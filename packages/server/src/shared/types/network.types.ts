/**
 * Network Types - WebSocket and connection handling types
 *
 * Contains TypeScript types for server networking, WebSocket connections,
 * and real-time multiplayer communication.
 *
 * **Type Categories**:
 * - WebSocket types (NodeWebSocket, ServerSocket)
 * - Connection handling (ConnectionParams, NetworkWithSocket)
 * - Server network interfaces
 *
 * **Referenced by**: ServerNetwork, connection handlers, socket managers
 */

// Re-export Socket base class from shared
export type { Socket } from "@hyperscape/shared";
import { Socket } from "@hyperscape/shared";

// ============================================================================
// WEBSOCKET TYPES
// ============================================================================

/**
 * Node.js WebSocket type with server-specific methods
 *
 * Extends the standard WebSocket interface with Node.js ws library methods
 * like ping(), terminate(), and event handlers.
 */
export type NodeWebSocket = WebSocket & {
  on: (event: string, listener: Function) => void;
  ping: () => void;
  terminate: () => void;
};

/**
 * Server-side socket with player and authentication data
 *
 * Extends the base Socket class with server-specific properties
 * for tracking player state, account ID, and character selection.
 */
export interface ServerSocket extends Socket {
  player: any;
  // Base Socket properties from Socket class
  ws: NodeWebSocket;
  network: NetworkWithSocket;

  // Server-specific extensions
  accountId?: string;
  selectedCharacterId?: string;
  characterId?: string; // Track active character immediately for duplicate detection
}

// ============================================================================
// CONNECTION TYPES
// ============================================================================

/**
 * WebSocket connection parameters from client
 *
 * Contains authentication and identification data sent by the client
 * during the initial WebSocket handshake.
 */
export interface ConnectionParams {
  authToken?: string;
  name?: string;
  avatar?: string;
  privyUserId?: string;
}

/**
 * Network system interface with socket management
 *
 * Defines the contract for server-side network systems that handle
 * WebSocket connections and message routing.
 */
export interface NetworkWithSocket {
  onConnection: (ws: NodeWebSocket, params: ConnectionParams) => Promise<void>;
  sockets: Map<string, ServerSocket>;
  enqueue: (
    socket: Socket | ServerSocket,
    method: string,
    data: unknown,
  ) => void;
  onDisconnect: (socket: Socket | ServerSocket, code?: number | string) => void;
}

/**
 * Server network with socket tracking
 *
 * Extended network interface that includes player entity data
 * on each socket. Used by player management endpoints.
 *
 * Note: PlayerEntity type is defined in game.types.ts.
 * Import via the barrel export: import type { PlayerEntity } from '../types'
 */
export interface ServerNetworkWithSockets {
  sockets: Map<
    string,
    ServerSocket & {
      player: any; // PlayerEntity from game.types.ts - avoid circular dependency
    }
  >;
}
