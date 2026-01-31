/**
 * Color System - Hyperscape UI Theme
 *
 * RuneScape-inspired color palette with modern glass morphism.
 * All colors meet WCAG 2.1 AA contrast requirements.
 *
 * @see /development-docs/UI_UX_DESIGN_SYSTEM.md
 */

/**
 * Core Color Palette - Dark Theme
 * Matches hyperscapeTheme for consistency
 */
export const COLORS = {
  // ===========================================
  // BRAND / ACCENT COLORS
  // ===========================================

  /** Primary accent - Rich classic gold */
  ACCENT: "#d4a84b",
  /** Lighter accent variant - Bright gold highlight */
  ACCENT_LIGHT: "#ffd866",
  /** Darker accent variant */
  ACCENT_DARK: "#c49530",
  /** Chat-specific accent */
  CHAT_ACCENT: "#e8c55a",

  // ===========================================
  // BACKGROUND COLORS (Hyperscape Theme)
  // ===========================================

  /** Primary panel background - Matches hyperscapeTheme.colors.background.primary */
  BG_PRIMARY: "#0f0f12",
  /** Secondary background - Matches hyperscapeTheme.colors.background.secondary */
  BG_SECONDARY: "#22222a",
  /** Tertiary/accent background - Matches hyperscapeTheme.colors.background.tertiary */
  BG_TERTIARY: "#363640",
  /** Solid dark background */
  BG_SOLID: "#0f0f12",
  /** Elevated surface */
  BG_ELEVATED: "#22222a",
  /** Overlay/inset background */
  BG_OVERLAY: "rgba(0, 0, 0, 0.75)",

  // ===========================================
  // BORDER COLORS (Hyperscape Theme)
  // ===========================================

  /** Primary border - Matches hyperscapeTheme.colors.border.default */
  BORDER_PRIMARY: "#4d4540",
  /** Secondary/subtle border - Hover state */
  BORDER_SECONDARY: "#6a5f50",
  /** Accent border (gold) - Active state */
  BORDER_ACCENT: "#8b7a60",
  /** Focus ring color - Matches hyperscapeTheme.colors.border.focus */
  BORDER_FOCUS: "#f0d060",

  // ===========================================
  // TEXT COLORS
  // ===========================================

  /** Primary text - Warm white */
  TEXT_PRIMARY: "#f5f0e8",
  /** Secondary text - Muted gold */
  TEXT_SECONDARY: "#c4b896",
  /** Muted text - Subtle brown */
  TEXT_MUTED: "#7d7460",
  /** Disabled text */
  TEXT_DISABLED: "#454545",
  /** Inverted text (for light backgrounds) */
  TEXT_INVERTED: "#0a0a0c",

  // ===========================================
  // SEMANTIC / STATUS COLORS
  // ===========================================

  /** Success state - Modern green */
  SUCCESS: "#4ade80",
  /** Success dark variant */
  SUCCESS_DARK: "#22c55e",
  /** Error state - Soft red */
  ERROR: "#f87171",
  /** Error dark variant */
  ERROR_DARK: "#dc2626",
  /** Warning state - Bright amber */
  WARNING: "#fbbf24",
  /** Warning dark variant */
  WARNING_DARK: "#f59e0b",
  /** Info state - Soft blue */
  INFO: "#60a5fa",
  /** Info dark variant */
  INFO_DARK: "#3b82f6",

  // ===========================================
  // INTERACTIVE STATES (Hyperscape Theme)
  // ===========================================

  /** Hover overlay - Matches hyperscapeTheme.colors.slot.hover */
  HOVER: "#3a3844",
  /** Active/pressed overlay - Matches hyperscapeTheme.colors.slot.selected */
  ACTIVE: "#5a5248",
  /** Disabled overlay */
  DISABLED: "#101012",
  /** Selection highlight */
  SELECTION: "#5a5248",
} as const;

/**
 * Gradient Definitions - Dark Theme
 */
export const GRADIENTS = {
  /** Panel background gradient - Hyperscape theme */
  PANEL: "linear-gradient(135deg, #0f0f12 0%, #1a1a20 50%, #0f0f12 100%)",

  /** Header gradient - Hyperscape theme */
  HEADER: "linear-gradient(180deg, #22222a 0%, #1a1a20 100%)",

  /** Button gradient - Gold accent */
  BUTTON: "linear-gradient(135deg, #d4a84b 0%, #c49530 100%)",

  /** Button hover gradient */
  BUTTON_HOVER: "linear-gradient(135deg, #e8be5a 0%, #d4a84b 100%)",

  /** Decorative divider - Gold */
  DIVIDER:
    "linear-gradient(90deg, transparent, #d4a84b40 14%, #ffd86699 50%, #d4a84b40 86%, transparent)",

  /** Success gradient */
  SUCCESS: "linear-gradient(180deg, #4ade80 0%, #22c55e 100%)",

  /** Error gradient */
  ERROR: "linear-gradient(180deg, #f87171 0%, #dc2626 100%)",

  /** Gold shimmer (for rare items) */
  GOLD_SHIMMER:
    "linear-gradient(135deg, #d4a84b 0%, #ffd866 50%, #d4a84b 100%)",

  /** Purple shimmer (for epic items) */
  PURPLE_SHIMMER:
    "linear-gradient(135deg, #a855f7 0%, #c084fc 50%, #a855f7 100%)",
} as const;

// Type exports
export type ColorKey = keyof typeof COLORS;
export type GradientKey = keyof typeof GRADIENTS;
