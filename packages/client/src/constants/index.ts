/**
 * Constants Barrel Export
 *
 * Centralized export for all design tokens and constants.
 *
 * Usage:
 * ```typescript
 * import { COLORS, spacing, typography, zIndex } from '../constants';
 * ```
 *
 * @see /development-docs/UI_UX_DESIGN_SYSTEM.md
 */

// ===========================================
// COLORS & GRADIENTS
// ===========================================
export { COLORS, GRADIENTS } from "./colors";
export type { ColorKey, GradientKey } from "./colors";

// ===========================================
// DESIGN TOKENS
// ===========================================
export {
  // Spacing
  spacing,
  // Typography
  typography,
  // Border radius
  borderRadius,
  // Shadows
  shadows,
  // Animation
  animation,
  // Z-index layers
  zIndex,
  // Breakpoints
  breakpoints,
  // Touch targets
  touchTargets,
  // Game-specific UI
  gameUI,
  // Item rarity
  rarityColors,
  // Skill colors
  skillColors,
  // Status bar colors
  statusColors,
  // Panel styles
  panelStyles,
  getPanelStyle,
  getTabStyle,
  // Utilities
  parseTokenToNumber,
} from "./tokens";

// Token types
export type {
  Spacing,
  FontSize,
  FontWeight,
  BorderRadius,
  Shadow,
  ZIndex,
  Breakpoint,
  TouchTarget,
  Rarity,
  Skill,
  PanelStyleName,
} from "./tokens";

// ===========================================
// LAYOUT SYSTEM
// ===========================================
export {
  grid,
  snapZones,
  windowSizes,
  windowConfig,
  panelSpacing,
  hudZones,
  getColumnWidth,
  getContainerPadding,
  // New drop zone system
  reservedAreas,
  dropZones,
  getDropZoneBounds,
  isPointInDropZone,
  findDropZoneAtPoint,
} from "./layout";

export type {
  SnapZone,
  WindowSize,
  WindowId,
  DropZoneDefinition,
} from "./layout";

// ===========================================
// UI CONFIGURATION (Legacy)
// ===========================================
export { UI } from "./ui";

// ===========================================
// MOBILE UI STYLES
// ===========================================
export {
  MOBILE_TOUCH_TARGET,
  MOBILE_SLOT_SIZE,
  MOBILE_ICON_SIZE,
  MOBILE_ICON_SIZE_LG,
  MOBILE_BAR_HEIGHT,
  MOBILE_SPACING,
  MOBILE_INVENTORY_GRID,
  MOBILE_EQUIPMENT,
  MOBILE_SKILLS,
  MOBILE_PRAYER,
  MOBILE_COMBAT,
  MOBILE_MENUBAR,
  MOBILE_CHAT,
} from "./mobileStyles";

export type { MobileSpacing, MobileBarHeight } from "./mobileStyles";

// ===========================================
// PANEL LAYOUT CONSTANTS
// ===========================================
export {
  PANEL_ICON_SIZE,
  PANEL_GRID_GAP,
  PANEL_PADDING,
  PANEL_GRID_PADDING,
  PANEL_MOBILE_PADDING,
  PANEL_MOBILE_ICON_SIZE,
  PANEL_MOBILE_GRID_GAP,
  PANEL_SLOT_RADIUS,
} from "./panelLayout";

// ===========================================
// GAME CONSTANTS (Re-exports from @hyperforge/shared)
// ===========================================
// Use constants from the shared package instead of duplicating here:
// - SKILL_DEFINITIONS from @hyperforge/shared/data/skill-icons
// - INVENTORY_CONSTANTS, EQUIPMENT_SLOTS from @hyperforge/shared/constants/GameConstants
// - calculateCombatLevel from @hyperforge/shared/utils/game/CombatLevelCalculator
