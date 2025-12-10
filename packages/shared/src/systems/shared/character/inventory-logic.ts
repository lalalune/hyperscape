/**
 * Inventory Pure Logic Module
 *
 * PURE FUNCTIONS for inventory operations.
 * No side effects, no system dependencies, fully unit testable.
 *
 * Each function:
 * - Validates inputs strictly (throws on invalid)
 * - Returns a result object (never mutates input directly)
 * - Has no external dependencies
 */

import {
  ValidationError,
  assertPlayerId,
  assertItemId,
  assertSlotIndex,
  assertQuantity,
  assertNonNegativeInteger,
  assertDefined,
  assertObject,
} from "../../../validation";
import { INPUT_LIMITS } from "../../../constants";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Item in an inventory slot
 */
export interface InventorySlot {
  slot: number;
  itemId: string;
  quantity: number;
  item: {
    id: string;
    name: string;
    type: string;
    stackable: boolean;
    weight: number;
  };
}

/**
 * Result of a move operation
 */
export interface MoveResult {
  success: boolean;
  error?: string;
  fromSlot: InventorySlot | null;
  toSlot: InventorySlot | null;
}

/**
 * Result of an add operation
 */
export interface AddResult {
  success: boolean;
  error?: string;
  slot?: number;
  addedQuantity: number;
  isNewStack: boolean;
}

/**
 * Result of a remove operation
 */
export interface RemoveResult {
  success: boolean;
  error?: string;
  removedQuantity: number;
  remainingQuantity: number;
  slotCleared: boolean;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a move item request strictly
 * @throws ValidationError if invalid
 */
export function validateMoveRequest(
  playerId: unknown,
  fromSlot: unknown,
  toSlot: unknown
): { playerId: string; fromSlot: number; toSlot: number } {
  assertPlayerId(playerId, "playerId");
  assertSlotIndex(fromSlot, "fromSlot");
  assertSlotIndex(toSlot, "toSlot");

  return {
    playerId: playerId as string,
    fromSlot: fromSlot as number,
    toSlot: toSlot as number,
  };
}

/**
 * Validate an add item request strictly
 * @throws ValidationError if invalid
 */
export function validateAddRequest(
  playerId: unknown,
  itemId: unknown,
  quantity: unknown,
  slot?: unknown
): { playerId: string; itemId: string; quantity: number; slot?: number } {
  assertPlayerId(playerId, "playerId");
  assertItemId(itemId, "itemId");
  assertQuantity(quantity, "quantity");

  if (slot !== undefined) {
    assertSlotIndex(slot, "slot");
  }

  return {
    playerId: playerId as string,
    itemId: itemId as string,
    quantity: quantity as number,
    slot: slot as number | undefined,
  };
}

/**
 * Validate a remove item request strictly
 * @throws ValidationError if invalid
 */
export function validateRemoveRequest(
  playerId: unknown,
  itemId: unknown,
  quantity: unknown,
  slot?: unknown
): { playerId: string; itemId: string; quantity: number; slot?: number } {
  assertPlayerId(playerId, "playerId");
  assertItemId(itemId, "itemId");
  assertQuantity(quantity, "quantity");

  if (slot !== undefined) {
    assertSlotIndex(slot, "slot");
  }

  return {
    playerId: playerId as string,
    itemId: itemId as string,
    quantity: quantity as number,
    slot: slot as number | undefined,
  };
}

// =============================================================================
// PURE LOGIC FUNCTIONS
// =============================================================================

/**
 * Find the first empty slot in an inventory
 *
 * @param items - Current inventory items
 * @param maxSlots - Maximum slot count
 * @returns Empty slot index, or -1 if full
 */
export function findEmptySlot(
  items: ReadonlyArray<{ slot: number }>,
  maxSlots: number = INPUT_LIMITS.MAX_INVENTORY_SLOTS
): number {
  const usedSlots = new Set<number>();
  for (const item of items) {
    usedSlots.add(item.slot);
  }

  for (let i = 0; i < maxSlots; i++) {
    if (!usedSlots.has(i)) {
      return i;
    }
  }

  return -1;
}

/**
 * Count empty slots in an inventory
 */
export function countEmptySlots(
  items: ReadonlyArray<{ slot: number }>,
  maxSlots: number = INPUT_LIMITS.MAX_INVENTORY_SLOTS
): number {
  return maxSlots - items.length;
}

/**
 * Check if inventory is full
 */
export function isInventoryFull(
  items: ReadonlyArray<{ slot: number }>,
  maxSlots: number = INPUT_LIMITS.MAX_INVENTORY_SLOTS
): boolean {
  return items.length >= maxSlots;
}

/**
 * Find existing stack of an item
 *
 * @param items - Current inventory items
 * @param itemId - Item ID to find
 * @returns The item if found, undefined otherwise
 */
export function findExistingStack(
  items: ReadonlyArray<InventorySlot>,
  itemId: string
): InventorySlot | undefined {
  return items.find((item) => item.itemId === itemId);
}

/**
 * Get item at a specific slot
 */
export function getItemAtSlot(
  items: ReadonlyArray<InventorySlot>,
  slot: number
): InventorySlot | undefined {
  return items.find((item) => item.slot === slot);
}

/**
 * Calculate if an item can be added to inventory
 *
 * PURE FUNCTION - does not modify state
 *
 * @param items - Current inventory items
 * @param itemId - Item to add
 * @param quantity - Quantity to add
 * @param isStackable - Whether the item stacks
 * @param maxSlots - Maximum slot count
 * @returns Object indicating if add is possible and why
 */
export function canAddItem(
  items: ReadonlyArray<InventorySlot>,
  itemId: string,
  quantity: number,
  isStackable: boolean,
  maxSlots: number = INPUT_LIMITS.MAX_INVENTORY_SLOTS
): { canAdd: boolean; reason?: string; slotsNeeded: number } {
  // Stackable: check if existing stack or need one slot
  if (isStackable) {
    const existingStack = findExistingStack(items, itemId);
    if (existingStack) {
      // Can add to existing stack - check overflow
      const newTotal = existingStack.quantity + quantity;
      if (newTotal > INPUT_LIMITS.MAX_QUANTITY) {
        return {
          canAdd: false,
          reason: `Would exceed max stack size ${INPUT_LIMITS.MAX_QUANTITY}`,
          slotsNeeded: 0,
        };
      }
      return { canAdd: true, slotsNeeded: 0 };
    }

    // Need one new slot
    const emptySlots = countEmptySlots(items, maxSlots);
    if (emptySlots < 1) {
      return { canAdd: false, reason: "Inventory full", slotsNeeded: 1 };
    }
    return { canAdd: true, slotsNeeded: 1 };
  }

  // Non-stackable: need one slot per item
  const emptySlots = countEmptySlots(items, maxSlots);
  if (emptySlots < quantity) {
    return {
      canAdd: false,
      reason: `Need ${quantity} slots, only ${emptySlots} available`,
      slotsNeeded: quantity,
    };
  }
  return { canAdd: true, slotsNeeded: quantity };
}

/**
 * Calculate move result (OSRS-style swap)
 *
 * PURE FUNCTION - returns new slot states without modifying input
 *
 * @param items - Current inventory items
 * @param fromSlot - Source slot
 * @param toSlot - Destination slot
 * @returns Move result with new slot states
 */
export function calculateMoveResult(
  items: ReadonlyArray<InventorySlot>,
  fromSlot: number,
  toSlot: number
): MoveResult {
  // Same slot - no-op
  if (fromSlot === toSlot) {
    return {
      success: true,
      fromSlot: getItemAtSlot(items, fromSlot) ?? null,
      toSlot: getItemAtSlot(items, toSlot) ?? null,
    };
  }

  const fromItem = getItemAtSlot(items, fromSlot);
  const toItem = getItemAtSlot(items, toSlot);

  // Can't move from empty slot
  if (!fromItem) {
    return {
      success: false,
      error: `Source slot ${fromSlot} is empty`,
      fromSlot: null,
      toSlot: toItem ?? null,
    };
  }

  // OSRS-style swap
  if (toItem) {
    // Both slots occupied - swap
    return {
      success: true,
      fromSlot: { ...toItem, slot: fromSlot },
      toSlot: { ...fromItem, slot: toSlot },
    };
  } else {
    // Move to empty slot
    return {
      success: true,
      fromSlot: null, // Source slot now empty
      toSlot: { ...fromItem, slot: toSlot },
    };
  }
}

/**
 * Apply a move to an inventory array
 *
 * PURE FUNCTION - returns new array, does not modify input
 */
export function applyMove(
  items: ReadonlyArray<InventorySlot>,
  fromSlot: number,
  toSlot: number
): InventorySlot[] {
  // Same slot - no-op, return copy unchanged
  if (fromSlot === toSlot) {
    return [...items];
  }

  const result = calculateMoveResult(items, fromSlot, toSlot);
  if (!result.success) {
    return [...items]; // Return copy unchanged
  }

  // Create new array without the moved items
  const newItems = items.filter(
    (item) => item.slot !== fromSlot && item.slot !== toSlot
  );

  // Add the new positions
  if (result.fromSlot) {
    newItems.push(result.fromSlot);
  }
  if (result.toSlot) {
    newItems.push(result.toSlot);
  }

  return newItems;
}

/**
 * Calculate total quantity of an item in inventory
 */
export function getTotalQuantity(
  items: ReadonlyArray<InventorySlot>,
  itemId: string
): number {
  let total = 0;
  for (const item of items) {
    if (item.itemId === itemId) {
      total += item.quantity;
    }
  }
  return total;
}

/**
 * Calculate total weight of inventory
 */
export function calculateTotalWeight(
  items: ReadonlyArray<InventorySlot>
): number {
  let total = 0;
  for (const item of items) {
    total += (item.item.weight ?? 0) * item.quantity;
  }
  return total;
}

/**
 * Check if player has at least a certain quantity of an item
 */
export function hasItem(
  items: ReadonlyArray<InventorySlot>,
  itemId: string,
  quantity: number = 1
): boolean {
  return getTotalQuantity(items, itemId) >= quantity;
}

/**
 * Get all items of a specific type
 */
export function getItemsByType(
  items: ReadonlyArray<InventorySlot>,
  type: string
): InventorySlot[] {
  return items.filter((item) => item.item.type === type);
}

/**
 * Validate slot indices for a move operation
 * @throws ValidationError if invalid
 */
export function validateSlotIndices(
  fromSlot: number,
  toSlot: number,
  maxSlots: number = INPUT_LIMITS.MAX_INVENTORY_SLOTS
): void {
  if (
    !Number.isInteger(fromSlot) ||
    fromSlot < 0 ||
    fromSlot >= maxSlots
  ) {
    throw new ValidationError(
      `must be in range [0, ${maxSlots})`,
      "fromSlot",
      fromSlot
    );
  }

  if (
    !Number.isInteger(toSlot) ||
    toSlot < 0 ||
    toSlot >= maxSlots
  ) {
    throw new ValidationError(
      `must be in range [0, ${maxSlots})`,
      "toSlot",
      toSlot
    );
  }
}
