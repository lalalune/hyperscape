/**
 * Health Routes Module - Server health and status endpoints
 *
 * Provides endpoints for monitoring server health and retrieving current
 * server status including uptime and connected players.
 *
 * Endpoints:
 * - GET /health - Basic health check (uptime, timestamp)
 * - GET /status - Detailed status (world time, connected players, commit hash)
 *
 * ## Production Monitoring Setup
 *
 * These endpoints must be configured with external monitoring:
 * - **Railway**: Use Railway's built-in health checks pointing to /health
 * - **External**: Configure uptime monitoring (e.g., UptimeRobot, Pingdom) to poll /health
 * - **Alerting**: Set up alerts for non-200 responses or high response times
 *
 * **Important**: These endpoints only provide data - they do NOT send alerts.
 * You must configure external monitoring to poll these endpoints and trigger alerts.
 *
 * Usage:
 * ```typescript
 * import { registerHealthRoutes } from './routes/health-routes';
 * registerHealthRoutes(fastify, world, config);
 * ```
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { World } from "@hyperforge/shared";
import type { ServerConfig } from "../config.js";
import type { DatabaseSystem } from "../../systems/DatabaseSystem/index.js";
import { isMaintenanceModeActive } from "../maintenance-mode.js";

export type DatabaseHealthResult = {
  healthy: boolean;
  status: "healthy" | "unhealthy" | "unavailable" | "timeout";
  latencyMs: number;
  poolInfo?: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
  error?: string;
};

type DatabaseHealthSource = Pick<DatabaseSystem, "checkHealthAsync">;

export async function checkDatabaseHealth(
  databaseSystem: DatabaseHealthSource | undefined,
  timeoutMs: number,
): Promise<DatabaseHealthResult> {
  if (!databaseSystem) {
    return {
      healthy: false,
      status: "unavailable",
      latencyMs: 0,
      error: "Database system not available",
    };
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutResult = new Promise<DatabaseHealthResult>((resolve) => {
    timeout = setTimeout(
      () =>
        resolve({
          healthy: false,
          status: "timeout",
          latencyMs: timeoutMs,
          error: `Database health check timed out after ${timeoutMs}ms`,
        }),
      timeoutMs,
    );
    timeout.unref?.();
  });

  try {
    return await Promise.race([
      databaseSystem.checkHealthAsync().then((result) => ({
        ...result,
        status: result.healthy ? ("healthy" as const) : ("unhealthy" as const),
      })),
      timeoutResult,
    ]);
  } catch (error) {
    return {
      healthy: false,
      status: "unhealthy",
      latencyMs: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Register health and status endpoints
 *
 * Sets up monitoring endpoints that return server health metrics
 * and current game state information.
 *
 * @param fastify - Fastify server instance
 * @param world - Game world instance
 * @param config - Server configuration
 */
export function registerHealthRoutes(
  fastify: FastifyInstance,
  world: World,
  config: ServerConfig,
): void {
  const strictDatabaseHealth = !/^(0|false|no|off)$/i.test(
    process.env.HEALTH_CHECK_STRICT_DB || "true",
  );
  const databaseHealthTimeoutMs = Math.max(
    250,
    Number.parseInt(process.env.HEALTH_CHECK_DB_TIMEOUT_MS || "1500", 10) ||
      1500,
  );

  // Basic health check
  fastify.get(
    "/health",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const maintenanceMode = isMaintenanceModeActive();
      const baseHealth = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        maintenanceMode,
      };

      const databaseSystem = world.getSystem("database") as
        DatabaseSystem | undefined;
      const databaseHealth = await checkDatabaseHealth(
        databaseSystem,
        databaseHealthTimeoutMs,
      );

      const health = {
        status: databaseHealth.healthy ? "ok" : "degraded",
        ...baseHealth,
        database: databaseHealth,
      };

      const statusCode =
        strictDatabaseHealth && !databaseHealth.healthy ? 503 : 200;
      return reply.code(statusCode).send(health);
    },
  );

  // Detailed status with connected players
  fastify.get(
    "/status",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const status = {
        uptime: Math.round(world.time),
        protected: config.adminCode !== undefined,
        connectedUsers: [] as Array<{
          id: string;
          position: number[];
          name: string;
        }>,
        commitHash: config.commitHash,
      };

      // Import type from our local types
      const network =
        world.network as unknown as import("../../types.js").ServerNetworkWithSockets;

      for (const socket of network.sockets.values()) {
        if (socket.player?.node?.position) {
          const pos = socket.player.node.position;
          status.connectedUsers.push({
            id: socket.player.data.userId as string,
            position: [pos.x, pos.y, pos.z],
            name: socket.player.data.name as string,
          });
        }
      }

      return reply.code(200).send(status);
    },
  );
}
