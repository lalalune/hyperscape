/**
 * Server Type Definitions - Server-specific types and interfaces
 * 
 * This file defines TypeScript types used throughout the server codebase.
 * It includes both server-specific types and re-exports from shared code.
 * 
 * **Type Categories**:
 * 
 * 1. **Database Row Types** - Match the Drizzle schema structure
 *    - PlayerRow, InventoryRow, EquipmentRow, etc.
 *    - Used by DatabaseSystem for type-safe queries
 * 
 * 2. **Network Types** - WebSocket and connection handling
 *    - ServerSocket, NodeWebSocket, ConnectionParams
 *    - Used by ServerNetwork for player connections
 * 
 * 3. **System Types** - Game systems and their data
 *    - ResourceSystem, InventorySystemData, TerrainSystem
 *    - Used to type-cast systems retrieved with world.getSystem()
 * 
 * 4. **Re-exports** - Types from @hyperscape/shared
 *    - SystemDatabase, Socket, WorldOptions, etc.
 *    - Provides convenient single import location
 * 
 * **Why this file exists**:
 * - Server needs types that don't belong in shared (PostgreSQL-specific, Node-specific)
 * - Provides strong typing for server-only features
 * - Centralizes type definitions for easy discovery
 * 
 * **Referenced by**: Nearly all server files (ServerNetwork, DatabaseSystem, index.ts, etc.)
 */

import type { Entity } from '@hyperscape/shared';

// ============================================================================
// RE-EXPORTS FROM SHARED
// ============================================================================
// Import commonly used shared types for convenience

/** Database interface for legacy Knex-style queries */
export type { SystemDatabase } from '@hyperscape/shared';

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================
// These types match the structure of rows returned from Drizzle queries.
// They correspond to the tables defined in db/schema.ts.

/**
 * Player data row from the characters table
 * 
 * Contains all persistent character data including stats, position, and progress.
 * Used by DatabaseSystem for loading/saving player state.
 */
export interface PlayerRow {
  playerId: string
  id: string
  accountId: string
  name: string
  combatLevel: number
  attackLevel: number
  strengthLevel: number
  defenseLevel: number
  constitutionLevel: number
  rangedLevel: number
  woodcuttingLevel: number
  fishingLevel: number
  firemakingLevel: number
  cookingLevel: number
  attackXp: number
  strengthXp: number
  defenseXp: number
  constitutionXp: number
  rangedXp: number
  woodcuttingXp: number
  fishingXp: number
  firemakingXp: number
  cookingXp: number
  health: number
  maxHealth: number
  coins: number
  positionX: number
  positionY: number
  positionZ: number
  createdAt: number
  lastLogin: number
}

/** World item row (dropped items, resource nodes) */
export interface ItemRow {
  id: string
  chunkX: number
  chunkZ: number
  itemId: string
  quantity: number
  positionX: number
  positionY: number
  positionZ: number
  createdAt: number
}

/** Inventory item row - items in player's 28-slot inventory */
export interface InventoryRow {
  playerId: string
  itemId: string
  quantity: number
  slotIndex: number
  metadata: string | null
}

export interface EquipmentRow {
  playerId: string
  slotType: string
  itemId: string | null
  quantity: number
}

export interface PlayerSessionRow {
  id: string
  sessionId: string
  playerId: string
  sessionStart: number
  sessionEnd: number | null
  playtimeMinutes: number
  lastActivity: number
  reason: string | null
}

export interface WorldChunkRow {
  chunkX: number
  chunkZ: number
  data: string
  lastActive: number
  playerCount: number
  needsReset: number
}

export interface InventorySaveItem {
  itemId: string
  quantity: number
  slotIndex: number | null
  metadata: Record<string, unknown> | null
}

/** Equipment save data - for savePlayerEquipmentAsync() */
export interface EquipmentSaveItem {
  slotType: string
  itemId: string | null
  quantity: number
}

// Database helpers - re-export from shared for convenience
export { dbHelpers, isDatabaseInstance } from '@hyperscape/shared'

// ============================================================================
// NETWORK TYPES
// ============================================================================
// Types for WebSocket connections and network handling

// Socket base class - re-export from shared
import { Socket } from '@hyperscape/shared'
export type { Socket } from '@hyperscape/shared'

/**
 * Node.js WebSocket type with server-specific methods
 * 
 * Extends the standard WebSocket interface with Node.js ws library methods
 * like ping(), terminate(), and event handlers.
 */
export type NodeWebSocket = WebSocket & {
  on: (event: string, listener: Function) => void
  ping: () => void
  terminate: () => void
}

// Extended Socket type with server-specific properties
export interface ServerSocket extends Socket {
  // Base Socket properties from Socket class
  ws: NodeWebSocket
  network: NetworkWithSocket
  
  // Server-specific extensions
  accountId?: string
  selectedCharacterId?: string
}

/**
 * WebSocket connection parameters from client
 * @public
 */
export interface ConnectionParams {
  authToken?: string
  name?: string
  avatar?: string
  privyUserId?: string
}

/**
 * Network system interface with socket management
 * @public
 */
export interface NetworkWithSocket {
  onConnection: (ws: NodeWebSocket, params: ConnectionParams) => Promise<void>
  sockets: Map<string, ServerSocket>
  enqueue: (socket: Socket | ServerSocket, method: string, data: unknown) => void
  onDisconnect: (socket: Socket | ServerSocket, code?: number | string) => void
}

/**
 * Server-side user account representation
 * @public
 */
export interface User {
  id: string
  name: string
  avatar: string | null
  roles: string | string[]
  createdAt: string
}

/**
 * Server performance statistics
 * @public
 */
export interface ServerStats {
  currentCPU: number
  currentMemory: number
  maxMemory: number
}

/**
 * Player spawn point data (position and rotation)
 * @public
 */
export interface SpawnData {
  position: [number, number, number]
  quaternion: [number, number, number, number]
}

/**
 * Terrain system interface for height queries
 * @public
 */
export type TerrainSystem = {
  getHeightAt: (x: number, z: number) => number
  isReady: () => boolean
}

/**
 * Chat message data structure
 * @public
 */
export interface ChatMessage {
  id: string
  userId: string
  userName: string
  message: string
  timestamp: number
  channel?: string
}

// Re-export WorldOptions from shared
export type { WorldOptions } from '@hyperscape/shared'

/**
 * Resource entity (tree, rock, etc.) for gathering systems
 * @public
 */
export interface ResourceEntity {
  id: string
  type: string
  position: { x: number; y: number; z: number }
  isAvailable: boolean
  lastDepleted?: number
  respawnTime?: number
}

/**
 * Resource system interface
 * @public
 */
export interface ResourceSystem {
  getAllResources?: () => ResourceEntity[]
}

/**
 * Inventory system data interface
 * @public
 */
export interface InventorySystemData {
  getInventoryData?: (playerId: string) => {
    items: unknown[]
    coins: number
    maxSlots: number
  }
}

/**
 * Database system operation signatures
 * @public
 */
export interface DatabaseSystemOperations {
  getPlayerInventoryAsync?: (playerId: string) => Promise<Array<{
    itemId: string | number
    quantity: number
    slotIndex: number | null
  }>>
  getPlayerAsync?: (playerId: string) => Promise<{ coins?: number } | null>
}

/**
 * Player entity with server-specific properties
 * @public
 */
export type PlayerEntity = Entity & {
  data: {
    id: string
    userId?: string
    [key: string]: unknown
  }
  serialize: () => unknown
}

/**
 * Server network with socket tracking (for index.ts disconnect handler)
 * @public
 */
export interface ServerNetworkWithSockets {
  sockets: Map<string, ServerSocket & { 
    player: PlayerEntity
  }>
}
