/**
 * Tactical Command Design Tokens
 *
 * Dual-theme system: Royal Command (Light) & Shadow Ops (Dark)
 * Industrial Command aesthetic with thin borders and bracket corners
 */

export const colors = {
  // Royal Command (Light Theme)
  light: {
    // Backgrounds
    "bg-primary": "#FAF8F5", // Cream
    "bg-secondary": "#F5F3F0", // Pearl
    "bg-tertiary": "#EFEDE8", // Bone
    "bg-card": "#FFFFFF", // White
    "bg-hover": "#EFEDE8", // Bone
    "bg-elevated": "#FFFFFF", // White

    // Text
    "text-primary": "#1A1A1E", // Ink
    "text-secondary": "#4A4A52", // Graphite
    "text-tertiary": "#6B6B75", // Stone
    "text-muted": "#9A9AA5", // Ash

    // Borders
    "border-primary": "#D1CCC4", // Stone
    "border-secondary": "#E5E2DC", // Pebble
    "border-hover": "#B8B3AA", // Clay

    // Accents
    "accent-primary": "#2E5BBA", // Sapphire
    "accent-secondary": "#C9A227", // Gold
    "accent-tertiary": "#1E3A5F", // Deep Navy
  },

  // Shadow Ops (Dark Theme)
  dark: {
    // Backgrounds
    "bg-primary": "#1A1A1E", // Charcoal
    "bg-secondary": "#252529", // Slate
    "bg-tertiary": "#2F2F35", // Obsidian
    "bg-card": "#252529", // Slate
    "bg-hover": "#2F2F35", // Obsidian
    "bg-elevated": "#35353D", // Steel

    // Text
    "text-primary": "#FAF8F5", // Cream
    "text-secondary": "#B8B8C0", // Silver
    "text-tertiary": "#8A8A95", // Pewter
    "text-muted": "#5A5A65", // Smoke

    // Borders
    "border-primary": "#3A3A40", // Graphite
    "border-secondary": "#45454D", // Charcoal
    "border-hover": "#55555D", // Steel

    // Accents
    "accent-primary": "#DC2626", // Ruby
    "accent-secondary": "#C9A227", // Gold
    "accent-tertiary": "#F59E0B", // Amber
  },

  // Semantic Colors (same for both themes)
  semantic: {
    success: "#10B981",
    "success-light": "#34D399",
    "success-dark": "#059669",
    "success-bg-light": "rgba(16, 185, 129, 0.1)",
    "success-bg-dark": "rgba(16, 185, 129, 0.15)",

    warning: "#F59E0B",
    "warning-light": "#FBBF24",
    "warning-dark": "#D97706",
    "warning-bg-light": "rgba(245, 158, 11, 0.1)",
    "warning-bg-dark": "rgba(245, 158, 11, 0.15)",

    error: "#EF4444",
    "error-light": "#F87171",
    "error-dark": "#DC2626",
    "error-bg-light": "rgba(239, 68, 68, 0.1)",
    "error-bg-dark": "rgba(239, 68, 68, 0.15)",

    info: "#3B82F6",
    "info-light": "#60A5FA",
    "info-dark": "#2563EB",
    "info-bg-light": "rgba(59, 130, 246, 0.1)",
    "info-bg-dark": "rgba(59, 130, 246, 0.15)",
  },

  // Utility
  utility: {
    white: "#FFFFFF",
    black: "#000000",
    transparent: "transparent",
  },
} as const;

export const spacing = {
  0: "0",
  px: "1px",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  3.5: "0.875rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "1.75rem",
  8: "2rem",
  9: "2.25rem",
  10: "2.5rem",
  12: "3rem",
  14: "3.5rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  32: "8rem",
  40: "10rem",
  48: "12rem",
  56: "14rem",
  64: "16rem",
} as const;

export const borderRadius = {
  none: "0",
  sm: "0.25rem", // 4px - Tactical sharp
  DEFAULT: "0.375rem", // 6px
  md: "0.5rem", // 8px
  lg: "0.75rem", // 12px
  xl: "1rem", // 16px
  full: "9999px",
} as const;

export const typography = {
  fontFamily: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: '"Outfit", "Inter", sans-serif',
    mono: '"JetBrains Mono", "SF Mono", "Monaco", monospace',
  },
  fontSize: {
    xs: ["0.75rem", { lineHeight: "1rem" }],
    sm: ["0.875rem", { lineHeight: "1.25rem" }],
    base: ["1rem", { lineHeight: "1.5rem" }],
    lg: ["1.125rem", { lineHeight: "1.75rem" }],
    xl: ["1.25rem", { lineHeight: "1.75rem" }],
    "2xl": ["1.5rem", { lineHeight: "2rem" }],
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
    "5xl": ["3rem", { lineHeight: "1" }],
  },
  fontWeight: {
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

export const effects = {
  boxShadow: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    DEFAULT:
      "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
    xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
    none: "none",
    // Tactical glow effects
    "glow-ruby": "0 0 20px rgba(220, 38, 38, 0.3)",
    "glow-sapphire": "0 0 20px rgba(46, 91, 186, 0.3)",
    "glow-gold": "0 0 20px rgba(201, 162, 39, 0.3)",
  },
} as const;

export const animation = {
  duration: {
    instant: "0ms",
    fast: "150ms",
    base: "200ms",
    slow: "300ms",
    slower: "500ms",
  },
  easing: {
    linear: "linear",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

export const layout = {
  sidebar: {
    collapsed: "64px",
    expanded: "256px",
  },
  topbar: {
    height: "64px",
  },
} as const;

// CSS Variable generator for theme switching
export function generateCSSVariables(theme: "light" | "dark") {
  const themeColors = theme === "light" ? colors.light : colors.dark;

  return {
    "--bg-primary": themeColors["bg-primary"],
    "--bg-secondary": themeColors["bg-secondary"],
    "--bg-tertiary": themeColors["bg-tertiary"],
    "--bg-card": themeColors["bg-card"],
    "--bg-hover": themeColors["bg-hover"],
    "--bg-elevated": themeColors["bg-elevated"],

    "--text-primary": themeColors["text-primary"],
    "--text-secondary": themeColors["text-secondary"],
    "--text-tertiary": themeColors["text-tertiary"],
    "--text-muted": themeColors["text-muted"],

    "--border-primary": themeColors["border-primary"],
    "--border-secondary": themeColors["border-secondary"],
    "--border-hover": themeColors["border-hover"],

    "--accent-primary": themeColors["accent-primary"],
    "--accent-secondary": themeColors["accent-secondary"],
    "--accent-tertiary": themeColors["accent-tertiary"],

    // Semantic
    "--color-success": colors.semantic.success,
    "--color-warning": colors.semantic.warning,
    "--color-error": colors.semantic.error,
    "--color-info": colors.semantic.info,
  };
}

export const theme = {
  colors,
  spacing,
  borderRadius,
  typography,
  effects,
  animation,
  layout,
} as const;
