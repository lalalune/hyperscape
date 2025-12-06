/**
 * StorePanel - RuneScape-style store interface
 *
 * Features:
 * - Grid display of store items for sale
 * - Player inventory for selling items
 * - Fixed prices (from stores.json manifest)
 * - Buyback at 50% of item value
 * - Left-click to buy/sell 1
 * - Right-click context menu for buy/sell options (1, 5, 10, All, X)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { ClientWorld, InventorySlotItem } from "../../types";
import { COLORS } from "../../constants";

interface StoreItem {
  id: string;
  itemId: string;
  name: string;
  price: number;
  stockQuantity: number;
  description?: string;
  category?: string;
}

type InventorySlotViewItem = Pick<
  InventorySlotItem,
  "slot" | "itemId" | "quantity"
>;

interface StorePanelProps {
  storeId: string;
  storeName: string;
  buybackRate: number;
  items: StoreItem[];
  world: ClientWorld;
  inventory: InventorySlotViewItem[];
  coins: number;
  npcEntityId?: string;
  onClose: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  itemId: string;
  quantity: number;
  price: number;
  type: "store" | "inventory";
  itemName: string;
}

const STORE_SLOTS_PER_ROW = 8;
const STORE_VISIBLE_ROWS = 5;
const STORE_SCROLL_HEIGHT = STORE_VISIBLE_ROWS * 55;

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
  if (id.includes("fishing") || id.includes("rod")) return "🎣";
  if (id.includes("tinderbox")) return "🔥";
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
 * Format price for display
 */
function formatPrice(price: number): string {
  if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `${Math.floor(price / 1000)}K`;
  return String(price);
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

  const actionLabel = menu.type === "store" ? "Buy" : "Sell";

  const handleCustomSubmit = () => {
    const amount = parseInt(customAmount, 10);
    if (amount > 0) {
      onAction(menu.type === "store" ? "buy" : "sell", amount);
    }
    onClose();
  };

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

  if (!menu.visible) return null;

  const maxQuantity =
    menu.type === "store"
      ? menu.quantity === -1
        ? 9999
        : menu.quantity
      : menu.quantity;

  const menuOptions = [
    { label: `${actionLabel} 1`, amount: 1 },
    { label: `${actionLabel} 5`, amount: 5 },
    { label: `${actionLabel} 10`, amount: 10 },
    { label: `${actionLabel} X`, amount: -1 },
  ];

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
        {/* Item name header */}
        <div
          className="px-3 py-1 text-xs font-bold border-b"
          style={{
            color: COLORS.ACCENT,
            borderColor: "rgba(139, 69, 19, 0.4)",
          }}
        >
          {menu.itemName}
        </div>
        {/* Price info */}
        <div
          className="px-3 py-1 text-xs border-b"
          style={{
            color: "#fbbf24",
            borderColor: "rgba(139, 69, 19, 0.4)",
          }}
        >
          {menu.type === "store" ? "Price" : "Sell"}: {formatPrice(menu.price)}{" "}
          gp
        </div>
        {showCustomInput ? (
          <div className="px-2 py-2">
            <input
              type="number"
              min="1"
              max={maxQuantity}
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
              placeholder={`1-${maxQuantity}`}
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
              className="block w-full px-3 py-1 text-left text-xs transition-colors whitespace-nowrap"
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
                    menu.type === "store" ? "buy" : "sell",
                    Math.min(option.amount, maxQuantity),
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
// The server tracks interaction sessions and sends storeClose packets
// when the player moves too far away. The client no longer polls distance.
// This prevents race conditions between server and client position sync
// that caused unreliable store opening under lag.

export function StorePanel({
  storeId,
  storeName,
  buybackRate,
  items,
  world,
  inventory,
  coins,
  npcEntityId,
  onClose,
}: StorePanelProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    itemId: "",
    quantity: 0,
    price: 0,
    type: "store",
    itemName: "",
  });

  // NOTE: Distance validation is handled server-side (InteractionSessionManager)
  // The server sends storeClose packets when the player moves too far away.
  // This eliminates race conditions between server and client position sync.

  // Convert inventory array to slot-indexed array
  const inventorySlots: (InventorySlotViewItem | null)[] = Array(28).fill(null);
  inventory.forEach((item) => {
    if (typeof item.slot === "number" && item.slot >= 0 && item.slot < 28) {
      inventorySlots[item.slot] = item;
    }
  });

  const handleBuy = useCallback(
    (itemId: string, quantity: number) => {
      if (world.network?.send) {
        world.network.send("storeBuy", { storeId, itemId, quantity });
      }
    },
    [world.network, storeId],
  );

  const handleSell = useCallback(
    (itemId: string, quantity: number) => {
      if (world.network?.send) {
        world.network.send("storeSell", { storeId, itemId, quantity });
      }
    },
    [world.network, storeId],
  );

  const handleContextMenuAction = useCallback(
    (action: string, quantity: number) => {
      if (action === "buy") {
        handleBuy(contextMenu.itemId, quantity);
      } else if (action === "sell") {
        handleSell(contextMenu.itemId, quantity);
      }
    },
    [contextMenu.itemId, handleBuy, handleSell],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const openStoreContextMenu = (e: React.MouseEvent, item: StoreItem) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      itemId: item.itemId,
      quantity: item.stockQuantity,
      price: item.price,
      type: "store",
      itemName: item.name,
    });
  };

  const openInventoryContextMenu = (
    e: React.MouseEvent,
    item: InventorySlotViewItem,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate total quantity of this item in inventory
    const totalQuantity = inventory
      .filter((i) => i && i.itemId === item.itemId)
      .reduce((sum, i) => sum + (i.quantity || 1), 0);

    // Calculate sell price (buybackRate * base value)
    // For now, estimate from store items or use a flat rate
    const storeItem = items.find((si) => si.itemId === item.itemId);
    const sellPrice = storeItem
      ? Math.floor(storeItem.price * buybackRate)
      : Math.floor(10 * buybackRate); // Default 10 gp base value

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      itemId: item.itemId,
      quantity: totalQuantity,
      price: sellPrice,
      type: "inventory",
      itemName: formatItemName(item.itemId),
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
      <style>{`
        .store-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .store-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
        }
        .store-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 69, 19, 0.6);
          border-radius: 4px;
        }
        .store-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 69, 19, 0.8);
        }
      `}</style>
      <ContextMenu
        menu={contextMenu}
        onAction={handleContextMenuAction}
        onClose={closeContextMenu}
      />

      <div className="flex gap-2">
        {/* Store Panel - Left Side */}
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
              <span>🏪</span>
              <span>{storeName}</span>
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

          {/* Store Items Grid */}
          <div
            className="p-3 overflow-y-auto overflow-x-hidden store-scrollbar"
            style={{
              maxHeight: `${STORE_SCROLL_HEIGHT}px`,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(139, 69, 19, 0.6) rgba(0, 0, 0, 0.3)",
            }}
          >
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${STORE_SLOTS_PER_ROW}, 50px)`,
              }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  className="w-[50px] h-[50px] rounded flex flex-col items-center justify-center relative cursor-pointer transition-colors duration-150"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(242, 208, 138, 0.1) 0%, rgba(242, 208, 138, 0.05) 100%)",
                    border: "1px solid rgba(242, 208, 138, 0.3)",
                  }}
                  title={`${item.name} - ${item.price} gp${item.stockQuantity !== -1 ? ` (${item.stockQuantity} in stock)` : ""}`}
                  onClick={() => handleBuy(item.itemId, 1)}
                  onContextMenu={(e) => openStoreContextMenu(e, item)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "linear-gradient(135deg, rgba(242, 208, 138, 0.2) 0%, rgba(242, 208, 138, 0.1) 100%)";
                    e.currentTarget.style.borderColor =
                      "rgba(242, 208, 138, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "linear-gradient(135deg, rgba(242, 208, 138, 0.1) 0%, rgba(242, 208, 138, 0.05) 100%)";
                    e.currentTarget.style.borderColor =
                      "rgba(242, 208, 138, 0.3)";
                  }}
                >
                  <span className="text-xl select-none">
                    {getItemIcon(item.itemId)}
                  </span>
                  {/* Price */}
                  <span
                    className="absolute bottom-0 right-0.5 text-[9px] font-bold"
                    style={{
                      color: "#fbbf24",
                      textShadow: "1px 1px 1px black, -1px -1px 1px black",
                    }}
                  >
                    {formatPrice(item.price)}
                  </span>
                  {/* Stock indicator */}
                  {item.stockQuantity !== -1 && item.stockQuantity < 10 && (
                    <span
                      className="absolute top-0 left-0.5 text-[8px] font-bold"
                      style={{
                        color: item.stockQuantity === 0 ? "#ff6666" : "#ffffff",
                        textShadow: "1px 1px 1px black",
                      }}
                    >
                      {item.stockQuantity}
                    </span>
                  )}
                </div>
              ))}
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
              <span>Sells at {Math.floor(buybackRate * 100)}% value</span>
              <span>Left: Buy 1 | Right: Options</span>
            </div>
          </div>
        </div>

        {/* Inventory Panel - Right Side */}
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
                          ? `${formatItemName(item.itemId)} x${item.quantity} - Click to sell`
                          : "Empty slot"
                      }
                      onClick={() => item && handleSell(item.itemId, 1)}
                      onContextMenu={(e) => {
                        if (item) {
                          openInventoryContextMenu(e, item);
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (item) {
                          e.currentTarget.style.background =
                            "linear-gradient(135deg, rgba(200, 150, 100, 0.2) 0%, rgba(200, 150, 100, 0.1) 100%)";
                          e.currentTarget.style.borderColor =
                            "rgba(200, 150, 100, 0.5)";
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
              {coins.toLocaleString()} gp
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
              Left: Sell 1 | Right: Options
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
