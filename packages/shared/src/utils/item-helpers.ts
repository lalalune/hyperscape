/**
 * rules-accurate item type detection helpers.
 * Used for context menu ordering and left-click default actions.
 *
 * These helpers determine:
 * - Primary action for left-click (Eat, Wield, Use, etc.)
 * - Context menu action ordering
 * - Item classification for UI purposes
 */

import type { Item } from "../types/game/item-types";

// ============================================================================
// ITEM TYPE DETECTION
// ============================================================================

/** Food items - have healAmount and are consumable (excludes potions) */
export function isFood(item: Item | null): boolean {
  if (!item) return false;
  return (
    item.type === "consumable" &&
    typeof item.healAmount === "number" &&
    item.healAmount > 0 &&
    !item.id.includes("potion")
  );
}

/** Potions - consumable items with "potion" in ID */
export function isPotion(item: Item | null): boolean {
  if (!item) return false;
  return item.type === "consumable" && item.id.includes("potion");
}

/** Bones - items that can be buried for Prayer XP */
export function isBone(item: Item | null): boolean {
  if (!item) return false;
  return item.id === "bones" || item.id.endsWith("_bones");
}

/** Weapons - equipSlot is weapon or 2h, or has weaponType */
export function isWeapon(item: Item | null): boolean {
  if (!item) return false;
  return (
    item.equipSlot === "weapon" ||
    item.equipSlot === "2h" ||
    item.is2h === true ||
    item.weaponType != null
  );
}

/** Shields/Defenders - equipSlot is shield */
export function isShield(item: Item | null): boolean {
  if (!item) return false;
  return item.equipSlot === "shield";
}

/** Equipment that uses "Wield" (weapons + shields) */
export function usesWield(item: Item | null): boolean {
  return isWeapon(item) || isShield(item);
}

/** Equipment that uses "Wear" (all other equipment: head, body, legs, etc.) */
export function usesWear(item: Item | null): boolean {
  if (!item) return false;
  if (!item.equipable && !item.equipSlot) return false;
  return !usesWield(item);
}

/** Bank notes - cannot be eaten/equipped, only Use/Drop/Examine */
export function isNotedItem(item: Item | null): boolean {
  if (!item) return false;
  return item.isNoted === true || item.id.endsWith("_noted");
}

// ============================================================================
// PRIMARY ACTION DETECTION
// ============================================================================

/** Primary action types for inventory left-click */
export type PrimaryActionType =
  | "eat"
  | "drink"
  | "bury"
  | "wield"
  | "wear"
  | "use";

/** Valid inventory actions that have handlers */
export const HANDLED_INVENTORY_ACTIONS = new Set<string>([
  "eat",
  "drink",
  "bury",
  "wield",
  "wear",
  "drop",
  "examine",
  "use",
]);

/**
 * Get primary action from manifest's inventoryActions (rules-accurate approach).
 * Returns the first action in the array, or null if no actions defined.
 *
 * classic MMORPG stores explicit inventory options per item in the manifest.
 * First option is always the left-click default.
 */
export function getPrimaryActionFromManifest(
  item: Item | null,
): PrimaryActionType | null {
  if (!item?.inventoryActions || item.inventoryActions.length === 0) {
    return null;
  }
  const firstAction = item.inventoryActions[0].toLowerCase();
  switch (firstAction) {
    case "eat":
      return "eat";
    case "drink":
      return "drink";
    case "bury":
      return "bury";
    case "wield":
      return "wield";
    case "wear":
      return "wear";
    case "use":
    default:
      return "use";
  }
}

/**
 * Get primary action using manifest-first approach with heuristic fallback.
 * rules-accurate: reads from inventoryActions if available.
 */
export function getPrimaryAction(
  item: Item | null,
  isNoted: boolean,
): PrimaryActionType {
  if (isNoted) return "use";

  const manifestAction = getPrimaryActionFromManifest(item);
  if (manifestAction) return manifestAction;

  // Fallback to heuristic detection
  if (isFood(item)) return "eat";
  if (isPotion(item)) return "drink";
  if (isBone(item)) return "bury";
  if (usesWield(item)) return "wield";
  if (usesWear(item)) return "wear";

  return "use";
}
