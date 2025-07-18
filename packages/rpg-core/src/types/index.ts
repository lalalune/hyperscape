// Core RPG Type Definitions

// Core type re-exports
export * from '../types'

// Import core types
import type { Component as CoreComponent } from '../types'

// Re-export Entity type from core
// Entity export removed from '../types'

// Skill types
export type SkillType =
  | 'attack'
  | 'strength'
  | 'defense'
  | 'ranged'
  | 'magic'
  | 'prayer'
  | 'hitpoints'
  | 'mining'
  | 'smithing'
  | 'fishing'
  | 'cooking'
  | 'woodcutting'
  | 'firemaking'
  | 'crafting'
  | 'herblore'
  | 'agility'
  | 'thieving'
  | 'slayer'
  | 'farming'
  | 'runecrafting'
  | 'hunter'
  | 'construction'

// Vector types
export interface Vector3 {
  x: number
  y: number
  z: number
}

// Component types
export interface Component {
  type: string
  entityId?: string
  entity?: any
  data?: any
}

// Combat types
export enum CombatStyle {
  ACCURATE = 'accurate',
  AGGRESSIVE = 'aggressive',
  DEFENSIVE = 'defensive',
  CONTROLLED = 'controlled',
  RAPID = 'rapid',
  LONGRANGE = 'longrange',
}

export enum AttackType {
  MELEE = 'melee',
  RANGED = 'ranged',
  MAGIC = 'magic',
}

export enum SpellType {
  WIND_STRIKE = 'wind_strike',
  WATER_STRIKE = 'water_strike',
  EARTH_STRIKE = 'earth_strike',
  FIRE_STRIKE = 'fire_strike',
  WIND_BOLT = 'wind_bolt',
  WATER_BOLT = 'water_bolt',
  EARTH_BOLT = 'earth_bolt',
  FIRE_BOLT = 'fire_bolt',
  WIND_BLAST = 'wind_blast',
  WATER_BLAST = 'water_blast',
  EARTH_BLAST = 'earth_blast',
  FIRE_BLAST = 'fire_blast',
  WIND_WAVE = 'wind_wave',
  WATER_WAVE = 'water_wave',
  EARTH_WAVE = 'earth_wave',
  FIRE_WAVE = 'fire_wave',
  WIND_SURGE = 'wind_surge',
  WATER_SURGE = 'water_surge',
  EARTH_SURGE = 'earth_surge',
  FIRE_SURGE = 'fire_surge',
  CONFUSE = 'confuse',
  WEAKEN = 'weaken',
  CURSE = 'curse',
  BIND = 'bind',
  SNARE = 'snare',
  ENTANGLE = 'entangle',
  STUN = 'stun',
  CHARGE = 'charge',
  BONES_TO_BANANAS = 'bones_to_bananas',
  TELEKINETIC_GRAB = 'telekinetic_grab',
  SUPERHEAT_ITEM = 'superheat_item',
  ENCHANT_CROSSBOW_BOLT = 'enchant_crossbow_bolt',
  CHARGE_WATER_ORB = 'charge_water_orb',
  CHARGE_EARTH_ORB = 'charge_earth_orb',
  CHARGE_FIRE_ORB = 'charge_fire_orb',
  CHARGE_AIR_ORB = 'charge_air_orb'
}

export interface CombatBonuses {
  // Attack bonuses
  attackStab: number
  attackSlash: number
  attackCrush: number
  attackMagic: number
  attackRanged: number

  // Defense bonuses
  defenseStab: number
  defenseSlash: number
  defenseCrush: number
  defenseMagic: number
  defenseRanged: number

  // Other bonuses
  meleeStrength: number
  rangedStrength: number
  magicDamage: number
  prayerBonus: number
}

export interface HitResult {
  damage: number
  type: 'normal' | 'miss' | 'critical'
  attackType: AttackType
  attackerId: string
  targetId: string
  timestamp: number
}

export interface CombatSession {
  id: string
  attackerId: string
  targetId: string
  startTime: number
  lastAttackTime: number
  combatTimer: number
  hits: HitResult[]
}

// Stats types
export interface SkillData {
  level: number
  xp: number
  bonus?: number
  current?: number
  experience?: number
}

export interface StatsComponent extends Component {
  type: 'stats'

  // Combat skills
  hitpoints: {
    current: number
    max: number
    level: number
    xp: number
    experience?: number
  }
  attack: SkillData
  strength: SkillData
  defense: SkillData
  defence?: SkillData  // Alternative spelling for compatibility
  ranged: SkillData
  magic: SkillData
  prayer: {
    level: number
    xp: number
    points: number
    maxPoints: number
    current?: number
    experience?: number
  }

  // Gathering skills
  mining?: SkillData
  fishing?: SkillData
  woodcutting?: SkillData
  firemaking?: SkillData

  // Artisan skills
  smithing?: SkillData
  cooking?: SkillData
  crafting?: SkillData
  fletching?: SkillData
  construction?: SkillData
  herblore?: SkillData

  // Support skills
  agility?: SkillData
  thieving?: SkillData
  slayer?: SkillData
  farming?: SkillData
  runecrafting?: SkillData
  hunter?: SkillData

  // Combat bonuses from equipment
  combatBonuses: CombatBonuses

  // Computed values
  combatLevel: number
  totalLevel: number
}

export interface CombatComponent extends Component {
  type: 'combat'
  entityId?: string
  entity?: any
  data?: any

  inCombat: boolean
  target: string | null
  lastAttackTime: number
  lastAttack?: number
  attackSpeed: number
  attackRange?: number
  combatStyle: CombatStyle
  autoRetaliate: boolean

  // Combat state
  hitSplatQueue: HitSplat[]
  hitSplats?: HitSplat[]
  animationQueue: string[]

  // Special attack
  specialAttackEnergy: number
  specialAttackActive: boolean

  // Protection prayers
  protectionPrayers: {
    melee: boolean
    ranged: boolean
    magic: boolean
  }
}

export interface HitSplat {
  damage: number
  type: 'normal' | 'miss' | 'critical' | 'poison' | 'disease'
  position: Vector3
  timestamp: number
  duration: number
}

// Item and Equipment types
export enum EquipmentSlot {
  HEAD = 'head',
  CAPE = 'cape',
  AMULET = 'amulet',
  WEAPON = 'weapon',
  BODY = 'body',
  SHIELD = 'shield',
  LEGS = 'legs',
  GLOVES = 'gloves',
  BOOTS = 'boots',
  RING = 'ring',
  AMMO = 'ammo',
}

export enum WeaponType {
  DAGGER = 'dagger',
  SWORD = 'sword',
  SCIMITAR = 'scimitar',
  MACE = 'mace',
  AXE = 'axe',
  SPEAR = 'spear',
  HALBERD = 'halberd',
  BOW = 'bow',
  CROSSBOW = 'crossbow',
  STAFF = 'staff',
  WAND = 'wand',
}

export interface ItemDefinition {
  id: number
  name: string
  examine: string
  value: number
  weight: number

  // Properties
  stackable: boolean
  equipable: boolean
  tradeable: boolean
  members: boolean

  // Noting system
  noteable?: boolean
  noted?: boolean
  notedId?: number

  // Equipment data
  equipment?: {
    slot: EquipmentSlot
    requirements: { [skill: string]: SkillData }
    bonuses: CombatBonuses
    weaponType?: WeaponType
    attackSpeed?: number
    twoHanded?: boolean
  }

  // Visual
  model: string
  icon: string
}

export interface ItemStack {
  itemId: number
  quantity: number
  metadata?: any
}

export interface Equipment extends ItemDefinition {
  metadata?: any
}

export interface InventoryComponent extends Component {
  type: 'inventory'

  items: (ItemStack | null)[]
  maxSlots: number

  equipment: {
    [K in EquipmentSlot]: Equipment | null
  }

  totalWeight: number
  equipmentBonuses: CombatBonuses
}

// NPC types
export enum NPCType {
  MONSTER = 'monster',
  QUEST_GIVER = 'quest_giver',
  SHOP = 'shop',
  BANKER = 'banker',
  SKILL_MASTER = 'skill_master',
  SHOPKEEPER = 'shopkeeper',
  GUARD = 'guard',
  BOSS = 'boss',
  ANIMAL = 'animal',
  CITIZEN = 'citizen',
}

export enum ZoneType {
  LUMBRIDGE = 'lumbridge',
  VARROCK = 'varrock',
  FALADOR = 'falador',
  DRAYNOR = 'draynor',
  EDGEVILLE = 'edgeville',
  WILDERNESS = 'wilderness',
  TUTORIAL_ISLAND = 'tutorial_island',
  BARBARIAN_VILLAGE = 'barbarian_village',
  FISHING_GUILD = 'fishing_guild',
  KARAMJA = 'karamja',
  CAMELOT = 'camelot'
}

export enum NPCBehavior {
  AGGRESSIVE = 'aggressive',
  PASSIVE = 'passive',
  FRIENDLY = 'friendly',
  SHOP = 'shop',
  QUEST = 'quest',
  BANKER = 'banker',
  DEFENSIVE = 'defensive',
  WANDER = 'wander',
  PATROL = 'patrol',
  FOLLOW = 'follow',
}

export enum NPCState {
  IDLE = 'idle',
  COMBAT = 'combat',
  FLEEING = 'fleeing',
  DEAD = 'dead',
  WANDERING = 'wandering',
  PATROLLING = 'patrolling',
  RETURNING = 'returning',
}

export interface NPCComponent extends Component {
  type: 'npc'

  npcId: number
  name: string
  examine: string

  // Type and behavior
  npcType: NPCType
  behavior: NPCBehavior
  faction: string

  // State
  state: NPCState
  level: number

  // Combat stats
  combatLevel: number
  maxHitpoints: number
  currentHitpoints: number
  attackStyle: AttackType
  aggressionLevel: number
  aggressionRange: number

  // Combat abilities
  attackBonus: number
  strengthBonus: number
  defenseBonus: number
  maxHit: number
  attackSpeed: number

  // Spawning
  respawnTime: number
  wanderRadius: number
  spawnPoint: Vector3

  // Loot
  lootTable?: string

  // Interaction
  dialogue?: any
  shop?: any
  questGiver?: boolean
  shopkeeper?: boolean
  shopType?: string
  currentTarget: string | null
  lastInteraction: number
}

// Movement types
export interface MovementComponent extends Component {
  type: 'movement'

  position: Vector3
  velocity?: Vector3
  destination: Vector3 | null
  targetPosition: Vector3 | null
  path: Vector3[]
  speed?: number
  currentSpeed: number
  moveSpeed: number
  isMoving: boolean
  canMove: boolean
  runEnergy: number
  isRunning: boolean
  facingDirection: number

  // Pathfinding
  pathfindingFlags: number
  lastMoveTime: number

  // Teleportation
  teleportDestination: Vector3 | null
  teleportTime: number
  teleportAnimation: string
}

// Loot types
export interface ItemDrop {
  itemId: number
  quantity: number
  noted?: boolean
}

export interface LootDrop {
  itemId: number
  quantity: number
  weight: number
  rarity: 'always' | 'common' | 'uncommon' | 'rare' | 'very_rare' | 'ultra_rare'
}

export interface LootEntry {
  itemId: number
  quantity: {
    min: number
    max: number
  }
  weight: number
  noted?: boolean
}

export interface LootTable {
  id: string
  name: string
  description?: string

  drops: LootDrop[]
  rareDropTable: boolean

  // Legacy properties for compatibility
  alwaysDrops?: ItemDrop[]
  commonDrops?: LootEntry[]
  uncommonDrops?: LootEntry[]
  rareDrops?: LootEntry[]

  rareTableAccess?: number
  maxDrops?: number
}

export interface LootComponent extends Component {
  type: 'loot'
  items: LootDrop[]
  owner: string | null
  spawnTime: number
  position: Vector3
  source: string
}

// Entity types
export interface RPGEntity extends Entity {
  // Override components with proper type
  components: Map<string, any>

  // Component methods remain compatible with base Entity but handle the correct types
  getComponent<T extends Component>(type: string): T | null
  hasComponent(type: string): boolean

  // RPG-specific properties
  position: Vector3
}

// Player specific
export interface PlayerEntity extends RPGEntity {
  id: string
  username: string
  displayName: string
  accountType: 'normal' | 'ironman' | 'hardcore_ironman'
  playTime: number
  membershipStatus: boolean

  // Death mechanics
  deathLocation: Vector3 | null
  gravestoneTimer: number

  // PvP
  skullTimer: number
  wildernessLevel: number
  combatZone: 'safe' | 'pvp' | 'wilderness'
}

// NPC Entity
export interface NPCEntity extends RPGEntity {
  spawnPoint: Vector3
  currentTarget: string | null
  deathTime: number

  // AI State
  aiState: 'idle' | 'wandering' | 'chasing' | 'attacking' | 'fleeing' | 'returning'
  stateTimer: number
}

// Item Drop Entity
export interface ItemDropEntity extends RPGEntity {
  itemId: number
  quantity: number
  value: number

  owner: string | null
  ownershipTimer: number
  publicSince: number

  despawnTimer: number
  highlightTimer: number
}

// NPC Definition
export interface NPCDefinition {
  id: number
  name: string
  examine: string
  npcType: NPCType
  behavior: NPCBehavior
  faction?: string
  level?: number
  combatLevel?: number
  maxHitpoints?: number
  attackStyle?: AttackType
  aggressionLevel?: number
  aggressionRange?: number
  combat?: {
    attackBonus: number
    strengthBonus: number
    defenseBonus: number
    maxHit: number
    attackSpeed: number
  }
  lootTable?: string
  respawnTime?: number
  wanderRadius?: number
  moveSpeed?: number
  dialogue?: any
  shop?: {
    name: string
    stock: Array<{ itemId: number; stock: number }>
    currency: string
    buyModifier: number
    sellModifier: number
    restock: boolean
    restockTime: number
  }
  questGiver?: {
    useLLM: boolean
    quests: string[]
    minLevel: number
    maxLevel: number
    questCooldown: number
  }
  skillMaster?: any
}

// Spawning System Types
export enum SpawnerType {
  NPC = 'npc',
  RESOURCE = 'resource',
  CHEST = 'chest',
  BOSS = 'boss',
  EVENT = 'event',
}

export interface SpawnArea {
  type: 'point' | 'circle' | 'rectangle' | 'polygon'

  // Area-specific parameters
  radius?: number // For circle
  width?: number // For rectangle
  height?: number // For rectangle
  vertices?: Vector3[] // For polygon

  // Spawn rules
  avoidOverlap: boolean
  minSpacing: number
  maxHeight: number // Y-axis variance

  // Validation
  isValidPosition(position: Vector3): boolean
  getRandomPosition(): Vector3
}

// Death/Respawn System Types
export interface QuestRequirement {
  questId: string
}

export interface SkillRequirement {
  skill: SkillType
  level: number
}

export enum GravestoneTier {
  BASIC = 'basic',
  WOODEN = 'wooden',
  STONE = 'stone',
  ORNATE = 'ornate',
  ANGEL = 'angel',
  MYSTIC = 'mystic',
  ROYAL = 'royal',
}

export interface Gravestone {
  id: string
  ownerId: string
  position: Vector3
  items: ItemStack[]
  createdAt: number
  expiresAt: number
  tier: GravestoneTier
  blessed: boolean
  blessedBy?: string
}

export interface RespawnPoint {
  id: string
  name: string
  position: Vector3
  requirements?: QuestRequirement | SkillRequirement
  isDefault?: boolean
}

export interface SafeZone {
  id: string
  name: string
  bounds: BoundingBox
  allowPvP: boolean
}

export interface BoundingBox {
  min: Vector3
  max: Vector3
}

export interface DeathConfig {
  // Respawn locations
  defaultRespawnPoint: Vector3
  respawnPoints: Map<string, RespawnPoint>

  // Item protection
  itemsKeptOnDeath: number // Default: 3
  protectItemPrayer: boolean
  skullItemsKept: number // Default: 0

  // Gravestone settings
  gravestoneEnabled: boolean
  gravestoneBaseDuration: number // milliseconds
  gravestoneTierMultipliers: Map<GravestoneTier, number>

  // Safe zones
  safeZones: SafeZone[]

  // Death costs
  freeReclaimThreshold: number // GP value
  reclaimFeePercentage: number // Percentage of item value
}

export interface DeathComponent extends Component {
  type: 'death'

  isDead: boolean
  deathTime: number
  deathLocation: Vector3 | null
  killer: string | null

  // Gravestone
  gravestoneId: string | null
  gravestoneTimer: number

  // Respawn
  respawnPoint: string | null
  respawnTimer: number

  // Item protection
  itemsKeptOnDeath: ItemStack[]
  itemsLostOnDeath: ItemStack[]

  // Death count
  deathCount: number
  lastDeathTime: number
}

export interface ItemValue {
  stack: ItemStack
  value: number
}

// Grand Exchange types
export enum OfferType {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OfferStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  COMPLETE = 'complete',
  CANCELLED = 'cancelled',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  COLLECTED = 'collected',
}

export interface GrandExchangeOffer {
  id: string
  playerId: string
  type: OfferType
  itemId: number
  quantity: number
  pricePerItem: number
  quantityFulfilled: number
  status: OfferStatus
  createdAt: number
  updatedAt: number
  completedAt?: number
  cancelledAt?: number

  // Additional properties for the implementation
  remainingQuantity: number
  completedQuantity: number
  totalSpent?: number
  totalEarned?: number
}

export interface GrandExchangeComponent extends Component {
  type: 'grandExchange'

  offers: GrandExchangeOffer[]
  maxOffers: number
  offerHistory: GrandExchangeOffer[]
  collectItems: ItemStack[]
  collectGold: number
}

export interface MarketData {
  itemId: number
  currentPrice: number
  averagePrice: number
  volume24h: number
  priceChange24h: number
  buyOffers: number
  sellOffers: number
  lastTrade: number
  priceHistory: Array<{
    timestamp: number
    price: number
    volume: number
  }>
}

// Clan System types
export enum ClanRank {
  RECRUIT = 'recruit',
  CORPORAL = 'corporal',
  SERGEANT = 'sergeant',
  LIEUTENANT = 'lieutenant',
  CAPTAIN = 'captain',
  GENERAL = 'general',
  ADMIN = 'admin',
  DEPUTY_OWNER = 'deputy_owner',
  OWNER = 'owner',
}

export interface ClanMember {
  playerId: string
  username: string
  rank: ClanRank
  joinedAt: number
  lastSeen: number
  contributions: number
  clanXp: number
}

export interface Clan {
  id: string
  name: string
  tag: string
  description: string
  owner: string
  created: number
  members: Map<string, ClanMember>
  maxMembers: number
  level: number
  experience: number
  treasury: number

  // Settings
  settings: {
    joinType: 'open' | 'invite' | 'closed'
    minCombatLevel: number
    minTotalLevel: number
    kickInactiveDays: number
    clanColor: string
    motd: string // Message of the day
  }

  // Features
  features: {
    citadel: boolean
    clanWars: boolean
    clanChat: boolean
    events: boolean
  }

  // Permissions by rank
  permissions: Map<ClanRank, ClanPermissions>
}

export interface ClanPermissions {
  invite: boolean
  kick: boolean
  promote: boolean
  demote: boolean
  accessTreasury: boolean
  editSettings: boolean
  startWars: boolean
  editMotd: boolean
  manageCitadel: boolean
}

export interface ClanComponent extends Component {
  type: 'clan'

  clanId: string | null
  rank: ClanRank | null
  invites: string[] // Clan IDs
  joinDate: number
  contributions: number
  clanXp: number
  lastClanChat: number
}

// Clan War types
export interface ClanWar {
  id: string
  clan1Id: string
  clan2Id: string
  startTime?: number
  endTime?: number
  status: 'pending' | 'active' | 'completed'
  rules: ClanWarRules
  scores: {
    clan1: number
    clan2: number
  }
  participants: Map<string, ClanWarParticipant>
  winner?: string
}

export interface ClanWarParticipant {
  playerId: string
  clanId: string
  kills: number
  deaths: number
  damageDealt: number
  healingDone: number
  flagCaptures?: number
}

export interface ClanWarRules {
  duration: number
  allowFood: boolean
  allowPrayer: boolean
  allowSpecial: boolean
  combatLevelRange?: [number, number]
  mapType: 'classic' | 'capture_the_flag' | 'king_of_the_hill'
  respawnDelay: number
  minParticipants: number
  maxParticipants: number
}

// Minigame types
export enum MinigameType {
  CASTLE_WARS = 'castle_wars',
  PEST_CONTROL = 'pest_control',
  FIGHT_CAVES = 'fight_caves',
  BARROWS = 'barrows',
}

export interface Minigame {
  id: string
  name: string
  type: MinigameType
  minPlayers: number
  maxPlayers: number
  duration: number
  requirements?: GameRequirements
  rewards: MinigameRewards
  status: MinigameStatus
}

export enum MinigameStatus {
  WAITING = 'waiting',
  STARTING = 'starting',
  IN_PROGRESS = 'in_progress',
  ENDING = 'ending',
  COMPLETED = 'completed',
}

export interface GameRequirements {
  combatLevel?: number
  skills?: { [skill: string]: number }
  quests?: string[]
  items?: string[]
}

export interface MinigameRewards {
  points: number
  experience?: { [skill: string]: number }
  items?: ItemReward[]
  currency?: { [type: string]: number }
}

export interface ItemReward {
  itemId: number
  quantity: number
  chance: number
}

export interface MinigameSession {
  id: string
  type: MinigameType
  players: string[]
  teams?: Map<string, Team>
  startTime: number
  endTime?: number
  status: 'waiting' | 'in_progress' | 'completed'
  data: any // Game-specific data
}

export interface MinigamePlayer {
  playerId: string
  teamId?: string
  score: number
  stats: any // Game-specific stats
}

export interface Team {
  id: string
  name: string
  color: string
  players: Set<string>
  score: number
}

export interface CastleWarsData {
  saradominScore: number
  zamorakScore: number
  flagCarriers: {
    saradomin: string | null
    zamorak: string | null
  }
  barricades: Array<{
    team: 'saradomin' | 'zamorak'
    position: Vector3
    health: number
  }>
  timeRemaining: number
}

export interface PestControlData {
  portals: Array<{
    id: string
    color: 'purple' | 'blue' | 'yellow' | 'red'
    health: number
    maxHealth: number
    position: Vector3
    shielded: boolean
  }>
  knightHealth: number
  knightMaxHealth: number
  voidKnightPosition: Vector3
  pestCount: number
  waveNumber: number
}

export interface FightCavesData {
  wave: number
  maxWave: number
  enemies: Array<{
    type: 'tz-kih' | 'tz-kek' | 'tok-xil' | 'yt-mejkot' | 'ket-zek' | 'tzTok-jad'
    health: number
    position: Vector3
  }>
  healersSpawned: boolean
  playerDeaths: number
  startSupplies: ItemStack[]
}

export interface BarrowsData {
  cryptsLooted: Array<'ahrim' | 'dharok' | 'guthan' | 'karil' | 'torag' | 'verac'>
  brothersKilled: string[]
  tunnelBrother: string
  rewardPotential: number
  chestLooted: boolean
  tunnelDoors: Map<string, boolean> // Door ID -> is open
}

export interface MinigameComponent extends Component {
  type: 'minigame'

  currentMinigame: MinigameType | null
  sessionId: string | null
  team: string | null

  // Stats
  stats: Map<MinigameType, MinigameStats>

  // Rewards
  points: Map<MinigameType, number>
  unlockedRewards: string[]
}

export interface MinigameStats {
  gamesPlayed: number
  wins: number
  losses: number
  bestScore: number
  totalScore: number
  achievements: string[]
  personalBest: any // Minigame-specific
}

// Construction types
export interface ConstructionRoom {
  id: string
  type: RoomType
  rotation: number // 0, 90, 180, 270 degrees
  level: number // Floor level
  furniture: Map<string, Furniture>
  doors: Map<string, boolean> // Direction -> has door
  hotspots: Map<string, HotspotType>
}

export enum RoomType {
  GARDEN = 'garden',
  PARLOUR = 'parlour',
  KITCHEN = 'kitchen',
  DINING_ROOM = 'dining_room',
  WORKSHOP = 'workshop',
  BEDROOM = 'bedroom',
  HALL = 'hall',
  GAMES_ROOM = 'games_room',
  COMBAT_ROOM = 'combat_room',
  QUEST_HALL = 'quest_hall',
  STUDY = 'study',
  COSTUME_ROOM = 'costume_room',
  CHAPEL = 'chapel',
  PORTAL_CHAMBER = 'portal_chamber',
  FORMAL_GARDEN = 'formal_garden',
  THRONE_ROOM = 'throne_room',
  OUBLIETTE = 'oubliette',
  DUNGEON = 'dungeon',
  TREASURE_ROOM = 'treasure_room',
}

export enum HotspotType {
  DECORATION = 'decoration',
  SEATING = 'seating',
  TABLE = 'table',
  STORAGE = 'storage',
  LIGHTING = 'lighting',
  RUG = 'rug',
  ALTAR = 'altar',
  PORTAL = 'portal',
  GUARD = 'guard',
  TROPHY = 'trophy',
  SKILL = 'skill',
  GAMES = 'games',
  GLORY = 'glory',
}

export interface Furniture {
  id: string
  itemId: number
  name: string
  hotspotType: HotspotType
  level: number
  experience: number
  materials: ItemStack[]
  effects?: FurnitureEffect[]
  interactable: boolean
}

export interface FurnitureEffect {
  type: 'teleport' | 'restore' | 'bank' | 'altar' | 'range' | 'repair' | 'pet_house'
  data: any
}

export interface PlayerHouse {
  id: string
  ownerId: string
  location: 'rimmington' | 'taverley' | 'pollnivneach' | 'hosidius' | 'rellekka' | 'brimhaven' | 'yanille'

  // Layout
  layout: Map<string, ConstructionRoom> // "x,y,z" -> Room
  maxRooms: number
  maxFloors: number

  // Settings
  settings: {
    locked: boolean
    buildMode: boolean
    pvpEnabled: boolean
    teleportInside: boolean
    renderDistance: number
    theme: 'basic' | 'fancy' | 'ancient'
  }

  // Servants
  servant: {
    type: 'none' | 'rick' | 'maid' | 'cook' | 'butler' | 'demon_butler'
    taskQueue: ServantTask[]
    lastPayment: number
  }

  // Visitors
  visitors: string[]
  maxVisitors: number

  // Dungeon
  dungeonMonsters: Array<{
    type: string
    position: Vector3
    respawnTime: number
  }>
}

export interface ServantTask {
  type: 'bank' | 'sawmill' | 'unnote' | 'fetch'
  items: ItemStack[]
  completionTime: number
}

export interface ConstructionComponent extends Component {
  type: 'construction'

  level: number
  experience: number

  // House
  houseId: string | null
  inHouse: boolean
  buildMode: boolean

  // Furniture owned (for flatpacks)
  flatpacks: Map<number, number> // Item ID -> quantity

  // Current build
  currentBuild: {
    roomType: RoomType | null
    position: Vector3 | null
    rotation: number
  } | null
}

// Additional Construction types
export interface HouseLayout {
  rooms: Map<string, ConstructionRoom> // "x,y,z" -> Room
  entrancePosition: Vector3
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
    minZ: number
    maxZ: number
  }
}

export interface RoomGrid {
  x: number
  y: number
  z: number
}

export interface Hotspot {
  type: HotspotType
  position: Vector3
  furnitureId?: string
}

export interface HouseSettings {
  locked: boolean
  buildMode: boolean
  pvpEnabled: boolean
  teleportInside: boolean
  renderDistance: number
  theme: 'basic' | 'fancy' | 'ancient'
  visitors: string[]
  maxVisitors: number
}

export interface MaterialRequirement {
  itemId: number
  quantity: number
}

// Export visual types
export * from './visual.types'

// Additional Grand Exchange types (extending the basic ones already defined)
export interface GrandExchangeTransaction {
  id: string
  buyerId: string
  sellerId: string
  itemId: number
  quantity: number
  price: number
  timestamp: number
  buyOfferId: string
  sellOfferId: string
}

export interface MarketPrice {
  itemId: number
  currentPrice: number
  averagePrice: number
  volume: number
  lastUpdate: number
  change24h: number
}

export interface PriceHistory {
  itemId: number
  data: Array<{
    timestamp: number
    price: number
    volume: number
  }>
}

export interface MarketStats {
  itemId: number
  currentPrice: number
  averagePrice: number
  volume24h: number
  buyOffers: number
  sellOffers: number
  buyVolume: number
  sellVolume: number
  priceChange24h: number
  highPrice24h: number
  lowPrice24h: number
}

// Additional component interfaces for testing scenarios
export interface ResourceComponent extends Component {
  type: 'resource'
  resourceType: string
  resourceId: number
  name: string
  examine: string
  harvestable: boolean
  respawnable: boolean
  health: number
  maxHealth: number
  respawnTime: number
  lastHarvestTime: number
  requirements: {
    skill: string
    level: number
    tool: string
  }
  drops: Array<{
    itemId: number
    quantity: { min: number; max: number }
    chance: number
    experience: number
  }>
  harvestTime: number
  animations: {
    idle: string
    harvest: string
    depleted: string
  }
}

export interface ItemComponent extends Component {
  type: 'item'
  itemId: number
  quantity: number
  owner: string | null
  spawnTime: number
  publicSince: number
  despawnTimer: number
  highlightTimer: number
  noted: boolean
  metadata?: any
}

export interface QuestComponent extends Component {
  type: 'quest'
  activeQuests: Map<string, any>
  completedQuests: Set<string>
  questLog: string[]
  questPoints: number
  lastQuestUpdate: number
}

export interface ConstructionSiteComponent extends Component {
  type: 'construction_site'
  siteId: string
  roomType: RoomType
  position: Vector3
  requirements: {
    level: number
    materials: Array<{ itemId: number; quantity: number }>
    tools: string[]
  }
  buildAttempts: number
  isBuilt: boolean
  canBuild: boolean
  buildTime: number
  experienceReward: number
  availableHotspots: Array<{
    type: HotspotType
    position: Vector3
  }>
}

export interface SkillsComponent extends Component {
  type: 'skills'
  skills: {
    [skillName: string]: {
      level: number
      xp: number
      currentAction: string | null
      lastActionTime: number
      toolEquipped: string | null
      efficiency: number
    }
  }
}
