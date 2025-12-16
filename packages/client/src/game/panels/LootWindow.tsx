import React, { useState, useEffect, useCallback, useRef } from "react";
import { EventType, getItem } from "@hyperscape/shared";
import type { World, InventoryItem } from "@hyperscape/shared";

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
  const isClosingRef = useRef(false);

  useEffect(() => setItems(lootItems), [lootItems, corpseId]);
  useEffect(() => { isClosingRef.current = false; }, [corpseId]);

  const checkGravestoneState = useCallback(() => {
    if (!visible || !corpseId || isClosingRef.current) return;

    const gravestoneEntity = world.entities?.get(corpseId);
    if (!gravestoneEntity) {
      isClosingRef.current = true;
      onClose();
      return;
    }

    const entityData = gravestoneEntity as {
      data?: { lootItems?: InventoryItem[]; lootItemCount?: number };
      lootItems?: InventoryItem[];
    };
    const serverItems = entityData.data?.lootItems || entityData.lootItems || [];
    setItems((prev) => prev.length !== serverItems.length ? [...serverItems] : prev);

    if (serverItems.length === 0 || entityData.data?.lootItemCount === 0) {
      isClosingRef.current = true;
      setTimeout(onClose, 500);
    }
  }, [visible, corpseId, world, onClose]);

  useEffect(() => {
    if (!visible || !corpseId) return;

    const handleEntityUpdate = (data: unknown) => {
      const update = data as { entityId?: string; id?: string };
      if (update.entityId === corpseId || update.id === corpseId) checkGravestoneState();
    };

    world.on(EventType.ENTITY_UPDATED, handleEntityUpdate);
    const updateInterval = setInterval(checkGravestoneState, 250);

    return () => {
      clearInterval(updateInterval);
      world.off(EventType.ENTITY_UPDATED, handleEntityUpdate);
    };
  }, [visible, corpseId, world, checkGravestoneState]);

  const sendLootRequest = useCallback((item: InventoryItem, slot: number, playerId: string) => {
    const payload = { corpseId, playerId, itemId: item.itemId, quantity: item.quantity, slot };
    if (world.network?.send) {
      world.network.send("entityEvent", { id: "world", event: EventType.CORPSE_LOOT_REQUEST, payload });
    } else {
      world.emit(EventType.CORPSE_LOOT_REQUEST, payload);
    }
  }, [corpseId, world]);

  const handleTakeItem = (item: InventoryItem, index: number) => {
    const playerId = world.getPlayer()?.id;
    if (!playerId) return;
    sendLootRequest(item, index, playerId);
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTakeAll = () => {
    const playerId = world.getPlayer()?.id;
    if (!playerId) return;
    items.forEach((item, i) => sendLootRequest(item, i, playerId));
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

      <div className="mt-4 pt-3 border-t border-white/10">
        <p className="text-xs text-gray-400 text-center">
          Click an item to take it • Take All to loot everything
        </p>
      </div>
    </div>
  );
}
