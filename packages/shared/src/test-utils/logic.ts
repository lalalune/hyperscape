/**
 * Logic Extractors
 *
 * Pure functions extracted from production systems for unit testing.
 * These have no side effects and can be tested in isolation.
 *
 * Re-exports from specific mock modules for convenience.
 */

// Re-export combat logic
export {
  calculateAccuracy,
  calculateMeleeMaxHit,
  calculateRangedMaxHit,
  calculateDamageDeterministic,
  isAttackOnCooldown,
  isInMeleeRange,
  isInRangedRange,
  calculateRetaliationDelay,
  msToTicks,
} from "./mocks/combat";

// Export inventory logic types
export type { MoveItemResult } from "./mocks/inventory";

// Export position utilities
export {
  distance2D,
  distance3D,
  chebyshevDistance,
  offsetPosition,
  createPositionLine,
  createPositionGrid,
} from "./fixtures/positions";

// =============================================================================
// ADDITIONAL PURE LOGIC FUNCTIONS
// =============================================================================

import { INPUT_LIMITS } from "../constants";

/**
 * Validate and clamp quantity to valid range
 * PURE FUNCTION
 */
export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
    return 1;
  }
  return Math.max(1, Math.min(quantity, INPUT_LIMITS.MAX_QUANTITY));
}

/**
 * Check if quantity would overflow when added
 * PURE FUNCTION
 */
export function wouldOverflow(current: number, add: number): boolean {
  return current > INPUT_LIMITS.MAX_QUANTITY - add;
}

/**
 * Validate slot index
 * PURE FUNCTION
 */
export function isValidSlotIndex(slot: number): boolean {
  return (
    Number.isInteger(slot) &&
    slot >= 0 &&
    slot < INPUT_LIMITS.MAX_INVENTORY_SLOTS
  );
}

/**
 * Validate item ID format (no control characters)
 * PURE FUNCTION
 */
export function isValidItemId(itemId: string): boolean {
  if (typeof itemId !== "string" || itemId.length === 0) {
    return false;
  }
  if (itemId.length > INPUT_LIMITS.MAX_ITEM_ID_LENGTH) {
    return false;
  }
  // eslint-disable-next-line no-control-regex
  return !/[\x00-\x1f]/.test(itemId);
}

/**
 * Calculate XP for a level (RuneScape formula)
 * PURE FUNCTION
 */
export function calculateXpForLevel(level: number): number {
  let xp = 0;
  for (let i = 1; i < level; i++) {
    xp += Math.floor(i + 300 * Math.pow(2, i / 7));
  }
  return Math.floor(xp / 4);
}

/**
 * Calculate level from XP
 * PURE FUNCTION
 */
export function calculateLevelFromXp(xp: number): number {
  for (let level = 1; level <= 99; level++) {
    if (xp < calculateXpForLevel(level + 1)) {
      return level;
    }
  }
  return 99;
}

/**
 * Calculate food healing amount (OSRS formula)
 * PURE FUNCTION
 *
 * @param foodId - ID of the food item
 */
export function calculateFoodHealing(foodId: string): number {
  const healingMap: Record<string, number> = {
    cooked_shrimp: 3,
    cooked_anchovies: 3,
    bread: 5,
    cooked_trout: 7,
    cooked_salmon: 9,
    cooked_tuna: 10,
    cooked_lobster: 12,
    cooked_swordfish: 14,
    cooked_monkfish: 16,
    cooked_shark: 20,
  };

  return healingMap[foodId] ?? 1;
}

/**
 * Calculate gathering success chance
 * PURE FUNCTION
 *
 * @param skillLevel - Player's skill level
 * @param resourceLevel - Required level for resource
 */
export function calculateGatheringChance(
  skillLevel: number,
  resourceLevel: number,
): number {
  if (skillLevel < resourceLevel) {
    return 0;
  }

  // Base chance increases with level difference
  const levelDiff = skillLevel - resourceLevel;
  const baseChance = 0.4;
  const bonusChance = Math.min(levelDiff * 0.02, 0.5);

  return Math.min(baseChance + bonusChance, 0.95);
}

/**
 * Calculate respawn time in ticks
 * PURE FUNCTION
 *
 * @param baseRespawnMs - Base respawn time in milliseconds
 * @param tickDuration - Duration of one tick in ms (default 600)
 */
export function calculateRespawnTicks(
  baseRespawnMs: number,
  tickDuration: number = 600,
): number {
  return Math.max(1, Math.round(baseRespawnMs / tickDuration));
}

/**
 * Calculate sell price (OSRS: 40% of store price)
 * PURE FUNCTION
 */
export function calculateSellPrice(storePrice: number): number {
  return Math.floor(storePrice * 0.4);
}

/**
 * Calculate buy price with stock modifier
 * PURE FUNCTION
 *
 * @param basePrice - Base item price
 * @param currentStock - Current stock in store
 * @param maxStock - Maximum stock capacity
 */
export function calculateBuyPrice(
  basePrice: number,
  currentStock: number,
  maxStock: number,
): number {
  // Price increases as stock decreases
  const stockRatio = currentStock / maxStock;
  const priceModifier = 1 + (1 - stockRatio) * 0.3;
  return Math.floor(basePrice * priceModifier);
}
