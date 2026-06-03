/**
 * Panel Registry
 *
 * Maps panel IDs to React components for the InterfaceManager.
 * This provides the default panel rendering for all game UI panels.
 *
 * Panels are designed to be self-contained and fetch their data from
 * the world instance, so the registry mainly handles lazy loading
 * and fallback rendering.
 *
 * @packageDocumentation
 */

import React, { Suspense, lazy, type ReactNode } from "react";
import type {
  ClientWorld,
  InventorySlotItem,
  PlayerEquipmentItems,
} from "../../types";
import type { PlayerStats } from "@hyperforge/shared";
import { MenuButton, type MenuIconName } from "@/ui";
import {
  ActionBarPanel,
  ACTION_BAR_DIMENSIONS,
} from "../../game/panels/ActionBarPanel";
import { InventoryPanel } from "../../game/panels/InventoryPanel";
import { StatsPanel } from "../../game/panels/StatsPanel";
import {
  PrayerPanel,
  PRAYER_PANEL_DIMENSIONS,
} from "../../game/panels/PrayerPanel";
import {
  SpellsPanel,
  SPELLS_PANEL_DIMENSIONS,
} from "../../game/panels/SpellsPanel";
import {
  PresetPanel,
  AccessibilityPanel,
  useWindowStore,
  useThemeStore,
} from "@/ui";

/** Size dimensions type */
export interface PanelSize {
  width: number;
  height: number;
}

/** Responsive size configuration for different viewport sizes */
export interface ResponsiveSizes {
  /** Size for mobile viewports (<768px) */
  mobile?: PanelSize;
  /** Size for tablet viewports (768px-1024px) */
  tablet?: PanelSize;
  /** Size for desktop viewports (>1024px) - defaults to preferredSize */
  desktop?: PanelSize;
}

/** Mobile drawer types for hybrid panel system */
export type MobileDrawerType = "sheet" | "modal" | "overlay";

/** Mobile drawer height presets */
export type MobileDrawerHeight = "compact" | "half" | "full";

/** Mobile landscape panel position */
export type MobileLandscapePosition = "left" | "right" | "modal";

/** Mobile-specific layout configuration */
export interface MobileLayoutConfig {
  /** How the panel opens on mobile (sheet=bottom drawer, modal=fullscreen, overlay=floating) */
  drawerType: MobileDrawerType;
  /** Default height for drawer (compact=30vh, half=50vh, full=90vh) */
  drawerHeight: MobileDrawerHeight;
  /** Position in landscape mode */
  landscapePosition: MobileLandscapePosition;
  /** Grid columns override for mobile (e.g., 4 for 4-column inventory) */
  gridColumns?: number;
  /** Whether to show in compact/simplified mode on mobile */
  compact?: boolean;
}

/** Panel sizing and behavior configuration */
export interface PanelConfig {
  /** Minimum size the panel can be resized to */
  minSize: PanelSize;
  /** Preferred/default size for this panel (used as base for scaling) */
  preferredSize: PanelSize;
  /** Maximum size (optional) */
  maxSize?: PanelSize;
  /** Whether the panel content should scroll when smaller than content */
  scrollable: boolean;
  /** Whether the panel can be resized at all */
  resizable: boolean;
  /** Responsive sizes for different viewport breakpoints */
  responsive?: ResponsiveSizes;
  /**
   * Scale factor range for smooth viewport scaling
   * minScale: minimum scale factor (e.g., 0.75 = 75% of preferredSize)
   * maxScale: maximum scale factor (e.g., 1.25 = 125% of preferredSize)
   */
  scaleFactor?: {
    min: number;
    max: number;
  };
  /** Aspect ratio to maintain during resize (width/height) */
  aspectRatio?: number;
  /** Mobile-specific layout configuration */
  mobileLayout?: MobileLayoutConfig;
}

/** Base resolution for scale calculations (1080p) */
const BASE_VIEWPORT = { width: 1920, height: 1080 };

/**
 * Calculate a responsive size based on viewport and panel config
 *
 * @param baseSize - The base size to scale from
 * @param viewport - Current viewport dimensions
 * @param scaleFactor - Min/max scale factors
 * @returns Scaled size that fits the viewport
 */
export function calculateResponsiveSize(
  baseSize: PanelSize,
  viewport: PanelSize,
  scaleFactor: { min: number; max: number } = { min: 0.75, max: 1.25 },
): PanelSize {
  // Calculate scale based on viewport relative to base resolution
  const widthScale = viewport.width / BASE_VIEWPORT.width;
  const heightScale = viewport.height / BASE_VIEWPORT.height;

  // Use the smaller scale to maintain proportions, clamped to scale factor range
  const rawScale = Math.min(widthScale, heightScale);
  const scale = Math.max(scaleFactor.min, Math.min(scaleFactor.max, rawScale));

  return {
    width: Math.round(baseSize.width * scale),
    height: Math.round(baseSize.height * scale),
  };
}

/**
 * Get the appropriate panel size for a given device type
 *
 * @param config - Panel configuration
 * @param deviceType - Current device type (mobile, tablet, desktop)
 * @param viewport - Current viewport dimensions (for smooth scaling)
 * @returns The appropriate size for this panel
 */
export function getResponsivePanelSize(
  config: PanelConfig,
  deviceType: "mobile" | "tablet" | "desktop",
  viewport?: PanelSize,
): PanelSize {
  // First check for explicit responsive breakpoint sizes
  if (config.responsive) {
    const breakpointSize = config.responsive[deviceType];
    if (breakpointSize) {
      return breakpointSize;
    }
  }

  // If viewport is provided and scale factor is configured, use smooth scaling
  if (viewport && config.scaleFactor) {
    return calculateResponsiveSize(
      config.preferredSize,
      viewport,
      config.scaleFactor,
    );
  }

  // Default fallback based on device type with preset scale factors
  const deviceScales = {
    mobile: 0.85,
    tablet: 0.95,
    desktop: 1.0,
  };

  const scale = deviceScales[deviceType];
  return {
    width: Math.round(config.preferredSize.width * scale),
    height: Math.round(config.preferredSize.height * scale),
  };
}

// ============================================================================
// MENUBAR DIMENSIONS (simplified - matches inventory panel approach)
// ============================================================================

// Special panel IDs that open modals instead of windows
export const MODAL_PANEL_IDS = ["map", "stats", "death"] as const;
export type ModalPanelId = (typeof MODAL_PANEL_IDS)[number];

/**
 * Menubar dimensions - simplified to match inventory panel sizing approach
 *
 * Layout: 5 columns x 2 rows for 10 buttons
 * Uses CSS Grid with `repeat(5, 1fr)` so buttons scale with container
 * Width matches inventory panel for consistent right-column alignment
 */
export const MENUBAR_DIMENSIONS = {
  // Match inventory panel width for consistent right column
  minWidth: 235,
  // 2 rows with very compact ~20px buttons + padding (2px) + gap (1px) + border (2px)
  // Calculation: 2 * 20 + 1 + 2*2 + 2 = 47px
  minHeight: 47,
  // Preferred size - very compact 2-row layout
  width: 235,
  height: 50,
  // Maximum - match inventory panel maxWidth
  maxWidth: 390,
  maxHeight: 70,
  // Grid configuration
  columns: 5,
  rows: 2,
  gap: 1,
  padding: 2,
};

// ============================================================================
// PANEL CONFIGURATION REGISTRY
// ============================================================================

/**
 * Panel configuration registry
 * Defines sizing constraints and behavior for each panel type
 *
 * Each panel has:
 * - Base sizes (min, preferred, max)
 * - Scale factor range for smooth viewport scaling (default: 0.8-1.2)
 * - Optional responsive breakpoint sizes for mobile/tablet/desktop
 * - Aspect ratio for panels that need to maintain proportions
 */
export const PANEL_CONFIG: Record<string, PanelConfig> = {
  // Inventory - fixed grid layout (4x7), panel handles own overflow
  // Min/max width aligned with skills panel for consistent right column sizing
  inventory: {
    minSize: { width: 235, height: 340 },
    preferredSize: { width: 320, height: 420 },
    maxSize: { width: 390, height: 550 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.85, max: 1.15 },
    responsive: {
      mobile: { width: 260, height: 360 },
      tablet: { width: 290, height: 390 },
      desktop: { width: 320, height: 420 },
    },
    mobileLayout: {
      drawerType: "sheet",
      drawerHeight: "half",
      landscapePosition: "right",
      gridColumns: 4,
    },
  },
  // Equipment - fixed layout, needs specific dimensions for slot arrangement
  // Min/max width aligned with skills panel for consistent right column sizing
  equipment: {
    minSize: { width: 235, height: 340 },
    preferredSize: { width: 260, height: 390 },
    maxSize: { width: 340, height: 520 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.85, max: 1.15 },
    responsive: {
      mobile: { width: 235, height: 340 },
      tablet: { width: 250, height: 370 },
      desktop: { width: 260, height: 390 },
    },
    mobileLayout: {
      drawerType: "sheet",
      drawerHeight: "half",
      landscapePosition: "right",
      compact: true,
    },
  },
  // Stats - full skills display with combat, gathering, production sections
  stats: {
    // Minimum size ensures all content visible without cutoff
    minSize: { width: 255, height: 345 },
    preferredSize: { width: 275, height: 370 },
    // Max size allows modest expansion without oversizing
    maxSize: { width: 325, height: 440 },
    scrollable: false, // Content fits within bounds
    resizable: true,
    // Tight scale limits for readability
    scaleFactor: { min: 0.92, max: 1.1 },
    responsive: {
      mobile: { width: 255, height: 345 },
      tablet: { width: 265, height: 365 },
      desktop: { width: 275, height: 370 },
    },
    mobileLayout: {
      drawerType: "modal",
      drawerHeight: "full",
      landscapePosition: "modal",
    },
  },
  // Skills - 3x4 grid of skill icons with total/combat level footer
  // Mobile size matches Prayer panel for consistent tab switching
  skills: {
    minSize: { width: 235, height: 280 },
    preferredSize: { width: 325, height: 360 },
    maxSize: { width: 390, height: 470 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.85, max: 1.15 },
    responsive: {
      mobile: {
        width: PRAYER_PANEL_DIMENSIONS.layouts.fourCol.width,
        height: PRAYER_PANEL_DIMENSIONS.layouts.fourCol.height,
      },
      tablet: { width: 305, height: 385 },
      desktop: { width: 325, height: 400 },
    },
    mobileLayout: {
      drawerType: "sheet",
      drawerHeight: "half",
      landscapePosition: "right",
      gridColumns: 4,
    },
  },
  // Prayer - grid of prayer icons with adaptive layout
  // minSize matches right column (235px width, 280px height) for consistent alignment
  prayer: {
    minSize: {
      width: 235,
      height: 280,
    },
    preferredSize: {
      width: PRAYER_PANEL_DIMENSIONS.defaultWidth,
      height: PRAYER_PANEL_DIMENSIONS.defaultHeight,
    },
    maxSize: {
      width: PRAYER_PANEL_DIMENSIONS.maxWidth,
      height: PRAYER_PANEL_DIMENSIONS.maxHeight,
    },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.8, max: 1.2 },
    responsive: {
      mobile: {
        width: PRAYER_PANEL_DIMENSIONS.layouts.threeCol.width,
        height: PRAYER_PANEL_DIMENSIONS.layouts.threeCol.height,
      },
      tablet: {
        width: PRAYER_PANEL_DIMENSIONS.layouts.fourCol.width,
        height: PRAYER_PANEL_DIMENSIONS.layouts.fourCol.height,
      },
      desktop: {
        width: PRAYER_PANEL_DIMENSIONS.defaultWidth,
        height: PRAYER_PANEL_DIMENSIONS.defaultHeight,
      },
    },
    mobileLayout: {
      drawerType: "sheet",
      drawerHeight: "half",
      landscapePosition: "right",
      gridColumns: 4,
    },
  },
  // Combat - combat stats and style selector
  combat: {
    minSize: { width: 235, height: 280 },
    preferredSize: { width: 310, height: 340 },
    maxSize: { width: 420, height: 470 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.8, max: 1.2 },
    responsive: {
      mobile: { width: 260, height: 310 },
      tablet: { width: 285, height: 340 },
      desktop: { width: 310, height: 360 },
    },
    mobileLayout: {
      drawerType: "sheet",
      drawerHeight: "compact",
      landscapePosition: "left",
      compact: true,
    },
  },
  // Spells - magic spellbook with spell grid
  // minWidth matches right column (235px) for consistent alignment
  spells: {
    minSize: {
      width: 235, // Match right column width for consistency
      height: SPELLS_PANEL_DIMENSIONS.minHeight,
    },
    preferredSize: {
      width: SPELLS_PANEL_DIMENSIONS.defaultWidth,
      height: SPELLS_PANEL_DIMENSIONS.defaultHeight,
    },
    maxSize: {
      width: SPELLS_PANEL_DIMENSIONS.maxWidth,
      height: SPELLS_PANEL_DIMENSIONS.maxHeight,
    },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.85, max: 1.15 },
    responsive: {
      mobile: { width: 200, height: 280 },
      tablet: { width: 210, height: 300 },
      desktop: {
        width: SPELLS_PANEL_DIMENSIONS.defaultWidth,
        height: SPELLS_PANEL_DIMENSIONS.defaultHeight,
      },
    },
    mobileLayout: {
      drawerType: "sheet",
      drawerHeight: "half",
      landscapePosition: "right",
      gridColumns: 4,
    },
  },
  // Settings - toggles and sliders, panel handles own scrolling
  settings: {
    minSize: { width: 290, height: 340 },
    preferredSize: { width: 360, height: 470 },
    maxSize: { width: 500, height: 620 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.8, max: 1.15 },
    responsive: {
      mobile: { width: 310, height: 390 },
      tablet: { width: 340, height: 430 },
      desktop: { width: 360, height: 470 },
    },
    mobileLayout: {
      drawerType: "modal",
      drawerHeight: "full",
      landscapePosition: "modal",
    },
  },
  // Minimap - three-layer architecture with minimal constraints
  // Layer 1: Fixed canvas (512x512), Layer 2: Resizable viewport, Layer 3: Overlay
  minimap: {
    minSize: { width: 80, height: 80 }, // Very minimal - can go nearly as small as needed
    preferredSize: { width: 300, height: 300 },
    // No maxSize - allow near-fullscreen resizing
    // No aspectRatio - width and height resize independently
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.4, max: 1.5 }, // Wide range for flexibility
    responsive: {
      mobile: { width: 150, height: 150 },
      tablet: { width: 250, height: 250 },
      desktop: { width: 300, height: 300 },
    },
    mobileLayout: {
      drawerType: "overlay",
      drawerHeight: "compact",
      landscapePosition: "left",
      compact: true,
    },
  },
  // Chat - needs width for messages, panel handles own scrolling
  chat: {
    minSize: { width: 130, height: 195 },
    preferredSize: { width: 520, height: 585 },
    // No maxSize - allow unlimited resizing in edit mode (like minimap)
    scrollable: false,
    resizable: true,
    // No scaleFactor - use preferredSize directly without scaling limits
    responsive: {
      mobile: { width: 260, height: 390 },
      tablet: { width: 260, height: 495 },
      desktop: { width: 520, height: 585 },
    },
    mobileLayout: {
      drawerType: "overlay",
      drawerHeight: "compact",
      landscapePosition: "left",
    },
  },
  // Presets - layout management, panel handles own layout
  presets: {
    minSize: { width: 235, height: 235 },
    preferredSize: { width: 340, height: 390 },
    maxSize: { width: 440, height: 520 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.8, max: 1.15 },
    responsive: {
      mobile: { width: 285, height: 340 },
      tablet: { width: 310, height: 365 },
      desktop: { width: 340, height: 390 },
    },
    mobileLayout: {
      drawerType: "modal",
      drawerHeight: "full",
      landscapePosition: "modal",
    },
  },
  // Accessibility settings panel
  accessibility: {
    minSize: { width: 290, height: 390 },
    preferredSize: { width: 360, height: 520 },
    maxSize: { width: 470, height: 680 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.85, max: 1.15 },
    responsive: {
      mobile: { width: 325, height: 470 },
      tablet: { width: 345, height: 495 },
      desktop: { width: 360, height: 520 },
    },
    mobileLayout: {
      drawerType: "modal",
      drawerHeight: "full",
      landscapePosition: "modal",
    },
  },
  // Action bar - configurable layout with +/- controls
  // Supports layouts: 7x1 (default horizontal), 9x1, 3x3, 2x4, 4x2, 1x7, 1x9
  // Uses actual calculated dimensions from ActionBarPanel to prevent resizing larger than content
  actionbar: {
    // Minimum: Allow compact layouts
    minSize: {
      width: ACTION_BAR_DIMENSIONS.minWidth,
      height: ACTION_BAR_DIMENSIONS.minHeight,
    },
    // Default: 7-slot horizontal (7x1) with controls
    preferredSize: {
      width: ACTION_BAR_DIMENSIONS.defaultWidth,
      height: ACTION_BAR_DIMENSIONS.defaultHeight,
    },
    // Maximum: 9-slot horizontal layout (horizontal-only layout system)
    maxSize: {
      width: ACTION_BAR_DIMENSIONS.maxWidth,
      height: ACTION_BAR_DIMENSIONS.maxHeight,
    },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.85, max: 1.2 },
    responsive: {
      mobile: { width: 280, height: ACTION_BAR_DIMENSIONS.defaultHeight },
      tablet: { width: 320, height: ACTION_BAR_DIMENSIONS.defaultHeight },
      desktop: {
        width: ACTION_BAR_DIMENSIONS.defaultWidth,
        height: ACTION_BAR_DIMENSIONS.defaultHeight,
      },
    },
  },
  // Menu bar - fluid 5x2 grid of panel buttons (matches inventory approach)
  // Uses CSS Grid with 1fr units so buttons scale seamlessly with container
  menubar: {
    minSize: {
      width: MENUBAR_DIMENSIONS.minWidth,
      height: MENUBAR_DIMENSIONS.minHeight,
    },
    preferredSize: {
      width: MENUBAR_DIMENSIONS.width,
      height: MENUBAR_DIMENSIONS.height,
    },
    maxSize: {
      width: MENUBAR_DIMENSIONS.maxWidth,
      height: MENUBAR_DIMENSIONS.maxHeight,
    },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.8, max: 1.2 },
    responsive: {
      mobile: {
        width: MENUBAR_DIMENSIONS.minWidth,
        height: MENUBAR_DIMENSIONS.minHeight,
      },
      tablet: {
        width: MENUBAR_DIMENSIONS.width,
        height: MENUBAR_DIMENSIONS.height,
      },
      desktop: {
        width: MENUBAR_DIMENSIONS.width,
        height: MENUBAR_DIMENSIONS.height,
      },
    },
  },
  // Bank - large grid, panel handles own scrolling
  bank: {
    minSize: { width: 365, height: 365 },
    preferredSize: { width: 520, height: 520 },
    maxSize: { width: 780, height: 780 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.75, max: 1.25 },
    responsive: {
      mobile: { width: 420, height: 440 },
      tablet: { width: 470, height: 480 },
      desktop: { width: 520, height: 520 },
    },
    mobileLayout: {
      drawerType: "modal",
      drawerHeight: "full",
      landscapePosition: "modal",
    },
  },
  // Store - item list, panel handles own layout
  store: {
    minSize: { width: 340, height: 365 },
    preferredSize: { width: 420, height: 520 },
    maxSize: { width: 585, height: 715 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.8, max: 1.2 },
    responsive: {
      mobile: { width: 365, height: 440 },
      tablet: { width: 390, height: 480 },
      desktop: { width: 420, height: 520 },
    },
    mobileLayout: {
      drawerType: "modal",
      drawerHeight: "full",
      landscapePosition: "modal",
    },
  },
  // Quests - quest list, panel handles own layout
  quests: {
    minSize: { width: 260, height: 300 },
    preferredSize: { width: 365, height: 455 },
    maxSize: { width: 495, height: 610 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.8, max: 1.2 },
    responsive: {
      mobile: { width: 310, height: 390 },
      tablet: { width: 340, height: 420 },
      desktop: { width: 365, height: 455 },
    },
  },
  // Quest Detail - separate window for quest details
  "quest-detail": {
    minSize: { width: 420, height: 520 },
    preferredSize: { width: 520, height: 650 },
    maxSize: { width: 650, height: 910 },
    scrollable: true,
    resizable: true,
    scaleFactor: { min: 0.85, max: 1.15 },
    responsive: {
      mobile: { width: 390, height: 520 },
      tablet: { width: 455, height: 585 },
      desktop: { width: 520, height: 650 },
    },
    mobileLayout: {
      drawerType: "modal",
      drawerHeight: "full",
      landscapePosition: "modal",
    },
  },
  // Friends - player list, panel handles own layout
  friends: {
    minSize: { width: 235, height: 235 },
    preferredSize: { width: 310, height: 390 },
    maxSize: { width: 420, height: 520 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.8, max: 1.2 },
    responsive: {
      mobile: { width: 260, height: 340 },
      tablet: { width: 285, height: 365 },
      desktop: { width: 310, height: 390 },
    },
    mobileLayout: {
      drawerType: "sheet",
      drawerHeight: "half",
      landscapePosition: "right",
    },
  },
  // Map - world map view
  map: {
    minSize: { width: 365, height: 300 },
    preferredSize: { width: 585, height: 455 },
    maxSize: { width: 845, height: 650 },
    scrollable: false,
    resizable: true,
    scaleFactor: { min: 0.75, max: 1.3 },
    aspectRatio: 1.286, // ~16:12.5 aspect for map
    responsive: {
      mobile: { width: 455, height: 365 },
      tablet: { width: 520, height: 410 },
      desktop: { width: 585, height: 455 },
    },
    mobileLayout: {
      drawerType: "modal",
      drawerHeight: "full",
      landscapePosition: "modal",
    },
  },
};

/** Get panel config with fallback defaults */
export function getPanelConfig(panelId: string): PanelConfig {
  return (
    PANEL_CONFIG[panelId] || {
      minSize: { width: 235, height: 180 },
      preferredSize: { width: 325, height: 260 },
      maxSize: { width: 455, height: 390 },
      scrollable: false,
      resizable: true,
      scaleFactor: { min: 0.8, max: 1.2 },
      responsive: {
        mobile: { width: 275, height: 220 },
        tablet: { width: 300, height: 240 },
        desktop: { width: 325, height: 260 },
      },
    }
  );
}

/**
 * Get the current device type based on viewport width
 *
 * @param viewportWidth - Current viewport width in pixels
 * @returns Device type string
 */
export function getDeviceType(
  viewportWidth: number,
): "mobile" | "tablet" | "desktop" {
  if (viewportWidth < 768) return "mobile";
  if (viewportWidth < 1024) return "tablet";
  return "desktop";
}

/**
 * Get responsive panel size based on current viewport
 * Combines breakpoint-based sizing with smooth scaling
 *
 * @param panelId - The panel ID to get size for
 * @param viewport - Current viewport dimensions
 * @returns Calculated size for this panel
 */
export function getPanelSizeForViewport(
  panelId: string,
  viewport: PanelSize,
): PanelSize {
  const config = getPanelConfig(panelId);
  const deviceType = getDeviceType(viewport.width);

  return getResponsivePanelSize(config, deviceType, viewport);
}

/**
 * Apply aspect ratio constraint to a size
 *
 * @param size - Size to constrain
 * @param aspectRatio - Target aspect ratio (width/height)
 * @param priority - Which dimension to preserve ('width' | 'height')
 * @returns Size constrained to aspect ratio
 */
export function constrainToAspectRatio(
  size: PanelSize,
  aspectRatio: number,
  priority: "width" | "height" = "width",
): PanelSize {
  if (priority === "width") {
    return {
      width: size.width,
      height: Math.round(size.width / aspectRatio),
    };
  }
  return {
    width: Math.round(size.height * aspectRatio),
    height: size.height,
  };
}

/**
 * Scrollable panel wrapper - only adds scroll behavior when panel config specifies it.
 * Most panels handle their own internal scrolling, so this is primarily for
 * panels that don't have built-in scroll handling.
 *
 * Note: Returns children directly if scrollable=false to avoid adding wrapper layers
 */
function ScrollablePanelWrapper({
  children,
  scrollable,
}: {
  children: React.ReactNode;
  scrollable: boolean;
}): React.ReactElement {
  // Don't wrap if not scrollable - return children directly wrapped in fragment
  if (!scrollable) {
    return <>{children}</>;
  }

  // Only add scroll container for panels that need it
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(139, 119, 87, 0.5) transparent",
      }}
    >
      {children}
    </div>
  );
}

/** All available menu bar buttons */
const ALL_MENU_BUTTONS: Array<{
  panelId: string;
  iconName: MenuIconName;
  label: string;
}> = [
  { panelId: "inventory", iconName: "inventory", label: "Inventory" },
  { panelId: "equipment", iconName: "equipment", label: "Equipment" },
  { panelId: "skills", iconName: "skills", label: "Skills" },
  { panelId: "prayer", iconName: "prayer", label: "Prayer" },
  { panelId: "spells", iconName: "spells", label: "Spells" },
  { panelId: "combat", iconName: "combat", label: "Combat" },
  { panelId: "quests", iconName: "quests", label: "Quests" },
  { panelId: "friends", iconName: "friends", label: "Friends" },
  { panelId: "map", iconName: "map", label: "World Map" },
  { panelId: "settings", iconName: "settings", label: "Settings" },
];

/**
 * Menu bar panel - displays navigation buttons in a fluid 5x2 grid
 *
 * Uses CSS Grid with `repeat(5, 1fr)` so buttons scale seamlessly with container.
 * Matches inventory panel's approach for consistent right-column sizing.
 */
function MenuBarPanel({
  onPanelClick,
}: {
  onPanelClick?: (panelId: string) => void;
  windowId?: string;
}): React.ReactElement {
  const theme = useThemeStore((s) => s.theme);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${MENUBAR_DIMENSIONS.columns}, 1fr)`,
        gridTemplateRows: `repeat(${MENUBAR_DIMENSIONS.rows}, 1fr)`,
        gap: MENUBAR_DIMENSIONS.gap,
        padding: MENUBAR_DIMENSIONS.padding,
        background: `linear-gradient(180deg, ${theme.colors.background.secondary} 0%, ${theme.colors.background.primary} 100%)`,
        border: `1px solid ${theme.colors.border.default}`,
        borderRadius: 4,
        boxShadow: `inset 0 2px 8px rgba(0, 0, 0, 0.5), ${theme.shadows.md}`,
      }}
    >
      {ALL_MENU_BUTTONS.map((button) => (
        <MenuButton
          key={button.panelId}
          iconName={button.iconName}
          label={button.label}
          active={false}
          onClick={() => onPanelClick?.(button.panelId)}
          fluid
          panelId={button.panelId}
        />
      ))}
    </div>
  );
}

// Lazy load panels for better code splitting
const ChatPanel = lazy(() =>
  import("../../game/panels/ChatPanel").then((m) => ({
    default: m.ChatPanel,
  })),
);
const EquipmentPanel = lazy(() =>
  import("../../game/panels/EquipmentPanel").then((m) => ({
    default: m.EquipmentPanel,
  })),
);
const SkillsPanel = lazy(() =>
  import("../../game/panels/SkillsPanel").then((m) => ({
    default: m.SkillsPanel,
  })),
);
const CombatPanel = lazy(() =>
  import("../../game/panels/CombatPanel").then((m) => ({
    default: m.CombatPanel,
  })),
);
const SettingsPanel = lazy(() =>
  import("../../game/panels/SettingsPanel").then((m) => ({
    default: m.SettingsPanel,
  })),
);
const QuestsPanel = lazy(() =>
  import("../../game/panels/QuestsPanel").then((m) => ({
    default: m.QuestsPanel,
  })),
);
const QuestDetailPanel = lazy(() =>
  import("../../game/panels/QuestDetailPanel").then((m) => ({
    default: m.QuestDetailPanel,
  })),
);
const MapPanel = lazy(() =>
  import("../../game/panels/MapPanel").then((m) => ({
    default: m.MapPanel,
  })),
);
const FriendsPanel = lazy(() =>
  import("../../game/panels/FriendsPanel").then((m) => ({
    default: m.FriendsPanel,
  })),
);
/** Panel loading fallback */
function PanelLoadingFallback(): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "rgba(255, 255, 255, 0.5)",
        fontSize: 14,
      }}
    >
      Loading...
    </div>
  );
}

/** Placeholder for unimplemented panels */
function PlaceholderPanel({
  panelId,
}: {
  panelId: string;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "rgba(255, 255, 255, 0.5)",
        fontSize: 14,
        gap: 8,
      }}
    >
      <span style={{ fontSize: 24 }}>{getPanelIcon(panelId)}</span>
      <span>{formatPanelName(panelId)}</span>
      <span style={{ fontSize: 11, opacity: 0.6 }}>Coming Soon</span>
    </div>
  );
}

/** Get icon for panel ID */
function getPanelIcon(panelId: string): string {
  const icons: Record<string, string> = {
    inventory: "🎒",
    equipment: "🎽",
    stats: "📊",
    skills: "⭐",
    prayer: "✨",
    spells: "🔮",
    combat: "⚔️",
    settings: "⚙️",
    bank: "🏦",
    quests: "📜",
    "quest-detail": "📋",
    map: "🗺️",
    minimap: "🧭",
    chat: "💬",
    friends: "👥",
    presets: "📐",
    dashboard: "📈",
    action: "⚡",
    accessibility: "♿",
  };
  return icons[panelId] || "📋";
}

/** Format panel ID to display name */
function formatPanelName(panelId: string): string {
  return panelId
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Panel render context with all necessary data */
export interface PanelRenderContext {
  world: ClientWorld;
  /** Inventory items for InventoryPanel */
  inventoryItems?: InventorySlotItem[];
  /** Coins for InventoryPanel */
  coins?: number;
  /** Player stats for SkillsPanel and CombatPanel */
  stats?: PlayerStats | null;
  /** Player equipment for EquipmentPanel and CombatPanel */
  equipment?: PlayerEquipmentItems | null;
  /** Callback for menu bar panel clicks */
  onPanelClick?: (panelId: string) => void;
  /** Whether edit mode is unlocked (for action bar +/- controls) */
  isEditMode?: boolean;
  /** Optional getter for current player-facing panel data */
  getPanelData?: () => Pick<
    PanelRenderContext,
    "inventoryItems" | "coins" | "stats" | "equipment"
  >;
}

/**
 * Create the default panel renderer
 *
 * This function returns a renderPanel callback that can be passed to InterfaceManager.
 * It handles rendering all registered game panels with proper data.
 *
 * @example
 * ```tsx
 * function GameScreen() {
 *   const world = useWorld();
 *   const { items, coins, stats, equipment } = usePlayerData(world);
 *
 *   const renderPanel = createPanelRenderer({
 *     world,
 *     inventoryItems: items,
 *     coins,
 *     stats,
 *     equipment,
 *   });
 *
 *   return (
 *     <InterfaceManager world={world} renderPanel={renderPanel}>
 *       <GameViewport />
 *     </InterfaceManager>
 *   );
 * }
 * ```
 */
export function createPanelRenderer(
  context: PanelRenderContext,
): (panelId: string, world?: ClientWorld, windowId?: string) => ReactNode {
  const {
    world,
    inventoryItems: initialInventoryItems = [],
    coins: initialCoins = 0,
    stats: initialStats = null,
    equipment: initialEquipment = null,
    onPanelClick,
    isEditMode = false,
    getPanelData,
  } = context;

  return (
    panelId: string,
    _world?: ClientWorld,
    windowId?: string,
  ): ReactNode => {
    // Don't render if no world
    if (!world) {
      return (
        <div style={{ padding: 16, color: "rgba(255, 255, 255, 0.5)" }}>
          Waiting for world...
        </div>
      );
    }

    // Get panel config for scrollability
    const config = getPanelConfig(panelId);
    const livePanelData = getPanelData?.();
    const inventoryItems =
      livePanelData?.inventoryItems ?? initialInventoryItems;
    const coins = livePanelData?.coins ?? initialCoins;
    const stats = livePanelData?.stats ?? initialStats;
    const equipment = livePanelData?.equipment ?? initialEquipment;

    switch (panelId) {
      case "inventory":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <InventoryPanel
                items={inventoryItems}
                coins={coins}
                world={world}
                useParentDndContext={true}
              />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      case "equipment":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <EquipmentPanel equipment={equipment} world={world} />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      case "stats":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <StatsPanel stats={stats} equipment={equipment} />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      case "skills":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <SkillsPanel stats={stats} />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      case "prayer":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <PrayerPanel stats={stats} world={world} />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      case "spells":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <SpellsPanel stats={stats} world={world} />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      case "combat":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <CombatPanel world={world} stats={stats} equipment={equipment} />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      case "settings":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <SettingsPanel world={world} />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      case "minimap":
        // Minimap is handled by MinimapWrapper in WindowRenderer, not through renderPanel
        // This case should not be reached for the main minimap window
        return null;

      case "menubar":
        return <MenuBarPanel onPanelClick={onPanelClick} windowId={windowId} />;

      // Bank is typically opened as a modal/overlay, not a regular panel
      // but we include a placeholder for now
      case "bank":
        return (
          <ScrollablePanelWrapper
            scrollable={getPanelConfig("bank").scrollable}
          >
            <PlaceholderPanel panelId="bank" />
          </ScrollablePanelWrapper>
        );

      case "chat":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <ChatPanel world={world} />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      // Action bar panels (up to 5)
      // useParentDndContext enables cross-panel drag-drop (skills, prayers, items)
      case "action":
      case "actionbar-0":
        return (
          <ActionBarPanel
            world={world}
            barId={0}
            isEditMode={isEditMode}
            windowId={windowId}
            useParentDndContext={true}
          />
        );
      case "actionbar-1":
        return (
          <ActionBarPanel
            world={world}
            barId={1}
            isEditMode={isEditMode}
            windowId={windowId}
            useParentDndContext={true}
          />
        );
      case "actionbar-2":
        return (
          <ActionBarPanel
            world={world}
            barId={2}
            isEditMode={isEditMode}
            windowId={windowId}
            useParentDndContext={true}
          />
        );
      case "actionbar-3":
        return (
          <ActionBarPanel
            world={world}
            barId={3}
            isEditMode={isEditMode}
            windowId={windowId}
            useParentDndContext={true}
          />
        );
      case "actionbar-4":
        return (
          <ActionBarPanel
            world={world}
            barId={4}
            isEditMode={isEditMode}
            windowId={windowId}
            useParentDndContext={true}
          />
        );

      // Layout presets panel
      case "presets":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <PresetPanel />
          </ScrollablePanelWrapper>
        );

      // Accessibility settings panel
      case "accessibility":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <AccessibilityPanel />
          </ScrollablePanelWrapper>
        );

      // Panels that are planned but not yet implemented
      case "quests":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <QuestsPanel world={world} />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      case "quest-detail":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <QuestDetailPanel
                world={world}
                onClose={() => {
                  if (windowId) {
                    useWindowStore.getState().destroyWindow(windowId);
                  }
                }}
              />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      case "map":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <MapPanel world={world} />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      case "friends":
        return (
          <ScrollablePanelWrapper scrollable={config.scrollable}>
            <Suspense fallback={<PanelLoadingFallback />}>
              <FriendsPanel world={world} />
            </Suspense>
          </ScrollablePanelWrapper>
        );

      default:
        return (
          <div
            style={{
              padding: 16,
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: 13,
            }}
          >
            Unknown panel: {panelId}
          </div>
        );
    }
  };
}

/**
 * Get list of all available panel IDs
 */
export function getAvailablePanels(): Array<{
  id: string;
  label: string;
  icon: string;
  implemented: boolean;
}> {
  return [
    { id: "minimap", label: "Minimap", icon: "🗺️", implemented: true },
    { id: "inventory", label: "Inventory", icon: "🎒", implemented: true },
    { id: "equipment", label: "Equipment", icon: "🎽", implemented: true },
    { id: "stats", label: "Stats", icon: "📊", implemented: true },
    { id: "skills", label: "Skills", icon: "⭐", implemented: true },
    { id: "prayer", label: "Prayer", icon: "✨", implemented: true },
    { id: "spells", label: "Spells", icon: "🔮", implemented: true },
    { id: "combat", label: "Combat", icon: "⚔️", implemented: true },
    { id: "settings", label: "Settings", icon: "⚙️", implemented: true },
    { id: "bank", label: "Bank", icon: "🏦", implemented: true },
    { id: "quests", label: "Quests", icon: "📜", implemented: false },
    { id: "map", label: "World Map", icon: "🗺️", implemented: false },
    { id: "chat", label: "Chat", icon: "💬", implemented: true },
    { id: "action", label: "Action Bar", icon: "⚡", implemented: true },
    { id: "friends", label: "Friends", icon: "👥", implemented: false },
    { id: "presets", label: "Layout Presets", icon: "📐", implemented: true },
    {
      id: "accessibility",
      label: "Accessibility",
      icon: "♿",
      implemented: true,
    },
  ];
}
