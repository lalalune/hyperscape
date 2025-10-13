/**
 * System Type Definitions
 * 
 * Type definitions for game systems:
 * - System interfaces (what methods systems expose)
 * - Runtime data structures (internal system state)
 * - System-specific types (combat, loot, spawning)
 * - Type guards and helpers
 */

import { Entity } from '../entities/Entity'
import THREE from '../extras/three'
import type { CombatData } from '../systems/CombatSystem'
import type { BankItem, InventorySlotItem, StoreItem, Item, MobStats, Position3D } from './core'
import type { PxScene } from './physics'
import type { Player, System, World } from './index'
import type { PlayerRow, InventoryRow, EquipmentRow, WorldChunkRow, PlayerSessionRow, InventorySaveItem, EquipmentSaveItem, ItemRow } from './database'

// ============================================================================
// CORE SYSTEM INTERFACES
// ============================================================================

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

export interface LoaderSystem extends System {
  load(type: string, url: string): Promise<unknown>;
  preload(type: string, url: string): void;
  execPreload(): Promise<void>;
  insert?(type: string, url: string, data: File): void;
  get?(type: string, url: string): unknown;
  
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

// ============================================================================
// DATABASE SYSTEM INTERFACE
// ============================================================================

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

// ============================================================================
// GAME SYSTEM INTERFACES
// ============================================================================

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

export interface EntityManager extends System {
  getEntity(entityId: string): Entity | undefined
  getEntityCounts(): Record<string, number>
}

export interface ItemRegistrySystem extends System {
  get(itemId: string): Item | null
}

// ============================================================================
// RUNTIME DATA STRUCTURES (Internal System State)
// ============================================================================

/**
 * Internal banking system interface (runtime data structure)
 * Note: Distinct from BankingSystem which extends System
 */
export interface InternalBankingSystem {
  playerBanks: Map<string, Map<string, { items: BankItem[] }>>;
}

/**
 * Internal inventory system interface (runtime data structure)
 * Note: Distinct from InventorySystem which extends System
 */
export interface InternalInventorySystem {
  playerInventories: Map<string, { items: InventorySlotItem[]; coins: number }>;
}

/**
 * Internal store system interface (runtime data structure)
 * Note: Distinct from StoreSystem which extends System
 */
export interface InternalStoreSystem {
  stores: Map<string, { items: StoreItem[] }>;
}

/**
 * Internal equipment system interface (runtime data structure)
 * Note: Distinct from EquipmentSystem which extends System
 */
export interface InternalEquipmentSystem {
  playerEquipment: Map<string, Record<string, { item: Item | null; itemId: number | null }>>;
}

// ============================================================================
// SYSTEM-SPECIFIC TYPES
// ============================================================================

/**
 * Combat system interfaces
 */
export interface CombatEntity {
  id: string;
  position: Position3D;
  stats: { attack: number; defense: number; ranged: number };
  config: { attackPower: number; defensePower: number; defense: number };
  getPosition(): Position3D;
  takeDamage(damage: number, attackerId: string): void;
}

export interface XPDrop {
  entityId: string;
  skill: 'attack' | 'strength' | 'defense' | 'constitution' | 'ranged' | 'woodcutting' | 'fishing' | 'firemaking' | 'cooking';
  amount: number;
  timestamp: number;
  playerId: string;
  position: Position3D;
}

export interface SkillMilestone {
  level: number;
  name: string;
  message: string;
  reward: string | null;
}

/**
 * Loot system interfaces
 */
export interface DroppedItem {
  id: string;
  itemId: string;
  quantity: number;
  position: Position3D;
  despawnTime: number;
  droppedBy: string;
  entityId: string;
  droppedAt: number;
  mesh: THREE.Object3D | null;
}

export interface LootItem extends Item {
  quantity: number;
}

/**
 * Mob spawning interfaces
 */
export interface EntitySpawnedEvent {
  entityId?: string;
  entityType?: 'player' | 'mob' | 'item' | 'npc' | 'resource';
  position?: Position3D;
  entityData?: Record<string, unknown>;
  type?: string;
  config?: unknown;
}

export interface MobSpawnRequest {
  mobType: string;
  position: Position3D;
  level: number;
  config: Partial<MobStats> | null;
  respawnTime: number;
  customId: string | null;
}

/**
 * Entity manager interfaces
 */
export interface MoveRequestEvent {
  entityId: string;
  targetPosition: Position3D;
  speed: number;
}

export interface MobAttackEvent {
  attackerId: string;
  targetId: string;
  damage: number;
}

/**
 * Skills system data
 */
export interface SkillsData {
  attack: { level: number; xp: number };
  strength: { level: number; xp: number };
  defense: { level: number; xp: number };
  constitution: { level: number; xp: number };
  ranged: { level: number; xp: number };
  woodcutting: { level: number; xp: number };
  fishing: { level: number; xp: number };
  firemaking: { level: number; xp: number };
  cooking: { level: number; xp: number };
}

export interface InventoryData {
  items: Array<{
    slot: number;
    itemId: string;
    quantity: number;
    item: {
      id: string;
      name: string;
      type: string;
      stackable: boolean;
      weight: number;
    };
  }>;
  coins: number;
  maxSlots: number;
}

export interface EquipmentData {
  weapon: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
  shield: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
  helmet: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
  body: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
  legs: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
  arrows: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
}

export interface UIRequestData {
  playerId: string;
  requestType: 'open' | 'close' | 'update' | 'refresh';
  data: Record<string, string | number | boolean>;
  uiType: 'inventory' | 'skills' | 'equipment' | 'stats' | 'bank' | 'store';
}

/**
 * Action registry interfaces (system-specific execution params)
 */
export interface SystemActionParams {
  playerId: string;
  targetId: string | null;
  position: Position3D | null;
  itemId: string | null;
  quantity: number | null;
  slot: number | null;
  skillName: string | null;
}

/**
 * Store system interfaces
 */
export interface StoreSystemInterface {
  openStore(playerId: string, storeType: 'general' | 'equipment' | 'food' | 'runes'): void;
  closeStore(playerId: string): void;
  buyItem(playerId: string, itemId: string, quantity: number): Promise<boolean>;
  sellItem(playerId: string, itemId: string, quantity: number): Promise<boolean>;
  getStoreInventory(storeType: 'general' | 'equipment' | 'food' | 'runes'): Array<{ item: Item; price: number }>;
}

/**
 * System loader interfaces - specific system registry
 */
export interface Systems {
  combat: System;
  inventory: System;
  skills: System;
  itemPickup: System;
  persistence: System;
  spawning: System;
  banking: System;
  store: System;
  ui: System;
}

/**
 * System-specific debug info interfaces
 */
export interface NPCSystemInfo {
  bankAccounts: number;
  totalTransactions: number;
  storeItems: number;
  recentTransactions: Array<{
    timestamp: number;
    type: 'buy' | 'sell' | 'bank_deposit' | 'bank_withdraw';
    playerId: string;
    itemId: string | null;
    quantity: number;
    amount: number;
  }>;
}

// ============================================================================
// TYPE GUARDS & HELPERS
// ============================================================================

/**
 * Type guard helpers
 */
export function isPhysicsSystem(system: System): system is PhysicsSystem {
  return 'scene' in system && 'createLayerMask' in system
}

export function isMobSystem(system: System): system is MobSystem {
  return 'getMob' in system && 'spawnMob' in system
}

/**
 * Helper to get typed systems with non-null assertion
 */
export function getRequiredSystem<T extends System>(world: World, systemKey: string): T {
  const system = world.getSystem<T>(systemKey)
  if (!system) {
    throw new Error(`Required system '${systemKey}' not found`)
  }
  return system
}
