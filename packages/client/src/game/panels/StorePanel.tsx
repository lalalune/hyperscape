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

import React, {
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { ClientWorld, InventorySlotItem } from "../../types";
import { COLORS } from "../../constants";
import { InventoryPanel } from "./InventoryPanel";
import {
  CursorTooltip,
  useWindowStore,
  useThemeStore,
  useMobileLayout,
} from "@/ui";
import {
  getTooltipMetaStyle,
  getTooltipTitleStyle,
} from "@/ui/core/tooltip/tooltipStyles";
import {
  getContextMenuItemStyle,
  getContextMenuSurfaceStyle,
  getInteractiveTileStyle,
  getPanelHeaderStyle,
  getPanelInsetStyle,
  getPanelSurfaceStyle,
} from "@/ui/theme/themes";
import { getItem } from "@hyperforge/shared";
import { formatItemName, formatPrice } from "@/utils";
import { ItemIcon } from "@/ui/components/ItemIcon";
import { UI } from "@/ui/core";

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

/**
 * Context Menu Component
 * Uses theme system for consistent styling.
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
  const theme = useThemeStore((s) => s.theme);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
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

  const menuContainerStyle: CSSProperties = {
    ...getContextMenuSurfaceStyle(theme, {
      minWidth: 188,
      radius: theme.borderRadius.md,
    }),
    padding: `${theme.spacing.xs}px 0`,
    display: "inline-block",
  };

  const menuItemStyle = (isHovered: boolean): CSSProperties => ({
    display: "block",
    width: "100%",
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    textAlign: "left",
    fontSize: theme.typography.fontSize.xs,
    color: isHovered ? theme.colors.text.primary : theme.colors.text.secondary,
    ...getContextMenuItemStyle(theme, {
      hovered: isHovered,
      radius: 0,
      padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    }),
    borderBottom: `1px solid ${isHovered ? `${theme.colors.border.hover}55` : "transparent"}`,
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s ease",
    whiteSpace: "nowrap",
  });

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: menu.x,
        top: menu.y,
        width: "auto",
        zIndex: UI.Z_INDEX.CONTEXT_MENU,
        pointerEvents: "auto",
      }}
    >
      <div style={menuContainerStyle}>
        {/* Item name header */}
        <div
          style={{
            ...getPanelHeaderStyle(theme),
            padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.accent.primary,
          }}
        >
          {menu.itemName}
        </div>
        {/* Price info */}
        <div
          style={{
            padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.state.warning,
            ...getPanelInsetStyle(theme, {
              emphasis: "normal",
              radius: theme.borderRadius.sm,
            }),
            borderBottom: `1px solid ${theme.colors.border.default}40`,
          }}
        >
          {menu.type === "store" ? "Price" : "Sell"}: {formatPrice(menu.price)}{" "}
          gp
        </div>
        {showCustomInput ? (
          <div style={{ padding: theme.spacing.sm }}>
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
              style={{
                width: "100%",
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                fontSize: theme.typography.fontSize.sm,
                ...getPanelInsetStyle(theme, {
                  emphasis: "normal",
                  radius: theme.borderRadius.sm,
                }),
                color: theme.colors.text.primary,
                outline: "none",
              }}
              placeholder={`1-${maxQuantity}`}
            />
            <div
              style={{
                display: "flex",
                gap: theme.spacing.xs,
                marginTop: theme.spacing.xs,
              }}
            >
              <button
                onClick={handleCustomSubmit}
                style={{
                  flex: 1,
                  padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                  fontSize: theme.typography.fontSize.xs,
                  ...getInteractiveTileStyle(theme, {
                    active: true,
                    accentColor: theme.colors.state.success,
                    radius: theme.borderRadius.sm,
                  }),
                  color: theme.colors.text.primary,
                  cursor: "pointer",
                }}
              >
                OK
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                  fontSize: theme.typography.fontSize.xs,
                  ...getInteractiveTileStyle(theme, {
                    active: true,
                    accentColor: theme.colors.state.danger,
                    radius: theme.borderRadius.sm,
                  }),
                  color: theme.colors.text.primary,
                  cursor: "pointer",
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
              style={menuItemStyle(hoveredIndex === idx)}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
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
  storeName: _storeName, // Displayed by ModalWindow wrapper, kept for interface compatibility
  buybackRate,
  items,
  world,
  inventory,
  coins,
  npcEntityId: _npcEntityId,
  onClose: _onClose, // Handled by ModalWindow wrapper, kept for interface compatibility
}: StorePanelProps) {
  const theme = useThemeStore((s) => s.theme);

  // Cleanup: Remove any orphaned store windows from previous UI system
  // Store is now rendered as a modal, not a window
  useEffect(() => {
    const { windows, destroyWindow } = useWindowStore.getState();
    windows.forEach((win) => {
      const winIdLower = win.id.toLowerCase();
      const isStoreWindow =
        winIdLower.includes("store") ||
        winIdLower.includes("trade") ||
        winIdLower.includes("central") ||
        winIdLower.includes("general") ||
        win.tabs.some((tab) => {
          const content =
            typeof tab.content === "string" ? tab.content.toLowerCase() : "";
          const label = tab.label?.toLowerCase() || "";
          return (
            content.includes("store") ||
            content.includes("trade") ||
            content.includes("central") ||
            content.includes("general") ||
            label.includes("store") ||
            label.includes("trade") ||
            label.includes("central") ||
            label.includes("general")
          );
        });
      if (isStoreWindow) {
        destroyWindow(win.id);
      }
    });
  }, []);

  const { shouldUseMobileUI } = useMobileLayout();

  // Responsive sizing
  const responsiveSlotsPerRow = shouldUseMobileUI ? 6 : STORE_SLOTS_PER_ROW;
  const responsiveSlotSize = shouldUseMobileUI ? 40 : 50;

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
  const [hoveredStoreItemId, setHoveredStoreItemId] = useState<string | null>(
    null,
  );
  const [hoveredStoreTooltip, setHoveredStoreTooltip] = useState<{
    item: StoreItem;
    position: { x: number; y: number };
  } | null>(null);

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
    // Look up item value from manifest - this is the authoritative source
    // Server uses the same calculation: itemData.value * buybackRate
    const itemData = getItem(item.itemId);
    const baseValue = itemData?.value ?? 0;

    // Items without a value cannot be sold (matches server validation)
    if (baseValue <= 0) {
      // Don't show context menu for unsellable items
      return;
    }

    const sellPrice = Math.floor(baseValue * buybackRate);

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
    <>
      {/* Context menu rendered via portal */}
      <ContextMenu
        menu={contextMenu}
        onAction={handleContextMenuAction}
        onClose={closeContextMenu}
      />

      {/* Main content - responsive flex layout (column on mobile, row on desktop) */}
      <div
        className="flex gap-2"
        style={{
          flexDirection: shouldUseMobileUI ? "column" : "row",
          maxWidth: "100%",
          maxHeight: shouldUseMobileUI ? "80vh" : undefined,
          overflow: shouldUseMobileUI ? "auto" : undefined,
        }}
      >
        {/* Store Panel - Left Side (top on mobile) */}
        <div
          className="rounded-lg shadow-xl flex-1"
          style={{
            ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
            borderRadius: theme.borderRadius.xl,
            boxShadow: `${theme.shadows.xl}, inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -16px 24px rgba(0, 0, 0, 0.08)`,
            maxWidth: "100%",
          }}
        >
          {/* Store Items Grid */}
          <div
            className="p-2 overflow-y-auto overflow-x-hidden scrollbar-thick-brown"
            style={{
              maxHeight: shouldUseMobileUI
                ? `${4 * (responsiveSlotSize + 8)}px`
                : `${STORE_SCROLL_HEIGHT}px`,
              ...getPanelInsetStyle(theme, {
                emphasis: "strong",
                radius: theme.borderRadius.lg,
              }),
            }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${responsiveSlotsPerRow}, ${responsiveSlotSize}px)`,
                gap: shouldUseMobileUI ? "4px" : "8px",
              }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded flex flex-col items-center justify-center relative cursor-pointer transition-colors duration-150"
                  style={{
                    width: `${responsiveSlotSize}px`,
                    height: `${responsiveSlotSize}px`,
                    ...getInteractiveTileStyle(theme, {
                      hovered: hoveredStoreItemId === item.id,
                      radius: theme.borderRadius.md,
                      accentColor: theme.colors.accent.primary,
                    }),
                  }}
                  onClick={() => handleBuy(item.itemId, 1)}
                  onContextMenu={(e) => openStoreContextMenu(e, item)}
                  onMouseEnter={(e) => {
                    setHoveredStoreItemId(item.id);
                    setHoveredStoreTooltip({
                      item,
                      position: { x: e.clientX, y: e.clientY },
                    });
                  }}
                  onMouseMove={(e) => {
                    setHoveredStoreTooltip((prev) =>
                      prev?.item.id === item.id
                        ? {
                            item,
                            position: { x: e.clientX, y: e.clientY },
                          }
                        : prev,
                    );
                  }}
                  onMouseLeave={() => {
                    setHoveredStoreItemId((prev) =>
                      prev === item.id ? null : prev,
                    );
                    setHoveredStoreTooltip((prev) =>
                      prev?.item.id === item.id ? null : prev,
                    );
                  }}
                >
                  <span className="select-none">
                    <ItemIcon itemId={item.itemId} size={44} />
                  </span>
                  {/* Price */}
                  <span
                    className="absolute bottom-0 right-0.5 text-[9px] font-bold"
                    style={{
                      color: theme.colors.accent.gold,
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
                        color:
                          item.stockQuantity === 0
                            ? theme.colors.state.danger
                            : theme.colors.text.primary,
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

          {hoveredStoreTooltip && !contextMenu.visible && (
            <CursorTooltip
              visible={true}
              position={hoveredStoreTooltip.position}
              estimatedSize={{ width: 220, height: 70 }}
              style={{
                zIndex: theme.zIndex.tooltip,
                minWidth: "180px",
                maxWidth: "260px",
              }}
            >
              <div
                style={{
                  ...getTooltipTitleStyle(theme),
                }}
              >
                {hoveredStoreTooltip.item.name}
              </div>
              <div
                style={{
                  ...getTooltipMetaStyle(theme),
                  marginTop: "4px",
                }}
              >
                {hoveredStoreTooltip.item.price} gp
                {hoveredStoreTooltip.item.stockQuantity !== -1
                  ? ` • ${hoveredStoreTooltip.item.stockQuantity} in stock`
                  : " • Unlimited stock"}
              </div>
            </CursorTooltip>
          )}

          {/* Footer */}
          <div
            className="px-4 py-2 rounded-b-lg"
            style={{
              ...getPanelHeaderStyle(theme),
              borderTop: `1px solid ${theme.colors.border.default}40`,
              borderBottom: "none",
            }}
          >
            <div
              className="flex justify-between items-center text-xs"
              style={{ color: theme.colors.text.secondary }}
            >
              <span>Sells at {Math.floor(buybackRate * 100)}% value</span>
              <span>Left: Buy 1 | Right: Options</span>
            </div>
          </div>
        </div>

        {/* Inventory Panel - Right Side (bottom on mobile) */}
        <div
          className="rounded-lg shadow-xl overflow-hidden"
          style={{
            ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
            borderRadius: theme.borderRadius.xl,
            boxShadow: `${theme.shadows.xl}, inset 0 2px 4px rgba(255, 255, 255, 0.05)`,
            width: shouldUseMobileUI ? "100%" : "200px",
            minWidth: shouldUseMobileUI ? undefined : "180px",
          }}
        >
          {/* Header */}
          <div
            className="flex justify-between items-center px-3 py-1.5"
            style={{
              ...getPanelHeaderStyle(theme),
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

          {/* Modern Inventory Panel in store mode */}
          <div style={{ height: shouldUseMobileUI ? "220px" : "350px" }}>
            <InventoryPanel
              items={inventory}
              coins={coins}
              embeddedMode="store"
              onEmbeddedClick={(item) => handleSell(item.itemId, 1)}
              onEmbeddedContextMenu={(e, item) =>
                openInventoryContextMenu(e, item)
              }
              showCoinPouch={true}
              footerHint="Left: Sell 1 | Right: Options"
            />
          </div>
        </div>
      </div>
    </>
  );
}
