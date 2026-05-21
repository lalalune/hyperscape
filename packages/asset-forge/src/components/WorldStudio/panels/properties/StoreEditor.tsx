/**
 * StoreEditor — Inline editor for shop inventory
 *
 * Used inside NPCProperties when the NPC has a linked store.
 * Allows adding/removing items, editing prices and stock quantities.
 */

import { Store, Plus, X, Package } from "lucide-react";
import React, { useCallback, useState } from "react";

import type {
  ManifestStore,
  ManifestStoreItem,
  ManifestItem,
} from "../../types";
import { useWorldStudio } from "../../WorldStudioContext";
import { ItemPicker } from "../ItemPicker";
import {
  PropertySection,
  NumberInput,
  TextInput,
  Toggle,
  SliderInput,
} from "./PropertyControls";

interface Props {
  store: ManifestStore;
}

export function StoreEditor({ store }: Props) {
  const { state, actions } = useWorldStudio();
  const [showItemPicker, setShowItemPicker] = useState(false);

  const updateStore = useCallback(
    (updates: Partial<ManifestStore>) => {
      const updatedStores = state.manifests.stores.map((s) =>
        s.id === store.id ? { ...s, ...updates } : s,
      );
      actions.updateManifestStores(updatedStores);
    },
    [state.manifests.stores, store.id, actions],
  );

  const updateItem = useCallback(
    (itemIndex: number, updates: Partial<ManifestStoreItem>) => {
      const newItems = [...store.items];
      newItems[itemIndex] = { ...newItems[itemIndex], ...updates };
      updateStore({ items: newItems });
    },
    [store.items, updateStore],
  );

  const removeItem = useCallback(
    (itemIndex: number) => {
      const newItems = store.items.filter((_, i) => i !== itemIndex);
      updateStore({ items: newItems });
    },
    [store.items, updateStore],
  );

  const addItem = useCallback(
    (itemId: string, item: ManifestItem) => {
      const newStoreItem: ManifestStoreItem = {
        id: `${store.id}-${itemId}`,
        itemId,
        name: item.name,
        price: item.value ?? 10,
        stockQuantity: 10,
      };
      updateStore({ items: [...store.items, newStoreItem] });
      setShowItemPicker(false);
    },
    [store, updateStore],
  );

  return (
    <>
      <PropertySection title="Shop Settings" icon={<Store size={10} />}>
        <TextInput
          label="Name"
          value={store.name}
          onChange={(name) => updateStore({ name })}
        />
        <Toggle
          label="Buyback"
          value={store.buyback ?? false}
          onChange={(buyback) => updateStore({ buyback })}
        />
        {store.buyback && (
          <SliderInput
            label="Buyback Rate"
            value={store.buybackRate ?? 0.4}
            onChange={(buybackRate) => updateStore({ buybackRate })}
            min={0.1}
            max={1}
            step={0.05}
            hint="Percentage of item value offered for buyback"
          />
        )}
      </PropertySection>

      <PropertySection
        title="Inventory"
        badge={store.items.length}
        icon={<Package size={10} />}
      >
        {store.items.map((item, idx) => (
          <div
            key={item.id}
            className="space-y-1 py-1.5 border-b border-border-primary/30 last:border-0 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-text-secondary truncate">
                {item.name}
              </span>
              <button
                className="p-0.5 rounded text-text-tertiary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ease-out"
                onClick={() => removeItem(idx)}
                title="Remove from shop"
              >
                <X size={10} />
              </button>
            </div>
            <div className="text-[9px] text-text-tertiary truncate">
              {item.itemId}
            </div>
            <div className="grid grid-cols-2 gap-1">
              <NumberInput
                label="Price"
                value={item.price}
                onChange={(price) => updateItem(idx, { price })}
                min={1}
                max={999999}
                unit="gp"
              />
              <NumberInput
                label="Stock"
                value={item.stockQuantity}
                onChange={(stockQuantity) => updateItem(idx, { stockQuantity })}
                min={1}
                max={9999}
              />
            </div>
            {item.restockTime != null && (
              <NumberInput
                label="Restock Time"
                value={item.restockTime}
                onChange={(restockTime) => updateItem(idx, { restockTime })}
                min={0}
                max={10000}
                unit="ticks"
              />
            )}
          </div>
        ))}

        {/* Add item button */}
        {showItemPicker ? (
          <div className="mt-1">
            <ItemPicker
              value={null}
              onSelect={addItem}
              onClose={() => setShowItemPicker(false)}
              placeholder="Add item to shop..."
            />
          </div>
        ) : (
          <button
            className="w-full mt-1 py-1 text-[10px] text-primary/80 hover:text-primary hover:bg-primary/5 rounded border border-dashed border-primary/30 flex items-center justify-center gap-1"
            onClick={() => setShowItemPicker(true)}
          >
            <Plus size={10} />
            Add Item
          </button>
        )}
      </PropertySection>
    </>
  );
}
