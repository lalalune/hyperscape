/**
 * Design Tokens - Hyperscape UI Design System
 *
 * Single source of truth for all design values.
 * Based on UI_UX_DESIGN_SYSTEM.md specifications (January 2026).
 *
 * Design Philosophy:
 * - 8px base unit system (Material Design / iOS HIG standard)
 * - 1.25x modular typographic scale
 * - WCAG 2.1 AA accessibility compliance
 * - Touch-first design (≥48dp touch targets)
 * - Dark mode standard for gaming
 *
 * @see /development-docs/UI_UX_DESIGN_SYSTEM.md
 */

import type { CSSProperties } from "react";
import { INVENTORY_CONSTANTS } from "@hyperscape/shared";

/**
 * Spacing - 8px Base Unit System
 *
 * All spacing values are multiples of 8px for consistent layouts.
 * Keys use T-shirt sizing for semantic meaning.
 */
export const spacing = {
  /** 0px */
  none: "0",
  /** 1px - pixel-perfect borders */
  px: "1px",
  /** 2px - 0.25 units */
  "2xs": "2px",
  /** 4px - 0.5 units */
  xs: "4px",
  /** 6px */
  "xs-sm": "6px",
  /** 8px - 1 unit (base) */
  sm: "8px",
  /** 10px */
  "sm-md": "10px",
  /** 12px - 1.5 units */
  md: "12px",
  /** 16px - 2 units */
  lg: "16px",
  /** 20px - 2.5 units */
  "lg-xl": "20px",
  /** 24px - 3 units */
  xl: "24px",
  /** 32px - 4 units */
  "2xl": "32px",
  /** 40px - 5 units */
  "3xl": "40px",
  /** 48px - 6 units (touch target minimum) */
  "4xl": "48px",
  /** 56px - 7 units (large touch target) */
  "5xl": "56px",
  /** 64px - 8 units */
  "6xl": "64px",
  /** 80px - 10 units */
  "7xl": "80px",
  /** 96px - 12 units */
  "8xl": "96px",
} as const;

/**
 * Typography - Modular Scale (1.25x ratio)
 *
 * Base size: 16px
 * Scale: Perfect fourth (1.25x)
 */
export const typography = {
  fontFamily: {
    /** Fantasy/medieval headers - Cinzel for RuneScape aesthetic */
    display: "'Cinzel', serif",
    /** UI body text - Inter for readability */
    body: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    /** Monospace for numbers, stats, code */
    mono: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
  },

  fontSize: {
    /** 10px - Tiny labels */
    "2xs": "10px",
    /** 12px - Small labels, captions */
    xs: "12px",
    /** 14px - Secondary text, descriptions */
    sm: "14px",
    /** 16px - Body text (base) */
    base: "16px",
    /** 18px - Large body */
    lg: "18px",
    /** 20px - Section headers */
    xl: "20px",
    /** 24px - Panel titles */
    "2xl": "24px",
    /** 30px - Major headers */
    "3xl": "30px",
    /** 36px - Hero text */
    "4xl": "36px",
    /** 48px - Display text */
    "5xl": "48px",
  },

  fontWeight: {
    /** 400 - Regular text */
    normal: "400",
    /** 500 - Slightly emphasized */
    medium: "500",
    /** 600 - Buttons, labels */
    semibold: "600",
    /** 700 - Headers, important */
    bold: "700",
  },

  lineHeight: {
    /** 1.0 - Single line (icons, badges) */
    none: "1",
    /** 1.2 - Tight (headers) */
    tight: "1.2",
    /** 1.4 - Snug (UI elements) */
    snug: "1.4",
    /** 1.5 - Normal (body text) */
    normal: "1.5",
    /** 1.75 - Relaxed (long-form) */
    relaxed: "1.75",
  },

  letterSpacing: {
    /** -0.02em - Tight (large headers) */
    tight: "-0.02em",
    /** 0 - Normal */
    normal: "0",
    /** 0.02em - Wide (small caps, labels) */
    wide: "0.02em",
    /** 0.05em - Wider (uppercase) */
    wider: "0.05em",
  },
} as const;

/**
 * Border Radius
 */
export const borderRadius = {
  /** 0 - Sharp corners */
  none: "0",
  /** 2px - Subtle rounding */
  xs: "2px",
  /** 4px - Small elements */
  sm: "4px",
  /** 8px - Standard (buttons, inputs) */
  md: "8px",
  /** 12px - Cards, panels */
  lg: "12px",
  /** 16px - Large panels */
  xl: "16px",
  /** 24px - Extra large (modals) */
  "2xl": "24px",
  /** 9999px - Fully round (pills, avatars) */
  full: "9999px",
} as const;

/**
 * Shadows - Glass Morphism Style
 *
 * Designed for dark UI with subtle depth cues.
 */
export const shadows = {
  /** No shadow */
  none: "none",
  /** Subtle elevation */
  xs: "0 1px 2px rgba(0, 0, 0, 0.2)",
  /** Small elevation */
  sm: "0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)",
  /** Medium elevation */
  md: "0 4px 6px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2)",
  /** Large elevation */
  lg: "0 10px 15px rgba(0, 0, 0, 0.5), 0 4px 6px rgba(0, 0, 0, 0.2)",
  /** Extra large elevation */
  xl: "0 20px 25px rgba(0, 0, 0, 0.6), 0 8px 10px rgba(0, 0, 0, 0.2)",

  /** Panel shadow with golden glow (RuneScape aesthetic) */
  panel: "0 8px 32px rgba(0, 0, 0, 0.6), 0 0 1px rgba(242, 208, 138, 0.2)",
  /** Panel hover state */
  panelHover:
    "0 12px 40px rgba(0, 0, 0, 0.7), 0 0 2px rgba(242, 208, 138, 0.3)",

  /** Inner shadow for depth */
  inner: "inset 0 2px 4px rgba(0, 0, 0, 0.3)",
  /** Subtle top highlight */
  innerGlow: "inset 0 1px 0 rgba(255, 255, 255, 0.1)",
} as const;

/**
 * Animation Timing
 *
 * Micro-interactions for functional feedback, not decoration.
 */
export const animation = {
  duration: {
    /** 0ms - Instant (state changes) */
    instant: "0ms",
    /** 100ms - Micro-interactions */
    fastest: "100ms",
    /** 150ms - Fast feedback */
    fast: "150ms",
    /** 200ms - Standard transitions */
    base: "200ms",
    /** 300ms - Moderate transitions */
    slow: "300ms",
    /** 500ms - Slow transitions (modals) */
    slower: "500ms",
  },

  easing: {
    /** Linear - Progress bars, loading */
    linear: "linear",
    /** Ease in - Elements leaving */
    easeIn: "cubic-bezier(0.4, 0, 1, 1)",
    /** Ease out - Elements entering */
    easeOut: "cubic-bezier(0, 0, 0.2, 1)",
    /** Ease in-out - Standard */
    easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    /** Bounce - Playful feedback */
    bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    /** Spring - Natural motion */
    spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },
} as const;

/**
 * Z-Index Hierarchy
 *
 * Organized layer system to prevent z-index wars.
 */
export const zIndex = {
  /** 0 - Base layer (game world) */
  base: 0,
  /** 10 - Slightly elevated elements */
  raised: 10,
  /** 100 - Dropdowns, popovers */
  dropdown: 100,
  /** 200 - Sticky headers */
  sticky: 200,
  /** 300 - Sidebar panels */
  sidebar: 300,
  /** 400 - Floating panels */
  panel: 400,
  /** 500 - Active/focused panels */
  panelActive: 500,
  /** 600 - Chat overlay */
  chat: 600,
  /** 800 - Overlays, backdrops */
  overlay: 800,
  /** 999 - Modal backdrop */
  modalBackdrop: 999,
  /** 1000 - Modal content */
  modal: 1000,
  /** 1100 - Tooltips */
  tooltip: 1100,
  /** 1200 - Toast notifications */
  toast: 1200,
  /** 1300 - Context menus */
  contextMenu: 1300,
  /** 10000 - Death screen, critical overlays */
  critical: 10000,

  // Mobile HUD layers (7000-8000 range, above desktop panels but below modals)
  /** 7000 - Mobile status HUD (HP/Prayer orbs) */
  mobileStatusHud: 7000,
  /** 7200 - Mobile minimap and radial menu */
  mobileMinimap: 7200,
  /** 7500 - Mobile action bar */
  mobileActionBar: 7500,
  /** 7800 - Mobile chat overlay */
  mobileChatOverlay: 7800,
  /** 8000 - Mobile navigation/drawer */
  mobileDrawer: 8000,
} as const;

/**
 * Breakpoints - Mobile-First Responsive Design
 *
 * Values in pixels for use with matchMedia or CSS.
 */
export const breakpoints = {
  /** 0px - Mobile portrait (320px+) */
  xs: 0,
  /** 480px - Mobile landscape */
  sm: 480,
  /** 640px - Large mobile / small tablet */
  md: 640,
  /** 768px - Tablet portrait */
  lg: 768,
  /** 1024px - Tablet landscape / desktop */
  xl: 1024,
  /** 1280px - Desktop wide */
  "2xl": 1280,
  /** 1536px - Ultrawide */
  "3xl": 1536,
} as const;

/**
 * Touch Target Sizes - Accessibility Compliance
 *
 * Google Material: 48x48dp minimum
 * Apple HIG: 44x44pt minimum
 * Industry standard: ≥48px with ≥8px spacing
 */
export const touchTargets = {
  /** 36px - Desktop only (precise mouse) */
  xs: "36px",
  /** 40px - Small (desktop, compact UI) */
  sm: "40px",
  /** 44px - Apple HIG minimum */
  apple: "44px",
  /** 48px - Google Material minimum (standard) */
  md: "48px",
  /** 56px - Large (primary actions) */
  lg: "56px",
  /** 64px - Extra large (critical actions) */
  xl: "64px",
} as const;

/**
 * Game-Specific UI Dimensions
 *
 * Pre-calculated sizes for common game UI elements.
 */
export const gameUI = {
  /** Inventory configuration (grid layout: 7 columns × 4 rows = 28 slots) */
  inventory: {
    slots: INVENTORY_CONSTANTS.MAX_INVENTORY_SLOTS,
    columns: 7, // 7 slots across (horizontal)
    rows: 4, // 4 slots down (vertical)
    slotSize: "48px",
    slotGap: "4px",
  },

  /** Action bar configuration (horizontal bar at bottom of screen) */
  actionBar: {
    /** Minimum number of slots user can configure */
    minSlots: 4,
    /** Maximum number of slots user can configure (RS3 has 14, we use 12) */
    maxSlots: 12,
    /** Default number of slots */
    defaultSlots: 9,
    /** Slots displayed per page (for paged action panels) */
    slotsPerPage: 7,
    /** Total pages/bars available */
    totalPages: 4,
    /** Size of each action slot in pixels (compact) */
    slotSize: "30px",
    /** Gap between slots in pixels */
    slotGap: "2px",
    /** Padding around the slot container */
    padding: "3px",
    /** Size of +/- control buttons */
    controlButtonSize: "16px",
  },

  /** Equipment panel */
  equipment: {
    slots: 11,
    slotSize: "56px",
  },

  /** Skills display */
  skills: {
    count: 9,
    iconSize: "32px",
    barHeight: "8px",
  },

  /** Status bars (health, prayer, stamina) */
  statusBars: {
    width: "180px",
    height: "24px",
    iconSize: "20px",
  },

  /** Minimap */
  minimap: {
    desktop: "220px",
    mobile: "180px",
    pipSize: "6px",
  },

  /** Chat panel */
  chat: {
    maxHeight: "300px",
    inputHeight: "40px",
    messageGap: "4px",
  },

  /**
   * Scrollbar Configuration
   *
   * Unified scrollbar styling for consistent UI across all panels.
   * Three variants: hidden, thin (6px), and thick (8px).
   */
  scrollbar: {
    /** Thin scrollbar (6px) - default for most panels */
    thin: {
      width: "6px",
      borderRadius: "3px",
    },
    /** Thick scrollbar (8px) - for inventory/bank style grids */
    thick: {
      width: "8px",
      borderRadius: "4px",
    },
    /** Color variants */
    colors: {
      /** Gold theme - matches primary UI accent */
      gold: {
        thumb: "rgba(242, 208, 138, 0.5)",
        thumbHover: "rgba(242, 208, 138, 0.8)",
        track: "transparent",
      },
      /** Brown theme - matches panel borders */
      brown: {
        thumb: "rgba(139, 69, 19, 0.6)",
        thumbHover: "rgba(139, 69, 19, 0.8)",
        track: "rgba(0, 0, 0, 0.3)",
      },
    },
  },
} as const;

/**
 * Item Rarity Colors - Standard MMO System
 *
 * Includes both color and icon for colorblind accessibility.
 */
export const rarityColors = {
  common: { color: "#9CA3AF", icon: "○", name: "Common" },
  uncommon: { color: "#22C55E", icon: "◆", name: "Uncommon" },
  rare: { color: "#3B82F6", icon: "★", name: "Rare" },
  epic: { color: "#A855F7", icon: "✦", name: "Epic" },
  legendary: { color: "#F59E0B", icon: "❖", name: "Legendary" },
} as const;

/**
 * Skill Colors - For XP Orbs and Skill Indicators
 */
export const skillColors = {
  attack: "#DC2626",
  strength: "#EAB308",
  defense: "#3B82F6",
  constitution: "#22C55E",
  ranged: "#10B981",
  woodcutting: "#84CC16",
  fishing: "#06B6D4",
  firemaking: "#F97316",
  cooking: "#F472B6",
  mining: "#9CA3AF",
} as const;

/**
 * Status Bar Gradients
 */
export const statusColors = {
  health: {
    fill: "linear-gradient(180deg, #EF4444 0%, #DC2626 100%)",
    background: "rgba(185, 28, 28, 0.3)",
  },
  stamina: {
    fill: "linear-gradient(180deg, #22C55E 0%, #16A34A 100%)",
    background: "rgba(22, 163, 74, 0.3)",
  },
  prayer: {
    fill: "linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)",
    background: "rgba(37, 99, 235, 0.3)",
  },
} as const;

/**
 * Panel Styles - Unified Component Styling
 *
 * Base styles for all panel components to ensure consistency.
 * Use these instead of hardcoding styles in individual panels.
 */
export const panelStyles = {
  /** Base container for all panels - Hyperscape theme (RS3-inspired dark with bronze accents) */
  container: {
    background: "#0f0f12", // Matches hyperscapeTheme.colors.background.primary
    border: "1px solid #4d4540",
    borderRadius: "8px",
    boxShadow:
      "0 4px 12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(212, 168, 75, 0.1)",
  },

  /** Section within a panel (like a card) - Hyperscape theme */
  section: {
    background: "#1a1a20", // Slightly lighter than container for depth
    border: "1px solid #4d4540",
    borderRadius: "6px",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 2px 4px rgba(0, 0, 0, 0.3)",
  },

  /** Grid item (inventory slot, skill box, etc.) - Hyperscape theme */
  gridItem: {
    background: "#1a1a20", // Matches hyperscapeTheme.colors.slot.empty
    border: "1px solid #4d4540",
    borderRadius: "4px",
    boxShadow:
      "inset 1px 1px 0 rgba(255, 255, 255, 0.03), inset -1px -1px 0 rgba(0, 0, 0, 0.3)",
  },

  /** Interactive element (button, clickable item) - Gold accent */
  interactive: {
    background: "linear-gradient(135deg, #d4a84b 0%, #c49530 100%)",
    border: "1px solid #e8c55a",
    borderRadius: "6px",
    boxShadow:
      "0 2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 216, 102, 0.3)",
  },

  /** Hover state for interactive elements */
  interactiveHover: {
    background: "linear-gradient(135deg, #e8be5a 0%, #d4a84b 100%)",
    boxShadow:
      "0 3px 6px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 216, 102, 0.4)",
  },

  /** Active/selected state */
  active: {
    background:
      "linear-gradient(135deg, rgba(74, 222, 128, 0.2) 0%, rgba(74, 222, 128, 0.1) 100%)",
    border: "1px solid rgba(74, 222, 128, 0.6)",
    boxShadow: "0 0 8px rgba(74, 222, 128, 0.3), 0 2px 4px rgba(0, 0, 0, 0.4)",
  },

  /** Disabled state */
  disabled: {
    background: "#101012", // Slightly darker than primary
    border: "1px solid #4d4540",
    opacity: "0.6",
  },

  /** Input field styling - Hyperscape theme */
  input: {
    background: "#0f0f12", // Matches container background
    border: "1px solid #4d4540",
    borderRadius: "4px",
    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.4)",
  },

  /** Tab styling - Hyperscape theme */
  tab: {
    inactive: {
      background: "#1a1a20",
      border: "1px solid #4d4540",
      color: "#9a8d78", // Matches hyperscapeTheme.colors.text.muted
    },
    active: {
      background: "#22222a", // Matches hyperscapeTheme.colors.background.secondary
      border: "1px solid #6a5f50",
      color: "#d4a84b", // Matches hyperscapeTheme.colors.accent.primary
    },
  },

  /** Divider/separator - Hyperscape theme */
  divider: {
    background: "linear-gradient(90deg, transparent, #4d4540, transparent)",
    height: "1px",
  },

  /** Label styling */
  label: {
    color: "#7d7460",
    fontSize: "12px",
    fontWeight: "500",
    letterSpacing: "0.02em",
    textTransform: "uppercase" as const,
  },

  /** Value/stat styling - Gold accent */
  value: {
    color: "#d4a84b",
    fontSize: "14px",
    fontWeight: "600",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
  },

  /** Title styling within panels - Gold accent */
  sectionTitle: {
    color: "#d4a84b",
    fontSize: "13px",
    fontWeight: "600",
    letterSpacing: "0.02em",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
    borderBottom: "1px solid #2d2820",
    paddingBottom: "8px",
    marginBottom: "12px",
  },

  /** Tooltip styling - Dark theme */
  tooltip: {
    background: "#0a0a0c",
    border: "1px solid #4a3f30",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.7)",
    padding: "8px 12px",
  },
} as const;

/**
 * Panel style names that are NOT tab-like (don't have active/inactive nested states).
 * Used to narrow the parameter type of getPanelStyle.
 * Only excludes entries that have BOTH "active" AND "inactive" properties (true nested-state objects).
 */
type NonTabPanelName = {
  [K in keyof typeof panelStyles]: (typeof panelStyles)[K] extends {
    active: unknown;
    inactive: unknown;
  }
    ? never
    : K;
}[keyof typeof panelStyles];

/**
 * Get CSS-in-JS style object from panel style.
 * Note: For tab styles (which have "active"/"inactive" states), use getTabStyle() instead.
 *
 * The NonTabPanelName type already excludes tab-style entries at compile time.
 * A runtime check is retained for JavaScript callers, but logs a warning instead of throwing.
 */
export function getPanelStyle(styleName: NonTabPanelName): CSSProperties {
  const style = panelStyles[styleName];
  if (typeof style === "object") {
    // Runtime safety for JS callers - warn but don't throw
    if ("active" in style && "inactive" in style) {
      console.warn(
        `getPanelStyle("${styleName}") contains nested states (active/inactive). ` +
          `Use getTabStyle("active") or getTabStyle("inactive") instead.`,
      );
    }
    return style as CSSProperties;
  }
  return {};
}

/**
 * Get CSS-in-JS style object for tab states.
 * Use this for panelStyles.tab which has "active" and "inactive" sub-styles.
 */
export function getTabStyle(state: "active" | "inactive"): CSSProperties {
  return panelStyles.tab[state] as CSSProperties;
}

/**
 * Parse a spacing token value to a numeric pixel value.
 * Handles strings like "24px", "1.5rem", or plain numbers.
 *
 * **Accepted inputs:**
 * - Numbers: returned as-is (if finite)
 * - Numeric strings: "24px", "16", etc. - parsed to number
 * - "rem" units: converted to pixels using remBase (default 16px, e.g., "1.5rem" → 24)
 *
 * **Fallback behavior:**
 * Returns the provided `fallback` value when:
 * - Input is NaN or non-finite
 * - Parsing fails (invalid string format)
 *
 * **Note:** "em" units are NOT supported because they require contextual
 * font-size information which is not available at parse time.
 *
 * @param value - The spacing token value (e.g., "24px", "1.5rem", 24)
 * @param fallback - Fallback value if parsing fails (default: 0)
 * @param remBase - Base pixel size for rem conversion (default: 16). Pass a custom
 *   value if the project uses a non-standard root font size.
 * @returns Numeric pixel value
 */
export function parseTokenToNumber(
  value: string | number,
  fallback: number = 0,
  remBase: number = 16,
): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  // Handle rem values using provided remBase
  if (value.endsWith("rem")) {
    return parsed * remBase;
  }
  return parsed;
}

// Type exports for TypeScript consumers
export type Spacing = keyof typeof spacing;
export type FontSize = keyof typeof typography.fontSize;
export type FontWeight = keyof typeof typography.fontWeight;
export type LineHeight = keyof typeof typography.lineHeight;
export type LetterSpacing = keyof typeof typography.letterSpacing;
export type BorderRadius = keyof typeof borderRadius;
export type Shadow = keyof typeof shadows;
export type ZIndex = keyof typeof zIndex;
export type Breakpoint = keyof typeof breakpoints;
export type TouchTarget = keyof typeof touchTargets;
export type Rarity = keyof typeof rarityColors;
export type Skill = keyof typeof skillColors;
export type PanelStyleName = keyof typeof panelStyles;
