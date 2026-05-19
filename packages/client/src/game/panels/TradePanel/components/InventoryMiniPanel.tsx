/**
 * Inventory Mini Panel Component
 *
 * Inventory mini-panel for selecting items to trade.
 * tile-based MMORPG style: displayed to the right of trade offers, 4x7 grid matching inventory.
 * Left-click: add 1 item, Right-click: context menu
 */

import { getInteractiveTileStyle, getPanelInsetStyle } from "@/ui/theme/themes";
import { TRADE_GRID_COLS } from "../constants";
import { getMaxInventorySlots } from "@hyperforge/shared";
import { InventoryItem } from "./InventoryItem";
import type { InventoryMiniPanelProps } from "../types";

export function InventoryMiniPanel({
  items,
  offeredSlots,
  theme,
  onItemLeftClick,
  onItemRightClick,
}: InventoryMiniPanelProps) {
  // Filter out items already offered
  const availableItems = items.filter((item) => !offeredSlots.has(item.slot));

  // Create a map for quick lookup
  const itemsBySlot = new Map<
    number,
    { slot: number; itemId: string; quantity: number }
  >();
  availableItems.forEach((item) => itemsBySlot.set(item.slot, item));

  return (
    <div className="flex flex-col">
      <h4
        className="text-xs font-bold mb-2"
        style={{ color: theme.colors.text.secondary }}
      >
        Your Inventory
      </h4>
      <div
        className="grid gap-1 p-2 rounded"
        style={{
          // tile-based MMORPG style: 4 columns x 7 rows = 28 slots
          gridTemplateColumns: `repeat(${TRADE_GRID_COLS}, 36px)`,
          ...getPanelInsetStyle(theme, {
            emphasis: "strong",
            radius: theme.borderRadius.md,
          }),
        }}
      >
        {/* Render all 28 slots, showing items in their actual positions */}
        {Array.from({ length: getMaxInventorySlots() }).map((_, slotIndex) => {
          const item = itemsBySlot.get(slotIndex);
          if (item) {
            return (
              <InventoryItem
                key={slotIndex}
                item={item}
                theme={theme}
                onLeftClick={() => onItemLeftClick(item)}
                onRightClick={(e) => onItemRightClick(e, item)}
              />
            );
          }
          // Empty slot
          return (
            <div
              key={slotIndex}
              className="relative flex items-center justify-center"
              style={{
                width: "36px",
                height: "36px",
                ...getInteractiveTileStyle(theme, {
                  radius: 4,
                  disabled: true,
                }),
                opacity: 0.5,
              }}
            />
          );
        })}
      </div>
      <p
        className="text-xs mt-2 text-center"
        style={{ color: theme.colors.text.muted }}
      >
        Left-click: Offer 1 | Right-click: Options
      </p>
    </div>
  );
}
