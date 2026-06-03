/**
 * Theme System for Hyperia UI
 *
 * Two theme variants:
 * - base: Clean, minimal dark theme
 * - hyperia: RS3-inspired dark theme with gold/bronze accents and glassmorphism
 *
 * Based on Runescape 3 visual design specifications.
 *
 * @packageDocumentation
 */

import type React from "react";

export type ShellControlButtonStyle = React.CSSProperties & {
  "--shell-button-hover-bg": string;
  "--shell-button-hover-fg": string;
};

/** Complete theme interface */
export interface Theme {
  /** Theme identifier */
  name: "base" | "hyperia";

  /** Color palette */
  colors: {
    background: {
      primary: string;
      secondary: string;
      tertiary: string;
      overlay: string;
      glass: string;
      /** Semi-transparent panel background (primary) - use for panel containers */
      panelPrimary: string;
      /** Semi-transparent panel background (secondary) - use for panel sections */
      panelSecondary: string;
      /** Hover state background */
      hover: string;
    };
    text: {
      primary: string;
      secondary: string;
      muted: string;
      disabled: string;
      link: string;
      accent: string;
    };
    border: {
      default: string;
      hover: string;
      active: string;
      focus: string;
      decorative: string;
    };
    accent: {
      primary: string;
      secondary: string;
      hover: string;
      active: string;
      /** Gold accent color */
      gold: string;
    };
    state: {
      success: string;
      warning: string;
      danger: string;
      info: string;
    };
    status: {
      hp: string;
      hpBackground: string;
      prayer: string;
      prayerBackground: string;
      adrenaline: string;
      adrenalineBackground: string;
      energy: string;
      energyBackground: string;
    };
    slot: {
      empty: string;
      filled: string;
      hover: string;
      selected: string;
      disabled: string;
    };
  };

  /** Spacing scale (8px grid) */
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    grid: number;
  };

  /** Typography */
  typography: {
    fontFamily: {
      body: string;
      heading: string;
      mono: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      xxl: string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };

  /** Border radius */
  borderRadius: {
    none: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: string;
  };

  /** Box shadows */
  shadows: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    window: string;
    glow: string;
  };

  /** Z-index layers */
  zIndex: {
    base: number;
    dropdown: number;
    sticky: number;
    window: number;
    overlay: number;
    modal: number;
    popover: number;
    tooltip: number;
  };

  /** Transitions */
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };

  /** Glassmorphism settings */
  glass: {
    blur: number;
    opacity: number;
    borderOpacity: number;
  };

  /** Panel/window specific styles */
  panel: {
    headerHeight: number;
    borderWidth: number;
    minWidth: number;
    minHeight: number;
  };

  /** Slot grid specific styles (inventory, action bar) */
  slot: {
    size: number;
    gap: number;
    borderRadius: number;
    iconSize: number;
  };

  /** Window system configuration */
  window: {
    /** Resize handle size in pixels */
    resizeHandleSize: number;
    /** Corner resize handle size in pixels */
    resizeCornerSize: number;
    /** Edge snap threshold in pixels */
    edgeSnapThreshold: number;
    /** Alignment guide snap threshold in pixels */
    guideSnapThreshold: number;
  };
}

/**
 * Base Theme
 * Clean, minimal dark theme with modern aesthetics
 */
export const baseTheme: Theme = {
  name: "base",

  colors: {
    background: {
      primary: "#1c1c20", // Slightly lighter base
      secondary: "#32323a", // Much lighter for contrast
      tertiary: "#4e4e58", // Significantly lighter for clear separation
      overlay: "rgba(0, 0, 0, 0.7)",
      glass: "rgba(28, 28, 32, 0.78)",
      panelPrimary: "rgba(35, 35, 42, 0.75)", // Lighter panel background
      panelSecondary: "rgba(58, 58, 68, 0.75)", // Much more visible panel section
      hover: "#2a2a32", // Hover state background
    },
    text: {
      primary: "#fafafa", // Zinc-50
      secondary: "#b8b8c0", // Brighter secondary
      muted: "#8888a0", // Lighter muted
      disabled: "#606068", // Lighter disabled
      link: "#70b0ff", // Brighter blue
      accent: "#70b0ff",
    },
    border: {
      default: "#606068", // Much lighter for visibility
      hover: "#808090", // Lighter
      active: "#a0a0b0", // Lighter
      focus: "#70b0ff", // Brighter blue
      decorative: "#606068", // Lighter for visibility
    },
    accent: {
      primary: "#3b82f6", // Blue-500
      secondary: "#60a5fa", // Blue-400
      hover: "#2563eb", // Blue-600
      active: "#1d4ed8", // Blue-700
      gold: "#f59e0b", // Amber-500
    },
    state: {
      success: "#22c55e", // Green-500
      warning: "#f59e0b", // Amber-500
      danger: "#ef4444", // Red-500
      info: "#3b82f6", // Blue-500
    },
    status: {
      hp: "#ef4444",
      hpBackground: "#450a0a",
      prayer: "#3b82f6",
      prayerBackground: "#172554",
      adrenaline: "#f59e0b",
      adrenalineBackground: "#451a03",
      energy: "#22c55e",
      energyBackground: "#14532d",
    },
    slot: {
      empty: "#24242a", // Lighter for visibility
      filled: "#38383e", // Much lighter for contrast
      hover: "#50505a", // Lighter hover state
      selected: "#686870", // Lighter selected state
      disabled: "#18181c", // Slightly lighter disabled
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    grid: 8,
  },

  typography: {
    fontFamily: {
      body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      heading:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, monospace',
    },
    fontSize: {
      xs: "10px",
      sm: "12px",
      base: "14px",
      lg: "16px",
      xl: "20px",
      xxl: "24px",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  borderRadius: {
    none: 0,
    sm: 2,
    md: 4,
    lg: 8,
    xl: 12,
    full: "9999px",
  },

  shadows: {
    none: "none",
    sm: "0 1px 2px rgba(0, 0, 0, 0.3)",
    md: "0 4px 6px rgba(0, 0, 0, 0.4)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.5)",
    xl: "0 20px 25px rgba(0, 0, 0, 0.6)",
    window: "0 8px 32px rgba(0, 0, 0, 0.5)",
    glow: "0 0 20px rgba(74, 158, 255, 0.3)",
  },

  zIndex: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    window: 400,
    overlay: 800,
    modal: 1200,
    popover: 1300,
    tooltip: 1100,
  },

  transitions: {
    fast: "100ms ease",
    normal: "200ms ease",
    slow: "300ms ease",
  },

  glass: {
    blur: 12,
    opacity: 0.85,
    borderOpacity: 0.3,
  },

  panel: {
    headerHeight: 32,
    borderWidth: 1,
    minWidth: 260,
    minHeight: 195,
  },

  slot: {
    size: 36,
    gap: 4,
    borderRadius: 4,
    iconSize: 32,
  },

  window: {
    resizeHandleSize: 8,
    resizeCornerSize: 12,
    edgeSnapThreshold: 15,
    guideSnapThreshold: 10,
  },
};

/**
 * Hyperia Theme
 * RS3-inspired dark theme with gold/bronze accents and enhanced glassmorphism
 * Updated with more polished color palette for modern game UI
 */
export const hyperiaTheme: Theme = {
  name: "hyperia",

  colors: {
    background: {
      primary: "#0c0d10",
      secondary: "#171a1f",
      tertiary: "#252b33",
      overlay: "rgba(0, 0, 0, 0.75)",
      glass: "rgba(16, 18, 22, 0.84)",
      panelPrimary: "rgba(23, 26, 31, 0.84)",
      panelSecondary: "rgba(33, 39, 47, 0.9)",
      hover: "#2f3741",
    },
    text: {
      primary: "#efe9dd",
      secondary: "#d2ccc2",
      muted: "#9c978e",
      disabled: "#555555",
      link: "#c6b18d",
      accent: "#d7c7ab",
    },
    border: {
      default: "#3c444f",
      hover: "#57616d",
      active: "#738090",
      focus: "#b8a07a",
      decorative: "#5b6673",
    },
    accent: {
      primary: "#a89473",
      secondary: "#c6b18d",
      hover: "#b8a07a",
      active: "#8e7a59",
      gold: "#bea57b",
    },
    state: {
      success: "#4ade80", // Modern green
      warning: "#fbbf24", // Bright amber
      danger: "#f87171", // Soft red
      info: "#60a5fa", // Soft blue
    },
    status: {
      hp: "#dc2626", // Vibrant red
      hpBackground: "#2d0a0a",
      prayer: "#3b82f6", // Bright blue
      prayerBackground: "#0d1a2d",
      adrenaline: "#d4a84b", // Gold
      adrenalineBackground: "#2d2000",
      energy: "#22c55e", // Bright green
      energyBackground: "#0d2d0d",
    },
    slot: {
      empty: "#15181d",
      filled: "#242931",
      hover: "#303743",
      selected: "#53483a",
      disabled: "#0d0f13",
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    grid: 8,
  },

  typography: {
    fontFamily: {
      body: '"Rubik", -apple-system, BlinkMacSystemFont, sans-serif',
      heading: '"Rubik", -apple-system, BlinkMacSystemFont, sans-serif',
      mono: '"SF Mono", "Fira Code", monospace',
    },
    fontSize: {
      xs: "10px",
      sm: "12px",
      base: "14px",
      lg: "16px",
      xl: "20px",
      xxl: "24px",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  borderRadius: {
    none: 0,
    sm: 2,
    md: 4,
    lg: 6,
    xl: 8,
    full: "9999px",
  },

  shadows: {
    none: "none",
    sm: "0 1px 2px rgba(0, 0, 0, 0.4)",
    md: "0 6px 12px rgba(0, 0, 0, 0.54)",
    lg: "0 12px 24px rgba(0, 0, 0, 0.64)",
    xl: "0 22px 44px rgba(0, 0, 0, 0.74)",
    window:
      "0 18px 42px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(93, 103, 116, 0.24)",
    glow: "0 0 18px rgba(190, 165, 123, 0.16)",
  },

  zIndex: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    window: 400,
    overlay: 800,
    modal: 1200,
    popover: 1300,
    tooltip: 1100,
  },

  transitions: {
    fast: "100ms ease",
    normal: "200ms ease",
    slow: "300ms ease",
  },

  glass: {
    blur: 16,
    opacity: 0.8,
    borderOpacity: 0.4,
  },

  panel: {
    headerHeight: 28,
    borderWidth: 1,
    minWidth: 260,
    minHeight: 195,
  },

  slot: {
    size: 36,
    gap: 2,
    borderRadius: 2,
    iconSize: 32,
  },

  window: {
    resizeHandleSize: 8,
    resizeCornerSize: 12,
    edgeSnapThreshold: 15,
    guideSnapThreshold: 10,
  },
};

/** All available themes */
export const themes = {
  base: baseTheme,
  hyperia: hyperiaTheme,
  // Legacy aliases
  dark: baseTheme,
  light: baseTheme, // No light theme in game context
} as const;

/** Theme name type */
export type ThemeName = "base" | "hyperia";

// Legacy exports for backwards compatibility
export const darkTheme = baseTheme;
export const lightTheme = baseTheme;

/**
 * Get glassmorphism style for a theme
 */
export function getThemedGlassmorphismStyle(
  theme: Theme,
  transparency: number = 0,
): React.CSSProperties {
  const baseOpacity = theme.glass.opacity;
  const alpha = baseOpacity * (1 - transparency / 100);

  return {
    // Use specific pattern to avoid ReDoS: match decimal number before closing paren
    // Pattern: digits, optionally followed by decimal point and more digits, then )
    backgroundColor: theme.colors.background.glass.replace(
      /(\d+(?:\.\d+)?)\)$/,
      `${alpha})`,
    ),
    backdropFilter: `blur(${theme.glass.blur}px)`,
    WebkitBackdropFilter: `blur(${theme.glass.blur}px)`,
    borderColor: theme.colors.border.default,
  };
}

/**
 * Get window shadow for a theme
 */
export function getThemedWindowShadow(
  theme: Theme,
  state: "normal" | "focused" | "dragging" = "normal",
): string {
  switch (state) {
    case "focused":
      return `${theme.shadows.lg}, 0 0 0 1px ${theme.colors.border.focus}`;
    case "dragging":
      return theme.shadows.xl;
    default:
      return theme.shadows.window;
  }
}

/**
 * Shared elevated surface style for premium HUD panels and windows.
 * Keeps panel treatments consistent across the live game UI.
 */
export function getPanelSurfaceStyle(
  theme: Theme,
  options?: {
    transparency?: number;
    emphasis?: "normal" | "strong";
    interactive?: boolean;
  },
): React.CSSProperties {
  const transparency = options?.transparency ?? 0;
  const emphasis = options?.emphasis ?? "normal";
  const interactive = options?.interactive ?? false;
  const glassStyle = getThemedGlassmorphismStyle(theme, transparency);
  const borderColor =
    emphasis === "strong"
      ? theme.colors.border.decorative
      : theme.colors.border.default;

  return {
    ...glassStyle,
    position: "relative",
    border: `1px solid ${borderColor}`,
    borderRadius: theme.borderRadius.lg,
    backgroundImage:
      theme.name === "hyperia"
        ? `linear-gradient(180deg, rgba(255, 255, 255, 0.065) 0%, rgba(255, 255, 255, 0.022) 18%, rgba(0, 0, 0, 0.1) 100%),
           radial-gradient(circle at top right, rgba(190, 165, 123, 0.045), transparent 28%),
           radial-gradient(circle at bottom left, rgba(93, 103, 116, 0.075), transparent 34%),
           repeating-linear-gradient(135deg, rgba(255,255,255,0.01) 0, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 6px),
           linear-gradient(180deg, ${theme.colors.background.panelSecondary}ee 0%, ${theme.colors.background.panelPrimary}fb 100%)`
        : `linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 24%, rgba(0, 0, 0, 0.06) 100%),
           linear-gradient(180deg, ${theme.colors.background.panelSecondary}d9 0%, ${theme.colors.background.panelPrimary}f2 100%)`,
    boxShadow:
      emphasis === "strong"
        ? `${theme.shadows.window}, inset 0 1px 0 rgba(255, 255, 255, 0.085), inset 0 0 0 1px rgba(255, 255, 255, 0.024), inset 0 -18px 30px rgba(0, 0, 0, 0.16)`
        : `${theme.shadows.md}, inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -10px 16px rgba(0, 0, 0, 0.1)`,
    color: theme.colors.text.primary,
    transition: interactive ? theme.transitions.fast : undefined,
  };
}

/**
 * Shared header chrome used by tabs and modal/window shells.
 */
export function getPanelHeaderStyle(theme: Theme): React.CSSProperties {
  return {
    background:
      theme.name === "hyperia"
        ? `linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 48%),
           radial-gradient(circle at top right, rgba(190, 165, 123, 0.055), transparent 34%),
           linear-gradient(90deg, rgba(255,255,255,0.012) 0%, transparent 12%, transparent 88%, rgba(255,255,255,0.01) 100%),
           linear-gradient(180deg, ${theme.colors.background.secondary} 0%, ${theme.colors.background.tertiary} 100%)`
        : `linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 56%),
           linear-gradient(180deg, ${theme.colors.background.secondary} 0%, ${theme.colors.background.primary} 100%)`,
    borderBottom: `1px solid ${theme.colors.border.default}`,
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.065), inset 0 -1px 0 rgba(0, 0, 0, 0.36)",
  };
}

/**
 * Shared tab style to keep window tabs readable and consistent.
 */
export function getTabStyle(
  theme: Theme,
  options: {
    active: boolean;
    dragging?: boolean;
  },
): React.CSSProperties {
  const active = options.active;
  const dragging = options.dragging ?? false;

  return {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.xs,
    minHeight: 32,
    padding: `0 6px`,
    ...getTabChromeStyle(theme, {
      isActive: active,
      isDragging: dragging,
    }),
    color: active ? theme.colors.text.primary : theme.colors.text.secondary,
    transition: theme.transitions.fast,
    userSelect: "none",
  };
}

export interface WindowSurfaceOptions {
  transparency?: number;
  state?: "normal" | "focused" | "dragging";
}

export interface TabBarChromeOptions {
  isDropTarget?: boolean;
  isPotentialDropTarget?: boolean;
  isSourceDragging?: boolean;
}

export interface TabChromeOptions {
  isActive: boolean;
  isDragging?: boolean;
}

type ShellButtonVariant = "neutral" | "danger" | "accent";

/**
 * Get the premium window surface style used by desktop shell windows.
 */
export function getWindowSurfaceStyle(
  theme: Theme,
  options: WindowSurfaceOptions = {},
): React.CSSProperties {
  const transparency = options.transparency ?? 0;
  const state = options.state ?? "normal";
  const baseOpacity = theme.glass.opacity;
  const alpha = baseOpacity * (1 - transparency / 100);
  const borderColor =
    state === "focused"
      ? theme.colors.border.focus
      : theme.colors.border.default;
  const shadow = getThemedWindowShadow(theme, state);
  const accentGlow =
    theme.name === "hyperia"
      ? `0 0 0 1px rgba(190, 165, 123, ${state === "dragging" ? 0.12 : 0.06})`
      : "none";

  return {
    backgroundColor: theme.colors.background.glass.replace(
      /(\d+(?:\.\d+)?)\)$/,
      `${alpha})`,
    ),
    backgroundImage:
      theme.name === "hyperia"
        ? `linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.022) 28%, rgba(0, 0, 0, 0.12) 100%),
           radial-gradient(circle at top right, rgba(190, 165, 123, 0.045), transparent 34%),
           radial-gradient(circle at bottom left, rgba(93, 103, 116, 0.06), transparent 34%),
           repeating-linear-gradient(135deg, rgba(255,255,255,0.008) 0, rgba(255,255,255,0.008) 1px, transparent 1px, transparent 7px)`
        : "linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 42%, rgba(0, 0, 0, 0.08) 100%)",
    backdropFilter: `blur(${theme.glass.blur}px) saturate(1.08)`,
    WebkitBackdropFilter: `blur(${theme.glass.blur}px) saturate(1.08)`,
    border: `1px solid ${borderColor}`,
    borderRadius: theme.borderRadius.md,
    boxShadow: `${shadow}, inset 0 1px 0 rgba(255, 255, 255, 0.09), inset 0 -18px 32px rgba(0, 0, 0, 0.12), ${accentGlow}`,
  };
}

/**
 * Get the desktop tab bar chrome style used across the premium shell.
 */
export function getTabBarChromeStyle(
  theme: Theme,
  options: TabBarChromeOptions = {},
): React.CSSProperties {
  const {
    isDropTarget = false,
    isPotentialDropTarget = false,
    isSourceDragging = false,
  } = options;

  let borderBottomColor = theme.colors.border.default;
  let shadow = "inset 0 -1px 0 rgba(0, 0, 0, 0.18)";

  if (isDropTarget) {
    borderBottomColor = theme.colors.accent.primary;
    shadow = `inset 0 -1px 0 ${theme.colors.accent.primary}, inset 0 1px 0 rgba(255, 255, 255, 0.08)`;
  } else if (isPotentialDropTarget) {
    borderBottomColor = theme.colors.border.hover;
  }

  return {
    backgroundColor: theme.colors.background.secondary,
    backgroundImage:
      theme.name === "hyperia"
        ? "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.018) 22%, rgba(0, 0, 0, 0.11) 100%), radial-gradient(circle at top right, rgba(190, 165, 123, 0.04), transparent 28%), repeating-linear-gradient(90deg, rgba(255,255,255,0.01) 0, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 18px)"
        : "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 100%)",
    borderBottom: `1px solid ${borderBottomColor}`,
    boxShadow: `${shadow}, inset 0 1px 0 rgba(255, 255, 255, 0.06)`,
    minHeight: 36,
    opacity: isSourceDragging ? 0.72 : 1,
  };
}

/**
 * Get the chrome style for an individual tab.
 */
export function getTabChromeStyle(
  theme: Theme,
  options: TabChromeOptions,
): React.CSSProperties {
  const { isActive, isDragging = false } = options;

  return {
    backgroundColor: isActive
      ? theme.colors.background.secondary
      : "rgba(255, 255, 255, 0.01)",
    backgroundImage: isActive
      ? "linear-gradient(180deg, rgba(255, 255, 255, 0.082) 0%, rgba(255, 255, 255, 0.022) 38%, rgba(0, 0, 0, 0.08) 100%)"
      : "linear-gradient(180deg, rgba(255, 255, 255, 0.028) 0%, rgba(255, 255, 255, 0.01) 100%)",
    borderRight: `1px solid ${isActive ? theme.colors.border.hover : theme.colors.border.default}`,
    borderBottom: isActive
      ? `1px solid ${theme.colors.accent.primary}`
      : "1px solid transparent",
    borderTop: `1px solid ${isActive ? "rgba(255, 255, 255, 0.14)" : "transparent"}`,
    borderTopLeftRadius: theme.borderRadius.sm,
    borderTopRightRadius: theme.borderRadius.sm,
    boxShadow: isActive
      ? "inset 0 1px 0 rgba(255, 255, 255, 0.09), 0 -1px 0 rgba(0, 0, 0, 0.08)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.025)",
    opacity: isDragging ? 0.5 : 1,
  };
}

/**
 * Get shell button style for tab bars and other window controls.
 */
export function getShellControlButtonStyle(
  theme: Theme,
  variant: ShellButtonVariant = "neutral",
): ShellControlButtonStyle {
  const palette =
    variant === "danger"
      ? {
          fg: theme.colors.text.muted,
          bg: "rgba(255, 255, 255, 0.025)",
          hoverBg: theme.colors.state.danger,
          hoverFg: theme.colors.text.primary,
        }
      : variant === "accent"
        ? {
            fg: theme.colors.text.secondary,
            bg: "rgba(255, 255, 255, 0.025)",
            hoverBg: `${theme.colors.accent.primary}2A`,
            hoverFg: theme.colors.accent.primary,
          }
        : {
            fg: theme.colors.text.muted,
            bg: "rgba(255, 255, 255, 0.02)",
            hoverBg: theme.colors.background.tertiary,
            hoverFg: theme.colors.text.primary,
          };

  return {
    width: 24,
    height: 24,
    border: `1px solid rgba(255, 255, 255, 0.05)`,
    background: palette.bg,
    color: palette.fg,
    cursor: "pointer",
    borderRadius: theme.borderRadius.sm,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    flexShrink: 0,
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -8px 12px rgba(0, 0, 0, 0.18)",
    transition: `color ${theme.transitions.fast}, background-color ${theme.transitions.fast}, border-color ${theme.transitions.fast}, transform ${theme.transitions.fast}`,
    "--shell-button-hover-bg": palette.hoverBg,
    "--shell-button-hover-fg": palette.hoverFg,
  };
}

/**
 * Get slot style for inventory/action bar items
 */
export function getSlotStyle(
  theme: Theme,
  state: "empty" | "filled" | "hover" | "selected" | "disabled" = "empty",
): React.CSSProperties {
  return {
    width: theme.slot.size,
    height: theme.slot.size,
    borderRadius: theme.slot.borderRadius,
    backgroundColor: theme.colors.slot[state],
    border: `1px solid ${theme.colors.border.default}`,
    transition: theme.transitions.fast,
  };
}

export function getPanelInsetStyle(
  theme: Theme,
  options?: {
    emphasis?: "normal" | "strong";
    padding?: number | string;
    radius?: number;
  },
): React.CSSProperties {
  const emphasis = options?.emphasis ?? "normal";

  return {
    background:
      theme.name === "hyperia"
        ? emphasis === "strong"
          ? "linear-gradient(180deg, rgba(255, 255, 255, 0.045) 0%, rgba(255, 255, 255, 0.016) 16%, rgba(0, 0, 0, 0.12) 100%), radial-gradient(circle at top right, rgba(190, 165, 123, 0.035), transparent 26%), repeating-linear-gradient(135deg, rgba(255,255,255,0.008) 0, rgba(255,255,255,0.008) 1px, transparent 1px, transparent 8px), linear-gradient(180deg, rgba(31, 35, 42, 0.98) 0%, rgba(18, 21, 26, 0.99) 100%)"
          : "linear-gradient(180deg, rgba(255, 255, 255, 0.032) 0%, rgba(255, 255, 255, 0.012) 18%, rgba(0, 0, 0, 0.1) 100%), repeating-linear-gradient(135deg, rgba(255,255,255,0.006) 0, rgba(255,255,255,0.006) 1px, transparent 1px, transparent 9px), linear-gradient(180deg, rgba(27, 31, 38, 0.96) 0%, rgba(17, 20, 25, 0.98) 100%)"
        : theme.colors.background.panelPrimary,
    border: `1px solid ${emphasis === "strong" ? theme.colors.border.decorative : `${theme.colors.border.default}66`}`,
    borderRadius: options?.radius ?? theme.borderRadius.md,
    boxShadow:
      emphasis === "strong"
        ? `${theme.shadows.md}, inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -12px 18px rgba(0, 0, 0, 0.14)`
        : `${theme.shadows.sm}, inset 0 1px 0 rgba(255, 255, 255, 0.04), inset 0 -10px 16px rgba(0, 0, 0, 0.1)`,
    padding: options?.padding,
  };
}

export function getHudClusterSurfaceStyle(
  theme: Theme,
  options?: {
    active?: boolean;
    radius?: number;
    padding?: number | string;
  },
): React.CSSProperties {
  const active = options?.active ?? false;

  return {
    background:
      theme.name === "hyperia"
        ? active
          ? "linear-gradient(180deg, rgba(255, 255, 255, 0.075) 0%, rgba(255, 255, 255, 0.026) 18%, rgba(0, 0, 0, 0.18) 100%), radial-gradient(circle at top center, rgba(226, 213, 184, 0.08), transparent 44%), linear-gradient(180deg, rgba(34, 39, 47, 0.9) 0%, rgba(17, 20, 25, 0.92) 100%)"
          : "linear-gradient(180deg, rgba(255, 255, 255, 0.065) 0%, rgba(255, 255, 255, 0.02) 20%, rgba(0, 0, 0, 0.16) 100%), radial-gradient(circle at top center, rgba(226, 213, 184, 0.055), transparent 42%), linear-gradient(180deg, rgba(32, 37, 45, 0.86) 0%, rgba(16, 19, 24, 0.88) 100%)"
        : theme.colors.background.panelPrimary,
    border: `1px solid ${active ? theme.colors.border.hover : `${theme.colors.border.default}72`}`,
    borderRadius: options?.radius ?? theme.borderRadius.md,
    boxShadow: active
      ? `${theme.shadows.md}, inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -12px 18px rgba(0,0,0,0.16)`
      : `${theme.shadows.sm}, inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -10px 16px rgba(0,0,0,0.14)`,
    backdropFilter: `blur(${Math.max(6, theme.glass.blur - 2)}px)`,
    padding: options?.padding,
  };
}

export function getContextMenuSurfaceStyle(
  theme: Theme,
  options?: {
    minWidth?: number | string;
    radius?: number;
  },
): React.CSSProperties {
  return {
    ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
    background:
      theme.name === "hyperia"
        ? "linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.022) 18%, rgba(0, 0, 0, 0.18) 100%), radial-gradient(circle at top right, rgba(226, 213, 184, 0.08), transparent 34%), linear-gradient(180deg, rgba(37, 43, 52, 0.95) 0%, rgba(18, 22, 28, 0.97) 100%)"
        : theme.colors.background.panelPrimary,
    border: `1px solid ${theme.colors.border.hover}`,
    borderRadius: options?.radius ?? theme.borderRadius.md,
    boxShadow: `${theme.shadows.lg}, inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -16px 24px rgba(0,0,0,0.18)`,
    backdropFilter: `blur(${Math.max(8, theme.glass.blur)}px)`,
    overflow: "hidden",
    minWidth: options?.minWidth,
  };
}

export function getContextMenuItemStyle(
  theme: Theme,
  options?: {
    hovered?: boolean;
    active?: boolean;
    danger?: boolean;
    radius?: number;
    padding?: number | string;
  },
): React.CSSProperties {
  const hovered = options?.hovered ?? false;
  const active = options?.active ?? false;
  const danger = options?.danger ?? false;
  const accent = danger
    ? theme.colors.state.danger
    : theme.colors.accent.secondary;

  return {
    ...getPanelInsetStyle(theme, {
      emphasis: hovered || active ? "strong" : "normal",
      radius: options?.radius ?? 0,
      padding: options?.padding,
    }),
    background:
      hovered || active
        ? `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, ${accent}18 24%, rgba(21, 25, 31, 0.98) 100%)`
        : "transparent",
    border: "none",
    boxShadow:
      hovered || active
        ? `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 14px rgba(0,0,0,0.12)`
        : "none",
    color: danger ? theme.colors.state.danger : theme.colors.text.primary,
    transition:
      "background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
  };
}

export function getInteractiveTileStyle(
  theme: Theme,
  options?: {
    active?: boolean;
    hovered?: boolean;
    dragging?: boolean;
    disabled?: boolean;
    dropTarget?: boolean;
    radius?: number;
    accentColor?: string;
  },
): React.CSSProperties {
  const active = options?.active ?? false;
  const hovered = options?.hovered ?? false;
  const dragging = options?.dragging ?? false;
  const disabled = options?.disabled ?? false;
  const dropTarget = options?.dropTarget ?? false;
  const accentColor = options?.accentColor ?? theme.colors.accent.primary;

  const background = dropTarget
    ? `linear-gradient(180deg, ${accentColor}22 0%, rgba(23, 26, 31, 0.98) 100%)`
    : active
      ? `linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, ${accentColor}18 20%, rgba(25, 29, 35, 0.98) 100%)`
      : hovered
        ? "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.018) 20%, rgba(24, 28, 34, 0.99) 100%)"
        : "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.012) 18%, rgba(22, 26, 31, 0.99) 100%)";

  return {
    background,
    border: active
      ? `1px solid ${accentColor}B3`
      : dropTarget
        ? `2px solid ${accentColor}B3`
        : hovered
          ? `1px solid ${theme.colors.border.hover}`
          : `1px solid ${theme.colors.border.default}80`,
    borderRadius: options?.radius ?? theme.borderRadius.sm,
    boxShadow: active
      ? `0 0 10px ${accentColor}14, inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -8px 12px rgba(0, 0, 0, 0.14)`
      : dropTarget
        ? `0 0 8px ${accentColor}18, inset 0 1px 0 rgba(255, 255, 255, 0.05)`
        : "inset 0 1px 0 rgba(255, 255, 255, 0.04), inset 0 -8px 12px rgba(0, 0, 0, 0.14)",
    opacity: dragging ? 0.45 : disabled ? 0.5 : 1,
    transition:
      "transform 0.15s ease, opacity 0.15s ease, background 0.15s ease, border 0.15s ease, box-shadow 0.15s ease",
  };
}

/**
 * Get status bar gradient for HP, prayer, etc.
 */
export function getStatusBarGradient(
  theme: Theme,
  type: "hp" | "prayer" | "adrenaline" | "energy",
  fillPercent: number = 100,
): string {
  const color = theme.colors.status[type];
  const bgColor =
    theme.colors.status[
      `${type}Background` as keyof typeof theme.colors.status
    ];

  return `linear-gradient(to right, ${color} 0%, ${color} ${fillPercent}%, ${bgColor} ${fillPercent}%, ${bgColor} 100%)`;
}

/**
 * Get decorative panel border style (RS3-style bronze border)
 */
export function getDecorativeBorderStyle(theme: Theme): React.CSSProperties {
  if (theme.name === "hyperia") {
    return {
      border: `1px solid ${theme.colors.border.decorative}`,
      boxShadow: `inset 0 0 0 1px rgba(139, 90, 43, 0.2), ${theme.shadows.window}`,
    };
  }
  return {
    border: `1px solid ${theme.colors.border.default}`,
    boxShadow: theme.shadows.window,
  };
}
