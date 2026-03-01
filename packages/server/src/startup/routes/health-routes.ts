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
import type { World } from "@hyperscape/shared";
import type { ServerConfig } from "../config.js";
import { DatabaseSystem } from "../../systems/DatabaseSystem/index.js";
import { isMaintenanceModeActive } from "../maintenance-mode.js";

type DatabaseHealthResult = {
  healthy: boolean;
  latencyMs: number;
  poolInfo?: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
  error?: string;
};

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
  const checkDatabaseInHealth = /^(1|true|yes|on)$/i.test(
    process.env.HEALTH_CHECK_DATABASE || "",
  );
  const strictDatabaseHealth = /^(1|true|yes|on)$/i.test(
    process.env.HEALTH_CHECK_STRICT_DB || "",
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

      // Keep /health lightweight for runtime probes by default.
      // Deep DB checks can be enabled via HEALTH_CHECK_DATABASE=true.
      if (!checkDatabaseInHealth) {
        return reply.code(200).send({
          status: "ok",
          ...baseHealth,
          database: {
            healthy: null,
            status: "skipped",
            latencyMs: 0,
          },
        });
      }

      const databaseSystem = world.getSystem("database") as
        | DatabaseSystem
        | undefined;
      const timeoutFallback: DatabaseHealthResult = {
        healthy: false,
        latencyMs: databaseHealthTimeoutMs,
        error: `Database health check timed out after ${databaseHealthTimeoutMs}ms`,
      };

      let databaseHealth: DatabaseHealthResult;
      if (!databaseSystem) {
        databaseHealth = {
          healthy: false,
          latencyMs: 0,
          error: "Database system not available",
        };
      } else {
        databaseHealth = await Promise.race<DatabaseHealthResult>([
          databaseSystem.checkHealthAsync(),
          new Promise<DatabaseHealthResult>((resolve) => {
            setTimeout(() => resolve(timeoutFallback), databaseHealthTimeoutMs);
          }),
        ]).catch((error) => {
          return {
            healthy: false,
            latencyMs: 0,
            error: error instanceof Error ? error.message : String(error),
          };
        });
      }

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
