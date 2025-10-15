/**
 * Combat-related constants extracted from various systems
 * These values are based on the GDD specifications
 */

export const COMBAT_CONSTANTS = {
  // Attack ranges
  MELEE_RANGE: 2,
  RANGED_RANGE: 10,
  
  // Attack timing (RuneScape-style speeds)
  ATTACK_COOLDOWN_MS: 2400, // 2.4 seconds - standard weapon attack speed
  COMBAT_TIMEOUT_MS: 10000, // 10 seconds without attacks ends combat
  
  // Damage calculations
  DAMAGE_MULTIPLIERS: {
    MELEE_ATTACK: 0.5,
    RANGED_ATTACK: 0.5,
    DEFENSE_REDUCTION: 0.25,
  },
  
  // Minimum values
  MIN_DAMAGE: 1,
  
  // Combat states
  COMBAT_STATES: {
    IDLE: 'idle',
    IN_COMBAT: 'in_combat',
    FLEEING: 'fleeing',
  } as const,
} as const;

export const AGGRO_CONSTANTS = {
  // Default behaviors
  DEFAULT_BEHAVIOR: 'passive' as const,
  
  // Update intervals
  AGGRO_UPDATE_INTERVAL_MS: 100,
  
  // Special level thresholds
  ALWAYS_AGGRESSIVE_LEVEL: 999, // Used for mobs that ignore level differences
  
  // Mob behavior configurations - loaded dynamically from mobs.json manifest
  // Access via getMobById(mobId).behavior from data/mobs.ts
  MOB_BEHAVIORS: {
    'default': { 
      behavior: 'passive' as const, 
      detectionRange: 5, 
      leashRange: 10, 
      levelIgnoreThreshold: 0 
    }
  } as const,
} as const;

export const LEVEL_CONSTANTS = {
  // Starting values
  DEFAULT_COMBAT_LEVEL: 3,
  MIN_COMBAT_LEVEL: 3,
  MAX_LEVEL: 99,
  
  // XP formulas
  XP_BASE: 50,
  XP_GROWTH_FACTOR: 8,
  
  // Combat level calculation weights
  COMBAT_LEVEL_WEIGHTS: {
    DEFENSE_WEIGHT: 0.25,
    OFFENSE_WEIGHT: 0.325,
    RANGED_MULTIPLIER: 1.5,
  },
} as const;

export type CombatState = typeof COMBAT_CONSTANTS.COMBAT_STATES[keyof typeof COMBAT_CONSTANTS.COMBAT_STATES];
export type MobBehaviorType = keyof typeof AGGRO_CONSTANTS.MOB_BEHAVIORS;