/**
 * @fileoverview Player-to-Player Trading UI
 * @module hyperscape/client/components/PlayerTradeUI
 *
 * Complete P2P trading interface using server-side validation.
 *
 * Features:
 * - Trade request modal for incoming requests
 * - Trade window with drag-and-drop item selection
 * - Coin input for gold trading
 * - Real-time offer synchronization
 * - Confirmation system for both players
 * - Automatic cancellation on disconnect
 */

import React, { useState, useEffect, useCallback } from "react";
import { EventType, getItem } from "@hyperscape/shared";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

interface TradeOffer {
  items: Array<{
    itemId: string;
    quantity: number;
    slot: number;
    name: string;
  }>;
  coins: number;
}

interface TradeState {
  tradeId: string;
  isInitiator: boolean;
  otherPlayerId: string;
  otherPlayerName: string;
  yourOffer: TradeOffer;
  theirOffer: TradeOffer;
  yourConfirmed: boolean;
  theirConfirmed: boolean;
}

/**
 * Trade Request Modal - Shows incoming trade requests
 */
export function TradeRequestModal({
  world,
  onClose,
}: {
  world: {
    on: (event: string, handler: (data: unknown) => void) => void;
    off: (event: string, handler: (data: unknown) => void) => void;
    network?: { send: (method: string, data: unknown) => void };
  };
  onClose?: () => void;
}): React.ReactElement | null {
  const [request, setRequest] = useState<{
    tradeId: string;
    fromPlayerId: string;
    fromPlayerName: string;
  } | null>(null);

  useEffect(() => {
    const handler = (data: {
      tradeId: string;
      fromPlayerId: string;
      fromPlayerName: string;
    }) => {
      setRequest(data);
    };

    world.on(EventType.TRADE_REQUEST_RECEIVED, handler);
    return () => world.off(EventType.TRADE_REQUEST_RECEIVED, handler);
  }, [world]);

  const handleAccept = useCallback(() => {
    if (!request) return;

    if (!world?.network?.send) {
      console.error("[TradeRequestModal] Network not available");
      return;
    }

    (world.network.send as (method: string, data: unknown) => void)(
      "tradeResponse",
      {
        tradeId: request.tradeId,
        fromPlayerId: request.fromPlayerId,
        accepted: true,
      },
    );

    setRequest(null);
    if (onClose) onClose();
  }, [request, world, onClose]);

  const handleDecline = useCallback(() => {
    if (!request) return;

    if (!world?.network?.send) {
      console.error("[TradeRequestModal] Network not available");
      return;
    }

    (world.network.send as (method: string, data: unknown) => void)(
      "tradeResponse",
      {
        tradeId: request.tradeId,
        fromPlayerId: request.fromPlayerId,
        accepted: false,
      },
    );

    setRequest(null);
    if (onClose) onClose();
  }, [request, world, onClose]);

  if (!request) return null;

  return (
    <div
      className="fixed top-4 right-4 bg-gray-900 border-2 border-yellow-600 rounded-lg p-4 shadow-xl z-[9999] max-w-sm pointer-events-auto"
      data-testid="trade-request-modal"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start mb-3">
        <span className="text-3xl mr-3">🤝</span>
        <div>
          <h3 className="text-lg font-semibold text-yellow-400">
            Trade Request
          </h3>
          <p className="text-gray-300 text-sm">
            <strong>{request.fromPlayerName}</strong> wants to trade with you
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleAccept();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          data-testid="trade-accept-button"
          className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded transition pointer-events-auto"
        >
          Accept
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleDecline();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex-1 bg-red-900 hover:bg-red-800 text-red-200 font-semibold py-2 rounded transition pointer-events-auto"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

/**
 * Trade Window - Main trading interface
 */
// Helper to get item icon
function getItemIcon(itemId: string): string {
  if (
    itemId.includes("sword") ||
    itemId.includes("dagger") ||
    itemId.includes("scimitar")
  )
    return "⚔️";
  if (itemId.includes("shield") || itemId.includes("defender")) return "🛡️";
  if (
    itemId.includes("helmet") ||
    itemId.includes("helm") ||
    itemId.includes("hat")
  )
    return "⛑️";
  if (
    itemId.includes("body") ||
    itemId.includes("plate") ||
    itemId.includes("chainbody")
  )
    return "🦺";
  if (itemId.includes("legs") || itemId.includes("platelegs")) return "👖";
  if (itemId.includes("boots") || itemId.includes("boot")) return "👢";
  if (itemId.includes("bow")) return "🏹";
  if (itemId.includes("arrow") || itemId.includes("bolt")) return "➳";
  if (
    itemId.includes("fish") ||
    itemId.includes("lobster") ||
    itemId.includes("shark")
  )
    return "🐟";
  if (itemId.includes("log") || itemId.includes("wood")) return "🪵";
  if (itemId.includes("ore") || itemId.includes("bar")) return "⛏️";
  if (itemId.includes("hatchet") || itemId.includes("axe")) return "🪓";
  if (itemId.includes("tinderbox")) return "🔥";
  if (itemId.includes("rod")) return "🎣";
  return "📦";
}

// Draggable Inventory Item Component
function DraggableInventoryItem({
  item,
  onClick,
}: {
  item: {
    slot: number;
    itemId: string;
    quantity: number;
    item: { name: string };
  };
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `inv-${item.slot}`,
      data: { item },
    });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      style={style}
      className="bg-gray-700 p-2 rounded cursor-grab active:cursor-grabbing hover:bg-gray-600 transition text-center pointer-events-auto border border-gray-600"
      data-testid={`inventory-slot-${item.slot}`}
    >
      <div className="text-2xl mb-1">{getItemIcon(item.itemId)}</div>
      <div className="text-white text-xs truncate">{item.item.name}</div>
      <div className="text-gray-400 text-xs">x{item.quantity}</div>
    </div>
  );
}

// Droppable Trade Offer Area
function DroppableTradeOfferArea({
  items,
  onRemoveItem,
  disabled,
}: {
  items: Array<{
    itemId: string;
    quantity: number;
    slot: number;
    name: string;
  }>;
  onRemoveItem: (slot: number) => void;
  disabled: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: "trade-offer-area",
  });

  return (
    <div
      ref={setNodeRef}
      className="min-h-32 border-2 border-dashed border-yellow-600 rounded p-2 bg-gray-900"
    >
      {items.length === 0 ? (
        <div className="text-gray-500 text-center py-8 text-sm">
          {disabled
            ? "Your offer is locked"
            : "Drag items here or click items below"}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => {
            const itemDef = getItem(item.itemId);
            const estimatedValue = itemDef?.value || 0;

            return (
              <div
                key={idx}
                className="bg-gray-700 p-2 rounded flex items-center justify-between hover:bg-gray-600 transition"
                onContextMenu={(e) => {
                  if (disabled) return;
                  e.preventDefault();
                  e.stopPropagation();

                  const evt = new CustomEvent("contextmenu", {
                    detail: {
                      target: {
                        id: `trade_offer_${idx}`,
                        type: "trade_item",
                        name: item.name,
                      },
                      mousePosition: { x: e.clientX, y: e.clientY },
                      items: [
                        {
                          id: "remove",
                          label: `Remove ${item.name}`,
                          enabled: true,
                        },
                        { id: "examine", label: "Examine", enabled: true },
                      ],
                    },
                  });
                  window.dispatchEvent(evt);

                  // Handle selection
                  const onSelect = (selectEvt: Event) => {
                    const ce = selectEvt as CustomEvent<{
                      actionId: string;
                      targetId: string;
                    }>;
                    if (ce.detail?.targetId === `trade_offer_${idx}`) {
                      if (ce.detail.actionId === "remove") {
                        onRemoveItem(item.slot);
                      }
                      window.removeEventListener(
                        "contextmenu:select",
                        onSelect as EventListener,
                      );
                    }
                  };
                  window.addEventListener(
                    "contextmenu:select",
                    onSelect as EventListener,
                    { once: true },
                  );
                }}
                title={itemDef?.description || item.name}
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xl">{getItemIcon(item.itemId)}</span>
                  <div className="flex flex-col">
                    <span className="text-white text-sm">
                      {item.name} x{item.quantity}
                    </span>
                    {estimatedValue > 0 && (
                      <span className="text-xs text-gray-400">
                        ~{(estimatedValue * item.quantity).toLocaleString()} gp
                      </span>
                    )}
                  </div>
                </div>
                {!disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onRemoveItem(item.slot);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="text-red-400 hover:text-red-300 pointer-events-auto transition text-lg"
                    title="Remove from trade"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TradeWindow({
  world,
}: {
  world: {
    entities?: { player?: { id: string } };
    network?: {
      send: (method: string, data: unknown) => void;
      id?: string;
      socket?: { player?: { id: string } };
      lastInventoryByPlayerId?: Record<string, unknown>;
    };
    emit: (event: string, data: unknown) => void;
    on: (event: string, handler: (data: unknown) => void) => void;
    off: (event: string, handler: (data: unknown) => void) => void;
  };
}): React.ReactElement | null {
  const [tradeState, setTradeState] = useState<TradeState | null>(null);
  const [inventory, setInventory] = useState<
    Array<{
      slot: number;
      itemId: string;
      quantity: number;
      item: { name: string };
    }>
  >([]);
  const [coins, setCoins] = useState<number>(0);
  const [offerCoins, setOfferCoins] = useState<string>("0");
  const [draggedItem, setDraggedItem] = useState<{
    slot: number;
    itemId: string;
    quantity: number;
    item: { name: string };
  } | null>(null);

  // Helper to enrich trade offer items with names from item registry
  const enrichOfferWithNames = useCallback(
    (offer: {
      items: Array<{
        itemId: string;
        quantity: number;
        slot: number;
        name?: string;
      }>;
      coins: number;
    }): TradeOffer => {
      return {
        items: offer.items.map((item) => {
          // If name already provided, use it
          if (item.name)
            return item as {
              itemId: string;
              quantity: number;
              slot: number;
              name: string;
            };

          // Otherwise look up from item registry
          const itemDef = getItem(item.itemId);
          return {
            itemId: item.itemId,
            quantity: item.quantity,
            slot: item.slot,
            name: itemDef?.name || item.itemId,
          };
        }),
        coins: offer.coins,
      };
    },
    [],
  );

  // Define all handler callbacks first (before useEffect hooks that use them)
  const handleAddItem = useCallback(
    (item: {
      slot: number;
      itemId: string;
      quantity: number;
      item: { name: string };
    }) => {
      if (!tradeState) return;

      if (!world?.network?.send) {
        console.error("[TradeWindow] Network not available");
        return;
      }

      // Check if already in offer
      const alreadyInOffer = tradeState.yourOffer.items.some(
        (i) => i.slot === item.slot,
      );
      if (alreadyInOffer) {
        world.emit(EventType.UI_TOAST, {
          message: `${item.item.name} is already in your offer`,
          type: "warning",
        });
        return;
      }

      // Add to offer
      const newItems = [
        ...tradeState.yourOffer.items,
        {
          itemId: item.itemId,
          quantity: item.quantity,
          slot: item.slot,
          name: item.item.name,
        },
      ];

      // Send update to server
      (world.network.send as (method: string, data: unknown) => void)(
        "tradeOffer",
        {
          tradeId: tradeState.tradeId,
          items: newItems,
          coins: tradeState.yourOffer.coins,
        },
      );

      // Show feedback
      world.emit(EventType.UI_TOAST, {
        message: `Added ${item.item.name} x${item.quantity} to trade`,
        type: "info",
      });
    },
    [tradeState, world],
  );

  const handleRemoveItem = useCallback(
    (slot: number) => {
      if (!tradeState) return;

      if (!world?.network?.send) {
        console.error("[TradeWindow] Network not available");
        return;
      }

      const removedItem = tradeState.yourOffer.items.find(
        (i) => i.slot === slot,
      );
      const newItems = tradeState.yourOffer.items.filter(
        (i) => i.slot !== slot,
      );

      (world.network.send as (method: string, data: unknown) => void)(
        "tradeOffer",
        {
          tradeId: tradeState.tradeId,
          items: newItems,
          coins: tradeState.yourOffer.coins,
        },
      );

      // Show feedback
      if (removedItem) {
        world.emit(EventType.UI_TOAST, {
          message: `Removed ${removedItem.name} from trade`,
          type: "info",
        });
      }
    },
    [tradeState, world],
  );

  const handleUpdateCoins = useCallback(() => {
    if (!tradeState) return;

    if (!world?.network?.send) {
      console.error("[TradeWindow] Network not available");
      return;
    }

    const coinAmount = parseInt(offerCoins) || 0;
    if (coinAmount < 0) {
      world.emit(EventType.UI_TOAST, {
        message: "Gold amount cannot be negative",
        type: "error",
      });
      setOfferCoins("0");
      return;
    }

    if (coinAmount > coins) {
      world.emit(EventType.UI_TOAST, {
        message: `You only have ${coins} gold`,
        type: "error",
      });
      setOfferCoins(coins.toString());
      return;
    }

    (world.network.send as (method: string, data: unknown) => void)(
      "tradeOffer",
      {
        tradeId: tradeState.tradeId,
        items: tradeState.yourOffer.items,
        coins: coinAmount,
      },
    );

    // Show feedback if amount changed
    if (coinAmount !== tradeState.yourOffer.coins) {
      world.emit(EventType.UI_TOAST, {
        message:
          coinAmount > 0
            ? `Offering ${coinAmount} gold`
            : "Removed gold from offer",
        type: "info",
      });
    }
  }, [tradeState, world, offerCoins, coins]);

  const handleConfirm = useCallback(() => {
    if (!tradeState) return;

    if (!world?.network?.send) {
      console.error("[TradeWindow] Network not available");
      return;
    }

    (world.network.send as (method: string, data: unknown) => void)(
      "tradeConfirm",
      {
        tradeId: tradeState.tradeId,
      },
    );
  }, [tradeState, world]);

  const handleCancel = useCallback(() => {
    if (!tradeState) return;

    if (!world?.network?.send) {
      console.error("[TradeWindow] Network not available");
      return;
    }

    (world.network.send as (method: string, data: unknown) => void)(
      "tradeCancel",
      {
        tradeId: tradeState.tradeId,
      },
    );
  }, [tradeState, world]);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const itemData = event.active.data.current as
      | {
          item: {
            slot: number;
            itemId: string;
            quantity: number;
            item: { name: string };
          };
        }
      | undefined;
    if (itemData?.item) {
      setDraggedItem(itemData.item);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { over } = event;

      if (over && over.id === "trade-offer-area" && draggedItem) {
        handleAddItem(draggedItem);
      }

      setDraggedItem(null);
    },
    [draggedItem, handleAddItem],
  );

  // Listen for trade started
  useEffect(() => {
    const handleTradeStarted = (data: {
      tradeId: string;
      initiatorId: string;
      initiatorName: string;
      recipientId: string;
      recipientName: string;
    }) => {
      // Try multiple ways to get my player ID (different systems use different paths)
      const myPlayerId =
        world.network?.socket?.player?.id ||
        world.entities?.player?.id ||
        world.network?.id;

      const isInitiator = myPlayerId === data.initiatorId;
      const otherPlayerId = isInitiator ? data.recipientId : data.initiatorId;
      const otherPlayerName = isInitiator
        ? data.recipientName
        : data.initiatorName;

      setTradeState({
        tradeId: data.tradeId,
        isInitiator,
        otherPlayerId,
        otherPlayerName,
        yourOffer: { items: [], coins: 0 },
        theirOffer: { items: [], coins: 0 },
        yourConfirmed: false,
        theirConfirmed: false,
      });

      // Show trade started notification
      world.emit(EventType.UI_TOAST, {
        message: `Trade started with ${otherPlayerName}`,
        type: "info",
      });
    };

    world.on(EventType.TRADE_STARTED, handleTradeStarted);
    return () => world.off(EventType.TRADE_STARTED, handleTradeStarted);
  }, [world]);

  // ESC key to cancel trade
  useEffect(() => {
    if (!tradeState) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !tradeState.yourConfirmed) {
        handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tradeState, handleCancel]);

  // Listen for trade updates
  useEffect(() => {
    const handleTradeUpdated = (data: {
      tradeId: string;
      initiatorOffer: {
        items: Array<{
          itemId: string;
          quantity: number;
          slot: number;
          name?: string;
        }>;
        coins: number;
      };
      recipientOffer: {
        items: Array<{
          itemId: string;
          quantity: number;
          slot: number;
          name?: string;
        }>;
        coins: number;
      };
      initiatorConfirmed: boolean;
      recipientConfirmed: boolean;
    }) => {
      setTradeState((prev) => {
        if (!prev || prev.tradeId !== data.tradeId) return prev;

        // Enrich offers with item names
        const enrichedYourOffer = enrichOfferWithNames(
          prev.isInitiator ? data.initiatorOffer : data.recipientOffer,
        );
        const enrichedTheirOffer = enrichOfferWithNames(
          prev.isInitiator ? data.recipientOffer : data.initiatorOffer,
        );
        const newTheirConfirmed = prev.isInitiator
          ? data.recipientConfirmed
          : data.initiatorConfirmed;

        // Check if other player updated their offer
        const theirItemsChanged =
          JSON.stringify(prev.theirOffer.items) !==
          JSON.stringify(enrichedTheirOffer.items);
        const theirCoinsChanged =
          prev.theirOffer.coins !== enrichedTheirOffer.coins;

        if (theirItemsChanged || theirCoinsChanged) {
          const changes = [];
          if (theirItemsChanged) {
            const itemNames = enrichedTheirOffer.items
              .map((i) => `${i.name} x${i.quantity}`)
              .join(", ");
            changes.push(
              itemNames || `${enrichedTheirOffer.items.length} items`,
            );
          }
          if (theirCoinsChanged && enrichedTheirOffer.coins > 0)
            changes.push(`${enrichedTheirOffer.coins} gold`);

          if (changes.length > 0) {
            world.emit(EventType.UI_TOAST, {
              message: `${prev.otherPlayerName} updated: ${changes.join(", ")}`,
              type: "info",
            });
          }
        }

        // Check if other player confirmed
        if (!prev.theirConfirmed && newTheirConfirmed) {
          world.emit(EventType.UI_TOAST, {
            message: `${prev.otherPlayerName} confirmed the trade!`,
            type: "success",
          });
        }

        return {
          ...prev,
          yourOffer: enrichedYourOffer,
          theirOffer: enrichedTheirOffer,
          yourConfirmed: prev.isInitiator
            ? data.initiatorConfirmed
            : data.recipientConfirmed,
          theirConfirmed: newTheirConfirmed,
        };
      });
    };

    world.on(EventType.TRADE_UPDATED, handleTradeUpdated);
    return () => world.off(EventType.TRADE_UPDATED, handleTradeUpdated);
  }, [world, enrichOfferWithNames]);

  // Listen for trade completed/cancelled
  useEffect(() => {
    const handleTradeCompleted = () => {
      // Request fresh inventory from server
      const myPlayerId = world.entities?.player?.id;
      if (myPlayerId) {
        world.emit(EventType.INVENTORY_REQUEST, { playerId: myPlayerId });
      }

      setTimeout(() => setTradeState(null), 2000); // Keep open 2s to show success
    };

    const handleTradeCancelled = () => {
      setTradeState(null);
    };

    world.on(EventType.TRADE_COMPLETED, handleTradeCompleted);
    world.on(EventType.TRADE_CANCELLED, handleTradeCancelled);

    return () => {
      world.off(EventType.TRADE_COMPLETED, handleTradeCompleted);
      world.off(EventType.TRADE_CANCELLED, handleTradeCancelled);
    };
  }, [world]);

  // Load player inventory - use same pattern as InventoryPanel
  useEffect(() => {
    const handleInventoryUpdate = (raw: unknown) => {
      const data = raw as {
        playerId: string;
        items: Array<{
          slot: number;
          itemId: string;
          quantity: number;
          item?: { name: string };
        }>;
        coins: number;
      };

      const myPlayerId =
        world.network?.socket?.player?.id || world.entities?.player?.id;
      if (data.playerId === myPlayerId) {
        // Convert to full inventory slots with names
        const fullItems = data.items.map((item) => ({
          slot: item.slot,
          itemId: item.itemId,
          quantity: item.quantity,
          item: { name: item.item?.name || item.itemId },
        }));

        setInventory(fullItems);
        setCoins(data.coins);
      }
    };

    const handleCoinsUpdate = (raw: unknown) => {
      const data = raw as { playerId: string; coins: number };
      const myPlayerId =
        world.network?.socket?.player?.id || world.entities?.player?.id;
      if (data.playerId === myPlayerId) {
        setCoins(data.coins);
      }
    };

    world.on(EventType.INVENTORY_UPDATED, handleInventoryUpdate);
    world.on(EventType.INVENTORY_UPDATE_COINS, handleCoinsUpdate);

    // Request initial inventory if not cached
    const requestInitial = () => {
      const lp = world.entities?.player?.id;
      if (lp) {
        const cached = world.network?.lastInventoryByPlayerId?.[lp];
        if (cached && Array.isArray(cached.items)) {
          const fullItems = cached.items.map(
            (item: {
              slot: number;
              itemId: string;
              quantity: number;
              item?: { name?: string };
            }) => ({
              slot: item.slot,
              itemId: item.itemId,
              quantity: item.quantity,
              item: { name: item.item?.name || item.itemId },
            }),
          );
          setInventory(fullItems);
          setCoins(cached.coins);
        }
        world.emit(EventType.INVENTORY_REQUEST, { playerId: lp });
        return true;
      }
      return false;
    };

    let timeoutId: number | null = null;
    if (!requestInitial()) {
      timeoutId = window.setTimeout(() => requestInitial(), 400);
    }

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      world.off(EventType.INVENTORY_UPDATED, handleInventoryUpdate);
      world.off(EventType.INVENTORY_UPDATE_COINS, handleCoinsUpdate);
    };
  }, [world]);

  if (!tradeState) return null;

  const availableItems = inventory.filter(
    (item) =>
      !tradeState.yourOffer.items.some((offered) => offered.slot === item.slot),
  );

  // Calculate trade value estimates
  const yourOfferValue =
    tradeState.yourOffer.items.reduce((sum, item) => {
      const itemDef = getItem(item.itemId);
      return sum + (itemDef?.value || 0) * item.quantity;
    }, 0) + tradeState.yourOffer.coins;

  const theirOfferValue =
    tradeState.theirOffer.items.reduce((sum, item) => {
      const itemDef = getItem(item.itemId);
      return sum + (itemDef?.value || 0) * item.quantity;
    }, 0) + tradeState.theirOffer.coins;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9998] pointer-events-auto"
        data-testid="trade-window"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="bg-gray-900 border-2 border-yellow-600 rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-yellow-400">
                🤝 Trading with {tradeState.otherPlayerName}
              </h2>
              <div className="text-xs text-gray-400 mt-1">
                Trade ID: {tradeState.tradeId.slice(0, 8)}... | You are:{" "}
                {tradeState.isInitiator
                  ? "Initiator (sent request)"
                  : "Recipient (accepted request)"}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleCancel();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-gray-400 hover:text-white text-3xl font-bold leading-none pointer-events-auto"
            >
              ×
            </button>
          </div>

          {/* Confirmation Status */}
          <div className="mb-4 bg-gray-800 p-3 rounded">
            <div className="flex justify-between mb-2">
              <div
                className={`flex items-center gap-2 font-semibold ${tradeState.yourConfirmed ? "text-green-400" : "text-gray-400"}`}
              >
                {tradeState.yourConfirmed ? "✅" : "⭕"} You
                {tradeState.yourConfirmed && (
                  <span className="text-xs">(Confirmed)</span>
                )}
              </div>
              <div
                className={`flex items-center gap-2 font-semibold ${tradeState.theirConfirmed ? "text-green-400" : "text-gray-400"}`}
              >
                {tradeState.theirConfirmed ? "✅" : "⭕"}{" "}
                {tradeState.otherPlayerName}
                {tradeState.theirConfirmed && (
                  <span className="text-xs">(Confirmed)</span>
                )}
              </div>
            </div>
            {tradeState.yourConfirmed && tradeState.theirConfirmed && (
              <div className="text-center text-green-400 text-sm font-semibold animate-pulse">
                🎉 Executing trade...
              </div>
            )}
            {tradeState.yourConfirmed && !tradeState.theirConfirmed && (
              <div className="text-center text-yellow-400 text-sm">
                Waiting for {tradeState.otherPlayerName} to confirm...
              </div>
            )}
            {!tradeState.yourConfirmed && tradeState.theirConfirmed && (
              <div className="text-center text-yellow-400 text-sm">
                {tradeState.otherPlayerName} is waiting for you to confirm
              </div>
            )}
          </div>

          {/* Trade Offers */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Your Offer */}
            <div className="bg-gray-800 p-4 rounded border-4 border-green-500 shadow-lg shadow-green-500/50">
              <h3 className="text-2xl font-bold text-green-400 mb-4 text-center">
                ✅ YOUR OFFER
              </h3>

              {/* Items */}
              <div className="mb-4">
                <div className="text-sm font-semibold text-green-400 mb-2">
                  Items ({tradeState.yourOffer.items.length}):
                </div>
                <DroppableTradeOfferArea
                  items={tradeState.yourOffer.items}
                  onRemoveItem={handleRemoveItem}
                  disabled={tradeState.yourConfirmed}
                />
              </div>

              {/* Coins */}
              <div>
                <div className="text-sm text-gray-400 mb-2">Gold:</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={offerCoins}
                    onChange={(e) => setOfferCoins(e.target.value)}
                    onBlur={handleUpdateCoins}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleUpdateCoins();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={tradeState.yourConfirmed}
                    min="0"
                    max={coins}
                    placeholder="0"
                    data-testid="trade-coins-input"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white disabled:opacity-50 pointer-events-auto"
                  />
                  <span className="text-gray-400 self-center text-sm">
                    / {coins.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Offer Value Summary */}
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-xs text-gray-400 mb-1">
                  Estimated Value:
                </div>
                <div className="text-yellow-400 font-semibold">
                  {yourOfferValue.toLocaleString()} gp
                </div>
              </div>
            </div>

            {/* Their Offer */}
            <div className="bg-gray-800 p-4 rounded border-4 border-blue-500 shadow-lg shadow-blue-500/50">
              <h3 className="text-2xl font-bold text-blue-400 mb-4 text-center">
                👤 THEIR OFFER
              </h3>

              {/* Items */}
              <div className="mb-4">
                <div className="text-sm font-semibold text-blue-400 mb-2">
                  Items ({tradeState.theirOffer.items.length}):
                </div>
                <div className="min-h-32 border-2 border-gray-700 rounded p-2 bg-gray-900">
                  {tradeState.theirOffer.items.length === 0 ? (
                    <div className="text-gray-500 text-center py-8 text-sm">
                      Waiting for {tradeState.otherPlayerName}...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tradeState.theirOffer.items.map((item, idx) => {
                        const itemDef = getItem(item.itemId);
                        const estimatedValue = itemDef?.value || 0;

                        return (
                          <div
                            key={idx}
                            className="bg-gray-700 p-2 rounded flex items-center gap-2"
                          >
                            <span className="text-xl">
                              {getItemIcon(item.itemId)}
                            </span>
                            <div className="flex flex-col flex-1">
                              <span className="text-white text-sm">
                                {item.name || item.itemId} x{item.quantity}
                              </span>
                              {estimatedValue > 0 && (
                                <span className="text-xs text-gray-400">
                                  ~
                                  {(
                                    estimatedValue * item.quantity
                                  ).toLocaleString()}{" "}
                                  gp
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Coins */}
              <div>
                <div className="text-sm text-gray-400 mb-2">Gold:</div>
                <div className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-yellow-400 font-semibold">
                  {tradeState.theirOffer.coins.toLocaleString()} coins
                </div>
              </div>

              {/* Offer Value Summary */}
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-xs text-gray-400 mb-1">
                  Estimated Value:
                </div>
                <div className="text-yellow-400 font-semibold">
                  {theirOfferValue.toLocaleString()} gp
                </div>
              </div>
            </div>
          </div>

          {/* Trade Balance Indicator */}
          {(yourOfferValue > 0 || theirOfferValue > 0) && (
            <div className="mb-6 bg-gray-800 p-3 rounded text-center">
              <div className="text-sm text-gray-400 mb-1">Trade Balance:</div>
              <div className="flex items-center justify-center gap-3">
                <span className="text-green-400 font-semibold">
                  You: {yourOfferValue.toLocaleString()} gp
                </span>
                <span className="text-gray-500">⇄</span>
                <span className="text-blue-400 font-semibold">
                  Them: {theirOfferValue.toLocaleString()} gp
                </span>
              </div>
              {Math.abs(yourOfferValue - theirOfferValue) >
                yourOfferValue * 0.5 && (
                <div className="mt-2 text-xs text-yellow-400">
                  ⚠️ Unbalanced trade - make sure this is what you want
                </div>
              )}
            </div>
          )}

          {/* Available Inventory */}
          {!tradeState.yourConfirmed && (
            <div className="mb-6 bg-gray-800 p-4 rounded">
              <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center justify-between">
                <span>Your Inventory ({availableItems.length} items)</span>
                {draggedItem && (
                  <span className="text-xs text-yellow-400 animate-pulse">
                    Dragging {draggedItem.item.name}...
                  </span>
                )}
              </h3>
              {availableItems.length === 0 && inventory.length === 0 && (
                <div className="text-gray-500 text-center py-8 text-sm border-2 border-dashed border-gray-700 rounded">
                  Your inventory is empty
                </div>
              )}
              {availableItems.length === 0 && inventory.length > 0 && (
                <div className="text-blue-300 text-center py-8 text-sm border-2 border-dashed border-blue-700 rounded bg-blue-900 bg-opacity-20">
                  All your items are in the trade offer
                </div>
              )}
              {availableItems.length > 0 && (
                <div className="grid grid-cols-7 gap-2 max-h-48 overflow-y-auto p-2 border-2 border-dashed border-gray-700 rounded">
                  {availableItems.map((item) => (
                    <DraggableInventoryItem
                      key={item.slot}
                      item={item}
                      onClick={() => handleAddItem(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!tradeState.yourConfirmed ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleConfirm();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                data-testid="trade-confirm-button"
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded transition pointer-events-auto"
              >
                ✓ Confirm Trade
              </button>
            ) : (
              <button
                disabled
                className="flex-1 bg-green-900 text-green-400 font-bold py-3 rounded cursor-not-allowed pointer-events-auto"
              >
                ✓ Waiting for {tradeState.otherPlayerName}...
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleCancel();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={tradeState.yourConfirmed && tradeState.theirConfirmed}
              className="bg-red-900 hover:bg-red-800 text-red-200 font-bold py-3 px-8 rounded transition disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
            >
              Cancel
            </button>
          </div>

          {/* Info */}
          <div className="mt-4 bg-blue-900 bg-opacity-30 border border-blue-700 p-3 rounded">
            <p className="text-blue-200 text-sm">
              <strong>How trading works:</strong>
            </p>
            <ul className="text-blue-300 text-xs space-y-1 list-disc list-inside mt-2">
              <li>Add items and gold to your offer</li>
              <li>Review the other player's offer</li>
              <li>Both players must confirm</li>
              <li>Trade executes automatically when both confirm</li>
              <li>Items swap atomically (all or nothing)</li>
              <li>Either player can cancel before both confirm</li>
            </ul>
          </div>
        </div>
      </div>
    </DndContext>
  );
}

/**
 * Trade Success Notification
 */
export function TradeSuccessNotification(): React.ReactElement {
  return (
    <div
      className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-900 border-2 border-green-600 rounded-lg p-6 shadow-2xl z-[9999]"
      data-testid="trade-success"
    >
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-2xl font-bold text-green-400 mb-2">
          Trade Completed!
        </h3>
        <p className="text-green-300">Items have been exchanged successfully</p>
      </div>
    </div>
  );
}
