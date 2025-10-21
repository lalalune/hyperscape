/**
 * Level Progression & Tier System
 * 
 * Runescape-style level progression with material tiers
 * Ensures generated content matches appropriate difficulty and level ranges
 */

export interface LevelTier {
  name: string
  material: string
  levelRange: { min: number; max: number }
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard' | 'epic' | 'legendary'
  xpMultiplier: number
  goldMultiplier: number
}

export const LEVEL_TIERS: Record<string, LevelTier> = {
  bronze: {
    name: 'Bronze',
    material: 'bronze',
    levelRange: { min: 1, max: 10 },
    difficulty: 'easy',
    xpMultiplier: 1.0,
    goldMultiplier: 1.0
  },
  iron: {
    name: 'Iron',
    material: 'iron',
    levelRange: { min: 11, max: 20 },
    difficulty: 'medium',
    xpMultiplier: 1.5,
    goldMultiplier: 1.3
  },
  steel: {
    name: 'Steel',
    material: 'steel',
    levelRange: { min: 21, max: 30 },
    difficulty: 'hard',
    xpMultiplier: 2.0,
    goldMultiplier: 1.6
  },
  mithril: {
    name: 'Mithril',
    material: 'mithril',
    levelRange: { min: 31, max: 40 },
    difficulty: 'very_hard',
    xpMultiplier: 3.0,
    goldMultiplier: 2.0
  },
  adamant: {
    name: 'Adamant',
    material: 'adamant',
    levelRange: { min: 41, max: 50 },
    difficulty: 'epic',
    xpMultiplier: 4.0,
    goldMultiplier: 2.5
  },
  rune: {
    name: 'Rune',
    material: 'rune',
    levelRange: { min: 51, max: 60 },
    difficulty: 'legendary',
    xpMultiplier: 5.0,
    goldMultiplier: 3.0
  }
}

export function getTierForDifficulty(difficulty: LevelTier['difficulty']): LevelTier {
  switch (difficulty) {
    case 'easy':
      return LEVEL_TIERS.bronze
    case 'medium':
      return LEVEL_TIERS.iron
    case 'hard':
      return LEVEL_TIERS.steel
    case 'very_hard':
      return LEVEL_TIERS.mithril
    case 'epic':
      return LEVEL_TIERS.adamant
    case 'legendary':
      return LEVEL_TIERS.rune
    default:
      return LEVEL_TIERS.bronze
  }
}

export function getTierForLevel(level: number): LevelTier {
  for (const tier of Object.values(LEVEL_TIERS)) {
    if (level >= tier.levelRange.min && level <= tier.levelRange.max) {
      return tier
    }
  }
  return LEVEL_TIERS.bronze
}

export function calculateQuestRewards(
  difficulty: LevelTier['difficulty'],
  objectiveCount: number
): { experience: number; gold: number } {
  const tier = getTierForDifficulty(difficulty)
  
  // Base rewards scale with objectives
  const baseXP = 50 * objectiveCount
  const baseGold = 25 * objectiveCount
  
  return {
    experience: Math.floor(baseXP * tier.xpMultiplier),
    gold: Math.floor(baseGold * tier.goldMultiplier)
  }
}

export function validateItemForTier(itemId: string, tier: LevelTier): boolean {
  // Check if item ID contains tier material
  const lowerItemId = itemId.toLowerCase()
  const lowerMaterial = tier.material.toLowerCase()
  
  // Bronze tier can use any basic items
  if (tier.material === 'bronze') return true
  
  // Higher tiers should match material
  return lowerItemId.includes(lowerMaterial)
}

export function validateMobForTier(mobLevel: number, tier: LevelTier): boolean {
  return mobLevel >= tier.levelRange.min && mobLevel <= tier.levelRange.max
}

export function getSkillLevelRequirement(tier: LevelTier, skillType: string): number {
  // Skill requirements typically match tier minimum
  const baseRequirement = tier.levelRange.min
  
  // Some skills might have different progressions
  const skillModifiers: Record<string, number> = {
    combat: 1.0,
    woodcutting: 0.8,
    mining: 0.8,
    fishing: 0.7,
    cooking: 0.6,
    smithing: 1.2
  }
  
  const modifier = skillModifiers[skillType] || 1.0
  return Math.floor(baseRequirement * modifier)
}

