/**
 * PM2 Ecosystem Config – Hyperscape Duel Stack
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs          # start
 *   pm2 restart ecosystem.config.cjs        # restart all
 *   pm2 stop ecosystem.config.cjs           # stop all
 *   pm2 delete ecosystem.config.cjs         # remove from pm2
 *   pm2 logs hyperscape-duel-api            # tail control-plane logs
 *
 * The default topology is split:
 * - hyperscape-duel-api owns the control plane, duel server, client, bots,
 *   betting app, and keeper automation.
 * - hyperscape-stream-source owns the dedicated browser capture + FFmpeg
 *   source worker.
 *
 * The duel-stack orchestrator only owns the stream worker when explicitly
 * opted in with DUEL_OWNS_STREAM_CAPTURE=true. That keeps staging/prod from
 * silently reverting to the old all-in-one capture model.
 */

// ── Load deploy-time secrets into process.env ─────────────────────────────
// bunx pm2 may not inherit the deploy shell's exported env vars, so we
// read the local runtime secret files directly. These files are intended to
// stay personal and untracked for enoomian staging; shared project secrets
// are intentionally not consulted here.
const fs = require("fs");
// Prefer persistent paths first. /tmp is wiped on reboot by systemd-tmpfiles
// on recent Ubuntu/Debian (rule `D /tmp` in /usr/lib/tmpfiles.d/tmp.conf),
// so after a host reboot a pm2 resurrect would find /tmp/hyperscape-secrets.env
// missing and start processes with default env. The persistent copy at
// /root/hyperscape-secrets.env survives reboots. The /tmp path remains as a
// transitional fallback for deploy scripts that haven't migrated.
const SECRETS_FILES = [
  "/tmp/hyperscape-secrets.env",
  require("path").join(__dirname, ".env.production"),
  "/root/hyperscape-secrets.env",
];
for (const secretsPath of SECRETS_FILES) {
  try {
    if (fs.existsSync(secretsPath)) {
      const lines = fs.readFileSync(secretsPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        // Runtime secret files are the deploy-time source of truth for this
        // PM2 config. Override inherited PM2 env so secret rotations take
        // effect on `pm2 restart ecosystem.config.cjs --update-env`.
        process.env[key] = value;
      }
    }
  } catch { /* ignore missing/unreadable files */ }
}

// Auto-detect DUEL_DATABASE_MODE from DATABASE_URL so sanitizeRuntimeEnv()
// doesn't strip it when the mode defaults to "local".
if (!process.env.DUEL_DATABASE_MODE && process.env.DATABASE_URL) {
  try {
    const dbHost = new URL(process.env.DATABASE_URL).hostname;
    const isLocal = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(dbHost);
    process.env.DUEL_DATABASE_MODE = isLocal ? "local" : "remote";
  } catch {
    process.env.DUEL_DATABASE_MODE = "remote";
  }
}

function isLoopbackHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1"
  );
}

function isLocalDatabaseUrl(rawValue) {
  if (!rawValue) return false;
  try {
    return isLoopbackHostname(new URL(rawValue).hostname);
  } catch {
    return false;
  }
}

function sanitizeRuntimeEnv() {
  const requestedDatabaseMode =
    (process.env.DUEL_DATABASE_MODE || "").trim().toLowerCase() || "local";
  const useRemoteDatabase = requestedDatabaseMode === "remote";
  const runtimeEnv = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value == null) continue;
    if (!useRemoteDatabase) {
      if (
        key === "DATABASE_URL" ||
        key === "POSTGRES_URL" ||
        key === "USE_LOCAL_POSTGRES"
      ) {
        continue;
      }
    }
    runtimeEnv[key] = value;
  }

  runtimeEnv.DUEL_DATABASE_MODE = useRemoteDatabase ? "remote" : "local";
  runtimeEnv.USE_LOCAL_POSTGRES =
    process.env.USE_LOCAL_POSTGRES ||
    (useRemoteDatabase ? "false" : "true");

  if (!useRemoteDatabase && isLocalDatabaseUrl(process.env.DATABASE_URL)) {
    runtimeEnv.DATABASE_URL = process.env.DATABASE_URL;
  }
  if (useRemoteDatabase && process.env.DATABASE_URL) {
    runtimeEnv.DATABASE_URL = process.env.DATABASE_URL;
  }

  return runtimeEnv;
}

const runtimeEnv = sanitizeRuntimeEnv();
const defaultGameUrl = process.env.GAME_URL || "http://localhost:3333/?page=stream";
const defaultGameFallbackUrls =
  process.env.GAME_FALLBACK_URLS ||
  [
    defaultGameUrl,
    "http://localhost:3333/?embedded=true&mode=spectator",
    "http://localhost:3333/",
  ].join(",");
const defaultHlsOutputPath =
  process.env.HLS_OUTPUT_PATH ||
  require("path").join(__dirname, "packages/server/public/live/stream.m3u8");
const defaultHlsSegmentPattern =
  process.env.HLS_SEGMENT_PATTERN ||
  require("path").join(
    __dirname,
    "packages/server/public/live/stream-%09d.ts",
  );
const configuredStreamDestinations =
  process.env.STREAM_ENABLED_DESTINATIONS ||
  process.env.DUEL_STREAM_DESTINATIONS ||
  "";
const normalizedStreamDestinations = configuredStreamDestinations
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const localHlsOutputEnabled =
  normalizedStreamDestinations.length === 0 ||
  normalizedStreamDestinations.some((value) =>
    ["self", "self_hls", "hls"].includes(value),
  );
const defaultRtmpStatusFile =
  process.env.RTMP_STATUS_FILE ||
  require("path").join(__dirname, ".runtime-locks/rtmp-status.json");

const display = process.env.DISPLAY || ":99";
const sharedProductionEnv = {
  ...runtimeEnv,
  NODE_ENV: "production",
  DISPLAY: display,
  POSTGRES_POOL_MAX: "20",
  POSTGRES_POOL_MIN: "2",
  SKIP_MIGRATIONS: "true",
  DATABASE_URL: process.env.DATABASE_URL || "",
  USE_LOCAL_POSTGRES:
    process.env.USE_LOCAL_POSTGRES ||
    (process.env.DATABASE_URL ? "false" : "true"),
  STREAMING_DUEL_ENABLED: "true",
  DUEL_BETTING_ENABLED: "false",
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
  SOLANA_WS_URL: "wss://api.devnet.solana.com/",
  ORACLE_SETTLEMENT_DELAY_MS: "7000",
  SOLANA_ARENA_MARKET_PROGRAM_ID:
    process.env.SOLANA_ARENA_MARKET_PROGRAM_ID ||
    "9NdidShnVzy1fc1WHWJTvyuXmH47ynfNGA6QFdyfAuSU",
  SOLANA_GOLD_MINT:
    process.env.SOLANA_GOLD_MINT ||
    "DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump",
  PUBLIC_CDN_URL: process.env.PUBLIC_CDN_URL || "https://assets.hyperscape.club",
  DISABLE_RATE_LIMIT: "true",
  ALLOW_DESTRUCTIVE_CHANGES: "false",
  AUTO_START_AGENTS: "true",
  AUTO_START_AGENTS_MAX: "10",
  SPAWN_MODEL_AGENTS: "true",
  MAX_MODEL_AGENTS: "4",
  MALLOC_TRIM_THRESHOLD_: "-1",
  MIMALLOC_ALLOW_DECOMMIT: "0",
  MIMALLOC_ALLOW_RESET: "0",
  MIMALLOC_PAGE_RESET: "0",
  MIMALLOC_PURGE_DELAY: "1000000",
  STREAM_CAPTURE_MODE: process.env.STREAM_CAPTURE_MODE || "cdp",
  STREAM_ALLOW_WEBCODECS_CLOUDFLARE:
    process.env.STREAM_ALLOW_WEBCODECS_CLOUDFLARE || "false",
  STREAM_CAPTURE_HEADLESS: "false",
  STREAM_CAPTURE_CHANNEL: "chrome-beta",
  STREAM_CAPTURE_ANGLE: "vulkan",
  STREAM_CAPTURE_WIDTH: process.env.STREAM_CAPTURE_WIDTH || "1280",
  STREAM_CAPTURE_HEIGHT: process.env.STREAM_CAPTURE_HEIGHT || "720",
  STREAM_OUTPUT_WIDTH:
    process.env.STREAM_OUTPUT_WIDTH ||
    process.env.STREAM_CAPTURE_WIDTH ||
    "1280",
  STREAM_OUTPUT_HEIGHT:
    process.env.STREAM_OUTPUT_HEIGHT ||
    process.env.STREAM_CAPTURE_HEIGHT ||
    "720",
  FFMPEG_HWACCEL:
    process.env.FFMPEG_HWACCEL ||
    (process.platform === "linux"
      ? "nvidia"
      : process.platform === "darwin"
        ? "mac"
        : "auto"),
  STREAM_LOW_LATENCY: process.env.STREAM_LOW_LATENCY || "true",
  STREAM_FPS: process.env.STREAM_FPS || "30",
  HLS_TIME_SECONDS: process.env.HLS_TIME_SECONDS || "1",
  HLS_LIST_SIZE: process.env.HLS_LIST_SIZE || "6",
  HLS_DELETE_THRESHOLD: process.env.HLS_DELETE_THRESHOLD || "24",
  FFMPEG_PATH: process.env.FFMPEG_PATH || "ffmpeg",
  TWITCH_STREAM_URL: process.env.TWITCH_STREAM_URL || "rtmp://live.twitch.tv/app",
  TWITCH_STREAM_KEY:
    process.env.TWITCH_STREAM_KEY || process.env.TWITCH_RTMP_STREAM_KEY || "",
  KICK_STREAM_KEY: process.env.KICK_STREAM_KEY || "",
  KICK_RTMP_URL:
    process.env.KICK_RTMP_URL ||
    "rtmps://fa723fc1b171.global-contribute.live-video.net/app",
  STREAM_ENABLED_DESTINATIONS:
    configuredStreamDestinations,
  YOUTUBE_STREAM_URL: process.env.YOUTUBE_STREAM_URL || "rtmp://a.rtmp.youtube.com/live2",
  HLS_OUTPUT_PATH: localHlsOutputEnabled ? defaultHlsOutputPath : "",
  HLS_SEGMENT_PATTERN: localHlsOutputEnabled ? defaultHlsSegmentPattern : "",
  RTMP_STATUS_FILE: defaultRtmpStatusFile,
  GAME_URL: defaultGameUrl,
  GAME_FALLBACK_URLS: defaultGameFallbackUrls,
  STREAMING_DUEL_COMBAT_AI_ENABLED: "false",
  SERVER_RUNTIME_MAX_TICKS_PER_FRAME: "1",
  SERVER_RUNTIME_MIN_DELAY_MS: "10",
};

const apiProcessEnv = {
  ...sharedProductionEnv,
  DUEL_OWNS_STREAM_CAPTURE: "false",
  STREAMING_CAPTURE_ENABLED: "false",
};

const streamSourceEnv = {
  ...sharedProductionEnv,
  STREAMING_CAPTURE_ENABLED: "true",
  // ───────────────────────────────────────────────────────────────────────────
  // To switch this worker to the native x11grab + NVENC capture path
  // (replaces CDP JPEG screencast; Chromium becomes a pure scene renderer):
  //
  //   STREAM_CAPTURE_MODE: "x11_nvenc",
  //
  // Requirements:
  //   - FFMPEG_HWACCEL=nvidia (already set in sharedProductionEnv on Linux)
  //   - Xvfb sized to exactly STREAM_CAPTURE_WIDTH x STREAM_CAPTURE_HEIGHT
  //   - xdpyinfo available on PATH (preflighted at start)
  // Rollback is instant: unset STREAM_CAPTURE_MODE (or set it to "cdp")
  // and `pm2 restart hyperscape-stream-source`.
  // ───────────────────────────────────────────────────────────────────────────
};

module.exports = {
  apps: [
    {
      name: "hyperscape-duel-api",
      script: "dist/index.js",
      interpreter: "node",
      node_args: "--import ./scripts/register-hooks.mjs",
      cwd: require("path").join(__dirname, "packages/server"),
      autorestart: true,
      max_restarts: 999999,
      min_uptime: "10s",
      restart_delay: 10000,
      exp_backoff_restart_delay: 2000,
      max_memory_restart: "4G",
      error_file: "logs/duel-api-error.log",
      out_file: "logs/duel-api-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      env: apiProcessEnv,
    },
    {
      name: "hyperscape-stream-source",
      script: "packages/server/scripts/stream-to-rtmp.ts",
      interpreter: "bun",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 999999,
      min_uptime: "10s",
      restart_delay: 10000,
      exp_backoff_restart_delay: 2000,
      max_memory_restart: "4G",
      error_file: "logs/stream-source-error.log",
      out_file: "logs/stream-source-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      env: streamSourceEnv,
    },
  ],
};
