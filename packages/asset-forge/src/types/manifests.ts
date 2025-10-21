/**
 * Manifest Types
 * TypeScript definitions for game data manifests loaded from CDN
 */

export type ManifestType = 'items' | 'mobs' | 'npcs' | 'resources' | 'world-areas' | 'biomes' | 'zones' | 'banks' | 'stores'

// Item Manifest
export interface ItemManifest {
  id: string
  name: string
  type: 'weapon' | 'armor' | 'tool' | 'resource' | 'ammunition' | 'consumable' | 'currency'
  quantity: number
  stackable: boolean
  maxStackSize: number
  value: number
  weight: number
  equipSlot: string | null
  weaponType: string | null
  equipable: boolean
  attackType: 'MELEE' | 'RANGED' | null
  description: string
  examine: string
  tradeable: boolean
  rarity: string
  modelPath: string | null
  iconPath: string | null
  healAmount: number
  stats: {
    attack: number
    defense: number
    strength: number
  }
  bonuses: {
    attack: number
    strength: number
    defense: number
    ranged: number
  }
  requirements: {
    level: number
    skills: Record<string, number>
  }
}

// Mob Manifest
export interface MobManifest {
  id: string
  name: string
  description: string
  difficultyLevel: 1 | 2 | 3
  mobType: string
  type: string
  stats: {
    level: number
    attack: number
    strength: number
    defense: number
    constitution: number
    ranged: number
    magic: number
  }
  behavior: {
    aggressive: boolean
    aggroRange: number
    wanderRadius: number
    respawnTime: number
  }
  drops: Array<{
    itemId: string
    quantity: number
    chance: number
    isGuaranteed: boolean
  }>
  spawnBiomes: string[]
  modelPath: string
  respawnTime: number
  xpReward: number
  // Convenience properties for backward compatibility
  level?: number // Alias for stats.level
  combatLevel?: number // Alias for stats.level
}

// NPC Manifest
export interface NPCManifest {
  id: string
  name: string
  description: string
  type: string
  npcType?: string // Alias for type (backward compatibility)
  modelPath: string
  services: string[]
}

// Resource Manifest
export interface ResourceManifest {
  id: string
  name: string
  type: string
  modelPath: string | null
  harvestSkill: string
  requiredLevel: number
  harvestTime: number
  respawnTime: number
  harvestYield: Array<{
    itemId: string
    quantity: number
    chance: number
  }>
}

// World Area Manifest
export interface WorldAreaManifest {
  id: string
  name: string
  description: string
  difficultyLevel: number
  bounds: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
  }
  biomeType: string
  safeZone: boolean
  npcs?: Array<{
    id: string
    name: string
    type: string
    position: { x: number; y: number; z: number }
    services: string[]
    description: string
  }>
  resources?: Array<{
    type: string
    position: { x: number; y: number; z: number }
    resourceId: string
    respawnTime: number
    level: number
  }>
  mobSpawns?: Array<{
    mobId: string
    position: { x: number; y: number; z: number }
    spawnRadius: number
    maxCount: number
    respawnTime: number
  }>
  connections: string[]
  specialFeatures: string[]
}

// Biome Manifest
export interface BiomeManifest {
  id: string
  name: string
  description: string
  terrainType: string
  climate: string
  difficulty: number
  commonResources: string[]
  commonMobs: string[]
  spawnRate: number
}

// Zone Manifest
export interface ZoneManifest {
  id: string
  name: string
  description: string
  level: number
  biomes: string[]
  recommendedSkills: string[]
  dangerLevel: string
}

// Bank Manifest
export interface BankManifest {
  id: string
  name: string
  location: string
  position: { x: number; y: number; z: number }
  services: string[]
}

// Store Manifest
export interface StoreManifest {
  id: string
  name: string
  type: string
  location: string
  position: { x: number; y: number; z: number }
  inventory: Array<{
    itemId: string
    stock: number
    price: number
  }>
}

// Union type for all manifests
export type AnyManifest = 
  | ItemManifest 
  | MobManifest 
  | NPCManifest 
  | ResourceManifest 
  | WorldAreaManifest 
  | BiomeManifest 
  | ZoneManifest 
  | BankManifest 
  | StoreManifest

// Manifest metadata
export interface ManifestInfo {
  type: ManifestType
  label: string
  icon: string
  description: string
  count?: number
}

