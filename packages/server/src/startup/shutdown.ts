/**
 * Shutdown Module - Graceful server cleanup
 *
 * Handles graceful shutdown of all server resources in the correct order
 * to prevent data loss and ensure clean termination.
 *
 * Shutdown sequence:
 * 1. Close HTTP server (stop accepting new connections)
 * 2. Shutdown embedded agents
 * 3. Force-save all player data (inventory, equipment, coins)
 * 4. Wait for pending database operations
 * 5. Destroy world and all systems
 * 6. Close database connections
 * 7. Stop Docker containers (if started)
 * 8. Clear startup flag (for hot reload)
 * 9. Exit process (unless hot reload)
 *
 * Handles signals:
 * - SIGINT (Ctrl+C) - User termination
 * - SIGTERM (Docker stop, systemd) - Graceful shutdown
 * - SIGUSR2 (Hot reload) - Dev mode restart
 * - uncaughtException - Crash handling
 * - unhandledRejection - Promise error handling
 *
 * Usage:
 * ```typescript
 * registerShutdownHandlers(fastify, world, dbContext);
 * ```
 */

import type { FastifyInstance } from "fastify";
import type { World } from "@hyperscape/shared";
import { DatabaseSystem } from "../systems/DatabaseSystem/index.js";
import type { DatabaseContext } from "./database.js";
import { closeDatabase } from "./database.js";
import { getAgentManager } from "../eliza/index.js";
import { stopAllModelAgents } from "../eliza/ModelAgentSpawner.js";
import { getStreamCapture } from "../streaming/stream-capture.js";
import { errMsg } from "../shared/errMsg.js";
import { ArenaService } from "../arena/ArenaService.js";
import { getStreamingDuelScheduler } from "../systems/StreamingDuelScheduler/index.js";
import { getDuelMarketMaker } from "../arena/DuelMarketMaker.js";

/**
 * Web3 context for chain writer shutdown
 */
interface Web3Context {
  shutdown: () => Promise<void>;
}

/**
 * Shutdown context for cleanup
 */
interface ShutdownContext {
  fastify: FastifyInstance;
  world: World;
  dbContext: DatabaseContext;
  web3Context: Web3Context | null;
}

const alertWebhookUrl = process.env.ALERT_WEBHOOK_URL;
const alertTimeoutMs = 2000;
let alertSent = false;
let lastFatalDetails: Record<string, string> | null = null;

async function sendAlert(
  message: string,
  details: Record<string, string>,
): Promise<void> {
  if (!alertWebhookUrl || alertSent) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), alertTimeoutMs);
  try {
    await fetch(alertWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: message,
        details,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("[Shutdown] Failed to send alert webhook:", errMsg(err));
  } finally {
    clearTimeout(timeout);
    alertSent = true;
  }
}

/**
 * Register all shutdown handlers
 *
 * Sets up signal handlers for SIGINT, SIGTERM, SIGUSR2 and error handlers
 * for uncaughtException and unhandledRejection.
 *
 * @param fastify - Fastify server instance
 * @param world - Game world instance
 * @param dbContext - Database context with connections and Docker manager
 * @param web3Context - Optional Web3 context for chain writer shutdown
 */
export function registerShutdownHandlers(
  fastify: FastifyInstance,
  world: World,
  dbContext: DatabaseContext,
  web3Context: Web3Context | null = null,
): void {
  console.log("[Shutdown] Registering shutdown handlers...");
  const dbWriteErrorsNonFatal = /^(1|true|yes|on)$/i.test(
    process.env.DB_WRITE_ERRORS_NON_FATAL || "",
  );

  const context: ShutdownContext = { fastify, world, dbContext, web3Context };

  // Track if we're shutting down (prevent duplicate shutdowns)
  let isShuttingDown = false;

  /**
   * Graceful shutdown handler
   *
   * Performs cleanup in the correct order to prevent data loss.
   * Handles hot reload (SIGUSR2) differently from termination signals.
   *
   * @param signal - Signal that triggered shutdown
   */
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log(`[Shutdown] Already shutting down, ignoring ${signal}`);
      return;
    }
    isShuttingDown = true;

    console.log(`[Shutdown] Received ${signal}, starting graceful shutdown...`);
    if (signal !== "SIGUSR2") {
      const details: Record<string, string> = {
        signal,
        nodeEnv: process.env.NODE_ENV || "development",
      };
      if (lastFatalDetails) {
        for (const [key, value] of Object.entries(lastFatalDetails)) {
          details[key] = value;
        }
      }
      await sendAlert("Hyperscape server shutting down", details);
    }

    // Step 1: Stop stream capture (headless browser + FFmpeg)
    try {
      const capture = getStreamCapture();
      if (capture.isRunning()) {
        console.log("[Shutdown] Stopping stream capture...");
        await capture.stop();
        console.log("[Shutdown] ✅ Stream capture stopped");
      }
    } catch {
      // Stream capture may not have been initialized
    }

    // Step 2: Close HTTP server
    await closeHttpServer(context);

    // Step 3: Shutdown embedded agents
    await shutdownAgents();

    // Step 2b: Shutdown Web3 chain writer (flush pending writes)
    await shutdownWeb3(context);

    // Step 2c: Shutdown StreamingDuelScheduler (stop duel cycle timers)
    try {
      const scheduler = getStreamingDuelScheduler();
      if (scheduler) {
        console.log("[Shutdown] Destroying StreamingDuelScheduler...");
        scheduler.destroy();
        console.log("[Shutdown] ✅ StreamingDuelScheduler destroyed");
      }
    } catch (err) {
      console.error(
        "[Shutdown] Failed to destroy StreamingDuelScheduler:",
        err,
      );
    }

    // Step 2d: Shutdown ArenaService (stop tick loop, clean up listeners)
    try {
      const arenaService = ArenaService.tryForWorld(context.world);
      if (arenaService) {
        console.log("[Shutdown] Destroying ArenaService...");
        arenaService.destroy();
        console.log("[Shutdown] ✅ ArenaService destroyed");
      }
    } catch (err) {
      console.error("[Shutdown] Error destroying ArenaService:", err);
    }

    // Step 2e: Shutdown DuelMarketMaker (clean up event listeners, clear markets)
    try {
      const marketMaker = getDuelMarketMaker();
      if (marketMaker) {
        console.log("[Shutdown] Destroying DuelMarketMaker...");
        marketMaker.destroy();
        console.log("[Shutdown] ✅ DuelMarketMaker destroyed");
      }
    } catch (err) {
      console.error("[Shutdown] Failed to destroy DuelMarketMaker:", err);
    }

    // Step 3: Force-save all player data (inventory, equipment, coins)
    // Must happen BEFORE waitForDatabaseOperations() which sets isDestroying=true,
    // and BEFORE world.destroy() which calls system.destroy() fire-and-forget.
    await forcePlayerDataSave(context);

    // Step 4: Wait for pending database operations
    await waitForDatabaseOperations(context);

    // Step 5: Destroy world and systems
    await destroyWorld(context);

    // Step 6: Close database connections
    await closeDatabaseConnections(context);

    // Step 7: Stop Docker containers
    await stopDocker(context);

    // Step 8: Clear startup flag
    clearStartupFlag();

    console.log("[Shutdown] ✅ Graceful shutdown complete");

    // For hot reload (SIGUSR2), don't exit process
    if (signal === "SIGUSR2") {
      isShuttingDown = false; // Reset so next reload can proceed
      return;
    }

    // For termination signals, exit after short delay
    setTimeout(() => {
      process.exit(0);
    }, 100);
  };

  // Register signal handlers
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // Hot reload signal

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    const errorMessage =
      error instanceof Error ? error.message : String(error ?? "");
    const errorStack = error instanceof Error ? (error.stack ?? "") : "";
    const isNonFatalDbTransportError =
      dbWriteErrorsNonFatal &&
      (errorMessage.includes("Connection terminated unexpectedly") ||
        errorMessage.includes("Connection terminated") ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("socket hang up"));
    const isNonFatalNodeNetTimeoutBug =
      dbWriteErrorsNonFatal &&
      (errorMessage.includes("null is not an object (evaluating 'context')") ||
        errorMessage.includes("Cannot read properties of null")) &&
      (errorStack.includes("internalConnectMultipleTimeout") ||
        errorStack.includes("node:net"));
    if (isNonFatalDbTransportError || isNonFatalNodeNetTimeoutBug) {
      console.warn(
        "[Shutdown] Non-fatal transport exception suppressed:",
        isNonFatalNodeNetTimeoutBug
          ? `${errorMessage} (internalConnectMultipleTimeout)`
          : errorMessage,
      );
      return;
    }
    console.error("[Shutdown] Uncaught exception:", error);
    lastFatalDetails = {
      error: errorMessage,
    };
    void gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    const reasonStr = reason instanceof Error ? reason.message : String(reason);

    // Non-fatal agent/plugin errors that should not crash the server
    const isNonFatalAgentError =
      reasonStr.includes("registration timed out") ||
      reasonStr.includes("initialization aborted") ||
      reasonStr.includes("shutdown in progress") ||
      reasonStr.includes("failed to register") ||
      reasonStr.includes("runtime initialization") ||
      reasonStr.includes("Database is shutting down");

    if (isShuttingDown) {
      if (isNonFatalAgentError) {
        console.log(
          "[Shutdown] Suppressing expected shutdown error:",
          reasonStr.substring(0, 100),
        );
        return;
      }
      console.error(
        "[Shutdown] Already shutting down, ignoring unhandledRejection",
      );
      return;
    }

    if (isNonFatalAgentError) {
      console.warn(
        "[Shutdown] Non-fatal agent/plugin error (server continues):",
        reasonStr.substring(0, 200),
      );
      return;
    }

    console.error(
      "[Shutdown] Unhandled rejection at:",
      promise,
      "reason:",
      reason,
    );
    lastFatalDetails = {
      reason: reasonStr,
    };
    void gracefulShutdown("unhandledRejection");
  });

  // Log that hot reload is supported
  if (process.env.NODE_ENV === "development") {
    console.log("[Shutdown] Hot reload supported (SIGUSR2)");
  }

  console.log("[Shutdown] ✅ Shutdown handlers registered");
}

/**
 * Shutdown embedded agents
 *
 * Gracefully stops all embedded agents and removes their player entities.
 *
 * @private
 */
async function shutdownAgents(): Promise<void> {
  try {
    console.log("[Shutdown] Shutting down embedded agents...");
    const agentManager = getAgentManager();
    if (agentManager) {
      await agentManager.shutdown();
      console.log("[Shutdown] ✅ Embedded agents shut down");
    } else {
      console.log("[Shutdown] No agent manager found, skipping agent shutdown");
    }
  } catch (err) {
    console.error("[Shutdown] Error shutting down agents:", err);
  }

  // Stop model agents (ElizaOS LLM agents managed by ModelAgentSpawner).
  // This clears behaviorIntervals, agentPlans, and stops all runtimes.
  try {
    console.log("[Shutdown] Stopping model agents...");
    await stopAllModelAgents();
    console.log("[Shutdown] ✅ Model agents stopped");
  } catch (err) {
    console.error("[Shutdown] Error stopping model agents:", err);
  }
}

/**
 * Shutdown Web3 chain writer
 *
 * Flushes any pending on-chain writes before shutdown.
 *
 * @param context - Shutdown context
 * @private
 */
async function shutdownWeb3(context: ShutdownContext): Promise<void> {
  if (!context.web3Context) {
    return;
  }

  try {
    console.log("[Shutdown] Shutting down Web3 chain writer...");
    await context.web3Context.shutdown();
    console.log("[Shutdown] ✅ Web3 chain writer shut down");
  } catch (err) {
    console.error("[Shutdown] Error shutting down Web3:", err);
  }
}

/**
 * Force-save all player data before shutdown
 *
 * Directly calls destroyAsync() on inventory, equipment, and coin pouch systems
 * and awaits their completion. This ensures all player data is persisted BEFORE
 * the database system marks itself as destroying (which rejects new operations).
 *
 * After this runs, the systems' data maps are cleared, so when world.destroy()
 * later calls their destroy() → destroyAsync() again, the saves are no-ops.
 *
 * @param context - Shutdown context
 * @private
 */
async function forcePlayerDataSave(context: ShutdownContext): Promise<void> {
  try {
    console.log("[Shutdown] Force-saving all player data...");

    const savePromises: Promise<void>[] = [];

    // Get each critical system and call destroyAsync() directly
    const inventorySystem = context.world.getSystem("inventory") as
      | { destroyAsync(): Promise<void> }
      | undefined;
    if (inventorySystem?.destroyAsync) {
      savePromises.push(
        inventorySystem.destroyAsync().catch((err) => {
          console.error("[Shutdown] Inventory save error:", err);
        }),
      );
    }

    const equipmentSystem = context.world.getSystem("equipment") as
      | { destroyAsync(): Promise<void> }
      | undefined;
    if (equipmentSystem?.destroyAsync) {
      savePromises.push(
        equipmentSystem.destroyAsync().catch((err) => {
          console.error("[Shutdown] Equipment save error:", err);
        }),
      );
    }

    const coinPouchSystem = context.world.getSystem("coin-pouch") as
      | { destroyAsync(): Promise<void> }
      | undefined;
    if (coinPouchSystem?.destroyAsync) {
      savePromises.push(
        coinPouchSystem.destroyAsync().catch((err) => {
          console.error("[Shutdown] Coin pouch save error:", err);
        }),
      );
    }

    await Promise.all(savePromises);
    console.log("[Shutdown] ✅ Player data saved");
  } catch (err) {
    console.error("[Shutdown] Error force-saving player data:", err);
  }
}

/**
 * Close HTTP server
 *
 * Stops accepting new connections and waits for existing requests to complete.
 *
 * @param context - Shutdown context
 * @private
 */
async function closeHttpServer(context: ShutdownContext): Promise<void> {
  try {
    console.log("[Shutdown] Closing HTTP server...");
    await context.fastify.close();
    console.log("[Shutdown] ✅ HTTP server closed");
  } catch (err) {
    console.error("[Shutdown] Error closing HTTP server:", err);
  }
}

/**
 * Wait for pending database operations
 *
 * Ensures all fire-and-forget database operations complete before shutdown.
 * Critical for preventing data loss.
 *
 * @param context - Shutdown context
 * @private
 */
async function waitForDatabaseOperations(
  context: ShutdownContext,
): Promise<void> {
  try {
    console.log("[Shutdown] Waiting for pending database operations...");
    const databaseSystem = context.world.getSystem("database") as
      | DatabaseSystem
      | undefined;

    if (databaseSystem) {
      await databaseSystem.waitForPendingOperations();
      console.log("[Shutdown] ✅ Database operations complete");
    }
  } catch (err) {
    console.error(
      "[Shutdown] Error waiting for pending database operations:",
      err,
    );
  }
}

/**
 * Destroy world and all systems
 *
 * Cleanly shuts down the ECS world and all registered systems.
 *
 * @param context - Shutdown context
 * @private
 */
async function destroyWorld(context: ShutdownContext): Promise<void> {
  try {
    console.log("[Shutdown] Destroying world...");
    context.world.destroy();
    console.log("[Shutdown] ✅ World destroyed");
  } catch (err) {
    console.error("[Shutdown] Error destroying world:", err);
  }
}

/**
 * Close database connections
 *
 * Closes PostgreSQL connection pool and clears singleton instances.
 *
 * @param context - Shutdown context
 * @private
 */
async function closeDatabaseConnections(
  _context: ShutdownContext,
): Promise<void> {
  try {
    console.log("[Shutdown] Closing database connections...");
    await closeDatabase();
    console.log("[Shutdown] ✅ Database connections closed");
  } catch (err) {
    console.error("[Shutdown] Error closing database:", err);
  }
}

/**
 * Stop Docker containers
 *
 * Stops PostgreSQL container if it was started by this server instance.
 *
 * @param context - Shutdown context
 * @private
 */
async function stopDocker(context: ShutdownContext): Promise<void> {
  try {
    if (context.dbContext.dockerManager) {
      console.log("[Shutdown] Stopping Docker PostgreSQL...");
      await context.dbContext.dockerManager.stopPostgres();
      console.log("[Shutdown] ✅ Docker stopped");
    }
  } catch (err) {
    console.error("[Shutdown] Error stopping Docker:", err);
  }
}

/**
 * Clear startup flag
 *
 * Clears the global startup flag to allow hot reload to proceed.
 *
 * @private
 */
function clearStartupFlag(): void {
  const globalWithFlag = globalThis as typeof globalThis & {
    __HYPERSCAPE_SERVER_STARTING__?: boolean;
  };
  globalWithFlag.__HYPERSCAPE_SERVER_STARTING__ = false;
}
