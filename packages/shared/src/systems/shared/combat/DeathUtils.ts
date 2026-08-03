/**
 * DeathUtils.ts — Pure utility functions for the player death pipeline.
 *
 * Extracted from PlayerDeathSystem to reduce file size and improve testability.
 * All functions are stateless and side-effect-free.
 */

import type { InventoryItem } from "../../../types/core/core";
import { dataManager } from "../../../data/DataManager";

/** Prefix for gravestone entity IDs. Used in ID generation and filtering. */
export const GRAVESTONE_ID_PREFIX = "gravestone_";

/**
 * Sanitize killedBy string to prevent injection attacks
 * - Normalizes Unicode to prevent homograph attacks (Cyrillic 'а' vs Latin 'a')
 * - Removes zero-width characters and BiDi overrides that could manipulate display
 * - Removes control characters and dangerous HTML characters
 * - Limits length to prevent buffer overflow attacks
 * - Defaults to "unknown" for invalid inputs
 */
export function sanitizeKilledBy(killedBy: unknown): string {
  if (typeof killedBy !== "string" || !killedBy) {
    return "unknown";
  }

  // Normalize Unicode to NFKC form to prevent homograph attacks
  const normalized = killedBy.normalize("NFKC");

  // Build sanitized string character by character
  let sanitized = "";
  for (const char of normalized) {
    const code = char.charCodeAt(0);

    // Skip zero-width characters (U+200B-U+200D, U+FEFF)
    if (code >= 0x200b && code <= 0x200d) continue;
    if (code === 0xfeff) continue;

    // Skip BiDi override characters (U+202A-U+202E)
    if (code >= 0x202a && code <= 0x202e) continue;

    // Skip control characters (0x00-0x1F and 0x7F)
    if (code < 32 || code === 127) continue;

    // Skip dangerous HTML characters
    if ("<>'\"&".includes(char)) continue;

    sanitized += char;
  }

  sanitized = sanitized.trim().substring(0, 64); // Limit to 64 characters
  return sanitized || "unknown";
}

/**
 * classic MMORPG-style: In safe zones, player keeps their 3 most valuable items on death.
 */
export const ITEMS_KEPT_ON_DEATH = 3;

/**
 * Get the value of an item from manifest data.
 * Returns 0 for unknown items (they sort to bottom and get dropped first).
 */
export function getItemValue(itemId: string): number {
  const item = dataManager.getItem(itemId);
  return item?.value ?? 0;
}

/**
 * Split items into "kept" and "dropped" lists for safe zone deaths (classic MMORPG-style).
 * Keeps the N most valuable individual items. For stacked items (quantity > 1),
 * each unit counts as one item but only the top N units across all stacks are kept.
 *
 * Uses O(n log n) on unique items — does NOT expand stacks into individual entries,
 * avoiding memory explosion for large quantities (e.g. 10,000 arrows).
 *
 * Returns { kept: items retained by player, dropped: items for gravestone }
 */
export function splitItemsForSafeDeath(
  allItems: InventoryItem[],
  keepCount: number,
): { kept: InventoryItem[]; dropped: InventoryItem[] } {
  if (keepCount <= 0) {
    return { kept: [], dropped: [...allItems] };
  }

  // Build value-tagged entries (one per unique item slot, not per unit)
  const tagged = allItems.map((item, index) => ({
    item,
    index,
    unitValue: getItemValue(item.itemId),
  }));

  // Sort descending by value (most valuable first).
  // Tiebreak on original index for deterministic behavior when values are equal.
  tagged.sort((a, b) => b.unitValue - a.unitValue || a.index - b.index);

  // Greedily assign keep-count without expanding stacks
  const keptCounts = new Map<number, number>();
  let remaining = keepCount;
  for (const entry of tagged) {
    if (remaining <= 0) break;
    const toKeep = Math.min(entry.item.quantity, remaining);
    keptCounts.set(entry.index, toKeep);
    remaining -= toKeep;
  }

  const kept: InventoryItem[] = [];
  const dropped: InventoryItem[] = [];

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const keptQty = keptCounts.get(i) ?? 0;
    const droppedQty = item.quantity - keptQty;

    if (keptQty > 0) {
      kept.push({ ...item, quantity: keptQty });
    }
    if (droppedQty > 0) {
      dropped.push({ ...item, quantity: droppedQty });
    }
  }

  return { kept, dropped };
}

/** Position validation constants */
export const POSITION_VALIDATION = {
  WORLD_BOUNDS: 10000, // Max 10km from origin
  MAX_HEIGHT: 500, // Max height
  MIN_HEIGHT: -50, // Allow some underground (caves)
} as const;

/** Check if a number is valid for position use */
export function isValidPositionNumber(n: number): boolean {
  return Number.isFinite(n);
}

/**
 * Validate and clamp a position to world bounds
 * @param position - Position to validate
 * @returns Validated and clamped position, or null if completely invalid
 */
export function validatePosition(position: {
  x: number;
  y: number;
  z: number;
}): { x: number; y: number; z: number } | null {
  const { x, y, z } = position;

  // Check for invalid numbers (NaN, Infinity)
  if (
    !isValidPositionNumber(x) ||
    !isValidPositionNumber(y) ||
    !isValidPositionNumber(z)
  ) {
    return null;
  }

  // Clamp to world bounds
  return {
    x: Math.max(
      -POSITION_VALIDATION.WORLD_BOUNDS,
      Math.min(POSITION_VALIDATION.WORLD_BOUNDS, x),
    ),
    y: Math.max(
      POSITION_VALIDATION.MIN_HEIGHT,
      Math.min(POSITION_VALIDATION.MAX_HEIGHT, y),
    ),
    z: Math.max(
      -POSITION_VALIDATION.WORLD_BOUNDS,
      Math.min(POSITION_VALIDATION.WORLD_BOUNDS, z),
    ),
  };
}

/**
 * Check if position is within world bounds without clamping
 */
export function isPositionInBounds(position: {
  x: number;
  y: number;
  z: number;
}): boolean {
  return (
    Math.abs(position.x) <= POSITION_VALIDATION.WORLD_BOUNDS &&
    Math.abs(position.z) <= POSITION_VALIDATION.WORLD_BOUNDS &&
    position.y >= POSITION_VALIDATION.MIN_HEIGHT &&
    position.y <= POSITION_VALIDATION.MAX_HEIGHT
  );
}
