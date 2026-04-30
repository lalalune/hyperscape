/**
 * World Studio type definitions, action types, and initial state constants.
 *
 * Extracted from WorldStudioContext.tsx to reduce file size and improve
 * module boundaries. Types are re-exported from WorldStudioContext for
 * backwards compatibility.
 */

import type { VegetationConfig } from "../WorldBuilder/types";
import type { GameEntityData } from "../WorldBuilder/TileBasedTerrain";
import type { GameModeManifest } from "@hyperforge/shared/runtime";

import type {
  WorldBuilderState,
  WorldBuilderAction,
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
  GeneratedTown,
  GeneratedBuilding,
  GeneratedRoad,
} from "../WorldBuilder/types";

import type {
  ActivePlacement,
  ExtendedWorldLayers,
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
  ManifestElementalStaff,
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
  PrefabEntry,
  PaletteCategory,
  BrushSettings,
  BrushOverlays,
  BrushType,
  TerrainSculptStroke,
  BiomePaintStroke,
  VegetationPaintStroke,
  MaterialPaintStroke,
  FoliagePaintStroke,
  AudioLayers,
  MusicZone,
  AmbientZone,
  SFXTrigger,
  AIGenerationState,
  DeploymentState,
  DeploymentDiff,
  DeploymentRecord,
} from "./types";

import type { ManifestOverrides } from "./types";

import {
  EMPTY_EXTENDED_LAYERS,
  EMPTY_MANIFEST_DATA,
  DEFAULT_BRUSH_SETTINGS,
  EMPTY_BRUSH_OVERLAYS,
  EMPTY_AUDIO_LAYERS,
  EMPTY_AI_GENERATION_STATE,
  EMPTY_DEPLOYMENT_STATE,
  EMPTY_MANIFEST_OVERRIDES,
} from "./types";

import { worldBuilderInitialState } from "../WorldBuilder/WorldBuilderContext";

import type {
  TownStageResult,
  RoadZoneStageResult,
  PopulationStageResult,
} from "./hooks/useZoneAutoGen";

// ============== WIZARD PREVIEW ==============

/** Data passed to the 3D viewport overlay during wizard generation */
export interface WizardPreviewData {
  towns?: TownStageResult;
  roadsZones?: RoadZoneStageResult;
  population?: PopulationStageResult;
  worldCenterOffset: number;
}

// ============== STUDIO-SPECIFIC TYPES ==============

/** Team/project context from the Phase 1 API */
export interface StudioProjectState {
  currentTeamId: string | null;
  currentGameId: string | null;
  currentProjectId: string | null;
  projectName: string | null;
  projectVersion: number;
  lockedBy: string | null;
  /**
   * GameMode manifest fetched from the game record (Phase 4). Null until a
   * project is loaded, or if the API response did not include one (legacy
   * games). Callers should fall back to `HYPERIA_DEFAULT_MANIFEST`.
   */
  gameMode: GameModeManifest | null;
  /**
   * Template id the project was cloned from (B0'.B). Used by PIE to
   * resolve which plugin set to install on Play. `null` means the
   * project predates the typed-layer migration.
   */
  templateId: string | null;
  /**
   * Plugin ids the project declares (B0'.A). Empty = blank canvas;
   * PIE Play boots no game plugins, viewport renders terrain only.
   */
  plugins: ReadonlyArray<string>;
  /**
   * Asset pack manifest ids installed on this project (Phase AP1
   * of `PLAN_ASSET_PACKS.md`). The studio's Asset Library reads
   * from the union of these packs; the agent's `GET_PROJECT_STATE`
   * (select=availableAssets) flattens them into a catalog.
   */
  assetPacks: ReadonlyArray<string>;
}

/** Server persistence state */
export interface StudioPersistenceState {
  isSaving: boolean;
  isLoading: boolean;
  saveError: string | null;
  loadError: string | null;
  lastSavedAt: number | null;
  autoSaveEnabled: boolean;
}

/** Tool modes — select is default, others unlock in Phase 3+ */
export type StudioToolMode =
  | "select"
  | "place"
  | "brush"
  | "path"
  | "procgen"
  | "zonePaint";

/** Transform gizmo mode */
export type GizmoTransformMode = "translate" | "rotate" | "scale";
/** Transform coordinate space */
export type GizmoTransformSpace = "world" | "local";

export interface StudioToolState {
  activeTool: StudioToolMode;
  /** Active placement ghost (when place tool is active) */
  activePlacement: ActivePlacement | null;
  /** Brush settings (when brush tool is active) */
  brushSettings: BrushSettings;
  /** Camera teleport request from minimap (consumed by viewport) */
  cameraTeleportTarget: {
    x: number;
    y: number;
    z: number;
    close?: boolean;
  } | null;
  /** Transform gizmo mode (translate/rotate/scale) */
  transformMode: GizmoTransformMode;
  /** Transform coordinate space (world/local) */
  transformSpace: GizmoTransformSpace;
  /** Zone tile painting state (when zonePaint tool is active) */
  zonePaint: ZonePaintState | null;
  /** Water body editor: vertex/waypoint adding mode (Phase 8.1) */
  isAddingWaterVertices: boolean;
  /** Grid snap size in meters (0.25, 0.5, 1.0, 2.0, 4.0) */
  gridSize: number;
}

/** State for painting zone tiles */
export interface ZonePaintState {
  /** Region being painted */
  regionId: string;
  /** Brush size in tiles (1, 3, 5) */
  brushSize: number;
  /** Current cursor tile position */
  cursorTile: { x: number; z: number } | null;
  /** Paint or erase mode */
  mode: "paint" | "erase";
}

/** Studio-specific viewport overlay toggles and preview settings */
export interface StudioViewportOverlays {
  /** Show biome color overlay on terrain */
  biomeOverlay: boolean;
  /** Show difficulty zone boundaries */
  difficultyOverlay: boolean;
  /** Show zone tile color overlay (auto-gen + hand-painted regions) */
  zoneOverlay: boolean;
  /** Day/night time-of-day (0-24 hours, null = default lighting) */
  timeOfDay: number | null;
  /** Enable shadow rendering (CSM cascaded shadows) */
  shadows: boolean;
  /** Enable bloom + tone mapping post-processing */
  bloom: boolean;
  /** Use game-matching exponential fog instead of simple linear fog */
  gameFog: boolean;
  /** Enable procedural sky dome with sun, moon, and clouds */
  sky: boolean;
  /** Enable procedural wind-animated grass */
  grass: boolean;
}

export const DEFAULT_VIEWPORT_OVERLAYS: StudioViewportOverlays = {
  biomeOverlay: false,
  difficultyOverlay: false,
  zoneOverlay: true,
  timeOfDay: null,
  shadows: false,
  bloom: false,
  gameFog: true,
  sky: true,
  grass: true,
};

// ============== COMBINED STATE ==============

/**
 * PIE execution mode, mirroring UE5's Simulate / Play distinction.
 * - `simulate`: editor fly-cam, no pawn possession. Level designers move
 *   freely; game input (WASD + mouse look) drives the editor camera.
 * - `play`: the resolved GameMode's controller stack possesses the pawn.
 *   For Hyperia this is click-to-walk + orbit camera.
 */
export type PIEMode = "simulate" | "play";

/** Play-In-Editor state */
export interface PIEState {
  /** Whether PIE mode is active */
  active: boolean;
  /** Loading state during PIE initialization */
  loading: boolean;
  /** Error message if PIE failed to start */
  error: string | null;
  /** Which PIE flavour the next pieStart() will launch. */
  mode: PIEMode;
}

export const EMPTY_PIE_STATE: PIEState = {
  active: false,
  loading: false,
  error: null,
  mode: "simulate",
};

export interface WorldStudioState {
  /** All world builder state (creation, editing, viewport, history) */
  builder: WorldBuilderState;
  /** Current team/game/project context */
  project: StudioProjectState;
  /** Server persistence tracking */
  persistence: StudioPersistenceState;
  /** Active tool and tool options */
  tools: StudioToolState;
  /** Phase 3+ extended placement layers */
  extendedLayers: ExtendedWorldLayers;
  /** Loaded manifest data for entity palette */
  manifests: ManifestData;
  /** Non-destructive brush stroke overlays */
  brushOverlays: BrushOverlays;
  /** Phase 7: Audio zone layers */
  audioLayers: AudioLayers;
  /** Phase 7: AI content generation state */
  aiGeneration: AIGenerationState;
  /** Phase 8: Deployment pipeline state */
  deployment: DeploymentState;
  /** Phase 9: Viewport overlay settings */
  overlays: StudioViewportOverlays;
  /** Manifest override deltas (staging layer over base manifests) */
  manifestOverrides: ManifestOverrides;
  /** Entity data from game manifest (world-areas.json), populated by GameWorldEntitySync */
  gameEntities: GameEntityData | null;
  /** Wizard preview data for 3D viewport ghost overlay */
  wizardPreview: WizardPreviewData | null;
  /** Live terrain config for real-time slider updates (Phase 1) */
  liveTerrainConfig: WorldCreationConfig | null;
  /** Phase 4: Play-In-Editor state */
  pie: PIEState;
  /** Phase 9.2: Saved prefab templates */
  prefabs: Prefab[];
}

// ============== ACTION TYPES ==============

/** Studio-specific actions (project, persistence, tools, placement) */
export type StudioSpecificAction =
  // Project actions
  | {
      type: "SET_PROJECT";
      teamId: string;
      gameId: string;
      projectId: string;
      name: string;
      version: number;
      gameMode: GameModeManifest | null;
      templateId: string | null;
      plugins: ReadonlyArray<string>;
      assetPacks: ReadonlyArray<string>;
    }
  | { type: "CLEAR_PROJECT" }
  | { type: "SET_PROJECT_LOCK"; lockedBy: string | null }
  | { type: "UPDATE_PROJECT_VERSION"; version: number }
  | { type: "SET_GAME_MODE"; gameMode: GameModeManifest | null }

  // Persistence actions
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; savedAt: number; version: number }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS" }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "SET_AUTO_SAVE"; enabled: boolean }

  // Tool actions
  | { type: "SET_TOOL"; tool: StudioToolMode }
  | { type: "SET_TRANSFORM_MODE"; mode: GizmoTransformMode }
  | { type: "SET_TRANSFORM_SPACE"; space: GizmoTransformSpace }
  | { type: "SET_GRID_SIZE"; size: number }
  | { type: "CAMERA_TELEPORT"; target: { x: number; y: number; z: number } }
  | { type: "CAMERA_TELEPORT_CONSUMED" }

  // Placement actions
  | {
      type: "START_PLACEMENT";
      category: PaletteCategory;
      templateId: string;
      templateName: string;
      /** Entity type schema ID for generic module placement */
      entityTypeId?: string;
    }
  | {
      type: "UPDATE_PLACEMENT_POSITION";
      position: WorldPosition;
      rotation?: number;
    }
  | { type: "CONFIRM_PLACEMENT" }
  | { type: "CANCEL_PLACEMENT" }

  // Zone tile painting actions
  | { type: "START_ZONE_PAINT"; regionId: string }
  | { type: "UPDATE_ZONE_CURSOR"; tile: { x: number; z: number } | null }
  | {
      type: "PAINT_ZONE_TILES";
      regionId: string;
      tileKeys: string[];
      erase: boolean;
    }
  | { type: "SET_ZONE_BRUSH_SIZE"; size: number }
  | { type: "SET_ZONE_PAINT_MODE"; mode: "paint" | "erase" }
  | { type: "STOP_ZONE_PAINT" }
  | { type: "SWITCH_ZONE_PAINT_REGION"; regionId: string }
  | { type: "SET_ADDING_WATER_VERTICES"; enabled: boolean }

  // Extended layer entity actions — Spawn Points
  | { type: "ADD_SPAWN_POINT"; spawnPoint: PlacedSpawnPoint }
  | {
      type: "UPDATE_SPAWN_POINT";
      id: string;
      updates: Partial<PlacedSpawnPoint>;
    }
  | { type: "REMOVE_SPAWN_POINT"; id: string }

  // Extended layer entity actions — Teleports
  | { type: "ADD_TELEPORT"; teleport: PlacedTeleport }
  | { type: "UPDATE_TELEPORT"; id: string; updates: Partial<PlacedTeleport> }
  | { type: "REMOVE_TELEPORT"; id: string }

  // Extended layer entity actions — Mob Spawns
  | { type: "ADD_MOB_SPAWN"; mobSpawn: PlacedMobSpawn }
  | { type: "UPDATE_MOB_SPAWN"; id: string; updates: Partial<PlacedMobSpawn> }
  | { type: "REMOVE_MOB_SPAWN"; id: string }

  // Extended layer entity actions — Resources
  | { type: "ADD_RESOURCE"; resource: PlacedResource }
  | { type: "UPDATE_RESOURCE"; id: string; updates: Partial<PlacedResource> }
  | { type: "REMOVE_RESOURCE"; id: string }

  // Extended layer entity actions — Stations
  | { type: "ADD_STATION"; station: PlacedStation }
  | { type: "UPDATE_STATION"; id: string; updates: Partial<PlacedStation> }
  | { type: "REMOVE_STATION"; id: string }

  // Brush tool actions
  | { type: "SET_BRUSH_SETTINGS"; settings: Partial<BrushSettings> }
  | { type: "ADD_TERRAIN_SCULPT"; stroke: TerrainSculptStroke }
  | { type: "ADD_BIOME_PAINT"; stroke: BiomePaintStroke }
  | { type: "ADD_VEGETATION_PAINT"; stroke: VegetationPaintStroke }
  | { type: "ADD_MATERIAL_PAINT"; stroke: MaterialPaintStroke }
  | { type: "ADD_FOLIAGE_PAINT"; stroke: FoliagePaintStroke }
  | {
      type: "SET_TILE_COLLISION";
      tiles: Array<{ tileX: number; tileZ: number; blocked: boolean }>;
    }
  | { type: "UNDO_LAST_BRUSH_STROKE"; brushType: BrushType }
  | { type: "CLEAR_BRUSH_OVERLAYS"; brushType?: BrushType }
  | { type: "RESTORE_BRUSH_OVERLAYS"; overlays: BrushOverlays }

  // Extended layer entity actions — POIs
  | { type: "ADD_POI"; poi: PlacedPOI }
  | { type: "UPDATE_POI"; id: string; updates: Partial<PlacedPOI> }
  | { type: "REMOVE_POI"; id: string }

  // Extended layer entity actions — Water Bodies
  | { type: "ADD_WATER_BODY"; waterBody: PlacedWaterBody }
  | { type: "UPDATE_WATER_BODY"; id: string; updates: Partial<PlacedWaterBody> }
  | { type: "REMOVE_WATER_BODY"; id: string }

  // Extended layer entity actions — Regions
  | { type: "ADD_REGION"; region: PlacedRegion }
  | { type: "UPDATE_REGION"; id: string; updates: Partial<PlacedRegion> }
  | { type: "REMOVE_REGION"; id: string }

  // Extended layer entity actions — Danger Sources
  | { type: "ADD_DANGER_SOURCE"; dangerSource: PlacedDangerSource }
  | {
      type: "UPDATE_DANGER_SOURCE";
      id: string;
      updates: Partial<PlacedDangerSource>;
    }
  | { type: "REMOVE_DANGER_SOURCE"; id: string }

  // Extended layer entity actions — Wilderness Boundary
  | { type: "SET_WILDERNESS_BOUNDARY"; boundary: WildernessBoundary | null }

  // Manifest loading
  | { type: "MANIFESTS_LOAD_START" }
  | {
      type: "MANIFESTS_LOAD_SUCCESS";
      data: Omit<ManifestData, "loaded" | "loading" | "error">;
    }
  | { type: "MANIFESTS_LOAD_ERROR"; error: string }

  // Manifest editing — update individual manifest data in local state
  | { type: "MANIFEST_UPDATE_RAW"; name: string; content: unknown }
  | { type: "MANIFEST_UPDATE_ITEMS"; items: ManifestItem[] }
  | { type: "MANIFEST_UPDATE_QUESTS"; quests: ManifestQuest[] }
  | { type: "MANIFEST_UPDATE_STORES"; stores: ManifestStore[] }
  | { type: "MANIFEST_UPDATE_NPCS"; npcs: ManifestNPC[] }
  | {
      type: "MANIFEST_UPDATE_COMBAT_SPELLS";
      combatSpells: ManifestCombatSpell[];
    }
  | { type: "MANIFEST_UPDATE_PRAYERS"; prayers: ManifestPrayer[] }
  | { type: "MANIFEST_UPDATE_RECIPES"; recipes: ManifestRecipe[] }
  | { type: "MANIFEST_UPDATE_AMMUNITION"; ammunition: ManifestAmmunition[] }
  | { type: "MANIFEST_UPDATE_RUNES"; runes: ManifestRune[] }
  | {
      type: "MANIFEST_UPDATE_SKILL_UNLOCKS";
      skillUnlocks: ManifestSkillUnlock[];
    }
  | {
      type: "MANIFEST_UPDATE_TIER_REQUIREMENTS";
      tierRequirements: ManifestTierRequirement[];
    }
  | { type: "MANIFEST_UPDATE_DUEL_ARENAS"; duelArenas: ManifestDuelArena[] }
  | { type: "MANIFEST_UPDATE_STATIONS"; stations: ManifestStation[] }
  | { type: "MANIFEST_UPDATE_TREES"; trees: ManifestTree[] }
  | {
      type: "MANIFEST_UPDATE_FISHING_SPOTS";
      fishingSpots: ManifestFishingSpot[];
    }
  | {
      type: "MANIFEST_UPDATE_MINING_ROCKS";
      miningRocks: ManifestMiningRock[];
    }

  // Phase 7: Audio zone actions
  | { type: "ADD_MUSIC_ZONE"; zone: MusicZone }
  | { type: "UPDATE_MUSIC_ZONE"; id: string; updates: Partial<MusicZone> }
  | { type: "REMOVE_MUSIC_ZONE"; id: string }
  | { type: "ADD_AMBIENT_ZONE"; zone: AmbientZone }
  | { type: "UPDATE_AMBIENT_ZONE"; id: string; updates: Partial<AmbientZone> }
  | { type: "REMOVE_AMBIENT_ZONE"; id: string }
  | { type: "ADD_SFX_TRIGGER"; trigger: SFXTrigger }
  | { type: "UPDATE_SFX_TRIGGER"; id: string; updates: Partial<SFXTrigger> }
  | { type: "REMOVE_SFX_TRIGGER"; id: string }

  // Phase 9.1: Custom asset actions
  | { type: "ADD_CUSTOM_ASSET"; asset: PlacedCustomAsset }
  | {
      type: "UPDATE_CUSTOM_ASSET";
      id: string;
      updates: Partial<PlacedCustomAsset>;
    }
  | { type: "REMOVE_CUSTOM_ASSET"; id: string }

  // Phase 9.2: Prefab actions
  | { type: "ADD_PREFAB"; prefab: Prefab }
  | { type: "UPDATE_PREFAB"; id: string; updates: Partial<Prefab> }
  | { type: "REMOVE_PREFAB"; id: string }

  // Bulk restore actions (for project load persistence)
  | { type: "RESTORE_EXTENDED_LAYERS"; layers: ExtendedWorldLayers }
  | { type: "RESTORE_AUDIO_LAYERS"; layers: AudioLayers }
  | { type: "RESTORE_PREFABS"; prefabs: Prefab[] }

  // Phase 7: AI generation actions
  | {
      type: "AI_GENERATION_START";
      generationType: "dialogue" | "voice" | "quest";
      entityId: string;
    }
  | {
      type: "AI_GENERATION_COMPLETE";
      generationType: "dialogue" | "voice" | "quest";
      entityId: string;
      result: unknown;
    }
  | {
      type: "AI_GENERATION_ERROR";
      generationType: "dialogue" | "voice" | "quest";
      entityId: string;
      error: string;
    }
  | {
      type: "AI_GENERATION_ACCEPT";
      generationType: "dialogue" | "voice" | "quest";
      entityId: string;
    }
  | {
      type: "AI_GENERATION_REJECT";
      generationType: "dialogue" | "voice" | "quest";
      entityId: string;
    }
  // Phase 8: Deployment pipeline
  | { type: "DEPLOY_STAGING_START" }
  | {
      type: "DEPLOY_STAGING_STATUS";
      status: DeploymentState["stagingStatus"];
      error?: string;
    }
  | { type: "DEPLOY_STAGING_COMPLETE"; record: DeploymentRecord }
  | { type: "DEPLOY_PRODUCTION_START" }
  | {
      type: "DEPLOY_PRODUCTION_STATUS";
      status: DeploymentState["productionStatus"];
      error?: string;
    }
  | { type: "DEPLOY_PRODUCTION_COMPLETE"; record: DeploymentRecord }
  | { type: "DEPLOY_DIFF_START" }
  | { type: "DEPLOY_DIFF_COMPLETE"; diff: DeploymentDiff }
  | { type: "DEPLOY_HISTORY_LOAD"; history: DeploymentRecord[] }
  | { type: "DEPLOY_ROLLBACK"; deploymentId: string }
  | {
      type: "DEPLOY_PROMOTION_REQUEST";
      id: string;
      requestedBy: string;
      diff: DeploymentDiff;
    }
  | { type: "DEPLOY_PROMOTION_APPROVE"; approvedBy: string }
  | { type: "DEPLOY_PROMOTION_REJECT" }
  // Phase 9: Viewport overlays
  | { type: "SET_OVERLAY"; overlay: Partial<StudioViewportOverlays> }
  // Game entity data from manifest
  | { type: "SET_GAME_ENTITIES"; data: GameEntityData }
  // Manifest overrides
  | {
      type: "SET_MANIFEST_OVERRIDE";
      overrideType: keyof ManifestOverrides;
      entityId: string;
      data: Record<string, unknown>;
    }
  | {
      type: "CLEAR_MANIFEST_OVERRIDE";
      overrideType: keyof ManifestOverrides;
      entityId: string;
    }
  | { type: "LOAD_MANIFEST_OVERRIDES"; overrides: ManifestOverrides }
  | { type: "CLEAR_ALL_MANIFEST_OVERRIDES" }
  // Batch actions for auto-generation pipeline
  | { type: "BATCH_ADD_REGIONS"; regions: PlacedRegion[] }
  | {
      type: "BATCH_ADD_ENTITIES";
      mobSpawns: PlacedMobSpawn[];
      resources: PlacedResource[];
    }
  | { type: "BATCH_ADD_MINES"; mines: PlacedMine[] }
  | { type: "ADD_MINE"; mine: PlacedMine }
  | { type: "REMOVE_MINE"; id: string }
  | { type: "CLEAR_ALL_AUTOGEN" }
  // Move a single town to a new position
  | {
      type: "MOVE_TOWN";
      townId: string;
      position: { x: number; y: number; z: number };
    }
  // Town unification — sync runtime-generated towns into foundation.towns
  | {
      type: "SYNC_RUNTIME_TOWNS";
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
      }>;
    }
  // Replace foundation roads (used by auto-gen to add inter-town roads)
  | {
      type: "SET_FOUNDATION_ROADS";
      roads: GeneratedRoad[];
    }
  // Replace foundation towns + buildings (selective regeneration)
  | {
      type: "SET_FOUNDATION_TOWNS";
      towns: GeneratedTown[];
      buildings: GeneratedBuilding[];
    }
  // Update foundation config without changing towns/roads (selective regeneration)
  | {
      type: "SET_FOUNDATION_CONFIG";
      config: WorldCreationConfig;
    }
  // Custom road CRUD (user-authored roads from path tool)
  | {
      type: "ADD_CUSTOM_ROAD";
      road: import("../WorldBuilder/types").CustomRoad;
    }
  | {
      type: "UPDATE_CUSTOM_ROAD";
      roadId: string;
      updates: Partial<import("../WorldBuilder/types").CustomRoad>;
    }
  | { type: "REMOVE_CUSTOM_ROAD"; roadId: string }
  // Wizard preview overlay
  | { type: "SET_WIZARD_PREVIEW"; preview: WizardPreviewData }
  // Live terrain config for real-time slider updates (Phase 1)
  | { type: "SET_LIVE_TERRAIN_CONFIG"; config: WorldCreationConfig }
  | { type: "CLEAR_LIVE_TERRAIN_CONFIG" }
  | { type: "CLEAR_WIZARD_PREVIEW" }
  // Phase 4: Play-In-Editor
  | { type: "PIE_START" }
  | { type: "PIE_STARTED" }
  | { type: "PIE_STOP" }
  | { type: "PIE_ERROR"; error: string }
  | { type: "PIE_SET_MODE"; mode: PIEMode }

  // Generic entity CRUD — schema-driven GameModule actions
  | {
      type: "ENTITY_ADD";
      stateKey: string;
      stateRoot?: "extendedLayers" | "audioLayers";
      entity: { id: string } & Record<string, unknown>;
    }
  | {
      type: "ENTITY_UPDATE";
      stateKey: string;
      stateRoot?: "extendedLayers" | "audioLayers";
      id: string;
      updates: Record<string, unknown>;
      trackSource?: boolean;
    }
  | {
      type: "ENTITY_REMOVE";
      stateKey: string;
      stateRoot?: "extendedLayers" | "audioLayers";
      id: string;
    };

/** Union of all world builder + studio-specific actions */
export type WorldStudioAction = WorldBuilderAction | StudioSpecificAction;

// ============== VIEWPORT CALLBACKS ==============

/** Ref-based callbacks for viewport operations that bypass React state.
 *  Set by ViewportContainer when scene is ready, consumed by panels like ProcgenPanel. */
export interface ViewportCallbacks {
  refreshVegetation?: (
    vegConfig?: VegetationConfig,
    exclusions?: import("../WorldBuilder/TileBasedTerrain").VegetationExclusions,
    vegetationPaints?: Array<{
      id: string;
      center: { x: number; z: number };
      radius: number;
      strength: number;
      falloff: "sharp" | "linear" | "smooth";
      mode: "add" | "remove";
      speciesFilter: string[];
      timestamp: number;
    }>,
  ) => Promise<void>;
  navigateCamera?: (x: number, z: number, close?: boolean) => void;
  /** Query biome + height at world coordinates (game space). Used by auto-gen pipeline. */
  queryBiome?: (
    worldX: number,
    worldZ: number,
  ) => { biome: string; height: number };
  /** Get difficulty level for a biome ID. Used by auto-gen pipeline. */
  getBiomeDifficulty?: (biomeId: string) => number;
  /** Offset to convert game-space → scene-space: sceneX = gameX + worldCenterOffset. */
  worldCenterOffset?: number;
  /** Runtime-generated towns with game-space positions + safe zone radii. */
  runtimeTowns?: Array<{
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
    size: string;
    safeZoneRadius: number;
  }>;
  /** Vegetation tree positions in game-space. Used by auto-gen to avoid placing entities on trees. */
  vegetationPositions?: Array<{ x: number; z: number }>;
  /** Full vegetation tree data for manifest export (species, world pos, scale, rotation). */
  vegetationTrees?: Array<{
    s: string;
    x: number;
    y: number;
    z: number;
    sc: number;
    r: number;
  }>;
  /** Rebuild town 3D meshes (buildings, roads, landmarks) from full procgen town data. */
  refreshTownMarkers?: (
    towns: import("@hyperforge/procgen/building/town").GeneratedTown[],
  ) => void;
  /** Show or hide the decorative instanced vegetation layer. */
  setVegetationVisible?: (visible: boolean) => void;
  /** Get the current terrain querier function (for heightmap export). */
  getTerrainQuerier?: () =>
    | ((
        worldX: number,
        worldZ: number,
      ) => {
        height: number;
        biome: string;
        biomeForestWeight?: number;
        biomeCanyonWeight?: number;
      })
    | null;
  /** Set an imported heightmap querier that overrides procedural terrain. */
  setImportedQuerier?: (
    querier:
      | ((
          worldX: number,
          worldZ: number,
        ) => {
          height: number;
          biome: string;
          biomeForestWeight?: number;
          biomeCanyonWeight?: number;
        })
      | null,
  ) => void;
}

// ============== INITIAL STATE ==============

export const initialProjectState: StudioProjectState = {
  currentTeamId: null,
  currentGameId: null,
  currentProjectId: null,
  projectName: null,
  projectVersion: 0,
  lockedBy: null,
  gameMode: null,
  templateId: null,
  plugins: [],
  assetPacks: [],
};

export const initialPersistenceState: StudioPersistenceState = {
  isSaving: false,
  isLoading: false,
  saveError: null,
  loadError: null,
  lastSavedAt: null,
  autoSaveEnabled: true,
};

export const initialToolState: StudioToolState = {
  activeTool: "select",
  activePlacement: null,
  brushSettings: DEFAULT_BRUSH_SETTINGS,
  cameraTeleportTarget: null,
  transformMode: "translate",
  transformSpace: "world",
  zonePaint: null,
  isAddingWaterVertices: false,
  gridSize: 1.0,
};

export const worldStudioInitialState: WorldStudioState = {
  builder: worldBuilderInitialState,
  project: initialProjectState,
  persistence: initialPersistenceState,
  tools: initialToolState,
  extendedLayers: EMPTY_EXTENDED_LAYERS,
  manifests: EMPTY_MANIFEST_DATA,
  brushOverlays: EMPTY_BRUSH_OVERLAYS,
  audioLayers: EMPTY_AUDIO_LAYERS,
  aiGeneration: EMPTY_AI_GENERATION_STATE,
  deployment: EMPTY_DEPLOYMENT_STATE,
  overlays: DEFAULT_VIEWPORT_OVERLAYS,
  manifestOverrides: EMPTY_MANIFEST_OVERRIDES,
  gameEntities: null,
  wizardPreview: null,
  liveTerrainConfig: null,
  pie: EMPTY_PIE_STATE,
  prefabs: [],
};

// Re-export commonly-used types from WorldBuilder for convenience
export type {
  WorldBuilderState,
  WorldBuilderAction,
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
  GeneratedTown,
  GeneratedBuilding,
  GeneratedRoad,
  ActivePlacement,
  ExtendedWorldLayers,
  ManifestData,
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
  PrefabEntry,
  PaletteCategory,
  BrushSettings,
  BrushOverlays,
  BrushType,
  TerrainSculptStroke,
  BiomePaintStroke,
  VegetationPaintStroke,
  MaterialPaintStroke,
  FoliagePaintStroke,
  AudioLayers,
  MusicZone,
  AmbientZone,
  SFXTrigger,
  DeploymentState,
  DeploymentDiff,
  DeploymentRecord,
  ManifestOverrides,
  ManifestItem,
  ManifestQuest,
  ManifestStore,
  ManifestNPC,
  ManifestCombatSpell,
  ManifestPrayer,
  ManifestRecipe,
  ManifestAmmunition,
  ManifestRune,
  ManifestElementalStaff,
  ManifestSkillUnlock,
  ManifestTierRequirement,
  ManifestDuelArena,
  ManifestStation,
  ManifestTree,
  ManifestFishingSpot,
  ManifestMiningRock,
  GameEntityData,
  VegetationConfig,
};
