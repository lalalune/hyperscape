/**
 * Input Validation Utilities
 *
 * Pure functions for validating handler inputs.
 * No dependencies - easy to test.
 *
 * These replace the duplicate validation functions in store.ts and bank.ts.
 */

import { INPUT_LIMITS } from "@hyperscape/shared";

// eslint-disable-next-line no-control-regex
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

/**
 * Validate bank move mode - must be 'swap' or 'insert'
 */
export function isValidBankMoveMode(
  value: unknown,
): value is "swap" | "insert" {
  return value === "swap" || value === "insert";
}

/**
 * Validate bank tab index - 0 (main) or 1-9 (custom tabs)
 * OSRS allows up to 9 custom tabs plus the main tab
 */
export function isValidBankTabIndex(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 9
  );
}

/**
 * Validate custom bank tab index - 1-9 (excludes main tab 0)
 * Used when creating/deleting tabs (main tab can't be created/deleted)
 */
export function isValidCustomBankTabIndex(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 9
  );
}

/**
 * Validate npcId - must be non-empty string within length limits
 * Uses same limits as itemId since NPC IDs follow similar patterns
 */
export function isValidNpcId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= INPUT_LIMITS.MAX_ITEM_ID_LENGTH &&
    !CONTROL_CHAR_REGEX.test(value)
  );
}

/**
 * Validate dialogue responseIndex - must be non-negative integer
 * Max 10 responses per dialogue node (generous limit for OSRS-style dialogues)
 */
export function isValidResponseIndex(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < 10
  );
}

/**
 * Validate request timestamp - prevents replay attacks
 *
 * Validates that:
 * 1. Timestamp is a valid number
 * 2. Timestamp is not too old (prevents captured requests from being replayed)
 * 3. Timestamp is not too far in the future (prevents clock manipulation)
 *
 * @param timestamp - Client-provided timestamp (should be Date.now() from client)
 * @param serverTime - Current server time (Date.now())
 * @returns Object with validity flag and reason if invalid
 */
export function validateRequestTimestamp(
  timestamp: unknown,
  serverTime: number = Date.now(),
): { valid: boolean; reason?: string } {
  // Must be a number
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return { valid: false, reason: "Invalid timestamp format" };
  }

  const age = serverTime - timestamp;

  // Check if timestamp is too old (stale request / replay attack)
  if (age > INPUT_LIMITS.MAX_REQUEST_AGE_MS) {
    return {
      valid: false,
      reason: `Request timestamp too old (${age}ms > ${INPUT_LIMITS.MAX_REQUEST_AGE_MS}ms)`,
    };
  }

  // Check if timestamp is too far in the future (clock manipulation)
  if (age < -INPUT_LIMITS.MAX_CLOCK_SKEW_MS) {
    return {
      valid: false,
      reason: `Request timestamp in future (${-age}ms ahead)`,
    };
  }

  return { valid: true };
}

/**
 * Validate slot index within a given max
 */
export function isValidSlotIndex(
  value: unknown,
  maxSlots: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < maxSlots
  );
}
