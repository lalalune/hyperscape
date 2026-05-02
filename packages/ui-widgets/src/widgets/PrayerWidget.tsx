/**
 * PrayerWidget — prayer grid panel adapter.
 *
 * Matches `hyperforge.panel.prayer`. Renders a grid of prayer cells
 * (icon + name) with visual state for unlocked/active/locked, plus a
 * top strip showing points remaining. Toggling, drain, and overhead
 * prayer effects stay in the hand-coded `PrayerPanel.tsx`.
 */

import { memo } from "react";
import {
  FONT_STACK,
  INSET_BG,
  INSET_BG_SOFT,
  INSET_SHADOW_SOFT,
  PANEL_BG,
  PANEL_BORDER,
  SLOT_EMPTY_BG,
  SLOT_FILLED_BG,
  STATE_SUCCESS,
  STATE_WARNING,
  TEXT_ACCENT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "./widgetStyles";

export interface PrayerRow {
  id: string;
  name: string;
  icon: string;
  levelRequired: number;
  drainRate: number;
  active: boolean;
  unlocked: boolean;
}

export interface PrayerProps {
  points: number;
  maxPoints: number;
  columns: number;
  items?: ReadonlyArray<PrayerRow>;
}

// R3.P13 — empty fallback. Earlier versions hardcoded
// Hyperia-specific prayer ids (`thick_skin`, `burst_of_strength`,
// etc.) so the widget would render with content even when no
// `items` were bound; that hardcoded a Hyperia gameplay model
// into a generic widget. Now the consumer is expected to pass
// `items` from its game's data source — empty `items` renders
// an empty grid with the points header visible (which is the
// honest behavior: "you haven't bound any prayers yet").
const FALLBACK: ReadonlyArray<PrayerRow> = [];

export const PrayerWidget = memo(function PrayerWidget({
  points,
  maxPoints,
  columns,
  items,
}: PrayerProps) {
  const cols = Math.max(1, columns);
  const rows = items && items.length > 0 ? items : FALLBACK;
  const pct = maxPoints > 0 ? Math.min(1, Math.max(0, points / maxPoints)) : 0;

  return (
    <div
      role="region"
      aria-label="Prayer"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minWidth: 200,
        minHeight: 200,
        padding: 4,
        background: PANEL_BG,
        border: `1px solid ${PANEL_BORDER}`,
        borderRadius: 6,
        fontFamily: FONT_STACK,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 6px",
          marginBottom: 4,
          background: INSET_BG_SOFT,
          borderRadius: 4,
          boxShadow: INSET_SHADOW_SOFT,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>🙏</span>
          <span
            style={{
              color: TEXT_MUTED,
              fontSize: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Prayer
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 80,
              height: 6,
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: 0,
              overflow: "hidden",
              border: "1px solid rgba(14, 165, 233, 0.3)",
              boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div
              style={{
                width: `${pct * 100}%`,
                height: "100%",
                background: "#0ea5e9",
                transition: "width 0.2s ease-out",
              }}
            />
          </div>
          <span
            style={{
              color: TEXT_PRIMARY,
              fontSize: 10,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              minWidth: 36,
              textAlign: "right",
            }}
          >
            {Math.round(points)}/{maxPoints}
          </span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 3,
          padding: 4,
          background: INSET_BG,
          borderRadius: 4,
          boxShadow: INSET_SHADOW_SOFT,
          overflow: "auto",
        }}
      >
        {rows.map((row) => {
          const tint = row.active
            ? STATE_SUCCESS
            : row.unlocked
              ? TEXT_ACCENT
              : STATE_WARNING;
          return (
            <div
              key={row.id}
              title={`${row.name} (Lv ${row.levelRequired})`}
              style={{
                aspectRatio: "1 / 1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                padding: 2,
                background: row.unlocked ? SLOT_FILLED_BG : SLOT_EMPTY_BG,
                border: `1px solid ${tint}55`,
                borderRadius: 4,
                boxShadow: row.active
                  ? `0 0 8px ${tint}66, inset 0 1px 2px rgba(0, 0, 0, 0.35)`
                  : "inset 0 1px 2px rgba(0, 0, 0, 0.35)",
                opacity: row.unlocked ? 1 : 0.45,
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{row.icon}</span>
              <span
                style={{
                  fontSize: 7,
                  color: TEXT_SECONDARY,
                  letterSpacing: 0.3,
                  textAlign: "center",
                  lineHeight: 1.1,
                }}
              >
                {row.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
