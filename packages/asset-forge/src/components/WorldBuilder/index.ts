/**
 * WorldBuilder Components
 *
 * Components for world building and terrain editing in HyperForge.
 * Two-phase system: Creation (procedural) and Editing (layered content).
 */

// Terrain Preview (existing)
export {
  TerrainPreview,
  TerrainControls,
  type TerrainPreviewConfig,
} from "./TerrainPreview";

// Tile-Based Terrain (real game-like terrain viewer)
export {
  TileBasedTerrain,
  type TileBasedTerrainProps,
} from "./TileBasedTerrain";

// Types
export type {
  WorldBuilderMode,
  WorldBuilderState,
  WorldBuilderAction,
  WorldCreationConfig,
  WorldData,
  WorldFoundation,
  WorldLayers,
  Selection,
  SelectionMode,
  HierarchyNode,
  GeneratedBiome,
  GeneratedTown,
  GeneratedBuilding,
  GeneratedRoad,
  BiomeOverride,
  TownOverride,
  PlacedNPC,
  PlacedQuest,
  PlacedBoss,
  PlacedEvent,
  PlacedLore,
  DifficultyZone,
  CustomPlacement,
  ViewportOverlays,
  CameraMode,
} from "./types";

// Default configs
export {
  HYPERIA_CREATION_CONFIG,
  MINIMAL_CREATION_CONFIG,
  BLANK_CREATION_CONFIG,
  DEFAULT_TOWN_CONFIG,
  DEFAULT_ROAD_CONFIG,
  DEFAULT_NOISE_CONFIG,
  DEFAULT_BIOME_CONFIG,
  DEFAULT_ISLAND_CONFIG,
  DEFAULT_VIEWPORT_OVERLAYS,
} from "./types";

// Context
export {
  WorldBuilderProvider,
  useWorldBuilder,
  useWorldBuilderSelector,
  useWorldBuilderMode,
  useCreationState,
  useEditingState,
  useViewportState,
  useCurrentWorld,
  useSelection,
} from "./WorldBuilderContext";

// Creation Mode
export { CreationPanel } from "./CreationMode";

// Editing Mode
export {
  EditorLayout,
  HierarchyPanel,
  PropertiesPanel,
  OverlayControls,
  OverlayDropdown,
} from "./EditingMode";

// Shared Components
export { ModeToggle, ModeIndicator, ModeBanner, TreeView } from "./shared";

// Viewport Overlays
export {
  OverlayManager,
  useViewportOverlays,
  TooltipOverlay,
  SelectionInfoPanel,
} from "./ViewportOverlay";

// Utilities
export {
  serializeWorld,
  deserializeWorld,
  exportWorldToJSON,
  importWorldFromJSON,
  downloadWorldAsFile,
  importWorldFromFile,
  validateWorldData,
  migrateWorldData,
  generateWorldId,
  generateWorldName,
  createNewWorld,
  calculateWorldStats,
} from "./utils";

// Integrated World Tab
export { WorldTab, default as WorldTabDefault } from "./WorldTab";
