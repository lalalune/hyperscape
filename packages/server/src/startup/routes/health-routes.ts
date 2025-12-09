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
 * Usage:
 * ```typescript
 * import { registerHealthRoutes } from './routes/health-routes';
 * registerHealthRoutes(fastify, world, config);
 * ```
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { World } from "@hyperscape/shared";
import type { ServerConfig } from "../config.js";

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
  // Basic health check
  fastify.get(
    "/health",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const health = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };

      return reply.code(200).send(health);
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
