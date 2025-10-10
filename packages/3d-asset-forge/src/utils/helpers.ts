/**
 * Utility helpers
 */

import { AssetMetadata } from '../types'

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i)
        await sleep(delay)
      }
    }
  }
  
  throw lastError!
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Create a progress bar string
 */
export function createProgressBar(current: number, total: number, width: number = 30): string {
  const percentage = current / total
  const filled = Math.round(width * percentage)
  const empty = width - filled
  
  return `[${'='.repeat(filled)}${' '.repeat(empty)}] ${Math.round(percentage * 100)}%`
}

/**
 * Parse asset type from description
 */
export function parseAssetType(description: string): string {
  const weaponKeywords = ['sword', 'axe', 'bow', 'staff', 'dagger', 'mace', 'spear', 'shield', 'scimitar', 'crossbow', 'wand']
  const armorKeywords = ['helmet', 'armor', 'chest', 'legs', 'boots', 'gloves', 'ring', 'amulet', 'cape', 'plate', 'mail']
  const consumableKeywords = ['potion', 'food', 'scroll', 'elixir', 'bread', 'meat', 'fish', 'rune']
  const toolKeywords = ['pickaxe', 'hatchet', 'fishing', 'hammer', 'knife', 'chisel', 'tinderbox']
  const buildingKeywords = ['bank', 'store', 'shop', 'house', 'temple', 'castle', 'tower', 'guild', 'inn']
  const resourceKeywords = ['ore', 'bar', 'log', 'plank', 'gem', 'stone', 'coal']
  const characterKeywords = ['goblin', 'guard', 'merchant', 'warrior', 'mage', 'dragon', 'skeleton', 'zombie']
  
  const lowerDesc = description.toLowerCase()
  
  if (weaponKeywords.some(kw => lowerDesc.includes(kw))) return 'weapon'
  if (armorKeywords.some(kw => lowerDesc.includes(kw))) return 'armor'
  if (consumableKeywords.some(kw => lowerDesc.includes(kw))) return 'consumable'
  if (toolKeywords.some(kw => lowerDesc.includes(kw))) return 'tool'
  if (buildingKeywords.some(kw => lowerDesc.includes(kw))) return 'building'
  if (resourceKeywords.some(kw => lowerDesc.includes(kw))) return 'resource'
  if (characterKeywords.some(kw => lowerDesc.includes(kw))) return 'character'
  
  return 'decoration'
}

/**
 * Parse building type from description
 */
export function parseBuildingType(description: string): string {
  const lowerDesc = description.toLowerCase()
  
  if (lowerDesc.includes('bank')) return 'bank'
  if (lowerDesc.includes('store') || lowerDesc.includes('shop')) return 'store'
  if (lowerDesc.includes('house') || lowerDesc.includes('home')) return 'house'
  if (lowerDesc.includes('temple') || lowerDesc.includes('church')) return 'temple'
  if (lowerDesc.includes('castle')) return 'castle'
  if (lowerDesc.includes('guild')) return 'guild'
  if (lowerDesc.includes('inn') || lowerDesc.includes('tavern')) return 'inn'
  if (lowerDesc.includes('tower')) return 'tower'
  
  return 'house' // default
}

/**
 * Parse weapon type from description
 */
export function parseWeaponType(description: string): string | undefined {
  const lowerDesc = description.toLowerCase()
  
  const weaponTypes = ['sword', 'axe', 'bow', 'staff', 'shield', 'dagger', 'mace', 'spear', 'crossbow', 'wand', 'scimitar', 'battleaxe', 'longsword']
  
  for (const weapon of weaponTypes) {
    if (lowerDesc.includes(weapon)) return weapon
  }
  
  return undefined
}

/**
 * Get recommended polycount for asset type
 */
export function getPolycountForType(type: string): number {
  const polycounts: Record<string, number> = {
    weapon: 5000,
    armor: 8000,
    building: 30000,
    character: 15000,
    prop: 3000,
    tool: 3000,
    consumable: 2000,
    resource: 4000,
    misc: 3000
  }
  
  return polycounts[type] || 5000
}

/**
 * Material tier definitions for RPG assets
 */
export const MATERIAL_TIERS = {
  // Weapon/Armor material tiers
  bronze: {
    name: 'Bronze',
    level: 1,
    description: 'Basic bronze metal with copper-brown coloring',
    color: '#CD7F32',
    rarity: 'common',
    adjectives: ['simple', 'basic', 'crude', 'tarnished']
  },
  steel: {
    name: 'Steel',
    level: 10,
    description: 'Strong steel metal with silver-gray finish',
    color: '#C0C0C0',
    rarity: 'uncommon',
    adjectives: ['razor sharp', 'polished', 'reinforced', 'sturdy']
  },
  mithril: {
    name: 'Mithril',
    level: 20,
    description: 'Magical silvery-blue metal with glowing properties',
    color: '#87CEEB',
    rarity: 'rare',
    adjectives: ['magical', 'shimmering', 'ethereal', 'enchanted']
  },
  
  // Bow material tiers
  wood: {
    name: 'Wood',
    level: 1,
    description: 'Simple wooden construction',
    color: '#8B4513',
    rarity: 'common',
    adjectives: ['simple', 'basic', 'crude', 'rough']
  },
  oak: {
    name: 'Oak',
    level: 10,
    description: 'Sturdy oak wood with reinforced construction',
    color: '#D2691E',
    rarity: 'uncommon',
    adjectives: ['sturdy', 'reinforced', 'quality', 'durable']
  },
  willow: {
    name: 'Willow',
    level: 20,
    description: 'Flexible willow wood with elegant design',
    color: '#DEB887',
    rarity: 'rare',
    adjectives: ['flexible', 'elegant', 'graceful', 'masterwork']
  },
  
  // Armor material tiers
  leather: {
    name: 'Leather',
    level: 1,
    description: 'Basic leather construction with simple stitching',
    color: '#8B4513',
    rarity: 'common',
    adjectives: ['basic', 'simple', 'crude', 'worn']
  }
} as const

/**
 * Generate material-specific description for items
 */
export function generateMaterialDescription(
  baseDescription: string,
  materialTier: keyof typeof MATERIAL_TIERS,
  itemType: 'weapon' | 'armor' | 'tool'
): string {
  const tier = MATERIAL_TIERS[materialTier]
  const adjective = tier.adjectives[Math.floor(Math.random() * tier.adjectives.length)]
  
  // Add material-specific details
  let description = baseDescription
  
  // Add material description
  if (itemType === 'weapon') {
    description += ` with ${tier.description.toLowerCase()}`
  } else if (itemType === 'armor') {
    description += ` made from ${tier.description.toLowerCase()}`
  } else if (itemType === 'tool') {
    description += ` crafted from ${tier.description.toLowerCase()}`
  }
  
  // Add special effects for higher tiers
  if (materialTier === 'mithril') {
    description += ' and glowing magical runes'
  } else if (materialTier === 'steel') {
    description += ' and professional craftsmanship'
  }
  
  return description
}

/**
 * Generate tier-based batch for a specific item type
 */
export function generateTierBatch(
  baseItem: {
    name: string
    description: string
    type: string
    subtype?: string
    style?: string
    metadata?: Record<string, string | number | boolean>
  },
  materialTiers: (keyof typeof MATERIAL_TIERS)[],
  itemType: 'weapon' | 'armor' | 'tool'
) {
  return materialTiers.map(tier => {
    const tierInfo = MATERIAL_TIERS[tier]
    return {
      ...baseItem,
      name: `${tierInfo.name} ${baseItem.name}`,
      description: generateMaterialDescription(baseItem.description, tier, itemType),
      metadata: {
        ...baseItem.metadata,
        tier,
        level: tierInfo.level,
        rarity: tierInfo.rarity,
        color: tierInfo.color
      }
    }
  })
}

/**
 * Difficulty level definitions for monsters
 */
export const DIFFICULTY_LEVELS = {
  1: {
    name: 'Beginner',
    description: 'Low-level enemies for new players',
    levelRange: [1, 5],
    examples: ['Goblin', 'Bandit', 'Barbarian']
  },
  2: {
    name: 'Intermediate', 
    description: 'Mid-level enemies for experienced players',
    levelRange: [6, 15],
    examples: ['Hobgoblin', 'Guard', 'Dark Warrior']
  },
  3: {
    name: 'Advanced',
    description: 'High-level enemies for skilled players',
    levelRange: [16, 25],
    examples: ['Black Knight', 'Ice Warrior', 'Dark Ranger']
  }
} as const 