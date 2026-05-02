/**
 * InventoryWidget — schema-driven inventory grid adapter.
 *
 * Matches the `hyperforge.panel.inventory` widget schema from
 * `@hyperforge/ui-framework/builtins`. Renders a fixed `columns × rows`
 * slot grid. If the `items` prop is provided (typically via a
 * `$inventory.items` binding), each slot's icon and quantity badge are
 * rendered using the client's `ItemIcon` helper so the manifest path
 * matches the hand-coded `game/panels/InventoryPanel.tsx` at pixel level.
 *
 * Drag-and-drop, right-click context menus, tooltip text, coin pouch,
 * and item-on-item targeting are intentionally NOT implemented here
 * — those are interactive concerns that remain in the hand-coded
 * panel until the runtime-bindings layer grows interaction hooks.
 */

import { memo, useMemo } from "react";
import { useItemIcon } from "../ItemIconContext";

export interface InventoryItem {
  slot: number;
  itemId: string;
  quantity: number;
}

export interface InventoryProps {
  columns: number;
  rows: number;
  showQuantities: boolean;
  allowDragToActionBar: boolean;
  items?: ReadonlyArray<InventoryItem>;
}

// Match `InventoryPanel.tsx` surface language: outer panel uses
// `getPanelSurfaceStyle`, inner grid container uses
// `getPanelInsetStyle({emphasis:"strong", radius:md})`.
const SLOT_SIZE = 40;
const GAP = 3;
const PANEL_BG = "rgba(20, 21, 24, 0.95)";
const PANEL_BORDER = "rgba(255, 255, 255, 0.15)";
const GRID_INSET_BG = "rgba(0, 0, 0, 0.4)";
const GRID_INSET_SHADOW = "inset 0 2px 8px rgba(0, 0, 0, 0.55)";
const SLOT_EMPTY_BG = "rgba(255, 255, 255, 0.03)";
const SLOT_EMPTY_BORDER = "rgba(255, 255, 255, 0.08)";
const SLOT_FILLED_BG =
  "linear-gradient(180deg, rgba(40, 44, 52, 0.9) 0%, rgba(24, 26, 32, 0.95) 100%)";
const SLOT_FILLED_BORDER = "rgba(255, 255, 255, 0.18)";
const SLOT_INSET_SHADOW = "inset 0 1px 2px rgba(0, 0, 0, 0.35)";
// Warm-yellow quantity badge (Tailwind amber-400).
const QUANTITY_COLOR = "#fbbf24";

/** Compact quantity format (1k, 10M, etc) for the slot badge. */
function formatQuantity(qty: number): string {
  if (qty >= 10_000_000) return `${Math.floor(qty / 1_000_000)}M`;
  if (qty >= 100_000) return `${Math.floor(qty / 1_000)}K`;
  if (qty >= 10_000) return `${Math.floor(qty / 1_000)}K`;
  return String(qty);
}

export const InventoryWidget = memo(function InventoryWidget({
  columns,
  rows,
  showQuantities,
  allowDragToActionBar: _allowDragToActionBar,
  items,
}: InventoryProps) {
  const ItemIcon = useItemIcon();
  const cols = Math.max(1, columns);
  const slotCount = Math.max(0, Math.floor(cols * Math.max(1, rows)));

  // Index items by slot for O(1) lookup per render cell.
  const bySlot = useMemo(() => {
    const map = new Map<number, InventoryItem>();
    if (items) {
      for (const item of items) {
        map.set(item.slot, item);
      }
    }
    return map;
  }, [items]);

  return (
    <div
      role="region"
      aria-label="Inventory"
      style={{
        display: "inline-block",
        padding: 4,
        background: PANEL_BG,
        border: `1px solid ${PANEL_BORDER}`,
        borderRadius: 6,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          padding: 4,
          background: GRID_INSET_BG,
          borderRadius: 4,
          boxShadow: GRID_INSET_SHADOW,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, ${SLOT_SIZE}px)`,
            gridAutoRows: `${SLOT_SIZE}px`,
            gap: GAP,
          }}
        >
          {Array.from({ length: slotCount }, (_, i) => {
            const item = bySlot.get(i);
            const isFilled = item !== undefined;
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  width: SLOT_SIZE,
                  height: SLOT_SIZE,
                  background: isFilled ? SLOT_FILLED_BG : SLOT_EMPTY_BG,
                  border: `1px solid ${isFilled ? SLOT_FILLED_BORDER : SLOT_EMPTY_BORDER}`,
                  borderRadius: 3,
                  boxShadow: SLOT_INSET_SHADOW,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {item && (
                  <ItemIcon
                    itemId={item.itemId}
                    size={Math.max(20, SLOT_SIZE - 10)}
                  />
                )}
                {item && showQuantities && item.quantity > 1 && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 1,
                      right: 2,
                      fontSize: 9,
                      fontWeight: 700,
                      color: QUANTITY_COLOR,
                      textShadow: "0 0 2px rgba(0, 0, 0, 0.95), 1px 1px 0 #000",
                      lineHeight: 1,
                      pointerEvents: "none",
                    }}
                  >
                    {formatQuantity(item.quantity)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
