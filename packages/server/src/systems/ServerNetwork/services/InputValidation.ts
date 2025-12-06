/**
 * Input Validation Utilities
 *
 * Pure functions for validating handler inputs.
 * No dependencies - easy to test.
 *
 * These replace the duplicate validation functions in store.ts and bank.ts.
 */

import { INPUT_LIMITS } from "@hyperscape/shared";

const CONTROL_CHAR_REGEX = /[\x00-\x1f]/;

/**
 * Validate itemId - must be non-empty string within length limits
 * Prevents null bytes and control characters for security
 */
export function isValidItemId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= INPUT_LIMITS.MAX_ITEM_ID_LENGTH &&
    !CONTROL_CHAR_REGEX.test(value)
  );
}

/**
 * Validate storeId - must be non-empty string within length limits
 * Prevents null bytes and control characters for security
 */
export function isValidStoreId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= INPUT_LIMITS.MAX_STORE_ID_LENGTH &&
    !CONTROL_CHAR_REGEX.test(value)
  );
}

/**
 * Validate quantity - must be positive integer within safe bounds
 */
export function isValidQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= INPUT_LIMITS.MAX_QUANTITY
  );
}

/**
 * Check if adding quantities would overflow the max quantity limit
 */
export function wouldOverflow(current: number, add: number): boolean {
  return current > INPUT_LIMITS.MAX_QUANTITY - add;
}

/**
 * Validate slot number for inventory
 */
export function isValidInventorySlot(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < INPUT_LIMITS.MAX_INVENTORY_SLOTS
  );
}

/**
 * Validate slot number for bank
 */
export function isValidBankSlot(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < INPUT_LIMITS.MAX_BANK_SLOTS
  );
}
