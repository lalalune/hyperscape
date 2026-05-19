/**
 * Design Tokens - hs-kit UI Design System
 *
 * Single source of truth for all design values used in hs-kit.
 * Based on UI_UX_DESIGN_SYSTEM.md specifications.
 *
 * Design Philosophy:
 * - 8px base unit system (Material Design / iOS HIG standard)
 * - 1.25x modular typographic scale
 * - WCAG 2.1 AA accessibility compliance
 * - Touch-first design (≥48dp touch targets)
 * - Dark mode standard for gaming
 */

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
    /** Fantasy/medieval headers - Cinzel for tile-based MMORPG aesthetic */
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

  /** Panel shadow with golden glow (tile-based MMORPG aesthetic) */
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
