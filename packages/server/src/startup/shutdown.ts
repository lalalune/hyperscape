/**
 * Shutdown Module - Graceful server cleanup
 *
 * Handles graceful shutdown of all server resources in the correct order
 * to prevent data loss and ensure clean termination.
 *
 * Shutdown sequence:
 * 1. Close HTTP server (stop accepting new connections)
 * 2. Wait for pending database operations
 * 3. Destroy world and all systems
 * 4. Close database connections
 * 5. Stop Docker containers (if started)
 * 6. Clear startup flag (for hot reload)
 * 7. Exit process (unless hot reload)
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
import { DatabaseSystem } from "../DatabaseSystem.js";
import type { DatabaseContext } from "./database.js";
import { closeDatabase } from "./database.js";

/**
 * Shutdown context for cleanup
 */
interface ShutdownContext {
  fastify: FastifyInstance;
  world: World;
  dbContext: DatabaseContext;
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
 */
export function registerShutdownHandlers(
  fastify: FastifyInstance,
  world: World,
  dbContext: DatabaseContext,
): void {
  console.log("[Shutdown] Registering shutdown handlers...");

  const context: ShutdownContext = { fastify, world, dbContext };

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

    // Step 1: Close HTTP server
    await closeHttpServer(context);

    // Step 2: Wait for pending database operations
    await waitForDatabaseOperations(context);

    // Step 3: Destroy world and systems
    await destroyWorld(context);

    // Step 4: Close database connections
    await closeDatabaseConnections(context);

    // Step 5: Stop Docker containers
    await stopDocker(context);

    // Step 6: Clear startup flag
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
    console.error("[Shutdown] Uncaught exception:", error);
    gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error(
      "[Shutdown] Unhandled rejection at:",
      promise,
      "reason:",
      reason,
    );
    gracefulShutdown("unhandledRejection");
  });

  // Log that hot reload is supported
  if (process.env.NODE_ENV === "development") {
    console.log("[Shutdown] Hot reload supported (SIGUSR2)");
  }

  console.log("[Shutdown] ✅ Shutdown handlers registered");
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
  context: ShutdownContext,
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
