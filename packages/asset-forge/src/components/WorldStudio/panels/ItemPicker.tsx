/**
 * ItemPicker — Reusable item selection popover for World Studio
 *
 * Used when configuring NPC drops, shop inventories, quest rewards,
 * recipe inputs/outputs, and any other cross-reference to items.
 * Supports search, type filtering, and shows item details on hover.
 */

import { Search, Package, X } from "lucide-react";
import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";

import type { ManifestItem } from "../types";
import { useWorldStudio } from "../WorldStudioContext";

interface ItemPickerProps {
  /** Currently selected item ID (if any) */
  value: string | null;
  /** Called when an item is selected */
  onSelect: (itemId: string, item: ManifestItem) => void;
  /** Called when the picker is closed */
  onClose?: () => void;
  /** Optional type filter */
  typeFilter?: ManifestItem["type"][];
  /** Placeholder text */
  placeholder?: string;
}

const TYPE_COLORS: Record<ManifestItem["type"], string> = {
  weapon: "text-red-400",
  armor: "text-blue-400",
  resource: "text-amber-400",
  tool: "text-orange-400",
  ammunition: "text-green-400",
  food: "text-pink-400",
  misc: "text-text-tertiary",
  rune: "text-purple-400",
};

export function ItemPicker({
  value,
  onSelect,
  onClose,
  typeFilter,
  placeholder = "Search items...",
}: ItemPickerProps) {
  const { state } = useWorldStudio();
  const items = state.manifests.items;
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<ManifestItem["type"] | "all">(
    "all",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const availableTypes = useMemo(() => {
    if (typeFilter) return typeFilter;
    const types = new Set(items.map((i) => i.type));
    return Array.from(types).sort();
  }, [items, typeFilter]);

  const filtered = useMemo(() => {
    let result = items;
    if (activeType !== "all") {
      result = result.filter((i) => i.type === activeType);
    }
    if (typeFilter) {
      result = result.filter((i) => typeFilter.includes(i.type));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q) ||
          (i.tier?.toLowerCase().includes(q) ?? false),
      );
    }
    return result.slice(0, 100); // Cap at 100 for performance
  }, [items, search, activeType, typeFilter]);

  const handleSelect = useCallback(
    (item: ManifestItem) => {
      onSelect(item.id, item);
    },
    [onSelect],
  );

  return (
    <div className="flex flex-col bg-bg-secondary border border-border-primary rounded-lg shadow-xl max-h-80 w-72">
      {/* Search header */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border-primary">
        <Search size={12} className="text-text-tertiary flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-xs bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
        {onClose && (
          <button
            className="p-0.5 rounded text-text-tertiary hover:text-text-primary"
            onClick={onClose}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Type filter tabs */}
      {availableTypes.length > 1 && (
        <div className="flex gap-0.5 px-1.5 py-1 border-b border-border-primary overflow-x-auto scrollbar-thin">
          <button
            className={`px-1.5 py-0.5 text-[10px] rounded flex-shrink-0 transition-colors ${
              activeType === "all"
                ? "bg-primary/20 text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            } ease-out`}
            onClick={() => setActiveType("all")}
          >
            All
          </button>
          {availableTypes.map((type) => (
            <button
              key={type}
              className={`px-1.5 py-0.5 text-[10px] rounded flex-shrink-0 capitalize transition-colors ${
                activeType === type
                  ? "bg-primary/20 text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              } ease-out`}
              onClick={() => setActiveType(type)}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Item list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-text-tertiary">
            {search ? "No items match search" : "No items available"}
          </div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              className={`w-full text-left px-2 py-1 flex items-center gap-2 text-xs transition-colors border-b border-border-primary/20 ${
                value === item.id
                  ? "bg-primary/10 text-primary"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              } ease-out`}
              onClick={() => handleSelect(item)}
            >
              <Package
                size={10}
                className={`flex-shrink-0 ${TYPE_COLORS[item.type]}`}
              />
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.name}</div>
                <div className="text-[10px] text-text-tertiary truncate">
                  {[
                    item.type,
                    item.tier,
                    item.rarity,
                    item.value ? `${item.value}gp` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {item.levelRequired && (
                <span className="text-[10px] text-text-tertiary flex-shrink-0">
                  Lv{item.levelRequired}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-2 py-1 border-t border-border-primary text-[10px] text-text-tertiary">
        {filtered.length}{" "}
        {filtered.length === 100 ? "(showing first 100)" : "items"}
      </div>
    </div>
  );
}

// ============== INLINE ITEM REFERENCE ==============

interface ItemReferenceProps {
  /** Item ID to display */
  itemId: string;
  /** Whether to allow changing the item */
  editable?: boolean;
  /** Called with new item ID when changed */
  onChange?: (itemId: string) => void;
}

/**
 * Inline item reference display — shows item name and type,
 * with optional click-to-change via ItemPicker.
 */
export function ItemReference({
  itemId,
  editable,
  onChange,
}: ItemReferenceProps) {
  const { state } = useWorldStudio();
  const item = state.manifests.items.find((i) => i.id === itemId);
  const [showPicker, setShowPicker] = useState(false);

  const handleSelect = useCallback(
    (newId: string) => {
      onChange?.(newId);
      setShowPicker(false);
    },
    [onChange],
  );

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] transition-colors ${
          item
            ? `${TYPE_COLORS[item.type]} bg-bg-tertiary hover:bg-bg-tertiary/80`
            : "text-red-400 bg-red-400/10"
        } ${editable ? "cursor-pointer" : "cursor-default"}`}
        onClick={() => editable && setShowPicker(!showPicker)}
        title={item ? `${item.name} (${item.id})` : `Unknown item: ${itemId}`}
      >
        <Package size={8} />
        <span className="truncate max-w-[120px]">
          {item ? item.name : itemId}
        </span>
        {!item && <span className="text-red-400">?</span>}
      </button>
      {showPicker && (
        <div className="absolute top-full left-0 z-50 mt-1">
          <ItemPicker
            value={itemId}
            onSelect={handleSelect}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}
    </div>
  );
}
