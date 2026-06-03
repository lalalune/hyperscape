/**
 * StakeInventoryPanel — Inventory panel for staking items
 *
 * Renders the player's inventory on the right side of the stakes screen.
 * Items that are already staked show a highlighted border.
 */

import type { CSSProperties } from "react";
import type { Theme } from "@/ui";
import { getItem } from "@hyperforge/shared";
import { SlotItem } from "./SlotItem";

// ============================================================================
// Types
// ============================================================================

interface InventoryItem {
  slot: number;
  itemId: string;
  quantity: number;
}

interface StakeInventoryPanelProps {
  inventory: InventoryItem[];
  stakedSlots: Set<number>;
  totalSlots: number;
  theme: Theme;
  panelStyle: CSSProperties;
  headerStyle: CSSProperties;
  gridStyle: CSSProperties;
  quantityStyle: CSSProperties;
  onItemClick: (item: InventoryItem) => void;
  onItemRightClick: (e: React.MouseEvent, item: InventoryItem) => void;
}

// ============================================================================
// Component
// ============================================================================

export function StakeInventoryPanel({
  inventory,
  stakedSlots,
  totalSlots,
  theme,
  panelStyle,
  headerStyle,
  gridStyle,
  quantityStyle,
  onItemClick,
  onItemRightClick,
}: StakeInventoryPanelProps) {
  return (
    <div style={panelStyle}>
      <div style={headerStyle}>Inventory</div>
      <div style={gridStyle}>
        {Array.from({ length: totalSlots }).map((_, i) => {
          const item = inventory.find((inv) => inv.slot === i);
          if (!item) {
            return (
              <SlotItem
                key={i}
                theme={theme}
                hasItem={false}
                quantityStyle={quantityStyle}
              />
            );
          }

          const isStaked = stakedSlots.has(item.slot);
          const itemData = getItem(item.itemId);
          const displayName = itemData?.name || item.itemId;

          return (
            <SlotItem
              key={i}
              theme={theme}
              hasItem={true}
              itemId={item.itemId}
              displayName={displayName}
              quantity={item.quantity}
              isStaked={isStaked}
              title={isStaked ? `${displayName} (staked)` : displayName}
              quantityStyle={quantityStyle}
              onClick={!isStaked ? () => onItemClick(item) : undefined}
              onContextMenu={(e) => {
                if (!isStaked) onItemRightClick(e, item);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
