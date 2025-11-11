/**
 * Player Routes Module - Player management endpoints
 *
 * Handles player-related HTTP endpoints including disconnect beacons
 * sent by clients during unload/beforeunload events.
 *
 * Endpoints:
 * - POST /api/player/disconnect - Disconnect player (beacon endpoint)
 *
 * Usage:
 * ```typescript
 * import { registerPlayerRoutes } from './routes/player-routes';
 * registerPlayerRoutes(fastify, world);
 * ```
 */

import type { FastifyInstance } from "fastify";
import type { World } from "@hyperscape/shared";

/**
 * Register player management endpoints
 *
 * Sets up endpoints for player lifecycle management.
 * Currently focused on disconnect handling via navigator.sendBeacon.
 *
 * @param fastify - Fastify server instance
 * @param world - Game world instance
 */
export function registerPlayerRoutes(
  fastify: FastifyInstance,
  world: World,
): void {
  // Minimal player disconnect endpoint for client beacons
  fastify.post("/api/player/disconnect", async (req, reply) => {
    const body = req.body as {
      playerId: string;
      sessionId?: string;
      reason?: string;
    };

    fastify.log.info({ body }, "[API] player/disconnect");

    const network =
      world.network as unknown as import("../../types.js").ServerNetworkWithSockets;
    const socket = network.sockets.get(body.playerId);

    if (socket) {
      socket.close?.();
    }

    return reply.send({ ok: true });
  });
}
