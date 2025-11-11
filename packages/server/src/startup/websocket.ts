/**
 * WebSocket Module - Real-time multiplayer connection handling
 *
 * Registers the WebSocket endpoint and handles incoming connections.
 * Delegates connection management to ServerNetwork system.
 *
 * Responsibilities:
 * - Register /ws WebSocket endpoint
 * - Validate WebSocket connections
 * - Pass connections to ServerNetwork for authentication and handling
 * - Handle connection errors gracefully
 *
 * Usage:
 * ```typescript
 * registerWebSocket(fastify, world);
 * ```
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { World } from "@hyperscape/shared";
import type { NodeWebSocket } from "../types.js";

// JSON value type for proper typing
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

/**
 * Register WebSocket endpoint
 *
 * Sets up the /ws WebSocket endpoint for real-time multiplayer.
 * Connections are validated and passed to ServerNetwork for handling.
 *
 * @param fastify - Fastify server instance
 * @param world - Game world instance with ServerNetwork
 */
export function registerWebSocket(
  fastify: FastifyInstance,
  world: World,
): void {
  console.log("[WebSocket] Registering /ws endpoint...");

  // In @fastify/websocket v11+, the first parameter IS the WebSocket directly
  fastify.get("/ws", { websocket: true }, (socket, req: FastifyRequest) => {
    const ws = socket as unknown as NodeWebSocket;

    fastify.log.info("[WebSocket] Connection established");

    // Basic null check only - let ServerNetwork handle the rest
    if (!ws || typeof ws.send !== "function") {
      fastify.log.error("[WebSocket] Invalid WebSocket object received");
      return;
    }

    // Handle network connection
    const query = req.query as Record<string, JSONValue>;
    world.network.onConnection!(ws, query);
  });

  console.log("[WebSocket] ✅ WebSocket endpoint registered");
}
