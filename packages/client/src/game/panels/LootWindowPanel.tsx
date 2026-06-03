import React, { useState, useEffect, useRef, useCallback } from "react";
import type { World } from "@hyperforge/shared";
import type {
  InventoryItem,
  PendingLootTransaction,
  LootResult,
} from "@hyperforge/shared";
import { EventType, generateTransactionId, getItem } from "@hyperforge/shared";
import { ErrorBoundary } from "../../lib/ErrorBoundary";
import { CursorTooltip, useThemeStore } from "@/ui";
import {
  getTooltipMetaStyle,
  getTooltipTitleStyle,
} from "@/ui/core/tooltip/tooltipStyles";
import {
  getInteractiveTileStyle,
  getPanelHeaderStyle,
  getPanelSurfaceStyle,
  getShellControlButtonStyle,
} from "@/ui/theme/themes";
import { UI } from "@/ui/core";

// Timeout for pending loot transactions (3 seconds for better UX)
const LOOT_TRANSACTION_TIMEOUT_MS = 3000;

interface LootWindowPanelProps {
  visible: boolean;
  corpseId: string;
  corpseName: string;
  lootItems: InventoryItem[];
  onClose: () => void;
  world: World;
}

/**
 * Internal LootWindowPanel component (wrapped with ErrorBoundary below)
 */
function LootWindowPanelContent({
  visible,
  corpseId,
  corpseName,
  lootItems,
  onClose,
  world,
}: LootWindowPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const closeButtonStyle = getShellControlButtonStyle(theme, "neutral");
  const [items, setItems] = useState<InventoryItem[]>(lootItems);
  const [hoveredItem, setHoveredItem] = useState<{
    item: InventoryItem;
    displayName: string;
    itemType: string;
    position: { x: number; y: number };
  } | null>(null);

  // Close confirmation state
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Shadow state - track pending loot transactions for rollback
  const [_pendingTransactions, setPendingTransactions] = useState<
    Map<string, PendingLootTransaction>
  >(new Map());
  const pendingItemIds = useRef<Set<string>>(new Set());
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Update items when prop changes
  useEffect(() => {
    setItems(lootItems);
  }, [lootItems, corpseId]);

  // Rollback a failed/timed-out transaction
  const rollbackTransaction = useCallback((transactionId: string) => {
    setPendingTransactions((prev) => {
      const transaction = prev.get(transactionId);
      if (!transaction) return prev;

      // Unblock this itemId for future clicks
      pendingItemIds.current.delete(transaction.itemId);

      // Restore the item to its original position
      setItems((currentItems) => {
        const newItems = [...currentItems];
        // Insert at original index or at end if out of bounds
        const insertIndex = Math.min(
          transaction.originalIndex,
          newItems.length,
        );
        newItems.splice(insertIndex, 0, transaction.originalItem);
        return newItems;
      });

      // Remove from pending
      const newPending = new Map(prev);
      newPending.delete(transactionId);
      return newPending;
    });

    // Clear any existing timeout
    const existingTimeout = timeoutRefs.current.get(transactionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      timeoutRefs.current.delete(transactionId);
    }
  }, []);

  // Handle loot result events from server
  useEffect(() => {
    if (!world.network) return;

    const handleLootResult = (result: LootResult) => {
      const { transactionId, success, reason } = result;

      // Clear timeout for this transaction (handles both single and batch)
      const existingTimeout = timeoutRefs.current.get(transactionId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutRefs.current.delete(transactionId);
      }

      if (success) {
        // Transaction confirmed - remove from pending (item already removed from UI)
        setPendingTransactions((prev) => {
          const newPending = new Map(prev);
          // Unblock itemId and remove the exact transaction ID
          const txn = prev.get(transactionId);
          if (txn) pendingItemIds.current.delete(txn.itemId);
          newPending.delete(transactionId);
          // Also clear any batch-related transactions (e.g., "txn123_0", "txn123_1", etc.)
          // This handles the "loot all" case where we track items as "${batchId}_${index}"
          for (const key of prev.keys()) {
            if (key.startsWith(`${transactionId}_`)) {
              const batchTxn = prev.get(key);
              if (batchTxn) pendingItemIds.current.delete(batchTxn.itemId);
              newPending.delete(key);
            }
          }
          return newPending;
        });
      } else {
        // Transaction failed - rollback
        console.warn(`[LootWindow] Loot failed: ${transactionId} - ${reason}`);

        // For batch operations, rollback all related transactions
        setPendingTransactions((prev) => {
          const batchKeys = Array.from(prev.keys()).filter(
            (key) =>
              key === transactionId || key.startsWith(`${transactionId}_`),
          );
          if (batchKeys.length > 0) {
            // Batch rollback
            batchKeys.forEach((key) => rollbackTransaction(key));
          } else {
            // Single item rollback
            rollbackTransaction(transactionId);
          }
          return prev;
        });

        // Show error toast if available
        if (reason) {
          const errorMessages: Record<string, string> = {
            ITEM_NOT_FOUND: "Item already looted by someone else",
            INVENTORY_FULL: "Your inventory is full",
            PROTECTED: "You cannot loot this yet",
            GRAVESTONE_GONE: "The gravestone has despawned",
            RATE_LIMITED: "Too many requests, slow down",
            INVALID_REQUEST: "Invalid loot request",
            PLAYER_DYING: "Cannot loot while dying",
          };
          world.emit(EventType.UI_TOAST, {
            message: errorMessages[reason] || "Failed to loot item",
            type: "error",
          });
        }
      }
    };

    // Listen for loot result events
    world.network.on("lootResult", handleLootResult);

    return () => {
      world.network?.off("lootResult", handleLootResult);
    };
  }, [world, rollbackTransaction]);

  // Cleanup timeouts and pending state on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current.clear();
      pendingItemIds.current.clear();
    };
  }, []);

  // Handle close with confirmation if items remain
  const handleCloseClick = useCallback(() => {
    if (items.length > 0) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  }, [items.length, onClose]);

  const handleConfirmClose = useCallback(() => {
    setShowCloseConfirm(false);
    onClose();
  }, [onClose]);

  const handleCancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  // Sync gravestone state with server using events + reduced polling fallback
  useEffect(() => {
    if (!visible || !corpseId) return;

    // Helper to check entity state and sync items
    const syncEntityState = (): boolean => {
      const gravestoneEntity = world.entities?.get(corpseId);

      // If gravestone entity no longer exists (despawned), close window
      if (!gravestoneEntity) {
        onClose();
        return false;
      }

      // Check if entity has lootItems in its data
      // Entity runtime data may include loot properties not in base type
      type EntityWithLoot = typeof gravestoneEntity & {
        data?: {
          lootItems?: InventoryItem[];
          lootItemCount?: number;
        };
        lootItems?: InventoryItem[];
      };
      const entityWithLoot = gravestoneEntity as EntityWithLoot;
      const entityData = entityWithLoot.data;
      if (entityData?.lootItems || entityWithLoot.lootItems) {
        const serverItems: InventoryItem[] =
          entityData?.lootItems || entityWithLoot.lootItems || [];

        // Only update if items actually changed
        setItems((prevItems) => {
          if (prevItems === serverItems) return prevItems;
          if (prevItems.length !== serverItems.length) return serverItems;
          for (let i = 0; i < prevItems.length; i++) {
            if (
              prevItems[i].itemId !== serverItems[i].itemId ||
              prevItems[i].quantity !== serverItems[i].quantity
            ) {
              return serverItems;
            }
          }
          return prevItems;
        });
      }

      // If gravestone is empty, close the window
      if (
        (entityWithLoot.lootItems?.length === 0 ||
          entityData?.lootItems?.length === 0 ||
          entityData?.lootItemCount === 0) &&
        items.length > 0
      ) {
        setTimeout(() => {
          onClose();
        }, 500);
        return false;
      }

      return true;
    };

    // Initial sync on mount
    if (!syncEntityState()) return;

    // Event handler for entity updates (includes gravestone state changes)
    const handleEntityUpdate = (data: { id?: string; entityId?: string }) => {
      const entityId = data.id || data.entityId;
      if (entityId === corpseId) {
        syncEntityState();
      }
    };

    // Event handler for gravestone expiration
    const handleHeadstoneExpired = (...args: unknown[]) => {
      const data = args[0] as { gravestoneId?: string };
      if (data.gravestoneId === corpseId) {
        onClose();
      }
    };

    // Subscribe to entity update events
    world.on(
      EventType.ENTITY_UPDATED,
      handleEntityUpdate as (...args: unknown[]) => void,
    );
    world.on(EventType.DEATH_HEADSTONE_EXPIRED, handleHeadstoneExpired);

    // Reduced polling as fallback (1s instead of 100ms = 10x less CPU)
    // This catches edge cases where events might be missed
    const fallbackInterval = setInterval(syncEntityState, 1000);

    return () => {
      world.off(
        EventType.ENTITY_UPDATED,
        handleEntityUpdate as (...args: unknown[]) => void,
      );
      world.off(EventType.DEATH_HEADSTONE_EXPIRED, handleHeadstoneExpired);
      clearInterval(fallbackInterval);
    };
  }, [visible, corpseId, world, items.length, onClose]);

  const handleTakeItem = (item: InventoryItem, index: number) => {
    const localPlayer = world.getPlayer();
    if (!localPlayer) return;

    // Double-click guard: block if this itemId already has a pending transaction
    if (pendingItemIds.current.has(item.itemId)) return;
    pendingItemIds.current.add(item.itemId);

    // Generate transaction ID for shadow state tracking
    const transactionId = generateTransactionId();

    // Track pending transaction for potential rollback
    const pendingTransaction: PendingLootTransaction = {
      transactionId,
      itemId: item.itemId,
      quantity: item.quantity,
      requestedAt: Date.now(),
      originalItem: { ...item },
      originalIndex: index,
    };

    setPendingTransactions((prev) => {
      const newPending = new Map(prev);
      newPending.set(transactionId, pendingTransaction);
      return newPending;
    });

    // Set timeout for transaction (auto-rollback if no response)
    const timeout = setTimeout(() => {
      console.warn(`[LootWindow] Transaction timed out: ${transactionId}`);
      rollbackTransaction(transactionId);
      world.emit(EventType.UI_TOAST, {
        message: "Loot request timed out",
        type: "error",
      });
    }, LOOT_TRANSACTION_TIMEOUT_MS);
    timeoutRefs.current.set(transactionId, timeout);

    // Send loot request to server with transaction ID
    if (world.network?.send) {
      world.network.send("entityEvent", {
        id: "world",
        event: EventType.CORPSE_LOOT_REQUEST,
        payload: {
          corpseId,
          playerId: localPlayer.id,
          itemId: item.itemId,
          quantity: item.quantity,
          slot: index,
          transactionId, // Include transaction ID for confirmation
        },
      });
    } else {
      world.emit(EventType.CORPSE_LOOT_REQUEST, {
        corpseId,
        playerId: localPlayer.id,
        itemId: item.itemId,
        quantity: item.quantity,
        slot: index,
        transactionId,
      });
    }

    // Optimistically remove item from UI (will rollback if server rejects)
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTakeAll = () => {
    const localPlayer = world.getPlayer();
    if (!localPlayer) return;
    if (items.length === 0) return;

    // Generate single transaction ID for the batch operation
    const transactionId = generateTransactionId();

    // Track all items as pending for potential rollback
    const itemsCopy = [...items];
    itemsCopy.forEach((item, index) => {
      const pendingTransaction: PendingLootTransaction = {
        transactionId: `${transactionId}_${index}`,
        itemId: item.itemId,
        quantity: item.quantity,
        requestedAt: Date.now(),
        originalItem: { ...item },
        originalIndex: index,
      };

      setPendingTransactions((prev) => {
        const newPending = new Map(prev);
        newPending.set(pendingTransaction.transactionId, pendingTransaction);
        return newPending;
      });
    });

    // Set single timeout for the batch operation
    const timeout = setTimeout(() => {
      console.warn(`[LootWindow] Loot all timed out: ${transactionId}`);
      // Rollback all items
      itemsCopy.forEach((_, index) => {
        rollbackTransaction(`${transactionId}_${index}`);
      });
      world.emit(EventType.UI_TOAST, {
        message: "Loot request timed out",
        type: "error",
      });
    }, LOOT_TRANSACTION_TIMEOUT_MS);
    timeoutRefs.current.set(transactionId, timeout);

    // Send single batch loot request
    if (world.network?.send) {
      world.network.send("entityEvent", {
        id: "world",
        event: EventType.CORPSE_LOOT_ALL_REQUEST,
        payload: {
          corpseId,
          playerId: localPlayer.id,
          transactionId,
        },
      });
    } else {
      world.emit(EventType.CORPSE_LOOT_ALL_REQUEST, {
        corpseId,
        playerId: localPlayer.id,
        transactionId,
      });
    }

    // Optimistically clear ALL items at once
    setItems([]);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
      style={{
        zIndex: UI.Z_INDEX.MODAL,
        width: "32rem",
        ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
        borderRadius: theme.borderRadius.xl,
        padding: "1.5rem",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="flex justify-between items-center mb-4"
        style={{
          ...getPanelHeaderStyle(theme),
          margin: "-1.5rem -1.5rem 1rem",
          padding: "0.75rem 1rem",
        }}
      >
        <h3
          className="m-0 text-lg font-bold"
          style={{ color: theme.colors.text.primary }}
        >
          {corpseName}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleTakeAll}
            className="border-none rounded text-white py-1.5 px-3 cursor-pointer text-sm transition-colors"
            style={{
              ...getInteractiveTileStyle(theme, {
                active: true,
                accentColor: theme.colors.state.success,
                radius: theme.borderRadius.md,
              }),
              color: theme.colors.text.primary,
            }}
            disabled={items.length === 0}
          >
            Take All
          </button>
          <button
            onClick={handleCloseClick}
            className="py-1.5 px-3 cursor-pointer text-sm transition-colors"
            style={closeButtonStyle}
          >
            Close
          </button>
        </div>
      </div>

      {/* Loot Items */}
      {items.length === 0 ? (
        <div
          className="text-center py-8"
          style={{ color: theme.colors.text.secondary }}
        >
          <p className="text-sm">This corpse has been looted</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {items.map((item, index) => {
            const itemData = getItem(item.itemId);
            const displayName = itemData?.name || item.itemId;
            const itemType = itemData?.type || "misc";

            return (
              <div
                key={`${item.id}-${index}`}
                className="rounded p-2 cursor-pointer transition-all"
                style={{
                  ...getInteractiveTileStyle(theme, {
                    radius: theme.borderRadius.md,
                    accentColor: theme.colors.accent.primary,
                  }),
                }}
                onClick={() => handleTakeItem(item, index)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${theme.colors.border.hover}80`;
                  setHoveredItem({
                    item,
                    displayName,
                    itemType,
                    position: { x: e.clientX, y: e.clientY },
                  });
                }}
                onMouseMove={(e) => {
                  setHoveredItem((prev) =>
                    prev?.item.id === item.id
                      ? {
                          item,
                          displayName,
                          itemType,
                          position: { x: e.clientX, y: e.clientY },
                        }
                      : prev,
                  );
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${theme.colors.border.default}30`;
                  setHoveredItem((prev) =>
                    prev?.item.id === item.id ? null : prev,
                  );
                }}
              >
                <div className="text-center">
                  <div
                    className="text-xs font-bold mb-1 truncate"
                    style={{ color: theme.colors.text.primary }}
                  >
                    {displayName.substring(0, 12)}
                  </div>
                  {item.quantity > 1 && (
                    <div
                      className="text-xs font-bold"
                      style={{ color: theme.colors.text.accent }}
                    >
                      ×{item.quantity}
                    </div>
                  )}
                  <div
                    className="text-[10px] mt-1 capitalize"
                    style={{ color: theme.colors.text.muted }}
                  >
                    {itemType}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hoveredItem && (
        <CursorTooltip
          visible={true}
          position={hoveredItem.position}
          estimatedSize={{ width: 220, height: 72 }}
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
            {hoveredItem.displayName}
            {hoveredItem.item.quantity > 1
              ? ` x${hoveredItem.item.quantity}`
              : ""}
          </div>
          <div
            style={{
              ...getTooltipMetaStyle(theme),
              marginTop: "4px",
              textTransform: "capitalize",
            }}
          >
            {hoveredItem.itemType} • Click to take
          </div>
        </CursorTooltip>
      )}

      {/* Instructions */}
      <div className="mt-4 pt-3 border-t border-white/10">
        <p
          className="text-xs text-center"
          style={{ color: theme.colors.text.secondary }}
        >
          Click an item to take it • Take All to loot everything
        </p>
      </div>

      {/* Close Confirmation Dialog */}
      {showCloseConfirm && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg z-10">
          <div
            className="rounded-lg p-4 max-w-xs text-center"
            style={{
              ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
              borderRadius: theme.borderRadius.lg,
            }}
          >
            <p
              className="font-bold mb-2"
              style={{ color: theme.colors.state.warning }}
            >
              Leave items behind?
            </p>
            <p
              className="text-sm mb-4"
              style={{ color: theme.colors.text.secondary }}
            >
              There are still {items.length} item{items.length > 1 ? "s" : ""}{" "}
              in this corpse. They may despawn if you leave them.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleConfirmClose}
                className="text-white px-4 py-2 rounded text-sm"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.state.danger}CC 0%, ${theme.colors.state.danger}AA 100%)`,
                }}
              >
                Leave Items
              </button>
              <button
                onClick={handleCancelClose}
                className="text-white px-4 py-2 rounded text-sm"
                style={{
                  background:
                    theme.name === "hyperia"
                      ? "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(0, 0, 0, 0.16) 100%)"
                      : theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border.default}40`,
                  color: theme.colors.text.primary,
                }}
              >
                Keep Looting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * LootWindow wrapped with ErrorBoundary for resilience
 *
 * If the loot window crashes due to data issues, this prevents
 * the entire game UI from failing. Shows a fallback with close button.
 */
export function LootWindowPanel(props: LootWindowPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const fallback = (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
      <div
        className="rounded-lg p-4 text-center max-w-sm"
        style={{
          ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
          border: `2px solid ${theme.colors.state.danger}`,
        }}
      >
        <p
          className="font-bold mb-2"
          style={{ color: theme.colors.state.danger }}
        >
          ⚠️ Loot Window Error
        </p>
        <p
          className="text-sm mb-4"
          style={{ color: theme.colors.text.secondary }}
        >
          Something went wrong displaying the loot. Your items are still safe.
        </p>
        <button
          onClick={props.onClose}
          className="text-white px-4 py-2 rounded text-sm"
          style={{
            background:
              theme.name === "hyperia"
                ? "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(0, 0, 0, 0.16) 100%)"
                : theme.colors.background.tertiary,
            border: `1px solid ${theme.colors.border.default}40`,
            color: theme.colors.text.primary,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback}>
      <LootWindowPanelContent {...props} />
    </ErrorBoundary>
  );
}
