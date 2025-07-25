/**
 * GDD-Compliant Mob Database
 * All mobs from the Game Design Document with accurate stats, drops, and behaviors
 */

import { RPGSkill } from '../types/index';

export interface MobStats {
  level: number;
  health: number;
  attack: number;
  strength: number;
  defense: number;
  ranged: number;
  constitution: number;
}

export interface MobDropItem {
  itemId: string;
  quantity: number;
  chance: number; // 0-1 probability
  isGuaranteed?: boolean;
}

export interface MobBehavior {
  aggressive: boolean;
  aggroRange: number; // meters
  chaseRange: number; // meters
  returnToSpawn: boolean;
  ignoreLowLevelPlayers?: boolean; // Level threshold for aggression
  levelThreshold?: number;
}

export interface MobData {
  id: string;
  name: string;
  description: string;
  difficultyLevel: 1 | 2 | 3; // Per GDD: Level 1-3 mobs
  stats: MobStats;
  behavior: MobBehavior;
  drops: MobDropItem[];
  spawnBiomes: string[];
  modelPath: string;
  animationSet: {
    idle: string;
    walk: string;
    attack: string;
    death: string;
  };
  respawnTime: number; // milliseconds
  xpReward: number; // Base XP for killing this mob
}

/**
 * Level 1 Mobs (Beginner Areas)
 */
export const LEVEL_1_MOBS: Record<string, MobData> = {
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    description: 'Small green humanoids with crude weapons. The classic first enemy.',
    difficultyLevel: 1,
    stats: {
      level: 2,
      health: 5,
      attack: 1,
      strength: 1,
      defense: 1,
      ranged: 1,
      constitution: 5
    },
    behavior: {
      aggressive: true,
      aggroRange: 3,
      chaseRange: 8,
      returnToSpawn: true,
    },
    drops: [
      { itemId: 'coins', quantity: 5, chance: 1.0, isGuaranteed: true },
      { itemId: 'bronze_sword', quantity: 1, chance: 0.05 },
      { itemId: 'bronze_shield', quantity: 1, chance: 0.03 },
      { itemId: 'bronze_helmet', quantity: 1, chance: 0.02 }
    ],
    spawnBiomes: ['mistwood_valley', 'goblin_wastes'],
    modelPath: '/assets/models/mobs/goblin.glb',
    animationSet: {
      idle: '/assets/animations/goblin_idle.glb',
      walk: '/assets/animations/goblin_walk.glb',
      attack: '/assets/animations/goblin_attack.glb',
      death: '/assets/animations/goblin_death.glb'
    },
    respawnTime: 900000, // 15 minutes per GDD
    xpReward: 8
  },

  bandit: {
    id: 'bandit',
    name: 'Desperate Bandit',
    description: 'Humans who turned to crime after the Calamity. More desperate than evil.',
    difficultyLevel: 1,
    stats: {
      level: 3,
      health: 8,
      attack: 2,
      strength: 2,
      defense: 1,
      ranged: 1,
      constitution: 8
    },
    behavior: {
      aggressive: true,
      aggroRange: 4,
      chaseRange: 10,
      returnToSpawn: true,
      ignoreLowLevelPlayers: true,
      levelThreshold: 5 // Won't attack players above combat level 5
    },
    drops: [
      { itemId: 'coins', quantity: 8, chance: 1.0, isGuaranteed: true },
      { itemId: 'bronze_sword', quantity: 1, chance: 0.08 },
      { itemId: 'bronze_body', quantity: 1, chance: 0.04 }
    ],
    spawnBiomes: ['mistwood_valley', 'goblin_wastes', 'northern_plains'],
    modelPath: '/assets/models/mobs/bandit.glb',
    animationSet: {
      idle: '/assets/animations/human_idle.glb',
      walk: '/assets/animations/human_walk.glb',
      attack: '/assets/animations/human_attack.glb',
      death: '/assets/animations/human_death.glb'
    },
    respawnTime: 900000,
    xpReward: 12
  },

  barbarian: {
    id: 'barbarian',
    name: 'Barbarian Warrior',
    description: 'Primitive humans living in the wilderness who reject civilization.',
    difficultyLevel: 1,
    stats: {
      level: 4,
      health: 12,
      attack: 3,
      strength: 4,
      defense: 2,
      ranged: 1,
      constitution: 12
    },
    behavior: {
      aggressive: true,
      aggroRange: 5,
      chaseRange: 12,
      returnToSpawn: true,
    },
    drops: [
      { itemId: 'coins', quantity: 12, chance: 1.0, isGuaranteed: true },
      { itemId: 'bronze_sword', quantity: 1, chance: 0.12 },
      { itemId: 'bronze_helmet', quantity: 1, chance: 0.08 },
      { itemId: 'bronze_legs', quantity: 1, chance: 0.06 }
    ],
    spawnBiomes: ['goblin_wastes', 'northern_plains'],
    modelPath: '/assets/models/mobs/barbarian.glb',
    animationSet: {
      idle: '/assets/animations/barbarian_idle.glb',
      walk: '/assets/animations/barbarian_walk.glb',
      attack: '/assets/animations/barbarian_attack.glb',
      death: '/assets/animations/barbarian_death.glb'
    },
    respawnTime: 900000,
    xpReward: 18
  }
};

/**
 * Level 2 Mobs (Intermediate Areas)
 */
export const LEVEL_2_MOBS: Record<string, MobData> = {
  hobgoblin: {
    id: 'hobgoblin',
    name: 'Hobgoblin',
    description: 'Larger, militaristic cousins of goblins with organized fighting discipline.',
    difficultyLevel: 2,
    stats: {
      level: 8,
      health: 25,
      attack: 8,
      strength: 7,
      defense: 6,
      ranged: 3,
      constitution: 25
    },
    behavior: {
      aggressive: true,
      aggroRange: 6,
      chaseRange: 15,
      returnToSpawn: true,
    },
    drops: [
      { itemId: 'coins', quantity: 25, chance: 1.0, isGuaranteed: true },
      { itemId: 'steel_sword', quantity: 1, chance: 0.15 },
      { itemId: 'steel_shield', quantity: 1, chance: 0.12 },
      { itemId: 'steel_helmet', quantity: 1, chance: 0.10 },
      { itemId: 'steel_body', quantity: 1, chance: 0.08 }
    ],
    spawnBiomes: ['darkwood_forest', 'corrupted_ruins'],
    modelPath: '/assets/models/mobs/hobgoblin.glb',
    animationSet: {
      idle: '/assets/animations/hobgoblin_idle.glb',
      walk: '/assets/animations/hobgoblin_walk.glb',
      attack: '/assets/animations/hobgoblin_attack.glb',
      death: '/assets/animations/hobgoblin_death.glb'
    },
    respawnTime: 900000,
    xpReward: 35
  },

  guard: {
    id: 'guard',
    name: 'Corrupted Guard',
    description: 'Former kingdom soldiers serving dark masters, well-trained but fallen.',
    difficultyLevel: 2,
    stats: {
      level: 10,
      health: 30,
      attack: 10,
      strength: 8,
      defense: 8,
      ranged: 5,
      constitution: 30
    },
    behavior: {
      aggressive: true,
      aggroRange: 7,
      chaseRange: 15,
      returnToSpawn: true,
    },
    drops: [
      { itemId: 'coins', quantity: 35, chance: 1.0, isGuaranteed: true },
      { itemId: 'steel_sword', quantity: 1, chance: 0.20 },
      { itemId: 'steel_shield', quantity: 1, chance: 0.18 },
      { itemId: 'steel_helmet', quantity: 1, chance: 0.15 },
      { itemId: 'steel_body', quantity: 1, chance: 0.12 },
      { itemId: 'steel_legs', quantity: 1, chance: 0.10 }
    ],
    spawnBiomes: ['darkwood_forest', 'corrupted_ruins'],
    modelPath: '/assets/models/mobs/guard.glb',
    animationSet: {
      idle: '/assets/animations/guard_idle.glb',
      walk: '/assets/animations/guard_walk.glb',
      attack: '/assets/animations/guard_attack.glb',
      death: '/assets/animations/guard_death.glb'
    },
    respawnTime: 900000,
    xpReward: 45
  },

  dark_warrior: {
    id: 'dark_warrior',
    name: 'Dark Warrior',
    description: 'Warriors who embraced darkness after the Calamity, choosing power over honor.',
    difficultyLevel: 2,
    stats: {
      level: 12,
      health: 35,
      attack: 12,
      strength: 12,
      defense: 8,
      ranged: 6,
      constitution: 35
    },
    behavior: {
      aggressive: true,
      aggroRange: 8,
      chaseRange: 20,
      returnToSpawn: true,
      ignoreLowLevelPlayers: false, // Always hostile per GDD
    },
    drops: [
      { itemId: 'coins', quantity: 45, chance: 1.0, isGuaranteed: true },
      { itemId: 'steel_sword', quantity: 1, chance: 0.25 },
      { itemId: 'steel_shield', quantity: 1, chance: 0.20 },
      { itemId: 'steel_body', quantity: 1, chance: 0.15 }
    ],
    spawnBiomes: ['darkwood_forest'],
    modelPath: '/assets/models/mobs/dark_warrior.glb',
    animationSet: {
      idle: '/assets/animations/dark_warrior_idle.glb',
      walk: '/assets/animations/dark_warrior_walk.glb',
      attack: '/assets/animations/dark_warrior_attack.glb',
      death: '/assets/animations/dark_warrior_death.glb'
    },
    respawnTime: 900000,
    xpReward: 55
  }
};

/**
 * Level 3 Mobs (Advanced Areas)
 */
export const LEVEL_3_MOBS: Record<string, MobData> = {
  black_knight: {
    id: 'black_knight',
    name: 'Black Knight',
    description: 'The most feared human enemies, elite dark warriors in pitch-black armor.',
    difficultyLevel: 3,
    stats: {
      level: 20,
      health: 60,
      attack: 20,
      strength: 18,
      defense: 15,
      ranged: 8,
      constitution: 60
    },
    behavior: {
      aggressive: true,
      aggroRange: 10,
      chaseRange: 25,
      returnToSpawn: true,
      ignoreLowLevelPlayers: false, // Always hostile per GDD
    },
    drops: [
      { itemId: 'coins', quantity: 100, chance: 1.0, isGuaranteed: true },
      { itemId: 'mithril_sword', quantity: 1, chance: 0.20 },
      { itemId: 'mithril_shield', quantity: 1, chance: 0.15 },
      { itemId: 'mithril_helmet', quantity: 1, chance: 0.12 },
      { itemId: 'mithril_body', quantity: 1, chance: 0.10 },
      { itemId: 'mithril_legs', quantity: 1, chance: 0.08 }
    ],
    spawnBiomes: ['blasted_lands', 'black_knight_fortress'],
    modelPath: '/assets/models/mobs/black_knight.glb',
    animationSet: {
      idle: '/assets/animations/black_knight_idle.glb',
      walk: '/assets/animations/black_knight_walk.glb',
      attack: '/assets/animations/black_knight_attack.glb',
      death: '/assets/animations/black_knight_death.glb'
    },
    respawnTime: 900000,
    xpReward: 100
  },

  ice_warrior: {
    id: 'ice_warrior',
    name: 'Ice Warrior',
    description: 'Ancient warriors of Valorhall, frozen but still fighting with incredible defense.',
    difficultyLevel: 3,
    stats: {
      level: 18,
      health: 80,
      attack: 15,
      strength: 12,
      defense: 20, // Very high defense per GDD
      ranged: 5,
      constitution: 80
    },
    behavior: {
      aggressive: true,
      aggroRange: 8,
      chaseRange: 15, // Slow but tough
      returnToSpawn: true,
      ignoreLowLevelPlayers: false,
    },
    drops: [
      { itemId: 'coins', quantity: 120, chance: 1.0, isGuaranteed: true },
      { itemId: 'mithril_sword', quantity: 1, chance: 0.18 },
      { itemId: 'mithril_helmet', quantity: 1, chance: 0.15 },
      { itemId: 'mithril_body', quantity: 1, chance: 0.12 },
      { itemId: 'mithril_legs', quantity: 1, chance: 0.10 }
    ],
    spawnBiomes: ['northern_reaches'],
    modelPath: '/assets/models/mobs/ice_warrior.glb',
    animationSet: {
      idle: '/assets/animations/ice_warrior_idle.glb',
      walk: '/assets/animations/ice_warrior_walk.glb',
      attack: '/assets/animations/ice_warrior_attack.glb',
      death: '/assets/animations/ice_warrior_death.glb'
    },
    respawnTime: 900000,
    xpReward: 90
  },

  dark_ranger: {
    id: 'dark_ranger',
    name: 'Dark Ranger',
    description: 'Master bowmen who turned to darkness, deadly accurate with powerful longbows.',
    difficultyLevel: 3,
    stats: {
      level: 22,
      health: 50,
      attack: 12,
      strength: 10,
      defense: 12,
      ranged: 25, // High ranged attack per GDD
      constitution: 50
    },
    behavior: {
      aggressive: true,
      aggroRange: 12, // Long range aggro
      chaseRange: 20,
      returnToSpawn: true,
      ignoreLowLevelPlayers: false,
    },
    drops: [
      { itemId: 'coins', quantity: 150, chance: 1.0, isGuaranteed: true },
      { itemId: 'willow_bow', quantity: 1, chance: 0.25 },
      { itemId: 'arrows', quantity: 50, chance: 0.80 }, // Common arrow drops per GDD
      { itemId: 'mithril_helmet', quantity: 1, chance: 0.10 },
      { itemId: 'mithril_legs', quantity: 1, chance: 0.08 }
    ],
    spawnBiomes: ['blasted_lands'],
    modelPath: '/assets/models/mobs/dark_ranger.glb',
    animationSet: {
      idle: '/assets/animations/dark_ranger_idle.glb',
      walk: '/assets/animations/dark_ranger_walk.glb',
      attack: '/assets/animations/dark_ranger_attack.glb',
      death: '/assets/animations/dark_ranger_death.glb'
    },
    respawnTime: 900000,
    xpReward: 110
  }
};

/**
 * Complete Mob Database
 */
export const ALL_MOBS: Record<string, MobData> = {
  ...LEVEL_1_MOBS,
  ...LEVEL_2_MOBS,
  ...LEVEL_3_MOBS
};

/**
 * Helper Functions
 */
export function getMobById(mobId: string): MobData | null {
  return ALL_MOBS[mobId] || null;
}

export function getMobsByDifficulty(level: 1 | 2 | 3): MobData[] {
  return Object.values(ALL_MOBS).filter(mob => mob.difficultyLevel === level);
}

export function getMobsByBiome(biome: string): MobData[] {
  return Object.values(ALL_MOBS).filter(mob => 
    mob.spawnBiomes.includes(biome)
  );
}

export function canMobDropItem(mobId: string, itemId: string): boolean {
  const mob = getMobById(mobId);
  if (!mob) return false;
  
  return mob.drops.some(drop => drop.itemId === itemId);
}

export function calculateMobDrops(mobId: string): MobDropItem[] {
  const mob = getMobById(mobId);
  if (!mob) return [];
  
  const drops: MobDropItem[] = [];
  
  for (const drop of mob.drops) {
    if (drop.isGuaranteed || Math.random() < drop.chance) {
      drops.push({
        itemId: drop.itemId,
        quantity: drop.quantity,
        chance: drop.chance
      });
    }
  }
  
  return drops;
}

/**
 * GDD Combat Level Calculation for Mobs
 * Same formula as players for consistency
 */
export function calculateMobCombatLevel(mob: MobData): number {
  const stats = mob.stats;
  const attack = stats.attack;
  const strength = stats.strength;
  const defense = stats.defense;
  const constitution = stats.constitution;
  const ranged = stats.ranged * 1.5; // Ranged counts for 1.5x
  
  const combatLevel = Math.floor(
    (defense + constitution + Math.floor(ranged / 2)) * 0.25 +
    Math.max(attack + strength, ranged * 2 / 3) * 0.325
  );
  
  return Math.max(3, combatLevel);
}

/**
 * Spawning Constants per GDD
 */
export const MOB_SPAWN_CONSTANTS = {
  GLOBAL_RESPAWN_TIME: 900000, // 15 minutes per GDD
  MAX_MOBS_PER_ZONE: 10,
  SPAWN_RADIUS_CHECK: 5, // Don't spawn if player within 5 meters
  AGGRO_LEVEL_THRESHOLD: 5, // Some mobs ignore players above this combat level
} as const;

/**
 * Mob Type Classifications for Systems
 */
export const MOB_CLASSIFICATIONS = {
  HUMANOID: ['goblin', 'bandit', 'barbarian', 'hobgoblin', 'guard', 'dark_warrior', 'black_knight', 'dark_ranger'],
  UNDEAD: ['ice_warrior'], // Ice warriors are preserved/frozen, quasi-undead
  AGGRESSIVE_ALWAYS: ['dark_warrior', 'black_knight', 'ice_warrior', 'dark_ranger'],
  LEVEL_SENSITIVE: ['bandit'], // Ignore high-level players
} as const;