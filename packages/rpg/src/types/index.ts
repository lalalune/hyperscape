// Core RPG Type System
// This is the foundation that defines all RPG data structures and interfaces

// ===== SKILLS =====
export enum RPGSkill {
  ATTACK = 'attack',
  STRENGTH = 'strength', 
  DEFENSE = 'defense',
  RANGE = 'range',
  CONSTITUTION = 'constitution',
  WOODCUTTING = 'woodcutting',
  FISHING = 'fishing',
  FIREMAKING = 'firemaking',
  COOKING = 'cooking'
}

export interface SkillState {
  level: number
  experience: number
}

export interface PlayerSkills {
  [RPGSkill.ATTACK]: SkillState
  [RPGSkill.STRENGTH]: SkillState
  [RPGSkill.DEFENSE]: SkillState
  [RPGSkill.RANGE]: SkillState
  [RPGSkill.CONSTITUTION]: SkillState
  [RPGSkill.WOODCUTTING]: SkillState
  [RPGSkill.FISHING]: SkillState
  [RPGSkill.FIREMAKING]: SkillState
  [RPGSkill.COOKING]: SkillState
}

// ===== ITEMS =====
export enum ItemType {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  TOOL = 'tool',
  RESOURCE = 'resource',
  CONSUMABLE = 'consumable',
  AMMUNITION = 'ammunition',
  CURRENCY = 'currency',
  QUEST = 'quest'
}

export enum WeaponType {
  SWORD = 'sword',
  BOW = 'bow',
  SHIELD = 'shield',
  STAFF = 'staff',
  DAGGER = 'dagger'
}

export enum ArmorSlot {
  HELMET = 'helmet',
  BODY = 'body',
  LEGS = 'legs',
  BOOTS = 'boots',
  GLOVES = 'gloves',
  CAPE = 'cape'
}

export interface ItemRequirement {
  level: number
  skill: RPGSkill
}

export interface ItemBonuses {
  attack?: number
  strength?: number
  defense?: number
  range?: number
  magic?: number
  prayer?: number
}

export interface RPGItem {
  id: string
  name: string
  description: string
  type: ItemType
  stackable: boolean
  maxStack: number
  value: number
  weight: number
  requirements?: ItemRequirement
  bonuses?: ItemBonuses
  weaponType?: WeaponType
  armorSlot?: ArmorSlot
  modelPath?: string
  iconPath?: string
  healAmount?: number
  restoreAmount?: number
  consumeOnUse?: boolean
}

export interface InventorySlot {
  item: RPGItem
  quantity: number
}

export interface Inventory {
  slots: (InventorySlot | null)[]
  maxSlots: number
}

export interface Equipment {
  weapon: InventorySlot | null
  shield: InventorySlot | null
  helmet: InventorySlot | null
  body: InventorySlot | null
  legs: InventorySlot | null
  arrows: InventorySlot | null
}

// ===== COMBAT =====
export enum CombatStyle {
  ACCURATE = 'accurate',
  AGGRESSIVE = 'aggressive', 
  DEFENSIVE = 'defensive',
  CONTROLLED = 'controlled'
}

export interface CombatStats {
  attack: number
  strength: number
  defense: number
  range: number
  constitution: number
  combatLevel: number
}

export interface CombatResult {
  damage: number
  hit: boolean
  critical: boolean
  experienceGained: { [skill in RPGSkill]?: number }
}

export interface CombatSession {
  attackerId: string
  targetId: string
  startTime: number
  lastAttackTime: number
  style: CombatStyle
  active: boolean
}

// ===== PLAYER =====
export interface PlayerPosition {
  x: number
  y: number
  z: number
}

export interface PlayerHealth {
  current: number
  max: number
}

export interface PlayerState {
  id: string
  name: string
  position: PlayerPosition
  health: PlayerHealth
  skills: PlayerSkills
  inventory: Inventory
  equipment: Equipment
  inCombat: boolean
  combatTarget: string | null
  lastAction: string | null
  coins: number
  deathLocation: PlayerPosition | null
}

// ===== MOBS =====
export enum MobType {
  GOBLIN = 'goblin',
  HOBGOBLIN = 'hobgoblin',
  BANDIT = 'bandit',
  BARBARIAN = 'barbarian',
  GUARD = 'guard',
  DARK_WARRIOR = 'dark_warrior',
  BLACK_KNIGHT = 'black_knight',
  ICE_WARRIOR = 'ice_warrior',
  DARK_RANGER = 'dark_ranger'
}

export enum MobBehavior {
  PASSIVE = 'passive',
  AGGRESSIVE = 'aggressive',
  DEFENSIVE = 'defensive'
}

export interface LootEntry {
  itemId: string
  quantity: number | (() => number)
  chance: number
  rare?: boolean
}

export interface MobDefinition {
  id: string
  name: string
  type: MobType
  level: number
  health: number
  combat: CombatStats
  behavior: MobBehavior
  aggroRange: number
  respawnTime: number
  lootTable: LootEntry[]
  experienceReward: number
  modelPath?: string
  color?: string
}

export interface MobInstance {
  id: string
  definition: MobDefinition
  currentHealth: number
  position: PlayerPosition
  spawnPosition: PlayerPosition
  state: 'idle' | 'aggressive' | 'combat' | 'returning' | 'dead'
  target: string | null
  lastAttackTime: number
  respawnTime: number | null
}

// ===== WORLD =====
export interface WorldPosition {
  x: number
  z: number
}

export interface BiomeDefinition {
  id: string
  name: string
  description: string
  difficulty: number
  mobSpawns: MobType[]
  resourceNodes: string[]
  color: string
}

export interface ResourceNode {
  id: string
  type: 'tree' | 'rock' | 'fishing_spot'
  position: WorldPosition
  resourceId: string
  respawnTime: number
  currentlyHarvested: boolean
  harvestTime: number
  requiredSkill: RPGSkill
  requiredLevel: number
  experience: number
}

export interface Town {
  id: string
  name: string
  position: WorldPosition
  isStarterTown: boolean
  hasBank: boolean
  hasShop: boolean
  safeZone: boolean
}

export interface WorldState {
  mobs: Map<string, MobInstance>
  players: Map<string, PlayerState>
  resourceNodes: Map<string, ResourceNode>
  towns: Map<string, Town>
  worldTime: number
  lastTick: number
}

// ===== SYSTEM INTERFACES =====
export interface RPGSystem {
  name: string
  initialized: boolean
  init(): Promise<void>
  update(deltaTime: number): Promise<void>
  cleanup(): Promise<void>
}

export interface RPGCombatSystem extends RPGSystem {
  startCombat(attackerId: string, targetId: string): Promise<boolean>
  processCombatTick(): Promise<void>
  endCombat(sessionId: string): Promise<void>
  calculateDamage(attacker: PlayerState | MobInstance, target: PlayerState | MobInstance): Promise<CombatResult>
  applyCombatStyle(style: CombatStyle): { attack: number, strength: number, defense: number }
}

export interface RPGSkillsSystem extends RPGSystem {
  grantExperience(playerId: string, skill: RPGSkill, amount: number): Promise<boolean>
  calculateLevel(experience: number): number
  getRequiredExperience(level: number): number
  checkLevelUp(playerId: string, skill: RPGSkill): Promise<boolean>
  meetsRequirement(playerId: string, requirement: ItemRequirement): Promise<boolean>
}

export interface RPGInventorySystem extends RPGSystem {
  addItem(playerId: string, itemId: string, quantity: number): Promise<boolean>
  removeItem(playerId: string, itemId: string, quantity: number): Promise<boolean>
  moveItem(playerId: string, fromSlot: number, toSlot: number): Promise<boolean>
  getInventory(playerId: string): Promise<Inventory | null>
  hasSpace(playerId: string, itemId: string, quantity: number): Promise<boolean>
  dropItem(playerId: string, itemId: string, quantity: number): Promise<boolean>
}

export interface RPGEquipmentSystem extends RPGSystem {
  equipItem(playerId: string, itemId: string): Promise<boolean>
  unequipItem(playerId: string, slot: keyof Equipment): Promise<boolean>
  getEquipment(playerId: string): Promise<Equipment | null>
  calculateBonuses(equipment: Equipment): ItemBonuses
  meetsEquipmentRequirements(playerId: string, item: RPGItem): Promise<boolean>
}

export interface RPGMobSystem extends RPGSystem {
  spawnMob(definition: MobDefinition, position: WorldPosition): Promise<string>
  despawnMob(mobId: string): Promise<boolean>
  updateMobAI(mobId: string): Promise<void>
  processMobCombat(mobId: string): Promise<void>
  handleMobDeath(mobId: string, killerId?: string): Promise<void>
  respawnMobs(): Promise<void>
  getMob(mobId: string): Promise<MobInstance | null>
}

export interface RPGWorldSystem extends RPGSystem {
  getWorldState(): Promise<WorldState>
  updateWorldState(state: Partial<WorldState>): Promise<void>
  processResourceNodes(): Promise<void>
  handlePlayerMovement(playerId: string, newPosition: PlayerPosition): Promise<void>
  checkCollisions(position: PlayerPosition): Promise<boolean>
  getTown(townId: string): Promise<Town | null>
  getNearbyEntities(position: PlayerPosition, radius: number): Promise<{ players: string[], mobs: string[] }>
}

export interface RPGPersistenceSystem extends RPGSystem {
  savePlayerState(playerId: string, state: PlayerState): Promise<void>
  loadPlayerState(playerId: string): Promise<PlayerState | null>
  saveMobState(mobId: string, state: MobInstance): Promise<void>
  loadMobState(mobId: string): Promise<MobInstance | null>
  saveWorldState(state: WorldState): Promise<void>
  loadWorldState(): Promise<WorldState | null>
}

// ===== EVENTS =====
export interface RPGEvent {
  type: string
  timestamp: number
  data: any
}

export interface PlayerJoinEvent extends RPGEvent {
  type: 'player:join'
  data: {
    playerId: string
    playerName: string
    position: PlayerPosition
  }
}

export interface PlayerLeaveEvent extends RPGEvent {
  type: 'player:leave'
  data: {
    playerId: string
  }
}

export interface CombatStartEvent extends RPGEvent {
  type: 'combat:start'
  data: {
    attackerId: string
    targetId: string
    sessionId: string
  }
}

export interface CombatHitEvent extends RPGEvent {
  type: 'combat:hit'
  data: {
    attackerId: string
    targetId: string
    damage: number
    experienceGained: { [skill in RPGSkill]?: number }
  }
}

export interface MobDeathEvent extends RPGEvent {
  type: 'mob:death'
  data: {
    mobId: string
    killerId?: string
    loot: LootEntry[]
    experienceReward: number
  }
}

export interface SkillLevelUpEvent extends RPGEvent {
  type: 'skill:levelup'
  data: {
    playerId: string
    skill: RPGSkill
    newLevel: number
    oldLevel: number
  }
}

export interface ItemDropEvent extends RPGEvent {
  type: 'item:drop'
  data: {
    itemId: string
    quantity: number
    position: PlayerPosition
    droppedBy?: string
  }
}

export interface ItemPickupEvent extends RPGEvent {
  type: 'item:pickup'
  data: {
    itemId: string
    quantity: number
    playerId: string
    position: PlayerPosition
  }
}

// ===== TESTING TYPES =====
export interface TestColor {
  r: number
  g: number
  b: number
  name: string
}

export interface VisualTestEntity {
  id: string
  type: 'player' | 'mob' | 'item' | 'building'
  color: TestColor
  position: PlayerPosition
  visible: boolean
}

export interface TestScenario {
  name: string
  description: string
  entities: VisualTestEntity[]
  expectedActions: string[]
  verificationSteps: string[]
}

export interface TestResult {
  scenarioName: string
  passed: boolean
  errors: string[]
  screenshots: string[]
  entityPositions: { [entityId: string]: PlayerPosition }
  logOutput: string[]
}

// ===== DATABASE SCHEMA TYPES =====
export interface RPGDatabaseSchema {
  players: {
    id: string
    name: string
    created_at: Date
    last_login: Date
    position_x: number
    position_y: number
    position_z: number
    health_current: number
    health_max: number
    coins: number
    attack_level: number
    attack_experience: number
    strength_level: number
    strength_experience: number
    defense_level: number
    defense_experience: number
    range_level: number
    range_experience: number
    constitution_level: number
    constitution_experience: number
    woodcutting_level: number
    woodcutting_experience: number
    fishing_level: number
    fishing_experience: number
    firemaking_level: number
    firemaking_experience: number
    cooking_level: number
    cooking_experience: number
  }
  
  inventory: {
    id: string
    player_id: string
    slot_index: number
    item_id: string
    quantity: number
  }
  
  equipment: {
    id: string
    player_id: string
    slot_type: keyof Equipment
    item_id: string
    quantity: number
  }
  
  mob_instances: {
    id: string
    definition_id: string
    position_x: number
    position_z: number
    spawn_x: number
    spawn_z: number
    current_health: number
    state: string
    target_id: string | null
    last_attack_time: number
    respawn_time: number | null
  }
  
  world_state: {
    id: string
    world_time: number
    last_tick: number
    data: string // JSON serialized WorldState
  }
}

// ===== UTILITY TYPES =====
export type RPGEventHandler<T extends RPGEvent = RPGEvent> = (event: T) => Promise<void> | void

export interface RPGEventEmitter {
  on<T extends RPGEvent>(eventType: string, handler: RPGEventHandler<T>): void
  off<T extends RPGEvent>(eventType: string, handler: RPGEventHandler<T>): void
  emit<T extends RPGEvent>(event: T): Promise<void>
}

// Experience table (same as RuneScape)
export const EXPERIENCE_TABLE = [
  0, 83, 174, 276, 388, 512, 650, 801, 969, 1154,
  1358, 1584, 1833, 2107, 2411, 2746, 3115, 3523, 3973, 4470,
  5018, 5624, 6291, 7028, 7842, 8740, 9730, 10824, 12031, 13363,
  14833, 16456, 18247, 20224, 22406, 24815, 27473, 30408, 33648, 37224,
  41171, 45529, 50339, 55649, 61512, 67983, 75127, 83014, 91721, 101333,
  111945, 123660, 136594, 150872, 166636, 184040, 203254, 224466, 247886, 273742,
  302288, 333804, 368599, 407015, 449428, 496254, 547953, 605032, 668051, 737627,
  814445, 899257, 992895, 1096278, 1210421, 1336443, 1475581, 1629200, 1798808, 1986068,
  2192818, 2421087, 2673114, 2951373, 3258594, 3597792, 3972294, 4385776, 4842295, 5346332,
  5902831, 6517253, 7195629, 7944614, 8771558, 9684577, 10692629, 11805606, 13034431
]

// Color constants for visual testing
export const TEST_COLORS = {
  PLAYER: { r: 0, g: 0, b: 255, name: 'blue' },
  GOBLIN: { r: 0, g: 255, b: 0, name: 'green' },
  BANDIT: { r: 255, g: 165, b: 0, name: 'orange' },
  ITEM: { r: 255, g: 255, b: 0, name: 'yellow' },
  BUILDING: { r: 139, g: 69, b: 19, name: 'brown' },
  RESOURCE: { r: 128, g: 128, b: 128, name: 'gray' },
  DEATH: { r: 255, g: 0, b: 0, name: 'red' },
  SPAWN: { r: 255, g: 255, b: 255, name: 'white' }
} as const

// Default game constants
export const GAME_CONSTANTS = {
  INVENTORY_SIZE: 28,
  RESPAWN_TIME: 30000, // 30 seconds
  COMBAT_TICK_RATE: 600, // 0.6 seconds per attack
  MAX_STACK_SIZE: 2147483647,
  STARTING_HEALTH: 100,
  STARTING_LEVEL: 1,
  MAX_LEVEL: 99,
  TILE_SIZE: 1, // World grid tile size
  AGGRO_RANGE: 8,
  FOLLOW_RANGE: 12,
  INTERACTION_RANGE: 2,
  VISUAL_RANGE: 50
} as const