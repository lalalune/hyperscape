/**
 * Mobile UI Style Constants
 *
 * Shared constants for mobile-optimized panel layouts.
 * Used by panels to provide consistent touch-friendly sizing across the mobile UI.
 *
 * Design Guidelines:
 * - Touch targets: minimum 48px (Google Material Design)
 * - Visual clarity: larger icons, readable text
 * - Space efficiency: compact layouts that maximize content
 *
 * @packageDocumentation
 */

import { INVENTORY_CONSTANTS } from "@hyperforge/shared";

/** Minimum touch target size (48px per Material Design guidelines) */
export const MOBILE_TOUCH_TARGET = 48;

/** Slot size for inventory/equipment grids on mobile */
export const MOBILE_SLOT_SIZE = 48;

/** Default icon size for mobile UI elements */
export const MOBILE_ICON_SIZE = 24;

/** Larger icon size for emphasis (prayers, skills) */
export const MOBILE_ICON_SIZE_LG = 32;

/** Health/prayer bar heights on mobile (thicker for visibility) */
export const MOBILE_BAR_HEIGHT = {
  /** Primary bar (player health) */
  primary: 16,
  /** Secondary bar (target health) */
  secondary: 12,
  /** Thin bar (XP progress, prayer drain) */
  thin: 8,
} as const;

/** Spacing values for mobile layouts */
export const MOBILE_SPACING = {
  /** Extra small: 4px */
  xs: 4,
  /** Small: 8px */
  sm: 8,
  /** Medium: 12px */
  md: 12,
  /** Large: 16px */
  lg: 16,
  /** Extra large: 20px */
  xl: 20,
} as const;

/** Inventory grid configuration for mobile - matches desktop OSRS 4x7 layout */
export const MOBILE_INVENTORY_GRID = {
  /** Number of columns in mobile inventory (4 like OSRS) */
  columns: 4,
  /** Number of rows in mobile inventory (7 like OSRS) */
  rows: 7,
  /** Total slots (4 * 7 = 28, OSRS standard) */
  totalSlots: INVENTORY_CONSTANTS.MAX_INVENTORY_SLOTS,
  /** Gap between slots */
  gap: 3,
} as const;

/** Equipment panel configuration for mobile */
export const MOBILE_EQUIPMENT = {
  /** Number of columns in mobile equipment grid (3-column OSRS paperdoll) */
  columns: 3,
  /** Slot height */
  slotHeight: 52,
  /** Gap between slots */
  gap: 6,
  /** Padding inside panel */
  padding: 6,
} as const;

/** Skills panel configuration for mobile - matches desktop 3-column layout */
export const MOBILE_SKILLS = {
  /** Number of columns in mobile skills grid (4 to match prayer panel) */
  columns: 4,
  /** Minimum card height - compact like desktop */
  cardHeight: 32,
  /** Gap between cards */
  gap: 4,
  /** Icon size in skill cards */
  iconSize: 14,
} as const;

/** Prayer panel configuration for mobile */
export const MOBILE_PRAYER = {
  /** Prayer icon size on mobile */
  iconSize: 40,
  /** Maximum columns on mobile */
  maxColumns: 4,
  /** Minimum columns on mobile (force 4-wide layout) */
  minColumns: 4,
  /** Gap between prayer icons */
  gap: 4,
  /** Prayer points bar height */
  barHeight: 14,
} as const;

/** Combat panel configuration for mobile - more compact */
export const MOBILE_COMBAT = {
  /** Player health bar height - slightly reduced */
  healthBarHeight: 12,
  /** Target health bar height */
  targetBarHeight: 10,
  /** Attack style button height - reduced for compact layout */
  styleButtonHeight: 44,
} as const;

/** Menu bar configuration for mobile */
export const MOBILE_MENUBAR = {
  /** Grid columns for menu buttons */
  columns: 3,
  /** Button size (icon + label) */
  buttonSize: 72,
  /** Gap between buttons */
  gap: 12,
} as const;

/** Chat panel configuration for mobile */
export const MOBILE_CHAT = {
  /** Compact tab bar height */
  tabBarHeight: 36,
  /** Tab button size (icon-only) */
  tabButtonSize: 32,
  /** Input field height */
  inputHeight: 44,
} as const;

/** Type definitions for mobile style constants */
export type MobileSpacing = keyof typeof MOBILE_SPACING;
export type MobileBarHeight = keyof typeof MOBILE_BAR_HEIGHT;
