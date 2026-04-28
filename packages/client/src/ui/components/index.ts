/**
 * UI Components
 *
 * Generic UI primitives for the game interface.
 * These are reusable components that can be used across different panels and features.
 */

// Window system
export { Window } from "./Window";
export {
  WindowErrorBoundary,
  type WindowErrorBoundaryProps,
} from "./WindowErrorBoundary";

// Tab system
export { TabBar } from "./TabBar";
export { Tab } from "./Tab";
export { TabContextMenu, type TabContextMenuAction } from "./TabContextMenu";

// Modal and popout
export { ModalWindow, type ModalWindowProps } from "./ModalWindow";
export {
  PopoutPanel,
  type PopoutPanelProps,
  type PopoutMode,
  type PopoutPosition,
} from "./PopoutPanel";

// Edit mode
export { EditModeOverlay } from "./EditModeOverlay";
export { EditModeToolbar, type EditModeToolbarProps } from "./EditModeToolbar";
export { AlignmentGuides } from "./AlignmentGuides";
export { TransparencySlider } from "./TransparencySlider";

// Presets and drag
export { PresetPanel } from "./PresetPanel";
export { DragOverlay } from "./DragOverlay";

// Virtual scrolling
export {
  VirtualList,
  type VirtualListProps,
  type VirtualListRef,
  type VirtualListRenderItem,
} from "./VirtualList";
export {
  VirtualGrid,
  VirtualItemGrid,
  type VirtualGridProps,
  type VirtualGridRef,
  type VirtualGridRenderCell,
} from "./VirtualGrid";

// Item and inventory
export {
  ItemSlot,
  ItemGrid,
  type ItemData,
  type ItemSlotProps,
  type ItemGridProps,
} from "./ItemSlot";

// Status and combat
export {
  StatusBar,
  StatusOrb,
  SpecialAttackOrb,
  RunEnergyOrb,
  StatusBarsGroup,
} from "./StatusBar";
export type {
  StatusBarProps,
  StatusOrbProps,
  SpecialAttackOrbProps,
  RunEnergyOrbProps,
  StatusBarsGroupProps,
  StatusType,
  StatusEffect,
} from "./StatusBar";

export {
  ActionBar,
  createActionBar,
  useActionBarKeybindsForBar,
  createPanelActions,
  DEFAULT_ACTION_BAR_KEYBINDS,
} from "./ActionBar";
export type {
  ActionBarProps,
  ActionBarState,
  ActionSlot,
  Action,
  ActionType,
  PanelActionDef,
} from "./ActionBar";

// Navigation
export { Ribbon, createRibbonCategory, DEFAULT_CATEGORIES } from "./Ribbon";
export type { RibbonProps, RibbonCategory } from "./Ribbon";

export { Minimap, createMinimapState } from "./Minimap";
export type { MinimapProps, MinimapState, MinimapIcon } from "./Minimap";

// Mobile
export { TouchActionBar, type TouchActionBarProps } from "./TouchActionBar";
export {
  MobileDrawer,
  useDrawerState,
  type MobileDrawerProps,
  type DrawerState,
  type DrawerHeightConfig,
} from "./MobileDrawer";

// Achievements and effects
export {
  AchievementPopup,
  type AchievementPopupProps,
  type AchievementVariant,
  type CelebrationEffectType,
} from "./AchievementPopup";
export { FireworksEffect, type FireworksEffectProps } from "./FireworksEffect";

// Tooltips
export {
  TieredTooltip,
  type TieredTooltipProps,
  type TooltipItemData,
  type PlayerStatsForTooltip,
} from "./TieredTooltip";

// Combat UI
export { BuffBar, type BuffBarProps, type Buff } from "./BuffBar";
export {
  BossTimer,
  type BossTimerProps,
  type BossAttack,
  type BossPhase,
} from "./BossTimer";

// Settings panels
export {
  AccessibilityPanel,
  type AccessibilityPanelProps,
} from "./AccessibilityPanel";
export { ComplexityPanel, type ComplexityPanelProps } from "./ComplexityPanel";

// Upgrade and locking
export { UpgradePrompt, type UpgradePromptProps } from "./UpgradePrompt";
export { LockedFeature, type LockedFeatureProps } from "./LockedFeature";

// Utility components (moved from components/)
export { Portal } from "./Portal";
export { ScrollableArea, type ScrollableAreaProps } from "./ScrollableArea";
export { Slider, type SliderProps } from "./Slider";
export { ToggleSwitch, type ToggleSwitchProps } from "./ToggleSwitch";
export { HintContext, HintProvider } from "./Hint";
export { HandIcon } from "./Icons";
export { MenuButton, type MenuIconName } from "./MenuButton";
export { MouseLeftIcon } from "./MouseLeftIcon";
export { MouseRightIcon } from "./MouseRightIcon";
export { MouseWheelIcon } from "./MouseWheelIcon";

// Theme utilities
export {
  getThemedGlassmorphismStyle,
  getThemedWindowShadow,
  getDecorativeBorderStyle,
  getSlotStyle,
} from "../theme/themes";

// Notifications
export { NotificationContainer } from "./NotificationContainer";

// Note: Animation utilities are exported from ../theme, not here to avoid duplicate exports
