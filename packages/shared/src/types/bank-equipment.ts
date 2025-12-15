/**
 * Bank Equipment Tab Types
 *
 * Type definitions for the RS3-style bank equipment view feature.
 * Enables players to:
 * - View/manage equipment from bank interface
 * - Withdraw items directly to equipment slot
 * - Deposit worn equipment to bank
 */

import {
  VALID_EQUIPMENT_SLOT_KEYS,
  BankEquipmentError,
} from "../constants/BankEquipmentConstants";

// Re-export for backwards compatibility
export { BankEquipmentError };

// ============================================================================
// MVP EQUIPMENT SLOTS
// ============================================================================

/**
 * Equipment slots currently implemented for MVP.
 * Full system supports 11 slots, but MVP only uses these 5.
 * Other slots are kept in code for future expansion.
 */
export const MVP_EQUIPMENT_SLOTS = Object.freeze(
  new Set(["weapon", "shield", "helmet", "body", "legs"]),
);

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

// BankEquipmentError is imported from BankEquipmentConstants and re-exported above

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
 * Only accepts empty objects (no unexpected properties)
 */
export function isValidDepositAllEquipmentRequest(
  data: unknown,
): data is BankDepositAllEquipmentRequest {
  return (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    Object.keys(data).length === 0
  );
}

// ============================================================================
// EQUIPMENT DATA TYPES (for server -> client communication)
// ============================================================================

/**
 * Equipment slot item data sent to client
 */
export interface EquipmentSlotItem {
  readonly itemId: string;
  readonly quantity: number;
}

/**
 * Full player equipment data structure
 * Used when sending equipment state to client
 */
export interface PlayerEquipmentData {
  readonly weapon?: EquipmentSlotItem | null;
  readonly shield?: EquipmentSlotItem | null;
  readonly helmet?: EquipmentSlotItem | null;
  readonly body?: EquipmentSlotItem | null;
  readonly legs?: EquipmentSlotItem | null;
  readonly boots?: EquipmentSlotItem | null;
  readonly gloves?: EquipmentSlotItem | null;
  readonly cape?: EquipmentSlotItem | null;
  readonly amulet?: EquipmentSlotItem | null;
  readonly ring?: EquipmentSlotItem | null;
  readonly arrows?: EquipmentSlotItem | null;
}

/**
 * Valid equipment slot names for validation
 */
const VALID_EQUIPMENT_SLOTS = new Set([
  "weapon",
  "shield",
  "helmet",
  "body",
  "legs",
  "boots",
  "gloves",
  "cape",
  "amulet",
  "ring",
  "arrows",
]);

/**
 * Type guard for EquipmentSlotItem
 */
function isValidEquipmentSlotItem(data: unknown): data is EquipmentSlotItem {
  if (data === null || data === undefined) return true; // null/undefined are valid (empty slot)
  if (typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;
  return (
    typeof obj.itemId === "string" &&
    obj.itemId.length > 0 &&
    typeof obj.quantity === "number" &&
    Number.isInteger(obj.quantity) &&
    obj.quantity >= 0
  );
}

/**
 * Type guard for PlayerEquipmentData
 * Validates equipment data structure before sending to client
 */
export function isValidPlayerEquipmentData(
  data: unknown,
): data is PlayerEquipmentData {
  if (typeof data !== "object" || data === null) return false;

  const obj = data as Record<string, unknown>;

  // Validate each slot if present
  for (const slot of VALID_EQUIPMENT_SLOTS) {
    if (slot in obj && !isValidEquipmentSlotItem(obj[slot])) {
      return false;
    }
  }

  return true;
}

/**
 * Validates PlayerEquipment structure from EquipmentSystem.
 *
 * PlayerEquipment has EquipmentSlot objects (with nested `item` property),
 * not flat EquipmentSlotItem objects. This validator handles both formats
 * and only checks MVP slots to avoid errors for unimplemented slots.
 *
 * Use this when validating data from EquipmentSystem.getPlayerEquipment()
 */
export function isValidPlayerEquipmentStructure(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;

  const obj = data as Record<string, unknown>;

  // Only validate MVP slots - future slots may not be initialized
  for (const slot of MVP_EQUIPMENT_SLOTS) {
    if (!(slot in obj)) continue; // Slot not present is OK

    const slotValue = obj[slot];

    // null/undefined = empty slot (valid)
    if (slotValue === null || slotValue === undefined) continue;

    // Must be an object
    if (typeof slotValue !== "object") return false;

    const slotObj = slotValue as Record<string, unknown>;

    // EquipmentSlot format: { item: Item | null, ... }
    // If 'item' property exists, validate nested structure
    if ("item" in slotObj) {
      const item = slotObj.item;
      if (item !== null && typeof item !== "object") return false;
      // Item exists and is an object - valid
      continue;
    }

    // EquipmentSlotItem format: { itemId: string, quantity: number }
    // Direct itemId/quantity properties
    if ("itemId" in slotObj) {
      if (typeof slotObj.itemId !== "string") return false;
      if (typeof slotObj.quantity !== "number") return false;
      continue;
    }

    // Unknown structure
    return false;
  }

  return true;
}
