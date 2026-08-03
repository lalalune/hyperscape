/**
 * Combat Level Calculator - Rules-Accurate Combat Level Calculation
 *
 * Implements the configured combat-level formula used by the game.
 * Combat level determines player power and affects mob aggression behavior.
 *
 *
 * Key mechanics:
 * - Base stats (Defence, Hitpoints, Prayer) contribute to all combat types
 * - Combat type (Melee, Ranged, Magic) only the highest contributes
 * - Level range: 3 (minimum) to 126 (maximum with all 99s)
 * - Used by AggroSystem for double-level aggro rule
 *
 */

/**
 * Combat skills required for combat level calculation
 */
export interface CombatSkills {
  attack: number;
  strength: number;
  defense: number;
  hitpoints: number; // Also called "constitution" in some systems
  ranged: number;
  magic: number;
  prayer: number;
}

/**
 * Combat type classification
 */
export type CombatType = "melee" | "ranged" | "magic";

/** Minimum combat level (fresh character with all level 1 stats, 10 HP) */
export const MIN_COMBAT_LEVEL = 3;

/** Maximum combat level (all 99 stats) */
export const MAX_COMBAT_LEVEL = 126;

/**
 * Calculate rules-accurate combat level.
 *
 * Formula:
 *   Base = 0.25 * (Defence + Hitpoints + floor(Prayer / 2))
 *   Melee = 0.325 * (Attack + Strength)
 *   Ranged = 0.325 * floor(Ranged * 1.5)
 *   Magic = 0.325 * floor(Magic * 1.5)
 *   Combat Level = floor(Base + max(Melee, Ranged, Magic))
 *
 * @param skills - Combat skills (attack, strength, defense, hitpoints, ranged, magic, prayer)
 * @returns Combat level (3-126)
 *
 * @example
 * // Fresh character (level 3)
 * calculateCombatLevel({ attack: 1, strength: 1, defense: 1, hitpoints: 10, ranged: 1, magic: 1, prayer: 1 })
 * // => 3
 *
 * @example
 * // Maxed melee (level 126)
 * calculateCombatLevel({ attack: 99, strength: 99, defense: 99, hitpoints: 99, ranged: 99, magic: 99, prayer: 99 })
 * // => 126
 */
export function calculateCombatLevel(skills: CombatSkills): number {
  // Base component: Defence + Hitpoints + half Prayer
  const base =
    0.25 * (skills.defense + skills.hitpoints + Math.floor(skills.prayer / 2));

  // Combat type components (only highest one counts)
  const melee = 0.325 * (skills.attack + skills.strength);
  const ranged = 0.325 * Math.floor(skills.ranged * 1.5);
  const magic = 0.325 * Math.floor(skills.magic * 1.5);

  // Take the highest combat type contribution
  const combatTypeBonus = Math.max(melee, ranged, magic);

  // Final combat level (floored)
  const level = Math.floor(base + combatTypeBonus);

  // Clamp to valid range (3-126)
  return Math.max(MIN_COMBAT_LEVEL, Math.min(MAX_COMBAT_LEVEL, level));
}

/**
 * Determine primary combat type based on highest effective level contribution.
 *
 * Used for:
 * - Combat style indicators
 * - NPC classification
 * - Equipment recommendations
 *
 * @param skills - Combat skills
 * @returns Primary combat type ('melee', 'ranged', or 'magic')
 */
export function getPrimaryCombatType(skills: CombatSkills): CombatType {
  const melee = 0.325 * (skills.attack + skills.strength);
  const ranged = 0.325 * Math.floor(skills.ranged * 1.5);
  const magic = 0.325 * Math.floor(skills.magic * 1.5);

  if (melee >= ranged && melee >= magic) return "melee";
  if (ranged >= magic) return "ranged";
  return "magic";
}

/**
 * Create CombatSkills from partial skills data with defaults.
 * Useful when converting from systems that may not have all skills.
 *
 * @param partial - Partial skills data
 * @returns Complete CombatSkills with defaults for missing values
 */
export function normalizeCombatSkills(
  partial: Partial<CombatSkills> & { constitution?: number },
): CombatSkills {
  return {
    attack: partial.attack ?? 1,
    strength: partial.strength ?? 1,
    defense: partial.defense ?? 1,
    // Support both "hitpoints" and "constitution" naming
    hitpoints: partial.hitpoints ?? partial.constitution ?? 10,
    ranged: partial.ranged ?? 1,
    magic: partial.magic ?? 1,
    prayer: partial.prayer ?? 1,
  };
}

/**
 * Check if player level is high enough to be ignored by a mob.
 *
 * classic MMORPG Rule: Mobs ignore players whose combat level is MORE THAN DOUBLE the mob's level.
 *
 * Examples:
 * - Level 2 goblin ignores level 5+ players (5 > 2*2 = 4)
 * - Level 10 guard ignores level 21+ players (21 > 10*2 = 20)
 * - Level 100 boss never ignores (toleranceImmune)
 *
 * @param playerCombatLevel - Player's combat level
 * @param mobLevel - Mob's combat level
 * @param toleranceImmune - If true, mob never ignores players based on level (bosses)
 * @returns true if mob should ignore this player
 *
 */
export function shouldMobIgnorePlayer(
  playerCombatLevel: number,
  mobLevel: number,
  toleranceImmune: boolean = false,
): boolean {
  // Some mobs (bosses, special encounters) never ignore based on level
  if (toleranceImmune) return false;

  // classic MMORPG rule: player level > (mob level * 2) = mob ignores player
  return playerCombatLevel > mobLevel * 2;
}
