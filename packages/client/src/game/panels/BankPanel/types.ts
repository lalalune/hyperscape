/**
 * BankPanel Type Definitions
 *
 * All TypeScript interfaces for the bank panel system.
 */

import type { ClientWorld, InventorySlotItem } from "../../../types";
import type { PlayerEquipmentItems } from "@hyperscape/shared";

// ============================================================================
// GAME DATA (from server)
// ============================================================================

export interface BankItem {
  itemId: string;
  quantity: number; // 0 = placeholder (RS3-style)
  slot: number;
  tabIndex: number;
}

export interface BankTab {
  tabIndex: number;
  iconItemId: string | null;
}

export type InventorySlotViewItem = Pick<
  InventorySlotItem,
  "slot" | "itemId" | "quantity"
>;

// ============================================================================
// UI STATE
// ============================================================================

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  itemId: string;
  quantity: number;
  type: "bank" | "inventory";
  tabIndex?: number;
  slot?: number;
}

export interface CoinModalState {
  visible: boolean;
  action: "deposit" | "withdraw";
  maxAmount: number;
}

export interface ConfirmModalState {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

// NOTE: DragState is exported from hooks/useDragDrop.ts (has all 6 fields including insertPosition)
// Import it from "./hooks" rather than here

export type RightPanelMode = "inventory" | "equipment";

// ============================================================================
// COMPONENT PROPS
// ============================================================================

/**
 * RS3-STYLE PLACEHOLDERS:
 * - Placeholders are items with quantity = 0 (no separate data structure)
 * - Items with qty=0 are rendered with greyed-out style
 * - Context menu shows "Release" for qty=0 items, "Withdraw-Placeholder" for qty>0
 *
 * RS3-STYLE EQUIPMENT VIEW:
 * - Right panel can switch between Inventory and Equipment views
 * - Equipment view shows all equipped items with deposit buttons
 * - "Deposit Worn Items" button deposits all equipment at once
 */
export interface BankPanelProps {
  items: BankItem[]; // Includes items with qty=0 (placeholders)
  tabs?: BankTab[];
  alwaysSetPlaceholder?: boolean;
  maxSlots: number;
  world: ClientWorld;
  inventory: InventorySlotViewItem[];
  equipment?: PlayerEquipmentItems | null; // Player's equipped items (RS3-style)
  coins: number;
  onClose: () => void;
}
