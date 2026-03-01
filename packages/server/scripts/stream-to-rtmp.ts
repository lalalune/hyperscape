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
 * Falls back to the legacy MediaRecorder + WebSocket path if CDP capture fails
 * or STREAM_CAPTURE_MODE=mediarecorder is set.
 *
 * Usage:
 *   bun run stream:rtmp
 *   bun run packages/server/scripts/stream-to-rtmp.ts
 *
 * Environment Variables:
 *   STREAM_CAPTURE_MODE      - 'cdp' (default) or 'mediarecorder' (legacy)
 *   STREAM_CAPTURE_HEADLESS  - 'true' for headless (default: false for better GPU rendering)
 *   STREAM_CAPTURE_CHANNEL   - Browser channel ('chrome', 'msedge', etc.)
 *   STREAM_CAPTURE_ANGLE     - ANGLE backend (default: metal on macOS, vulkan elsewhere)
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
 *   STREAMING_VIEWER_ACCESS_TOKEN - Optional token appended as streamToken for gated viewer WS
 *   GAME_URL                 - URL to Hyperscape (default: http://localhost:3333/?page=stream)
 *   GAME_FALLBACK_URLS       - Comma-separated fallback URLs
 *   RTMP_BRIDGE_PORT         - WebSocket port for legacy bridge (default: 8765)
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page, type CDPSession } from "playwright";
import {
  getRTMPBridge,
  startRTMPBridge,
  generateCaptureScript,
  generateWebCodecsCaptureScript,
} from "../src/streaming/index.js";
import { errMsg } from "../src/shared/errMsg.ts";

// ── Configuration ──────────────────────────────────────────────────────────

const GAME_URL = process.env.GAME_URL || "http://localhost:3333/?page=stream";
const GAME_FALLBACK_URLS = (
  process.env.GAME_FALLBACK_URLS ||
  "http://localhost:3333/?embedded=true&mode=spectator,http://localhost:3333/"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const STREAMING_VIEWER_ACCESS_TOKEN = (
  process.env.STREAMING_VIEWER_ACCESS_TOKEN || ""
).trim();

function withViewerAccessToken(rawUrl: string): string {
  if (!STREAMING_VIEWER_ACCESS_TOKEN) return rawUrl;
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("streamToken", STREAMING_VIEWER_ACCESS_TOKEN);
    return url.toString();
  } catch {
    const separator = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${separator}streamToken=${encodeURIComponent(STREAMING_VIEWER_ACCESS_TOKEN)}`;
  }
}

/**
 * Process game URL for streaming.
 * WebGPU is REQUIRED - there is no WebGL fallback.
 */
function withRendererCaptureHints(rawUrl: string): string {
  // WebGPU is required - we don't add any disable flags
  // The STREAM_CAPTURE_DISABLE_WEBGPU env var is ignored
  if (
    /^(1|true|yes|on)$/i.test(process.env.STREAM_CAPTURE_DISABLE_WEBGPU || "")
  ) {
    console.warn(
      "[Main] WARNING: STREAM_CAPTURE_DISABLE_WEBGPU is set but ignored - WebGPU is REQUIRED",
    );
  }
  return rawUrl;
}

const GAME_URL_CANDIDATES = Array.from(
  new Set(
    [GAME_URL, ...GAME_FALLBACK_URLS]
      .map(withViewerAccessToken)
      .map(withRendererCaptureHints),
  ),
);

const BRIDGE_PORT = parseInt(process.env.RTMP_BRIDGE_PORT || "8765", 10);
const BRIDGE_URL = `ws://localhost:${BRIDGE_PORT}`;
const SPECTATOR_PORT = parseInt(process.env.SPECTATOR_PORT || "4180", 10);
const EXTERNAL_STATUS_FILE = (process.env.RTMP_STATUS_FILE || "").trim();
let externalStatusWriteErrored = false;

/** Capture mode: 'cdp' (fast) or 'mediarecorder' (legacy) or 'webcodecs' (holy grail) */
const CAPTURE_MODE = (process.env.STREAM_CAPTURE_MODE?.trim() || "cdp") as
  | "cdp"
  | "mediarecorder"
  | "webcodecs";
// Headless modes: false (with display), true (legacy headless), "new" (Chrome's new headless with GPU)
const STREAM_CAPTURE_HEADLESS_RAW =
  process.env.STREAM_CAPTURE_HEADLESS?.trim() || "false";
const STREAM_CAPTURE_HEADLESS =
  STREAM_CAPTURE_HEADLESS_RAW === "true" ||
  STREAM_CAPTURE_HEADLESS_RAW === "new";
const STREAM_CAPTURE_HEADLESS_NEW = STREAM_CAPTURE_HEADLESS_RAW === "new";
const STREAM_CAPTURE_CHANNEL = process.env.STREAM_CAPTURE_CHANNEL?.trim() || "";
const STREAM_CAPTURE_EXECUTABLE =
  process.env.STREAM_CAPTURE_EXECUTABLE?.trim() || "";
const STREAM_CAPTURE_USE_EGL =
  process.env.STREAM_CAPTURE_USE_EGL?.toLowerCase() === "true";
// Use ozone-platform=headless for headless GPU rendering (works without X11)
const STREAM_CAPTURE_OZONE_HEADLESS =
  process.env.STREAM_CAPTURE_OZONE_HEADLESS?.toLowerCase() === "true";
const ANGLE_BACKEND =
  process.env.STREAM_CAPTURE_ANGLE?.trim() ||
  (process.platform === "darwin" ? "metal" : "vulkan");
const CDP_QUALITY = Math.min(
  100,
  Math.max(1, parseInt(process.env.STREAM_CDP_QUALITY || "80", 10)),
);
const TARGET_FPS = parseInt(process.env.STREAM_FPS || "30", 10);

function parseEvenDimension(
  rawValue: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(rawValue || "", 10);
  const candidate = Number.isFinite(parsed) ? parsed : fallback;
  const clamped = Math.max(2, candidate);
  return clamped % 2 === 0 ? clamped : clamped - 1;
}

// Viewport settings (default 720p for stream stability)
const VIEWPORT = {
  width: parseEvenDimension(process.env.STREAM_CAPTURE_WIDTH, 1280),
  height: parseEvenDimension(process.env.STREAM_CAPTURE_HEIGHT, 720),
};

let browser: Browser | null = null;
let page: Page | null = null;
let cdpSession: CDPSession | null = null;
let selectedGameUrl: string | null = null;
let launchTime = Date.now();
const BROWSER_RESTART_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes (prevents WebGPU OOM)
const CAPTURE_RECOVERY_TIMEOUT_MS = Math.max(
  10_000,
  Number.parseInt(
    process.env.STREAM_CAPTURE_RECOVERY_TIMEOUT_MS || "30000",
    10,
  ) || 30_000,
);
const CAPTURE_RECOVERY_MAX_FAILURES = Math.max(
  1,
  Number.parseInt(
    process.env.STREAM_CAPTURE_RECOVERY_MAX_FAILURES || "4",
    10,
  ) || 4,
);

// ── CDP Frame Rate Tracking ────────────────────────────────────────────────

let cdpFrameCount = 0;
let cdpFps = 0;
let cdpFpsIntervalId: ReturnType<typeof setInterval> | null = null;
let cdpDroppedFrames = 0;
let cdpLastFrameWidth = 0;
let cdpLastFrameHeight = 0;
let cdpResolutionMismatchCount = 0;
/** Flag to suppress old CDP handlers during recovery */
let cdpRecoveryModeActive = false;

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

type ActiveCaptureMode = "cdp" | "webcodecs" | "mediarecorder";

function writeExternalStatusSnapshot(
  bridge: ReturnType<typeof getRTMPBridge>,
  captureMode: ActiveCaptureMode,
): void {
  if (!EXTERNAL_STATUS_FILE) return;

  const bridgeStatus = bridge.getStatus();
  const stats = bridge.getStats();
  const processMemory = process.memoryUsage();
  const payload = {
    ...bridgeStatus,
    stats: {
      bytesReceived: stats.bytesReceived,
      bytesReceivedMB: (stats.bytesReceived / 1024 / 1024).toFixed(2),
      uptimeSeconds: Math.floor(stats.uptime / 1000),
      destinations: stats.destinations,
      healthy: stats.healthy,
      droppedFrames: stats.droppedFrames,
      backpressured: stats.backpressured,
      spectators: stats.spectators,
      processMemory: stats.processMemory,
    },
    captureMode,
    processRssBytes: processMemory.rss,
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

async function waitForStreamReadiness(
  pageRef: Page,
  timeoutMs: number,
): Promise<boolean> {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let probeCount = 0;

  let consecutiveTimeouts = 0;
  const MAX_CONSECUTIVE_TIMEOUTS = 5;

  while (Date.now() < deadline) {
    probeCount++;
    try {
      // Add 5s timeout to prevent hanging evaluate calls
      const probePromise = pageRef.evaluate(() => {
        const win = window as unknown as {
          __HYPERSCAPE_STREAM_READY__?: boolean;
        };
        const text = (document.body?.innerText || "").slice(0, 512);
        const normalizedText = text.toLowerCase();
        const hasStreamingBootUi =
          normalizedText.includes("waiting for duel data") ||
          normalizedText.includes("initializing world systems");
        return {
          hasCanvas: document.querySelector("canvas") !== null,
          readyFlag: win.__HYPERSCAPE_STREAM_READY__ === true,
          hasStreamingBootUi,
          textPreview: text.slice(0, 200),
        };
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Probe timeout (5s)")), 5000),
      );

      const probe = await Promise.race([probePromise, timeoutPromise]);
      consecutiveTimeouts = 0; // Reset on success

      // Log probe status every 10 seconds
      if (probeCount % 10 === 0 || probeCount === 1) {
        console.log(
          `[Main] Stream readiness probe #${probeCount}: canvas=${probe.hasCanvas}, ready=${probe.readyFlag}, bootUi=${probe.hasStreamingBootUi}, text="${probe.textPreview.replace(/\n/g, " ").slice(0, 80)}..."`,
        );
      }

      if (probe.readyFlag) {
        console.log("[Main] Stream ready via __HYPERSCAPE_STREAM_READY__ flag");
        return true;
      }

      // Allow capture once we have a canvas and the stream boot/loading UI has
      // cleared (the old gate accepted any canvas, which could lock us at 3%).
      if (probe.hasCanvas && !probe.hasStreamingBootUi) {
        console.log("[Main] Stream ready via canvas detection (no boot UI)");
        return true;
      }

      // Hard fallback after sustained boot-screen presence to avoid deadlock.
      if (probe.hasStreamingBootUi && Date.now() - startedAt >= 180_000) {
        console.log(
          "[Main] Stream ready via 180s fallback (boot UI persisted)",
        );
        return true;
      }
    } catch (err) {
      const errMessage = errMsg(err);
      const isTimeout =
        errMessage.includes("timeout") || errMessage.includes("Timeout");

      if (isTimeout) {
        consecutiveTimeouts++;
        console.warn(
          `[Main] Stream readiness probe failed (timeout ${consecutiveTimeouts}/${MAX_CONSECUTIVE_TIMEOUTS}): ${errMessage}`,
        );

        // If we get too many consecutive timeouts, assume the page is stuck
        // and proceed with capture anyway (WebGPU might be blocking JS but still rendering)
        if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
          console.warn(
            `[Main] Too many consecutive probe timeouts (${consecutiveTimeouts}). Proceeding with capture anyway...`,
          );
          return true;
        }
      } else if (!isTransientPageEvalError(err)) {
        console.warn("[Main] Stream readiness probe failed:", errMessage);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  console.warn(`[Main] Stream readiness timed out after ${timeoutMs}ms`);
  return false;
}

// ── Browser Launch ─────────────────────────────────────────────────────────

/**
 * Quick WebGPU preflight test to detect initialization hangs.
 * Returns true if WebGPU initializes successfully within timeout.
 */
async function testWebGpuInit(
  testPage: Page,
  timeoutMs: number = 15000,
): Promise<{ success: boolean; error?: string; adapterInfo?: string }> {
  console.log(
    `[Main] Testing WebGPU initialization (timeout: ${timeoutMs}ms)...`,
  );

  try {
    const result = await Promise.race([
      testPage.evaluate(async () => {
        try {
          // Check if WebGPU API is available
          if (!navigator.gpu) {
            return { success: false, error: "navigator.gpu not available" };
          }

          // Try to get adapter
          const adapter = await navigator.gpu.requestAdapter({
            powerPreference: "high-performance",
          });

          if (!adapter) {
            return { success: false, error: "Failed to get WebGPU adapter" };
          }

          // Try to get device
          const device = await adapter.requestDevice();

          if (!device) {
            return { success: false, error: "Failed to get WebGPU device" };
          }

          // Get adapter info for diagnostics
          const info = await adapter.requestAdapterInfo();
          const adapterInfo = `${info.vendor || "unknown"} - ${info.architecture || "unknown"} (${info.description || "no description"})`;

          // Clean up
          device.destroy();

          return { success: true, adapterInfo };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
      new Promise<{ success: boolean; error: string }>((resolve) =>
        setTimeout(
          () =>
            resolve({
              success: false,
              error: `WebGPU initialization timed out after ${timeoutMs}ms`,
            }),
          timeoutMs,
        ),
      ),
    ]);

    if (result.success) {
      console.log(`[Main] ✅ WebGPU preflight PASSED: ${result.adapterInfo}`);
    } else {
      console.warn(`[Main] ⚠️ WebGPU preflight FAILED: ${result.error}`);
    }

    return result;
  } catch (err) {
    const error = errMsg(err);
    console.warn(`[Main] ⚠️ WebGPU preflight error: ${error}`);
    return { success: false, error };
  }
}

/**
 * Capture GPU diagnostics from chrome://gpu to help debug WebGPU issues.
 * This runs a quick Chrome instance to dump GPU info.
 */
async function captureGpuDiagnostics(): Promise<void> {
  console.log("[Main] Capturing GPU diagnostics from chrome://gpu...");
  console.log(
    `[Main] Environment: DISPLAY=${process.env.DISPLAY}, ANGLE=${ANGLE_BACKEND}`,
  );
  console.log(
    `[Main] VK_ICD_FILENAMES=${process.env.VK_ICD_FILENAMES || "(not set)"}`,
  );

  // Use same headless setting as main browser - WebGPU REQUIRES a display
  // headless: true does NOT support WebGPU
  const playwrightHeadless =
    STREAM_CAPTURE_HEADLESS && !STREAM_CAPTURE_HEADLESS_NEW;

  // Use Metal on macOS, Vulkan elsewhere
  const diagFeatureFlags =
    process.platform === "darwin"
      ? "--enable-features=UseSkiaRenderer,WebGPU"
      : "--enable-features=Vulkan,UseSkiaRenderer,WebGPU";

  const launchConfig = {
    headless: playwrightHeadless,
    ignoreDefaultArgs: ["--enable-unsafe-swiftshader"],
    args: [
      ...(STREAM_CAPTURE_HEADLESS_NEW ? ["--headless=new"] : []),
      // CRITICAL: Sandbox bypass for container GPU access
      "--no-sandbox",
      "--disable-gpu-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      // GPU / WebGPU rendering
      "--use-gl=angle",
      `--use-angle=${ANGLE_BACKEND}`,
      "--enable-unsafe-webgpu",
      diagFeatureFlags,
      "--ignore-gpu-blocklist",
      "--disable-software-rasterizer",
      "--disable-gpu-driver-bug-workarounds",
    ],
    env: {
      ...process.env,
      // Ensure Vulkan ICD is explicitly set (Linux/Windows only)
      ...(process.platform !== "darwin" && {
        VK_ICD_FILENAMES:
          process.env.VK_ICD_FILENAMES ||
          "/usr/share/vulkan/icd.d/nvidia_icd.json",
      }),
    },
  };

  let diagBrowser: Browser | null = null;
  try {
    // Try to get the same browser that will be used for streaming
    if (STREAM_CAPTURE_EXECUTABLE) {
      diagBrowser = await chromium.launch({
        ...launchConfig,
        executablePath: STREAM_CAPTURE_EXECUTABLE,
      });
    } else if (STREAM_CAPTURE_CHANNEL) {
      diagBrowser = await chromium.launch({
        ...launchConfig,
        channel: STREAM_CAPTURE_CHANNEL,
      });
    } else {
      diagBrowser = await chromium.launch(launchConfig);
    }

    const diagPage = await diagBrowser.newPage();
    await diagPage.goto("chrome://gpu", { timeout: 30000 });

    // Wait for page to load
    await diagPage.waitForTimeout(2000);

    // Extract key GPU information
    const gpuInfo = await diagPage.evaluate(() => {
      const getText = (selector: string) =>
        document.querySelector(selector)?.textContent?.trim() || "";

      // Get all text content for analysis
      const bodyText = document.body?.innerText || "";

      // Look for key WebGPU-related strings
      const hasWebGpu = bodyText.includes("WebGPU");
      const hasVulkan = bodyText.includes("Vulkan");
      const hasHardwareAcceleration = bodyText.includes("Hardware accelerated");

      // Try to extract feature status
      const featureStatusMatch = bodyText.match(
        /WebGPU[:\s]*(Hardware accelerated|Software only|Disabled|Unavailable|Blocked)/i,
      );

      return {
        webgpuStatus: featureStatusMatch
          ? featureStatusMatch[1]
          : hasWebGpu
            ? "Present"
            : "Not found",
        hasVulkan,
        hasHardwareAcceleration,
        // Get first 3000 chars of text for debugging
        textPreview: bodyText.slice(0, 3000),
      };
    });

    console.log("[GPU Diagnostics] ═══════════════════════════════════════");
    console.log(`[GPU Diagnostics] WebGPU Status: ${gpuInfo.webgpuStatus}`);
    console.log(`[GPU Diagnostics] Vulkan Support: ${gpuInfo.hasVulkan}`);
    console.log(
      `[GPU Diagnostics] HW Acceleration: ${gpuInfo.hasHardwareAcceleration}`,
    );
    console.log("[GPU Diagnostics] ═══════════════════════════════════════");

    // Log detailed info if WebGPU is not hardware accelerated
    if (
      gpuInfo.webgpuStatus !== "Hardware accelerated" &&
      gpuInfo.webgpuStatus !== "Present"
    ) {
      console.warn("[GPU Diagnostics] ⚠️ WebGPU may not be working properly!");
      console.warn(
        "[GPU Diagnostics] Text preview:",
        gpuInfo.textPreview.slice(0, 1500),
      );
    }

    await diagPage.close();
    await diagBrowser.close();
    diagBrowser = null;
  } catch (err) {
    console.warn("[GPU Diagnostics] Failed to capture GPU info:", errMsg(err));
  } finally {
    if (diagBrowser) {
      await diagBrowser.close().catch(() => {});
    }
  }
}

async function launchCaptureBrowser() {
  // WebGPU is REQUIRED - configure Chrome for optimal WebGPU support
  // Use Metal on macOS, Vulkan elsewhere
  const featureFlags =
    process.platform === "darwin"
      ? "--enable-features=UseSkiaRenderer,WebGPU"
      : "--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan,UseSkiaRenderer,WebGPU";

  // Use ANGLE with Metal on macOS, Vulkan elsewhere
  const glArgs = ["--use-gl=angle", `--use-angle=${ANGLE_BACKEND}`];

  // Dawn-specific flags for container GPU access
  const dawnArgs = [
    "--enable-dawn-features=allow_unsafe_apis,disable_blob_cache",
  ];

  // Headless mode configuration
  // NOTE: WebGPU requires a display (Xorg or Xvfb) - pure headless won't work
  // Playwright's headless option only accepts boolean
  const playwrightHeadless =
    STREAM_CAPTURE_HEADLESS && !STREAM_CAPTURE_HEADLESS_NEW;

  if (STREAM_CAPTURE_HEADLESS && !process.env.DISPLAY) {
    console.warn(
      "[Main] WARNING: Headless mode requested but WebGPU requires a display (Xorg/Xvfb)",
    );
  }

  // Ozone platform for headless GPU rendering (works without X11)
  const ozoneArgs = STREAM_CAPTURE_OZONE_HEADLESS
    ? ["--ozone-platform=headless"]
    : [];

  const launchConfig = {
    headless: playwrightHeadless,
    // Ignore Playwright's SwiftShader default which conflicts with GPU rendering
    ignoreDefaultArgs: ["--enable-unsafe-swiftshader"],
    args: [
      // Ozone headless platform (if set) - enables GPU without X11
      ...ozoneArgs,
      // Chrome's new headless mode (if requested) - must be passed as arg, not option
      ...(STREAM_CAPTURE_HEADLESS_NEW ? ["--headless=new"] : []),
      // GPU / WebGPU essentials - WebGPU is REQUIRED
      ...glArgs,
      ...dawnArgs,
      "--enable-unsafe-webgpu",
      featureFlags,
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization",
      "--use-cmd-decoder=passthrough",
      // Force hardware GPU rendering - disable software fallbacks
      "--disable-software-rasterizer",
      "--disable-gpu-driver-bug-workarounds",
      "--enable-accelerated-2d-canvas",
      "--enable-gpu-compositing",
      "--enable-native-gpu-memory-buffers",
      // Sandbox & stability - CRITICAL: disable GPU sandbox for container GPU access
      "--no-sandbox",
      "--disable-gpu-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--autoplay-policy=no-user-gesture-required",
      // Prevent Chromium from throttling rendering/timers
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-hang-monitor",
      // Force continuous rendering - don't skip frames
      "--disable-frame-rate-limit",
      // Audio output - use PulseAudio virtual sink for capture
      "--alsa-output-device=pulse",
      "--audio-output-channels=2",
    ],
    // Set environment for PulseAudio
    env: {
      ...process.env,
      PULSE_SERVER: "unix:/run/pulse/native",
      PULSE_SINK: "chrome_audio",
    },
  };

  // Log critical environment for WebGPU debugging
  console.log(`[Main] Browser launch config:`);
  console.log(`  - DISPLAY: ${process.env.DISPLAY || "(not set)"}`);
  console.log(`  - STREAM_CAPTURE_HEADLESS: ${STREAM_CAPTURE_HEADLESS}`);
  console.log(
    `  - STREAM_CAPTURE_EXECUTABLE: ${STREAM_CAPTURE_EXECUTABLE || "(not set)"}`,
  );
  console.log(
    `  - STREAM_CAPTURE_CHANNEL: ${STREAM_CAPTURE_CHANNEL || "(not set)"}`,
  );
  console.log(`  - playwrightHeadless: ${playwrightHeadless}`);
  console.log(
    `  - VK_ICD_FILENAMES: ${process.env.VK_ICD_FILENAMES || "(not set)"}`,
  );

  // Try explicit executable first (most reliable for WebGPU)
  if (STREAM_CAPTURE_EXECUTABLE) {
    if (fs.existsSync(STREAM_CAPTURE_EXECUTABLE)) {
      console.log(
        `[Main] Launching with explicit executable: ${STREAM_CAPTURE_EXECUTABLE}`,
      );
      return await chromium.launch({
        ...launchConfig,
        executablePath: STREAM_CAPTURE_EXECUTABLE,
      });
    } else {
      console.warn(
        `[Main] Executable not found: ${STREAM_CAPTURE_EXECUTABLE}, trying alternatives...`,
      );
      // Try common Chrome Dev locations
      const alternatives = [
        "/usr/bin/google-chrome-unstable",
        "/opt/google/chrome-unstable/google-chrome-unstable",
        "/usr/bin/google-chrome",
      ];
      for (const alt of alternatives) {
        if (fs.existsSync(alt)) {
          console.log(`[Main] Found alternative: ${alt}`);
          return await chromium.launch({
            ...launchConfig,
            executablePath: alt,
          });
        }
      }
    }
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

  // On macOS, Playwright's bundled Chromium doesn't have WebGPU support.
  // Try to use Chrome first for proper WebGPU support.
  if (process.platform === "darwin") {
    const macChromePaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    for (const chromePath of macChromePaths) {
      if (fs.existsSync(chromePath)) {
        console.log(
          `[Main] macOS: Using Chrome for WebGPU support: ${chromePath}`,
        );
        return await chromium.launch({
          ...launchConfig,
          executablePath: chromePath,
        });
      }
    }
    console.warn(
      "[Main] macOS: Chrome not found at standard locations. WebGPU may not work with bundled Chromium.",
    );
    console.warn(
      "[Main] Install Chrome or set STREAM_CAPTURE_EXECUTABLE=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    );
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

async function setupBrowser() {
  if (browser) await cleanup();

  // Capture GPU diagnostics before launching main browser
  // This helps debug WebGPU issues on remote GPU servers
  await captureGpuDiagnostics();

  const glMode = STREAM_CAPTURE_USE_EGL ? "egl" : `angle/${ANGLE_BACKEND}`;
  const headlessMode = STREAM_CAPTURE_HEADLESS_NEW
    ? "new"
    : STREAM_CAPTURE_HEADLESS;
  const browserInfo = STREAM_CAPTURE_EXECUTABLE
    ? `exec=${STREAM_CAPTURE_EXECUTABLE}`
    : STREAM_CAPTURE_CHANNEL
      ? `channel=${STREAM_CAPTURE_CHANNEL}`
      : "bundled";
  console.log(
    `[Main] Launching browser (headless=${headlessMode}, gl=${glMode}, ${browserInfo}, mode=${CAPTURE_MODE})...`,
  );
  browser = await launchCaptureBrowser();

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

  if (!selectedGameUrl) {
    // First, do a quick WebGPU preflight test on a blank page
    // This helps detect WebGPU initialization hangs before loading heavy game content
    console.log("[Main] Running WebGPU preflight test on blank page...");
    try {
      await page.goto("about:blank", { timeout: 10000 });
      const webgpuTest = await testWebGpuInit(page, 20000);

      if (!webgpuTest.success) {
        console.error("[Main] ❌ WebGPU PREFLIGHT FAILED:", webgpuTest.error);
        console.error(
          "[Main] WebGPU is REQUIRED but failed to initialize. Possible causes:",
        );
        console.error("  - GPU driver issues or missing Vulkan support");
        console.error("  - Chrome WebGPU disabled or blocked");
        console.error("  - Display/Xvfb configuration issues");
        console.error(
          "[Main] Will attempt to proceed anyway (game may hang or fail)...",
        );
      }
    } catch (err) {
      console.warn("[Main] WebGPU preflight test error:", errMsg(err));
    }

    for (const candidateUrl of GAME_URL_CANDIDATES) {
      console.log(`[Main] Navigating to ${candidateUrl}...`);
      try {
        // Use longer timeout for Vite dev mode (180s) - production builds are faster
        await page.goto(candidateUrl, {
          timeout: 180_000,
          waitUntil: "domcontentloaded",
        });
      } catch (err) {
        console.warn(`[Main] Failed to load ${candidateUrl}:`, err);
        continue;
      }

      console.log(`[Main] Waiting for stream readiness on ${candidateUrl}...`);
      const isReady = await waitForStreamReadiness(page, 90_000);
      if (isReady) {
        selectedGameUrl = candidateUrl;
        break;
      }
      console.warn(
        `[Main] Stream readiness not detected on ${candidateUrl}, trying fallback...`,
      );
    }
  } else {
    try {
      await page.goto(selectedGameUrl, {
        timeout: 180_000,
        waitUntil: "domcontentloaded",
      });
    } catch (err) {
      console.error(
        `[Main] Failed to reload configured URL ${selectedGameUrl}`,
        err,
      );
    }
  }

  if (!selectedGameUrl) {
    console.error(
      `[Main] Could not find a game canvas on any candidate URL: ${GAME_URL_CANDIDATES.join(", ")}`,
    );
    console.error(
      "[Main] Make sure the game client is running and supports stream/spectator mode.",
    );
    await cleanup();
    process.exit(1);
  }

  console.log(`[Main] Using game page: ${selectedGameUrl}`);
  console.log("[Main] Waiting for game to initialize...");
  await page.waitForTimeout(5000);

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

  // Handle incoming frames from CDP
  cdpSession.on("Page.screencastFrame", async (params) => {
    // Skip if we're in recovery mode (old session handler may still fire briefly)
    if (cdpRecoveryModeActive) return;

    const { sessionId, data: base64Data, metadata } = params;

    // Track frame dimensions from CDP metadata
    if (metadata) {
      const { deviceWidth, deviceHeight } = metadata;
      if (deviceWidth && deviceHeight) {
        // Detect resolution changes
        if (
          cdpLastFrameWidth !== deviceWidth ||
          cdpLastFrameHeight !== deviceHeight
        ) {
          const wasWrongSize =
            cdpLastFrameWidth > 0 &&
            (cdpLastFrameWidth !== VIEWPORT.width ||
              cdpLastFrameHeight !== VIEWPORT.height);
          cdpLastFrameWidth = deviceWidth;
          cdpLastFrameHeight = deviceHeight;

          // Log dimension changes
          const matches =
            deviceWidth === VIEWPORT.width && deviceHeight === VIEWPORT.height;
          if (!matches) {
            cdpResolutionMismatchCount++;
            if (
              cdpResolutionMismatchCount <= 3 ||
              cdpResolutionMismatchCount % 100 === 0
            ) {
              console.warn(
                `[CDP] Resolution mismatch: got ${deviceWidth}x${deviceHeight}, expected ${VIEWPORT.width}x${VIEWPORT.height} (count: ${cdpResolutionMismatchCount})`,
              );
            }
          } else if (wasWrongSize) {
            console.log(
              `[CDP] Resolution restored: ${deviceWidth}x${deviceHeight} ✓`,
            );
            cdpResolutionMismatchCount = 0;
          }
        }
      }
    }

    // Acknowledge the frame immediately to request the next one
    try {
      await cdpSession?.send("Page.screencastFrameAck", { sessionId });
    } catch {
      // Session may have been destroyed during page navigation
    }

    // Decode base64 JPEG and feed to FFmpeg
    const jpegBuffer = Buffer.from(base64Data, "base64");
    const written = bridge.feedFrame(jpegBuffer);

    if (written) {
      cdpFrameCount++;
    } else {
      cdpDroppedFrames++;
    }
  });

  // Start the screencast
  await cdpSession.send("Page.startScreencast", {
    format: "jpeg",
    quality: CDP_QUALITY,
    maxWidth: VIEWPORT.width,
    maxHeight: VIEWPORT.height,
    everyNthFrame: 1, // Capture every frame
  });

  console.log("[CDP] ✅ Screencast capture started — frames piping to FFmpeg");
}

async function stopCdpCapture() {
  stopFpsTracking();

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

  const captureScript = generateCaptureScript({
    bridgeUrl: BRIDGE_URL,
    fps: TARGET_FPS,
    bitrate: 6000000,
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
    bitrate: 6000000,
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

type BrowserCaptureStatus = {
  recording?: boolean;
  wsConnected?: boolean;
  chunkCount?: number;
  bytesSent?: number;
  uptime?: number;
  lastChunkMs?: number;
  captureFps?: number;
};

async function getBrowserCaptureStatus(): Promise<BrowserCaptureStatus | null> {
  if (!page || page.isClosed()) return null;

  try {
    return (await page.evaluate(() => {
      return (
        window as unknown as {
          __captureControl__?: { getStatus: () => unknown };
        }
      ).__captureControl__?.getStatus?.();
    })) as BrowserCaptureStatus | null;
  } catch (err) {
    if (isTransientPageEvalError(err)) return null;
    throw err;
  }
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
    const captureStatus = await getBrowserCaptureStatus();
    const bridgeStats = bridge.getStats();
    const captureActive =
      captureStatus?.recording === true && captureStatus?.wsConnected === true;
    const hasTraffic = bridgeStats.bytesReceived > 0;

    if (captureActive && hasTraffic) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
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

  // Get bridge instance
  const bridge = getRTMPBridge();

  // Start Spectator Server for zero-latency WebSockets stream
  bridge.startSpectatorServer(SPECTATOR_PORT);

  // Setup browser
  await setupBrowser();

  let captureWatchdog: ReturnType<typeof setInterval> | null = null;
  let activeCaptureMode: "cdp" | "webcodecs" | "mediarecorder" = CAPTURE_MODE;
  let cdpStalledIntervals = 0;
  let lastCdpBytesReceived = 0;
  let cdpRecoveryInFlight = false;
  let cdpRecoveryFailures = 0;

  if (CAPTURE_MODE === "cdp") {
    // ── CDP Mode: Direct screencast frame piping ──
    await startCdpCapture(bridge);
  } else if (CAPTURE_MODE === "webcodecs") {
    // ── WebCodecs Mode: Native VideoEncoder API to FFmpeg -c:v copy ──
    captureWatchdog = (await startWebCodecsCapture(bridge)) ?? null;
    const healthy = await waitForCaptureTraffic(bridge, 20000);
    if (!healthy) {
      console.warn(
        "[Main] WebCodecs capture produced no media within 20s; falling back to CDP screencast capture.",
      );
      if (captureWatchdog) {
        clearInterval(captureWatchdog);
        captureWatchdog = null;
      }
      await stopInPageCaptureControl();
      bridge.stop();
      bridge.startSpectatorServer(SPECTATOR_PORT);
      await startCdpCapture(bridge);
      activeCaptureMode = "cdp";
    }
  } else {
    // ── Legacy Mode: MediaRecorder + WebSocket ──
    captureWatchdog = (await startLegacyCapture(bridge)) ?? null;
    activeCaptureMode = "mediarecorder";
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("Streaming active! Press Ctrl+C to stop.");
  console.log("=".repeat(60));
  console.log("");

  writeExternalStatusSnapshot(bridge, activeCaptureMode);
  const statusSnapshotInterval = setInterval(() => {
    writeExternalStatusSnapshot(bridge, activeCaptureMode);
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

    if (activeCaptureMode === "cdp") {
      const resInfo =
        cdpLastFrameWidth > 0
          ? `${cdpLastFrameWidth}x${cdpLastFrameHeight}${cdpLastFrameWidth !== VIEWPORT.width || cdpLastFrameHeight !== VIEWPORT.height ? " (MISMATCH!)" : ""}`
          : "unknown";
      console.log(
        `[Stream Health] CDP FPS: ${cdpFps} | Resolution: ${resInfo} | Frames: ${bridge.getDirectFrameCount()} | Dropped: ${cdpDroppedFrames} | BridgeDrops: ${stats.droppedFrames} | Backpressure: ${stats.backpressured ? "ON" : "off"}`,
      );

      // Auto-recover viewport if resolution is consistently wrong (e.g., window minimized)
      const hasMismatch =
        cdpLastFrameWidth > 0 &&
        (cdpLastFrameWidth !== VIEWPORT.width ||
          cdpLastFrameHeight !== VIEWPORT.height);
      if (
        hasMismatch &&
        cdpResolutionMismatchCount >= 10 &&
        !cdpRecoveryInFlight
      ) {
        console.warn(
          `[Main] Persistent resolution mismatch (${cdpResolutionMismatchCount} frames). Attempting viewport fix...`,
        );
        cdpResolutionMismatchCount = 0;
        // Try to fix viewport size via Playwright
        if (page && !page.isClosed()) {
          page
            .setViewportSize(VIEWPORT)
            .then(() => {
              console.log(
                `[Main] Viewport resized to ${VIEWPORT.width}x${VIEWPORT.height}`,
              );
            })
            .catch((err) => {
              console.warn("[Main] Failed to resize viewport:", errMsg(err));
            });
        }
      }

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

      if (cdpStalledIntervals >= 4) {
        if (cdpRecoveryInFlight) {
          console.warn(
            "[Main] CDP recovery already in progress; skipping duplicate stall recovery attempt.",
          );
          console.log("");
          return;
        }

        console.warn(
          `[Main] CDP capture stalled (${cdpStalledIntervals} intervals without traffic). Attempting soft recovery...`,
        );
        cdpStalledIntervals = 0;
        cdpRecoveryInFlight = true;

        let recovered = false;
        try {
          // Soft recovery: restart CDP screencast without killing browser or FFmpeg
          // Set recovery mode to suppress old handler's frames during transition
          cdpRecoveryModeActive = true;
          await withTimeout(
            (async () => {
              if (cdpSession) {
                try {
                  await cdpSession.send("Page.stopScreencast");
                } catch {
                  // Session may be stale
                }
              }
              // Re-create CDP session on the existing page
              if (page && !page.isClosed()) {
                if (cdpSession) {
                  try {
                    await cdpSession.detach();
                  } catch {
                    /* ignore */
                  }
                  cdpSession = null;
                }
                // Small delay to ensure old session is fully cleaned up
                await new Promise((r) => setTimeout(r, 100));

                cdpSession = await page.context().newCDPSession(page);
                await cdpSession.send("Page.startScreencast", {
                  format: "jpeg",
                  quality: CDP_QUALITY,
                  maxWidth: VIEWPORT.width,
                  maxHeight: VIEWPORT.height,
                  everyNthFrame: 1,
                });
                cdpSession.on("Page.screencastFrame", async (params) => {
                  // Skip if we're still in recovery mode transition
                  if (cdpRecoveryModeActive) return;

                  const { sessionId, data: base64Data, metadata } = params;
                  // Track frame dimensions after recovery
                  if (metadata?.deviceWidth && metadata?.deviceHeight) {
                    cdpLastFrameWidth = metadata.deviceWidth;
                    cdpLastFrameHeight = metadata.deviceHeight;
                  }
                  try {
                    await cdpSession?.send("Page.screencastFrameAck", {
                      sessionId,
                    });
                  } catch {
                    /* ignore */
                  }
                  const jpegBuffer = Buffer.from(base64Data, "base64");
                  const written = bridge.feedFrame(jpegBuffer);
                  if (written) cdpFrameCount++;
                  else cdpDroppedFrames++;
                });
                // Clear recovery mode after new handler is set up
                cdpRecoveryModeActive = false;
              } else {
                throw new Error("Page is closed, need hard recovery");
              }
            })(),
            CAPTURE_RECOVERY_TIMEOUT_MS,
            "CDP soft restart",
          );
          recovered = true;
          cdpRecoveryFailures = 0;
          bridge.resetRestartAttempts();
          lastCdpBytesReceived = bridge.getStats().bytesReceived;
          console.log("[Main] CDP soft recovery successful (no stream gap)");
        } catch (softErr) {
          console.warn(
            `[Main] Soft CDP recovery failed: ${errMsg(softErr)}. Trying hard recovery...`,
          );
          // Hard recovery: full browser teardown and restart
          try {
            await withTimeout(
              (async () => {
                await stopCdpCapture();
                await setupBrowser();
                await startCdpCapture(bridge);
              })(),
              CAPTURE_RECOVERY_TIMEOUT_MS,
              "CDP hard restart",
            );
            recovered = true;
            cdpRecoveryFailures = 0;
            bridge.resetRestartAttempts();
            lastCdpBytesReceived = bridge.getStats().bytesReceived;
            console.log("[Main] CDP hard recovery successful");
          } catch (hardErr) {
            cdpRecoveryFailures += 1;
            console.warn(
              `[Main] CDP hard restart failed (${cdpRecoveryFailures}/${CAPTURE_RECOVERY_MAX_FAILURES}):`,
              errMsg(hardErr),
            );
          }
        } finally {
          cdpRecoveryInFlight = false;
          // Always clear recovery mode to allow frame processing
          cdpRecoveryModeActive = false;
        }

        if (
          !recovered &&
          cdpRecoveryFailures >= CAPTURE_RECOVERY_MAX_FAILURES
        ) {
          console.warn(
            "[Main] Falling back to MediaRecorder capture mode after CDP stall.",
          );
          try {
            await withTimeout(
              stopCdpCapture(),
              5_000,
              "Stop stalled CDP capture",
            ).catch(() => undefined);
            bridge.stop();
            bridge.startSpectatorServer(SPECTATOR_PORT);
            captureWatchdog = (await startLegacyCapture(bridge)) ?? null;
            activeCaptureMode = "mediarecorder";
            lastCdpBytesReceived = bridge.getStats().bytesReceived;
            cdpRecoveryFailures = 0;
            console.log("[Main] Fallback to MediaRecorder mode complete");
          } catch (fallbackErr) {
            console.error(
              "[Main] MediaRecorder fallback failed:",
              errMsg(fallbackErr),
            );
          }
        }
      }
    } else {
      try {
        const captureStatus = await getBrowserCaptureStatus();
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
      console.log(
        "[Main] 🔄 Scheduled browser rotation to prevent WebGPU memory leaks.",
      );
      try {
        if (activeCaptureMode === "cdp") {
          await stopCdpCapture();
        } else {
          await stopInPageCaptureControl();
        }
        await setupBrowser();
        if (activeCaptureMode === "cdp") {
          await startCdpCapture(bridge);
        } else if (activeCaptureMode === "webcodecs") {
          // Watchdog will automatically inject script on new page
        }
      } catch (err) {
        console.error("[Main] Failed to rotate browser!", err);
      }
    }
  }, 30000);

  // Handle shutdown
  const shutdown = async () => {
    console.log("\n[Main] Shutting down...");
    if (captureWatchdog) clearInterval(captureWatchdog);
    clearInterval(statusSnapshotInterval);
    clearInterval(statusInterval);
    await stopCdpCapture();
    getRTMPBridge().stop();
    clearExternalStatusSnapshot();
    await cleanup();
    process.exit(0);
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
  bridge.stopProcessing();

  if (browser) {
    await browser.close();
    browser = null;
  }

  clearExternalStatusSnapshot();
  console.log("[Main] Cleanup complete");
}

// Run
main().catch((err) => {
  console.error("[Main] Fatal error:", err);
  cleanup().then(() => process.exit(1));
});
