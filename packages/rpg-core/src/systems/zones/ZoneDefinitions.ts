/**
 * Zone Definitions - World areas and their properties
 * Based on RuneScape world layout with different regions
 */

import { ResourceType } from '../resources/ResourceDefinitions'
import { SkillType } from '../skills/SkillDefinitions'

export enum ZoneType {
  LUMBRIDGE = 'lumbridge',
  DRAYNOR = 'draynor',
  VARROCK = 'varrock',
  FALADOR = 'falador',
  BARBARIAN_VILLAGE = 'barbarian_village',
  WILDERNESS = 'wilderness',
  KARAMJA = 'karamja',
  CAMELOT = 'camelot',
  RESOURCE_FOREST = 'resource_forest',
  MINING_GUILD = 'mining_guild',
  FISHING_GUILD = 'fishing_guild',
}

export interface ZoneBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  minY?: number
  maxY?: number
}

export interface ResourceDistribution {
  resourceType: ResourceType
  density: number // 0-1, how common this resource is in the zone
  minLevel: number // minimum level to find this resource here
  clusterSize: {
    // how resources group together
    min: number
    max: number
  }
  preferredAreas?: {
    // specific areas within zone where this spawns more
    centerX: number
    centerZ: number
    radius: number
    densityMultiplier: number
  }[]
}

export interface NPCSpawnInfo {
  npcId: number
  name: string
  level: number
  density: number // spawns per 100 tiles
  aggressive: boolean
  maxSpawns: number // max simultaneous spawns in zone
}

export interface ZoneFeatures {
  hasBank: boolean
  hasShops: boolean
  hasTeleport: boolean
  pvpEnabled: boolean
  safeZone: boolean
  skillMultipliers?: Partial<Record<SkillType, number>> // XP multipliers
  environmentEffects?: string[] // weather, lighting, etc.
}

export interface ZoneDefinition {
  type: ZoneType
  name: string
  description: string
  bounds: ZoneBounds

  // Visual and environmental
  theme: 'grassland' | 'forest' | 'desert' | 'swamp' | 'mountain' | 'city' | 'wilderness'
  skyColor: string
  fogColor: string
  ambientLight: number // 0-1

  // Gameplay features
  features: ZoneFeatures

  // Resource distribution
  resources: ResourceDistribution[]

  // NPC spawns
  npcs: NPCSpawnInfo[]

  // Connected zones (for travel/borders)
  connections: {
    zoneType: ZoneType
    entryPoint: { x: number; z: number }
    exitPoint: { x: number; z: number }
  }[]

  // Special locations within the zone
  landmarks: {
    name: string
    x: number
    z: number
    type: 'bank' | 'shop' | 'quest' | 'teleport' | 'dungeon' | 'building'
    description: string
  }[]
}

export const ZONE_DEFINITIONS: Record<ZoneType, ZoneDefinition> = {
  [ZoneType.LUMBRIDGE]: {
    type: ZoneType.LUMBRIDGE,
    name: 'Lumbridge',
    description: 'A peaceful town perfect for beginners',
    bounds: {
      minX: -50,
      maxX: 50,
      minZ: -50,
      maxZ: 50,
    },
    theme: 'grassland',
    skyColor: '#87CEEB',
    fogColor: '#F0F8FF',
    ambientLight: 0.8,
    features: {
      hasBank: true,
      hasShops: true,
      hasTeleport: true,
      pvpEnabled: false,
      safeZone: true,
      skillMultipliers: {
        [SkillType.COOKING]: 1.1, // Slightly faster cooking in town
      },
    },
    resources: [
      {
        resourceType: ResourceType.TREE_NORMAL,
        density: 0.3,
        minLevel: 1,
        clusterSize: { min: 2, max: 5 },
        preferredAreas: [{ centerX: -20, centerZ: 20, radius: 15, densityMultiplier: 2.0 }],
      },
      {
        resourceType: ResourceType.FISHING_NET,
        density: 0.1,
        minLevel: 1,
        clusterSize: { min: 1, max: 2 },
        preferredAreas: [{ centerX: 0, centerZ: -30, radius: 10, densityMultiplier: 3.0 }],
      },
      {
        resourceType: ResourceType.ROCK_CLAY,
        density: 0.05,
        minLevel: 1,
        clusterSize: { min: 1, max: 3 },
      },
    ],
    npcs: [
      {
        npcId: 1, // Goblin
        name: 'Goblin',
        level: 2,
        density: 0.02,
        aggressive: false,
        maxSpawns: 5,
      },
      {
        npcId: 4, // Cow
        name: 'Cow',
        level: 1,
        density: 0.03,
        aggressive: false,
        maxSpawns: 8,
      },
    ],
    connections: [
      {
        zoneType: ZoneType.DRAYNOR,
        entryPoint: { x: -45, z: 0 },
        exitPoint: { x: 45, z: 0 },
      },
      {
        zoneType: ZoneType.VARROCK,
        entryPoint: { x: 45, z: 0 },
        exitPoint: { x: -45, z: 0 },
      },
    ],
    landmarks: [
      {
        name: 'Lumbridge Castle',
        x: 0,
        z: 0,
        type: 'building',
        description: 'The iconic castle where new adventurers begin',
      },
      {
        name: 'Lumbridge Bank',
        x: -10,
        z: -10,
        type: 'bank',
        description: 'Store your items safely',
      },
      {
        name: 'General Store',
        x: 15,
        z: -5,
        type: 'shop',
        description: 'Buy and sell basic items',
      },
    ],
  },

  [ZoneType.DRAYNOR]: {
    type: ZoneType.DRAYNOR,
    name: 'Draynor Village',
    description: 'A village known for its willow trees and fishing spots',
    bounds: {
      minX: -150,
      maxX: -50,
      minZ: -50,
      maxZ: 50,
    },
    theme: 'grassland',
    skyColor: '#87CEEB',
    fogColor: '#F5F5DC',
    ambientLight: 0.7,
    features: {
      hasBank: true,
      hasShops: true,
      hasTeleport: false,
      pvpEnabled: false,
      safeZone: true,
      skillMultipliers: {
        [SkillType.WOODCUTTING]: 1.1,
        [SkillType.FISHING]: 1.1,
      },
    },
    resources: [
      {
        resourceType: ResourceType.TREE_WILLOW,
        density: 0.4,
        minLevel: 30,
        clusterSize: { min: 3, max: 8 },
        preferredAreas: [{ centerX: -100, centerZ: -20, radius: 20, densityMultiplier: 3.0 }],
      },
      {
        resourceType: ResourceType.TREE_NORMAL,
        density: 0.2,
        minLevel: 1,
        clusterSize: { min: 2, max: 4 },
      },
      {
        resourceType: ResourceType.FISHING_NET,
        density: 0.2,
        minLevel: 1,
        clusterSize: { min: 2, max: 4 },
        preferredAreas: [{ centerX: -80, centerZ: 30, radius: 15, densityMultiplier: 2.5 }],
      },
      {
        resourceType: ResourceType.FISHING_BAIT,
        density: 0.1,
        minLevel: 20,
        clusterSize: { min: 1, max: 2 },
      },
    ],
    npcs: [
      {
        npcId: 1, // Goblin
        name: 'Goblin',
        level: 5,
        density: 0.01,
        aggressive: false,
        maxSpawns: 3,
      },
      {
        npcId: 6, // Dark Wizard
        name: 'Dark Wizard',
        level: 7,
        density: 0.005,
        aggressive: true,
        maxSpawns: 2,
      },
    ],
    connections: [
      {
        zoneType: ZoneType.LUMBRIDGE,
        entryPoint: { x: -55, z: 0 },
        exitPoint: { x: -45, z: 0 },
      },
      {
        zoneType: ZoneType.BARBARIAN_VILLAGE,
        entryPoint: { x: -100, z: -45 },
        exitPoint: { x: 0, z: 45 },
      },
    ],
    landmarks: [
      {
        name: 'Draynor Bank',
        x: -90,
        z: 0,
        type: 'bank',
        description: 'Village bank near the market',
      },
      {
        name: 'Willow Grove',
        x: -100,
        z: -20,
        type: 'quest',
        description: 'Dense cluster of willow trees',
      },
      {
        name: 'Fishing Dock',
        x: -80,
        z: 30,
        type: 'quest',
        description: 'Popular fishing spot',
      },
    ],
  },

  [ZoneType.VARROCK]: {
    type: ZoneType.VARROCK,
    name: 'Varrock',
    description: 'A bustling city with shops, smithing, and mining',
    bounds: {
      minX: 50,
      maxX: 150,
      minZ: -50,
      maxZ: 50,
    },
    theme: 'city',
    skyColor: '#696969',
    fogColor: '#A9A9A9',
    ambientLight: 0.6,
    features: {
      hasBank: true,
      hasShops: true,
      hasTeleport: true,
      pvpEnabled: false,
      safeZone: true,
      skillMultipliers: {
        [SkillType.SMITHING]: 1.2,
        [SkillType.MINING]: 1.1,
      },
    },
    resources: [
      {
        resourceType: ResourceType.ROCK_IRON,
        density: 0.3,
        minLevel: 15,
        clusterSize: { min: 2, max: 5 },
        preferredAreas: [{ centerX: 120, centerZ: -30, radius: 15, densityMultiplier: 2.5 }],
      },
      {
        resourceType: ResourceType.ROCK_COAL,
        density: 0.2,
        minLevel: 30,
        clusterSize: { min: 1, max: 3 },
      },
      {
        resourceType: ResourceType.ROCK_COPPER,
        density: 0.15,
        minLevel: 1,
        clusterSize: { min: 2, max: 4 },
      },
      {
        resourceType: ResourceType.ROCK_TIN,
        density: 0.15,
        minLevel: 1,
        clusterSize: { min: 2, max: 4 },
      },
      {
        resourceType: ResourceType.TREE_OAK,
        density: 0.1,
        minLevel: 15,
        clusterSize: { min: 1, max: 3 },
      },
    ],
    npcs: [
      {
        npcId: 2, // Guard
        name: 'Guard',
        level: 21,
        density: 0.02,
        aggressive: false,
        maxSpawns: 8,
      },
      {
        npcId: 1, // Goblin
        name: 'Goblin',
        level: 8,
        density: 0.01,
        aggressive: false,
        maxSpawns: 3,
      },
    ],
    connections: [
      {
        zoneType: ZoneType.LUMBRIDGE,
        entryPoint: { x: 55, z: 0 },
        exitPoint: { x: 45, z: 0 },
      },
      {
        zoneType: ZoneType.WILDERNESS,
        entryPoint: { x: 100, z: 45 },
        exitPoint: { x: 0, z: -45 },
      },
    ],
    landmarks: [
      {
        name: 'Varrock Bank (West)',
        x: 80,
        z: 10,
        type: 'bank',
        description: 'Main city bank',
      },
      {
        name: 'Varrock Bank (East)',
        x: 120,
        z: 0,
        type: 'bank',
        description: 'Bank near the mines',
      },
      {
        name: 'Sword Shop',
        x: 90,
        z: -10,
        type: 'shop',
        description: 'Buy weapons and armor',
      },
      {
        name: 'Rune Shop',
        x: 75,
        z: 20,
        type: 'shop',
        description: 'Purchase magic runes',
      },
      {
        name: 'Mining Site',
        x: 120,
        z: -30,
        type: 'quest',
        description: 'Rich deposits of iron and coal',
      },
    ],
  },

  [ZoneType.FALADOR]: {
    type: ZoneType.FALADOR,
    name: 'Falador',
    description: 'The white knights city with advanced crafting facilities',
    bounds: {
      minX: -150,
      maxX: -50,
      minZ: 50,
      maxZ: 150,
    },
    theme: 'city',
    skyColor: '#F0F8FF',
    fogColor: '#FFFFFF',
    ambientLight: 0.9,
    features: {
      hasBank: true,
      hasShops: true,
      hasTeleport: true,
      pvpEnabled: false,
      safeZone: true,
      skillMultipliers: {
        [SkillType.CRAFTING]: 1.2,
        [SkillType.SMITHING]: 1.1,
        [SkillType.PRAYER]: 1.1,
      },
    },
    resources: [
      {
        resourceType: ResourceType.TREE_MAPLE,
        density: 0.1,
        minLevel: 45,
        clusterSize: { min: 1, max: 2 },
      },
      {
        resourceType: ResourceType.TREE_OAK,
        density: 0.2,
        minLevel: 15,
        clusterSize: { min: 2, max: 4 },
      },
      {
        resourceType: ResourceType.ROCK_GOLD,
        density: 0.05,
        minLevel: 40,
        clusterSize: { min: 1, max: 2 },
        preferredAreas: [{ centerX: -80, centerZ: 120, radius: 10, densityMultiplier: 3.0 }],
      },
    ],
    npcs: [
      {
        npcId: 5, // White Knight
        name: 'White Knight',
        level: 38,
        density: 0.02,
        aggressive: false,
        maxSpawns: 6,
      },
    ],
    connections: [
      {
        zoneType: ZoneType.BARBARIAN_VILLAGE,
        entryPoint: { x: -100, z: 55 },
        exitPoint: { x: 0, z: -45 },
      },
    ],
    landmarks: [
      {
        name: 'Falador Bank',
        x: -100,
        z: 100,
        type: 'bank',
        description: 'White knights bank',
      },
      {
        name: 'White Knights Castle',
        x: -90,
        z: 90,
        type: 'building',
        description: 'Home of the White Knights',
      },
      {
        name: 'Crafting Guild',
        x: -120,
        z: 120,
        type: 'quest',
        description: 'Advanced crafting facilities',
      },
    ],
  },

  [ZoneType.BARBARIAN_VILLAGE]: {
    type: ZoneType.BARBARIAN_VILLAGE,
    name: 'Barbarian Village',
    description: 'A rough village where warriors train',
    bounds: {
      minX: -50,
      maxX: 50,
      minZ: 50,
      maxZ: 150,
    },
    theme: 'grassland',
    skyColor: '#8B4513',
    fogColor: '#D2B48C',
    ambientLight: 0.7,
    features: {
      hasBank: false,
      hasShops: true,
      hasTeleport: false,
      pvpEnabled: false,
      safeZone: false,
      skillMultipliers: {
        [SkillType.ATTACK]: 1.1,
        [SkillType.STRENGTH]: 1.1,
        [SkillType.DEFENCE]: 1.1,
      },
    },
    resources: [
      {
        resourceType: ResourceType.TREE_NORMAL,
        density: 0.3,
        minLevel: 1,
        clusterSize: { min: 3, max: 6 },
      },
      {
        resourceType: ResourceType.TREE_OAK,
        density: 0.1,
        minLevel: 15,
        clusterSize: { min: 1, max: 3 },
      },
      {
        resourceType: ResourceType.FISHING_BAIT,
        density: 0.15,
        minLevel: 20,
        clusterSize: { min: 1, max: 2 },
      },
    ],
    npcs: [
      {
        npcId: 7, // Barbarian
        name: 'Barbarian',
        level: 12,
        density: 0.03,
        aggressive: true,
        maxSpawns: 6,
      },
    ],
    connections: [
      {
        zoneType: ZoneType.DRAYNOR,
        entryPoint: { x: 0, z: 55 },
        exitPoint: { x: -100, z: -45 },
      },
      {
        zoneType: ZoneType.FALADOR,
        entryPoint: { x: 0, z: 145 },
        exitPoint: { x: -100, z: 55 },
      },
    ],
    landmarks: [
      {
        name: 'Barbarian Outpost',
        x: 0,
        z: 100,
        type: 'building',
        description: 'Where barbarians gather and train',
      },
      {
        name: 'Weapon Shop',
        x: -10,
        z: 110,
        type: 'shop',
        description: 'Rough weapons for warriors',
      },
    ],
  },

  [ZoneType.WILDERNESS]: {
    type: ZoneType.WILDERNESS,
    name: 'The Wilderness',
    description: 'A dangerous wasteland where players can attack each other',
    bounds: {
      minX: 50,
      maxX: 200,
      minZ: 50,
      maxZ: 200,
    },
    theme: 'wilderness',
    skyColor: '#8B0000',
    fogColor: '#696969',
    ambientLight: 0.4,
    features: {
      hasBank: false,
      hasShops: false,
      hasTeleport: false,
      pvpEnabled: true,
      safeZone: false,
      skillMultipliers: {
        [SkillType.MINING]: 1.5,
        [SkillType.WOODCUTTING]: 1.3,
      },
      environmentEffects: ['darkness', 'fog', 'danger'],
    },
    resources: [
      {
        resourceType: ResourceType.TREE_YEW,
        density: 0.02,
        minLevel: 60,
        clusterSize: { min: 1, max: 2 },
      },
      {
        resourceType: ResourceType.TREE_MAGIC,
        density: 0.005,
        minLevel: 75,
        clusterSize: { min: 1, max: 1 },
      },
      {
        resourceType: ResourceType.ROCK_MITHRIL,
        density: 0.08,
        minLevel: 55,
        clusterSize: { min: 1, max: 3 },
      },
      {
        resourceType: ResourceType.ROCK_ADAMANT,
        density: 0.03,
        minLevel: 70,
        clusterSize: { min: 1, max: 2 },
      },
      {
        resourceType: ResourceType.ROCK_RUNITE,
        density: 0.01,
        minLevel: 85,
        clusterSize: { min: 1, max: 1 },
        preferredAreas: [{ centerX: 150, centerZ: 150, radius: 20, densityMultiplier: 5.0 }],
      },
    ],
    npcs: [
      {
        npcId: 8, // Skeleton
        name: 'Skeleton',
        level: 25,
        density: 0.04,
        aggressive: true,
        maxSpawns: 15,
      },
      {
        npcId: 9, // Greater Demon
        name: 'Greater Demon',
        level: 87,
        density: 0.005,
        aggressive: true,
        maxSpawns: 2,
      },
    ],
    connections: [
      {
        zoneType: ZoneType.VARROCK,
        entryPoint: { x: 55, z: 55 },
        exitPoint: { x: 100, z: 45 },
      },
    ],
    landmarks: [
      {
        name: 'Runite Rocks',
        x: 150,
        z: 150,
        type: 'quest',
        description: 'Extremely rare runite deposits',
      },
      {
        name: 'Dark Altar',
        x: 125,
        z: 125,
        type: 'quest',
        description: 'Mysterious altar with dark energy',
      },
    ],
  },

  [ZoneType.RESOURCE_FOREST]: {
    type: ZoneType.RESOURCE_FOREST,
    name: 'Resource Forest',
    description: 'A dense forest rich with trees of all kinds',
    bounds: {
      minX: -50,
      maxX: 50,
      minZ: 150,
      maxZ: 250,
    },
    theme: 'forest',
    skyColor: '#228B22',
    fogColor: '#90EE90',
    ambientLight: 0.6,
    features: {
      hasBank: false,
      hasShops: false,
      hasTeleport: false,
      pvpEnabled: false,
      safeZone: true,
      skillMultipliers: {
        [SkillType.WOODCUTTING]: 1.5,
      },
    },
    resources: [
      {
        resourceType: ResourceType.TREE_NORMAL,
        density: 0.6,
        minLevel: 1,
        clusterSize: { min: 5, max: 10 },
      },
      {
        resourceType: ResourceType.TREE_OAK,
        density: 0.4,
        minLevel: 15,
        clusterSize: { min: 3, max: 7 },
      },
      {
        resourceType: ResourceType.TREE_WILLOW,
        density: 0.3,
        minLevel: 30,
        clusterSize: { min: 2, max: 5 },
      },
      {
        resourceType: ResourceType.TREE_MAPLE,
        density: 0.15,
        minLevel: 45,
        clusterSize: { min: 1, max: 3 },
      },
      {
        resourceType: ResourceType.TREE_YEW,
        density: 0.05,
        minLevel: 60,
        clusterSize: { min: 1, max: 2 },
      },
      {
        resourceType: ResourceType.TREE_MAGIC,
        density: 0.01,
        minLevel: 75,
        clusterSize: { min: 1, max: 1 },
      },
    ],
    npcs: [
      {
        npcId: 10, // Ent
        name: 'Tree Spirit',
        level: 95,
        density: 0.002,
        aggressive: true,
        maxSpawns: 1,
      },
    ],
    connections: [],
    landmarks: [
      {
        name: 'Ancient Grove',
        x: 0,
        z: 200,
        type: 'quest',
        description: 'Where the oldest trees grow',
      },
    ],
  },

  [ZoneType.MINING_GUILD]: {
    type: ZoneType.MINING_GUILD,
    name: 'Mining Guild',
    description: 'An exclusive area for skilled miners',
    bounds: {
      minX: 150,
      maxX: 200,
      minZ: -100,
      maxZ: -50,
    },
    theme: 'mountain',
    skyColor: '#696969',
    fogColor: '#2F4F4F',
    ambientLight: 0.5,
    features: {
      hasBank: true,
      hasShops: true,
      hasTeleport: false,
      pvpEnabled: false,
      safeZone: true,
      skillMultipliers: {
        [SkillType.MINING]: 2.0,
      },
    },
    resources: [
      {
        resourceType: ResourceType.ROCK_COAL,
        density: 0.8,
        minLevel: 30,
        clusterSize: { min: 5, max: 10 },
      },
      {
        resourceType: ResourceType.ROCK_MITHRIL,
        density: 0.3,
        minLevel: 55,
        clusterSize: { min: 2, max: 5 },
      },
      {
        resourceType: ResourceType.ROCK_ADAMANT,
        density: 0.1,
        minLevel: 70,
        clusterSize: { min: 1, max: 3 },
      },
    ],
    npcs: [],
    connections: [],
    landmarks: [
      {
        name: 'Mining Guild Bank',
        x: 175,
        z: -75,
        type: 'bank',
        description: 'Exclusive bank for guild members',
      },
      {
        name: 'Pickaxe Shop',
        x: 170,
        z: -80,
        type: 'shop',
        description: 'High quality mining equipment',
      },
    ],
  },

  [ZoneType.FISHING_GUILD]: {
    type: ZoneType.FISHING_GUILD,
    name: 'Fishing Guild',
    description: 'Premium fishing spots for experienced anglers',
    bounds: {
      minX: -200,
      maxX: -150,
      minZ: -100,
      maxZ: -50,
    },
    theme: 'grassland',
    skyColor: '#87CEEB',
    fogColor: '#E0F6FF',
    ambientLight: 0.8,
    features: {
      hasBank: true,
      hasShops: true,
      hasTeleport: false,
      pvpEnabled: false,
      safeZone: true,
      skillMultipliers: {
        [SkillType.FISHING]: 2.0,
      },
    },
    resources: [
      {
        resourceType: ResourceType.FISHING_CAGE,
        density: 0.5,
        minLevel: 40,
        clusterSize: { min: 3, max: 6 },
      },
      {
        resourceType: ResourceType.FISHING_HARPOON,
        density: 0.3,
        minLevel: 50,
        clusterSize: { min: 2, max: 4 },
      },
    ],
    npcs: [],
    connections: [],
    landmarks: [
      {
        name: 'Fishing Guild Bank',
        x: -175,
        z: -75,
        type: 'bank',
        description: 'Bank with fish storage',
      },
      {
        name: 'Fishing Shop',
        x: -170,
        z: -80,
        type: 'shop',
        description: 'Premium fishing equipment',
      },
    ],
  },

  [ZoneType.KARAMJA]: {
    type: ZoneType.KARAMJA,
    name: 'Karamja',
    description: 'A tropical island with dangerous jungle and volcano',
    bounds: {
      minX: 200,
      maxX: 300,
      minZ: -200,
      maxZ: -100,
    },
    theme: 'forest',
    skyColor: '#87CEEB',
    fogColor: '#E0E0E0',
    ambientLight: 0.8,
    features: {
      hasBank: false,
      hasShops: true,
      hasTeleport: false,
      pvpEnabled: false,
      safeZone: false,
      skillMultipliers: {
        [SkillType.FISHING]: 1.2,
        [SkillType.WOODCUTTING]: 1.1,
      },
    },
    resources: [
      {
        resourceType: ResourceType.TREE_NORMAL,
        density: 0.5,
        minLevel: 1,
        clusterSize: { min: 3, max: 6 },
      },
      {
        resourceType: ResourceType.TREE_WILLOW,
        density: 0.2,
        minLevel: 30,
        clusterSize: { min: 1, max: 3 },
      },
      {
        resourceType: ResourceType.FISHING_CAGE,
        density: 0.4,
        minLevel: 40,
        clusterSize: { min: 2, max: 4 },
      },
    ],
    npcs: [
      {
        npcId: 11, // Jungle spider
        name: 'Jungle Spider',
        level: 44,
        density: 0.03,
        aggressive: true,
        maxSpawns: 8,
      },
    ],
    connections: [],
    landmarks: [
      {
        name: 'Karamja Volcano',
        x: 250,
        z: -150,
        type: 'dungeon',
        description: 'Entrance to a dangerous volcano',
      },
      {
        name: 'General Store',
        x: 220,
        z: -120,
        type: 'shop',
        description: 'Basic supplies for adventurers',
      },
    ],
  },

  [ZoneType.CAMELOT]: {
    type: ZoneType.CAMELOT,
    name: 'Camelot',
    description: 'A grand castle city ruled by knights',
    bounds: {
      minX: -300,
      maxX: -200,
      minZ: 200,
      maxZ: 300,
    },
    theme: 'city',
    skyColor: '#87CEEB',
    fogColor: '#E0E0E0',
    ambientLight: 0.9,
    features: {
      hasBank: true,
      hasShops: true,
      hasTeleport: true,
      pvpEnabled: false,
      safeZone: true,
      skillMultipliers: {},
    },
    resources: [
      {
        resourceType: ResourceType.TREE_OAK,
        density: 0.2,
        minLevel: 15,
        clusterSize: { min: 1, max: 3 },
      },
    ],
    npcs: [
      {
        npcId: 12, // Knight of Camelot
        name: 'Knight of Camelot',
        level: 48,
        density: 0.02,
        aggressive: false,
        maxSpawns: 5,
      },
    ],
    connections: [],
    landmarks: [
      {
        name: 'Camelot Castle',
        x: -250,
        z: 250,
        type: 'building',
        description: 'The great castle of Camelot',
      },
      {
        name: 'Camelot Bank',
        x: -240,
        z: 240,
        type: 'bank',
        description: 'Royal bank of Camelot',
      },
      {
        name: 'Magic Shop',
        x: -260,
        z: 230,
        type: 'shop',
        description: 'Mystic items and runes',
      },
    ],
  },
}

// Helper functions
export function getZoneAt(x: number, z: number): ZoneDefinition | null {
  for (const zone of Object.values(ZONE_DEFINITIONS)) {
    if (x >= zone.bounds.minX && x <= zone.bounds.maxX && z >= zone.bounds.minZ && z <= zone.bounds.maxZ) {
      return zone
    }
  }
  return null
}

export function getZonesByTheme(theme: string): ZoneDefinition[] {
  return Object.values(ZONE_DEFINITIONS).filter(zone => zone.theme === theme)
}

export function getConnectedZones(zoneType: ZoneType): ZoneType[] {
  const zone = ZONE_DEFINITIONS[zoneType]
  return zone ? zone.connections.map(conn => conn.zoneType) : []
}

export function isInPvPZone(x: number, z: number): boolean {
  const zone = getZoneAt(x, z)
  return zone ? zone.features.pvpEnabled : false
}

export function getSkillMultiplier(x: number, z: number, skill: SkillType): number {
  const zone = getZoneAt(x, z)
  return zone?.features.skillMultipliers?.[skill] || 1.0
}

