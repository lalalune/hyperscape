/**
 * HitDelayCalculator - Rules-Accurate Hit Delay System
 *
 * Calculates the delay (in ticks) between an attack being made and
 * damage appearing on the target. This creates the projectile travel
 * time effect seen in classic fantasy MMORPG.
 *
 * classic MMORPG HIT DELAY FORMULAS:
 *
 * MELEE:
 *   Delay = 0 ticks (instant)
 *   Damage appears the same tick as the attack animation starts.
 *
 * RANGED:
 *   Delay = 1 + floor((3 + distance) / 6) ticks
 *   Examples:
 *     Distance 1: 1 + floor(4/6) = 1 tick
 *     Distance 5: 1 + floor(8/6) = 2 ticks
 *     Distance 10: 1 + floor(13/6) = 3 ticks
 *
 * MAGIC:
 *   Delay = 1 + floor((1 + distance) / 3) ticks
 *   Examples:
 *     Distance 1: 1 + floor(2/3) = 1 tick
 *     Distance 5: 1 + floor(6/3) = 3 ticks
 *     Distance 10: 1 + floor(11/3) = 4 ticks
 *
 * IMPORTANT: These delays affect when the hitsplat appears and when
 * the target's health actually decreases. The attack animation and
 * projectile are purely visual and don't affect timing.
 */

import { COMBAT_CONSTANTS } from "../../constants/CombatConstants";
import { AttackType } from "../../types/core/core";

/**
 * Attack type for hit delay calculation
 */
export type HitDelayAttackType = "melee" | "ranged" | "magic";

/**
 * Projectile data for visual synchronization
 */
export interface ProjectileData {
  /** Unique ID for this projectile */
  id: string;
  /** Attacker entity ID */
  attackerId: string;
  /** Target entity ID */
  targetId: string;
  /** Attack type (ranged/magic) */
  attackType: HitDelayAttackType;
  /** Tick the projectile was fired */
  firedAtTick: number;
  /** Tick the projectile will hit (and damage applies) */
  hitsAtTick: number;
  /** Calculated delay in ticks */
  delayTicks: number;
  /** Distance at time of firing (tiles) */
  distance: number;
  /** Damage that will be applied on hit */
  damage: number;
  /** Whether this projectile has been processed */
  processed: boolean;
}

/**
 * Result of hit delay calculation
 */
export interface HitDelayResult {
  /** Delay in ticks until damage applies */
  delayTicks: number;
  /** Tick number when damage should apply */
  applyAtTick: number;
  /** Distance used for calculation (tiles) */
  distance: number;
  /** Attack type used */
  attackType: HitDelayAttackType;
}

/**
 * Calculate hit delay for an attack based on type and distance
 *
 * @param attackType - Type of attack (melee, ranged, magic)
 * @param distance - Distance to target in tiles
 * @param currentTick - Current game tick
 * @returns Hit delay result with tick timing
 */
export function calculateHitDelay(
  attackType: HitDelayAttackType | AttackType,
  distance: number,
  currentTick: number,
): HitDelayResult {
  const { HIT_DELAY } = COMBAT_CONSTANTS;

  // Normalize attack type
  const normalizedType = normalizeAttackType(attackType);

  // Ensure distance is non-negative
  const safeDistance = Math.max(0, distance);

  let delayTicks: number;

  switch (normalizedType) {
    case "melee":
      // Melee is instant (0 tick delay)
      delayTicks = HIT_DELAY.MELEE_BASE;
      break;

    case "ranged":
      // Ranged: 1 + floor((3 + distance) / 6)
      delayTicks =
        HIT_DELAY.RANGED_BASE +
        Math.floor(
          (HIT_DELAY.RANGED_DISTANCE_OFFSET + safeDistance) /
            HIT_DELAY.RANGED_DISTANCE_DIVISOR,
        );
      break;

    case "magic":
      // Magic: 1 + floor((1 + distance) / 3)
      delayTicks =
        HIT_DELAY.MAGIC_BASE +
        Math.floor(
          (HIT_DELAY.MAGIC_DISTANCE_OFFSET + safeDistance) /
            HIT_DELAY.MAGIC_DISTANCE_DIVISOR,
        );
      break;

    default:
      // Default to melee (instant) for unknown types
      delayTicks = HIT_DELAY.MELEE_BASE;
  }

  // Cap at maximum delay
  delayTicks = Math.min(delayTicks, HIT_DELAY.MAX_HIT_DELAY);

  return {
    delayTicks,
    applyAtTick: currentTick + delayTicks,
    distance: safeDistance,
    attackType: normalizedType,
  };
}

/**
 * Calculate hit delay for melee attacks (convenience function)
 * Always returns 0 ticks (instant)
 */
export function calculateMeleeHitDelay(currentTick: number): HitDelayResult {
  return calculateHitDelay("melee", 0, currentTick);
}

/**
 * Calculate hit delay for ranged attacks
 *
 * @param distance - Distance to target in tiles
 * @param currentTick - Current game tick
 */
export function calculateRangedHitDelay(
  distance: number,
  currentTick: number,
): HitDelayResult {
  return calculateHitDelay("ranged", distance, currentTick);
}

/**
 * Calculate hit delay for magic attacks
 *
 * @param distance - Distance to target in tiles
 * @param currentTick - Current game tick
 */
export function calculateMagicHitDelay(
  distance: number,
  currentTick: number,
): HitDelayResult {
  return calculateHitDelay("magic", distance, currentTick);
}

/**
 * Calculate distance between two positions in tiles
 *
 * Uses Chebyshev distance (max of x/z difference) for tile-based games.
 * This matches classic MMORPG's tile distance calculation.
 *
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Distance in tiles (Chebyshev distance)
 */
export function calculateTileDistance(
  pos1: { x: number; z: number },
  pos2: { x: number; z: number },
): number {
  // Convert world coordinates to tile coordinates
  // Assuming 1 tile = 1 world unit (adjust if different)
  const dx = Math.abs(pos1.x - pos2.x);
  const dz = Math.abs(pos1.z - pos2.z);

  // Chebyshev distance (how classic MMORPG calculates tile distance)
  return Math.max(dx, dz);
}

/**
 * Calculate Euclidean distance between two positions
 * Used for projectile visual interpolation
 */
export function calculateEuclideanDistance(
  pos1: { x: number; y?: number; z: number },
  pos2: { x: number; y?: number; z: number },
): number {
  const dx = pos1.x - pos2.x;
  const dy = (pos1.y ?? 0) - (pos2.y ?? 0);
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Normalize attack type to hit delay type
 */
function normalizeAttackType(
  attackType: HitDelayAttackType | AttackType | string,
): HitDelayAttackType {
  const type = String(attackType).toLowerCase();

  if (
    type === "melee" ||
    type === "slash" ||
    type === "stab" ||
    type === "crush"
  ) {
    return "melee";
  }
  if (
    type === "ranged" ||
    type === "range" ||
    type === "arrow" ||
    type === "bolt"
  ) {
    return "ranged";
  }
  if (type === "magic" || type === "mage" || type === "spell") {
    return "magic";
  }

  // Default to melee for unknown types
  return "melee";
}

/**
 * Create a projectile data object for tracking
 *
 * @param attackerId - Attacker entity ID
 * @param targetId - Target entity ID
 * @param attackType - Type of attack
 * @param distance - Distance to target
 * @param damage - Damage to apply
 * @param currentTick - Current game tick
 */
export function createProjectile(
  attackerId: string,
  targetId: string,
  attackType: HitDelayAttackType,
  distance: number,
  damage: number,
  currentTick: number,
): ProjectileData {
  const hitDelay = calculateHitDelay(attackType, distance, currentTick);

  return {
    id: `${attackerId}-${targetId}-${currentTick}`,
    attackerId,
    targetId,
    attackType,
    firedAtTick: currentTick,
    hitsAtTick: hitDelay.applyAtTick,
    delayTicks: hitDelay.delayTicks,
    distance,
    damage,
    processed: false,
  };
}

/**
 * Check if a projectile should hit on the given tick
 */
export function shouldProjectileHit(
  projectile: ProjectileData,
  currentTick: number,
): boolean {
  return !projectile.processed && currentTick >= projectile.hitsAtTick;
}

/**
 * Calculate projectile progress (0-1) for visual interpolation
 *
 * @param projectile - Projectile data
 * @param currentTick - Current game tick
 * @returns Progress from 0 (just fired) to 1 (hit target)
 */
export function getProjectileProgress(
  projectile: ProjectileData,
  currentTick: number,
): number {
  if (projectile.delayTicks === 0) {
    return 1; // Instant hit
  }

  const ticksElapsed = currentTick - projectile.firedAtTick;
  const progress = ticksElapsed / projectile.delayTicks;

  return Math.max(0, Math.min(1, progress));
}

/**
 * Get hit delay examples for documentation/testing
 */
export function getHitDelayExamples(): Array<{
  attackType: HitDelayAttackType;
  distance: number;
  delay: number;
}> {
  const examples: Array<{
    attackType: HitDelayAttackType;
    distance: number;
    delay: number;
  }> = [];

  const types: HitDelayAttackType[] = ["melee", "ranged", "magic"];
  const distances = [1, 2, 3, 5, 7, 10];

  for (const type of types) {
    for (const distance of distances) {
      const result = calculateHitDelay(type, distance, 0);
      examples.push({
        attackType: type,
        distance,
        delay: result.delayTicks,
      });
    }
  }

  return examples;
}
