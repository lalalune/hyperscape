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
}

/**
 * Calculate damage for any attack type (melee, ranged, or magic)
 */
export function calculateDamage(
  attacker: { stats?: CombatStats; config?: { attackPower?: number } },
  target: { stats?: CombatStats; config?: { defense?: number } },
  attackType: AttackType,
): DamageResult {
  // Get base damage based on attack type
  let baseDamage = 1;

  if (attackType === AttackType.MELEE) {
    const attackStat = attacker.stats?.attack || 0;
    const attackPower = attacker.config?.attackPower || 0;

    if (attackStat > 0) {
      baseDamage =
        Math.floor(
          attackStat * COMBAT_CONSTANTS.DAMAGE_MULTIPLIERS.MELEE_ATTACK,
        ) + 1;
    } else if (attackPower > 0) {
      baseDamage = attackPower;
    } else {
      baseDamage = 5; // Default melee damage
    }
  } else if (attackType === AttackType.RANGED) {
    const rangedStat = attacker.stats?.ranged || 0;
    const attackPower = attacker.config?.attackPower || 0;

    if (rangedStat > 0) {
      baseDamage =
        Math.floor(
          rangedStat * COMBAT_CONSTANTS.DAMAGE_MULTIPLIERS.RANGED_ATTACK,
        ) + 1;
    } else if (attackPower > 0) {
      baseDamage = attackPower;
    } else {
      baseDamage = 3; // Default ranged damage
    }
  }

  // Ensure baseDamage is valid
  if (!Number.isFinite(baseDamage) || baseDamage < 1) {
    baseDamage = 5;
  }

  // Apply defense reduction
  const defense = getDefenseValue(target);
  const damageReduction = Math.floor(
    defense * COMBAT_CONSTANTS.DAMAGE_MULTIPLIERS.DEFENSE_REDUCTION,
  );

  // Calculate final damage with randomization
  const finalDamage = Math.max(
    COMBAT_CONSTANTS.MIN_DAMAGE,
    baseDamage - damageReduction,
  );
  const damage = Math.floor(Math.random() * finalDamage) + 1;

  // Ensure damage is valid
  if (!Number.isFinite(damage) || damage < 1) {
    return {
      damage: 1,
      isCritical: false,
      damageType: attackType,
    };
  }

  // Simple critical hit chance (10%)
  const isCritical = Math.random() < 0.1;

  return {
    damage: isCritical ? damage * 2 : damage,
    isCritical,
    damageType: attackType,
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
