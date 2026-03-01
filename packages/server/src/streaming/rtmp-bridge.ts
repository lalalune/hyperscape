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
import { WebSocketServer, WebSocket, type RawData } from "ws";
import type {
  RTMPDestination,
  StreamingConfig,
  StreamingStatus,
  DestinationStatus,
} from "./types.js";
import { DEFAULT_STREAMING_CONFIG } from "./types.js";

const require = createRequire(import.meta.url);
let resolvedFfmpegCommand: string | null = null;

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

  // Prefer the system FFmpeg on Linux. It has proven more stable than
  // some static builds for long-running tee muxer sessions.
  if (process.platform === "linux" && fs.existsSync("/usr/bin/ffmpeg")) {
    resolvedFfmpegCommand = "/usr/bin/ffmpeg";
    return resolvedFfmpegCommand;
  }

  try {
    const ffmpegStaticPath = require("ffmpeg-static") as string | null;
    if (ffmpegStaticPath && fs.existsSync(ffmpegStaticPath)) {
      resolvedFfmpegCommand = ffmpegStaticPath;
      return resolvedFfmpegCommand;
    }
  } catch {
    // Optional dependency; fall through to system ffmpeg.
  }

  resolvedFfmpegCommand = "ffmpeg";
  return resolvedFfmpegCommand;
}

export class RTMPBridge {
  private wss: WebSocketServer | null = null;
  private spectatorWss: WebSocketServer | null = null;
  private ffmpeg: ChildProcess | null = null;
  private client: WebSocket | null = null;
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
  /** Whether client socket reads are paused due to FFmpeg backpressure */
  private clientSocketPaused = false;

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
        250,
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
  }

  private static parseEnvBool(
    raw: string | undefined,
    defaultValue: boolean = true,
  ): boolean {
    if (raw == null || raw === "") return defaultValue;
    return !["0", "false", "no", "off"].includes(raw.trim().toLowerCase());
  }

  private static toRtmpUrl(input: string): string {
    const trimmed = input.trim();
    if (/^rtmps?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `rtmp://${trimmed}`;
  }

  private static teeEscape(value: string): string {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/:/g, "\\:")
      .replace(/\|/g, "\\|");
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
    ws: WebSocket | null = this.client,
  ): void {
    if (!ws) return;
    const socket = (
      ws as unknown as {
        _socket?: { pause?: () => void; resume?: () => void };
      }
    )._socket;
    if (!socket) return;

    if (paused && !this.clientSocketPaused) {
      socket.pause?.();
      this.clientSocketPaused = true;
    } else if (!paused && this.clientSocketPaused) {
      socket.resume?.();
      this.clientSocketPaused = false;
    }
  }

  /**
   * Write encoded media into FFmpeg stdin with backpressure handling.
   * In CDP direct mode we drop frames when backpressured to preserve low latency.
   */
  private writeToFfmpeg(data: Buffer, sourceWs?: WebSocket): boolean {
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
        this.ffmpegBackpressured = true;
        this.setClientBackpressurePaused(true, sourceWs);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load RTMP destinations from environment variables
   * Adds to any manually configured destinations
   */
  loadDestinationsFromEnv(): void {
    // Keep any manually added destinations, just add from env
    const existingNames = new Set(this.destinations.map((d) => d.name));
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
    const addDestination = (
      name: string,
      url: string,
      key: string = "",
      enabled: boolean = true,
    ) => {
      if (!url || existingNames.has(name)) return;
      this.destinations.push({ name, url, key, enabled });
      existingNames.add(name);
    };

    // Optional external multiplexer (Restream/livepeer/etc.)
    if (
      process.env.RTMP_MULTIPLEXER_URL &&
      !existingNames.has(
        process.env.RTMP_MULTIPLEXER_NAME || "RTMP Multiplexer",
      )
    ) {
      addDestination(
        process.env.RTMP_MULTIPLEXER_NAME || "RTMP Multiplexer",
        RTMPBridge.toRtmpUrl(process.env.RTMP_MULTIPLEXER_URL),
        process.env.RTMP_MULTIPLEXER_STREAM_KEY || "",
      );
    }

    // Twitch
    if (twitchStreamKey && !existingNames.has("Twitch")) {
      const server =
        process.env.TWITCH_STREAM_URL ||
        process.env.TWITCH_RTMP_URL ||
        process.env.TWITCH_RTMP_SERVER ||
        "live.twitch.tv/app";
      addDestination("Twitch", RTMPBridge.toRtmpUrl(server), twitchStreamKey);
    }

    // YouTube
    if (youtubeStreamKey && !existingNames.has("YouTube")) {
      const server =
        process.env.YOUTUBE_STREAM_URL ||
        process.env.YOUTUBE_RTMP_URL ||
        "rtmp://a.rtmp.youtube.com/live2";
      addDestination("YouTube", RTMPBridge.toRtmpUrl(server), youtubeStreamKey);
    }

    // Kick (uses RTMPS with regional ingest)
    const kickServer =
      process.env.KICK_RTMP_URL ||
      "rtmps://fa723fc1b171.global-contribute.live-video.net/app";
    const kickStreamKey = process.env.KICK_STREAM_KEY?.trim() || "";
    const kickUrlHasEmbeddedKey = /\/live\/[^/]+/.test(kickServer);
    if (
      (kickStreamKey || kickUrlHasEmbeddedKey) &&
      !existingNames.has("Kick")
    ) {
      addDestination("Kick", kickServer, kickStreamKey);
    }

    // Pump.fun (full URL provided)
    if (process.env.PUMPFUN_RTMP_URL && !existingNames.has("Pump.fun")) {
      addDestination(
        "Pump.fun",
        process.env.PUMPFUN_RTMP_URL,
        process.env.PUMPFUN_STREAM_KEY || "",
      );
    }

    // X/Twitter (full URL provided via Media Studio)
    if (process.env.X_RTMP_URL && !existingNames.has("X/Twitter")) {
      addDestination(
        "X/Twitter",
        process.env.X_RTMP_URL,
        process.env.X_STREAM_KEY || "",
      );
    }

    // Generic custom destination
    if (
      process.env.CUSTOM_RTMP_URL &&
      !existingNames.has(process.env.CUSTOM_RTMP_NAME || "Custom")
    ) {
      addDestination(
        process.env.CUSTOM_RTMP_NAME || "Custom",
        process.env.CUSTOM_RTMP_URL,
        process.env.CUSTOM_STREAM_KEY || "",
      );
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
            addDestination(
              item.name,
              RTMPBridge.toRtmpUrl(item.url),
              item.key || "",
              RTMPBridge.parseEnvBool(
                typeof item.enabled === "string"
                  ? item.enabled
                  : item.enabled == null
                    ? undefined
                    : String(item.enabled),
                true,
              ),
            );
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
   * Start the WebSocket server (legacy MediaRecorder mode)
   */
  start(port: number = 8765): void {
    if (this.wss) {
      console.warn("[RTMPBridge] Server already running");
      return;
    }

    this.initOutputs();

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

    if (encoder === "h264_videotoolbox") {
      return [
        "-c:v",
        "h264_videotoolbox",
        "-realtime",
        "1",
        "-b:v",
        `${this.config.videoBitrate}k`,
        "-maxrate",
        `${Math.floor(this.config.videoBitrate * 1.1)}k`,
        "-bufsize",
        `${this.config.videoBitrate * 2}k`,
        "-pix_fmt",
        "yuv420p",
        "-g",
        String(this.config.gopSize),
      ];
    } else if (encoder === "h264_nvenc") {
      return [
        "-c:v",
        "h264_nvenc",
        "-preset",
        "p3",
        "-tune",
        "ll",
        "-b:v",
        `${this.config.videoBitrate}k`,
        "-maxrate",
        `${Math.floor(this.config.videoBitrate * 1.1)}k`,
        "-bufsize",
        `${this.config.videoBitrate * 2}k`,
        "-pix_fmt",
        "yuv420p",
        "-g",
        String(this.config.gopSize),
      ];
    }

    // Use 'film' tune for better quality and stability (allows B-frames)
    // Only use 'zerolatency' if STREAM_LOW_LATENCY=true is explicitly set
    const useLowLatency = /^(1|true|yes)$/i.test(
      process.env.STREAM_LOW_LATENCY || "",
    );
    const tune = useLowLatency ? "zerolatency" : "film";
    // Buffer multiplier: 2x for both modes (was 4x for film, caused 18MB buffer)
    // Lower buffer reduces latency accumulation and backpressure buildup
    const bufferMultiplier = 2;

    return [
      "-c:v",
      "libx264",
      "-preset",
      this.config.preset,
      "-tune",
      tune,
      "-b:v",
      `${this.config.videoBitrate}k`,
      "-maxrate",
      `${Math.floor(this.config.videoBitrate * 1.2)}k`,
      "-bufsize",
      `${this.config.videoBitrate * bufferMultiplier}k`,
      "-pix_fmt",
      "yuv420p",
      "-g",
      String(this.config.gopSize),
      // Add B-frames for better compression (disabled in zerolatency mode)
      ...(useLowLatency ? [] : ["-bf", "2"]),
    ];
  }

  /**
   * Build common audio codec + global_header args.
   */
  private buildAudioArgs(): string[] {
    return [
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
      "44100",
      "-flags",
      "+global_header",
    ];
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

    this.ffmpegBackpressured = false;
    this.setClientBackpressurePaused(false);
    this.ffmpegLogTail = [];

    this.startTime = Date.now();
    this.status.active = true;
    this.status.ffmpegRunning = true;
    this.status.startedAt = this.startTime;

    this.status.destinations = this.destinations
      .filter((d) => d.enabled)
      .map((d) => ({
        name: d.name,
        connected: true,
        bytesWritten: 0,
        startedAt: this.startTime,
      }));

    this.ffmpeg.stdout?.on("data", (data) => {
      console.log("[FFmpeg stdout]", data.toString());
    });

    this.ffmpeg.stderr?.on("data", (data) => {
      const msg = data.toString();
      const lines = msg
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
      if (!msg.includes("frame=") && !msg.includes("fps=")) {
        console.log("[FFmpeg]", msg.trim());
      }
      this.parseFFmpegOutput(msg);
    });

    this.ffmpeg.on("close", (code, signal) => {
      console.log(
        `[RTMPBridge] FFmpeg${label ? ` (${label})` : ""} exited with code=${code ?? "null"} signal=${signal ?? "null"}`,
      );
      this.ffmpeg = null;
      this.status.ffmpegRunning = false;
      this.status.active = false;

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

      if (shouldRestartOnCrash()) {
        this.handleFFmpegCrash(-1);
      }
    });

    this.startHealthMonitoring();

    this.ffmpeg.stdin?.on("drain", () => {
      this.ffmpegBackpressured = false;
      this.setClientBackpressurePaused(false);
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

    // Check if low latency mode is explicitly requested
    const useLowLatency = /^(1|true|yes)$/i.test(
      process.env.STREAM_LOW_LATENCY || "",
    );

    // FFmpeg args for JPEG frame piping (mjpeg → H.264)
    const args: string[] = useLowLatency
      ? [
          // Ultra low-latency input flags (may cause buffering on viewers)
          "-fflags",
          "nobuffer",
          "-flags",
          "low_delay",
        ]
      : [
          // Balanced input flags with larger buffer for a/v sync stability
          "-fflags",
          "+genpts+discardcorrupt",
          "-thread_queue_size",
          "1024",
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

    // Audio input: try PulseAudio first, fallback to silent if not available
    const audioEnabled = process.env.STREAM_AUDIO_ENABLED !== "false";
    const pulseDevice =
      process.env.PULSE_AUDIO_DEVICE || "chrome_audio.monitor";
    let usePulseAudio = audioEnabled && process.platform === "linux";

    // Check if PulseAudio is actually accessible before trying to use it
    if (usePulseAudio) {
      try {
        // Test if we can access PulseAudio - pactl info will fail if not
        execSync("pactl info", { timeout: 2000, stdio: "pipe" });
        // Also verify the specific sink exists
        const sinks = execSync("pactl list short sinks", {
          timeout: 2000,
          stdio: "pipe",
        }).toString();
        if (!sinks.includes("chrome_audio")) {
          console.log(
            "[RTMPBridge] PulseAudio accessible but chrome_audio sink not found, falling back to silent",
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
      // Capture from PulseAudio virtual sink (Chrome outputs here)
      // Use thread_queue_size to buffer audio and prevent underruns
      // Use wallclock timestamps to maintain real-time timing
      args.push(
        "-thread_queue_size",
        "1024",
        "-use_wallclock_as_timestamps",
        "1",
        "-f",
        "pulse",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-i",
        pulseDevice,
      );
      console.log(`[RTMPBridge] Audio capture from PulseAudio: ${pulseDevice}`);
    } else {
      // Fallback: silent audio source (many RTMP servers require an audio track)
      args.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo");
      console.log(
        "[RTMPBridge] Audio: using silent source (PulseAudio not available)",
      );
    }

    // Map video from pipe and audio from PulseAudio/anullsrc
    args.push("-map", "0:v:0", "-map", "1:a:0");

    // Force output frame rate
    args.push("-r", String(this.config.fps));

    // Normalize to a deterministic even output size for H.264 encoders.
    // Browsers may emit odd canvas dimensions (e.g. 1024x637) under some
    // deviceScaleFactor/layout paths, which causes libx264 to fail.
    const outputWidth = Math.max(
      2,
      this.config.width - (this.config.width % 2),
    );
    const outputHeight = Math.max(
      2,
      this.config.height - (this.config.height % 2),
    );
    args.push(
      "-vf",
      `scale=${outputWidth}:${outputHeight}:flags=lanczos,format=yuv420p`,
    );

    // Video encoder
    args.push(...this.buildVideoEncoderArgs());

    args.push(...this.buildAudioArgs());

    if (isNullOutput) {
      args.push("-f", "null", "-");
    } else {
      args.push("-f", "tee", outputString);
    }

    const redactedCdpArgs = args.map((arg) =>
      /rtmps?:\/\//.test(arg)
        ? arg.replace(/\/[^/\s[\]]+$/, "/***REDACTED***")
        : arg,
    );
    console.log(
      "[RTMPBridge] Starting FFmpeg (CDP direct mode) with args:",
      redactedCdpArgs.join(" "),
    );

    this.ffmpeg = spawn(this.ffmpegCommand, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.ffmpegBackpressured = false;
    this.setClientBackpressurePaused(false);

    this.startTime = Date.now();
    this.status.active = true;
    this.status.ffmpegRunning = true;
    this.status.clientConnected = true; // CDP mode is always "connected"

    this.setupFFmpegHandlers("CDP direct", () => this.cdpDirectMode);
  }

  /**
   * Feed a single JPEG frame to FFmpeg (CDP direct mode)
   *
   * @param jpegBuffer - Raw JPEG image data
   * @returns true if frame was written, false if dropped
   */
  feedFrame(jpegBuffer: Buffer): boolean {
    if (!this.ffmpeg?.stdin?.writable) return false;

    this.bytesReceived += jpegBuffer.length;
    this.lastDataReceived = Date.now();
    this.directFrameCount++;

    return this.writeToFfmpeg(jpegBuffer);
  }

  /**
   * Get the current frame count (CDP direct mode)
   */
  getDirectFrameCount(): number {
    return this.directFrameCount;
  }

  /**
   * Stop processing (FFmpeg only) for browser rotation
   */
  stopProcessing(): void {
    if (this.ffmpegRestartTimeout) {
      clearTimeout(this.ffmpegRestartTimeout);
      this.ffmpegRestartTimeout = null;
    }
    this.stopHealthMonitoring();
    this.stopFFmpeg();
  }

  /**
   * Stop the server and clean up
   */
  stop(): void {
    // Clear any pending restart timeout
    if (this.ffmpegRestartTimeout) {
      clearTimeout(this.ffmpegRestartTimeout);
      this.ffmpegRestartTimeout = null;
    }

    // Stop health monitoring
    this.stopHealthMonitoring();

    this.stopFFmpeg();
    this.ffmpegBackpressured = false;
    this.setClientBackpressurePaused(false);

    if (this.client) {
      this.client.close();
      this.client = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.spectatorWss) {
      this.spectatorWss.close();
      this.spectatorWss = null;
    }
    for (const client of this.spectatorClients) {
      client.close();
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

    console.log("[RTMPBridge] Client connected");
    this.client = ws;
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
      this.writeToFfmpeg(data, ws);
    });

    ws.on("close", () => {
      console.log("[RTMPBridge] Client disconnected");
      this.client = null;
      this.status.clientConnected = false;
      this.stopFFmpeg();
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

    console.log("[RTMPBridge] Client connected (WebCodecs mode)");
    this.client = ws;
    (this.client as any)._isWebCodecs = true;
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
      this.writeToFfmpeg(data, ws);
    });

    ws.on("close", () => {
      console.log("[RTMPBridge] Client disconnected");
      this.client = null;
      this.status.clientConnected = false;
      this.stopFFmpeg();
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
      const fullUrl = dest.key ? `${dest.url}/${dest.key}` : dest.url;
      // Add flvflags for better RTMP stability and buffering
      return `[f=flv:onfail=ignore:flvflags=no_duration_filesize]${fullUrl}`;
    });

    const hlsOutputPath = process.env.HLS_OUTPUT_PATH?.trim();
    if (hlsOutputPath) {
      const hlsTime = parseEnvInt(process.env.HLS_TIME_SECONDS, 2, 1);
      const hlsListSize = parseEnvInt(process.env.HLS_LIST_SIZE, 24, 2);
      const hlsDeleteThreshold = parseEnvInt(
        process.env.HLS_DELETE_THRESHOLD,
        96,
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

  /**
   * Start FFmpeg process
   */
  private startFFmpeg(): void {
    if (this.ffmpeg) {
      console.warn("[RTMPBridge] FFmpeg already running");
      return;
    }

    const outputString = this.buildOutputString();
    const isNullOutput = outputString === "-f null -";

    // Build FFmpeg arguments
    const args = [
      // Input: pipe from stdin (WebM from MediaRecorder)
      "-i",
      "pipe:0",

      // Explicitly map input streams for tee outputs.
      // Some FFmpeg builds fail stream auto-selection with tee + WebM pipe input.
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",

      // Force constant frame rate output for strict RTMP ingestion (Twitch/YouTube)
      "-r",
      String(this.config.fps),
    ];

    // Normalize to deterministic even dimensions for H.264 output.
    const outputWidth = Math.max(
      2,
      this.config.width - (this.config.width % 2),
    );
    const outputHeight = Math.max(
      2,
      this.config.height - (this.config.height % 2),
    );
    args.push(
      "-vf",
      `scale=${outputWidth}:${outputHeight}:flags=lanczos,format=yuv420p`,
    );

    // Video codec settings
    args.push(...this.buildVideoEncoderArgs());

    args.push(...this.buildAudioArgs());

    if (isNullOutput) {
      // No destinations - discard output (for testing)
      args.push("-f", "null", "-");
    } else {
      // Use tee muxer for multiple outputs
      args.push("-f", "tee", outputString);
    }

    const redactedArgs = args.map((arg) =>
      /rtmps?:\/\//.test(arg)
        ? arg.replace(/\/[^/\s[\]]+$/, "/***REDACTED***")
        : arg,
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

      // Generate silent audio source
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=stereo",
      "-shortest",

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
      args.push("-f", "tee", outputString);
    }

    const redactedWcArgs = args.map((arg) =>
      /rtmps?:\/\//.test(arg)
        ? arg.replace(/\/[^/\s[\]]+$/, "/***REDACTED***")
        : arg,
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
  private stopFFmpeg(): void {
    if (!this.ffmpeg) return;

    console.log("[RTMPBridge] Stopping FFmpeg");
    this.ffmpegBackpressured = false;
    this.setClientBackpressurePaused(false);

    const oldFfmpeg = this.ffmpeg;
    this.ffmpeg = null;
    this.status.ffmpegRunning = false;

    // Remove event listeners so old process close events don't nullify a newly started current process
    oldFfmpeg.removeAllListeners("close");
    oldFfmpeg.removeAllListeners("error");
    oldFfmpeg.stdout?.removeAllListeners("data");
    oldFfmpeg.stderr?.removeAllListeners("data");
    oldFfmpeg.stdin?.removeAllListeners("drain");
    oldFfmpeg.stdin?.removeAllListeners("error");

    // Close stdin first to signal end of input
    oldFfmpeg.stdin?.end();

    // Give it a moment to finish, then kill
    const killTimer = setTimeout(() => {
      try {
        oldFfmpeg.kill("SIGKILL"); // Force kill to prevent zombie FFmpeg processes taking up GPU/CPU
      } catch {}
    }, 2000);
    killTimer.unref?.();
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
              name: destination.name,
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
        } else if (this.client && (this.client as any)._isWebCodecs) {
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

    // Check for data timeout
    if (
      this.lastDataReceived > 0 &&
      now - this.lastDataReceived > RTMPBridge.DATA_TIMEOUT
    ) {
      console.warn(
        `[RTMPBridge] No data received for ${Math.round((now - this.lastDataReceived) / 1000)}s. ` +
          `Stream may be stalled.`,
      );
    }

    // Check destination health
    for (const dest of this.status.destinations) {
      if (!dest.connected && dest.error) {
        console.warn(
          `[RTMPBridge] Destination ${dest.name} unhealthy: ${dest.error}`,
        );
      }
    }

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
