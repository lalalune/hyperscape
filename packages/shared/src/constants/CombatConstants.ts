/**
 * Combat-related constants extracted from various systems
 * These values are based on the GDD specifications
 */

export const COMBAT_CONSTANTS = {
  // Attack ranges
  MELEE_RANGE: 2,
  RANGED_RANGE: 10,

  // Pickup range (server-side validation, slightly larger than client to account for movement)
  PICKUP_RANGE: 2.5,

  // Attack timing (RuneScape-style speeds)
  ATTACK_COOLDOWN_MS: 2400, // 2.4 seconds - standard weapon attack speed (4 ticks)
  COMBAT_TIMEOUT_MS: 4800, // 4.8 seconds (8 ticks) - OSRS in-combat timer after last hit

  // OSRS Constants
  TICK_DURATION_MS: 600, // 0.6 seconds per game tick

  // OSRS-accurate tick-based combat timing
  DEFAULT_ATTACK_SPEED_TICKS: 4, // Unarmed/standard weapon (2.4s)
  COMBAT_TIMEOUT_TICKS: 8, // 4.8s - health bar visible after combat ends
  LOGOUT_PREVENTION_TICKS: 16, // 9.6s - can't logout after taking damage
  HEALTH_REGEN_COOLDOWN_TICKS: 17, // 10.2s - cooldown after damage before regen starts
  HEALTH_REGEN_INTERVAL_TICKS: 100, // 60s - regenerate 1 HP every 100 ticks

  // Weapon speed tiers in ticks (OSRS-accurate)
  // @see https://oldschool.runescape.wiki/w/Attack_speed
  ATTACK_SPEED_TICKS: {
    FASTEST: 3, // Darts, blowpipe (1.8s)
    FAST: 4, // Scimitars, whip, daggers, unarmed (2.4s)
    MEDIUM: 5, // Longswords, crossbows (3.0s)
    SLOW: 6, // Godswords, battleaxes (3.6s)
    SLOWEST: 7, // Halberds, 2H swords (4.2s)
  },

  // Respawn timing in ticks (OSRS-style)
  // @see https://oldschool.runescape.wiki/w/Respawn_rate
  RESPAWN_TICKS_MIN: 25, // 15 seconds - minimum respawn time
  RESPAWN_TICKS_DEFAULT: 25, // 15 seconds - standard mob respawn
  RESPAWN_TICKS_RANDOMNESS: 8, // +0-8 ticks randomness (~0-5 seconds)

  // Death/Loot timing in ticks (OSRS-style)
  // @see https://oldschool.runescape.wiki/w/Gravestone
  GRAVESTONE_TICKS: 500, // 5 minutes (300 seconds / 0.6)
  GROUND_ITEM_DESPAWN_TICKS: 200, // 2 minutes (120 seconds / 0.6)
  LOOT_PROTECTION_TICKS: 100, // 1 minute (60 seconds / 0.6) - killer exclusivity
  CORPSE_DESPAWN_TICKS: 200, // 2 minutes - mob corpse despawn

  BASE_CONSTANT: 64, // Added to equipment bonuses in formulas
  EFFECTIVE_LEVEL_CONSTANT: 8, // Added to effective levels
  DAMAGE_DIVISOR: 640, // Used in max hit calculation

  // Damage calculations (DEPRECATED - keeping for backward compatibility)
  DAMAGE_MULTIPLIERS: {
    MELEE_ATTACK: 0.5, // Deprecated - use OSRS formula
    RANGED_ATTACK: 0.5, // Deprecated - use OSRS formula
    DEFENSE_REDUCTION: 0.25, // Deprecated - defense doesn't reduce damage in OSRS
  },

  // Minimum values
  MIN_DAMAGE: 0, // OSRS: Can hit 0 (miss)
  MAX_DAMAGE: 200, // OSRS damage cap

  // Combat states
  COMBAT_STATES: {
    IDLE: "idle",
    IN_COMBAT: "in_combat",
    FLEEING: "fleeing",
  } as const,
} as const;

export const AGGRO_CONSTANTS = {
  // Default behaviors
  DEFAULT_BEHAVIOR: "passive" as const,

  // Update intervals
  AGGRO_UPDATE_INTERVAL_MS: 100,

  // Special level thresholds
  ALWAYS_AGGRESSIVE_LEVEL: 999, // Used for mobs that ignore level differences

  // Mob behavior configurations - loaded dynamically from mobs.json manifest
  // Access via getMobById(mobId).behavior from data/mobs.ts
  MOB_BEHAVIORS: {
    default: {
      behavior: "passive" as const,
      detectionRange: 5,
      leashRange: 10,
      levelIgnoreThreshold: 0,
    },
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

export type CombatState =
  (typeof COMBAT_CONSTANTS.COMBAT_STATES)[keyof typeof COMBAT_CONSTANTS.COMBAT_STATES];
export type MobBehaviorType = keyof typeof AGGRO_CONSTANTS.MOB_BEHAVIORS;
