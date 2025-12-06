/**
 * Broadcast Module - Network message broadcasting
 *
 * Handles sending messages to clients via WebSocket connections.
 * Provides methods for broadcasting to all clients, specific clients,
 * or clients by player ID.
 *
 * Responsibilities:
 * - Broadcast to all connected clients (with optional exclusion)
 * - Send to specific socket by socket ID
 * - Send to specific player by player ID
 * - Packet serialization and delivery
 *
 * Usage:
 * ```typescript
 * const broadcast = new BroadcastManager(sockets);
 * broadcast.sendToAll('chat', { message: 'Hello' }, excludeSocketId);
 * broadcast.sendToSocket(socketId, 'update', data);
 * broadcast.sendToPlayer(playerId, 'inventory', items);
 * ```
 */

import type { ServerSocket } from "../../shared/types";
import { writePacket } from "@hyperscape/shared";

/**
 * BroadcastManager - Manages network message broadcasting
 *
 * Provides centralized broadcasting logic that can be shared across
 * ServerNetwork components.
 */
export class BroadcastManager {
  /**
   * Create a BroadcastManager
   *
   * @param sockets - Map of active socket connections (passed by reference)
   */
  constructor(private sockets: Map<string, ServerSocket>) {}

  /**
   * Broadcast message to all connected clients
   *
   * Sends a message to all active sockets except the one specified
   * by ignoreSocketId (useful for echoing player actions to others).
   *
   * @param name - Message type/name
   * @param data - Message payload
   * @param ignoreSocketId - Optional socket ID to exclude from broadcast
   * @returns Number of clients that received the message
   */
  sendToAll<T = unknown>(
    name: string,
    data: T,
    ignoreSocketId?: string,
  ): number {
    const packet = writePacket(name, data);
    let sentCount = 0;

    this.sockets.forEach((socket) => {
      if (socket.id === ignoreSocketId) {
        return;
      }
      socket.sendPacket(packet);
      sentCount++;
    });

    return sentCount;
  }

  /**
   * Send message to specific socket by socket ID
   *
   * Looks up the socket by ID and sends the message if found.
   * Fails silently if socket doesn't exist.
   *
   * @param socketId - Target socket ID
   * @param name - Message type/name
   * @param data - Message payload
   * @returns True if socket was found and message sent
   */
  sendToSocket<T = unknown>(socketId: string, name: string, data: T): boolean {
    const socket = this.sockets.get(socketId);
    if (socket) {
      socket.send(name, data);
      return true;
    }
    return false;
  }

  /**
   * Send message to specific player by player ID
   *
   * Iterates through all sockets to find the one associated with
   * the given player ID, then sends the message.
   *
   * This is less efficient than sendToSocket() but useful when you
   * only have a player ID instead of socket ID.
   *
   * @param playerId - Target player ID
   * @param name - Message type/name
   * @param data - Message payload
   * @returns True if player was found and message sent
   */
  sendToPlayer<T = unknown>(playerId: string, name: string, data: T): boolean {
    for (const socket of this.sockets.values()) {
      if (socket.player && socket.player.id === playerId) {
        socket.send(name, data);
        return true;
      }
    }
    return false;
  }

  /**
   * Get the socket for a specific player
   *
   * Looks up the socket by player ID. Useful for accessing player
   * entity data or sending targeted messages.
   *
   * @param playerId - Target player ID
   * @returns The socket if found, undefined otherwise
   */
  getPlayerSocket(playerId: string): ServerSocket | undefined {
    for (const socket of this.sockets.values()) {
      if (socket.player && socket.player.id === playerId) {
        return socket;
      }
    }
    return undefined;
  }
}
