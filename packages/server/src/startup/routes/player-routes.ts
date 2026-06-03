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
import type { World } from "@hyperforge/shared";
import { timingSafeEqual } from "crypto";

/**
 * Timing-safe string comparison for session validation.
 */
function safeCompare(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    const buf = Buffer.alloc(b.length);
    timingSafeEqual(buf, Buffer.from(b, "utf8"));
    return false;
  }
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

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
  /**
   * POST /api/player/disconnect
   *
   * Disconnect a player from the game. Used by clients during page unload.
   *
   * SECURITY: Requires both playerId and sessionId to prevent unauthorized disconnects.
   * The sessionId must match the socket's sessionId to prove ownership.
   *
   * Body:
   *   - playerId: string - The player's ID
   *   - sessionId: string - The session ID (must match socket's session)
   *   - reason?: string - Optional disconnect reason
   */
  fastify.post("/api/player/disconnect", async (req, reply) => {
    try {
      const body = req.body as {
        playerId?: string;
        sessionId?: string;
        reason?: string;
      };

      fastify.log.info(
        { playerId: body.playerId, hasSessionId: !!body.sessionId },
        "[API] player/disconnect",
      );

      // Validate world and network exist
      if (!world?.network) {
        fastify.log.warn(
          "[API] player/disconnect - world.network not available",
        );
        return reply.send({ ok: true }); // Still return success to avoid client retries
      }

      const network =
        world.network as unknown as import("../../shared/types/index.js").ServerNetworkWithSockets;

      // Validate required fields
      if (!network?.sockets || !body?.playerId || !body?.sessionId) {
        fastify.log.warn(
          {
            hasSockets: !!network?.sockets,
            hasPlayerId: !!body?.playerId,
            hasSessionId: !!body?.sessionId,
          },
          "[API] player/disconnect - missing required fields",
        );
        return reply.send({ ok: true });
      }

      const socket =
        network.sockets.get(body.playerId) ||
        [...network.sockets.values()].find((candidate) => {
          const playerId = (candidate as { player?: { id?: string } }).player
            ?.id;
          return playerId === body.playerId;
        });

      if (socket) {
        // SECURITY: Validate sessionId matches socket's session
        // This prevents malicious actors from disconnecting other players
        const socketSessionId =
          (socket as { sessionId?: string }).sessionId || socket.id;
        if (!safeCompare(body.sessionId, socketSessionId)) {
          fastify.log.warn(
            { playerId: body.playerId },
            "[API] player/disconnect - session validation failed",
          );
          // Don't reveal whether player exists - just silently succeed
          return reply.send({ ok: true });
        }

        try {
          socket.close?.();
        } catch (error) {
          fastify.log.error(
            { error, playerId: body.playerId },
            "[API] player/disconnect - error closing socket",
          );
        }
      } else {
        fastify.log.debug(
          { playerId: body.playerId },
          "[API] player/disconnect - socket not found (may have already disconnected)",
        );
      }

      return reply.send({ ok: true });
    } catch (error) {
      fastify.log.error(
        { error, body: req.body },
        "[API] player/disconnect - unexpected error",
      );
      // Still return success to prevent client retries
      return reply.send({ ok: true });
    }
  });
}
