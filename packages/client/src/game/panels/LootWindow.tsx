import React, { useState, useEffect } from "react";
import type { World } from "@hyperscape/shared";
import type { InventoryItem } from "@hyperscape/shared";
import { EventType } from "@hyperscape/shared";
import { getItem } from "@hyperscape/shared";

interface LootWindowProps {
  visible: boolean;
  corpseId: string;
  corpseName: string;
  lootItems: InventoryItem[];
  onClose: () => void;
  world: World;
}

export function LootWindow({
  visible,
  corpseId,
  corpseName,
  lootItems,
  onClose,
  world,
}: LootWindowProps) {
  const [items, setItems] = useState<InventoryItem[]>(lootItems);

  // Update items when prop changes
  useEffect(() => {
    setItems(lootItems);
  }, [lootItems, corpseId]);

  // Listen for server updates to the gravestone entity
  // This keeps the loot window in sync when items are removed
  useEffect(() => {
    const updateInterval = setInterval(() => {
      if (!visible || !corpseId) return;

      // Get the gravestone entity from the world
      const gravestoneEntity = world.entities?.get(corpseId);

      // If gravestone entity no longer exists (despawned), close window immediately
      if (!gravestoneEntity) {
        console.log(
          "[LootWindow] Gravestone despawned, closing window immediately...",
        );
        onClose();
        return;
      }

      // Check if entity has lootItems in its data
      const entityData = (gravestoneEntity as { data?: { lootItems?: InventoryItem[]; lootItemCount?: number } }).data;
      const gravestoneLootItems = (gravestoneEntity as { lootItems?: InventoryItem[] }).lootItems;
      if (entityData?.lootItems || gravestoneLootItems) {
        const serverItems =
          entityData?.lootItems || gravestoneLootItems || [];

        // Update local state with server data
        setItems([...serverItems]);
      }

      // If gravestone is empty, close the window
      if (
        (gravestoneLootItems?.length === 0 ||
          entityData?.lootItems?.length === 0 ||
          entityData?.lootItemCount === 0) &&
        items.length > 0
      ) {
        console.log(
          "[LootWindow] Gravestone empty, closing window in 500ms...",
        );
        setTimeout(() => {
          onClose();
        }, 500);
      }
    }, 100); // Check every 100ms for updates

    return () => clearInterval(updateInterval);
  }, [visible, corpseId, world, items.length, onClose]);

  const handleTakeItem = (item: InventoryItem, index: number) => {
    const localPlayer = world.getPlayer();
    if (!localPlayer) return;

    // Send loot request to server
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
        },
      });
    } else {
      world.emit(EventType.CORPSE_LOOT_REQUEST, {
        corpseId,
        playerId: localPlayer.id,
        itemId: item.itemId,
        quantity: item.quantity,
        slot: index,
      });
    }

    // Optimistically remove item from UI
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTakeAll = () => {
    const localPlayer = world.getPlayer();
    if (!localPlayer) return;

    // Take ALL items in one batch request
    // Copy current items array since we'll clear it optimistically
    const itemsToTake = [...items];

    // Send loot request for each item
    itemsToTake.forEach((item, index) => {
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
          },
        });
      } else {
        world.emit(EventType.CORPSE_LOOT_REQUEST, {
          corpseId,
          playerId: localPlayer.id,
          itemId: item.itemId,
          quantity: item.quantity,
          slot: index,
        });
      }
    });

    // Optimistically clear ALL items at once
    setItems([]);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-auto"
      style={{
        width: "32rem",
        background: "rgba(11, 10, 21, 0.98)",
        border: "1px solid #2a2b39",
        borderRadius: "0.5rem",
        padding: "1.5rem",
        backdropFilter: "blur(10px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-lg font-bold text-white">{corpseName}</h3>
        <div className="flex gap-2">
          <button
            onClick={handleTakeAll}
            className="bg-emerald-600 hover:bg-emerald-700 border-none rounded text-white py-1.5 px-3 cursor-pointer text-sm transition-colors"
            disabled={items.length === 0}
          >
            Take All
          </button>
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 border-none rounded text-white py-1.5 px-3 cursor-pointer text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Loot Items */}
      {items.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
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
                className="bg-black/40 border border-white/10 rounded p-2 cursor-pointer hover:bg-black/60 hover:border-white/30 transition-all"
                onClick={() => handleTakeItem(item, index)}
                title={`Click to take ${displayName} (${item.quantity})`}
              >
                <div className="text-center">
                  <div className="text-xs font-bold text-white mb-1 truncate">
                    {displayName.substring(0, 12)}
                  </div>
                  {item.quantity > 1 && (
                    <div className="text-xs text-yellow-400 font-bold">
                      ×{item.quantity}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-500 mt-1 capitalize">
                    {itemType}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 pt-3 border-t border-white/10">
        <p className="text-xs text-gray-400 text-center">
          Click an item to take it • Take All to loot everything
        </p>
      </div>
    </div>
  );
}
