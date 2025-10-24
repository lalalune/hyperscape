/**
 * Utility Helpers
 *
 * Collection of reusable utility functions for asset management,
 * async operations, formatting, and RPG game mechanics.
 */

// import { AssetMetadata } from '../types'

/**
 * Generate a unique ID using timestamp and random string.
 *
 * @returns Unique identifier string in format "timestamp-randomstring"
 *
 * @example
 * ```typescript
 * const id = generateId() // "1234567890-abc123xyz"
 * ```
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration to sleep in milliseconds
 * @returns Promise that resolves after the specified duration
 *
 * @example
 * ```typescript
 * await sleep(1000) // Wait 1 second
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff.
 *
 * Attempts to execute an async function multiple times with
 * increasing delays between attempts. Useful for handling transient errors.
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelay - Initial delay in milliseconds (default: 1000)
 * @returns Promise resolving to the function's return value
 *
 * @throws The last error encountered if all retries fail
 *
 * @example
 * ```typescript
 * const data = await retry(
 *   () => fetch('https://api.example.com/data'),
 *   5,
 *   2000
 * )
 * ```
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
 * Format bytes to human-readable string.
 *
 * @deprecated Use formatFileSize from './formatting' instead
 * @param bytes - Number of bytes to format
 * @returns Formatted string with appropriate unit (Bytes, KB, MB, GB)
 *
 * @example
 * ```typescript
 * formatBytes(1024) // "1.0 KB"
 * formatBytes(1048576) // "1.0 MB"
 * formatBytes(0) // "0 Bytes"
 * ```
 */
export function formatBytes(bytes: number): string {
  // Redirect to new utility
  const { formatFileSize } = require('./formatting')
  return formatFileSize(bytes)
}

/**
 * Create a text-based progress bar string.
 *
 * @param current - Current progress value
 * @param total - Total progress value
 * @param width - Width of progress bar in characters (default: 30)
 * @returns Formatted progress bar string with percentage
 *
 * @example
 * ```typescript
 * createProgressBar(50, 100, 20) // "[==========          ] 50%"
 * createProgressBar(75, 100) // "[=======================       ] 75%"
 * ```
 */
export function createProgressBar(current: number, total: number, width: number = 30): string {
  const percentage = current / total
  const filled = Math.round(width * percentage)
  const empty = width - filled

  return `[${'='.repeat(filled)}${' '.repeat(empty)}] ${Math.round(percentage * 100)}%`
}

/**
 * Parse asset type from textual description using keyword matching.
 *
 * Analyzes description text to automatically categorize assets into types
 * like weapon, armor, consumable, tool, building, resource, or character.
 *
 * @param description - Asset description text to analyze
 * @returns Asset type category, defaults to 'decoration' if no match found
 *
 * @example
 * ```typescript
 * parseAssetType("iron sword with sharp blade") // "weapon"
 * parseAssetType("healing potion with red liquid") // "consumable"
 * parseAssetType("goblin warrior with club") // "character"
 * ```
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
 * Parse building type from description using keyword matching.
 *
 * @param description - Building description text to analyze
 * @returns Building type (bank, store, house, temple, castle, guild, inn, tower), defaults to 'house'
 *
 * @example
 * ```typescript
 * parseBuildingType("large stone bank with vault") // "bank"
 * parseBuildingType("general store with supplies") // "store"
 * parseBuildingType("medieval inn with tavern") // "inn"
 * ```
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
 * Parse weapon type from description using keyword matching.
 *
 * @param description - Weapon description text to analyze
 * @returns Weapon type string or undefined if no weapon keywords found
 *
 * @example
 * ```typescript
 * parseWeaponType("iron longsword with leather grip") // "longsword"
 * parseWeaponType("wooden bow with arrows") // "bow"
 * parseWeaponType("leather armor") // undefined
 * ```
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
 * Get recommended polycount for asset type.
 *
 * Returns optimal polygon count targets for different asset categories
 * to balance visual quality with performance.
 *
 * @param type - Asset type (weapon, armor, building, character, etc.)
 * @returns Recommended polygon count, defaults to 5000 for unknown types
 *
 * @example
 * ```typescript
 * getPolycountForType('weapon') // 5000
 * getPolycountForType('building') // 30000
 * getPolycountForType('character') // 15000
 * ```
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
 * Generate material-specific description for RPG items.
 *
 * Enhances base descriptions with material tier details and properties,
 * adding appropriate adjectives and visual descriptions based on the tier.
 *
 * @param baseDescription - Base item description
 * @param materialTier - Material tier (bronze, steel, mithril, wood, oak, willow, leather)
 * @param itemType - Type of item (weapon, armor, tool)
 * @returns Enhanced description with material-specific details
 *
 * @example
 * ```typescript
 * generateMaterialDescription(
 *   "A sharp sword",
 *   "mithril",
 *   "weapon"
 * ) // "A sharp sword with magical silvery-blue metal with glowing properties and glowing magical runes"
 * ```
 */
export function generateMaterialDescription(
  baseDescription: string,
  materialTier: keyof typeof MATERIAL_TIERS,
  itemType: 'weapon' | 'armor' | 'tool'
): string {
  const tier = MATERIAL_TIERS[materialTier]
//   const _adjective = tier.adjectives[Math.floor(Math.random() * tier.adjectives.length)]
  
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
 * Generate tier-based batch of items from a base item template.
 *
 * Creates multiple variations of an item across different material tiers,
 * useful for generating progression systems in RPG games.
 *
 * @param baseItem - Base item template with name, description, type, etc.
 * @param materialTiers - Array of material tier keys to generate
 * @param itemType - Type of item (weapon, armor, tool)
 * @returns Array of items with tier-specific properties
 *
 * @example
 * ```typescript
 * const swords = generateTierBatch(
 *   {
 *     name: "Sword",
 *     description: "A sharp blade",
 *     type: "weapon",
 *     subtype: "melee"
 *   },
 *   ["bronze", "steel", "mithril"],
 *   "weapon"
 * )
 * // Returns: [Bronze Sword (level 1), Steel Sword (level 10), Mithril Sword (level 20)]
 * ```
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

/**
 * Exponential backoff implementation for polling optimization.
 *
 * Reduces API calls by progressively increasing delay between poll attempts.
 * Includes jitter to prevent thundering herd problems and provides metrics
 * for monitoring poll behavior.
 *
 * @example
 * ```typescript
 * const backoff = new ExponentialBackoff(1000, 30000, 2.0, 0.1)
 *
 * async function pollStatus() {
 *   while (!backoff.isTimedOut()) {
 *     const status = await checkStatus()
 *     if (status === 'completed') {
 *       backoff.reset()
 *       return status
 *     }
 *     await sleep(backoff.getNextDelay())
 *   }
 * }
 * ```
 */
export class ExponentialBackoff {
  private currentDelay: number
  private readonly initialDelay: number
  private readonly maxDelay: number
  private readonly multiplier: number
  private readonly jitterFactor: number
  private startTime: number
  private pollCount: number = 0
  private lastResetTime: number

  /**
   * Create a new exponential backoff instance.
   *
   * @param initialDelay - Starting delay in milliseconds (default: 2000)
   * @param maxDelay - Maximum delay cap in milliseconds (default: 30000)
   * @param multiplier - Delay multiplier per attempt (default: 1.5)
   * @param jitterFactor - Random jitter factor 0-1 (default: 0.1)
   */
  constructor(
    initialDelay: number = 2000,
    maxDelay: number = 30000,
    multiplier: number = 1.5,
    jitterFactor: number = 0.1
  ) {
    this.initialDelay = initialDelay
    this.currentDelay = initialDelay
    this.maxDelay = maxDelay
    this.multiplier = multiplier
    this.jitterFactor = jitterFactor
    this.startTime = Date.now()
    this.lastResetTime = Date.now()
  }

  /**
   * Get next delay with exponential increase and jitter.
   *
   * Calculates and returns the next delay value, then increases the internal
   * delay for subsequent calls. Includes random jitter to prevent synchronized polls.
   *
   * @returns Delay in milliseconds for the next poll attempt
   *
   * @example
   * ```typescript
   * const backoff = new ExponentialBackoff(1000, 10000, 2.0)
   * backoff.getNextDelay() // ~1000ms (with jitter)
   * backoff.getNextDelay() // ~2000ms (with jitter)
   * backoff.getNextDelay() // ~4000ms (with jitter)
   * ```
   */
  getNextDelay(): number {
    this.pollCount++

    // Add random jitter to prevent thundering herd
    const jitter = (Math.random() - 0.5) * 2 * this.jitterFactor * this.currentDelay
    const delay = Math.min(this.currentDelay + jitter, this.maxDelay)

    // Increase delay for next call
    this.currentDelay = Math.min(this.currentDelay * this.multiplier, this.maxDelay)

    return Math.max(delay, 0)
  }

  /**
   * Reset delay to initial value.
   *
   * Call this when poll succeeds or status changes to restart
   * the backoff progression from the beginning.
   *
   * @example
   * ```typescript
   * if (status === 'completed') {
   *   backoff.reset()
   * }
   * ```
   */
  reset(): void {
    this.currentDelay = this.initialDelay
    this.lastResetTime = Date.now()
  }

  /**
   * Get current delay without incrementing.
   *
   * @returns Current delay value in milliseconds
   */
  getCurrentDelay(): number {
    return this.currentDelay
  }

  /**
   * Get polling metrics for monitoring and debugging.
   *
   * @returns Object containing poll statistics
   *
   * @example
   * ```typescript
   * const metrics = backoff.getMetrics()
   * console.log(`Polled ${metrics.totalPolls} times over ${metrics.elapsedTime}ms`)
   * console.log(`Average interval: ${metrics.averageInterval}ms`)
   * ```
   */
  getMetrics(): {
    totalPolls: number
    elapsedTime: number
    currentDelay: number
    averageInterval: number
    timeSinceLastReset: number
  } {
    const elapsedTime = Date.now() - this.startTime
    return {
      totalPolls: this.pollCount,
      elapsedTime,
      currentDelay: this.currentDelay,
      averageInterval: this.pollCount > 0 ? elapsedTime / this.pollCount : 0,
      timeSinceLastReset: Date.now() - this.lastResetTime
    }
  }

  /**
   * Check if maximum timeout has been exceeded.
   *
   * @param maxTimeout - Maximum timeout in milliseconds (default: 600000 = 10 minutes)
   * @returns True if timeout exceeded, false otherwise
   *
   * @example
   * ```typescript
   * while (!backoff.isTimedOut(300000)) { // 5 minute timeout
   *   await poll()
   *   await sleep(backoff.getNextDelay())
   * }
   * ```
   */
  isTimedOut(maxTimeout: number = 600000): boolean {
    return Date.now() - this.startTime > maxTimeout
  }
} 