#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { promisify } from "node:util";

import { assertHyperiaNodeVersion } from "./node-runtime-policy.mjs";
import {
  buildDuelSmokeLauncherArgs,
  isDuelSmokeOnlineLine,
  validateDuelSmokePorts,
} from "./duel-launch-smoke-policy.mjs";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const options = parseArgs({
  options: {
    help: { type: "boolean", short: "h" },
    "skip-install": { type: "boolean" },
    "skip-build": { type: "boolean" },
    "with-hyperbet": { type: "boolean" },
    "with-keeper": { type: "boolean" },
    "with-stream-recovery": { type: "boolean" },
    "timeout-ms": { type: "string", default: "600000" },
  },
  strict: true,
}).values;

if (options.help) {
  console.log(`
Clean-checkout duel launch smoke.

Usage:
  node scripts/smoke-duel-launch.mjs [options]

Options:
  --skip-install       Reuse the current frozen install (local diagnostics only)
  --skip-build         Reuse current production builds (local diagnostics only)
  --with-hyperbet      Verify the read-only Hyperbet backend and betting UI
  --with-keeper        Also verify SOL transaction automation (requires deployed programs and roles)
  --with-stream-recovery
                       Inject and verify local renderer loss plus same-session UI recovery
  --timeout-ms <ms>    Startup/verification deadline (default: 600000)
`);
  process.exit(0);
}

assertHyperiaNodeVersion(process.version);

const timeoutMs = Number.parseInt(options["timeout-ms"], 10);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 60_000) {
  throw new Error("--timeout-ms must be an integer of at least 60000");
}
const withHyperbet = options["with-hyperbet"] === true;
const withKeeper = options["with-keeper"] === true;
const withStreamRecovery = options["with-stream-recovery"] === true;
if (withKeeper && !withHyperbet) {
  throw new Error("--with-keeper requires --with-hyperbet");
}
if (withStreamRecovery && !withHyperbet) {
  throw new Error("--with-stream-recovery requires --with-hyperbet");
}

const ports = validateDuelSmokePorts({
  server: Number(process.env.DUEL_SMOKE_SERVER_PORT || 35551),
  websocket: Number(process.env.DUEL_SMOKE_WS_PORT || 35552),
  client: Number(process.env.DUEL_SMOKE_CLIENT_PORT || 35553),
  capture: Number(process.env.DUEL_SMOKE_CAPTURE_PORT || 35554),
  spectator: Number(process.env.DUEL_SMOKE_SPECTATOR_PORT || 35556),
  postgres: Number(process.env.DUEL_SMOKE_POSTGRES_PORT || 35555),
  hyperbetApi: Number(process.env.DUEL_SMOKE_HYPERBET_API_PORT || 35557),
  hyperbetApp: Number(process.env.DUEL_SMOKE_HYPERBET_APP_PORT || 35558),
});
const runId = `${Date.now()}-${process.pid}`;
const containerName = `hyperia-duel-smoke-${runId}`;
const volumeName = `${containerName}-data`;
const liveDir = path.join(os.tmpdir(), `hyperia-duel-smoke-hls-${runId}`);
const hlsOutputPath = path.join(liveDir, "stream.m3u8");
const runtimeDir = path.join(ROOT, ".runtime-locks", `duel-smoke-${runId}`);
const rtmpStatusFile = path.join(runtimeDir, "rtmp-status.json");
const hyperbetKeeperHealthFile = path.join(
  runtimeDir,
  "hyperbet-keeper-health.json",
);
const hyperbetStreamStateFile = path.join(
  runtimeDir,
  "hyperbet-stream-state.json",
);
const hyperbetKeeperDbPath = path.join(runtimeDir, "hyperbet-keeper.sqlite");
const duelLockPath = path.join(ROOT, ".runtime-locks", "duel-stack.json");
const clientRuntimeEnvPath = path.join(ROOT, "packages/client/dist/env.js");
const originalClientRuntimeEnv = fs.existsSync(clientRuntimeEnvPath)
  ? await fsp.readFile(clientRuntimeEnvPath)
  : null;
const runtimePath = [path.dirname(process.execPath), process.env.PATH]
  .filter(Boolean)
  .join(path.delimiter);
let activeCommand = null;
let launcher = null;
let cleanupPromise = null;
let interruptedSignal = null;

function log(message) {
  console.log(`[duel-smoke] ${message}`);
}

async function runCommand(label, command, args, environment = {}) {
  log(`${label}...`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, ...environment, PATH: runtimePath },
      stdio: "inherit",
    });
    activeCommand = child;
    child.once("error", (error) => {
      if (activeCommand === child) activeCommand = null;
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (activeCommand === child) activeCommand = null;
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (code=${code} signal=${signal})`));
    });
  });
}

async function assertPortAvailable(name, port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () =>
      reject(new Error(`Duel smoke ${name} port ${port} is already in use`)),
    );
    server.listen({ host: "0.0.0.0", port, exclusive: true }, () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

async function dockerObjectExists(args) {
  try {
    const { stdout } = await execFileAsync("docker", args);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function waitForChildExit(child, waitMs) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for duel launcher shutdown")),
      waitMs,
    );
    const handleExit = () => {
      clearTimeout(timeout);
      resolve();
    };
    child.once("exit", handleExit);
    if (child.exitCode !== null || child.signalCode !== null) {
      child.removeListener("exit", handleExit);
      handleExit();
    }
  });
}

function signalProcessGroup(child, signal) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Process already exited.
    }
  }
}

async function removeOwnedDuelLock(launcherPid) {
  try {
    const lock = JSON.parse(await fsp.readFile(duelLockPath, "utf8"));
    if (Number(lock?.pid) === launcherPid) {
      await fsp.rm(duelLockPath, { force: true });
    }
  } catch {
    // Missing, invalid, or not owned by this smoke process.
  }
}

async function cleanup() {
  if (
    activeCommand &&
    activeCommand.exitCode === null &&
    activeCommand.signalCode === null
  ) {
    activeCommand.kill("SIGTERM");
    await waitForChildExit(activeCommand, 10_000).catch(() => {});
  }

  if (launcher && launcher.exitCode === null && launcher.signalCode === null) {
    launcher.kill("SIGINT");
    try {
      await waitForChildExit(launcher, 30_000);
    } catch {
      signalProcessGroup(launcher, "SIGKILL");
      await waitForChildExit(launcher, 10_000).catch(() => {});
    }
  }
  if (launcher) signalProcessGroup(launcher, "SIGTERM");

  await removeOwnedDuelLock(launcher?.pid);
  await execFileAsync("docker", ["rm", "-f", containerName]).catch(() => {});
  await execFileAsync("docker", ["volume", "rm", volumeName]).catch(() => {});
  await fsp.rm(liveDir, { recursive: true, force: true });
  await fsp.rm(runtimeDir, { recursive: true, force: true });

  if (originalClientRuntimeEnv === null) {
    await fsp.rm(clientRuntimeEnvPath, { force: true });
  } else {
    await fsp.writeFile(clientRuntimeEnvPath, originalClientRuntimeEnv);
  }
}

function cleanupOnce() {
  cleanupPromise ||= cleanup();
  return cleanupPromise;
}

function handleInterruption(signal) {
  if (interruptedSignal) return;
  interruptedSignal = signal;
  log(`received ${signal}; stopping only smoke-owned resources`);
  void cleanupOnce();
}

function assertNotInterrupted() {
  if (interruptedSignal) {
    throw new Error(`Duel smoke interrupted by ${interruptedSignal}`);
  }
}

process.once("SIGINT", () => handleInterruption("SIGINT"));
process.once("SIGTERM", () => handleInterruption("SIGTERM"));

async function launchAndWait() {
  const args = buildDuelSmokeLauncherArgs({
    ports,
    timeoutMs,
    withHyperbet,
    withKeeper,
  });
  const environment = {
    ...process.env,
    PATH: runtimePath,
    POSTGRES_CONTAINER: containerName,
    POSTGRES_PORT: String(ports.postgres),
    POSTGRES_USER: "hyperia_smoke",
    POSTGRES_PASSWORD: `smoke-${runId}`,
    POSTGRES_DB: "hyperia_smoke",
    POSTGRES_IMAGE: "postgres:16-alpine",
    HLS_OUTPUT_PATH: hlsOutputPath,
    HLS_SEGMENT_PATTERN: path.join(liveDir, "stream-%09d.ts"),
    RTMP_STATUS_FILE: rtmpStatusFile,
    SPECTATOR_PORT: String(ports.spectator),
    STREAM_CAPTURE_CHANNEL: "bundled",
    DUEL_WITH_HYPERBET: withHyperbet ? "true" : "false",
    DUEL_HYPERBET_READ_ONLY_MODE:
      withHyperbet && !withKeeper ? "true" : "false",
    DUEL_HYPERBET_KEEPER_HEALTH_FILE: hyperbetKeeperHealthFile,
    DUEL_HYPERBET_STREAM_STATE_FILE: hyperbetStreamStateFile,
    DUEL_HYPERBET_KEEPER_DB_PATH: hyperbetKeeperDbPath,
    DUEL_USE_PRODUCTION_CLIENT: "true",
    DUEL_NODE_ENV: "production",
    DUEL_LOG_LEVEL: "info",
    DUEL_LOCAL_SMOKE_MODE: "true",
    LOAD_TEST_MODE: "true",
    TERRAIN_SEED: "0",
    TOWN_COLLISION_DEEP_VALIDATION: "false",
    ANTHROPIC_API_KEY: "",
    OPENAI_API_KEY: "",
    GROQ_API_KEY: "",
    STREAMING_DUEL_PREPARATION_MS: "5000",
    STREAMING_ANNOUNCEMENT_MS: "5000",
    STREAMING_FIGHTING_MS: "30000",
    STREAMING_END_WARNING_MS: "5000",
    STREAMING_RESOLUTION_MS: "3000",
  };
  // Keep binding inputs absent here on purpose: the explicit launcher URLs
  // must be sufficient to bind the same custom ports they advertise.
  // Mirroring them through PORT/UWS_PORT would hide topology drift.
  delete environment.PORT;
  delete environment.UWS_PORT;

  const child = spawn("bun", args, {
    cwd: ROOT,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  launcher = child;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  let stdoutBuffer = "";
  const online = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Duel smoke timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    const consume = (chunk) => {
      process.stdout.write(chunk);
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || "";
      if (lines.some(isDuelSmokeOnlineLine)) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on("data", consume);
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Duel launcher exited before online (code=${code} signal=${signal})`,
        ),
      );
    });
  });

  await online;
  return child;
}

async function runSmoke() {
  let passed = false;
  try {
    await execFileAsync("docker", ["info"]);
    assertNotInterrupted();
    if (fs.existsSync(liveDir) || fs.existsSync(runtimeDir)) {
      throw new Error("Duel smoke runtime path already exists");
    }
    if (
      await dockerObjectExists([
        "ps",
        "-a",
        "--filter",
        `name=^/${containerName}$`,
        "--format",
        "{{.Names}}",
      ])
    ) {
      throw new Error(`Duel smoke container already exists: ${containerName}`);
    }
    if (
      await dockerObjectExists([
        "volume",
        "ls",
        "-q",
        "--filter",
        `name=^${volumeName}$`,
      ])
    ) {
      throw new Error(`Duel smoke volume already exists: ${volumeName}`);
    }
    for (const [name, port] of Object.entries(ports)) {
      assertNotInterrupted();
      await assertPortAvailable(name, port);
    }

    assertNotInterrupted();
    await fsp.mkdir(liveDir, { recursive: true });
    await fsp.mkdir(runtimeDir, { recursive: true });

    if (!options["skip-install"]) {
      assertNotInterrupted();
      await runCommand(
        "frozen dependency and browser/assets install",
        "bun",
        ["install", "--frozen-lockfile"],
        {
          HYPERIA_REQUIRE_FULL_ASSETS: "true",
          HYPERIA_REQUIRE_BROWSER_SYSTEM_DEPS: "true",
        },
      );
    }
    if (!options["skip-build"]) {
      assertNotInterrupted();
      await runCommand("production monorepo build", "bun", ["run", "build"]);
    }

    assertNotInterrupted();
    launcher = await launchAndWait();
    if (withStreamRecovery) {
      assertNotInterrupted();
      const recoveryEvidenceDir =
        process.env.DUEL_STREAM_RECOVERY_EVIDENCE_DIR?.trim() ||
        path.join(runtimeDir, "stream-recovery-evidence");
      await runCommand(
        "same-session stream recovery fault injection",
        process.execPath,
        [
          "scripts/verify-duel-stream-recovery.mjs",
          "--betting-url",
          `http://127.0.0.1:${ports.hyperbetApp}`,
          "--hyperbet-api-url",
          `http://127.0.0.1:${ports.hyperbetApi}`,
          "--hyperia-url",
          `http://127.0.0.1:${ports.server}`,
          "--capture-port",
          String(ports.capture),
          "--status-file",
          rtmpStatusFile,
          "--evidence-dir",
          recoveryEvidenceDir,
          "--timeout-ms",
          String(Math.min(timeoutMs, 120_000)),
        ],
      );
    }
    passed = true;
  } finally {
    await cleanupOnce();
  }

  for (const [name, port] of Object.entries(ports)) {
    await assertPortAvailable(name, port);
  }
  if (
    await dockerObjectExists([
      "ps",
      "-a",
      "--filter",
      `name=^/${containerName}$`,
      "--format",
      "{{.Names}}",
    ])
  ) {
    throw new Error(`Duel smoke leaked container ${containerName}`);
  }
  if (
    await dockerObjectExists([
      "volume",
      "ls",
      "-q",
      "--filter",
      `name=^${volumeName}$`,
    ])
  ) {
    throw new Error(`Duel smoke leaked volume ${volumeName}`);
  }
  if (!passed) throw new Error("Duel smoke did not reach the online boundary");

  const hyperbetProof = withHyperbet
    ? withKeeper
      ? ", synchronized Hyperbet UI/backend, and a ready SOL keeper"
      : ", plus the synchronized read-only Hyperbet UI/backend"
    : "";
  const recoveryProof = withStreamRecovery
    ? ", including same-session renderer-loss recovery"
    : "";
  log(
    `PASS: clean launch reached a rendered combat duel${hyperbetProof}${recoveryProof} and removed every owned runtime resource`,
  );
}

try {
  await runSmoke();
} catch (error) {
  if (interruptedSignal) {
    log(`interrupted by ${interruptedSignal}`);
    process.exitCode = interruptedSignal === "SIGINT" ? 130 : 143;
  } else {
    console.error(
      `[duel-smoke] FAIL: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
