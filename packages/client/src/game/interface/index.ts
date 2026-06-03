/**
 * Hyperia Interface Components
 *
 * Customizable windows, tabs, and layout presets for game UI.
 *
 * @packageDocumentation
 */

// Core interface components
export { InterfaceManager } from "./InterfaceManager";
export { NavigationRibbon } from "./NavigationRibbon";

// Panel registry for wiring up game panels
export {
  createPanelRenderer,
  getAvailablePanels,
  getPanelConfig,
  getPanelSizeForViewport,
  getResponsivePanelSize,
  calculateResponsiveSize,
  getDeviceType,
  constrainToAspectRatio,
  PANEL_CONFIG,
  type PanelRenderContext,
  type PanelConfig,
  type PanelSize,
  type ResponsiveSizes,
} from "./PanelRegistry";

// Community preset sharing
export { LoadFromPlayer, type LoadFromPlayerProps } from "./LoadFromPlayer";

// Shared hooks for player data and modal panels
export {
  usePlayerData,
  useModalPanels,
  type PlayerDataState,
  type ModalPanelsState,
  type BankData,
  type StoreData,
  type DialogueData,
  type SmeltingData,
  type SmithingData,
  type LootWindowData,
  type QuestStartData,
  type QuestCompleteData,
  type XpLampData,
} from "@/hooks";

// Interface event hooks
export {
  useWorldMapHotkey,
  useOpenPaneEvent,
  useInterfaceUIState,
} from "./useInterfaceEvents";

// Interface modals
export {
  FullscreenWorldMap,
  ItemsKeptOnDeathPanel,
  InterfaceModalsRenderer,
  type InterfaceModalsRendererProps,
} from "./InterfaceModals";

// Interface panels (window content helpers)
export {
  WindowContent,
  DraggableContentWrapper,
  ActionBarWrapper,
  MenuBarWrapper,
  MinimapWrapper,
} from "./InterfacePanels";

// Interface types
export {
  PANEL_ICONS,
  getPanelIcon,
  MAX_ACTION_BARS,
  DEFAULT_GRID_SIZE,
  TAB_BAR_HEIGHT,
  snapToGrid,
  clampPosition,
  type InterfaceManagerProps,
  type PanelRenderer,
  type DragHandleProps,
  type WindowContentProps,
  type DraggableContentWrapperProps,
  type ActionBarWrapperProps,
  type MenuBarWrapperProps,
  type MinimapWrapperProps,
  type InterfaceUIState,
  type InterfaceUIStateSetters,
} from "./types";

// Mobile interface components
export { MobileInterfaceManager } from "./MobileInterfaceManager";
export { CompactStatusHUD } from "./CompactStatusHUD";
export { getMobileUISizes } from "./mobileUISizes";

// Extracted modules for InterfaceManager
export {
  useDragDropCoordinator,
  type DndKitActiveItem,
} from "./DragDropCoordinator";
export { WindowRenderer } from "./WindowRenderer";
export { EditModeOverlayManager, HoldToEditIndicator } from "./EditModeUI";
export { DndKitDragOverlayRenderer } from "./DndKitOverlay";
