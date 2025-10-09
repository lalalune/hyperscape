// Creature size categories with height ranges
export const CREATURE_SIZE_CATEGORIES = {
  tiny: {
    name: 'Tiny',
    minHeight: 0,
    maxHeight: 0.6,
    scaleFactor: 0.5,
  },
  small: {
    name: 'Small', 
    minHeight: 0.6,
    maxHeight: 1.2,
    scaleFactor: 0.75,
  },
  medium: {
    name: 'Medium',
    minHeight: 1.2,
    maxHeight: 2.4,
    scaleFactor: 1.0,
  },
  large: {
    name: 'Large',
    minHeight: 2.4,
    maxHeight: 4.0,
    scaleFactor: 1.5,
  },
  huge: {
    name: 'Huge',
    minHeight: 4.0,
    maxHeight: 6.0,
    scaleFactor: 2.0,
  },
  gargantuan: {
    name: 'Gargantuan',
    minHeight: 6.0,
    maxHeight: Infinity,
    scaleFactor: 3.0,
  },
} as const

// Creature presets for quick selection
export const CREATURE_PRESETS = [
  { name: 'Fairy', height: 0.3, category: 'tiny' as const },
  { name: 'Gnome', height: 0.9, category: 'small' as const },
  { name: 'Human', height: 1.83, category: 'medium' as const },
  { name: 'Troll', height: 3.0, category: 'large' as const },
  { name: 'Giant', height: 5.0, category: 'huge' as const },
  { name: 'Dragon', height: 8.0, category: 'gargantuan' as const }
] as const

// Get creature category based on height
export function getCreatureCategory(height: number): keyof typeof CREATURE_SIZE_CATEGORIES {
  for (const [category, bounds] of Object.entries(CREATURE_SIZE_CATEGORIES)) {
    if (height >= bounds.minHeight && height < bounds.maxHeight) {
      return category as keyof typeof CREATURE_SIZE_CATEGORIES
    }
  }
  return 'medium' // Default fallback
}

// Type exports
export type CreatureSizeCategory = keyof typeof CREATURE_SIZE_CATEGORIES
export type CreaturePreset = typeof CREATURE_PRESETS[number] 