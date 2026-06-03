/**
 * Layout System - Hyperia UI Grid & Window Snapping
 *
 * Based on UI_UX_DESIGN_SYSTEM.md:
 * - 12-column responsive grid
 * - 8px base unit system
 * - Snap zones for window management
 *
 * @see /development-docs/UI_UX_DESIGN_SYSTEM.md
 */

import { breakpoints, spacing } from "./tokens";

/**
 * Grid Configuration
 *
 * 12-column grid with 16px gutters (2 base units)
 */
export const grid = {
  /** Number of columns */
  columns: 12,
  /** Gutter size between columns */
  gutter: "16px",
  /** Maximum container width */
  maxWidth: "1440px",
  /** Container padding */
  padding: {
    mobile: "8px",
    tablet: "16px",
    desktop: "24px",
  },
} as const;

/**
 * Reserved Areas
 *
 * Areas of the screen that are reserved for HUD elements and should not be covered by snap zones.
 */
export const reservedAreas = {
  /** Top-right: Minimap and menu buttons */
  minimap: {
    width: 280,
    height: 280,
    position: "top-right" as const,
  },
  /** Bottom-left: Chat window */
  chat: {
    width: 420,
    height: 320,
    position: "bottom-left" as const,
  },
} as const;

/**
 * Drop Zone Definition
 *
 * Defines a rectangular area where windows can snap to.
 * Percentages are relative to viewport dimensions.
 */
export type DropZoneDefinition = {
  id: string;
  label: string;
  /** Left edge as percentage of viewport width (0-100) */
  left: number;
  /** Top edge as percentage of viewport height (0-100) */
  top: number;
  /** Width as percentage of viewport width */
  width: number;
  /** Height as percentage of viewport height */
  height: number;
  /** Padding from edges in pixels */
  padding: number;
};

/**
 * Window Drop Zones
 *
 * Flexible drop zones for window snapping.
 * Zones are defined as viewport percentages with pixel padding.
 */
export const dropZones: DropZoneDefinition[] = [
  // Left column
  {
    id: "left-full",
    label: "Left",
    left: 0,
    top: 0,
    width: 33,
    height: 100,
    padding: 16,
  },
  {
    id: "left-top",
    label: "Top Left",
    left: 0,
    top: 0,
    width: 33,
    height: 50,
    padding: 16,
  },
  {
    id: "left-bottom",
    label: "Bottom Left",
    left: 0,
    top: 50,
    width: 33,
    height: 50,
    padding: 16,
  },
  // Center column
  {
    id: "center-full",
    label: "Center",
    left: 33,
    top: 0,
    width: 34,
    height: 100,
    padding: 16,
  },
  {
    id: "center-top",
    label: "Top Center",
    left: 33,
    top: 0,
    width: 34,
    height: 50,
    padding: 16,
  },
  {
    id: "center-bottom",
    label: "Bottom Center",
    left: 33,
    top: 50,
    width: 34,
    height: 50,
    padding: 16,
  },
  // Right column
  {
    id: "right-full",
    label: "Right",
    left: 67,
    top: 0,
    width: 33,
    height: 100,
    padding: 16,
  },
  {
    id: "right-top",
    label: "Top Right",
    left: 67,
    top: 0,
    width: 33,
    height: 50,
    padding: 16,
  },
  {
    id: "right-bottom",
    label: "Bottom Right",
    left: 67,
    top: 50,
    width: 33,
    height: 50,
    padding: 16,
  },
];

/**
 * Get the pixel bounds for a drop zone given the viewport dimensions.
 */
export function getDropZoneBounds(
  zone: DropZoneDefinition,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number; width: number; height: number } {
  const x = (zone.left / 100) * viewportWidth + zone.padding;
  const y = (zone.top / 100) * viewportHeight + zone.padding;
  // Clamp width/height to prevent negative values when padding exceeds computed size
  const rawWidth = (zone.width / 100) * viewportWidth - zone.padding * 2;
  const rawHeight = (zone.height / 100) * viewportHeight - zone.padding * 2;
  const width = Math.max(0, rawWidth);
  const height = Math.max(0, rawHeight);
  return { x, y, width, height };
}

/**
 * Check if a point is inside a drop zone, accounting for reserved areas.
 */
export function isPointInDropZone(
  pointX: number,
  pointY: number,
  zone: DropZoneDefinition,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  const bounds = getDropZoneBounds(zone, viewportWidth, viewportHeight);

  // Check if point is in zone bounds
  const inBounds =
    pointX >= bounds.x &&
    pointX <= bounds.x + bounds.width &&
    pointY >= bounds.y &&
    pointY <= bounds.y + bounds.height;

  if (!inBounds) return false;

  // Check if point is in reserved minimap area (top-right)
  const minimapLeft = viewportWidth - reservedAreas.minimap.width;
  const minimapMaxY = reservedAreas.minimap.height; // Bottom edge of top-anchored minimap
  if (pointX >= minimapLeft && pointY <= minimapMaxY) {
    return false;
  }

  // Check if point is in reserved chat area (bottom-left)
  const chatRight = reservedAreas.chat.width;
  const chatTop = viewportHeight - reservedAreas.chat.height;
  if (pointX <= chatRight && pointY >= chatTop) {
    return false;
  }

  return true;
}

/**
 * Find which drop zone a point is over, if any.
 * Returns the smallest matching zone (most specific).
 */
export function findDropZoneAtPoint(
  pointX: number,
  pointY: number,
  viewportWidth: number,
  viewportHeight: number,
): DropZoneDefinition | null {
  // Filter to zones that contain the point
  const matchingZones = dropZones.filter((zone) =>
    isPointInDropZone(pointX, pointY, zone, viewportWidth, viewportHeight),
  );

  if (matchingZones.length === 0) return null;

  // Return the smallest zone (most specific) - sort by area ascending
  // Use non-mutating sort to avoid modifying the filtered array
  const sortedZones = [...matchingZones].sort((a, b) => {
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    return areaA - areaB;
  });

  return sortedZones[0];
}

/**
 * Offset type for snap zones - supports both numeric (pixels) and string (percentages) values
 */
export type SnapZoneOffset = {
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
};

/**
 * Snap zone definition with anchor and offset
 */
export type SnapZoneDefinition = {
  anchor: string;
  offset: SnapZoneOffset;
};

/**
 * Legacy Window Snap Zones (kept for backwards compatibility)
 *
 * Pre-defined positions for window snapping.
 * Each zone specifies anchor point and offset from viewport edge.
 */
export const snapZones: Record<string, SnapZoneDefinition> = {
  /** Top-left corner (status bars, debug panel) */
  topLeft: {
    anchor: "top-left",
    offset: { top: 20, left: 24 },
  },
  /** Top-right corner (minimap, menu buttons) */
  topRight: {
    anchor: "top-right",
    offset: { top: 20, right: 24 },
  },
  /** Bottom-left corner (chat) */
  bottomLeft: {
    anchor: "bottom-left",
    offset: { bottom: 20, left: 24 },
  },
  /** Bottom-right corner */
  bottomRight: {
    anchor: "bottom-right",
    offset: { bottom: 20, right: 24 },
  },
  /** Center of screen (modals) */
  center: {
    anchor: "center",
    offset: { top: "50%", left: "50%" },
  },
  /** Left side (panels) */
  left: {
    anchor: "left",
    offset: { top: "50%", left: 24 },
  },
  /** Right side (panels) */
  right: {
    anchor: "right",
    offset: { top: "50%", right: 24 },
  },
};

/**
 * Window Size Presets
 *
 * Consistent window sizes based on content type.
 * All sizes are in pixels and respect 8px grid.
 */
export const windowSizes = {
  /** Small windows (settings toggles, simple panels) */
  small: {
    width: 320,
    minHeight: 200,
    maxHeight: 400,
  },
  /** Medium windows (inventory, skills) */
  medium: {
    width: 400,
    minHeight: 300,
    maxHeight: 552,
  },
  /** Large windows (equipment, dashboard) */
  large: {
    width: 520,
    minHeight: 400,
    maxHeight: 648,
  },
  /** Extra large windows (bank, quest log) */
  xlarge: {
    width: 680,
    minHeight: 448,
    maxHeight: 752,
  },
} as const;

/**
 * Known window IDs for type-safe window configuration
 */
export type WindowConfigId =
  | "inventory"
  | "equipment"
  | "skills"
  | "combat"
  | "settings"
  | "account"
  | "dashboard"
  | "debug";

/**
 * Window Configuration by ID
 *
 * Maps window identifiers to their default configuration.
 */
export const windowConfig: Record<
  WindowConfigId,
  {
    size: keyof typeof windowSizes;
    defaultZone: keyof typeof snapZones;
    title: string;
  }
> = {
  inventory: { size: "medium", defaultZone: "right", title: "Inventory" },
  equipment: { size: "large", defaultZone: "center", title: "Equipment" },
  skills: { size: "medium", defaultZone: "center", title: "Skills" },
  combat: { size: "medium", defaultZone: "left", title: "Combat" },
  settings: { size: "medium", defaultZone: "center", title: "Settings" },
  account: { size: "small", defaultZone: "center", title: "Account" },
  dashboard: { size: "large", defaultZone: "center", title: "Dashboard" },
  debug: { size: "small", defaultZone: "topLeft", title: "Debug" },
} as const;

/**
 * Calculate column span width
 *
 * @param columns - Number of columns to span (1-12)
 * @returns CSS width value
 */
export function getColumnWidth(columns: number): string {
  // Validate and clamp columns to valid range [1, grid.columns]
  const validColumns = Math.max(1, Math.min(Math.floor(columns), grid.columns));
  const percentage = (validColumns / grid.columns) * 100;
  // For multi-column spans, subtract (validColumns - 1) gutters for internal gaps
  // Single column spans don't need gutter subtraction
  if (validColumns === 1) {
    return `${percentage}%`;
  }
  return `calc(${percentage}% - (${validColumns - 1} * ${grid.gutter}))`;
}

/**
 * Get responsive container padding
 *
 * @param width - Current viewport width
 * @returns Padding value
 */
export function getContainerPadding(width: number): string {
  // Guard for invalid widths (NaN, negative, Infinity)
  if (!Number.isFinite(width) || width < 0) {
    return grid.padding.mobile;
  }
  // Mapping:
  // - width < breakpoints.lg (768px)  => mobile padding (8px)
  // - width >= breakpoints.lg && < breakpoints.xl (1024px) => tablet padding (16px)
  // - width >= breakpoints.xl => desktop padding (24px)
  if (width < breakpoints.lg) return grid.padding.mobile;
  if (width < breakpoints.xl) return grid.padding.tablet;
  return grid.padding.desktop;
}

/**
 * Panel Spacing Constants
 *
 * Consistent internal spacing for all panels.
 */
export const panelSpacing = {
  /** Padding inside panel header */
  header: {
    x: spacing.md,
    y: spacing["sm-md"],
  },
  /** Padding inside panel content */
  content: {
    x: spacing.md,
    y: spacing.md,
  },
  /** Gap between panel sections */
  sectionGap: spacing.lg,
  /** Gap between items in a grid */
  itemGap: spacing.xs,
} as const;

/**
 * HUD Layout Zones
 *
 * Defines safe zones for HUD elements based on device type.
 */
export const hudZones = {
  desktop: {
    /** Top bar: HP/MP, minimap, XP */
    top: {
      height: "64px",
      padding: "20px 24px",
    },
    /** Bottom bar: chat, action bar */
    bottom: {
      height: "auto",
      padding: "0 24px 20px",
    },
    /** Side panels */
    sides: {
      width: "auto",
      padding: "0 24px",
    },
  },
  tablet: {
    top: {
      height: "56px",
      padding: "16px 16px",
    },
    bottom: {
      height: "auto",
      padding: "0 16px 16px",
    },
    sides: {
      width: "auto",
      padding: "0 16px",
    },
  },
  mobile: {
    top: {
      height: "48px",
      padding: "12px 8px",
    },
    bottom: {
      height: "auto",
      padding: "0 8px calc(8px + env(safe-area-inset-bottom))",
    },
    sides: {
      width: "100%",
      padding: "0",
    },
  },
} as const;

// Type exports
export type SnapZone = keyof typeof snapZones;
export type WindowSize = keyof typeof windowSizes;

/**
 * Alias for WindowConfigId - kept for API clarity in consumer code.
 * Both WindowId and WindowConfigId resolve to the same type (keyof typeof windowConfig).
 */
export type WindowId = WindowConfigId;
