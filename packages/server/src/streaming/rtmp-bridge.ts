/**
 * RTMP Bridge Server
 *
 * Receives video chunks from browser via WebSocket and pipes them
 * to FFmpeg for encoding and multi-destination RTMP streaming.
 *
 * Architecture:
 *   Browser (MediaRecorder) → WebSocket → This Server → FFmpeg → Multiple RTMP endpoints
 *
 * Uses FFmpeg's tee muxer to send one encoded stream to multiple destinations
 * efficiently (single encode, multiple outputs).
 */

import { spawn, exec, execSync, type ChildProcess } from "child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import type {
  RTMPDestination,
  StreamingConfig,
  StreamingStatus,
  DestinationStatus,
} from "./types.js";
import { DEFAULT_STREAMING_CONFIG } from "./types.js";
import {
  buildStreamDestinationId,
  inferStreamDeliveryTransport,
  normalizeStreamDestinationProvider,
  resolveExternalStreamDeliveryInfo,
  resolveStreamCanonicalProviderPriority,
} from "./delivery-config.js";
import {
  assertValidStreamIngestSettings,
  resolveStreamIngestSettings,
} from "./ingest-config.js";
import {
  isStreamDestinationEnabled,
  resolveEnabledStreamDestinations,
} from "./stream-destinations.js";
import { probePlaybackUrl } from "./destination-probe.js";
import { errMsg } from "../shared/errMsg.js";

const require = createRequire(import.meta.url);
let resolvedFfmpegCommand: string | null = null;

type DirectFrameDiagnosticSample = {
  at: number;
  size: number;
  cdpTimestamp: number | null;
};

type BackpressureTransition = {
  at: number;
  backpressured: boolean;
};

type FatalWriteDiagnostic = {
  at: number;
  message: string;
  frameCount: number;
  droppedFrames: number;
  bytesReceived: number;
  backpressured: boolean;
  cdpDirectMode: boolean;
  uptimeMs: number;
};

type BridgeClientSocket = WebSocket & {
  _isWebCodecs?: boolean;
  _socket?: {
    pause?: () => void;
    resume?: () => void;
  };
};

function parseEnvInt(
  rawValue: string | undefined,
  fallback: number,
  minValue: number,
): number {
  const parsed = Number.parseInt(rawValue || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minValue, parsed);
}

function toEvenDimension(value: number): number {
  const clamped = Math.max(2, value);
  return clamped % 2 === 0 ? clamped : clamped - 1;
}

const SPECTATOR_MAX_BUFFERED_BYTES = parseEnvInt(
  process.env.STREAM_SPECTATOR_MAX_BUFFERED_BYTES,
  8 * 1024 * 1024,
  128 * 1024,
);

function resolveFfmpegCommand(): string {
  if (resolvedFfmpegCommand) return resolvedFfmpegCommand;

  const configuredPath = process.env.FFMPEG_PATH?.trim();
  if (configuredPath) {
    resolvedFfmpegCommand = configuredPath;
    return resolvedFfmpegCommand;
  }

  // Prefer PATH-resolved ffmpeg over the ffmpeg-static npm package.
  // The npm package bundles an older static build (7.0.2) that segfaults
  // during long-running tee muxer sessions on Linux.
  for (const candidate of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (fs.existsSync(candidate)) {
      resolvedFfmpegCommand = candidate;
      return resolvedFfmpegCommand;
    }
  }

  // Try PATH-resolved ffmpeg (e.g. ~/.local/bin/ffmpeg) before ffmpeg-static.
  try {
    const { execFileSync } =
      require("node:child_process") as typeof import("node:child_process");
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore", timeout: 5000 });
    resolvedFfmpegCommand = "ffmpeg";
    return resolvedFfmpegCommand;
  } catch {
    // ffmpeg not on PATH; try ffmpeg-static as last resort.
  }

  try {
    const ffmpegStaticPath = require("ffmpeg-static") as string | null;
    if (ffmpegStaticPath && fs.existsSync(ffmpegStaticPath)) {
      resolvedFfmpegCommand = ffmpegStaticPath;
      return resolvedFfmpegCommand;
    }
  } catch {
    // Optional dependency; fall through.
  }

  resolvedFfmpegCommand = "ffmpeg";
  return resolvedFfmpegCommand;
}

export class RTMPBridge {
  private static readonly CAPTURE_DIAGNOSTIC_HISTORY_LIMIT = 16;
  private wss: WebSocketServer | null = null;
  private spectatorWss: WebSocketServer | null = null;
  private ffmpeg: ChildProcess | null = null;
  private client: BridgeClientSocket | null = null;
  private spectatorClients: Set<WebSocket> = new Set();
  /** Cached fMP4 init segment (moov atom) — required for late joiners */
  private fmp4InitSegment: Buffer | null = null;
  private destinations: RTMPDestination[] = [];
  private config: StreamingConfig;
  private status: StreamingStatus;
  private readonly ffmpegCommand: string;
  private bytesReceived: number = 0;
  private startTime: number = 0;

  /** FFmpeg crash recovery state */
  private ffmpegRestartAttempts: number = 0;
  private lastFFmpegCrash: number = 0;
  private ffmpegRestartTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Health monitoring interval */
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  /** Last data received timestamp for health monitoring */
  private lastDataReceived: number = 0;
  /** Whether outputs have been loaded from environment */
  private outputsInitialized = false;
  /** Whether this bridge is in CDP direct mode (no WebSocket) */
  private cdpDirectMode = false;
  /** Frame counter for CDP direct mode */
  private directFrameCount = 0;
  /** Number of frames dropped due to FFmpeg backpressure (CDP direct mode) */
  private droppedFrameCount = 0;
  /** Recent FFmpeg log lines for post-crash diagnostics */
  private ffmpegLogTail: string[] = [];
  /** Whether FFmpeg stdin is currently backpressured */
  private ffmpegBackpressured = false;
  /** Rolling encoder FPS reported by FFmpeg progress logs */
  private ffmpegEncoderFps = 0;
  /**
   * Monotonic encoder frame counter parsed from FFmpeg stderr (`frame=  NNN`).
   * Unlike `directFrameCount` (which counts JPEG frames we *wrote* to FFmpeg
   * stdin), this counts frames FFmpeg itself has actually encoded. For
   * x11grab-based capture modes there is no stdin frame write, so this is the
   * only reliable encoder-side liveness signal.
   */
  private lastEncoderFrameCount = 0;
  /** Wallclock timestamp of the most recent `frame=` advance observed in FFmpeg stderr */
  private lastEncoderFrameAt: number | null = null;
  /**
   * Most recent `speed=N.NNx` value parsed from FFmpeg stderr. Values < 1.0
   * mean the encoder is running slower than real-time — a reliable early
   * warning that RTMP upstream is backed up or the input pipeline is
   * starving the encoder. Null until FFmpeg emits its first progress line.
   */
  private ffmpegSpeedX: number | null = null;
  /** Most recent `bitrate=N.Nkbits/s` value parsed from FFmpeg stderr (kbps). */
  private ffmpegOutputBitrateKbps: number | null = null;
  /** Whether client socket reads are paused due to FFmpeg backpressure */
  private clientSocketPaused = false;
  /** Recent CDP frame arrival diagnostics */
  private recentDirectFrames: DirectFrameDiagnosticSample[] = [];
  /** Recent FFmpeg stdin backpressure transitions */
  private recentBackpressureTransitions: BackpressureTransition[] = [];
  /** First fatal FFmpeg write error observed in the current worker process */
  private firstFatalWriteError: FatalWriteDiagnostic | null = null;
  /** Most recent fatal FFmpeg write error observed in the current worker process */
  private lastFatalWriteError: FatalWriteDiagnostic | null = null;
  /** Pending recovery for an FFmpeg process that lost its delivery output */
  private fatalWriteRestartTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Guard against overlapping fatal-write restarts */
  private fatalWriteRecoveryInFlight = false;
  /** Prevent overlapping playback delivery probes */
  private deliveryRecoveryProbeInFlight = false;
  /** Consecutive canonical playback probe failures while FFmpeg is healthy */
  private deliveryRecoveryProbeFailures = 0;
  /** Last time delivery-health recovery requested an FFmpeg restart */
  private lastDeliveryRecoveryRestartAt = 0;
  /** Last seen CDP timestamp for monotonicity checks */
  private lastCdpTimestamp: number | null = null;
  /** Number of non-monotonic CDP timestamps observed */
  private nonMonotonicCdpTimestampCount = 0;

  /** Placeholder frame buffer (JPEG) for idle periods */
  private placeholderFrame: Buffer | null = null;
  /** Timer for feeding placeholder frames */
  private placeholderInterval: ReturnType<typeof setInterval> | null = null;
  /** Whether we're currently in placeholder mode (no live frames) */
  private inPlaceholderMode = false;
  /** Timeout before switching to placeholder mode (ms) */
  private static readonly PLACEHOLDER_TIMEOUT = 5000;
  /** Whether placeholder mode is enabled */
  private placeholderEnabled = false;

  /** Maximum restart attempts before giving up */
  private static readonly MAX_RESTART_ATTEMPTS = 8;

  /** Base delay for exponential backoff (ms) */
  private static readonly BASE_RESTART_DELAY = 1000;

  /** Maximum delay between restart attempts (ms) */
  private static readonly MAX_RESTART_DELAY = 60000;

  /** Health check interval (ms) - check every 5s for faster detection */
  private static readonly HEALTH_CHECK_INTERVAL = 5000;

  /** Timeout for no data before considering unhealthy (ms) - reduced to 15s */
  private static readonly DATA_TIMEOUT = 15000;
  /** Number of FFmpeg log lines to keep in memory */
  private static readonly FFMPEG_LOG_TAIL_LINES = 40;

  constructor(config: Partial<StreamingConfig> = {}) {
    const envConfig: Partial<StreamingConfig> = {
      width: toEvenDimension(
        parseEnvInt(
          process.env.STREAM_OUTPUT_WIDTH || process.env.STREAM_CAPTURE_WIDTH,
          DEFAULT_STREAMING_CONFIG.width,
          2,
        ),
      ),
      height: toEvenDimension(
        parseEnvInt(
          process.env.STREAM_OUTPUT_HEIGHT || process.env.STREAM_CAPTURE_HEIGHT,
          DEFAULT_STREAMING_CONFIG.height,
          2,
        ),
      ),
      fps: parseEnvInt(process.env.STREAM_FPS, DEFAULT_STREAMING_CONFIG.fps, 1),
      videoBitrate: parseEnvInt(
        process.env.STREAM_VIDEO_BITRATE_KBPS ||
          process.env.STREAM_VIDEO_BITRATE,
        DEFAULT_STREAMING_CONFIG.videoBitrate,
        96,
      ),
      audioBitrate: parseEnvInt(
        process.env.STREAM_AUDIO_BITRATE_KBPS ||
          process.env.STREAM_AUDIO_BITRATE,
        DEFAULT_STREAMING_CONFIG.audioBitrate,
        32,
      ),
      gopSize: parseEnvInt(
        process.env.STREAM_GOP_SIZE,
        DEFAULT_STREAMING_CONFIG.gopSize,
        15,
      ),
    };

    this.config = { ...DEFAULT_STREAMING_CONFIG, ...envConfig, ...config };
    this.config.width = toEvenDimension(this.config.width);
    this.config.height = toEvenDimension(this.config.height);
    this.status = {
      active: false,
      destinations: [],
      ffmpegRunning: false,
      clientConnected: false,
    };
    this.ffmpegCommand = resolveFfmpegCommand();
    console.log(`[RTMPBridge] Using FFmpeg command: ${this.ffmpegCommand}`);
    console.log(
      `[RTMPBridge] Stream profile: ${this.config.width}x${this.config.height}@${this.config.fps}fps, GOP=${this.config.gopSize}, ${this.config.videoBitrate}k video / ${this.config.audioBitrate}k audio`,
    );

    // Initialize placeholder mode from environment
    this.placeholderEnabled = RTMPBridge.parseEnvBool(
      process.env.STREAM_PLACEHOLDER_ENABLED,
      false,
    );
    if (this.placeholderEnabled) {
      this.initializePlaceholderFrame();
      console.log("[RTMPBridge] Placeholder mode enabled for idle periods");
    }
  }

  /**
   * Initialize the placeholder frame buffer.
   * Creates a simple dark gray JPEG image to send during idle periods.
   */
  private initializePlaceholderFrame(): void {
    // Create a minimal valid JPEG image (dark gray)
    // This is a hand-crafted minimal JPEG that's ~300 bytes
    // Using a procedural approach to avoid external dependencies
    this.placeholderFrame = this.generatePlaceholderJpeg();
    console.log(
      `[RTMPBridge] Placeholder frame initialized (${this.placeholderFrame?.length || 0} bytes)`,
    );
  }

  /**
   * Generate a minimal placeholder JPEG image.
   * Creates a solid dark gray frame to keep the stream alive.
   */
  private generatePlaceholderJpeg(): Buffer {
    // Minimal JPEG header for a 16x16 dark gray image
    // This is much smaller than generating a full-size frame
    // FFmpeg will scale it to the output size
    const minimalJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10,
      0x00, 0x10, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
      0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
      0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
      0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
      0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
      0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
      0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
      0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
      0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd5, 0xdb, 0x20, 0xa8, 0xaa, 0x1e, 0xc9,
      0x19, 0x52, 0x47, 0x0c, 0x8a, 0xb8, 0xf4, 0xeb, 0x99, 0x86, 0x00, 0x70,
      0xcd, 0x9a, 0x00, 0xff, 0xd9,
    ]);
    return minimalJpeg;
  }

  /**
   * Start the placeholder frame interval.
   * Sends placeholder frames at the configured FPS when in placeholder mode.
   */
  private startPlaceholderMode(): void {
    if (!this.placeholderEnabled || !this.placeholderFrame) return;
    if (this.placeholderInterval) return; // Already running

    this.inPlaceholderMode = true;
    const frameInterval = Math.round(1000 / this.config.fps);

    console.log(
      `[RTMPBridge] Entering placeholder mode (${this.config.fps}fps)`,
    );

    this.placeholderInterval = setInterval(() => {
      if (this.placeholderFrame && this.ffmpeg?.stdin?.writable) {
        this.writeToFfmpeg(this.placeholderFrame);
      }
    }, frameInterval);
  }

  /**
   * Stop the placeholder frame interval.
   * Called when live frames resume.
   */
  private stopPlaceholderMode(): void {
    if (this.placeholderInterval) {
      clearInterval(this.placeholderInterval);
      this.placeholderInterval = null;
    }
    if (this.inPlaceholderMode) {
      console.log(
        "[RTMPBridge] Exiting placeholder mode (live frames resumed)",
      );
      this.inPlaceholderMode = false;
    }
  }

  private static parseEnvBool(
    raw: string | undefined,
    defaultValue: boolean = true,
  ): boolean {
    if (raw == null || raw === "") return defaultValue;
    return !["0", "false", "no", "off"].includes(raw.trim().toLowerCase());
  }

  private static deliveryRecoveryGraceMs(): number {
    return parseEnvInt(
      process.env.STREAM_DELIVERY_RECOVERY_GRACE_MS,
      45_000,
      0,
    );
  }

  private static deliveryRecoveryFailureThreshold(): number {
    return parseEnvInt(process.env.STREAM_DELIVERY_RECOVERY_FAILURES, 3, 1);
  }

  private static deliveryRecoveryProbeTimeoutMs(): number {
    return parseEnvInt(
      process.env.STREAM_DELIVERY_RECOVERY_PROBE_TIMEOUT_MS,
      2_500,
      500,
    );
  }

  private static deliveryRecoveryRestartCooldownMs(): number {
    return parseEnvInt(
      process.env.STREAM_DELIVERY_RECOVERY_RESTART_COOLDOWN_MS,
      30_000,
      5_000,
    );
  }

  private static toRtmpUrl(input: string): string {
    const trimmed = input.trim();
    if (/^rtmps?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `rtmp://${trimmed}`;
  }

  private static normalizeKickRtmpUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) {
      return "rtmps://fa723fc1b171.global-contribute.live-video.net/app";
    }

    const legacyKickPattern =
      /^(?:rtmps?:\/\/)?ingest\.kick\.com\/live(?:\/([^/?#]+))?\/?$/i;
    const legacyMatch = trimmed.match(legacyKickPattern);
    if (legacyMatch) {
      const embeddedKey = legacyMatch[1]?.trim();
      const baseUrl =
        "rtmps://fa723fc1b171.global-contribute.live-video.net/app";
      return embeddedKey ? `${baseUrl}/${embeddedKey}` : baseUrl;
    }

    return RTMPBridge.toRtmpUrl(trimmed);
  }

  private static teeEscape(value: string): string {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/:/g, "\\:")
      .replace(/\|/g, "\\|");
  }

  private static appendSrtQuery(
    baseUrl: string,
    streamId: string,
    passphrase: string,
  ): string {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const query = new URLSearchParams({
      passphrase,
      streamid: streamId,
    });
    return `${baseUrl}${separator}${query.toString()}`;
  }

  private static redactSensitiveFfmpegText(value: string): string {
    return value
      .replace(/(passphrase=)[^&\s\]'"]+/gi, "$1***REDACTED***")
      .replace(/(streamid=)[^&\s\]'"]+/gi, "$1***REDACTED***")
      .replace(/(rtmps?:\/\/[^/\s[\]'"]+\/)[^\s[\]'"]+/gi, "$1***REDACTED***");
  }

  private resolveIngestSettings() {
    return assertValidStreamIngestSettings(
      process.env,
      resolveStreamIngestSettings(process.env),
    );
  }

  private buildExternalDeliveryDestination(
    ingestUrl: string,
    streamKey: string,
    role: "canonical" | "fallback",
  ): RTMPDestination | null {
    const ingestSettings = this.resolveIngestSettings();
    const deliveryInfo = resolveExternalStreamDeliveryInfo(process.env);
    const provider = normalizeStreamDestinationProvider(
      deliveryInfo.provider,
      "External Delivery",
    );
    const playbackUrl =
      deliveryInfo.playbackUrl ?? deliveryInfo.llhlsUrl ?? deliveryInfo.hlsUrl;
    const destinationId = buildStreamDestinationId({
      role,
      provider,
      name: "External Delivery",
    });
    if (ingestSettings.transport === "srt") {
      if (
        !ingestSettings.srtUrl ||
        !ingestSettings.srtStreamId ||
        !ingestSettings.srtPassphrase
      ) {
        console.warn(
          "[RTMPBridge] STREAM_INGEST_TRANSPORT=srt but SRT ingest settings are incomplete; skipping external delivery destination",
        );
        return null;
      }
      return {
        id: destinationId,
        name: "External Delivery",
        role,
        provider,
        transport: "srt",
        playbackUrl,
        ingestUrl: ingestSettings.srtUrl,
        url: RTMPBridge.appendSrtQuery(
          ingestSettings.srtUrl,
          ingestSettings.srtStreamId,
          ingestSettings.srtPassphrase,
        ),
        key: "",
        enabled: true,
      };
    }

    return {
      id: destinationId,
      name: "External Delivery",
      role,
      provider,
      transport: inferStreamDeliveryTransport({
        playbackUrl,
        ingestUrl,
      }),
      playbackUrl,
      ingestUrl,
      url: RTMPBridge.toRtmpUrl(ingestUrl),
      key: streamKey,
      enabled: true,
    };
  }

  private buildBridgeAudioInputArgs(): string[] {
    const ingestSettings = this.resolveIngestSettings();
    const audioEnabled = process.env.STREAM_AUDIO_ENABLED !== "false";
    const pulseDevice =
      process.env.PULSE_AUDIO_DEVICE || "chrome_audio.monitor";
    let usePulseAudio = audioEnabled && process.platform === "linux";

    if (usePulseAudio) {
      try {
        execSync("pactl info", { timeout: 2000, stdio: "pipe" });
        const sinks = execSync("pactl list short sinks", {
          timeout: 2000,
          stdio: "pipe",
        }).toString();
        if (!sinks.includes("chrome_audio")) {
          console.log(
            "[RTMPBridge] PulseAudio accessible but chrome_audio sink not found, falling back to silent audio",
          );
          usePulseAudio = false;
        }
      } catch {
        console.log(
          "[RTMPBridge] PulseAudio not accessible, falling back to silent audio",
        );
        usePulseAudio = false;
      }
    }

    if (usePulseAudio) {
      console.log(`[RTMPBridge] Audio capture from PulseAudio: ${pulseDevice}`);
      return [
        "-thread_queue_size",
        "1024",
        "-use_wallclock_as_timestamps",
        "1",
        "-f",
        "pulse",
        "-ac",
        "2",
        "-ar",
        String(ingestSettings.audioSampleRate),
        "-i",
        pulseDevice,
      ];
    }

    console.log(
      "[RTMPBridge] Audio: using bridge-managed silent source (anullsrc)",
    );
    return [
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=${ingestSettings.audioSampleRate}:cl=stereo`,
    ];
  }

  private toBuffer(data: RawData): Buffer | null {
    if (Buffer.isBuffer(data)) return data;
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    if (Array.isArray(data)) {
      return Buffer.concat(data.map((chunk) => Buffer.from(chunk)));
    }
    if (typeof data === "string") return Buffer.from(data);
    return null;
  }

  private setClientBackpressurePaused(
    paused: boolean,
    ws: BridgeClientSocket | null = this.client,
  ): void {
    if (!ws) return;
    const socket = ws._socket;
    if (!socket) return;

    if (paused && !this.clientSocketPaused) {
      socket.pause?.();
      this.clientSocketPaused = true;
    } else if (!paused && this.clientSocketPaused) {
      socket.resume?.();
      this.clientSocketPaused = false;
    }
  }

  private pushDiagnosticSample<T>(samples: T[], value: T): void {
    samples.push(value);
    while (samples.length > RTMPBridge.CAPTURE_DIAGNOSTIC_HISTORY_LIMIT) {
      samples.shift();
    }
  }

  private setFfmpegBackpressured(
    backpressured: boolean,
    ws: BridgeClientSocket | null = this.client,
  ): void {
    if (this.ffmpegBackpressured === backpressured) {
      if (!backpressured) {
        this.setClientBackpressurePaused(false, ws);
      }
      return;
    }

    this.ffmpegBackpressured = backpressured;
    this.pushDiagnosticSample(this.recentBackpressureTransitions, {
      at: Date.now(),
      backpressured,
    });

    if (backpressured) {
      this.setClientBackpressurePaused(true, ws);
    } else {
      this.setClientBackpressurePaused(false, ws);
    }
  }

  private recordDirectFrameSample(params: {
    frameAt: number;
    size: number;
    cdpTimestamp?: number | null;
  }): void {
    const cdpTimestamp =
      typeof params.cdpTimestamp === "number" &&
      Number.isFinite(params.cdpTimestamp)
        ? params.cdpTimestamp
        : null;

    if (
      cdpTimestamp != null &&
      this.lastCdpTimestamp != null &&
      cdpTimestamp < this.lastCdpTimestamp
    ) {
      this.nonMonotonicCdpTimestampCount += 1;
    }
    if (cdpTimestamp != null) {
      this.lastCdpTimestamp = cdpTimestamp;
    }

    this.pushDiagnosticSample(this.recentDirectFrames, {
      at: params.frameAt,
      size: params.size,
      cdpTimestamp,
    });
  }

  private recordFatalWriteError(message: string): void {
    const snapshot: FatalWriteDiagnostic = {
      at: Date.now(),
      message: RTMPBridge.redactSensitiveFfmpegText(message.trim()),
      frameCount: this.directFrameCount,
      droppedFrames: this.droppedFrameCount,
      bytesReceived: this.bytesReceived,
      backpressured: this.ffmpegBackpressured,
      cdpDirectMode: this.cdpDirectMode,
      uptimeMs: this.startTime ? Math.max(0, Date.now() - this.startTime) : 0,
    };

    if (!this.firstFatalWriteError) {
      this.firstFatalWriteError = snapshot;
    }
    this.lastFatalWriteError = snapshot;
  }

  private scheduleFatalWriteRestart(
    message: string,
    targetProcess: ChildProcess | null = this.ffmpeg,
    label = "Fatal FFmpeg output write",
  ): void {
    if (!targetProcess || this.ffmpeg !== targetProcess) return;
    if (this.fatalWriteRecoveryInFlight || this.fatalWriteRestartTimeout) {
      return;
    }

    const sanitizedMessage = RTMPBridge.redactSensitiveFfmpegText(
      message.trim(),
    );
    if (this.ffmpegRestartAttempts >= RTMPBridge.MAX_RESTART_ATTEMPTS) {
      console.error(
        `[RTMPBridge] ${label} persisted after ${this.ffmpegRestartAttempts} restart attempts. Manual intervention required: ${sanitizedMessage}`,
      );
      return;
    }

    const nextAttempt = this.ffmpegRestartAttempts + 1;
    const baseDelay =
      RTMPBridge.BASE_RESTART_DELAY * Math.pow(2, nextAttempt - 1);
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, RTMPBridge.MAX_RESTART_DELAY);

    console.warn(
      `[RTMPBridge] ${label} detected; restarting encoder in ${Math.round(delay)}ms: ${sanitizedMessage}`,
    );

    this.fatalWriteRestartTimeout = setTimeout(() => {
      this.fatalWriteRestartTimeout = null;
      void this.restartAfterFatalWrite(targetProcess);
    }, delay);
  }

  private async restartAfterFatalWrite(
    targetProcess: ChildProcess,
  ): Promise<void> {
    if (this.fatalWriteRecoveryInFlight) return;
    if (this.ffmpeg !== targetProcess) return;

    const wasCdpDirectMode = this.cdpDirectMode;
    const wasWebCodecsMode = Boolean(this.client?._isWebCodecs);
    const hadClient = Boolean(this.client);

    this.fatalWriteRecoveryInFlight = true;
    try {
      this.ffmpegRestartAttempts++;
      await this.stopFFmpeg();

      if (wasCdpDirectMode) {
        this.startFFmpegDirect();
      } else if (hadClient && wasWebCodecsMode) {
        this.startFFmpegWebCodecs();
      } else if (hadClient) {
        this.startFFmpeg();
      } else {
        console.log(
          "[RTMPBridge] No active capture client after fatal write; skipping FFmpeg restart",
        );
        this.ffmpegRestartAttempts = 0;
        return;
      }

      setTimeout(() => {
        if (this.ffmpeg && this.status.ffmpegRunning) {
          console.log(
            "[RTMPBridge] FFmpeg fatal-write recovery appears successful",
          );
          this.ffmpegRestartAttempts = Math.max(
            0,
            this.ffmpegRestartAttempts - 1,
          );
        }
      }, 5000).unref?.();
    } catch (error) {
      console.error(
        "[RTMPBridge] Failed to recover FFmpeg after fatal output write:",
        errMsg(error),
      );
      this.handleFFmpegCrash(-1);
    } finally {
      this.fatalWriteRecoveryInFlight = false;
    }
  }

  private resolveCanonicalDeliveryDestination(): DestinationStatus | null {
    const destinations = this.status.destinations.filter((destination) => {
      if (!destination.playbackUrl) return false;
      const provider = normalizeStreamDestinationProvider(
        destination.provider ?? null,
        destination.name,
      );
      return provider === "cloudflare_stream";
    });
    return (
      destinations.find((destination) => destination.role === "canonical") ??
      destinations[0] ??
      null
    );
  }

  private shouldRunDeliveryRecoveryProbe(
    now: number,
    stats: ReturnType<RTMPBridge["getStats"]>,
    destination: DestinationStatus | null,
  ): destination is DestinationStatus & { playbackUrl: string } {
    if (!destination?.playbackUrl) return false;
    if (
      !RTMPBridge.parseEnvBool(
        process.env.STREAM_DELIVERY_RECOVERY_ENABLED,
        true,
      )
    ) {
      return false;
    }
    if (!this.ffmpeg || !this.status.ffmpegRunning || !stats.healthy) {
      this.deliveryRecoveryProbeFailures = 0;
      return false;
    }
    if (this.deliveryRecoveryProbeInFlight) return false;
    if (this.fatalWriteRecoveryInFlight || this.fatalWriteRestartTimeout) {
      return false;
    }
    if (
      this.startTime > 0 &&
      now - this.startTime < RTMPBridge.deliveryRecoveryGraceMs()
    ) {
      return false;
    }
    if (
      this.lastDeliveryRecoveryRestartAt > 0 &&
      now - this.lastDeliveryRecoveryRestartAt <
        RTMPBridge.deliveryRecoveryRestartCooldownMs()
    ) {
      return false;
    }
    return true;
  }

  private checkCanonicalDeliveryRecovery(
    now: number,
    stats: ReturnType<RTMPBridge["getStats"]>,
  ): void {
    const destination = this.resolveCanonicalDeliveryDestination();
    if (!this.shouldRunDeliveryRecoveryProbe(now, stats, destination)) {
      return;
    }

    const targetProcess = this.ffmpeg;
    const playbackUrl = destination.playbackUrl;
    this.deliveryRecoveryProbeInFlight = true;

    void probePlaybackUrl(
      playbackUrl,
      RTMPBridge.deliveryRecoveryProbeTimeoutMs(),
    )
      .then((result) => {
        if (!targetProcess || this.ffmpeg !== targetProcess) return;

        if (result.ready) {
          this.deliveryRecoveryProbeFailures = 0;
          destination.connected = true;
          if (
            destination.error === "delivery_disconnected" ||
            destination.error?.startsWith("playback_probe_")
          ) {
            delete destination.error;
          }
          return;
        }

        this.deliveryRecoveryProbeFailures += 1;
        destination.connected = false;
        const failureLabel =
          result.lastError ??
          `playback_probe_${result.manifestStatus}_${result.statusCode ?? "no_status"}`;
        destination.error = failureLabel;

        console.warn(
          `[RTMPBridge] Canonical Cloudflare playback probe failed (${this.deliveryRecoveryProbeFailures}/${RTMPBridge.deliveryRecoveryFailureThreshold()}): ${failureLabel}`,
        );

        if (
          this.deliveryRecoveryProbeFailures <
          RTMPBridge.deliveryRecoveryFailureThreshold()
        ) {
          return;
        }

        this.deliveryRecoveryProbeFailures = 0;
        this.lastDeliveryRecoveryRestartAt = Date.now();
        this.scheduleFatalWriteRestart(
          `canonical delivery unavailable after healthy FFmpeg output: ${failureLabel}`,
          targetProcess,
          "Canonical delivery probe failure",
        );
      })
      .catch((error) => {
        if (!targetProcess || this.ffmpeg !== targetProcess) return;
        this.deliveryRecoveryProbeFailures += 1;
        destination.connected = false;
        destination.error = errMsg(error);
      })
      .finally(() => {
        this.deliveryRecoveryProbeInFlight = false;
      });
  }

  /**
   * Write encoded media into FFmpeg stdin with backpressure handling.
   * In CDP direct mode we drop frames when backpressured to preserve low latency.
   */
  private writeToFfmpeg(data: Buffer, sourceWs?: BridgeClientSocket): boolean {
    if (!this.ffmpeg?.stdin?.writable) return false;

    // CDP direct mode has no transport-level pause control, so drop when backed up.
    if (this.ffmpegBackpressured && !sourceWs) {
      this.droppedFrameCount++;
      return false;
    }

    if (this.ffmpegBackpressured && sourceWs) {
      this.setClientBackpressurePaused(true, sourceWs);
    }

    try {
      const writable = this.ffmpeg.stdin.write(data);
      if (!writable) {
        this.setFfmpegBackpressured(true, sourceWs);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start FFmpeg in H.264 stream-copy mode for the exposed-function capture
   * bridge. Unlike startWebCodecs(), this doesn't create a WebSocket server —
   * data arrives via writeToFfmpegRaw() called from page.exposeFunction().
   */
  startWebCodecsDirect(): void {
    this.initOutputs();
    this.cdpDirectMode = false;
    this.status.clientConnected = true; // No WebSocket client, but data will flow
    this.bytesReceived = 0;
    this.droppedFrameCount = 0;
    this.startFFmpegWebCodecs();
    console.log(
      "[RTMPBridge] Started FFmpeg in WebCodecs direct mode (no WebSocket, data via exposeFunction)",
    );
  }

  /**
   * Public entry point for writing raw H.264 NAL units from the exposed-function
   * capture bridge. Tracks bytes received and last-data timestamps the same way
   * the WebSocket handler does, but without a WebSocket dependency.
   */
  writeToFfmpegRaw(data: Buffer): boolean {
    if (!this.ffmpeg?.stdin?.writable) return false;
    this.bytesReceived += data.length;
    this.lastDataReceived = Date.now();
    return this.writeToFfmpeg(data);
  }

  /**
   * Close the WebSocket server without stopping FFmpeg.
   * Used by the exposed-function capture mode which starts FFmpeg via
   * startWebCodecs() (to get the H.264 stream-copy pipeline) but doesn't
   * need the WebSocket listener.
   */
  closeWebSocketServer(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
      console.log(
        "[RTMPBridge] WebSocket server closed (not needed for exposed-function capture)",
      );
    }
  }

  /**
   * Load RTMP destinations from environment variables
   * Adds to any manually configured destinations
   */
  loadDestinationsFromEnv(): void {
    // Keep any manually added destinations, just add from env
    const existingNames = new Set(this.destinations.map((d) => d.name));
    const ingestSettings = this.resolveIngestSettings();
    const enabledDestinations = resolveEnabledStreamDestinations(
      process.env.STREAM_ENABLED_DESTINATIONS ||
        process.env.DUEL_STREAM_DESTINATIONS,
    );
    const twitchStreamKey = (
      process.env.TWITCH_STREAM_KEY ||
      process.env.TWITCH_RTMP_STREAM_KEY ||
      ""
    ).trim();
    const youtubeStreamKey = (
      process.env.YOUTUBE_STREAM_KEY ||
      process.env.YOUTUBE_RTMP_STREAM_KEY ||
      ""
    ).trim();
    const externalDeliveryInfo = resolveExternalStreamDeliveryInfo(process.env);
    const providerPriority = resolveStreamCanonicalProviderPriority(
      process.env,
    );
    const hasExternalDeliveryIngest =
      ingestSettings.transport === "srt"
        ? Boolean(
            ingestSettings.srtUrl &&
            ingestSettings.srtStreamId &&
            ingestSettings.srtPassphrase,
          )
        : Boolean(externalDeliveryInfo.ingestUrl);
    const addDestination = (destination: RTMPDestination) => {
      if (!destination.url || existingNames.has(destination.name)) return;
      this.destinations.push(destination);
      existingNames.add(destination.name);
    };

    // Optional external multiplexer (Restream/livepeer/etc.)
    if (
      isStreamDestinationEnabled(enabledDestinations, "multiplexer") &&
      process.env.RTMP_MULTIPLEXER_URL &&
      !existingNames.has(
        process.env.RTMP_MULTIPLEXER_NAME || "RTMP Multiplexer",
      )
    ) {
      const name = process.env.RTMP_MULTIPLEXER_NAME || "RTMP Multiplexer";
      addDestination({
        id: buildStreamDestinationId({
          role: "mirror",
          provider: "custom",
          name,
        }),
        name,
        role: "mirror",
        provider: "custom",
        transport: inferStreamDeliveryTransport({
          ingestUrl: RTMPBridge.toRtmpUrl(process.env.RTMP_MULTIPLEXER_URL),
        }),
        playbackUrl: null,
        ingestUrl: RTMPBridge.toRtmpUrl(process.env.RTMP_MULTIPLEXER_URL),
        url: RTMPBridge.toRtmpUrl(process.env.RTMP_MULTIPLEXER_URL),
        key: process.env.RTMP_MULTIPLEXER_STREAM_KEY || "",
        enabled: true,
      });
    }

    // Twitch
    if (
      isStreamDestinationEnabled(enabledDestinations, "twitch") &&
      twitchStreamKey &&
      !existingNames.has("Twitch")
    ) {
      const server =
        process.env.TWITCH_STREAM_URL ||
        process.env.TWITCH_RTMP_URL ||
        process.env.TWITCH_RTMP_SERVER ||
        "live.twitch.tv/app";
      addDestination({
        id: "mirror-twitch",
        name: "Twitch",
        role: "mirror",
        provider: "twitch",
        transport: inferStreamDeliveryTransport({
          ingestUrl: RTMPBridge.toRtmpUrl(server),
        }),
        playbackUrl: null,
        ingestUrl: RTMPBridge.toRtmpUrl(server),
        url: RTMPBridge.toRtmpUrl(server),
        key: twitchStreamKey,
        enabled: true,
      });
    }

    // YouTube
    if (
      isStreamDestinationEnabled(enabledDestinations, "youtube") &&
      youtubeStreamKey &&
      !existingNames.has("YouTube")
    ) {
      const server =
        process.env.YOUTUBE_STREAM_URL ||
        process.env.YOUTUBE_RTMP_URL ||
        "rtmp://a.rtmp.youtube.com/live2";
      addDestination({
        id: "mirror-youtube",
        name: "YouTube",
        role: "mirror",
        provider: "youtube",
        transport: inferStreamDeliveryTransport({
          ingestUrl: RTMPBridge.toRtmpUrl(server),
        }),
        playbackUrl: null,
        ingestUrl: RTMPBridge.toRtmpUrl(server),
        url: RTMPBridge.toRtmpUrl(server),
        key: youtubeStreamKey,
        enabled: true,
      });
    }

    if (
      isStreamDestinationEnabled(enabledDestinations, "external") &&
      hasExternalDeliveryIngest &&
      !existingNames.has("External Delivery")
    ) {
      const role =
        providerPriority[0] === "cloudflare_stream" ? "canonical" : "fallback";
      const destination = this.buildExternalDeliveryDestination(
        externalDeliveryInfo.ingestUrl ?? "",
        process.env.STREAM_INGEST_STREAM_KEY?.trim() || "",
        role,
      );
      if (destination) {
        addDestination(destination);
      }
    }

    // Kick (uses RTMPS with regional ingest)
    const kickServer = RTMPBridge.normalizeKickRtmpUrl(
      process.env.KICK_RTMP_URL ||
        "rtmps://fa723fc1b171.global-contribute.live-video.net/app",
    );
    const kickStreamKey = process.env.KICK_STREAM_KEY?.trim() || "";
    const kickUrlHasEmbeddedKey = /\/(?:live|app)\/[^/]+/.test(kickServer);
    if (
      isStreamDestinationEnabled(enabledDestinations, "kick") &&
      (kickStreamKey || kickUrlHasEmbeddedKey) &&
      !existingNames.has("Kick")
    ) {
      addDestination({
        id: "mirror-kick",
        name: "Kick",
        role: "mirror",
        provider: "kick",
        transport: inferStreamDeliveryTransport({ ingestUrl: kickServer }),
        playbackUrl: null,
        ingestUrl: kickServer,
        url: kickServer,
        key: kickStreamKey,
        enabled: true,
      });
    }

    // Pump.fun (full URL provided)
    if (
      isStreamDestinationEnabled(enabledDestinations, "pumpfun") &&
      process.env.PUMPFUN_RTMP_URL &&
      !existingNames.has("Pump.fun")
    ) {
      addDestination({
        id: "mirror-pump-fun",
        name: "Pump.fun",
        role: "mirror",
        provider: "custom",
        transport: inferStreamDeliveryTransport({
          ingestUrl: process.env.PUMPFUN_RTMP_URL,
        }),
        playbackUrl: null,
        ingestUrl: process.env.PUMPFUN_RTMP_URL,
        url: process.env.PUMPFUN_RTMP_URL,
        key: process.env.PUMPFUN_STREAM_KEY || "",
        enabled: true,
      });
    }

    // X/Twitter (full URL provided via Media Studio)
    if (
      isStreamDestinationEnabled(enabledDestinations, "x") &&
      process.env.X_RTMP_URL &&
      !existingNames.has("X/Twitter")
    ) {
      addDestination({
        id: "mirror-x-twitter",
        name: "X/Twitter",
        role: "mirror",
        provider: "custom",
        transport: inferStreamDeliveryTransport({
          ingestUrl: process.env.X_RTMP_URL,
        }),
        playbackUrl: null,
        ingestUrl: process.env.X_RTMP_URL,
        url: process.env.X_RTMP_URL,
        key: process.env.X_STREAM_KEY || "",
        enabled: true,
      });
    }

    // Generic custom destination
    if (
      isStreamDestinationEnabled(enabledDestinations, "custom") &&
      process.env.CUSTOM_RTMP_URL &&
      !existingNames.has(process.env.CUSTOM_RTMP_NAME || "Custom")
    ) {
      const name = process.env.CUSTOM_RTMP_NAME || "Custom";
      addDestination({
        id: buildStreamDestinationId({
          role: "mirror",
          provider: "custom",
          name,
        }),
        name,
        role: "mirror",
        provider: "custom",
        transport: inferStreamDeliveryTransport({
          ingestUrl: process.env.CUSTOM_RTMP_URL,
        }),
        playbackUrl: null,
        ingestUrl: process.env.CUSTOM_RTMP_URL,
        url: process.env.CUSTOM_RTMP_URL,
        key: process.env.CUSTOM_STREAM_KEY || "",
        enabled: true,
      });
    }

    // Arbitrary fanout list (JSON array of { name, url, key?, enabled? })
    const destinationsJson = process.env.RTMP_DESTINATIONS_JSON;
    if (destinationsJson) {
      try {
        const parsed = JSON.parse(destinationsJson) as Array<{
          name?: string;
          url?: string;
          key?: string;
          enabled?: boolean | string;
        }>;
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (!item?.name || !item?.url) continue;
            addDestination({
              id: buildStreamDestinationId({
                role: "mirror",
                provider: "custom",
                name: item.name,
              }),
              name: item.name,
              role: "mirror",
              provider: "custom",
              transport: inferStreamDeliveryTransport({
                ingestUrl: item.url,
              }),
              playbackUrl: null,
              ingestUrl: item.url,
              url: RTMPBridge.toRtmpUrl(item.url),
              key: item.key || "",
              enabled: RTMPBridge.parseEnvBool(
                typeof item.enabled === "string"
                  ? item.enabled
                  : item.enabled == null
                    ? undefined
                    : String(item.enabled),
                true,
              ),
            });
          }
        }
      } catch (err) {
        console.warn(
          "[RTMPBridge] Failed to parse RTMP_DESTINATIONS_JSON:",
          err,
        );
      }
    }

    console.log(
      `[RTMPBridge] Loaded ${this.destinations.length} destinations:`,
      this.destinations.map((d) => d.name).join(", "),
    );
  }

  private enabledOutputCount(): number {
    return this.destinations.filter((d) => d.enabled).length;
  }

  private logFFmpegSpawnError(err: unknown): void {
    const error = err as NodeJS.ErrnoException;
    const code = error?.code || "unknown";
    if (code === "ENOENT") {
      console.error(
        `[RTMPBridge] FFmpeg command not found: ${this.ffmpegCommand}. ` +
          "Install ffmpeg, set FFMPEG_PATH, or install optional dependency ffmpeg-static.",
      );
      return;
    }
    if (code === "EACCES") {
      console.error(
        `[RTMPBridge] FFmpeg is not executable: ${this.ffmpegCommand}. ` +
          "Fix file permissions or set FFMPEG_PATH to a valid ffmpeg binary.",
      );
      return;
    }
    console.error("[RTMPBridge] FFmpeg spawn error:", err);
  }

  /**
   * Add a destination manually
   */
  addDestination(dest: RTMPDestination): void {
    this.destinations.push(dest);
  }

  /**
   * Initialize output destinations from environment
   * Called automatically by start() and startFFmpegDirect(), or manually.
   */
  initOutputs(): void {
    if (this.outputsInitialized) return;
    this.loadDestinationsFromEnv();
    this.outputsInitialized = true;

    if (this.enabledOutputCount() === 0) {
      console.warn(
        "[RTMPBridge] No RTMP outputs configured. Set environment variables.",
      );
    }
  }

  /**
   * Re-initialize output destinations by re-reading environment variables.
   * Use after credential rotation (e.g. Cloudflare Stream live input
   * recreation) so a Tier-1 FFmpeg-only restart picks up new ingest URLs
   * without killing the browser or restarting the process.
   */
  reinitOutputs(): void {
    this.destinations = [];
    this.outputsInitialized = false;
    this.initOutputs();
    console.log(
      `[RTMPBridge] Destinations re-initialized (${this.enabledOutputCount()} outputs)`,
    );
  }

  /**
   * Tier-1 warm restart: stop the current FFmpeg process and launch a new
   * one with fresh destinations. Everything else (browser, page, CDP
   * session, IndexedDB cache, WebGPU context) survives. Recovery time: ~2s.
   *
   * Optionally pass `rereadEnv: true` to call `reinitOutputs()` first,
   * picking up rotated Cloudflare credentials from the process environment.
   */
  async restartFFmpegDirect(options?: { rereadEnv?: boolean }): Promise<void> {
    console.log(
      `[RTMPBridge] Tier-1 restart: stopping FFmpeg (rereadEnv=${options?.rereadEnv ?? false})`,
    );
    await this.stopFFmpeg();
    if (options?.rereadEnv) {
      this.reinitOutputs();
    }
    this.startFFmpegDirect();
  }

  /**
   * Start the WebSocket server (legacy MediaRecorder mode)
   */
  start(port: number = 8765): void {
    if (this.wss) {
      console.warn("[RTMPBridge] Server already running");
      return;
    }

    this.initOutputs();
    this.cdpDirectMode = false;

    // Graceful port handling to avoid EADDRINUSE
    const tryListen = (retries: number = 1) => {
      this.wss = new WebSocketServer({ port });

      this.wss.on("listening", () => {
        console.log(`[RTMPBridge] WebSocket server started on port ${port}`);
      });

      this.wss.on("connection", this.handleConnection.bind(this));

      this.wss.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && retries > 0) {
          console.warn(
            `[RTMPBridge] Port ${port} in use, killing stale process...`,
          );
          try {
            // Fire-and-forget port cleanup — does NOT block the event loop
            exec(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, {
              timeout: 3000,
            });
          } catch {
            // Ignore — process may already be dead
          }
          this.wss?.close();
          this.wss = null;
          setTimeout(() => tryListen(retries - 1), 1500);
        } else {
          console.error("[RTMPBridge] WebSocket server error:", err);
        }
      });
    };

    tryListen();
  }

  /**
   * Start the WebSocket server for WebCodecs mode
   * Expects raw H.264 NAL units (Annex B) and pipes them using -c:v copy
   */
  startWebCodecs(port: number = 8765): void {
    if (this.wss) {
      console.warn("[RTMPBridge] Server already running");
      return;
    }

    this.initOutputs();
    this.cdpDirectMode = false;

    const tryListen = (retries: number = 1) => {
      this.wss = new WebSocketServer({ port });

      this.wss.on("listening", () => {
        console.log(
          `[RTMPBridge] WebSocket server started (WebCodecs mode) on port ${port}`,
        );
      });

      this.wss.on("connection", this.handleWebCodecsConnection.bind(this));

      this.wss.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && retries > 0) {
          console.warn(
            `[RTMPBridge] Port ${port} in use, killing stale process...`,
          );
          try {
            exec(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, {
              timeout: 3000,
            });
          } catch {}
          this.wss?.close();
          this.wss = null;
          setTimeout(() => tryListen(retries - 1), 1500);
        } else {
          console.error("[RTMPBridge] WebSocket server error:", err);
        }
      });
    };

    tryListen();
  }

  /**
   * Build video encoder args based on FFMPEG_HWACCEL env var.
   * Shared by startFFmpeg, startFFmpegDirect, and startFFmpegWebCodecs.
   */
  private buildVideoEncoderArgs(): string[] {
    const ingestSettings = this.resolveIngestSettings();
    const hwAccel = process.env.FFMPEG_HWACCEL || "auto";
    let encoder = "libx264";

    if (
      hwAccel === "mac" ||
      (hwAccel === "auto" && process.platform === "darwin")
    ) {
      encoder = "h264_videotoolbox";
    } else if (hwAccel === "nvidia") {
      encoder = "h264_nvenc";
    }

    const targetBitrate =
      ingestSettings.profile === "cloudflare_live"
        ? Math.max(this.config.videoBitrate, 6_000)
        : this.config.videoBitrate;
    const maxrate =
      ingestSettings.profile === "cloudflare_live"
        ? targetBitrate
        : Math.floor(targetBitrate * 1.1); // 10% overhead for VBR spikes
    const minrate =
      ingestSettings.profile === "cloudflare_live" ? targetBitrate : 0;
    const bufsize = targetBitrate * 2; // 2 seconds of buffering to absorb network jitter

    if (encoder === "h264_videotoolbox") {
      return [
        "-c:v",
        "h264_videotoolbox",
        "-realtime",
        "1",
        "-b:v",
        `${targetBitrate}k`,
        ...(ingestSettings.profile === "cloudflare_live"
          ? ["-profile:v", "high", "-level", "4.1", "-minrate", `${minrate}k`]
          : []),
        "-maxrate",
        `${maxrate}k`,
        "-bufsize",
        `${bufsize}k`,
        "-pix_fmt",
        "yuv420p",
        "-g",
        String(ingestSettings.gopFrames),
      ];
    } else if (encoder === "h264_nvenc") {
      if (ingestSettings.profile === "cloudflare_live") {
        return [
          "-c:v",
          "h264_nvenc",
          "-preset",
          "llhq",
          "-tune",
          "ll",
          "-rc",
          "cbr",
          "-multipass",
          "disabled",
          "-b:v",
          `${targetBitrate}k`,
          "-minrate",
          `${targetBitrate}k`,
          "-maxrate",
          `${targetBitrate}k`,
          "-bufsize",
          `${bufsize}k`,
          "-pix_fmt",
          "yuv420p",
          "-g",
          String(ingestSettings.gopFrames),
          "-bf",
          "0",
          "-forced-idr",
          "1",
          "-zerolatency",
          "1",
          "-strict_gop",
          "1",
          "-rc-lookahead",
          "0",
          "-profile:v",
          "high",
          "-level",
          "4.1",
        ];
      }
      return [
        "-c:v",
        "h264_nvenc",
        "-preset",
        "p3",
        "-tune",
        "ll",
        "-b:v",
        `${targetBitrate}k`,
        "-maxrate",
        `${maxrate}k`,
        "-bufsize",
        `${bufsize}k`,
        "-pix_fmt",
        "yuv420p",
        "-g",
        String(ingestSettings.gopFrames),
      ];
    }

    // Default to zerolatency for live streaming — eliminates B-frame buffering
    // delay and encoder lookahead that cause visible judder. Use film only when
    // STREAM_LOW_LATENCY=false is explicitly set (e.g. for VOD recording).
    const useHighLatency = /^(0|false|no)$/i.test(
      process.env.STREAM_LOW_LATENCY || "",
    );
    const tune = useHighLatency ? "film" : "zerolatency";

    if (ingestSettings.profile === "cloudflare_live") {
      return [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-tune",
        "zerolatency",
        "-b:v",
        `${targetBitrate}k`,
        "-minrate",
        `${targetBitrate}k`,
        "-maxrate",
        `${targetBitrate}k`,
        "-bufsize",
        `${bufsize}k`,
        "-pix_fmt",
        "yuv420p",
        "-g",
        String(ingestSettings.gopFrames),
        "-keyint_min",
        String(ingestSettings.gopFrames),
        "-sc_threshold",
        "0",
        "-bf",
        "0",
        "-forced-idr",
        "1",
        "-profile:v",
        "high",
        "-level",
        "4.1",
        "-x264-params",
        "nal-hrd=cbr:force-cfr=1:open-gop=0",
      ];
    }

    return [
      "-c:v",
      "libx264",
      "-preset",
      this.config.preset,
      "-tune",
      tune,
      "-b:v",
      `${targetBitrate}k`,
      "-maxrate",
      `${maxrate}k`,
      "-bufsize",
      `${bufsize}k`,
      "-pix_fmt",
      "yuv420p",
      "-g",
      String(ingestSettings.gopFrames),
      // B-frames add latency — only use for VOD/recording mode
      ...(useHighLatency ? ["-bf", "2"] : []),
    ];
  }

  /**
   * Build common audio codec + global_header args.
   */
  private buildAudioArgs(): string[] {
    const ingestSettings = this.resolveIngestSettings();
    const args = [
      // Audio filter: async resample to recover from timing drift
      // async=1000 means resample if audio drifts more than 1000 samples (22ms at 44.1kHz)
      // This prevents audio dropouts when video/audio streams desync
      "-af",
      "aresample=async=1000:first_pts=0",
      "-c:a",
      "aac",
      "-b:a",
      `${this.config.audioBitrate}k`,
      "-ar",
      String(ingestSettings.audioSampleRate),
    ];
    if (ingestSettings.transport !== "srt") {
      args.push("-flags", "+global_header");
    }
    return args;
  }

  private buildOutputVideoFilter(resetPts: boolean = false): string {
    const outputWidth = Math.max(
      2,
      this.config.width - (this.config.width % 2),
    );
    const outputHeight = Math.max(
      2,
      this.config.height - (this.config.height % 2),
    );
    const filters = resetPts ? ["setpts=PTS-STARTPTS"] : [];
    filters.push(
      `scale=${outputWidth}:${outputHeight}:flags=lanczos`,
      "format=yuv420p",
    );
    return filters.join(",");
  }

  /**
   * Common FFmpeg post-spawn setup: status init, event handlers, health monitoring.
   * @param label - Log label for this FFmpeg mode (e.g. "CDP direct", "WebCodecs")
   * @param shouldRestartOnCrash - Called on non-zero exit to decide whether to restart
   */
  private setupFFmpegHandlers(
    label: string,
    shouldRestartOnCrash: () => boolean,
  ): void {
    if (!this.ffmpeg) return;

    this.setFfmpegBackpressured(false);
    this.ffmpegLogTail = [];

    this.startTime = Date.now();
    this.status.active = true;
    this.status.ffmpegRunning = true;
    this.status.startedAt = this.startTime;

    this.status.destinations = this.destinations
      .filter((d) => d.enabled)
      .map((d) => ({
        id: d.id,
        name: d.name,
        role: d.role,
        provider: d.provider,
        transport: d.transport,
        playbackUrl: d.playbackUrl ?? null,
        ingestUrl: d.ingestUrl ?? d.url,
        connected: false,
        bytesWritten: 0,
        startedAt: this.startTime,
      }));

    this.ffmpeg.stdout?.on("data", (data) => {
      console.log("[FFmpeg stdout]", data.toString());
    });

    this.ffmpeg.stderr?.on("data", (data) => {
      const msg = data.toString();
      const sanitizedMsg = RTMPBridge.redactSensitiveFfmpegText(msg);
      const lines = sanitizedMsg
        .split(/\r?\n/)
        .map((line: string) => line.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        this.ffmpegLogTail.push(...lines);
        if (this.ffmpegLogTail.length > RTMPBridge.FFMPEG_LOG_TAIL_LINES) {
          this.ffmpegLogTail = this.ffmpegLogTail.slice(
            -RTMPBridge.FFMPEG_LOG_TAIL_LINES,
          );
        }
      }
      if (!sanitizedMsg.includes("frame=") && !sanitizedMsg.includes("fps=")) {
        console.log("[FFmpeg]", sanitizedMsg.trim());
      }
      this.parseFFmpegOutput(sanitizedMsg);
    });

    this.ffmpeg.on("close", (code, signal) => {
      console.log(
        `[RTMPBridge] FFmpeg${label ? ` (${label})` : ""} exited with code=${code ?? "null"} signal=${signal ?? "null"}`,
      );
      this.ffmpeg = null;
      this.status.ffmpegRunning = false;
      this.status.active = false;
      this.markAllDestinationsDisconnected(
        code !== 0 || signal != null
          ? `ffmpeg_exit:${code ?? "null"}:${signal ?? "null"}`
          : undefined,
      );

      if ((code !== 0 || signal != null) && this.ffmpegLogTail.length > 0) {
        console.warn(
          `[RTMPBridge] FFmpeg tail before exit: ${this.ffmpegLogTail.join(" | ")}`,
        );
      }

      if ((code !== 0 || signal != null) && shouldRestartOnCrash()) {
        this.handleFFmpegCrash(code);
      }
    });

    this.ffmpeg.on("error", (err) => {
      this.logFFmpegSpawnError(err);
      this.ffmpeg = null;
      this.status.ffmpegRunning = false;
      this.markAllDestinationsDisconnected(errMsg(err));

      if (shouldRestartOnCrash()) {
        this.handleFFmpegCrash(-1);
      }
    });

    this.startHealthMonitoring();

    this.ffmpeg.stdin?.on("drain", () => {
      this.setFfmpegBackpressured(false);
    });

    this.ffmpeg.stdin?.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code !== "EPIPE") {
        console.error("[RTMPBridge] FFmpeg stdin error:", err);
      }
    });
  }

  /**
   * Start FFmpeg in CDP direct mode (JPEG frame piping, no WebSocket required)
   *
   * Use `feedFrame(buffer)` to send individual JPEG frames.
   * This is much faster than the legacy MediaRecorder→WebSocket path
   * because there's only one encode step (JPEG→H.264) instead of two
   * (VP8/VP9→H.264).
   */
  startFFmpegDirect(): void {
    if (this.ffmpeg) {
      console.warn("[RTMPBridge] FFmpeg already running");
      return;
    }

    this.initOutputs();
    this.cdpDirectMode = true;
    this.directFrameCount = 0;
    this.droppedFrameCount = 0;

    const outputString = this.buildOutputString();
    const isNullOutput = outputString === "-f null -";

    // Default to low-latency for live streaming. Only use high-latency buffered
    // mode when STREAM_LOW_LATENCY=false is explicitly set.
    const useHighLatency = /^(0|false|no)$/i.test(
      process.env.STREAM_LOW_LATENCY || "",
    );

    // FFmpeg args for JPEG frame piping (mjpeg → H.264)
    const args: string[] = useHighLatency
      ? [
          // Buffered input flags for VOD/recording
          "-fflags",
          "+genpts+discardcorrupt",
          "-thread_queue_size",
          "512",
        ]
      : [
          // Low-latency input flags for live streaming
          "-fflags",
          "nobuffer",
          "-flags",
          "low_delay",
        ];

    // Input: JPEG frames piped via stdin
    args.push(
      "-f",
      "mjpeg",
      "-framerate",
      String(this.config.fps),
      "-i",
      "pipe:0",
    );
    args.push(...this.buildBridgeAudioInputArgs());

    // Map video from pipe and audio from PulseAudio/anullsrc
    args.push("-map", "0:v:0", "-map", "1:a:0");

    // Force output frame rate
    args.push("-r", String(this.config.fps));

    args.push("-vf", this.buildOutputVideoFilter(true));

    // Video encoder
    args.push(...this.buildVideoEncoderArgs());

    args.push(...this.buildAudioArgs());

    if (isNullOutput) {
      args.push("-f", "null", "-");
    } else {
      const directOutputArgs = this.buildDirectOutputArgs();
      if (directOutputArgs) {
        args.push(...directOutputArgs);
      } else {
        args.push("-f", "tee", outputString);
      }
    }

    const redactedCdpArgs = args.map((arg) =>
      RTMPBridge.redactSensitiveFfmpegText(arg),
    );
    console.log(
      "[RTMPBridge] Starting FFmpeg (CDP direct mode) with args:",
      redactedCdpArgs.join(" "),
    );

    this.ffmpeg = spawn(this.ffmpegCommand, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.setFfmpegBackpressured(false);

    this.startTime = Date.now();
    this.status.active = true;
    this.status.ffmpegRunning = true;
    this.status.clientConnected = true; // CDP mode is always "connected"

    this.setupFFmpegHandlers("CDP direct", () => this.cdpDirectMode);
  }

  /**
   * Start FFmpeg with x11grab input (native X11 display capture) and NVENC
   * encode, bypassing the in-browser encode path and the JPEG stdin-pipe
   * entirely. Chromium keeps rendering the scene to the Xvfb display; FFmpeg
   * reads that display directly, encodes with h264_nvenc, and fans out to
   * configured destinations via the existing tee/direct output paths.
   *
   * The caller is responsible for ensuring:
   *   - An Xvfb (or Xorg) display is running at `options.display`.
   *   - Chromium is pinned full-screen at (0,0) to WxH so the captured region
   *     is the canvas and not the whole virtual screen.
   *   - `FFMPEG_HWACCEL=nvidia` is set so `buildVideoEncoderArgs` picks
   *     h264_nvenc; this method does not fall back to libx264.
   */
  startFFmpegX11Grab(options: {
    display: string;
    width: number;
    height: number;
    fps: number;
    drawMouse?: boolean;
  }): void {
    if (this.ffmpeg) {
      console.warn("[RTMPBridge] FFmpeg already running");
      return;
    }

    const drawMouse = options.drawMouse === true;
    // x11grab format string. The `.0+0,0` suffix pins the grab offset to the
    // top-left of screen 0. If the caller has sized Xvfb to exactly WxH and
    // pinned Chromium at (0,0), this captures the scene region exactly.
    const x11Input = `${options.display}.0+0,0`;

    this.initOutputs();
    // x11grab does not use the CDP-direct stdin path, but we mark the bridge
    // as running so destination bookkeeping, backpressure accounting, and
    // status reporting all behave identically to `startFFmpegDirect`.
    this.cdpDirectMode = false;
    this.directFrameCount = 0;
    this.droppedFrameCount = 0;
    this.lastEncoderFrameCount = 0;
    this.lastEncoderFrameAt = null;

    const outputString = this.buildOutputString();
    const isNullOutput = outputString === "-f null -";

    const args: string[] = [
      // Low-latency input flags — x11grab is real-time only
      "-fflags",
      "nobuffer",
      "-flags",
      "low_delay",
      "-thread_queue_size",
      "512",
      "-probesize",
      "32",
      "-analyzeduration",
      "0",
      "-f",
      "x11grab",
      "-draw_mouse",
      drawMouse ? "1" : "0",
      "-video_size",
      `${options.width}x${options.height}`,
      "-framerate",
      String(options.fps),
      "-i",
      x11Input,
    ];

    args.push(...this.buildBridgeAudioInputArgs());

    // Video from x11grab (input 0), audio from pulse/anullsrc (input 1).
    args.push("-map", "0:v:0", "-map", "1:a:0");

    // Force output frame rate (matches existing CDP path).
    args.push("-r", String(options.fps));

    // NOTE: buildOutputVideoFilter normalises scale/pad for the final output
    // resolution. Safe to reuse here; if Xvfb is sized to exactly WxH this is
    // a no-op pass-through.
    args.push("-vf", this.buildOutputVideoFilter(true));

    // Video encoder (h264_nvenc via FFMPEG_HWACCEL=nvidia).
    args.push(...this.buildVideoEncoderArgs());

    args.push(...this.buildAudioArgs());

    // Use wallclock PTS so audio/video stay in lockstep against Cloudflare
    // ingest expectations (matches the existing CDP path's implicit behaviour).
    args.push("-fflags", "+genpts", "-use_wallclock_as_timestamps", "1");

    if (isNullOutput) {
      args.push("-f", "null", "-");
    } else {
      const directOutputArgs = this.buildDirectOutputArgs();
      if (directOutputArgs) {
        args.push(...directOutputArgs);
      } else {
        args.push("-f", "tee", outputString);
      }
    }

    const redactedArgs = args.map((arg) =>
      RTMPBridge.redactSensitiveFfmpegText(arg),
    );
    console.log(
      "[RTMPBridge] Starting FFmpeg (x11grab + NVENC mode) with args:",
      redactedArgs.join(" "),
    );

    this.ffmpeg = spawn(this.ffmpegCommand, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.setFfmpegBackpressured(false);

    this.startTime = Date.now();
    this.status.active = true;
    this.status.ffmpegRunning = true;
    // x11grab is always "connected" to its source (the X display); unlike the
    // WebSocket-based modes there is no client socket to wait for.
    this.status.clientConnected = true;

    this.setupFFmpegHandlers(
      "x11grab",
      () => this.status.ffmpegRunning === true,
    );
  }

  /** Exposed for unit tests — builds the args array without spawning FFmpeg. */
  buildX11GrabArgsForTest(options: {
    display: string;
    width: number;
    height: number;
    fps: number;
    drawMouse?: boolean;
  }): string[] {
    const drawMouse = options.drawMouse === true;
    const x11Input = `${options.display}.0+0,0`;
    const outputString = this.buildOutputString();
    const isNullOutput = outputString === "-f null -";
    const args: string[] = [
      "-fflags",
      "nobuffer",
      "-flags",
      "low_delay",
      "-thread_queue_size",
      "512",
      "-probesize",
      "32",
      "-analyzeduration",
      "0",
      "-f",
      "x11grab",
      "-draw_mouse",
      drawMouse ? "1" : "0",
      "-video_size",
      `${options.width}x${options.height}`,
      "-framerate",
      String(options.fps),
      "-i",
      x11Input,
    ];
    args.push(...this.buildBridgeAudioInputArgs());
    args.push("-map", "0:v:0", "-map", "1:a:0");
    args.push("-r", String(options.fps));
    args.push("-vf", this.buildOutputVideoFilter(true));
    args.push(...this.buildVideoEncoderArgs());
    args.push(...this.buildAudioArgs());
    args.push("-fflags", "+genpts", "-use_wallclock_as_timestamps", "1");
    if (isNullOutput) {
      args.push("-f", "null", "-");
    } else {
      const directOutputArgs = this.buildDirectOutputArgs();
      if (directOutputArgs) {
        args.push(...directOutputArgs);
      } else {
        args.push("-f", "tee", outputString);
      }
    }
    return args;
  }

  /**
   * Feed a single JPEG frame to FFmpeg (CDP direct mode)
   *
   * @param jpegBuffer - Raw JPEG image data
   * @returns true if frame was written, false if dropped
   */
  feedFrame(
    jpegBuffer: Buffer,
    options?: {
      frameAt?: number | null;
      cdpTimestamp?: number | null;
    },
  ): boolean {
    if (!this.ffmpeg?.stdin?.writable) return false;

    // Exit placeholder mode when live frames resume
    if (this.inPlaceholderMode) {
      this.stopPlaceholderMode();
    }

    const frameAt =
      typeof options?.frameAt === "number" && Number.isFinite(options.frameAt)
        ? options.frameAt
        : Date.now();
    this.bytesReceived += jpegBuffer.length;
    this.lastDataReceived = frameAt;
    this.directFrameCount++;
    this.recordDirectFrameSample({
      frameAt,
      size: jpegBuffer.length,
      cdpTimestamp: options?.cdpTimestamp ?? null,
    });

    return this.writeToFfmpeg(jpegBuffer);
  }

  /**
   * Get the current frame count (CDP direct mode)
   */
  getDirectFrameCount(): number {
    return this.directFrameCount;
  }

  /**
   * Monotonic frame counter as reported by FFmpeg's own `frame= NNN` stderr
   * progress line. Authoritative encoder-side liveness signal — used by the
   * x11_nvenc watchdog since that capture mode does not write JPEG frames to
   * FFmpeg stdin (and therefore `directFrameCount` is meaningless there).
   */
  getLastEncoderFrameCount(): number {
    return this.lastEncoderFrameCount;
  }

  /**
   * Wallclock ms timestamp of the most recent FFmpeg `frame=` advance, or
   * null if the encoder has not yet reported progress (typical before FFmpeg
   * first emits a progress line or immediately after a restart).
   */
  getLastEncoderFrameAt(): number | null {
    return this.lastEncoderFrameAt;
  }

  getCaptureDiagnostics(): {
    recentFrames: Array<{
      at: number;
      size: number;
      cdpTimestamp: number | null;
    }>;
    recentFrameCadenceMs: number[];
    nonMonotonicCdpTimestampCount: number;
    backpressureTransitions: Array<{
      at: number;
      backpressured: boolean;
    }>;
    firstFatalWriteError: FatalWriteDiagnostic | null;
    lastFatalWriteError: FatalWriteDiagnostic | null;
  } {
    const recentFrames = this.recentDirectFrames.map((sample) => ({
      at: sample.at,
      size: sample.size,
      cdpTimestamp: sample.cdpTimestamp,
    }));
    const recentFrameCadenceMs: number[] = [];
    for (let index = 1; index < recentFrames.length; index += 1) {
      const cadence = recentFrames[index]!.at - recentFrames[index - 1]!.at;
      if (Number.isFinite(cadence) && cadence >= 0) {
        recentFrameCadenceMs.push(cadence);
      }
    }

    return {
      recentFrames,
      recentFrameCadenceMs,
      nonMonotonicCdpTimestampCount: this.nonMonotonicCdpTimestampCount,
      backpressureTransitions: this.recentBackpressureTransitions.map(
        (transition) => ({
          at: transition.at,
          backpressured: transition.backpressured,
        }),
      ),
      firstFatalWriteError: this.firstFatalWriteError
        ? { ...this.firstFatalWriteError }
        : null,
      lastFatalWriteError: this.lastFatalWriteError
        ? { ...this.lastFatalWriteError }
        : null,
    };
  }

  /**
   * Stop processing (FFmpeg only) for browser rotation
   */
  async stopProcessing(): Promise<void> {
    if (this.ffmpegRestartTimeout) {
      clearTimeout(this.ffmpegRestartTimeout);
      this.ffmpegRestartTimeout = null;
    }
    this.stopHealthMonitoring();
    await this.stopFFmpeg();
  }

  /**
   * Stop the server and clean up
   */
  async stop(): Promise<void> {
    // Clear any pending restart timeout
    if (this.ffmpegRestartTimeout) {
      clearTimeout(this.ffmpegRestartTimeout);
      this.ffmpegRestartTimeout = null;
    }

    // Stop health monitoring
    this.stopHealthMonitoring();

    await this.stopFFmpeg();
    this.setFfmpegBackpressured(false);

    if (this.client) {
      this.client.close();
      this.client = null;
    }

    if (this.wss) {
      // Remove all listeners before closing to prevent memory leaks
      this.wss.removeAllListeners("listening");
      this.wss.removeAllListeners("connection");
      this.wss.removeAllListeners("error");
      this.wss.close();
      this.wss = null;
    }

    if (this.spectatorWss) {
      // Remove all listeners before closing to prevent memory leaks
      this.spectatorWss.removeAllListeners("listening");
      this.spectatorWss.removeAllListeners("connection");
      this.spectatorWss.removeAllListeners("error");
      this.spectatorWss.close();
      this.spectatorWss = null;
    }
    // Clean up individual spectator WebSocket listeners
    for (const client of this.spectatorClients) {
      client.removeAllListeners("close");
      client.removeAllListeners("error");
      try {
        client.close();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.spectatorClients.clear();
    this.fmp4InitSegment = null;
    this.ffmpegLogTail = [];

    // Reset restart state
    this.ffmpegRestartAttempts = 0;
    this.lastFFmpegCrash = 0;

    this.status.active = false;
    console.log("[RTMPBridge] Server stopped");
  }

  /**
   * Start the Spectator WebSocket Server for MSE zero-latency streaming
   */
  startSpectatorServer(port: number = 4180): void {
    if (this.spectatorWss) {
      console.warn("[RTMPBridge] Spectator server already running");
      return;
    }

    const tryListen = (retries: number = 1) => {
      this.spectatorWss = new WebSocketServer({ port });

      this.spectatorWss.on("listening", () => {
        console.log(
          `[RTMPBridge] Spectator WebSocket server started on port ${port} (MSE fMP4)`,
        );
      });

      this.spectatorWss.on("connection", (ws: WebSocket) => {
        console.log("[RTMPBridge] Spectator connected");
        this.spectatorClients.add(ws);

        // Send cached init segment so the browser can immediately start decoding
        if (this.fmp4InitSegment) {
          ws.send(this.fmp4InitSegment, { binary: true });
          console.log(
            `[RTMPBridge] Sent cached init segment (${this.fmp4InitSegment.length} bytes) to new spectator`,
          );
        }

        ws.on("close", () => {
          this.spectatorClients.delete(ws);
          console.log("[RTMPBridge] Spectator disconnected");
        });

        ws.on("error", (err) => {
          console.error("[RTMPBridge] Spectator error:", err);
          this.spectatorClients.delete(ws);
        });
      });

      this.spectatorWss.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && retries > 0) {
          console.warn(
            `[RTMPBridge] Spectator Port ${port} in use, killing stale process...`,
          );
          try {
            exec(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, {
              timeout: 3000,
            });
          } catch {}
          this.spectatorWss?.close();
          this.spectatorWss = null;
          setTimeout(() => tryListen(retries - 1), 1500);
        } else {
          console.error("[RTMPBridge] Spectator server error:", err);
        }
      });
    };

    tryListen();
  }

  /**
   * Broadcast binary fMP4 chunks to all connected spectators.
   * Detects and caches the init segment (ftyp+moov) for late joiners.
   */
  private broadcastToSpectators(data: Buffer): void {
    // Detect init segment: fMP4 always starts with an 'ftyp' box
    // ftyp box signature: bytes 4-7 are "ftyp" (0x66747970)
    if (!this.fmp4InitSegment && data.length >= 8) {
      const boxType = data.toString("ascii", 4, 8);
      if (boxType === "ftyp") {
        this.fmp4InitSegment = Buffer.from(data);
        console.log(
          `[RTMPBridge] Cached fMP4 init segment (${data.length} bytes)`,
        );
      }
    }

    for (const client of [...this.spectatorClients]) {
      if (client.readyState !== WebSocket.OPEN) {
        this.spectatorClients.delete(client);
        continue;
      }
      if (client.bufferedAmount > SPECTATOR_MAX_BUFFERED_BYTES) {
        console.warn(
          `[RTMPBridge] Dropping slow spectator (buffered=${client.bufferedAmount} bytes)`,
        );
        this.spectatorClients.delete(client);
        try {
          client.terminate();
        } catch {}
        continue;
      }
      try {
        client.send(data, { binary: true });
      } catch {
        this.spectatorClients.delete(client);
        try {
          client.terminate();
        } catch {}
      }
    }
  }

  /**
   * Handle incoming WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    if (this.client) {
      console.warn("[RTMPBridge] Rejecting connection - already have a client");
      ws.close(1013, "Already streaming");
      return;
    }

    const clientWs = ws as BridgeClientSocket;
    console.log("[RTMPBridge] Client connected");
    this.client = clientWs;
    this.status.clientConnected = true;
    this.bytesReceived = 0;
    this.droppedFrameCount = 0;

    // Start FFmpeg when client connects
    this.startFFmpeg();

    ws.on("message", (raw: RawData) => {
      const data = this.toBuffer(raw);
      if (!data) return;

      this.bytesReceived += data.length;
      this.lastDataReceived = Date.now();
      this.writeToFfmpeg(data, clientWs);
    });

    ws.on("close", () => {
      console.log("[RTMPBridge] Client disconnected");
      this.client = null;
      this.status.clientConnected = false;
      void this.stopFFmpeg();
    });

    ws.on("error", (err) => {
      console.error("[RTMPBridge] Client WebSocket error:", err);
    });
  }

  /**
   * Handle incoming WebSocket connection for WebCodecs mode
   * Expects raw H.264 NAL units (Annex B format)
   */
  private handleWebCodecsConnection(ws: WebSocket): void {
    if (this.client) {
      console.warn("[RTMPBridge] Rejecting connection - already have a client");
      ws.close(1013, "Already streaming");
      return;
    }

    const clientWs = ws as BridgeClientSocket;
    console.log("[RTMPBridge] Client connected (WebCodecs mode)");
    this.client = clientWs;
    this.client._isWebCodecs = true;
    this.status.clientConnected = true;
    this.bytesReceived = 0;
    this.droppedFrameCount = 0;

    // Start FFmpeg in stream-copy mode
    this.startFFmpegWebCodecs();

    ws.on("message", (raw: RawData) => {
      const data = this.toBuffer(raw);
      if (!data) return;

      this.bytesReceived += data.length;
      this.lastDataReceived = Date.now();
      this.writeToFfmpeg(data, clientWs);
    });

    ws.on("close", () => {
      console.log("[RTMPBridge] Client disconnected");
      this.client = null;
      this.status.clientConnected = false;
      void this.stopFFmpeg();
    });

    ws.on("error", (err) => {
      console.error("[RTMPBridge] Client WebSocket error:", err);
    });
  }

  /**
   * Build FFmpeg tee muxer output string
   */
  private buildOutputString(): string {
    const enabledDests = this.destinations.filter((d) => d.enabled);
    const outputs = enabledDests.map((dest) => {
      if (dest.url.startsWith("srt://")) {
        return `[f=mpegts:mpegts_flags=resend_headers:onfail=ignore]${RTMPBridge.teeEscape(dest.url)}`;
      }
      const fullUrl = dest.key ? `${dest.url}/${dest.key}` : dest.url;
      // Wrap each RTMP endpoint in a fifo muxer to absorb network stalls without blocking the encoder
      return `[f=fifo:fifo_format=flv:drop_pkts_on_overflow=1:attempt_recovery=1:recovery_wait_time=1]${fullUrl}`;
    });

    const ingestSettings = this.resolveIngestSettings();
    const hlsOutputPath = process.env.HLS_OUTPUT_PATH?.trim();
    if (hlsOutputPath && !ingestSettings.probeOnly) {
      this.cleanupHlsOutputArtifacts(hlsOutputPath);
      const hlsTime = parseEnvInt(process.env.HLS_TIME_SECONDS, 1, 1);
      const hlsListSize = parseEnvInt(process.env.HLS_LIST_SIZE, 6, 2);
      const hlsDeleteThreshold = parseEnvInt(
        process.env.HLS_DELETE_THRESHOLD,
        24,
        1,
      );
      const hlsStartNumber = parseEnvInt(
        process.env.HLS_START_NUMBER,
        Math.floor(Date.now() / 1000),
        0,
      );
      const hlsFlags =
        process.env.HLS_FLAGS ||
        "delete_segments+append_list+independent_segments+program_date_time+omit_endlist+temp_file";
      const hlsAllowCache = parseEnvInt(process.env.HLS_ALLOW_CACHE, 1, 0);
      const hlsSegmentPattern =
        process.env.HLS_SEGMENT_PATTERN?.trim() ||
        `${hlsOutputPath.replace(/\.[^./]+$/, "") || "stream"}-%09d.ts`;

      const hlsOptions = [
        "f=hls",
        "onfail=ignore",
        `hls_time=${hlsTime}`,
        `hls_list_size=${hlsListSize}`,
        `hls_delete_threshold=${hlsDeleteThreshold}`,
        `hls_flags=${hlsFlags}`,
        `start_number=${hlsStartNumber}`,
        `hls_allow_cache=${hlsAllowCache}`,
        `hls_segment_filename=${RTMPBridge.teeEscape(hlsSegmentPattern)}`,
      ].join(":");

      outputs.push(`[${hlsOptions}]${RTMPBridge.teeEscape(hlsOutputPath)}`);
    }

    if (outputs.length === 0) {
      // No outputs - just discard (useful for testing)
      return "-f null -";
    }

    return outputs.join("|");
  }

  private cleanupHlsOutputArtifacts(hlsOutputPath: string): void {
    const outputDir = path.dirname(hlsOutputPath);
    const manifestName = path.basename(hlsOutputPath);
    const defaultSegmentPattern = `${hlsOutputPath.replace(/\.[^./]+$/, "") || "stream"}-%09d.ts`;
    const segmentPattern =
      process.env.HLS_SEGMENT_PATTERN?.trim() || defaultSegmentPattern;
    const segmentPrefix = path.basename(segmentPattern).split("%", 1)[0] ?? "";
    if (!segmentPrefix) return;

    try {
      if (!fs.existsSync(outputDir)) return;
      for (const fileName of fs.readdirSync(outputDir)) {
        const isManifest = fileName === manifestName;
        const isSegment =
          fileName.startsWith(segmentPrefix) &&
          (fileName.endsWith(".ts") || fileName.endsWith(".tmp"));
        if (!isManifest && !isSegment) continue;
        fs.rmSync(path.join(outputDir, fileName), { force: true });
      }
    } catch (error) {
      console.warn(
        `[RTMPBridge] Unable to clean HLS output artifacts in ${outputDir}: ${errMsg(error)}`,
      );
    }
  }

  private buildDirectOutputArgs(): string[] | null {
    const enabledDests = this.destinations.filter(
      (destination) => destination.enabled,
    );
    const ingestSettings = this.resolveIngestSettings();
    const hlsOutputPath = process.env.HLS_OUTPUT_PATH?.trim();
    const hasLocalHlsOutput = Boolean(
      hlsOutputPath && !ingestSettings.probeOnly,
    );
    if (hasLocalHlsOutput || enabledDests.length !== 1) {
      return null;
    }

    const [destination] = enabledDests;
    if (!destination) return null;
    if (destination.url.startsWith("srt://")) {
      return [
        "-f",
        "mpegts",
        "-mpegts_flags",
        "+resend_headers",
        destination.url,
      ];
    }

    const fullUrl = destination.key
      ? `${destination.url}/${destination.key}`
      : destination.url;
    return ["-f", "flv", fullUrl];
  }

  private markAllDestinationsDisconnected(error?: string): void {
    for (const destination of this.status.destinations) {
      destination.connected = false;
      if (error) {
        destination.error = error;
      }
    }
  }

  private markDestinationsFromMessage(msg: string): void {
    const trimmed = msg.trim();
    const normalized = trimmed.toLowerCase();
    const now = Date.now();
    let matched = false;

    for (const destination of this.status.destinations) {
      const ingestCandidates = [
        destination.ingestUrl,
        this.destinations.find((candidate) => candidate.id === destination.id)
          ?.url,
      ]
        .filter(Boolean)
        .map((value) => {
          try {
            const url = new URL(String(value));
            return `${url.protocol}//${url.host}`;
          } catch {
            return String(value);
          }
        });

      if (
        normalized.includes(destination.name.toLowerCase()) ||
        ingestCandidates.some((candidate) =>
          normalized.includes(candidate.toLowerCase()),
        )
      ) {
        destination.connected = false;
        destination.error = trimmed;
        destination.lastWriteErrorAt = now;
        matched = true;
      }
    }

    if (!matched && this.status.destinations.length === 1) {
      const [destination] = this.status.destinations;
      if (destination) {
        destination.connected = false;
        destination.error = trimmed;
        destination.lastWriteErrorAt = now;
      }
    }
  }

  /** Quiet window after a write error during which markHealthyDestinationsConnected refuses to re-flip a destination to connected=true. */
  private static readonly DESTINATION_WRITE_ERROR_QUIET_WINDOW_MS = 10_000;
  /** Encoder output bitrate (kbps) below which we treat delivery as dark, once FFmpeg has been running long enough for the buffer to settle. */
  private static readonly DESTINATION_MIN_HEALTHY_BITRATE_KBPS = 100;
  /** Skip the bitrate-floor check for the first N ms of bridge uptime so initial I-frame burst doesn't trip it. */
  private static readonly DESTINATION_BITRATE_GRACE_MS = 15_000;

  private markHealthyDestinationsConnected(): void {
    const now = Date.now();
    // Encoder output running but pushing near-zero kbps AFTER the startup
    // grace window means the tee/fifo muxer is silently dropping output —
    // destinations are dark even though `frame=` progress keeps advancing.
    const bridgeUptimeMs = this.startTime > 0 ? now - this.startTime : 0;
    const encoderBitrate = this.ffmpegOutputBitrateKbps;
    const bitrateStarved =
      bridgeUptimeMs > RTMPBridge.DESTINATION_BITRATE_GRACE_MS &&
      encoderBitrate != null &&
      Number.isFinite(encoderBitrate) &&
      encoderBitrate < RTMPBridge.DESTINATION_MIN_HEALTHY_BITRATE_KBPS;

    for (const destination of this.status.destinations) {
      if (destination.error) continue;
      // An `frame=` / `fps=` progress line from FFmpeg only proves the
      // encoder is running. It does NOT prove the RTMP destination is
      // accepting bytes — FFmpeg will keep emitting progress lines while
      // its tee/fifo muxer is silently dropping packets. If a fatal
      // write error was observed in the recent past, leave `connected`
      // alone so the upstream health surface reports the real outage
      // until we have positive evidence (a new, clean progress run
      // after the quiet window elapses) that delivery has recovered.
      if (
        destination.lastWriteErrorAt != null &&
        now - destination.lastWriteErrorAt <
          RTMPBridge.DESTINATION_WRITE_ERROR_QUIET_WINDOW_MS
      ) {
        continue;
      }
      if (bitrateStarved) continue;
      destination.connected = true;
    }
  }

  /** Most recent `speed=N.NNx` parsed from FFmpeg stderr, or null before first progress line. Values below 1.0 indicate the encoder is falling behind real-time. */
  getEncoderSpeed(): number | null {
    return this.ffmpegSpeedX;
  }

  /** Most recent encoder output bitrate in kbps, or null before first progress line. */
  getEncoderOutputBitrateKbps(): number | null {
    return this.ffmpegOutputBitrateKbps;
  }

  /** Wallclock ms of the most recent destination write error, across all destinations. Null if none have been recorded since bridge start. */
  getLastDestinationWriteErrorAt(): number | null {
    let latest: number | null = null;
    for (const dest of this.status.destinations) {
      if (dest.lastWriteErrorAt == null) continue;
      if (latest == null || dest.lastWriteErrorAt > latest) {
        latest = dest.lastWriteErrorAt;
      }
    }
    return latest;
  }

  /**
   * Start FFmpeg process
   */
  private startFFmpeg(): void {
    if (this.ffmpeg) {
      console.warn("[RTMPBridge] FFmpeg already running");
      return;
    }

    this.ffmpegEncoderFps = 0;
    const outputString = this.buildOutputString();
    const isNullOutput = outputString === "-f null -";

    // Build FFmpeg arguments
    const args = [
      "-fflags",
      "+genpts+discardcorrupt+nobuffer",
      "-thread_queue_size",
      "256",
      // Input: pipe from stdin (WebM from MediaRecorder)
      "-i",
      "pipe:0",
      ...this.buildBridgeAudioInputArgs(),

      // Explicitly map input streams for tee outputs.
      // Ignore MediaRecorder's synthetic audio and let the bridge own A/V timing.
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",

      // Force constant frame rate output for strict RTMP ingestion (Twitch/YouTube)
      "-r",
      String(this.config.fps),
    ];
    args.push("-vf", this.buildOutputVideoFilter(true));

    // Video codec settings
    args.push(...this.buildVideoEncoderArgs());

    args.push(...this.buildAudioArgs());

    if (isNullOutput) {
      // No destinations - discard output (for testing)
      args.push("-f", "null", "-");
    } else {
      const directOutputArgs = this.buildDirectOutputArgs();
      if (directOutputArgs) {
        args.push(...directOutputArgs);
      } else {
        // Use tee muxer for multiple outputs
        args.push("-f", "tee", outputString);
      }
    }

    const redactedArgs = args.map((arg) =>
      RTMPBridge.redactSensitiveFfmpegText(arg),
    );
    console.log(
      "[RTMPBridge] Starting FFmpeg with args:",
      redactedArgs.join(" "),
    );

    this.ffmpeg = spawn(this.ffmpegCommand, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.setupFFmpegHandlers("", () => !!this.client);
  }

  /**
   * Start FFmpeg process for WebCodecs mode
   * Reads raw H.264 NAL units from stdin and muxes them (-c:v copy) to destinations.
   * Zero CPU encoding overhead.
   */
  private startFFmpegWebCodecs(): void {
    if (this.ffmpeg) {
      console.warn("[RTMPBridge] FFmpeg already running");
      return;
    }

    this.cdpDirectMode = false;

    const outputString = this.buildOutputString();
    const isNullOutput = outputString === "-f null -";

    const args = [
      "-fflags",
      "nobuffer",
      "-flags",
      "low_delay",
      // Important: read the raw h264 byte stream directly
      "-f",
      "h264",
      "-framerate",
      String(this.config.fps),
      "-i",
      "pipe:0",
      ...this.buildBridgeAudioInputArgs(),

      "-map",
      "0:v:0",
      "-map",
      "1:a:0",

      "-r",
      String(this.config.fps),

      // Zero CPU encoding: just copy the H.264 stream into the RTMP muxer.
      "-c:v",
      "copy",

      // Encode audio to AAC
      "-c:a",
      "aac",
      "-b:a",
      `${this.config.audioBitrate}k`,
      "-ar",
      "44100",
      "-flags",
      "+global_header",
    ];

    if (isNullOutput) {
      args.push("-f", "null", "-");
    } else {
      const directOutputArgs = this.buildDirectOutputArgs();
      if (directOutputArgs) {
        args.push(...directOutputArgs);
      } else {
        args.push("-f", "tee", outputString);
      }
    }

    const redactedWcArgs = args.map((arg) =>
      RTMPBridge.redactSensitiveFfmpegText(arg),
    );
    console.log(
      "[RTMPBridge] Starting FFmpeg (WebCodecs mode/Stream Copy) with args:",
      redactedWcArgs.join(" "),
    );

    this.ffmpeg = spawn(this.ffmpegCommand, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.setupFFmpegHandlers("WebCodecs", () => !!this.client);
  }

  /**
   * Parse FFmpeg output for connection status
   */
  private parseFFmpegOutput(msg: string): void {
    const encoderFpsMatch = msg.match(/fps=\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (encoderFpsMatch) {
      const parsedFps = Number.parseFloat(encoderFpsMatch[1] || "");
      if (Number.isFinite(parsedFps)) {
        this.ffmpegEncoderFps = parsedFps;
      }
    }

    const encoderFrameMatch = msg.match(/frame=\s*(\d+)/i);
    if (encoderFrameMatch) {
      const parsedFrame = Number.parseInt(encoderFrameMatch[1] || "", 10);
      if (
        Number.isFinite(parsedFrame) &&
        parsedFrame > this.lastEncoderFrameCount
      ) {
        this.lastEncoderFrameCount = parsedFrame;
        this.lastEncoderFrameAt = Date.now();
      }
    }

    // Parse `speed=0.25x` — encoder keeping up with real-time when >= ~1.0.
    // Sustained speed < 1.0 means the encoder is falling behind (either
    // RTMP upstream is backed up or the input pipeline is starving it),
    // and Cloudflare will refuse to promote the input to live.
    const speedMatch = msg.match(/speed=\s*([0-9]+(?:\.[0-9]+)?)x/i);
    if (speedMatch) {
      const parsedSpeed = Number.parseFloat(speedMatch[1] || "");
      if (Number.isFinite(parsedSpeed)) {
        this.ffmpegSpeedX = parsedSpeed;
      }
    }

    // Parse `bitrate=4123.5kbits/s` — encoder output bitrate.
    const bitrateMatch = msg.match(
      /bitrate=\s*([0-9]+(?:\.[0-9]+)?)\s*kbits\/s/i,
    );
    if (bitrateMatch) {
      const parsedBitrate = Number.parseFloat(bitrateMatch[1] || "");
      if (Number.isFinite(parsedBitrate)) {
        this.ffmpegOutputBitrateKbps = parsedBitrate;
      }
    }

    if (encoderFrameMatch || encoderFpsMatch) {
      this.markHealthyDestinationsConnected();
    }

    const slaveMuxerFailureMatch = msg.match(/Slave muxer #(\d+) failed/i);
    if (slaveMuxerFailureMatch) {
      const destIndex = Number.parseInt(slaveMuxerFailureMatch[1] || "", 10);
      if (Number.isFinite(destIndex)) {
        const destination = this.status.destinations[destIndex];
        if (destination) {
          destination.connected = false;
          destination.error = msg.trim();
        }
      }
    }

    if (
      /All tee outputs failed|av_interleaved_write_frame\(\)|Error writing trailer|Broken pipe|Input\/output error|The specified session has been invalidated/i.test(
        msg,
      )
    ) {
      this.recordFatalWriteError(msg);
      this.markDestinationsFromMessage(msg);
      this.scheduleFatalWriteRestart(msg);
    }

    // Check for RTMP connection errors
    for (const dest of this.status.destinations) {
      if (
        msg.includes(dest.name) ||
        msg.toLowerCase().includes(dest.name.toLowerCase())
      ) {
        if (msg.includes("error") || msg.includes("failed")) {
          dest.connected = false;
          dest.error = msg.trim();
        }
      }
    }
  }

  /**
   * Stop FFmpeg process
   */
  private async stopFFmpeg(): Promise<void> {
    if (!this.ffmpeg) return;

    console.log("[RTMPBridge] Stopping FFmpeg");
    if (this.fatalWriteRestartTimeout) {
      clearTimeout(this.fatalWriteRestartTimeout);
      this.fatalWriteRestartTimeout = null;
    }
    this.stopHealthMonitoring();
    this.stopPlaceholderMode();
    this.cdpDirectMode = false;
    this.setFfmpegBackpressured(false);
    this.ffmpegEncoderFps = 0;
    this.setClientBackpressurePaused(false);

    const oldFfmpeg = this.ffmpeg;
    this.ffmpeg = null;
    this.status.ffmpegRunning = false;
    this.markAllDestinationsDisconnected("ffmpeg_stopped");

    // Remove event listeners so old process close events don't nullify a newly started current process
    oldFfmpeg.removeAllListeners("close");
    oldFfmpeg.removeAllListeners("error");
    oldFfmpeg.stdout?.removeAllListeners("data");
    oldFfmpeg.stderr?.removeAllListeners("data");
    oldFfmpeg.stdin?.removeAllListeners("drain");
    oldFfmpeg.stdin?.removeAllListeners("error");

    if (oldFfmpeg.exitCode !== null || oldFfmpeg.signalCode !== null) {
      return;
    }

    let forceKilled = false;
    await new Promise<void>((resolve) => {
      let settled = false;
      let killTimer: ReturnType<typeof setTimeout> | null = null;
      let hardTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
      const settle = () => {
        if (settled) return;
        settled = true;
        if (killTimer) {
          clearTimeout(killTimer);
        }
        if (hardTimeoutTimer) {
          clearTimeout(hardTimeoutTimer);
        }
        oldFfmpeg.removeListener("exit", settle);
        oldFfmpeg.removeListener("close", settle);
        resolve();
      };

      oldFfmpeg.once("exit", settle);
      oldFfmpeg.once("close", settle);

      // Close stdin first to signal end of input.
      oldFfmpeg.stdin?.end();

      // Give it a moment to finish, then kill.
      killTimer = setTimeout(() => {
        forceKilled = true;
        try {
          oldFfmpeg.kill("SIGKILL"); // Force kill to prevent zombie FFmpeg processes taking up GPU/CPU
        } catch {}
      }, 750);
      killTimer.unref?.();

      hardTimeoutTimer = setTimeout(() => {
        forceKilled = true;
        settle();
      }, 3_000);
      hardTimeoutTimer.unref?.();

      try {
        oldFfmpeg.kill("SIGTERM");
      } catch {}
    });

    if (forceKilled) {
      console.warn(
        "[RTMPBridge] FFmpeg did not exit after SIGTERM; forced SIGKILL",
      );
    }
  }

  /**
   * Get current streaming status
   */
  getStatus(): StreamingStatus {
    // In duel-stack mode the RTMP publisher can run as an external process.
    // Surface configured destinations even when this in-process bridge is idle
    // so health endpoints can still verify fanout wiring.
    this.initOutputs();
    const idleConfiguredDestinations =
      this.status.destinations.length > 0
        ? this.status.destinations
        : this.destinations
            .filter((destination) => destination.enabled)
            .map((destination) => ({
              id: destination.id,
              name: destination.name,
              role: destination.role,
              provider: destination.provider,
              transport: destination.transport,
              playbackUrl: destination.playbackUrl ?? null,
              ingestUrl: destination.ingestUrl ?? destination.url,
              connected: false,
              bytesWritten: 0,
              startedAt: this.status.startedAt,
            }));

    return {
      ...this.status,
      destinations: idleConfiguredDestinations.map((d) => ({ ...d })),
    };
  }

  /**
   * Get streaming statistics
   */
  getStats(): {
    bytesReceived: number;
    uptime: number;
    destinations: number;
    restartAttempts: number;
    lastCrash: number;
    healthy: boolean;
    droppedFrames: number;
    encoderFps: number;
    backpressured: boolean;
    spectators: number;
    processMemory: {
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
      arrayBuffersBytes: number;
    };
  } {
    const now = Date.now();
    const healthy =
      this.status.ffmpegRunning &&
      (this.cdpDirectMode || this.status.clientConnected) &&
      (this.lastDataReceived === 0 ||
        now - this.lastDataReceived < RTMPBridge.DATA_TIMEOUT);
    const usage = process.memoryUsage();

    return {
      bytesReceived: this.bytesReceived,
      uptime: this.startTime ? now - this.startTime : 0,
      destinations: this.enabledOutputCount(),
      restartAttempts: this.ffmpegRestartAttempts,
      lastCrash: this.lastFFmpegCrash,
      healthy,
      droppedFrames: this.droppedFrameCount,
      encoderFps: this.ffmpegEncoderFps,
      backpressured: this.ffmpegBackpressured,
      spectators: this.spectatorClients.size,
      processMemory: {
        rssBytes: usage.rss,
        heapTotalBytes: usage.heapTotal,
        heapUsedBytes: usage.heapUsed,
        externalBytes: usage.external,
        arrayBuffersBytes: usage.arrayBuffers,
      },
    };
  }

  /**
   * Handle FFmpeg crash with exponential backoff restart
   */
  private handleFFmpegCrash(exitCode: number | null): void {
    const now = Date.now();
    this.lastFFmpegCrash = now;

    // Clear any existing restart timeout
    if (this.ffmpegRestartTimeout) {
      clearTimeout(this.ffmpegRestartTimeout);
      this.ffmpegRestartTimeout = null;
    }

    // Check if we've exceeded max restart attempts
    if (this.ffmpegRestartAttempts >= RTMPBridge.MAX_RESTART_ATTEMPTS) {
      console.error(
        `[RTMPBridge] FFmpeg crashed ${this.ffmpegRestartAttempts} times. ` +
          `Giving up. Manual intervention required.`,
      );
      this.status.active = false;
      return;
    }

    this.ffmpegRestartAttempts++;

    // Calculate delay with exponential backoff and jitter
    const baseDelay =
      RTMPBridge.BASE_RESTART_DELAY *
      Math.pow(2, this.ffmpegRestartAttempts - 1);
    const jitter = Math.random() * 1000; // Add up to 1s jitter
    const delay = Math.min(baseDelay + jitter, RTMPBridge.MAX_RESTART_DELAY);

    console.warn(
      `[RTMPBridge] FFmpeg crashed with code ${exitCode}. ` +
        `Restart attempt ${this.ffmpegRestartAttempts}/${RTMPBridge.MAX_RESTART_ATTEMPTS} ` +
        `in ${Math.round(delay)}ms`,
    );

    this.ffmpegRestartTimeout = setTimeout(() => {
      this.ffmpegRestartTimeout = null;

      // Only restart if client is still connected
      if (this.client || this.cdpDirectMode) {
        console.log("[RTMPBridge] Attempting FFmpeg restart...");
        if (this.cdpDirectMode) {
          this.startFFmpegDirect();
        } else if (this.client?._isWebCodecs) {
          this.startFFmpegWebCodecs();
        } else {
          this.startFFmpeg();
        }

        // Reset restart counter after successful restart (if still running after 5s)
        setTimeout(() => {
          if (this.ffmpeg && this.status.ffmpegRunning) {
            console.log("[RTMPBridge] FFmpeg restart appears successful");
            // Gradually reduce restart counter on success
            this.ffmpegRestartAttempts = Math.max(
              0,
              this.ffmpegRestartAttempts - 1,
            );
          }
        }, 5000);
      } else {
        console.log(
          "[RTMPBridge] Client disconnected, skipping FFmpeg restart",
        );
        this.ffmpegRestartAttempts = 0;
      }
    }, delay);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Stop any existing monitoring
    this.stopHealthMonitoring();

    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, RTMPBridge.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Check streaming health and log warnings
   */
  private checkHealth(): void {
    const now = Date.now();
    const stats = this.getStats();

    // Check for data timeout and enter placeholder mode if enabled
    if (
      this.lastDataReceived > 0 &&
      now - this.lastDataReceived > RTMPBridge.PLACEHOLDER_TIMEOUT
    ) {
      // Enter placeholder mode to keep stream alive
      if (this.placeholderEnabled && !this.inPlaceholderMode) {
        this.startPlaceholderMode();
      }

      // Only warn if we're past the longer DATA_TIMEOUT
      if (now - this.lastDataReceived > RTMPBridge.DATA_TIMEOUT) {
        console.warn(
          `[RTMPBridge] No data received for ${Math.round((now - this.lastDataReceived) / 1000)}s. ` +
            `${this.inPlaceholderMode ? "(placeholder mode active)" : "Stream may be stalled."}`,
        );
      }
    }

    // Check destination health
    for (const dest of this.status.destinations) {
      if (!dest.connected && dest.error) {
        console.warn(
          `[RTMPBridge] Destination ${dest.name} unhealthy: ${dest.error}`,
        );
      }
    }
    this.checkCanonicalDeliveryRecovery(now, stats);

    // Log periodic health status (every 5 health checks = ~50s)
    if (Math.random() < 0.2) {
      const healthyDests = this.status.destinations.filter(
        (d) => d.connected,
      ).length;
      console.log(
        `[RTMPBridge] Health check: ${stats.healthy ? "HEALTHY" : "UNHEALTHY"} | ` +
          `Uptime: ${Math.round(stats.uptime / 1000)}s | ` +
          `Received: ${Math.round(stats.bytesReceived / 1024)}KB | ` +
          `Destinations: ${healthyDests}/${this.status.destinations.length}`,
      );
    }
  }

  /**
   * Reset bytes received counter (call periodically to prevent overflow)
   */
  resetBytesReceived(): void {
    this.bytesReceived = 0;
  }

  /**
   * Reset FFmpeg restart attempt counter.
   * Call after a successful soft recovery to prevent premature give-up.
   */
  resetRestartAttempts(): void {
    this.ffmpegRestartAttempts = 0;
  }
}

// Singleton instance
let bridgeInstance: RTMPBridge | null = null;

/**
 * Get or create the RTMP bridge instance
 */
export function getRTMPBridge(): RTMPBridge {
  if (!bridgeInstance) {
    bridgeInstance = new RTMPBridge();
  }
  return bridgeInstance;
}

/**
 * Return the existing bridge instance without creating one.
 */
export function peekRTMPBridge(): RTMPBridge | null {
  return bridgeInstance;
}

/**
 * Start the RTMP bridge server
 */
export function startRTMPBridge(port: number = 8765): RTMPBridge {
  const bridge = getRTMPBridge();
  bridge.start(port);
  return bridge;
}
