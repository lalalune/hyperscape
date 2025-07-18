/**
 * Item Definitions - Comprehensive item system for RuneScape-style RPG
 * Defines all items including weapons, armor, consumables, and materials
 */

import { SkillType } from '../skills/SkillDefinitions'

export enum ItemCategory {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  TOOL = 'tool',
  CONSUMABLE = 'consumable',
  MATERIAL = 'material',
  QUEST = 'quest',
  MISC = 'misc',
}

export enum ItemRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  VERY_RARE = 'very_rare',
  ULTRA_RARE = 'ultra_rare',
}

export enum EquipmentSlot {
  WEAPON = 'weapon',
  HELMET = 'helmet',
  BODY = 'body',
  LEGS = 'legs',
  BOOTS = 'boots',
  GLOVES = 'gloves',
  SHIELD = 'shield',
  RING = 'ring',
  AMULET = 'amulet',
  ARROW = 'arrow',
  CAPE = 'cape',
}

export interface ItemRequirement {
  skill: SkillType
  level: number
}

export interface ItemStats {
  attackBonus?: number
  strengthBonus?: number
  defenceBonus?: number
  rangedBonus?: number
  rangedDefence?: number
  magicBonus?: number
  magicDefence?: number
  prayer?: number
  weight?: number
}

export interface ItemDefinition {
  id: string
  name: string
  description: string
  category: ItemCategory
  rarity: ItemRarity
  value: number // Grand Exchange value
  weight: number
  stackable: boolean
  tradeable: boolean

  // Equipment specific
  equipmentSlot?: EquipmentSlot
  requirements?: ItemRequirement[]
  stats?: ItemStats

  // Consumable specific
  consumable?: {
    healAmount?: number
    effects?: Array<{
      skill: SkillType
      boost: number
      duration: number // minutes
    }>
    consumeTime?: number // milliseconds
  }

  // Visual
  visual?: {
    color: string
    model?: string
    texture?: string
  }

  // Production
  production?: {
    skill: SkillType
    level: number
    experience: number
    materials: Array<{
      itemId: string
      quantity: number
    }>
  }
}

// Comprehensive item definitions
export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  // === WEAPONS ===

  // Bronze weapons
  bronze_dagger: {
    id: 'bronze_dagger',
    name: 'Bronze Dagger',
    description: 'A sharp bronze dagger.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.COMMON,
    value: 5,
    weight: 0.5,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.WEAPON,
    requirements: [{ skill: SkillType.ATTACK, level: 1 }],
    stats: {
      attackBonus: 1,
      strengthBonus: 1,
      weight: 0.5,
    },
    visual: {
      color: '#CD7F32',
      model: 'dagger',
    },
  },

  bronze_sword: {
    id: 'bronze_sword',
    name: 'Bronze Sword',
    description: 'A bronze sword.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.COMMON,
    value: 15,
    weight: 1.0,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.WEAPON,
    requirements: [{ skill: SkillType.ATTACK, level: 1 }],
    stats: {
      attackBonus: 3,
      strengthBonus: 2,
      weight: 1.0,
    },
    visual: {
      color: '#CD7F32',
      model: 'sword',
    },
  },

  // Iron weapons
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    description: 'An iron sword.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.COMMON,
    value: 50,
    weight: 1.2,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.WEAPON,
    requirements: [{ skill: SkillType.ATTACK, level: 1 }],
    stats: {
      attackBonus: 10,
      strengthBonus: 9,
      weight: 1.2,
    },
    visual: {
      color: '#C0C0C0',
      model: 'sword',
    },
  },

  // Steel weapons
  steel_sword: {
    id: 'steel_sword',
    name: 'Steel Sword',
    description: 'A steel sword.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.COMMON,
    value: 150,
    weight: 1.4,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.WEAPON,
    requirements: [{ skill: SkillType.ATTACK, level: 5 }],
    stats: {
      attackBonus: 21,
      strengthBonus: 20,
      weight: 1.4,
    },
    visual: {
      color: '#71797E',
      model: 'sword',
    },
  },

  // Mithril weapons
  mithril_sword: {
    id: 'mithril_sword',
    name: 'Mithril Sword',
    description: 'A mithril sword.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.UNCOMMON,
    value: 500,
    weight: 1.0,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.WEAPON,
    requirements: [{ skill: SkillType.ATTACK, level: 20 }],
    stats: {
      attackBonus: 35,
      strengthBonus: 34,
      weight: 1.0,
    },
    visual: {
      color: '#4A90E2',
      model: 'sword',
    },
  },

  // Adamant weapons
  adamant_sword: {
    id: 'adamant_sword',
    name: 'Adamant Sword',
    description: 'An adamant sword.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.RARE,
    value: 1500,
    weight: 1.6,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.WEAPON,
    requirements: [{ skill: SkillType.ATTACK, level: 30 }],
    stats: {
      attackBonus: 50,
      strengthBonus: 49,
      weight: 1.6,
    },
    visual: {
      color: '#50C878',
      model: 'sword',
    },
  },

  // Rune weapons
  rune_sword: {
    id: 'rune_sword',
    name: 'Rune Sword',
    description: 'A rune sword.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.VERY_RARE,
    value: 5000,
    weight: 1.8,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.WEAPON,
    requirements: [{ skill: SkillType.ATTACK, level: 40 }],
    stats: {
      attackBonus: 67,
      strengthBonus: 66,
      weight: 1.8,
    },
    visual: {
      color: '#4169E1',
      model: 'sword',
    },
  },

  // === ARMOR ===

  // Bronze armor
  bronze_helmet: {
    id: 'bronze_helmet',
    name: 'Bronze Helmet',
    description: 'A bronze helmet.',
    category: ItemCategory.ARMOR,
    rarity: ItemRarity.COMMON,
    value: 20,
    weight: 1.0,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.HELMET,
    requirements: [{ skill: SkillType.DEFENCE, level: 1 }],
    stats: {
      defenceBonus: 6,
      weight: 1.0,
    },
    visual: {
      color: '#CD7F32',
      model: 'helmet',
    },
  },

  bronze_platebody: {
    id: 'bronze_platebody',
    name: 'Bronze Platebody',
    description: 'A bronze platebody.',
    category: ItemCategory.ARMOR,
    rarity: ItemRarity.COMMON,
    value: 80,
    weight: 5.0,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.BODY,
    requirements: [{ skill: SkillType.DEFENCE, level: 1 }],
    stats: {
      defenceBonus: 15,
      weight: 5.0,
    },
    visual: {
      color: '#CD7F32',
      model: 'platebody',
    },
  },

  // Iron armor
  iron_helmet: {
    id: 'iron_helmet',
    name: 'Iron Helmet',
    description: 'An iron helmet.',
    category: ItemCategory.ARMOR,
    rarity: ItemRarity.COMMON,
    value: 100,
    weight: 1.2,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.HELMET,
    requirements: [{ skill: SkillType.DEFENCE, level: 1 }],
    stats: {
      defenceBonus: 15,
      weight: 1.2,
    },
    visual: {
      color: '#C0C0C0',
      model: 'helmet',
    },
  },

  // === CONSUMABLES ===

  // Cooked food
  cooked_shrimp: {
    id: 'cooked_shrimp',
    name: 'Cooked Shrimp',
    description: 'Some nicely cooked shrimp.',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.COMMON,
    value: 3,
    weight: 0.1,
    stackable: true,
    tradeable: true,
    consumable: {
      healAmount: 3,
      consumeTime: 1800,
    },
    visual: {
      color: '#FFA500',
      model: 'food',
    },
  },

  cooked_lobster: {
    id: 'cooked_lobster',
    name: 'Cooked Lobster',
    description: 'A delicious cooked lobster.',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.UNCOMMON,
    value: 150,
    weight: 0.5,
    stackable: true,
    tradeable: true,
    consumable: {
      healAmount: 12,
      consumeTime: 1800,
    },
    visual: {
      color: '#FF6347',
      model: 'food',
    },
  },

  cooked_shark: {
    id: 'cooked_shark',
    name: 'Cooked Shark',
    description: 'A perfectly cooked shark.',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.RARE,
    value: 1000,
    weight: 1.0,
    stackable: true,
    tradeable: true,
    consumable: {
      healAmount: 20,
      consumeTime: 1800,
    },
    visual: {
      color: '#708090',
      model: 'food',
    },
  },

  // Potions
  attack_potion: {
    id: 'attack_potion',
    name: 'Attack Potion',
    description: 'A potion that temporarily boosts attack.',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.UNCOMMON,
    value: 50,
    weight: 0.1,
    stackable: true,
    tradeable: true,
    consumable: {
      effects: [
        {
          skill: SkillType.ATTACK,
          boost: 3,
          duration: 5, // 5 minutes
        },
      ],
      consumeTime: 1800,
    },
    visual: {
      color: '#FF0000',
      model: 'potion',
    },
  },

  strength_potion: {
    id: 'strength_potion',
    name: 'Strength Potion',
    description: 'A potion that temporarily boosts strength.',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.UNCOMMON,
    value: 50,
    weight: 0.1,
    stackable: true,
    tradeable: true,
    consumable: {
      effects: [
        {
          skill: SkillType.STRENGTH,
          boost: 3,
          duration: 5,
        },
      ],
      consumeTime: 1800,
    },
    visual: {
      color: '#800080',
      model: 'potion',
    },
  },

  // === MATERIALS ===

  // Raw materials
  raw_shrimp: {
    id: 'raw_shrimp',
    name: 'Raw Shrimp',
    description: 'Some raw shrimp.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.COMMON,
    value: 1,
    weight: 0.1,
    stackable: true,
    tradeable: true,
    visual: {
      color: '#FFEFD5',
      model: 'food',
    },
  },

  raw_lobster: {
    id: 'raw_lobster',
    name: 'Raw Lobster',
    description: 'A raw lobster.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.UNCOMMON,
    value: 100,
    weight: 0.5,
    stackable: true,
    tradeable: true,
    visual: {
      color: '#8B0000',
      model: 'food',
    },
  },

  raw_shark: {
    id: 'raw_shark',
    name: 'Raw Shark',
    description: 'A raw shark.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.RARE,
    value: 800,
    weight: 1.0,
    stackable: true,
    tradeable: true,
    visual: {
      color: '#2F4F4F',
      model: 'food',
    },
  },

  // Ore and bars
  copper_ore: {
    id: 'copper_ore',
    name: 'Copper Ore',
    description: 'An ore containing copper.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.COMMON,
    value: 5,
    weight: 2.0,
    stackable: true,
    tradeable: true,
    visual: {
      color: '#B87333',
      model: 'ore',
    },
  },

  tin_ore: {
    id: 'tin_ore',
    name: 'Tin Ore',
    description: 'An ore containing tin.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.COMMON,
    value: 5,
    weight: 2.0,
    stackable: true,
    tradeable: true,
    visual: {
      color: '#D3D3D3',
      model: 'ore',
    },
  },

  iron_ore: {
    id: 'iron_ore',
    name: 'Iron Ore',
    description: 'An ore containing iron.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.COMMON,
    value: 25,
    weight: 2.5,
    stackable: true,
    tradeable: true,
    visual: {
      color: '#696969',
      model: 'ore',
    },
  },

  coal: {
    id: 'coal',
    name: 'Coal',
    description: 'A lump of coal.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.COMMON,
    value: 100,
    weight: 2.0,
    stackable: true,
    tradeable: true,
    visual: {
      color: '#36454F',
      model: 'ore',
    },
  },

  bronze_bar: {
    id: 'bronze_bar',
    name: 'Bronze Bar',
    description: 'A bar of bronze.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.COMMON,
    value: 50,
    weight: 1.0,
    stackable: true,
    tradeable: true,
    visual: {
      color: '#CD7F32',
      model: 'bar',
    },
  },

  iron_bar: {
    id: 'iron_bar',
    name: 'Iron Bar',
    description: 'A bar of iron.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.COMMON,
    value: 150,
    weight: 1.2,
    stackable: true,
    tradeable: true,
    visual: {
      color: '#C0C0C0',
      model: 'bar',
    },
  },

  // === TOOLS ===

  bronze_pickaxe: {
    id: 'bronze_pickaxe',
    name: 'Bronze Pickaxe',
    description: 'A pickaxe made of bronze.',
    category: ItemCategory.TOOL,
    rarity: ItemRarity.COMMON,
    value: 100,
    weight: 2.0,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.WEAPON,
    requirements: [{ skill: SkillType.MINING, level: 1 }],
    stats: {
      attackBonus: 1,
      weight: 2.0,
    },
    visual: {
      color: '#CD7F32',
      model: 'pickaxe',
    },
  },

  iron_pickaxe: {
    id: 'iron_pickaxe',
    name: 'Iron Pickaxe',
    description: 'A pickaxe made of iron.',
    category: ItemCategory.TOOL,
    rarity: ItemRarity.COMMON,
    value: 500,
    weight: 2.5,
    stackable: false,
    tradeable: true,
    equipmentSlot: EquipmentSlot.WEAPON,
    requirements: [{ skill: SkillType.MINING, level: 1 }],
    stats: {
      attackBonus: 3,
      weight: 2.5,
    },
    visual: {
      color: '#C0C0C0',
      model: 'pickaxe',
    },
  },

  // === MISC ===

  coins: {
    id: 'coins',
    name: 'Coins',
    description: 'Shiny gold coins.',
    category: ItemCategory.MISC,
    rarity: ItemRarity.COMMON,
    value: 1,
    weight: 0,
    stackable: true,
    tradeable: true,
    visual: {
      color: '#FFD700',
      model: 'coin',
    },
  },
}

// Helper functions
export function getItemDefinition(itemId: string): ItemDefinition | null {
  return ITEM_DEFINITIONS[itemId] || null
}

export function getItemsByCategory(category: ItemCategory): ItemDefinition[] {
  return Object.values(ITEM_DEFINITIONS).filter(item => item.category === category)
}

export function getItemsByRarity(rarity: ItemRarity): ItemDefinition[] {
  return Object.values(ITEM_DEFINITIONS).filter(item => item.rarity === rarity)
}

export function getItemsByEquipmentSlot(slot: EquipmentSlot): ItemDefinition[] {
  return Object.values(ITEM_DEFINITIONS).filter(item => item.equipmentSlot === slot)
}

export function getTradeableItems(): ItemDefinition[] {
  return Object.values(ITEM_DEFINITIONS).filter(item => item.tradeable)
}

export function getStackableItems(): ItemDefinition[] {
  return Object.values(ITEM_DEFINITIONS).filter(item => item.stackable)
}

export function canPlayerEquipItem(playerLevels: Record<SkillType, number>, item: ItemDefinition): boolean {
  if (!item.requirements) {
    return true
  }

  return item.requirements.every(req => {
    const playerLevel = playerLevels[req.skill] || 1
    return playerLevel >= req.level
  })
}
