#!/usr/bin/env bun
/**
 * Stream to RTMP — CDP Screencast Capture
 *
 * High-performance streaming pipeline that uses Chrome DevTools Protocol (CDP)
 * Page.startScreencast to capture frames directly from the Chromium compositor
 * and pipes them to FFmpeg for H.264 encoding.
 *
 * This is ~2-3x faster than the legacy MediaRecorder → WebSocket path because:
 * - No browser-side VP8/VP9 encoding (MediaRecorder eliminated)
 * - No WebSocket serialization/transfer overhead
 * - Single encode step: raw JPEG → H.264 (hardware accelerated on Mac)
 * - CDP captures from compositor regardless of headless/headful mode
 *
 * Architecture:
 *   Chromium Compositor → CDP screencastFrame → Node.js → FFmpeg stdin (JPEG pipe) → RTMP fanout
 *
 * Falls back to WebCodecs when CDP capture fails. MediaRecorder remains an
 * explicit operator/debug path when STREAM_CAPTURE_MODE=mediarecorder is set.
 *
 * Usage:
 *   bun run stream:rtmp
 *   bun run packages/server/scripts/stream-to-rtmp.ts
 *
 * Environment Variables:
 *   STREAM_CAPTURE_MODE      - 'cdp' (default), 'webcodecs', or 'mediarecorder' (debug)
 *   STREAM_ALLOW_WEBCODECS_CLOUDFLARE - 'true' to allow WebCodecs on cloudflare_live ingest
 *   STREAM_CAPTURE_HEADLESS  - 'true' for headless (default: false for better GPU rendering)
 *   STREAM_CAPTURE_CHANNEL   - Browser channel ('chrome', 'msedge', etc.)
 *   STREAM_CAPTURE_ANGLE     - ANGLE backend (default: metal on macOS, vulkan elsewhere)
 *   STREAM_CAPTURE_PRESERVE_STREAM_ROUTE - Keep /stream instead of rewriting to /stream.html
 *   CAPTURE_DISABLE_SANDBOX  - 'true' to launch Chromium with --no-sandbox
 *   STREAM_CDP_QUALITY       - JPEG quality for CDP screencast (1-100, default: 80)
 *   STREAM_FPS               - Target frames per second (default: 30)
 *   TWITCH_STREAM_KEY / TWITCH_RTMP_STREAM_KEY - Twitch stream key
 *   TWITCH_STREAM_URL / TWITCH_RTMP_URL / TWITCH_RTMP_SERVER - Twitch ingest URL
 *   YOUTUBE_STREAM_KEY / YOUTUBE_RTMP_STREAM_KEY - YouTube stream key
 *   YOUTUBE_STREAM_URL / YOUTUBE_RTMP_URL - YouTube ingest URL
 *   KICK_STREAM_KEY          - Kick stream key
 *   PUMPFUN_RTMP_URL         - Pump.fun RTMP URL
 *   X_RTMP_URL               - X/Twitter RTMP URL
 *   RTMP_DESTINATIONS_JSON   - JSON array fanout config
 *   STREAMING_VIEWER_ACCESS_TOKEN - Optional token appended as #streamToken for gated viewer WS bootstrap
 *   GAME_URL                 - URL to Hyperscape (default: http://localhost:3333/?page=stream)
 *   GAME_FALLBACK_URLS       - Comma-separated fallback URLs
 *   RTMP_BRIDGE_PORT         - WebSocket port for legacy bridge (default: 8765)
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page, type CDPSession } from "playwright";
import {
  getRTMPBridge,
  startRTMPBridge,
  generateCaptureScript,
  generateWebCodecsCaptureScript,
  generateWebCodecsExposedCaptureScript,
} from "../src/streaming/index.js";
import {
  resolveStreamDeliveryInfo,
  type StreamDeliveryInfo,
} from "../src/streaming/delivery-config.js";
import type {
  BrowserCaptureStatusSnapshot,
  StreamSourceCaptureMode,
  StreamSourceDegradedReason,
  StreamSourceRuntime,
} from "../src/streaming/source-runtime.js";
import { resolveBrowserCaptureLastFrameAt } from "../src/streaming/source-runtime.js";
import {
  resolveStreamIngestSettings,
  type StreamIngestSettings,
} from "../src/streaming/ingest-config.js";
import {
  readLocalHlsManifestSnapshot,
  resolveExternalStatusFile,
  type HlsManifestSnapshot,
} from "../src/streaming/stream-status-artifacts.js";
import {
  buildDefaultCaptureLaunchArgs,
  resolveAllowedCaptureOrigins,
  resolveUnexpectedCaptureOrigin,
  shouldAcceptCaptureReadiness,
  type CaptureRendererHealthSnapshot,
} from "../src/streaming/captureBrowserPolicy.js";
import { redactStreamingSecretsFromUrl } from "../src/streaming/redactStreamingUrl.js";
import { errMsg } from "../src/shared/errMsg.ts";
import { getStreamLeakDiagnostics } from "../src/streaming/stream-leak-diagnostics.js";
import { startX11NvencCapture } from "./capture/x11-nvenc.ts";

// Auto-enable leak diagnostics if STREAM_LEAK_DIAGNOSTICS=true.
// Installed before any timers are allocated so the counts are accurate.
getStreamLeakDiagnostics();

// ── Configuration ──────────────────────────────────────────────────────────

const GAME_URL = process.env.GAME_URL || "http://localhost:3333/stream.html";
const GAME_FALLBACK_URLS = (
  process.env.GAME_FALLBACK_URLS ||
  "http://localhost:3333/stream.html,http://localhost:3333/?embedded=true&mode=spectator,http://localhost:3333/"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const STREAMING_VIEWER_ACCESS_TOKEN = (
  process.env.STREAMING_VIEWER_ACCESS_TOKEN || ""
).trim();
const STREAM_CAPTURE_PRESERVE_STREAM_ROUTE = /^(1|true|yes|on)$/i.test(
  process.env.STREAM_CAPTURE_PRESERVE_STREAM_ROUTE || "",
);

type RequestedCaptureMode = "cdp" | "mediarecorder" | "webcodecs" | "x11_nvenc";

function resolveRequestedCaptureMode(
  env: NodeJS.ProcessEnv = process.env,
): RequestedCaptureMode {
  return (env.STREAM_CAPTURE_MODE?.trim() || "cdp") as RequestedCaptureMode;
}

function resolveEffectiveCaptureMode(
  env: NodeJS.ProcessEnv = process.env,
): RequestedCaptureMode {
  const requestedMode = resolveRequestedCaptureMode(env);
  const ingest = resolveStreamIngestSettings(env);
  const allowWebCodecsForCloudflare = /^(1|true|yes|on)$/i.test(
    env.STREAM_ALLOW_WEBCODECS_CLOUDFLARE || "",
  );
  // x11_nvenc is Cloudflare-safe (it does not go through the in-browser
  // WebCodecs encoder path that Cloudflare rejects), so the
  // webcodecs->cdp guardrail does not apply here.
  if (
    requestedMode === "webcodecs" &&
    ingest.profile === "cloudflare_live" &&
    !allowWebCodecsForCloudflare
  ) {
    return "cdp";
  }
  return requestedMode;
}

function normalizeCaptureGameUrl(rawUrl: string): string {
  // CDP reads frames from the compositor; x11_nvenc reads the same
  // compositor via x11grab on Xvfb. Both want the dedicated stream
  // entrypoint (no bridge params, no SPA player gate) — WebCodecs on the
  // other hand relies on the in-page capture bridge and keeps the raw URL.
  const mode = resolveEffectiveCaptureMode(process.env);
  if (mode !== "cdp" && mode !== "x11_nvenc") {
    return rawUrl;
  }

  try {
    const url = new URL(rawUrl);
    // The source encoder needs the dedicated stream entrypoint. The public
    // /stream route is a normal SPA route in some deployments and will try to
    // authenticate as a player.
    if (!STREAM_CAPTURE_PRESERVE_STREAM_ROUTE && url.pathname === "/stream") {
      url.pathname = "/stream.html";
    }
    // CDP capture reads frames directly from the compositor and does not
    // expose the legacy in-page WebSocket bridge. Leaving these params on the
    // stream URL makes the page repeatedly dial a bridge that will never exist.
    url.searchParams.delete("internalCapture");
    url.searchParams.delete("bridgeUrl");
    // Preserve an explicit source-capture hint so the stream entrypoint can
    // purge service workers/caches on Pages without re-enabling bridge capture.
    url.searchParams.set("streamCapture", "1");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function withViewerAccessToken(rawUrl: string): string {
  if (!STREAMING_VIEWER_ACCESS_TOKEN) return rawUrl;
  try {
    const url = new URL(rawUrl);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    hashParams.set("streamToken", STREAMING_VIEWER_ACCESS_TOKEN);
    url.hash = hashParams.toString();
    return url.toString();
  } catch {
    const separator = rawUrl.includes("#") ? "&" : "#";
    return `${rawUrl}${separator}streamToken=${encodeURIComponent(STREAMING_VIEWER_ACCESS_TOKEN)}`;
  }
}

const GAME_URL_CANDIDATES = Array.from(
  new Set(
    [GAME_URL, ...GAME_FALLBACK_URLS]
      .map(withViewerAccessToken)
      .map(normalizeCaptureGameUrl),
  ),
);
const ALLOWED_CAPTURE_ORIGINS =
  resolveAllowedCaptureOrigins(GAME_URL_CANDIDATES);

const BRIDGE_PORT = parseInt(process.env.RTMP_BRIDGE_PORT || "8765", 10);
const BRIDGE_URL = `ws://localhost:${BRIDGE_PORT}`;
const SPECTATOR_PORT = parseInt(process.env.SPECTATOR_PORT || "4180", 10);
const EXTERNAL_STATUS_FILE = resolveExternalStatusFile(process.env);
let externalStatusWriteErrored = false;

/**
 * Capture mode: 'cdp' is the production default, 'webcodecs' is the automatic
 * fallback, and 'mediarecorder' remains an explicit operator/debug mode.
 */
const REQUESTED_CAPTURE_MODE = resolveRequestedCaptureMode(process.env);
const CAPTURE_MODE = resolveEffectiveCaptureMode(process.env);
const STREAM_CAPTURE_HEADLESS = process.env.STREAM_CAPTURE_HEADLESS === "true";
const requestedCaptureChannel =
  process.env.STREAM_CAPTURE_CHANNEL?.trim() || "";
const STREAM_CAPTURE_CHANNEL =
  process.platform === "darwin" && requestedCaptureChannel === "chromium"
    ? "chrome"
    : requestedCaptureChannel;
const ANGLE_BACKEND =
  process.env.STREAM_CAPTURE_ANGLE?.trim() ||
  (process.platform === "darwin" ? "metal" : "vulkan");
const CAPTURE_DISABLE_SANDBOX = /^(1|true|yes|on)$/i.test(
  process.env.CAPTURE_DISABLE_SANDBOX || "",
);
const STREAM_CAPTURE_DISABLE_WEBGPU = /^(1|true|yes|on)$/i.test(
  process.env.STREAM_CAPTURE_DISABLE_WEBGPU || "",
);
if (STREAM_CAPTURE_DISABLE_WEBGPU) {
  throw new Error(
    "STREAM_CAPTURE_DISABLE_WEBGPU is not supported. Hyperscape capture is WebGPU-only.",
  );
}

function parseIntegerSetting(
  rawValue: string | undefined,
  fallback: number,
): number {
  const normalized = rawValue?.trim().replace(/_/g, "") ?? "";
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const CDP_QUALITY = Math.min(
  100,
  Math.max(1, parseIntegerSetting(process.env.STREAM_CDP_QUALITY, 80)),
);
const TARGET_FPS = parseIntegerSetting(process.env.STREAM_FPS, 30);
const STREAM_CAPTURE_WARMUP_MS = Math.max(
  250,
  parseIntegerSetting(process.env.STREAM_CAPTURE_WARMUP_MS, 1000),
);
const REQUIRE_IN_PAGE_READY_PROBE =
  process.env.STREAM_CAPTURE_REQUIRE_READY_PROBE === "true";
const USE_TIMED_STREAM_WARMUP =
  !REQUIRE_IN_PAGE_READY_PROBE &&
  process.platform === "linux" &&
  !STREAM_CAPTURE_HEADLESS;
const STREAM_CAPTURE_POST_NAV_DELAY_MS = Math.max(
  0,
  parseIntegerSetting(
    process.env.STREAM_CAPTURE_POST_NAV_DELAY_MS,
    USE_TIMED_STREAM_WARMUP ? 250 : 5000,
  ),
);

function parseEvenDimension(
  rawValue: string | undefined,
  fallback: number,
): number {
  const parsed = parseIntegerSetting(rawValue, fallback);
  const candidate = Number.isFinite(parsed) ? parsed : fallback;
  const clamped = Math.max(2, candidate);
  return clamped % 2 === 0 ? clamped : clamped - 1;
}

// Viewport settings (default 720p for stream stability)
const VIEWPORT = {
  width: parseEvenDimension(process.env.STREAM_CAPTURE_WIDTH, 1280),
  height: parseEvenDimension(process.env.STREAM_CAPTURE_HEIGHT, 720),
};

const XVFB_60HZ_MODELINES: Record<
  string,
  {
    modeName: string;
    modeline: string;
  }
> = {
  "1280x720": {
    modeName: "1280x720_60.00",
    modeline:
      '"1280x720_60.00" 74.50 1280 1344 1472 1664 720 723 728 748 -hsync +vsync',
  },
  "1920x1080": {
    modeName: "1920x1080_60.00",
    modeline:
      '"1920x1080_60.00" 173.00 1920 2048 2248 2576 1080 1083 1088 1120 -hsync +vsync',
  },
};

function resolveXvfb60HzMode(
  width: number,
  height: number,
): {
  modeName: string;
  modeline: string;
} | null {
  return XVFB_60HZ_MODELINES[`${width}x${height}`] ?? null;
}

let browser: Browser | null = null;
let page: Page | null = null;
// x11_nvenc mode spawns Chrome directly (outside of Playwright) so it can
// pass `--app=URL --kiosk` and produce a chromeless, full-bleed window that
// x11grab can capture without browser chrome or white margins. Playwright's
// `chromium.launch()` silently drops `--kiosk`, so the Playwright-launched
// browser re-exposes the tab bar + URL bar — confirmed by a failed preview
// on :201 during the first prod cutover attempt. We keep a handle to the
// externally-spawned Chrome process so cleanup() can SIGKILL it; the
// `browser` var above holds the CDP-attached Playwright Browser session,
// which owns no child process in this mode.
let x11NvencChromeProcess: ChildProcess | null = null;
let cdpSession: CDPSession | null = null;
let selectedGameUrl: string | null = null;
let latestSceneUrl: string | null = null;
let latestActiveBundle: string | null = null;
let launchTime = Date.now();
const BROWSER_RESTART_INTERVAL_MS = 1 * 60 * 60 * 1000; // 1 Hour
const CAPTURE_RECOVERY_TIMEOUT_MS = Math.max(
  10_000,
  parseIntegerSetting(process.env.STREAM_CAPTURE_RECOVERY_TIMEOUT_MS, 30_000),
);
const CAPTURE_RECOVERY_MAX_FAILURES = Math.max(
  1,
  parseIntegerSetting(process.env.STREAM_CAPTURE_RECOVERY_MAX_FAILURES, 2),
);
const CDP_STARTUP_TIMEOUT_MS = Math.max(
  5_000,
  parseIntegerSetting(process.env.STREAM_CAPTURE_START_TIMEOUT_MS, 15_000),
);
const SOURCE_CAPTURE_STALL_MS = Math.max(
  5_000,
  parseIntegerSetting(process.env.STREAM_SOURCE_CAPTURE_STALL_MS, 10_000),
);
const SOURCE_VISUAL_CHANGE_STALE_MS = Math.max(
  5_000,
  parseIntegerSetting(process.env.STREAM_SOURCE_VISUAL_CHANGE_STALE_MS, 10_000),
);
const INGEST_SETTINGS = resolveStreamIngestSettings(process.env);
const WEBCODECS_VIDEO_BITRATE_BPS =
  parseIntegerSetting(
    process.env.STREAM_VIDEO_BITRATE_KBPS,
    INGEST_SETTINGS.profile === "cloudflare_live" ? 4_800 : 6_000,
  ) * 1_000;
const SOURCE_DEGRADED_RESTART_POLLS = Math.max(
  2,
  parseIntegerSetting(process.env.STREAM_SOURCE_DEGRADED_RESTART_POLLS, 6),
);
const PAGE_READINESS_STALL_MS = Math.max(
  30_000,
  parseIntegerSetting(
    process.env.STREAM_SOURCE_PAGE_READINESS_STALL_MS,
    5 * 60_000,
  ),
);
const SOURCE_PROBE_TIMEOUT_MS = Math.max(
  1_000,
  parseIntegerSetting(process.env.STREAM_SOURCE_PROBE_TIMEOUT_MS, 5_000),
);
const SOURCE_RECOVERY_READY_TIMEOUT_MS = Math.max(
  10_000,
  parseIntegerSetting(
    process.env.STREAM_SOURCE_RECOVERY_READY_TIMEOUT_MS,
    60_000,
  ),
);
const FATAL_WRITE_PAGE_STALL_THRESHOLD_MS = Math.max(
  2_000,
  Math.min(5_000, Math.floor(SOURCE_CAPTURE_STALL_MS / 2)),
);
const CDP_FRAME_PUMP_INTERVAL_MS = Math.max(
  16,
  Math.round(1000 / Math.max(1, TARGET_FPS)),
);
const CDP_EVERY_NTH_FRAME = Math.max(
  1,
  parseIntegerSetting(
    process.env.STREAM_CDP_EVERY_NTH_FRAME,
    Math.max(1, Math.round(60 / Math.max(1, TARGET_FPS))),
  ),
);

if (REQUESTED_CAPTURE_MODE !== CAPTURE_MODE) {
  console.warn(
    `[Main] Overriding STREAM_CAPTURE_MODE=${REQUESTED_CAPTURE_MODE} to ${CAPTURE_MODE} for ${INGEST_SETTINGS.profile} ingest so canonical delivery uses server-side encoding`,
  );
}

// ── CDP Frame Rate Tracking ────────────────────────────────────────────────

let cdpFrameCount = 0;
let cdpFps = 0;
let cdpFpsIntervalId: ReturnType<typeof setInterval> | null = null;
let cdpDroppedFrames = 0;
let lastCaptureFrameAt: number | null = null;
let lastEncodedFrameAt: number | null = null;
let latestCdpFrameBuffer: Buffer | null = null;
let cdpFramePumpIntervalId: ReturnType<typeof setInterval> | null = null;
let cdpRepeatedFrameCount = 0;
let latestRenderTickAt: number | null = null;
let latestDuelStateTickAt: number | null = null;
let latestVisualChangeAt: number | null = null;
let lastVisualSampleHash: string | null = null;
let lastObservedRenderTick = 0;
let lastObservedDuelStateTick = 0;

function startFpsTracking() {
  if (cdpFpsIntervalId) clearInterval(cdpFpsIntervalId);
  cdpFrameCount = 0;
  cdpFps = 0;
  cdpFpsIntervalId = setInterval(() => {
    cdpFps = cdpFrameCount;
    cdpFrameCount = 0;
  }, 1000);
}

function stopFpsTracking() {
  if (cdpFpsIntervalId) {
    clearInterval(cdpFpsIntervalId);
    cdpFpsIntervalId = null;
  }
}

function feedCdpFrameToEncoder(
  bridge: ReturnType<typeof getRTMPBridge>,
  jpegBuffer: Buffer,
  options: {
    frameAt: number;
    cdpTimestamp: number | null;
    repeated: boolean;
  },
): boolean {
  const written = bridge.feedFrame(jpegBuffer, {
    frameAt: options.frameAt,
    cdpTimestamp: options.cdpTimestamp,
  });
  if (written) {
    lastEncodedFrameAt = options.frameAt;
    if (options.repeated) {
      cdpRepeatedFrameCount += 1;
    } else {
      cdpFrameCount += 1;
    }
  } else {
    cdpDroppedFrames += 1;
  }
  return written;
}

function startCdpFramePump(bridge: ReturnType<typeof getRTMPBridge>): void {
  if (cdpFramePumpIntervalId) {
    clearInterval(cdpFramePumpIntervalId);
  }
  cdpFramePumpIntervalId = setInterval(() => {
    if (!latestCdpFrameBuffer) return;
    if (bridge.getStatus().ffmpegRunning !== true) return;

    const nowMs = Date.now();
    if (
      lastEncodedFrameAt != null &&
      nowMs - lastEncodedFrameAt < CDP_FRAME_PUMP_INTERVAL_MS
    ) {
      return;
    }

    // CDP screencast is event-driven; a static but valid live scene can stop
    // emitting frames. A live encoder still needs continuous input, so repeat
    // the latest real browser frame while renderer health reports content truth.
    feedCdpFrameToEncoder(bridge, latestCdpFrameBuffer, {
      frameAt: nowMs,
      cdpTimestamp: null,
      repeated: true,
    });
  }, CDP_FRAME_PUMP_INTERVAL_MS);
}

function stopCdpFramePump(): void {
  if (cdpFramePumpIntervalId) {
    clearInterval(cdpFramePumpIntervalId);
    cdpFramePumpIntervalId = null;
  }
}

type ActiveCaptureMode = Exclude<StreamSourceCaptureMode, "none">;

type RendererHeartbeatSnapshot = {
  renderTick: number;
  latestRenderTickAt: number | null;
  duelStateTick: number;
  latestDuelStateTickAt: number | null;
};

type RendererMetricsSnapshot = {
  captureFps: number | null;
  encodeFps: number | null;
  droppedFrames: number;
  renderTick: number;
  duelStateTick: number;
  latestFrameAt: number | null;
  latestRenderTickAt: number | null;
  latestDuelStateTickAt: number | null;
  latestVisualChangeAt: number | null;
  visualChangeAgeMs: number | null;
};

type CaptureDiagnosticsFrameSnapshot = {
  at: number;
  size: number;
  cdpTimestamp: number | null;
};

type CaptureDiagnosticsBackpressureSnapshot = {
  at: number;
  backpressured: boolean;
};

type CaptureDiagnosticsFatalWriteSnapshot = {
  at: number;
  message: string;
  frameCount: number;
  droppedFrames: number;
  bytesReceived: number;
  backpressured: boolean;
  cdpDirectMode: boolean;
  uptimeMs: number;
};

type CaptureDiagnosticsSnapshot = {
  recentFrames: CaptureDiagnosticsFrameSnapshot[];
  recentFrameCadenceMs: number[];
  nonMonotonicCdpTimestampCount: number;
  backpressureTransitions: CaptureDiagnosticsBackpressureSnapshot[];
  firstFatalWriteError: CaptureDiagnosticsFatalWriteSnapshot | null;
  lastFatalWriteError: CaptureDiagnosticsFatalWriteSnapshot | null;
  pageStallBeforeLastFatalWrite: boolean | null;
  lastFrameAgeMs: number | null;
  captureSessionGeneration: string | null;
  browserCapture: {
    recording: boolean | null;
    wsConnected: boolean | null;
    chunkCount: number | null;
    bytesSent: number | null;
    lastChunkAt: number | null;
    lastChunkAgeMs: number | null;
    lastChunkMs: number | null;
  };
};

type RendererSmokeSnapshot = {
  currentSceneUrl: string | null;
  activeBundle: string | null;
  deliveryMode: StreamDeliveryInfo["mode"];
  captureFpsP50: number | null;
  captureFpsP95: number | null;
  encodeFpsP50: number | null;
  encodeFpsP95: number | null;
  updatedAt: number;
  ingest: RendererIngestSnapshot;
};

type RendererIngestSnapshot = {
  profile: StreamIngestSettings["profile"];
  transport: StreamIngestSettings["transport"];
  audioSampleRate: number;
  gopFrames: number;
  probeOnly: boolean;
};

type RendererHealthSnapshot = CaptureRendererHealthSnapshot & {
  updatedAt: number | null;
  phase: string | null;
};

type RendererCanvasRectSnapshot = {
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

let latestRendererHealth: RendererHealthSnapshot = {
  ready: false,
  degradedReason: "capture_not_initialized",
  updatedAt: null,
  phase: null,
  diagnostics: null,
};
let rendererHealthProbeInFlight: Promise<RendererHealthSnapshot> | null = null;
let browserCaptureStatusProbeInFlight: Promise<BrowserCaptureStatus | null> | null =
  null;
let captureNavigationAbortInFlight = false;
let latestBrowserCaptureStatus: BrowserCaptureStatus | null = null;
let sourceRecoveryCount = 0;
let sourceLastRecoveryAt: number | null = null;
const FPS_SAMPLE_RETENTION_MS = 60_000;
const captureFpsSamples: Array<{ at: number; value: number }> = [];
const encodeFpsSamples: Array<{ at: number; value: number }> = [];

function pruneFpsSamples(nowMs: number): void {
  while (
    captureFpsSamples.length > 0 &&
    nowMs - captureFpsSamples[0]!.at > FPS_SAMPLE_RETENTION_MS
  ) {
    captureFpsSamples.shift();
  }
  while (
    encodeFpsSamples.length > 0 &&
    nowMs - encodeFpsSamples[0]!.at > FPS_SAMPLE_RETENTION_MS
  ) {
    encodeFpsSamples.shift();
  }
}

function recordFpsSample(
  samples: Array<{ at: number; value: number }>,
  value: number | null,
  nowMs: number,
): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return;
  }
  samples.push({ at: nowMs, value });
}

function percentileFromSamples(
  samples: ReadonlyArray<{ at: number; value: number }>,
  percentile: number,
): number | null {
  if (samples.length === 0) return null;
  const sorted = samples.map((sample) => sample.value).sort((a, b) => a - b);
  const clampedPercentile = Math.max(0, Math.min(1, percentile));
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * clampedPercentile)),
  );
  const value = sorted[index];
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function buildRendererMetricsSnapshot(
  bridge: ReturnType<typeof getRTMPBridge>,
  captureMode: ActiveCaptureMode,
): RendererMetricsSnapshot {
  const stats = bridge.getStats();
  const nowMs = Date.now();
  const captureFps = captureMode === "cdp" ? cdpFps : null;
  const encodeFps =
    typeof stats.encoderFps === "number" && Number.isFinite(stats.encoderFps)
      ? stats.encoderFps
      : null;
  recordFpsSample(captureFpsSamples, captureFps, nowMs);
  recordFpsSample(encodeFpsSamples, encodeFps, nowMs);
  pruneFpsSamples(nowMs);

  return {
    captureFps,
    encodeFps,
    droppedFrames: Math.max(stats.droppedFrames, cdpDroppedFrames),
    renderTick: lastObservedRenderTick,
    duelStateTick: lastObservedDuelStateTick,
    latestFrameAt: lastEncodedFrameAt ?? lastCaptureFrameAt,
    latestRenderTickAt,
    latestDuelStateTickAt,
    latestVisualChangeAt,
    visualChangeAgeMs:
      latestVisualChangeAt != null
        ? Math.max(0, Date.now() - latestVisualChangeAt)
        : null,
  };
}

function buildCaptureDiagnosticsSnapshot(
  bridge: ReturnType<typeof getRTMPBridge>,
): CaptureDiagnosticsSnapshot {
  const diagnostics = bridge.getCaptureDiagnostics();
  const lastFatalWriteError = diagnostics.lastFatalWriteError
    ? { ...diagnostics.lastFatalWriteError }
    : null;
  const latestFrameAt =
    typeof lastEncodedFrameAt === "number" &&
    Number.isFinite(lastEncodedFrameAt)
      ? lastEncodedFrameAt
      : typeof lastCaptureFrameAt === "number" &&
          Number.isFinite(lastCaptureFrameAt)
        ? lastCaptureFrameAt
        : null;

  return {
    recentFrames: diagnostics.recentFrames.map((sample) => ({
      at: sample.at,
      size: sample.size,
      cdpTimestamp: sample.cdpTimestamp,
    })),
    recentFrameCadenceMs: [...diagnostics.recentFrameCadenceMs],
    nonMonotonicCdpTimestampCount: diagnostics.nonMonotonicCdpTimestampCount,
    backpressureTransitions: diagnostics.backpressureTransitions.map(
      (transition) => ({
        at: transition.at,
        backpressured: transition.backpressured,
      }),
    ),
    firstFatalWriteError: diagnostics.firstFatalWriteError
      ? { ...diagnostics.firstFatalWriteError }
      : null,
    lastFatalWriteError,
    pageStallBeforeLastFatalWrite:
      lastFatalWriteError == null
        ? null
        : latestFrameAt == null
          ? true
          : lastFatalWriteError.at - latestFrameAt >=
            FATAL_WRITE_PAGE_STALL_THRESHOLD_MS,
    lastFrameAgeMs:
      latestFrameAt == null ? null : Math.max(0, Date.now() - latestFrameAt),
    captureSessionGeneration:
      latestBrowserCaptureStatus?.captureSessionGeneration ?? null,
    browserCapture: {
      recording:
        typeof latestBrowserCaptureStatus?.recording === "boolean"
          ? latestBrowserCaptureStatus.recording
          : null,
      wsConnected:
        typeof latestBrowserCaptureStatus?.wsConnected === "boolean"
          ? latestBrowserCaptureStatus.wsConnected
          : null,
      chunkCount:
        typeof latestBrowserCaptureStatus?.chunkCount === "number" &&
        Number.isFinite(latestBrowserCaptureStatus.chunkCount)
          ? latestBrowserCaptureStatus.chunkCount
          : null,
      bytesSent:
        typeof latestBrowserCaptureStatus?.bytesSent === "number" &&
        Number.isFinite(latestBrowserCaptureStatus.bytesSent)
          ? latestBrowserCaptureStatus.bytesSent
          : null,
      lastChunkAt:
        typeof latestBrowserCaptureStatus?.lastChunkAt === "number" &&
        Number.isFinite(latestBrowserCaptureStatus.lastChunkAt)
          ? latestBrowserCaptureStatus.lastChunkAt
          : null,
      lastChunkAgeMs:
        typeof latestBrowserCaptureStatus?.lastChunkAgeMs === "number" &&
        Number.isFinite(latestBrowserCaptureStatus.lastChunkAgeMs)
          ? latestBrowserCaptureStatus.lastChunkAgeMs
          : null,
      lastChunkMs:
        typeof latestBrowserCaptureStatus?.lastChunkMs === "number" &&
        Number.isFinite(latestBrowserCaptureStatus.lastChunkMs)
          ? latestBrowserCaptureStatus.lastChunkMs
          : null,
    },
  };
}

function buildRendererSmokeSnapshot(
  delivery: StreamDeliveryInfo,
): RendererSmokeSnapshot {
  const nowMs = Date.now();
  const ingest = resolveStreamIngestSettings(process.env);
  pruneFpsSamples(nowMs);
  return {
    currentSceneUrl: resolveStatusSceneUrl(),
    activeBundle: latestActiveBundle,
    deliveryMode: delivery.mode,
    captureFpsP50: percentileFromSamples(captureFpsSamples, 0.5),
    captureFpsP95: percentileFromSamples(captureFpsSamples, 0.95),
    encodeFpsP50: percentileFromSamples(encodeFpsSamples, 0.5),
    encodeFpsP95: percentileFromSamples(encodeFpsSamples, 0.95),
    updatedAt: nowMs,
    ingest: {
      profile: ingest.profile,
      transport: ingest.transport,
      audioSampleRate: ingest.audioSampleRate,
      gopFrames: ingest.gopFrames,
      targetFps: TARGET_FPS,
      probeOnly: ingest.probeOnly,
    },
  };
}

function recordSourceRecovery(reason: string): void {
  sourceRecoveryCount += 1;
  sourceLastRecoveryAt = Date.now();
  console.log(`[Main] Source recovery recorded: ${reason}`);
}

function mapRendererReasonToSourceDegradedReason(
  degradedReason: string | null | undefined,
): StreamSourceDegradedReason | null {
  const normalized = (degradedReason ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized === "capture_page_missing" ||
    normalized === "loading_overlay_active" ||
    normalized === "canvas_missing" ||
    normalized === "initialization_failed" ||
    normalized === "asset_origin_incomplete" ||
    normalized === "socket_disconnected" ||
    normalized === "stream_state_missing" ||
    normalized === "waiting_for_duel_data" ||
    normalized === "world_not_ready" ||
    normalized === "terrain_not_ready" ||
    normalized === "camera_target_unresolved" ||
    normalized === "avatar_not_ready" ||
    normalized === "initializing" ||
    normalized === "agents_missing" ||
    normalized === "invalid_agent_hp" ||
    normalized === "arena_positions_invalid" ||
    normalized.startsWith("probe_failed:")
  ) {
    return "page_not_ready";
  }
  if (
    normalized === "render_tick_stale" ||
    normalized === "visual_change_stale" ||
    normalized === "capture_fps_low"
  ) {
    return "capture_stalled";
  }
  // Renderer reported low encoder FPS: the compositor-to-FFmpeg pipeline
  // is producing below-target cadence. Previously this fell through to
  // `null`, leaving `sourceRuntime.ready=true` even while the downstream
  // broadcast path was starving. Route it through `encoder_stalled` so
  // the top-level readiness surface stays honest.
  if (normalized === "encoder_fps_low") {
    return "encoder_stalled";
  }
  return null;
}

function rendererPhaseNeedsVisualChange(
  phase: string | null | undefined,
): boolean {
  const normalized = (phase ?? "").trim().toUpperCase();
  return (
    normalized === "COUNTDOWN" ||
    normalized === "FIGHTING" ||
    normalized === "RESOLUTION"
  );
}

function sourceVisualChangeIsStale(nowMs: number): boolean {
  if (!rendererPhaseNeedsVisualChange(latestRendererHealth.phase)) {
    return false;
  }

  const latestVisualChangeAgeMs =
    latestVisualChangeAt == null
      ? null
      : Math.max(0, nowMs - latestVisualChangeAt);
  return (
    latestVisualChangeAgeMs == null ||
    latestVisualChangeAgeMs > SOURCE_VISUAL_CHANGE_STALE_MS
  );
}

function resolveStatusSceneUrl(): string | null {
  const sceneUrl = latestSceneUrl ?? selectedGameUrl;
  return sceneUrl ? redactStreamingSecretsFromUrl(sceneUrl) : null;
}

function hashVisualSample(buffer: Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

function resolveVisualSampleClip(
  canvasRect: RendererCanvasRectSnapshot | unknown,
  viewport: { width: number; height: number } | null,
): { x: number; y: number; width: number; height: number } | null {
  if (!viewport || !canvasRect || typeof canvasRect !== "object") {
    return null;
  }
  const rect = canvasRect as Partial<NonNullable<RendererCanvasRectSnapshot>>;
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 96 ||
    height < 96
  ) {
    return null;
  }

  const sampleX = Math.max(0, x + width * 0.15);
  const sampleY = Math.max(0, y + height * 0.2);
  const sampleWidth = Math.min(width * 0.7, viewport.width - sampleX);
  const sampleHeight = Math.min(height * 0.6, viewport.height - sampleY);
  if (sampleWidth < 64 || sampleHeight < 64) {
    return null;
  }
  return {
    x: sampleX,
    y: sampleY,
    width: sampleWidth,
    height: sampleHeight,
  };
}

function resolveSourceRuntimeSnapshot(
  bridge: ReturnType<typeof getRTMPBridge>,
  captureMode: ActiveCaptureMode,
): StreamSourceRuntime {
  const nowMs = Date.now();
  const bridgeStatus = bridge.getStatus();
  const ingest = resolveStreamIngestSettings(process.env);
  const hlsManifest = readLocalHlsManifestSnapshot(process.env);
  const browserCaptureLastFrameAt = resolveBrowserCaptureLastFrameAt(
    latestBrowserCaptureStatus as BrowserCaptureStatusSnapshot | null,
    nowMs,
  );
  // x11_nvenc has no browser-side or CDP-side frame timestamps — the
  // authoritative liveness is FFmpeg's own `frame=` progression, exposed by
  // the bridge. Fall back to `lastEncodedFrameAt` only if the bridge hasn't
  // yet reported an encoder frame (expected briefly at startup).
  const lastFrameAt =
    captureMode === "x11_nvenc"
      ? (bridge.getLastEncoderFrameAt() ?? lastEncodedFrameAt)
      : captureMode === "cdp"
        ? (lastEncodedFrameAt ?? lastCaptureFrameAt)
        : browserCaptureLastFrameAt;
  const rendererReason = mapRendererReasonToSourceDegradedReason(
    latestRendererHealth.degradedReason,
  );
  const visualChangeStale = sourceVisualChangeIsStale(nowMs);

  // Any destination with a recent fatal-write error is authoritative
  // evidence the broadcast path is dark — don't trust FFmpeg's
  // `frame=` progress alone.
  const DESTINATION_ERROR_RECENT_MS = 15_000;
  const lastDestErrorAt = bridge.getLastDestinationWriteErrorAt?.() ?? null;
  const destinationRecentlyErrored =
    lastDestErrorAt != null &&
    nowMs - lastDestErrorAt < DESTINATION_ERROR_RECENT_MS;
  // Encoder falling behind real-time — the stream will drift from live,
  // and Cloudflare will refuse to promote the input to live until cadence
  // recovers. Threshold at 0.9 leaves a little slack for normal jitter.
  const encoderSpeed = bridge.getEncoderSpeed?.() ?? null;
  const encoderBelowRealtime =
    encoderSpeed != null && Number.isFinite(encoderSpeed) && encoderSpeed < 0.9;

  let degradedReason: StreamSourceDegradedReason | null = null;
  if (captureNavigationAbortInFlight) {
    degradedReason = "unexpected_navigation";
  } else if (captureMode === "x11_nvenc") {
    // x11_nvenc mode does not attach Playwright — Chrome is a detached
    // child process and `browser`/`page` are null by design (see
    // spawnX11NvencChromeProcess). Treat Chrome-child liveness as the
    // authoritative "render browser is up" signal for this mode.
    if (!x11NvencChromeProcess || x11NvencChromeProcess.killed) {
      degradedReason = "browser_missing";
    }
  } else if (!browser || !page || page.isClosed()) {
    degradedReason = "browser_missing";
  } else if (destinationRecentlyErrored) {
    degradedReason = "destination_disconnected";
  } else if (rendererReason) {
    degradedReason = rendererReason;
  } else if (visualChangeStale) {
    degradedReason = "capture_stalled";
  } else if (bridgeStatus.ffmpegRunning !== true) {
    degradedReason = "encoder_stalled";
  } else if (encoderBelowRealtime) {
    degradedReason = "encoder_stalled";
  } else if (
    (captureMode === "cdp" || captureMode === "x11_nvenc") &&
    (lastFrameAt == null || nowMs - lastFrameAt > SOURCE_CAPTURE_STALL_MS)
  ) {
    degradedReason = "capture_stalled";
  } else if (
    captureMode !== "cdp" &&
    captureMode !== "x11_nvenc" &&
    !latestBrowserCaptureStatus?.captureSessionGeneration
  ) {
    degradedReason = "page_not_ready";
  } else if (
    captureMode !== "cdp" &&
    captureMode !== "x11_nvenc" &&
    (bridgeStatus.clientConnected !== true ||
      latestBrowserCaptureStatus?.recording !== true ||
      latestBrowserCaptureStatus?.wsConnected !== true ||
      lastFrameAt == null ||
      nowMs - lastFrameAt > SOURCE_CAPTURE_STALL_MS)
  ) {
    degradedReason = "capture_stalled";
  } else if (
    !ingest.probeOnly &&
    typeof hlsManifest?.updatedAt === "number" &&
    Number.isFinite(hlsManifest.updatedAt) &&
    nowMs - hlsManifest.updatedAt > SOURCE_CAPTURE_STALL_MS
  ) {
    degradedReason = "manifest_stale";
  }

  return {
    ready: degradedReason == null,
    statusSource: "external_worker",
    captureMode,
    degradedReason,
    currentSceneUrl: resolveStatusSceneUrl(),
    activeBundle: latestActiveBundle,
    lastFrameAt,
    lastRenderTickAt: latestRenderTickAt,
    lastVisualChangeAt: latestVisualChangeAt,
    lastRecoveryAt: sourceLastRecoveryAt,
    recoveryCount: sourceRecoveryCount,
    workerHeartbeatAt: nowMs,
  };
}

function writeExternalStatusSnapshot(
  bridge: ReturnType<typeof getRTMPBridge>,
  captureMode: ActiveCaptureMode,
): StreamSourceRuntime | null {
  const sourceRuntime = resolveSourceRuntimeSnapshot(bridge, captureMode);
  if (!EXTERNAL_STATUS_FILE) return sourceRuntime;

  const bridgeStatus = bridge.getStatus();
  const stats = bridge.getStats();
  const processMemory = process.memoryUsage();
  const delivery: StreamDeliveryInfo = resolveStreamDeliveryInfo(process.env);
  const ingest = resolveStreamIngestSettings(process.env);
  const hlsManifest = readLocalHlsManifestSnapshot(process.env);
  const metrics = buildRendererMetricsSnapshot(bridge, captureMode);
  const captureDiagnostics = buildCaptureDiagnosticsSnapshot(bridge);
  const smoke = buildRendererSmokeSnapshot(delivery);
  const payload = {
    ...bridgeStatus,
    stats: {
      bytesReceived: stats.bytesReceived,
      bytesReceivedMB: (stats.bytesReceived / 1024 / 1024).toFixed(2),
      uptimeSeconds: Math.floor(stats.uptime / 1000),
      destinations: stats.destinations,
      healthy: stats.healthy,
      droppedFrames: stats.droppedFrames,
      encoderFps: stats.encoderFps,
      backpressured: stats.backpressured,
      spectators: stats.spectators,
      processMemory: stats.processMemory,
    },
    captureMode,
    metrics,
    hlsManifest,
    delivery,
    ingest: {
      profile: ingest.profile,
      transport: ingest.transport,
      audioSampleRate: ingest.audioSampleRate,
      gopFrames: ingest.gopFrames,
      targetFps: TARGET_FPS,
      probeOnly: ingest.probeOnly,
    },
    smoke,
    sourceRuntime,
    captureDiagnostics,
    processRssBytes: processMemory.rss,
    rendererHealth: latestRendererHealth,
    updatedAt: Date.now(),
    source: "external-rtmp-bridge",
  };

  try {
    fs.mkdirSync(path.dirname(EXTERNAL_STATUS_FILE), { recursive: true });
    fs.writeFileSync(EXTERNAL_STATUS_FILE, JSON.stringify(payload));
    externalStatusWriteErrored = false;
  } catch (err) {
    if (!externalStatusWriteErrored) {
      externalStatusWriteErrored = true;
      console.warn(
        `[Main] Failed to write RTMP status file (${EXTERNAL_STATUS_FILE}):`,
        err,
      );
    }
  }
  return sourceRuntime;
}

function clearExternalStatusSnapshot(): void {
  if (!EXTERNAL_STATUS_FILE) return;
  try {
    fs.unlinkSync(EXTERNAL_STATUS_FILE);
  } catch {
    // Ignore stale/missing status file cleanup errors.
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────

function isTransientPageEvalError(err: unknown): boolean {
  const message = errMsg(err);
  return (
    message.includes("Execution context was destroyed") ||
    message.includes("Cannot find context with specified id") ||
    message.includes("Most likely because of a navigation") ||
    message.includes("Target page, context or browser has been closed")
  );
}

function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    operation
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function hasConfiguredOutput(): boolean {
  const hasTwitchKey = Boolean(
    process.env.TWITCH_STREAM_KEY || process.env.TWITCH_RTMP_STREAM_KEY,
  );
  const hasYoutubeKey = Boolean(
    process.env.YOUTUBE_STREAM_KEY || process.env.YOUTUBE_RTMP_STREAM_KEY,
  );
  return Boolean(
    process.env.RTMP_MULTIPLEXER_URL ||
    hasTwitchKey ||
    hasYoutubeKey ||
    process.env.KICK_STREAM_KEY ||
    process.env.PUMPFUN_RTMP_URL ||
    process.env.X_RTMP_URL ||
    process.env.RTMP_DESTINATIONS_JSON,
  );
}

async function probeRendererHealth(
  pageRef: Page,
): Promise<RendererHealthSnapshot> {
  const probedAt = Date.now();
  const probe = await pageRef.evaluate(() => {
    // This shape mirrors StreamingWindowRendererHealth from the client bundle.
    // Playwright evaluate runs in the browser context, so runtime imports are
    // intentionally avoided here.
    const win = window as unknown as {
      __HYPERSCAPE_STREAM_READY__?: boolean;
      __HYPERSCAPE_STREAM_RENDERER_HEALTH__?: {
        ready?: boolean;
        degradedReason?: string | null;
        updatedAt?: number | null;
        phase?: string | null;
      } | null;
      __HYPERSCAPE_STREAM_HEARTBEAT__?: {
        renderTick?: number;
        latestRenderTickAt?: number | null;
        duelStateTick?: number;
        latestDuelStateTickAt?: number | null;
      } | null;
      __HYPERSCAPE_STREAM_BOOT_STATUS__?: string | null;
      __HYPERSCAPE_STREAM_BOOT_DIAGNOSTICS__?: unknown;
    };
    const activeBundle =
      Array.from(
        document.querySelectorAll<HTMLScriptElement>("script[src]"),
      ).find(
        (script) =>
          script.src.includes("StreamingMode-") ||
          script.src.includes("framework.client-"),
      )?.src ?? null;
    const explicitHealth =
      win.__HYPERSCAPE_STREAM_RENDERER_HEALTH__ &&
      typeof win.__HYPERSCAPE_STREAM_RENDERER_HEALTH__ === "object"
        ? {
            ready: win.__HYPERSCAPE_STREAM_RENDERER_HEALTH__.ready === true,
            degradedReason:
              typeof win.__HYPERSCAPE_STREAM_RENDERER_HEALTH__
                .degradedReason === "string"
                ? win.__HYPERSCAPE_STREAM_RENDERER_HEALTH__.degradedReason
                : null,
            updatedAt:
              typeof win.__HYPERSCAPE_STREAM_RENDERER_HEALTH__.updatedAt ===
                "number" &&
              Number.isFinite(
                win.__HYPERSCAPE_STREAM_RENDERER_HEALTH__.updatedAt,
              )
                ? win.__HYPERSCAPE_STREAM_RENDERER_HEALTH__.updatedAt
                : null,
            phase:
              typeof win.__HYPERSCAPE_STREAM_RENDERER_HEALTH__.phase ===
              "string"
                ? win.__HYPERSCAPE_STREAM_RENDERER_HEALTH__.phase
                : null,
          }
        : null;

    // Read boot status from a lightweight window global instead of
    // document.body.textContent which forces full text computation of
    // the game DOM every probe interval and can cause layout thrashing.
    const bootStatus =
      typeof win.__HYPERSCAPE_STREAM_BOOT_STATUS__ === "string"
        ? win.__HYPERSCAPE_STREAM_BOOT_STATUS__
        : null;

    const hasStreamingBootUi =
      !explicitHealth &&
      bootStatus !== null &&
      !bootStatus.startsWith("error:");
    const hasCriticalErrorUi =
      !explicitHealth && bootStatus !== null && bootStatus.startsWith("error:");
    const heartbeat =
      win.__HYPERSCAPE_STREAM_HEARTBEAT__ &&
      typeof win.__HYPERSCAPE_STREAM_HEARTBEAT__ === "object"
        ? {
            renderTick:
              typeof win.__HYPERSCAPE_STREAM_HEARTBEAT__.renderTick ===
                "number" &&
              Number.isFinite(win.__HYPERSCAPE_STREAM_HEARTBEAT__.renderTick)
                ? win.__HYPERSCAPE_STREAM_HEARTBEAT__.renderTick
                : 0,
            latestRenderTickAt:
              typeof win.__HYPERSCAPE_STREAM_HEARTBEAT__.latestRenderTickAt ===
                "number" &&
              Number.isFinite(
                win.__HYPERSCAPE_STREAM_HEARTBEAT__.latestRenderTickAt,
              )
                ? win.__HYPERSCAPE_STREAM_HEARTBEAT__.latestRenderTickAt
                : null,
            duelStateTick:
              typeof win.__HYPERSCAPE_STREAM_HEARTBEAT__.duelStateTick ===
                "number" &&
              Number.isFinite(win.__HYPERSCAPE_STREAM_HEARTBEAT__.duelStateTick)
                ? win.__HYPERSCAPE_STREAM_HEARTBEAT__.duelStateTick
                : 0,
            latestDuelStateTickAt:
              typeof win.__HYPERSCAPE_STREAM_HEARTBEAT__
                .latestDuelStateTickAt === "number" &&
              Number.isFinite(
                win.__HYPERSCAPE_STREAM_HEARTBEAT__.latestDuelStateTickAt,
              )
                ? win.__HYPERSCAPE_STREAM_HEARTBEAT__.latestDuelStateTickAt
                : null,
          }
        : null;
    let frameHash: string | null = null;
    const preferredCanvas =
      document.querySelector("#hyperscape-world-canvas") ??
      document.querySelector("#game-canvas canvas") ??
      document.querySelector("[data-component='viewport'] canvas");
    const canvasCandidates = Array.from(
      document.querySelectorAll("canvas"),
    ).filter(
      (candidate): candidate is HTMLCanvasElement =>
        candidate instanceof HTMLCanvasElement,
    );
    const largestCanvas = canvasCandidates.slice().sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const leftArea =
        Math.max(leftRect.width, left.width) *
        Math.max(leftRect.height, left.height);
      const rightArea =
        Math.max(rightRect.width, right.width) *
        Math.max(rightRect.height, right.height);
      return rightArea - leftArea;
    })[0];
    const canvas =
      preferredCanvas instanceof HTMLCanvasElement
        ? preferredCanvas
        : (largestCanvas ?? null);
    const canvasRect =
      canvas instanceof HTMLCanvasElement
        ? (() => {
            const rect = canvas.getBoundingClientRect();
            const x = Number(rect.x);
            const y = Number(rect.y);
            const width = Number(rect.width);
            const height = Number(rect.height);
            return Number.isFinite(x) &&
              Number.isFinite(y) &&
              Number.isFinite(width) &&
              Number.isFinite(height) &&
              width > 0 &&
              height > 0
              ? { x, y, width, height }
              : null;
          })()
        : null;
    if (canvas instanceof HTMLCanvasElement) {
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = 32;
      sampleCanvas.height = 18;
      const context = sampleCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      if (context) {
        try {
          context.drawImage(
            canvas,
            0,
            0,
            sampleCanvas.width,
            sampleCanvas.height,
          );
          const imageData = context.getImageData(
            0,
            0,
            sampleCanvas.width,
            sampleCanvas.height,
          ).data;
          let hash = 2166136261;
          for (let i = 0; i < imageData.length; i += 16) {
            hash ^= imageData[i] ?? 0;
            hash = Math.imul(hash, 16777619);
            hash ^= imageData[i + 1] ?? 0;
            hash = Math.imul(hash, 16777619);
            hash ^= imageData[i + 2] ?? 0;
            hash = Math.imul(hash, 16777619);
          }
          frameHash = (hash >>> 0).toString(16);
        } catch {
          frameHash = null;
        }
      }
    }
    return {
      explicitHealth,
      hasCanvas: canvasCandidates.length > 0,
      readyFlag: win.__HYPERSCAPE_STREAM_READY__ === true,
      hasStreamingBootUi,
      hasCriticalErrorUi,
      heartbeat,
      frameHash,
      canvasRect,
      currentSceneUrl: window.location.href,
      activeBundle,
      bootDiagnostics:
        win.__HYPERSCAPE_STREAM_BOOT_DIAGNOSTICS__ &&
        typeof win.__HYPERSCAPE_STREAM_BOOT_DIAGNOSTICS__ === "object"
          ? win.__HYPERSCAPE_STREAM_BOOT_DIAGNOSTICS__
          : null,
    };
  });

  let visualSampleHash =
    typeof probe.frameHash === "string" && probe.frameHash.length > 0
      ? `canvas:${probe.frameHash}`
      : null;
  try {
    const clip = resolveVisualSampleClip(
      probe.canvasRect as RendererCanvasRectSnapshot | unknown,
      pageRef.viewportSize(),
    );
    if (clip) {
      const screenshot = await pageRef.screenshot({
        type: "jpeg",
        quality: 30,
        fullPage: false,
        scale: "css",
        clip,
      });
      visualSampleHash = `screenshot:${hashVisualSample(screenshot)}`;
    }
  } catch {
    // Fall back to the in-page canvas sample. Some capture sessions briefly
    // reject screenshots while Chromium is navigating or restarting.
  }

  const heartbeat =
    probe.heartbeat && typeof probe.heartbeat === "object"
      ? (probe.heartbeat as RendererHeartbeatSnapshot)
      : null;
  if (heartbeat) {
    lastObservedRenderTick = heartbeat.renderTick;
    lastObservedDuelStateTick = heartbeat.duelStateTick;
    latestRenderTickAt = heartbeat.latestRenderTickAt;
    latestDuelStateTickAt = heartbeat.latestDuelStateTickAt;
  }
  latestSceneUrl =
    typeof probe.currentSceneUrl === "string" &&
    probe.currentSceneUrl.length > 0
      ? probe.currentSceneUrl
      : selectedGameUrl;
  latestActiveBundle =
    typeof probe.activeBundle === "string" && probe.activeBundle.length > 0
      ? probe.activeBundle
      : null;
  if (visualSampleHash) {
    if (visualSampleHash !== lastVisualSampleHash) {
      lastVisualSampleHash = visualSampleHash;
      latestVisualChangeAt = probedAt;
    } else if (latestVisualChangeAt === null) {
      latestVisualChangeAt = probedAt;
    }
  }

  const explicitHealth =
    probe.explicitHealth && typeof probe.explicitHealth === "object"
      ? probe.explicitHealth
      : null;

  if (explicitHealth) {
    const criticalUiVisible = probe.hasCriticalErrorUi === true;
    return {
      ready: criticalUiVisible ? false : explicitHealth.ready === true,
      degradedReason: criticalUiVisible
        ? normalizedCriticalErrorReason(probe)
        : typeof explicitHealth.degradedReason === "string"
          ? explicitHealth.degradedReason
          : null,
      updatedAt:
        typeof explicitHealth.updatedAt === "number"
          ? explicitHealth.updatedAt
          : probedAt,
      phase:
        typeof explicitHealth.phase === "string" ? explicitHealth.phase : null,
      diagnostics: {
        hasCanvas: probe.hasCanvas === true,
        hasStreamingBootUi: probe.hasStreamingBootUi === true,
        hasCriticalErrorUi: criticalUiVisible,
        readyFlag: probe.readyFlag === true,
        bootDiagnostics: probe.bootDiagnostics ?? null,
      },
    };
  }

  return {
    ready:
      !probe.hasCriticalErrorUi &&
      (probe.readyFlag === true ||
        (probe.hasCanvas && !probe.hasStreamingBootUi)),
    degradedReason:
      !probe.hasCriticalErrorUi &&
      (probe.readyFlag === true ||
        (probe.hasCanvas && !probe.hasStreamingBootUi))
        ? null
        : probe.hasCriticalErrorUi
          ? normalizedCriticalErrorReason(probe)
          : probe.hasStreamingBootUi
            ? "loading_overlay_active"
            : "canvas_missing",
    updatedAt: probedAt,
    phase: null,
    diagnostics: {
      hasCanvas: probe.hasCanvas === true,
      hasStreamingBootUi: probe.hasStreamingBootUi === true,
      hasCriticalErrorUi: probe.hasCriticalErrorUi === true,
      readyFlag: probe.readyFlag === true,
      bootDiagnostics: probe.bootDiagnostics ?? null,
    },
  };
}

function normalizedCriticalErrorReason(probe: {
  hasCriticalErrorUi?: boolean;
  explicitHealth?: { degradedReason?: string | null } | null;
}): string {
  const explicitReason = probe.explicitHealth?.degradedReason;
  if (typeof explicitReason === "string" && explicitReason.trim().length > 0) {
    return explicitReason;
  }
  return probe.hasCriticalErrorUi ? "initialization_failed" : "canvas_missing";
}

function assertAllowedCaptureNavigation(rawUrl: string): void {
  const unexpectedOrigin = resolveUnexpectedCaptureOrigin(
    rawUrl,
    ALLOWED_CAPTURE_ORIGINS,
  );
  if (!unexpectedOrigin) {
    return;
  }

  throw new Error(
    `Capture browser navigated outside the allowed origin set (${ALLOWED_CAPTURE_ORIGINS.join(", ")}): ${unexpectedOrigin}`,
  );
}

function assertCaptureDocumentResponse(
  response: Awaited<ReturnType<Page["goto"]>>,
  rawUrl: string,
): void {
  const status = response?.status();
  if (typeof status !== "number" || status < 400) {
    return;
  }

  throw new Error(
    `Capture document request returned HTTP ${status}: ${redactStreamingSecretsFromUrl(rawUrl)}`,
  );
}

async function abortCaptureForUnexpectedNavigation(
  rawUrl: string,
): Promise<void> {
  if (captureNavigationAbortInFlight) {
    return;
  }
  captureNavigationAbortInFlight = true;
  console.error(
    `[Main] Refusing to capture unexpected navigation target ${redactStreamingSecretsFromUrl(rawUrl)}. Allowed origins: ${ALLOWED_CAPTURE_ORIGINS.join(", ")}`,
  );
  try {
    await cleanup();
  } finally {
    process.exit(1);
  }
}

async function refreshRendererHealthSnapshot(
  pageRef: Page | null,
): Promise<RendererHealthSnapshot> {
  if (!pageRef) {
    latestRendererHealth = {
      ready: false,
      degradedReason: "capture_page_missing",
      updatedAt: Date.now(),
      phase: null,
      diagnostics: null,
    };
    return latestRendererHealth;
  }

  if (rendererHealthProbeInFlight) {
    return rendererHealthProbeInFlight;
  }

  rendererHealthProbeInFlight = (async () => {
    try {
      latestRendererHealth = await withTimeout(
        probeRendererHealth(pageRef),
        SOURCE_PROBE_TIMEOUT_MS,
        "Renderer health probe",
      );
    } catch (err) {
      latestRendererHealth = {
        ready: false,
        degradedReason: `probe_failed:${errMsg(err)}`.slice(0, 180),
        updatedAt: Date.now(),
        phase: null,
        diagnostics: null,
      };
    }
    return latestRendererHealth;
  })().finally(() => {
    rendererHealthProbeInFlight = null;
  });

  return rendererHealthProbeInFlight;
}

async function waitForStreamReadiness(
  pageRef: Page,
  timeoutMs: number,
): Promise<boolean> {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const probe = await refreshRendererHealthSnapshot(pageRef);
      if (
        shouldAcceptCaptureReadiness({
          snapshot: probe,
          startedAt,
          nowMs: Date.now(),
        })
      ) {
        return true;
      }
    } catch (err) {
      if (!isTransientPageEvalError(err)) {
        console.warn("[Main] Stream readiness probe failed:", errMsg(err));
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  return false;
}

// ── Browser Launch ─────────────────────────────────────────────────────────

/**
 * Poll Chrome's /json/version endpoint until it responds successfully,
 * proving the browser is up and has finished launching the render window.
 *
 * We do NOT return the WebSocket debugger URL nor attach via Playwright's
 * connectOverCDP() in x11_nvenc mode — it hangs on the WebSocket handshake
 * under Bun (same class as the "Bun/ws WebSocket handshake timeout" already
 * documented in this file for WebCodecs-over-WebSocket). The only reason to
 * probe this endpoint is to gate FFmpeg's x11grab start on Chrome having
 * finished its first paint, so the initial frames aren't captured from an
 * empty Xvfb. If we ever need scene-level health probes for x11_nvenc mode
 * we'll add a raw CDP client (e.g. chrome-remote-interface) that bypasses
 * Playwright's ws handshake.
 */
async function waitForChromeReady(
  port: number,
  timeoutMs: number,
): Promise<void> {
  const httpEndpoint = `http://127.0.0.1:${port}/json/version`;
  const deadline = Date.now() + timeoutMs;
  let lastErr: string | null = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(httpEndpoint);
      if (res.ok) {
        await res.text();
        return;
      }
      lastErr = `http ${res.status}`;
    } catch (err) {
      lastErr = errMsg(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Chrome on port ${port} did not reach ready state within ${timeoutMs}ms (last: ${lastErr ?? "no reply"})`,
  );
}

/**
 * Spawn Chrome directly (outside Playwright) with `--app=URL --kiosk` so the
 * rendered window has no tab bar / URL bar / infobars, wait for Chrome to
 * report ready, and return. In x11_nvenc mode we deliberately do NOT
 * attach Playwright to the Chrome process — Playwright's connectOverCDP()
 * hangs indefinitely on Bun's WebSocket handshake, which is the same
 * Bun/ws compatibility issue already documented for the WebCodecs path.
 * Chrome stays a detached child process; x11grab captures its display.
 *
 * Only used for x11_nvenc mode. Other capture modes continue to use
 * `chromium.launch()` unchanged.
 *
 * Why direct spawn instead of Playwright launch: `chromium.launch({ args:
 * ['--kiosk', ...] })` on Chrome channels silently renders the browser
 * with a tab bar + URL bar, and x11grab captures those chrome pixels
 * into the stream frame. The canary worker proved that a plain
 * child_process spawn with `--app=URL --kiosk` renders a frameless,
 * full-bleed window at the configured size — exactly what x11grab needs.
 */
async function spawnX11NvencChromeProcess(): Promise<void> {
  // Kill any leftover child from a previous spawn (browser rotation, recovery)
  if (x11NvencChromeProcess && !x11NvencChromeProcess.killed) {
    try {
      x11NvencChromeProcess.kill("SIGKILL");
    } catch {
      // Already dead
    }
    x11NvencChromeProcess = null;
  }

  const port = parseIntegerSetting(
    process.env.STREAM_X11_NVENC_DEBUG_PORT,
    9222,
  );
  const profileDir =
    process.env.STREAM_X11_NVENC_PROFILE_DIR ?? "/tmp/x11-nvenc-render-profile";
  const streamUrl = GAME_URL_CANDIDATES[0];
  if (!streamUrl) {
    throw new Error(
      "x11_nvenc mode requires at least one GAME_URL_CANDIDATES entry",
    );
  }
  const chromePath =
    process.env.STREAM_CAPTURE_CHROME_PATH ?? "/opt/google/chrome-beta/chrome";

  // Clean profile dir so stale Singleton-lock files don't block startup.
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  fs.mkdirSync(profileDir, { recursive: true });

  const args: string[] = [
    `--app=${streamUrl}`,
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${port}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-infobars",
    "--hide-scrollbars",
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    "--window-position=0,0",
    "--kiosk",
    "--start-fullscreen",
    "--autoplay-policy=no-user-gesture-required",
    "--use-gl=angle",
    `--use-angle=${ANGLE_BACKEND}`,
    "--enable-webgl",
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,UseSkiaRenderer,WebGPU",
    "--ignore-gpu-blocklist",
    "--enable-gpu-rasterization",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    // Chrome refuses to start as root (the capture worker's typical
    // environment on gpu-server) without --no-sandbox. Playwright
    // silently injected this for us in launch-mode; in direct-spawn
    // we must pass it explicitly. x11grab never uses Chrome as a
    // privilege boundary — it just renders a page for capture — so
    // dropping the sandbox here matches the proven canary worker and
    // the existing CDP/webcodecs launch posture.
    "--no-sandbox",
  ];

  console.log(
    `[Main] Spawning Chrome directly for x11_nvenc (no Playwright launch): ${chromePath} --app=<url> --kiosk --window-size=${VIEWPORT.width},${VIEWPORT.height} --remote-debugging-port=${port}`,
  );
  const child = spawn(chromePath, args, {
    detached: false,
    stdio: ["ignore", "ignore", "pipe"],
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    console.warn(
      `[Main] x11_nvenc Chrome exited (code=${code} signal=${signal})`,
    );
  });
  if (child.stderr) {
    child.stderr.on("data", (buf: Buffer) => {
      const msg = buf.toString("utf8").trim();
      if (!msg) return;
      // Echo only genuine errors, filter GCM / ALSA noise.
      if (
        /error|fatal|crashed/i.test(msg) &&
        !/ERROR:google_apis\/gcm|ERROR:.*alsa/i.test(msg)
      ) {
        console.warn("[x11-nvenc chrome]", msg.slice(0, 500));
      }
    });
  }

  x11NvencChromeProcess = child;

  await waitForChromeReady(port, 30_000);
  console.log(
    `[Main] x11_nvenc Chrome ready on :${process.env.DISPLAY ?? "?"} (remote-debugging-port=${port}); ` +
      "not attaching Playwright (Bun/ws handshake hangs), x11grab captures the display directly.",
  );
}

async function launchCaptureBrowser(): Promise<Browser | null> {
  if (CAPTURE_MODE === "x11_nvenc") {
    await spawnX11NvencChromeProcess();
    return null;
  }
  const featureFlags = "--enable-features=Vulkan,UseSkiaRenderer,WebGPU";
  // When in x11_nvenc mode, pin Chromium full-screen to the Xvfb display so
  // FFmpeg's x11grab captures the canvas region exactly (no browser chrome,
  // no stray surrounding pixels). No effect on other capture modes.
  const fullScreenPin =
    CAPTURE_MODE === "x11_nvenc"
      ? { width: VIEWPORT.width, height: VIEWPORT.height }
      : undefined;
  const launchConfig = {
    headless: STREAM_CAPTURE_HEADLESS,
    args: buildDefaultCaptureLaunchArgs({
      angleBackend: ANGLE_BACKEND,
      featureFlags,
      disableSandbox: CAPTURE_DISABLE_SANDBOX,
      fullScreenPin,
    }),
  };

  if (CAPTURE_DISABLE_SANDBOX) {
    console.warn(
      "[Main] CAPTURE_DISABLE_SANDBOX=true: Chromium sandboxing is disabled for this capture session.",
    );
  }

  if (STREAM_CAPTURE_CHANNEL) {
    console.log(
      `[Main] Launching with explicit browser channel: ${STREAM_CAPTURE_CHANNEL}`,
    );
    return await chromium.launch({
      ...launchConfig,
      channel: STREAM_CAPTURE_CHANNEL,
    });
  }

  try {
    return await chromium.launch(launchConfig);
  } catch (err) {
    const message = errMsg(err);
    const likelyMissingBrowser =
      message.includes("Executable doesn't exist") ||
      message.includes("browser executable") ||
      message.includes("Please run the following command");

    if (!likelyMissingBrowser) {
      throw err;
    }

    console.warn(
      "[Main] Playwright Chromium is missing. Installing bundled Chromium...",
    );
    const install = spawnSync(
      process.platform === "win32" ? "bunx.cmd" : "bunx",
      ["playwright", "install", "chromium"],
      {
        stdio: "inherit",
        env: process.env,
      },
    );
    if (install.status !== 0) {
      throw new Error(
        `Failed to install Playwright Chromium (exit ${install.status ?? "unknown"}).`,
      );
    }

    console.log("[Main] Chromium installed. Retrying browser launch...");
    return chromium.launch(launchConfig);
  }
}

async function setupBrowser(forceReselect = false) {
  if (browser) await cleanup();
  if (forceReselect) {
    selectedGameUrl = null;
  }

  console.log(
    `[Main] Launching browser (headless=${STREAM_CAPTURE_HEADLESS}, angle=${ANGLE_BACKEND}${STREAM_CAPTURE_CHANNEL ? `, channel=${STREAM_CAPTURE_CHANNEL}` : ""}, mode=${CAPTURE_MODE})...`,
  );
  browser = await launchCaptureBrowser();

  if (CAPTURE_MODE === "x11_nvenc") {
    // x11_nvenc owns Chrome as a detached child process (not attached via
    // Playwright — see spawnX11NvencChromeProcess). There is no Playwright
    // Page to wire up. Chrome has already been loaded with --app=<game URL>
    // and is rendering into Xvfb. Skip all Playwright page setup, skip the
    // GAME_URL_CANDIDATES goto loop, and let Chrome's first-paint settling
    // happen under STREAM_CAPTURE_POST_NAV_DELAY_MS below. The x11_nvenc
    // capture (x11grab + NVENC) reads the display directly from here on.
    selectedGameUrl = GAME_URL_CANDIDATES[0] ?? null;
    console.log(
      `[Main] x11_nvenc mode: skipping Playwright page setup; Chrome is a detached child on DISPLAY=${process.env.DISPLAY ?? "?"}.`,
    );
    if (STREAM_CAPTURE_POST_NAV_DELAY_MS > 0) {
      console.log(
        `[Main] Waiting ${STREAM_CAPTURE_POST_NAV_DELAY_MS}ms before starting capture...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, STREAM_CAPTURE_POST_NAV_DELAY_MS),
      );
    }
    launchTime = Date.now();
    return;
  }

  // ── Playwright path (cdp / webcodecs / mediarecorder) ──
  if (!browser) {
    throw new Error("launchCaptureBrowser returned null outside x11_nvenc");
  }
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  page = await context.newPage();

  // Keep compositor frames flowing for CDP screencast even when the scene is
  // visually static (e.g. waiting overlays), otherwise some Chromium builds
  // emit sparse frames and stall downstream HLS/RTMP cadence.
  await page.addInitScript(() => {
    const win = window as unknown as {
      __HYPERSCAPE_REPAINT_TICKER__?: boolean;
    };
    if (win.__HYPERSCAPE_REPAINT_TICKER__) return;
    win.__HYPERSCAPE_REPAINT_TICKER__ = true;

    const ticker = document.createElement("div");
    ticker.id = "__hyperscape-repaint-ticker";
    ticker.style.position = "fixed";
    ticker.style.right = "0";
    ticker.style.bottom = "0";
    ticker.style.width = "2px";
    ticker.style.height = "2px";
    ticker.style.opacity = "0.015";
    ticker.style.backgroundColor = "#000000";
    ticker.style.mixBlendMode = "difference";
    ticker.style.zIndex = "2147483647";
    ticker.style.pointerEvents = "none";
    ticker.style.willChange = "transform,opacity,background-color";

    const attach = () => {
      const root = document.body || document.documentElement;
      if (root && !root.contains(ticker)) {
        root.appendChild(ticker);
      }
    };

    attach();
    let phase = 0;
    const tick = () => {
      phase = (phase + 1) & 3;
      ticker.style.transform =
        phase & 1 ? "translate3d(0.5px,0.5px,0)" : "translate3d(0,0,0)";
      ticker.style.backgroundColor = phase >= 2 ? "#010101" : "#000000";
      ticker.style.opacity = phase & 1 ? "0.02" : "0.015";
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.addEventListener("DOMContentLoaded", attach, { once: true });
  });

  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === "error") {
      console.error("[Browser]", text);
    } else if (text.includes("[Capture]") || text.includes("[StreamingMode]")) {
      console.log("[Browser]", text);
    }
  });

  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) {
      return;
    }
    console.warn(
      `[Browser] Resource response ${status}: ${redactStreamingSecretsFromUrl(response.url())}`,
    );
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure();
    console.warn(
      `[Browser] Request failed: ${redactStreamingSecretsFromUrl(request.url())}${failure?.errorText ? ` (${failure.errorText})` : ""}`,
    );
  });

  page.on("framenavigated", (frame) => {
    if (frame !== page?.mainFrame()) {
      return;
    }
    const navigatedUrl = frame.url();
    if (!navigatedUrl || navigatedUrl === "about:blank") {
      return;
    }
    const unexpectedOrigin = resolveUnexpectedCaptureOrigin(
      navigatedUrl,
      ALLOWED_CAPTURE_ORIGINS,
    );
    if (!unexpectedOrigin) {
      return;
    }
    void abortCaptureForUnexpectedNavigation(navigatedUrl);
  });

  if (!selectedGameUrl) {
    for (const candidateUrl of GAME_URL_CANDIDATES) {
      const redactedCandidateUrl = redactStreamingSecretsFromUrl(candidateUrl);
      console.log(`[Main] Navigating to ${redactedCandidateUrl}...`);
      try {
        const response = await page.goto(candidateUrl, {
          timeout: 120_000,
          waitUntil: "domcontentloaded",
        });
        assertCaptureDocumentResponse(response, candidateUrl);
        assertAllowedCaptureNavigation(page.url());
      } catch (err) {
        console.warn(`[Main] Failed to load ${redactedCandidateUrl}:`, err);
        continue;
      }

      if (USE_TIMED_STREAM_WARMUP) {
        console.log(
          `[Main] Using timed warmup (${STREAM_CAPTURE_WARMUP_MS}ms) for ${redactedCandidateUrl}; skipping in-page readiness probe on headed Linux CDP capture.`,
        );
        await page.waitForTimeout(STREAM_CAPTURE_WARMUP_MS);
        selectedGameUrl = candidateUrl;
        break;
      }

      console.log(
        `[Main] Waiting for stream readiness on ${redactedCandidateUrl}...`,
      );
      const isReady = await waitForStreamReadiness(page, 90_000);
      if (isReady) {
        selectedGameUrl = candidateUrl;
        break;
      }
      console.warn(
        `[Main] Stream readiness not detected on ${redactedCandidateUrl}, trying fallback...`,
      );
    }
  } else {
    try {
      const response = await page.goto(selectedGameUrl, {
        timeout: 120_000,
        waitUntil: "domcontentloaded",
      });
      assertCaptureDocumentResponse(response, selectedGameUrl);
      assertAllowedCaptureNavigation(page.url());
    } catch (err) {
      console.error(
        `[Main] Failed to reload configured URL ${redactStreamingSecretsFromUrl(selectedGameUrl)}`,
        err,
      );
    }
  }

  if (!selectedGameUrl) {
    console.error(
      `[Main] Could not find a game canvas on any candidate URL: ${GAME_URL_CANDIDATES.map(redactStreamingSecretsFromUrl).join(", ")}`,
    );
    console.error(
      "[Main] Make sure the game client is running and supports stream/spectator mode.",
    );
    await cleanup();
    process.exit(1);
  }

  console.log(
    `[Main] Using game page: ${redactStreamingSecretsFromUrl(selectedGameUrl)}`,
  );
  if (STREAM_CAPTURE_POST_NAV_DELAY_MS > 0) {
    console.log(
      `[Main] Waiting ${STREAM_CAPTURE_POST_NAV_DELAY_MS}ms before starting capture...`,
    );
    await page.waitForTimeout(STREAM_CAPTURE_POST_NAV_DELAY_MS);
  }

  launchTime = Date.now();
}

// ── CDP Screencast Capture ─────────────────────────────────────────────────

async function startCdpCapture(bridge: ReturnType<typeof getRTMPBridge>) {
  if (!page) throw new Error("No page available for CDP capture");

  // Create CDP session
  cdpSession = await page.context().newCDPSession(page);

  console.log(
    `[CDP] Starting screencast capture (quality=${CDP_QUALITY}, fps=${TARGET_FPS}, ${VIEWPORT.width}x${VIEWPORT.height})...`,
  );

  // Start FFmpeg in direct mode (JPEG piping)
  bridge.startFFmpegDirect();

  startFpsTracking();
  startCdpFramePump(bridge);

  // Handle incoming frames from CDP
  cdpSession.on("Page.screencastFrame", async (params) => {
    const { sessionId, data: base64Data } = params;

    // Acknowledge the frame immediately to request the next one
    try {
      await cdpSession?.send("Page.screencastFrameAck", { sessionId });
    } catch {
      // Session may have been destroyed during page navigation
    }

    const frameAt = Date.now();
    lastCaptureFrameAt = frameAt;
    // CDP can emit compositor frames faster than the configured stream FPS.
    // Keep FFmpeg on the target cadence instead of overfeeding the encoder.
    if (
      lastEncodedFrameAt != null &&
      frameAt - lastEncodedFrameAt < CDP_FRAME_PUMP_INTERVAL_MS
    ) {
      return;
    }

    // Decode only accepted frames; skipped CDP frames can be large base64 JPEGs.
    const jpegBuffer = Buffer.from(base64Data, "base64");
    latestCdpFrameBuffer = jpegBuffer;
    const metadataRecord =
      params.metadata && typeof params.metadata === "object"
        ? (params.metadata as Record<string, unknown>)
        : null;
    const cdpTimestamp =
      metadataRecord &&
      typeof metadataRecord.timestamp === "number" &&
      Number.isFinite(metadataRecord.timestamp)
        ? metadataRecord.timestamp
        : null;
    feedCdpFrameToEncoder(bridge, jpegBuffer, {
      frameAt,
      cdpTimestamp,
      repeated: false,
    });
  });

  // Start the screencast
  await cdpSession.send("Page.startScreencast", {
    format: "jpeg",
    quality: CDP_QUALITY,
    maxWidth: VIEWPORT.width,
    maxHeight: VIEWPORT.height,
    everyNthFrame: CDP_EVERY_NTH_FRAME,
  });

  console.log(
    `[CDP] ✅ Screencast capture started — frames piping to FFmpeg (everyNthFrame=${CDP_EVERY_NTH_FRAME})`,
  );
}

async function stopCdpCapture() {
  stopFpsTracking();
  stopCdpFramePump();
  latestCdpFrameBuffer = null;
  lastEncodedFrameAt = null;

  if (cdpSession) {
    try {
      await cdpSession.send("Page.stopScreencast");
      await cdpSession.detach();
    } catch {
      // Session may already be closed
    }
    cdpSession = null;
  }
}

// ── Legacy MediaRecorder Capture ───────────────────────────────────────────

async function startLegacyCapture(bridge: ReturnType<typeof getRTMPBridge>) {
  if (!page) return;

  // Start WebSocket bridge for MediaRecorder chunks
  bridge.start(BRIDGE_PORT);

  const streamPageMayAlreadyCapture =
    !REQUIRE_IN_PAGE_READY_PROBE && selectedGameUrl?.includes("?page=stream");
  if (streamPageMayAlreadyCapture) {
    console.log(
      "[Main] Stream page capture bridge may already be active; will inject MediaRecorder only if the in-page bridge is inactive.",
    );
  }

  const captureScript = generateCaptureScript({
    bridgeUrl: BRIDGE_URL,
    fps: TARGET_FPS,
    bitrate: WEBCODECS_VIDEO_BITRATE_BPS,
  });

  const ensureCaptureRunning = async (reason: string) => {
    if (!page || page.isClosed()) return;

    let state: {
      hasCanvas: boolean;
      hasControl: boolean;
      recording: boolean;
      wsConnected: boolean;
    };
    try {
      state = await page.evaluate(() => {
        const control = (
          window as unknown as {
            __captureControl__?: { getStatus: () => unknown };
          }
        ).__captureControl__;
        const status = (control?.getStatus?.() || {}) as {
          recording?: boolean;
          wsConnected?: boolean;
        };
        return {
          hasCanvas: document.querySelector("canvas") !== null,
          hasControl: Boolean(control),
          recording: status.recording === true,
          wsConnected: status.wsConnected === true,
        };
      });
    } catch (err) {
      if (isTransientPageEvalError(err)) return;
      throw err;
    }

    if (!state.hasCanvas) return;
    if (state.hasControl && state.recording && state.wsConnected) return;

    console.log(
      `[Main] Legacy capture inactive (reason=${reason}), injecting script...`,
    );
    try {
      await page.evaluate(captureScript);
      await page.waitForTimeout(1500);
    } catch (err) {
      if (isTransientPageEvalError(err)) return;
      throw err;
    }
  };

  // Inject and verify capture
  try {
    await ensureCaptureRunning("initial");
  } catch (err) {
    console.warn("[Main] Initial capture injection failed:", err);
  }

  // Watchdog to recover from page reloads
  return setInterval(() => {
    void ensureCaptureRunning("watchdog").catch((err) => {
      console.warn("[Main] Capture watchdog error:", err);
    });
  }, 5000);
}

// ── WebCodecs Canvas Capture ───────────────────────────────────────────────

async function startWebCodecsCapture(bridge: ReturnType<typeof getRTMPBridge>) {
  if (!page) return;

  // Start WebSocket bridge for WebCodecs NAL chunks (stream copy)
  bridge.startWebCodecs(BRIDGE_PORT);

  const captureScript = generateWebCodecsCaptureScript({
    bridgeUrl: BRIDGE_URL,
    fps: TARGET_FPS,
    bitrate: WEBCODECS_VIDEO_BITRATE_BPS,
    gopFrames: INGEST_SETTINGS.gopFrames,
  });

  const ensureCaptureRunning = async (reason: string) => {
    if (!page || page.isClosed()) return;

    let state: {
      hasCanvas: boolean;
      hasControl: boolean;
      recording: boolean;
      wsConnected: boolean;
    };
    try {
      state = await page.evaluate(() => {
        const control = (
          window as unknown as {
            __captureControl__?: { getStatus: () => unknown };
          }
        ).__captureControl__;
        const status = (control?.getStatus?.() || {}) as {
          recording?: boolean;
          wsConnected?: boolean;
        };
        return {
          hasCanvas: document.querySelector("canvas") !== null,
          hasControl: Boolean(control),
          recording: status.recording === true,
          wsConnected: status.wsConnected === true,
        };
      });
    } catch (err) {
      if (isTransientPageEvalError(err)) return;
      throw err;
    }

    if (!state.hasCanvas) return;
    if (state.hasControl && state.recording && state.wsConnected) return;

    console.log(
      `[Main] WebCodecs capture inactive (reason=${reason}), injecting script...`,
    );
    try {
      await page.evaluate(captureScript);
      await page.waitForTimeout(1500);
    } catch (err) {
      if (isTransientPageEvalError(err)) return;
      throw err;
    }
  };

  // Inject and verify capture
  try {
    await ensureCaptureRunning("initial");
  } catch (err) {
    console.warn("[Main] Initial WebCodecs capture injection failed:", err);
  }

  // Watchdog to recover from page reloads
  return setInterval(() => {
    void ensureCaptureRunning("watchdog").catch((err) => {
      console.warn("[Main] Capture watchdog error:", err);
    });
  }, 5000);
}

// ── WebCodecs Exposed-Function Capture ──────────────────────────────────────
// Bypasses WebSocket entirely: the browser calls window.__streamNALU(base64)
// which is a direct Playwright IPC channel to this Node process. This is a
// workaround for a Bun/ws WebSocket handshake timeout seen on headless Linux
// that leaves the standard WebCodecs-over-WebSocket path unable to connect.

async function startWebCodecsExposedCapture(
  bridge: ReturnType<typeof getRTMPBridge>,
) {
  if (!page) return;

  // Start FFmpeg in H.264 stream-copy mode without a WebSocket server.
  // Data flows via page.exposeFunction() → writeToFfmpegRaw().
  bridge.startWebCodecsDirect();

  // Expose the IPC function BEFORE injecting the capture script.
  // page.exposeFunction survives page reloads (it's a CDP binding).
  try {
    await page.exposeFunction("__streamNALU", (base64: string) => {
      try {
        const buf = Buffer.from(base64, "base64");
        bridge.writeToFfmpegRaw(buf);
      } catch {
        // Ignore transient write errors — FFmpeg restart handles recovery
      }
    });
    console.log("[Main] Exposed __streamNALU function to browser");
  } catch (err) {
    if (String(err).includes("already")) {
      console.log("[Main] __streamNALU already exposed (warm restart)");
    } else {
      console.error("[Main] Failed to expose __streamNALU:", err);
      return;
    }
  }

  const captureScript = generateWebCodecsExposedCaptureScript({
    fps: TARGET_FPS,
    bitrate: WEBCODECS_VIDEO_BITRATE_BPS,
    gopFrames: INGEST_SETTINGS.gopFrames,
  });

  const ensureCaptureRunning = async (reason: string) => {
    if (!page || page.isClosed()) return;

    let state: {
      hasCanvas: boolean;
      hasControl: boolean;
      recording: boolean;
      wsConnected: boolean;
    };
    try {
      state = await page.evaluate(() => {
        const control = (
          window as unknown as {
            __captureControl__?: { getStatus: () => unknown };
          }
        ).__captureControl__;
        const status = (control?.getStatus?.() || {}) as {
          recording?: boolean;
          wsConnected?: boolean;
        };
        return {
          hasCanvas: document.querySelector("canvas") !== null,
          hasControl: Boolean(control),
          recording: status.recording === true,
          wsConnected: status.wsConnected === true,
        };
      });
    } catch (err) {
      if (isTransientPageEvalError(err)) return;
      throw err;
    }

    if (!state.hasCanvas) return;
    // Exposed-function variant: the in-page script streams NALUs via
    // page.exposeFunction('__streamNALU') (no WebSocket at all). Under
    // that transport `status.wsConnected` stays false forever, so gating
    // the "already running" short-circuit on wsConnected always re-injects
    // — correctness-wise harmless (injection is idempotent) but
    // semantically the wrong readiness signal for this path. Accept
    // `hasControl && recording` as sufficient; the bridge-side bytes-
    // received signal is the authoritative liveness check and lives in
    // waitForCaptureTraffic.
    if (state.hasControl && state.recording) return;

    console.log(
      `[Main] WebCodecs/Exposed capture inactive (reason=${reason}), injecting script...`,
    );
    try {
      await page.evaluate(captureScript);
      await page.waitForTimeout(1500);
    } catch (err) {
      if (isTransientPageEvalError(err)) return;
      throw err;
    }
  };

  try {
    await ensureCaptureRunning("initial");
  } catch (err) {
    console.warn(
      "[Main] Initial WebCodecs/Exposed capture injection failed:",
      err,
    );
  }

  return setInterval(() => {
    void ensureCaptureRunning("watchdog").catch((err) => {
      console.warn("[Main] Capture watchdog error:", err);
    });
  }, 5000);
}

type BrowserCaptureStatus = {
  recording?: boolean;
  wsConnected?: boolean;
  chunkCount?: number;
  bytesSent?: number;
  uptime?: number;
  lastChunkAt?: number | null;
  lastChunkAgeMs?: number | null;
  lastChunkMs?: number | null;
  captureFps?: number;
  captureSessionGeneration?: string | null;
};

async function getBrowserCaptureStatus(): Promise<BrowserCaptureStatus | null> {
  if (!page || page.isClosed()) return null;

  try {
    return (await withTimeout(
      page.evaluate(() => {
        const win = window as unknown as {
          __captureControl__?: { getStatus: () => unknown };
          __HYPERSCAPE_STREAM_CAPTURE_SESSION_GENERATION__?: string | null;
        };
        const captureStatus =
          (win.__captureControl__?.getStatus?.() as Record<string, unknown>) ??
          {};
        return {
          ...captureStatus,
          captureSessionGeneration:
            typeof win.__HYPERSCAPE_STREAM_CAPTURE_SESSION_GENERATION__ ===
            "string"
              ? win.__HYPERSCAPE_STREAM_CAPTURE_SESSION_GENERATION__
              : null,
        };
      }),
      SOURCE_PROBE_TIMEOUT_MS,
      "Browser capture status probe",
    )) as BrowserCaptureStatus | null;
  } catch (err) {
    if (isTransientPageEvalError(err)) return null;
    throw err;
  }
}

async function refreshBrowserCaptureStatusSnapshot(): Promise<BrowserCaptureStatus | null> {
  if (browserCaptureStatusProbeInFlight) {
    return browserCaptureStatusProbeInFlight;
  }

  browserCaptureStatusProbeInFlight = getBrowserCaptureStatus()
    .then((status) => {
      latestBrowserCaptureStatus = status;
      return latestBrowserCaptureStatus;
    })
    .catch((err) => {
      if (!isTransientPageEvalError(err)) {
        throw err;
      }
      return null;
    })
    .finally(() => {
      browserCaptureStatusProbeInFlight = null;
    });

  return browserCaptureStatusProbeInFlight;
}

async function stopInPageCaptureControl(): Promise<void> {
  if (!page || page.isClosed()) return;

  try {
    await page.evaluate(() => {
      (
        window as unknown as { __captureControl__?: { stop: () => void } }
      ).__captureControl__?.stop?.();
    });
  } catch (err) {
    if (!isTransientPageEvalError(err)) {
      console.warn("[Main] Failed to stop in-page capture control:", err);
    }
  }
}

async function waitForCaptureTraffic(
  bridge: ReturnType<typeof getRTMPBridge>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const captureStatus = await refreshBrowserCaptureStatusSnapshot();
    const bridgeStats = bridge.getStats();
    // The readiness contract used to gate on `recording && wsConnected &&
    // bytesReceived > 0`. The `wsConnected` requirement is wrong for the
    // exposed-function variant (startWebCodecsExposedCapture calls
    // bridge.startWebCodecsDirect() which doesn't open a WebSocket at all
    // — data flows via page.exposeFunction('__streamNALU')). Under that
    // path `wsConnected` stays false forever and the gate can never pass.
    // `bytesReceived > 0` is the authoritative "bridge is producing
    // frames" signal regardless of transport, so gate on that plus
    // recording.
    const captureActive = captureStatus?.recording === true;
    const hasTraffic = bridgeStats.bytesReceived > 0;

    if (captureActive && hasTraffic) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

async function startValidatedWebCodecsCapture(
  bridge: ReturnType<typeof getRTMPBridge>,
): Promise<{
  mode: ActiveCaptureMode;
  watchdog: ReturnType<typeof setInterval> | null;
}> {
  console.log(
    "[Main] WebCodecs mode: trying exposed-function bridge (bypasses WebSocket)...",
  );
  let watchdog = (await startWebCodecsExposedCapture(bridge)) ?? null;
  let healthy = await waitForCaptureTraffic(bridge, 25_000);
  if (!healthy) {
    console.warn(
      "[Main] WebCodecs/Exposed produced no media within 25s; trying WebSocket fallback...",
    );
    if (watchdog) {
      clearInterval(watchdog);
      watchdog = null;
    }
    await stopInPageCaptureControl();
    await bridge.stop();
    bridge.startSpectatorServer(SPECTATOR_PORT);
    watchdog = (await startWebCodecsCapture(bridge)) ?? null;
    healthy = await waitForCaptureTraffic(bridge, 20_000);
  }
  if (!healthy) {
    console.warn(
      "[Main] WebCodecs capture produced no media within 20s; falling back to CDP screencast capture.",
    );
    if (watchdog) {
      clearInterval(watchdog);
      watchdog = null;
    }
    await stopInPageCaptureControl();
    await bridge.stop();
    bridge.startSpectatorServer(SPECTATOR_PORT);
    await startCdpCapture(bridge);
    return { mode: "cdp", watchdog: null };
  }

  return { mode: "webcodecs", watchdog };
}

// ── Main Entry Point ───────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log(`Hyperscape RTMP Streaming (${CAPTURE_MODE.toUpperCase()} mode)`);
  console.log("=".repeat(60));
  console.log("");

  // Check if any destinations are configured
  if (!hasConfiguredOutput()) {
    console.warn("");
    console.warn("WARNING: No RTMP outputs configured!");
    console.warn("Set environment variables:");
    console.warn("  - TWITCH_STREAM_KEY (or TWITCH_RTMP_STREAM_KEY)");
    console.warn(
      "  - Optional Twitch URL: TWITCH_STREAM_URL / TWITCH_RTMP_URL / TWITCH_RTMP_SERVER",
    );
    console.warn("  - YOUTUBE_STREAM_KEY (or YOUTUBE_RTMP_STREAM_KEY)");
    console.warn(
      "  - Optional YouTube URL: YOUTUBE_STREAM_URL / YOUTUBE_RTMP_URL",
    );
    console.warn("  - KICK_STREAM_KEY");
    console.warn("  - PUMPFUN_RTMP_URL");
    console.warn("  - X_RTMP_URL");
    console.warn("  - RTMP_DESTINATIONS_JSON");
    console.warn("");
    console.warn("Streaming will run but output will be discarded.");
    console.warn("");
  }

  // ── Xvfb 60Hz modeline setup ──────────────────────────────────────
  // Xvfb virtual displays default to 0 Hz refresh rate. Chrome's
  // compositor locks to V-sync, so 0 Hz means 0-5 fps rendering. Set
  // the display to 60 Hz via xrandr modeline so the compositor runs at
  // full speed. This only matters for headed mode on Linux Xvfb; it's
  // harmless on macOS, in headless mode, or if xrandr isn't available.
  if (!STREAM_CAPTURE_HEADLESS && process.env.DISPLAY) {
    try {
      const { execSync } = await import("child_process");
      const display = process.env.DISPLAY;
      // Check current refresh rate
      const xrandrOutput = execSync(`DISPLAY=${display} xrandr`, {
        encoding: "utf-8",
        timeout: 5000,
      });
      if (xrandrOutput.includes("0.00*")) {
        console.log(
          `[Main] Xvfb display ${display} is at 0 Hz — applying 60 Hz modeline`,
        );
        const mode = resolveXvfb60HzMode(VIEWPORT.width, VIEWPORT.height);
        if (!mode) {
          console.warn(
            `[Main] No known 60 Hz modeline for ${VIEWPORT.width}x${VIEWPORT.height}; leaving Xvfb mode unchanged`,
          );
        } else {
          execSync(
            `DISPLAY=${display} xrandr --newmode ${mode.modeline} 2>/dev/null; DISPLAY=${display} xrandr --addmode screen ${mode.modeName} 2>/dev/null; DISPLAY=${display} xrandr --output screen --mode ${mode.modeName} 2>/dev/null`,
            { timeout: 5000 },
          );
          console.log(
            `[Main] Xvfb display ${display} set to 60 Hz at ${VIEWPORT.width}x${VIEWPORT.height}`,
          );
        }
      } else {
        console.log(
          `[Main] Xvfb display ${display} already has a non-zero refresh rate`,
        );
      }
    } catch (xrandrErr) {
      console.warn(
        "[Main] Xvfb modeline setup skipped (xrandr not available or failed):",
        errMsg(xrandrErr),
      );
    }
  }

  // Get bridge instance
  const bridge = getRTMPBridge();

  // Start Spectator Server for zero-latency WebSockets stream
  bridge.startSpectatorServer(SPECTATOR_PORT);

  // Setup browser
  await setupBrowser();

  let captureWatchdog: ReturnType<typeof setInterval> | null = null;
  let activeCaptureMode: ActiveCaptureMode = CAPTURE_MODE;
  let cdpStalledIntervals = 0;
  let lastCdpBytesReceived = 0;
  let cdpRecoveryInFlight = false;
  let cdpRecoveryFailures = 0;
  // x11_nvenc stall tracking — parallels CDP's counters but uses encoder
  // `frame=` progression (via bridge.getLastEncoderFrameCount) rather than
  // bytesReceived, because x11grab always produces bytes even against a
  // frozen display and is therefore not a useful liveness signal.
  let x11StalledIntervals = 0;
  let lastX11EncoderFrameCount = 0;
  let x11RecoveryInFlight = false;
  let x11RecoveryFailures = 0;
  let sourceDegradedPolls = 0;
  let pageNotReadySinceMs: number | null = null;
  let tier1Failures = 0; // FFmpeg-only restart failures
  let tier2Failures = 0; // Warm restart (page reload) failures
  let tier3Failures = 0; // Browser restart failures

  // ── Tiered recovery functions ──────────────────────────────────────
  // See plan: warm-boot-tiered-recovery for full design rationale.

  async function stopActiveCapture(
    mode: ActiveCaptureMode,
    options: { preserveBridgeProcessing?: boolean } = {},
  ): Promise<boolean> {
    if (captureWatchdog) {
      clearInterval(captureWatchdog);
      captureWatchdog = null;
    }

    latestBrowserCaptureStatus = null;

    if (mode === "cdp") {
      await stopCdpCapture();
      if (options.preserveBridgeProcessing) {
        await bridge.stopProcessing();
        return false;
      }
      await bridge.stop();
      return true;
    }

    if (mode === "x11_nvenc") {
      // No in-page capture script and no CDP session for this mode — the
      // bridge owns the whole FFmpeg child (which is reading from X11
      // directly). Preserve-processing semantics match the CDP branch.
      if (options.preserveBridgeProcessing) {
        await bridge.stopProcessing();
        return false;
      }
      await bridge.stop();
      return true;
    }

    await stopInPageCaptureControl();
    await bridge.stop();
    return true;
  }

  async function startActiveCapture(
    mode: ActiveCaptureMode,
    options: { restartSpectatorServer?: boolean } = {},
  ): Promise<ActiveCaptureMode> {
    pageNotReadySinceMs = null;
    if (options.restartSpectatorServer) {
      bridge.startSpectatorServer(SPECTATOR_PORT);
    }

    if (mode === "cdp") {
      await startCdpCapture(bridge);
      lastCdpBytesReceived = bridge.getStats().bytesReceived;
      return "cdp";
    }

    if (mode === "webcodecs") {
      const result = await startValidatedWebCodecsCapture(bridge);
      captureWatchdog = result.watchdog;
      if (result.mode === "cdp") {
        lastCdpBytesReceived = bridge.getStats().bytesReceived;
      }
      return result.mode;
    }

    if (mode === "x11_nvenc") {
      // No in-page script to maintain — liveness is tracked by the
      // supervisor loop using `bridge.getLastEncoderFrame{Count,At}`.
      captureWatchdog = await startX11NvencCapture(bridge);
      return "x11_nvenc";
    }

    captureWatchdog = (await startLegacyCapture(bridge)) ?? null;
    return "mediarecorder";
  }

  async function waitForRecoveryReadiness(reason: string): Promise<void> {
    if (CAPTURE_MODE === "x11_nvenc") {
      // x11_nvenc has no Playwright Page to probe. Treat the Chrome
      // child process being alive as the readiness signal. FFmpeg's
      // encoder-frame progression is the authoritative liveness check
      // post-recovery (supervised elsewhere in the status loop).
      if (!x11NvencChromeProcess || x11NvencChromeProcess.killed) {
        throw new Error(
          `${reason}: x11_nvenc Chrome child not running after restart`,
        );
      }
      return;
    }
    if (!page) {
      throw new Error(`${reason}: missing page after restart`);
    }
    const ready = await waitForStreamReadiness(
      page,
      SOURCE_RECOVERY_READY_TIMEOUT_MS,
    );
    if (!ready) {
      throw new Error(
        `${reason}: renderer did not recover within ${SOURCE_RECOVERY_READY_TIMEOUT_MS}ms`,
      );
    }
  }

  async function closeBrowserForRestart(): Promise<void> {
    if (page) {
      try {
        await page.evaluate(() => {
          (
            window as unknown as { __captureControl__?: { stop: () => void } }
          ).__captureControl__?.stop?.();
        });
      } catch {
        // Page might already be closed
      }
    }

    if (browser) {
      await browser.close();
      browser = null;
    }

    page = null;
    latestBrowserCaptureStatus = null;
    latestSceneUrl = null;
    latestActiveBundle = null;
  }

  /**
   * Tier 2: warm restart — reload the page but keep the browser alive.
   * IndexedDB VRM cache and WebGPU shader cache survive, cutting recovery
   * from ~90s (cold) to ~15s. The active capture pipeline is recreated.
   */
  async function warmRestart(reason: string): Promise<void> {
    console.log(`[Main] Warm restart (Tier 2): ${reason}`);
    const restartSpectatorServer = await stopActiveCapture(activeCaptureMode, {
      preserveBridgeProcessing: activeCaptureMode === "cdp",
    });
    // DON'T close browser — IndexedDB + WebGPU cache survive
    if (page) {
      try {
        await page.goto(selectedGameUrl || GAME_URL_CANDIDATES[0], {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
      } catch (navErr) {
        console.error("[Main] Warm restart navigation failed:", navErr);
        throw navErr;
      }
    } else {
      throw new Error("No page reference for warm restart");
    }
    launchTime = Date.now();
    activeCaptureMode = await startActiveCapture(activeCaptureMode, {
      restartSpectatorServer,
    });
    await waitForRecoveryReadiness(`warm restart (${reason})`);
    // Reset consecutive-failure counters on successful warm restart.
    tier1Failures = 0;
    tier2Failures = 0;
    tier3Failures = 0;
    console.log("[Main] Warm restart complete");
  }

  /**
   * Tier 3: browser restart — close and relaunch the browser.
   * The Node process, bridge singleton, and selectedGameUrl survive.
   * With persistent user-data-dir, IndexedDB may also survive.
   */
  async function browserRestart(reason: string): Promise<void> {
    console.log(`[Main] Browser restart (Tier 3): ${reason}`);
    const restartSpectatorServer = await stopActiveCapture(activeCaptureMode);
    await closeBrowserForRestart();
    await setupBrowser(false); // reuse selectedGameUrl
    launchTime = Date.now();
    activeCaptureMode = await startActiveCapture(activeCaptureMode, {
      restartSpectatorServer,
    });
    await waitForRecoveryReadiness(`browser restart (${reason})`);
    // Reset all consecutive-failure counters on successful browser restart.
    tier1Failures = 0;
    tier2Failures = 0;
    tier3Failures = 0;
    console.log("[Main] Browser restart complete");
  }

  if (CAPTURE_MODE === "cdp") {
    // ── CDP Mode: Direct screencast frame piping ──
    try {
      await withTimeout(
        startCdpCapture(bridge),
        CDP_STARTUP_TIMEOUT_MS,
        "CDP screencast startup",
      );
    } catch (err) {
      console.warn(
        `[Main] CDP startup failed; falling back to WebCodecs capture: ${errMsg(err)}`,
      );
      await withTimeout(
        stopCdpCapture(),
        5_000,
        "Stop failed CDP capture",
      ).catch(() => undefined);
      await bridge.stop();
      bridge.startSpectatorServer(SPECTATOR_PORT);
      activeCaptureMode = await startActiveCapture("webcodecs");
      recordSourceRecovery(
        activeCaptureMode === "webcodecs"
          ? "cdp_startup_failed_to_webcodecs"
          : "cdp_startup_failed_to_cdp_fallback",
      );
    }
  } else if (CAPTURE_MODE === "webcodecs") {
    activeCaptureMode = await startActiveCapture("webcodecs");
    if (activeCaptureMode === "cdp") {
      recordSourceRecovery("webcodecs_startup_failed_to_cdp");
    }
  } else if (CAPTURE_MODE === "x11_nvenc") {
    // ── x11_nvenc Mode: FFmpeg x11grab + NVENC, Chromium as pure renderer ──
    // Startup preflights (xdpyinfo, h264_nvenc availability) live inside
    // startX11NvencCapture — a failure there throws and we fall back to CDP
    // to keep the worker streaming rather than exiting entirely.
    try {
      activeCaptureMode = await startActiveCapture("x11_nvenc");
    } catch (err) {
      console.warn(
        `[Main] x11_nvenc startup failed; falling back to CDP capture: ${errMsg(err)}`,
      );
      await bridge.stop().catch(() => undefined);
      bridge.startSpectatorServer(SPECTATOR_PORT);
      activeCaptureMode = await startActiveCapture("cdp");
      recordSourceRecovery("x11_nvenc_startup_failed_to_cdp");
    }
  } else {
    // ── Legacy Mode: MediaRecorder + WebSocket ──
    activeCaptureMode = await startActiveCapture("mediarecorder");
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("Streaming active! Press Ctrl+C to stop.");
  console.log("=".repeat(60));
  console.log("");

  // x11_nvenc mode has no Playwright Page to probe. The detached Chrome
  // process IS the renderer, and its liveness + the encoder's
  // frame-count progression are the authoritative health signals.
  // Synthesize a healthy snapshot so downstream consumers
  // (source-runtime, keeper /api/health, bets-page authority gate)
  // don't report rendererHealthReady=false just because the Playwright
  // probe is disabled by design.
  if (CAPTURE_MODE === "x11_nvenc") {
    const nowMs = Date.now();
    latestRendererHealth = {
      ready: true,
      degradedReason: null,
      updatedAt: nowMs,
      phase: null,
      diagnostics: null,
    };
    // Seed render-tick + visual-change so the keeper's freshness gates
    // don't flag them as stale on the first external-status write.
    latestRenderTickAt = nowMs;
    latestVisualChangeAt = nowMs;
  } else {
    await refreshRendererHealthSnapshot(page);
  }
  writeExternalStatusSnapshot(bridge, activeCaptureMode);
  const statusSnapshotInterval = setInterval(() => {
    const healthProbe =
      CAPTURE_MODE === "x11_nvenc"
        ? Promise.resolve().then(() => {
            // Refresh timestamp + re-assert healthy as long as the
            // Chrome child is alive. Also advance the render-tick and
            // visual-change timestamps — the Playwright page.evaluate
            // heartbeat that normally populates them is disabled here,
            // and without these the keeper's deriveBettingRendererHealth
            // flags `render_tick_stale` (observed on first cutover:
            // rendererHealthReady=false despite fully healthy
            // encoder+ingest). Encoder frame-count progression is
            // already supervised separately as the authoritative
            // liveness signal.
            const chromeAlive =
              !!x11NvencChromeProcess && !x11NvencChromeProcess.killed;
            const nowMs = Date.now();
            latestRendererHealth = {
              ready: chromeAlive,
              degradedReason: chromeAlive ? null : "browser_missing",
              updatedAt: nowMs,
              phase: null,
              diagnostics: null,
            };
            if (chromeAlive) {
              latestRenderTickAt = nowMs;
              latestVisualChangeAt = nowMs;
            }
            return latestRendererHealth;
          })
        : refreshRendererHealthSnapshot(page);
    void healthProbe
      .then(() =>
        activeCaptureMode === "cdp"
          ? Promise.resolve<BrowserCaptureStatus | null>(null)
          : refreshBrowserCaptureStatusSnapshot(),
      )
      .catch(() => undefined)
      .finally(() => {
        const sourceRuntime = writeExternalStatusSnapshot(
          bridge,
          activeCaptureMode,
        );
        const degradedReason = sourceRuntime?.degradedReason ?? null;
        const nowMs = Date.now();
        const withinLaunchGrace =
          nowMs - launchTime <
          Math.max(CDP_STARTUP_TIMEOUT_MS, SOURCE_CAPTURE_STALL_MS);
        if (degradedReason === "page_not_ready") {
          pageNotReadySinceMs = pageNotReadySinceMs ?? nowMs;
        } else {
          pageNotReadySinceMs = null;
        }
        const pageNotReadyStalled =
          degradedReason === "page_not_ready" &&
          pageNotReadySinceMs != null &&
          nowMs - pageNotReadySinceMs >= PAGE_READINESS_STALL_MS;
        const shouldRestartForDegradation =
          !withinLaunchGrace &&
          // Keep scene readiness as a health gate during normal convergence,
          // but escalate if it remains stuck beyond a bounded stall window.
          (degradedReason === "browser_missing" ||
            degradedReason === "unexpected_navigation" ||
            degradedReason === "capture_stalled" ||
            degradedReason === "encoder_stalled" ||
            degradedReason === "manifest_stale" ||
            pageNotReadyStalled);
        if (shouldRestartForDegradation) {
          sourceDegradedPolls += 1;
        } else {
          sourceDegradedPolls = 0;
        }
        if (
          shouldRestartForDegradation &&
          sourceDegradedPolls >= SOURCE_DEGRADED_RESTART_POLLS
        ) {
          console.error(
            `[Main] Source remained degraded (${degradedReason}) for ${sourceDegradedPolls} consecutive health polls; attempting tiered recovery.`,
          );
          sourceDegradedPolls = 0;

          // ── Tiered recovery ──────────────────────────────────────────
          // Tier 1: FFmpeg-only restart (~2s). Encoder/transport failures
          //   don't need a page reload — just restart the encoder.
          // Tier 2: Page reload + CDP restart (~15s). Page-level issues
          //   (canvas missing, navigation, capture stalled) need a fresh
          //   page load but the browser (and its IndexedDB VRM cache,
          //   WebGPU shader cache) survives.
          // Tier 3: Browser restart (~35s). Browser crashed or Tier 2
          //   failed 3 times. New browser, reuse selectedGameUrl.
          // Tier 4: Full shutdown (~90s). Last resort, pm2 cold-restarts.
          //
          // Each tier has a consecutive-failure counter. If Tier N fails
          // 3 times without a successful recovery, escalate to Tier N+1.
          const isTier1Reason =
            degradedReason === "encoder_stalled" ||
            degradedReason === "manifest_stale";
          const isTier2Reason =
            degradedReason === "capture_stalled" ||
            degradedReason === "unexpected_navigation" ||
            degradedReason === "page_not_ready" ||
            degradedReason === "canvas_missing";
          const isTier3Reason = degradedReason === "browser_missing";

          const shouldUseTier1 =
            isTier1Reason && activeCaptureMode === "cdp" && tier1Failures < 3;

          if (shouldUseTier1) {
            tier1Failures += 1;
            console.log(
              `[Main] Tier 1 recovery (FFmpeg restart ${tier1Failures}/3): ${degradedReason}`,
            );
            void bridge
              .restartFFmpegDirect()
              .then(() => {
                tier1Failures = 0;
                tier2Failures = 0;
                tier3Failures = 0;
                startCdpFramePump(bridge);
              })
              .catch((err) => {
                console.error(
                  "[Main] Tier 1 recovery failed, escalating:",
                  err,
                );
                tier1Failures = 3; // force escalation on next poll
              });
          } else if (
            (isTier2Reason ||
              (isTier1Reason &&
                (activeCaptureMode !== "cdp" || tier1Failures >= 3))) &&
            tier2Failures < 3
          ) {
            if (isTier1Reason && activeCaptureMode !== "cdp") {
              console.log(
                `[Main] Tier 1 FFmpeg-only recovery skipped for ${activeCaptureMode} capture; escalating to warm restart.`,
              );
            }
            tier2Failures += 1;
            tier1Failures = 0;
            console.log(
              `[Main] Tier 2 recovery (warm restart ${tier2Failures}/3): ${degradedReason}`,
            );
            void warmRestart(degradedReason ?? "unknown").catch((err) => {
              console.error("[Main] Tier 2 recovery failed, escalating:", err);
              tier2Failures = 3;
            });
          } else if (
            (isTier3Reason || tier2Failures >= 3) &&
            tier3Failures < 3
          ) {
            tier3Failures += 1;
            tier2Failures = 0;
            tier1Failures = 0;
            console.log(
              `[Main] Tier 3 recovery (browser restart ${tier3Failures}/3): ${degradedReason}`,
            );
            void browserRestart(degradedReason ?? "unknown").catch((err) => {
              console.error(
                "[Main] Tier 3 recovery failed, falling through to shutdown:",
                err,
              );
              void shutdown(1);
            });
          } else {
            console.error(
              `[Main] All recovery tiers exhausted — full shutdown (tier1=${tier1Failures}, tier2=${tier2Failures}, tier3=${tier3Failures})`,
            );
            tier1Failures = 0;
            tier2Failures = 0;
            tier3Failures = 0;
            void shutdown(1);
          }
        }
      });
  }, 2000);

  // Status updates every 30 seconds
  const statusInterval = setInterval(async () => {
    const bridgeStatus = bridge.getStatus();
    const stats = bridge.getStats();
    const processMemory = process.memoryUsage();

    console.log("[Status] Active:", bridgeStatus.active);
    console.log(
      "[Status] Bytes received:",
      (stats.bytesReceived / 1024 / 1024).toFixed(2),
      "MB",
    );
    console.log(
      "[Status] Process RSS:",
      (processMemory.rss / 1024 / 1024).toFixed(1),
      "MB",
      "| Heap:",
      (processMemory.heapUsed / 1024 / 1024).toFixed(1),
      "MB",
    );
    console.log("[Status] Uptime:", Math.floor(stats.uptime / 1000), "seconds");
    console.log(
      "[Status] Destinations:",
      bridgeStatus.destinations
        .map((d) => `${d.name}: ${d.connected ? "OK" : "ERROR"}`)
        .join(", ") || "(none configured)",
    );
    if (!latestRendererHealth.ready) {
      console.warn(
        `[Stream Health] Renderer degraded: ${latestRendererHealth.degradedReason || "unknown"}`,
      );
    }

    if (activeCaptureMode === "cdp") {
      console.log(
        `[Stream Health] CDP FPS: ${cdpFps} | Frames: ${bridge.getDirectFrameCount()} | Repeated: ${cdpRepeatedFrameCount} | Dropped: ${cdpDroppedFrames} | BridgeDrops: ${stats.droppedFrames} | Backpressure: ${stats.backpressured ? "ON" : "off"}`,
      );

      // CDP can occasionally stall after initial page setup on remote GPU stacks.
      // Detect sustained no-traffic periods and recover automatically.
      const bytesDelta = stats.bytesReceived - lastCdpBytesReceived;
      lastCdpBytesReceived = stats.bytesReceived;
      const hasMeaningfulTraffic = bytesDelta > 16 * 1024;
      if (hasMeaningfulTraffic || !bridgeStatus.clientConnected) {
        cdpStalledIntervals = 0;
      } else {
        cdpStalledIntervals += 1;
      }

      if (cdpStalledIntervals >= 2) {
        if (cdpRecoveryInFlight) {
          console.warn(
            "[Main] CDP recovery already in progress; skipping duplicate stall recovery attempt.",
          );
          console.log("");
          return;
        }

        console.warn(
          `[Main] CDP capture stalled (${cdpStalledIntervals} intervals without traffic). Attempting recovery...`,
        );
        cdpStalledIntervals = 0;
        cdpRecoveryInFlight = true;

        let recovered = false;
        try {
          await withTimeout(
            (async () => {
              await stopCdpCapture();
              await setupBrowser(cdpRecoveryFailures > 0);
              await startCdpCapture(bridge);
            })(),
            CAPTURE_RECOVERY_TIMEOUT_MS,
            "CDP restart",
          );
          recovered = true;
          cdpRecoveryFailures = 0;
          lastCdpBytesReceived = bridge.getStats().bytesReceived;
          recordSourceRecovery("cdp_stall_recovery");
          console.log("[Main] CDP capture restarted successfully");
        } catch (err) {
          cdpRecoveryFailures += 1;
          console.warn(
            `[Main] CDP restart failed (${cdpRecoveryFailures}/${CAPTURE_RECOVERY_MAX_FAILURES}):`,
            errMsg(err),
          );
        } finally {
          cdpRecoveryInFlight = false;
        }

        if (
          !recovered &&
          cdpRecoveryFailures >= CAPTURE_RECOVERY_MAX_FAILURES
        ) {
          // When the operator explicitly configured STREAM_CAPTURE_MODE=cdp
          // (or the Cloudflare-live guardrail has forced the effective mode
          // to cdp), silently flipping to WebCodecs after repeated CDP
          // stalls masks the real failure and enters a broken recovery
          // loop — the WebCodecs path has its own readiness failure modes
          // (exposed-function vs WebSocket, bytesReceived=0) which then
          // flip back to CDP, etc. Instead escalate: full browser restart,
          // and if that also fails, exit so the supervisor respawns us in
          // the configured mode cleanly.
          if (CAPTURE_MODE === "cdp") {
            console.warn(
              "[Main] CDP stall exceeded recovery threshold; escalating to full browser restart (STREAM_CAPTURE_MODE=cdp, not falling back to webcodecs).",
            );
            try {
              await withTimeout(
                browserRestart("cdp_stall_persistent"),
                CAPTURE_RECOVERY_TIMEOUT_MS + 10_000,
                "Browser restart for persistent CDP stall",
              );
              cdpRecoveryFailures = 0;
              lastCdpBytesReceived = bridge.getStats().bytesReceived;
              recordSourceRecovery("cdp_stall_browser_restart");
              console.log(
                "[Main] Browser restart after persistent CDP stall complete",
              );
            } catch (restartErr) {
              console.error(
                "[Main] Browser restart for persistent CDP stall failed:",
                errMsg(restartErr),
              );
              // Supervisor respawn is the last line of defense; pm2 will
              // bring us back up with the configured CAPTURE_MODE.
              void shutdown(1);
            }
          } else {
            console.warn(
              "[Main] Falling back to WebCodecs capture mode after CDP stall.",
            );
            try {
              // Clear any existing watchdog before starting a new one.
              if (captureWatchdog) {
                clearInterval(captureWatchdog);
                captureWatchdog = null;
              }
              await withTimeout(
                stopCdpCapture(),
                5_000,
                "Stop stalled CDP capture",
              ).catch(() => undefined);
              await bridge.stop();
              bridge.startSpectatorServer(SPECTATOR_PORT);
              activeCaptureMode = await startActiveCapture("webcodecs");
              cdpRecoveryFailures = 0;
              recordSourceRecovery(
                activeCaptureMode === "webcodecs"
                  ? "cdp_stall_fallback_to_webcodecs"
                  : "cdp_stall_recovered_via_cdp_fallback",
              );
              console.log(
                `[Main] Capture recovery after CDP stall settled on ${activeCaptureMode}`,
              );
            } catch (fallbackErr) {
              console.error(
                "[Main] WebCodecs fallback failed:",
                errMsg(fallbackErr),
              );
              void shutdown(1);
            }
          }
        }
      }
    } else if (activeCaptureMode === "x11_nvenc") {
      const encoderFrameCount = bridge.getLastEncoderFrameCount();
      const encoderFrameAt = bridge.getLastEncoderFrameAt();
      const encoderFps = stats.encoderFps;
      const frameDelta = encoderFrameCount - lastX11EncoderFrameCount;
      lastX11EncoderFrameCount = encoderFrameCount;
      const encoderFrameAgeMs =
        encoderFrameAt != null ? Date.now() - encoderFrameAt : null;

      console.log(
        `[Stream Health] x11_nvenc encoder=${encoderFrameCount} +${frameDelta} fps=${encoderFps.toFixed(1)} ageMs=${encoderFrameAgeMs ?? "n/a"} BridgeDrops: ${stats.droppedFrames} | Backpressure: ${stats.backpressured ? "ON" : "off"}`,
      );

      // Stall signal: no `frame=` advance this interval AND encoder either
      // reports near-zero fps or has never yet reported a frame after startup
      // grace. `frameDelta === 0` alone is insufficient — a 30s status tick
      // against a 30fps encoder should always see delta ≥ ~30 when healthy;
      // any 30s window with delta === 0 is a real stall.
      const startupGraceElapsed =
        encoderFrameAt != null || Date.now() - launchTime > 30_000;
      const looksStalled =
        startupGraceElapsed && frameDelta === 0 && encoderFps < 1;

      if (looksStalled) {
        x11StalledIntervals += 1;
      } else {
        x11StalledIntervals = 0;
      }

      if (x11StalledIntervals >= 2) {
        if (x11RecoveryInFlight) {
          console.warn(
            "[Main] x11_nvenc recovery already in progress; skipping duplicate stall recovery attempt.",
          );
        } else {
          console.warn(
            `[Main] x11_nvenc capture stalled (${x11StalledIntervals} intervals, last frame=${encoderFrameCount}). Attempting FFmpeg-only restart (tier-1)...`,
          );
          x11StalledIntervals = 0;
          x11RecoveryInFlight = true;

          let recovered = false;
          try {
            await withTimeout(
              (async () => {
                await bridge.stopProcessing();
                await startX11NvencCapture(bridge);
              })(),
              CAPTURE_RECOVERY_TIMEOUT_MS,
              "x11_nvenc restart",
            );
            recovered = true;
            x11RecoveryFailures = 0;
            lastX11EncoderFrameCount = bridge.getLastEncoderFrameCount();
            recordSourceRecovery("x11_nvenc_stall_recovery");
            console.log("[Main] x11_nvenc FFmpeg restarted successfully");
          } catch (err) {
            x11RecoveryFailures += 1;
            console.warn(
              `[Main] x11_nvenc restart failed (${x11RecoveryFailures}/${CAPTURE_RECOVERY_MAX_FAILURES}):`,
              errMsg(err),
            );
          } finally {
            x11RecoveryInFlight = false;
          }

          if (
            !recovered &&
            x11RecoveryFailures >= CAPTURE_RECOVERY_MAX_FAILURES
          ) {
            console.warn(
              "[Main] Falling back to CDP capture mode after x11_nvenc stall.",
            );
            try {
              if (captureWatchdog) {
                clearInterval(captureWatchdog);
                captureWatchdog = null;
              }
              await withTimeout(
                bridge.stop(),
                5_000,
                "Stop stalled x11_nvenc bridge",
              ).catch(() => undefined);
              bridge.startSpectatorServer(SPECTATOR_PORT);
              await startCdpCapture(bridge);
              activeCaptureMode = "cdp";
              x11RecoveryFailures = 0;
              lastCdpBytesReceived = bridge.getStats().bytesReceived;
              recordSourceRecovery("x11_nvenc_stall_fallback_to_cdp");
              console.log("[Main] Fallback to CDP mode complete");
            } catch (fallbackErr) {
              console.error(
                "[Main] CDP fallback from x11_nvenc failed:",
                errMsg(fallbackErr),
              );
              void shutdown(1);
            }
          }
        }
      }
    } else {
      try {
        const captureStatus = await refreshBrowserCaptureStatusSnapshot();
        if (captureStatus) {
          console.log("[Status] Capture:", captureStatus);
          if (typeof captureStatus.captureFps === "number") {
            const uptime = captureStatus.uptime ?? 0;
            const chunkCount = captureStatus.chunkCount ?? 0;
            const chunksPerSec =
              uptime > 0 ? (chunkCount / (uptime / 1000)).toFixed(1) : "0";
            console.log(
              `[Stream Health] Capture FPS: ${captureStatus.captureFps} | Latency: ${captureStatus.lastChunkMs}ms | Chunks/sec: ${chunksPerSec}`,
            );
          }
        }
        console.log(
          `[Stream Health] BridgeDrops: ${stats.droppedFrames} | Backpressure: ${stats.backpressured ? "ON" : "off"}`,
        );
      } catch {
        console.log("[Status] Capture: unavailable");
      }
    }
    console.log("");

    // Check for periodic restart to clear memory leaks
    if (Date.now() - launchTime > BROWSER_RESTART_INTERVAL_MS) {
      // Guard: skip rotation if any in-flight recovery is running to avoid
      // stepping on it mid-restart.
      if (cdpRecoveryInFlight || x11RecoveryInFlight) {
        console.warn(
          "[Main] Skipping scheduled browser rotation — capture recovery in progress.",
        );
      } else {
        console.log(
          "[Main] 🔄 Scheduled browser rotation to prevent WebGL memory leaks.",
        );
        try {
          // browserRestart dispatches via stopActiveCapture/startActiveCapture,
          // both of which already know how to handle x11_nvenc.
          await browserRestart("scheduled_browser_rotation");
          // Reset x11_nvenc frame counter after a fresh browser+FFmpeg start
          // so the supervisor stall detector doesn't flag the gap.
          if (activeCaptureMode === "x11_nvenc") {
            lastX11EncoderFrameCount = 0;
          }
          recordSourceRecovery("scheduled_browser_rotation");
        } catch (err) {
          console.error("[Main] Failed to rotate browser!", err);
        }
      }
    }
  }, 30000);

  // Handle shutdown
  //
  // IMPORTANT: every step below `await`s an operation that can hang when the
  // underlying subsystem is already dead (Chromium already crashed, FFmpeg
  // already killed, CDP session already closed, etc.). If any one of these
  // deadlocks, `process.exit()` below is never reached and pm2 keeps
  // reporting the worker as "online" indefinitely — we observed a ~75-minute
  // zombie on gpu-server on 2026-04-15 where `[Main] Cleaning up...` was the
  // last line ever emitted. The force-exit timer below caps the total
  // graceful-shutdown time at SHUTDOWN_FORCE_EXIT_MS; if that elapses before
  // we reach the clean process.exit at the bottom, we log and exit anyway so
  // pm2 can auto-respawn the worker.
  const SHUTDOWN_FORCE_EXIT_MS = Number(
    process.env.STREAM_SHUTDOWN_FORCE_EXIT_MS ?? 15_000,
  );
  const shutdown = async (exitCodeOrSignal: number | NodeJS.Signals = 0) => {
    const exitCode =
      typeof exitCodeOrSignal === "number" ? exitCodeOrSignal : 0;
    console.log("\n[Main] Shutting down...");

    const forceExitTimer = setTimeout(() => {
      console.error(
        `[Main] Graceful shutdown exceeded ${SHUTDOWN_FORCE_EXIT_MS}ms timeout; forcing process.exit(${exitCode}) so pm2 can respawn.`,
      );
      process.exit(exitCode);
    }, SHUTDOWN_FORCE_EXIT_MS);
    // Let the process exit naturally if this is the only outstanding timer.
    if (typeof forceExitTimer.unref === "function") forceExitTimer.unref();

    try {
      if (captureWatchdog) clearInterval(captureWatchdog);
      clearInterval(statusSnapshotInterval);
      clearInterval(statusInterval);
      await stopCdpCapture();
      await getRTMPBridge().stop();
      clearExternalStatusSnapshot();
      await cleanup();

      // Final leak report: print and validate that no timers were orphaned.
      const diag = getStreamLeakDiagnostics();
      if (diag) {
        diag.printReport();
        try {
          diag.assertNoLeaks("after shutdown");
          console.log("[StreamLeakDiagnostics] ✅ No timer leaks detected.");
        } catch (leakErr) {
          console.error(String(leakErr));
        }
        diag.uninstall();
      }
    } catch (shutdownErr) {
      console.error(
        "[Main] Error during graceful shutdown (will still exit):",
        shutdownErr,
      );
    } finally {
      clearTimeout(forceExitTimer);
      process.exit(exitCode);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep process alive
  await new Promise(() => {});
}

async function cleanup() {
  console.log("[Main] Cleaning up...");

  if (page) {
    try {
      await page.evaluate(() => {
        (
          window as unknown as { __captureControl__?: { stop: () => void } }
        ).__captureControl__?.stop?.();
      });
    } catch {
      // Page might already be closed
    }
  }

  const bridge = getRTMPBridge();
  await bridge.stopProcessing();

  if (browser) {
    await browser.close();
    browser = null;
  }

  // In x11_nvenc mode Chrome is a detached child process attached via CDP,
  // so `browser.close()` above only disconnects — it does NOT terminate the
  // Chrome child. Kill the child explicitly. No-op for other capture modes.
  if (x11NvencChromeProcess && !x11NvencChromeProcess.killed) {
    try {
      x11NvencChromeProcess.kill("SIGKILL");
    } catch {
      // Already dead
    }
    x11NvencChromeProcess = null;
  }

  page = null;
  latestBrowserCaptureStatus = null;
  latestSceneUrl = null;
  latestActiveBundle = null;

  clearExternalStatusSnapshot();
  console.log("[Main] Cleanup complete");
}

// Run
main().catch((err) => {
  console.error("[Main] Fatal error:", err);
  // Same belt-and-suspenders pattern as shutdown(): if cleanup() hangs (because
  // Chromium or the RTMP bridge has already crashed in a way that deadlocks
  // the corresponding cleanup await), force-exit so pm2 can respawn us. Bug
  // observed 2026-04-15.
  const fatalForceExitMs = Number(
    process.env.STREAM_SHUTDOWN_FORCE_EXIT_MS ?? 15_000,
  );
  const fatalForceExitTimer = setTimeout(() => {
    console.error(
      `[Main] Fatal cleanup exceeded ${fatalForceExitMs}ms; forcing exit(1).`,
    );
    process.exit(1);
  }, fatalForceExitMs);
  if (typeof fatalForceExitTimer.unref === "function") {
    fatalForceExitTimer.unref();
  }
  cleanup()
    .catch((cleanupErr) => {
      console.error("[Main] Error during fatal cleanup:", cleanupErr);
    })
    .finally(() => {
      clearTimeout(fatalForceExitTimer);
      process.exit(1);
    });
});
