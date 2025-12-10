/**
 * BankPanel - RuneScape-style bank interface
 *
 * SIMPLE SERVER-AUTHORITATIVE APPROACH:
 * - NO optimistic predictions - just display what server tells us
 * - Server is the single source of truth
 * - Clicks fire requests to server and wait for response
 * - 100% reliable - no desync, no duplication bugs, no oscillation
 *
 * This approach is used by many successful MMOs including early RuneScape.
 * Trade-off: Very slightly less responsive (wait ~50-100ms for server),
 * but 100% reliable with zero edge cases.
 *
 * Features:
 * - Scrollable grid display of bank items (480 slots)
 * - Right-click context menu with withdraw/deposit options (1, 5, 10, All, X)
 * - Left-click for quick withdraw/deposit 1
 * - All items stack in bank (MVP simplification)
 * - Shows alongside inventory when open
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { createPortal } from "react-dom";
import type { ClientWorld, InventorySlotItem } from "../../types";
import { COLORS } from "../../constants";

// ============================================================================
// TYPES
// ============================================================================

interface BankItem {
  itemId: string;
  quantity: number;
  slot: number;
  tabIndex: number;
}

interface BankTab {
  tabIndex: number;
  iconItemId: string | null;
}

type InventorySlotViewItem = Pick<
  InventorySlotItem,
  "slot" | "itemId" | "quantity"
>;

/**
 * RS3-STYLE PLACEHOLDERS:
 * - Placeholders are items with quantity = 0 (no separate data structure)
 * - Items with qty=0 are rendered with greyed-out style
 * - Context menu shows "Release" for qty=0 items, "Withdraw-Placeholder" for qty>0
 */
interface BankPanelProps {
  items: BankItem[]; // Includes items with qty=0 (placeholders)
  tabs?: BankTab[];
  alwaysSetPlaceholder?: boolean;
  maxSlots: number;
  world: ClientWorld;
  inventory: InventorySlotViewItem[];
  coins: number;
  bankId: string;
  onClose: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  itemId: string;
  quantity: number;
  type: "bank" | "inventory";
  tabIndex?: number;
  slot?: number;
}

interface CoinModalState {
  visible: boolean;
  action: "deposit" | "withdraw";
  maxAmount: number;
}

interface ConfirmModalState {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BANK_SLOTS_PER_ROW = 10;
const BANK_VISIBLE_ROWS = 8;
const BANK_SLOT_SIZE = 42; // Comfortable slot size
const BANK_GAP = 8; // gap-2 = 0.5rem = 8px
const BANK_SCROLL_HEIGHT = BANK_VISIBLE_ROWS * (BANK_SLOT_SIZE + BANK_GAP); // slot + gap

const INV_SLOTS_PER_ROW = 4;
const INV_ROWS = 7;
const INV_SLOT_SIZE = 40;

// Hyperscape Black & Gold Theme
const BANK_THEME = {
  // Panel backgrounds - deep black with slight warmth
  PANEL_BG: "rgba(15, 12, 8, 0.98)",
  PANEL_BG_DARK: "rgba(10, 8, 5, 0.98)",
  PANEL_BORDER: "rgba(139, 69, 19, 0.7)",
  PANEL_BORDER_LIGHT: "rgba(242, 208, 138, 0.3)",

  // Item slot colors - dark with gold accents
  SLOT_BG: "rgba(20, 15, 10, 0.9)",
  SLOT_BG_HOVER: "rgba(40, 30, 20, 0.9)",
  SLOT_BORDER: "rgba(242, 208, 138, 0.25)",
  SLOT_BORDER_HIGHLIGHT: "rgba(242, 208, 138, 0.5)",

  // Tab colors
  TAB_BG: "rgba(30, 25, 18, 0.9)",
  TAB_BG_SELECTED: "rgba(139, 69, 19, 0.6)",
  TAB_BORDER: "rgba(139, 69, 19, 0.5)",

  // Text colors - gold theme with OSRS quantity colors
  TEXT_GOLD: "#f2d08a", // Primary gold
  TEXT_GOLD_DIM: "rgba(242, 208, 138, 0.7)",
  TEXT_YELLOW: "#ffff00", // Quantity < 100K
  TEXT_WHITE: "#ffffff", // Quantity 100K - 9.99M
  TEXT_GREEN: "#00ff80", // Quantity 10M+

  // Button colors
  BUTTON_BG: "rgba(139, 69, 19, 0.5)",
  BUTTON_BG_HOVER: "rgba(139, 69, 19, 0.7)",
};

// Magic number constants for special slot/tab indices
const SLOT_INDEX_APPEND_ZONE = -100;
const TAB_INDEX_NEW_TAB_HOVER = -2;
const TAB_INDEX_ALL = -1;

// Drag throttle interval (60fps = 16.67ms)
const DRAG_THROTTLE_MS = 16;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get icon for item based on itemId
 */
function getItemIcon(itemId: string): string {
  const id = itemId.toLowerCase();
  if (id.includes("sword") || id.includes("dagger") || id.includes("scimitar"))
    return "⚔️";
  if (id.includes("shield") || id.includes("defender")) return "🛡️";
  if (id.includes("helmet") || id.includes("helm") || id.includes("hat"))
    return "⛑️";
  if (
    id.includes("body") ||
    id.includes("platebody") ||
    id.includes("chainmail")
  )
    return "👕";
  if (id.includes("legs") || id.includes("platelegs")) return "👖";
  if (id.includes("boots") || id.includes("boot")) return "👢";
  if (id.includes("glove") || id.includes("gauntlet")) return "🧤";
  if (id.includes("cape") || id.includes("cloak")) return "🧥";
  if (id.includes("amulet") || id.includes("necklace")) return "📿";
  if (id.includes("ring")) return "💍";
  if (id.includes("arrow") || id.includes("bolt")) return "🏹";
  if (id.includes("bow")) return "🎯";
  if (id.includes("coins") || id.includes("gold")) return "🪙";
  if (id.includes("fish") || id.includes("shrimp") || id.includes("lobster"))
    return "🐟";
  if (id.includes("log") || id.includes("wood")) return "🪵";
  if (id.includes("ore") || id.includes("bar")) return "🪨";
  if (id.includes("food") || id.includes("bread") || id.includes("meat"))
    return "🍖";
  if (id.includes("potion")) return "🧪";
  if (id.includes("rune")) return "🔮";
  if (id.includes("bone")) return "🦴";
  if (id.includes("hatchet") || id.includes("axe")) return "🪓";
  if (id.includes("pickaxe")) return "⛏️";
  return "📦";
}

/**
 * Format item name from itemId
 */
function formatItemName(itemId: string): string {
  return itemId.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format quantity for display
 */
function formatQuantity(quantity: number): string {
  if (quantity >= 10000000) return `${Math.floor(quantity / 1000000)}M`;
  if (quantity >= 100000) return `${Math.floor(quantity / 1000)}K`;
  if (quantity >= 1000) return `${(quantity / 1000).toFixed(1)}K`;
  return String(quantity);
}

// ============================================================================
// CONTEXT MENU COMPONENT
// ============================================================================

function ContextMenu({
  menu,
  onAction,
  onClose,
}: {
  menu: ContextMenuState;
  onAction: (action: string, quantity: number) => void;
  onClose: () => void;
}) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const menuRef = React.useRef<HTMLDivElement>(null);

  // RS3-style: Items with qty=0 are placeholders
  const isPlaceholder = menu.type === "bank" && menu.quantity === 0;
  const actionLabel = menu.type === "bank" ? "Withdraw" : "Deposit";

  const handleCustomSubmit = () => {
    const amount = parseInt(customAmount, 10);
    if (amount > 0) {
      onAction(menu.type === "bank" ? "withdraw" : "deposit", amount);
    }
    onClose();
  };

  // Close on click outside - MUST be before any conditional returns (Rules of Hooks)
  useEffect(() => {
    if (!menu.visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
    });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [menu.visible, onClose]);

  // IMPORTANT: Check visibility FIRST before any rendering
  if (!menu.visible) return null;

  // RS3-style: Handle placeholder-only context menu (qty=0 bank items)
  if (isPlaceholder) {
    return createPortal(
      <div
        ref={menuRef}
        className="fixed z-[10000] pointer-events-auto"
        style={{ left: menu.x, top: menu.y, width: "auto" }}
      >
        <div
          className="rounded shadow-xl py-1 inline-block"
          style={{
            background:
              "linear-gradient(135deg, rgba(30, 25, 20, 0.98) 0%, rgba(20, 15, 10, 0.98) 100%)",
            border: "1px solid rgba(139, 69, 19, 0.8)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.8)",
          }}
        >
          <button
            className="block px-3 py-1 text-left text-xs transition-colors whitespace-nowrap"
            style={{
              color: "rgba(242, 208, 138, 0.9)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(139, 69, 19, 0.4)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(242, 208, 138, 0.9)";
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAction("releasePlaceholder", 0);
              onClose();
            }}
          >
            Release
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  const menuOptions = [
    {
      label: `${actionLabel} 1`,
      amount: 1,
      action: menu.type === "bank" ? "withdraw" : "deposit",
    },
    {
      label: `${actionLabel} 5`,
      amount: 5,
      action: menu.type === "bank" ? "withdraw" : "deposit",
    },
    {
      label: `${actionLabel} 10`,
      amount: 10,
      action: menu.type === "bank" ? "withdraw" : "deposit",
    },
    {
      label: `${actionLabel} All`,
      amount: menu.quantity,
      action: menu.type === "bank" ? "withdraw" : "deposit",
    },
    {
      label: `${actionLabel} X`,
      amount: -1,
      action: menu.type === "bank" ? "withdraw" : "deposit",
    },
  ];

  // RS3-style: Add "Withdraw-Placeholder" option for bank items with qty > 0
  // This withdraws all and leaves a qty=0 placeholder regardless of toggle
  if (menu.type === "bank" && menu.quantity > 0) {
    menuOptions.push({
      label: "Withdraw-Placeholder",
      amount: menu.quantity,
      action: "withdrawPlaceholder",
    });
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[10000] pointer-events-auto"
      style={{
        left: menu.x,
        top: menu.y,
        width: "auto",
      }}
    >
      <div
        className="rounded shadow-xl py-1 inline-block"
        style={{
          background:
            "linear-gradient(135deg, rgba(30, 25, 20, 0.98) 0%, rgba(20, 15, 10, 0.98) 100%)",
          border: "1px solid rgba(139, 69, 19, 0.8)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.8)",
        }}
      >
        {showCustomInput ? (
          <div className="px-2 py-2">
            <input
              type="number"
              min="1"
              max={menu.quantity}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomSubmit();
                if (e.key === "Escape") onClose();
              }}
              autoFocus
              className="w-full px-2 py-1 text-sm rounded"
              style={{
                background: "rgba(0, 0, 0, 0.5)",
                border: "1px solid rgba(139, 69, 19, 0.6)",
                color: "#fff",
                outline: "none",
              }}
              placeholder={`1-${menu.quantity}`}
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={handleCustomSubmit}
                className="flex-1 px-2 py-1 text-xs rounded"
                style={{
                  background: "rgba(100, 150, 100, 0.6)",
                  color: "#fff",
                }}
              >
                OK
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-2 py-1 text-xs rounded"
                style={{
                  background: "rgba(150, 100, 100, 0.6)",
                  color: "#fff",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          menuOptions.map((option, idx) => (
            <button
              key={idx}
              className="block px-3 py-1 text-left text-xs transition-colors whitespace-nowrap"
              style={{
                color: "rgba(242, 208, 138, 0.9)",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(139, 69, 19, 0.4)";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "rgba(242, 208, 138, 0.9)";
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (option.amount === -1) {
                  setShowCustomInput(true);
                } else if (
                  option.action === "setPlaceholder" ||
                  option.action === "releasePlaceholder"
                ) {
                  onAction(option.action, 0);
                  onClose();
                } else {
                  onAction(
                    option.action,
                    Math.min(option.amount, menu.quantity),
                  );
                  onClose();
                }
              }}
            >
              {option.label}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

// ============================================================================
// COIN AMOUNT MODAL COMPONENT
// ============================================================================

function CoinAmountModal({
  modal,
  onConfirm,
  onClose,
}: {
  modal: CoinModalState;
  onConfirm: (amount: number) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modal.visible && inputRef.current) {
      inputRef.current.focus();
      setAmount("");
    }
  }, [modal.visible]);

  if (!modal.visible) return null;

  const handleSubmit = () => {
    const numAmount = parseInt(amount, 10);
    if (numAmount > 0 && numAmount <= modal.maxAmount) {
      onConfirm(numAmount);
      onClose();
    }
  };

  const handleQuickAmount = (value: number) => {
    const actualAmount = Math.min(value, modal.maxAmount);
    if (actualAmount > 0) {
      onConfirm(actualAmount);
      onClose();
    }
  };

  const actionLabel = modal.action === "deposit" ? "Deposit" : "Withdraw";
  const actionColor =
    modal.action === "deposit"
      ? "rgba(100, 180, 100, 0.8)"
      : "rgba(180, 150, 100, 0.8)";

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-lg p-4 shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(30, 25, 20, 0.98) 0%, rgba(20, 15, 10, 0.98) 100%)",
          border: "2px solid rgba(139, 69, 19, 0.8)",
          minWidth: "280px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-lg font-bold mb-3 text-center"
          style={{ color: "rgba(242, 208, 138, 0.9)" }}
        >
          🪙 {actionLabel} Coins
        </h3>

        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[1, 10, 100, 1000].map((qty) => (
            <button
              key={qty}
              onClick={() => handleQuickAmount(qty)}
              disabled={modal.maxAmount < qty}
              className="py-2 rounded text-sm font-bold transition-colors disabled:opacity-30"
              style={{
                background:
                  modal.maxAmount >= qty
                    ? actionColor
                    : "rgba(50, 50, 50, 0.5)",
                color: "#fff",
                border: "1px solid rgba(139, 69, 19, 0.6)",
              }}
            >
              {qty >= 1000 ? `${qty / 1000}K` : qty}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => handleQuickAmount(Math.floor(modal.maxAmount / 2))}
            disabled={modal.maxAmount < 2}
            className="py-2 rounded text-sm font-bold transition-colors disabled:opacity-30"
            style={{
              background: actionColor,
              color: "#fff",
              border: "1px solid rgba(139, 69, 19, 0.6)",
            }}
          >
            Half ({formatQuantity(Math.floor(modal.maxAmount / 2))})
          </button>
          <button
            onClick={() => handleQuickAmount(modal.maxAmount)}
            disabled={modal.maxAmount < 1}
            className="py-2 rounded text-sm font-bold transition-colors disabled:opacity-30"
            style={{
              background: actionColor,
              color: "#fff",
              border: "1px solid rgba(139, 69, 19, 0.6)",
            }}
          >
            All ({formatQuantity(modal.maxAmount)})
          </button>
        </div>

        {/* Custom amount input */}
        <div className="mb-3">
          <label
            className="text-xs mb-1 block"
            style={{ color: "rgba(242, 208, 138, 0.7)" }}
          >
            Custom amount (max: {modal.maxAmount.toLocaleString()})
          </label>
          <input
            ref={inputRef}
            type="number"
            min="1"
            max={modal.maxAmount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            className="w-full px-3 py-2 rounded text-sm"
            style={{
              background: "rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(139, 69, 19, 0.6)",
              color: "#fff",
              outline: "none",
            }}
            placeholder="Enter amount..."
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={
              !amount ||
              parseInt(amount, 10) <= 0 ||
              parseInt(amount, 10) > modal.maxAmount
            }
            className="flex-1 py-2 rounded text-sm font-bold transition-colors disabled:opacity-30"
            style={{
              background: actionColor,
              color: "#fff",
              border: "1px solid rgba(139, 69, 19, 0.6)",
            }}
          >
            {actionLabel}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded text-sm font-bold transition-colors"
            style={{
              background: "rgba(100, 100, 100, 0.5)",
              color: "#fff",
              border: "1px solid rgba(139, 69, 19, 0.6)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ============================================================================
// MEMOIZED BANK SLOT COMPONENT
// ============================================================================

/**
 * Props for the memoized BankSlotItem component
 */
interface BankSlotItemProps {
  item: BankItem;
  slotIndex: number;
  itemTabIndex: number;
  isDragging: boolean;
  isDropTarget: boolean;
  showSwapHighlight: boolean;
  showInsertLine: boolean;
  showFaintGuide: boolean;
  dropColor: string;
  guideColor: string;
  onDragStart: (slotIndex: number, tabIndex: number) => void;
  onDragOver: (e: React.DragEvent, slotIndex: number, tabIndex: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, slotIndex: number, tabIndex: number) => void;
  onDragEnd: () => void;
  onClick: (itemId: string) => void;
  onContextMenu: (e: React.MouseEvent, item: BankItem) => void;
}

/**
 * Memoized bank slot component to prevent unnecessary re-renders.
 *
 * Without memoization, all 480 slots would re-render on ANY state change
 * (hover, drag, selection). With React.memo, only slots whose props
 * actually changed will re-render.
 *
 * Performance impact: Reduces re-renders from O(n) to O(1) for most interactions.
 */
const BankSlotItem = memo(function BankSlotItem({
  item,
  slotIndex,
  itemTabIndex,
  isDragging,
  isDropTarget,
  showSwapHighlight,
  showInsertLine,
  showFaintGuide,
  dropColor,
  guideColor,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onClick,
  onContextMenu,
}: BankSlotItemProps) {
  const isPlaceholder = item.quantity === 0;

  return (
    <div
      className="rounded flex items-center justify-center relative cursor-grab active:cursor-grabbing"
      style={{
        width: BANK_SLOT_SIZE,
        height: BANK_SLOT_SIZE,
        background: showSwapHighlight
          ? `linear-gradient(135deg, rgba(${dropColor}, 0.35) 0%, rgba(${dropColor}, 0.2) 100%)`
          : isPlaceholder
            ? "linear-gradient(135deg, rgba(50, 45, 40, 0.4) 0%, rgba(40, 35, 30, 0.4) 100%)"
            : "linear-gradient(135deg, rgba(242, 208, 138, 0.1) 0%, rgba(242, 208, 138, 0.05) 100%)",
        border: showSwapHighlight
          ? `2px solid rgba(${dropColor}, 0.9)`
          : isPlaceholder
            ? "1px dashed rgba(242, 208, 138, 0.2)"
            : `1px solid ${BANK_THEME.SLOT_BORDER_HIGHLIGHT}`,
        transform: isDragging ? "scale(0.9)" : "scale(1)",
        opacity: isDragging ? 0.4 : isPlaceholder ? 0.6 : 1,
        transition:
          "transform 0.15s ease, opacity 0.15s ease, background 0.1s ease, border 0.1s ease",
        boxShadow: showSwapHighlight
          ? `0 0 12px rgba(${dropColor}, 0.5)`
          : "none",
      }}
      title={
        isPlaceholder
          ? `${formatItemName(item.itemId)} (placeholder)`
          : `${formatItemName(item.itemId)} x${item.quantity} (Tab ${itemTabIndex})`
      }
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(slotIndex, itemTabIndex);
      }}
      onDragOver={(e) => onDragOver(e, slotIndex, itemTabIndex)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, slotIndex, itemTabIndex)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(item.itemId)}
      onContextMenu={(e) => onContextMenu(e, item)}
    >
      {/* Single INSERT LINE on left edge */}
      {(showInsertLine || showFaintGuide) && (
        <div
          style={{
            position: "absolute",
            left: -4,
            top: 0,
            bottom: 0,
            width: showInsertLine ? 6 : 3,
            background: showInsertLine
              ? `rgba(${dropColor}, 1)`
              : `rgba(${guideColor}, 0.2)`,
            borderRadius: 3,
            zIndex: 20,
            boxShadow: showInsertLine
              ? `0 0 10px rgba(${dropColor}, 0.9), 0 0 20px rgba(${dropColor}, 0.5)`
              : "none",
            transition: "all 0.1s ease",
          }}
        />
      )}
      <span className="text-xl select-none pointer-events-none">
        {getItemIcon(item.itemId)}
      </span>
      {item.quantity > 1 && (
        <span
          className="absolute bottom-0 right-0.5 text-[10px] font-bold pointer-events-none"
          style={{
            color:
              item.quantity >= 10000000
                ? "#00ff00"
                : item.quantity >= 100000
                  ? "#ffffff"
                  : "#ffff00",
            textShadow: "1px 1px 1px black, -1px -1px 1px black",
          }}
        >
          {formatQuantity(item.quantity)}
        </span>
      )}
    </div>
  );
});

// ============================================================================
// CONFIRM MODAL COMPONENT
// ============================================================================

function ConfirmModal({
  modal,
  onClose,
}: {
  modal: ConfirmModalState;
  onClose: () => void;
}) {
  if (!modal.visible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-lg p-4 shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(30, 25, 20, 0.98) 0%, rgba(20, 15, 10, 0.98) 100%)",
          border: "2px solid rgba(139, 69, 19, 0.8)",
          minWidth: "280px",
          maxWidth: "360px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-lg font-bold mb-3 text-center"
          style={{ color: "rgba(242, 208, 138, 0.9)" }}
        >
          {modal.title}
        </h3>

        <p
          className="text-sm mb-4 text-center"
          style={{ color: "rgba(255, 255, 255, 0.8)" }}
        >
          {modal.message}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => {
              modal.onConfirm();
              onClose();
            }}
            className="flex-1 py-2 rounded text-sm font-bold transition-colors"
            style={{
              background: "rgba(180, 100, 100, 0.7)",
              color: "#fff",
              border: "1px solid rgba(180, 100, 100, 0.8)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(200, 80, 80, 0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(180, 100, 100, 0.7)";
            }}
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded text-sm font-bold transition-colors"
            style={{
              background: "rgba(100, 100, 100, 0.5)",
              color: "#fff",
              border: "1px solid rgba(139, 69, 19, 0.6)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(120, 120, 120, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(100, 100, 100, 0.5)";
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ============================================================================
// MAIN BANK PANEL COMPONENT
// ============================================================================

// NOTE: Distance validation is now SERVER-AUTHORITATIVE
// The server tracks interaction sessions and sends bankClose packets
// when the player moves too far away. The client no longer polls distance.

export function BankPanel({
  items, // RS3-style: includes qty=0 items (placeholders)
  tabs = [],
  alwaysSetPlaceholder = false,
  maxSlots,
  world,
  inventory,
  coins,
  bankId,
  onClose,
}: BankPanelProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    itemId: "",
    quantity: 0,
    type: "bank",
  });

  const [coinModal, setCoinModal] = useState<CoinModalState>({
    visible: false,
    action: "deposit",
    maxAmount: 0,
  });

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // ========== TAB STATE ==========
  // -1 = "All" view (shows all items across all tabs)
  // 0 = Main tab
  // 1-9 = Custom tabs
  const [selectedTab, setSelectedTab] = useState<number>(-1);

  // ========== DRAG-DROP STATE (OSRS-style bank reorganization) ==========
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null);
  const [dropMode, setDropMode] = useState<"swap" | "insert" | null>(null);
  const [insertPosition, setInsertPosition] = useState<
    "before" | "after" | null
  >(null);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [hoveredTabIndex, setHoveredTabIndex] = useState<number | null>(null);

  // ========== PERFORMANCE: Throttle drag state updates ==========
  const lastDragUpdateTime = useRef(0);

  // ========== PERFORMANCE: Memoize filtered items ==========
  const filteredItems = useMemo(() => {
    if (selectedTab === TAB_INDEX_ALL) {
      return items;
    }
    return items.filter((i) => i.tabIndex === selectedTab);
  }, [items, selectedTab]);

  // ========== PERFORMANCE: Memoize sorted tab indexes ==========
  const sortedTabIndexes = useMemo(() => {
    const tabSet = new Set(items.map((i) => i.tabIndex));
    return [...tabSet].sort((a, b) => a - b);
  }, [items]);

  // ========== SIMPLE SERVER-AUTHORITATIVE UI ==========
  // NO optimistic predictions - just display server state directly.
  // This is simple, reliable, and correct.
  //
  // Server queue processes operations one at a time per player.
  // Each click fires a request; server responds with updated bank state.
  // The UI updates when the new props arrive from server.

  // Bank coins from server state
  const bankCoinsItem = items.find((item) => item.itemId === "coins");
  const bankCoins = bankCoinsItem?.quantity ?? 0;

  // ========== ACTION HANDLERS ==========
  // Simple fire-and-forget to server. Server will respond with updated state.

  const handleWithdraw = useCallback(
    (itemId: string, quantity: number) => {
      if (world.network?.send) {
        world.network.send("bankWithdraw", { itemId, quantity });
      }
    },
    [world.network],
  );

  const handleDeposit = useCallback(
    (itemId: string, quantity: number) => {
      if (world.network?.send) {
        // RS3-style: New items go to currently viewed tab (or tab 0 if viewing All)
        const targetTab = selectedTab === TAB_INDEX_ALL ? 0 : selectedTab;
        world.network.send("bankDeposit", {
          itemId,
          quantity,
          targetTabIndex: targetTab,
        });
      }
    },
    [world.network, selectedTab],
  );

  const handleDepositAll = useCallback(() => {
    if (world.network?.send) {
      // RS3-style: New items go to currently viewed tab (or tab 0 if viewing All)
      const targetTab = selectedTab === TAB_INDEX_ALL ? 0 : selectedTab;
      world.network.send("bankDepositAll", { targetTabIndex: targetTab });
    }
  }, [world.network, selectedTab]);

  const handleDepositCoins = useCallback(
    (amount: number) => {
      if (world.network?.send && amount > 0) {
        world.network.send("bankDepositCoins", { amount });
      }
    },
    [world.network],
  );

  const handleWithdrawCoins = useCallback(
    (amount: number) => {
      if (world.network?.send && amount > 0) {
        world.network.send("bankWithdrawCoins", { amount });
      }
    },
    [world.network],
  );

  // ========== BANK MOVE HANDLER (OSRS-style drag-drop) ==========

  const handleBankMove = useCallback(
    (
      fromSlot: number,
      toSlot: number,
      mode: "swap" | "insert",
      tabIndex: number,
    ) => {
      if (world.network?.send && fromSlot !== toSlot) {
        world.network.send("bankMove", { fromSlot, toSlot, mode, tabIndex });
      }
    },
    [world.network],
  );

  // ========== TAB HANDLERS ==========

  const handleCreateTab = useCallback(
    (fromSlot: number, fromTabIndex: number, newTabIndex: number) => {
      if (world.network?.send) {
        world.network.send("bankCreateTab", {
          fromSlot,
          fromTabIndex,
          newTabIndex,
        });
      }
    },
    [world.network],
  );

  const handleDeleteTab = useCallback(
    (tabIndex: number) => {
      if (world.network?.send && tabIndex > 0) {
        world.network.send("bankDeleteTab", { tabIndex });
      }
    },
    [world.network],
  );

  const handleMoveToTab = useCallback(
    (
      fromSlot: number,
      fromTabIndex: number,
      toTabIndex: number,
      toSlot?: number,
    ) => {
      if (world.network?.send && fromTabIndex !== toTabIndex) {
        world.network.send("bankMoveToTab", {
          fromSlot,
          fromTabIndex,
          toTabIndex,
          toSlot,
        });
      }
    },
    [world.network],
  );

  // ========== PLACEHOLDER HANDLERS (RS3-style) ==========

  // RS3-style: Withdraw all and leave qty=0 placeholder (ignores toggle)
  const handleWithdrawPlaceholder = useCallback(
    (itemId: string) => {
      if (world.network?.send) {
        world.network.send("bankWithdrawPlaceholder", { itemId });
      }
    },
    [world.network],
  );

  // RS3-style: Release = delete the qty=0 row
  const handleReleasePlaceholder = useCallback(
    (tabIndex: number, slot: number) => {
      if (world.network?.send) {
        world.network.send("bankReleasePlaceholder", { tabIndex, slot });
      }
    },
    [world.network],
  );

  const handleReleaseAllPlaceholders = useCallback(() => {
    if (world.network?.send) {
      world.network.send("bankReleaseAllPlaceholders", {});
    }
  }, [world.network]);

  const handleToggleAlwaysPlaceholder = useCallback(() => {
    if (world.network?.send) {
      world.network.send("bankToggleAlwaysPlaceholder", {});
    }
  }, [world.network]);

  // Get the next available tab index for creating new tabs
  // RS3-STYLE: Always append at end (max + 1), never fill gaps
  const nextAvailableTabIndex = (() => {
    if (tabs.length === 0) return 1; // No custom tabs yet, start at 1
    const maxTabIndex = Math.max(...tabs.map((t) => t.tabIndex));
    if (maxTabIndex >= 9) return null; // All tabs used (max is 9)
    return maxTabIndex + 1;
  })();

  // ========== COIN MODAL HANDLERS ==========

  const openCoinModal = (action: "deposit" | "withdraw") => {
    const maxAmount = action === "deposit" ? coins : bankCoins;
    if (maxAmount > 0) {
      setCoinModal({ visible: true, action, maxAmount });
    }
  };

  const closeCoinModal = () => {
    setCoinModal((prev) => ({ ...prev, visible: false }));
  };

  const handleCoinModalConfirm = (amount: number) => {
    if (coinModal.action === "deposit") {
      handleDepositCoins(amount);
    } else {
      handleWithdrawCoins(amount);
    }
  };

  // ========== CONTEXT MENU HANDLERS ==========

  const handleContextMenuAction = useCallback(
    (action: string, quantity: number) => {
      if (action === "withdraw") {
        handleWithdraw(contextMenu.itemId, quantity);
      } else if (action === "deposit") {
        handleDeposit(contextMenu.itemId, quantity);
      } else if (action === "withdrawPlaceholder") {
        // RS3-style: Withdraw all and leave qty=0 placeholder
        handleWithdrawPlaceholder(contextMenu.itemId);
      } else if (
        action === "releasePlaceholder" &&
        contextMenu.tabIndex !== undefined &&
        contextMenu.slot !== undefined
      ) {
        // RS3-style: Delete the qty=0 row
        handleReleasePlaceholder(contextMenu.tabIndex, contextMenu.slot);
      }
    },
    [
      contextMenu.itemId,
      contextMenu.tabIndex,
      contextMenu.slot,
      handleWithdraw,
      handleDeposit,
      handleWithdrawPlaceholder,
      handleReleasePlaceholder,
    ],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const openContextMenu = (
    e: React.MouseEvent,
    itemId: string,
    quantity: number,
    type: "bank" | "inventory",
    tabIndex?: number,
    slot?: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // For inventory items, calculate total count across ALL slots
    let totalQuantity = quantity;
    if (type === "inventory") {
      totalQuantity = inventory
        .filter((item) => item && item.itemId === itemId)
        .reduce((sum, item) => sum + (item.quantity || 1), 0);
    }

    // RS3-style: No separate hasPlaceholder check needed
    // Items with qty=0 ARE placeholders (handled by context menu component)
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      itemId,
      quantity: totalQuantity,
      type,
      tabIndex,
      slot,
    });
  };

  // ========== STABLE CALLBACKS FOR MEMOIZED SLOT COMPONENT ==========
  // These must be stable (useCallback) to prevent re-rendering all slots
  // when parent re-renders

  const handleSlotDragStart = useCallback(
    (slotIndex: number, tabIndex: number) => {
      setDraggedSlot(slotIndex);
      setDraggedTabIndex(tabIndex);
    },
    [],
  );

  const handleSlotDragOver = useCallback(
    (e: React.DragEvent, slotIndex: number, tabIndex: number) => {
      e.preventDefault();
      if (draggedSlot === null) return;
      if (draggedSlot === slotIndex && draggedTabIndex === tabIndex) return;

      // Throttle state updates to 60fps
      const now = performance.now();
      if (now - lastDragUpdateTime.current < DRAG_THROTTLE_MS) return;
      lastDragUpdateTime.current = now;

      setHoveredSlot(slotIndex);
      setHoveredTabIndex(tabIndex);

      // SIMPLE: Left 40% = insert before, Right 60% = swap
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      if (x < width * 0.4) {
        setDropMode("insert");
        setInsertPosition("before");
      } else {
        setDropMode("swap");
        setInsertPosition(null);
      }
    },
    [draggedSlot, draggedTabIndex],
  );

  const handleSlotDragLeave = useCallback(() => {
    setHoveredSlot(null);
    setHoveredTabIndex(null);
    setDropMode(null);
    setInsertPosition(null);
  }, []);

  const handleSlotDrop = useCallback(
    (e: React.DragEvent, targetSlot: number, targetTabIndex: number) => {
      e.preventDefault();
      if (draggedSlot !== null && draggedTabIndex !== null) {
        if (draggedTabIndex === targetTabIndex) {
          handleBankMove(
            draggedSlot,
            targetSlot,
            dropMode || "swap",
            draggedTabIndex,
          );
        } else {
          handleMoveToTab(
            draggedSlot,
            draggedTabIndex,
            targetTabIndex,
            targetSlot,
          );
        }
      }
      setDraggedSlot(null);
      setDraggedTabIndex(null);
      setDropMode(null);
      setInsertPosition(null);
      setHoveredSlot(null);
      setHoveredTabIndex(null);
    },
    [draggedSlot, draggedTabIndex, dropMode, handleBankMove, handleMoveToTab],
  );

  const handleSlotDragEnd = useCallback(() => {
    setDraggedSlot(null);
    setDraggedTabIndex(null);
    setDropMode(null);
    setInsertPosition(null);
    setHoveredSlot(null);
    setHoveredTabIndex(null);
  }, []);

  const handleSlotClick = useCallback(
    (itemId: string) => {
      handleWithdraw(itemId, 1);
    },
    [handleWithdraw],
  );

  const handleSlotContextMenu = useCallback(
    (e: React.MouseEvent, item: BankItem) => {
      openContextMenu(
        e,
        item.itemId,
        item.quantity,
        "bank",
        item.tabIndex,
        item.slot,
      );
    },
    [inventory], // openContextMenu depends on inventory for total calculation
  );

  // ========== RENDER ==========

  return (
    <div
      className="fixed z-[9999] pointer-events-auto"
      style={{
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Custom scrollbar styles */}
      <style>{`
        .bank-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .bank-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
        }
        .bank-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 69, 19, 0.6);
          border-radius: 4px;
        }
        .bank-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 69, 19, 0.8);
        }
      `}</style>

      <ContextMenu
        menu={contextMenu}
        onAction={handleContextMenuAction}
        onClose={closeContextMenu}
      />

      <CoinAmountModal
        modal={coinModal}
        onConfirm={handleCoinModalConfirm}
        onClose={closeCoinModal}
      />

      <ConfirmModal
        modal={confirmModal}
        onClose={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
      />

      <div className="flex gap-2">
        {/* Bank Panel - Left Side */}
        <div
          className="flex flex-col rounded-lg"
          style={{
            background:
              "linear-gradient(135deg, rgba(20, 15, 10, 0.98) 0%, rgba(15, 10, 5, 0.98) 100%)",
            border: `2px solid ${BANK_THEME.PANEL_BORDER}`,
            boxShadow: `0 10px 30px rgba(0, 0, 0, 0.8), inset 0 2px 4px ${BANK_THEME.PANEL_BORDER_LIGHT}`,
            minHeight: `${BANK_SCROLL_HEIGHT + 180}px`,
            width: `${BANK_SLOTS_PER_ROW * (BANK_SLOT_SIZE + BANK_GAP) + 32}px`,
          }}
        >
          {/* Header */}
          <div
            className="flex justify-between items-center px-4 py-2 rounded-t-lg"
            style={{
              background:
                "linear-gradient(180deg, rgba(139, 69, 19, 0.4) 0%, rgba(139, 69, 19, 0.2) 100%)",
              borderBottom: `1px solid ${BANK_THEME.PANEL_BORDER}`,
            }}
          >
            <h2
              className="text-lg font-bold flex items-center gap-2"
              style={{ color: BANK_THEME.TEXT_GOLD }}
            >
              <span>🏦</span>
              <span>Bank</span>
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold transition-colors"
              style={{
                background: "rgba(180, 50, 50, 0.8)",
                color: "#fff",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(220, 60, 60, 0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(180, 50, 50, 0.8)";
              }}
            >
              ✕
            </button>
          </div>

          {/* Tab Bar */}
          <div
            className="mx-3 mt-2 mb-0 flex gap-1 overflow-x-auto pb-0"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              position: "relative",
              zIndex: 10,
            }}
          >
            {/* All Tab (∞) - RS3 style */}
            <button
              onClick={() => setSelectedTab(TAB_INDEX_ALL)}
              className="px-3 py-1.5 rounded-t text-xs font-bold transition-colors flex-shrink-0"
              style={{
                background:
                  selectedTab === TAB_INDEX_ALL
                    ? "linear-gradient(180deg, rgba(139, 69, 19, 0.7) 0%, rgba(100, 50, 10, 0.7) 100%)"
                    : "rgba(50, 40, 30, 0.6)",
                color:
                  selectedTab === TAB_INDEX_ALL
                    ? "#fff"
                    : BANK_THEME.TEXT_GOLD_DIM,
                borderTop:
                  selectedTab === TAB_INDEX_ALL
                    ? `1px solid ${BANK_THEME.PANEL_BORDER_LIGHT}`
                    : `1px solid ${BANK_THEME.TAB_BORDER}`,
                borderLeft:
                  selectedTab === TAB_INDEX_ALL
                    ? `1px solid ${BANK_THEME.PANEL_BORDER_LIGHT}`
                    : `1px solid ${BANK_THEME.TAB_BORDER}`,
                borderRight:
                  selectedTab === TAB_INDEX_ALL
                    ? `1px solid ${BANK_THEME.PANEL_BORDER_LIGHT}`
                    : `1px solid ${BANK_THEME.TAB_BORDER}`,
                borderBottom: "none",
              }}
              title="View all items across all tabs"
            >
              ∞
            </button>

            {/* All Tabs (0-9) - RS3 style: Tab 0 is just another tab, icon = first item */}
            {(() => {
              // Create array of all tabs including tab 0 (which always exists implicitly)
              const allTabIndexes = [0, ...tabs.map((t) => t.tabIndex)].sort(
                (a, b) => a - b,
              );
              // Remove duplicates (in case tab 0 is somehow in tabs array)
              const uniqueTabIndexes = [...new Set(allTabIndexes)];

              return uniqueTabIndexes.map((tabIndex) => {
                const isSelected = selectedTab === tabIndex;
                const isHovered = hoveredTabIndex === tabIndex;
                const borderColor = isHovered
                  ? "1px solid rgba(100, 200, 255, 0.8)"
                  : isSelected
                    ? `1px solid ${BANK_THEME.PANEL_BORDER_LIGHT}`
                    : `1px solid ${BANK_THEME.TAB_BORDER}`;
                // RS3-style: Tab icon = first item by slot order
                // Prefer real items (qty > 0), but fall back to placeholders if tab only has placeholders
                const tabItemsSorted = items
                  .filter((i) => i.tabIndex === tabIndex)
                  .sort((a, b) => a.slot - b.slot);
                const firstRealItem = tabItemsSorted.find(
                  (i) => i.quantity > 0,
                );
                const firstAnyItem = tabItemsSorted[0];
                const iconItem = firstRealItem || firstAnyItem;
                const tabIcon = iconItem
                  ? getItemIcon(iconItem.itemId)
                  : `${tabIndex}`;
                const isPlaceholderIcon = iconItem && iconItem.quantity === 0;
                // Tab 0 can't be deleted, only custom tabs (1-9)
                const canDelete = tabIndex > 0;
                return (
                  <button
                    key={tabIndex}
                    onClick={() => setSelectedTab(tabIndex)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (canDelete) {
                        setConfirmModal({
                          visible: true,
                          title: "Delete Tab",
                          message: `Delete tab ${tabIndex}? All items will be moved to tab 0.`,
                          onConfirm: () => {
                            handleDeleteTab(tabIndex);
                            if (selectedTab === tabIndex) {
                              setSelectedTab(0);
                            }
                          },
                        });
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setHoveredTabIndex(tabIndex);
                    }}
                    onDragLeave={() => setHoveredTabIndex(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (
                        draggedSlot !== null &&
                        draggedTabIndex !== null &&
                        draggedTabIndex !== tabIndex
                      ) {
                        handleMoveToTab(draggedSlot, draggedTabIndex, tabIndex);
                      }
                      setDraggedSlot(null);
                      setDraggedTabIndex(null);
                      setHoveredTabIndex(null);
                    }}
                    className="px-3 py-1.5 rounded-t text-xs font-bold transition-colors flex-shrink-0"
                    style={{
                      background: isHovered
                        ? "rgba(100, 200, 255, 0.3)"
                        : isSelected
                          ? "linear-gradient(180deg, rgba(139, 69, 19, 0.7) 0%, rgba(100, 50, 10, 0.7) 100%)"
                          : isPlaceholderIcon
                            ? "rgba(40, 35, 28, 0.6)"
                            : "rgba(50, 40, 30, 0.6)",
                      color: isSelected ? "#fff" : BANK_THEME.TEXT_GOLD_DIM,
                      borderTop: borderColor,
                      borderLeft: borderColor,
                      borderRight: borderColor,
                      borderBottom: "none",
                      opacity: isPlaceholderIcon && !isSelected ? 0.6 : 1,
                    }}
                    title={
                      iconItem
                        ? `${formatItemName(iconItem.itemId)}${isPlaceholderIcon ? " (empty)" : ""}${canDelete ? " - Right-click to delete" : ""}`
                        : `Tab ${tabIndex}${canDelete ? " - Right-click to delete" : ""}`
                    }
                  >
                    {tabIcon}
                  </button>
                );
              });
            })()}

            {/* Add Tab Button (+) */}
            {nextAvailableTabIndex !== null && (
              <button
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setHoveredTabIndex(TAB_INDEX_NEW_TAB_HOVER);
                }}
                onDragLeave={() => setHoveredTabIndex(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (
                    draggedSlot !== null &&
                    draggedTabIndex !== null &&
                    nextAvailableTabIndex !== null
                  ) {
                    handleCreateTab(
                      draggedSlot,
                      draggedTabIndex,
                      nextAvailableTabIndex,
                    );
                  }
                  setDraggedSlot(null);
                  setDraggedTabIndex(null);
                  setHoveredTabIndex(null);
                }}
                className="px-3 py-1.5 rounded-t text-xs font-bold transition-colors flex-shrink-0"
                style={{
                  background:
                    hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                      ? "rgba(100, 255, 100, 0.3)"
                      : "rgba(50, 50, 50, 0.4)",
                  color: "rgba(100, 200, 100, 0.8)",
                  borderTop:
                    hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                      ? "1px solid rgba(100, 255, 100, 0.8)"
                      : "1px dashed rgba(100, 200, 100, 0.4)",
                  borderLeft:
                    hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                      ? "1px solid rgba(100, 255, 100, 0.8)"
                      : "1px dashed rgba(100, 200, 100, 0.4)",
                  borderRight:
                    hoveredTabIndex === TAB_INDEX_NEW_TAB_HOVER
                      ? "1px solid rgba(100, 255, 100, 0.8)"
                      : "1px dashed rgba(100, 200, 100, 0.4)",
                  borderBottom: "none",
                }}
                title="Drag an item here to create a new tab"
              >
                +
              </button>
            )}
          </div>

          {/* Scrollable Item Grid */}
          <div
            className="mx-3 mt-1 p-3 overflow-y-auto overflow-x-hidden bank-scrollbar flex-1 rounded"
            style={{
              maxHeight: `${BANK_SCROLL_HEIGHT}px`,
              scrollbarWidth: "thin",
              scrollbarColor: `${BANK_THEME.PANEL_BORDER} rgba(0, 0, 0, 0.3)`,
              background: "rgba(0, 0, 0, 0.2)",
              border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
            }}
          >
            {/* "All" tab view with grouped headers */}
            {selectedTab === TAB_INDEX_ALL ? (
              <div className="space-y-2">
                {/* Group items by tabIndex and render with headers */}
                {(() => {
                  // Get unique tab indexes from items, sorted
                  const tabIndexes = [
                    ...new Set(items.map((i) => i.tabIndex)),
                  ].sort((a, b) => a - b);

                  return tabIndexes.map((tabIdx) => {
                    const tabItems = items
                      .filter((i) => i.tabIndex === tabIdx)
                      .sort((a, b) => a.slot - b.slot);
                    if (tabItems.length === 0) return null;

                    // RS3-style: Prefer real items, but show placeholder icon if tab only has placeholders
                    const firstRealItem = tabItems.find((i) => i.quantity > 0);
                    const firstAnyItem = tabItems[0];
                    const iconItem = firstRealItem || firstAnyItem;
                    const isPlaceholderIcon =
                      iconItem && iconItem.quantity === 0;
                    // RS3-style: All tabs treated equally, icon derived from first item
                    const tabLabel = iconItem
                      ? `${getItemIcon(iconItem.itemId)} Tab ${tabIdx}${isPlaceholderIcon ? " (empty)" : ""}`
                      : `📦 Tab ${tabIdx}`;

                    // Check if this tab header is being hovered for drop
                    const isHeaderDropTarget =
                      hoveredTabIndex === tabIdx &&
                      draggedSlot !== null &&
                      draggedTabIndex !== tabIdx;

                    return (
                      <div key={tabIdx}>
                        {/* Tab Header - OSRS style separator - DROPPABLE to move items to this tab */}
                        <div
                          className="flex items-center gap-2 mb-1 pb-0.5 transition-colors"
                          style={{
                            background: isHeaderDropTarget
                              ? "rgba(100, 200, 255, 0.15)"
                              : "transparent",
                            padding: "1px 2px",
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (
                              draggedSlot !== null &&
                              draggedTabIndex !== tabIdx
                            ) {
                              setHoveredTabIndex(tabIdx);
                            }
                          }}
                          onDragLeave={() => {
                            setHoveredTabIndex(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (
                              draggedSlot !== null &&
                              draggedTabIndex !== null &&
                              draggedTabIndex !== tabIdx
                            ) {
                              handleMoveToTab(
                                draggedSlot,
                                draggedTabIndex,
                                tabIdx,
                              );
                            }
                            setDraggedSlot(null);
                            setDraggedTabIndex(null);
                            setHoveredTabIndex(null);
                            setDropMode(null);
                            setInsertPosition(null);
                            setHoveredSlot(null);
                          }}
                        >
                          <span
                            className="text-[10px] font-bold"
                            style={{
                              color: isHeaderDropTarget
                                ? "#fff"
                                : BANK_THEME.TEXT_GOLD,
                            }}
                          >
                            {tabLabel}
                          </span>
                          <div
                            className="flex-1"
                            style={{
                              height: isHeaderDropTarget ? "2px" : "1px",
                              background: isHeaderDropTarget
                                ? "rgba(100, 200, 255, 0.8)"
                                : BANK_THEME.PANEL_BORDER_LIGHT,
                              transition: "all 0.15s ease",
                            }}
                          />
                          <span
                            className="text-[9px]"
                            style={{
                              color: isHeaderDropTarget
                                ? "rgba(255,255,255,0.7)"
                                : `${BANK_THEME.TEXT_GOLD}88`,
                            }}
                          >
                            {isHeaderDropTarget
                              ? "Drop here"
                              : `${tabItems.length}`}
                          </span>
                        </div>

                        {/* Items grid for this tab */}
                        <div
                          className="grid gap-2"
                          style={{
                            gridTemplateColumns: `repeat(${BANK_SLOTS_PER_ROW}, ${BANK_SLOT_SIZE}px)`,
                          }}
                        >
                          {tabItems.map((item) => {
                            const slotIndex = item.slot;
                            const itemTabIndex = item.tabIndex;

                            // Determine visual states
                            const isDragging =
                              draggedSlot === slotIndex &&
                              draggedTabIndex === itemTabIndex;
                            const isDropTarget =
                              hoveredSlot === slotIndex &&
                              hoveredTabIndex === itemTabIndex &&
                              draggedSlot !== null &&
                              !(
                                draggedSlot === slotIndex &&
                                draggedTabIndex === itemTabIndex
                              );
                            const isCrossTabDrop =
                              isDropTarget &&
                              draggedTabIndex !== null &&
                              draggedTabIndex !== itemTabIndex;
                            const canReceiveDrop =
                              draggedSlot !== null && !isDragging;

                            // Visual states for different drop modes
                            const showInsertLine =
                              isDropTarget && dropMode === "insert";
                            const showSwapHighlight =
                              isDropTarget && dropMode === "swap";

                            // Show faint insert guides on ALL items while dragging
                            const showFaintGuide =
                              canReceiveDrop && !isDropTarget;

                            // Color based on cross-tab vs same-tab
                            const dropColor = isCrossTabDrop
                              ? "100, 255, 150"
                              : "100, 200, 255";
                            const guideColor =
                              draggedTabIndex !== itemTabIndex
                                ? "100, 255, 150"
                                : "100, 200, 255";

                            return (
                              <BankSlotItem
                                key={`${itemTabIndex}-${slotIndex}`}
                                item={item}
                                slotIndex={slotIndex}
                                itemTabIndex={itemTabIndex}
                                isDragging={isDragging}
                                isDropTarget={isDropTarget}
                                showSwapHighlight={showSwapHighlight}
                                showInsertLine={showInsertLine}
                                showFaintGuide={showFaintGuide}
                                dropColor={dropColor}
                                guideColor={guideColor}
                                onDragStart={handleSlotDragStart}
                                onDragOver={handleSlotDragOver}
                                onDragLeave={handleSlotDragLeave}
                                onDrop={handleSlotDrop}
                                onDragEnd={handleSlotDragEnd}
                                onClick={handleSlotClick}
                                onContextMenu={handleSlotContextMenu}
                              />
                            );
                          })}

                          {/* RS3-STYLE: Placeholders are items with qty=0, already rendered above with greyed style */}

                          {/* APPEND ZONE - Empty slot at end for dropping items to append */}
                          {draggedSlot !== null && (
                            <div
                              className="rounded flex items-center justify-center relative"
                              style={{
                                width: BANK_SLOT_SIZE,
                                height: BANK_SLOT_SIZE,
                                background:
                                  hoveredSlot === SLOT_INDEX_APPEND_ZONE &&
                                  hoveredTabIndex === tabIdx
                                    ? `linear-gradient(135deg, rgba(${draggedTabIndex !== tabIdx ? "100, 255, 150" : "100, 200, 255"}, 0.35) 0%, rgba(${draggedTabIndex !== tabIdx ? "100, 255, 150" : "100, 200, 255"}, 0.2) 100%)`
                                    : "linear-gradient(135deg, rgba(242, 208, 138, 0.05) 0%, rgba(242, 208, 138, 0.02) 100%)",
                                border:
                                  hoveredSlot === SLOT_INDEX_APPEND_ZONE &&
                                  hoveredTabIndex === tabIdx
                                    ? `2px dashed rgba(${draggedTabIndex !== tabIdx ? "100, 255, 150" : "100, 200, 255"}, 0.9)`
                                    : "2px dashed rgba(242, 208, 138, 0.2)",
                                transition: "all 0.15s ease",
                                boxShadow:
                                  hoveredSlot === SLOT_INDEX_APPEND_ZONE &&
                                  hoveredTabIndex === tabIdx
                                    ? `0 0 12px rgba(${draggedTabIndex !== tabIdx ? "100, 255, 150" : "100, 200, 255"}, 0.5)`
                                    : "none",
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setHoveredSlot(SLOT_INDEX_APPEND_ZONE); // Special marker for "append"
                                setHoveredTabIndex(tabIdx);
                                setDropMode("insert");
                                setInsertPosition("after");
                              }}
                              onDragLeave={() => {
                                setHoveredSlot(null);
                                setHoveredTabIndex(null);
                                setDropMode(null);
                                setInsertPosition(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (
                                  draggedSlot !== null &&
                                  draggedTabIndex !== null
                                ) {
                                  const lastSlot =
                                    tabItems.length > 0
                                      ? tabItems[tabItems.length - 1].slot
                                      : -1;
                                  if (draggedTabIndex === tabIdx) {
                                    // Same tab - move to end
                                    handleBankMove(
                                      draggedSlot,
                                      lastSlot + 1,
                                      "insert",
                                      draggedTabIndex,
                                    );
                                  } else {
                                    // Cross-tab - append to this tab (no toSlot = append)
                                    handleMoveToTab(
                                      draggedSlot,
                                      draggedTabIndex,
                                      tabIdx,
                                    );
                                  }
                                }
                                setDraggedSlot(null);
                                setDraggedTabIndex(null);
                                setDropMode(null);
                                setInsertPosition(null);
                                setHoveredSlot(null);
                                setHoveredTabIndex(null);
                              }}
                            >
                              <span
                                className="text-xs font-medium"
                                style={{
                                  color:
                                    hoveredSlot === SLOT_INDEX_APPEND_ZONE &&
                                    hoveredTabIndex === tabIdx
                                      ? `rgba(${draggedTabIndex !== tabIdx ? "100, 255, 150" : "100, 200, 255"}, 1)`
                                      : "rgba(242, 208, 138, 0.3)",
                                }}
                              >
                                +
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              /* Single tab view - flat grid with improved UX */
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${BANK_SLOTS_PER_ROW}, ${BANK_SLOT_SIZE}px)`,
                }}
              >
                {filteredItems.map((item) => {
                  const slotIndex = item.slot;
                  const itemTabIndex = item.tabIndex;

                  // Determine visual states
                  const isDragging =
                    draggedSlot === slotIndex &&
                    draggedTabIndex === itemTabIndex;
                  const isDropTarget =
                    hoveredSlot === slotIndex &&
                    draggedSlot !== null &&
                    !(
                      draggedSlot === slotIndex &&
                      draggedTabIndex === itemTabIndex
                    );
                  const canReceiveDrop = draggedSlot !== null && !isDragging;
                  const showSwapHighlight = isDropTarget && dropMode === "swap";
                  const showInsertLine = isDropTarget && dropMode === "insert";

                  // Show faint insert guides on ALL items while dragging
                  const showFaintGuide = canReceiveDrop && !isDropTarget;

                  // Single-tab view uses same color for all
                  const dropColor = "100, 200, 255";
                  const guideColor = "100, 200, 255";

                  return (
                    <BankSlotItem
                      key={`${itemTabIndex}-${slotIndex}`}
                      item={item}
                      slotIndex={slotIndex}
                      itemTabIndex={itemTabIndex}
                      isDragging={isDragging}
                      isDropTarget={isDropTarget}
                      showSwapHighlight={showSwapHighlight}
                      showInsertLine={showInsertLine}
                      showFaintGuide={showFaintGuide}
                      dropColor={dropColor}
                      guideColor={guideColor}
                      onDragStart={handleSlotDragStart}
                      onDragOver={handleSlotDragOver}
                      onDragLeave={handleSlotDragLeave}
                      onDrop={handleSlotDrop}
                      onDragEnd={handleSlotDragEnd}
                      onClick={handleSlotClick}
                      onContextMenu={handleSlotContextMenu}
                    />
                  );
                })}

                {/* RS3-STYLE: Placeholders are items with qty=0, already rendered above with greyed style */}

                {/* APPEND ZONE - Empty slot at end for dropping items to append */}
                {draggedSlot !== null && selectedTab >= 0 && (
                  <div
                    className="rounded flex items-center justify-center relative"
                    style={{
                      width: BANK_SLOT_SIZE,
                      height: BANK_SLOT_SIZE,
                      background:
                        hoveredSlot === SLOT_INDEX_APPEND_ZONE
                          ? "linear-gradient(135deg, rgba(100, 200, 255, 0.35) 0%, rgba(100, 200, 255, 0.2) 100%)"
                          : "linear-gradient(135deg, rgba(242, 208, 138, 0.05) 0%, rgba(242, 208, 138, 0.02) 100%)",
                      border:
                        hoveredSlot === SLOT_INDEX_APPEND_ZONE
                          ? "2px dashed rgba(100, 200, 255, 0.9)"
                          : "2px dashed rgba(242, 208, 138, 0.2)",
                      transition: "all 0.15s ease",
                      boxShadow:
                        hoveredSlot === SLOT_INDEX_APPEND_ZONE
                          ? "0 0 12px rgba(100, 200, 255, 0.5)"
                          : "none",
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setHoveredSlot(SLOT_INDEX_APPEND_ZONE); // Special marker for "append"
                      setDropMode("insert");
                      setInsertPosition("after");
                    }}
                    onDragLeave={() => {
                      setHoveredSlot(null);
                      setDropMode(null);
                      setInsertPosition(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (
                        draggedSlot !== null &&
                        draggedTabIndex !== null &&
                        draggedTabIndex === selectedTab
                      ) {
                        const lastSlot =
                          filteredItems.length > 0
                            ? filteredItems[filteredItems.length - 1].slot
                            : -1;
                        handleBankMove(
                          draggedSlot,
                          lastSlot + 1,
                          "insert",
                          draggedTabIndex,
                        );
                      }
                      setDraggedSlot(null);
                      setDraggedTabIndex(null);
                      setDropMode(null);
                      setInsertPosition(null);
                      setHoveredSlot(null);
                    }}
                  >
                    <span
                      className="text-xs font-medium"
                      style={{
                        color:
                          hoveredSlot === SLOT_INDEX_APPEND_ZONE
                            ? "rgba(100, 200, 255, 1)"
                            : "rgba(242, 208, 138, 0.3)",
                      }}
                    >
                      +
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer - Status bar with placeholder controls */}
          <div
            className="mx-3 mb-2 mt-1 px-3 py-1.5 flex justify-between items-center text-xs rounded"
            style={{
              background: BANK_THEME.PANEL_BG_DARK,
              border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
              color: BANK_THEME.TEXT_GOLD_DIM,
            }}
          >
            <div className="flex items-center gap-3">
              <span>
                {selectedTab === TAB_INDEX_ALL
                  ? `${items.length} items`
                  : `${filteredItems.length} in tab`}{" "}
                • {items.length}/{maxSlots} slots
              </span>
              {/* RS3-style: Count items with qty=0 as placeholders */}
              {items.filter((i) => i.quantity === 0).length > 0 && (
                <span style={{ opacity: 0.6 }}>
                  ({items.filter((i) => i.quantity === 0).length} placeholder
                  {items.filter((i) => i.quantity === 0).length !== 1
                    ? "s"
                    : ""}
                  )
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Always Set Placeholder Checkbox */}
              <label
                className="flex items-center gap-1.5 cursor-pointer select-none"
                title={
                  alwaysSetPlaceholder
                    ? "Placeholders ON: Withdrawing all creates placeholder"
                    : "Placeholders OFF: Withdrawing all removes slot"
                }
              >
                <input
                  type="checkbox"
                  checked={alwaysSetPlaceholder}
                  onChange={handleToggleAlwaysPlaceholder}
                  className="w-3.5 h-3.5 rounded cursor-pointer accent-amber-600"
                  style={{
                    accentColor: "#d97706",
                  }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: alwaysSetPlaceholder
                      ? "#f2d08a"
                      : "rgba(255,255,255,0.5)",
                  }}
                >
                  Always placeholder
                </span>
              </label>
              {/* Release All Placeholders (RS3-style: items with qty=0) */}
              {items.filter((i) => i.quantity === 0).length > 0 && (
                <button
                  onClick={handleReleaseAllPlaceholders}
                  className="px-2 py-0.5 rounded text-[10px] font-medium transition-all"
                  style={{
                    background: "rgba(180, 100, 100, 0.5)",
                    color: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(180, 100, 100, 0.6)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "rgba(180, 100, 100, 0.7)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "rgba(180, 100, 100, 0.5)";
                  }}
                  title="Release all placeholders"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inventory Panel - Right Side */}
        <div
          className="flex flex-col rounded-lg"
          style={{
            background: BANK_THEME.PANEL_BG,
            border: `2px solid ${BANK_THEME.PANEL_BORDER}`,
            boxShadow: `0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 ${BANK_THEME.PANEL_BORDER_LIGHT}`,
            width: `${INV_SLOTS_PER_ROW * (INV_SLOT_SIZE + 4) + 24}px`,
          }}
        >
          {/* Header */}
          <div
            className="flex justify-center items-center px-3 py-2 rounded-t-lg"
            style={{
              background:
                "linear-gradient(180deg, rgba(139, 69, 19, 0.4) 0%, rgba(139, 69, 19, 0.2) 100%)",
              borderBottom: `1px solid ${BANK_THEME.PANEL_BORDER}`,
            }}
          >
            <h2
              className="text-sm font-bold flex items-center gap-2"
              style={{ color: BANK_THEME.TEXT_GOLD }}
            >
              <span>🎒</span>
              <span>Inventory</span>
            </h2>
          </div>

          {/* Inventory Grid */}
          <div className="p-2 flex-1">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${INV_SLOTS_PER_ROW}, ${INV_SLOT_SIZE}px)`,
              }}
            >
              {Array.from({ length: INV_SLOTS_PER_ROW * INV_ROWS }).map(
                (_, idx) => {
                  const item = inventory.find((i) => i && i.slot === idx);

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-center relative rounded ${item ? "cursor-pointer" : ""}`}
                      style={{
                        width: INV_SLOT_SIZE,
                        height: INV_SLOT_SIZE,
                        background: item
                          ? "linear-gradient(135deg, rgba(242, 208, 138, 0.1) 0%, rgba(242, 208, 138, 0.05) 100%)"
                          : "rgba(0, 0, 0, 0.4)",
                        border: item
                          ? `1px solid ${BANK_THEME.SLOT_BORDER_HIGHLIGHT}`
                          : `1px solid ${BANK_THEME.SLOT_BORDER}`,
                      }}
                      title={
                        item
                          ? `${formatItemName(item.itemId)} x${item.quantity} - Click to deposit`
                          : "Empty slot"
                      }
                      onClick={() => item && handleDeposit(item.itemId, 1)}
                      onContextMenu={(e) => {
                        if (item) {
                          openContextMenu(
                            e,
                            item.itemId,
                            item.quantity || 1,
                            "inventory",
                          );
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (item) {
                          e.currentTarget.style.background =
                            "linear-gradient(135deg, rgba(100, 200, 100, 0.2) 0%, rgba(100, 200, 100, 0.1) 100%)";
                          e.currentTarget.style.borderColor =
                            "rgba(100, 200, 100, 0.5)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (item) {
                          e.currentTarget.style.background =
                            "linear-gradient(135deg, rgba(242, 208, 138, 0.1) 0%, rgba(242, 208, 138, 0.05) 100%)";
                          e.currentTarget.style.borderColor =
                            BANK_THEME.SLOT_BORDER_HIGHLIGHT;
                        }
                      }}
                    >
                      {item && (
                        <>
                          <span className="text-lg select-none">
                            {getItemIcon(item.itemId)}
                          </span>
                          {(item.quantity || 1) > 1 && (
                            <span
                              className="absolute bottom-0 right-0.5 text-[9px] font-bold"
                              style={{
                                color: BANK_THEME.TEXT_YELLOW,
                                textShadow:
                                  "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
                              }}
                            >
                              {item.quantity}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </div>

          {/* Coin Pouch Section */}
          <div
            className="mx-2 mb-2 p-2 rounded flex items-center justify-between"
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">💰</span>
              <span className="text-sm font-bold" style={{ color: "#fbbf24" }}>
                {coins.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => openCoinModal("deposit")}
              disabled={coins <= 0}
              className="px-2 py-1 rounded text-xs font-bold transition-colors disabled:opacity-30"
              style={{
                background: "rgba(100, 180, 100, 0.6)",
                color: "#fff",
                border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
              }}
              onMouseEnter={(e) => {
                if (coins > 0)
                  e.currentTarget.style.background = "rgba(100, 180, 100, 0.8)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(100, 180, 100, 0.6)";
              }}
            >
              Deposit
            </button>
          </div>

          {/* Deposit All Button */}
          <div className="px-2 pb-2">
            <button
              onClick={handleDepositAll}
              className="w-full py-2 rounded text-sm font-bold transition-colors"
              style={{
                background:
                  "linear-gradient(180deg, rgba(139, 69, 19, 0.7) 0%, rgba(139, 69, 19, 0.5) 100%)",
                color: BANK_THEME.TEXT_GOLD,
                border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(180deg, rgba(139, 69, 19, 0.9) 0%, rgba(139, 69, 19, 0.7) 100%)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(180deg, rgba(139, 69, 19, 0.7) 0%, rgba(139, 69, 19, 0.5) 100%)";
              }}
            >
              Deposit All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
