/**
 * GameStoreEditor — Store inventory editor for game manifest NPCs
 *
 * Reads base store data from manifests, writes overrides to storeOverrides.
 * Uses existing ItemPicker for adding items.
 */

import { Store, Package, Plus, Trash2 } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";

import type { ManifestItem, StoreManifestOverride } from "../../types";
import { useWorldStudio } from "../../WorldStudioContext";
import { ItemPicker } from "../ItemPicker";
import {
  PropertySection,
  InfoRow,
  DragNumberInput,
  TextInput,
  Toggle,
  OverridableField,
} from "./PropertyControls";

interface Props {
  storeId: string;
}

export function GameStoreEditor({ storeId }: Props) {
  const { state, actions } = useWorldStudio();
  const [showItemPicker, setShowItemPicker] = useState(false);

  // Base store from manifests
  const baseStore = useMemo(
    () => state.manifests.stores.find((s) => s.id === storeId),
    [state.manifests.stores, storeId],
  );

  // Override from state
  const override = state.manifestOverrides.storeOverrides.get(storeId);

  // Helper: get override or create a new one
  const getOverride = useCallback((): StoreManifestOverride => {
    return override ?? { entityId: storeId };
  }, [override, storeId]);

  // Helper: set a top-level override field
  const setField = useCallback(
    (field: keyof StoreManifestOverride, value: unknown) => {
      const existing = getOverride();
      const updated = { ...existing, [field]: value };
      actions.setManifestOverride(
        "storeOverrides",
        storeId,
        updated as unknown as Record<string, unknown>,
      );
    },
    [getOverride, storeId, actions],
  );

  // Helper: reset a top-level override field
  const resetField = useCallback(
    (field: string) => {
      if (!override) return;
      const updated = { ...override } as Record<string, unknown>;
      delete updated[field];
      const keys = Object.keys(updated).filter((k) => k !== "entityId");
      if (keys.length === 0) {
        actions.clearManifestOverride("storeOverrides", storeId);
      } else {
        actions.setManifestOverride("storeOverrides", storeId, updated);
      }
    },
    [override, storeId, actions],
  );

  // Merged item list: base items with overrides applied
  const mergedItems = useMemo(() => {
    if (!baseStore) return [];
    const itemOvr = override?.itemOverrides ?? {};
    return baseStore.items.map((item) => {
      const ovr = itemOvr[item.itemId];
      if (!ovr) return item;
      return {
        ...item,
        price: ovr.price ?? item.price,
        stockQuantity: ovr.stockQuantity ?? item.stockQuantity,
      };
    });
  }, [baseStore, override]);

  // Added items (not in base manifest)
  const addedItems = override?.addedItems ?? [];

  // All item IDs already in the store (base + added), for filtering the picker
  const existingItemIds = useMemo(() => {
    const ids = new Set<string>();
    if (baseStore) {
      for (const item of baseStore.items) ids.add(item.itemId);
    }
    for (const item of addedItems) ids.add(item.itemId);
    return ids;
  }, [baseStore, addedItems]);

  // Check if a specific item field is overridden
  const isItemOverridden = useCallback(
    (itemId: string, field: "price" | "stockQuantity"): boolean => {
      return override?.itemOverrides?.[itemId]?.[field] !== undefined;
    },
    [override],
  );

  // Update an item override
  const setItemOverride = useCallback(
    (itemId: string, field: "price" | "stockQuantity", value: number) => {
      const existing = getOverride();
      const currentItemOvr = existing.itemOverrides ?? {};
      const itemOvr = { ...currentItemOvr[itemId], [field]: value };
      const updated = {
        ...existing,
        itemOverrides: { ...currentItemOvr, [itemId]: itemOvr },
      };
      actions.setManifestOverride(
        "storeOverrides",
        storeId,
        updated as unknown as Record<string, unknown>,
      );
    },
    [getOverride, storeId, actions],
  );

  // Reset a single item field override
  const resetItemOverride = useCallback(
    (itemId: string, field: "price" | "stockQuantity") => {
      if (!override?.itemOverrides?.[itemId]) return;
      const currentItemOvr = { ...override.itemOverrides };
      const itemOvr = { ...currentItemOvr[itemId] };
      delete itemOvr[field];
      if (Object.keys(itemOvr).length === 0) {
        delete currentItemOvr[itemId];
      } else {
        currentItemOvr[itemId] = itemOvr;
      }
      const updated: Record<string, unknown> = { ...override };
      if (Object.keys(currentItemOvr).length === 0) {
        delete updated.itemOverrides;
      } else {
        updated.itemOverrides = currentItemOvr;
      }
      const keys = Object.keys(updated).filter((k) => k !== "entityId");
      if (keys.length === 0) {
        actions.clearManifestOverride("storeOverrides", storeId);
      } else {
        actions.setManifestOverride("storeOverrides", storeId, updated);
      }
    },
    [override, storeId, actions],
  );

  // Add an item from the ItemPicker
  const handleAddItem = useCallback(
    (itemId: string, item: ManifestItem) => {
      if (existingItemIds.has(itemId)) return;
      const existing = getOverride();
      const currentAdded = existing.addedItems ?? [];
      const updated = {
        ...existing,
        addedItems: [
          ...currentAdded,
          {
            itemId,
            name: item.name,
            price: item.value || 10,
            stockQuantity: 10,
          },
        ],
      };
      actions.setManifestOverride(
        "storeOverrides",
        storeId,
        updated as unknown as Record<string, unknown>,
      );
      setShowItemPicker(false);
    },
    [existingItemIds, getOverride, storeId, actions],
  );

  // Update an added item's field
  const updateAddedItem = useCallback(
    (itemId: string, field: "price" | "stockQuantity", value: number) => {
      if (!override?.addedItems) return;
      const updated = {
        ...override,
        addedItems: override.addedItems.map((item) =>
          item.itemId === itemId ? { ...item, [field]: value } : item,
        ),
      };
      actions.setManifestOverride(
        "storeOverrides",
        storeId,
        updated as unknown as Record<string, unknown>,
      );
    },
    [override, storeId, actions],
  );

  // Remove an added item
  const removeAddedItem = useCallback(
    (itemId: string) => {
      if (!override?.addedItems) return;
      const newAdded = override.addedItems.filter((i) => i.itemId !== itemId);
      const updated: Record<string, unknown> = { ...override };
      if (newAdded.length === 0) {
        delete updated.addedItems;
      } else {
        updated.addedItems = newAdded;
      }
      const keys = Object.keys(updated).filter((k) => k !== "entityId");
      if (keys.length === 0) {
        actions.clearManifestOverride("storeOverrides", storeId);
      } else {
        actions.setManifestOverride("storeOverrides", storeId, updated);
      }
    },
    [override, storeId, actions],
  );

  if (!baseStore) {
    return (
      <PropertySection title="Store" icon={<Store size={10} />}>
        <InfoRow label="Store ID" value={storeId} />
        <div className="text-[9px] text-text-tertiary px-1">
          Store not found in manifests
        </div>
      </PropertySection>
    );
  }

  const mergedName = override?.name ?? baseStore.name;
  const mergedBuyback = override?.buyback ?? baseStore.buyback ?? false;
  const totalItems = mergedItems.length + addedItems.length;

  return (
    <>
      <PropertySection
        title="Store Settings"
        icon={<Store size={10} />}
        persistKey="game-store-settings"
      >
        <OverridableField
          label="Store Name"
          isOverridden={override?.name !== undefined}
          onReset={() => resetField("name")}
        >
          <TextInput
            label=""
            value={mergedName}
            onChange={(v) => setField("name", v)}
          />
        </OverridableField>
        <InfoRow label="Store ID" value={storeId} />
        <OverridableField
          label="Buyback"
          isOverridden={override?.buyback !== undefined}
          onReset={() => resetField("buyback")}
        >
          <Toggle
            label=""
            value={mergedBuyback}
            onChange={(v) => setField("buyback", v)}
          />
        </OverridableField>
      </PropertySection>

      <PropertySection
        title="Inventory"
        badge={totalItems}
        icon={<Package size={10} />}
        persistKey="game-store-inventory"
      >
        {/* Base manifest items (overridable) */}
        {mergedItems.map((item) => {
          const priceOvr = isItemOverridden(item.itemId, "price");
          const stockOvr = isItemOverridden(item.itemId, "stockQuantity");
          return (
            <div
              key={item.id}
              className="space-y-1 py-1.5 border-b border-border-primary/30 last:border-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-text-secondary truncate">
                  {item.name}
                </span>
              </div>
              <div className="text-[9px] text-text-tertiary truncate">
                {item.itemId}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <OverridableField
                  label="Price"
                  isOverridden={priceOvr}
                  onReset={() => resetItemOverride(item.itemId, "price")}
                >
                  <DragNumberInput
                    label=""
                    value={item.price}
                    onChange={(v) => setItemOverride(item.itemId, "price", v)}
                    min={1}
                    max={999999}
                    step={1}
                    unit="gp"
                  />
                </OverridableField>
                <OverridableField
                  label="Stock"
                  isOverridden={stockOvr}
                  onReset={() =>
                    resetItemOverride(item.itemId, "stockQuantity")
                  }
                >
                  <DragNumberInput
                    label=""
                    value={item.stockQuantity}
                    onChange={(v) =>
                      setItemOverride(item.itemId, "stockQuantity", v)
                    }
                    min={1}
                    max={9999}
                    step={1}
                  />
                </OverridableField>
              </div>
            </div>
          );
        })}

        {/* Added items (from overrides, not in base manifest) */}
        {addedItems.map((item) => (
          <div
            key={`added-${item.itemId}`}
            className="space-y-1 py-1.5 border-b border-border-primary/30 last:border-0"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-primary truncate">
                {item.name}
              </span>
              <button
                className="p-0.5 rounded text-text-tertiary hover:text-red-400 transition-colors ease-out"
                onClick={() => removeAddedItem(item.itemId)}
                title="Remove from store"
              >
                <Trash2 size={10} />
              </button>
            </div>
            <div className="text-[9px] text-text-tertiary truncate">
              {item.itemId}
              <span className="ml-1 text-primary/60">(added)</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div>
                <div className="text-[9px] text-text-tertiary mb-0.5">
                  Price
                </div>
                <DragNumberInput
                  label=""
                  value={item.price}
                  onChange={(v) => updateAddedItem(item.itemId, "price", v)}
                  min={1}
                  max={999999}
                  step={1}
                  unit="gp"
                />
              </div>
              <div>
                <div className="text-[9px] text-text-tertiary mb-0.5">
                  Stock
                </div>
                <DragNumberInput
                  label=""
                  value={item.stockQuantity}
                  onChange={(v) =>
                    updateAddedItem(item.itemId, "stockQuantity", v)
                  }
                  min={1}
                  max={9999}
                  step={1}
                />
              </div>
            </div>
          </div>
        ))}

        {totalItems === 0 && (
          <div className="text-[9px] text-text-tertiary px-1 py-2 text-center">
            No items in store
          </div>
        )}

        {/* Add Item button + picker */}
        <div className="relative pt-1.5">
          <button
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] rounded border border-dashed border-border-primary text-text-tertiary hover:text-text-secondary hover:border-text-tertiary transition-colors ease-out"
            onClick={() => setShowItemPicker(!showItemPicker)}
          >
            <Plus size={10} />
            Add Item
          </button>
          {showItemPicker && (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-1">
              <ItemPicker
                value={null}
                onSelect={handleAddItem}
                onClose={() => setShowItemPicker(false)}
              />
            </div>
          )}
        </div>
      </PropertySection>
    </>
  );
}
