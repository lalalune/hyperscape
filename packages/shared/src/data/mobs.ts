/**
 * @deprecated Use './characters' instead
 * This file is kept for backward compatibility only.
 * Re-exports all character data from the unified characters.ts module.
 */

export {
  ALL_MOBS,
  LEVEL_1_MOBS,
  LEVEL_2_MOBS,
  LEVEL_3_MOBS,
  getMobById,
  getMobsByDifficulty,
  getMobsByBiome,
  canMobDropItem,
  calculateMobDrops,
  calculateMobCombatLevel,
  MOB_SPAWN_CONSTANTS,
  getMobClassifications
} from './characters';
