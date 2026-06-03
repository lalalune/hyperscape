/**
 * Trade Slot Component
 *
 * Individual trade slot displaying an item or empty slot.
 * Shows red flashing exclamation when item was recently removed (anti-scam).
 */

import { useState } from "react";
import { getItem } from "@hyperforge/shared";
import { CursorTooltip } from "@/ui";
import {
  getTooltipMetaStyle,
  getTooltipTitleStyle,
} from "@/ui/core/tooltip/tooltipStyles";
import { ItemIcon } from "@/ui/components/ItemIcon";
import { getInteractiveTileStyle } from "@/ui/theme/themes";
import { formatQuantity } from "../utils";
import type { TradeSlotProps } from "../types";

export function TradeSlot({
  item,
  slotIndex: _slotIndex,
  side,
  onRemove,
  theme,
  isRemoved,
}: TradeSlotProps) {
  const itemData = item ? getItem(item.itemId) : null;
  const quantity = item?.quantity ?? 0;
  const qtyDisplay = quantity > 1 ? formatQuantity(quantity) : null;
  const [hoverState, setHoverState] = useState<{ x: number; y: number } | null>(
    null,
  );

  return (
    <>
      <div
        className="relative flex items-center justify-center"
        style={{
          width: "36px",
          height: "36px",
          ...getInteractiveTileStyle(theme, {
            radius: 4,
            accentColor: isRemoved
              ? theme.colors.state.danger
              : theme.colors.accent.primary,
            active: Boolean(item),
          }),
          cursor: item && side === "my" ? "pointer" : "default",
          transition: "background 0.15s, border-color 0.15s",
          animation: isRemoved ? "pulse 0.5s ease-in-out infinite" : "none",
        }}
        onClick={() => {
          if (item && side === "my" && onRemove) {
            onRemove();
          }
        }}
        onMouseEnter={(e) => {
          if (itemData?.name) {
            setHoverState({ x: e.clientX, y: e.clientY });
          }
        }}
        onMouseMove={(e) => {
          if (itemData?.name) {
            setHoverState({ x: e.clientX, y: e.clientY });
          }
        }}
        onMouseLeave={() => setHoverState(null)}
      >
        {/* Red flashing exclamation for removed items */}
        {isRemoved && !item && (
          <span
            style={{
              fontSize: "24px",
              color: "#ef4444",
              fontWeight: "bold",
              textShadow: "0 0 8px rgba(239, 68, 68, 0.8)",
            }}
          >
            !
          </span>
        )}
        {/* Render item icon */}
        {item && (
          <ItemIcon
            itemId={item.itemId}
            size={32}
            style={{ filter: "drop-shadow(0 2px 2px rgba(0, 0, 0, 0.6))" }}
          />
        )}
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

      {itemData?.name && hoverState && (
        <CursorTooltip
          visible={true}
          position={hoverState}
          estimatedSize={{ width: 150, height: 48 }}
          style={{
            zIndex: theme.zIndex.tooltip,
            minWidth: "120px",
          }}
        >
          <div
            style={{
              ...getTooltipTitleStyle(theme),
            }}
          >
            {itemData.name}
            {quantity > 1 ? ` x${quantity}` : ""}
          </div>
          <div style={{ ...getTooltipMetaStyle(theme), marginTop: "4px" }}>
            {side === "my" ? "Click to remove from trade" : "Offered in trade"}
          </div>
        </CursorTooltip>
      )}
    </>
  );
}
