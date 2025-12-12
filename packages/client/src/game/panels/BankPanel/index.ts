/**
 * BankPanel Public API
 *
 * Re-exports types, constants, and utils.
 * Note: BankPanel component is still in parent directory during migration.
 */

// Types
export type {
  BankItem,
  BankTab,
  InventorySlotViewItem,
  ContextMenuState,
  CoinModalState,
  ConfirmModalState,
  DragState,
  RightPanelMode,
  BankPanelProps,
} from "./types";

// Constants
export {
  BANK_SLOTS_PER_ROW,
  BANK_VISIBLE_ROWS,
  BANK_SLOT_SIZE,
  BANK_GAP,
  BANK_SCROLL_HEIGHT,
  INV_SLOTS_PER_ROW,
  INV_ROWS,
  INV_SLOT_SIZE,
  SLOT_INDEX_APPEND_ZONE,
  TAB_INDEX_NEW_TAB_HOVER,
  TAB_INDEX_ALL,
  DRAG_THROTTLE_MS,
  BANK_THEME,
  BANK_SCROLLBAR_STYLES,
} from "./constants";

// Utils
export {
  isNotedItem,
  getItemIcon,
  formatItemName,
  formatQuantity,
  getQuantityColor,
} from "./utils";
