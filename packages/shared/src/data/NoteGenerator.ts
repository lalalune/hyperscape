/**
 * Note Generator - Runtime Bank Note Generation
 *
 * Automatically generates "noted" variants for eligible items at runtime.
 * This avoids manual duplication in item manifests - any tradeable,
 * non-stackable item automatically gets a noted version.
 *
 * OSRS Note Rules:
 * - Only tradeable, non-stackable items can be noted
 * - Already stackable items (arrows, runes, coins) cannot be noted
 * - Untradeable/quest items cannot be noted
 * - Noted items are always stackable
 * - Noted items cannot be equipped, eaten, or used
 *
 * Data Flow:
 *   BANK: stores base items (e.g., "logs")
 *   WITHDRAW (asNote=true): gives "logs_noted" to inventory
 *   DEPOSIT "logs_noted": auto-converts to "logs" in bank
 */

import type { Item } from "../types/game/item-types";
import { ItemRarity } from "../types/entities";

/** NOTE SUFFIX: Appended to base item ID to create noted variant */
export const NOTE_SUFFIX = "_noted";

/**
 * Determine if an item should have a noted variant generated.
 *
 * OSRS Rules:
 * - Must be tradeable (default true for most items)
 * - Must NOT already be stackable (stackable items don't need notes)
 * - Must NOT be currency type (coins are inherently stackable)
 * - Must NOT already be a noted item
 * - Must NOT have noteable explicitly set to false
 *
 * @param item - The item to check
 * @returns true if a noted variant should be generated
 */
export function shouldGenerateNote(item: Item): boolean {
  // Already a note? Skip
  if (item.isNoted) {
    return false;
  }

  // Already has a noted variant? Skip (prevents re-generation)
  if (item.notedItemId) {
    return false;
  }

  // Explicitly marked as non-noteable? Skip
  if (item.noteable === false) {
    return false;
  }

  // Currency items (coins, tokens) are inherently stackable - skip
  if (item.type === "currency") {
    return false;
  }

  // Already stackable items don't need notes
  if (item.stackable === true) {
    return false;
  }

  // Untradeable items cannot be noted (OSRS rule)
  // Default to tradeable if not specified
  const isTradeable = item.tradeable !== false;
  if (!isTradeable) {
    return false;
  }

  // All checks passed - this item can be noted
  return true;
}

/**
 * Generate the noted variant of a base item.
 *
 * Noted items have these properties:
 * - ID: "{baseId}_noted"
 * - Name: "{baseName} (noted)"
 * - Always stackable
 * - Cannot be equipped
 * - Cannot be eaten/used
 * - Zero weight (notes are paper)
 * - Same value as base item
 * - References back to base item via baseItemId
 *
 * @param baseItem - The original (unnoted) item
 * @returns The noted variant of the item
 */
export function generateNotedItem(baseItem: Item): Item {
  const notedId = `${baseItem.id}${NOTE_SUFFIX}`;

  return {
    // Core identity
    id: notedId,
    name: `${baseItem.name} (noted)`,
    type: baseItem.type,
    description: `A bank note for: ${baseItem.description || baseItem.name}`,
    examine: `A bank note for ${baseItem.quantity ?? 1}x ${baseItem.name}.`,

    // Inherit tradeable and rarity from base
    tradeable: baseItem.tradeable,
    rarity: baseItem.rarity || ItemRarity.COMMON,

    // Visual: Same model/icon as base item (client adds "N" badge)
    modelPath: baseItem.modelPath, // Uses same model (client renders differently)
    iconPath: baseItem.iconPath, // Same icon (client adds "N" overlay)

    // Noted items are ALWAYS stackable
    stackable: true,
    maxStackSize: 2147483647, // Max int32

    // Notes are weightless (paper)
    weight: 0,

    // Same value for trading/selling
    value: baseItem.value,

    // Cannot be equipped
    equipable: false,
    equipSlot: null,

    // Cannot be eaten/consumed
    healAmount: undefined,

    // Cannot attack with notes
    weaponType: undefined,
    attackType: undefined,
    attackSpeed: undefined,
    attackRange: undefined,
    bonuses: undefined,
    requirements: undefined,

    // Note system fields
    isNoted: true,
    baseItemId: baseItem.id,
    noteable: false, // Notes themselves cannot be noted again
  };
}

/**
 * Generate noted variants for all eligible items and cross-link them.
 *
 * Process:
 * 1. Filter items that should have noted variants
 * 2. Generate noted items for each
 * 3. Update base items with notedItemId reference
 * 4. Return combined map with all items
 *
 * @param items - Map of all base items
 * @returns New map containing all items (base + noted)
 */
export function generateAllNotedItems(
  items: Map<string, Item>,
): Map<string, Item> {
  const result = new Map<string, Item>(items);
  let generatedCount = 0;

  for (const [_id, item] of items) {
    if (shouldGenerateNote(item)) {
      // Generate the noted variant
      const notedItem = generateNotedItem(item);

      // Add noted item to result
      result.set(notedItem.id, notedItem);

      // Update base item with cross-reference
      const baseItem = result.get(item.id);
      if (baseItem) {
        // Mutate the existing item in the result map
        baseItem.noteable = true;
        baseItem.notedItemId = notedItem.id;
      }

      generatedCount++;
    }
  }

  if (generatedCount > 0) {
    console.log(
      `[NoteGenerator] Generated ${generatedCount} noted item variants`,
    );
  }

  return result;
}

/**
 * Get the base item ID from a noted item ID.
 * Returns the input unchanged if not a noted item.
 *
 * @param itemId - Item ID (possibly noted)
 * @returns Base item ID
 */
export function getBaseItemId(itemId: string): string {
  if (itemId.endsWith(NOTE_SUFFIX)) {
    return itemId.slice(0, -NOTE_SUFFIX.length);
  }
  return itemId;
}

/**
 * Get the noted item ID from a base item ID.
 *
 * @param itemId - Base item ID
 * @returns Noted item ID
 */
export function getNotedItemId(itemId: string): string {
  if (itemId.endsWith(NOTE_SUFFIX)) {
    return itemId; // Already noted
  }
  return `${itemId}${NOTE_SUFFIX}`;
}

/**
 * Check if an item ID represents a noted item.
 *
 * @param itemId - Item ID to check
 * @returns true if this is a noted item ID
 */
export function isNotedItemId(itemId: string): boolean {
  return itemId.endsWith(NOTE_SUFFIX);
}
