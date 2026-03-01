#!/usr/bin/env node
/**
 * Duel Stack Orchestrator
 *
 * Starts the full agent duel arena stack with one command:
 * - game server + client (streaming duel scheduler)
 * - duel bot matchmaker
 * - RTMP bridge + local HLS fanout
 * - betting app (devnet mode)
 * - keeper bot (devnet automation)
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { parseArgs } from "node:util";

const options = parseArgs({
  options: {
    help: { type: "boolean", short: "h" },
    bots: { type: "string", short: "b", default: "4" },
    "betting-port": { type: "string", default: "4179" },
    "rtmp-port": { type: "string", default: "8765" },
    "server-url": { type: "string", default: "http://localhost:5555" },
    "ws-url": { type: "string", default: "ws://localhost:5555/ws" },
    "client-url": { type: "string", default: "http://localhost:3333" },
    "remote-betting": { type: "boolean" },
    "skip-chain-setup": { type: "boolean" },
    "skip-keeper": { type: "boolean" },
    "skip-stream": { type: "boolean" },
    "skip-betting": { type: "boolean" },
    "skip-bots": { type: "boolean" },
    "with-mm": { type: "boolean" },
    "mm-mode": {
      type: "string",
      default: process.env.DUEL_MM_MODE || "auto",
    },
    "mm-config": {
      type: "string",
      default:
        process.env.DUEL_MM_CONFIG ||
        "packages/market-maker-bot/wallets.generated.json",
    },
    "mm-stagger-ms": {
      type: "string",
      default: process.env.DUEL_MM_STAGGER_MS || "900",
    },
    "mm-start-delay-ms": {
      type: "string",
      default: process.env.DUEL_MM_START_DELAY_MS || "1000",
    },
    fresh: { type: "boolean" },
    verify: { type: "boolean" },
    "verify-timeout-ms": { type: "string", default: "240000" },
    "startup-timeout-ms": {
      type: "string",
      default: process.env.DUEL_STARTUP_TIMEOUT_MS || "420000",
    },
    verbose: { type: "boolean", short: "v" },
  },
  strict: true,
}).values;

if (options.help) {
  console.log(`
Full Duel Stack bootstrap

Usage:
  bun run duel [options]

Options:
  -h, --help              Show this help
  -b, --bots <n>          Duel bot count (default: 4)
  --betting-port <n>      Betting app dev port (default: 4179)
  --rtmp-port <n>         RTMP bridge websocket port (default: 8765)
  --server-url <url>      Game HTTP base URL (default: http://localhost:5555)
  --ws-url <url>          Game WS URL (default: ws://localhost:5555/ws)
  --client-url <url>      Game client URL (default: http://localhost:3333)
  --remote-betting        Do not start local betting app (external platform mode)
  --skip-chain-setup      Start server without setup-chain/anvil bootstrap
  --skip-keeper           Skip devnet keeper bot
  --skip-stream           Skip RTMP/HLS bridge process
  --skip-betting          Skip betting app
  --skip-bots             Skip duel matchmaker bots
  --with-mm               Start market-maker bot(s) after duel stack is ready
  --mm-mode <mode>        MM startup mode: auto|single|multi (default: auto)
  --mm-config <path>      MM multi-wallet config path (default: packages/market-maker-bot/wallets.generated.json)
  --mm-stagger-ms <n>     MM multi startup stagger in ms (default: 900)
  --mm-start-delay-ms <n> Delay before MM startup in ms (default: 1000)
  --fresh                 Force fresh restart of game server + client
  --verify                Run startup verification checks after boot
  --verify-timeout-ms <n> Verification timeout in ms (default: 240000)
  --startup-timeout-ms <n> Readiness timeout for game/client/betting startup (default: 420000)
  -v, --verbose           Verbose status logs
`);
  process.exit(0);
}

function isProcessAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockFile(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch {
    return null;
  }
}

function acquireSingletonLock(lockName) {
  const lockDir = path.join(process.cwd(), ".runtime-locks");
  fs.mkdirSync(lockDir, { recursive: true });
  const lockPath = path.join(lockDir, `${lockName}.json`);

  const writeLock = () => {
    const fd = fs.openSync(lockPath, "wx");
    const payload = {
      pid: process.pid,
      createdAt: new Date().toISOString(),
      command: process.argv.join(" "),
      cwd: process.cwd(),
    };
    fs.writeFileSync(fd, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    fs.closeSync(fd);
  };

  try {
    writeLock();
  } catch (err) {
    if (err?.code !== "EEXIST") throw err;

    const existing = readLockFile(lockPath);
    const existingPid = Number.parseInt(String(existing?.pid ?? ""), 10);

    if (isProcessAlive(existingPid) && existingPid !== process.pid) {
      console.error(
        `[duel] Another duel stack is already running (pid ${existingPid}). Stop it before launching a new one.`,
      );
      process.exit(1);
    }

    try {
      fs.rmSync(lockPath, { force: true });
      writeLock();
    } catch {
      console.error(
        "[duel] Failed to acquire run lock. Delete .runtime-locks/duel-stack.json and retry.",
      );
      process.exit(1);
    }
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = readLockFile(lockPath);
    if (Number.parseInt(String(current?.pid ?? ""), 10) === process.pid) {
      try {
        fs.rmSync(lockPath, { force: true });
      } catch {
        // ignore lock cleanup failures
      }
    }
  };
}

const releaseRunLock = acquireSingletonLock("duel-stack");

const ROOT = process.cwd();
const bettingPort = Number.parseInt(options["betting-port"], 10);
const rtmpPort = Number.parseInt(options["rtmp-port"], 10);
const serverHttpUrl = options["server-url"].replace(/\/$/, "");
const serverWsUrl = options["ws-url"];
const clientUrl = options["client-url"].replace(/\/$/, "");
const bots = Math.max(2, Number.parseInt(options.bots, 10) || 4);
const verifyEnabled = options.verify === true;
const remoteBettingMode = options["remote-betting"] === true;
const withMarketMaker =
  options["with-mm"] === true ||
  /^(1|true|yes|on)$/i.test(process.env.DUEL_WITH_MM || "");
const mmModeRaw = String(options["mm-mode"] || "auto")
  .trim()
  .toLowerCase();
const mmMode = ["auto", "single", "multi"].includes(mmModeRaw)
  ? mmModeRaw
  : "auto";
const mmConfigInput = String(options["mm-config"] || "").trim();
const mmConfigPath = path.isAbsolute(mmConfigInput)
  ? mmConfigInput
  : path.resolve(ROOT, mmConfigInput);
const mmConfigExists = fs.existsSync(mmConfigPath);
const mmStaggerMs = Math.max(
  0,
  Number.parseInt(options["mm-stagger-ms"], 10) || 900,
);
const mmStartDelayMs = Math.max(
  0,
  Number.parseInt(options["mm-start-delay-ms"], 10) || 1000,
);
const skipChainSetup =
  options["skip-chain-setup"] === true ||
  remoteBettingMode ||
  /^(1|true|yes|on)$/i.test(process.env.DUEL_SKIP_CHAIN_SETUP || "");
const skipBettingApp = options["skip-betting"] === true || remoteBettingMode;
const verifyTimeoutMs =
  Number.parseInt(options["verify-timeout-ms"], 10) || 240_000;
const startupTimeoutMs =
  Number.parseInt(options["startup-timeout-ms"], 10) || 420_000;
const streamingStateTimeoutMs =
  Number.parseInt(process.env.DUEL_STREAMING_STATE_TIMEOUT_MS || "", 10) ||
  30_000;
const enableMadviseEagainShim =
  process.platform === "linux" &&
  !/^(0|false|no|off)$/i.test(
    process.env.DUEL_ENABLE_MADVISE_EAGAIN_SHIM || "true",
  );
const madviseShimSource = path.join(
  ROOT,
  "scripts/native/madvise-dontdump-shim.c",
);
const madviseShimOutput = path.join(
  ROOT,
  ".runtime-locks",
  "libduel-madvise-shim.so",
);

const bettingAppDir = path.join(ROOT, "packages/gold-betting-demo/app");
const bettingPublicDir = path.join(bettingAppDir, "public");
const serverPublicDir = path.join(ROOT, "packages/server/public");
const defaultHlsOutputPath = path.join(serverPublicDir, "live", "stream.m3u8");
const configuredHlsOutputPath = process.env.HLS_OUTPUT_PATH?.trim();
const hlsOutputPath = configuredHlsOutputPath
  ? path.isAbsolute(configuredHlsOutputPath)
    ? configuredHlsOutputPath
    : path.resolve(ROOT, configuredHlsOutputPath)
  : defaultHlsOutputPath;
const configuredHlsSegmentPattern = process.env.HLS_SEGMENT_PATTERN?.trim();
const defaultHlsSegmentPattern = path.join(
  path.dirname(hlsOutputPath),
  `${path.basename(hlsOutputPath, path.extname(hlsOutputPath)) || "stream"}-%09d.ts`,
);
const hlsSegmentPattern = configuredHlsSegmentPattern
  ? path.isAbsolute(configuredHlsSegmentPattern)
    ? configuredHlsSegmentPattern
    : path.resolve(ROOT, configuredHlsSegmentPattern)
  : defaultHlsSegmentPattern;
const configuredRtmpStatusFile = process.env.RTMP_STATUS_FILE?.trim();
const defaultRtmpStatusFile = path.join(
  ROOT,
  ".runtime-locks",
  "rtmp-status.json",
);
const rtmpStatusFile = configuredRtmpStatusFile
  ? path.isAbsolute(configuredRtmpStatusFile)
    ? configuredRtmpStatusFile
    : path.resolve(ROOT, configuredRtmpStatusFile)
  : defaultRtmpStatusFile;
const toPublicPath = (baseDir) => {
  const relative = path.relative(baseDir, hlsOutputPath).replace(/\\/g, "/");
  if (relative.startsWith("..")) return null;
  return `/${relative}`;
};
const serverHlsPublicPath = toPublicPath(serverPublicDir);
const bettingHlsPublicPath = toPublicPath(bettingPublicDir);
const localBettingHlsPath =
  serverHlsPublicPath || bettingHlsPublicPath || "/live/stream.m3u8";
const hlsUrl = serverHlsPublicPath
  ? `${serverHttpUrl}${serverHlsPublicPath}`
  : bettingHlsPublicPath
    ? `http://localhost:${bettingPort}${bettingHlsPublicPath}`
    : `${serverHttpUrl}/live/stream.m3u8`;
const streamPageUrl = `${clientUrl}/?page=stream`;
const embeddedSpectatorUrl = `${clientUrl}/?embedded=true&mode=spectator`;
const forceWebglFallback = /^(1|true|yes|on)$/i.test(
  process.env.DUEL_FORCE_WEBGL_FALLBACK || "",
);
const requestedCaptureMode = (
  process.env.STREAM_CAPTURE_MODE || "cdp"
).trim().toLowerCase();
const disableBridgeCapture =
  process.env.DUEL_DISABLE_BRIDGE_CAPTURE == null
    ? requestedCaptureMode === "cdp"
    : !/^(0|false|no|off)$/i.test(process.env.DUEL_DISABLE_BRIDGE_CAPTURE);
const streamCaptureUrl = withCaptureParams(streamPageUrl);
const embeddedSpectatorCaptureUrl = withCaptureParams(embeddedSpectatorUrl);
const homeCaptureUrl = withCaptureParams(`${clientUrl}/`);

const managed = [];
let shuttingDown = false;

function log(message) {
  console.log(`[duel] ${message}`);
}

function signalProcessTree(proc, signal) {
  if (!proc?.pid) return;

  // Prefer signaling the detached process group so subprocesses are cleaned up.
  try {
    process.kill(-proc.pid, signal);
    return;
  } catch {
    // Fall back to single PID when process groups are unavailable.
  }

  try {
    process.kill(proc.pid, signal);
  } catch {
    // ignore dead/unowned pid
  }
}

function withCacheBust(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set("_ts", String(Date.now()));
    return parsed.toString();
  } catch {
    const joiner = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${joiner}_ts=${Date.now()}`;
  }
}

function withCaptureParams(rawUrl) {
  const params = [];
  if (disableBridgeCapture) {
    params.push(["disableBridgeCapture", "1"]);
  }
  if (forceWebglFallback) {
    params.push(["webglFallback", "true"]);
  }
  if (params.length === 0) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl);
    for (const [key, value] of params) {
      parsed.searchParams.set(key, value);
    }
    return parsed.toString();
  } catch {
    const separator = rawUrl.includes("?") ? "&" : "?";
    const query = params
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
    return `${rawUrl}${separator}${query}`;
  }
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function listProcessSnapshot() {
  try {
    const out = execFileSync("ps", ["-axo", "pid=,command="], {
      encoding: "utf8",
    });
    return out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.+)$/);
        if (!match) return null;
        return {
          pid: Number.parseInt(match[1], 10),
          command: match[2],
        };
      })
      .filter((entry) => entry && Number.isFinite(entry.pid));
  } catch {
    return [];
  }
}

async function terminateProcessesByCommandPatterns(patterns, label) {
  const snapshot = listProcessSnapshot();
  const matched = snapshot.filter((entry) => {
    if (!entry?.pid || entry.pid === process.pid) return false;
    return patterns.some((pattern) => entry.command.includes(pattern));
  });

  if (matched.length === 0) return;

  log(
    `found ${matched.length} stale ${label} process(es): ${matched.map((entry) => entry.pid).join(", ")} - terminating`,
  );

  for (const entry of matched) {
    try {
      process.kill(entry.pid, "SIGTERM");
    } catch {
      // ignore dead/unowned pid
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));

  for (const entry of matched) {
    if (!isProcessAlive(entry.pid)) continue;
    try {
      process.kill(entry.pid, "SIGKILL");
    } catch {
      // ignore dead/unowned pid
    }
  }
}

async function cleanupStaleLocalPostgresSessions(serverEnv) {
  if (process.env.DUEL_SKIP_DB_SESSION_CLEANUP === "true") return;

  const host = serverEnv.POSTGRES_HOST || process.env.POSTGRES_HOST || "localhost";
  const port = Number.parseInt(
    String(serverEnv.POSTGRES_PORT || process.env.POSTGRES_PORT || "5432"),
    10,
  );
  const user = serverEnv.POSTGRES_USER || process.env.POSTGRES_USER;
  const password = serverEnv.POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD;
  const database = serverEnv.POSTGRES_DB || process.env.POSTGRES_DB;

  if (!user || !password || !database || !Number.isFinite(port) || port <= 0) {
    return;
  }

  let pool;
  try {
    const pg = await import("pg");
    const { Pool } = pg.default ?? pg;
    pool = new Pool({
      host,
      port,
      user,
      password,
      database,
      max: 1,
      connectionTimeoutMillis: 4000,
    });

    const maxResult = await pool.query("show max_connections");
    const totalResult = await pool.query(
      "select count(*)::int as total from pg_stat_activity where datname = current_database()",
    );
    const maxConnections = Number.parseInt(
      String(maxResult.rows?.[0]?.max_connections ?? "0"),
      10,
    );
    const totalConnections = Number.parseInt(
      String(totalResult.rows?.[0]?.total ?? "0"),
      10,
    );
    if (!Number.isFinite(maxConnections) || !Number.isFinite(totalConnections)) {
      return;
    }

    const cleanupThreshold = Math.max(30, Math.floor(maxConnections * 0.5));
    if (totalConnections < cleanupThreshold) return;

    const terminated = await pool.query(`
      with killed as (
        select pg_terminate_backend(pid) as ok
        from pg_stat_activity
        where datname = current_database()
          and pid <> pg_backend_pid()
          and usename = current_user
          and state = 'idle'
      )
      select count(*) filter (where ok)::int as terminated from killed
    `);
    const terminatedCount = Number.parseInt(
      String(terminated.rows?.[0]?.terminated ?? "0"),
      10,
    );
    if (terminatedCount > 0) {
      log(
        `terminated ${terminatedCount} stale idle PostgreSQL session(s) (had ${totalConnections}/${maxConnections} active backends)`,
      );
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log(`warning: unable to cleanup stale PostgreSQL sessions (${reason})`);
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch {
        // ignore cleanup failures
      }
    }
  }
}

function prepareHlsOutput(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith(".m3u8") || file.endsWith(".ts")) {
      try {
        fs.unlinkSync(path.join(dir, file));
      } catch {
        // ignore stale file cleanup errors
      }
    }
  }

  const hlsTargetDuration = Math.max(
    1,
    Number.parseInt(process.env.HLS_TIME_SECONDS || "2", 10) || 2,
  );
  const hlsStartNumber = Math.max(
    0,
    Number.parseInt(process.env.HLS_START_NUMBER || "0", 10) || 0,
  );
  const bootstrapManifest = [
    "#EXTM3U",
    "#EXT-X-VERSION:6",
    "#EXT-X-ALLOW-CACHE:YES",
    `#EXT-X-TARGETDURATION:${hlsTargetDuration}`,
    `#EXT-X-MEDIA-SEQUENCE:${hlsStartNumber}`,
    "#EXT-X-INDEPENDENT-SEGMENTS",
    "",
  ].join("\n");
  fs.writeFileSync(filePath, bootstrapManifest, "utf8");
}

function ensureMadviseEagainShim() {
  if (!enableMadviseEagainShim) return null;
  if (!fs.existsSync(madviseShimSource)) {
    log(
      `warning: madvise shim source not found at ${madviseShimSource}; continuing without shim`,
    );
    return null;
  }

  fs.mkdirSync(path.dirname(madviseShimOutput), { recursive: true });

  let needsBuild = !fs.existsSync(madviseShimOutput);
  if (!needsBuild) {
    try {
      const srcStat = fs.statSync(madviseShimSource);
      const outStat = fs.statSync(madviseShimOutput);
      needsBuild = srcStat.mtimeMs > outStat.mtimeMs;
    } catch {
      needsBuild = true;
    }
  }

  if (needsBuild) {
    try {
      execFileSync(
        "cc",
        [
          "-shared",
          "-fPIC",
          "-O2",
          "-Wall",
          "-Wextra",
          "-o",
          madviseShimOutput,
          madviseShimSource,
          "-ldl",
        ],
        { stdio: "pipe" },
      );
      log(`compiled madvise EAGAIN shim at ${madviseShimOutput}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log(
        `warning: failed to compile madvise shim (${reason}); continuing without shim`,
      );
      return null;
    }
  }

  return madviseShimOutput;
}

function spawnManaged(name, command, args, opts = {}) {
  const {
    critical = true,
    restart = false,
    restartDelayMs = 3000,
    maxRestarts = restart ? Number.POSITIVE_INFINITY : 0,
    ...spawnOptions
  } = opts;

  const entry = {
    name,
    command,
    args,
    spawnOptions,
    critical,
    restart,
    restartDelayMs: Math.max(
      250,
      Number.isFinite(restartDelayMs) ? restartDelayMs : 3000,
    ),
    maxRestarts:
      Number.isFinite(maxRestarts) && maxRestarts >= 0
        ? Math.floor(maxRestarts)
        : Number.POSITIVE_INFINITY,
    restarts: 0,
    restartTimer: null,
    proc: null,
  };

  const launch = () => {
    if (shuttingDown) return;

    const proc = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      ...entry.spawnOptions,
    });
    entry.proc = proc;

    const prefix = `[${name}]`;
    proc.stdout?.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) console.log(`${prefix} ${line}`);
    });
    proc.stderr?.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) console.error(`${prefix} ${line}`);
    });
    proc.on("exit", (code, signal) => {
      entry.proc = null;
      if (shuttingDown) return;

      const canRestart =
        entry.restart &&
        (entry.restarts < entry.maxRestarts ||
          entry.maxRestarts === Number.POSITIVE_INFINITY);

      if (canRestart) {
        entry.restarts += 1;
        console.warn(
          `${prefix} exited (code=${code ?? "null"} signal=${signal ?? "null"}) - restarting in ${entry.restartDelayMs}ms (attempt ${entry.restarts})`,
        );
        entry.restartTimer = setTimeout(() => {
          entry.restartTimer = null;
          launch();
        }, entry.restartDelayMs);
        return;
      }

      if (!entry.critical) {
        console.warn(
          `${prefix} exited (code=${code ?? "null"} signal=${signal ?? "null"})`,
        );
        return;
      }
      console.error(
        `${prefix} exited unexpectedly (code=${code ?? "null"} signal=${signal ?? "null"})`,
      );
      void shutdown(1);
    });
  };

  managed.push(entry);
  launch();
  return entry;
}

function runCommand(name, command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    });

    const prefix = `[${name}]`;
    proc.stdout?.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) console.log(`${prefix} ${line}`);
    });
    proc.stderr?.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) console.error(`${prefix} ${line}`);
    });
    proc.on("error", (error) => {
      reject(error);
    });
    proc.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${name} exited with code=${code ?? "null"} signal=${signal ?? "null"}`,
        ),
      );
    });
  });
}

async function waitForHttp(url, label, timeoutMs = 180_000) {
  const timeoutWindowMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 180_000;
  const maxAttempts = Math.max(1, Math.ceil(timeoutWindowMs / 1_000));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 2_000);
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) {
        log(`${label} ready at ${url}`);
        return;
      }
    } catch {
      // retry
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

async function waitForLiveHls(url, timeoutMs = 180_000) {
  const timeoutWindowMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 180_000;
  const maxAttempts = Math.max(1, Math.ceil(timeoutWindowMs / 1_000));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 2_000);
      const res = await fetch(withCacheBust(url), {
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.ok) {
        const manifest = await res.text();
        const hasHeader = manifest.includes("#EXTM3U");
        const hasSegments =
          /#EXTINF:/m.test(manifest) &&
          /\.(ts|m4s|mp4)(\?|$)/m.test(manifest);
        if (hasHeader && hasSegments) {
          log(`live HLS stream ready at ${url}`);
          return;
        }
      }
    } catch {
      // retry
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    if (attempt % 15 === 0) {
      log(`waiting for live HLS segments at ${url} (attempt ${attempt})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`live HLS stream did not become ready at ${url}`);
}

async function isHttpReady(url, timeoutMs = 2_000) {
  let timeout;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function getPortFromUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.port) {
      const parsedPort = Number.parseInt(parsed.port, 10);
      if (Number.isFinite(parsedPort) && parsedPort > 0) return parsedPort;
    }
    if (parsed.protocol === "https:" || parsed.protocol === "wss:") return 443;
    if (parsed.protocol === "http:" || parsed.protocol === "ws:") return 80;
  } catch {
    // ignore invalid URL
  }
  return null;
}

function getListeningPids(port) {
  if (!Number.isFinite(port) || port <= 0) return [];
  try {
    const output = execFileSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      { encoding: "utf8" },
    );
    return output
      .split(/\s+/)
      .filter(Boolean)
      .map((value) => Number.parseInt(value, 10))
      .filter((pid) => Number.isFinite(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

async function clearUnhealthyListener(label, rawUrl, force = false) {
  const port = getPortFromUrl(rawUrl);
  if (!port) return;

  const pids = getListeningPids(port);
  if (pids.length === 0) return;

  if (force) {
    log(
      `${label} fresh restart requested; terminating listener(s) on port ${port}: ${pids.join(", ")}`,
    );
  } else {
    log(
      `${label} is unhealthy but port ${port} is occupied by pid(s): ${pids.join(", ")}. terminating stale listener(s)...`,
    );
  }

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore dead/unowned pid
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));

  const stillListening = getListeningPids(port);
  if (stillListening.length > 0) {
    for (const pid of stillListening) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // ignore dead/unowned pid
      }
    }
  }
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("shutting down duel stack...");

  for (const entry of [...managed].reverse()) {
    if (entry.restartTimer) {
      clearTimeout(entry.restartTimer);
      entry.restartTimer = null;
    }
    const activeProc = entry.proc;
    if (activeProc && activeProc.exitCode == null && !activeProc.killed) {
      if (options.verbose) {
        log(`stopping ${entry.name} (pid ${activeProc.pid})`);
      }
      signalProcessTree(activeProc, "SIGTERM");
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));
  for (const entry of managed) {
    if (entry.restartTimer) {
      clearTimeout(entry.restartTimer);
      entry.restartTimer = null;
    }
    const proc = entry.proc;
    if (proc && proc.exitCode == null && !proc.killed) {
      signalProcessTree(proc, "SIGKILL");
    }
  }
  releaseRunLock();
  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void shutdown(0);
});
process.on("SIGTERM", () => {
  void shutdown(0);
});
process.on("SIGHUP", () => {
  void shutdown(0);
});
process.on("SIGQUIT", () => {
  void shutdown(0);
});
process.on("uncaughtException", (err) => {
  console.error("[duel] uncaught exception:", err);
  void shutdown(1);
});
process.on("unhandledRejection", (err) => {
  console.error("[duel] unhandled rejection:", err);
  void shutdown(1);
});

async function main() {
  prepareHlsOutput(hlsOutputPath);

  const serverEnv = readEnvFile(path.join(ROOT, "packages/server/.env"));
  const defaultPublicCdnUrl = `${serverHttpUrl}/game-assets`;
  const explicitDuelPublicCdnUrl = (process.env.DUEL_PUBLIC_CDN_URL || "").trim();
  const inheritedPublicCdnUrl = (
    process.env.PUBLIC_CDN_URL ||
    serverEnv.PUBLIC_CDN_URL ||
    ""
  ).trim();
  const allowInheritedPublicCdnUrl = /^(1|true|yes|on)$/i.test(
    process.env.DUEL_ALLOW_INHERITED_CDN_URL || "",
  );
  const resolvedPublicCdnUrl = (
    explicitDuelPublicCdnUrl ||
    (allowInheritedPublicCdnUrl ? inheritedPublicCdnUrl : "") ||
    defaultPublicCdnUrl
  ).replace(/\/$/, "");
  if (options.verbose) {
    const cdnSource = explicitDuelPublicCdnUrl
      ? "DUEL_PUBLIC_CDN_URL"
      : allowInheritedPublicCdnUrl && inheritedPublicCdnUrl
        ? "PUBLIC_CDN_URL/server .env"
        : "duel default (/game-assets)";
    log(`using PUBLIC_CDN_URL=${resolvedPublicCdnUrl} (${cdnSource})`);
  }
  if (options.fresh === true) {
    await terminateProcessesByCommandPatterns(
      [
        "bun --preload ./src/shared/polyfills.ts ./dist/index.js",
        "bun run --cwd packages/server start",
        "bun run dev:duel:skip-dev",
      ],
      "duel/server",
    );
    await terminateProcessesByCommandPatterns(
      [
        "bun run --cwd packages/market-maker-bot start",
        "bun run --cwd packages/market-maker-bot start:multi",
        "packages/market-maker-bot/src/index.ts",
        "packages/market-maker-bot/src/run-multi.ts",
      ],
      "duel/market-maker",
    );
  }
  await cleanupStaleLocalPostgresSessions(serverEnv);
  const verifyRequiredDestinations = [];

  const gameEnv = {
    ...serverEnv,
    ...process.env,
    // Duel stack should always target the local game server endpoints unless
    // explicitly overridden by duel-specific env vars.
    PUBLIC_API_URL:
      process.env.DUEL_PUBLIC_API_URL ||
      process.env.VITE_GAME_API_URL ||
      serverHttpUrl,
    PUBLIC_WS_URL:
      process.env.DUEL_PUBLIC_WS_URL ||
      process.env.VITE_GAME_WS_URL ||
      serverWsUrl,
    PUBLIC_CDN_URL: resolvedPublicCdnUrl,
    STREAMING_DUEL_ENABLED: process.env.STREAMING_DUEL_ENABLED || "true",
    DUEL_MARKET_MAKER_ENABLED:
      process.env.DUEL_MARKET_MAKER_ENABLED ||
      (remoteBettingMode ? "false" : "true"),
    DUEL_BETTING_ENABLED:
      process.env.DUEL_BETTING_ENABLED ||
      (skipBettingApp || remoteBettingMode ? "false" : "true"),
    // In remote-betting mode, disable local ArenaService loop/routes to avoid
    // duplicate market orchestration and keep duel runtime responsive.
    ARENA_SERVICE_ENABLED:
      process.env.ARENA_SERVICE_ENABLED ||
      (skipBettingApp ? "false" : "true"),
    DISABLE_RATE_LIMIT: process.env.DISABLE_RATE_LIMIT || "true",
    ALLOW_DESTRUCTIVE_CHANGES:
      process.env.ALLOW_DESTRUCTIVE_CHANGES || "false",
    // In external-betting mode, default to remote Postgres (Supabase/Railway).
    // Local betting workflows can still force USE_LOCAL_POSTGRES=true via env.
    USE_LOCAL_POSTGRES:
      process.env.USE_LOCAL_POSTGRES ||
      (skipBettingApp ? "false" : serverEnv.USE_LOCAL_POSTGRES || "true"),
    // Keep stream runtime alive through transient remote DB outages.
    DB_WRITE_ERRORS_NON_FATAL:
      process.env.DB_WRITE_ERRORS_NON_FATAL || "true",
    // Streaming duel instances don't need mutable world chunk persistence.
    DISABLE_WORLD_CHUNK_PERSISTENCE:
      process.env.DISABLE_WORLD_CHUNK_PERSISTENCE || "true",
    // Avoid blocking startup on crash-recovery DB queries in stream mode.
    SKIP_DEATH_RECOVERY_ON_STARTUP:
      process.env.SKIP_DEATH_RECOVERY_ON_STARTUP || "true",
    DEATH_RECOVERY_STARTUP_TIMEOUT_MS:
      process.env.DEATH_RECOVERY_STARTUP_TIMEOUT_MS || "5000",
    // Disable embedded agents — use LLM-driven model agents instead.
    AUTO_START_AGENTS: process.env.AUTO_START_AGENTS ?? "false",
    AUTO_START_AGENTS_MAX: process.env.AUTO_START_AGENTS_MAX || "10",
    // Enable model agents (LLM-driven, WebSocket-based) for duels and world behavior.
    SPAWN_MODEL_AGENTS: process.env.SPAWN_MODEL_AGENTS ?? "true",
    MAX_MODEL_AGENTS: process.env.MAX_MODEL_AGENTS || "10",
    // Allow model agents even if embedded agents are also running (safety net).
    SPAWN_MODEL_AGENTS_WITH_EMBEDDED:
      process.env.SPAWN_MODEL_AGENTS_WITH_EMBEDDED || "true",
    // Prevent aggressive local auto-restarts while tuning duel/MM workflows.
    MEMORY_RESTART_THRESHOLD_MB:
      process.env.MEMORY_RESTART_THRESHOLD_MB || "12288",
    // Enable autonomous behavior (movement, questing, skilling) outside duels.
    // StreamingDuelScheduler still owns combat flow inside the arena.
    EMBEDDED_AGENT_AUTONOMY_ENABLED:
      process.env.EMBEDDED_AGENT_AUTONOMY_ENABLED || "true",
    // Keep duel CPU predictable on long-running streams; scripted combat
    // strategy avoids piling LLM planning work into fight ticks.
    STREAMING_DUEL_LLM_TACTICS_ENABLED:
      process.env.STREAMING_DUEL_LLM_TACTICS_ENABLED || "false",
    // Default to combat-system-only duels for stream stability. Re-enable
    // per-agent DuelCombatAI explicitly when validating combat AI behavior.
    STREAMING_DUEL_COMBAT_AI_ENABLED:
      process.env.STREAMING_DUEL_COMBAT_AI_ENABLED || "false",
    STREAMING_ANNOUNCEMENT_MS:
      process.env.STREAMING_ANNOUNCEMENT_MS || "30000",
    STREAMING_FIGHTING_MS: process.env.STREAMING_FIGHTING_MS || "150000",
    STREAMING_END_WARNING_MS:
      process.env.STREAMING_END_WARNING_MS || "10000",
    STREAMING_RESOLUTION_MS:
      process.env.STREAMING_RESOLUTION_MS || "5000",
    // Prevent duplicate RTMP publishers when duel-stack runs external
    // stream-to-rtmp capture.
    STREAMING_CAPTURE_ENABLED:
      process.env.STREAMING_CAPTURE_ENABLED ||
      (options["skip-stream"] ? "true" : "false"),
    RTMP_STATUS_FILE: rtmpStatusFile,
    // Keep the server DB pool conservative in local duel workflows to avoid
    // exceeding low local Postgres max_connections limits.
    POSTGRES_POOL_MAX: process.env.POSTGRES_POOL_MAX || "6",
    POSTGRES_POOL_MIN: process.env.POSTGRES_POOL_MIN || "1",
    // Bun on Linux can spend excessive CPU in allocator trim loops under
    // duel load; disabling aggressive trim keeps API latency stable.
    MALLOC_TRIM_THRESHOLD_:
      process.env.MALLOC_TRIM_THRESHOLD_ || "-1",
    // Bun/mimalloc can enter high-CPU madvise loops under sustained stream
    // load. Keep pages resident longer to avoid allocator thrash stalls.
    MIMALLOC_ALLOW_DECOMMIT:
      process.env.MIMALLOC_ALLOW_DECOMMIT || "0",
    MIMALLOC_ALLOW_RESET: process.env.MIMALLOC_ALLOW_RESET || "0",
    MIMALLOC_PAGE_RESET: process.env.MIMALLOC_PAGE_RESET || "0",
    MIMALLOC_PURGE_DELAY: process.env.MIMALLOC_PURGE_DELAY || "1000000",
  };

  const configuredServerHealthPath = (
    process.env.DUEL_SERVER_HEALTH_PATH || "/health"
  ).trim();
  const normalizedServerHealthPath = configuredServerHealthPath.startsWith("/")
    ? configuredServerHealthPath
    : `/${configuredServerHealthPath}`;
  const gameServerHealthUrl = `${serverHttpUrl}${normalizedServerHealthPath}`;
  const gameStreamingStateUrl = `${serverHttpUrl}/api/streaming/state`;
  const serverHealthReady = await isHttpReady(gameServerHealthUrl);
  const serverStreamingReady = await isHttpReady(gameStreamingStateUrl);
  let serverWasReady = serverHealthReady && serverStreamingReady;
  let clientWasReady = await isHttpReady(clientUrl);
  const forceFreshGame =
    options.fresh === true ||
    verifyEnabled ||
    process.env.DUEL_FORCE_FRESH === "true";

  if (forceFreshGame) {
    log("forcing fresh game server + client startup");
    await clearUnhealthyListener("game server", serverHttpUrl, true);
    await clearUnhealthyListener("game client", clientUrl, true);
    serverWasReady = false;
    clientWasReady = false;
  }

  if (options.verbose) {
    log(
      `initial readiness: server health=${serverHealthReady}, streaming api=${serverStreamingReady}, client=${clientWasReady}`,
    );
  }

  if (serverWasReady && clientWasReady) {
    log("reusing existing game server + client");
  } else {
    if (!serverWasReady) {
      await clearUnhealthyListener("game server", serverHttpUrl);
    }
    if (!clientWasReady) {
      await clearUnhealthyListener("game client", clientUrl);
    }

    const missing = [];
    if (!serverWasReady) {
      missing.push("server");
    }
    if (!clientWasReady) {
      missing.push("client");
    }

    log(
      `starting missing game components (${missing.join(" + ")}) while preserving any running services`,
    );

    if (!serverWasReady) {
      log("building shared package for fresh server startup...");
      await runCommand(
        "shared-build",
        "bun",
        ["run", "--cwd", "packages/shared", "build"],
        { env: gameEnv },
      );
      log("building server package for stable runtime startup...");
      await runCommand(
        "server-build",
        "bun",
        ["run", "--cwd", "packages/server", "build"],
        { env: gameEnv },
      );
      const gameServerEnv = { ...gameEnv };
      const madviseShimPath = ensureMadviseEagainShim();
      if (madviseShimPath) {
        const existingPreload = (gameServerEnv.LD_PRELOAD || "").trim();
        gameServerEnv.LD_PRELOAD = existingPreload
          ? `${madviseShimPath}:${existingPreload}`
          : madviseShimPath;
        log("enabled madvise EAGAIN stability shim for game server");
      }
      const gameServerCommand = skipChainSetup
        ? {
            command: "bun",
            args: ["--preload", "./src/shared/polyfills.ts", "./dist/index.js"],
            opts: {
              cwd: path.join(ROOT, "packages/server"),
              env: gameServerEnv,
            },
          }
        : {
            command: "bun",
            args: ["run", "--cwd", "packages/server", "start"],
            opts: { env: gameServerEnv },
          };
      if (skipChainSetup) {
        log("starting game server without setup-chain bootstrap");
      }
      spawnManaged(
        "game-server",
        gameServerCommand.command,
        gameServerCommand.args,
        gameServerCommand.opts,
      );
    }

    if (!clientWasReady) {
      // Check if production build exists and should be used
      const clientDistPath = path.join(ROOT, "packages/client/dist/index.html");
      const useProductionBuild =
        process.env.NODE_ENV === "production" ||
        process.env.DUEL_CLIENT_MODE === "production" ||
        /^(1|true|yes|on)$/i.test(process.env.DUEL_USE_PRODUCTION_CLIENT || "");
      const distExists = fs.existsSync(clientDistPath);

      if (useProductionBuild && distExists) {
        log("starting game client in production mode (vite preview)...");
        spawnManaged(
          "game-client",
          "bun",
          ["run", "--cwd", "packages/client", "preview", "--", "--host", "--port", "3333"],
          { env: gameEnv },
        );
      } else {
        if (useProductionBuild && !distExists) {
          log("warning: production client requested but dist not found, falling back to dev mode");
        }
        spawnManaged("game-client", "bun", ["run", "--cwd", "packages/client", "dev"], {
          env: gameEnv,
        });
      }
    }
  }

  await waitForHttp(gameServerHealthUrl, "game server", startupTimeoutMs);
  try {
    await waitForHttp(
      gameStreamingStateUrl,
      "streaming duel api",
      streamingStateTimeoutMs,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log(
      `warning: streaming duel api not ready at ${gameStreamingStateUrl} (${reason}) - continuing startup`,
    );
  }
  // Game client is optional for the duel/betting stack — only wait if it was
  // explicitly started or was already running at boot.
  if (!clientWasReady || options.fresh) {
    await waitForHttp(`${clientUrl}`, "game client", startupTimeoutMs);
  } else {
    const clientOk = await isHttpReady(clientUrl);
    if (clientOk) {
      log(`game client ready at ${clientUrl}`);
    } else {
      log(`warning: game client not reachable at ${clientUrl} - continuing without it`);
    }
  }

  if (!options["skip-bots"]) {
    log("starting duel matchmaker bots...");
    spawnManaged(
      "duel-bots",
      "bun",
      [
        "run",
        "dev:duel:skip-dev",
        `--bots=${bots}`,
        `--url=${serverWsUrl}`,
        `--client-url=${clientUrl}`,
      ],
      {
        env: gameEnv,
        critical: false,
        restart: true,
        restartDelayMs: 2500,
      },
    );
  }

  if (!options["skip-stream"]) {
    startStreamBridge();
  }

  if (!skipBettingApp) {
    const bettingEnv = {
      ...process.env,
      ...readEnvFile(path.join(ROOT, "packages/gold-betting-demo/.env.devnet")),
      ...readEnvFile(path.join(ROOT, "packages/gold-betting-demo/app/.env.devnet")),
      // Prefer same-origin app stream path for reliability on :4179.
      VITE_STREAM_URL: process.env.VITE_STREAM_URL || localBettingHlsPath,
      VITE_GAME_API_URL: process.env.VITE_GAME_API_URL || serverHttpUrl,
      VITE_GAME_WS_URL: process.env.VITE_GAME_WS_URL || serverWsUrl,
      VITE_WS_URL: process.env.VITE_WS_URL || serverWsUrl,
    };

    await clearUnhealthyListener("betting-app", `http://localhost:${bettingPort}`, options.fresh === true);
    log(`starting betting app on :${bettingPort}...`);
    spawnManaged(
      "betting-app",
      "bun",
      [
        "run",
        "--cwd",
        "packages/gold-betting-demo/app",
        "dev",
        "--mode",
        "devnet",
        "--host",
        "--port",
        String(bettingPort),
      ],
      {
        env: bettingEnv,
        restart: true,
        restartDelayMs: 2500,
      },
    );
    await waitForHttp(
      `http://localhost:${bettingPort}`,
      "betting app",
      startupTimeoutMs,
    );
  }

  function startStreamBridge() {
    log("starting RTMP bridge + local HLS fanout...");
    const defaultCaptureHeadless =
      process.platform === "linux" ? "false" : "true";
    const captureHeadless = (
      process.env.STREAM_CAPTURE_HEADLESS || defaultCaptureHeadless
    ).toLowerCase() === "true";
    const preferSoftwareCapture =
      process.platform === "linux" && captureHeadless;
    const streamEnv = {
      ...serverEnv,
      ...process.env,
      GAME_URL: process.env.GAME_URL || streamCaptureUrl,
      GAME_FALLBACK_URLS:
        process.env.GAME_FALLBACK_URLS ||
        `${embeddedSpectatorCaptureUrl},${homeCaptureUrl}`,
      RTMP_BRIDGE_PORT: String(rtmpPort),
      HLS_OUTPUT_PATH: hlsOutputPath,
      HLS_SEGMENT_PATTERN: hlsSegmentPattern,
      HLS_TIME_SECONDS: process.env.HLS_TIME_SECONDS || "2",
      HLS_LIST_SIZE: process.env.HLS_LIST_SIZE || "24",
      HLS_DELETE_THRESHOLD: process.env.HLS_DELETE_THRESHOLD || "96",
      HLS_START_NUMBER:
        process.env.HLS_START_NUMBER || String(Math.floor(Date.now() / 1000)),
      HLS_FLAGS:
        process.env.HLS_FLAGS ||
        "delete_segments+append_list+independent_segments+program_date_time+omit_endlist+temp_file",
      // Prefer WebCodecs by default for lower CPU and smoother 720p stream.
      STREAM_CAPTURE_MODE:
        process.env.STREAM_CAPTURE_MODE ||
        (process.platform === "linux" ? "webcodecs" : "cdp"),
      STREAM_CAPTURE_CHANNEL:
        process.env.STREAM_CAPTURE_CHANNEL ||
        (process.platform === "linux"
          ? "chromium"
          : preferSoftwareCapture
            ? "chromium"
            : "chrome"),
      STREAM_CAPTURE_ANGLE:
        process.env.STREAM_CAPTURE_ANGLE ||
        (preferSoftwareCapture
          ? "swiftshader"
          : process.platform === "darwin"
            ? "metal"
            : "vulkan"),
      STREAM_CAPTURE_DISABLE_WEBGPU:
        process.env.STREAM_CAPTURE_DISABLE_WEBGPU ||
        (preferSoftwareCapture ? "true" : "false"),
      STREAM_CAPTURE_HEADLESS:
        process.env.STREAM_CAPTURE_HEADLESS || defaultCaptureHeadless,
      RTMP_STATUS_FILE: rtmpStatusFile,
    };

    const hasTwitchDestination = Boolean(
      streamEnv.TWITCH_STREAM_KEY || streamEnv.TWITCH_RTMP_STREAM_KEY,
    );
    const hasYoutubeDestination = Boolean(
      streamEnv.YOUTUBE_STREAM_KEY || streamEnv.YOUTUBE_RTMP_STREAM_KEY,
    );
    const strictDestinationVerification =
      process.env.DUEL_VERIFY_REQUIRE_DESTINATIONS === "true";
    if (strictDestinationVerification) {
      if (hasTwitchDestination) verifyRequiredDestinations.push("twitch");
      if (hasYoutubeDestination) verifyRequiredDestinations.push("youtube");
    } else if (hasTwitchDestination || hasYoutubeDestination) {
      log(
        "RTMP destination verification is in soft mode; set DUEL_VERIFY_REQUIRE_DESTINATIONS=true for strict destination checks.",
      );
    }

    const captureHeadlessForLaunch = (
      streamEnv.STREAM_CAPTURE_HEADLESS || "true"
    ).toLowerCase() === "true";
    const useXvfbForCapture =
      process.platform === "linux" &&
      !captureHeadlessForLaunch &&
      (process.env.DUEL_CAPTURE_USE_XVFB || "true").toLowerCase() !== "false";
    const rtmpCommand = useXvfbForCapture ? "xvfb-run" : "bun";
    const rtmpArgs = useXvfbForCapture
      ? [
          "-a",
          "-s",
          `-screen 0 ${streamEnv.STREAM_CAPTURE_WIDTH || "1280"}x${streamEnv.STREAM_CAPTURE_HEIGHT || "720"}x24`,
          "bun",
          "run",
          "--cwd",
          "packages/server",
          "stream:rtmp",
        ]
      : ["run", "--cwd", "packages/server", "stream:rtmp"];
    if (useXvfbForCapture) {
      log("starting RTMP bridge + capture under Xvfb (virtual display)...");
    }

    spawnManaged(
      "rtmp-bridge",
      rtmpCommand,
      rtmpArgs,
      {
        env: streamEnv,
        critical: false,
        restart: true,
        restartDelayMs: 3000,
      },
    );

    const hlsReadyTimeoutMs =
      Number.parseInt(process.env.DUEL_STREAM_READY_TIMEOUT_MS || "", 10) ||
      180_000;
    // Non-fatal: if HLS stream never comes up (e.g. no RTMP source) just warn
    // and keep the rest of the stack (betting app, bots, keeper) running.
    waitForLiveHls(hlsUrl, hlsReadyTimeoutMs).catch((err) => {
      log(`warning: HLS stream not ready - ${err.message}`);
      log("stream may not be available, but the rest of the stack continues");
    });
  }

  let mmRuntimeMode = "disabled";
  async function startMarketMakers() {
    if (!withMarketMaker) {
      return;
    }

    const marketMakerDir = path.join(ROOT, "packages/market-maker-bot");
    const resolvedMode =
      mmMode === "auto" ? (mmConfigExists ? "multi" : "single") : mmMode;
    const mmEnv = {
      ...readEnvFile(path.join(marketMakerDir, ".env")),
      ...process.env,
      MM_DUEL_STATE_API_URL:
        process.env.MM_DUEL_STATE_API_URL || gameStreamingStateUrl,
      MM_ENABLE_DUEL_SIGNAL: process.env.MM_ENABLE_DUEL_SIGNAL || "true",
      MM_DUEL_SIGNAL_WEIGHT: process.env.MM_DUEL_SIGNAL_WEIGHT || "0.9",
      MM_DUEL_HP_EDGE_MULTIPLIER:
        process.env.MM_DUEL_HP_EDGE_MULTIPLIER || "0.49",
      MM_DUEL_SIGNAL_FETCH_TIMEOUT_MS:
        process.env.MM_DUEL_SIGNAL_FETCH_TIMEOUT_MS || "2500",
      MM_TAKER_INTERVAL_CYCLES:
        process.env.MM_TAKER_INTERVAL_CYCLES || "1",
      ORDER_SIZE_MIN: process.env.ORDER_SIZE_MIN || "40",
      ORDER_SIZE_MAX: process.env.ORDER_SIZE_MAX || "140",
      MM_TAKER_SIZE_MIN: process.env.MM_TAKER_SIZE_MIN || "20",
      MM_TAKER_SIZE_MAX: process.env.MM_TAKER_SIZE_MAX || "80",
      MAX_ORDERS_PER_SIDE: process.env.MAX_ORDERS_PER_SIDE || "6",
      CANCEL_STALE_AGE_MS: process.env.CANCEL_STALE_AGE_MS || "12000",
    };

    if (mmStartDelayMs > 0) {
      log(`waiting ${mmStartDelayMs}ms before market-maker startup...`);
      await new Promise((resolve) => setTimeout(resolve, mmStartDelayMs));
    }

    if (resolvedMode === "multi") {
      if (!mmConfigExists) {
        log(
          `warning: MM multi config not found at ${mmConfigPath}; falling back to single mode`,
        );
      } else {
        mmRuntimeMode = "multi";
        log(`starting market maker bots (multi) using ${mmConfigPath}...`);
        spawnManaged(
          "market-maker",
          "bun",
          [
            "run",
            "--cwd",
            "packages/market-maker-bot",
            "start:multi",
            "--",
            "--config",
            mmConfigPath,
            "--stagger-ms",
            String(mmStaggerMs),
          ],
          {
            env: mmEnv,
            critical: false,
            restart: true,
            restartDelayMs: 3500,
          },
        );
        return;
      }
    }

    mmRuntimeMode = "single";
    log("starting market maker bot (single)...");
    spawnManaged(
      "market-maker",
      "bun",
      ["run", "--cwd", "packages/market-maker-bot", "start"],
      {
        env: mmEnv,
        critical: false,
        restart: true,
        restartDelayMs: 3500,
      },
    );
  }

  if (!options["skip-keeper"]) {
    log("starting keeper bot (devnet automation)...");
    const keeperGameUrl = (
      process.env.DUEL_KEEPER_GAME_URL ||
      process.env.KEEPER_GAME_URL ||
      serverHttpUrl
    )
      .trim()
      .replace(/\/$/, "");
    log(`keeper game api url: ${keeperGameUrl}`);
    log(
      "keeper will warn and back off automatically when bot signer funding is low",
    );
    const keeperEnv = {
      ...readEnvFile(path.join(ROOT, "packages/gold-betting-demo/.env.devnet")),
      ...process.env,
      GAME_URL: keeperGameUrl,
      GAME_STATE_POLL_TIMEOUT_MS:
        process.env.GAME_STATE_POLL_TIMEOUT_MS || "5000",
      GAME_STATE_POLL_INTERVAL_MS:
        process.env.GAME_STATE_POLL_INTERVAL_MS || "3000",
    };
    spawnManaged(
      "keeper-bot",
      "bun",
      ["run", "--cwd", "packages/gold-betting-demo", "keeper:bot:devnet"],
      {
        env: keeperEnv,
        critical: false,
        restart: true,
        restartDelayMs: 5000,
      },
    );
  }

  await startMarketMakers();

  if (verifyEnabled) {
    log("running startup verification checks...");
    const verifyArgs = [
      "scripts/verify-duel-stack.mjs",
      "--server-url",
      serverHttpUrl,
      "--client-url",
      clientUrl,
      "--hls-url",
      hlsUrl,
      "--timeout-ms",
      String(verifyTimeoutMs),
      "--fight-timeout-ms",
      String(Math.min(verifyTimeoutMs, 120_000)),
      "--rtmp-timeout-ms",
      String(Math.min(verifyTimeoutMs, 120_000)),
    ];
    if (!skipBettingApp) {
      verifyArgs.push("--betting-url", `http://localhost:${bettingPort}`);
    }
    if (verifyRequiredDestinations.length > 0) {
      verifyArgs.push(
        "--require-destinations",
        verifyRequiredDestinations.join(","),
      );
    }
    await runCommand("duel-verify", "bun", verifyArgs);
    log("startup verification passed");
  }

  log("stack online");
  log(`stream page: ${streamPageUrl}`);
  log(`stream capture url: ${streamCaptureUrl}`);
  log(`embedded spectator: ${embeddedSpectatorUrl}`);
  log(
    skipBettingApp
      ? "betting app: skipped (remote betting mode)"
      : `betting app: http://localhost:${bettingPort}`,
  );
  log(`hls stream url: ${hlsUrl}`);
  log(
    withMarketMaker
      ? `market maker: enabled (${mmRuntimeMode})`
      : "market maker: skipped (pass --with-mm)",
  );
  log("press Ctrl+C to stop");

  await new Promise(() => { });
}

main().catch((err) => {
  console.error("[duel] failed to start duel stack:", err);
  void shutdown(1);
});
