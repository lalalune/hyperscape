/**
 * Server-side type definitions
 * Local definitions for types that should be imported from @hyperscape/shared
 * but aren't properly exported due to build issues
 */

// Import database types from shared for re-export
export type {
  SystemDatabase,
  TypedKnexDatabase,
  PlayerRow,
  ItemRow,
  InventoryRow,
  EquipmentRow,
  PlayerSessionRow,
  WorldChunkRow,
  InventorySaveItem,
  EquipmentSaveItem
} from '@hyperscape/shared'

// Import database helpers from shared (these are values, not types)
export { dbHelpers, isDatabaseInstance } from '@hyperscape/shared'

// Import SystemDatabase for use in this file
import type { SystemDatabase } from '@hyperscape/shared'

// Network types
export type NodeWebSocket = WebSocket & { send: (data: unknown) => void; close: (code?: number, reason?: string) => void }

export interface ConnectionParams {
  authToken?: string
  name?: string
  avatar?: string
  privyUserId?: string
}

export interface NetworkWithSocket {
  onConnection: (ws: NodeWebSocket, params: ConnectionParams) => Promise<void>
}

export interface User {
  id: string
  name: string
  avatar: string | null
  roles: string | string[]
  createdAt: string
}

export interface ServerStats {
  currentCPU: number
  currentMemory: number
  maxMemory: number
}

export interface SpawnData {
  position: [number, number, number]
  quaternion: [number, number, number, number]
}

export type TerrainSystem = {
  getHeightAt: (x: number, z: number) => number
  isReady: () => boolean
}

// Chat message type
export interface ChatMessage {
  id: string
  userId: string
  userName: string
  message: string
  timestamp: number
  channel?: string
}

// World options type
export interface WorldOptions {
  db?: SystemDatabase
  storage?: unknown
  assetsUrl?: string
  assetsDir?: string
}
