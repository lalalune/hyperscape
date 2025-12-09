/**
 * Server Type Definitions - Backwards compatibility re-exports
 *
 * This file maintains backwards compatibility with code that imports from
 * the old location. All types have been reorganized into domain-specific
 * files under shared/types/.
 *
 * **DEPRECATED**: Import from shared/types instead
 *
 * Old:
 * ```typescript
 * import type { PlayerRow } from './types';
 * ```
 *
 * New:
 * ```typescript
 * import type { PlayerRow } from './shared/types';
 * ```
 *
 * @deprecated Use shared/types instead
 */

// Re-export all types from the new location
export type {
  // Database types
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
  // Network types
  Socket,
  NodeWebSocket,
  ServerSocket,
  ConnectionParams,
  NetworkWithSocket,
  ServerNetworkWithSockets,
  // Game types
  WorldOptions,
  SpawnData,
  TerrainSystem,
  ResourceEntity,
  ResourceSystem,
  InventorySystemData,
  PlayerEntity,
  ServerStats,
  ChatMessage,
  // Auth types
  User,
} from "./shared/types/index.js";

export { dbHelpers, isDatabaseInstance } from "./shared/types/index.js";
