/**
 * Shared Types - Central export for all server types
 *
 * This barrel file re-exports all types from domain-specific type files,
 * providing a single convenient import location for server code.
 *
 * **Usage**:
 * ```typescript
 * import type { PlayerRow, ServerSocket, SpawnData } from '../shared/types';
 * ```
 *
 * **Domain modules**:
 * - database.types - Database rows and persistence
 * - network.types - WebSocket and connections
 * - game.types - Game systems and entities
 * - auth.types - User accounts and authentication
 */

// Database types
export type {
  PlayerRow,
  ItemRow,
  InventoryRow,
  EquipmentRow,
  PlayerSessionRow,
  WorldChunkRow,
  InventorySaveItem,
  EquipmentSaveItem,
  DatabaseSystemOperations,
  SystemDatabase,
} from "./database.types.js";
export { dbHelpers, isDatabaseInstance } from "./database.types.js";

// Network types
export type {
  Socket,
  NodeWebSocket,
  ServerSocket,
  ConnectionParams,
  NetworkWithSocket,
  ServerNetworkWithSockets,
} from "./network.types.js";

// Game types
export type {
  WorldOptions,
  SpawnData,
  TerrainSystem,
  ResourceEntity,
  ResourceSystem,
  InventorySystemData,
  PlayerEntity,
  ServerStats,
  ChatMessage,
} from "./game.types.js";

// Auth types
export type { User } from "./auth.types.js";
