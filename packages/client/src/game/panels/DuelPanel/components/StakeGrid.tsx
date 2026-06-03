/**
 * StakeGrid — Grid of staked items (mine or opponent's)
 *
 * Renders a titled panel with a grid of stake slots and total value.
 */

import type { CSSProperties } from "react";
import type { Theme } from "@/ui";
import { getItem, type StakedItem } from "@hyperforge/shared";
import { SlotItem } from "./SlotItem";
import { formatGoldValue } from "../utils";

// ============================================================================
// Types
// ============================================================================

interface StakeGridProps {
  title: string;
  stakes: StakedItem[];
  allStakes: StakedItem[];
  isMine: boolean;
  totalValue: number;
  totalSlots: number;
  theme: Theme;
  panelStyle: CSSProperties;
  headerStyle: CSSProperties;
  gridStyle: CSSProperties;
  valueStyle: CSSProperties;
  quantityStyle: CSSProperties;
  onRemoveStake?: (stakeIndex: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function StakeGrid({
  title,
  stakes,
  allStakes,
  isMine,
  totalValue,
  totalSlots,
  theme,
  panelStyle,
  headerStyle,
  gridStyle,
  valueStyle,
  quantityStyle,
  onRemoveStake,
}: StakeGridProps) {
  return (
    <div style={panelStyle}>
      <div style={headerStyle}>{title}</div>
      <div style={gridStyle}>
        {Array.from({ length: totalSlots }).map((_, i) => {
          const item = stakes[i];
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
              title={`${displayName}${isMine ? " (click to remove)" : ""}`}
              quantityStyle={quantityStyle}
              onClick={
                isMine && onRemoveStake
                  ? () => onRemoveStake(allStakes.indexOf(item))
                  : undefined
              }
            />
          );
        })}
      </div>
      <div style={valueStyle}>Value: {formatGoldValue(totalValue)} gp</div>
    </div>
  );
}
