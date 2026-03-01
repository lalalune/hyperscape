/**
 * Hyperscape Server - Startup orchestrator
 *
 * This module contains the actual server initialization logic.
 * It is loaded dynamically from `src/index.ts` after polyfills are installed.
 */

// Import startup modules
import { loadConfig } from "./startup/config.js";
import { initializeDatabase } from "./startup/database.js";
import { initializeWorld } from "./startup/world.js";
import { createHttpServer } from "./startup/http-server.js";
import { registerApiRoutes } from "./startup/api-routes.js";
import { registerWebSocket } from "./startup/websocket.js";
import { registerShutdownHandlers } from "./startup/shutdown.js";
import { errMsg } from "./shared/errMsg.js";

// Import embedded agent system
import { initializeAgents } from "./eliza/index.js";

// Import streaming duel scheduler
import { initStreamingDuelScheduler } from "./systems/StreamingDuelScheduler/index.js";

// Import stream capture pipeline
import { initStreamCapture } from "./streaming/stream-capture.js";

function resolveBooleanEnvFlag(name: string, defaultEnabled: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultEnabled;
  return raw !== "false";
}

/**
 * Starts the Hyperscape server
 *
 * This is the main entry point for server initialization. It orchestrates
 * all startup modules in the correct sequence to bring the server online.
 *
 * The server supports hot reload in development via SIGUSR2 signal.
 */
async function startServer() {
  // Prevent duplicate server initialization
  const globalWithFlag = globalThis as typeof globalThis & {
    __HYPERSCAPE_SERVER_STARTING__?: boolean;
  };

  if (globalWithFlag.__HYPERSCAPE_SERVER_STARTING__) {
    console.log(
      "[Server] Server already starting, skipping duplicate initialization",
    );
    return;
  }

  globalWithFlag.__HYPERSCAPE_SERVER_STARTING__ = true;

  console.log("=".repeat(60));
  console.log("🚀 Hyperscape Server Starting...");
  console.log("=".repeat(60));

  // Step 1: Load configuration
  console.log("[Server] Step 1/8: Loading configuration...");
  const config = await loadConfig();
  console.log(`[Server] ✅ Configuration loaded (port: ${config.port})`);

  const isDevelopment = config.nodeEnv !== "production";

  // Validate critical secrets in production
  if (!isDevelopment) {
    const missing: string[] = [];
    if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
    if (!process.env.ARENA_EXTERNAL_BET_WRITE_KEY?.trim())
      missing.push("ARENA_EXTERNAL_BET_WRITE_KEY");
    if (missing.length > 0) {
      console.error(
        `[Server] FATAL: Missing required production secrets: ${missing.join(", ")}`,
      );
      process.exit(1);
    }
    const warnings: string[] = [];
    if (!process.env.PRIVY_APP_ID && !process.env.PUBLIC_PRIVY_APP_ID)
      warnings.push("PRIVY_APP_ID");
    if (!process.env.PRIVY_APP_SECRET) warnings.push("PRIVY_APP_SECRET");
    if (!process.env.SOLANA_ARENA_AUTHORITY_SECRET)
      warnings.push("SOLANA_ARENA_AUTHORITY_SECRET");
    if (warnings.length > 0) {
      console.warn(
        `[Server] WARNING: Missing recommended production secrets: ${warnings.join(", ")}`,
      );
    }
  }
  const streamingDuelEnabled = resolveBooleanEnvFlag(
    "STREAMING_DUEL_ENABLED",
    !isDevelopment,
  );
  const streamCaptureEnabled = resolveBooleanEnvFlag(
    "STREAMING_CAPTURE_ENABLED",
    !isDevelopment,
  );
  process.env.STREAMING_DUEL_ENABLED = streamingDuelEnabled ? "true" : "false";
  process.env.STREAMING_CAPTURE_ENABLED = streamCaptureEnabled
    ? "true"
    : "false";
  console.log(
    `[Server] Feature flags: streamingDuel=${streamingDuelEnabled ? "enabled" : "disabled"} (env STREAMING_DUEL_ENABLED), streamCapture=${streamCaptureEnabled ? "enabled" : "disabled"} (env STREAMING_CAPTURE_ENABLED)`,
  );

  // Step 2: Initialize database
  console.log("[Server] Step 2/8: Initializing database...");
  const dbContext = await initializeDatabase(config);
  console.log("[Server] ✅ Database initialized");

  // Step 3: Initialize world
  console.log("[Server] Step 3/8: Initializing world...");
  const world = await initializeWorld(config, dbContext);
  console.log("[Server] ✅ World initialized");

  // Step 3b: Initialize Web3 (EVM chain writer) if enabled
  let web3Context: { shutdown: () => Promise<void> } | null = null;
  if (process.env.WEB3_ENABLED === "true") {
    console.log("[Server] Step 3b: Initializing Web3 chain writer...");
    try {
      const { initializeWeb3 } = await import("./startup/web3.js");
      web3Context = await initializeWeb3(world);
      console.log("[Server] ✅ Web3 chain writer initialized");
    } catch (err) {
      console.warn(
        "[Server] ⚠️ Web3 initialization failed, continuing without chain writer:",
        errMsg(err),
      );
      web3Context = null;
    }
  }

  // Step 4: Create HTTP server
  console.log("[Server] Step 4/8: Creating HTTP server...");
  const fastify = await createHttpServer(config);
  console.log("[Server] ✅ HTTP server created");

  // Step 5: Register API routes
  console.log("[Server] Step 5/8: Registering API routes...");
  registerApiRoutes(fastify, world, config);
  console.log("[Server] ✅ API routes registered");

  // Step 6: Register WebSocket
  console.log("[Server] Step 6/8: Registering WebSocket...");
  registerWebSocket(fastify, world);
  console.log("[Server] ✅ WebSocket registered");

  // Step 7: Start listening
  console.log("[Server] Step 7/8: Starting HTTP server...");
  await fastify.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`[Server] ✅ Server listening on http://0.0.0.0:${config.port}`);

  // Step 8: Initialize streaming duel scheduler (BEFORE agents so it can track their spawns)
  if (streamingDuelEnabled) {
    try {
      console.log(
        "[Server] Step 8/10: Initializing streaming duel scheduler...",
      );
      initStreamingDuelScheduler(world);
      console.log("[Server] ✅ Streaming duel scheduler initialized");
    } catch (err) {
      console.error(
        "[Server] ⚠️ Streaming duel scheduler failed to initialize, continuing degraded:",
        errMsg(err),
      );
    }
  } else {
    console.log(
      "[Server] Step 8/10: Skipping streaming duel scheduler (disabled)",
    );
  }

  // Step 9: Initialize duel market maker (Solana betting integration)
  if (process.env.DUEL_MARKET_MAKER_ENABLED === "true") {
    try {
      console.log("[Server] Step 9/10: Initializing duel market maker...");
      const { DuelMarketMaker, setDuelMarketMaker } =
        await import("./arena/DuelMarketMaker.js");
      const seedAmount = parseInt(
        process.env.MARKET_MAKER_SEED_GOLD || "10",
        10,
      );
      const marketMaker = new DuelMarketMaker(world, seedAmount);
      await marketMaker.init();
      setDuelMarketMaker(marketMaker);
      console.log("[Server] ✅ Duel market maker initialized");
    } catch (err) {
      console.error(
        "[Server] ⚠️ Duel market maker failed to initialize, continuing degraded:",
        errMsg(err),
      );
    }
  }

  // Step 10: Initialize embedded agents
  try {
    console.log("[Server] Step 10/10: Initializing embedded agents...");
    const agentManager = await initializeAgents(world, {
      autoStartAgents: process.env.AUTO_START_AGENTS !== "false",
    });
    console.log(
      `[Server] ✅ Embedded agents initialized (${agentManager.getAllAgents().length} agent(s))`,
    );
  } catch (err) {
    console.error(
      "[Server] ⚠️ Agent initialization failed, continuing without agents:",
      errMsg(err),
    );
  }

  // Step 11: Initialize stream capture pipeline (RTMPBridge → HLS)
  if (streamCaptureEnabled) {
    try {
      console.log("[Server] Step 11: Initializing stream capture pipeline...");
      const captureStarted = initStreamCapture();
      if (captureStarted) {
        console.log(
          "[Server] ✅ Stream capture pipeline ready (RTMPBridge WebSocket)",
        );
      } else {
        console.log("[Server] ⏭️  Stream capture disabled");
      }
    } catch (err) {
      console.error(
        "[Server] ⚠️ Stream capture failed to initialize, continuing without capture:",
        errMsg(err),
      );
    }
  } else {
    console.log("[Server] Step 11: Skipping stream capture (disabled)");
  }

  // Register shutdown handlers
  registerShutdownHandlers(fastify, world, dbContext, web3Context);

  // Start periodic memory monitoring to catch leaks early
  startMemoryMonitor(world);

  console.log("=".repeat(60));
  console.log("✅ Hyperscape Server Ready");
  console.log("=".repeat(60));
  console.log(`   Port:        ${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   World:       ${config.worldDir}`);
  console.log(`   Assets:      ${config.assetsDir}`);
  console.log(`   CDN:         ${config.cdnUrl}`);
  if (config.commitHash) {
    console.log(`   Commit:      ${config.commitHash}`);
  }
  console.log("=".repeat(60));
}

type CollectionMetric = {
  path: string;
  kind: "array" | "map" | "set" | "object" | "bytes";
  size: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function getCollectionMetric(
  value: unknown,
): Omit<CollectionMetric, "path"> | null {
  if (Array.isArray(value)) {
    return { kind: "array", size: value.length };
  }
  if (value instanceof Map) {
    return { kind: "map", size: value.size };
  }
  if (value instanceof Set) {
    return { kind: "set", size: value.size };
  }
  if (value instanceof ArrayBuffer) {
    return { kind: "bytes", size: value.byteLength };
  }
  if (ArrayBuffer.isView(value)) {
    return { kind: "bytes", size: value.byteLength };
  }
  if (isPlainObject(value)) {
    return { kind: "object", size: Object.keys(value).length };
  }
  return null;
}

function collectCollectionMetrics(
  prefix: string,
  value: unknown,
  out: CollectionMetric[],
): void {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const [key, fieldValue] of Object.entries(record)) {
    const fieldPath = `${prefix}.${key}`;
    const metric = getCollectionMetric(fieldValue);
    if (metric) {
      out.push({ path: fieldPath, ...metric });
      if (!isPlainObject(fieldValue)) {
        continue;
      }
    }
    if (!isPlainObject(fieldValue)) continue;
    for (const [nestedKey, nestedValue] of Object.entries(fieldValue)) {
      const nestedPath = `${fieldPath}.${nestedKey}`;
      const nestedMetric = getCollectionMetric(nestedValue);
      if (nestedMetric) {
        out.push({ path: nestedPath, ...nestedMetric });
      }
    }
  }
}

function getCollectionSize(value: unknown): number | null {
  if (value instanceof Map || value instanceof Set) {
    return value.size;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length;
  }
  return null;
}

function buildNetworkDebugSummary(world: unknown): string {
  const worldRecord = world as {
    systemsByName?: Map<string, unknown>;
    entities?: {
      items?: Map<string, unknown>;
      players?: Map<string, unknown>;
    };
  };

  const networkSystem =
    worldRecord.systemsByName instanceof Map
      ? worldRecord.systemsByName.get("network")
      : undefined;
  if (!networkSystem || typeof networkSystem !== "object") {
    return "";
  }

  const metrics: string[] = [];
  const pushMetric = (label: string, value: unknown): void => {
    const size = getCollectionSize(value);
    if (size !== null) {
      metrics.push(`${label}=${size}`);
    }
  };

  const networkRecord = networkSystem as {
    sockets?: unknown;
    processingRateLimiter?: unknown;
    socketManager?: {
      socketFirstSeenAt?: unknown;
      socketMissedPongs?: unknown;
      pingTimestamps?: unknown;
      socketRTT?: unknown;
      reconnectTimers?: unknown;
      disconnectedPlayers?: unknown;
      combatLogoutTimers?: unknown;
    };
  };

  pushMetric("network.sockets", networkRecord.sockets);
  pushMetric(
    "network.processingRateLimiter",
    networkRecord.processingRateLimiter,
  );

  const socketManager = networkRecord.socketManager;
  if (socketManager && typeof socketManager === "object") {
    pushMetric("socket.firstSeen", socketManager.socketFirstSeenAt);
    pushMetric("socket.missedPongs", socketManager.socketMissedPongs);
    pushMetric("socket.pingTimestamps", socketManager.pingTimestamps);
    pushMetric("socket.rtt", socketManager.socketRTT);
    pushMetric("socket.reconnectTimers", socketManager.reconnectTimers);
    pushMetric("socket.disconnectedPlayers", socketManager.disconnectedPlayers);
    pushMetric("socket.combatLogoutTimers", socketManager.combatLogoutTimers);
  }

  pushMetric("world.entities.items", worldRecord.entities?.items);
  pushMetric("world.entities.players", worldRecord.entities?.players);

  return metrics.join(" | ");
}

function buildCollectionSummary(world: unknown, limit = 12): string {
  const metrics: CollectionMetric[] = [];

  collectCollectionMetrics("world", world, metrics);
  const worldRecord = world as {
    __busListenerMap?: Map<string, Map<unknown, unknown>>;
    systemsByName?: Map<string, unknown>;
    pgPool?: { totalCount?: number; idleCount?: number; waitingCount?: number };
  };
  const busListenerMap = worldRecord.__busListenerMap;
  if (busListenerMap instanceof Map) {
    let totalBusListeners = 0;
    for (const listenersForEvent of busListenerMap.values()) {
      if (listenersForEvent instanceof Map) {
        totalBusListeners += listenersForEvent.size;
      }
    }
    metrics.push({
      path: "world.__busListenerMap.totalListeners",
      kind: "map",
      size: totalBusListeners,
    });
  }
  const systemsByName = worldRecord.systemsByName;
  if (systemsByName instanceof Map) {
    for (const [systemName, systemValue] of systemsByName) {
      collectCollectionMetrics(
        `system:${String(systemName)}`,
        systemValue,
        metrics,
      );
    }
  }
  const pgPool = worldRecord.pgPool;
  if (pgPool && typeof pgPool === "object") {
    const totalCount =
      typeof pgPool.totalCount === "number" ? pgPool.totalCount : 0;
    const idleCount =
      typeof pgPool.idleCount === "number" ? pgPool.idleCount : 0;
    const waitingCount =
      typeof pgPool.waitingCount === "number" ? pgPool.waitingCount : 0;
    metrics.push({
      path: "world.pgPool.totalCount",
      kind: "object",
      size: totalCount,
    });
    metrics.push({
      path: "world.pgPool.idleCount",
      kind: "object",
      size: idleCount,
    });
    metrics.push({
      path: "world.pgPool.waitingCount",
      kind: "object",
      size: waitingCount,
    });
  }

  const filtered = metrics
    .filter((item) => item.size > 0)
    .sort((left, right) => right.size - left.size)
    .slice(0, limit);
  if (filtered.length === 0) return "";
  return filtered
    .map((item) => `${item.path}(${item.kind})=${item.size}`)
    .join(" | ");
}

function startMemoryMonitor(world: unknown): void {
  const isPlaywrightTest = process.env.PLAYWRIGHT_TEST === "true";
  const INTERVAL_MS = isPlaywrightTest ? 5_000 : 30_000;
  const MB = 1024 * 1024;
  const forceGcInPlaywright =
    isPlaywrightTest &&
    (process.env.PLAYWRIGHT_FORCE_GC || "true").toLowerCase() !== "false";
  const collectionDebugEnabled = process.env.MEMORY_COLLECTION_DEBUG === "true";
  const collectionLimit = Math.max(
    8,
    parseInt(process.env.MEMORY_COLLECTION_LIMIT || "12", 10) || 12,
  );

  // Production GC hint: periodically nudge the runtime to collect garbage.
  // Runs every 60s regardless of the memory monitor interval.
  const GC_HINT_INTERVAL_MS = 60_000;
  let lastGcHintAt = 0;
  // Track whether we already warned at the soft threshold to avoid log spam
  let softWarningLogged = false;

  const bunGcHint = (): void => {
    try {
      (
        globalThis as typeof globalThis & {
          Bun?: { gc?: (force?: boolean) => void };
        }
      ).Bun?.gc?.(true);
    } catch {
      // Best-effort GC hint only.
    }
  };

  const timer = setInterval(() => {
    const now = Date.now();

    // GC hint: in Playwright tests, every interval; in production, every 60s
    if (forceGcInPlaywright) {
      bunGcHint();
    } else if (now - lastGcHintAt >= GC_HINT_INTERVAL_MS) {
      bunGcHint();
      lastGcHintAt = now;
    }

    const mem = process.memoryUsage();
    const rssMB = (mem.rss / MB).toFixed(1);
    const heapUsedMB = (mem.heapUsed / MB).toFixed(1);
    const heapTotalMB = (mem.heapTotal / MB).toFixed(1);
    const externalMB = (mem.external / MB).toFixed(1);
    // Use stderr so output is visible even when stdout is piped through duel-stack
    process.stderr.write(
      `[Memory] RSS=${rssMB}MB  HeapUsed=${heapUsedMB}MB  HeapTotal=${heapTotalMB}MB  External=${externalMB}MB\n`,
    );
    if (collectionDebugEnabled) {
      const summary = buildCollectionSummary(world, collectionLimit);
      if (summary) {
        process.stderr.write(`[MemoryCollections] ${summary}\n`);
      }
      const networkSummary = buildNetworkDebugSummary(world);
      if (networkSummary) {
        process.stderr.write(`[MemoryNetwork] ${networkSummary}\n`);
      }
    }
    const memLimitGB = Number(process.env.MEMORY_LIMIT_GB) || 12;

    // Soft warning at 80% of limit — trigger GC and log a warning
    const softLimitBytes = memLimitGB * 1024 * MB * 0.8;
    if (!isPlaywrightTest && mem.rss > softLimitBytes) {
      if (!softWarningLogged) {
        process.stderr.write(
          `[Memory] ⚠️ RSS ${rssMB}MB > 80% of ${memLimitGB}GB limit, triggering GC\n`,
        );
        softWarningLogged = true;
      }
      bunGcHint();
    } else {
      softWarningLogged = false;
    }

    // Hard limit: restart process
    if (!isPlaywrightTest && mem.rss > memLimitGB * 1024 * MB) {
      process.stderr.write(
        `[Memory] RSS ${rssMB}MB > ${memLimitGB}GB, restarting\n`,
      );
      process.exit(1);
    }
  }, INTERVAL_MS);

  timer.unref?.();
}

// Start the server with error handling
startServer().catch((err) => {
  console.error("=".repeat(60));
  console.error("❌ FATAL ERROR DURING STARTUP");
  console.error("=".repeat(60));
  console.error(err);
  console.error("=".repeat(60));

  // Clear the flag so hot reload can retry
  const globalWithFlag = globalThis as typeof globalThis & {
    __HYPERSCAPE_SERVER_STARTING__?: boolean;
  };
  globalWithFlag.__HYPERSCAPE_SERVER_STARTING__ = false;

  process.exit(1);
});
