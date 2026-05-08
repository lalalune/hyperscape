/**
 * TileBasedTerrain - Real tile-based terrain viewer matching the game's terrain system
 *
 * This component renders terrain exactly as it appears in the game:
 * - Individual 100m x 100m tiles as separate THREE.Mesh objects
 * - Same terrain generation via TerrainGenerator from @hyperforge/procgen
 * - Tile loading/unloading based on camera position
 * - Fly camera controls for exploration
 * - Town markers showing generated towns
 *
 * Uses WebGPU renderer for TSL/node materials compatibility.
 */

import { TownGenerator } from "@hyperforge/procgen/building/town";
import type { GeneratedTown as ProcgenTown } from "@hyperforge/procgen/building/town";
import {
  TerrainGenerator,
  createConfigFromPreset,
  TERRAIN_PRESETS,
  type TerrainConfig,
} from "@hyperforge/procgen/terrain";
import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import { MeshBasicNodeMaterial, LineBasicNodeMaterial } from "three/webgpu";
// TSL post-processing (pass, fxaa, bloom) now lives inside ViewportRenderLoop.

import { useCameraControls } from "./useCameraControls";
import { ViewHelper } from "three/examples/jsm/helpers/ViewHelper.js";

import { buildingWalkabilityService } from "./BuildingWalkabilityService";
import { Minimap, WILDERNESS_START_PERCENT } from "./Minimap";
import {
  createGameTerrainQuerier,
  GAME_MAX_HEIGHT,
  GAME_WATER_THRESHOLD,
  GAME_TILE_SIZE,
  GAME_WORLD_SIZE,
} from "./GameTerrainAdapter";
import {
  generateTrees,
  type ResourceGenerationContext,
  type BiomeTreeConfig,
  getTreeConfigForBiome,
  precomputeExclusions,
  filterTreesByExclusions,
  type VegetationExclusionInput,
} from "@hyperforge/shared/world";
import {
  initTreeModels,
  getTreeSpeciesInstance,
  getAllTreeSpeciesIds,
  clearTreeSpeciesCache,
  createBridgeMeshes,
  createDuelArena,
} from "./GameWorldAssets";
import {
  DifficultyHeatmapManager,
  type TownInfo,
  type DangerSourceInfo,
} from "./DifficultyHeatmap";
// createRoadMaterial removed — roads rendered by terrain shader, not ribbon meshes
import {
  createGameWorldEntities,
  disposeEntitySync,
  disposeEntitySyncGeometry,
  type GameEntityData,
} from "./GameWorldEntitySync";
import { SceneResourceManager } from "./SceneResourceManager";
import { FoliageManager, FOLIAGE_TILE_RADIUS } from "./FoliageRenderer";
import {
  processDeferredFrame,
  processDeferredDisposalOnly,
} from "../WorldStudio/utils/deferredGpuDisposal";
import {
  applySculptStrokesToGeometry,
  applyVegetationPaintStrokes,
} from "../WorldStudio/utils/brushApplication";
import type {
  WorldCreationConfig,
  GeneratedRoad,
  VegetationConfig,
} from "./types";
import {
  type TerrainQueryResult,
  type TerrainQuerier,
  type TownFlattenZone,
  createTemplateGeometry,
  createTerrainMaterial,
  generateTileGeometry,
} from "./terrainHelpers";
import {
  createEditorWaterMaterial,
  type EditorWaterUniforms,
} from "./EditorWaterMaterial";
import { EditorGrassManager } from "./EditorGrassManager";
import { useStandaloneSky } from "./hooks/useStandaloneSky";
import { useGameFog } from "./hooks/useGameFog";
import { useShadowsCSM } from "./hooks/useShadowsCSM";
import { setupTerrainLighting } from "./hooks/setupTerrainLighting";
import { TownRenderer } from "./systems/TownRenderer";
import { ViewportRenderLoop } from "./systems/ViewportRenderLoop";
// TODO: Wire these system classes for full decomposition (CameraController, SelectionManager, TileManager)
// import { CameraController } from "./systems/CameraController";
// import { SelectionManager } from "./systems/SelectionManager";
// import { TileManager } from "./systems/TileManager";

import { THREE, type AssetForgeRenderer } from "@/utils/webgpu-renderer";
import {
  DAY_CYCLE,
  FOG_COLORS,
  updateSceneLighting,
  hourToDayPhase,
  computeTargetExposure,
  updateSceneFog,
} from "@hyperforge/shared";

// Town rendering moved to TownRenderer — shared geometry singletons, type aliases,
// and material constructors are now managed by TownRenderer.ts.

// Tile geometry pool extracted to `hooks/tileGeometryPool.ts`
// (Phase 1.1 sixth carve, second piece of the tile-streamer
// extraction outlined in PLAN_AAA_MASTER_AUDIT debt #2). Pure
// module-scope `Map<vertex-count, BufferGeometry[]>` with two
// pull/push helpers; behavior preserved verbatim.
import {
  acquirePooledGeometry,
  releaseToGeomPool,
} from "./hooks/tileGeometryPool";

// ============== PRE-ALLOCATED MATH OBJECTS (avoid per-click/per-frame GC) ==============

const _clickMatrix = new THREE.Matrix4();
const _clickPos = new THREE.Vector3();
const _clickQuat = new THREE.Quaternion();
const _clickScale = new THREE.Vector3();

// ============== CONSTANTS ==============

// Tile streaming radius constants + altitude-scaled radius
// computation extracted to `hooks/tileStreamingRadius.ts`
// (Phase 1.1 fifth carve, first piece of the tile-streamer
// extraction outlined in PLAN_AAA_MASTER_AUDIT debt #2).
import {
  TILE_LOAD_RADIUS_STANDALONE as TILE_LOAD_RADIUS,
  TILE_LOAD_RADIUS_STUDIO,
  TILE_UNLOAD_RADIUS,
  MAX_TILES_PER_FRAME,
  MAX_TILES_PER_FRAME_INITIAL_LOAD,
  TILE_LOD_LOW_RESOLUTION,
  MAX_LOW_RES_TILES_PER_FRAME,
  getDynamicLoadRadius,
  getFullDetailRadius,
} from "./hooks/tileStreamingRadius";

// GPU resource lifecycle (staging + disposal) is managed by SceneResourceManager.
// See SceneResourceManager.ts for rate-limiting constants and phase separation logic.

/** Camera altitude above which entity markers are hidden (saves thousands of draw calls) */
const MARKER_HIDE_ALTITUDE = 400;

// Per-tile town flatten zone builder extracted to
// `hooks/buildTownFlattenZones.ts` (Phase 1.1 eighth carve).
// Pure AABB-rejection + zone construction; no React or scene refs.
import { buildTownFlattenZones } from "./hooks/buildTownFlattenZones";
// Dirty-tile-by-distance ordering extracted to
// `hooks/markDirtyTilesByDistance.ts` (Phase 1.1 ninth carve).
// Used by terrain-config / road / mine change effects to
// prioritize regenerating tiles near the camera first.
import { markDirtyTilesByDistance } from "./hooks/markDirtyTilesByDistance";
// Mouse → NDC conversion extracted to
// `hooks/mouseEventToNdc.ts` (Phase 1.1 tenth carve). Used by
// click and hover handlers before raycasting.
import { mouseEventToNdc } from "./hooks/mouseEventToNdc";
// Per-mesh Y rescale extracted to `hooks/rescaleVertexY.ts`
// (Phase 1.1 twelfth carve). Used by the maxHeight-change
// fast-path that scales loaded tile geometry in place rather
// than regenerating from scratch.
import { rescaleVertexY } from "./hooks/rescaleVertexY";

// Building LOD distances and town size colors now live in TownRenderer.ts.

// ============== TYPES ==============

interface TileData {
  mesh: THREE.Mesh;
  water: THREE.Mesh | null;
  tileX: number;
  tileZ: number;
  lastAccessed: number;
  /** Vertex resolution (e.g. 32 for full, 8 for LOD far tiles) */
  resolution: number;
  /** Dirty flag — geometry needs regeneration due to config change */
  dirty?: boolean;
}

/** Selection info returned when clicking objects in the viewport */
export interface ViewportSelection {
  type:
    | "terrain"
    | "chunk"
    | "tile"
    | "biome"
    | "town"
    | "building"
    | "road"
    | "entity"
    | "vegetation"
    | "bridge"
    | "duelArena";
  id: string;
  position: { x: number; y: number; z: number };
  townId?: string;
  townName?: string;
  buildingType?: string;
  biomeType?: string;
  tileKey?: string;
  /** Entity type for entity selections (spawnPoint, teleport, mobSpawn, etc.) */
  entityType?: string;
  /** Entity ID for entity selections */
  entityId?: string;
  /** Display name for entity selections */
  entityDisplayName?: string;
  /** Full entity metadata from userData (for game world entities) */
  entityData?: Record<string, unknown>;
  /** Vegetation instance data (for vegetation selections) */
  vegetationSpecies?: string;
  vegetationInstanceIndex?: number;
  /** Tile inspector data for terrain selections */
  tileData?: {
    tileX: number;
    tileZ: number;
    chunkX: number;
    chunkZ: number;
    worldX: number;
    worldZ: number;
    height: number;
    biome: string;
    slope: number;
    walkable: boolean;
    inTown: boolean;
    townId?: string;
    inWilderness: boolean;
    difficultyLevel: number;
  };
}

/** View mode for the viewport */
export type ViewMode = "lit" | "wireframe" | "biomeColors";

/**
 * Exclusion zones for vegetation filtering. Inspired by Far Cry 5's SDF-based
 * density field and Horizon Zero Dawn's distance-to-civilization maps.
 *
 * Instead of binary keep/remove, the system computes a continuous survival
 * probability per tree using signed distance fields + FBM noise distortion +
 * town proximity gradients + scale tapering at forest edges.
 *
 * All positions are in game-space (centered coordinates).
 */
/** Vegetation exclusion input — re-exported from shared for external callers */
export type VegetationExclusions = VegetationExclusionInput;

/**
 * Determine the visually dominant biome from terrain shader blend weights.
 * Uses simple max-weight for general reporting (queryBiome on viewport ref).
 */
function _getVisualBiome(q: TerrainQueryResult): string {
  const fW = q.biomeForestWeight ?? 0;
  const cW = q.biomeCanyonWeight ?? 0;
  const tW = Math.max(0, 1 - fW - cW);
  if (fW >= cW && fW >= tW) return "forest";
  if (cW >= fW && cW >= tW) return "canyon";
  return "tundra";
}

/**
 * Biome selection specifically for tree species placement.
 *
 * The terrain shader linearly blends biome colors:
 *   finalColor = tundra*tW + forest*fW + canyon*cW
 *
 * At boundaries (e.g., forest=0.4, tundra=0.35, canyon=0.25), the max-weight
 * biome is "forest" but the blended visual color is grey-muddy — NOT clearly
 * forest-green. Placing forest-exclusive species (Maple, Knotwood) on this
 * grey ground looks wrong.
 *
 * Fix: require a biome to have >55% weight (clear visual dominance) before
 * using its full species set. Below that threshold the blended color is
 * ambiguous, so we fall back to "tundra" whose conifers (WindPine, Fir, Pine,
 * Birch) look natural on any ground color and create a pleasing transition.
 */
// Deterministic per-tile LCG RNG extracted to
// `hooks/tileSeedRng.ts` (Phase 1.1 seventh carve). Pure
// stateless function; matches the server's createTileRng
// byte-for-byte so client and server placements stay in sync.
import { createTileRng as _createTileRng } from "./hooks/tileSeedRng";

/** Refs exposed to parent for editing tool integration */
export interface TerrainSceneRefs {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /**
   * The WebGPU renderer driving the viewport. Exposed so
   * `usePIESession` can mount it onto PIE's `_clientWorld.graphics`,
   * letting the real `InteractionRouter` (which reads
   * `world.graphics.renderer.domElement` to bind canvas events)
   * run unmodified. Lifecycle owned by `ViewportRenderLoop`; this
   * is a stable reference for the duration of the session.
   */
  renderer: THREE.WebGPURenderer;
  raycaster: THREE.Raycaster;
  /** DOM container element for mouse event binding */
  container: HTMLDivElement;
  terrainContainer: THREE.Group;
  /** Group for adding editor entity markers (NPCs, spawn points, etc.) */
  entityOverlay: THREE.Group;
  /** Register an object as clickable for selection */
  addSelectable: (obj: THREE.Object3D) => void;
  /** Remove an object from selectables */
  removeSelectable: (obj: THREE.Object3D) => void;
  /**
   * Set interaction mode to prevent OrbitControls from conflicting with editing tools.
   * 'orbit' = normal camera controls (left-click rotates)
   * 'tool'  = editing mode (left-click disabled on orbit, middle dolly, right pan)
   * 'gizmo' = transform gizmo active (left disabled for gizmo, middle orbit, right pan)
   */
  setInteractionMode: (mode: "orbit" | "tool" | "gizmo") => void;
  /** Animate camera to focus on a world position with a given bounding radius */
  focusOnPosition: (target: THREE.Vector3, radius: number) => void;
  /** Change the viewport rendering mode */
  setViewMode: (mode: ViewMode) => void;
  /** Toggle the ground grid helper */
  setGridVisible: (visible: boolean) => void;
  /**
   * Promote a vegetation InstancedMesh instance into a standalone Object3D
   * so TransformControls can attach to it. Hides the original instance.
   * Returns the proxy group (already added to entityOverlay), or null if not found.
   */
  promoteVegetationInstance: (
    speciesId: string,
    instanceIndex: number,
    selectableId: string,
  ) => THREE.Group | null;
  /**
   * Write the proxy group's current transform back to the InstancedMesh
   * instance and remove the proxy from the scene.
   */
  demoteVegetationInstance: (proxyGroup: THREE.Group) => void;
  /**
   * Re-fetch tree positions from the server and rebuild all vegetation
   * InstancedMeshes without tearing down the rest of the scene.
   * Pass a VegetationConfig to override biome defaults, or omit for defaults.
   * Pass exclusions to filter out trees near wizard-placed content.
   */
  refreshVegetation: (
    vegConfig?: VegetationConfig,
    exclusions?: VegetationExclusions,
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
  /** Teleport camera to a world position. Pass close=true for entity-level zoom. */
  navigateCamera: (x: number, z: number, close?: boolean) => void;
  /** True if RMB fly mode was used in the current mouse interaction (for context menu suppression) */
  wasRecentlyFlying: () => boolean;
  /** Sample terrain height at scene coordinates (analytical — no raycasting). Returns 0 if querier not ready. */
  getTerrainHeight: (sceneX: number, sceneZ: number) => number;
  /** Enter player preview mode: ground-locked, WASD walk, mouse look. Press Escape to exit. */
  enterPlayerMode: () => void;
  /** Exit player preview mode and return to orbit camera. */
  exitPlayerMode: () => void;
  /** Whether player preview mode is currently active. */
  isPlayerMode: () => boolean;
  /** Offset to convert between scene-space (0..worldSize) and game-space (-half..+half). sceneX = gameX + offset. */
  worldCenterOffset: number;
  /** Query biome + height at world coordinates (game space). Used by auto-gen pipeline. */
  queryBiome: (
    worldX: number,
    worldZ: number,
  ) => { biome: string; height: number };
  /** Get difficulty level for a biome ID. Used by auto-gen pipeline. */
  getBiomeDifficulty: (biomeId: string) => number;
  /** Runtime-generated towns with positions in game-space. Set by terrain generation. */
  runtimeTowns: Array<{
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
    size: string;
    safeZoneRadius: number;
  }>;
  /** Vegetation tree positions in game-space, populated by refreshVegetation(). */
  vegetationPositions: Array<{ x: number; z: number }>;
  /** Full vegetation tree data for manifest export (species, world pos, scale, rotation). */
  vegetationTrees: Array<{
    s: string;
    x: number;
    y: number;
    z: number;
    sc: number;
    r: number;
  }>;
  /** Rebuild town 3D meshes (buildings, roads, landmarks) from full procgen data. */
  refreshTownMarkers: (towns: ProcgenTown[]) => void;
  /** Move a town's 3D scene markers + update runtimeTownsRef for flatten zones.
   *  Does NOT unload tiles — that's handled by the useEffect when roads prop changes. */
  moveTownInScene: (
    townId: string,
    newPosition: { x: number; y: number; z: number },
  ) => void;
  /** Remove all inter-town road ribbon meshes and re-render from provided roads. */
  rebuildRoadRibbons: (
    roads: Array<{
      id: string;
      path: Array<{ x: number; y: number; z: number }>;
      width: number;
      connectedTowns: [string, string];
      isMainRoad: boolean;
    }>,
  ) => void;
  /** Get the last ProcgenTown[] passed to refreshTownMarkers (for town-move pipeline). */
  getLastProcgenTowns: () => ProcgenTown[];
  /** Show or hide the decorative instanced vegetation layer. */
  setVegetationVisible: (visible: boolean) => void;
  /** Get the current terrain querier function (for heightmap export). */
  getTerrainQuerier: () =>
    | ((worldX: number, worldZ: number) => TerrainQueryResult)
    | null;
}

export interface TileBasedTerrainProps {
  config: WorldCreationConfig;
  className?: string;
  onTileCountChange?: (loaded: number, total: number) => void;
  /** Called when user clicks on an object in the viewport */
  onSelect?: (selection: ViewportSelection | null) => void;
  /** Currently selected object ID for highlighting */
  selectedId?: string | null;
  /** Whether to show vegetation (trees, grass, rocks) - GPU instanced */
  showVegetation?: boolean;
  /** Whether fly mode is enabled (controlled externally) */
  flyModeEnabled?: boolean;
  /** Called when fly mode state changes */
  onFlyModeChange?: (enabled: boolean) => void;
  /** Called when player preview mode state changes */
  onPlayerModeChange?: (enabled: boolean) => void;
  /** Called when camera move speed changes (scroll wheel or [ ] keys) */
  onMoveSpeedChange?: (speed: number) => void;
  /** Pre-generated road network (uses actual pathfinding data) */
  roads?: GeneratedRoad[];
  /** Placed mine areas for terrain influence overlay */
  mines?: Array<{
    position: { x: number; y: number; z: number };
    radius: number;
    radialOffsets: number[];
    entryAngle: number;
    biome: string;
  }>;
  /** Called when scene is ready, exposes refs for editing tool integration */
  onSceneReady?: (refs: TerrainSceneRefs) => void;
  /** When true, suppress built-in HUD overlays (used by World Studio which has its own) */
  hideBuiltinOverlays?: boolean;
  /** Called after game world entities are loaded from the manifest API */
  onGameEntitiesLoaded?: (data: GameEntityData) => void;
  /** Called on quick RMB click (no fly) with screen coords for context menu */
  onViewportContextMenu?: (x: number, y: number) => void;
  /**
   * Bug #3 fix — explicit "this project targets the Hyperia
   * game" flag, distinct from `config.useGamePipeline` (which
   * is a procgen-pipeline boolean baked into legacy world data).
   * When `false`, the Hyperia-specific blocks
   * (bridges, duel arena, `createGameWorldEntities`) skip even
   * if `config.useGamePipeline` is true. Defaults to undefined
   * → treated as legacy behavior (fall through to
   * `useGamePipeline` boolean alone).
   */
  projectTargetsHyperia?: boolean;
  /** Show difficulty heatmap overlay on terrain */
  showDifficultyHeatmap?: boolean;
  /** Danger sources for difficulty heatmap overlay */
  dangerSources?: DangerSourceInfo[];
  /** Called after towns are generated/loaded — used to sync runtime towns back to foundation */
  onTownsGenerated?: (
    towns: Array<{
      id: string;
      name: string;
      position: { x: number; y: number; z: number };
      size: "hamlet" | "village" | "town";
      safeZoneRadius: number;
      biomeId?: string;
    }>,
  ) => void;
  /** Brush overlay strokes (terrain sculpt, biome paint, foliage) to re-apply on tile generation */
  brushOverlays?: {
    terrainSculpts: Array<{
      id: string;
      center: { x: number; z: number };
      radius: number;
      strength: number;
      falloff: "smooth" | "linear" | "sharp";
      mode: "raise" | "lower" | "flatten" | "smooth";
      flattenTarget?: number;
      timestamp: number;
    }>;
    foliagePaints?: Array<{
      id: string;
      center: { x: number; z: number };
      radius: number;
      strength: number;
      falloff: "smooth" | "linear" | "sharp";
      mode: "add" | "remove";
      foliageTypes: string[];
      timestamp: number;
    }>;
  };
  /** Override the terrain querier with an imported heightmap querier */
  importedQuerier?:
    | ((worldX: number, worldZ: number) => TerrainQueryResult)
    | null;
  /** Time of day for lighting (0-24, where 0/24=midnight, 6=dawn, 12=noon, 18=dusk) */
  timeOfDay?: number;
  /** Enable shadow rendering (Phase 6.1) */
  enableShadows?: boolean;
  /** Enable bloom post-processing (Phase 6.2) */
  enableBloom?: boolean;
  /** Use game-matching exponential fog (Phase 6.3) */
  enableGameFog?: boolean;
  /** Enable procedural sky dome with sun, moon, and clouds */
  enableSky?: boolean;
  /** Enable procedural wind-animated grass */
  enableGrass?: boolean;
}

export type { GameEntityData };

// Minimap extracted to ./Minimap.tsx
// Terrain helper functions extracted to ./terrainHelpers.ts

// ============== MAIN COMPONENT ==============

export const TileBasedTerrain: React.FC<TileBasedTerrainProps> = ({
  config,
  className = "",
  onTileCountChange,
  onSelect,
  selectedId,
  showVegetation = false,
  flyModeEnabled = false,
  onFlyModeChange,
  onMoveSpeedChange,
  roads: providedRoads,
  mines: providedMines,
  onSceneReady,
  hideBuiltinOverlays = false,
  onGameEntitiesLoaded,
  onViewportContextMenu,
  showDifficultyHeatmap = false,
  dangerSources,
  onTownsGenerated,
  onPlayerModeChange,
  brushOverlays,
  importedQuerier,
  projectTargetsHyperia,
  timeOfDay = 12,
  enableShadows = false,
  enableBloom = false,
  enableGameFog = false,
  enableSky = false,
  enableGrass = false,
}) => {
  // Terrain querier ref (defined early so camera hook can use it for player mode)
  const terrainQuerierRef = useRef<TerrainQuerier | null>(null);
  const worldCenterOffsetRef = useRef<number>(0);

  // Stable terrain height callback for player-mode ground lock
  const getTerrainHeightForCamera = useCallback(
    (sceneX: number, sceneZ: number): number => {
      const querier = terrainQuerierRef.current;
      if (!querier) return 0;
      const offset = worldCenterOffsetRef.current;
      return querier(sceneX - offset, sceneZ - offset).height;
    },
    [],
  );

  // Camera controller — handles fly mode, orbit controls, all input handlers
  const cam = useCameraControls({
    worldSize: config.terrain.worldSize,
    tileSize: config.terrain.tileSize,
    onFlyModeChange,
    onMoveSpeedChange,
    onViewportContextMenu,
    onPlayerModeChange,
    getTerrainHeight: getTerrainHeightForCamera,
  });
  const {
    cameraRef,
    cameraStateRef,
    orbitControlsRef,
    containerRef,
    keysRef,
    rmbFlyActiveRef,
    rmbDidFlyRef,
    pendingOrbitCreateRef,
    playerModeRef: camPlayerModeRef,
    updateCamera,
    handleMouseMove,
    handleKeyDown,
    handleKeyUp,
    handleMouseDown,
    handleMouseUp,
    handleWheel,
    handleContextMenu,
    handlePointerLockChange,
    initOrbitControls,
    enterPlayerMode: camEnterPlayerMode,
    exitPlayerMode: camExitPlayerMode,
  } = cam;

  const rendererRef = useRef<AssetForgeRenderer | null>(null);
  const renderLoopRef = useRef<ViewportRenderLoop | null>(null);
  // Post-processing pipeline is now managed by ViewportRenderLoop.
  const gpuRecoveryCountRef = useRef(0);
  const gpuRecoveringRef = useRef(false);
  const [gpuRecovering, setGpuRecovering] = useState(false);
  const [gpuError, setGpuError] = useState<string | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const timeOfDayRef = useRef(timeOfDay);
  timeOfDayRef.current = timeOfDay;
  // Shadow + CSM lifecycle owned by `useShadowsCSM` (Phase 1.1
  // third carve). Hook is installed below alongside the other
  // hook installations; returns `enableShadowsRef` for the
  // animation loop and main scene effect to consult.
  const enableBloomRef = useRef(enableBloom);
  enableBloomRef.current = enableBloom;
  // Game-fog lifecycle owned by `useGameFog` (Phase 1.1 second
  // carve). Hook returns `enableGameFogRef` for the animation
  // loop's day-cycle fog-color interpolation.
  const enableGrassRef = useRef(enableGrass);
  enableGrassRef.current = enableGrass;
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  // Phase 1.1 first carve — sky lifecycle is owned by
  // `useStandaloneSky` (created/disposed when `enableSky`
  // toggles, async-init guarded against fast-toggle races,
  // background swap with the day-color flat scene). The hook
  // returns the stable refs we read from the animation loop.
  // The hook installation is below — see `const { skyRef,
  // enableSkyRef } = useStandaloneSky(...)`.
  const { skyRef: standaloneSkyRef, enableSkyRef } = useStandaloneSky({
    enableSky,
    hostRefs: { sceneRef, rendererRef, cameraRef },
  });
  const { enableGameFogRef } = useGameFog({
    enableGameFog,
    sceneRef,
  });
  // useShadowsCSM is installed AFTER isStudioModeRef is declared
  // (line ~848) — see the post-isStudioModeRef block.
  const standaloneGrassRef = useRef<EditorGrassManager | null>(null);
  // CSM shadow node ref owned by `useShadowsCSM` hook.
  const viewHelperRef = useRef<ViewHelper | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const viewModeRef = useRef<ViewMode>("lit");

  // Terrain state
  const tilesRef = useRef<Map<string, TileData>>(new Map());
  const templateGeometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const lowResTemplateGeometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const waterTemplateGeometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const terrainMaterialRef = useRef<THREE.Material | null>(null); // MeshStandardNodeMaterial for WebGPU
  const waterMaterialRef = useRef<THREE.Material | null>(null); // MeshStandardNodeMaterial for WebGPU
  const waterUniformsRef = useRef<EditorWaterUniforms | null>(null);
  const waterTexturesRef = useRef<{
    normalTex: THREE.DataTexture;
    flowTex: THREE.DataTexture;
    foamTex: THREE.DataTexture;
  } | null>(null);
  const lodObjectsRef = useRef<THREE.LOD[]>([]);
  const terrainContainerRef = useRef<THREE.Group | null>(null);
  const waterContainerRef = useRef<THREE.Group | null>(null);
  const townMarkersRef = useRef<THREE.Group | null>(null);
  const townRendererRef = useRef<TownRenderer | null>(null);
  const vegetationContainerRef = useRef<THREE.Group | null>(null);
  /** Map InstancedMesh → species ID for vegetation instance selection */
  const vegetationSpeciesMapRef = useRef<Map<THREE.InstancedMesh, string>>(
    new Map(),
  );
  const entitySyncRef = useRef<THREE.Group | null>(null);
  const entityOverlayRef = useRef<THREE.Group | null>(null);
  const foliageContainerRef = useRef<THREE.Group | null>(null);
  const foliageManagerRef = useRef<FoliageManager | null>(null);
  const wildernessOverlayRef = useRef<THREE.Mesh | null>(null);
  /** Vegetation tree positions in game-space, populated by refreshVegetation(). */
  const vegetationPositionsRef = useRef<Array<{ x: number; z: number }>>([]);
  /** Full vegetation tree data for manifest export. */
  const vegetationTreesRef = useRef<
    Array<{ s: string; x: number; y: number; z: number; sc: number; r: number }>
  >([]);
  const generatorRef = useRef<TerrainGenerator | null>(null);
  const heatmapManagerRef = useRef<DifficultyHeatmapManager | null>(null);
  /** Ref-stable copies of props that should NOT trigger full scene rebuild.
   *  Roads ref is ONLY updated via rebuildRoadRibbons() or the useEffect that
   *  watches providedRoads — NOT in the component body. Writing it here would
   *  overwrite the ref with stale prop data during renders that happen between
   *  rebuildRoadRibbons() and the SET_FOUNDATION_ROADS dispatch propagating. */
  const providedRoadsRef = useRef(providedRoads);
  const runtimeMinesRef = useRef(providedMines);
  const townConfigRef = useRef(config.towns);
  townConfigRef.current = config.towns;
  const configSeedRef = useRef(config.seed);
  configSeedRef.current = config.seed;

  // Tile generation queue + O(1) membership set
  const tileQueueRef = useRef<
    Array<{ tileX: number; tileZ: number; resolution: number }>
  >([]);
  const tileQueueSetRef = useRef<Set<string>>(new Set());

  // Dirty tile queue for incremental regeneration (Phase 6)
  const dirtyTileKeysRef = useRef<string[]>([]);

  // LOD upgrade queue — swap geometry in-place without removing mesh from scene (no flash)
  const lodUpgradeQueueRef = useRef<
    Array<{ key: string; tileX: number; tileZ: number }>
  >([]);
  const lodUpgradeQueueSetRef = useRef<Set<string>>(new Set());

  // LOD downgrade queue — swap distant full-res tiles back to low-res to reclaim GPU memory
  const lodDowngradeQueueRef = useRef<
    Array<{ key: string; tileX: number; tileZ: number }>
  >([]);
  const lodDowngradeQueueSetRef = useRef<Set<string>>(new Set());

  /** Previous maxHeight for fast-path scaling */
  const prevMaxHeightRef = useRef<number>(config.terrain.maxHeight);
  /** Previous waterThreshold for fast-path water plane move */
  const prevWaterThresholdRef = useRef<number>(config.terrain.waterThreshold);

  /** Previous deps for the terrain config effect — used to detect maxHeight-only
   *  changes so we can skip expensive dirty-tile regeneration (fast-path handles it). */
  const prevTerrainEffectDepsRef = useRef({
    seed: config.seed,
    useGamePipeline: config.useGamePipeline,
    tileSize: config.terrain.tileSize,
    tileResolution: config.terrain.tileResolution,
    maxHeight: config.terrain.maxHeight,
    terrainConfig: null as object | null,
    importedQuerier: null as unknown,
  });

  // GPU resource lifecycle manager — handles staged object addition and
  // deferred GPU disposal to prevent Metal WebGPU device loss.
  // See SceneResourceManager.ts for invariants and documentation.
  const resourceManager = useRef(new SceneResourceManager()).current;

  // Camera state refs are now managed by useCameraControls hook

  // Performance: track whether we're in World Studio mode via ref
  // (avoids adding hideBuiltinOverlays to callback dep arrays)
  const isStudioModeRef = useRef(hideBuiltinOverlays);
  isStudioModeRef.current = hideBuiltinOverlays;
  // Phase 1.1 third carve — shadow + CSM lifecycle. Installed
  // after `isStudioModeRef` because the shadow effect respects
  // studio-mode override.
  const { enableShadowsRef } = useShadowsCSM({
    enableShadows,
    hostRefs: { rendererRef, sunRef, cameraRef, isStudioModeRef },
  });

  // Raycasting for selection
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const selectableObjectsRef = useRef<THREE.Object3D[]>([]);

  // Selection highlighting
  const selectionOutlineRef = useRef<THREE.Mesh | null>(null);
  /** Track which selectable has labels shown due to being selected */
  const selectedLabelRef = useRef<THREE.Object3D | null>(null);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const [loadedTiles, setLoadedTiles] = useState(0);
  // Initial load tracking — loading overlay shown until all low-res tiles are seeded.
  // Two-phase: initialLoadComplete triggers fade-out, loadingOverlayVisible controls DOM removal.
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const initialLoadCompleteRef = useRef(false);
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(true);
  const [townCount, setTownCount] = useState(0);
  /** Runtime town data from terrain generation (game-space coordinates + safeZoneRadius) */
  const runtimeTownsRef = useRef<TerrainSceneRefs["runtimeTowns"]>([]);
  /** Full ProcgenTown[] from last refreshTownMarkers call (for town-move rebuild) */
  const lastProcgenTownsRef = useRef<ProcgenTown[]>([]);
  const [roadCount, setRoadCount] = useState(0);
  const [hoveredObject, setHoveredObject] = useState<string | null>(null);
  /** Track hovered selectable group for label visibility toggle (UE5-style) */
  const hoveredSelectableRef = useRef<THREE.Object3D | null>(null);
  const [cameraRotationY, setCameraRotationY] = useState(0);

  // Minimap data
  const [minimapTowns, setMinimapTowns] = useState<
    Array<{
      id: string;
      name: string;
      position: { x: number; z: number };
      size: string;
    }>
  >([]);
  const [minimapRoads, setMinimapRoads] = useState<
    Array<{ path: Array<{ x: number; z: number }> }>
  >([]);

  // Derived values
  const tileSize = config.terrain.tileSize;
  const tileResolution = config.terrain.tileResolution;
  const worldSize = config.terrain.worldSize;
  const maxHeight = config.terrain.maxHeight;
  const waterThreshold = config.terrain.waterThreshold;

  // Create terrain config - pass ALL config including island, noise, biomes, shoreline
  const terrainConfig = useMemo((): Partial<TerrainConfig> => {
    const preset = config.preset || "large-island";

    // Build full override config from WorldCreationConfig
    const overrides: Partial<TerrainConfig> = {
      seed: config.seed,
      worldSize: config.terrain.worldSize,
      tileSize: config.terrain.tileSize,
      tileResolution: config.terrain.tileResolution,
      maxHeight: config.terrain.maxHeight,
      waterThreshold: config.terrain.waterThreshold,
      // Pass through island, noise, biomes, and shoreline configs
      island: config.island,
      noise: config.noise,
      biomes: config.biomes,
      shoreline: config.shoreline,
    };

    if (TERRAIN_PRESETS[preset]) {
      return createConfigFromPreset(preset, overrides);
    }
    return createConfigFromPreset("large-island", overrides);
  }, [config]);

  // Tile key cache — avoids O(farRadius²) template literal string allocations
  // per camera tile change. The packed numeric key enables fast Map lookups;
  // the string is computed once per unique tile coordinate.
  const _tileKeyCache = useRef(new Map<number, string>());
  const getTileKey = useCallback((tileX: number, tileZ: number): string => {
    const packed = (tileX + 500) * 1000 + (tileZ + 500);
    let key = _tileKeyCache.current.get(packed);
    if (!key) {
      key = `${tileX}_${tileZ}`;
      _tileKeyCache.current.set(packed, key);
    }
    return key;
  }, []);

  // Track last camera tile position for early-return optimization
  const lastCameraTileRef = useRef({ tileX: -Infinity, tileZ: -Infinity });

  // Check if tile is within world bounds
  const isInBounds = useCallback(
    (tileX: number, tileZ: number) => {
      return tileX >= 0 && tileX < worldSize && tileZ >= 0 && tileZ < worldSize;
    },
    [worldSize],
  );

  // Get current camera tile position
  const getCameraTile = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return { tileX: 0, tileZ: 0 };

    const tileX = Math.floor(camera.position.x / tileSize);
    const tileZ = Math.floor(camera.position.z / tileSize);
    return { tileX, tileZ };
  }, [tileSize]);

  // Generate a single tile at a given resolution (full or low-res LOD)
  const generateTile = useCallback(
    (tileX: number, tileZ: number, resolution?: number) => {
      const scene = sceneRef.current;
      const querier = terrainQuerierRef.current;
      const fullTemplate = templateGeometryRef.current;
      const lowResTemplate = lowResTemplateGeometryRef.current;
      const terrainMaterial = terrainMaterialRef.current;
      const waterMaterial = waterMaterialRef.current;
      const terrainContainer = terrainContainerRef.current;
      const waterContainer = waterContainerRef.current;

      if (
        !scene ||
        !querier ||
        !fullTemplate ||
        !terrainMaterial ||
        !waterMaterial ||
        !terrainContainer ||
        !waterContainer
      )
        return;

      const key = getTileKey(tileX, tileZ);
      if (tilesRef.current.has(key)) return; // Already exists

      // Pick template based on requested resolution
      const useRes = resolution ?? tileResolution;
      const isLowRes = lowResTemplate && useRes <= TILE_LOD_LOW_RESOLUTION;
      const template = isLowRes ? lowResTemplate : fullTemplate;

      // Build town flatten zones with AABB rejection
      const wcOffset = (worldSize * tileSize) / 2;
      const flattenZones = buildTownFlattenZones(
        runtimeTownsRef.current,
        tileX,
        tileZ,
        tileSize,
        wcOffset,
        querier,
      );

      // Try to acquire a recycled geometry from the pool (avoids clone + GPU alloc)
      const templateVertexCount = template.attributes.position.count;
      const pooledGeom = acquirePooledGeometry(templateVertexCount);

      // Generate tile geometry with road influence + town flattening + mine influence
      const roadsForTile = providedRoadsRef.current;
      const minesForTile = runtimeMinesRef.current;
      const { geometry, hasWater } = generateTileGeometry(
        tileX,
        tileZ,
        template,
        querier,
        tileSize,
        waterThreshold,
        maxHeight,
        worldSize,
        roadsForTile,
        flattenZones,
        minesForTile,
        pooledGeom, // Reuse pooled geometry if available
      );

      // Re-apply any brush sculpt strokes so they persist across tile unload/reload
      const sculpts = brushOverlaysRef.current?.terrainSculpts;
      if (sculpts && sculpts.length > 0) {
        const halfTileOffset = tileSize / 2;
        applySculptStrokesToGeometry(
          geometry,
          tileX * tileSize + halfTileOffset,
          tileZ * tileSize + halfTileOffset,
          sculpts,
        );
      }

      // One-time diagnostic: check if road influence is being baked into regenerated tiles.
      // Log every 100th tile to track progress without flooding the console.
      const tileCount = tilesRef.current.size;
      if (
        roadsForTile &&
        roadsForTile.length > 0 &&
        (tileCount === 1 || tileCount === 50 || tileCount === 200)
      ) {
        const ri = geometry.attributes.roadInfluence;
        let maxRI = 0;
        let nonZeroCount = 0;
        if (ri) {
          for (let vi = 0; vi < ri.count; vi++) {
            const v = ri.getX(vi);
            if (v > maxRI) maxRI = v;
            if (v > 0) nonZeroCount++;
          }
        }
        console.log(
          `[generateTile] Tile(${tileX},${tileZ}) #${tileCount}: ${roadsForTile.length} roads, ` +
            `maxRI=${maxRI.toFixed(3)}, nonZeroVerts=${nonZeroCount}/${ri?.count ?? 0}, ` +
            `road0 pts=${roadsForTile[0]?.path?.length ?? "N/A"}`,
        );
      }

      // Mine influence diagnostic (mirrors road diagnostic above)
      if (
        minesForTile &&
        minesForTile.length > 0 &&
        (tileCount === 1 || tileCount === 50 || tileCount === 200)
      ) {
        const mi = geometry.attributes.mineInfluence;
        let maxMI = 0;
        let nonZeroMineVerts = 0;
        if (mi) {
          for (let vi = 0; vi < mi.count; vi++) {
            const v = mi.getX(vi);
            if (v > maxMI) maxMI = v;
            if (v > 0) nonZeroMineVerts++;
          }
        }
        console.log(
          `[generateTile] Tile(${tileX},${tileZ}) #${tileCount}: ${minesForTile.length} mines, ` +
            `maxMI=${maxMI.toFixed(3)}, nonZeroVerts=${nonZeroMineVerts}/${mi?.count ?? 0}`,
        );
      }

      // Create terrain mesh
      const mesh = new THREE.Mesh(geometry, terrainMaterial);
      const halfTileSizeOffset = tileSize / 2;
      mesh.position.set(
        tileX * tileSize + halfTileSizeOffset,
        0,
        tileZ * tileSize + halfTileSizeOffset,
      );
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      // Add tile metadata for raycasting
      mesh.userData = {
        tileX,
        tileZ,
        tileKey: key,
      };
      terrainContainer.add(mesh);

      // Create water mesh if needed — skip in studio mode (uses single world-sized water plane)
      let waterMesh: THREE.Mesh | null = null;
      if (hasWater && !isStudioModeRef.current) {
        const waterGeometry = waterTemplateGeometryRef.current
          ? waterTemplateGeometryRef.current.clone()
          : (() => {
              const g = new THREE.PlaneGeometry(tileSize, tileSize);
              g.rotateX(-Math.PI / 2);
              return g;
            })();
        waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
        waterMesh.position.set(
          tileX * tileSize + tileSize / 2,
          waterThreshold,
          tileZ * tileSize + tileSize / 2,
        );
        waterContainer.add(waterMesh);
      }

      // Store tile data with resolution for LOD upgrade/downgrade
      tilesRef.current.set(key, {
        mesh,
        water: waterMesh,
        tileX,
        tileZ,
        lastAccessed: performance.now(),
        resolution: useRes,
      });

      // Notify heatmap manager of new tile
      heatmapManagerRef.current?.onTileLoaded(tileX, tileZ);

      // Schedule foliage generation for this tile
      if (terrainQuerierRef.current && foliageManagerRef.current) {
        foliageManagerRef.current.scheduleTile({
          tileX,
          tileZ,
          tileSize,
          worldSeed: configSeedRef.current,
          querier: terrainQuerierRef.current,
          waterThreshold,
          foliagePaints: brushOverlaysRef.current?.foliagePaints,
        });
      }

      // Add grass for this tile (EditorGrassManager)
      if (standaloneGrassRef.current) {
        const halfTile = tileSize / 2;
        standaloneGrassRef.current.addTile(
          tileX * tileSize + halfTile,
          tileZ * tileSize + halfTile,
          tileSize,
        );
      }

      setLoadedTiles(tilesRef.current.size);
    },
    [
      getTileKey,
      tileSize,
      tileResolution,
      waterThreshold,
      maxHeight,
      worldSize,
    ],
  );

  // Unload a tile — remove from scene and queue geometry for deferred disposal.
  // Tile geometries share the terrain material (terrainMaterialRef) so we must
  // NOT dispose the material — only the per-tile geometry buffers.
  const unloadTile = useCallback(
    (key: string) => {
      const tileData = tilesRef.current.get(key);
      if (!tileData) return;

      const terrainContainer = terrainContainerRef.current;
      const waterContainer = waterContainerRef.current;

      // Remove terrain mesh from scene. Pool the geometry for reuse instead of
      // disposing — eliminates GPU buffer alloc/dealloc churn during camera pan.
      // The mesh itself is disposed (cheap — it's just a JS object referencing
      // the pooled geometry), but the geometry's GPU buffers stay alive in pool.
      if (terrainContainer) {
        terrainContainer.remove(tileData.mesh);
      }
      // Pool the geometry; dispose only the mesh shell (material is shared)
      releaseToGeomPool(tileData.mesh.geometry);
      tileData.mesh.geometry = null!; // Prevent resourceManager from disposing it

      // Remove water mesh
      if (tileData.water && waterContainer) {
        waterContainer.remove(tileData.water);
        resourceManager.queueDisposal(tileData.water, true);
      }

      // Notify heatmap manager
      heatmapManagerRef.current?.onTileUnloaded(tileData.tileX, tileData.tileZ);

      // Unload foliage for this tile
      foliageManagerRef.current?.unloadTile(tileData.tileX, tileData.tileZ);

      // Remove grass for this tile (EditorGrassManager)
      if (standaloneGrassRef.current) {
        const halfTile = tileSize / 2;
        standaloneGrassRef.current.removeTile(
          tileData.tileX * tileSize + halfTile,
          tileData.tileZ * tileSize + halfTile,
        );
      }

      tilesRef.current.delete(key);
      setLoadedTiles(tilesRef.current.size);
    },
    [tileSize],
  );

  // Swap a tile's geometry to a target resolution in-place — mesh stays in
  // scene the whole time (no flash). Used for both LOD upgrades/downgrades
  // and dirty-tile regeneration (regenerateTileInPlace delegates here).
  //
  // When the target resolution matches the tile's current resolution (dirty
  // regen), passes the existing geometry for IN-PLACE attribute updates —
  // no new GPU buffers are created, eliminating Metal staging buffer churn
  // and allocation/dispose overhead.
  const swapTileResolution = useCallback(
    (key: string, targetResolution: number) => {
      const tile = tilesRef.current.get(key);
      if (!tile) return;

      const querier = terrainQuerierRef.current;
      const fullTemplate = templateGeometryRef.current;
      const lowResTemplate = lowResTemplateGeometryRef.current;
      const waterContainer = waterContainerRef.current;

      if (!querier || !fullTemplate) return;

      const isLowRes =
        lowResTemplate && targetResolution <= TILE_LOD_LOW_RESOLUTION;
      const template = isLowRes ? lowResTemplate : fullTemplate;

      // Reuse existing geometry for dirty regen (same resolution) — avoids
      // creating new GPU buffers. Only create new geometry for LOD swaps
      // where vertex count changes.
      const sameResolution = tile.resolution === targetResolution;
      const reuseGeometry = sameResolution ? tile.mesh.geometry : undefined;

      const roadsForTile = providedRoadsRef.current;
      const minesForTile = runtimeMinesRef.current;
      const wcOffset = (worldSize * tileSize) / 2;
      const flattenZones = buildTownFlattenZones(
        runtimeTownsRef.current,
        tile.tileX,
        tile.tileZ,
        tileSize,
        wcOffset,
        querier,
      );

      const { geometry, hasWater } = generateTileGeometry(
        tile.tileX,
        tile.tileZ,
        template,
        querier,
        tileSize,
        waterThreshold,
        maxHeight,
        worldSize,
        roadsForTile,
        flattenZones,
        minesForTile,
        reuseGeometry,
      );

      // Apply brush strokes
      const sculpts = brushOverlaysRef.current?.terrainSculpts;
      if (sculpts && sculpts.length > 0) {
        const halfTileOffset = tileSize / 2;
        applySculptStrokesToGeometry(
          geometry,
          tile.tileX * tileSize + halfTileOffset,
          tile.tileZ * tileSize + halfTileOffset,
          sculpts,
        );
      }

      // Only swap geometry when a NEW geometry was created (LOD change).
      // For in-place updates, the mesh already references the updated geometry.
      if (!sameResolution) {
        const oldGeometry = tile.mesh.geometry;
        tile.mesh.geometry = geometry;
        // Pool old geometry for reuse instead of disposing
        releaseToGeomPool(oldGeometry);
      }

      // Update per-tile water — skip in studio mode (uses single world-sized water plane)
      if (!isStudioModeRef.current) {
        if (tile.water && waterContainer) {
          if (!hasWater) {
            waterContainer.remove(tile.water);
            tile.water.geometry.dispose();
            tile.water = null;
          } else {
            tile.water.position.y = waterThreshold;
          }
        } else if (hasWater && waterContainer) {
          const waterGeometry = waterTemplateGeometryRef.current
            ? waterTemplateGeometryRef.current.clone()
            : (() => {
                const g = new THREE.PlaneGeometry(tileSize, tileSize);
                g.rotateX(-Math.PI / 2);
                return g;
              })();
          const waterMat = waterMaterialRef.current;
          if (waterMat) {
            const wm = new THREE.Mesh(waterGeometry, waterMat);
            wm.position.set(
              tile.tileX * tileSize + tileSize / 2,
              waterThreshold,
              tile.tileZ * tileSize + tileSize / 2,
            );
            waterContainer.add(wm);
            tile.water = wm;
          }
        }
      }

      tile.resolution = targetResolution;
    },
    [tileSize, tileResolution, waterThreshold, maxHeight, worldSize],
  );

  // Regenerate a tile's geometry in-place (incremental update without unload/reload).
  // Used by dirty-tile processing when terrain config changes.
  // Delegates to swapTileResolution at the tile's current resolution.
  const regenerateTileInPlace = useCallback(
    (key: string) => {
      const tile = tilesRef.current.get(key);
      if (!tile) return;
      swapTileResolution(key, tile.resolution);
      tile.dirty = false;
    },
    [swapTileResolution],
  );

  // Pre-allocated arrays for tile update loop — reused every frame to avoid GC pressure.
  // Reset via .length = 0 instead of allocating new arrays.
  const _newEntriesPool = useRef<
    Array<{
      tileX: number;
      tileZ: number;
      resolution: number;
      distance: number;
    }>
  >([]);
  const _remainingPool = useRef<typeof tileQueueRef.current>([]);

  // Update tiles based on camera position with two-tier LOD:
  //   - Near tiles (within fullDetailRadius): full resolution geometry
  //   - Far tiles (beyond that, up to dynamic farRadius): low-res LOD geometry
  //   - In World Studio mode: tiles are NEVER evicted (full map always visible).
  //     LOD upgrades/downgrades use in-place geometry swap (no flash).
  const updateTiles = useCallback(
    (frameTime: number) => {
      const camera = cameraRef.current;
      if (!camera) return;
      const { tileX: cameraTileX, tileZ: cameraTileZ } = getCameraTile();

      // Phase 2A: Skip full tile scan when camera tile hasn't changed.
      // Still process the tile queue, dirty tiles, and LOD queues even when stationary.
      const cameraTileChanged =
        cameraTileX !== lastCameraTileRef.current.tileX ||
        cameraTileZ !== lastCameraTileRef.current.tileZ;

      if (cameraTileChanged) {
        lastCameraTileRef.current.tileX = cameraTileX;
        lastCameraTileRef.current.tileZ = cameraTileZ;

        const isStudio = isStudioModeRef.current;

        // Full-detail vs far-LOD radii are altitude-driven; both
        // live in `hooks/tileStreamingRadius.ts` so the math stays
        // testable. Full-detail scales DOWN with altitude (less
        // close-detail when zoomed out); far-LOD scales UP (more
        // visible horizon when zoomed out).
        const fullDetailRadius = getFullDetailRadius(
          camera.position.y,
          isStudio,
        );
        const farRadius = getDynamicLoadRadius(camera.position.y, isStudio);

        // In World Studio mode, tiles are never evicted — the full map fits in memory.
        // In standalone mode, evict tiles beyond farRadius + 2.
        const unloadRadius = isStudio ? Infinity : farRadius + 2;

        // Reuse pooled array to avoid per-frame allocation (Phase 2A GC reduction)
        const newEntries = _newEntriesPool.current;
        newEntries.length = 0;

        // Queue tiles to load across the full dynamic radius
        for (let dx = -farRadius; dx <= farRadius; dx++) {
          for (let dz = -farRadius; dz <= farRadius; dz++) {
            const tileX = cameraTileX + dx;
            const tileZ = cameraTileZ + dz;

            if (!isInBounds(tileX, tileZ)) continue;

            const key = getTileKey(tileX, tileZ);
            const dist = Math.max(Math.abs(dx), Math.abs(dz)); // Chebyshev distance
            const wantFullRes = dist <= fullDetailRadius;
            const wantRes = wantFullRes
              ? tileResolution
              : TILE_LOD_LOW_RESOLUTION;

            const existing = tilesRef.current.get(key);
            if (existing) {
              // Phase 2C: Use cached frame timestamp instead of per-tile performance.now()
              existing.lastAccessed = frameTime;
              // LOD upgrade: tile is low-res but camera moved close enough for full detail.
              // In studio mode, use in-place geometry swap (no flash). In standalone, unload+regen.
              if (
                wantFullRes &&
                existing.resolution <= TILE_LOD_LOW_RESOLUTION
              ) {
                if (isStudio) {
                  // Queue in-place LOD upgrade — mesh stays in scene (no flash)
                  if (!lodUpgradeQueueSetRef.current.has(key)) {
                    lodUpgradeQueueSetRef.current.add(key);
                    lodUpgradeQueueRef.current.push({
                      key,
                      tileX: existing.tileX,
                      tileZ: existing.tileZ,
                    });
                  }
                  continue;
                } else {
                  unloadTile(key);
                  // Falls through to queue for full-res generation
                }
              } else if (
                isStudio &&
                !wantFullRes &&
                existing.resolution > TILE_LOD_LOW_RESOLUTION
              ) {
                // LOD downgrade: camera moved away from a full-res tile.
                // Queue in-place downgrade to reclaim GPU memory.
                if (!lodDowngradeQueueSetRef.current.has(key)) {
                  lodDowngradeQueueSetRef.current.add(key);
                  lodDowngradeQueueRef.current.push({
                    key,
                    tileX: existing.tileX,
                    tileZ: existing.tileZ,
                  });
                }
                continue;
              } else {
                continue;
              }
            }

            if (!tileQueueSetRef.current.has(key)) {
              tileQueueSetRef.current.add(key);
              const distance = Math.abs(dx) + Math.abs(dz);
              newEntries.push({ tileX, tileZ, resolution: wantRes, distance });
            }
          }
        }

        // Sort new entries by distance and append to queue (avoids O(n) findIndex+splice per entry)
        if (newEntries.length > 0) {
          newEntries.sort((a, b) => a.distance - b.distance);
          for (const entry of newEntries) {
            tileQueueRef.current.push(entry);
          }
        }

        // Eviction check: only in non-studio mode (studio never evicts)
        if (!isStudio) {
          for (const [key, tile] of tilesRef.current) {
            const dx = Math.abs(tile.tileX - cameraTileX);
            const dz = Math.abs(tile.tileZ - cameraTileZ);

            if (dx > unloadRadius || dz > unloadRadius) {
              if (frameTime - tile.lastAccessed > 1000) {
                unloadTile(key);
              }
            }
          }
        }
      }

      // When the scene staging queue is draining (buildings/vegetation being added),
      // reduce tile generation budget but DON'T pause entirely. Low-res tiles are
      // tiny (8×8 = 64 vertices) — a few per frame combined with staging is fine.
      // Full-res tiles (32×32 = 1024 vertices) are paused during staging.
      const hasStagedWork = resourceManager.hasStagedWork;
      // Initial-load fast path — viewport is hidden, so we can spend
      // much more time per frame meshing without affecting interactive
      // FPS. Drops to MAX_TILES_PER_FRAME (2) once the overlay clears.
      const duringInitialLoad = !initialLoadCompleteRef.current;
      const fullResBudget = duringInitialLoad
        ? MAX_TILES_PER_FRAME_INITIAL_LOAD
        : MAX_TILES_PER_FRAME;
      const maxFullThisFrame = hasStagedWork ? 0 : fullResBudget;

      // Low-res tiles use a time-based budget. During initial load (loading
      // overlay visible), spend up to 32ms/frame since the viewport is hidden —
      // fills the map 4× faster. After initial load, cap at 8ms for 60fps.
      const LOW_RES_TIME_BUDGET_MS = duringInitialLoad ? 32 : 8;
      const lowResDeadline = frameTime + LOW_RES_TIME_BUDGET_MS;

      // Process tile queue with separate budgets for full-res and low-res
      let fullResGen = 0;
      let lowResGen = 0;
      const lowResCountLimit = duringInitialLoad
        ? MAX_LOW_RES_TILES_PER_FRAME * 4
        : MAX_LOW_RES_TILES_PER_FRAME;
      // Swap pooled array with queue to avoid per-frame allocation (Phase 2A).
      // CRITICAL: after `tileQueueRef.current = remaining`, the pool and queue
      // would alias the same array. Swap refs so clearing the pool next frame
      // doesn't wipe the queue.
      const remaining = _remainingPool.current;
      _remainingPool.current = tileQueueRef.current; // old queue becomes next frame's pool
      remaining.length = 0;

      for (const entry of tileQueueRef.current) {
        const isFullRes = entry.resolution > TILE_LOD_LOW_RESOLUTION;

        if (isFullRes && fullResGen >= maxFullThisFrame) {
          remaining.push(entry);
          continue;
        }
        if (
          !isFullRes &&
          lowResGen >= lowResCountLimit &&
          performance.now() >= lowResDeadline
        ) {
          remaining.push(entry);
          continue;
        }

        const qKey = getTileKey(entry.tileX, entry.tileZ);
        tileQueueSetRef.current.delete(qKey);
        if (
          isInBounds(entry.tileX, entry.tileZ) &&
          !tilesRef.current.has(qKey)
        ) {
          generateTile(entry.tileX, entry.tileZ, entry.resolution);
          if (isFullRes) fullResGen++;
          else lowResGen++;
        }
      }
      tileQueueRef.current = remaining;

      // Process LOD upgrade queue — swap low-res geometry to full-res in-place (no flash).
      // Budget: MAX_TILES_PER_FRAME per frame (same as new tile generation).
      let lodUpgraded = 0;
      const lodUpgradeBudget = hasStagedWork ? 0 : MAX_TILES_PER_FRAME;
      while (
        lodUpgradeQueueRef.current.length > 0 &&
        lodUpgraded < lodUpgradeBudget
      ) {
        const entry = lodUpgradeQueueRef.current.shift()!;
        lodUpgradeQueueSetRef.current.delete(entry.key);
        const tile = tilesRef.current.get(entry.key);
        if (tile && tile.resolution <= TILE_LOD_LOW_RESOLUTION) {
          swapTileResolution(entry.key, tileResolution);
          // Add grass for newly upgraded tile
          if (standaloneGrassRef.current) {
            const halfTile = tileSize / 2;
            standaloneGrassRef.current.addTile(
              tile.tileX * tileSize + halfTile,
              tile.tileZ * tileSize + halfTile,
              tileSize,
            );
          }
          lodUpgraded++;
        }
      }

      // Process LOD downgrade queue — swap distant full-res to low-res (1 per frame, low priority).
      if (
        lodDowngradeQueueRef.current.length > 0 &&
        lodUpgraded === 0 &&
        !hasStagedWork
      ) {
        const entry = lodDowngradeQueueRef.current.shift()!;
        lodDowngradeQueueSetRef.current.delete(entry.key);
        const tile = tilesRef.current.get(entry.key);
        if (tile && tile.resolution > TILE_LOD_LOW_RESOLUTION) {
          swapTileResolution(entry.key, TILE_LOD_LOW_RESOLUTION);
        }
      }

      // Process dirty tiles progressively — regenerate geometry in-place without
      // unloading. Uses a time-based budget (12ms) instead of a fixed count so
      // that slider changes (noise, biomes, waterThreshold) regenerate 12-24×
      // faster. Each 32×32 tile takes ~0.5-1ms to regenerate. In-place attribute
      // updates (no new GPU buffers) make this safe even at higher budgets.
      // During staged work (buildings/vegetation being added), cap at 1 tile.
      {
        const DIRTY_TIME_BUDGET_MS = 12;
        const dirtyDeadline = performance.now() + DIRTY_TIME_BUDGET_MS;
        let dirtyProcessed = 0;
        while (dirtyTileKeysRef.current.length > 0) {
          if (hasStagedWork && dirtyProcessed >= 1) break;
          if (dirtyProcessed > 0 && performance.now() >= dirtyDeadline) break;
          const dirtyKey = dirtyTileKeysRef.current.shift()!;
          const dirtyTile = tilesRef.current.get(dirtyKey);
          if (dirtyTile?.dirty) {
            regenerateTileInPlace(dirtyKey);
            dirtyProcessed++;
          }
        }
      }

      // Update generating state — only call setState when the value actually changes
      // to avoid triggering React reconciliation on every animation frame.
      const isStillGenerating =
        tileQueueRef.current.length > 0 ||
        dirtyTileKeysRef.current.length > 0 ||
        lodUpgradeQueueRef.current.length > 0;
      if (isGeneratingRef.current !== isStillGenerating) {
        isGeneratingRef.current = isStillGenerating;
        setIsGenerating(isStillGenerating);
      }
    },
    [
      getCameraTile,
      isInBounds,
      getTileKey,
      generateTile,
      unloadTile,
      tileResolution,
      regenerateTileInPlace,
      swapTileResolution,
    ],
  );

  // Handle viewport click for selection
  const handleClick = useCallback(
    (event: MouseEvent) => {
      const container = containerRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;

      if (!container || !camera || !scene) return;

      // During RMB fly mode, ignore LMB clicks for selection
      if (rmbFlyActiveRef.current) return;

      // Selection mode: perform raycast to find what was clicked
      mouseEventToNdc(event, container, mouseRef.current);

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Check for intersections with selectable objects (towns, buildings) first
      const selectableIntersects = raycasterRef.current.intersectObjects(
        selectableObjectsRef.current,
        true,
      );

      if (selectableIntersects.length > 0) {
        const hit = selectableIntersects[0];
        const object = hit.object;
        // Walk up parent chain to find userData with selectable info
        // (ray may hit a child mesh inside a group)
        let current: THREE.Object3D | null = object;
        let userData: Record<string, unknown> | null = null;
        while (current) {
          const ud = current.userData as Record<string, unknown>;
          if (ud.selectable && ud.selectableType && ud.selectableId) {
            userData = ud;
            break;
          }
          current = current.parent;
        }

        if (userData) {
          const selection: ViewportSelection = {
            type: userData.selectableType as ViewportSelection["type"],
            id: userData.selectableId as string,
            position: {
              x: hit.point.x,
              y: hit.point.y,
              z: hit.point.z,
            },
            townId: userData.townId as string | undefined,
            townName: userData.townName as string | undefined,
            buildingType: userData.buildingType as string | undefined,
            biomeType: userData.biomeType as string | undefined,
            entityType: userData.entityType as string | undefined,
            entityId: userData.entityId as string | undefined,
            entityDisplayName: userData.displayName as string | undefined,
            entityData: userData as Record<string, unknown>,
          };

          onSelect?.(selection);
          return;
        }
      }

      // Check vegetation instances (InstancedMesh per-instance selection)
      const vegContainer = vegetationContainerRef.current;
      if (vegContainer && vegContainer.visible) {
        const vegChildren: THREE.InstancedMesh[] = [];
        vegContainer.traverse((child) => {
          if (child instanceof THREE.InstancedMesh) {
            vegChildren.push(child);
          }
        });
        if (vegChildren.length > 0) {
          const vegIntersects = raycasterRef.current.intersectObjects(
            vegChildren,
            false,
          );
          if (vegIntersects.length > 0) {
            const hit = vegIntersects[0];
            const im = hit.object as THREE.InstancedMesh;
            const instanceId = hit.instanceId;
            const speciesId = vegetationSpeciesMapRef.current.get(im);
            if (instanceId !== undefined && speciesId) {
              // Extract the instance position from the instance matrix
              // (uses module-scope pre-allocated objects — avoids per-click GC)
              const instanceMatrix = _clickMatrix;
              im.getMatrixAt(instanceId, instanceMatrix);
              const instancePos = _clickPos;
              instanceMatrix.decompose(instancePos, _clickQuat, _clickScale);
              onSelect?.({
                type: "vegetation",
                id: `${speciesId}_${instanceId}`,
                position: {
                  x: instancePos.x,
                  y: instancePos.y,
                  z: instancePos.z,
                },
                vegetationSpecies: speciesId,
                vegetationInstanceIndex: instanceId,
              });
              return;
            }
          }
        }
      }

      // Check if we hit terrain
      const terrainContainer = terrainContainerRef.current;
      if (terrainContainer) {
        const terrainIntersects = raycasterRef.current.intersectObject(
          terrainContainer,
          true,
        );

        if (terrainIntersects.length > 0) {
          const hit = terrainIntersects[0];
          const mesh = hit.object as THREE.Mesh;
          const tileData = mesh.userData as {
            tileX?: number;
            tileZ?: number;
          };

          if (tileData.tileX !== undefined && tileData.tileZ !== undefined) {
            // Query terrain at this point for detailed info
            const generator = generatorRef.current;
            const worldCenterOffset = (worldSize * tileSize) / 2;
            const worldX = hit.point.x - worldCenterOffset;
            const worldZ = hit.point.z - worldCenterOffset;

            // Get chunk coordinates (10x10 tiles per chunk)
            const chunkX = Math.floor(tileData.tileX / 10);
            const chunkZ = Math.floor(tileData.tileZ / 10);

            let biomeType = "unknown";
            let terrainHeight = hit.point.y;
            let slope = 0;
            let walkable = true;

            // Query terrain info — use procgen generator or game querier
            const clickQuerier = terrainQuerierRef.current;
            if (generator && !config.useGamePipeline) {
              const query = generator.queryPoint(worldX, worldZ);
              biomeType = query.biome;
              terrainHeight = query.height;
              slope = query.normal ? 1 - Math.abs(query.normal.y) : 0;
            } else if (clickQuerier) {
              const query = clickQuerier(worldX, worldZ);
              biomeType = query.biome;
              terrainHeight = query.height;
              // Finite-difference slope for game pipeline
              const sd = 1.0;
              const hn = clickQuerier(worldX, worldZ + sd).height;
              const hs = clickQuerier(worldX, worldZ - sd).height;
              const he = clickQuerier(worldX + sd, worldZ).height;
              const hw = clickQuerier(worldX - sd, worldZ).height;
              const dzdx = (he - hw) / (2 * sd);
              const dzdy = (hn - hs) / (2 * sd);
              slope =
                Math.sqrt(dzdx * dzdx + dzdy * dzdy) /
                (1 + Math.sqrt(dzdx * dzdx + dzdy * dzdy));
            }

            {
              // Walkable if not too steep and not underwater
              const terrainWalkable =
                slope < 0.7 && terrainHeight > waterThreshold;

              // Check building walkability (unified with game's BuildingCollisionService logic)
              const buildingCheck = buildingWalkabilityService.checkWalkability(
                worldX,
                worldZ,
                terrainWalkable,
              );
              walkable = buildingCheck.walkable;

              if (buildingCheck.inBuilding) {
                const floorHeight = buildingWalkabilityService.getFloorHeight(
                  worldX,
                  worldZ,
                );
                if (floorHeight !== null) {
                  terrainHeight = floorHeight;
                }
              }
            }

            // Check if in a town (approximate - check against generated towns)
            let inTown = false;
            let townIdForTile: string | undefined;
            const townMarkersGroup = townMarkersRef.current;
            if (townMarkersGroup) {
              townMarkersGroup.traverse((child) => {
                if (child.userData.selectableType === "town") {
                  const townPos = child.position;
                  const dist = Math.sqrt(
                    Math.pow(hit.point.x - townPos.x, 2) +
                      Math.pow(hit.point.z - townPos.z, 2),
                  );
                  // Approximate town radius
                  if (dist < 150) {
                    inTown = true;
                    townIdForTile = child.userData.selectableId;
                  }
                }
              });
            }

            // Check wilderness (northern portion of map)
            // Wilderness starts at WILDERNESS_START_PERCENT (0.7 = 70% from south = northern 30%)
            // In world coordinates, Z increases going north, so wilderness is when Z > 70% of world size
            const worldSizeMeters = worldSize * tileSize;
            const wildernessThreshold =
              worldSizeMeters * WILDERNESS_START_PERCENT;
            const inWilderness = hit.point.z > wildernessThreshold;

            // Calculate difficulty based on distance from center (starter area)
            const distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
            const maxDist = (worldSize * tileSize) / 2;
            const difficultyLevel = Math.min(
              4,
              Math.floor((distFromCenter / maxDist) * 5),
            );

            const selection: ViewportSelection = {
              type: "tile",
              id: `tile_${tileData.tileX}_${tileData.tileZ}`,
              position: {
                x: hit.point.x,
                y: hit.point.y,
                z: hit.point.z,
              },
              biomeType,
              tileKey: `${tileData.tileX},${tileData.tileZ}`,
              tileData: {
                tileX: tileData.tileX,
                tileZ: tileData.tileZ,
                chunkX,
                chunkZ,
                worldX,
                worldZ,
                height: terrainHeight,
                biome: biomeType,
                slope,
                walkable,
                inTown,
                townId: townIdForTile,
                inWilderness,
                difficultyLevel,
              },
            };

            onSelect?.(selection);
            return;
          }
        }
      }

      // Click on empty space (sky/water) - deselect
      onSelect?.(null);
    },
    [onSelect, worldSize, tileSize, waterThreshold],
  );

  // ---- Stable refs for the mount-once scene effect ----
  // These allow the effect to always call the latest callback / read the
  // latest config without the callbacks themselves being in the dep array,
  // which previously caused the entire WebGPU scene to tear down on every
  // slider change or re-render.
  const terrainConfigRef = useRef(terrainConfig);
  terrainConfigRef.current = terrainConfig;
  const useGamePipelineRef = useRef(config.useGamePipeline);
  useGamePipelineRef.current = config.useGamePipeline;
  // Bug #3 — Hyperia-content gate. When the project doesn't
  // target Hyperia (plugins[] doesn't include
  // @hyperforge/hyperscape) we MUST NOT load Hyperia bridges /
  // duel arena / manifest entities, even if a legacy worldData
  // shipped with `useGamePipeline: true`. `projectTargetsHyperia`
  // explicitly says "this project wants Hyperia content";
  // legacy callers that don't pass the prop default to the
  // pre-fix behavior (config.useGamePipeline alone).
  const hyperiaContentEnabledRef = useRef(false);
  hyperiaContentEnabledRef.current =
    projectTargetsHyperia === undefined
      ? !!config.useGamePipeline
      : projectTargetsHyperia && !!config.useGamePipeline;
  const showVegetationRef = useRef(showVegetation);
  showVegetationRef.current = showVegetation;
  const waterThresholdRef = useRef(waterThreshold);
  waterThresholdRef.current = waterThreshold;

  const handleMouseMoveRef = useRef(handleMouseMove);
  handleMouseMoveRef.current = handleMouseMove;
  const handleKeyDownRef = useRef(handleKeyDown);
  handleKeyDownRef.current = handleKeyDown;
  const handleKeyUpRef = useRef(handleKeyUp);
  handleKeyUpRef.current = handleKeyUp;
  const handleMouseDownRef = useRef(handleMouseDown);
  handleMouseDownRef.current = handleMouseDown;
  const handleMouseUpRef = useRef(handleMouseUp);
  handleMouseUpRef.current = handleMouseUp;
  const handleWheelRef = useRef(handleWheel);
  handleWheelRef.current = handleWheel;
  const handleContextMenuRef = useRef(handleContextMenu);
  handleContextMenuRef.current = handleContextMenu;
  const handlePointerLockChangeRef = useRef(handlePointerLockChange);
  handlePointerLockChangeRef.current = handlePointerLockChange;
  const handleClickRef = useRef(handleClick);
  handleClickRef.current = handleClick;
  const updateCameraRef = useRef(updateCamera);
  updateCameraRef.current = updateCamera;
  const updateTilesRef = useRef(updateTiles);
  updateTilesRef.current = updateTiles;
  const generateTileRef = useRef(generateTile);
  generateTileRef.current = generateTile;
  const brushOverlaysRef = useRef(brushOverlays);
  brushOverlaysRef.current = brushOverlays;

  // Initialize Three.js scene with WebGPU
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;

    // Stable event handler wrappers — delegate to latest callback via refs.
    // This lets the effect run once (mount) without re-attaching listeners
    // when handlers change due to config/state updates.
    const _onMouseMove = (e: MouseEvent) => handleMouseMoveRef.current(e);
    const _onKeyDown = (e: KeyboardEvent) => handleKeyDownRef.current(e);
    const _onKeyUp = (e: KeyboardEvent) => handleKeyUpRef.current(e);
    const _onMouseDown = (e: MouseEvent) => handleMouseDownRef.current(e);
    const _onMouseUp = (e: MouseEvent) => handleMouseUpRef.current(e);
    const _onWheel = (e: WheelEvent) => handleWheelRef.current(e);
    const _onContextMenu = (e: MouseEvent) => handleContextMenuRef.current(e);
    const _onPointerLockChange = () => handlePointerLockChangeRef.current();
    const _onClick = (e: MouseEvent) => handleClickRef.current(e);

    // Scene (create before async renderer init)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(FOG_COLORS.DAY);
    scene.fog = new THREE.Fog(FOG_COLORS.DAY, 400, 800); // Game-parity fog distances
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      1,
      10000,
    );
    // Start camera at center of world, looking down at an angle
    const worldCenter = (worldSize * tileSize) / 2;
    camera.position.set(worldCenter, 400, worldCenter + 300);
    cameraStateRef.current.position.copy(camera.position);
    cameraRef.current = camera;

    // Orbit controls — immediate mouse interaction (rotate, pan, zoom)
    const orbitTarget = new THREE.Vector3(worldCenter, 0, worldCenter);
    initOrbitControls(camera, container, orbitTarget);

    // Containers for terrain, water, and town markers
    const terrainContainer = new THREE.Group();
    scene.add(terrainContainer);
    terrainContainerRef.current = terrainContainer;

    const waterContainer = new THREE.Group();
    scene.add(waterContainer);
    waterContainerRef.current = waterContainer;

    // Single world-sized water plane — replaces per-tile water meshes.
    // One draw call instead of potentially hundreds.
    // Phase 8.2: Use Gerstner wave material for visual parity with game.
    if (isStudioModeRef.current) {
      const worldSizeMeters = worldSize * tileSize;
      const wg = new THREE.PlaneGeometry(
        worldSizeMeters,
        worldSizeMeters,
        128,
        128,
      );
      wg.rotateX(-Math.PI / 2);
      const {
        material: wMat,
        uniforms: wUniforms,
        textures: wTextures,
      } = createEditorWaterMaterial();
      waterUniformsRef.current = wUniforms;
      waterTexturesRef.current = wTextures;
      const worldWater = new THREE.Mesh(wg, wMat);
      worldWater.position.set(
        worldSizeMeters / 2,
        waterThreshold,
        worldSizeMeters / 2,
      );
      waterContainer.add(worldWater);
    }

    const townMarkers = new THREE.Group();
    scene.add(townMarkers);
    townMarkersRef.current = townMarkers;
    townRendererRef.current = new TownRenderer(townMarkers, resourceManager);

    const vegetationContainer = new THREE.Group();
    vegetationContainer.visible = showVegetationRef.current;
    scene.add(vegetationContainer);
    vegetationContainerRef.current = vegetationContainer;

    // Foliage container (grass, flowers, rocks — separate from tree vegetation)
    const foliageContainer = new THREE.Group();
    foliageContainer.name = "foliage";
    scene.add(foliageContainer);
    foliageContainerRef.current = foliageContainer;
    foliageManagerRef.current = new FoliageManager(foliageContainer);

    // Wilderness zone visual (PVP area in north) - border band + floating skull
    const wildernessStartPercent = 0.3; // Start at 30% from center (north direction)
    const worldSizeForWilderness = worldSize * tileSize;
    const worldCenterForWilderness = worldSizeForWilderness / 2;
    const wildernessBoundaryZ =
      worldCenterForWilderness -
      worldSizeForWilderness * wildernessStartPercent;
    const wildernessDepth = wildernessBoundaryZ; // From boundary to north edge (z=0)
    const wildernessWidth = worldSizeForWilderness;

    // Create wilderness border group
    const wildernessGroup = new THREE.Group();
    const borderHeight = 8.0; // Height of border walls
    const borderColor = 0xff0000; // Bright red

    // Border wall material (very transparent to not block grass)
    const borderWallMaterial = new MeshBasicNodeMaterial();
    borderWallMaterial.color = new THREE.Color(borderColor);
    borderWallMaterial.transparent = true;
    borderWallMaterial.opacity = 0.15;
    borderWallMaterial.side = THREE.DoubleSide;
    borderWallMaterial.depthWrite = false;

    // South wall (the main boundary line players cross)
    const southWallGeom = new THREE.PlaneGeometry(
      wildernessWidth,
      borderHeight,
    );
    const southWall = new THREE.Mesh(southWallGeom, borderWallMaterial);
    southWall.position.set(0, borderHeight / 2, wildernessDepth / 2);
    southWall.rotation.y = Math.PI;
    wildernessGroup.add(southWall);

    // East wall
    const eastWallGeom = new THREE.PlaneGeometry(wildernessDepth, borderHeight);
    const eastWall = new THREE.Mesh(eastWallGeom, borderWallMaterial);
    eastWall.position.set(wildernessWidth / 2, borderHeight / 2, 0);
    eastWall.rotation.y = -Math.PI / 2;
    wildernessGroup.add(eastWall);

    // West wall
    const westWallGeom = new THREE.PlaneGeometry(wildernessDepth, borderHeight);
    const westWall = new THREE.Mesh(westWallGeom, borderWallMaterial);
    westWall.position.set(-wildernessWidth / 2, borderHeight / 2, 0);
    westWall.rotation.y = Math.PI / 2;
    wildernessGroup.add(westWall);

    // North wall (at z=0, edge of world)
    const northWallGeom = new THREE.PlaneGeometry(
      wildernessWidth,
      borderHeight,
    );
    const northWall = new THREE.Mesh(northWallGeom, borderWallMaterial);
    northWall.position.set(0, borderHeight / 2, -wildernessDepth / 2);
    wildernessGroup.add(northWall);

    // Border edge lines
    const lineMaterial = new LineBasicNodeMaterial();
    lineMaterial.color = new THREE.Color(borderColor);

    // Top edge outline
    const topEdgePoints = [
      new THREE.Vector3(
        -wildernessWidth / 2,
        borderHeight,
        -wildernessDepth / 2,
      ),
      new THREE.Vector3(
        wildernessWidth / 2,
        borderHeight,
        -wildernessDepth / 2,
      ),
      new THREE.Vector3(wildernessWidth / 2, borderHeight, wildernessDepth / 2),
      new THREE.Vector3(
        -wildernessWidth / 2,
        borderHeight,
        wildernessDepth / 2,
      ),
      new THREE.Vector3(
        -wildernessWidth / 2,
        borderHeight,
        -wildernessDepth / 2,
      ),
    ];
    const topEdgeGeom = new THREE.BufferGeometry().setFromPoints(topEdgePoints);
    const topEdgeLine = new THREE.Line(topEdgeGeom, lineMaterial);
    wildernessGroup.add(topEdgeLine);

    // Position wilderness group at center (lifted 10m above terrain)
    wildernessGroup.position.set(
      worldCenterForWilderness,
      12,
      wildernessDepth / 2,
    );
    scene.add(wildernessGroup);

    // Create floating skull sprite
    const skullCanvas = document.createElement("canvas");
    const skullSize = 256;
    skullCanvas.width = skullSize;
    skullCanvas.height = skullSize;
    const skullCtx = skullCanvas.getContext("2d");
    if (skullCtx) {
      skullCtx.clearRect(0, 0, skullSize, skullSize);
      skullCtx.font = `${skullSize * 0.8}px serif`;
      skullCtx.textAlign = "center";
      skullCtx.textBaseline = "middle";
      skullCtx.fillText("💀", skullSize / 2, skullSize / 2);
      // Add glow
      skullCtx.shadowColor = "rgba(255, 0, 0, 0.8)";
      skullCtx.shadowBlur = 20;
      skullCtx.fillText("💀", skullSize / 2, skullSize / 2);
    }
    const skullTexture = new THREE.CanvasTexture(skullCanvas);

    const skullMaterial = new THREE.SpriteMaterial({
      map: skullTexture,
      transparent: true,
      depthWrite: false,
    });
    const skullSprite = new THREE.Sprite(skullMaterial);
    const skullSpriteSize = 30.0;
    skullSprite.scale.set(skullSpriteSize, skullSpriteSize, 1);
    skullSprite.position.set(
      worldCenterForWilderness,
      50, // High above terrain
      wildernessDepth / 4, // Centered in wilderness zone
    );
    // Phase 4E: Add skull to wildernessGroup (not scene) so cleanup traverses it
    wildernessGroup.add(skullSprite);

    // Store reference for cleanup (use group as main reference)
    wildernessOverlayRef.current = wildernessGroup as unknown as THREE.Mesh;
    // Store skull for animation
    (
      wildernessGroup as THREE.Group & { skullSprite?: THREE.Sprite }
    ).skullSprite = skullSprite;

    // Phase 1.1 fourth carve — lighting setup extracted into
    // `setupTerrainLighting` utility (`hooks/setupTerrainLighting.ts`).
    // The util constructs + adds all three lights to the scene and
    // returns refs the parent stores so its animation loop can
    // drive the day cycle.
    const { sun, hemi, ambient } = setupTerrainLighting(scene, {
      isStudioMode: isStudioModeRef.current,
      enableShadows: enableShadowsRef.current,
    });
    hemiLightRef.current = hemi;
    ambientLightRef.current = ambient;
    sunRef.current = sun;

    // Create terrain resources (full-res + low-res LOD template)
    templateGeometryRef.current = createTemplateGeometry(
      tileSize,
      tileResolution,
    );
    lowResTemplateGeometryRef.current = createTemplateGeometry(
      tileSize,
      TILE_LOD_LOW_RESOLUTION,
    );
    const waterTemplate = new THREE.PlaneGeometry(tileSize, tileSize);
    waterTemplate.rotateX(-Math.PI / 2);
    waterTemplateGeometryRef.current = waterTemplate;
    // Phase C4 first cut — non-Hyperia projects render terrain via
    // per-vertex RGB from the runtime content registry. The shader's
    // tundra/forest/canyon texture blend would otherwise treat every
    // tile as 100% tundra (since `biomeForestWeight` and
    // `biomeCanyonWeight` are 0 for tropical / arctic / desert
    // biomes), producing a snowy-white island regardless of the
    // pack's authored biome colors. With `useVertexColorBase=true`,
    // the shader reads the per-vertex `color` attribute (populated
    // by `terrainHelpers.generateTileGeometry` from
    // `getActiveBiomeDefinitions`) directly, so themed packs render
    // their actual biome tints. Hyperia projects keep the textured
    // path.
    terrainMaterialRef.current = createTerrainMaterial({
      useVertexColorBase: !hyperiaContentEnabledRef.current,
    });
    const {
      material: editorWaterMat,
      uniforms: editorWaterUniforms,
      textures: editorWaterTextures,
    } = createEditorWaterMaterial();
    waterMaterialRef.current = editorWaterMat;
    if (!waterUniformsRef.current) {
      waterUniformsRef.current = editorWaterUniforms;
    }
    waterTexturesRef.current = editorWaterTextures;

    // Create terrain generator and querier
    const generator = new TerrainGenerator(terrainConfigRef.current);
    generatorRef.current = generator;

    // Build the terrain querier — Hyperia game pipeline uses
    // `createGameTerrainQuerier` (which embeds Hyperia's
    // hardcoded 3-biome polygon centers + island shape);
    // everything else wraps `TerrainGenerator.queryPoint`.
    //
    // Bug #3 follow-up — gated on `hyperiaContentEnabledRef`,
    // not the legacy `useGamePipelineRef`. Projects whose
    // worldData was saved before R1.P1 carry
    // `useGamePipeline: true` even when their plugins set
    // doesn't include `@hyperforge/hyperscape`. Without this
    // dual-gate, non-Hyperia projects flow through the
    // Hyperia-specific terrain querier and inherit Hyperia's
    // deterministic island shape + pie-slice biomes.
    if (hyperiaContentEnabledRef.current) {
      const gameQuerier = createGameTerrainQuerier(configSeedRef.current);
      // Pre-allocated result object — queryPoint already pools internally,
      // but the wrapper previously allocated a new object per call.
      const _gameResult: import("./terrainHelpers").TerrainQueryResult = {
        height: 0,
        biome: "forest",
        biomeForestWeight: 0,
        biomeCanyonWeight: 0,
      };
      terrainQuerierRef.current = (worldX: number, worldZ: number) => {
        const q = gameQuerier.queryPoint(worldX, worldZ);
        _gameResult.height = q.height;
        _gameResult.biome = q.biomeId;
        _gameResult.color = q.biomeColor;
        _gameResult.biomeForestWeight = q.biomeForestWeight;
        _gameResult.biomeCanyonWeight = q.biomeCanyonWeight;
        return _gameResult;
      };
    } else {
      // Pre-allocated result object for procgen pipeline. Phase 2.1
      // also forwards `biomeInfluences` (full top-N weighted list)
      // and `color` (pre-blended per-vertex RGB from procgen) so
      // the N-channel attribute write path in `terrainHelpers`
      // can populate the new `biomeIndices` + `biomeWeights`
      // attributes. Borrowed-ref contract: both fields point into
      // procgen's pooled scratch state — terrainHelpers consumes
      // them synchronously per vertex.
      const _procgenResult: import("./terrainHelpers").TerrainQueryResult = {
        height: 0,
        biome: "forest",
        biomeForestWeight: 0,
        biomeCanyonWeight: 0,
      };
      terrainQuerierRef.current = (worldX: number, worldZ: number) => {
        const q = generator.queryPoint(worldX, worldZ);
        // Extract per-biome weights for legacy 3-channel shader path
        const fW =
          q.biomeInfluences?.find((b) => b.type === "forest")?.weight ?? 0;
        const cW =
          q.biomeInfluences?.find((b) => b.type === "canyon")?.weight ?? 0;
        _procgenResult.height = q.height;
        _procgenResult.biome = q.biome;
        _procgenResult.biomeForestWeight = fW;
        _procgenResult.biomeCanyonWeight = cW;
        _procgenResult.biomeInfluences = q.biomeInfluences;
        _procgenResult.color = q.color;
        return _procgenResult;
      };
    }

    // Compute world metrics shared by all pipelines
    const worldSizeMeters = worldSize * tileSize;
    const worldCenterOffset = worldSizeMeters / 2;
    worldCenterOffsetRef.current = worldCenterOffset;

    // Clear selectable objects array
    selectableObjectsRef.current = [];

    // ---- Difficulty heatmap overlay ----
    // Create the manager now (querier + scene are ready). Town data arrives
    // later and is fed via setTowns(). The manager creates overlay meshes
    // as terrain tiles load/unload.
    const biomeSystem = generator.getBiomeSystem();
    const heatmapQuerier = terrainQuerierRef.current!;
    const heatmapManager = new DifficultyHeatmapManager({
      scene,
      seed: configSeedRef.current,
      tileSize,
      worldCenterOffset,
      queryBiome: (wx, wz) => {
        const q = heatmapQuerier(wx, wz);
        return { biome: q.biome, height: q.height };
      },
      getBiomeDifficulty: (biomeId: string) => {
        const def = biomeSystem.getBiomeDefinition(biomeId);
        return def?.difficultyLevel ?? 0;
      },
    });
    heatmapManagerRef.current = heatmapManager;

    // ---- Hyperia game pipeline: fetch exact towns + roads
    // from server-side Hyperia game code ----
    // The Asset Forge API runs the ACTUAL Hyperia TownGenerator
    // + BFS road pathfinding, producing pixel-identical
    // town/road layouts for the live Hyperia world. Non-Hyperia
    // projects must not fetch this (the layout is Hyperia-
    // specific) — same dual-gate as the terrain querier above.
    if (hyperiaContentEnabledRef.current) {
      const initLayout = async () => {
        const layoutRes = await fetch("/api/world/layout");
        if (!mounted) return;
        if (!layoutRes.ok) {
          console.error(
            "[TileBasedTerrain] Failed to fetch world layout:",
            layoutRes.status,
          );
          return;
        }

        const layout = (await layoutRes.json()) as {
          towns: Array<{
            id: string;
            name: string;
            size: string;
            biome: string;
            position: { x: number; y: number; z: number };
            safeZoneRadius: number;
            layoutType: string;
            buildings: Array<{
              id: string;
              type: string;
              position: { x: number; y: number; z: number };
              rotation: number;
              size: { width: number; depth: number };
            }>;
            entryPoints: Array<{
              position: { x: number; z: number };
              angle: number;
            }>;
            internalRoads: Array<{
              start: { x: number; z: number };
              end: { x: number; z: number };
              width: number;
              isMain: boolean;
            }>;
            paths: Array<{
              start: { x: number; z: number };
              end: { x: number; z: number };
              width: number;
            }>;
            landmarks: Array<{
              type: string;
              position: { x: number; y: number; z: number };
              rotation: number;
              size: { width: number; depth: number; height: number };
            }>;
            plaza?: { center: { x: number; z: number }; radius: number };
          }>;
          roads: Array<{
            id: string;
            fromTownId: string;
            toTownId: string;
            path: Array<{ x: number; z: number }>;
            width: number;
            isMainRoad: boolean;
          }>;
          generationTimeMs: number;
        };
        if (!mounted) return;

        console.warn(
          `%c[initLayout] Received ${layout.towns.length} towns, ${layout.roads.length} roads from server (${layout.generationTimeMs}ms). This will render initial towns.`,
          "color: orange; font-weight: bold",
        );
        setTownCount(layout.towns.length);

        // Store runtime town data for auto-gen pipeline
        runtimeTownsRef.current = layout.towns.map((t) => ({
          id: t.id,
          name: t.name,
          position: { x: t.position.x, y: t.position.y, z: t.position.z },
          size: t.size,
          safeZoneRadius: t.safeZoneRadius,
        }));

        // Sync runtime towns back to foundation (single source of truth)
        onTownsGenerated?.(
          layout.towns.map((t) => ({
            id: t.id,
            name: t.name,
            position: { x: t.position.x, y: t.position.y, z: t.position.z },
            size: t.size as "hamlet" | "village" | "town",
            safeZoneRadius: t.safeZoneRadius,
            biomeId: t.biome,
          })),
        );

        // Feed town data to difficulty heatmap
        if (heatmapManagerRef.current) {
          const townInfos: TownInfo[] = layout.towns.map((t) => ({
            position: { x: t.position.x, z: t.position.z },
            safeZoneRadius: t.safeZoneRadius,
          }));
          heatmapManagerRef.current.setTowns(townInfos);
        }

        // Get height function from game terrain querier
        const heightQuerier = terrainQuerierRef.current;
        const getHeight = (wx: number, wz: number): number =>
          heightQuerier
            ? heightQuerier(wx, wz).height
            : generator.getHeightAt(wx, wz);

        // ---- Render town markers, buildings, landmarks, internal roads ----
        // Delegate to TownRenderer — handles shared materials, cone/ring/pillar
        // markers, buildings with LOD, landmarks, and internal road lines.
        // The server layout towns match the ProcgenTown interface.
        const tr = townRendererRef.current;
        if (tr) {
          tr.refreshTowns(
            layout.towns as unknown as ProcgenTown[],
            worldCenterOffset,
            getHeight,
            (obj) => {
              if (!selectableObjectsRef.current.includes(obj)) {
                selectableObjectsRef.current.push(obj);
              }
            },
            (lod) => lodObjectsRef.current.push(lod),
          );
          // Sync runtime towns from TownRenderer (already set by refreshTowns)
          runtimeTownsRef.current = tr.runtimeTowns;
          lastProcgenTownsRef.current = tr.lastProcgenTowns;
        }

        // ---- Inter-town roads: terrain shader handles road rendering via
        // roadInfluence vertex attribute. No ribbon meshes needed. ----
        if (layout.roads.length > 0) {
          setRoadCount(layout.roads.length);

          // Minimap roads
          setMinimapRoads(
            layout.roads.map((road) => ({
              path: road.path.map((p) => ({
                x: p.x + worldCenterOffset,
                z: p.z + worldCenterOffset,
              })),
            })),
          );
        } else {
          setRoadCount(0);
          setMinimapRoads([]);
        }

        // Minimap towns
        setMinimapTowns(
          layout.towns.map((town) => ({
            id: town.id,
            name: town.name,
            position: {
              x: town.position.x + worldCenterOffset,
              z: town.position.z + worldCenterOffset,
            },
            size: town.size,
          })),
        );
      };
      initLayout();
    } else {
      // ---- Procgen pipeline: generate towns locally ----

      // Scale town spacing based on world size (smaller worlds need closer towns)
      // Minimum spacing should allow at least 3-5 towns to fit
      const townCfg = townConfigRef.current;
      const scaledMinSpacing = Math.min(
        townCfg.minTownSpacing,
        worldSizeMeters / 5, // Ensure at least ~5 potential town spots
      );

      const townGenerator = TownGenerator.fromTerrainGenerator(generator, {
        seed: configSeedRef.current,
        config: {
          townCount: townCfg.townCount,
          worldSize: worldSizeMeters,
          minTownSpacing: scaledMinSpacing,
          waterThreshold: waterThresholdRef.current,
          landmarks: {
            fencesEnabled: townCfg.landmarks.fencesEnabled,
            fenceDensity: townCfg.landmarks.fenceDensity,
            fencePostHeight: townCfg.landmarks.fencePostHeight,
            lamppostsInVillages: townCfg.landmarks.lamppostsInVillages,
            lamppostSpacing: townCfg.landmarks.lamppostSpacing,
            marketStallsEnabled: townCfg.landmarks.marketStallsEnabled,
            decorationsEnabled: townCfg.landmarks.decorationsEnabled,
          },
        },
      });

      const townResult = townGenerator.generate();
      console.log(
        `[TileBasedTerrain] Generated ${townResult.towns.length} towns in ${townResult.stats.generationTime.toFixed(0)}ms`,
      );
      setTownCount(townResult.towns.length);

      // Store runtime town data for auto-gen pipeline
      runtimeTownsRef.current = townResult.towns.map((t) => ({
        id: t.id,
        name: t.name,
        position: { x: t.position.x, y: t.position.y, z: t.position.z },
        size: t.size,
        safeZoneRadius: t.safeZoneRadius,
      }));

      // Sync runtime towns back to foundation (single source of truth)
      onTownsGenerated?.(
        townResult.towns.map((t) => ({
          id: t.id,
          name: t.name,
          position: { x: t.position.x, y: t.position.y, z: t.position.z },
          size: t.size,
          safeZoneRadius: t.safeZoneRadius,
          biomeId: t.biome,
        })),
      );

      // Feed town data to difficulty heatmap
      if (heatmapManagerRef.current) {
        const townInfos: TownInfo[] = townResult.towns.map((t) => ({
          position: { x: t.position.x, z: t.position.z },
          safeZoneRadius: t.safeZoneRadius,
        }));
        heatmapManagerRef.current.setTowns(townInfos);
      }

      // Clear selectable objects array
      selectableObjectsRef.current = [];

      // ---- Render town markers, buildings, landmarks, internal roads ----
      // Delegate to TownRenderer — handles shared materials, cone/ring/pillar
      // markers, building LOD, internal roads, and landmarks.
      const tr = townRendererRef.current;
      if (tr) {
        const getHeight = (wx: number, wz: number): number =>
          generator.getHeightAt(wx, wz);
        tr.refreshTowns(
          townResult.towns,
          worldCenterOffset,
          getHeight,
          (obj) => {
            if (!selectableObjectsRef.current.includes(obj))
              selectableObjectsRef.current.push(obj);
          },
          (lod) => lodObjectsRef.current.push(lod),
        );
        runtimeTownsRef.current = tr.runtimeTowns;
        lastProcgenTownsRef.current = tr.lastProcgenTowns;
      }

      // Roads are rendered by the terrain shader via roadInfluence vertex
      // attribute — no ribbon meshes needed. Just track count + minimap.
      const roadsToRender = providedRoadsRef.current;
      if (roadsToRender && roadsToRender.length > 0) {
        setRoadCount(roadsToRender.length);

        // Populate minimap roads data from actual road paths
        const minimapRoadData: Array<{
          path: Array<{ x: number; z: number }>;
        }> = roadsToRender.map((road) => ({
          path: road.path.map((point) => ({
            x: point.x + worldCenterOffset,
            z: point.z + worldCenterOffset,
          })),
        }));
        setMinimapRoads(minimapRoadData);
      } else if (townResult.towns.length >= 2) {
        // No road data yet — roads will appear when the terrain shader picks up
        // roadInfluence from tiles regenerated after setFoundationRoads.
        setRoadCount(0);
        setMinimapRoads([]);
      } else {
        setRoadCount(0);
        setMinimapRoads([]);
      }

      // Populate minimap towns data
      const minimapTownData = townResult.towns.map((town) => ({
        id: town.id,
        name: town.name,
        position: {
          x: town.position.x + worldCenterOffset,
          z: town.position.z + worldCenterOffset,
        },
        size: town.size,
      }));
      setMinimapTowns(minimapTownData);
    } // end else (procgen pipeline)

    // Load vegetation from manifest (source of truth) or fall back to procgen
    const initVegetation = async () => {
      if (!showVegetation || !mounted) return;

      // Load actual game GLB tree models from manifest
      await initTreeModels();
      if (!mounted) return;

      // Clear any existing vegetation (handles double-init from React StrictMode
      // or effect re-runs). Without this, both runs pile up in the container.
      const existingChildren = [...vegetationContainer.children];
      if (existingChildren.length > 0) {
        for (const child of existingChildren) {
          vegetationContainer.remove(child);
          resourceManager.queueDisposal(child, true);
        }
        vegetationSpeciesMapRef.current.clear();
      }

      // ---- MANIFEST-FIRST: Load curated trees from world.json ----
      // World Studio is the source of truth for tree placement. On initial load,
      // we fetch the curated trees that were previously exported to world.json
      // (the same data the game server uses). This gives us ~2K trees that match
      // the actual game world, not 31K raw procgen candidates.
      // Procgen is only used as a fallback for new worlds with no manifest,
      // or when the user explicitly triggers regeneration via refreshVegetation().
      const initGenStart = performance.now();
      let filteredTrees: Array<{
        s: string;
        x: number;
        y: number;
        z: number;
        sc: number;
        r: number;
      }> = [];

      let treeSource = "procgen";
      try {
        const manifestRes = await fetch("/api/world/manifest-trees");
        if (manifestRes.ok) {
          const manifestData = (await manifestRes.json()) as {
            trees: Array<{
              s: string;
              x: number;
              y: number;
              z: number;
              sc: number;
              r: number;
            }>;
            source: string;
            count: number;
          };
          if (
            manifestData.source === "world.json" &&
            manifestData.trees.length > 0
          ) {
            filteredTrees = manifestData.trees;
            treeSource = "manifest";
          }
        }
      } catch {
        // Manifest fetch failed — fall back to procgen below
      }
      if (!mounted) return;

      // ---- FALLBACK: Generate trees via procgen if no manifest trees ----
      if (filteredTrees.length === 0) {
        const initQuerier = terrainQuerierRef.current;
        const initSeed = configSeedRef.current;

        if (initQuerier) {
          const halfT = Math.floor(GAME_WORLD_SIZE / 2);
          for (let tx = -halfT; tx < halfT; tx++) {
            for (let tz = -halfT; tz < halfT; tz++) {
              const cx = tx * GAME_TILE_SIZE;
              const cz = tz * GAME_TILE_SIZE;
              const tq = initQuerier(cx, cz);
              const tileBiome = tq.biome;
              const tc = getTreeConfigForBiome(tileBiome);
              if (!tc.enabled || tc.density <= 0) continue;

              const rCtx: ResourceGenerationContext = {
                tileX: tx,
                tileZ: tz,
                tileKey: `${tx}_${tz}`,
                tileSize: GAME_TILE_SIZE,
                waterThreshold: GAME_WATER_THRESHOLD,
                getHeightAt: (wx: number, wz: number) =>
                  initQuerier(wx, wz).height,
                getDominantBiome: (wx: number, wz: number) =>
                  initQuerier(wx, wz).biome,
                createRng: (salt: string) =>
                  _createTileRng(initSeed, tx, tz, salt),
              };

              const genResult = generateTrees(rCtx, tc);

              for (const node of genResult) {
                const p = node.position as { x: number; y: number; z: number };
                filteredTrees.push({
                  s: node.subType ?? "oak",
                  x: tx * GAME_TILE_SIZE + p.x,
                  y: p.y,
                  z: tz * GAME_TILE_SIZE + p.z,
                  sc: node.scale ?? 1,
                  r: node.rotation ?? 0,
                });
              }
            }
          }
        }
        if (!mounted) return;

        // Apply exclusion filtering for procgen trees (towns, roads)
        const towns = runtimeTownsRef.current;
        const roads = providedRoadsRef.current;
        if (
          filteredTrees.length > 0 &&
          (towns.length > 0 || (roads && roads.length > 0))
        ) {
          const exclusionInput: VegetationExclusionInput = {
            circles: [],
            roads: (roads ?? []).map((r) => ({
              path: r.path.map((p: { x: number; z: number }) => ({
                x: p.x,
                z: p.z,
              })),
              halfWidth: r.width ? r.width / 2 : 4,
            })),
            towns: towns.map((t) => ({
              x: t.position.x,
              z: t.position.z,
              safeZoneRadius: t.safeZoneRadius,
            })),
          };
          const precomputed = precomputeExclusions(exclusionInput);
          const beforeCount = filteredTrees.length;
          filteredTrees = filterTreesByExclusions(filteredTrees, precomputed);
          console.log(
            `[initVegetation] Exclusion filter: ${beforeCount} → ${filteredTrees.length} trees`,
          );
        }
      }

      const initGenElapsed = performance.now() - initGenStart;
      console.log(
        `[initVegetation] Loaded ${filteredTrees.length} trees from ${treeSource} in ${initGenElapsed.toFixed(0)}ms`,
      );

      // ---- Set up InstancedMesh per species for GLB models ----
      // Count trees per species first so we allocate exact-size GPU buffers
      const initSpeciesCounts = new Map<string, number>();
      for (const tree of filteredTrees) {
        const speciesId = `tree_${tree.s}`;
        initSpeciesCounts.set(
          speciesId,
          (initSpeciesCounts.get(speciesId) || 0) + 1,
        );
      }

      const speciesIds = getAllTreeSpeciesIds();
      const speciesInstanceData = new Map<
        string,
        {
          meshes: THREE.InstancedMesh[];
          manifestScale: number;
          count: number;
        }
      >();

      for (const id of speciesIds) {
        const treeCount = initSpeciesCounts.get(id) || 0;
        if (treeCount === 0) continue; // Skip species with no trees
        const data = getTreeSpeciesInstance(id);
        if (!data || data.parts.length === 0) continue;

        const meshes = data.parts.map((part) => {
          const im = new THREE.InstancedMesh(
            part.geometry,
            part.material,
            treeCount,
          );
          im.castShadow = true;
          im.receiveShadow = true;
          return im;
        });

        speciesInstanceData.set(id, {
          meshes,
          manifestScale: data.manifestScale,
          count: 0,
        });
      }

      let totalTreeCount = 0;
      const matrix = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const upAxis = new THREE.Vector3(0, 1, 0);

      // Place every tree from client-side generation
      // Trees are in centered world coords; scene uses 0-based coords.
      // Scene offset = worldCenterOffset (= halfWorld = worldSizeMeters / 2)
      for (const tree of filteredTrees) {
        const speciesId = `tree_${tree.s}`;
        const speciesData = speciesInstanceData.get(speciesId);
        if (!speciesData) continue;

        // Convert centered world coords → 0-based scene coords
        const sceneX = tree.x + worldCenterOffset;
        const sceneZ = tree.z + worldCenterOffset;

        const finalScale = speciesData.manifestScale * tree.sc;

        pos.set(sceneX, tree.y, sceneZ);
        scl.set(finalScale, finalScale, finalScale);
        quat.setFromAxisAngle(upAxis, tree.r);
        matrix.compose(pos, quat, scl);

        for (const im of speciesData.meshes) {
          im.setMatrixAt(speciesData.count, matrix);
        }
        speciesData.count++;
        totalTreeCount++;
      }

      // Finalize instance counts and stage for gradual scene addition
      vegetationSpeciesMapRef.current.clear();
      for (const [speciesId, data] of speciesInstanceData) {
        for (const im of data.meshes) {
          im.count = data.count;
          im.instanceMatrix.needsUpdate = true;
          resourceManager.stage({
            object: im,
            parent: vegetationContainer,
            onAdd: () => vegetationSpeciesMapRef.current.set(im, speciesId),
          });
        }
      }

      // Track vegetation positions for external consumers (auto-gen, debug panel)
      vegetationPositionsRef.current = filteredTrees.map((t) => ({
        x: t.x,
        z: t.z,
      }));
      vegetationTreesRef.current = filteredTrees;

      const speciesSummary = [...speciesInstanceData.entries()]
        .filter(([, d]) => d.count > 0)
        .map(([id, d]) => `${id.replace("tree_", "")}:${d.count}`)
        .join(", ");

      // Log species that had NO InstancedMesh (missing GLB model)
      const missingSpecies = filteredTrees
        .map((t) => `tree_${t.s}`)
        .filter((sid) => !speciesInstanceData.has(sid));
      const uniqueMissing = [...new Set(missingSpecies)];
      if (uniqueMissing.length > 0) {
        console.warn(
          `[initVegetation] Missing GLB models for species: ${uniqueMissing.join(", ")}. ` +
            `Available: ${[...speciesInstanceData.keys()].join(", ")}`,
        );
      }

      console.log(
        `%c[initVegetation] Placed ${totalTreeCount}/${filteredTrees.length} trees (${speciesSummary})`,
        "color: #4ade80; font-weight: bold;",
      );
      if (totalTreeCount === 0 && filteredTrees.length > 0) {
        console.error(
          `[initVegetation] Generated ${filteredTrees.length} trees but placed ZERO! ` +
            `Species lookup failed — check species ID format. ` +
            `Sample tree.s values: ${filteredTrees
              .slice(0, 5)
              .map((t) => t.s)
              .join(", ")}. ` +
            `Available speciesIds: ${[...speciesInstanceData.keys()].join(", ")}`,
        );
      }
    };
    initVegetation();

    // ---- Hyperia content: bridges + duel arena + manifest entities ----
    // Bug #3 fix — gated on `hyperiaContentEnabledRef` (the new
    // project-aware flag), not just `useGamePipelineRef`. A
    // legacy non-Hyperia project whose worldData has
    // `useGamePipeline: true` baked in (from before R1.P1's
    // honest-naming work) would otherwise still load Hyperia
    // bridges, duel arena, and the `/api/manifests/{npcs,
    // stations, gathering, world-areas}` JSON — Hyperia
    // content leaking into projects that don't declare the
    // Hyperia plugin.
    if (hyperiaContentEnabledRef.current) {
      const heightQuerier = terrainQuerierRef.current;
      if (heightQuerier) {
        const getH = (wx: number, wz: number) => heightQuerier(wx, wz).height;

        // Bridges at known river crossing positions
        const bridges = createBridgeMeshes(worldCenterOffset, getH);
        scene.add(bridges);
        // Register each bridge subgroup as selectable for click-to-select
        for (const child of bridges.children) {
          if (child.userData?.selectable) {
            selectableObjectsRef.current.push(child);
          }
        }

        // Duel arena at fixed game position
        const arena = createDuelArena(worldCenterOffset, getH);
        scene.add(arena);
        // Register arena group as selectable for click-to-select
        if (arena.userData?.selectable) {
          selectableObjectsRef.current.push(arena);
        }

        // All manifest entities (NPCs, stations, resources, mob spawns, fishing)
        createGameWorldEntities(
          worldCenterOffset,
          getH,
          waterThresholdRef.current,
        ).then((result) => {
          if (!mounted) {
            disposeEntitySync(result.group);
            return;
          }
          scene.add(result.group);
          entitySyncRef.current = result.group;

          // Register entity groups as selectable for click-to-select
          for (const subGroup of result.group.children) {
            if (!(subGroup instanceof THREE.Group)) continue;
            for (const entity of subGroup.children) {
              if (entity.userData?.selectable) {
                selectableObjectsRef.current.push(entity);
              }
            }
          }

          // Report entity data to parent
          onGameEntitiesLoaded?.(result.entities);
        });
      }
    }

    // Event listeners — use stable wrappers that delegate to refs
    document.addEventListener("mousemove", _onMouseMove);
    document.addEventListener("keydown", _onKeyDown);
    document.addEventListener("keyup", _onKeyUp);
    document.addEventListener("pointerlockchange", _onPointerLockChange);
    document.addEventListener("mouseup", _onMouseUp);
    container.addEventListener("click", _onClick);
    container.addEventListener("mousedown", _onMouseDown);
    container.addEventListener("wheel", _onWheel, { passive: false });
    document.addEventListener("contextmenu", _onContextMenu, true);

    // Async WebGPU renderer initialization via ViewportRenderLoop
    const initRenderer = async () => {
      const renderLoop = await ViewportRenderLoop.create({
        scene,
        camera,
        container,
        antialias: !isStudioModeRef.current,
        maxPixelRatio: isStudioModeRef.current ? 1 : 2,
        enableShadows: !isStudioModeRef.current || enableShadowsRef.current,
        enableBloom: false,
        maxRecoveryAttempts: 2,
      });

      if (!mounted) {
        renderLoop.dispose();
        return;
      }

      const renderer = renderLoop.renderer;
      rendererRef.current = renderer;
      renderLoopRef.current = renderLoop;

      // Sync GPU recovery state to React for UI overlays
      renderLoop.onGpuRecovery((event) => {
        if (event.phase === "started") {
          gpuRecoveringRef.current = true;
          gpuRecoveryCountRef.current = event.attempt;
          setGpuRecovering(true);
          // Sync rendererRef on recovery start (renderer may become stale)
          rendererRef.current = renderLoop.renderer;
        } else if (event.phase === "succeeded") {
          gpuRecoveringRef.current = false;
          rendererRef.current = renderLoop.renderer;
          setGpuRecovering(false);
          console.log(
            `[GPU-DEBUG] Device recovery #${event.attempt} successful`,
          );
        } else if (event.phase === "failed") {
          gpuRecoveringRef.current = false;
          setGpuRecovering(false);
          setGpuError(
            "GPU recovery failed after multiple attempts. Please reload the page.",
          );
        }
      });

      // Perf stats logging is handled by ViewportRenderLoop (emits every ~120 frames)

      // Create ViewHelper orientation cube (bottom-right corner)
      // Skip in World Studio — it provides its own viewport controls
      if (!hideBuiltinOverlays) {
        try {
          const helper = new ViewHelper(camera, renderer.domElement);
          viewHelperRef.current = helper;
        } catch (err) {
          console.warn(
            "[TileBasedTerrain] ViewHelper init failed (non-critical):",
            err,
          );
        }
      }

      // Create ground grid helper (hidden by default)
      const worldSizeMeters = worldSize * tileSize;
      const gridDivisions = worldSize; // One line per tile
      const grid = new THREE.GridHelper(
        worldSizeMeters,
        gridDivisions,
        0x444466, // Center line color
        0x333344, // Grid line color
      );
      grid.position.set(worldSizeMeters / 2, 0.5, worldSizeMeters / 2);
      grid.visible = false;
      scene.add(grid);
      gridHelperRef.current = grid;

      // Create editor entity overlay group (for NPCs, spawn points, etc.)
      if (!entityOverlayRef.current) {
        const overlay = new THREE.Group();
        overlay.name = "editor-entity-overlay";
        scene.add(overlay);
        entityOverlayRef.current = overlay;
      }

      // Notify parent that scene is ready for editing tool integration
      onSceneReady?.({
        scene,
        camera,
        renderer: renderLoop.renderer,
        raycaster: raycasterRef.current,
        container,
        terrainContainer,
        entityOverlay: entityOverlayRef.current,
        addSelectable: (obj: THREE.Object3D) => {
          if (!selectableObjectsRef.current.includes(obj)) {
            selectableObjectsRef.current.push(obj);
          }
        },
        removeSelectable: (obj: THREE.Object3D) => {
          const idx = selectableObjectsRef.current.indexOf(obj);
          if (idx >= 0) selectableObjectsRef.current.splice(idx, 1);
        },
        setInteractionMode: (mode: "orbit" | "tool" | "gizmo") => {
          const ctrl = orbitControlsRef.current;
          if (!ctrl) return;
          // RMB always reserved for fly mode — never assign to OrbitControls
          if (mode === "gizmo") {
            // Transform gizmo active — left free for gizmo handles,
            // middle click = orbit so user can still rotate the camera
            ctrl.mouseButtons = {
              LEFT: -1 as THREE.MOUSE,
              MIDDLE: THREE.MOUSE.ROTATE,
              RIGHT: -1 as THREE.MOUSE,
            };
          } else if (mode === "tool") {
            // Brush / placement tool — left free for painting / placing
            ctrl.mouseButtons = {
              LEFT: -1 as THREE.MOUSE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: -1 as THREE.MOUSE,
            };
          } else {
            ctrl.mouseButtons = {
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.PAN,
              RIGHT: -1 as THREE.MOUSE,
            };
          }
        },
        focusOnPosition: (target: THREE.Vector3, radius: number) => {
          const ctrl = orbitControlsRef.current;
          if (!ctrl) return;
          // Calculate camera distance to frame the object
          const fov = camera.fov * (Math.PI / 180);
          const distance = Math.max(radius * 2.5, 10) / Math.tan(fov / 2);
          // Animate orbit target and camera position
          const startTarget = ctrl.target.clone();
          const startPos = camera.position.clone();
          const endTarget = target.clone();
          const endPos = target
            .clone()
            .add(
              camera.position
                .clone()
                .sub(ctrl.target)
                .normalize()
                .multiplyScalar(distance),
            );
          const duration = 300; // ms
          const startTime = performance.now();
          const animateFocus = () => {
            const elapsed = performance.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const ease = 1 - Math.pow(1 - t, 3);
            ctrl.target.lerpVectors(startTarget, endTarget, ease);
            camera.position.lerpVectors(startPos, endPos, ease);
            ctrl.update();
            if (t < 1) requestAnimationFrame(animateFocus);
          };
          animateFocus();
        },
        setViewMode: (mode: ViewMode) => {
          viewModeRef.current = mode;
          const mat = terrainMaterialRef.current as
            | (THREE.Material & { wireframe?: boolean })
            | null;
          if (mat) {
            mat.wireframe = mode === "wireframe";
          }
          // Toggle vertex color display for biome mode
          // (terrain already uses vertex colors, this is a display hint)
        },
        setGridVisible: (visible: boolean) => {
          if (gridHelperRef.current) {
            gridHelperRef.current.visible = visible;
          }
        },
        promoteVegetationInstance: (
          speciesId: string,
          instanceIndex: number,
          selectableId: string,
        ): THREE.Group | null => {
          const vegContainer = vegetationContainerRef.current;
          const entityOverlay = entityOverlayRef.current;
          if (!vegContainer || !entityOverlay) return null;

          // Find the InstancedMesh(es) for this species
          const speciesMeshes: THREE.InstancedMesh[] = [];
          for (const [im, sid] of vegetationSpeciesMapRef.current) {
            if (sid === speciesId) speciesMeshes.push(im);
          }
          if (speciesMeshes.length === 0) return null;

          // Read the instance transform from the first mesh
          const instanceMatrix = new THREE.Matrix4();
          speciesMeshes[0].getMatrixAt(instanceIndex, instanceMatrix);
          const instancePos = new THREE.Vector3();
          const instanceQuat = new THREE.Quaternion();
          const instanceScl = new THREE.Vector3();
          instanceMatrix.decompose(instancePos, instanceQuat, instanceScl);

          // Create standalone proxy group with the species' mesh parts
          const speciesData = getTreeSpeciesInstance(speciesId);
          if (!speciesData) return null;

          const proxy = new THREE.Group();
          proxy.name = `veg_proxy_${selectableId}`;
          proxy.position.copy(instancePos);
          proxy.quaternion.copy(instanceQuat);
          proxy.scale.copy(instanceScl);

          for (const part of speciesData.parts) {
            const mesh = new THREE.Mesh(part.geometry, part.material);
            mesh.castShadow = true;
            mesh.userData._cachedModel = true; // Don't dispose — shared with cache
            proxy.add(mesh);
          }

          proxy.userData = {
            selectable: true,
            selectableId,
            _vegPromo: true,
            _vegSpeciesId: speciesId,
            _vegInstanceIndex: instanceIndex,
            displayName: speciesId.replace(/_/g, " "),
          };

          // Hide the original instance (scale to 0)
          const zeroMatrix = new THREE.Matrix4().compose(
            instancePos,
            instanceQuat,
            new THREE.Vector3(0, 0, 0),
          );
          for (const im of speciesMeshes) {
            im.setMatrixAt(instanceIndex, zeroMatrix);
            im.instanceMatrix.needsUpdate = true;
          }

          entityOverlay.add(proxy);
          return proxy;
        },
        demoteVegetationInstance: (proxyGroup: THREE.Group): void => {
          const entityOverlay = entityOverlayRef.current;
          if (!entityOverlay) return;

          const speciesId = proxyGroup.userData._vegSpeciesId as string;
          const instanceIndex = proxyGroup.userData._vegInstanceIndex as number;
          if (!speciesId || instanceIndex === undefined) return;

          // Find the InstancedMesh(es)
          const speciesMeshes: THREE.InstancedMesh[] = [];
          for (const [im, sid] of vegetationSpeciesMapRef.current) {
            if (sid === speciesId) speciesMeshes.push(im);
          }

          // Write the proxy's current transform back to the InstancedMesh
          const matrix = new THREE.Matrix4().compose(
            proxyGroup.position,
            proxyGroup.quaternion,
            proxyGroup.scale,
          );
          for (const im of speciesMeshes) {
            im.setMatrixAt(instanceIndex, matrix);
            im.instanceMatrix.needsUpdate = true;
          }

          // Remove proxy from overlay
          entityOverlay.remove(proxyGroup);
        },
        refreshVegetation: async (
          vegConfig?: VegetationConfig,
          exclusions?: VegetationExclusions,
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
        ): Promise<void> => {
          const vegContainer = vegetationContainerRef.current;
          if (!vegContainer) return;

          // Flush any pending staged vegetation from a previous call
          resourceManager.flushStagedForParent(vegContainer);

          // Remove existing vegetation InstancedMeshes from scene — queue deferred GPU disposal.
          // GPU resources are NOT disposed synchronously to prevent Metal device loss.
          // geometryOnly: true because veg InstancedMeshes share geometry/material from species cache.
          const toRemove = [...vegContainer.children];
          for (const child of toRemove) {
            vegContainer.remove(child);
            resourceManager.queueDisposal(child, true);
          }
          vegetationSpeciesMapRef.current.clear();

          // Ensure tree GLB models are loaded
          await initTreeModels();

          // Generate trees CLIENT-SIDE using the editor's own terrain querier.
          // This guarantees tree positions match the terrain the user sees — the
          // server's GameWorldContext uses a different implementation that produces
          // different biome/height maps even with the same seed.
          const currentSeed = configSeedRef.current;
          const querier = terrainQuerierRef.current;
          const genStartTime = performance.now();

          const allTrees: Array<{
            s: string;
            x: number;
            y: number;
            z: number;
            sc: number;
            r: number;
          }> = [];

          const editorTileSize = GAME_TILE_SIZE;
          const editorWorldSize = GAME_WORLD_SIZE;
          const editorWaterThreshold = GAME_WATER_THRESHOLD;
          const halfTiles = Math.floor(editorWorldSize / 2);

          // Build a resolveTreeConfig that merges user overrides (if any) with game defaults.
          // When vegConfig is provided (from ProcgenPanel), biomes with overrides use them;
          // biomes without overrides fall back to the game's authoritative config.
          const resolveTreeConfig:
            | ((biomeId: string) => BiomeTreeConfig)
            | undefined = vegConfig
            ? (biomeId: string) =>
                vegConfig[biomeId] ?? getTreeConfigForBiome(biomeId)
            : undefined;

          if (querier) {
            for (let tileX = -halfTiles; tileX < halfTiles; tileX++) {
              for (let tileZ = -halfTiles; tileZ < halfTiles; tileZ++) {
                // Sample biome at tile origin — matches TerrainSystem's
                // BiomeSystem.getBiomeForTile(tileX * tileSize, tileZ * tileSize)
                const tileCenterX = tileX * editorTileSize;
                const tileCenterZ = tileZ * editorTileSize;
                const tileQuery = querier(tileCenterX, tileCenterZ);
                const tileBiome = tileQuery.biome;
                const treeConfig = resolveTreeConfig
                  ? resolveTreeConfig(tileBiome)
                  : getTreeConfigForBiome(tileBiome);

                if (!treeConfig.enabled || treeConfig.density <= 0) continue;

                const resourceCtx: ResourceGenerationContext = {
                  tileX,
                  tileZ,
                  tileKey: `${tileX}_${tileZ}`,
                  tileSize: editorTileSize,
                  waterThreshold: editorWaterThreshold,
                  getHeightAt: (wx: number, wz: number) =>
                    querier(wx, wz).height,
                  getDominantBiome: (wx: number, wz: number) =>
                    querier(wx, wz).biome,
                  resolveTreeConfig,
                  createRng: (salt: string) =>
                    _createTileRng(currentSeed, tileX, tileZ, salt),
                };

                const trees = generateTrees(resourceCtx, treeConfig);

                // ---- DIAGNOSTIC: Log tree generation for comparison with TerrainSystem ----
                const isSampleTile =
                  (tileX === 0 && tileZ === 0) ||
                  (tileX === 1 && tileZ === 0) ||
                  (tileX === 0 && tileZ === 1);
                if (isSampleTile) {
                  const sample = trees
                    .slice(0, 3)
                    .map((t: { position: unknown; subType?: string }) => {
                      const pp = t.position as {
                        x: number;
                        y: number;
                        z: number;
                      };
                      return `(${pp.x.toFixed(2)},${pp.y.toFixed(2)},${pp.z.toFixed(2)}) ${t.subType}`;
                    });
                  console.log(
                    `[WS:TREE_DIAG] tile(${tileX},${tileZ}) seed=${currentSeed} biome=${tileBiome} ` +
                      `count=${trees.length} sample=[${sample.join("; ")}]`,
                  );
                }

                for (const node of trees) {
                  const pos = node.position as {
                    x: number;
                    y: number;
                    z: number;
                  };
                  allTrees.push({
                    s: node.subType ?? "oak",
                    x: tileX * editorTileSize + pos.x,
                    y: pos.y,
                    z: tileZ * editorTileSize + pos.z,
                    sc: node.scale ?? 1,
                    r: node.rotation ?? 0,
                  });
                }
              }
            }
          }

          const genElapsed = performance.now() - genStartTime;
          console.log(
            `[refreshVegetation] Generated ${allTrees.length} trees client-side in ${genElapsed.toFixed(0)}ms (seed=${currentSeed})`,
          );

          // Vegetation filtering via shared algorithm (same code runs in
          // game client TerrainSystem so staging matches exactly).
          let trees = allTrees;
          if (exclusions) {
            const beforeCount = trees.length;
            const precomputed = precomputeExclusions(exclusions);
            trees = filterTreesByExclusions(trees, precomputed);

            console.log(
              `[refreshVegetation] Filter: ${precomputed.circles.length} circles, ` +
                `${precomputed.roadSegs.length} road segs, ${precomputed.towns.length} town gradients → ` +
                `${beforeCount} → ${trees.length} trees (removed ${beforeCount - trees.length})`,
            );
          }

          // Apply vegetation paint strokes (add/remove trees from brush tool)
          if (vegetationPaints && vegetationPaints.length > 0) {
            const currentQuerier = terrainQuerierRef.current;
            const getHeight = currentQuerier
              ? (wx: number, wz: number) => currentQuerier(wx, wz).height
              : (_wx: number, _wz: number) => 0;
            const beforePaint = trees.length;
            trees = applyVegetationPaintStrokes(
              trees,
              vegetationPaints,
              getHeight,
            );
            console.log(
              `[refreshVegetation] Vegetation paint: ${beforePaint} → ${trees.length} trees (${vegetationPaints.length} strokes)`,
            );
          }

          // Cache game-space positions so the auto-gen pipeline can avoid them
          vegetationPositionsRef.current = trees.map((t) => ({
            x: t.x,
            z: t.z,
          }));
          vegetationTreesRef.current = trees;

          // Count trees per species first so we allocate exact-size GPU buffers
          const speciesCounts = new Map<string, number>();
          for (const tree of trees) {
            const speciesId = `tree_${tree.s}`;
            speciesCounts.set(
              speciesId,
              (speciesCounts.get(speciesId) || 0) + 1,
            );
          }

          // Rebuild InstancedMeshes per species (only for species with trees)
          const speciesIds = getAllTreeSpeciesIds();
          const speciesInstanceData = new Map<
            string,
            {
              meshes: THREE.InstancedMesh[];
              manifestScale: number;
              count: number;
            }
          >();

          for (const id of speciesIds) {
            const treeCount = speciesCounts.get(id) || 0;
            if (treeCount === 0) continue; // Skip species with no trees
            const data = getTreeSpeciesInstance(id);
            if (!data || data.parts.length === 0) continue;
            const meshes = data.parts.map((part) => {
              const im = new THREE.InstancedMesh(
                part.geometry,
                part.material,
                treeCount,
              );
              im.castShadow = true;
              im.receiveShadow = true;
              return im;
            });
            speciesInstanceData.set(id, {
              meshes,
              manifestScale: data.manifestScale,
              count: 0,
            });
          }

          let totalTreeCount = 0;
          const mat = new THREE.Matrix4();
          const p = new THREE.Vector3();
          const s = new THREE.Vector3();
          const q = new THREE.Quaternion();
          const up = new THREE.Vector3(0, 1, 0);
          const offset = worldCenterOffsetRef.current;

          for (const tree of trees) {
            const speciesId = `tree_${tree.s}`;
            const sd = speciesInstanceData.get(speciesId);
            if (!sd) continue;

            p.set(tree.x + offset, tree.y, tree.z + offset);
            const fs = sd.manifestScale * tree.sc;
            s.set(fs, fs, fs);
            q.setFromAxisAngle(up, tree.r);
            mat.compose(p, q, s);

            for (const im of sd.meshes) {
              im.setMatrixAt(sd.count, mat);
            }
            sd.count++;
            totalTreeCount++;
          }

          // Finalize and stage for gradual scene addition (prevents GPU device loss)
          for (const [speciesId, data] of speciesInstanceData) {
            for (const im of data.meshes) {
              im.count = data.count;
              im.instanceMatrix.needsUpdate = true;
              resourceManager.stage({
                object: im,
                parent: vegContainer,
                onAdd: () => vegetationSpeciesMapRef.current.set(im, speciesId),
              });
            }
          }

          console.log(`[refreshVegetation] Placed ${totalTreeCount} trees`);
        },
        navigateCamera: (x: number, z: number, close?: boolean) => {
          const viewHeight = close ? 35 : 150;
          // No Z offset — camera directly above-and-in-front so target is screen-center
          cameraStateRef.current.position.set(x, viewHeight, z);
          const cam = cameraRef.current;
          if (cam) {
            cam.position.set(x, viewHeight, z);
            const controls = orbitControlsRef.current;
            if (controls) {
              controls.target.set(x, 0, z);
              controls.update();
            }
          }
        },
        wasRecentlyFlying: () => {
          const val = rmbDidFlyRef.current;
          rmbDidFlyRef.current = false; // Auto-reset on read
          return val;
        },
        getTerrainHeight: (sceneX: number, sceneZ: number): number => {
          const querier = terrainQuerierRef.current;
          if (!querier) return 0;
          const offset = worldCenterOffsetRef.current;
          return querier(sceneX - offset, sceneZ - offset).height;
        },
        enterPlayerMode: camEnterPlayerMode,
        exitPlayerMode: camExitPlayerMode,
        isPlayerMode: () => camPlayerModeRef.current,
        worldCenterOffset: worldCenterOffsetRef.current,
        queryBiome: (worldX: number, worldZ: number) => {
          const querier = terrainQuerierRef.current;
          if (!querier) return { biome: "plains", height: 0 };
          const q = querier(worldX, worldZ);
          // Return visual biome (from shader blend weights) so external
          // consumers get the biome that matches the rendered ground color
          return { biome: _getVisualBiome(q), height: q.height };
        },
        getBiomeDifficulty: (biomeId: string) => {
          const gen = generatorRef.current;
          if (!gen) return 0;
          const def = gen.getBiomeSystem().getBiomeDefinition(biomeId);
          return def?.difficultyLevel ?? 0;
        },
        get runtimeTowns() {
          return runtimeTownsRef.current;
        },
        get vegetationPositions() {
          return vegetationPositionsRef.current;
        },
        get vegetationTrees() {
          return vegetationTreesRef.current;
        },
        refreshTownMarkers: (newTowns: ProcgenTown[]) => {
          const tr = townRendererRef.current;
          if (!tr) {
            console.error(
              "[refreshTownMarkers] townRendererRef is NULL! Aborting.",
            );
            return;
          }
          const offset = worldCenterOffsetRef.current;
          const heightQuerier = terrainQuerierRef.current;
          const gen = generatorRef.current;
          const getHeight = (wx: number, wz: number): number =>
            heightQuerier
              ? heightQuerier(wx, wz).height
              : gen
                ? gen.getHeightAt(wx, wz)
                : 0;

          // Delegate to TownRenderer — handles clearing, shared materials,
          // cone/ring/pillar markers, buildings with LOD, landmarks, internal roads
          tr.refreshTowns(
            newTowns,
            offset,
            getHeight,
            (obj) => {
              if (!selectableObjectsRef.current.includes(obj)) {
                selectableObjectsRef.current.push(obj);
              }
            },
            (lod) => lodObjectsRef.current.push(lod),
          );

          // Sync runtime towns + procgen data from the renderer
          runtimeTownsRef.current = tr.runtimeTowns;
          lastProcgenTownsRef.current = tr.lastProcgenTowns;

          // Regenerate terrain tiles under/near towns so flattening takes effect.
          // Use dirty-tile mechanism instead of unload+reload to avoid blanking
          // the entire map momentarily (tiles stay visible during regen).
          if (tilesRef.current.size > 0) {
            console.log(
              `[refreshTownMarkers] Marking ${tilesRef.current.size} tiles dirty for town terrain flattening`,
            );
            const camTile = lastCameraTileRef.current;
            const dEntries: Array<{ key: string; dist: number }> = [];
            for (const [key, tile] of tilesRef.current) {
              tile.dirty = true;
              const dx = tile.tileX - camTile.tileX;
              const dz = tile.tileZ - camTile.tileZ;
              dEntries.push({ key, dist: dx * dx + dz * dz });
            }
            dEntries.sort((a, b) => a.dist - b.dist);
            dirtyTileKeysRef.current = dEntries.map((e) => e.key);
            // Force updateTiles to re-scan on next frame
            lastCameraTileRef.current.tileX = -Infinity;
          }
        },
        moveTownInScene: (
          townId: string,
          newPosition: { x: number; y: number; z: number },
        ) => {
          const tr = townRendererRef.current;
          if (!tr) return;
          const offset = worldCenterOffsetRef.current;
          const heightQuerier = terrainQuerierRef.current;
          const gen = generatorRef.current;
          const getHeight = (wx: number, wz: number): number =>
            heightQuerier
              ? heightQuerier(wx, wz).height
              : gen
                ? gen.getHeightAt(wx, wz)
                : 0;
          tr.moveTown(townId, newPosition, offset, getHeight);
          // Sync runtime towns ref from TownRenderer
          runtimeTownsRef.current = tr.runtimeTowns;
        },
        rebuildRoadRibbons: (
          roads: Array<{
            id: string;
            path: Array<{ x: number; y: number; z: number }>;
            width: number;
            connectedTowns: [string, string];
            isMainRoad: boolean;
          }>,
        ) => {
          // Eagerly update providedRoadsRef so any tile that happens to
          // regenerate before the React render uses new road data. The full
          // tile unload is handled by the useEffect (same path as wizard).
          providedRoadsRef.current = roads as GeneratedRoad[];
        },
        getLastProcgenTowns: () =>
          townRendererRef.current?.lastProcgenTowns ??
          lastProcgenTownsRef.current,
        setVegetationVisible: (visible: boolean) => {
          if (vegetationContainerRef.current) {
            vegetationContainerRef.current.visible = visible;
          }
        },
        getTerrainQuerier: () => terrainQuerierRef.current,
      });

      // ---- Pre-seed entire world with low-res tiles for instant overview ----
      // Fast path: bypass generateTile() overhead for the initial batch.
      // Saves: per-tile town flatten zone recomputation, per-tile setLoadedTiles
      // React setState, diagnostic logging, water mesh creation, and heatmap
      // notifications. Roads/mines are skipped (invisible at 8×8 from distance);
      // LOD upgrade to full-res will include them when the camera zooms in.
      const totalTileCount = worldSize * worldSize;
      if (isStudioModeRef.current && terrainQuerierRef.current) {
        const querier = terrainQuerierRef.current;
        const lowTemplate = lowResTemplateGeometryRef.current;
        const tMaterial = terrainMaterialRef.current;
        const tContainer = terrainContainerRef.current;

        const MAX_SYNC_WORLD_SIZE = 50; // 50×50 = 2,500 tiles = ~16MB at 8×8
        if (
          worldSize <= MAX_SYNC_WORLD_SIZE &&
          lowTemplate &&
          tMaterial &&
          tContainer
        ) {
          const startT = performance.now();

          // Pre-compute town flatten zones once for the entire batch
          const towns = runtimeTownsRef.current;
          const wcOffset = (worldSize * tileSize) / 2;
          let batchFlattenZones: TownFlattenZone[] | undefined;
          if (towns.length > 0) {
            batchFlattenZones = [];
            for (const t of towns) {
              const r = t.safeZoneRadius;
              batchFlattenZones.push({
                x: t.position.x,
                z: t.position.z,
                centerHeight: querier(t.position.x, t.position.z).height,
                innerRadius: r * 0.85,
                outerRadius: r * 1.4,
              });
            }
            if (batchFlattenZones.length === 0) batchFlattenZones = undefined;
          }

          const halfTile = tileSize / 2;
          const now = performance.now();
          let syncGenCount = 0;

          for (let tx = 0; tx < worldSize; tx++) {
            for (let tz = 0; tz < worldSize; tz++) {
              const key = `${tx}_${tz}`;
              if (tilesRef.current.has(key)) continue;

              // Generate geometry — skip roads/mines for speed (invisible at low-res distance)
              const { geometry, hasWater } = generateTileGeometry(
                tx,
                tz,
                lowTemplate,
                querier,
                tileSize,
                waterThreshold,
                maxHeight,
                worldSize,
                undefined, // roads — skipped for speed
                batchFlattenZones,
                undefined, // mines — skipped for speed
              );

              const mesh = new THREE.Mesh(geometry, tMaterial);
              mesh.position.set(
                tx * tileSize + halfTile,
                0,
                tz * tileSize + halfTile,
              );
              mesh.receiveShadow = true;
              mesh.userData = { tileX: tx, tileZ: tz, tileKey: key };
              tContainer.add(mesh);

              // Skip water mesh creation during pre-seed (deferred to LOD upgrade)

              tilesRef.current.set(key, {
                mesh,
                water: null,
                tileX: tx,
                tileZ: tz,
                lastAccessed: now,
                resolution: TILE_LOD_LOW_RESOLUTION,
              });
              syncGenCount++;
            }
          }

          // Single batched React state update + heatmap notification
          if (syncGenCount > 0) {
            setLoadedTiles(tilesRef.current.size);
            console.log(
              `[TileBasedTerrain] Pre-seeded ${syncGenCount} low-res tiles in ${(performance.now() - startT).toFixed(1)}ms`,
            );
          }

          // Sync path: all tiles exist immediately
          initialLoadCompleteRef.current = true;
          setInitialLoadComplete(true);
        } else {
          // Large world (or missing refs): queue-based progressive generation
          const queue = tileQueueRef.current;
          const queueSet = tileQueueSetRef.current;
          let preSeedQueued = 0;
          for (let tx = 0; tx < worldSize; tx++) {
            for (let tz = 0; tz < worldSize; tz++) {
              const key = `${tx}_${tz}`;
              if (!tilesRef.current.has(key) && !queueSet.has(key)) {
                queueSet.add(key);
                queue.push({
                  tileX: tx,
                  tileZ: tz,
                  resolution: TILE_LOD_LOW_RESOLUTION,
                });
                preSeedQueued++;
              }
            }
          }
          if (preSeedQueued > 0) {
            console.log(
              `[TileBasedTerrain] Queued ${preSeedQueued} low-res tiles for progressive world overview`,
            );
          }
          // Async path: initialLoadComplete will be set in the animation loop
        }
      } else {
        // Non-studio mode: mark as complete immediately (no loading overlay)
        initialLoadCompleteRef.current = true;
        setInitialLoadComplete(true);
      }

      // ---- Pre-frame domain logic (registered on ViewportRenderLoop) ----
      // Track camera rotation for minimap (throttled updates)
      let lastRotationUpdate = 0;
      // Pre-allocated vector for label world position query (avoids GC)
      const _labelWorldPos = new THREE.Vector3();
      // Sun direction for shadow follow — updated when ToD changes, default from initial position
      const _sunDir = new THREE.Vector3(100, 200, 100).normalize();
      // Cache last time-of-day value to skip unchanged frames
      let lastToDValue = -1;
      // Domain-specific frame counter for throttled visibility updates
      let domainFrameCounter = 0;

      // Supply LOD objects for ViewportRenderLoop's built-in throttled updates
      renderLoop.setLodObjects(lodObjectsRef.current);

      renderLoop.onFrame((deltaTime, elapsedSeconds) => {
        const now = performance.now();
        domainFrameCounter++;

        updateCameraRef.current(deltaTime);
        updateTilesRef.current(now);

        // Check if initial world load is complete (async path for large worlds).
        if (!initialLoadCompleteRef.current) {
          if (tilesRef.current.size >= totalTileCount) {
            initialLoadCompleteRef.current = true;
            setInitialLoadComplete(true);
          }
        }

        // Time-of-day lighting — only when value changes
        const todValue = timeOfDayRef.current;
        if (
          todValue !== lastToDValue &&
          sunRef.current &&
          ambientLightRef.current
        ) {
          lastToDValue = todValue;
          const di = updateSceneLighting(
            todValue,
            {
              sun: sunRef.current,
              ambient: ambientLightRef.current,
              hemisphere: hemiLightRef.current,
              fog:
                !enableSkyRef.current && scene.fog instanceof THREE.Fog
                  ? (scene.fog as THREE.Fog)
                  : null,
              background: !enableSkyRef.current
                ? (scene.background as THREE.Color)
                : null,
            },
            enableSkyRef.current,
          );
          if (enableGameFogRef.current && scene.fog instanceof THREE.Fog) {
            scene.fog.near = 400;
            scene.fog.far = 800;
            if (enableSkyRef.current) {
              updateSceneFog(di, scene.fog as THREE.Fog);
            }
          }
          _sunDir.copy(sunRef.current.position).normalize();

          // Auto-exposure — delegate lerp to ViewportRenderLoop
          renderLoop.setTargetExposure(computeTargetExposure(di));

          // Grass day/night tinting + sun direction
          if (standaloneGrassRef.current) {
            standaloneGrassRef.current.setDayIntensity(di);
            standaloneGrassRef.current.updateSunDirection(_sunDir);
          }

          // Water day/night shade + night dimming
          if (waterUniformsRef.current) {
            waterUniformsRef.current.dayIntensity.value = di;
            waterUniformsRef.current.sunIntensity.value = di * 1.8;
          }
        }

        // Standalone sky system
        if (standaloneSkyRef.current && enableSkyRef.current) {
          const dayPhase = hourToDayPhase(todValue);
          const worldTimeSec = dayPhase * DAY_CYCLE.DURATION_SEC;
          standaloneSkyRef.current.update(deltaTime, worldTimeSec);
          standaloneSkyRef.current.lateUpdate(camera.position);
        }

        // Shadow camera follow
        if (sunRef.current?.castShadow) {
          sunRef.current.position.set(
            camera.position.x + _sunDir.x * 200,
            200 + _sunDir.y * 200,
            camera.position.z + _sunDir.z * 200,
          );
          sunRef.current.target.position.set(
            camera.position.x,
            0,
            camera.position.z,
          );
          sunRef.current.target.updateMatrixWorld();
        }

        // GPU resource staging — must run BEFORE LOD updates
        resourceManager.processStaging(entitySyncRef.current);

        // Foliage queue processing + throttled visibility culling
        const foliageMgr = foliageManagerRef.current;
        if (foliageMgr && foliageMgr.isEnabled()) {
          foliageMgr.processQueue();
          if (domainFrameCounter % 10 === 0) {
            foliageMgr.updateVisibility(camera.position.x, camera.position.z);
          }
        }

        // Procedural grass — process queue + camera position
        if (standaloneGrassRef.current && enableGrassRef.current) {
          standaloneGrassRef.current.processQueue(1);
          standaloneGrassRef.current.update(camera.position);
        }

        // Water shader uniforms: time + sun direction
        if (waterUniformsRef.current) {
          waterUniformsRef.current.time.value = elapsedSeconds;
          if (sunRef.current) {
            waterUniformsRef.current.sunDirection.value
              .copy(sunRef.current.position)
              .normalize();
          }
        }

        // Entity marker visibility — progressive distance culling
        if (entitySyncRef.current && !resourceManager.areMarkersHidden) {
          const camAlt = camera.position.y;
          if (camAlt >= MARKER_HIDE_ALTITUDE) {
            entitySyncRef.current.visible = false;
          } else {
            entitySyncRef.current.visible = true;
            if (camAlt > 200 && domainFrameCounter % 30 === 0) {
              const cullDistSq = 300 * 300;
              const cx = camera.position.x;
              const cz = camera.position.z;
              for (const subGroup of entitySyncRef.current.children) {
                for (const marker of subGroup.children) {
                  if (!marker.userData?.selectable) continue;
                  const firstChild = (marker as THREE.Group).children[0];
                  if (!firstChild) continue;
                  const dx = firstChild.position.x - cx;
                  const dz = firstChild.position.z - cz;
                  marker.visible = dx * dx + dz * dz < cullDistSq;
                }
              }
            }
          }
        }

        // Animate wilderness skull (bobbing and pulsing)
        if (wildernessOverlayRef.current) {
          const wildernessGroup =
            wildernessOverlayRef.current as unknown as THREE.Group & {
              skullSprite?: THREE.Sprite;
            };
          if (wildernessGroup.skullSprite) {
            const baseY = 50;
            wildernessGroup.skullSprite.position.y =
              baseY + Math.sin(elapsedSeconds * 1.2) * 3.0;
            const scalePulse = 1.0 + Math.sin(elapsedSeconds * 0.5) * 0.05;
            wildernessGroup.skullSprite.scale.set(
              30.0 * scalePulse,
              30.0 * scalePulse,
              1,
            );
          }
        }

        // Camera rotation for minimap (throttled)
        if (!isStudioModeRef.current && now - lastRotationUpdate > 100) {
          setCameraRotationY(cameraStateRef.current.euler.y);
          lastRotationUpdate = now;
        }

        // Constant screen-space label sizing
        const LABEL_SCREEN_HEIGHT = 0.035;
        const labelTargets = [
          hoveredSelectableRef.current,
          selectedLabelRef.current,
        ];
        for (const target of labelTargets) {
          if (!target) continue;
          for (const child of target.children) {
            if (!child.userData?.isLabel || !child.visible) continue;
            const sprite = child as THREE.Sprite;
            const dist = camera.position.distanceTo(
              sprite.getWorldPosition(_labelWorldPos),
            );
            const vFov = camera.fov * (Math.PI / 180);
            const worldHeight =
              2 * dist * Math.tan(vFov / 2) * LABEL_SCREEN_HEIGHT;
            const aspect = (sprite.userData.labelAspect as number) ?? 4;
            sprite.scale.set(worldHeight * aspect, worldHeight, 1);
          }
        }
      });

      // ---- Post-render: ViewHelper overlay + GPU resource disposal ----
      renderLoop.onPostRender(() => {
        // Render ViewHelper orientation cube overlay
        if (viewHelperRef.current && rendererRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          viewHelperRef.current.render(rendererRef.current as any);
        }

        // GPU resource disposal — runs AFTER rendering every frame
        resourceManager.processDisposal();

        // Deferred GPU disposal — frees old GPU resources every frame
        processDeferredDisposalOnly();

        // Deferred additions (entity markers) — only when no pending staging work
        if (
          !resourceManager.hasStagedWork &&
          resourceManager.pendingDisposal === 0
        ) {
          processDeferredFrame();
        }
      });

      // Start the render loop
      renderLoop.start();
    };

    initRenderer();

    // Resize is handled by ViewportRenderLoop (ResizeObserver + window.resize)

    // Capture refs for cleanup
    const currentTiles = tilesRef.current;
    const currentTemplateGeometry = templateGeometryRef;
    const currentTerrainMaterial = terrainMaterialRef;
    const currentWaterMaterial = waterMaterialRef;
    const currentTownMarkers = townMarkers;

    // Cleanup
    return () => {
      document.removeEventListener("mousemove", _onMouseMove);
      document.removeEventListener("keydown", _onKeyDown);
      document.removeEventListener("keyup", _onKeyUp);
      document.removeEventListener("pointerlockchange", _onPointerLockChange);
      document.removeEventListener("mouseup", _onMouseUp);
      container.removeEventListener("click", _onClick);
      container.removeEventListener("mousedown", _onMouseDown);
      container.removeEventListener("wheel", _onWheel);
      document.removeEventListener("contextmenu", _onContextMenu, true);

      // Stop and dispose ViewportRenderLoop (stops RAF, removes canvas,
      // disconnects ResizeObserver, disposes renderer + post-processing)
      renderLoopRef.current?.dispose();
      renderLoopRef.current = null;

      // Flush staging + disposal queues — on unmount we can dispose everything
      // synchronously since the renderer is being torn down anyway.
      resourceManager.flush();

      // Dispose all tiles
      for (const [key] of currentTiles) {
        const tile = currentTiles.get(key);
        if (tile) {
          tile.mesh.geometry.dispose();
          if (tile.water) tile.water.geometry.dispose();
        }
      }
      currentTiles.clear();

      // Dispose town markers
      currentTownMarkers.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });

      // Dispose TownRenderer (releases shared materials, geometries, etc.)
      townRendererRef.current?.dispose();
      townRendererRef.current = null;

      // Dispose difficulty heatmap
      heatmapManagerRef.current?.dispose();
      heatmapManagerRef.current = null;

      // Clear building walkability tracking
      buildingWalkabilityService.clear();

      // Dispose vegetation (InstancedMesh per species + rocks)
      vegetationContainer.traverse((child) => {
        if (
          child instanceof THREE.InstancedMesh ||
          child instanceof THREE.Mesh
        ) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      clearTreeSpeciesCache();

      // Dispose manifest entity sync markers
      if (entitySyncRef.current) {
        // Remove from selectables before disposing
        for (const subGroup of entitySyncRef.current.children) {
          if (!(subGroup instanceof THREE.Group)) continue;
          for (const entity of subGroup.children) {
            const idx = selectableObjectsRef.current.indexOf(entity);
            if (idx >= 0) selectableObjectsRef.current.splice(idx, 1);
          }
        }
        disposeEntitySync(entitySyncRef.current);
        entitySyncRef.current = null;
      }
      disposeEntitySyncGeometry();

      // Dispose wilderness overlay (stored as a Group, not a Mesh)
      if (wildernessOverlayRef.current) {
        const wildernessObj =
          wildernessOverlayRef.current as unknown as THREE.Object3D;
        wildernessObj.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
            child.geometry?.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          }
        });
      }

      // Dispose foliage system
      foliageManagerRef.current?.dispose();
      foliageManagerRef.current = null;

      // Standalone sky disposal handled by `useStandaloneSky`
      // hook's effect cleanup (Phase 1.1 first carve).

      // Dispose standalone grass system
      if (standaloneGrassRef.current) {
        standaloneGrassRef.current.dispose();
        standaloneGrassRef.current = null;
      }

      // CSM shadow node disposal handled by `useShadowsCSM`
      // hook's effect cleanup (Phase 1.1 third carve).

      // Dispose shared resources
      currentTemplateGeometry.current?.dispose();
      lowResTemplateGeometryRef.current?.dispose();
      waterTemplateGeometryRef.current?.dispose();
      currentTerrainMaterial.current?.dispose();
      currentWaterMaterial.current?.dispose();
      // Dispose water textures (normalTex, flowTex, foamTex)
      if (waterTexturesRef.current) {
        waterTexturesRef.current.normalTex.dispose();
        waterTexturesRef.current.flowTex.dispose();
        waterTexturesRef.current.foamTex.dispose();
        waterTexturesRef.current = null;
      }
      lodObjectsRef.current = [];

      // Dispose orbit controls
      if (orbitControlsRef.current) {
        orbitControlsRef.current.dispose();
        orbitControlsRef.current = null;
      }

      // Renderer + post-processing disposal is handled by ViewportRenderLoop.dispose()
      // (called at the top of this cleanup function). Clear ref for safety.
      rendererRef.current = null;

      // Exit pointer lock if active
      if (document.pointerLockElement === container) {
        document.exitPointerLock();
      }
    };
  }, [
    // Only STRUCTURAL params that warrant a full scene rebuild.
    // Noise weights, maxHeight, waterThreshold, seed → handled by the
    // terrain-config effect below (clears tiles, updates generator).
    // Event handlers + animation callbacks → delegated via stable refs.
    worldSize,
    tileSize,
    tileResolution,
  ]);

  // Shadow + CSM lifecycle owned by `useShadowsCSM` hook
  // (Phase 1.1 third carve — see `hooks/useShadowsCSM.ts`).

  // Phase 6: Dynamic bloom toggle — delegates to ViewportRenderLoop
  useEffect(() => {
    renderLoopRef.current?.setBloomEnabled(enableBloom);
  }, [enableBloom]);

  // Game-fog toggle lifecycle owned by `useGameFog` hook
  // (Phase 1.1 second carve — see `hooks/useGameFog.ts`).

  // Sky lifecycle owned by `useStandaloneSky` (Phase 1.1 first
  // carve from the monolith — see `hooks/useStandaloneSky.ts`).
  // The hook installation is at the top of the component
  // alongside the other ref declarations; the animation loop
  // below reads `standaloneSkyRef` to tick the sky each frame.

  // Phase 5: Game-accurate grass toggle (EditorGrassManager)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // EditorGrassManager hardcodes a 3-channel tundra/forest/canyon
    // grass blend (same Hyperia-shaped assumption Phase C4 first
    // cut closes for the terrain shader). For non-Hyperia themed
    // projects (tropical / arctic / desert / volcanic / wetland),
    // every per-vertex weight resolves to tundraW=1, so grass
    // renders as snow over the corrected biome tints — visually
    // worse than no grass. Suppress until Phase C4 follow-up
    // ships per-pack grass textures + N-channel weights.
    const grassAllowed = enableGrass && hyperiaContentEnabledRef.current;

    if (grassAllowed) {
      const querier = terrainQuerierRef.current;
      const gen = generatorRef.current;
      const offset = worldCenterOffsetRef.current;

      // Height callback in scene-space (EditorGrassManager handles offset internally)
      const getHeight = (sceneX: number, sceneZ: number): number => {
        if (querier) return querier(sceneX - offset, sceneZ - offset).height;
        if (gen) return gen.getHeightAt(sceneX - offset, sceneZ - offset);
        return 0;
      };

      // Terrain querier (takes world-space coords, without offset)
      const editorQuerier = (terrainX: number, terrainZ: number) => {
        if (querier) return querier(terrainX, terrainZ);
        return {
          height: gen ? gen.getHeightAt(terrainX, terrainZ) : 0,
          biomeForestWeight: 0,
          biomeCanyonWeight: 0,
        };
      };

      const grass = new EditorGrassManager(scene, {
        waterThreshold: GAME_WATER_THRESHOLD,
      });
      grass.setTerrainCallbacks(editorQuerier, getHeight, offset);

      // Generate grass for all currently loaded terrain tiles
      const halfTile = tileSize / 2;
      for (const [, td] of tilesRef.current) {
        const cx = td.tileX * tileSize + halfTile;
        const cz = td.tileZ * tileSize + halfTile;
        grass.addTile(cx, cz, tileSize);
      }

      standaloneGrassRef.current = grass;

      // Disable FoliageRenderer to avoid duplicate grass instances
      foliageManagerRef.current?.setEnabled(false);
    } else {
      if (standaloneGrassRef.current) {
        standaloneGrassRef.current.dispose();
        standaloneGrassRef.current = null;
      }
      // Re-enable FoliageRenderer when StandaloneGrass is off
      foliageManagerRef.current?.setEnabled(true);
    }

    return () => {
      if (standaloneGrassRef.current) {
        standaloneGrassRef.current.dispose();
        standaloneGrassRef.current = null;
      }
    };
  }, [enableGrass, tileSize]);

  // Phase 7: Regenerate foliage when foliage paint strokes change
  const foliagePaintCount = brushOverlays?.foliagePaints?.length ?? 0;
  useEffect(() => {
    const mgr = foliageManagerRef.current;
    const querier = terrainQuerierRef.current;
    if (!mgr || !querier) return;

    // Clear all foliage and reschedule loaded tiles
    mgr.clearAll();
    for (const [, tileData] of tilesRef.current) {
      mgr.scheduleTile({
        tileX: tileData.tileX,
        tileZ: tileData.tileZ,
        tileSize,
        worldSeed: configSeedRef.current,
        querier,
        waterThreshold,
        foliagePaints: brushOverlaysRef.current?.foliagePaints,
      });
    }
  }, [foliagePaintCount, tileSize, waterThreshold]);

  // Regenerate terrain when config changes — marks existing tiles dirty for
  // incremental in-place regeneration instead of unloading everything.
  useEffect(() => {
    // Update generator and querier
    const newGenerator = new TerrainGenerator(terrainConfig);
    generatorRef.current = newGenerator;

    // If an imported heightmap querier is active, use it instead of the
    // procedural generator/game pipeline querier.
    if (importedQuerier) {
      terrainQuerierRef.current = importedQuerier;
    } else if (config.useGamePipeline) {
      const gameQuerier = createGameTerrainQuerier(config.seed);
      const heightScale = maxHeight / GAME_MAX_HEIGHT;
      const _gr: import("./terrainHelpers").TerrainQueryResult = {
        height: 0,
        biome: "forest",
        biomeForestWeight: 0,
        biomeCanyonWeight: 0,
      };
      terrainQuerierRef.current = (worldX: number, worldZ: number) => {
        const q = gameQuerier.queryPoint(worldX, worldZ);
        _gr.height = q.height * heightScale;
        _gr.biome = q.biomeId;
        _gr.color = q.biomeColor;
        _gr.biomeForestWeight = q.biomeForestWeight;
        _gr.biomeCanyonWeight = q.biomeCanyonWeight;
        return _gr;
      };
    } else {
      const _pr: import("./terrainHelpers").TerrainQueryResult = {
        height: 0,
        biome: "forest",
        biomeForestWeight: 0,
        biomeCanyonWeight: 0,
      };
      terrainQuerierRef.current = (worldX: number, worldZ: number) => {
        const q = newGenerator.queryPoint(worldX, worldZ);
        const fW =
          q.biomeInfluences?.find((b) => b.type === "forest")?.weight ?? 0;
        const cW =
          q.biomeInfluences?.find((b) => b.type === "canyon")?.weight ?? 0;
        _pr.height = q.height;
        _pr.biome = q.biome;
        _pr.biomeForestWeight = fW;
        _pr.biomeCanyonWeight = cW;
        return _pr;
      };
    }

    // Update template geometries if resolution changed
    if (templateGeometryRef.current) {
      templateGeometryRef.current.dispose();
      templateGeometryRef.current = createTemplateGeometry(
        tileSize,
        tileResolution,
      );
    }
    if (lowResTemplateGeometryRef.current) {
      lowResTemplateGeometryRef.current.dispose();
      lowResTemplateGeometryRef.current = createTemplateGeometry(
        tileSize,
        TILE_LOD_LOW_RESOLUTION,
      );
    }

    // Detect whether ONLY maxHeight changed — if so, skip dirty marking
    // because the fast-path effect (Y-scaling + normal recompute) produces
    // identical geometry without needing per-tile regeneration.
    const prev = prevTerrainEffectDepsRef.current;
    const onlyMaxHeightChanged =
      prev.seed === config.seed &&
      prev.useGamePipeline === config.useGamePipeline &&
      prev.tileSize === tileSize &&
      prev.tileResolution === tileResolution &&
      prev.importedQuerier === importedQuerier &&
      prev.maxHeight !== maxHeight;

    prevTerrainEffectDepsRef.current = {
      seed: config.seed,
      useGamePipeline: config.useGamePipeline,
      tileSize,
      tileResolution,
      maxHeight,
      terrainConfig,
      importedQuerier,
    };

    // Mark all loaded tiles as dirty for progressive in-place regeneration
    // instead of tearing them all down and rebuilding from scratch.
    // Skip dirty marking when only maxHeight changed — the fast-path handles it.
    if (tilesRef.current.size > 0 && !onlyMaxHeightChanged) {
      dirtyTileKeysRef.current = markDirtyTilesByDistance(
        tilesRef.current,
        lastCameraTileRef.current,
      );
    }

    prevMaxHeightRef.current = maxHeight;
  }, [
    terrainConfig,
    tileSize,
    tileResolution,
    config.useGamePipeline,
    config.seed,
    maxHeight,
    importedQuerier,
  ]);

  // Fast-path: when waterThreshold changes, move water planes without
  // regenerating terrain geometry. This runs in addition to the terrain config
  // effect which marks tiles dirty — the dirty regen will also update water,
  // but this gives an instant visual response before dirty tiles process.
  useEffect(() => {
    const prev = prevWaterThresholdRef.current;
    if (waterThreshold === prev) return;
    prevWaterThresholdRef.current = waterThreshold;

    // Instantly reposition all existing water meshes.
    // In studio mode there's a single world-sized water plane in the container;
    // in standalone mode each tile has its own water mesh.
    const wc = waterContainerRef.current;
    if (wc) {
      for (const child of wc.children) {
        child.position.y = waterThreshold;
      }
    }
    for (const [, tile] of tilesRef.current) {
      if (tile.water) {
        tile.water.position.y = waterThreshold;
      }
    }
  }, [waterThreshold]);

  // Fast-path: when maxHeight changes, scale vertex Y positions on all
  // loaded tiles by the ratio newMax/oldMax. Also recomputes normals so the
  // result is visually identical to a full tile regeneration — this means
  // dirty-tile regen can be skipped entirely for maxHeight-only changes.
  useEffect(() => {
    const prev = prevMaxHeightRef.current;
    if (maxHeight === prev) return;
    // prevMaxHeightRef is updated by the terrain config effect

    const scale = maxHeight / prev;
    if (!isFinite(scale) || scale === 0) return;

    for (const [, tile] of tilesRef.current) {
      rescaleVertexY(tile.mesh.geometry, scale);
    }
  }, [maxHeight]);

  // Regenerate ALL tiles when roads change so the terrain shader picks up
  // road influence (road coloring baked into terrain surface) and height
  // flattening. This is the SAME path used by the world wizard on initial
  // generation — roads update in state → prop changes → tiles regenerate.
  const prevRoadsRef = useRef<GeneratedRoad[] | undefined>(undefined);
  useEffect(() => {
    if (providedRoads === prevRoadsRef.current) return;
    prevRoadsRef.current = providedRoads;
    providedRoadsRef.current = providedRoads;
    if (!providedRoads || providedRoads.length === 0) return;
    if (tilesRef.current.size === 0) return; // No tiles loaded yet

    console.log(
      `[TileBasedTerrain] Roads changed — marking ${tilesRef.current.size} tiles dirty for ${providedRoads.length} roads`,
    );

    dirtyTileKeysRef.current = markDirtyTilesByDistance(
      tilesRef.current,
      lastCameraTileRef.current,
    );
  }, [providedRoads]);

  // Regenerate ALL tiles when mines change so the terrain shader picks up
  // mine influence (rocky floor coloring) and height flattening.
  const prevMinesRef = useRef<TileBasedTerrainProps["mines"] | undefined>(
    undefined,
  );
  useEffect(() => {
    if (providedMines === prevMinesRef.current) return;
    prevMinesRef.current = providedMines;
    runtimeMinesRef.current = providedMines;
    if (!providedMines || providedMines.length === 0) return;
    if (tilesRef.current.size === 0) return;

    console.log(
      `[TileBasedTerrain] Mines changed — marking ${tilesRef.current.size} tiles dirty for ${providedMines.length} mines`,
    );

    dirtyTileKeysRef.current = markDirtyTilesByDistance(
      tilesRef.current,
      lastCameraTileRef.current,
    );
  }, [providedMines]);

  // Notify parent of tile count changes
  useEffect(() => {
    const totalTiles = worldSize * worldSize;
    onTileCountChange?.(loadedTiles, totalTiles);
  }, [loadedTiles, worldSize, onTileCountChange]);

  // Toggle vegetation visibility
  useEffect(() => {
    if (vegetationContainerRef.current) {
      vegetationContainerRef.current.visible = showVegetation;
    }
  }, [showVegetation]);

  // Toggle difficulty heatmap visibility
  useEffect(() => {
    heatmapManagerRef.current?.setVisible(showDifficultyHeatmap);
  }, [showDifficultyHeatmap]);

  // Feed danger sources to heatmap manager
  useEffect(() => {
    if (heatmapManagerRef.current && dangerSources) {
      heatmapManagerRef.current.setDangerSources(dangerSources);
    }
  }, [dangerSources]);

  // Selection highlighting effect
  useEffect(() => {
    const scene = sceneRef.current;

    // Hide labels from previously selected entity
    if (selectedLabelRef.current) {
      for (const child of selectedLabelRef.current.children) {
        if (child.userData?.isLabel) child.visible = false;
      }
      selectedLabelRef.current = null;
    }

    if (!scene || !selectedId) {
      // Remove existing selection outline
      if (selectionOutlineRef.current) {
        scene?.remove(selectionOutlineRef.current);
        selectionOutlineRef.current.geometry.dispose();
        if (selectionOutlineRef.current.material instanceof THREE.Material) {
          selectionOutlineRef.current.material.dispose();
        }
        selectionOutlineRef.current = null;
      }
      return;
    }

    // Find the selected object
    const selectedObject = selectableObjectsRef.current.find(
      (obj) => obj.userData.selectableId === selectedId,
    );

    if (selectedObject) {
      // Show labels for selected entity (UE5 style)
      for (const child of selectedObject.children) {
        if (child.userData?.isLabel) child.visible = true;
      }
      selectedLabelRef.current = selectedObject;

      // Remove existing outline
      if (selectionOutlineRef.current) {
        scene.remove(selectionOutlineRef.current);
        selectionOutlineRef.current.geometry.dispose();
        if (selectionOutlineRef.current.material instanceof THREE.Material) {
          selectionOutlineRef.current.material.dispose();
        }
      }

      // Create outline based on object's bounding box (works for Groups and Meshes)
      const box = new THREE.Box3().setFromObject(selectedObject);
      if (box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Padding scales with object size for entities vs buildings
      const padding = Math.min(size.length() * 0.15, 2);

      // Create a wireframe box as selection indicator
      const outlineGeometry = new THREE.BoxGeometry(
        size.x + padding,
        size.y + padding,
        size.z + padding,
      );
      const outlineMaterial = new MeshBasicNodeMaterial();
      outlineMaterial.color = new THREE.Color(0x4fc3f7); // Light blue (UE5-style)
      outlineMaterial.wireframe = true;
      outlineMaterial.transparent = true;
      outlineMaterial.opacity = 0.9;
      outlineMaterial.depthTest = false;
      const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
      outline.position.copy(center);
      outline.renderOrder = 999; // Render on top

      scene.add(outline);
      selectionOutlineRef.current = outline;
    }

    return () => {
      // Cleanup on unmount or selectedId change
      if (selectionOutlineRef.current && scene) {
        scene.remove(selectionOutlineRef.current);
        selectionOutlineRef.current.geometry.dispose();
        if (selectionOutlineRef.current.material instanceof THREE.Material) {
          selectionOutlineRef.current.material.dispose();
        }
        selectionOutlineRef.current = null;
      }
    };
  }, [selectedId]);

  // Hover detection for tooltip + UE5-style label visibility
  // Throttled to max ~15fps to avoid expensive raycasts on every mousemove
  const lastHoverRaycastRef = useRef(0);
  const handleMouseMoveForHover = useCallback((event: MouseEvent) => {
    const now = performance.now();
    if (now - lastHoverRaycastRef.current < 66) return; // ~15fps throttle
    lastHoverRaycastRef.current = now;

    if (rmbFlyActiveRef.current) {
      // Hide previous hover label during fly mode
      if (hoveredSelectableRef.current) {
        for (const child of hoveredSelectableRef.current.children) {
          if (child.userData?.isLabel) child.visible = false;
        }
        hoveredSelectableRef.current = null;
      }
      setHoveredObject(null);
      return;
    }

    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    // Calculate mouse position + raycaster
    mouseEventToNdc(event, container, mouseRef.current);
    raycasterRef.current.setFromCamera(mouseRef.current, camera);

    // Check for intersections (recursive to catch building child meshes)
    const intersects = raycasterRef.current.intersectObjects(
      selectableObjectsRef.current,
      true,
    );

    if (intersects.length > 0) {
      const hit = intersects[0];
      // Walk up parent chain to find selectable group (ray may hit child mesh)
      let obj: THREE.Object3D | null = hit.object;
      let userData: Record<string, unknown> | null = null;
      while (obj) {
        const ud = obj.userData as Record<string, unknown>;
        if (ud.selectableId) {
          userData = ud;
          break;
        }
        obj = obj.parent;
      }

      if (userData && obj) {
        // Toggle label visibility — UE5 style: only show for hovered entity
        if (obj !== hoveredSelectableRef.current) {
          // Hide previous
          if (hoveredSelectableRef.current) {
            for (const child of hoveredSelectableRef.current.children) {
              if (child.userData?.isLabel) child.visible = false;
            }
          }
          // Show new (unless it's the selected item — that's handled separately)
          for (const child of obj.children) {
            if (child.userData?.isLabel) child.visible = true;
          }
          hoveredSelectableRef.current = obj;
        }

        let label = userData.selectableId as string;
        if (userData.selectableType === "town" && userData.townName) {
          label = `Town: ${userData.townName as string}`;
        } else if (
          userData.selectableType === "building" &&
          userData.buildingType
        ) {
          label = `Building: ${userData.buildingType as string}`;
        } else if (
          userData.selectableType === "entity" &&
          userData.entityType
        ) {
          const displayName = userData.displayName as string | undefined;
          label =
            displayName ??
            `${userData.entityType as string}: ${userData.entityId as string}`;
        }
        setHoveredObject(label);
        return;
      }
    }

    // No hit — hide previous hover label
    if (hoveredSelectableRef.current) {
      for (const child of hoveredSelectableRef.current.children) {
        if (child.userData?.isLabel) child.visible = false;
      }
      hoveredSelectableRef.current = null;
    }
    setHoveredObject(null);
  }, []);

  // Add hover detection to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mousemove", handleMouseMoveForHover);
    return () => {
      container.removeEventListener("mousemove", handleMouseMoveForHover);
    };
  }, [handleMouseMoveForHover]);

  // Track if fly mode is active for UI
  const [isFlyModeActive, setIsFlyModeActive] = useState(false);

  // Sync internal fly mode state with pointer lock
  useEffect(() => {
    const checkPointerLock = () => {
      setIsFlyModeActive(document.pointerLockElement === containerRef.current);
    };
    document.addEventListener("pointerlockchange", checkPointerLock);
    return () =>
      document.removeEventListener("pointerlockchange", checkPointerLock);
  }, []);

  // Remove loading overlay from DOM after fade-out animation completes
  useEffect(() => {
    if (initialLoadComplete && loadingOverlayVisible) {
      const timer = setTimeout(() => setLoadingOverlayVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [initialLoadComplete, loadingOverlayVisible]);

  const totalTiles = worldSize * worldSize;
  const loadProgress =
    totalTiles > 0 ? Math.min(loadedTiles / totalTiles, 1) : 0;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* ---- GPU recovery overlay ---- */}
      {gpuRecovering && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 pointer-events-none">
          <div className="text-center text-white">
            <div className="text-lg font-semibold mb-2">
              GPU connection lost — recovering...
            </div>
            <div className="text-sm text-gray-300">
              Attempt {gpuRecoveryCountRef.current} of 3
            </div>
          </div>
        </div>
      )}

      {/* ---- GPU permanent error ---- */}
      {gpuError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-center text-white max-w-md">
            <div className="text-lg font-semibold mb-2 text-red-400">
              GPU Error
            </div>
            <div className="text-sm text-gray-300 mb-4">{gpuError}</div>
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      )}

      {/* ---- Loading overlay — shown until all low-res tiles are seeded ---- */}
      {loadingOverlayVisible && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,17,21,0.95) 0%, rgba(10,12,16,0.98) 100%)",
            opacity: initialLoadComplete ? 0 : 1,
            transition: "opacity 0.4s ease-out",
          }}
        >
          {/* Spinner */}
          <div
            className="mb-6"
            style={{
              width: 48,
              height: 48,
              border: "3px solid rgba(255,255,255,0.1)",
              borderTopColor: "rgba(99,179,237,0.9)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />

          <div className="text-sm font-medium text-white/90 mb-1">
            Building Terrain
          </div>
          <div className="text-xs text-white/50 mb-4">
            {loadedTiles} / {totalTiles} tiles
          </div>

          {/* Progress bar */}
          <div
            className="rounded-full overflow-hidden"
            style={{
              width: 240,
              height: 4,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${loadProgress * 100}%`,
                backgroundColor: "rgba(99,179,237,0.85)",
                transition: "width 0.15s ease-out",
              }}
            />
          </div>

          {/* Inline keyframe for spinner */}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ---- Built-in HUD (hidden when World Studio provides its own overlay) ---- */}
      {!hideBuiltinOverlays && (
        <>
          {/* UE5-style camera controls overlay */}
          {isFlyModeActive ? (
            <div className="absolute top-4 left-4 rounded-lg p-3 text-xs pointer-events-none bg-blue-500/20 border border-blue-500/50 text-blue-200">
              <div className="font-semibold text-text-primary mb-2">
                Fly Mode
              </div>
              <div>WASD — Move</div>
              <div>Q / E — Down / Up</div>
              <div>
                Scroll — Speed ({Math.round(cameraStateRef.current.moveSpeed)})
              </div>
              <div className="text-text-muted mt-1">Release RMB to exit</div>
            </div>
          ) : (
            <div className="absolute top-4 left-4 bg-bg-secondary/90 rounded-lg p-3 text-xs text-text-secondary pointer-events-none">
              <div className="font-semibold text-text-primary mb-2">
                Viewport Controls
              </div>
              <div>LMB Drag — Orbit</div>
              <div>MMB Drag — Pan</div>
              <div>Scroll — Zoom</div>
              <div>RMB Hold — Fly mode</div>
              <div>F — Focus selection</div>
            </div>
          )}

          {/* Stats overlay */}
          <div className="absolute top-4 right-4 bg-bg-secondary/90 rounded-lg p-3 text-xs text-text-primary pointer-events-none">
            <div>
              Tiles: {loadedTiles} / {worldSize * worldSize}
            </div>
            <div>
              World: {worldSize * tileSize}m x {worldSize * tileSize}m
            </div>
            <div>
              Towns: {townCount} | Roads: {roadCount}
            </div>
            <div>Vegetation: {showVegetation ? "On" : "Off"}</div>
            {isGenerating && (
              <div className="text-accent-primary mt-1">Loading tiles...</div>
            )}

            {/* LOD Legend */}
            <div className="mt-2 pt-2 border-t border-border-primary">
              <div className="font-semibold mb-1">Building LOD</div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Full (0-200m)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span>Simple (200-500m)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span>Box (500m+)</span>
                </div>
              </div>
            </div>

            {/* Zone Legend */}
            <div className="mt-2 pt-2 border-t border-border-primary">
              <div className="font-semibold mb-1">Zones</div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500/50" />
                  <span>Wilderness (PVP)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hover tooltip */}
          {hoveredObject && !rmbFlyActiveRef.current && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-bg-primary/95 border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary pointer-events-none shadow-lg">
              {hoveredObject}
              <span className="text-text-muted ml-2">(click to select)</span>
            </div>
          )}

          {/* Selected item indicator */}
          {selectedId && (
            <div className="absolute bottom-4 right-4 bg-green-500/20 border border-green-500/50 rounded-lg px-3 py-2 text-sm text-green-400 pointer-events-none">
              Selected: {selectedId}
            </div>
          )}
        </>
      )}

      {/* Minimap — hidden in World Studio (it provides its own overlay controls) */}
      {!hideBuiltinOverlays && (
        <Minimap
          worldSize={worldSize * tileSize}
          cameraPosition={cameraStateRef.current.position}
          cameraRotationY={cameraRotationY}
          towns={minimapTowns}
          roads={minimapRoads}
          className="absolute bottom-4 left-4"
          onNavigate={(x, z) => {
            const newY = Math.max(cameraStateRef.current.position.y, 100);
            cameraStateRef.current.position.set(x, newY, z);
            const cam = cameraRef.current;
            if (cam) {
              cam.position.set(x, newY, z);
              const ctrl = orbitControlsRef.current;
              if (ctrl) {
                ctrl.target.set(x, 0, z);
                ctrl.update();
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default TileBasedTerrain;
