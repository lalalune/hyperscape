/**
 * Bank Core Operation Types & Type Guards
 *
 * Type definitions and runtime validators for core bank operations.
 * Used by both client (pre-validation) and server (security validation).
 */

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

const MAX_ITEM_ID_LENGTH = 64;
const MAX_QUANTITY = 2147483647; // Max signed 32-bit int
const MAX_TAB_INDEX = 20;
const MAX_SLOT = 500;

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Request to deposit items from inventory to bank
 */
export interface BankDepositRequest {
  readonly itemId: string;
  readonly quantity: number;
  readonly targetTabIndex?: number;
}

/**
 * Request to withdraw items from bank to inventory
 */
export interface BankWithdrawRequest {
  readonly itemId: string;
  readonly quantity: number;
  readonly asNote?: boolean;
}

/**
 * Request to move/reorder items within bank
 */
export interface BankMoveRequest {
  readonly fromSlot: number;
  readonly toSlot: number;
  readonly mode: "swap" | "insert";
  readonly tabIndex: number;
}

/**
 * Request to deposit all inventory items
 */
export interface BankDepositAllRequest {
  readonly targetTabIndex?: number;
}

/**
 * Request to move item to a different tab
 */
export interface BankMoveToTabRequest {
  readonly fromSlot: number;
  readonly fromTabIndex: number;
  readonly toTabIndex: number;
  readonly toSlot?: number;
}

/**
 * Request to create a new tab from an item
 */
export interface BankCreateTabRequest {
  readonly fromSlot: number;
  readonly fromTabIndex: number;
  readonly newTabIndex: number;
}

/**
 * Request to delete a tab
 */
export interface BankDeleteTabRequest {
  readonly tabIndex: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for BankDepositRequest
 */
export function isValidBankDepositRequest(
  data: unknown,
): data is BankDepositRequest {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Required: itemId
  if (typeof obj.itemId !== "string") return false;
  if (obj.itemId.length === 0 || obj.itemId.length > MAX_ITEM_ID_LENGTH)
    return false;

  // Required: quantity
  if (typeof obj.quantity !== "number") return false;
  if (!Number.isInteger(obj.quantity)) return false;
  if (obj.quantity < 1 || obj.quantity > MAX_QUANTITY) return false;

  // Optional: targetTabIndex
  if (obj.targetTabIndex !== undefined) {
    if (typeof obj.targetTabIndex !== "number") return false;
    if (!Number.isInteger(obj.targetTabIndex)) return false;
    if (obj.targetTabIndex < -1 || obj.targetTabIndex > MAX_TAB_INDEX)
      return false;
  }

  return true;
}

/**
 * Type guard for BankWithdrawRequest
 */
export function isValidBankWithdrawRequest(
  data: unknown,
): data is BankWithdrawRequest {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Required: itemId
  if (typeof obj.itemId !== "string") return false;
  if (obj.itemId.length === 0 || obj.itemId.length > MAX_ITEM_ID_LENGTH)
    return false;

  // Required: quantity
  if (typeof obj.quantity !== "number") return false;
  if (!Number.isInteger(obj.quantity)) return false;
  if (obj.quantity < 1 || obj.quantity > MAX_QUANTITY) return false;

  // Optional: asNote
  if (obj.asNote !== undefined && typeof obj.asNote !== "boolean") return false;

  return true;
}

/**
 * Type guard for BankMoveRequest
 */
export function isValidBankMoveRequest(data: unknown): data is BankMoveRequest {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Required: fromSlot
  if (typeof obj.fromSlot !== "number" || !Number.isInteger(obj.fromSlot))
    return false;
  if (obj.fromSlot < 0 || obj.fromSlot > MAX_SLOT) return false;

  // Required: toSlot
  if (typeof obj.toSlot !== "number" || !Number.isInteger(obj.toSlot))
    return false;
  if (obj.toSlot < 0 || obj.toSlot > MAX_SLOT) return false;

  // Required: mode
  if (obj.mode !== "swap" && obj.mode !== "insert") return false;

  // Required: tabIndex
  if (typeof obj.tabIndex !== "number" || !Number.isInteger(obj.tabIndex))
    return false;
  if (obj.tabIndex < -1 || obj.tabIndex > MAX_TAB_INDEX) return false;

  return true;
}

/**
 * Type guard for BankDepositAllRequest
 */
export function isValidBankDepositAllRequest(
  data: unknown,
): data is BankDepositAllRequest {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Optional: targetTabIndex
  if (obj.targetTabIndex !== undefined) {
    if (typeof obj.targetTabIndex !== "number") return false;
    if (!Number.isInteger(obj.targetTabIndex)) return false;
    if (obj.targetTabIndex < -1 || obj.targetTabIndex > MAX_TAB_INDEX)
      return false;
  }

  return true;
}

/**
 * Type guard for BankMoveToTabRequest
 */
export function isValidBankMoveToTabRequest(
  data: unknown,
): data is BankMoveToTabRequest {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Required: fromSlot
  if (typeof obj.fromSlot !== "number" || !Number.isInteger(obj.fromSlot))
    return false;
  if (obj.fromSlot < 0 || obj.fromSlot > MAX_SLOT) return false;

  // Required: fromTabIndex
  if (
    typeof obj.fromTabIndex !== "number" ||
    !Number.isInteger(obj.fromTabIndex)
  )
    return false;
  if (obj.fromTabIndex < -1 || obj.fromTabIndex > MAX_TAB_INDEX) return false;

  // Required: toTabIndex
  if (typeof obj.toTabIndex !== "number" || !Number.isInteger(obj.toTabIndex))
    return false;
  if (obj.toTabIndex < -1 || obj.toTabIndex > MAX_TAB_INDEX) return false;

  // Optional: toSlot
  if (obj.toSlot !== undefined) {
    if (typeof obj.toSlot !== "number" || !Number.isInteger(obj.toSlot))
      return false;
    if (obj.toSlot < 0 || obj.toSlot > MAX_SLOT) return false;
  }

  return true;
}

/**
 * Type guard for BankCreateTabRequest
 */
export function isValidBankCreateTabRequest(
  data: unknown,
): data is BankCreateTabRequest {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Required: fromSlot
  if (typeof obj.fromSlot !== "number" || !Number.isInteger(obj.fromSlot))
    return false;
  if (obj.fromSlot < 0 || obj.fromSlot > MAX_SLOT) return false;

  // Required: fromTabIndex
  if (
    typeof obj.fromTabIndex !== "number" ||
    !Number.isInteger(obj.fromTabIndex)
  )
    return false;
  if (obj.fromTabIndex < -1 || obj.fromTabIndex > MAX_TAB_INDEX) return false;

  // Required: newTabIndex
  if (typeof obj.newTabIndex !== "number" || !Number.isInteger(obj.newTabIndex))
    return false;
  if (obj.newTabIndex < 1 || obj.newTabIndex > MAX_TAB_INDEX) return false;

  return true;
}

/**
 * Type guard for BankDeleteTabRequest
 */
export function isValidBankDeleteTabRequest(
  data: unknown,
): data is BankDeleteTabRequest {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Required: tabIndex (must be > 0, can't delete main tab)
  if (typeof obj.tabIndex !== "number" || !Number.isInteger(obj.tabIndex))
    return false;
  if (obj.tabIndex < 1 || obj.tabIndex > MAX_TAB_INDEX) return false;

  return true;
}
