/**
 * widgetStyles.ts — shared visual tokens for the schema-driven widget
 * adapters. Keeps the hand-coded panel language (dark surface,
 * hairline borders, inset shadows) expressible as cheap style objects
 * without a React theme subscription.
 *
 * These values intentionally mirror `ui/theme/themes.ts`
 * `getPanelSurfaceStyle(normal)` / `getPanelInsetStyle(strong)` for
 * the default dark theme. When the framework picks up theme CSS vars
 * at runtime, these constants swap to `var(--color-…)` tokens.
 */

import type { CSSProperties } from "react";

export const PANEL_BG = "rgba(20, 21, 24, 0.95)";
export const PANEL_BORDER = "rgba(255, 255, 255, 0.15)";
export const PANEL_SHADOW = "0 4px 12px rgba(0, 0, 0, 0.4)";

export const INSET_BG = "rgba(0, 0, 0, 0.4)";
export const INSET_BG_SOFT = "rgba(0, 0, 0, 0.3)";
export const INSET_SHADOW = "inset 0 2px 8px rgba(0, 0, 0, 0.55)";
export const INSET_SHADOW_SOFT = "inset 0 2px 6px rgba(0, 0, 0, 0.45)";

export const SLOT_EMPTY_BG = "rgba(255, 255, 255, 0.03)";
export const SLOT_EMPTY_BORDER = "rgba(255, 255, 255, 0.08)";
export const SLOT_FILLED_BG =
  "linear-gradient(180deg, rgba(40, 44, 52, 0.9) 0%, rgba(24, 26, 32, 0.95) 100%)";
export const SLOT_FILLED_BORDER = "rgba(255, 255, 255, 0.18)";
export const SLOT_INSET_SHADOW = "inset 0 1px 2px rgba(0, 0, 0, 0.35)";

export const TEXT_PRIMARY = "#e8e9ed";
export const TEXT_SECONDARY = "#9a9caa";
export const TEXT_MUTED = "#636577";
export const TEXT_DISABLED = "#4a4c58";
// Warm gold accent (highlighted numbers, badges). Hex matches
// Tailwind amber-400. R3.P13 of `PLAN_HYPERIA_DECOUPLING.md` —
// comment cleaned to drop the franchise reference; the value
// itself is theme-neutral and stays until runtime theme-token
// plumbing lands (separate phase).
export const TEXT_ACCENT = "#fbbf24";
export const TEXT_ACCENT_SECONDARY = "#a5b4fc";

export const STATE_SUCCESS = "#22c55e";
export const STATE_DANGER = "#dc2626";
export const STATE_WARNING = "#f59e0b";

export const FONT_STACK = "Inter, system-ui, sans-serif";

/** Base panel frame used by every panel-category widget. */
export function panelFrameStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    padding: 4,
    background: PANEL_BG,
    border: `1px solid ${PANEL_BORDER}`,
    borderRadius: 6,
    fontFamily: FONT_STACK,
    overflow: "hidden",
  };
}

/** Body section inside a panel frame: inset grid/list container. */
export function panelInsetStyle(): CSSProperties {
  return {
    flex: 1,
    padding: 4,
    background: INSET_BG,
    borderRadius: 4,
    boxShadow: INSET_SHADOW,
    overflow: "auto",
  };
}
