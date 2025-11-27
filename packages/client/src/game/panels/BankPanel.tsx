/**
 * BankPanel - RuneScape-style bank interface
 *
 * Features:
 * - Grid display of bank items with pagination
 * - Left-click to withdraw 1, right-click to withdraw all
 * - Deposit functionality via inventory integration
 * - All items stack in bank (MVP simplification)
 * - Shows alongside inventory when open
 */

import React, { useState } from "react";
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
  onClose: () => void;
}

const BANK_SLOTS_PER_ROW = 8;
const BANK_VISIBLE_ROWS = 6;
const BANK_VISIBLE_SLOTS = BANK_SLOTS_PER_ROW * BANK_VISIBLE_ROWS; // 48 visible at once

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

export function BankPanel({
  items,
  maxSlots,
  world,
  inventory,
  coins,
  onClose,
}: BankPanelProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(maxSlots / BANK_VISIBLE_SLOTS);

  const startSlot = page * BANK_VISIBLE_SLOTS;
  const visibleItems = items.filter(
    (item) =>
      item.slot >= startSlot && item.slot < startSlot + BANK_VISIBLE_SLOTS,
  );

  // Convert inventory array to slot-indexed array
  const inventorySlots: (InventorySlotViewItem | null)[] = Array(28).fill(null);
  inventory.forEach((item) => {
    if (typeof item.slot === "number" && item.slot >= 0 && item.slot < 28) {
      inventorySlots[item.slot] = item;
    }
  });

  const handleWithdraw = (itemId: string, quantity: number) => {
    if (world.network?.send) {
      world.network.send("bankWithdraw", { itemId, quantity });
    }
  };

  const handleDeposit = (itemId: string, quantity: number) => {
    if (world.network?.send) {
      world.network.send("bankDeposit", { itemId, quantity });
    }
  };

  const handleDepositAll = () => {
    // Deposit all inventory items
    inventory.forEach((item) => {
      if (item && item.itemId) {
        handleDeposit(item.itemId, item.quantity || 1);
      }
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

          {/* Item Grid */}
          <div className="p-3">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${BANK_SLOTS_PER_ROW}, 44px)`,
              }}
            >
              {Array.from({ length: BANK_VISIBLE_SLOTS }).map((_, idx) => {
                const slotIndex = startSlot + idx;
                const item = visibleItems.find((i) => i.slot === slotIndex);

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
                      e.preventDefault();
                      if (item) handleWithdraw(item.itemId, item.quantity);
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 pb-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 rounded transition-colors"
                style={{
                  background:
                    page === 0
                      ? "rgba(50, 50, 50, 0.5)"
                      : "rgba(139, 69, 19, 0.6)",
                  color: page === 0 ? "rgba(255, 255, 255, 0.4)" : "#fff",
                  cursor: page === 0 ? "not-allowed" : "pointer",
                }}
              >
                ◀
              </button>
              <span
                className="text-sm"
                style={{ color: "rgba(242, 208, 138, 0.8)" }}
              >
                Page {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1 rounded transition-colors"
                style={{
                  background:
                    page === totalPages - 1
                      ? "rgba(50, 50, 50, 0.5)"
                      : "rgba(139, 69, 19, 0.6)",
                  color:
                    page === totalPages - 1
                      ? "rgba(255, 255, 255, 0.4)"
                      : "#fff",
                  cursor: page === totalPages - 1 ? "not-allowed" : "pointer",
                }}
              >
                ▶
              </button>
            </div>
          )}

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
              <span>Left: Withdraw 1 | Right: Withdraw All</span>
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
                        e.preventDefault();
                        if (item)
                          handleDeposit(item.itemId, item.quantity || 1);
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
              Click: Deposit 1 | Right: Deposit All
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
