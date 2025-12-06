/**
 * BankPanel - RuneScape-style bank interface
 *
 * Features:
 * - Scrollable grid display of bank items (480 slots)
 * - Right-click context menu with withdraw/deposit options (1, 5, 10, All, X)
 * - Left-click for quick withdraw/deposit 1
 * - All items stack in bank (MVP simplification)
 * - Shows alongside inventory when open
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { ClientWorld, InventorySlotItem } from "../../types";
import { COLORS } from "../../constants";

interface BankItem {
  itemId: string;
  quantity: number;
  slot: number;
}

type InventorySlotViewItem = Pick<
  InventorySlotItem,
  "slot" | "itemId" | "quantity"
>;

interface BankPanelProps {
  items: BankItem[];
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
}

const BANK_SLOTS_PER_ROW = 10;
const BANK_VISIBLE_ROWS = 8; // Height of visible area to match inventory
const BANK_SCROLL_HEIGHT = BANK_VISIBLE_ROWS * 45; // 45px per row (44px + gap)

const INV_SLOTS_PER_ROW = 4;
const INV_ROWS = 7;

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

/**
 * Context Menu Component
 */
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

  const actionLabel = menu.type === "bank" ? "Withdraw" : "Deposit";

  const handleCustomSubmit = () => {
    const amount = parseInt(customAmount, 10);
    if (amount > 0) {
      onAction(menu.type === "bank" ? "withdraw" : "deposit", amount);
    }
    onClose();
  };

  // Close on click outside - only when menu is visible
  // Use capture phase to catch events BEFORE stopPropagation in BankPanel
  useEffect(() => {
    if (!menu.visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside the menu
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Add listener on next frame to avoid immediate trigger from right-click
    requestAnimationFrame(() => {
      // Use capture: true to catch events before they're stopped by BankPanel
      document.addEventListener("mousedown", handleClickOutside, true);
    });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [menu.visible, onClose]);

  if (!menu.visible) return null;

  const menuOptions = [
    { label: `${actionLabel} 1`, amount: 1 },
    { label: `${actionLabel} 5`, amount: 5 },
    { label: `${actionLabel} 10`, amount: 10 },
    { label: `${actionLabel} All`, amount: menu.quantity },
    { label: `${actionLabel} X`, amount: -1 }, // -1 indicates custom
  ];

  // Use portal to render menu directly to body, avoiding transform issues
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
                } else {
                  onAction(
                    menu.type === "bank" ? "withdraw" : "deposit",
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

// NOTE: Distance validation is now SERVER-AUTHORITATIVE
// The server tracks interaction sessions and sends bankClose packets
// when the player moves too far away. The client no longer polls distance.
// This prevents race conditions between server and client position sync
// that caused unreliable bank opening under lag.

export function BankPanel({
  items,
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

  // NOTE: Distance validation is handled server-side (InteractionSessionManager)
  // The server sends bankClose packets when the player moves too far away.
  // This eliminates race conditions between server and client position sync.

  // Calculate total rows needed for all bank slots
  const totalBankRows = Math.ceil(maxSlots / BANK_SLOTS_PER_ROW);

  // Convert inventory array to slot-indexed array
  const inventorySlots: (InventorySlotViewItem | null)[] = Array(28).fill(null);
  inventory.forEach((item) => {
    if (typeof item.slot === "number" && item.slot >= 0 && item.slot < 28) {
      inventorySlots[item.slot] = item;
    }
  });

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
        world.network.send("bankDeposit", { itemId, quantity });
      }
    },
    [world.network],
  );

  const handleDepositAll = () => {
    // Deposit all inventory items in a single batch operation
    if (world.network?.send) {
      world.network.send("bankDepositAll", {});
    }
  };

  const handleContextMenuAction = useCallback(
    (action: string, quantity: number) => {
      if (action === "withdraw") {
        handleWithdraw(contextMenu.itemId, quantity);
      } else if (action === "deposit") {
        handleDeposit(contextMenu.itemId, quantity);
      }
    },
    [contextMenu.itemId, handleWithdraw, handleDeposit],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const openContextMenu = (
    e: React.MouseEvent,
    itemId: string,
    quantity: number,
    type: "bank" | "inventory",
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // For inventory items, calculate total count across ALL slots
    // (since inventory items don't stack - each is in its own slot with qty=1)
    let totalQuantity = quantity;
    if (type === "inventory") {
      totalQuantity = inventory
        .filter((item) => item && item.itemId === itemId)
        .reduce((sum, item) => sum + (item.quantity || 1), 0);
    }

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      itemId,
      quantity: totalQuantity,
      type,
    });
  };

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
      {/* Custom scrollbar styles for webkit browsers */}
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
      {/* Context Menu */}
      <ContextMenu
        menu={contextMenu}
        onAction={handleContextMenuAction}
        onClose={closeContextMenu}
      />

      <div className="flex gap-2">
        {/* Bank Panel - Left Side */}
        <div
          className="rounded-lg shadow-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(20, 15, 10, 0.98) 0%, rgba(15, 10, 5, 0.98) 100%)",
            border: "2px solid rgba(139, 69, 19, 0.7)",
            boxShadow:
              "0 10px 30px rgba(0, 0, 0, 0.8), inset 0 2px 4px rgba(242, 208, 138, 0.1)",
          }}
        >
          {/* Header */}
          <div
            className="flex justify-between items-center px-4 py-2 rounded-t-lg"
            style={{
              background:
                "linear-gradient(180deg, rgba(139, 69, 19, 0.4) 0%, rgba(139, 69, 19, 0.2) 100%)",
              borderBottom: "1px solid rgba(139, 69, 19, 0.5)",
            }}
          >
            <h2
              className="text-lg font-bold flex items-center gap-2"
              style={{ color: COLORS.ACCENT }}
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

          {/* Scrollable Item Grid */}
          <div
            className="p-3 overflow-y-auto overflow-x-hidden bank-scrollbar"
            style={{
              maxHeight: `${BANK_SCROLL_HEIGHT}px`,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(139, 69, 19, 0.6) rgba(0, 0, 0, 0.3)",
            }}
          >
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${BANK_SLOTS_PER_ROW}, 44px)`,
              }}
            >
              {Array.from({ length: maxSlots }).map((_, idx) => {
                const slotIndex = idx;
                const item = items.find((i) => i.slot === slotIndex);

                return (
                  <div
                    key={slotIndex}
                    className={`
                      w-11 h-11 rounded
                      flex items-center justify-center relative
                      transition-colors duration-150
                      ${item ? "cursor-pointer" : ""}
                    `}
                    style={{
                      background: item
                        ? "linear-gradient(135deg, rgba(242, 208, 138, 0.1) 0%, rgba(242, 208, 138, 0.05) 100%)"
                        : "rgba(0, 0, 0, 0.4)",
                      border: item
                        ? "1px solid rgba(242, 208, 138, 0.3)"
                        : "1px solid rgba(242, 208, 138, 0.1)",
                    }}
                    title={
                      item
                        ? `${formatItemName(item.itemId)} x${item.quantity}`
                        : "Empty slot"
                    }
                    onClick={() => item && handleWithdraw(item.itemId, 1)}
                    onContextMenu={(e) => {
                      if (item) {
                        openContextMenu(e, item.itemId, item.quantity, "bank");
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (item) {
                        e.currentTarget.style.background =
                          "linear-gradient(135deg, rgba(242, 208, 138, 0.2) 0%, rgba(242, 208, 138, 0.1) 100%)";
                        e.currentTarget.style.borderColor =
                          "rgba(242, 208, 138, 0.5)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (item) {
                        e.currentTarget.style.background =
                          "linear-gradient(135deg, rgba(242, 208, 138, 0.1) 0%, rgba(242, 208, 138, 0.05) 100%)";
                        e.currentTarget.style.borderColor =
                          "rgba(242, 208, 138, 0.3)";
                      }
                    }}
                  >
                    {item && (
                      <>
                        <span className="text-xl select-none">
                          {getItemIcon(item.itemId)}
                        </span>
                        {item.quantity > 1 && (
                          <span
                            className="absolute bottom-0 right-0.5 text-[10px] font-bold"
                            style={{
                              color:
                                item.quantity >= 10000000
                                  ? "#00ff00"
                                  : item.quantity >= 100000
                                    ? "#ffffff"
                                    : "#ffff00",
                              textShadow:
                                "1px 1px 1px black, -1px -1px 1px black",
                            }}
                          >
                            {formatQuantity(item.quantity)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2 rounded-b-lg"
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              borderTop: "1px solid rgba(139, 69, 19, 0.3)",
            }}
          >
            <div
              className="flex justify-between items-center text-xs"
              style={{ color: "rgba(242, 208, 138, 0.6)" }}
            >
              <span>
                {items.length} / {maxSlots} slots
              </span>
              <span>Left: -1 | Right: Options</span>
            </div>
          </div>
        </div>

        {/* Inventory Panel - Right Side (Bank Mode) */}
        <div
          className="rounded-lg shadow-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(20, 15, 10, 0.98) 0%, rgba(15, 10, 5, 0.98) 100%)",
            border: "2px solid rgba(139, 69, 19, 0.7)",
            boxShadow:
              "0 10px 30px rgba(0, 0, 0, 0.8), inset 0 2px 4px rgba(242, 208, 138, 0.1)",
            width: "200px",
          }}
        >
          {/* Header */}
          <div
            className="flex justify-between items-center px-3 py-2 rounded-t-lg"
            style={{
              background:
                "linear-gradient(180deg, rgba(139, 69, 19, 0.4) 0%, rgba(139, 69, 19, 0.2) 100%)",
              borderBottom: "1px solid rgba(139, 69, 19, 0.5)",
            }}
          >
            <h2
              className="text-sm font-bold flex items-center gap-2"
              style={{ color: COLORS.ACCENT }}
            >
              <span>🎒</span>
              <span>Inventory</span>
            </h2>
          </div>

          {/* Inventory Grid */}
          <div className="p-2">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${INV_SLOTS_PER_ROW}, 42px)`,
              }}
            >
              {Array.from({ length: INV_SLOTS_PER_ROW * INV_ROWS }).map(
                (_, idx) => {
                  const item = inventorySlots[idx];

                  return (
                    <div
                      key={idx}
                      className={`
                      w-[42px] h-[42px] rounded
                      flex items-center justify-center relative
                      transition-colors duration-150
                      ${item ? "cursor-pointer" : ""}
                    `}
                      style={{
                        background: item
                          ? "linear-gradient(135deg, rgba(242, 208, 138, 0.1) 0%, rgba(242, 208, 138, 0.05) 100%)"
                          : "rgba(0, 0, 0, 0.4)",
                        border: item
                          ? "1px solid rgba(242, 208, 138, 0.3)"
                          : "1px solid rgba(242, 208, 138, 0.1)",
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
                            "rgba(242, 208, 138, 0.3)";
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
                                color: "#ffff00",
                                textShadow:
                                  "1px 1px 1px black, -1px -1px 1px black",
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

          {/* Deposit All Button */}
          <div className="px-2 pb-2">
            <button
              onClick={handleDepositAll}
              className="w-full py-2 rounded text-sm font-bold transition-colors"
              style={{
                background:
                  "linear-gradient(180deg, rgba(139, 69, 19, 0.7) 0%, rgba(139, 69, 19, 0.5) 100%)",
                color: COLORS.ACCENT,
                border: "1px solid rgba(139, 69, 19, 0.8)",
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

          {/* Coins */}
          <div
            className="px-3 py-2 rounded-b-lg flex items-center justify-between"
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              borderTop: "1px solid rgba(139, 69, 19, 0.3)",
            }}
          >
            <span className="text-sm">💰</span>
            <span className="text-sm font-bold" style={{ color: "#fbbf24" }}>
              {coins.toLocaleString()}
            </span>
          </div>

          {/* Footer hint */}
          <div
            className="px-2 py-1 text-center"
            style={{
              background: "rgba(0, 0, 0, 0.2)",
              borderTop: "1px solid rgba(139, 69, 19, 0.2)",
            }}
          >
            <span
              className="text-[10px]"
              style={{ color: "rgba(242, 208, 138, 0.5)" }}
            >
              Left: +1 | Right: Options
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
