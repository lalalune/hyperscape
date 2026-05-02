/**
 * EquipmentWidget — schema-driven equipment-slot panel adapter.
 *
 * Matches the `hyperforge.panel.equipment` widget schema. Renders the
 * worn-gear silhouette layout from `game/panels/EquipmentPanel.tsx`:
 * head / neck / cape at the top, mainhand / body / offhand in the
 * middle, legs below, gloves / feet / ring at the bottom.
 *
 * Presentational only; drag-drop + unequip context menu stay in the
 * hand-coded panel.
 */

import { memo, useMemo } from "react";
import { useItemIcon } from "../ItemIconContext";
import {
  FONT_STACK,
  INSET_BG,
  INSET_SHADOW_SOFT,
  PANEL_BG,
  PANEL_BORDER,
  SLOT_EMPTY_BG,
  SLOT_EMPTY_BORDER,
  SLOT_FILLED_BG,
  SLOT_FILLED_BORDER,
  SLOT_INSET_SHADOW,
  TEXT_MUTED,
} from "./widgetStyles";

export interface EquipmentSlot {
  slot: string;
  itemId: string | null;
  name?: string;
}

export interface EquipmentProps {
  showAvatar: boolean;
  showCombatSummary: boolean;
  items?: ReadonlyArray<EquipmentSlot>;
}

const SLOT_SIZE = 40;

// Grid layout (col, row) for a paperdoll figure. This default
// layout is Hyperia-flavored; games shipping their own equipment
// model contribute a custom EquipmentWidget variant.
const SLOT_POSITIONS: ReadonlyArray<{
  key: string;
  label: string;
  col: number;
  row: number;
}> = [
  { key: "head", label: "Head", col: 2, row: 1 },
  { key: "cape", label: "Cape", col: 1, row: 1 },
  { key: "neck", label: "Neck", col: 3, row: 1 },
  { key: "mainhand", label: "Main", col: 1, row: 2 },
  { key: "body", label: "Body", col: 2, row: 2 },
  { key: "offhand", label: "Off", col: 3, row: 2 },
  { key: "legs", label: "Legs", col: 2, row: 3 },
  { key: "gloves", label: "Hands", col: 1, row: 4 },
  { key: "feet", label: "Feet", col: 2, row: 4 },
  { key: "ring", label: "Ring", col: 3, row: 4 },
];

export const EquipmentWidget = memo(function EquipmentWidget({
  showAvatar: _showAvatar,
  showCombatSummary,
  items,
}: EquipmentProps) {
  const ItemIcon = useItemIcon();
  const bySlot = useMemo(() => {
    const map = new Map<string, EquipmentSlot>();
    if (items) {
      for (const s of items) map.set(s.slot, s);
    }
    return map;
  }, [items]);

  return (
    <div
      role="region"
      aria-label="Equipment"
      style={{
        display: "inline-block",
        padding: 4,
        background: PANEL_BG,
        border: `1px solid ${PANEL_BORDER}`,
        borderRadius: 6,
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          padding: 6,
          background: INSET_BG,
          borderRadius: 4,
          boxShadow: INSET_SHADOW_SOFT,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(3, ${SLOT_SIZE}px)`,
            gridTemplateRows: `repeat(4, ${SLOT_SIZE}px)`,
            gap: 4,
          }}
        >
          {SLOT_POSITIONS.map((pos) => {
            const live = bySlot.get(pos.key);
            const filled = !!live && !!live.itemId;
            return (
              <div
                key={pos.key}
                title={pos.label}
                style={{
                  gridColumn: pos.col,
                  gridRow: pos.row,
                  width: SLOT_SIZE,
                  height: SLOT_SIZE,
                  background: filled ? SLOT_FILLED_BG : SLOT_EMPTY_BG,
                  border: `1px solid ${filled ? SLOT_FILLED_BORDER : SLOT_EMPTY_BORDER}`,
                  borderRadius: 3,
                  boxShadow: SLOT_INSET_SHADOW,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {filled && live?.itemId ? (
                  <ItemIcon
                    itemId={live.itemId}
                    size={Math.max(20, SLOT_SIZE - 10)}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 7,
                      color: TEXT_MUTED,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      opacity: 0.6,
                    }}
                  >
                    {pos.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {showCombatSummary && (
        <div
          style={{
            marginTop: 4,
            padding: "4px 6px",
            background: INSET_BG,
            borderRadius: 4,
            boxShadow: INSET_SHADOW_SOFT,
            color: TEXT_MUTED,
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            textAlign: "center",
          }}
        >
          Combat Bonuses
        </div>
      )}
    </div>
  );
});
