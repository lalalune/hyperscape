/**
 * Socket Management Module
 *
 * Handles WebSocket connection health monitoring:
 * - Ping/pong health checks
 * - Socket disconnection detection
 * - Socket cleanup and player removal
 *
 * This module extracts socket management logic from ServerNetwork
 * to improve maintainability and separation of concerns.
 */

import type { ServerSocket } from "../../shared/types";
import { EventType, World } from "@hyperscape/shared";

const WS_PING_INTERVAL_SEC = parseInt(
  process.env.WS_PING_INTERVAL_SEC || "5",
  10,
);
const WS_PING_MISS_TOLERANCE = parseInt(
  process.env.WS_PING_MISS_TOLERANCE || "3",
  10,
);
const WS_PING_GRACE_MS = parseInt(process.env.WS_PING_GRACE_MS || "5000", 10);

/**
 * Socket health manager for WebSocket connection monitoring
 */
export class SocketManager {
  private socketFirstSeenAt: Map<string, number> = new Map();
  private socketMissedPongs: Map<string, number> = new Map();
  private intervalId: NodeJS.Timeout;

  constructor(
    private sockets: Map<string, ServerSocket>,
    private world: World,
    private sendFn: (
      name: string,
      data: unknown,
      ignoreSocketId?: string,
    ) => void,
  ) {
    this.intervalId = setInterval(
      () => this.checkSockets(),
      WS_PING_INTERVAL_SEC * 1000,
    );
  }

  /**
   * Checks health of all WebSocket connections
   *
   * Sends ping to all sockets and disconnects those that didn't respond to the
   * previous ping (alive flag is false). This prevents zombie connections from
   * accumulating when clients close without proper disconnect.
   *
   * Called every PING_RATE (default 5 seconds) by the socket interval timer.
   */
  checkSockets(): void {
    const now = Date.now();
    const toDisconnect: Array<{ socket: ServerSocket; reason: string }> = [];
    this.sockets.forEach((socket) => {
      // Grace period for new sockets
      if (!this.socketFirstSeenAt.has(socket.id)) {
        this.socketFirstSeenAt.set(socket.id, now);
        this.socketMissedPongs.set(socket.id, 0);
        socket.ping?.();
        return;
      }

      const firstSeen = this.socketFirstSeenAt.get(socket.id) || now;
      const withinGrace = now - firstSeen < WS_PING_GRACE_MS;

      if (withinGrace) {
        // During grace, just ping and do not count misses
        socket.ping?.();
        return;
      }

      if (!socket.alive) {
        const misses = (this.socketMissedPongs.get(socket.id) || 0) + 1;
        this.socketMissedPongs.set(socket.id, misses);
        if (misses >= WS_PING_MISS_TOLERANCE) {
          toDisconnect.push({ socket, reason: `missed_pong x${misses}` });
          return;
        }
      } else {
        // Reset miss counter on successful pong seen in last interval
        this.socketMissedPongs.set(socket.id, 0);
      }

      // Mark not-alive and send ping to solicit next pong
      socket.ping?.();
    });

    toDisconnect.forEach(({ socket, reason }) => {
      console.warn(
        `[SocketManager] Disconnecting socket ${socket.id} due to ${reason}`,
      );
      socket.disconnect?.();
      this.socketFirstSeenAt.delete(socket.id);
      this.socketMissedPongs.delete(socket.id);
    });
  }

  /**
   * Handles player disconnection and cleanup
   *
   * Performs cleanup when a player disconnects:
   * - Removes socket from tracking
   * - Emits player left event
   * - Destroys player entity
   * - Broadcasts entity removal to other clients
   */
  handleDisconnect(socket: ServerSocket, code?: number | string): void {
    console.log(
      `[SocketManager] 🔌 Socket ${socket.id} disconnected with code:`,
      code,
      {
        hadPlayer: !!socket.player,
        playerId: socket.player?.id,
        stackTrace: new Error().stack?.split("\n").slice(1, 4).join("\n"),
      },
    );

    // Remove socket from our tracking
    this.sockets.delete(socket.id);
    this.socketFirstSeenAt.delete(socket.id);
    this.socketMissedPongs.delete(socket.id);

    // Clear character claim for duplicate detection
    socket.characterId = undefined;

    // Clean up any socket-specific resources
    if (socket.player) {
      // Emit typed player left event
      this.world.emit(EventType.PLAYER_LEFT, {
        playerId: socket.player.id,
      });

      // Remove player entity from world
      if (this.world.entities?.remove) {
        this.world.entities.remove(socket.player.id);
      }
      // Broadcast entity removal to all remaining clients
      this.sendFn("entityRemoved", socket.player.id);
    }
  }

  /**
   * Cleanup and stop socket monitoring
   */
  destroy(): void {
    clearInterval(this.intervalId);
    this.socketFirstSeenAt.clear();
    this.socketMissedPongs.clear();
  }
}
