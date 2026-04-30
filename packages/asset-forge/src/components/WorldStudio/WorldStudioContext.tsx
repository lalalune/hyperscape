/**
 * World Studio Context
 *
 * State management for the unified world authoring tool (Phase 2).
 * Composes WorldBuilderContext's reducer for world editing state and adds
 * studio-specific state: project/team context, server persistence, and tool modes.
 *
 * Types, reducer, and selectors are extracted into separate modules:
 * - worldStudioTypes.ts — type definitions, action union, initial state
 * - worldStudioReducer.ts — studioReducer + composition function
 * - worldStudioSelectors.ts — pure selector functions + selector hooks
 */

import type {
  TerrainNoiseConfig,
  BiomeConfig,
  IslandConfig,
} from "@hyperforge/procgen/terrain";
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import type {
  WorldBuilderMode,
  WorldCreationConfig,
  WorldData,
  Selection,
  SelectionMode,
  HoverInfo,
  CameraMode,
  ViewportOverlays,
  BiomeOverride,
  TownOverride,
  PlacedNPC,
  PlacedQuest,
  PlacedBoss,
  PlacedEvent,
  PlacedLore,
  DifficultyZone,
  CustomPlacement,
  CreationModeState,
  HierarchyNode,
  WorldPosition,
  GeneratedRoad,
  GeneratedTown,
  GeneratedBuilding,
  CustomRoad,
} from "../WorldBuilder/types";

import type {
  ManifestData,
  ManifestItem,
  ManifestQuest,
  ManifestStore,
  ManifestNPC,
  ManifestCombatSpell,
  ManifestPrayer,
  ManifestRecipe,
  ManifestAmmunition,
  ManifestRune,
  ManifestSkillUnlock,
  ManifestTierRequirement,
  ManifestDuelArena,
  ManifestStation,
  ManifestTree,
  ManifestFishingSpot,
  ManifestMiningRock,
  PlacedSpawnPoint,
  PlacedTeleport,
  PlacedMobSpawn,
  PlacedResource,
  PlacedStation,
  PlacedMine,
  PlacedPOI,
  PlacedWaterBody,
  PlacedRegion,
  PlacedDangerSource,
  PlacedCustomAsset,
  WildernessBoundary,
  Prefab,
  PaletteCategory,
  BrushSettings,
  BrushType,
  TerrainSculptStroke,
  BiomePaintStroke,
  VegetationPaintStroke,
  MaterialPaintStroke,
  FoliagePaintStroke,
  BrushOverlays,
  MusicZone,
  AmbientZone,
  SFXTrigger,
  DeploymentState,
  DeploymentDiff,
  DeploymentRecord,
  AudioLayers,
} from "./types";
import type { ManifestOverrides } from "./types";

import type { GameModule } from "../../gameModules/GameModule";
import { EntityTypeRegistry } from "../../gameModules/EntityTypeRegistry";
import { HyperiaModule } from "../../gameModules/hyperia";
import { useStoreSync } from "../../editor/stores/useStoreSync";

// Import from extracted modules
import type {
  WorldStudioState,
  WorldStudioAction,
  StudioToolMode,
  GizmoTransformMode,
  GizmoTransformSpace,
  StudioViewportOverlays,
  ViewportCallbacks,
  WizardPreviewData,
  StudioProjectState,
  StudioPersistenceState,
  ZonePaintState,
  WorldBuilderState,
  ActivePlacement,
  ExtendedWorldLayers,
  GameEntityData,
  PIEMode,
} from "./worldStudioTypes";

import { worldStudioInitialState } from "./worldStudioTypes";
import { worldStudioReducer } from "./worldStudioReducer";
import type { GameModeManifest } from "@hyperforge/shared/runtime";

// Re-export types for backwards compatibility (70+ files import from this file)
export type {
  WorldStudioState,
  WorldStudioAction,
  StudioToolMode,
  GizmoTransformMode,
  GizmoTransformSpace,
  StudioViewportOverlays,
  ViewportCallbacks,
  WizardPreviewData,
  ZonePaintState,
  PIEMode,
} from "./worldStudioTypes";

// Re-export selectors for discoverability
export {
  selectActiveTool,
  selectTransformMode,
  selectTransformSpace,
  selectGridSize,
  selectActivePlacement,
  selectBrushSettings,
  selectZonePaint,
  selectNPCs,
  selectSpawnPoints,
  selectTeleports,
  selectMobSpawns,
  selectResources,
  selectStations,
  selectPOIs,
  selectWaterBodies,
  selectRegions,
  selectDangerSources,
  selectMines,
  selectWildernessBoundary,
  selectOverlays,
  selectManifests,
  selectManifestOverrides,
  selectAudioLayers,
  selectDeployment,
  selectProject,
  selectPersistence,
  selectWorld,
  selectSelection,
  selectHasUnsavedChanges,
  selectCanUndo,
  selectCanRedo,
  selectGameEntities,
  selectWizardPreview,
} from "./worldStudioSelectors";

// ============== CONTEXT ==============

interface WorldStudioContextValue {
  state: WorldStudioState;
  dispatch: React.Dispatch<WorldStudioAction>;
  /** Ref to viewport callbacks — does not trigger re-renders when mutated */
  viewportRef: React.MutableRefObject<ViewportCallbacks>;
  /** The active game module definition */
  activeModule: GameModule;
  /** Entity type registry for the active game module */
  registry: EntityTypeRegistry;

  /** Convenience action creators matching WorldBuilderContext pattern */
  actions: {
    // Mode
    setMode: (mode: WorldBuilderMode) => void;
    switchToCreation: () => void;
    switchToEditing: () => void;

    // Creation
    setPreset: (presetId: string | null) => void;
    updateCreationConfig: (config: Partial<WorldCreationConfig>) => void;
    updateTerrainConfig: (
      config: Partial<WorldCreationConfig["terrain"]>,
    ) => void;
    updateNoiseConfig: (config: Partial<TerrainNoiseConfig>) => void;
    updateBiomeConfig: (config: Partial<BiomeConfig>) => void;
    updateIslandConfig: (config: Partial<IslandConfig>) => void;
    updateTownConfig: (config: Partial<WorldCreationConfig["towns"]>) => void;
    updateRoadConfig: (config: Partial<WorldCreationConfig["roads"]>) => void;
    setSeed: (seed: number) => void;
    randomizeSeed: () => void;
    startGeneration: () => void;
    finishGeneration: (stats: CreationModeState["previewStats"]) => void;
    failGeneration: (error: string) => void;
    applyAndLock: (world: WorldData) => void;

    // Editing
    loadWorld: (world: WorldData) => void;
    unloadWorld: () => void;
    setSelection: (selection: Selection | null) => void;
    setHovered: (info: HoverInfo | null) => void;
    setSelectionMode: (mode: SelectionMode) => void;
    toggleNodeExpanded: (nodeId: string) => void;
    expandNode: (nodeId: string) => void;
    collapseNode: (nodeId: string) => void;

    // Layer editing
    addBiomeOverride: (override: BiomeOverride) => void;
    updateBiomeOverride: (
      biomeId: string,
      override: Partial<BiomeOverride>,
    ) => void;
    removeBiomeOverride: (biomeId: string) => void;
    addTownOverride: (override: TownOverride) => void;
    updateTownOverride: (
      townId: string,
      override: Partial<TownOverride>,
    ) => void;
    removeTownOverride: (townId: string) => void;
    addNPC: (npc: PlacedNPC) => void;
    updateNPC: (npcId: string, updates: Partial<PlacedNPC>) => void;
    removeNPC: (npcId: string) => void;
    addQuest: (quest: PlacedQuest) => void;
    updateQuest: (questId: string, updates: Partial<PlacedQuest>) => void;
    removeQuest: (questId: string) => void;
    addBoss: (boss: PlacedBoss) => void;
    updateBoss: (bossId: string, updates: Partial<PlacedBoss>) => void;
    removeBoss: (bossId: string) => void;
    addEvent: (event: PlacedEvent) => void;
    updateEvent: (eventId: string, updates: Partial<PlacedEvent>) => void;
    removeEvent: (eventId: string) => void;
    addLore: (lore: PlacedLore) => void;
    updateLore: (loreId: string, updates: Partial<PlacedLore>) => void;
    removeLore: (loreId: string) => void;
    addDifficultyZone: (zone: DifficultyZone) => void;
    updateDifficultyZone: (
      zoneId: string,
      updates: Partial<DifficultyZone>,
    ) => void;
    removeDifficultyZone: (zoneId: string) => void;
    addCustomPlacement: (placement: CustomPlacement) => void;
    updateCustomPlacement: (
      placementId: string,
      updates: Partial<CustomPlacement>,
    ) => void;
    removeCustomPlacement: (placementId: string) => void;
    markSaved: () => void;
    setSaveError: (error: string | null) => void;

    // Viewport
    setCameraMode: (mode: CameraMode) => void;
    setCameraHeight: (height: number) => void;
    setMoveSpeed: (speed: number) => void;
    toggleOverlay: (overlay: keyof ViewportOverlays) => void;
    setOverlays: (overlays: Partial<ViewportOverlays>) => void;

    // History (undo/redo)
    undo: () => void;
    redo: () => void;
    clearHistory: () => void;

    // Studio-specific: Project
    setProject: (
      teamId: string,
      gameId: string,
      projectId: string,
      name: string,
      version: number,
      gameMode: GameModeManifest | null,
      templateId: string | null,
      plugins: ReadonlyArray<string>,
      assetPacks: ReadonlyArray<string>,
    ) => void;
    clearProject: () => void;
    setProjectLock: (lockedBy: string | null) => void;
    setGameMode: (gameMode: GameModeManifest | null) => void;

    // Studio-specific: Persistence
    saveStart: () => void;
    saveSuccess: (savedAt: number, version: number) => void;
    saveError: (error: string) => void;
    loadStart: () => void;
    loadSuccess: () => void;
    loadError: (error: string) => void;
    setAutoSave: (enabled: boolean) => void;

    // Studio-specific: Tools
    setTool: (tool: StudioToolMode) => void;
    setTransformMode: (mode: GizmoTransformMode) => void;
    setTransformSpace: (space: GizmoTransformSpace) => void;
    setGridSize: (size: number) => void;
    setAddingWaterVertices: (enabled: boolean) => void;
    cameraTeleport: (target: {
      x: number;
      y: number;
      z: number;
      close?: boolean;
    }) => void;
    cameraTeleportConsumed: () => void;

    // Studio-specific: Brush
    setBrushSettings: (settings: Partial<BrushSettings>) => void;
    addTerrainSculpt: (stroke: TerrainSculptStroke) => void;
    addBiomePaint: (stroke: BiomePaintStroke) => void;
    addVegetationPaint: (stroke: VegetationPaintStroke) => void;
    addMaterialPaint: (stroke: MaterialPaintStroke) => void;
    addFoliagePaint: (stroke: FoliagePaintStroke) => void;
    setTileCollision: (
      tiles: Array<{ tileX: number; tileZ: number; blocked: boolean }>,
    ) => void;
    undoLastBrushStroke: (brushType: BrushType) => void;
    clearBrushOverlays: (brushType?: BrushType) => void;
    restoreBrushOverlays: (overlays: BrushOverlays) => void;
    restoreExtendedLayers: (layers: ExtendedWorldLayers) => void;
    restoreAudioLayers: (layers: AudioLayers) => void;
    restorePrefabs: (prefabs: Prefab[]) => void;

    // Studio-specific: Placement
    startPlacement: (
      category: PaletteCategory,
      templateId: string,
      templateName: string,
      entityTypeId?: string,
    ) => void;
    updatePlacementPosition: (
      position: WorldPosition,
      rotation?: number,
    ) => void;
    confirmPlacement: () => void;
    cancelPlacement: () => void;

    // Zone tile painting
    startZonePaint: (regionId: string) => void;
    updateZoneCursor: (tile: { x: number; z: number } | null) => void;
    paintZoneTiles: (
      regionId: string,
      tileKeys: string[],
      erase: boolean,
    ) => void;
    setZoneBrushSize: (size: number) => void;
    setZonePaintMode: (mode: "paint" | "erase") => void;
    stopZonePaint: () => void;
    switchZonePaintRegion: (regionId: string) => void;

    // Studio-specific: Extended layers — Spawn Points
    addSpawnPoint: (spawnPoint: PlacedSpawnPoint) => void;
    updateSpawnPoint: (id: string, updates: Partial<PlacedSpawnPoint>) => void;
    removeSpawnPoint: (id: string) => void;

    // Studio-specific: Extended layers — Teleports
    addTeleport: (teleport: PlacedTeleport) => void;
    updateTeleport: (id: string, updates: Partial<PlacedTeleport>) => void;
    removeTeleport: (id: string) => void;

    // Studio-specific: Extended layers — Mob Spawns
    addMobSpawn: (mobSpawn: PlacedMobSpawn) => void;
    updateMobSpawn: (id: string, updates: Partial<PlacedMobSpawn>) => void;
    removeMobSpawn: (id: string) => void;

    // Studio-specific: Extended layers — Resources
    addResource: (resource: PlacedResource) => void;
    updateResource: (id: string, updates: Partial<PlacedResource>) => void;
    removeResource: (id: string) => void;

    // Studio-specific: Extended layers — Stations
    addStation: (station: PlacedStation) => void;
    updateStation: (id: string, updates: Partial<PlacedStation>) => void;
    removeStation: (id: string) => void;

    // Studio-specific: POIs
    addPOI: (poi: PlacedPOI) => void;
    updatePOI: (id: string, updates: Partial<PlacedPOI>) => void;
    removePOI: (id: string) => void;

    // Studio-specific: Water Bodies
    addWaterBody: (waterBody: PlacedWaterBody) => void;
    updateWaterBody: (id: string, updates: Partial<PlacedWaterBody>) => void;
    removeWaterBody: (id: string) => void;

    // Studio-specific: Regions
    addRegion: (region: PlacedRegion) => void;
    updateRegion: (id: string, updates: Partial<PlacedRegion>) => void;
    removeRegion: (id: string) => void;

    // Studio-specific: Batch auto-generation
    batchAddRegions: (regions: PlacedRegion[]) => void;
    batchAddEntities: (
      mobSpawns: PlacedMobSpawn[],
      resources: PlacedResource[],
    ) => void;
    batchAddMines: (mines: PlacedMine[]) => void;
    addMine: (mine: PlacedMine) => void;
    removeMine: (id: string) => void;
    clearAllAutogen: () => void;

    // Move a town to a new position
    moveTown: (
      townId: string,
      position: { x: number; y: number; z: number },
    ) => void;
    // Town unification — sync runtime-generated towns into foundation
    syncRuntimeTowns: (
      towns: Array<{
        id: string;
        name: string;
        position: { x: number; y: number; z: number };
        size: "hamlet" | "village" | "town";
        safeZoneRadius: number;
        biomeId?: string;
        buildings?: Array<{
          id: string;
          type: string;
          position: { x: number; y: number; z: number };
          rotation: number;
          size: { width: number; depth: number };
        }>;
      }>,
    ) => void;
    setFoundationRoads: (roads: GeneratedRoad[]) => void;
    addCustomRoad: (road: CustomRoad) => void;
    updateCustomRoad: (roadId: string, updates: Partial<CustomRoad>) => void;
    removeCustomRoad: (roadId: string) => void;
    setFoundationTowns: (
      towns: GeneratedTown[],
      buildings: GeneratedBuilding[],
    ) => void;
    setFoundationConfig: (config: WorldCreationConfig) => void;

    // Studio-specific: Danger Sources
    addDangerSource: (dangerSource: PlacedDangerSource) => void;
    updateDangerSource: (
      id: string,
      updates: Partial<PlacedDangerSource>,
    ) => void;
    removeDangerSource: (id: string) => void;

    // Studio-specific: Wilderness Boundary
    setWildernessBoundary: (boundary: WildernessBoundary | null) => void;

    // Studio-specific: Manifests
    loadManifestsStart: () => void;
    loadManifestsSuccess: (
      data: Omit<ManifestData, "loaded" | "loading" | "error">,
    ) => void;
    loadManifestsError: (error: string) => void;
    updateManifestRaw: (name: string, content: unknown) => void;
    updateManifestItems: (items: ManifestItem[]) => void;
    updateManifestQuests: (quests: ManifestQuest[]) => void;
    updateManifestStores: (stores: ManifestStore[]) => void;
    updateManifestNPCs: (npcs: ManifestNPC[]) => void;
    updateManifestCombatSpells: (combatSpells: ManifestCombatSpell[]) => void;
    updateManifestPrayers: (prayers: ManifestPrayer[]) => void;
    updateManifestRecipes: (recipes: ManifestRecipe[]) => void;
    updateManifestAmmunition: (ammunition: ManifestAmmunition[]) => void;
    updateManifestRunes: (runes: ManifestRune[]) => void;
    updateManifestSkillUnlocks: (skillUnlocks: ManifestSkillUnlock[]) => void;
    updateManifestTierRequirements: (
      tierRequirements: ManifestTierRequirement[],
    ) => void;
    updateManifestDuelArenas: (duelArenas: ManifestDuelArena[]) => void;
    updateManifestStations: (stations: ManifestStation[]) => void;
    updateManifestTrees: (trees: ManifestTree[]) => void;
    updateManifestFishingSpots: (fishingSpots: ManifestFishingSpot[]) => void;
    updateManifestMiningRocks: (miningRocks: ManifestMiningRock[]) => void;

    // Phase 7: Audio zones
    addMusicZone: (zone: MusicZone) => void;
    updateMusicZone: (id: string, updates: Partial<MusicZone>) => void;
    removeMusicZone: (id: string) => void;
    addAmbientZone: (zone: AmbientZone) => void;
    updateAmbientZone: (id: string, updates: Partial<AmbientZone>) => void;
    removeAmbientZone: (id: string) => void;
    addSFXTrigger: (trigger: SFXTrigger) => void;
    updateSFXTrigger: (id: string, updates: Partial<SFXTrigger>) => void;
    removeSFXTrigger: (id: string) => void;

    // Phase 9.1: Custom assets
    addCustomAsset: (asset: PlacedCustomAsset) => void;
    updateCustomAsset: (
      id: string,
      updates: Partial<PlacedCustomAsset>,
    ) => void;
    removeCustomAsset: (id: string) => void;

    // Phase 9.2: Prefabs
    addPrefab: (prefab: Prefab) => void;
    updatePrefab: (id: string, updates: Partial<Prefab>) => void;
    removePrefab: (id: string) => void;

    // Phase 7: AI generation
    startAIGeneration: (
      generationType: "dialogue" | "voice" | "quest",
      entityId: string,
    ) => void;
    completeAIGeneration: (
      generationType: "dialogue" | "voice" | "quest",
      entityId: string,
      result: unknown,
    ) => void;
    errorAIGeneration: (
      generationType: "dialogue" | "voice" | "quest",
      entityId: string,
      error: string,
    ) => void;
    acceptAIGeneration: (
      generationType: "dialogue" | "voice" | "quest",
      entityId: string,
    ) => void;
    rejectAIGeneration: (
      generationType: "dialogue" | "voice" | "quest",
      entityId: string,
    ) => void;
    // Phase 8: Deployment pipeline
    deployStagingStart: () => void;
    deployStagingStatus: (
      status: DeploymentState["stagingStatus"],
      error?: string,
    ) => void;
    deployStagingComplete: (record: DeploymentRecord) => void;
    deployProductionStart: () => void;
    deployProductionStatus: (
      status: DeploymentState["productionStatus"],
      error?: string,
    ) => void;
    deployProductionComplete: (record: DeploymentRecord) => void;
    deployDiffStart: () => void;
    deployDiffComplete: (diff: DeploymentDiff) => void;
    deployHistoryLoad: (history: DeploymentRecord[]) => void;
    deployRollback: (deploymentId: string) => void;
    deployPromotionRequest: (
      id: string,
      requestedBy: string,
      diff: DeploymentDiff,
    ) => void;
    deployPromotionApprove: (approvedBy: string) => void;
    deployPromotionReject: () => void;
    // Phase 9: Viewport overlays
    setOverlay: (overlay: Partial<StudioViewportOverlays>) => void;
    // Game entity data
    setGameEntities: (data: GameEntityData) => void;
    // Wizard preview
    setWizardPreview: (preview: WizardPreviewData) => void;
    clearWizardPreview: () => void;
    // Live terrain config for real-time slider updates
    setLiveTerrainConfig: (config: WorldCreationConfig) => void;
    clearLiveTerrainConfig: () => void;
    // Manifest overrides
    setManifestOverride: (
      overrideType: keyof ManifestOverrides,
      entityId: string,
      data: Record<string, unknown>,
    ) => void;
    clearManifestOverride: (
      overrideType: keyof ManifestOverrides,
      entityId: string,
    ) => void;
    loadManifestOverrides: (overrides: ManifestOverrides) => void;
    clearAllManifestOverrides: () => void;
    // Phase 4: Play-In-Editor
    pieStart: () => void;
    pieStarted: () => void;
    pieStop: () => void;
    pieError: (error: string) => void;
    /**
     * Set the PIE execution mode. Only takes effect while PIE is idle;
     * mid-session mode switches are rejected in the reducer.
     */
    pieSetMode: (mode: PIEMode) => void;
  };

  /** Computed values */
  computed: {
    isCreationMode: boolean;
    isEditingMode: boolean;
    hasLoadedWorld: boolean;
    isConfigModified: boolean;
    getHierarchyTree: () => HierarchyNode | null;
    canUndo: boolean;
    canRedo: boolean;
    undoCount: number;
    redoCount: number;
    hasProject: boolean;
    isProjectLocked: boolean;
    hasUnsavedChanges: boolean;
    isPersisting: boolean;
  };
}

const WorldStudioContext = createContext<WorldStudioContextValue | null>(null);

/**
 * Dispatch-only context — components that only fire actions (toolbars, buttons)
 * subscribe here to avoid re-rendering on every state change.
 */
const WorldStudioDispatchContext =
  createContext<React.Dispatch<WorldStudioAction> | null>(null);

// ============== PROVIDER ==============

interface WorldStudioProviderProps {
  children: ReactNode;
  /** Active game module — defaults to HyperiaModule */
  module?: GameModule;
}

export function WorldStudioProvider({
  children,
  module,
}: WorldStudioProviderProps) {
  const [state, dispatch] = useReducer(
    worldStudioReducer,
    worldStudioInitialState,
  );
  const viewportRef = useRef<ViewportCallbacks>({});

  // Accept module prop, default to Hyperia
  const activeModule = module ?? HyperiaModule;

  // Build entity type registry for the active game module
  const registry = useMemo(
    () => new EntityTypeRegistry(activeModule),
    [activeModule],
  );

  // Sync context state → Zustand stores for incremental migration
  useStoreSync(state);

  // Memoized action creators
  const actions = useMemo(
    () => ({
      // Mode
      setMode: (mode: WorldBuilderMode) => dispatch({ type: "SET_MODE", mode }),
      switchToCreation: () => dispatch({ type: "SET_MODE", mode: "creation" }),
      switchToEditing: () => dispatch({ type: "SET_MODE", mode: "editing" }),

      // Creation
      setPreset: (presetId: string | null) =>
        dispatch({ type: "SET_PRESET", presetId }),
      updateCreationConfig: (config: Partial<WorldCreationConfig>) =>
        dispatch({ type: "UPDATE_CREATION_CONFIG", config }),
      updateTerrainConfig: (config: Partial<WorldCreationConfig["terrain"]>) =>
        dispatch({ type: "UPDATE_TERRAIN_CONFIG", config }),
      updateNoiseConfig: (config: Partial<TerrainNoiseConfig>) =>
        dispatch({ type: "UPDATE_NOISE_CONFIG", config }),
      updateBiomeConfig: (config: Partial<BiomeConfig>) =>
        dispatch({ type: "UPDATE_BIOME_CONFIG", config }),
      updateIslandConfig: (config: Partial<IslandConfig>) =>
        dispatch({ type: "UPDATE_ISLAND_CONFIG", config }),
      updateTownConfig: (config: Partial<WorldCreationConfig["towns"]>) =>
        dispatch({ type: "UPDATE_TOWN_CONFIG", config }),
      updateRoadConfig: (config: Partial<WorldCreationConfig["roads"]>) =>
        dispatch({ type: "UPDATE_ROAD_CONFIG", config }),
      setSeed: (seed: number) => dispatch({ type: "SET_SEED", seed }),
      randomizeSeed: () => dispatch({ type: "RANDOMIZE_SEED" }),
      startGeneration: () => dispatch({ type: "GENERATE_PREVIEW_START" }),
      finishGeneration: (stats: CreationModeState["previewStats"]) =>
        dispatch({ type: "GENERATE_PREVIEW_SUCCESS", stats }),
      failGeneration: (error: string) =>
        dispatch({ type: "GENERATE_PREVIEW_ERROR", error }),
      applyAndLock: (world: WorldData) =>
        dispatch({ type: "APPLY_AND_LOCK", world }),

      // Editing
      loadWorld: (world: WorldData) => dispatch({ type: "LOAD_WORLD", world }),
      unloadWorld: () => dispatch({ type: "UNLOAD_WORLD" }),
      setSelection: (selection: Selection | null) =>
        dispatch({ type: "SET_SELECTION", selection }),
      setHovered: (info: HoverInfo | null) =>
        dispatch({ type: "SET_HOVERED", info }),
      setSelectionMode: (mode: SelectionMode) =>
        dispatch({ type: "SET_SELECTION_MODE", mode }),
      toggleNodeExpanded: (nodeId: string) =>
        dispatch({ type: "TOGGLE_NODE_EXPANDED", nodeId }),
      expandNode: (nodeId: string) => dispatch({ type: "EXPAND_NODE", nodeId }),
      collapseNode: (nodeId: string) =>
        dispatch({ type: "COLLAPSE_NODE", nodeId }),

      // Layer editing
      addBiomeOverride: (override: BiomeOverride) =>
        dispatch({ type: "ADD_BIOME_OVERRIDE", override }),
      updateBiomeOverride: (
        biomeId: string,
        override: Partial<BiomeOverride>,
      ) => dispatch({ type: "UPDATE_BIOME_OVERRIDE", biomeId, override }),
      removeBiomeOverride: (biomeId: string) =>
        dispatch({ type: "REMOVE_BIOME_OVERRIDE", biomeId }),
      addTownOverride: (override: TownOverride) =>
        dispatch({ type: "ADD_TOWN_OVERRIDE", override }),
      updateTownOverride: (townId: string, override: Partial<TownOverride>) =>
        dispatch({ type: "UPDATE_TOWN_OVERRIDE", townId, override }),
      removeTownOverride: (townId: string) =>
        dispatch({ type: "REMOVE_TOWN_OVERRIDE", townId }),
      addNPC: (npc: PlacedNPC) => dispatch({ type: "ADD_NPC", npc }),
      updateNPC: (npcId: string, updates: Partial<PlacedNPC>) =>
        dispatch({ type: "UPDATE_NPC", npcId, updates }),
      removeNPC: (npcId: string) => dispatch({ type: "REMOVE_NPC", npcId }),
      addQuest: (quest: PlacedQuest) => dispatch({ type: "ADD_QUEST", quest }),
      updateQuest: (questId: string, updates: Partial<PlacedQuest>) =>
        dispatch({ type: "UPDATE_QUEST", questId, updates }),
      removeQuest: (questId: string) =>
        dispatch({ type: "REMOVE_QUEST", questId }),
      addBoss: (boss: PlacedBoss) => dispatch({ type: "ADD_BOSS", boss }),
      updateBoss: (bossId: string, updates: Partial<PlacedBoss>) =>
        dispatch({ type: "UPDATE_BOSS", bossId, updates }),
      removeBoss: (bossId: string) => dispatch({ type: "REMOVE_BOSS", bossId }),
      addEvent: (event: PlacedEvent) => dispatch({ type: "ADD_EVENT", event }),
      updateEvent: (eventId: string, updates: Partial<PlacedEvent>) =>
        dispatch({ type: "UPDATE_EVENT", eventId, updates }),
      removeEvent: (eventId: string) =>
        dispatch({ type: "REMOVE_EVENT", eventId }),
      addLore: (lore: PlacedLore) => dispatch({ type: "ADD_LORE", lore }),
      updateLore: (loreId: string, updates: Partial<PlacedLore>) =>
        dispatch({ type: "UPDATE_LORE", loreId, updates }),
      removeLore: (loreId: string) => dispatch({ type: "REMOVE_LORE", loreId }),
      addDifficultyZone: (zone: DifficultyZone) =>
        dispatch({ type: "ADD_DIFFICULTY_ZONE", zone }),
      updateDifficultyZone: (
        zoneId: string,
        updates: Partial<DifficultyZone>,
      ) => dispatch({ type: "UPDATE_DIFFICULTY_ZONE", zoneId, updates }),
      removeDifficultyZone: (zoneId: string) =>
        dispatch({ type: "REMOVE_DIFFICULTY_ZONE", zoneId }),
      addCustomPlacement: (placement: CustomPlacement) =>
        dispatch({ type: "ADD_CUSTOM_PLACEMENT", placement }),
      updateCustomPlacement: (
        placementId: string,
        updates: Partial<CustomPlacement>,
      ) => dispatch({ type: "UPDATE_CUSTOM_PLACEMENT", placementId, updates }),
      removeCustomPlacement: (placementId: string) =>
        dispatch({ type: "REMOVE_CUSTOM_PLACEMENT", placementId }),
      markSaved: () => dispatch({ type: "MARK_SAVED" }),
      setSaveError: (error: string | null) =>
        dispatch({ type: "SET_SAVE_ERROR", error }),

      // Viewport
      setCameraMode: (mode: CameraMode) =>
        dispatch({ type: "SET_CAMERA_MODE", mode }),
      setCameraHeight: (height: number) =>
        dispatch({ type: "SET_CAMERA_HEIGHT", height }),
      setMoveSpeed: (speed: number) =>
        dispatch({ type: "SET_MOVE_SPEED", speed }),
      toggleOverlay: (overlay: keyof ViewportOverlays) =>
        dispatch({ type: "TOGGLE_OVERLAY", overlay }),
      setOverlays: (overlays: Partial<ViewportOverlays>) =>
        dispatch({ type: "SET_OVERLAYS", overlays }),

      // History (undo/redo)
      undo: () => dispatch({ type: "UNDO" }),
      redo: () => dispatch({ type: "REDO" }),
      clearHistory: () => dispatch({ type: "CLEAR_HISTORY" }),

      // Studio-specific: Project
      setProject: (
        teamId: string,
        gameId: string,
        projectId: string,
        name: string,
        version: number,
        gameMode: GameModeManifest | null,
        templateId: string | null,
        plugins: ReadonlyArray<string>,
        assetPacks: ReadonlyArray<string>,
      ) =>
        dispatch({
          type: "SET_PROJECT",
          teamId,
          gameId,
          projectId,
          name,
          version,
          gameMode,
          templateId,
          plugins,
          assetPacks,
        }),
      clearProject: () => dispatch({ type: "CLEAR_PROJECT" }),
      setProjectLock: (lockedBy: string | null) =>
        dispatch({ type: "SET_PROJECT_LOCK", lockedBy }),
      setGameMode: (gameMode: GameModeManifest | null) =>
        dispatch({ type: "SET_GAME_MODE", gameMode }),

      // Studio-specific: Persistence
      saveStart: () => dispatch({ type: "SAVE_START" }),
      saveSuccess: (savedAt: number, version: number) =>
        dispatch({ type: "SAVE_SUCCESS", savedAt, version }),
      saveError: (error: string) => dispatch({ type: "SAVE_ERROR", error }),
      loadStart: () => dispatch({ type: "LOAD_START" }),
      loadSuccess: () => dispatch({ type: "LOAD_SUCCESS" }),
      loadError: (error: string) => dispatch({ type: "LOAD_ERROR", error }),
      setAutoSave: (enabled: boolean) =>
        dispatch({ type: "SET_AUTO_SAVE", enabled }),

      // Studio-specific: Tools
      setTool: (tool: StudioToolMode) => dispatch({ type: "SET_TOOL", tool }),
      setTransformMode: (mode: GizmoTransformMode) =>
        dispatch({ type: "SET_TRANSFORM_MODE", mode }),
      setTransformSpace: (space: GizmoTransformSpace) =>
        dispatch({ type: "SET_TRANSFORM_SPACE", space }),
      setGridSize: (size: number) => dispatch({ type: "SET_GRID_SIZE", size }),
      setAddingWaterVertices: (enabled: boolean) =>
        dispatch({ type: "SET_ADDING_WATER_VERTICES", enabled }),
      cameraTeleport: (target: {
        x: number;
        y: number;
        z: number;
        close?: boolean;
      }) => dispatch({ type: "CAMERA_TELEPORT", target }),
      cameraTeleportConsumed: () =>
        dispatch({ type: "CAMERA_TELEPORT_CONSUMED" }),

      // Studio-specific: Brush
      setBrushSettings: (settings: Partial<BrushSettings>) =>
        dispatch({ type: "SET_BRUSH_SETTINGS", settings }),
      addTerrainSculpt: (stroke: TerrainSculptStroke) =>
        dispatch({ type: "ADD_TERRAIN_SCULPT", stroke }),
      addBiomePaint: (stroke: BiomePaintStroke) =>
        dispatch({ type: "ADD_BIOME_PAINT", stroke }),
      addVegetationPaint: (stroke: VegetationPaintStroke) =>
        dispatch({ type: "ADD_VEGETATION_PAINT", stroke }),
      addMaterialPaint: (stroke: MaterialPaintStroke) =>
        dispatch({ type: "ADD_MATERIAL_PAINT", stroke }),
      addFoliagePaint: (stroke: FoliagePaintStroke) =>
        dispatch({ type: "ADD_FOLIAGE_PAINT", stroke }),
      setTileCollision: (
        tiles: Array<{ tileX: number; tileZ: number; blocked: boolean }>,
      ) => dispatch({ type: "SET_TILE_COLLISION", tiles }),
      undoLastBrushStroke: (brushType: BrushType) =>
        dispatch({ type: "UNDO_LAST_BRUSH_STROKE", brushType }),
      clearBrushOverlays: (brushType?: BrushType) =>
        dispatch({ type: "CLEAR_BRUSH_OVERLAYS", brushType }),
      restoreBrushOverlays: (overlays: BrushOverlays) =>
        dispatch({ type: "RESTORE_BRUSH_OVERLAYS", overlays }),
      restoreExtendedLayers: (layers: ExtendedWorldLayers) =>
        dispatch({ type: "RESTORE_EXTENDED_LAYERS", layers }),
      restoreAudioLayers: (layers: AudioLayers) =>
        dispatch({ type: "RESTORE_AUDIO_LAYERS", layers }),
      restorePrefabs: (prefabs: Prefab[]) =>
        dispatch({ type: "RESTORE_PREFABS", prefabs }),

      // Studio-specific: Placement
      startPlacement: (
        category: PaletteCategory,
        templateId: string,
        templateName: string,
        entityTypeId?: string,
      ) =>
        dispatch({
          type: "START_PLACEMENT",
          category,
          templateId,
          templateName,
          entityTypeId,
        }),
      updatePlacementPosition: (position: WorldPosition, rotation?: number) =>
        dispatch({ type: "UPDATE_PLACEMENT_POSITION", position, rotation }),
      confirmPlacement: () => dispatch({ type: "CONFIRM_PLACEMENT" }),
      cancelPlacement: () => dispatch({ type: "CANCEL_PLACEMENT" }),

      // Zone tile painting
      startZonePaint: (regionId: string) =>
        dispatch({ type: "START_ZONE_PAINT", regionId }),
      updateZoneCursor: (tile: { x: number; z: number } | null) =>
        dispatch({ type: "UPDATE_ZONE_CURSOR", tile }),
      paintZoneTiles: (regionId: string, tileKeys: string[], erase: boolean) =>
        dispatch({ type: "PAINT_ZONE_TILES", regionId, tileKeys, erase }),
      setZoneBrushSize: (size: number) =>
        dispatch({ type: "SET_ZONE_BRUSH_SIZE", size }),
      setZonePaintMode: (mode: "paint" | "erase") =>
        dispatch({ type: "SET_ZONE_PAINT_MODE", mode }),
      stopZonePaint: () => dispatch({ type: "STOP_ZONE_PAINT" }),
      switchZonePaintRegion: (regionId: string) =>
        dispatch({ type: "SWITCH_ZONE_PAINT_REGION", regionId }),

      // Studio-specific: Extended layers — Spawn Points
      addSpawnPoint: (spawnPoint: PlacedSpawnPoint) =>
        dispatch({ type: "ADD_SPAWN_POINT", spawnPoint }),
      updateSpawnPoint: (id: string, updates: Partial<PlacedSpawnPoint>) =>
        dispatch({ type: "UPDATE_SPAWN_POINT", id, updates }),
      removeSpawnPoint: (id: string) =>
        dispatch({ type: "REMOVE_SPAWN_POINT", id }),

      // Studio-specific: Extended layers — Teleports
      addTeleport: (teleport: PlacedTeleport) =>
        dispatch({ type: "ADD_TELEPORT", teleport }),
      updateTeleport: (id: string, updates: Partial<PlacedTeleport>) =>
        dispatch({ type: "UPDATE_TELEPORT", id, updates }),
      removeTeleport: (id: string) => dispatch({ type: "REMOVE_TELEPORT", id }),

      // Studio-specific: Extended layers — Mob Spawns
      addMobSpawn: (mobSpawn: PlacedMobSpawn) =>
        dispatch({ type: "ADD_MOB_SPAWN", mobSpawn }),
      updateMobSpawn: (id: string, updates: Partial<PlacedMobSpawn>) =>
        dispatch({ type: "UPDATE_MOB_SPAWN", id, updates }),
      removeMobSpawn: (id: string) =>
        dispatch({ type: "REMOVE_MOB_SPAWN", id }),

      // Studio-specific: Extended layers — Resources
      addResource: (resource: PlacedResource) =>
        dispatch({ type: "ADD_RESOURCE", resource }),
      updateResource: (id: string, updates: Partial<PlacedResource>) =>
        dispatch({ type: "UPDATE_RESOURCE", id, updates }),
      removeResource: (id: string) => dispatch({ type: "REMOVE_RESOURCE", id }),

      // Studio-specific: Extended layers — Stations
      addStation: (station: PlacedStation) =>
        dispatch({ type: "ADD_STATION", station }),
      updateStation: (id: string, updates: Partial<PlacedStation>) =>
        dispatch({ type: "UPDATE_STATION", id, updates }),
      removeStation: (id: string) => dispatch({ type: "REMOVE_STATION", id }),

      // Studio-specific: Extended layers — POIs
      addPOI: (poi: PlacedPOI) => dispatch({ type: "ADD_POI", poi }),
      updatePOI: (id: string, updates: Partial<PlacedPOI>) =>
        dispatch({ type: "UPDATE_POI", id, updates }),
      removePOI: (id: string) => dispatch({ type: "REMOVE_POI", id }),

      // Studio-specific: Extended layers — Water Bodies
      addWaterBody: (waterBody: PlacedWaterBody) =>
        dispatch({ type: "ADD_WATER_BODY", waterBody }),
      updateWaterBody: (id: string, updates: Partial<PlacedWaterBody>) =>
        dispatch({ type: "UPDATE_WATER_BODY", id, updates }),
      removeWaterBody: (id: string) =>
        dispatch({ type: "REMOVE_WATER_BODY", id }),

      // Studio-specific: Extended layers — Regions
      addRegion: (region: PlacedRegion) =>
        dispatch({ type: "ADD_REGION", region }),
      updateRegion: (id: string, updates: Partial<PlacedRegion>) =>
        dispatch({ type: "UPDATE_REGION", id, updates }),
      removeRegion: (id: string) => dispatch({ type: "REMOVE_REGION", id }),

      // Studio-specific: Batch auto-generation actions
      batchAddRegions: (regions: PlacedRegion[]) =>
        dispatch({ type: "BATCH_ADD_REGIONS", regions }),
      batchAddEntities: (
        mobSpawns: PlacedMobSpawn[],
        resources: PlacedResource[],
      ) => dispatch({ type: "BATCH_ADD_ENTITIES", mobSpawns, resources }),
      batchAddMines: (mines: PlacedMine[]) =>
        dispatch({ type: "BATCH_ADD_MINES", mines }),
      addMine: (mine: PlacedMine) => dispatch({ type: "ADD_MINE", mine }),
      removeMine: (id: string) => dispatch({ type: "REMOVE_MINE", id }),
      clearAllAutogen: () => dispatch({ type: "CLEAR_ALL_AUTOGEN" }),

      // Move a town to a new position
      moveTown: (
        townId: string,
        position: { x: number; y: number; z: number },
      ) => dispatch({ type: "MOVE_TOWN", townId, position }),

      // Town unification
      syncRuntimeTowns: (
        towns: Array<{
          id: string;
          name: string;
          position: { x: number; y: number; z: number };
          size: "hamlet" | "village" | "town";
          safeZoneRadius: number;
          biomeId?: string;
          buildings?: Array<{
            id: string;
            type: string;
            position: { x: number; y: number; z: number };
            rotation: number;
            size: { width: number; depth: number };
          }>;
        }>,
      ) => dispatch({ type: "SYNC_RUNTIME_TOWNS", towns }),

      // Foundation roads
      setFoundationRoads: (roads: GeneratedRoad[]) =>
        dispatch({ type: "SET_FOUNDATION_ROADS", roads }),
      // Custom road CRUD
      addCustomRoad: (road: CustomRoad) =>
        dispatch({ type: "ADD_CUSTOM_ROAD", road }),
      updateCustomRoad: (roadId: string, updates: Partial<CustomRoad>) =>
        dispatch({ type: "UPDATE_CUSTOM_ROAD", roadId, updates }),
      removeCustomRoad: (roadId: string) =>
        dispatch({ type: "REMOVE_CUSTOM_ROAD", roadId }),
      setFoundationTowns: (
        towns: GeneratedTown[],
        buildings: GeneratedBuilding[],
      ) => dispatch({ type: "SET_FOUNDATION_TOWNS", towns, buildings }),
      setFoundationConfig: (config: WorldCreationConfig) =>
        dispatch({ type: "SET_FOUNDATION_CONFIG", config }),

      // Studio-specific: Extended layers — Danger Sources
      addDangerSource: (dangerSource: PlacedDangerSource) =>
        dispatch({ type: "ADD_DANGER_SOURCE", dangerSource }),
      updateDangerSource: (id: string, updates: Partial<PlacedDangerSource>) =>
        dispatch({ type: "UPDATE_DANGER_SOURCE", id, updates }),
      removeDangerSource: (id: string) =>
        dispatch({ type: "REMOVE_DANGER_SOURCE", id }),

      // Studio-specific: Extended layers — Wilderness Boundary
      setWildernessBoundary: (boundary: WildernessBoundary | null) =>
        dispatch({ type: "SET_WILDERNESS_BOUNDARY", boundary }),

      // Studio-specific: Manifests
      loadManifestsStart: () => dispatch({ type: "MANIFESTS_LOAD_START" }),
      loadManifestsSuccess: (
        data: Omit<ManifestData, "loaded" | "loading" | "error">,
      ) => dispatch({ type: "MANIFESTS_LOAD_SUCCESS", data }),
      loadManifestsError: (error: string) =>
        dispatch({ type: "MANIFESTS_LOAD_ERROR", error }),
      updateManifestRaw: (name: string, content: unknown) =>
        dispatch({ type: "MANIFEST_UPDATE_RAW", name, content }),
      updateManifestItems: (items: ManifestItem[]) =>
        dispatch({ type: "MANIFEST_UPDATE_ITEMS", items }),
      updateManifestQuests: (quests: ManifestQuest[]) =>
        dispatch({ type: "MANIFEST_UPDATE_QUESTS", quests }),
      updateManifestStores: (stores: ManifestStore[]) =>
        dispatch({ type: "MANIFEST_UPDATE_STORES", stores }),
      updateManifestNPCs: (npcs: ManifestNPC[]) =>
        dispatch({ type: "MANIFEST_UPDATE_NPCS", npcs }),
      updateManifestCombatSpells: (combatSpells: ManifestCombatSpell[]) =>
        dispatch({ type: "MANIFEST_UPDATE_COMBAT_SPELLS", combatSpells }),
      updateManifestPrayers: (prayers: ManifestPrayer[]) =>
        dispatch({ type: "MANIFEST_UPDATE_PRAYERS", prayers }),
      updateManifestRecipes: (recipes: ManifestRecipe[]) =>
        dispatch({ type: "MANIFEST_UPDATE_RECIPES", recipes }),
      updateManifestAmmunition: (ammunition: ManifestAmmunition[]) =>
        dispatch({ type: "MANIFEST_UPDATE_AMMUNITION", ammunition }),
      updateManifestRunes: (runes: ManifestRune[]) =>
        dispatch({ type: "MANIFEST_UPDATE_RUNES", runes }),
      updateManifestSkillUnlocks: (skillUnlocks: ManifestSkillUnlock[]) =>
        dispatch({ type: "MANIFEST_UPDATE_SKILL_UNLOCKS", skillUnlocks }),
      updateManifestTierRequirements: (
        tierRequirements: ManifestTierRequirement[],
      ) =>
        dispatch({
          type: "MANIFEST_UPDATE_TIER_REQUIREMENTS",
          tierRequirements,
        }),
      updateManifestDuelArenas: (duelArenas: ManifestDuelArena[]) =>
        dispatch({ type: "MANIFEST_UPDATE_DUEL_ARENAS", duelArenas }),
      updateManifestStations: (stations: ManifestStation[]) =>
        dispatch({ type: "MANIFEST_UPDATE_STATIONS", stations }),
      updateManifestTrees: (trees: ManifestTree[]) =>
        dispatch({ type: "MANIFEST_UPDATE_TREES", trees }),
      updateManifestFishingSpots: (fishingSpots: ManifestFishingSpot[]) =>
        dispatch({ type: "MANIFEST_UPDATE_FISHING_SPOTS", fishingSpots }),
      updateManifestMiningRocks: (miningRocks: ManifestMiningRock[]) =>
        dispatch({ type: "MANIFEST_UPDATE_MINING_ROCKS", miningRocks }),

      // Phase 7: Audio zones
      addMusicZone: (zone: MusicZone) =>
        dispatch({ type: "ADD_MUSIC_ZONE", zone }),
      updateMusicZone: (id: string, updates: Partial<MusicZone>) =>
        dispatch({ type: "UPDATE_MUSIC_ZONE", id, updates }),
      removeMusicZone: (id: string) =>
        dispatch({ type: "REMOVE_MUSIC_ZONE", id }),
      addAmbientZone: (zone: AmbientZone) =>
        dispatch({ type: "ADD_AMBIENT_ZONE", zone }),
      updateAmbientZone: (id: string, updates: Partial<AmbientZone>) =>
        dispatch({ type: "UPDATE_AMBIENT_ZONE", id, updates }),
      removeAmbientZone: (id: string) =>
        dispatch({ type: "REMOVE_AMBIENT_ZONE", id }),
      addSFXTrigger: (trigger: SFXTrigger) =>
        dispatch({ type: "ADD_SFX_TRIGGER", trigger }),
      updateSFXTrigger: (id: string, updates: Partial<SFXTrigger>) =>
        dispatch({ type: "UPDATE_SFX_TRIGGER", id, updates }),
      removeSFXTrigger: (id: string) =>
        dispatch({ type: "REMOVE_SFX_TRIGGER", id }),

      // Phase 9.1: Custom assets
      addCustomAsset: (asset: PlacedCustomAsset) =>
        dispatch({ type: "ADD_CUSTOM_ASSET", asset }),
      updateCustomAsset: (id: string, updates: Partial<PlacedCustomAsset>) =>
        dispatch({ type: "UPDATE_CUSTOM_ASSET", id, updates }),
      removeCustomAsset: (id: string) =>
        dispatch({ type: "REMOVE_CUSTOM_ASSET", id }),

      // Phase 9.2: Prefabs
      addPrefab: (prefab: Prefab) => dispatch({ type: "ADD_PREFAB", prefab }),
      updatePrefab: (id: string, updates: Partial<Prefab>) =>
        dispatch({ type: "UPDATE_PREFAB", id, updates }),
      removePrefab: (id: string) => dispatch({ type: "REMOVE_PREFAB", id }),

      // Phase 7: AI generation
      startAIGeneration: (
        generationType: "dialogue" | "voice" | "quest",
        entityId: string,
      ) => dispatch({ type: "AI_GENERATION_START", generationType, entityId }),
      completeAIGeneration: (
        generationType: "dialogue" | "voice" | "quest",
        entityId: string,
        result: unknown,
      ) =>
        dispatch({
          type: "AI_GENERATION_COMPLETE",
          generationType,
          entityId,
          result,
        }),
      errorAIGeneration: (
        generationType: "dialogue" | "voice" | "quest",
        entityId: string,
        error: string,
      ) =>
        dispatch({
          type: "AI_GENERATION_ERROR",
          generationType,
          entityId,
          error,
        }),
      acceptAIGeneration: (
        generationType: "dialogue" | "voice" | "quest",
        entityId: string,
      ) => dispatch({ type: "AI_GENERATION_ACCEPT", generationType, entityId }),
      rejectAIGeneration: (
        generationType: "dialogue" | "voice" | "quest",
        entityId: string,
      ) => dispatch({ type: "AI_GENERATION_REJECT", generationType, entityId }),
      // Phase 8: Deployment pipeline
      deployStagingStart: () => dispatch({ type: "DEPLOY_STAGING_START" }),
      deployStagingStatus: (
        status: DeploymentState["stagingStatus"],
        error?: string,
      ) => dispatch({ type: "DEPLOY_STAGING_STATUS", status, error }),
      deployStagingComplete: (record: DeploymentRecord) =>
        dispatch({ type: "DEPLOY_STAGING_COMPLETE", record }),
      deployProductionStart: () =>
        dispatch({ type: "DEPLOY_PRODUCTION_START" }),
      deployProductionStatus: (
        status: DeploymentState["productionStatus"],
        error?: string,
      ) => dispatch({ type: "DEPLOY_PRODUCTION_STATUS", status, error }),
      deployProductionComplete: (record: DeploymentRecord) =>
        dispatch({ type: "DEPLOY_PRODUCTION_COMPLETE", record }),
      deployDiffStart: () => dispatch({ type: "DEPLOY_DIFF_START" }),
      deployDiffComplete: (diff: DeploymentDiff) =>
        dispatch({ type: "DEPLOY_DIFF_COMPLETE", diff }),
      deployHistoryLoad: (history: DeploymentRecord[]) =>
        dispatch({ type: "DEPLOY_HISTORY_LOAD", history }),
      deployRollback: (deploymentId: string) =>
        dispatch({ type: "DEPLOY_ROLLBACK", deploymentId }),
      deployPromotionRequest: (
        id: string,
        requestedBy: string,
        diff: DeploymentDiff,
      ) =>
        dispatch({ type: "DEPLOY_PROMOTION_REQUEST", id, requestedBy, diff }),
      deployPromotionApprove: (approvedBy: string) =>
        dispatch({ type: "DEPLOY_PROMOTION_APPROVE", approvedBy }),
      deployPromotionReject: () =>
        dispatch({ type: "DEPLOY_PROMOTION_REJECT" }),
      // Phase 9: Viewport overlays
      setOverlay: (overlay: Partial<StudioViewportOverlays>) =>
        dispatch({ type: "SET_OVERLAY", overlay }),
      // Game entity data
      setGameEntities: (data: GameEntityData) =>
        dispatch({ type: "SET_GAME_ENTITIES", data }),
      // Wizard preview
      setWizardPreview: (preview: WizardPreviewData) =>
        dispatch({ type: "SET_WIZARD_PREVIEW", preview }),
      clearWizardPreview: () => dispatch({ type: "CLEAR_WIZARD_PREVIEW" }),
      // Live terrain config for real-time slider updates
      setLiveTerrainConfig: (config: WorldCreationConfig) =>
        dispatch({ type: "SET_LIVE_TERRAIN_CONFIG", config }),
      clearLiveTerrainConfig: () =>
        dispatch({ type: "CLEAR_LIVE_TERRAIN_CONFIG" }),
      // Manifest overrides
      setManifestOverride: (
        overrideType: keyof ManifestOverrides,
        entityId: string,
        data: Record<string, unknown>,
      ) =>
        dispatch({
          type: "SET_MANIFEST_OVERRIDE",
          overrideType,
          entityId,
          data,
        }),
      clearManifestOverride: (
        overrideType: keyof ManifestOverrides,
        entityId: string,
      ) =>
        dispatch({ type: "CLEAR_MANIFEST_OVERRIDE", overrideType, entityId }),
      loadManifestOverrides: (overrides: ManifestOverrides) =>
        dispatch({ type: "LOAD_MANIFEST_OVERRIDES", overrides }),
      clearAllManifestOverrides: () =>
        dispatch({ type: "CLEAR_ALL_MANIFEST_OVERRIDES" }),
      // Phase 4: Play-In-Editor
      pieStart: () => dispatch({ type: "PIE_START" }),
      pieStarted: () => dispatch({ type: "PIE_STARTED" }),
      pieStop: () => dispatch({ type: "PIE_STOP" }),
      pieError: (error: string) => dispatch({ type: "PIE_ERROR", error }),
      pieSetMode: (mode: PIEMode) => dispatch({ type: "PIE_SET_MODE", mode }),
    }),
    [],
  );

  // Build hierarchy tree from world data (same logic as WorldBuilderContext)
  const getHierarchyTree = useCallback((): HierarchyNode | null => {
    const world = state.builder.editing.world;
    if (!world) return null;

    const foundation = world.foundation;
    const layers = world.layers;

    // Build biome children
    const biomeChildren: HierarchyNode[] = foundation.biomes.map((biome) => {
      const override = layers.biomeOverrides.get(biome.id);
      const displayType = override?.typeOverride || biome.type;
      return {
        id: `biome-${biome.id}`,
        label: `${displayType.charAt(0).toUpperCase() + displayType.slice(1)} (${biome.tileKeys.length} tiles)`,
        type: "biome",
        children: [],
        dataId: biome.id,
        expandable: false,
        metadata: { biomeType: displayType, tileCount: biome.tileKeys.length },
      };
    });

    // Build town children
    const townChildren: HierarchyNode[] = foundation.towns.map((town) => {
      const override = layers.townOverrides.get(town.id);
      const displayName = override?.nameOverride || town.name;

      const buildingChildren: HierarchyNode[] = foundation.buildings
        .filter((b) => b.townId === town.id)
        .map((building) => ({
          id: `building-${building.id}`,
          label: building.name,
          type: "building" as const,
          children: [],
          dataId: building.id,
          expandable: false,
          metadata: { buildingType: building.type },
        }));

      const townNpcs = layers.npcs.filter(
        (npc) =>
          npc.parentContext.type === "town" &&
          npc.parentContext.townId === town.id,
      );
      const npcChildren: HierarchyNode[] = townNpcs.map((npc) => ({
        id: `npc-${npc.id}`,
        label: npc.name,
        type: "npc" as const,
        children: [],
        dataId: npc.id,
        expandable: false,
        metadata: { npcType: npc.npcTypeId },
      }));

      return {
        id: `town-${town.id}`,
        label: `${displayName} (${town.size})`,
        type: "town" as const,
        children: [
          ...buildingChildren,
          ...(npcChildren.length > 0
            ? [
                {
                  id: `town-${town.id}-npcs`,
                  label: "NPCs",
                  type: "npcs" as const,
                  children: npcChildren,
                  expandable: true,
                  badge: npcChildren.length,
                },
              ]
            : []),
        ],
        dataId: town.id,
        badge: buildingChildren.length,
        expandable: buildingChildren.length > 0 || npcChildren.length > 0,
        metadata: { townSize: town.size, layoutType: town.layoutType },
      };
    });

    // Extended layer entities — placed manually via the Entity Palette.
    // These are merged into the Game Entities hierarchy below (NPCs → Characters,
    // Stations → Stations, Resources → Resources, Mob Spawns → Creatures).
    // Only types that have NO game entity equivalent remain as top-level folders.
    const ext = state.extendedLayers;

    // Placed mob spawns — built here, may also receive placed mob/boss NPCs during classification
    const extMobSpawnNodes: HierarchyNode[] = ext.mobSpawns.map((ms) => ({
      id: `mobspawn-${ms.id}`,
      label: ms.name,
      type: "mobSpawn" as const,
      children: [],
      dataId: ms.id,
      expandable: false,
      metadata: { mobId: ms.mobId, maxCount: ms.maxCount },
    }));

    // Types without game entity equivalents — remain as top-level folders
    const worldFeaturesDefs: HierarchyNode[] = [
      {
        id: "layer-spawn-points",
        label: "Spawn Points",
        type: "spawnPoints",
        children: ext.spawnPoints.map((sp) => ({
          id: `spawn-${sp.id}`,
          label: sp.name,
          type: "spawnPoint" as const,
          children: [],
          dataId: sp.id,
          expandable: false,
          metadata: { spawnType: sp.spawnType },
        })),
        badge: ext.spawnPoints.length,
        expandable: ext.spawnPoints.length > 0,
      },
      {
        id: "layer-teleports",
        label: "Teleports",
        type: "teleports",
        children: ext.teleports.map((tp) => ({
          id: `teleport-${tp.id}`,
          label: tp.name,
          type: "teleport" as const,
          children: [],
          dataId: tp.id,
          expandable: false,
          metadata: { connections: tp.connections.length },
        })),
        badge: ext.teleports.length,
        expandable: ext.teleports.length > 0,
      },
      {
        id: "layer-pois",
        label: "Points of Interest",
        type: "pois",
        children: ext.pois.map((poi) => ({
          id: `poi-${poi.id}`,
          label: poi.name,
          type: "poi" as const,
          children: [],
          dataId: poi.id,
          expandable: false,
          metadata: { category: poi.category, importance: poi.importance },
        })),
        badge: ext.pois.length,
        expandable: ext.pois.length > 0,
      },
      {
        id: "layer-water-bodies",
        label: "Water Bodies",
        type: "waterBodies",
        children: ext.waterBodies.map((wb) => ({
          id: `water-${wb.id}`,
          label: wb.name,
          type: "waterBody" as const,
          children: [],
          dataId: wb.id,
          expandable: false,
          metadata: { bodyType: wb.bodyType },
        })),
        badge: ext.waterBodies.length,
        expandable: ext.waterBodies.length > 0,
      },
      {
        id: "layer-regions",
        label: "Regions",
        type: "regions",
        children: ext.regions.map((r) => ({
          id: `region-${r.id}`,
          label: r.name,
          type: "region" as const,
          children: [],
          dataId: r.id,
          expandable: false,
          badge: r.tileKeys.length,
          metadata: { tags: r.tags, tileCount: r.tileKeys.length },
        })),
        badge: ext.regions.length,
        expandable: ext.regions.length > 0,
      },
      {
        id: "layer-danger-sources",
        label: "Danger Sources",
        type: "dangerSources",
        children: ext.dangerSources.map((ds) => ({
          id: `danger-${ds.id}`,
          label: ds.name,
          type: "dangerSource" as const,
          children: [],
          dataId: ds.id,
          expandable: false,
          metadata: { intensity: ds.intensity, radius: ds.radius },
        })),
        badge: ext.dangerSources.length,
        expandable: ext.dangerSources.length > 0,
      },
      {
        id: "layer-custom-assets",
        label: "Custom Assets",
        type: "customAssets",
        children: ext.customAssets.map((ca) => ({
          id: `asset-${ca.id}`,
          label: ca.name,
          type: "customAsset" as const,
          children: [],
          dataId: ca.id,
          expandable: false,
          metadata: { assetId: ca.assetId, scale: ca.scale },
        })),
        badge: ext.customAssets.length,
        expandable: ext.customAssets.length > 0,
      },
      ...(ext.wildernessBoundary
        ? [
            {
              id: "layer-wilderness-boundary",
              label: "Wilderness Boundary",
              type: "wildernessBoundary" as const,
              children: [] as HierarchyNode[],
              dataId: "wilderness-boundary",
              expandable: false,
              metadata: {
                points: ext.wildernessBoundary.points.length,
                maxLevel: ext.wildernessBoundary.maxLevel,
              },
            },
          ]
        : []),
    ];
    const worldFeaturesChildren = worldFeaturesDefs.filter(
      (node) => node.children.length > 0,
    );

    // Build audio layer children
    const audio = state.audioLayers;
    const audioChildren: HierarchyNode[] = [
      {
        id: "layer-music-zones",
        label: "Music Zones",
        type: "musicZones",
        children: audio.musicZones.map((mz) => ({
          id: `music-${mz.id}`,
          label: mz.name,
          type: "musicZone" as const,
          children: [],
          dataId: mz.id,
          expandable: false,
          metadata: { trackId: mz.trackId },
        })),
        badge: audio.musicZones.length,
        expandable: audio.musicZones.length > 0,
      },
      {
        id: "layer-ambient-zones",
        label: "Ambient Zones",
        type: "ambientZones",
        children: audio.ambientZones.map((az) => ({
          id: `ambient-${az.id}`,
          label: az.name,
          type: "ambientZone" as const,
          children: [],
          dataId: az.id,
          expandable: false,
          metadata: { ambientType: az.ambientType },
        })),
        badge: audio.ambientZones.length,
        expandable: audio.ambientZones.length > 0,
      },
      {
        id: "layer-sfx-triggers",
        label: "SFX Triggers",
        type: "sfxTriggers",
        children: audio.sfxTriggers.map((sfx) => ({
          id: `sfx-${sfx.id}`,
          label: sfx.name,
          type: "sfxTrigger" as const,
          children: [],
          dataId: sfx.id,
          expandable: false,
          metadata: { soundPath: sfx.soundPath, looping: sfx.looping },
        })),
        badge: audio.sfxTriggers.length,
        expandable: audio.sfxTriggers.length > 0,
      },
    ];

    // Build terrain chunks
    const worldSize = foundation.config.terrain.worldSize;
    const chunksPerSide = Math.ceil(worldSize / 10);
    const chunkChildren: HierarchyNode[] = [];
    for (let cx = 0; cx < chunksPerSide; cx++) {
      for (let cz = 0; cz < chunksPerSide; cz++) {
        const chunkId = `chunk-${cx}-${cz}`;
        const tilesInChunk =
          Math.min(10, worldSize - cx * 10) * Math.min(10, worldSize - cz * 10);
        chunkChildren.push({
          id: chunkId,
          label: `Chunk (${cx}, ${cz})`,
          type: "chunk",
          children: [],
          dataId: chunkId,
          expandable: false,
          badge: tilesInChunk,
          metadata: { chunkX: cx, chunkZ: cz, tileCount: tilesInChunk },
        });
      }
    }

    // Build road children
    const roadChildren: HierarchyNode[] = foundation.roads.map((road, idx) => ({
      id: `road-${road.id || idx}`,
      label: `Road ${road.connectedTowns[0]} → ${road.connectedTowns[1]}`,
      type: "road" as const,
      children: [],
      dataId: road.id || `road-${idx}`,
      expandable: false,
      metadata: {
        fromTown: road.connectedTowns[0],
        toTown: road.connectedTowns[1],
        length: road.path.length,
        isMainRoad: road.isMainRoad,
      },
    }));

    return {
      id: "world",
      label: world.name,
      type: "world",
      children: [
        {
          id: "terrain",
          label: "Terrain",
          type: "terrain",
          children: [
            {
              id: "chunks",
              label: "Chunks",
              type: "chunks",
              children: chunkChildren,
              badge: chunkChildren.length,
              expandable: chunkChildren.length > 0,
            },
          ],
          badge: worldSize * worldSize,
          expandable: true,
          metadata: {
            worldSize,
            tileSize: foundation.config.terrain.tileSize,
            totalTiles: worldSize * worldSize,
          },
        },
        {
          id: "biomes",
          label: "Biomes",
          type: "biomes",
          children: biomeChildren,
          badge: biomeChildren.length,
          expandable: biomeChildren.length > 0,
        },
        {
          id: "towns",
          label: "Towns",
          type: "towns",
          children: townChildren,
          badge: townChildren.length,
          expandable: townChildren.length > 0,
        },
        {
          id: "roads",
          label: "Roads",
          type: "roads",
          children: roadChildren,
          badge: roadChildren.length,
          expandable: roadChildren.length > 0,
        },
        ...worldFeaturesChildren,
        // Game manifest entities + placed entities — unified hierarchy
        ...(state.gameEntities ||
        ext.npcs.length > 0 ||
        ext.stations.length > 0 ||
        ext.resources.length > 0 ||
        ext.mobSpawns.length > 0
          ? (() => {
              const ge = state.gameEntities ?? {
                npcs: [],
                stations: [],
                resources: [],
                mobSpawns: [],
                fishingSpots: 0,
                areas: 0,
              };
              const manifests = state.manifests;
              const totalGame =
                ge.npcs.length +
                ge.stations.length +
                ge.resources.length +
                ge.mobSpawns.length +
                ext.npcs.length +
                ext.stations.length +
                ext.resources.length +
                ext.mobSpawns.length;

              // Helper: build a leaf node for a game entity
              const makeNpcNode = (n: (typeof ge.npcs)[0]): HierarchyNode => ({
                id: `game-npc-${n.selectableId}`,
                label: n.name,
                type: "gameNpc" as const,
                children: [] as HierarchyNode[],
                dataId: n.entityId,
                expandable: false,
                metadata: {
                  selectableId: n.selectableId,
                  position: n.position,
                },
              });
              const makeSpawnNode = (
                m: (typeof ge.mobSpawns)[0],
              ): HierarchyNode => ({
                id: `game-mobspawn-${m.selectableId}`,
                label: `Spawn: ${m.name}`,
                type: "gameMobSpawn" as const,
                children: [] as HierarchyNode[],
                dataId: m.entityId,
                expandable: false,
                metadata: {
                  selectableId: m.selectableId,
                  position: m.position,
                },
              });

              // --- Classify NPCs ---
              // Store NPC types determine shop vs service vs quest:
              const SHOP_NPC_TYPES = new Set([
                "general_store",
                "magic_store",
                "range_store",
                "armor_store",
                "crafting_store",
                "sword_store",
                "food_store",
                "rune_store",
              ]);
              const SERVICE_NPC_TYPES = new Set([
                "bank",
                "tanner",
                "healer",
                "guide",
                "scoreboard",
                "guard",
              ]);

              // Classify NPCs — combines game entities + placed entities
              const questNpcNodes: HierarchyNode[] = [];
              const shopkeeperNodes: HierarchyNode[] = [];
              const serviceNpcNodes: HierarchyNode[] = [];
              const mobNpcs: typeof ge.npcs = [];
              const bossNpcs: typeof ge.npcs = [];

              // Helper to classify a single NPC and push a node into the right bucket
              const classifyNpc = (
                entityId: string,
                npcType: string | undefined,
                storeId: string | undefined,
                node: HierarchyNode,
              ) => {
                const manifestNpc = manifests.npcs.find(
                  (m) => m.id === entityId,
                );
                const category = manifestNpc?.category;
                if (category === "quest" || npcType === "quest_giver") {
                  questNpcNodes.push(node);
                } else if (
                  storeId ||
                  (npcType && SHOP_NPC_TYPES.has(npcType))
                ) {
                  shopkeeperNodes.push(node);
                } else if (npcType && SERVICE_NPC_TYPES.has(npcType)) {
                  serviceNpcNodes.push(node);
                } else if (category === "mob" || category === "boss") {
                  // Handled separately for mob/boss nesting — skip here
                  return false;
                } else {
                  serviceNpcNodes.push(node);
                }
                return true;
              };

              // Classify game-entity NPCs
              for (const npc of ge.npcs) {
                const manifestNpc = manifests.npcs.find(
                  (m) => m.id === npc.entityId,
                );
                const category = manifestNpc?.category;
                if (category === "mob") {
                  mobNpcs.push(npc);
                } else if (category === "boss") {
                  bossNpcs.push(npc);
                } else {
                  classifyNpc(
                    npc.entityId,
                    npc.npcType,
                    npc.storeId,
                    makeNpcNode(npc),
                  );
                }
              }

              // Classify placed NPCs (from Entity Palette) using the same manifest lookup
              for (const npc of ext.npcs) {
                const manifestNpc = manifests.npcs.find(
                  (m) => m.id === npc.npcTypeId,
                );
                const category = manifestNpc?.category;
                const node: HierarchyNode = {
                  id: `npc-${npc.id}`,
                  label: npc.name,
                  type: "npc" as const,
                  children: [],
                  dataId: npc.id,
                  expandable: false,
                  metadata: { npcTypeId: npc.npcTypeId },
                };
                if (category === "mob" || category === "boss") {
                  // Placed mob/boss NPCs go into creatures as mob spawn equivalents
                  extMobSpawnNodes.push(node);
                } else {
                  classifyNpc(npc.npcTypeId, undefined, undefined, node);
                }
              }

              // --- Nest mob spawns under their parent mob ---
              const spawnsByMob = new Map<string, typeof ge.mobSpawns>();
              for (const spawn of ge.mobSpawns) {
                const list = spawnsByMob.get(spawn.entityId);
                if (list) list.push(spawn);
                else spawnsByMob.set(spawn.entityId, [spawn]);
              }

              // Build mob nodes with spawn children
              const buildMobNodes = (npcs: typeof ge.npcs): HierarchyNode[] => {
                const nodes: HierarchyNode[] = [];
                const handledMobs = new Set<string>();
                for (const npc of npcs) {
                  handledMobs.add(npc.entityId);
                  const spawns = spawnsByMob.get(npc.entityId) ?? [];
                  const spawnChildren = spawns.map(makeSpawnNode);
                  nodes.push({
                    id: `game-npc-${npc.selectableId}`,
                    label: npc.name,
                    type: "gameNpc" as const,
                    children: spawnChildren,
                    dataId: npc.entityId,
                    expandable: spawnChildren.length > 0,
                    metadata: {
                      selectableId: npc.selectableId,
                      position: npc.position,
                    },
                  });
                }
                // Orphan spawns: mob exists in manifest but not placed as NPC
                for (const [mobId, spawns] of spawnsByMob) {
                  if (handledMobs.has(mobId)) continue;
                  const manifestNpc = manifests.npcs.find(
                    (m) => m.id === mobId,
                  );
                  const mobName = manifestNpc?.name ?? mobId.replace(/_/g, " ");
                  const spawnChildren = spawns.map(makeSpawnNode);
                  nodes.push({
                    id: `game-mob-virtual-${mobId}`,
                    label: mobName,
                    type: "gameNpc" as const,
                    children: spawnChildren,
                    dataId: mobId,
                    expandable: spawnChildren.length > 0,
                    metadata: { virtual: true },
                  });
                }
                return nodes;
              };

              // Build Characters section (game entities + placed NPCs, unified)
              const charactersChildren: HierarchyNode[] = [];
              if (questNpcNodes.length > 0) {
                charactersChildren.push({
                  id: "game-quest-npcs",
                  label: "Quest Givers",
                  type: "gameQuestNpcs" as const,
                  children: questNpcNodes,
                  badge: questNpcNodes.length,
                  expandable: true,
                });
              }
              if (shopkeeperNodes.length > 0) {
                charactersChildren.push({
                  id: "game-shopkeepers",
                  label: "Shopkeepers",
                  type: "gameShopkeepers" as const,
                  children: shopkeeperNodes,
                  badge: shopkeeperNodes.length,
                  expandable: true,
                });
              }
              if (serviceNpcNodes.length > 0) {
                charactersChildren.push({
                  id: "game-service-npcs",
                  label: "Service NPCs",
                  type: "gameServiceNpcs" as const,
                  children: serviceNpcNodes,
                  badge: serviceNpcNodes.length,
                  expandable: true,
                });
              }
              const totalCharacters =
                questNpcNodes.length +
                shopkeeperNodes.length +
                serviceNpcNodes.length;

              // Build Creatures section (mobs + bosses with nested spawns)
              const mobNodes = buildMobNodes(mobNpcs);
              const bossNodes = buildMobNodes(bossNpcs);
              const creaturesChildren: HierarchyNode[] = [];
              if (mobNodes.length > 0) {
                creaturesChildren.push({
                  id: "game-mobs",
                  label: "Mobs",
                  type: "gameMobs" as const,
                  children: mobNodes,
                  badge: mobNodes.length,
                  expandable: true,
                });
              }
              if (bossNodes.length > 0) {
                creaturesChildren.push({
                  id: "game-bosses",
                  label: "Bosses",
                  type: "gameBosses" as const,
                  children: bossNodes,
                  badge: bossNodes.length,
                  expandable: true,
                });
              }
              // Add placed mob spawns directly into Mobs section
              if (extMobSpawnNodes.length > 0) {
                // Find or create the Mobs sub-folder to add placed spawns into
                const mobsFolder = creaturesChildren.find(
                  (c) => c.id === "game-mobs",
                );
                if (mobsFolder) {
                  mobsFolder.children.push(...extMobSpawnNodes);
                  mobsFolder.badge =
                    (mobsFolder.badge ?? 0) + extMobSpawnNodes.length;
                } else {
                  creaturesChildren.push({
                    id: "game-mobs",
                    label: "Mobs",
                    type: "gameMobs" as const,
                    children: extMobSpawnNodes,
                    badge: extMobSpawnNodes.length,
                    expandable: true,
                  });
                }
              }
              const totalCreatures =
                mobNpcs.length +
                bossNpcs.length +
                ge.mobSpawns.length +
                extMobSpawnNodes.length;

              // --- Classify Stations ---
              const CRAFTING_STATION_TYPES = new Set([
                "anvil",
                "furnace",
                "range",
              ]);
              const SERVICE_STATION_TYPES = new Set([
                "bank",
                "altar",
                "runecrafting_altar",
              ]);
              const craftingStations = ge.stations.filter(
                (s) =>
                  s.stationType && CRAFTING_STATION_TYPES.has(s.stationType),
              );
              const serviceStations = ge.stations.filter(
                (s) =>
                  s.stationType && SERVICE_STATION_TYPES.has(s.stationType),
              );
              const otherStations = ge.stations.filter(
                (s) =>
                  !s.stationType ||
                  (!CRAFTING_STATION_TYPES.has(s.stationType) &&
                    !SERVICE_STATION_TYPES.has(s.stationType)),
              );
              const makeStationNode = (
                s: (typeof ge.stations)[0],
              ): HierarchyNode => ({
                id: `game-station-${s.selectableId}`,
                label: s.name,
                type: "gameStation" as const,
                children: [] as HierarchyNode[],
                dataId: s.entityId,
                expandable: false,
                metadata: {
                  selectableId: s.selectableId,
                  position: s.position,
                },
              });
              const stationsChildren: HierarchyNode[] = [];
              if (craftingStations.length > 0) {
                stationsChildren.push({
                  id: "game-crafting-stations",
                  label: "Crafting",
                  type: "gameCraftingStations" as const,
                  children: craftingStations.map(makeStationNode),
                  badge: craftingStations.length,
                  expandable: true,
                });
              }
              if (serviceStations.length > 0) {
                stationsChildren.push({
                  id: "game-service-stations",
                  label: "Services",
                  type: "gameServiceStations" as const,
                  children: serviceStations.map(makeStationNode),
                  badge: serviceStations.length,
                  expandable: true,
                });
              }
              if (otherStations.length > 0) {
                stationsChildren.push({
                  id: "game-other-stations",
                  label: "Other",
                  type: "gameOtherStations" as const,
                  children: otherStations.map(makeStationNode),
                  badge: otherStations.length,
                  expandable: true,
                });
              }
              // Classify placed stations into the same Crafting/Services/Other buckets
              for (const s of ext.stations) {
                const node: HierarchyNode = {
                  id: `station-${s.id}`,
                  label: s.name,
                  type: "station" as const,
                  children: [],
                  dataId: s.id,
                  expandable: false,
                  metadata: { stationType: s.stationType },
                };
                if (
                  s.stationType &&
                  CRAFTING_STATION_TYPES.has(s.stationType)
                ) {
                  const folder = stationsChildren.find(
                    (c) => c.id === "game-crafting-stations",
                  );
                  if (folder) {
                    folder.children.push(node);
                    folder.badge = (folder.badge ?? 0) + 1;
                  } else
                    stationsChildren.push({
                      id: "game-crafting-stations",
                      label: "Crafting",
                      type: "gameCraftingStations" as const,
                      children: [node],
                      badge: 1,
                      expandable: true,
                    });
                } else if (
                  s.stationType &&
                  SERVICE_STATION_TYPES.has(s.stationType)
                ) {
                  const folder = stationsChildren.find(
                    (c) => c.id === "game-service-stations",
                  );
                  if (folder) {
                    folder.children.push(node);
                    folder.badge = (folder.badge ?? 0) + 1;
                  } else
                    stationsChildren.push({
                      id: "game-service-stations",
                      label: "Services",
                      type: "gameServiceStations" as const,
                      children: [node],
                      badge: 1,
                      expandable: true,
                    });
                } else {
                  const folder = stationsChildren.find(
                    (c) => c.id === "game-other-stations",
                  );
                  if (folder) {
                    folder.children.push(node);
                    folder.badge = (folder.badge ?? 0) + 1;
                  } else
                    stationsChildren.push({
                      id: "game-other-stations",
                      label: "Other",
                      type: "gameOtherStations" as const,
                      children: [node],
                      badge: 1,
                      expandable: true,
                    });
                }
              }

              // --- Classify Resources ---
              const miningResources = ge.resources.filter(
                (r) => r.resourceType === "ore",
              );
              const woodcuttingResources = ge.resources.filter(
                (r) => r.resourceType === "tree",
              );
              const otherResources = ge.resources.filter(
                (r) => r.resourceType !== "ore" && r.resourceType !== "tree",
              );
              const makeResourceNode = (
                r: (typeof ge.resources)[0],
              ): HierarchyNode => ({
                id: `game-resource-${r.selectableId}`,
                label: r.name,
                type: "gameResource" as const,
                children: [] as HierarchyNode[],
                dataId: r.entityId,
                expandable: false,
                metadata: {
                  selectableId: r.selectableId,
                  position: r.position,
                },
              });
              const resourcesChildren: HierarchyNode[] = [];
              if (miningResources.length > 0) {
                resourcesChildren.push({
                  id: "game-mining-resources",
                  label: "Mining",
                  type: "gameMining" as const,
                  children: miningResources.map(makeResourceNode),
                  badge: miningResources.length,
                  expandable: true,
                });
              }
              if (woodcuttingResources.length > 0) {
                resourcesChildren.push({
                  id: "game-woodcutting-resources",
                  label: "Woodcutting",
                  type: "gameWoodcutting" as const,
                  children: woodcuttingResources.map(makeResourceNode),
                  badge: woodcuttingResources.length,
                  expandable: true,
                });
              }
              if (ge.fishingSpots > 0) {
                resourcesChildren.push({
                  id: "game-fishing",
                  label: "Fishing",
                  type: "gameFishing" as const,
                  children: [],
                  badge: ge.fishingSpots,
                  expandable: false,
                });
              }
              if (otherResources.length > 0) {
                resourcesChildren.push({
                  id: "game-other-resources",
                  label: "Other",
                  type: "gameOtherResources" as const,
                  children: otherResources.map(makeResourceNode),
                  badge: otherResources.length,
                  expandable: true,
                });
              }
              // Classify placed resources into Mining/Woodcutting/Fishing/Other
              for (const r of ext.resources) {
                const node: HierarchyNode = {
                  id: `resource-${r.id}`,
                  label: r.name,
                  type: "resource" as const,
                  children: [],
                  dataId: r.id,
                  expandable: false,
                  metadata: { resourceType: r.resourceType },
                };
                const addToFolder = (
                  folderId: string,
                  label: string,
                  type: string,
                ) => {
                  const folder = resourcesChildren.find(
                    (c) => c.id === folderId,
                  );
                  if (folder) {
                    folder.children.push(node);
                    folder.badge = (folder.badge ?? 0) + 1;
                  } else
                    resourcesChildren.push({
                      id: folderId,
                      label,
                      type: type as never,
                      children: [node],
                      badge: 1,
                      expandable: true,
                    });
                };
                if (r.resourceType === "mining") {
                  addToFolder("game-mining-resources", "Mining", "gameMining");
                } else if (r.resourceType === "woodcutting") {
                  addToFolder(
                    "game-woodcutting-resources",
                    "Woodcutting",
                    "gameWoodcutting",
                  );
                } else if (r.resourceType === "fishing") {
                  addToFolder("game-fishing", "Fishing", "gameFishing");
                } else {
                  addToFolder(
                    "game-other-resources",
                    "Other",
                    "gameOtherResources",
                  );
                }
              }

              // Build top-level Game Entities node
              const gameChildren: HierarchyNode[] = [];
              if (totalCharacters > 0) {
                gameChildren.push({
                  id: "game-characters",
                  label: "Characters",
                  type: "gameCharacters" as const,
                  children: charactersChildren,
                  badge: totalCharacters,
                  expandable: true,
                });
              }
              if (totalCreatures > 0) {
                gameChildren.push({
                  id: "game-creatures",
                  label: "Creatures",
                  type: "gameCreatures" as const,
                  children: creaturesChildren,
                  badge: totalCreatures,
                  expandable: true,
                });
              }
              if (ge.stations.length > 0 || ext.stations.length > 0) {
                gameChildren.push({
                  id: "game-stations",
                  label: "Stations",
                  type: "gameStations" as const,
                  children: stationsChildren,
                  badge: ge.stations.length + ext.stations.length,
                  expandable: true,
                });
              }
              if (
                ge.resources.length > 0 ||
                ge.fishingSpots > 0 ||
                ext.resources.length > 0
              ) {
                gameChildren.push({
                  id: "game-resources",
                  label: "Resources",
                  type: "gameResources" as const,
                  children: resourcesChildren,
                  badge:
                    ge.resources.length +
                    ge.fishingSpots +
                    ext.resources.length,
                  expandable: true,
                });
              }
              if (ge.areas > 0) {
                gameChildren.push({
                  id: "game-areas",
                  label: "World Areas",
                  type: "gameAreas" as const,
                  children: [],
                  badge: ge.areas,
                  expandable: false,
                });
              }

              return [
                {
                  id: "game-entities",
                  label: "Game Entities",
                  type: "gameEntities" as const,
                  children: gameChildren,
                  badge: totalGame,
                  expandable: true,
                },
              ];
            })()
          : []),
        {
          id: "audio",
          label: "Audio",
          type: "audio",
          children: audioChildren,
          badge:
            audio.musicZones.length +
            audio.ambientZones.length +
            audio.sfxTriggers.length,
          expandable: audioChildren.some((c) => c.children.length > 0),
        },
      ],
      expandable: true,
    };
  }, [
    state.builder.editing.world,
    state.extendedLayers,
    state.audioLayers,
    state.gameEntities,
    state.manifests,
  ]);

  // Computed values
  const computed = useMemo(
    () => ({
      isCreationMode: state.builder.mode === "creation",
      isEditingMode: state.builder.mode === "editing",
      hasLoadedWorld: state.builder.editing.world !== null,
      isConfigModified: state.builder.creation.selectedPreset === null,
      getHierarchyTree,
      canUndo: state.builder.history.past.length > 0,
      canRedo: state.builder.history.future.length > 0,
      undoCount: state.builder.history.past.length,
      redoCount: state.builder.history.future.length,
      hasProject: state.project.currentProjectId !== null,
      isProjectLocked: state.project.lockedBy !== null,
      hasUnsavedChanges: state.builder.editing.hasUnsavedChanges,
      isPersisting: state.persistence.isSaving || state.persistence.isLoading,
    }),
    [
      state.builder.mode,
      state.builder.editing.world,
      state.builder.editing.hasUnsavedChanges,
      state.builder.creation.selectedPreset,
      getHierarchyTree,
      state.builder.history.past.length,
      state.builder.history.future.length,
      state.project.currentProjectId,
      state.project.lockedBy,
      state.persistence.isSaving,
      state.persistence.isLoading,
    ],
  );

  const contextValue = useMemo(
    () => ({
      state,
      dispatch,
      actions,
      computed,
      viewportRef,
      activeModule,
      registry,
    }),
    [state, actions, computed, activeModule, registry],
  );

  return (
    <WorldStudioDispatchContext.Provider value={dispatch}>
      <WorldStudioContext.Provider value={contextValue}>
        {children}
      </WorldStudioContext.Provider>
    </WorldStudioDispatchContext.Provider>
  );
}

// ============== HOOKS ==============

export function useWorldStudio(): WorldStudioContextValue {
  const context = useContext(WorldStudioContext);
  if (!context) {
    throw new Error("useWorldStudio must be used within a WorldStudioProvider");
  }
  return context;
}

/**
 * Convenience hook to get the active game module from context.
 * Returns the GameModule definition for the currently loaded module.
 */
export function useActiveModule(): GameModule {
  const { activeModule } = useWorldStudio();
  return activeModule;
}

/**
 * Convenience hook to get the entity type registry from context.
 * Returns the EntityTypeRegistry for the active game module.
 */
export function useEntityTypeRegistry(): EntityTypeRegistry {
  const { registry } = useWorldStudio();
  return registry;
}

/**
 * Dispatch-only hook — use this in components that fire actions but don't read state.
 * Avoids re-rendering when state changes (toolbar buttons, action dispatchers).
 */
export function useWorldStudioDispatch(): React.Dispatch<WorldStudioAction> {
  const dispatch = useContext(WorldStudioDispatchContext);
  if (!dispatch) {
    throw new Error(
      "useWorldStudioDispatch must be used within a WorldStudioProvider",
    );
  }
  return dispatch;
}

/** Select from the combined studio state */
export function useWorldStudioSelector<T>(
  selector: (state: WorldStudioState) => T,
): T {
  const { state } = useWorldStudio();
  return selector(state);
}

/** Get the builder sub-state (same shape as WorldBuilderState) */
export function useBuilderState(): WorldBuilderState {
  return useWorldStudioSelector((s) => s.builder);
}

/** Get the current mode */
export function useStudioMode(): WorldBuilderMode {
  return useWorldStudioSelector((s) => s.builder.mode);
}

/** Get the creation state */
export function useStudioCreationState(): CreationModeState {
  return useWorldStudioSelector((s) => s.builder.creation);
}

/** Get the editing state */
export function useStudioEditingState() {
  return useWorldStudioSelector((s) => s.builder.editing);
}

/** Get the viewport state */
export function useStudioViewportState() {
  return useWorldStudioSelector((s) => s.builder.viewport);
}

/** Get the current world data (or null) */
export function useStudioWorld(): WorldData | null {
  return useWorldStudioSelector((s) => s.builder.editing.world);
}

/** Get the current selection (or null) */
export function useStudioSelection(): Selection | null {
  return useWorldStudioSelector((s) => s.builder.editing.selection);
}

/**
 * Get the project state.
 *
 * Unlike most selectors, this is designed to be callable *outside* a
 * `WorldStudioProvider` — `UILayoutEditorPage` (and future standalone
 * asset editors) can be routed to directly without the studio shell,
 * in which case every `currentXxxId` field is simply `null` and
 * studio-dependent UI (e.g. the "Set as Active" button) hides itself.
 * Throwing here instead would crash the whole route.
 */
export function useStudioProject(): StudioProjectState {
  const context = useContext(WorldStudioContext);
  return context ? context.state.project : worldStudioInitialState.project;
}

/** Get the persistence state */
export function useStudioPersistence(): StudioPersistenceState {
  return useWorldStudioSelector((s) => s.persistence);
}

/** Get the active tool */
export function useStudioTool(): StudioToolMode {
  return useWorldStudioSelector((s) => s.tools.activeTool);
}

/** Get the active placement (or null) */
export function useActivePlacement(): ActivePlacement | null {
  return useWorldStudioSelector((s) => s.tools.activePlacement);
}

/** Get extended layers (Phase 3+ entities) */
export function useExtendedLayers(): ExtendedWorldLayers {
  return useWorldStudioSelector((s) => s.extendedLayers);
}

/** Get manifest data */
export function useManifests(): ManifestData {
  return useWorldStudioSelector((s) => s.manifests);
}

export default WorldStudioContext;
