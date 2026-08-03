/**
 * Cooking Calculator
 *
 * rules-accurate cooking burn rate calculations.
 * Uses data from items.json manifest via ProcessingDataProvider.
 *
 */

import { processingDataProvider } from "../../../../data/ProcessingDataProvider";
import type { CookingSourceType } from "../../../../constants/ProcessingConstants";

/**
 * Get stop-burn level for a food type and cooking source.
 *
 * @param rawFoodId - Raw food item ID (e.g., "raw_shrimp")
 * @param sourceType - Cooking source type ("fire" or "range")
 * @returns Level at which burning stops, or 99 if invalid food
 */
export function getStopBurnLevel(
  rawFoodId: string,
  sourceType: CookingSourceType,
): number {
  return processingDataProvider.getStopBurnLevel(rawFoodId, sourceType);
}

/**
 * Calculate burn chance for cooking.
 *
 * Uses linear interpolation between levelRequired and stopBurnLevel:
 * - At levelRequired: ~100% burn chance (actually depends on food)
 * - At stopBurnLevel: 0% burn chance
 *
 * @param cookingLevel - Player's cooking level
 * @param rawFoodId - Raw food item ID
 * @param sourceType - Cooking source type ("fire" or "range")
 * @returns Burn probability (0-1)
 */
export function calculateBurnChance(
  cookingLevel: number,
  rawFoodId: string,
  sourceType: CookingSourceType,
): number {
  const levelRequired = getCookingLevelRequired(rawFoodId);
  const stopBurnLevel = getStopBurnLevel(rawFoodId, sourceType);

  // Already past stop-burn level
  if (cookingLevel >= stopBurnLevel) {
    return 0;
  }

  // Below level requirement (shouldn't happen, but handle gracefully)
  if (cookingLevel < levelRequired) {
    return 1;
  }

  // Linear interpolation between levelRequired and stopBurnLevel.
  // At levelRequired the burn chance starts at a capped maximum (not 100%)
  // so that meeting the requirement guarantees some chance of success.
  const range = stopBurnLevel - levelRequired;
  if (range <= 0) {
    return 0; // Edge case: stopBurn <= levelRequired
  }

  const MAX_BURN_CHANCE = 0.55; // ~55% burn at minimum level (classic MMORPG-like)
  const progress = cookingLevel - levelRequired;
  const rawBurn = 1 - progress / range;
  return Math.max(0, Math.min(MAX_BURN_CHANCE, rawBurn));
}

/**
 * Roll whether food burns based on burn chance.
 *
 * @param cookingLevel - Player's cooking level
 * @param rawFoodId - Raw food item ID
 * @param sourceType - Cooking source type
 * @returns True if food burns, false if successfully cooked
 */
export function rollBurn(
  cookingLevel: number,
  rawFoodId: string,
  sourceType: CookingSourceType,
): boolean {
  const burnChance = calculateBurnChance(cookingLevel, rawFoodId, sourceType);
  return Math.random() < burnChance;
}

/**
 * Get cooking XP for a food type.
 *
 * @param rawFoodId - Raw food item ID
 * @returns XP amount, or 0 if invalid food
 */
export function getCookingXP(rawFoodId: string): number {
  return processingDataProvider.getCookingXP(rawFoodId);
}

/**
 * Get required cooking level for a food type.
 *
 * @param rawFoodId - Raw food item ID
 * @returns Required level, or 1 if invalid food
 */
export function getCookingLevelRequired(rawFoodId: string): number {
  return processingDataProvider.getCookingLevel(rawFoodId);
}

/**
 * Check if player meets cooking level requirement for a food type.
 *
 * @param playerLevel - Player's cooking level
 * @param rawFoodId - Raw food item ID
 * @returns True if player can cook this food type
 */
export function meetsCookingLevel(
  playerLevel: number,
  rawFoodId: string,
): boolean {
  const required = getCookingLevelRequired(rawFoodId);
  return playerLevel >= required;
}

/**
 * Check if an item ID is a valid raw food type.
 *
 * @param itemId - Item ID to check
 * @returns True if valid raw food
 */
export function isValidRawFood(itemId: string): boolean {
  return processingDataProvider.isCookable(itemId);
}

/**
 * Get cooked item ID from raw food ID.
 *
 * @param rawFoodId - Raw food item ID
 * @returns Cooked item ID, or null if invalid
 */
export function getCookedItemId(rawFoodId: string): string | null {
  return processingDataProvider.getCookedItemId(rawFoodId);
}

/**
 * Get burnt item ID from raw food ID.
 *
 * @param rawFoodId - Raw food item ID
 * @returns Burnt item ID, or null if invalid
 */
export function getBurntItemId(rawFoodId: string): string | null {
  return processingDataProvider.getBurntItemId(rawFoodId);
}

/**
 * Get all valid raw food IDs.
 *
 * @returns Set of valid raw food item IDs
 */
export function getValidRawFoodIds(): Set<string> {
  return processingDataProvider.getCookableItemIds();
}
