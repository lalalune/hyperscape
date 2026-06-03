#!/usr/bin/env node
/**
 * Simple Server Dev Script
 *
 * Just watches and rebuilds the server - no child process management.
 * Turbo handles orchestration, this script just focuses on the server.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "../");

process.chdir(rootDir);

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
};

// Build configuration
const buildScript = `
import * as esbuild from 'esbuild'

const excludeTestsPlugin = {
  name: 'exclude-tests',
  setup(build) {
    build.onResolve({ filter: /.*/ }, args => {
      if (args.path.includes('__tests__') || 
          args.path.includes('/tests/') ||
          args.path.includes('.test.') ||
          args.path.includes('.spec.')) {
        return { path: args.path, external: true }
      }
    })
  }
}

await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'build/index.js',
  platform: 'node',
  format: 'esm',
  bundle: true,
  treeShaking: true,
  minify: false,
  sourcemap: true,
  packages: 'external',
  external: ['vitest'],
  target: 'node22',
  define: {
    'process.env.CLIENT': 'false',
    'process.env.SERVER': 'true',
  },
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
  plugins: [excludeTestsPlugin],
  logLevel: 'error',
})

// Build agent behavior worker as separate file (loaded by worker_threads)
await esbuild.build({
  entryPoints: ['src/eliza/worker/agentBehaviorWorker.ts'],
  outfile: 'build/agentBehaviorWorker.js',
  platform: 'node',
  format: 'esm',
  bundle: true,
  treeShaking: true,
  minify: false,
  sourcemap: true,
  packages: 'external',
  external: ['vitest'],
  target: 'node22',
  define: {
    'process.env.CLIENT': 'false',
    'process.env.SERVER': 'true',
  },
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
  plugins: [excludeTestsPlugin],
  logLevel: 'error',
})

console.log('✅ Server build complete')
`;

// Initial build
console.log(`${colors.blue}Building server...${colors.reset}`);
await new Promise((resolve, reject) => {
  const proc = spawn("bun", ["-e", buildScript], {
    stdio: "inherit",
    cwd: rootDir,
  });
  proc.on("exit", (code) =>
    code === 0
      ? resolve()
      : reject(new Error(`Build failed with code ${code}`)),
  );
  proc.on("error", reject);
});

// Track server process
let serverProcess = null;
let isRestarting = false;
let shuttingDown = false;
let stoppingServer = false;
let lastRestartAt = 0;
const MIN_RESTART_INTERVAL_MS = 1200;
const STARTUP_DEPENDENCY_WAIT_MS = 15000;
const STARTUP_DEPENDENCY_POLL_MS = 250;
const MAX_AUTO_RESTARTS = 3;
const fileMtimes = new Map();
let queuedRebuildPath = null;
let warnedCdnFallback = false;
let autoRestartCount = 0;
let runtimeDepsChecked = false;
let cachedPublicCdnUrl = null;
let autoRestartTimer = null;

const runtimeDeps = [
  {
    name: "@hyperforge/decimation",
    entry: path.join(rootDir, "../decimation/dist/index.js"),
    cwd: path.join(rootDir, "../decimation"),
  },
  {
    name: "@hyperforge/impostor",
    entry: path.join(rootDir, "../impostors/dist/index.js"),
    cwd: path.join(rootDir, "../impostors"),
  },
  {
    name: "@hyperforge/procgen",
    entry: path.join(rootDir, "../procgen/dist/index.js"),
    cwd: path.join(rootDir, "../procgen"),
  },
];

const hasProcessExited = (proc) =>
  proc.exitCode !== null || proc.signalCode !== null;

async function stopServer(signal = "SIGTERM") {
  if (!serverProcess) {
    stoppingServer = false;
    return;
  }

  const proc = serverProcess;
  if (hasProcessExited(proc)) {
    if (serverProcess === proc) {
      serverProcess = null;
    }
    return;
  }

  await new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      stoppingServer = false;
      resolve();
    };

    const timeout = setTimeout(() => {
      if (!hasProcessExited(proc)) {
        try {
          proc.kill("SIGKILL");
        } catch {}
      }
      done();
    }, 5000);

    proc.once("exit", () => {
      clearTimeout(timeout);
      done();
    });

    stoppingServer = true;
    try {
      proc.kill(signal);
    } catch {
      clearTimeout(timeout);
      done();
    }
  });

  if (serverProcess === proc) {
    serverProcess = null;
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function hasMeaningfulFileChange(filePath) {
  try {
    const stat = await fs.stat(filePath);
    const nextMtime = stat.mtimeMs;
    const prevMtime = fileMtimes.get(filePath);
    fileMtimes.set(filePath, nextMtime);
    return prevMtime === undefined || nextMtime > prevMtime + 1;
  } catch {
    // If stat fails (deleted/renamed), allow rebuild to be safe.
    return true;
  }
}

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

async function waitForFile(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fileExists(filePath)) return true;
    await wait(STARTUP_DEPENDENCY_POLL_MS);
  }
  return fileExists(filePath);
}

async function buildRuntimeDependency(dep) {
  console.log(
    `${colors.yellow}⚠ Missing runtime artifact for ${dep.name}; building ${path.relative(rootDir, dep.cwd)}...${colors.reset}`,
  );
  await new Promise((resolve, reject) => {
    const proc = spawn("bun", ["run", "build"], {
      stdio: "inherit",
      cwd: dep.cwd,
      env: process.env,
    });
    proc.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Build failed for ${dep.name} (${code})`)),
    );
    proc.on("error", reject);
  });
}

async function ensureRuntimeDeps() {
  for (const dep of runtimeDeps) {
    if (await fileExists(dep.entry)) continue;

    // During startup, a dependency build may briefly remove dist/ before recreating it.
    // Wait first to avoid racing another active build.
    const appeared = await waitForFile(dep.entry, STARTUP_DEPENDENCY_WAIT_MS);
    if (appeared) continue;

    await buildRuntimeDependency(dep);

    if (!(await fileExists(dep.entry))) {
      throw new Error(`Missing runtime artifact after build: ${dep.entry}`);
    }
  }
}

function scheduleAutoRestart(reason) {
  if (shuttingDown || isRestarting || stoppingServer) return;
  if (autoRestartTimer) return;
  if (autoRestartCount >= MAX_AUTO_RESTARTS) {
    console.error(
      `${colors.red}Auto-restart limit reached (${MAX_AUTO_RESTARTS}). Please fix the crash and save a file to rebuild.${colors.reset}`,
    );
    return;
  }

  const delay = Math.min(1000 * Math.pow(2, autoRestartCount), 8000);
  autoRestartCount += 1;
  console.log(
    `${colors.yellow}↻ Scheduling server auto-restart in ${delay}ms (${reason}, attempt ${autoRestartCount}/${MAX_AUTO_RESTARTS})${colors.reset}`,
  );

  autoRestartTimer = setTimeout(async () => {
    autoRestartTimer = null;
    if (shuttingDown || serverProcess) return;
    try {
      await startServer();
      lastRestartAt = Date.now();
      console.log(`${colors.green}✓ Auto-restart succeeded${colors.reset}`);
    } catch (err) {
      console.error(
        `${colors.red}Auto-restart failed:${colors.reset}`,
        err instanceof Error ? err.message : String(err),
      );
      scheduleAutoRestart("retry-after-failed-auto-restart");
    }
  }, delay);
}

// Start server
function isLocalhost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  );
}

async function resolvePublicCdnUrl(localAssetsUrl) {
  const requested = process.env.PUBLIC_CDN_URL || "http://localhost:8080";

  try {
    const parsed = new URL(requested);
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    const isStandaloneLocalCdn =
      isLocalhost(parsed.hostname) && port === "8080";

    if (!isStandaloneLocalCdn) {
      return requested;
    }

    const healthRes = await fetch(`${parsed.protocol}//${parsed.host}/health`);
    if (healthRes.ok) {
      return requested;
    }
  } catch {
    // Invalid URL or failed health check - fall through to fallback.
  }

  if (!warnedCdnFallback) {
    console.log(
      `${colors.yellow}⚠ PUBLIC_CDN_URL=${requested || "(empty)"} is unreachable. Falling back to ${localAssetsUrl}.${colors.reset}`,
    );
    warnedCdnFallback = true;
  }

  return localAssetsUrl;
}

async function startServer() {
  if (serverProcess && !hasProcessExited(serverProcess)) {
    console.log(
      `${colors.dim}Server already running (PID ${serverProcess.pid})${colors.reset}`,
    );
    return;
  }
  serverProcess = null;

  const localPort = process.env.PORT || "5555";
  const localApiUrl = `http://localhost:${localPort}`;
  // uWS game WebSocket runs on UWS_PORT (default 5556), not the HTTP port
  const uwsPort = process.env.UWS_PORT || "5556";
  const localWsUrl = process.env.UWS_ENABLED === "false"
    ? `ws://localhost:${localPort}/ws`
    : `ws://localhost:${uwsPort}/ws`;
  const localAssetsUrl = `${localApiUrl}/game-assets`;

  if (!cachedPublicCdnUrl) {
    cachedPublicCdnUrl = await resolvePublicCdnUrl(localAssetsUrl);
  }
  if (!runtimeDepsChecked) {
    await ensureRuntimeDeps();
    runtimeDepsChecked = true;
  }

  const childEnv = {
    ...process.env,
    NODE_ENV: "development",
    PORT: localPort,
    PUBLIC_API_URL: process.env.PUBLIC_API_URL || localApiUrl,
    PUBLIC_WS_URL: process.env.PUBLIC_WS_URL || localWsUrl,
    PUBLIC_CDN_URL: cachedPublicCdnUrl,
  };

  console.log(`${colors.green}Starting server...${colors.reset}`);
  // Use Node.js instead of Bun for the server runtime.
  // Bun's JSC has stop-the-world old-generation GC that causes 500-1200ms pauses,
  // which destroys the 600ms game tick. V8 (Node.js) has incremental/concurrent GC
  // that keeps pauses <10ms. Polyfills are bundled via import in index.ts.
  const proc = spawn(
    "node",
    ["--max-old-space-size=2048", "--import", "./scripts/register-hooks.mjs", "build/index.js"],
    {
      stdio: "inherit",
      cwd: rootDir,
      env: childEnv,
    },
  );
  serverProcess = proc;

  proc.on("exit", (code, signal) => {
    console.log(
      `${colors.yellow}Server exited (code: ${code}, signal: ${signal})${colors.reset}`,
    );
    if (serverProcess === proc) {
      serverProcess = null;
    }

    const intentionalShutdown =
      shuttingDown ||
      isRestarting ||
      stoppingServer ||
      signal === "SIGTERM" ||
      signal === "SIGINT";

    // Don't auto-restart on intentional shutdown
    if (!intentionalShutdown && code !== 0) {
      console.log(`${colors.red}Server crashed.${colors.reset}`);
      scheduleAutoRestart(
        `exit=${code ?? "unknown"} signal=${signal ?? "none"}`,
      );
      return;
    }

    autoRestartCount = 0;
  });

  proc.on("error", (err) => {
    console.error(`${colors.red}Server error:${colors.reset}`, err);
  });
}

// Start initial server
await startServer();

// Setup file watcher
console.log(`${colors.blue}Setting up file watcher...${colors.reset}`);

const { default: chokidar } = await import("chokidar");

// Only watch compiled shared output — not shared/src. Watching source caused a
// restart on every save there *and* again when build/ updated (double restarts),
// leaving :5555 down during esbuild + Node boot (Vite then spams ECONNREFUSED on /env.js).
const watchRoots = [
  path.join(rootDir, "src"),
  path.join(rootDir, "../shared/build"),
];

const watchedExtensionRegex = /\.(ts|tsx|js|mjs|sql)$/;
const pollFallbackMtimes = new Map();
let pollFallbackInterval = null;

const isIgnoredPath = (filePath, stats) => {
  const normalized = filePath.replace(/\\/g, "/");

  if (normalized.includes("/node_modules/")) return true;
  if (normalized.includes("/packages/server/build/")) return true;
  if (normalized.includes("/packages/server/dist/")) return true;
  if (/\.d\.ts$/.test(normalized)) return true;
  if (/\.test\./.test(normalized) || /\.spec\./.test(normalized)) return true;

  if (stats?.isDirectory?.()) return false;
  return !watchedExtensionRegex.test(normalized);
};

async function collectWatchFiles(dirPath, out) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (isIgnoredPath(fullPath, entry)) continue;

    if (entry.isDirectory()) {
      await collectWatchFiles(fullPath, out);
    } else {
      out.push(fullPath);
    }
  }
}

async function listWatchFiles() {
  const files = [];
  for (const root of watchRoots) {
    await collectWatchFiles(root, files);
  }
  return files;
}

async function seedPollFallback() {
  const files = await listWatchFiles();
  pollFallbackMtimes.clear();
  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      pollFallbackMtimes.set(file, stat.mtimeMs);
    } catch {}
  }
  return files.length;
}

async function scanPollFallbackForChange() {
  const files = await listWatchFiles();
  const seen = new Set(files);
  let changedPath = null;

  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      const nextMtime = stat.mtimeMs;
      const prevMtime = pollFallbackMtimes.get(file);
      if (prevMtime === undefined || nextMtime > prevMtime + 1) {
        pollFallbackMtimes.set(file, nextMtime);
        changedPath ||= file;
      }
    } catch {}
  }

  for (const file of pollFallbackMtimes.keys()) {
    if (!seen.has(file)) {
      pollFallbackMtimes.delete(file);
      changedPath ||= file;
    }
  }

  return { changedPath, fileCount: files.length };
}

async function startPollingFallback() {
  if (pollFallbackInterval) return;
  const fileCount = await seedPollFallback();
  console.log(
    `${colors.yellow}↻ Falling back to polling watcher (${fileCount} files).${colors.reset}`,
  );

  pollFallbackInterval = setInterval(() => {
    if (isRestarting || shuttingDown) return;
    void scanPollFallbackForChange().then(({ changedPath }) => {
      if (changedPath) {
        void rebuild(changedPath);
      }
    });
  }, 5000);
}

const forcePolling = process.env.SERVER_DEV_USE_POLLING === "true";

const watcher = chokidar.watch(watchRoots, {
  ignored: isIgnoredPath,
  usePolling: forcePolling,
  interval: forcePolling ? 250 : undefined,
  binaryInterval: forcePolling ? 500 : undefined,
  ignoreInitial: true,
});

let rebuildTimeout = null;

const processRebuildQueue = async () => {
  if (isRestarting || !queuedRebuildPath) return;

  const filePath = queuedRebuildPath;
  queuedRebuildPath = null;

  clearTimeout(rebuildTimeout);
  rebuildTimeout = setTimeout(async () => {
    isRestarting = true;

    const normalized = filePath.replace(/\\/g, "/");
    const shortPath = normalized.startsWith(rootDir.replace(/\\/g, "/"))
      ? path.relative(rootDir, filePath)
      : path.relative(path.join(rootDir, "..", ".."), filePath);
    console.log(
      `\n${colors.yellow}⚡ Change detected: ${shortPath}${colors.reset}`,
    );
    console.log(`${colors.blue}Rebuilding server...${colors.reset}`);

    try {
      // Rebuild
      await new Promise((resolve, reject) => {
        const proc = spawn("bun", ["-e", buildScript], {
          stdio: "inherit",
          cwd: rootDir,
        });
        proc.on("exit", (code) =>
          code === 0 ? resolve() : reject(new Error(`Build failed`)),
        );
        proc.on("error", reject);
      });

      console.log(`${colors.green}✓ Rebuild complete${colors.reset}`);
      console.log(`${colors.blue}Restarting server...${colors.reset}`);

      const elapsedSinceRestart = Date.now() - lastRestartAt;
      if (elapsedSinceRestart < MIN_RESTART_INTERVAL_MS) {
        await wait(MIN_RESTART_INTERVAL_MS - elapsedSinceRestart);
      }

      // Kill old server and wait for graceful shutdown to complete
      await stopServer("SIGTERM");

      // Start new server
      await startServer();
      lastRestartAt = Date.now();
      console.log(`${colors.green}✓ Server restarted${colors.reset}\n`);
    } catch (err) {
      console.error(`${colors.red}Rebuild failed:${colors.reset}`, err.message);
    } finally {
      await wait(1200);
      isRestarting = false;
      if (queuedRebuildPath && !shuttingDown) {
        void processRebuildQueue();
      }
    }
  }, 200);
};

const rebuild = async (filePath) => {
  queuedRebuildPath = filePath;
  if (!isRestarting) {
    await processRebuildQueue();
  }
};

const onWatchEvent = (filePath) => {
  if (isRestarting || shuttingDown) {
    queuedRebuildPath = filePath;
    return;
  }

  void hasMeaningfulFileChange(filePath).then((changed) => {
    if (!changed) return;
    void rebuild(filePath);
  });
};

watcher.on("change", onWatchEvent);
watcher.on("add", onWatchEvent);
watcher.on("ready", async () => {
  const watched = watcher.getWatched();
  const dirCount = Object.keys(watched).length;
  const discoveredFileCount = (await listWatchFiles()).length;

  if (discoveredFileCount === 0) {
    console.log(
      `${colors.yellow}⚠ File watcher initialized but found 0 files. Watch roots:${colors.reset}`,
    );
    for (const p of watchRoots) {
      console.log(`${colors.dim}  - ${p}${colors.reset}`);
    }
    void startPollingFallback();
  }

  console.log(
    `${colors.green}✓ Watching ${discoveredFileCount} files across ${dirCount} directories${colors.reset}`,
  );
});

// Cleanup on exit
const cleanup = async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${colors.yellow}Shutting down...${colors.reset}`);
  clearTimeout(rebuildTimeout);
  if (autoRestartTimer) {
    clearTimeout(autoRestartTimer);
    autoRestartTimer = null;
  }
  if (pollFallbackInterval) {
    clearInterval(pollFallbackInterval);
    pollFallbackInterval = null;
  }
  await watcher.close();
  await stopServer("SIGTERM");
};

const shutdownAndExit = async (code = 0) => {
  try {
    await cleanup();
  } finally {
    process.exit(code);
  }
};

process.on("SIGINT", () => {
  void shutdownAndExit(0);
});
process.on("SIGTERM", () => {
  void shutdownAndExit(0);
});
process.on("SIGHUP", () => {
  void shutdownAndExit(0);
});
process.on("disconnect", () => {
  void shutdownAndExit(0);
});

process.on("uncaughtException", (err) => {
  console.error(`${colors.red}Uncaught exception:${colors.reset}`, err);
  void shutdownAndExit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(`${colors.red}Unhandled rejection:${colors.reset}`, reason);
  void shutdownAndExit(1);
});

process.on("exit", () => {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill("SIGTERM");
    } catch {}
  }
});

// Keep alive
await new Promise(() => {});
