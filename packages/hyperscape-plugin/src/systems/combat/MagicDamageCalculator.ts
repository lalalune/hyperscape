/**
 * MagicDamageCalculator - tile-based-MMORPG-accurate magic damage formulas
 *
 * Key differences from melee/ranged:
 * - Magic defense for PLAYERS = 0.7 * magicLevel + 0.3 * defenseLevel
 * - Magic defense for NPCs = just magicLevel (or NPC's magic level if defined)
 * - Max hit is determined by the spell, not equipment strength
 *
 * Effective Level = floor(magicLevel * prayerBonus) + styleBonus + 8
 * Attack Roll = effectiveLevel * (magicAttackBonus + 64)
 * Defense Roll (player) = floor(0.7 * magicLevel + 0.3 * defenseLevel + 9) * (magicDefenseBonus + 64)
 * Defense Roll (NPC) = (magicLevel + 9) * (magicDefenseBonus + 64)
 *
 * @see https://oldschool.runescape.wiki/w/Damage_per_second/Magic
 * @see https://oldschool.runescape.wiki/w/Magic_Damage
 */

import { MagicCombatStyle, MAGIC_STYLE_BONUSES } from "@hyperforge/shared";
import type { PrayerBonuses } from "@hyperforge/shared";
import { getGameRng, SeededRandom } from "@hyperforge/shared";
import { calculateHitChance } from "@hyperforge/shared";
import {
  getDamageBaseConstant,
  getEffectiveLevelConstant,
} from "@hyperforge/shared";

/**
 * Parameters for magic damage calculation
 */
export interface MagicDamageParams {
  /** Attacker's magic level */
  magicLevel: number;
  /** Equipment magic attack bonus */
  magicAttackBonus: number;
  /** Combat style */
  style: MagicCombatStyle;
  /** Spell's base max hit */
  spellBaseMaxHit: number;
  /** Target type (affects defense calculation) */
  targetType: "player" | "npc";
  /** Target's magic level (used for player defense calculation) */
  targetMagicLevel: number;
  /** Target's defense level (used for player defense calculation) */
  targetDefenseLevel: number;
  /** Target's magic defense bonus from equipment */
  targetMagicDefenseBonus: number;
  /** Prayer bonuses (optional) */
  prayerBonuses?: PrayerBonuses;
  /** Target's prayer bonuses (optional) */
  targetPrayerBonuses?: PrayerBonuses;
}

/**
 * Result of magic damage calculation
 */
export interface MagicDamageResult {
  /** Actual damage dealt (0 if missed or splashed) */
  damage: number;
  /** Maximum possible hit (spell base max hit) */
  maxHit: number;
  /** Whether the attack hit (passed accuracy check) */
  didHit: boolean;
  /** Calculated hit chance (0-1) */
  hitChance: number;
  /** Whether this was a splash (hit roll passed but dealt 0 damage) */
  splashed: boolean;
}

/**
 * Calculate magic attack roll
 */
function calculateMagicAttackRoll(
  magicLevel: number,
  magicAttackBonus: number,
  style: MagicCombatStyle,
  prayerBonuses?: PrayerBonuses,
): number {
  const styleBonus = MAGIC_STYLE_BONUSES[style];

  // Prayer multiplier
  const prayerMultiplier = prayerBonuses?.magicAttackMultiplier ?? 1;

  // Effective level = floor(magicLevel * prayerMultiplier) + styleBonus + EFFECTIVE_LEVEL_CONSTANT
  const boostedLevel = Math.floor(magicLevel * prayerMultiplier);
  const effectiveLevel =
    boostedLevel + styleBonus.attackBonus + getEffectiveLevelConstant();

  // Attack roll = effectiveLevel * (equipmentBonus + BASE_CONSTANT)
  return effectiveLevel * (magicAttackBonus + getDamageBaseConstant());
}

/**
 * Calculate magic defense roll for a player target
 * Player magic defense = 0.7 * magicLevel + 0.3 * defenseLevel
 */
function calculatePlayerMagicDefenseRoll(
  targetMagicLevel: number,
  targetDefenseLevel: number,
  targetMagicDefenseBonus: number,
  targetPrayerBonuses?: PrayerBonuses,
): number {
  // Prayer multiplier for magic defense
  const magicPrayerMultiplier =
    targetPrayerBonuses?.magicDefenseMultiplier ?? 1;
  const defensePrayerMultiplier = targetPrayerBonuses?.defenseMultiplier ?? 1;

  // Apply prayer bonuses to levels
  const boostedMagicLevel = Math.floor(
    targetMagicLevel * magicPrayerMultiplier,
  );
  const boostedDefenseLevel = Math.floor(
    targetDefenseLevel * defensePrayerMultiplier,
  );

  // Player magic defense formula: 0.7 * magic + 0.3 * defense
  const effectiveDefense = Math.floor(
    0.7 * boostedMagicLevel + 0.3 * boostedDefenseLevel + 9,
  );

  // Defense roll = effectiveDefense * (magicDefenseBonus + BASE_CONSTANT)
  return effectiveDefense * (targetMagicDefenseBonus + getDamageBaseConstant());
}

/**
 * Calculate magic defense roll for an NPC target
 * NPC magic defense uses only magic level (or a defined magic defense stat)
 */
function calculateNpcMagicDefenseRoll(
  targetMagicLevel: number,
  targetMagicDefenseBonus: number,
): number {
  // NPC effective defense = magicLevel + 9
  const effectiveDefense = targetMagicLevel + 9;

  // Defense roll = effectiveDefense * (magicDefenseBonus + BASE_CONSTANT)
  return effectiveDefense * (targetMagicDefenseBonus + getDamageBaseConstant());
}

/**
 * Calculate magic damage using tile-based-MMORPG-accurate formulas
 *
 * @param params - Magic damage calculation parameters
 * @param rng - Optional seeded random number generator
 * @returns Damage result with hit information
 */
export function calculateMagicDamage(
  params: MagicDamageParams,
  rng?: SeededRandom,
): MagicDamageResult {
  const random = rng ?? getGameRng();

  const {
    magicLevel,
    magicAttackBonus,
    style,
    spellBaseMaxHit,
    targetType,
    targetMagicLevel,
    targetDefenseLevel,
    targetMagicDefenseBonus,
    prayerBonuses,
    targetPrayerBonuses,
  } = params;

  // Calculate attack roll
  const attackRoll = calculateMagicAttackRoll(
    magicLevel,
    magicAttackBonus,
    style,
    prayerBonuses,
  );

  // Calculate defense roll based on target type
  let defenseRoll: number;
  if (targetType === "player") {
    defenseRoll = calculatePlayerMagicDefenseRoll(
      targetMagicLevel,
      targetDefenseLevel,
      targetMagicDefenseBonus,
      targetPrayerBonuses,
    );
  } else {
    defenseRoll = calculateNpcMagicDefenseRoll(
      targetMagicLevel,
      targetMagicDefenseBonus,
    );
  }

  // Calculate hit chance
  const hitChance = calculateHitChance(attackRoll, defenseRoll);

  // Max hit is determined by the spell
  const maxHit = spellBaseMaxHit;

  // Roll for hit
  const didHit = random.random() < hitChance;

  if (!didHit) {
    return {
      damage: 0,
      maxHit,
      didHit: false,
      hitChance,
      splashed: false,
    };
  }

  // Roll for damage (0 to maxHit inclusive)
  const damage = random.damageRoll(maxHit);

  // A "splash" is when you hit but deal 0 damage
  // This is different from missing - you still use runes on a splash
  const splashed = damage === 0;

  return {
    damage,
    maxHit,
    didHit: true,
    hitChance,
    splashed,
  };
}

/**
 * MagicDamageCalculator class for integration with CombatSystem
 */
export class MagicDamageCalculator {
  /**
   * Calculate magic damage
   */
  calculate(params: MagicDamageParams, rng?: SeededRandom): MagicDamageResult {
    return calculateMagicDamage(params, rng);
  }

  /**
   * Get max hit for display purposes (based on spell)
   */
  getMaxHit(spellBaseMaxHit: number): number {
    // For basic combat spells, max hit equals spell base max hit
    // Future: Add magic damage bonus from equipment (tome of fire, etc.)
    return spellBaseMaxHit;
  }

  /**
   * Get hit chance for display purposes (no RNG)
   */
  getHitChance(
    magicLevel: number,
    magicAttackBonus: number,
    style: MagicCombatStyle,
    targetType: "player" | "npc",
    targetMagicLevel: number,
    targetDefenseLevel: number,
    targetMagicDefenseBonus: number,
    prayerBonuses?: PrayerBonuses,
    targetPrayerBonuses?: PrayerBonuses,
  ): number {
    const attackRoll = calculateMagicAttackRoll(
      magicLevel,
      magicAttackBonus,
      style,
      prayerBonuses,
    );

    let defenseRoll: number;
    if (targetType === "player") {
      defenseRoll = calculatePlayerMagicDefenseRoll(
        targetMagicLevel,
        targetDefenseLevel,
        targetMagicDefenseBonus,
        targetPrayerBonuses,
      );
    } else {
      defenseRoll = calculateNpcMagicDefenseRoll(
        targetMagicLevel,
        targetMagicDefenseBonus,
      );
    }

    return calculateHitChance(attackRoll, defenseRoll);
  }
}
