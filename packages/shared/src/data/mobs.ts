/**
 * Mob Database
 * 
 * ALL mob data is loaded from JSON manifests at runtime by DataManager.
 * This keeps mob definitions data-driven and separate from code.
 * 
 * Available 3D model types (in /world-assets/forge/):
 * - goblin/goblin_rigged.glb     → Used for goblins
 * - thug/thug_rigged.glb         → Used for bandits
 * - human/human_rigged.glb       → Used for guards, knights, warriors, rangers
 * - troll/troll_rigged.glb       → Used for hobgoblins
 * - imp/imp_rigged.glb           → Used for dark warriors
 * 
 * To add new mobs:
 * 1. Add entry to world/assets/manifests/mobs.json
 * 2. Use one of the existing modelPath types above
 * 3. OR generate new model in 3D Asset Forge
 * 4. Restart server to reload manifests
 * 
 * DO NOT add mob data here - keep it in JSON!
 */

import type {
  MobData,
  MobDropItem
} from '../types/core';

/**
 * Mob Database - Populated at runtime from JSON manifests
 * DataManager.loadMobs() reads world/assets/manifests/mobs.json
 */
export const ALL_MOBS: Record<string, MobData> = {};

/**
 * Deprecated: Level-based collections
 * Use getMobsByDifficulty() to filter by level from ALL_MOBS
 */
export const LEVEL_1_MOBS: Record<string, MobData> = {};
export const LEVEL_2_MOBS: Record<string, MobData> = {};
export const LEVEL_3_MOBS: Record<string, MobData> = {};

/**
 * Helper Functions
 */

// Get mob by ID
export function getMobById(mobId: string): MobData | null {
  return ALL_MOBS[mobId] || null;
}

// Get mobs by difficulty level
export function getMobsByDifficulty(level: 1 | 2 | 3): MobData[] {
  return Object.values(ALL_MOBS).filter(mob => mob.difficultyLevel === level);
}

// Get mobs by biome
export function getMobsByBiome(biome: string): MobData[] {
  return Object.values(ALL_MOBS).filter(mob => 
    mob.spawnBiomes?.includes(biome)
  );
}

// Check if mob can drop specific item
export function canMobDropItem(mobId: string, itemId: string): boolean {
  const mob = getMobById(mobId);
  if (!mob) return false;
  
  return mob.drops?.some(drop => drop.itemId === itemId) || false;
}

// Calculate mob drops with RNG
export function calculateMobDrops(mobId: string): MobDropItem[] {
  const mob = getMobById(mobId);
  if (!mob || !mob.drops) return [];
  
  const drops: MobDropItem[] = [];
  
  for (const drop of mob.drops) {
    if (drop.isGuaranteed || Math.random() < drop.chance) {
      drops.push({
        itemId: drop.itemId,
        quantity: drop.quantity,
        chance: drop.chance,
        isGuaranteed: drop.isGuaranteed
      });
    }
  }
  
  return drops;
}

/**
 * Calculate mob combat level using GDD formula
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
 * Mob Type Classifications - Derived from JSON data
 * These are computed at runtime from loaded mob data
 */
export function getMobClassifications(): {
  HUMANOID: string[];
  UNDEAD: string[];
  AGGRESSIVE_ALWAYS: string[];
  LEVEL_SENSITIVE: string[];
} {
  const humanoid: string[] = [];
  const undead: string[] = [];
  const aggressiveAlways: string[] = [];
  const levelSensitive: string[] = [];
  
  for (const [mobId, mobData] of Object.entries(ALL_MOBS)) {
    // Classify by type field from JSON
    if (mobData.type === 'humanoid') {
      humanoid.push(mobId);
    } else if (mobData.type === 'undead') {
      undead.push(mobId);
    }
    
    // Check behavior from JSON
    if (mobData.behavior?.levelThreshold && mobData.behavior.levelThreshold >= 999) {
      aggressiveAlways.push(mobId);
    }
    
    if (mobData.behavior?.ignoreLowLevelPlayers) {
      levelSensitive.push(mobId);
    }
  }
  
  return { HUMANOID: humanoid, UNDEAD: undead, AGGRESSIVE_ALWAYS: aggressiveAlways, LEVEL_SENSITIVE: levelSensitive };
}
