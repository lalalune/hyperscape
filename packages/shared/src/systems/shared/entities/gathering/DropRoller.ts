/**
 * DropRoller - Pure utility functions for resource drop calculations
 *
 * Extracted from ResourceSystem.ts for SOLID compliance (Single Responsibility).
 * These are pure functions with no system dependencies.
 *
 */

import type { ResourceDrop } from "../../../../types/core/core";

/**
 * classic MMORPG catch rate interpolation formula
 *
 * Formula: P(Level) = (1 + floor(low × (99 - L) / 98 + high × (L - 1) / 98 + 0.5)) / 256
 *
 * @param low - Low catch rate value (numerator at level 1)
 * @param high - High catch rate value (numerator at level 99)
 * @param level - Player's skill level (1-99)
 * @returns Probability between 0 and 1
 *
 */
export function lerpSuccessRate(
  low: number,
  high: number,
  level: number,
): number {
  // Clamp level to valid range
  const clampedLevel = Math.min(99, Math.max(1, level));

  // classic MMORPG interpolation formula
  const lowComponent = (low * (99 - clampedLevel)) / 98;
  const highComponent = (high * (clampedLevel - 1)) / 98;
  const numerator = 1 + Math.floor(lowComponent + highComponent + 0.5);

  // Convert to probability and clamp to [0, 1]
  return Math.min(1, Math.max(0, numerator / 256));
}

/**
 * classic MMORPG Priority-based fish rolling system
 *
 * Fish are ordered by level requirement (highest first in manifest).
 * For each fish, the system:
 * 1. Checks if player meets level requirement
 * 2. If yes, rolls using that fish's catchLow/catchHigh success rate
 * 3. If roll succeeds, returns that fish
 * 4. If roll fails, moves to the next (lower-level) fish
 *
 * @param drops - Array of fish drops (must be ordered highest-level first)
 * @param playerLevel - Player's fishing level
 * @param debug - Enable debug logging
 * @returns The fish caught, or lowest-level fish as fallback
 */
export function rollFishDrop(
  drops: ResourceDrop[],
  playerLevel: number,
  debug = false,
): ResourceDrop {
  // Drops should already be ordered highest-level first in manifest
  for (const drop of drops) {
    const fishLevel = drop.levelRequired ?? 1;

    // Skip if player doesn't meet level requirement
    if (playerLevel < fishLevel) {
      continue;
    }

    // Roll using this fish's catch rate
    const catchLow = drop.catchLow ?? 48;
    const catchHigh = drop.catchHigh ?? 127;
    const successRate = lerpSuccessRate(catchLow, catchHigh, playerLevel);

    const roll = Math.random();
    if (roll < successRate) {
      // Caught this fish!
      if (debug) {
        console.log(
          `[Fishing] Caught ${drop.itemName} (level ${fishLevel}) - ` +
            `roll=${(roll * 100).toFixed(1)}% vs ${(successRate * 100).toFixed(1)}%`,
        );
      }
      return drop;
    } else {
      // Failed, try next fish in priority order
      if (debug) {
        console.log(
          `[Fishing] Failed ${drop.itemName} (level ${fishLevel}) - ` +
            `roll=${(roll * 100).toFixed(1)}% vs ${(successRate * 100).toFixed(1)}%, trying next...`,
        );
      }
    }
  }

  // Fallback: return lowest-level fish (last in array)
  // This ensures player always catches something if they're fishing
  const fallback = drops[drops.length - 1];
  if (debug) {
    console.log(`[Fishing] Fallback catch: ${fallback.itemName}`);
  }
  return fallback;
}

/**
 * Roll against harvestYield chances to determine drop
 *
 * Respects chance values from manifest for multi-drop resources (e.g., fishing).
 * Automatically uses classic MMORPG priority rolling when drops have catchLow/catchHigh.
 *
 * @param drops - Array of possible drops from manifest harvestYield
 * @param playerLevel - Optional player skill level (required for classic MMORPG priority rolling)
 * @param debug - Enable debug logging
 * @returns The rolled drop with all manifest data (itemId, itemName, quantity, xpAmount, etc.)
 * @throws Error if drops array is empty
 */
export function rollDrop(
  drops: ResourceDrop[],
  playerLevel?: number,
  debug = false,
): ResourceDrop {
  if (drops.length === 0) {
    throw new Error("[DropRoller] Resource has no drops defined in manifest");
  }

  // Single drop - no roll needed
  if (drops.length === 1) {
    return drops[0];
  }

  // RULES ACCURACY: Check if drops use priority rolling (catchLow/catchHigh defined)
  // This is used for fishing spots where higher-level fish are rolled first
  const usesPriorityRolling = drops.some(
    (d) => d.catchLow !== undefined && d.catchHigh !== undefined,
  );

  if (usesPriorityRolling && playerLevel !== undefined) {
    return rollFishDrop(drops, playerLevel, debug);
  }

  // Fallback to weighted random for other resources (trees, ores)
  const roll = Math.random();
  let cumulative = 0;

  for (const drop of drops) {
    cumulative += drop.chance;
    if (roll < cumulative) {
      return drop;
    }
  }

  // Fallback to first drop if chances don't sum to 1.0
  return drops[0];
}
