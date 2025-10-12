/**
 * Strong type definitions for all systems in Hyperscape
 * These interfaces define the expected structure of each system
 * to enable strong type assumptions throughout the codebase
 */

import { Entity } from '../entities/Entity'
import THREE from '../extras/three'
import type { CombatData } from '../systems/CombatSystem'
import type { Item, Town } from '../types/core'
import type { PxScene } from '../types/physics'
import type { Player, System, World } from './index'
import type { PlayerRow, InventoryRow, EquipmentRow, WorldChunkRow, PlayerSessionRow, InventorySaveItem, EquipmentSaveItem, ItemRow } from './database'

// Core System Interfaces

export interface PhysicsSystem extends System {
  scene: PxScene
  createLayerMask(...layers: string[]): number
  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance?: number, layerMask?: number): unknown
  addActor(actor: unknown, handle: unknown): unknown
  clean(): void
}

export interface StageSystem extends System {
  scene: THREE.Scene
  THREE: typeof THREE
  clean(): void
}

export interface ChatSystem extends System {
  add(message: { from: string; body: string }, broadcast?: boolean): void
  subscribe(callback: (messages: unknown[]) => void): () => void
  send(text: string): unknown
}

export interface ClientInputSystem extends System {
  setEnabled(enabled: boolean): void
  keyX?: { pressed: boolean; released: boolean; onPress?: () => void; onRelease?: () => void }
  setKey(key: string, value: boolean): void
}

export interface ClientInterfaceSystem extends System {
  registerCameraSystem(cameraSystem: unknown): void
  unregisterCameraSystem(cameraSystem: unknown): void
  toggleVisible(): void
}

export interface NetworkSystem extends System {
  isClient: boolean
  isServer: boolean
  send(event: string, data: unknown): void
  disconnect(): Promise<void>
}

export interface EntitiesSystem extends System {
  player: Player
  get(id: string): unknown
  modify(id: string, data: unknown): void
}

export interface TerrainSystem extends System {
  getHeightAt(x: number, z: number): number
  getHeightAtPosition(x: number, z: number): number
  isPositionWalkable(x: number, z: number): { walkable: boolean; reason?: string }
  getBiomeAt(x: number, z: number): string
  findWaterAreas(tile: unknown): unknown[]
}

export interface DatabaseSystem extends System {
  // Player data methods (sync for backward compatibility, async for PostgreSQL)
  getPlayer(playerId: string): PlayerRow | null
  getPlayerAsync(playerId: string): Promise<PlayerRow | null>
  savePlayer(playerId: string, data: Partial<PlayerRow>): void
  savePlayerAsync(playerId: string, data: Partial<PlayerRow>): Promise<void>
  
  // Character methods (for character selection)
  getCharacters(accountId: string): Array<{ id: string; name: string }>
  getCharactersAsync(accountId: string): Promise<Array<{ id: string; name: string }>>
  createCharacter(accountId: string, id: string, name: string): Promise<boolean>
  
  // Inventory methods
  getPlayerInventory(playerId: string): InventoryRow[]
  getPlayerInventoryAsync(playerId: string): Promise<InventoryRow[]>
  savePlayerInventory(playerId: string, inventory: InventorySaveItem[]): void
  savePlayerInventoryAsync(playerId: string, inventory: InventorySaveItem[]): Promise<void>
  
  // Equipment methods
  getPlayerEquipment(playerId: string): EquipmentRow[]
  getPlayerEquipmentAsync(playerId: string): Promise<EquipmentRow[]>
  savePlayerEquipment(playerId: string, equipment: EquipmentSaveItem[]): void
  savePlayerEquipmentAsync(playerId: string, equipment: EquipmentSaveItem[]): Promise<void>
  
  // World chunk methods
  saveWorldChunk(chunkData: {
    chunkX: number
    chunkZ: number
    biome?: string
    heightData?: number[]
    chunkSeed?: number
    lastActiveTime?: number | Date
    playerCount?: number
    data?: string
  }): void
  saveWorldChunkAsync(chunkData: {
    chunkX: number
    chunkZ: number
    biome?: string
    heightData?: number[]
    chunkSeed?: number
    lastActiveTime?: number | Date
    playerCount?: number
    data?: string
  }): Promise<void>
  getWorldChunk(x: number, z: number): WorldChunkRow | null
  getWorldChunkAsync(x: number, z: number): Promise<WorldChunkRow | null>
  getInactiveChunks(minutes: number): WorldChunkRow[]
  getInactiveChunksAsync(minutes: number): Promise<WorldChunkRow[]>
  updateChunkPlayerCount(chunkX: number, chunkZ: number, playerCount: number): void
  updateChunkPlayerCountAsync(chunkX: number, chunkZ: number, playerCount: number): Promise<void>
  markChunkForReset(chunkX: number, chunkZ: number): void
  markChunkForResetAsync(chunkX: number, chunkZ: number): Promise<void>
  resetChunk(chunkX: number, chunkZ: number): void
  resetChunkAsync(chunkX: number, chunkZ: number): Promise<void>
  
  // Session tracking methods
  createPlayerSession(sessionData: Omit<PlayerSessionRow, 'id' | 'sessionId'>): string
  createPlayerSessionAsync(sessionData: Omit<PlayerSessionRow, 'id' | 'sessionId'>, sessionId?: string): Promise<string>
  updatePlayerSession(sessionId: string, updates: Partial<PlayerSessionRow>): void
  updatePlayerSessionAsync(sessionId: string, updates: Partial<PlayerSessionRow>): Promise<void>
  getActivePlayerSessions(): PlayerSessionRow[]
  getActivePlayerSessionsAsync(): Promise<PlayerSessionRow[]>
  endPlayerSession(sessionId: string, reason?: string): void
  endPlayerSessionAsync(sessionId: string, reason?: string): Promise<void>
  
  // Maintenance methods
  cleanupOldSessions(daysOld: number): number
  cleanupOldSessionsAsync(daysOld: number): Promise<number>
  cleanupOldChunkActivity(daysOld: number): number
  cleanupOldChunkActivityAsync(daysOld: number): Promise<number>
  getDatabaseStats(): { 
    playerCount: number
    activeSessionCount: number
    chunkCount: number
    activeChunkCount: number
    totalActivityRecords: number
  }
  getDatabaseStatsAsync(): Promise<{
    playerCount: number
    activeSessionCount: number
    chunkCount: number
    activeChunkCount: number
    totalActivityRecords: number
  }>
  
  // Item methods
  getItem(itemId: number): ItemRow | null
  getItemAsync(itemId: number): Promise<ItemRow | null>
  getAllItems(): ItemRow[]
  getAllItemsAsync(): Promise<ItemRow[]>
  
  // Cleanup
  close(): void
}

export interface LoaderSystem extends System {
  // Basic loading methods
  load(type: string, url: string): Promise<unknown>;
  preload(type: string, url: string): void;
  execPreload(): Promise<void>;
  insert?(type: string, url: string, data: File): void;
  get?(type: string, url: string): unknown;
  
  // Typed loading methods (optional for backward compatibility)
  loadModel?(url: string): Promise<THREE.Object3D>;
  loadTexture?(url: string): Promise<THREE.Texture>;
  loadHDR?(url: string): Promise<THREE.DataTexture>;
  loadAvatar?(url: string): Promise<unknown>;
  loadEmote?(url: string): Promise<unknown>;
  loadVideo?(url: string): Promise<unknown>;
}

export interface ActionsSystem extends System {
  btnDown: boolean
  execute(actionName: string, params?: unknown): Promise<unknown>
  getAvailable(): string[]
  register(action: unknown): void
  unregister(name: string): void
}

export interface XRSystem extends System {
  session?: unknown
  supportsVR: boolean
  enter(): void
}

// System Interfaces

export interface PlayerSystem extends System {
  initializePlayer(playerId: string): void
  savePlayerToDatabase(playerId: string): void
  onPlayerEnter(event: { playerId: string }): void
  getPlayer(playerId: string): Player | null
}

export interface MobSystem extends System {
  getMob(mobId: string): Entity | null
  spawnMob(config: unknown): Promise<unknown>
  getMobCount(): number
  getActiveMobs(): Entity[]
  getSpawnedMobs(): Map<string, unknown>
}

export interface CombatSystem extends System {
  startCombat(attackerId: string, targetId: string, options?: unknown): boolean
  isInCombat(entityId: string): boolean
  getCombatData(entityId: string): CombatData | null
  forceEndCombat(entityId: string): void
  getActiveCombats(): Map<string, CombatData>
}

export interface InventorySystem extends System {
  addItem(playerId: string, itemId: string, quantity: number): boolean
  removeItem(playerId: string, itemId: string, quantity: number): boolean
  getPlayerInventory(playerId: string): unknown[]
  initializeTestPlayerInventory(playerId: string): void
  playerInventories: Map<string, unknown>
}

export interface EquipmentSystem extends System {
  equipItem(data: { playerId: string; itemId: string | number; slot: string; inventorySlot?: number }): void
  unequipItem(data: { playerId: string; slot: string }): void
  consumeArrow(playerId: string): boolean
  playerEquipment: Map<string, unknown>
}

export interface StoreSystem extends System {
  purchaseItem(playerId: string, itemId: string, quantity: number, expectedPrice: number): Promise<boolean>
  sellItem(playerId: string, itemId: string, quantity: number, expectedPrice: number): Promise<boolean>
  stores: Map<string, unknown>
}

export interface BankingSystem extends System {
  playerBanks: Map<string, unknown>
}

export interface XPSystem extends System {
  getSkillLevel(playerId: string, skill: string): number
  getSkillData(playerId: string, skill: string): unknown
  getCombatLevel(playerId: string): number
}

export interface MovementSystem extends System {
  startPlayerMovement(playerId: string, target: unknown): void
  teleportPlayer(playerId: string, position: unknown): void
  movePlayer(playerId: string, destination: unknown, options?: unknown): void
}

export interface PathfindingSystem extends System {
  findPath(start: unknown, end: unknown): unknown[]
}

export interface WorldGenerationSystem extends System {
  getTowns(): Town[]
}

export interface EntityManager extends System {
  getEntity(entityId: string): Entity | undefined
  getEntityCounts(): Record<string, number>
}

export interface ItemRegistrySystem extends System {
  get(itemId: string): Item | null
}

// Augment the World interface to include typed system retrieval
// Note: Commenting out this interface augmentation due to conflicts with existing World interface
// declare module './index' {
//   interface World {
//     // Core systems
//     physics: PhysicsSystem
//     stage: StageSystem
//     chat: ChatSystem
//     settings: Settings
//     entities: EntitiesSystem
//     network?: NetworkSystem
//     controls?: ClientInputSystem
//     ui?: ClientInterfaceSystem
//     loader?: LoaderSystem
//     actions?: ActionsSystem
//     xr?: XRSystem
//     terrain?: TerrainSystem
//     
//     // systems
//     rpg?: {
//       player?: PlayerSystem
//       mob?: MobSystem
//       combat?: CombatSystem
//       inventory?: InventorySystem
//       equipment?: EquipmentSystem
//       store?: StoreSystem
//       banking?: BankingSystem
//       xp?: XPSystem
//       movement?: MovementSystem
//       pathfinding?: PathfindingSystem
//       worldGeneration?: WorldGenerationSystem
//       entityManager?: EntityManager
//       itemRegistry?: ItemRegistrySystem
//     }
//     
//     // Typed system retrieval
//     getSystem<T extends System = System>(systemKey: string): T
//     findSystem<T extends System = System>(nameOrConstructor: string): T
//   }
// }

// Type guard helpers (these should eventually be removed)
export function isPhysicsSystem(system: System): system is PhysicsSystem {
  return 'scene' in system && 'createLayerMask' in system
}

export function isMobSystem(system: System): system is MobSystem {
  return 'getMob' in system && 'spawnMob' in system
}

// Helper to get typed systems with non-null assertion
export function getRequiredSystem<T extends System>(world: World, systemKey: string): T {
  const system = world.getSystem<T>(systemKey)
  if (!system) {
    throw new Error(`Required system '${systemKey}' not found`)
  }
  return system
}