/**
 * SkillsWidget — schema-driven skills panel adapter.
 *
 * Matches the `hyperforge.panel.skills` widget schema from
 * `@hyperforge/ui-framework/builtins`. Renders a `columns`-wide grid
 * of skill cards (icon + slanted current/base level display) with an
 * optional header strip showing Total / Combat levels.
 *
 * Live data flows in via `items`, `total`, and `combatLevel` bindings
 * projected from the `$skills.*` namespace in `dataContext.ts`.
 * Drag-to-action-bar, tooltips with XP progress, and the Skill Guide
 * modal stay in the hand-coded `SkillsPanel.tsx` until runtime
 * interaction hooks arrive.
 */

import { memo } from "react";

export interface SkillRow {
  key: string;
  label: string;
  icon: string;
  level: number;
  xp: number;
}

export interface SkillsProps {
  columns: number;
  showHeader: boolean;
  total: number;
  combatLevel: number;
  items?: ReadonlyArray<SkillRow>;
}

// Visual tokens chosen to mirror `SkillsPanel.tsx` desktop mode.
const PANEL_BG = "rgba(20, 21, 24, 0.95)";
const PANEL_BORDER = "rgba(255, 255, 255, 0.15)";
const HEADER_INSET_BG = "rgba(0, 0, 0, 0.3)";
const GRID_INSET_BG = "rgba(0, 0, 0, 0.4)";
const GRID_INSET_SHADOW = "inset 0 2px 8px rgba(0, 0, 0, 0.55)";
const CARD_BG =
  "linear-gradient(180deg, rgba(40, 44, 52, 0.9) 0%, rgba(24, 26, 32, 0.95) 100%)";
const CARD_BORDER = "rgba(255, 255, 255, 0.18)";
const TEXT_ACCENT = "#fbbf24";
const TEXT_MUTED = "#636577";
const TEXT_DISABLED = "#4a4c58";
const DANGER = "#dc2626";
const SUCCESS = "#22c55e";

// Fallback rows so the editor preview always has content. Kept small
// and intentionally generic — real play uses the live projection.
const FALLBACK_ROWS: ReadonlyArray<SkillRow> = [
  { key: "attack", label: "Attack", icon: "⚔", level: 1, xp: 0 },
  { key: "strength", label: "Strength", icon: "💪", level: 1, xp: 0 },
  { key: "defense", label: "Defense", icon: "🛡", level: 1, xp: 0 },
  { key: "ranged", label: "Ranged", icon: "🏹", level: 1, xp: 0 },
  { key: "magic", label: "Magic", icon: "✨", level: 1, xp: 0 },
  { key: "prayer", label: "Prayer", icon: "🙏", level: 1, xp: 0 },
  { key: "constitution", label: "HP", icon: "❤", level: 10, xp: 0 },
];

/** Slanted current-over-base level display. */
function LevelSplit({ level }: { level: number }) {
  const color = level >= 99 ? SUCCESS : TEXT_ACCENT;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        position: "relative",
        height: 13,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          lineHeight: 1,
          position: "relative",
          top: -2,
          textShadow: "1px 1px 1px rgba(0, 0, 0, 0.5)",
        }}
      >
        {level}
      </span>
      <span
        style={{
          fontSize: 8,
          color: TEXT_DISABLED,
          lineHeight: 1,
          margin: "0 1px",
          transform: "rotate(-20deg)",
          display: "inline-block",
        }}
      >
        /
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          lineHeight: 1,
          position: "relative",
          top: 2,
          textShadow: "1px 1px 1px rgba(0, 0, 0, 0.5)",
        }}
      >
        {level}
      </span>
    </div>
  );
}

export const SkillsWidget = memo(function SkillsWidget({
  columns,
  showHeader,
  total,
  combatLevel,
  items,
}: SkillsProps) {
  const cols = Math.max(1, columns);
  const rows = items && items.length > 0 ? items : FALLBACK_ROWS;

  return (
    <div
      role="region"
      aria-label="Skills"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minWidth: 200,
        minHeight: 160,
        padding: 4,
        background: PANEL_BG,
        border: `1px solid ${PANEL_BORDER}`,
        borderRadius: 6,
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {showHeader && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "3px 6px",
            marginBottom: 4,
            background: HEADER_INSET_BG,
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>⚔️</span>
            <div
              style={{
                fontSize: 8,
                color: TEXT_MUTED,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Skills
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 7,
                color: TEXT_MUTED,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                lineHeight: 1,
                marginBottom: 2,
                display: "flex",
                gap: 6,
                justifyContent: "center",
              }}
            >
              <span>Total</span>
              <span>Combat</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: 14,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: TEXT_ACCENT,
                  lineHeight: 1,
                  position: "relative",
                  top: -2,
                  textShadow: "1px 1px 1px rgba(0, 0, 0, 0.5)",
                }}
              >
                {total}
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: TEXT_DISABLED,
                  lineHeight: 1,
                  margin: "0 2px",
                  transform: "rotate(-20deg)",
                  display: "inline-block",
                }}
              >
                /
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: DANGER,
                  lineHeight: 1,
                  position: "relative",
                  top: 2,
                  textShadow: "1px 1px 1px rgba(0, 0, 0, 0.5)",
                }}
              >
                {combatLevel}
              </span>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 3,
          padding: 4,
          background: GRID_INSET_BG,
          borderRadius: 4,
          boxShadow: GRID_INSET_SHADOW,
          overflow: "hidden",
        }}
      >
        {rows.map((row) => (
          <div
            key={row.key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              minHeight: 24,
              padding: "2px 4px",
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 4,
              boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.35)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                filter: "drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.4))",
                lineHeight: 1,
              }}
            >
              {row.icon}
            </span>
            <LevelSplit level={row.level} />
          </div>
        ))}
      </div>
    </div>
  );
});
