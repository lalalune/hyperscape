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
  equipmentStats?: {
    attack: number;
    strength: number;
    defense: number;
    ranged: number;
  },
): DamageResult {
  // OSRS-inspired damage calculation
  // Uses STRENGTH for damage (not attack), defense doesn't reduce damage

  let maxHit = 1;

  if (attackType === AttackType.MELEE) {
    // Use STRENGTH stat for damage calculation (OSRS-correct)
    const strengthStat = attacker.stats?.strength || 0;
    const attackPower = attacker.config?.attackPower || 0;

    if (strengthStat > 0) {
      // Simplified OSRS formula: effective strength determines max hit
      // effectiveStrength = strengthLevel + 8 (simplified, no prayers/potions)
      const effectiveStrength = strengthStat + 8;
      // maxHit = floor(0.5 + effectiveStrength * (strengthBonus + 64) / 640)
      // Get strength bonus from equipment (e.g., steel sword gives +6 strength)
      const strengthBonus = equipmentStats?.strength || 0;
      maxHit = Math.floor(
        0.5 + (effectiveStrength * (strengthBonus + 64)) / 640,
      );

      console.log(
        `[CombatCalc] Melee damage: strength=${strengthStat}, bonus=${strengthBonus}, maxHit=${maxHit}`,
      );

      // Ensure reasonable minimum
      if (maxHit < 1) maxHit = Math.max(1, Math.floor(strengthStat / 10));
    } else if (attackPower > 0) {
      maxHit = attackPower;
    } else {
      maxHit = 5; // Default melee damage
    }
  } else if (attackType === AttackType.RANGED) {
    const rangedStat = attacker.stats?.ranged || 0;
    const attackPower = attacker.config?.attackPower || 0;

    if (rangedStat > 0) {
      // Use ranged stat for max hit calculation
      const effectiveRanged = rangedStat + 8;
      // Get ranged bonus from equipment (e.g., bow)
      const rangedBonus = equipmentStats?.ranged || 0;
      maxHit = Math.floor(0.5 + (effectiveRanged * (rangedBonus + 64)) / 640);

      console.log(
        `[CombatCalc] Ranged damage: ranged=${rangedStat}, bonus=${rangedBonus}, maxHit=${maxHit}`,
      );

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

  // OSRS: Defense does NOT reduce damage, only affects hit chance
  // Roll damage from 0 to maxHit (can hit 0)
  const damage = Math.floor(Math.random() * (maxHit + 1));

  // Ensure damage is valid
  if (!Number.isFinite(damage) || damage < 0) {
    return {
      damage: 0,
      isCritical: false,
      damageType: attackType,
    };
  }

  // OSRS: No critical hit system
  return {
    damage,
    isCritical: false,
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
