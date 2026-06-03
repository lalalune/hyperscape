/**
 * Centralized Item Detection Utilities
 *
 * This module provides consistent item detection across the entire plugin.
 * Items can have different formats depending on source:
 * - `name`: Display name (e.g., "Bronze Hatchet")
 * - `itemId`: Item type identifier (e.g., "bronze_hatchet")
 * - `id`: Unique instance ID
 *
 * IMPORTANT: Always use these utilities instead of writing custom detection logic.
 * This prevents bugs from inconsistent item checking.
 */

import type { InventoryItem } from "../types.js";

/**
 * Item with flexible format - covers all possible item shapes
 */
interface FlexibleItem {
  name?: string;
  itemId?: string;
  id?: string;
  item?: { name?: string };
  quantity?: number;
}

/**
 * Player entity with items and equipment
 * Note: Uses a flexible type to support different PlayerEntity implementations
 * across the codebase (some have Equipment type, some have inline object)
 */
interface PlayerWithInventory {
  items?: FlexibleItem[];
  equipment?: unknown;
}

/**
 * Safely extract the weapon from equipment (handles different equipment types)
 * Equipment.weapon can be:
 * - A string (item ID like "bronze_hatchet")
 * - An object with itemId/name properties
 * - null/undefined
 */
function getEquippedWeapon(equipment: unknown): string {
  if (!equipment || typeof equipment !== "object") return "";
  const eq = equipment as { weapon?: unknown };
  const weapon = eq.weapon;

  if (!weapon) return "";

  // If weapon is a string, use it directly
  if (typeof weapon === "string") {
    return weapon.toLowerCase();
  }

  // If weapon is an object, extract itemId or name
  if (typeof weapon === "object") {
    const weaponObj = weapon as { itemId?: string; name?: string; id?: string };
    const weaponName = weaponObj.itemId || weaponObj.name || weaponObj.id || "";
    return typeof weaponName === "string" ? weaponName.toLowerCase() : "";
  }

  return "";
}

/**
 * Get the normalized name of an item (lowercase).
 * Handles all possible item formats consistently.
 *
 * @param item - Item in any format
 * @returns Normalized lowercase name, or empty string if not found
 */
export function getItemName(
  item: FlexibleItem | InventoryItem | null | undefined,
): string {
  if (!item) return "";

  // Check all possible name fields in priority order
  const flexItem = item as FlexibleItem;

  // 1. Direct name property
  if (item.name && typeof item.name === "string") {
    return item.name.toLowerCase();
  }

  // 2. itemId property (common in inventory system)
  if (item.itemId && typeof item.itemId === "string") {
    return item.itemId.toLowerCase();
  }

  // 3. Nested item.name (some legacy formats)
  if (flexItem.item?.name && typeof flexItem.item.name === "string") {
    return flexItem.item.name.toLowerCase();
  }

  // 4. id property as last resort
  if (item.id && typeof item.id === "string") {
    return item.id.toLowerCase();
  }

  return "";
}

/**
 * Get normalized names for all items in an array
 *
 * @param items - Array of items in any format
 * @returns Array of lowercase item names
 */
export function getItemNames(
  items: (FlexibleItem | InventoryItem)[] | null | undefined,
): string[] {
  if (!items || !Array.isArray(items)) return [];
  return items.map(getItemName).filter(Boolean);
}

/**
 * Check if any item matches a search term
 *
 * @param items - Array of items
 * @param searchTerm - Term to search for (case-insensitive)
 * @returns true if any item contains the search term
 */
export function hasItemMatching(
  items: (FlexibleItem | InventoryItem)[] | null | undefined,
  searchTerm: string,
): boolean {
  const names = getItemNames(items);
  const term = searchTerm.toLowerCase();
  return names.some((name) => name.includes(term));
}

/**
 * Check if any item matches any of the search terms
 *
 * @param items - Array of items
 * @param searchTerms - Terms to search for (case-insensitive)
 * @returns true if any item contains any search term
 */
export function hasItemMatchingAny(
  items: (FlexibleItem | InventoryItem)[] | null | undefined,
  searchTerms: string[],
): boolean {
  const names = getItemNames(items);
  const terms = searchTerms.map((t) => t.toLowerCase());
  return names.some((name) => terms.some((term) => name.includes(term)));
}

// ============================================
// SPECIFIC TOOL DETECTION FUNCTIONS
// ============================================

/**
 * Check if player has an axe or hatchet (for woodcutting)
 * Checks both inventory and equipped weapon
 *
 * @param player - Player entity with items and equipment
 * @returns true if player has any axe/hatchet
 */
export function hasAxe(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;

  // Check inventory for axe or hatchet
  const hasInInventory = hasItemMatchingAny(player.items, ["axe", "hatchet"]);

  // Check equipped weapon
  const weapon = getEquippedWeapon(player.equipment);
  const hasEquipped = weapon.includes("axe") || weapon.includes("hatchet");

  return hasInInventory || hasEquipped;
}

/**
 * Check if player has a pickaxe (for mining)
 * Checks both inventory and equipped weapon
 *
 * @param player - Player entity with items and equipment
 * @returns true if player has any pickaxe
 */
export function hasPickaxe(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;

  // Check inventory
  const hasInInventory = hasItemMatching(player.items, "pickaxe");

  // Check equipped weapon
  const weapon = getEquippedWeapon(player.equipment);
  const hasEquipped = weapon.includes("pickaxe");

  return hasInInventory || hasEquipped;
}

/**
 * Check if player has a tinderbox (for firemaking)
 *
 * @param player - Player entity with items
 * @returns true if player has a tinderbox
 */
export function hasTinderbox(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;
  return hasItemMatching(player.items, "tinderbox");
}

/**
 * Check if player has fishing equipment (net, rod, harpoon, etc.)
 *
 * @param player - Player entity with items
 * @returns true if player has any fishing equipment
 */
export function hasFishingEquipment(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;

  const names = getItemNames(player.items);
  return names.some(
    (name) =>
      name.includes("fishing net") ||
      name.includes("small fishing net") ||
      name.includes("small_fishing_net") ||
      name.includes("fishing rod") ||
      name.includes("fly fishing rod") ||
      name.includes("harpoon") ||
      name.includes("lobster pot") ||
      (name.includes("net") &&
        (name.includes("fish") || name.includes("small"))),
  );
}

/**
 * Check if player has a weapon equipped
 *
 * @param player - Player entity with equipment
 * @returns true if player has a weapon equipped
 */
export function hasWeapon(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;
  return getEquippedWeapon(player.equipment).length > 0;
}

/**
 * Check if player has a combat-capable item (equipped OR in inventory)
 * In OSRS, hatchets and pickaxes can be equipped and used as melee weapons.
 *
 * @param player - Player entity with items and equipment
 * @returns true if player has any combat-capable item
 */
export function hasCombatCapableItem(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;

  // Check equipped weapon first
  if (hasWeapon(player)) return true;

  // Check inventory for combat-capable items.
  // Validated against packages/server/world/assets/manifests/items/weapons.json.
  // Uses "shortsword" not "sword" to avoid matching "swordfish" food items.
  const names = getItemNames(player.items);
  return names.some(
    (name) =>
      name.includes("shortsword") ||
      name.includes("longsword") ||
      name.includes("scimitar") ||
      name.includes("dagger") ||
      name.includes("2h sword") ||
      name.includes("2h_sword") ||
      name.includes("hatchet") || // Hatchets are valid melee weapons
      name.includes("pickaxe") || // Pickaxes are valid melee weapons
      name.includes("shortbow") ||
      name.includes("longbow") ||
      name.includes("staff"),
  );
}

/**
 * Check if player has food in inventory
 *
 * @param player - Player entity with items
 * @returns true if player has any food
 */
/** Check if an item name looks like food (matches server food.json manifest patterns) */
function isFoodName(name: string): boolean {
  return (
    name.includes("shrimp") ||
    name.includes("anchovies") ||
    name.includes("sardine") ||
    name.includes("herring") ||
    name.includes("trout") ||
    name.includes("salmon") ||
    name.includes("tuna") ||
    name.includes("lobster") ||
    name.includes("swordfish") ||
    name.includes("shark") ||
    name.includes("bread") ||
    name.includes("cake") ||
    name.includes("cooked") ||
    name.includes("meat") ||
    name.includes("pie")
  );
}

export function hasFood(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;

  const names = getItemNames(player.items);
  return names.some(isFoodName);
}

/**
 * Count the number of food items in player inventory
 */
export function countFood(
  player: PlayerWithInventory | null | undefined,
): number {
  if (!player) return 0;

  const names = getItemNames(player.items);
  return names.filter(isFoodName).length;
}

/**
 * Check if player has logs in inventory
 *
 * @param player - Player entity with items
 * @returns true if player has any logs
 */
export function hasLogs(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;
  return hasItemMatching(player.items, "log");
}

/**
 * Check if player has ore in inventory
 *
 * @param player - Player entity with items
 * @returns true if player has any ore
 */
export function hasOre(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;
  return hasItemMatching(player.items, "ore");
}

/**
 * Check if player has bars in inventory
 *
 * @param player - Player entity with items
 * @returns true if player has any metal bars
 */
export function hasBars(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;
  return hasItemMatching(player.items, "bar");
}

/**
 * Check if player has raw food in inventory
 *
 * @param player - Player entity with items
 * @returns true if player has any raw food
 */
export function hasRawFood(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;
  return hasItemMatching(player.items, "raw");
}

/**
 * Check if player has a knife (for fletching)
 *
 * @param player - Player entity with items
 * @returns true if player has a knife
 */
export function hasKnife(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;
  return hasItemMatching(player.items, "knife");
}

/**
 * Check if player has hides (for tanning)
 *
 * @param player - Player entity with items
 * @returns true if player has any hides
 */
export function hasHides(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;
  return hasItemMatchingAny(player.items, ["hide", "cowhide", "dragonhide"]);
}

/**
 * Check if player has rune/pure essence (for runecrafting)
 *
 * @param player - Player entity with items
 * @returns true if player has any essence
 */
export function hasEssence(
  player: PlayerWithInventory | null | undefined,
): boolean {
  if (!player) return false;
  return hasItemMatching(player.items, "essence");
}

/**
 * Check if player has basic gathering tools (axe AND pickaxe)
 *
 * @param player - Player entity with items
 * @returns true if player has both axe and pickaxe
 */
export function hasBasicTools(
  player: PlayerWithInventory | null | undefined,
): boolean {
  return hasAxe(player) && hasPickaxe(player);
}

/**
 * Get a summary of what tools/equipment the player has
 *
 * @param player - Player entity with items and equipment
 * @returns Object with boolean flags for each tool type
 */
export function getEquipmentSummary(
  player: PlayerWithInventory | null | undefined,
): {
  hasAxe: boolean;
  hasPickaxe: boolean;
  hasTinderbox: boolean;
  hasFishingEquipment: boolean;
  hasWeapon: boolean;
  hasFood: boolean;
  hasLogs: boolean;
  hasOre: boolean;
  hasBars: boolean;
  hasRawFood: boolean;
} {
  return {
    hasAxe: hasAxe(player),
    hasPickaxe: hasPickaxe(player),
    hasTinderbox: hasTinderbox(player),
    hasFishingEquipment: hasFishingEquipment(player),
    hasWeapon: hasWeapon(player),
    hasFood: hasFood(player),
    hasLogs: hasLogs(player),
    hasOre: hasOre(player),
    hasBars: hasBars(player),
    hasRawFood: hasRawFood(player),
  };
}
