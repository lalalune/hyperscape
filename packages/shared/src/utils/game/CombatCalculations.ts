/**
 * Combat Calculation Utilities
 *
 * Damage calculations, attack type handling, and combat stat formulas.
 * Provides consistent combat mechanics across all combat systems.
 */

import { COMBAT_CONSTANTS } from "../../constants/CombatConstants";
import { AttackType } from "../../types/core/core";
import {
  calculateDistance as mathCalculateDistance,
  calculateDistance2D as mathCalculateDistance2D,
} from "../MathUtils";

export interface CombatStats {
  attack?: number;
  strength?: number;
  defense?: number;
  ranged?: number;
  attackPower?: number;
}

export interface DamageResult {
  damage: number;
  isCritical: boolean;
  damageType: AttackType;
  didHit: boolean; // OSRS accuracy: did the attack hit or miss?
}

/**
 * Calculate OSRS-style accuracy (hit chance)
 * Returns true if the attack successfully hits
 */
function calculateAccuracy(
  attackerAttackLevel: number,
  attackerAttackBonus: number,
  targetDefenseLevel: number,
  targetDefenseBonus: number,
): boolean {
  // OSRS formula for attack roll
  const effectiveAttack = attackerAttackLevel + 8; // +8 is base, +3 would be for style (not implemented yet)
  const attackRoll = effectiveAttack * (attackerAttackBonus + 64);

  // OSRS formula for defence roll
  const effectiveDefence = targetDefenseLevel + 9;
  const defenceRoll = effectiveDefence * (targetDefenseBonus + 64);

  // Calculate hit chance based on OSRS formula
  let hitChance: number;
  if (attackRoll > defenceRoll) {
    hitChance = 1 - (defenceRoll + 2) / (2 * (attackRoll + 1));
  } else {
    hitChance = attackRoll / (2 * (defenceRoll + 1));
  }

  // Roll to see if attack hits
  const roll = Math.random();
  const didHit = roll < hitChance;

  // Debug logging
  if (Math.random() < 0.1) {
    // Log 10% of attacks to avoid spam
    console.log(
      `[Accuracy] Attack: ${attackerAttackLevel}+${attackerAttackBonus} vs Defence: ${targetDefenseLevel}+${targetDefenseBonus} | Hit chance: ${(hitChance * 100).toFixed(1)}% | Roll: ${(roll * 100).toFixed(1)}% | ${didHit ? "HIT" : "MISS"}`,
    );
  }

  return didHit;
}

/**
 * Calculate damage for any attack type (melee, ranged, or magic)
 */
export function calculateDamage(
  attacker: { stats?: CombatStats; config?: { attackPower?: number } },
  target: { stats?: CombatStats; config?: { defense?: number } },
  attackType: AttackType,
  equipmentStats?: {
    attack: number;
    strength: number;
    defense: number;
    ranged: number;
  },
): DamageResult {
  // OSRS-accurate combat calculation with accuracy system

  let maxHit = 1;
  let attackStat = 0;
  let attackBonus = 0;

  if (attackType === AttackType.MELEE) {
    // Use STRENGTH stat for damage calculation (OSRS-correct)
    const strengthStat = attacker.stats?.strength || 0;
    attackStat = attacker.stats?.attack || 1; // Attack level for accuracy
    const attackPower = attacker.config?.attackPower || 0;

    // ALWAYS use OSRS formula for consistency (even for mobs with attackPower)
    if (strengthStat > 0 || attackPower > 0) {
      // Use strength stat if available, otherwise derive from attackPower
      const effectiveStrengthLevel =
        strengthStat > 0
          ? strengthStat
          : Math.max(1, Math.floor(attackPower / 2));
      const effectiveAttackLevel =
        attackStat > 0 ? attackStat : effectiveStrengthLevel;

      attackStat = effectiveAttackLevel;

      // OSRS formula: effective strength determines max hit
      const effectiveStrength = effectiveStrengthLevel + 8;
      // Get strength bonus from equipment (players have equipment, mobs typically don't)
      const strengthBonus = equipmentStats?.strength || 0;
      attackBonus = equipmentStats?.attack || 0;

      maxHit = Math.floor(
        0.5 + (effectiveStrength * (strengthBonus + 64)) / 640,
      );

      // Ensure reasonable minimum (at least 1 damage for attackPower >= 10)
      if (maxHit < 1 && attackPower >= 10) {
        maxHit = 1;
      } else if (maxHit < 1 && strengthStat >= 10) {
        maxHit = 1;
      }
    } else {
      maxHit = 1; // Minimum damage
    }
  } else if (attackType === AttackType.RANGED) {
    const rangedStat = attacker.stats?.ranged || 0;
    attackStat = rangedStat; // Ranged level for accuracy
    const attackPower = attacker.config?.attackPower || 0;

    if (rangedStat > 0) {
      // Use ranged stat for max hit calculation
      const effectiveRanged = rangedStat + 8;
      // Get ranged bonus from equipment (e.g., bow)
      const rangedBonus = equipmentStats?.ranged || 0;
      attackBonus = rangedBonus; // Ranged bonus for accuracy
      maxHit = Math.floor(0.5 + (effectiveRanged * (rangedBonus + 64)) / 640);

      if (maxHit < 1) maxHit = Math.max(1, Math.floor(rangedStat / 10));
    } else if (attackPower > 0) {
      maxHit = attackPower;
    } else {
      maxHit = 3; // Default ranged damage
    }
  }

  // Ensure maxHit is valid
  if (!Number.isFinite(maxHit) || maxHit < 1) {
    maxHit = 5;
  }

  // OSRS accuracy system: attack roll vs defence roll
  const targetDefense = target.stats?.defense || 1;
  const targetDefenseBonus = 0; // Most NPCs have 0 defense bonus (would come from their equipment)

  const didHit = calculateAccuracy(
    attackStat,
    attackBonus,
    targetDefense,
    targetDefenseBonus,
  );

  // If attack missed, return 0 damage
  if (!didHit) {
    return {
      damage: 0,
      isCritical: false,
      damageType: attackType,
      didHit: false,
    };
  }

  // Attack hit - roll damage from 0 to maxHit (can still hit 0)
  const damage = Math.floor(Math.random() * (maxHit + 1));

  // Ensure damage is valid
  if (!Number.isFinite(damage) || damage < 0) {
    return {
      damage: 0,
      isCritical: false,
      damageType: attackType,
      didHit: true, // It hit but rolled 0 damage
    };
  }

  // OSRS: No critical hit system
  return {
    damage,
    isCritical: false,
    damageType: attackType,
    didHit: true,
  };
}

/**
 * Get defense value from entity
 */
function getDefenseValue(entity: {
  stats?: CombatStats;
  config?: { defense?: number };
}): number {
  if (entity.stats?.defense) {
    return entity.stats.defense;
  } else if (entity.config?.defense) {
    return entity.config.defense;
  }
  return 0;
}

/**
 * Check if entity is within attack range
 */
export function isInAttackRange(
  attackerPos: { x: number; y: number; z: number },
  targetPos: { x: number; y: number; z: number },
  attackType: AttackType,
): boolean {
  const distance = calculateDistance3D(attackerPos, targetPos);
  const maxRange =
    attackType === AttackType.MELEE
      ? COMBAT_CONSTANTS.MELEE_RANGE
      : COMBAT_CONSTANTS.RANGED_RANGE;

  return distance <= maxRange;
}

/**
 * Calculate 3D distance between two positions
 * Re-exported from MathUtils for convenience
 */
export const calculateDistance3D = mathCalculateDistance;

/**
 * Calculate 2D distance (ignoring Y axis)
 * Re-exported from MathUtils for convenience
 */
export const calculateDistance2D = mathCalculateDistance2D;

/**
 * Check if attack is on cooldown
 * @param lastAttackTime - Timestamp of last attack
 * @param currentTime - Current timestamp
 * @param attackSpeed - Optional attack speed in ms (defaults to standard 2400ms)
 */
export function isAttackOnCooldown(
  lastAttackTime: number,
  currentTime: number,
  attackSpeed?: number,
): boolean {
  const cooldown = attackSpeed ?? COMBAT_CONSTANTS.ATTACK_COOLDOWN_MS;
  return currentTime - lastAttackTime < cooldown;
}

/**
 * Check if combat should timeout
 */
export function shouldCombatTimeout(
  combatStartTime: number,
  currentTime: number,
): boolean {
  return currentTime - combatStartTime > COMBAT_CONSTANTS.COMBAT_TIMEOUT_MS;
}
