/**
 * Bank Equipment Tab Types
 *
 * Type definitions for the RS3-style bank equipment view feature.
 * Enables players to:
 * - View/manage equipment from bank interface
 * - Withdraw items directly to equipment slot
 * - Deposit worn equipment to bank
 */

import { VALID_EQUIPMENT_SLOT_KEYS } from "../constants/BankEquipmentConstants";

// ============================================================================
// VIEW MODE
// ============================================================================

/**
 * Bank right panel view mode
 */
export type BankRightPanelMode = "inventory" | "equipment";

/**
 * Where withdrawn items should go
 */
export type WithdrawTarget = "inventory" | "equipment";

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Bank equipment operation errors
 */
export enum BankEquipmentError {
  NOT_EQUIPABLE = "NOT_EQUIPABLE",
  REQUIREMENTS_NOT_MET = "REQUIREMENTS_NOT_MET",
  SLOT_OCCUPIED = "SLOT_OCCUPIED",
  INVENTORY_FULL = "INVENTORY_FULL",
  ITEM_NOT_FOUND = "ITEM_NOT_FOUND",
  TWO_HANDED_CONFLICT = "TWO_HANDED_CONFLICT",
  BANK_SESSION_INVALID = "BANK_SESSION_INVALID",
  RATE_LIMITED = "RATE_LIMITED",
  INVALID_REQUEST = "INVALID_REQUEST",
  BANK_FULL = "BANK_FULL",
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to withdraw an item directly to equipment
 */
export interface BankWithdrawToEquipmentRequest {
  readonly itemId: string;
  readonly tabIndex: number;
  readonly slot: number;
}

/**
 * Response for withdraw-to-equipment operation
 */
export interface BankWithdrawToEquipmentResponse {
  readonly success: boolean;
  readonly error?: BankEquipmentError;
  readonly message?: string;
  readonly equippedSlot?: string;
  readonly unequippedItems?: ReadonlyArray<{
    itemId: string;
    quantity: number;
  }>;
}

/**
 * Request to deposit a single equipment slot
 */
export interface BankDepositEquipmentRequest {
  readonly slot: string; // EquipmentSlotName
}

/**
 * Request to deposit all worn equipment
 */
export interface BankDepositAllEquipmentRequest {
  // No additional params - deposits all equipped items
}

/**
 * Response for deposit equipment operations
 */
export interface BankDepositEquipmentResponse {
  readonly success: boolean;
  readonly error?: BankEquipmentError;
  readonly message?: string;
  readonly depositedItems?: ReadonlyArray<{
    itemId: string;
    slot: string;
    quantity: number;
  }>;
}

// ============================================================================
// TYPE GUARDS (Eliminates `unknown` type handling)
// ============================================================================

/**
 * Type guard for BankWithdrawToEquipmentRequest
 * Validates all required fields with correct types
 */
export function isValidWithdrawToEquipmentRequest(
  data: unknown,
): data is BankWithdrawToEquipmentRequest {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.itemId === "string" &&
    obj.itemId.length > 0 &&
    obj.itemId.length <= 64 &&
    typeof obj.tabIndex === "number" &&
    Number.isInteger(obj.tabIndex) &&
    obj.tabIndex >= -1 &&
    obj.tabIndex <= 20 &&
    typeof obj.slot === "number" &&
    Number.isInteger(obj.slot) &&
    obj.slot >= 0 &&
    obj.slot <= 500
  );
}

/**
 * Type guard for BankDepositEquipmentRequest
 */
export function isValidDepositEquipmentRequest(
  data: unknown,
): data is BankDepositEquipmentRequest {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.slot === "string" && VALID_EQUIPMENT_SLOT_KEYS.has(obj.slot)
  );
}

/**
 * Type guard for BankDepositAllEquipmentRequest
 * Empty object is valid
 */
export function isValidDepositAllEquipmentRequest(
  data: unknown,
): data is BankDepositAllEquipmentRequest {
  return typeof data === "object" && data !== null;
}
