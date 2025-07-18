/**
 * Resource Definitions - All harvestable resources in the world
 * Each resource is represented as a colored cube with specific properties
 */

import { SkillType } from '../skills/SkillDefinitions'

export enum ResourceType {
  // Trees (Woodcutting)
  TREE_NORMAL = 'tree_normal',
  TREE_OAK = 'tree_oak',
  TREE_WILLOW = 'tree_willow',
  TREE_MAPLE = 'tree_maple',
  TREE_YEW = 'tree_yew',
  TREE_MAGIC = 'tree_magic',

  // Rocks (Mining)
  ROCK_CLAY = 'rock_clay',
  ROCK_COPPER = 'rock_copper',
  ROCK_TIN = 'rock_tin',
  ROCK_IRON = 'rock_iron',
  ROCK_COAL = 'rock_coal',
  ROCK_GOLD = 'rock_gold',
  ROCK_MITHRIL = 'rock_mithril',
  ROCK_ADAMANT = 'rock_adamant',
  ROCK_RUNITE = 'rock_runite',

  // Fishing Spots
  FISHING_NET = 'fishing_net', // Shrimp, anchovies
  FISHING_BAIT = 'fishing_bait', // Trout, salmon
  FISHING_CAGE = 'fishing_cage', // Lobster
  FISHING_HARPOON = 'fishing_harpoon', // Swordfish, shark
}

export interface ResourceVisual {
  color: string // Hex color for the cube
  scale: number // Size multiplier (1.0 = normal)
  emissive?: string // Emissive color for glowing effects
  metalness?: number // 0-1 for metallic appearance
  roughness?: number // 0-1 for surface roughness
}

export interface ResourceDefinition {
  type: ResourceType
  name: string
  description: string
  skill: SkillType
  levelRequired: number
  baseHarvestTime: number // milliseconds
  respawnTime: number // milliseconds
  visual: ResourceVisual

  // What you get from harvesting
  drops: {
    itemId: number
    name: string
    quantity: { min: number; max: number }
    chance: number // 0-1
    xp: number
  }[]

  // Tool requirements
  toolRequired?: number // Item ID of required tool

  // Depletion (some resources disappear after harvesting)
  depletes: boolean

  // Rarity in world generation
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare'
}

export const RESOURCE_DEFINITIONS: Record<ResourceType, ResourceDefinition> = {
  // Trees (Woodcutting)
  [ResourceType.TREE_NORMAL]: {
    type: ResourceType.TREE_NORMAL,
    name: 'Tree',
    description: 'A common tree found throughout the world',
    skill: SkillType.WOODCUTTING,
    levelRequired: 1,
    baseHarvestTime: 3000,
    respawnTime: 30000, // 30 seconds
    visual: {
      color: '#8B4513', // Brown
      scale: 1.2,
      roughness: 0.8,
    },
    drops: [
      {
        itemId: 1511, // Logs
        name: 'Logs',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 25,
      },
    ],
    toolRequired: 1351, // Bronze axe
    depletes: true,
    rarity: 'common',
  },

  [ResourceType.TREE_OAK]: {
    type: ResourceType.TREE_OAK,
    name: 'Oak Tree',
    description: 'A sturdy oak tree',
    skill: SkillType.WOODCUTTING,
    levelRequired: 15,
    baseHarvestTime: 4000,
    respawnTime: 45000,
    visual: {
      color: '#654321', // Darker brown
      scale: 1.4,
      roughness: 0.7,
    },
    drops: [
      {
        itemId: 1521, // Oak logs
        name: 'Oak Logs',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 37.5,
      },
    ],
    toolRequired: 1351,
    depletes: true,
    rarity: 'uncommon',
  },

  [ResourceType.TREE_WILLOW]: {
    type: ResourceType.TREE_WILLOW,
    name: 'Willow Tree',
    description: 'A graceful willow tree',
    skill: SkillType.WOODCUTTING,
    levelRequired: 30,
    baseHarvestTime: 3500,
    respawnTime: 60000,
    visual: {
      color: '#9ACD32', // Yellow-green
      scale: 1.3,
      roughness: 0.6,
    },
    drops: [
      {
        itemId: 1519, // Willow logs
        name: 'Willow Logs',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 67.5,
      },
    ],
    toolRequired: 1351,
    depletes: false, // Willows don't deplete completely
    rarity: 'uncommon',
  },

  [ResourceType.TREE_MAPLE]: {
    type: ResourceType.TREE_MAPLE,
    name: 'Maple Tree',
    description: 'A colorful maple tree',
    skill: SkillType.WOODCUTTING,
    levelRequired: 45,
    baseHarvestTime: 5000,
    respawnTime: 90000,
    visual: {
      color: '#FF8C00', // Dark orange
      scale: 1.5,
      roughness: 0.5,
    },
    drops: [
      {
        itemId: 1517, // Maple logs
        name: 'Maple Logs',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 100,
      },
    ],
    toolRequired: 1351,
    depletes: true,
    rarity: 'rare',
  },

  [ResourceType.TREE_YEW]: {
    type: ResourceType.TREE_YEW,
    name: 'Yew Tree',
    description: 'An ancient yew tree',
    skill: SkillType.WOODCUTTING,
    levelRequired: 60,
    baseHarvestTime: 8000,
    respawnTime: 180000, // 3 minutes
    visual: {
      color: '#006400', // Dark green
      scale: 1.8,
      roughness: 0.4,
    },
    drops: [
      {
        itemId: 1515, // Yew logs
        name: 'Yew Logs',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 175,
      },
    ],
    toolRequired: 1351,
    depletes: false,
    rarity: 'very_rare',
  },

  [ResourceType.TREE_MAGIC]: {
    type: ResourceType.TREE_MAGIC,
    name: 'Magic Tree',
    description: 'A mysterious magic tree that glows with power',
    skill: SkillType.WOODCUTTING,
    levelRequired: 75,
    baseHarvestTime: 12000,
    respawnTime: 300000, // 5 minutes
    visual: {
      color: '#8A2BE2', // Blue violet
      scale: 2.0,
      emissive: '#4B0082',
      roughness: 0.2,
    },
    drops: [
      {
        itemId: 1513, // Magic logs
        name: 'Magic Logs',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 250,
      },
    ],
    toolRequired: 1351,
    depletes: false,
    rarity: 'very_rare',
  },

  // Rocks (Mining)
  [ResourceType.ROCK_CLAY]: {
    type: ResourceType.ROCK_CLAY,
    name: 'Clay Rock',
    description: 'Soft clay deposits',
    skill: SkillType.MINING,
    levelRequired: 1,
    baseHarvestTime: 2000,
    respawnTime: 20000,
    visual: {
      color: '#D2B48C', // Tan
      scale: 0.8,
      roughness: 0.9,
    },
    drops: [
      {
        itemId: 434, // Clay
        name: 'Clay',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 5,
      },
    ],
    toolRequired: 1265, // Bronze pickaxe
    depletes: true,
    rarity: 'common',
  },

  [ResourceType.ROCK_COPPER]: {
    type: ResourceType.ROCK_COPPER,
    name: 'Copper Rock',
    description: 'Copper ore deposits',
    skill: SkillType.MINING,
    levelRequired: 1,
    baseHarvestTime: 3000,
    respawnTime: 30000,
    visual: {
      color: '#B87333', // Copper
      scale: 1.0,
      metalness: 0.7,
      roughness: 0.6,
    },
    drops: [
      {
        itemId: 436, // Copper ore
        name: 'Copper Ore',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 17.5,
      },
    ],
    toolRequired: 1265,
    depletes: true,
    rarity: 'common',
  },

  [ResourceType.ROCK_TIN]: {
    type: ResourceType.ROCK_TIN,
    name: 'Tin Rock',
    description: 'Tin ore deposits',
    skill: SkillType.MINING,
    levelRequired: 1,
    baseHarvestTime: 3000,
    respawnTime: 30000,
    visual: {
      color: '#A8A8A8', // Light gray
      scale: 1.0,
      metalness: 0.6,
      roughness: 0.5,
    },
    drops: [
      {
        itemId: 438, // Tin ore
        name: 'Tin Ore',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 17.5,
      },
    ],
    toolRequired: 1265,
    depletes: true,
    rarity: 'common',
  },

  [ResourceType.ROCK_IRON]: {
    type: ResourceType.ROCK_IRON,
    name: 'Iron Rock',
    description: 'Iron ore deposits',
    skill: SkillType.MINING,
    levelRequired: 15,
    baseHarvestTime: 4000,
    respawnTime: 45000,
    visual: {
      color: '#696969', // Dim gray
      scale: 1.1,
      metalness: 0.8,
      roughness: 0.4,
    },
    drops: [
      {
        itemId: 440, // Iron ore
        name: 'Iron Ore',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 35,
      },
    ],
    toolRequired: 1265,
    depletes: true,
    rarity: 'uncommon',
  },

  [ResourceType.ROCK_COAL]: {
    type: ResourceType.ROCK_COAL,
    name: 'Coal Rock',
    description: 'Coal deposits',
    skill: SkillType.MINING,
    levelRequired: 30,
    baseHarvestTime: 3500,
    respawnTime: 60000,
    visual: {
      color: '#2F4F4F', // Dark slate gray
      scale: 1.0,
      roughness: 0.9,
    },
    drops: [
      {
        itemId: 453, // Coal
        name: 'Coal',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 50,
      },
    ],
    toolRequired: 1265,
    depletes: true,
    rarity: 'uncommon',
  },

  [ResourceType.ROCK_GOLD]: {
    type: ResourceType.ROCK_GOLD,
    name: 'Gold Rock',
    description: 'Precious gold deposits',
    skill: SkillType.MINING,
    levelRequired: 40,
    baseHarvestTime: 5000,
    respawnTime: 90000,
    visual: {
      color: '#FFD700', // Gold
      scale: 0.9,
      metalness: 1.0,
      roughness: 0.1,
      emissive: '#FFD700',
    },
    drops: [
      {
        itemId: 444, // Gold ore
        name: 'Gold Ore',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 65,
      },
    ],
    toolRequired: 1265,
    depletes: true,
    rarity: 'rare',
  },

  [ResourceType.ROCK_MITHRIL]: {
    type: ResourceType.ROCK_MITHRIL,
    name: 'Mithril Rock',
    description: 'Rare mithril deposits',
    skill: SkillType.MINING,
    levelRequired: 55,
    baseHarvestTime: 6000,
    respawnTime: 120000,
    visual: {
      color: '#4169E1', // Royal blue
      scale: 1.2,
      metalness: 0.9,
      roughness: 0.2,
      emissive: '#4169E1',
    },
    drops: [
      {
        itemId: 447, // Mithril ore
        name: 'Mithril Ore',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 80,
      },
    ],
    toolRequired: 1265,
    depletes: true,
    rarity: 'rare',
  },

  [ResourceType.ROCK_ADAMANT]: {
    type: ResourceType.ROCK_ADAMANT,
    name: 'Adamant Rock',
    description: 'Very rare adamant deposits',
    skill: SkillType.MINING,
    levelRequired: 70,
    baseHarvestTime: 8000,
    respawnTime: 180000,
    visual: {
      color: '#228B22', // Forest green
      scale: 1.3,
      metalness: 0.9,
      roughness: 0.15,
      emissive: '#228B22',
    },
    drops: [
      {
        itemId: 449, // Adamant ore
        name: 'Adamant Ore',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 95,
      },
    ],
    toolRequired: 1265,
    depletes: true,
    rarity: 'very_rare',
  },

  [ResourceType.ROCK_RUNITE]: {
    type: ResourceType.ROCK_RUNITE,
    name: 'Runite Rock',
    description: 'Extremely rare runite deposits',
    skill: SkillType.MINING,
    levelRequired: 85,
    baseHarvestTime: 12000,
    respawnTime: 300000,
    visual: {
      color: '#00CED1', // Dark turquoise
      scale: 1.5,
      metalness: 1.0,
      roughness: 0.1,
      emissive: '#00CED1',
    },
    drops: [
      {
        itemId: 451, // Runite ore
        name: 'Runite Ore',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 125,
      },
    ],
    toolRequired: 1265,
    depletes: true,
    rarity: 'very_rare',
  },

  // Fishing Spots
  [ResourceType.FISHING_NET]: {
    type: ResourceType.FISHING_NET,
    name: 'Fishing Spot (Net)',
    description: 'A fishing spot where you can catch fish with a net',
    skill: SkillType.FISHING,
    levelRequired: 1,
    baseHarvestTime: 3000,
    respawnTime: 0, // Fishing spots don't respawn
    visual: {
      color: '#1E90FF', // Dodger blue
      scale: 0.6,
      roughness: 0.1,
      emissive: '#87CEEB',
    },
    drops: [
      {
        itemId: 317, // Shrimp
        name: 'Raw Shrimp',
        quantity: { min: 1, max: 1 },
        chance: 0.8,
        xp: 10,
      },
      {
        itemId: 321, // Anchovies
        name: 'Raw Anchovies',
        quantity: { min: 1, max: 1 },
        chance: 0.2,
        xp: 40,
      },
    ],
    toolRequired: 303, // Small fishing net
    depletes: false,
    rarity: 'common',
  },

  [ResourceType.FISHING_BAIT]: {
    type: ResourceType.FISHING_BAIT,
    name: 'Fishing Spot (Bait)',
    description: 'A fishing spot where you can catch fish with bait',
    skill: SkillType.FISHING,
    levelRequired: 20,
    baseHarvestTime: 4000,
    respawnTime: 0,
    visual: {
      color: '#4682B4', // Steel blue
      scale: 0.7,
      roughness: 0.1,
      emissive: '#B0C4DE',
    },
    drops: [
      {
        itemId: 335, // Trout
        name: 'Raw Trout',
        quantity: { min: 1, max: 1 },
        chance: 0.7,
        xp: 50,
      },
      {
        itemId: 331, // Salmon
        name: 'Raw Salmon',
        quantity: { min: 1, max: 1 },
        chance: 0.3,
        xp: 70,
      },
    ],
    toolRequired: 307, // Fishing rod
    depletes: false,
    rarity: 'uncommon',
  },

  [ResourceType.FISHING_CAGE]: {
    type: ResourceType.FISHING_CAGE,
    name: 'Fishing Spot (Cage)',
    description: 'A fishing spot where you can catch lobsters',
    skill: SkillType.FISHING,
    levelRequired: 40,
    baseHarvestTime: 6000,
    respawnTime: 0,
    visual: {
      color: '#FF6347', // Tomato
      scale: 0.8,
      roughness: 0.1,
      emissive: '#FFA07A',
    },
    drops: [
      {
        itemId: 377, // Lobster
        name: 'Raw Lobster',
        quantity: { min: 1, max: 1 },
        chance: 1.0,
        xp: 90,
      },
    ],
    toolRequired: 301, // Lobster pot
    depletes: false,
    rarity: 'rare',
  },

  [ResourceType.FISHING_HARPOON]: {
    type: ResourceType.FISHING_HARPOON,
    name: 'Fishing Spot (Harpoon)',
    description: 'A deep water fishing spot for large fish',
    skill: SkillType.FISHING,
    levelRequired: 50,
    baseHarvestTime: 8000,
    respawnTime: 0,
    visual: {
      color: '#191970', // Midnight blue
      scale: 1.0,
      roughness: 0.05,
      emissive: '#483D8B',
    },
    drops: [
      {
        itemId: 371, // Swordfish
        name: 'Raw Swordfish',
        quantity: { min: 1, max: 1 },
        chance: 0.6,
        xp: 100,
      },
      {
        itemId: 383, // Shark
        name: 'Raw Shark',
        quantity: { min: 1, max: 1 },
        chance: 0.4,
        xp: 110,
      },
    ],
    toolRequired: 311, // Harpoon
    depletes: false,
    rarity: 'very_rare',
  },
}

// Helper functions
export function getResourcesBySkill(skill: SkillType): ResourceDefinition[] {
  return Object.values(RESOURCE_DEFINITIONS).filter(resource => resource.skill === skill)
}

export function getResourcesByRarity(rarity: string): ResourceDefinition[] {
  return Object.values(RESOURCE_DEFINITIONS).filter(resource => resource.rarity === rarity)
}

export function canHarvestResource(resource: ResourceDefinition, playerLevel: number, hasTool: boolean): boolean {
  return playerLevel >= resource.levelRequired && (hasTool || !resource.toolRequired)
}
