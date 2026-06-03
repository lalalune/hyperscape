/**
 * Inventory Item Component
 *
 * Clickable inventory item for OSRS-style trade panel.
 * Left-click: add 1 to trade
 * Right-click: show context menu
 */

import { useState } from "react";
import { getItem } from "@hyperforge/shared";
import { CursorTooltip } from "@/ui";
import {
  getTooltipMetaStyle,
  getTooltipTitleStyle,
} from "@/ui/core/tooltip/tooltipStyles";
import { ItemIcon } from "@/ui/components/ItemIcon";
import { formatQuantity } from "../utils";
import type { InventoryItemProps } from "../types";

export function InventoryItem({
  item,
  theme,
  onLeftClick,
  onRightClick,
}: InventoryItemProps) {
  const itemData = getItem(item.itemId);
  const qtyDisplay = item.quantity > 1 ? formatQuantity(item.quantity) : null;
  const [hoverState, setHoverState] = useState<{ x: number; y: number } | null>(
    null,
  );

  return (
    <>
      <div
        className="relative flex items-center justify-center hover:brightness-110"
        style={{
          width: "36px",
          height: "36px",
          background: theme.colors.background.panelSecondary,
          border: `1px solid ${theme.colors.border.default}`,
          borderRadius: "4px",
          cursor: "pointer",
          transition: "filter 0.1s",
        }}
        onClick={(e) => {
          e.preventDefault();
          onLeftClick();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onRightClick(e);
        }}
        onMouseEnter={(e) => {
          setHoverState({ x: e.clientX, y: e.clientY });
        }}
        onMouseMove={(e) => {
          setHoverState({ x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={() => setHoverState(null)}
      >
        {/* Render item icon */}
        <ItemIcon
          itemId={item.itemId}
          size={32}
          style={{ filter: "drop-shadow(0 2px 2px rgba(0, 0, 0, 0.6))" }}
        />
        {qtyDisplay && (
          <span
            className="absolute bottom-0 right-0.5 text-xs font-bold"
            style={{
              color: qtyDisplay.color,
              textShadow:
                "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000",
              fontSize: "10px",
            }}
          >
            {qtyDisplay.text}
          </span>
        )}
      </div>

      {hoverState && (
        <CursorTooltip
          visible={true}
          position={hoverState}
          estimatedSize={{ width: 180, height: 52 }}
          style={{
            zIndex: theme.zIndex.tooltip,
            minWidth: "150px",
          }}
        >
          <div
            style={{
              ...getTooltipTitleStyle(theme),
            }}
          >
            {itemData?.name || item.itemId}
          </div>
          <div
            style={{
              ...getTooltipMetaStyle(theme),
              marginTop: "4px",
            }}
          >
            Left-click: Offer 1. Right-click: Options.
          </div>
        </CursorTooltip>
      )}
    </>
  );
}
