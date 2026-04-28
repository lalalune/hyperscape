/**
 * Trade Panel - OSRS Style
 *
 * Main trading interface showing both players' offers side-by-side.
 * Uses OSRS-style click-based item management with right-click context menus.
 *
 * Layout:
 * - Left side: Local player's offer
 * - Center: Partner's offer
 * - Right side: Inventory (on offer screen)
 * - Bottom: Accept/Cancel buttons
 *
 * Features:
 * - Left-click inventory item: add 1 to trade
 * - Right-click inventory item: context menu (Offer, Offer-5, Offer-10, Offer-X, Offer-All, Value, Examine)
 * - Click items in trade offer to remove
 * - Red flashing exclamation when items removed (anti-scam)
 * - Both players must accept for trade to complete
 * - Two-screen confirmation flow
 */

import { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useThemeStore } from "@/ui";
import {
  getInteractiveTileStyle,
  getPanelHeaderStyle,
  getPanelInsetStyle,
  getPanelSurfaceStyle,
  getShellControlButtonStyle,
} from "@/ui/theme/themes";
import type { TradeOfferItem } from "@hyperscape/shared";
import { UI } from "@/ui/core";

// Import from split modules
import type {
  TradePanelProps,
  ContextMenuState,
  QuantityPromptState,
} from "./types";
import { TRADE_GRID_COLS, TRADE_SLOTS } from "./constants";
import { formatGoldValue } from "../../systems/currency";
import { getWealthDifferenceColor } from "./utils";
import { TradeSlot, InventoryMiniPanel } from "./components";
import { TradeContextMenu, QuantityPrompt } from "./modals";
import { useRemovedItemTracking } from "./hooks";

// ============================================================================
// Main Component
// ============================================================================

export function TradePanel({
  state,
  inventory,
  onAddItem,
  onRemoveItem,
  onAccept,
  onCancel,
  onExamineItem,
  onValueItem,
}: TradePanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const closeButtonStyle = getShellControlButtonStyle(theme, "danger");

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  // Quantity prompt state
  const [quantityPrompt, setQuantityPrompt] =
    useState<QuantityPromptState>(null);

  // Track removed items for anti-scam feature
  const { myRemovedSlots, theirRemovedSlots, hasRecentRemovals } =
    useRemovedItemTracking(state.myOffer, state.theirOffer);

  // Get set of inventory slots already offered
  const offeredSlots = useMemo(() => {
    return new Set(state.myOffer.map((item) => item.inventorySlot));
  }, [state.myOffer]);

  // Handle left-click on inventory item (add 1)
  const handleInventoryLeftClick = useCallback(
    (item: { slot: number; itemId: string; quantity: number }) => {
      onAddItem(item.slot, 1);
    },
    [onAddItem],
  );

  // Handle right-click on inventory item (show context menu)
  const handleInventoryRightClick = useCallback(
    (
      e: React.MouseEvent,
      item: { slot: number; itemId: string; quantity: number },
    ) => {
      setContextMenu({ x: e.clientX, y: e.clientY, item });
    },
    [],
  );

  // Handle context menu option selection
  const handleContextMenuOffer = useCallback(
    (quantity: number | "x" | "all" | "value" | "examine") => {
      if (!contextMenu) return;
      const item = contextMenu.item;

      if (quantity === "x") {
        // Show quantity prompt
        setQuantityPrompt({ item });
      } else if (quantity === "all") {
        onAddItem(item.slot, item.quantity);
      } else if (quantity === "value") {
        // Use callback if provided, otherwise fallback behavior
        if (onValueItem) {
          onValueItem(item.itemId);
        }
      } else if (quantity === "examine") {
        // Use callback if provided, otherwise fallback behavior
        if (onExamineItem) {
          onExamineItem(item.itemId);
        }
      } else {
        // Numeric quantity
        const qty = Math.min(quantity, item.quantity);
        onAddItem(item.slot, qty);
      }
    },
    [contextMenu, onAddItem, onExamineItem, onValueItem],
  );

  // Handle quantity prompt confirm
  const handleQuantityConfirm = useCallback(
    (quantity: number) => {
      if (!quantityPrompt) return;
      onAddItem(quantityPrompt.item.slot, quantity);
      setQuantityPrompt(null);
    },
    [quantityPrompt, onAddItem],
  );

  // Handle accept with warning if items were removed
  const handleAcceptWithWarning = useCallback(() => {
    onAccept();
  }, [onAccept]);

  if (!state.isOpen || !state.partner) return null;

  // Convert offers to slot-indexed arrays for rendering
  const myOfferBySlot = new Map<number, TradeOfferItem>();
  for (const item of state.myOffer) {
    myOfferBySlot.set(item.tradeSlot, item);
  }

  const theirOfferBySlot = new Map<number, TradeOfferItem>();
  for (const item of state.theirOffer) {
    theirOfferBySlot.set(item.tradeSlot, item);
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: theme.colors.background.overlay,
        zIndex: UI.Z_INDEX.MODAL,
      }}
    >
      {/* CSS Animation for pulse effect */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Context Menu */}
      {contextMenu && (
        <TradeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          theme={theme}
          onOffer={handleContextMenuOffer}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Quantity Prompt */}
      {quantityPrompt && (
        <QuantityPrompt
          item={quantityPrompt.item}
          theme={theme}
          onConfirm={handleQuantityConfirm}
          onCancel={() => setQuantityPrompt(null)}
        />
      )}

      <div
        className="rounded-lg shadow-xl"
        style={{
          ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
          borderRadius: theme.borderRadius.xl,
          // OSRS layout: wider to fit inventory on right side
          width: state.screen === "offer" ? "680px" : "480px",
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 rounded-t-lg flex items-center justify-between"
          style={{
            ...getPanelHeaderStyle(theme),
          }}
        >
          <h2
            className="text-lg font-bold"
            style={{ color: theme.colors.text.accent }}
          >
            {state.screen === "confirm" ? (
              <>
                <span style={{ color: theme.colors.state.warning }}>
                  Confirm Trade
                </span>
                {" with "}
                <span style={{ color: theme.colors.text.primary }}>
                  {state.partner.name}
                </span>
              </>
            ) : (
              <>
                Trading with{" "}
                <span style={{ color: theme.colors.text.primary }}>
                  {state.partner.name}
                </span>
              </>
            )}
          </h2>
          <button
            onClick={onCancel}
            className="text-xl font-bold px-2 rounded transition-colors"
            style={{ ...closeButtonStyle, width: 28, height: 28, fontSize: 18 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = String(
                closeButtonStyle["--shell-button-hover-bg"],
              );
              e.currentTarget.style.color = String(
                closeButtonStyle["--shell-button-hover-fg"],
              );
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = String(
                closeButtonStyle.background,
              );
              e.currentTarget.style.color = String(closeButtonStyle.color);
            }}
          >
            ×
          </button>
        </div>

        {/* Trade areas - OSRS layout: offers on left, inventory on right */}
        <div className="p-4">
          <div className="flex gap-4">
            {/* Left section: Trade offers */}
            <div className="flex-1">
              <div className="flex gap-4">
                {/* My offer */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div
                        className="text-[10px] uppercase tracking-[0.14em] mb-1"
                        style={{ color: theme.colors.text.muted }}
                      >
                        Contract Tray
                      </div>
                      <h3
                        className="text-sm font-bold"
                        style={{ color: theme.colors.text.accent }}
                      >
                        Your Offer
                      </h3>
                    </div>
                    {state.myAccepted && (
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: `${theme.colors.state.success}30`,
                          color: theme.colors.state.success,
                          border: `1px solid ${theme.colors.state.success}50`,
                        }}
                      >
                        Accepted
                      </span>
                    )}
                  </div>
                  <div
                    className="grid gap-1 p-2 rounded"
                    style={{
                      gridTemplateColumns: `repeat(${TRADE_GRID_COLS}, 36px)`,
                      ...getPanelInsetStyle(theme, {
                        emphasis: "strong",
                        radius: theme.borderRadius.md,
                      }),
                    }}
                  >
                    {Array.from({ length: TRADE_SLOTS }).map((_, i) => (
                      <TradeSlot
                        key={i}
                        item={myOfferBySlot.get(i) || null}
                        slotIndex={i}
                        side="my"
                        onRemove={
                          state.screen === "offer"
                            ? () => onRemoveItem(i)
                            : undefined
                        }
                        theme={theme}
                        isRemoved={myRemovedSlots.has(i)}
                      />
                    ))}
                  </div>
                  {/* Wealth indicator for my offer */}
                  <div
                    className="mt-2 px-2 py-1 rounded text-xs text-center"
                    style={{
                      ...getPanelInsetStyle(theme, {
                        emphasis: "strong",
                        radius: theme.borderRadius.md,
                      }),
                      color: theme.colors.text.secondary,
                    }}
                  >
                    Value:{" "}
                    <span
                      style={{
                        color: theme.colors.accent.gold,
                        fontWeight: "bold",
                      }}
                    >
                      {formatGoldValue(state.myOfferValue)} gp
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div
                  className="w-px"
                  style={{ background: theme.colors.border.default }}
                />

                {/* Their offer */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div
                        className="text-[10px] uppercase tracking-[0.14em] mb-1"
                        style={{ color: theme.colors.text.muted }}
                      >
                        Counterparty Tray
                      </div>
                      <h3
                        className="text-sm font-bold"
                        style={{ color: theme.colors.text.accent }}
                      >
                        {state.partner.name}'s Offer
                      </h3>
                    </div>
                    {state.theirAccepted && (
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: `${theme.colors.state.success}30`,
                          color: theme.colors.state.success,
                          border: `1px solid ${theme.colors.state.success}50`,
                        }}
                      >
                        Accepted
                      </span>
                    )}
                  </div>
                  <div
                    className="grid gap-1 p-2 rounded"
                    style={{
                      gridTemplateColumns: `repeat(${TRADE_GRID_COLS}, 36px)`,
                      ...getPanelInsetStyle(theme, {
                        emphasis: "strong",
                        radius: theme.borderRadius.md,
                      }),
                    }}
                  >
                    {Array.from({ length: TRADE_SLOTS }).map((_, i) => (
                      <TradeSlot
                        key={i}
                        item={theirOfferBySlot.get(i) || null}
                        slotIndex={i}
                        side="their"
                        theme={theme}
                        isRemoved={theirRemovedSlots.has(i)}
                      />
                    ))}
                  </div>
                  {/* Wealth indicator for their offer */}
                  <div
                    className="mt-2 px-2 py-1 rounded text-xs text-center"
                    style={{
                      ...getPanelInsetStyle(theme, {
                        emphasis: "strong",
                        radius: theme.borderRadius.md,
                      }),
                      color: theme.colors.text.secondary,
                    }}
                  >
                    Value:{" "}
                    <span
                      style={{
                        color: theme.colors.accent.gold,
                        fontWeight: "bold",
                      }}
                    >
                      {formatGoldValue(state.theirOfferValue)} gp
                    </span>
                  </div>
                </div>
              </div>

              {/* Trade status bar - OSRS style: free slots + wealth transfer */}
              <div
                className="mt-3 px-3 py-2 rounded text-sm flex items-center justify-between"
                style={{
                  ...getPanelInsetStyle(theme, {
                    emphasis: "strong",
                    radius: theme.borderRadius.md,
                  }),
                }}
              >
                {/* Partner free slots indicator (OSRS-style) */}
                <span style={{ color: theme.colors.text.secondary }}>
                  <span
                    className="mr-2 uppercase tracking-[0.14em] text-[10px]"
                    style={{ color: theme.colors.text.muted }}
                  >
                    Capacity
                  </span>
                  Partner's free slots:{" "}
                  <span
                    style={{
                      color:
                        state.partnerFreeSlots > 0
                          ? theme.colors.state.success
                          : theme.colors.state.danger,
                      fontWeight: "bold",
                    }}
                  >
                    {state.partnerFreeSlots}
                  </span>
                </span>

                {/* Wealth transfer indicator */}
                {(state.myOfferValue > 0 || state.theirOfferValue > 0) && (
                  <span>
                    <span style={{ color: theme.colors.text.secondary }}>
                      Wealth:{" "}
                    </span>
                    <span
                      style={{
                        color: getWealthDifferenceColor(
                          state.myOfferValue,
                          state.theirOfferValue,
                        ),
                        fontWeight: "bold",
                      }}
                    >
                      {state.theirOfferValue >= state.myOfferValue ? "+" : ""}
                      {formatGoldValue(
                        state.theirOfferValue - state.myOfferValue,
                      )}{" "}
                      gp
                    </span>
                    {Math.abs(state.theirOfferValue - state.myOfferValue) >
                      Math.max(state.myOfferValue, state.theirOfferValue) *
                        0.5 &&
                      state.myOfferValue > 0 && (
                        <span
                          className="ml-1"
                          style={{ color: theme.colors.state.warning }}
                        >
                          ⚠️
                        </span>
                      )}
                  </span>
                )}
              </div>
            </div>

            {/* Right section: Inventory (OSRS style - only on offer screen) */}
            {state.screen === "offer" && (
              <>
                {/* Divider between offers and inventory */}
                <div
                  className="w-px"
                  style={{ background: theme.colors.border.default }}
                />
                <InventoryMiniPanel
                  items={inventory}
                  offeredSlots={offeredSlots}
                  theme={theme}
                  onItemLeftClick={handleInventoryLeftClick}
                  onItemRightClick={handleInventoryRightClick}
                />
              </>
            )}
          </div>

          {/* Confirmation screen message */}
          {state.screen === "confirm" && (
            <div
              className="mt-3 px-3 py-2 rounded text-sm text-center"
              style={{
                ...getPanelInsetStyle(theme, {
                  emphasis: "strong",
                  radius: theme.borderRadius.md,
                }),
                color: theme.colors.state.warning,
              }}
            >
              ⚠️ Please review the trade carefully before accepting
            </div>
          )}

          {/* Warning if items were removed */}
          {hasRecentRemovals && (
            <div
              className="mt-3 px-3 py-2 rounded text-sm text-center"
              style={{
                ...getPanelInsetStyle(theme, {
                  emphasis: "strong",
                  radius: theme.borderRadius.md,
                }),
                color: theme.colors.state.danger,
              }}
            >
              ⚠️ Items have been removed from the trade!
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAcceptWithWarning}
              disabled={state.myAccepted}
              className="flex-1 py-2.5 rounded text-sm font-bold transition-all"
              style={{
                ...getInteractiveTileStyle(theme, {
                  active: !state.myAccepted,
                  disabled: state.myAccepted,
                  accentColor: theme.colors.state.success,
                  radius: theme.borderRadius.md,
                }),
                color: theme.colors.text.primary,
                textShadow: "0 1px 2px rgba(0,0,0,0.35)",
                opacity: state.myAccepted ? 0.7 : 1,
                cursor: state.myAccepted ? "default" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!state.myAccepted) {
                  e.currentTarget.style.background = `linear-gradient(180deg, rgba(245, 252, 246, 0.08) 0%, ${theme.colors.state.success}26 22%, rgba(20, 42, 24, 0.98) 100%)`;
                }
              }}
              onMouseLeave={(e) => {
                if (!state.myAccepted) {
                  e.currentTarget.style.background = `linear-gradient(180deg, rgba(245, 252, 246, 0.06) 0%, ${theme.colors.state.success}1c 20%, rgba(22, 36, 25, 0.98) 100%)`;
                }
              }}
            >
              {state.myAccepted
                ? "Waiting for partner..."
                : state.screen === "confirm"
                  ? "Confirm Trade"
                  : "Accept Trade"}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded text-sm font-bold transition-all"
              style={{
                ...getInteractiveTileStyle(theme, {
                  active: true,
                  accentColor: theme.colors.state.danger,
                  radius: theme.borderRadius.md,
                }),
                color: theme.colors.text.primary,
                textShadow: "0 1px 2px rgba(0,0,0,0.35)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `linear-gradient(180deg, rgba(255, 246, 246, 0.08) 0%, ${theme.colors.state.danger}24 22%, rgba(53, 24, 24, 0.98) 100%)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `linear-gradient(180deg, rgba(255, 246, 246, 0.06) 0%, ${theme.colors.state.danger}1a 20%, rgba(40, 24, 24, 0.98) 100%)`;
              }}
            >
              Cancel
            </button>
          </div>

          {/* Status message */}
          {state.myAccepted && state.theirAccepted && (
            <p
              className="text-center text-sm mt-3"
              style={{ color: theme.colors.state.success }}
            >
              Both players accepted - completing trade...
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
