/**
 * Bank Equipment Constants
 *
 * Pre-allocated, immutable slot definitions for bank equipment view.
 * CRITICAL: These are frozen to prevent runtime modification and
 * declared once to avoid repeated allocations.
 */

import { BankEquipmentError } from "../types/bank-equipment";

// ============================================================================
// SLOT DEFINITIONS
// ============================================================================

export interface EquipmentSlotDefinition {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly gridPosition: { readonly row: number; readonly col: number };
}

/**
 * Immutable equipment slot definitions - allocated once at module load
 * Used by client BankEquipmentView to avoid per-render allocations
 *
 * Grid Layout (4 rows x 3 cols):
 * Row 0: [amulet] [helmet] [cape]
 * Row 1: [weapon] [body]   [shield]
 * Row 2: [gloves] [legs]   [boots]
 * Row 3: [ring]   [empty]  [arrows]
 */
export const BANK_EQUIPMENT_SLOT_DEFS: ReadonlyArray<EquipmentSlotDefinition> =
  Object.freeze([
    // Row 0
    Object.freeze({
      key: "amulet",
      label: "Neck",
      icon: "amulet",
      gridPosition: Object.freeze({ row: 0, col: 0 }),
    }),
    Object.freeze({
      key: "helmet",
      label: "Head",
      icon: "helmet",
      gridPosition: Object.freeze({ row: 0, col: 1 }),
    }),
    Object.freeze({
      key: "cape",
      label: "Cape",
      icon: "cape",
      gridPosition: Object.freeze({ row: 0, col: 2 }),
    }),
    // Row 1
    Object.freeze({
      key: "weapon",
      label: "Weapon",
      icon: "weapon",
      gridPosition: Object.freeze({ row: 1, col: 0 }),
    }),
    Object.freeze({
      key: "body",
      label: "Body",
      icon: "body",
      gridPosition: Object.freeze({ row: 1, col: 1 }),
    }),
    Object.freeze({
      key: "shield",
      label: "Shield",
      icon: "shield",
      gridPosition: Object.freeze({ row: 1, col: 2 }),
    }),
    // Row 2
    Object.freeze({
      key: "gloves",
      label: "Hands",
      icon: "gloves",
      gridPosition: Object.freeze({ row: 2, col: 0 }),
    }),
    Object.freeze({
      key: "legs",
      label: "Legs",
      icon: "legs",
      gridPosition: Object.freeze({ row: 2, col: 1 }),
    }),
    Object.freeze({
      key: "boots",
      label: "Feet",
      icon: "boots",
      gridPosition: Object.freeze({ row: 2, col: 2 }),
    }),
    // Row 3
    Object.freeze({
      key: "ring",
      label: "Ring",
      icon: "ring",
      gridPosition: Object.freeze({ row: 3, col: 0 }),
    }),
    Object.freeze({
      key: "arrows",
      label: "Ammo",
      icon: "arrows",
      gridPosition: Object.freeze({ row: 3, col: 2 }),
    }),
  ]);

/**
 * Set of valid equipment slot keys for O(1) lookup
 */
export const VALID_EQUIPMENT_SLOT_KEYS: ReadonlySet<string> = Object.freeze(
  new Set(BANK_EQUIPMENT_SLOT_DEFS.map((s) => s.key)),
);

/**
 * Array of equipment slot names for iteration
 */
export const BANK_EQUIPMENT_SLOT_NAMES: ReadonlyArray<string> = Object.freeze(
  BANK_EQUIPMENT_SLOT_DEFS.map((s) => s.key),
);

// ============================================================================
// ERROR MESSAGES
// ============================================================================

/**
 * Pre-allocated error messages to avoid string allocation on every error
 */
export const BANK_EQUIPMENT_ERROR_MESSAGES: Readonly<
  Record<BankEquipmentError, string>
> = Object.freeze({
  [BankEquipmentError.NOT_EQUIPABLE]: "This item cannot be equipped.",
  [BankEquipmentError.REQUIREMENTS_NOT_MET]:
    "You do not meet the requirements to equip this item.",
  [BankEquipmentError.SLOT_OCCUPIED]: "That equipment slot is occupied.",
  [BankEquipmentError.INVENTORY_FULL]: "Your inventory is full.",
  [BankEquipmentError.ITEM_NOT_FOUND]: "Item not found in bank.",
  [BankEquipmentError.TWO_HANDED_CONFLICT]:
    "You cannot equip a shield while wielding a two-handed weapon.",
  [BankEquipmentError.BANK_SESSION_INVALID]:
    "Bank session expired. Please reopen the bank.",
  [BankEquipmentError.RATE_LIMITED]: "Too many requests. Please slow down.",
  [BankEquipmentError.INVALID_REQUEST]: "Invalid request.",
  [BankEquipmentError.BANK_FULL]: "Your bank is full.",
});
