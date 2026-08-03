/**
 * SmithingConstants - Centralized constants for smelting and smithing systems
 *
 * This file contains all hardcoded values used across the smithing feature,
 * making it easier to maintain consistency and adjust values.
 *
 */

import { COMBAT_CONSTANTS } from "./CombatConstants";

export const SMITHING_CONSTANTS = {
  // Item IDs
  HAMMER_ITEM_ID: "hammer",
  COAL_ITEM_ID: "coal",

  // Tick-based timing defaults (used when manifest doesn't specify)
  // classic MMORPG: smelting and smithing both take 4 ticks
  DEFAULT_SMELTING_TICKS: 4,
  DEFAULT_SMITHING_TICKS: 4,

  // Tick duration (from CombatConstants for consistency)
  TICK_DURATION_MS: COMBAT_CONSTANTS.TICK_DURATION_MS,

  // Input validation limits
  MAX_QUANTITY: 10000,
  MIN_QUANTITY: 1,
  MAX_ITEM_ID_LENGTH: 64,

  // Messages - Smelting
  MESSAGES: {
    // Smelting messages
    ALREADY_SMELTING: "You are already smelting.",
    NO_ITEMS: "You have no items.",
    NO_ORES: "You don't have the ores to smelt anything.",
    INVALID_BAR: "Invalid bar type.",
    LEVEL_TOO_LOW_SMELT: "You need level {level} Smithing to smelt that.",
    SMELTING_START: "You begin smelting {item}s.",
    OUT_OF_MATERIALS: "You have run out of materials.",
    SMELT_SUCCESS: "You smelt a {item}.",
    IRON_SMELT_FAIL: "The ore is too impure and you fail to smelt it.",

    // Smithing messages
    ALREADY_SMITHING: "You are already smithing.",
    NO_HAMMER: "You need a hammer to work the metal on this anvil.",
    NO_BARS: "You don't have the bars to smith anything.",
    INVALID_RECIPE: "Invalid smithing recipe.",
    LEVEL_TOO_LOW_SMITH: "You need level {level} Smithing to make that.",
    SMITHING_START: "You begin smithing {item}s.",
    OUT_OF_BARS: "You have run out of bars.",
    SMITH_SUCCESS: "You hammer the {metal} and make a {item}.",
  },
} as const;

/**
 * Helper function to format messages with placeholders
 * @param message - Message template with {placeholder} syntax
 * @param values - Object with placeholder values
 */
export function formatMessage(
  message: string,
  values: Record<string, string | number>,
): string {
  let result = message;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

/**
 * Sanitize an item ID for safe logging (prevents log injection)
 */
export function sanitizeForLogging(input: string): string {
  return input.replace(/[^\w_-]/g, "");
}

/**
 * Validate and clamp quantity to safe bounds
 */
export function clampQuantity(quantity: unknown): number {
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    return SMITHING_CONSTANTS.MIN_QUANTITY;
  }
  return Math.floor(
    Math.max(
      SMITHING_CONSTANTS.MIN_QUANTITY,
      Math.min(quantity, SMITHING_CONSTANTS.MAX_QUANTITY),
    ),
  );
}

/**
 * Validate a string ID (barItemId, furnaceId, recipeId, anvilId)
 */
export function isValidItemId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= SMITHING_CONSTANTS.MAX_ITEM_ID_LENGTH
  );
}

/**
 * Loose inventory item type - matches items from inventory lookups
 * where quantity may be undefined (defaults to 1)
 */
export interface LooseInventoryItem {
  itemId: string;
  quantity?: number;
  slot?: number;
  metadata?: Record<string, unknown> | null;
}

/**
 * Type guard to validate an object is a valid inventory item
 * Validates structure, allows missing quantity (defaults to 1)
 */
export function isLooseInventoryItem(
  item: unknown,
): item is LooseInventoryItem {
  if (typeof item !== "object" || item === null) return false;
  if (!("itemId" in item)) return false;
  if (typeof (item as LooseInventoryItem).itemId !== "string") return false;

  // quantity is optional, but if present must be a number
  const qty = (item as LooseInventoryItem).quantity;
  if (qty !== undefined && typeof qty !== "number") return false;

  return true;
}

/**
 * Get quantity from an inventory item, defaulting to 1 if not present
 */
export function getItemQuantity(item: LooseInventoryItem): number {
  return item.quantity ?? 1;
}

/**
 * Convert ticks to milliseconds for setTimeout scheduling
 * @param ticks - Number of game ticks (1 tick = 600ms in classic MMORPG)
 */
export function ticksToMs(ticks: number): number {
  return ticks * SMITHING_CONSTANTS.TICK_DURATION_MS;
}

// ============================================================================
// PLAYER SKILLS TYPE GUARDS
// ============================================================================

/**
 * Skill data structure with level and XP
 */
export interface SkillLevelData {
  level: number;
  xp?: number;
}

/**
 * Entity that has skills (player or NPC with skill levels)
 */
export interface EntityWithSkills {
  id: string;
  skills?: {
    smithing?: SkillLevelData;
    [key: string]: SkillLevelData | undefined;
  };
}

/**
 * Type guard to check if an entity has a valid skills object.
 * Use this instead of loose type assertions like `player as { skills?: ... }`.
 *
 * @param entity - The entity to check
 * @returns true if entity has a valid skills structure
 */
export function hasSkills(entity: unknown): entity is EntityWithSkills {
  if (!entity || typeof entity !== "object") return false;
  if (!("id" in entity) || typeof (entity as EntityWithSkills).id !== "string")
    return false;

  const skills = (entity as EntityWithSkills).skills;
  if (skills === undefined) return true; // skills is optional
  if (typeof skills !== "object" || skills === null) return false;

  return true;
}

/**
 * Get smithing level from an entity safely.
 * Returns the smithing level if available, or the default (1) if not.
 *
 * @param entity - The entity to get smithing level from
 * @param defaultLevel - Default level to return if not found (default: 1)
 * @returns The entity's smithing level
 */
export function getSmithingLevelSafe(
  entity: unknown,
  defaultLevel = 1,
): number {
  if (!hasSkills(entity)) return defaultLevel;
  return entity.skills?.smithing?.level ?? defaultLevel;
}
