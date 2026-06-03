/**
 * Trade Panel Types
 *
 * TypeScript interfaces for the trade panel components.
 */

import type { Theme } from "@/ui";
import type { TradeOfferItem, TradeWindowState } from "@hyperforge/shared";

// ============================================================================
// Component Props
// ============================================================================

/**
 * Main trade panel props
 */
export interface TradePanelProps {
  state: TradeWindowState;
  inventory: Array<{ slot: number; itemId: string; quantity: number }>;
  onAddItem: (inventorySlot: number, quantity?: number) => void;
  onRemoveItem: (tradeSlot: number) => void;
  onAccept: () => void;
  onCancel: () => void;
  /** Callback when player examines an item (shows in chat) */
  onExamineItem?: (itemId: string) => void;
  /** Callback when player checks item value (shows in chat) */
  onValueItem?: (itemId: string) => void;
}

/**
 * Trade slot component props
 */
export interface TradeSlotProps {
  item: TradeOfferItem | null;
  slotIndex: number;
  side: "my" | "their";
  onRemove?: () => void;
  theme: Theme;
  isRemoved?: boolean;
}

/**
 * Inventory item component props
 */
export interface InventoryItemProps {
  item: { slot: number; itemId: string; quantity: number };
  theme: Theme;
  onLeftClick: () => void;
  onRightClick: (e: React.MouseEvent) => void;
}

/**
 * Inventory mini panel props
 */
export interface InventoryMiniPanelProps {
  items: Array<{ slot: number; itemId: string; quantity: number }>;
  offeredSlots: Set<number>;
  theme: Theme;
  onItemLeftClick: (item: {
    slot: number;
    itemId: string;
    quantity: number;
  }) => void;
  onItemRightClick: (
    e: React.MouseEvent,
    item: { slot: number; itemId: string; quantity: number },
  ) => void;
}

// ============================================================================
// Modal Types
// ============================================================================

/**
 * Context menu data for right-click
 */
export interface ContextMenuData {
  x: number;
  y: number;
  item: { slot: number; itemId: string; quantity: number };
}

/**
 * Quantity prompt data for Offer-X
 */
export interface QuantityPromptData {
  item: { slot: number; itemId: string; quantity: number };
}

/**
 * Context menu state (null when closed)
 */
export type ContextMenuState = ContextMenuData | null;

/**
 * Quantity prompt state (null when closed)
 */
export type QuantityPromptState = QuantityPromptData | null;

// ============================================================================
// Tracking Types
// ============================================================================

/**
 * Indicator for recently removed items (anti-scam feature)
 */
export interface RemovedItemIndicator {
  slot: number;
  side: "my" | "their";
  timestamp: number;
}

/**
 * Result from useRemovedItemTracking hook
 */
export interface RemovedItemTrackingResult {
  removedItems: RemovedItemIndicator[];
  myRemovedSlots: Set<number>;
  theirRemovedSlots: Set<number>;
  hasRecentRemovals: boolean;
}

// ============================================================================
// Context Menu Props
// ============================================================================

/**
 * Context menu component props
 */
export interface TradeContextMenuProps {
  x: number;
  y: number;
  item: { slot: number; itemId: string; quantity: number };
  theme: Theme;
  onOffer: (quantity: number | "x" | "all" | "value" | "examine") => void;
  onClose: () => void;
}

/**
 * Quantity prompt component props
 */
export interface QuantityPromptProps {
  item: { slot: number; itemId: string; quantity: number };
  theme: Theme;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}
