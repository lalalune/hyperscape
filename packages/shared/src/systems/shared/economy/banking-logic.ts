/**
 * Banking Pure Logic Module
 *
 * PURE FUNCTIONS for bank operations.
 * No side effects, no system dependencies, fully unit testable.
 */

import {
  ValidationError,
  assertPlayerId,
  assertEntityId,
  assertItemId,
  assertQuantity,
  assertNonNegativeInteger,
  assertDefined,
} from "../../../validation";
import { INPUT_LIMITS } from "../../../constants";
import { BANKING_CONSTANTS } from "../../../constants/BankingConstants";

// =============================================================================
// TYPES
// =============================================================================

export interface BankItem {
  id: string;
  name: string;
  quantity: number;
  stackable: boolean;
}

export interface BankData {
  items: BankItem[];
  maxSlots: number;
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface DepositResult {
  success: boolean;
  error?: string;
  itemDeposited?: BankItem;
  newBankItems: BankItem[];
}

export interface WithdrawResult {
  success: boolean;
  error?: string;
  itemWithdrawn?: { itemId: string; quantity: number };
  newBankItems: BankItem[];
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a bank open request
 * @throws ValidationError if invalid
 */
export function validateBankOpenRequest(
  playerId: unknown,
  bankId: unknown,
  playerPosition?: unknown,
  bankPosition?: unknown
): { playerId: string; bankId: string } {
  assertPlayerId(playerId, "playerId");
  assertEntityId(bankId, "bankId");

  // If positions are provided, validate distance
  if (playerPosition && bankPosition) {
    const dist = calculateDistance(
      playerPosition as Position3D,
      bankPosition as Position3D
    );
    if (dist > BANKING_CONSTANTS.MAX_DISTANCE) {
      throw new ValidationError(
        `must be within ${BANKING_CONSTANTS.MAX_DISTANCE} tiles of bank`,
        "distance",
        dist
      );
    }
  }

  return {
    playerId: playerId as string,
    bankId: bankId as string,
  };
}

/**
 * Validate a deposit request
 * @throws ValidationError if invalid
 */
export function validateDepositRequest(
  playerId: unknown,
  itemId: unknown,
  quantity: unknown
): { playerId: string; itemId: string; quantity: number } {
  assertPlayerId(playerId, "playerId");
  assertItemId(itemId, "itemId");
  assertQuantity(quantity, "quantity");

  return {
    playerId: playerId as string,
    itemId: itemId as string,
    quantity: quantity as number,
  };
}

/**
 * Validate a withdraw request
 * @throws ValidationError if invalid
 */
export function validateWithdrawRequest(
  playerId: unknown,
  itemId: unknown,
  quantity: unknown
): { playerId: string; itemId: string; quantity: number } {
  assertPlayerId(playerId, "playerId");
  assertItemId(itemId, "itemId");
  assertQuantity(quantity, "quantity");

  return {
    playerId: playerId as string,
    itemId: itemId as string,
    quantity: quantity as number,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate distance between two 3D positions
 */
export function calculateDistance(pos1: Position3D, pos2: Position3D): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Check if player is within bank interaction distance
 */
export function isWithinBankDistance(
  playerPosition: Position3D,
  bankPosition: Position3D
): boolean {
  return calculateDistance(playerPosition, bankPosition) <= BANKING_CONSTANTS.MAX_DISTANCE;
}

// =============================================================================
// PURE LOGIC FUNCTIONS
// =============================================================================

/**
 * Count used slots in bank
 */
export function countBankSlots(items: ReadonlyArray<BankItem>): number {
  return items.length;
}

/**
 * Check if bank is full
 */
export function isBankFull(
  items: ReadonlyArray<BankItem>,
  maxSlots: number = BANKING_CONSTANTS.MAX_BANK_SLOTS
): boolean {
  return items.length >= maxSlots;
}

/**
 * Get remaining bank slots
 */
export function getRemainingSlots(
  items: ReadonlyArray<BankItem>,
  maxSlots: number = BANKING_CONSTANTS.MAX_BANK_SLOTS
): number {
  return Math.max(0, maxSlots - items.length);
}

/**
 * Find item in bank by ID
 */
export function findBankItem(
  items: ReadonlyArray<BankItem>,
  itemId: string
): BankItem | undefined {
  return items.find((item) => item.id === itemId);
}

/**
 * Find item index in bank
 */
export function findBankItemIndex(
  items: ReadonlyArray<BankItem>,
  itemId: string
): number {
  return items.findIndex((item) => item.id === itemId);
}

/**
 * Check if bank has item with at least given quantity
 */
export function bankHasItem(
  items: ReadonlyArray<BankItem>,
  itemId: string,
  quantity: number = 1
): boolean {
  const item = findBankItem(items, itemId);
  return item !== undefined && item.quantity >= quantity;
}

/**
 * Get total quantity of an item in bank
 */
export function getBankItemQuantity(
  items: ReadonlyArray<BankItem>,
  itemId: string
): number {
  const item = findBankItem(items, itemId);
  return item?.quantity ?? 0;
}

/**
 * Check if deposit is allowed
 *
 * PURE FUNCTION - does not modify state
 */
export function canDeposit(
  bankItems: ReadonlyArray<BankItem>,
  itemId: string,
  quantity: number,
  isStackable: boolean,
  maxSlots: number = BANKING_CONSTANTS.MAX_BANK_SLOTS
): { canDeposit: boolean; reason?: string } {
  // Check if item already exists in bank (for stackable items)
  const existingItem = findBankItem(bankItems, itemId);

  if (existingItem) {
    // Can always add to existing stack (up to max quantity)
    const newQuantity = existingItem.quantity + quantity;
    if (newQuantity > INPUT_LIMITS.MAX_QUANTITY) {
      return {
        canDeposit: false,
        reason: `Would exceed max stack size ${INPUT_LIMITS.MAX_QUANTITY}`,
      };
    }
    return { canDeposit: true };
  }

  // Need a new slot
  if (bankItems.length >= maxSlots) {
    return { canDeposit: false, reason: "Bank is full" };
  }

  return { canDeposit: true };
}

/**
 * Calculate deposit result
 *
 * PURE FUNCTION - returns new bank state without modifying input
 */
export function calculateDeposit(
  bankItems: ReadonlyArray<BankItem>,
  itemId: string,
  itemName: string,
  quantity: number,
  isStackable: boolean,
  maxSlots: number = BANKING_CONSTANTS.MAX_BANK_SLOTS
): DepositResult {
  const validation = canDeposit(bankItems, itemId, quantity, isStackable, maxSlots);
  if (!validation.canDeposit) {
    return {
      success: false,
      error: validation.reason,
      newBankItems: [...bankItems],
    };
  }

  const existingItemIndex = findBankItemIndex(bankItems, itemId);

  if (existingItemIndex !== -1) {
    // Add to existing stack
    const newItems = [...bankItems];
    const existingItem = newItems[existingItemIndex];
    const updatedItem = {
      ...existingItem,
      quantity: existingItem.quantity + quantity,
    };
    newItems[existingItemIndex] = updatedItem;

    return {
      success: true,
      itemDeposited: { id: itemId, name: itemName, quantity, stackable: isStackable },
      newBankItems: newItems,
    };
  }

  // Create new stack
  const newItem: BankItem = {
    id: itemId,
    name: itemName,
    quantity,
    stackable: isStackable,
  };

  return {
    success: true,
    itemDeposited: newItem,
    newBankItems: [...bankItems, newItem],
  };
}

/**
 * Check if withdraw is allowed
 *
 * PURE FUNCTION - does not modify state
 */
export function canWithdraw(
  bankItems: ReadonlyArray<BankItem>,
  itemId: string,
  quantity: number
): { canWithdraw: boolean; reason?: string } {
  const item = findBankItem(bankItems, itemId);

  if (!item) {
    return { canWithdraw: false, reason: "Item not found in bank" };
  }

  if (item.quantity < quantity) {
    return {
      canWithdraw: false,
      reason: `Only ${item.quantity} available, requested ${quantity}`,
    };
  }

  return { canWithdraw: true };
}

/**
 * Calculate withdraw result
 *
 * PURE FUNCTION - returns new bank state without modifying input
 */
export function calculateWithdraw(
  bankItems: ReadonlyArray<BankItem>,
  itemId: string,
  quantity: number
): WithdrawResult {
  const validation = canWithdraw(bankItems, itemId, quantity);
  if (!validation.canWithdraw) {
    return {
      success: false,
      error: validation.reason,
      newBankItems: [...bankItems],
    };
  }

  const itemIndex = findBankItemIndex(bankItems, itemId);
  const item = bankItems[itemIndex];
  const remainingQuantity = item.quantity - quantity;

  const newItems = [...bankItems];

  if (remainingQuantity <= 0) {
    // Remove item entirely
    newItems.splice(itemIndex, 1);
  } else {
    // Reduce quantity
    newItems[itemIndex] = {
      ...item,
      quantity: remainingQuantity,
    };
  }

  return {
    success: true,
    itemWithdrawn: { itemId, quantity },
    newBankItems: newItems,
  };
}

/**
 * Calculate deposit all result
 *
 * PURE FUNCTION - returns new bank state without modifying input
 */
export function calculateDepositAll(
  bankItems: ReadonlyArray<BankItem>,
  inventoryItems: ReadonlyArray<{ itemId: string; name: string; quantity: number; stackable: boolean }>,
  maxSlots: number = BANKING_CONSTANTS.MAX_BANK_SLOTS
): { newBankItems: BankItem[]; depositedCount: number; failedItems: string[] } {
  let currentBank = [...bankItems];
  let depositedCount = 0;
  const failedItems: string[] = [];

  for (const invItem of inventoryItems) {
    const result = calculateDeposit(
      currentBank,
      invItem.itemId,
      invItem.name,
      invItem.quantity,
      invItem.stackable,
      maxSlots
    );

    if (result.success) {
      currentBank = result.newBankItems;
      depositedCount++;
    } else {
      failedItems.push(invItem.itemId);
    }
  }

  return {
    newBankItems: currentBank,
    depositedCount,
    failedItems,
  };
}

/**
 * Search bank items by name
 */
export function searchBankItems(
  items: ReadonlyArray<BankItem>,
  searchTerm: string
): BankItem[] {
  const lowerSearch = searchTerm.toLowerCase();
  return items.filter((item) =>
    item.name.toLowerCase().includes(lowerSearch)
  );
}

/**
 * Sort bank items by name
 */
export function sortBankItemsByName(
  items: ReadonlyArray<BankItem>,
  ascending: boolean = true
): BankItem[] {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  return ascending ? sorted : sorted.reverse();
}

/**
 * Sort bank items by quantity
 */
export function sortBankItemsByQuantity(
  items: ReadonlyArray<BankItem>,
  ascending: boolean = true
): BankItem[] {
  const sorted = [...items].sort((a, b) => a.quantity - b.quantity);
  return ascending ? sorted : sorted.reverse();
}
