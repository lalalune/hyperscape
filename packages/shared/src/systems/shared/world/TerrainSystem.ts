import type { World } from "../../../types";
import type { WorldChunkData } from "../../../types/network/database";
import {
  geometryToPxMesh,
  PMeshHandle,
} from "../../../extras/three/geometryToPxMesh";
import THREE, { MeshStandardNodeMaterial } from "../../../extras/three/three";
import { System } from "../infrastructure/System";
import { EventType } from "../../../types/events";
import { NoiseGenerator } from "../../../utils/NoiseGenerator";
import { InstancedMeshManager } from "../../../utils/rendering/InstancedMeshManager";
import { CollisionMask } from "../movement/CollisionFlags";
import { worldToTile } from "../movement/TileSystem";
import {
  generateTerrainTilesBatch,
  terminateTerrainWorkerPool,
  type TerrainWorkerConfig,
  type TerrainWorkerOutput,
} from "../../../utils/workers";
import {
  CONTINENT_LAYER,
  RIDGE_LAYER,
  HILL_LAYER,
  EROSION_LAYER,
  DETAIL_LAYER,
  HEIGHT_POWER_CURVE,
  ISLAND_RADIUS,
  ISLAND_FALLOFF,
  ISLAND_DEEP_OCEAN_BUFFER,
  BASE_ELEVATION,
  OCEAN_FLOOR_HEIGHT,
  HEIGHT_TERRAIN_MIX,
  POND_RADIUS,
  POND_DEPTH,
  POND_CENTER_X,
  POND_CENTER_Z,
  COASTLINE_CIRCLE_SAMPLE_RADIUS,
  COAST_LARGE,
  COAST_MEDIUM,
  COAST_SMALL,
  MOUNTAIN_BOOST_MAX_NORM_DIST,
  MOUNTAIN_BOOST_GAUSSIAN_COEFF,
} from "./TerrainHeightParams";

// Import terrain generator from procgen package
import {
  TerrainGenerator,
  type TerrainConfig,
  type BiomeDefinition,
} from "@hyperscape/procgen/terrain";

/**
 * Terrain System
 *
 * Specifications:
 * - 100x100m tiles (100m x 100m each)
 * - 100x100 world grid = 10km x 10km total world
 * - Only load current tile + adjacent tiles (3x3 = 9 tiles max)
 * - Procedural heightmap generation with biomes
 * - PhysX collision support
 * - Resource placement and road generation
 */

import type { BiomeData } from "../../../types/core/core";
import type { BiomeTreeConfig } from "../../../types/world/world-types";
import type {
  ResourceNode,
  TerrainTile,
  FlatZone,
} from "../../../types/world/terrain";
import type { RoadTileSegment } from "../../../types/world/world-types";
import { PhysicsHandle } from "../../../types/systems/physics";
import { getPhysX } from "../../../physics/PhysXManager";
import { Layers } from "../../../physics/Layers";
import { BIOMES } from "../../../data/world-structure";
import { ALL_WORLD_AREAS } from "../../../data/world-areas";
import { getDuelArenaConfig } from "../../../data/duel-manifest";
import { DataManager } from "../../../data/DataManager";
// NOTE: Import directly to avoid circular dependency through barrel file
import { WaterSystem } from "./WaterSystem";
import {
  generateTrees,
  generateOres,
  generateRocks,
  // generatePlants, // DISABLED - plants not working/looking good yet
  type ResourceGenerationContext,
} from "./BiomeResourceGenerator";
import {
  setProcgenRockWorld,
  addRockInstance,
  preWarmRockCache,
  BIOME_ROCK_PRESETS,
} from "./ProcgenRockCache";
import { ProcgenRockInstancer } from "./ProcgenRockInstancer";
// Plants disabled - not working/looking good yet
// import {
//   setProcgenPlantWorld,
//   addPlantInstance,
//   preWarmPlantCache,
//   BIOME_PLANT_PRESETS,
// } from "./ProcgenPlantCache";
import { ProcgenPlantInstancer } from "./ProcgenPlantInstancer"; // Still needed for cleanup
import { stationDataProvider } from "../../../data/StationDataProvider";
import { resolveFootprint } from "../../../types/game/resource-processing-types";
import {
  MAX_VERTEX_LIGHTS,
  type VertexLight,
  updateTerrainVertexLights,
  createTerrainMaterial,
  TerrainUniforms,
} from "./TerrainShader";
import { isLamppostLightTextureReady } from "./LamppostLightMask";
import type { RoadNetworkSystem } from "./RoadNetworkSystem";
import type { TownSystem } from "./TownSystem";
import { TERRAIN_CONSTANTS } from "../../../constants/GameConstants";
import {
  TerrainComputeContext,
  isTerrainComputeAvailable,
  type GPURoadSegment,
} from "../../../utils/compute";

// Road influence blending - used for shader's roadInfluence attribute
const ROAD_BLEND_WIDTH = 0.5; // Extra blend distance beyond road width (meters)
const TERRAIN_ROAD_INFLUENCE_DEBUG =
  process.env.TERRAIN_ROAD_INFLUENCE_DEBUG === "true";
const TERRAIN_TIMING_DEBUG = process.env.TERRAIN_TIMING_DEBUG === "true";
/** Maximum entries retained in pendingSerializationData to prevent unbounded growth */
const MAX_PENDING_SERIALIZATION_ENTRIES = 100;

// Lamppost vertex lighting (terrain-only, GPU shader accumulation)
const LAMP_VERTEX_LIGHT_RANGE = 12;
const LAMP_VERTEX_LIGHT_INTENSITY = 0.8;
const LAMP_VERTEX_LIGHT_COLOR = new THREE.Color(1.0, 0.9, 0.6);
const LAMP_LIGHT_UPDATE_INTERVAL_SEC = 0.4;
const LAMP_LIGHT_SEARCH_RANGE = 45;

interface BiomeCenter {
  x: number;
  z: number;
  type: string;
  influence: number;
}

type DifficultySample = {
  level: number;
  scalar: number;
  biome: string;
  difficultyTier: number;
  isSafe: boolean;
};

type BossHotspot = {
  id: string;
  x: number;
  z: number;
  radius: number;
  minLevel: number;
  maxLevel: number;
  seed: number;
};

export class TerrainSystem extends System {
  private terrainTiles = new Map<string, TerrainTile>();
  private terrainContainer!: THREE.Group;

  // Flat zones for terrain flattening under stations
  private flatZones = new Map<string, FlatZone>();
  private flatZonesByTile = new Map<string, FlatZone[]>(); // Spatial index by terrain tile
  private _flatZoneChecked = new Set<string>(); // PERF: reusable dedup set for flat zone queries
  private _pendingTileRegeneration = new Set<string>(); // Tracks tiles being regenerated to avoid duplicates
  private _queuedTileRegenerations = new Map<
    string,
    { x: number; z: number; reason: "flat_zone" | "road" | "other" }
  >();
  private _tileRegenerationFlushId?: ReturnType<typeof setTimeout>;
  public instancedMeshManager!: InstancedMeshManager;
  private _terrainInitialized = false;
  private _initialTilesReady = false; // Track when initial tiles are loaded
  private lastPlayerTile = { x: 0, z: 0 };
  private updateTimer = 0;
  private terrainTime = 0; // For animated caustics
  private noise!: NoiseGenerator;
  private biomeCenters: BiomeCenter[] = [];
  private biomeWeightScratch = new Map<string, number>();
  private databaseSystem!: {
    saveWorldChunk(chunkData: WorldChunkData): void;
  }; // DatabaseSystem reference

  // Terrain shader material (shared across all tiles)
  // On client: full material with terrainUniforms for visual rendering
  // On server: basic placeholder material (no uniforms needed)
  private terrainMaterial?:
    | THREE.Material
    | (THREE.Material & {
        terrainUniforms: TerrainUniforms;
      });
  private chunkSaveInterval?: NodeJS.Timeout;
  private terrainUpdateIntervalId?: NodeJS.Timeout;
  private serializationIntervalId?: NodeJS.Timeout;
  private boundingBoxIntervalId?: NodeJS.Timeout;
  /** Timeout ID for fallback terrain generation if ROADS_GENERATED event is delayed */
  private roadsTimeoutId?: NodeJS.Timeout;
  private activeChunks = new Set<string>();

  private coreChunkRange = 2; // 9 core chunks (5x5 grid)
  private ringChunkRange = 3; // Additional ring around core chunks
  private terrainOnlyChunkRange = 5; // Furthest ring with only terrain geometry
  private unloadPadding = 1; // Hysteresis padding for unloading beyond ring range
  private playerChunks = new Map<string, Set<string>>(); // player -> chunk keys
  private simulatedChunks = new Set<string>(); // chunks with active simulation
  private isGenerating = false; // Track if terrain generation is in progress
  private chunkPlayerCounts = new Map<string, number>(); // chunk -> player count
  // Smooth generation queue to avoid main-thread spikes when player moves
  private pendingTileKeys: string[] = [];
  private pendingTileSet = new Set<string>();
  private pendingCollisionKeys: string[] = [];
  private pendingCollisionSet = new Set<string>();
  private maxTilesPerFrame = 2; // cap tiles generated per frame
  private generationBudgetMsPerFrame = 6; // time budget per frame (ms)
  // Pending resource instance creation (deferred to spread across frames)
  // Uses index-based dequeue to avoid O(n) shift() operations
  private pendingResourceInstances: Array<{
    tile: TerrainTile;
    resourceIndex: number;
  }> = [];
  private pendingResourceHead = 0; // Index of next item to process
  private maxResourceInstancesPerFrame = 10; // Process 10 resource instances per frame
  private _tempVec3 = new THREE.Vector3();
  private _tempVec3_2 = new THREE.Vector3();
  private _tempVec2 = new THREE.Vector2();
  private _tempVec2_2 = new THREE.Vector2();
  private _tempVec2_3 = new THREE.Vector2(); // For road distance calculations
  private _tempBox3 = new THREE.Box3();
  private _tempColor = new THREE.Color(); // For biome color parsing
  private _spectatorFocusPos = new THREE.Vector3();
  private lamppostLightUpdateTimer = 0;
  private lamppostActiveLights: VertexLight[] = [];
  private lamppostLightIndices: number[] = [];
  private lamppostLightDistances: number[] = [];
  private waterSystem?: WaterSystem;
  private roadNetworkSystem?: RoadNetworkSystem;
  private _cachedRoadTileX = Number.NaN;
  private _cachedRoadTileZ = Number.NaN;
  private _cachedRoadSegments: ReadonlyArray<RoadTileSegment> = [];
  private townSystem: TownSystem | null = null;
  private bossHotspots: BossHotspot[] = [];

  // GPU compute context for accelerated terrain operations
  private terrainComputeContext: TerrainComputeContext | null = null;
  private gpuComputeAvailable = false;

  // Unified terrain generator from @hyperscape/procgen
  // Provides deterministic height/biome calculation independent of rendering
  private terrainGenerator!: TerrainGenerator;

  // PERFORMANCE: Template geometry and pre-allocated buffers for tile creation
  private templateGeometry: THREE.PlaneGeometry | null = null;
  private templateColors: Float32Array | null = null;
  private templateBiomeIds: Float32Array | null = null;
  // PERFORMANCE: Pre-allocated overflow height grid for normal computation
  // Size = (TILE_RESOLUTION + 2)^2 — one extra row/column on each side for centered differences
  private _overflowHeightGrid: Float32Array | null = null;

  // Serialization system
  private lastSerializationTime = 0;
  private serializationInterval = 15 * 60 * 1000; // 15 minutes in milliseconds
  private worldStateVersion = 1;
  private pendingSerializationData = new Map<
    string,
    {
      key: string;
      tileX: number;
      tileZ: number;
      biome: string;
      heightData?: number[];
      resourceStates: Array<{
        id: string;
        type: string;
        position: [number, number, number];
      }>;
      roadData: Array<{
        start: [number, number];
        end: [number, number];
        width: number;
      }>;
      playerCount: number;
      lastActiveTime?: Date;
      isSimulated: boolean;
      worldStateVersion: number;
      timestamp: number;
    }
  >();

  // Bounding box verification
  private worldBounds = {
    minX: -1000,
    maxX: 1000,
    minZ: -1000,
    maxZ: 1000,
    minY: -50,
    maxY: 100,
  };
  private terrainBoundingBoxes = new Map<string, THREE.Box3>();
  tileSize: number = 0;
  private runtimeIsServer = false;
  private runtimeIsClient = false;
  private readonly serverMeshCollisionEnabled = (() => {
    if (typeof process === "undefined") return false;
    const raw = process.env.TERRAIN_SERVER_MESH_COLLISION_ENABLED;
    if (raw != null && raw !== "") {
      return raw === "true";
    }
    return process.env.NODE_ENV === "production";
  })();

  // Deterministic noise seeding
  private computeSeedFromWorldId(): number {
    // Check for explicit seed in world config or environment
    const worldConfig = (this.world as { config?: { terrainSeed?: number } })
      .config;
    if (worldConfig?.terrainSeed !== undefined) {
      return worldConfig.terrainSeed;
    }

    // Check environment variable
    if (typeof process !== "undefined" && process.env?.TERRAIN_SEED) {
      const envSeed = parseInt(process.env.TERRAIN_SEED, 10);
      if (!isNaN(envSeed)) {
        return envSeed;
      }
    }

    // Always use fixed seed of 0 for deterministic terrain on both client and server
    const FIXED_SEED = 0;
    return FIXED_SEED;
  }

  private resolveRuntimeRole(): { isServer: boolean; isClient: boolean } {
    const hasWindow = typeof window !== "undefined";
    const isNodeOrBunRuntime =
      typeof process !== "undefined" &&
      !!process.versions &&
      (typeof process.versions.node === "string" ||
        typeof (process.versions as { bun?: string }).bun === "string");
    const networkIsServer = this.world.network?.isServer === true;
    const networkIsClient = this.world.network?.isClient === true;

    const isServer = networkIsServer || (!hasWindow && isNodeOrBunRuntime);
    const isClient = !isServer && (networkIsClient || hasWindow);
    return { isServer, isClient };
  }

  private getActiveWorldSizeTiles(): number {
    if (!this.CONFIG.ISLAND_MASK_ENABLED) {
      return this.CONFIG.WORLD_SIZE;
    }

    const maxTiles = this.CONFIG.ISLAND_MAX_WORLD_SIZE_TILES;
    return maxTiles > 0 ? maxTiles : this.CONFIG.WORLD_SIZE;
  }

  private getActiveWorldSizeMeters(): number {
    return this.getActiveWorldSizeTiles() * this.CONFIG.TILE_SIZE;
  }

  /**
   * Load terrain textures and create the shared terrain material.
   * Automatically uses KTX2 GPU-compressed textures when available.
   *
   * This material includes road influence support via the roadInfluence vertex attribute.
   * No fallback material - roads require the full shader to render correctly.
   */
  private initTerrainMaterial(): void {
    // Create the shared terrain material (uses procedural OSRS-style colors, no textures needed)
    // This material reads the roadInfluence attribute and blends road colors
    this.terrainMaterial = createTerrainMaterial();

    // Setup for CSM shadows
    if (this.world.setupMaterial) {
      this.world.setupMaterial(this.terrainMaterial);
    }

    console.log(
      "[TerrainSystem] Terrain material created with road influence support",
    );
  }

  /**
   * Get the terrain material.
   * On client: returns the full terrain shader material (must call initTerrainMaterial() first).
   * On server: returns a basic placeholder material since server doesn't render visuals.
   */
  private getTerrainMaterial(): THREE.Material {
    if (!this.terrainMaterial) {
      // Server doesn't need visual materials - just a placeholder for mesh creation
      // Road data is stored in geometry attributes, not in the material
      if (!this.runtimeIsClient) {
        this.terrainMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 });
        return this.terrainMaterial;
      }
      throw new Error(
        "[TerrainSystem] Terrain material not initialized. " +
          "initTerrainMaterial() must be called before creating terrain tiles.",
      );
    }
    return this.terrainMaterial;
  }

  /**
   * Get the terrain material with uniforms for external access (e.g., minimap fog control)
   * Returns null on server since server uses a basic material without uniforms.
   */
  public getTerrainMaterialWithUniforms():
    | (THREE.Material & {
        terrainUniforms: TerrainUniforms;
      })
    | null {
    if (!this.terrainMaterial) return null;
    // Check if material has terrainUniforms (client-only)
    if ("terrainUniforms" in this.terrainMaterial) {
      return this.terrainMaterial as THREE.Material & {
        terrainUniforms: TerrainUniforms;
      };
    }
    return null;
  }

  /**
   * Create a deterministic PRNG for a given tile and salt.
   * Ensures identical resource placement across clients and worlds for the same seed.
   */
  private createTileRng(
    tileX: number,
    tileZ: number,
    salt: string,
  ): () => number {
    // Mix world seed, tile coords, and salt into a 32-bit state
    const baseSeed = this.computeSeedFromWorldId() >>> 0;
    // Simple string hash (djb2 variant) for salt
    let saltHash = 5381 >>> 0;
    for (let i = 0; i < salt.length; i++) {
      saltHash = (((saltHash << 5) + saltHash) ^ salt.charCodeAt(i)) >>> 0;
    }
    let state =
      (baseSeed ^
        ((tileX * 73856093) >>> 0) ^
        ((tileZ * 19349663) >>> 0) ^
        saltHash) >>>
      0;

    return () => {
      // LCG parameters (Numerical Recipes)
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
  }

  public createDeterministicRng(
    tileX: number,
    tileZ: number,
    salt: string,
  ): () => number {
    return this.createTileRng(tileX, tileZ, salt);
  }

  /**
   * Queue a tile for generation if not already queued or present
   */
  private enqueueTileForGeneration(
    tileX: number,
    tileZ: number,
    _generateContent = true,
  ): void {
    const key = `${tileX}_${tileZ}`;
    if (this.terrainTiles.has(key) || this.pendingTileSet.has(key)) return;
    this.pendingTileSet.add(key);
    this.pendingTileKeys.push(key);

    // Also queue for worker pre-computation if enabled (client-side only)
    if (
      this.runtimeIsClient &&
      this.CONFIG.USE_WORKERS &&
      !this.pendingWorkerResults.has(key)
    ) {
      this.pendingWorkerTiles.push({ tileX, tileZ });
    }
  }

  /** Tiles waiting to be sent to workers for pre-computation */
  private pendingWorkerTiles: Array<{ tileX: number; tileZ: number }> = [];

  /**
   * Public API: Request prefetch of a tile for speculative loading.
   * Used by VegetationSystem to pre-generate tiles in the direction of player movement.
   * This queues the tile for generation at low priority (after immediate tiles).
   *
   * @param tileX - Tile X coordinate
   * @param tileZ - Tile Z coordinate
   */
  prefetchTile(tileX: number, tileZ: number): void {
    const key = `${tileX}_${tileZ}`;

    if (this.terrainTiles.has(key) || this.pendingTileSet.has(key)) {
      return;
    }

    // Add to worker pre-computation queue first (background processing)
    if (
      this.runtimeIsClient &&
      this.CONFIG.USE_WORKERS &&
      !this.pendingWorkerResults.has(key)
    ) {
      // Check if not already in worker queue
      const alreadyQueued = this.pendingWorkerTiles.some(
        (t) => t.tileX === tileX && t.tileZ === tileZ,
      );
      if (!alreadyQueued) {
        this.pendingWorkerTiles.push({ tileX, tileZ });
      }
    }

    // Enqueue for generation (will be processed when budget allows)
    this.enqueueTileForGeneration(tileX, tileZ, true);
  }

  /**
   * Process queued tile generations within per-frame time and count budgets
   * Prefers using pre-computed worker data when available
   */
  private processTileGenerationQueue(): void {
    if (this.pendingTileKeys.length === 0) return;
    const nowFn =
      typeof performance !== "undefined" && performance.now
        ? () => performance.now()
        : () => Date.now();
    const start = nowFn();
    let generated = 0;
    while (this.pendingTileKeys.length > 0) {
      if (generated >= this.maxTilesPerFrame) break;
      if (nowFn() - start > this.generationBudgetMsPerFrame) break;
      const key = this.pendingTileKeys.shift()!;
      this.pendingTileSet.delete(key);
      const [x, z] = key.split("_").map(Number);

      // Check if we have pre-computed worker data for this tile
      const workerData = this.pendingWorkerResults.get(key);
      const _tStart = performance.now();
      if (workerData) {
        const geometry = this.createTileGeometryFromWorkerData(workerData);
        this.createTileFromGeometryWithResources(x, z, geometry);
        this.pendingWorkerResults.delete(key);
        if (TERRAIN_TIMING_DEBUG) {
          console.debug(
            `[TerrainTiming] worker tile ${key}: ${(performance.now() - _tStart).toFixed(1)}ms`,
          );
        }
      } else {
        this.generateTile(x, z);
        if (TERRAIN_TIMING_DEBUG) {
          console.debug(
            `[TerrainTiming] sync tile ${key}: ${(performance.now() - _tStart).toFixed(1)}ms`,
          );
        }
      }
      generated++;
    }
  }

  /**
   * Dispatch pending tiles to workers for pre-computation
   * Called each frame to keep workers busy
   */
  private dispatchWorkerBatch(): void {
    if (
      this.pendingWorkerTiles.length === 0 ||
      this.workerBatchInProgress ||
      !this.CONFIG.USE_WORKERS
    ) {
      return;
    }

    // Take a batch of tiles to process
    const batchSize = Math.min(this.pendingWorkerTiles.length, 9); // Up to 9 tiles (3x3)
    const batch = this.pendingWorkerTiles.splice(0, batchSize);

    // Filter out tiles that already have results
    const tilesToProcess = batch.filter(
      (t) => !this.pendingWorkerResults.has(`${t.tileX}_${t.tileZ}`),
    );

    if (tilesToProcess.length === 0) {
      return;
    }

    // Fire and forget - don't await, let it run in background
    this.precomputeTilesWithWorker(tilesToProcess).catch((err) => {
      console.warn("[TerrainSystem] Worker batch error:", err);
    });
  }

  private processCollisionGenerationQueue(): void {
    if (!this.serverMeshCollisionEnabled) return;
    if (this.pendingCollisionKeys.length === 0 || !this.world.network?.isServer)
      return;

    const key = this.pendingCollisionKeys.shift()!;
    this.pendingCollisionSet.delete(key);

    const tile = this.terrainTiles.get(key);
    if (!tile || tile.collision) return;

    const geometry = tile.mesh.geometry;
    const transformedGeometry = geometry.clone();
    transformedGeometry.translate(
      tile.x * this.CONFIG.TILE_SIZE,
      0,
      tile.z * this.CONFIG.TILE_SIZE,
    );

    const meshHandle = geometryToPxMesh(this.world, transformedGeometry, false);
    if (meshHandle) {
      tile.collision = meshHandle;
    }

    // Avoid leaked cloned geometry
    transformedGeometry.dispose();
  }

  /**
   * Process pending resource instance creation queue.
   * Spreads instance creation across frames to prevent hitches.
   * Uses index-based dequeue to avoid O(n) shift() operations.
   */
  private processResourceInstanceQueue(): void {
    const queueLength = this.pendingResourceInstances.length;
    if (this.pendingResourceHead >= queueLength) {
      // Queue exhausted - reset for next batch
      if (queueLength > 0) {
        this.pendingResourceInstances.length = 0;
        this.pendingResourceHead = 0;
      }
      return;
    }

    let processed = 0;
    while (
      this.pendingResourceHead < queueLength &&
      processed < this.maxResourceInstancesPerFrame
    ) {
      const item = this.pendingResourceInstances[this.pendingResourceHead++];
      const { tile, resourceIndex } = item;

      // Tile may have been unloaded
      if (!this.terrainTiles.has(tile.key)) continue;
      if (resourceIndex >= tile.resources.length) continue;

      const resource = tile.resources[resourceIndex];
      if (resource.instanceId != null) continue;

      // Skip tree types - they're rendered by ProcgenTreeInstancer with proper models
      // (the InstancedMeshManager only creates placeholder green boxes for trees)
      if (resource.type === "tree") continue;

      // Create the instance
      this._tempVec3.set(
        tile.x * this.CONFIG.TILE_SIZE + resource.position.x,
        resource.position.y,
        tile.z * this.CONFIG.TILE_SIZE + resource.position.z,
      );

      const instanceId = this.instancedMeshManager.addInstance(
        resource.type,
        resource.id,
        this._tempVec3,
      );

      if (instanceId !== null) {
        resource.instanceId = instanceId;
        resource.meshType = resource.type;

        // Emit resource created event
        this.world.emit(EventType.RESOURCE_MESH_CREATED, {
          mesh: undefined,
          instanceId: instanceId,
          resourceId: resource.id,
          resourceType: resource.type === "ore" ? "mining_rock" : resource.type,
          worldPosition: {
            x: this._tempVec3.x,
            y: this._tempVec3.y,
            z: this._tempVec3.z,
          },
        });
      }

      processed++;
    }
  }

  /**
   * Queue resource instances for deferred creation.
   * Called by generateTile/createTileFromGeometryWithResources.
   */
  private queueResourceInstances(tile: TerrainTile): void {
    for (let i = 0; i < tile.resources.length; i++) {
      const resource = tile.resources[i];
      if (resource.instanceId != null) continue;
      this.pendingResourceInstances.push({ tile, resourceIndex: i });
    }
  }

  /**
   * Pre-compute terrain data for multiple tiles using web workers
   *
   * This offloads the heavy noise/heightmap calculations to worker threads,
   * allowing parallel processing across CPU cores while keeping the main thread
   * free for rendering and input handling.
   *
   * @param tiles - Array of tile coordinates to pre-compute
   * @returns Promise that resolves when all tiles are computed
   */
  async precomputeTilesWithWorker(
    tiles: Array<{ tileX: number; tileZ: number }>,
  ): Promise<void> {
    // Workers only available on client and when enabled
    if (!this.runtimeIsClient || !this.CONFIG.USE_WORKERS) {
      return;
    }

    if (this.workerBatchInProgress) {
      return;
    }

    // Filter out tiles that are already computed or have pending results
    const tilesToProcess = tiles.filter((t) => {
      const key = `${t.tileX}_${t.tileZ}`;
      return !this.terrainTiles.has(key) && !this.pendingWorkerResults.has(key);
    });

    if (tilesToProcess.length === 0) {
      return;
    }

    this.workerBatchInProgress = true;

    try {
      // Build worker config from current CONFIG
      // MUST match TerrainWorkerConfig interface exactly
      const workerConfig: TerrainWorkerConfig = {
        TILE_SIZE: this.CONFIG.TILE_SIZE,
        TILE_RESOLUTION: this.CONFIG.TILE_RESOLUTION,
        MAX_HEIGHT: this.CONFIG.MAX_HEIGHT,
        // Biome calculation - MUST match getBiomeInfluencesAtPosition()
        BIOME_GAUSSIAN_COEFF: this.CONFIG.BIOME_GAUSSIAN_COEFF,
        BIOME_BOUNDARY_NOISE_SCALE: this.CONFIG.BIOME_BOUNDARY_NOISE_SCALE,
        BIOME_BOUNDARY_NOISE_AMOUNT: this.CONFIG.BIOME_BOUNDARY_NOISE_AMOUNT,
        MOUNTAIN_HEIGHT_THRESHOLD: this.CONFIG.MOUNTAIN_HEIGHT_THRESHOLD,
        MOUNTAIN_WEIGHT_BOOST: this.CONFIG.MOUNTAIN_WEIGHT_BOOST,
        VALLEY_HEIGHT_THRESHOLD: this.CONFIG.VALLEY_HEIGHT_THRESHOLD,
        VALLEY_WEIGHT_BOOST: this.CONFIG.VALLEY_WEIGHT_BOOST,
        // Mountain height boost - MUST match getHeightAtWithoutShore()
        MOUNTAIN_HEIGHT_BOOST: this.CONFIG.MOUNTAIN_HEIGHT_BOOST,
        // Shoreline config - MUST match getHeightAt() and createTileGeometry()
        WATER_THRESHOLD: this.CONFIG.WATER_THRESHOLD,
        WATER_LEVEL_NORMALIZED: this.CONFIG.WATER_LEVEL_NORMALIZED,
        SHORELINE_THRESHOLD: this.CONFIG.SHORELINE_THRESHOLD,
        SHORELINE_STRENGTH: this.CONFIG.SHORELINE_STRENGTH,
        // Shoreline slope adjustment - MUST match adjustHeightForShoreline()
        SHORELINE_MIN_SLOPE: this.CONFIG.SHORELINE_MIN_SLOPE,
        SHORELINE_SLOPE_SAMPLE_DISTANCE:
          this.CONFIG.SHORELINE_SLOPE_SAMPLE_DISTANCE,
        SHORELINE_LAND_BAND: this.CONFIG.SHORELINE_LAND_BAND,
        SHORELINE_LAND_MAX_MULTIPLIER:
          this.CONFIG.SHORELINE_LAND_MAX_MULTIPLIER,
        SHORELINE_UNDERWATER_BAND: this.CONFIG.SHORELINE_UNDERWATER_BAND,
        UNDERWATER_DEPTH_MULTIPLIER: this.CONFIG.UNDERWATER_DEPTH_MULTIPLIER,
      };

      // Build simplified biome data for worker
      const biomeData: Record<
        string,
        { heightModifier: number; color: { r: number; g: number; b: number } }
      > = {};
      for (const [name, biome] of Object.entries(BIOMES)) {
        const color = new THREE.Color(biome.color);
        biomeData[name] = {
          // Use terrainMultiplier from BiomeData as heightModifier for worker
          heightModifier: biome.terrainMultiplier || 1,
          color: { r: color.r, g: color.g, b: color.b },
        };
      }

      // Generate terrain data in parallel using workers
      const batchResult = await generateTerrainTilesBatch(
        tilesToProcess,
        workerConfig,
        this.computeSeedFromWorldId(),
        this.biomeCenters,
        biomeData,
      );

      // Check if workers were actually available
      if (!batchResult.workersAvailable) {
        console.warn(
          "[TerrainSystem] Workers not available, tiles will use synchronous generation",
        );
        // Tiles will be generated synchronously via the normal queue
        return;
      }

      // Check if any tiles failed
      if (batchResult.failedCount > 0) {
        console.warn(
          `[TerrainSystem] ${batchResult.failedCount} tiles failed in worker, will retry synchronously`,
        );
      }

      // Store successful results for later geometry creation
      for (const result of batchResult.results) {
        this.pendingWorkerResults.set(result.tileKey, result);
      }
    } catch (error) {
      console.error("[TerrainSystem] Worker batch failed:", error);
    } finally {
      this.workerBatchInProgress = false;
    }
  }

  /**
   * Create tile geometry from pre-computed worker data.
   *
   * Worker now computes heights (with shoreline) and normals (from overflow
   * grid). For tiles WITHOUT flat zones we use worker data directly, avoiding
   * all main-thread noise evaluation. When flat zones overlap the tile we fall
   * back to main-thread height + normal recomputation so flat zone heights are
   * respected.
   */
  private createTileGeometryFromWorkerData(
    workerData: TerrainWorkerOutput,
  ): THREE.PlaneGeometry {
    const { tileX, tileZ, colorData, biomeData, normalData } = workerData;

    const template = this.getOrCreateTemplateGeometry();
    const geometry = template.clone();

    const positions = geometry.attributes.position;
    const roadInfluences = new Float32Array(positions.count);

    const tileKey = `${tileX}_${tileZ}`;
    const hasFlatZones = (this.flatZonesByTile.get(tileKey)?.length ?? 0) > 0;

    let heightData: Float32Array;

    if (hasFlatZones) {
      // Flat zones are dynamic (buildings/stations) and not known to the
      // worker. Recompute all heights on the main thread so flat zone
      // overrides are applied, then derive normals via the overflow grid.
      heightData = new Float32Array(positions.count);
      for (let i = 0; i < positions.count; i++) {
        const localX = positions.getX(i);
        const localZ = positions.getZ(i);
        const worldX = localX + tileX * this.CONFIG.TILE_SIZE;
        const worldZ = localZ + tileZ * this.CONFIG.TILE_SIZE;
        const height = this.getHeightAtComputed(worldX, worldZ);
        positions.setY(i, height);
        heightData[i] = height;
      }
    } else {
      // Use worker heights directly — they now include shoreline adjustment
      // and match the main-thread computation for procedural terrain.
      heightData = workerData.heightData;
      for (let i = 0; i < positions.count; i++) {
        positions.setY(i, heightData[i]);
      }
    }

    // Road influence per vertex (cheap — no noise, only tile lookups)
    for (let i = 0; i < positions.count; i++) {
      const localX = positions.getX(i);
      const localZ = positions.getZ(i);
      const worldX = localX + tileX * this.CONFIG.TILE_SIZE;
      const worldZ = localZ + tileZ * this.CONFIG.TILE_SIZE;
      roadInfluences[i] = this.calculateRoadInfluenceAtVertex(
        worldX,
        worldZ,
        tileX,
        tileZ,
      );
    }

    // Set attributes
    geometry.setAttribute("color", new THREE.BufferAttribute(colorData, 3));
    geometry.setAttribute(
      "biomeId",
      new THREE.BufferAttribute(new Float32Array(biomeData), 1),
    );
    geometry.setAttribute(
      "roadInfluence",
      new THREE.BufferAttribute(roadInfluences, 1),
    );

    if (TERRAIN_ROAD_INFLUENCE_DEBUG) {
      let nonZeroCount = 0;
      let maxInfluence = 0;
      for (let i = 0; i < roadInfluences.length; i++) {
        if (roadInfluences[i] > 0) {
          nonZeroCount++;
          maxInfluence = Math.max(maxInfluence, roadInfluences[i]);
        }
      }
      if (nonZeroCount > 0) {
        console.log(
          `[TerrainSystem/Worker] Tile (${tileX}, ${tileZ}): ${nonZeroCount}/${roadInfluences.length} vertices with road influence, max=${maxInfluence.toFixed(3)}`,
        );
      }
    }

    if (hasFlatZones) {
      // Normals must be recomputed on the main thread since heights changed
      this.computeHeightFieldNormals(geometry, tileX, tileZ, heightData);
    } else {
      // Use pre-computed worker normals directly
      geometry.setAttribute("normal", new THREE.BufferAttribute(normalData, 3));
    }

    this.applyFlatZoneCarve(geometry, tileX, tileZ);

    // Store height data for persistence
    this.storeHeightData(tileX, tileZ, Array.from(heightData));

    return geometry;
  }

  /**
   * Create a terrain tile from pre-computed geometry WITH full resource generation
   * This is the complete path for worker-generated tiles
   */
  private createTileFromGeometryWithResources(
    tileX: number,
    tileZ: number,
    geometry: THREE.PlaneGeometry,
  ): TerrainTile {
    const key = `${tileX}_${tileZ}`;

    // Check if tile already exists
    if (this.terrainTiles.has(key)) {
      geometry.dispose();
      return this.terrainTiles.get(key)!;
    }

    const material = this.getTerrainMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      tileX * this.CONFIG.TILE_SIZE,
      0,
      tileZ * this.CONFIG.TILE_SIZE,
    );
    mesh.name = `Terrain_${key}`;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = true;
    mesh.userData = {
      type: "terrain",
      walkable: true,
      clickable: true,
      biome: this.getBiomeAt(tileX, tileZ),
      tileKey: key,
      tileX,
      tileZ,
    };

    // Create tile object
    const tile: TerrainTile = {
      key,
      x: tileX,
      z: tileZ,
      mesh,
      collision: null,
      biome: this.getBiomeAt(tileX, tileZ) as TerrainTile["biome"],
      resources: [],
      roads: [],
      generated: true,
      lastActiveTime: new Date(),
      playerCount: 0,
      needsSave: true,
      waterMeshes: [],
      heightData: [],
      chunkSeed: 0,
      heightMap: new Float32Array(0),
      collider: null,
      lastUpdate: Date.now(),
    };

    // Create physics collision on the client for click-to-move raycasts.
    // Server keeps authoritative tile simulation via chunk/nav systems and
    // does not need per-tile rigid bodies here.
    const physics = this.world.physics;
    const PHYSX = getPhysX();
    if (this.runtimeIsClient && physics && PHYSX) {
      const positionAttribute = geometry.attributes.position;
      const vertices = positionAttribute.array as Float32Array;
      let minY = Infinity;
      let maxY = -Infinity;
      let avgY = 0;
      const vertexCount = positionAttribute.count;
      for (let i = 0; i < vertexCount; i++) {
        const y = vertices[i * 3 + 1];
        avgY += y;
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      avgY /= vertexCount;

      const heightRange = maxY - minY;
      const boxThickness = Math.max(5, heightRange * 0.5);
      const halfExtents = {
        x: this.CONFIG.TILE_SIZE / 2,
        y: boxThickness / 2,
        z: this.CONFIG.TILE_SIZE / 2,
      };
      const boxGeometry = new PHYSX.PxBoxGeometry(
        halfExtents.x,
        halfExtents.y,
        halfExtents.z,
      );
      const physicsMaterial = physics.physics.createMaterial(0.5, 0.5, 0.1);
      const shape = physics.physics.createShape(
        boxGeometry,
        physicsMaterial,
        true,
      );

      const terrainLayer = Layers.terrain;
      if (terrainLayer) {
        const filterData = new PHYSX.PxFilterData(
          terrainLayer.group,
          0xffffffff,
          0,
          0,
        );
        shape.setQueryFilterData(filterData);
        const simFilterData = new PHYSX.PxFilterData(
          terrainLayer.group,
          terrainLayer.mask,
          0,
          0,
        );
        shape.setSimulationFilterData(simFilterData);
      }

      const transform = new PHYSX.PxTransform(
        new PHYSX.PxVec3(
          mesh.position.x + this.CONFIG.TILE_SIZE / 2,
          avgY,
          mesh.position.z + this.CONFIG.TILE_SIZE / 2,
        ),
        new PHYSX.PxQuat(0, 0, 0, 1),
      );
      const actor = physics.physics.createRigidStatic(transform);
      actor.attachShape(shape);

      const handle: PhysicsHandle = {
        tag: `terrain_${tile.key}`,
        contactedHandles: new Set<PhysicsHandle>(),
        triggeredHandles: new Set<PhysicsHandle>(),
      };
      tile.collider = physics.addActor(actor, handle);
    }

    // Add to scene
    if (this.terrainContainer) {
      this.terrainContainer.add(mesh);
    }

    // Generate content (resources, visual features, water)
    const isServer =
      this.runtimeIsServer || this.world.network?.isServer || false;
    const isClient = this.runtimeIsClient;

    if (isServer) {
      this.generateTileResources(tile);
    }

    if (isClient) {
      if (!isServer && tile.resources.length === 0) {
        this.generateTileResources(tile);
      }
      this.generateVisualFeatures(tile);
      this.generateWaterMeshes(tile);

      // Queue resource instances for deferred creation (spreads work across frames)
      if (tile.resources.length > 0 && tile.mesh) {
        this.queueResourceInstances(tile);
      }
    }

    // Emit tile generated event
    const originX = tileX * this.CONFIG.TILE_SIZE;
    const originZ = tileZ * this.CONFIG.TILE_SIZE;
    const resourcesPayload = tile.resources.map((r) => ({
      id: r.id,
      type: r.type,
      position: {
        x: originX + r.position.x,
        y: r.position.y,
        z: originZ + r.position.z,
      },
    }));
    const genericBiome = this.mapBiomeToGeneric(tile.biome as string);
    this.world.emit(EventType.TERRAIN_TILE_GENERATED, {
      tileId: `${tileX},${tileZ}`,
      position: { x: originX, z: originZ },
      tileX,
      tileZ,
      biome: genericBiome,
      resources: resourcesPayload,
    });

    // Register resource spawn points (same as generateTile)
    if (isServer && tile.resources.length > 0) {
      const spawnPoints = tile.resources.map((r) => {
        const worldPos = {
          x: originX + r.position.x,
          y: r.position.y,
          z: originZ + r.position.z,
        };
        return {
          id: r.id,
          type: r.type,
          // Use actual subType from resource node, or derive from type
          subType: r.subType ?? (r.type === "tree" ? "normal" : undefined),
          position: worldPos,
          // Pass scale and rotation for visual variation
          scale: r.scale,
          rotation: r.rotation,
        };
      });
      this.world.emit(EventType.RESOURCE_SPAWN_POINTS_REGISTERED, {
        spawnPoints,
      });
    } else if (tile.resources.length > 0 && isClient && !isServer) {
      const spawnPoints = tile.resources.map((r) => {
        const worldPos = {
          x: originX + r.position.x,
          y: r.position.y,
          z: originZ + r.position.z,
        };
        return {
          id: r.id,
          type: r.type,
          // Use actual subType from resource node, or derive from type
          subType: r.subType ?? (r.type === "tree" ? "normal" : undefined),
          position: worldPos,
          // Pass scale and rotation for visual variation
          scale: r.scale,
          rotation: r.rotation,
        };
      });
      this.world.emit(EventType.RESOURCE_SPAWN_POINTS_REGISTERED, {
        spawnPoints,
      });
    }

    this.terrainTiles.set(key, tile);
    this.activeChunks.add(key);

    return tile;
  }

  private initializeBiomeCenters(): void {
    const worldSize = this.getActiveWorldSizeMeters();
    const gridSize = this.CONFIG.BIOME_GRID_SIZE; // 5x5 grid
    const cellSize = worldSize / gridSize;

    // Use deterministic PRNG for reproducible biome placement
    const baseSeed = this.computeSeedFromWorldId();
    let randomState = baseSeed;

    const nextRandom = () => {
      // Linear congruential generator for deterministic random
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 0xffffffff;
    };

    // Weighted biome types - plains dominant, with variety
    const biomeTypes = [
      "plains",
      "plains",
      "plains",
      "forest",
      "forest",
      "valley",
      "mountains",
      "mountains",
      "desert",
      "swamp",
      "tundra", // Added back
    ];

    // Clear any existing centers
    this.biomeCenters = [];

    // Grid-jitter placement for even distribution
    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        // Base position at grid cell center
        const baseX = (gx + 0.5) * cellSize - worldSize / 2;
        const baseZ = (gz + 0.5) * cellSize - worldSize / 2;

        // Jitter within cell (controlled randomness)
        const jitter = this.CONFIG.BIOME_JITTER;
        const jitterX = (nextRandom() - 0.5) * 2 * jitter * cellSize;
        const jitterZ = (nextRandom() - 0.5) * 2 * jitter * cellSize;

        const x = baseX + jitterX;
        const z = baseZ + jitterZ;

        const typeIndex = Math.floor(nextRandom() * biomeTypes.length);
        const influenceRange =
          this.CONFIG.BIOME_MAX_INFLUENCE - this.CONFIG.BIOME_MIN_INFLUENCE;
        const influence =
          this.CONFIG.BIOME_MIN_INFLUENCE + nextRandom() * influenceRange;

        this.biomeCenters.push({
          x,
          z,
          type: biomeTypes[typeIndex],
          influence,
        });
      }
    }
  }

  /**
   * Initialize the unified TerrainGenerator from @hyperscape/procgen
   * This creates a standalone generator that matches this system's configuration
   */
  private initializeTerrainGenerator(): void {
    const seed = this.computeSeedFromWorldId();
    const worldSizeMeters = this.getActiveWorldSizeMeters();

    // Convert BIOMES data to BiomeDefinition format
    const biomeDefinitions: Record<string, BiomeDefinition> = {};
    for (const [id, biomeData] of Object.entries(BIOMES)) {
      biomeDefinitions[id] = {
        id,
        name: biomeData.name,
        color: biomeData.color,
        terrainMultiplier: biomeData.terrainMultiplier || 1.0,
        difficultyLevel: biomeData.difficultyLevel || 0,
        heightRange: biomeData.heightRange,
        maxSlope: biomeData.maxSlope,
        resourceDensity: biomeData.resourceDensity,
      };
    }

    // Create configuration that matches this system's CONFIG
    const terrainConfig: Partial<TerrainConfig> = {
      seed,
      tileSize: this.CONFIG.TILE_SIZE,
      worldSize: this.CONFIG.WORLD_SIZE,
      tileResolution: this.CONFIG.TILE_RESOLUTION,
      maxHeight: this.CONFIG.MAX_HEIGHT,
      waterThreshold: this.CONFIG.WATER_THRESHOLD,
      noise: {
        continent: {
          scale: 0.0008,
          weight: 0.4,
          octaves: 5,
          persistence: 0.7,
          lacunarity: 2.0,
        },
        ridge: { scale: 0.003, weight: 0.1 },
        hill: {
          scale: 0.012,
          weight: 0.12,
          octaves: 4,
          persistence: 0.5,
          lacunarity: 2.2,
        },
        erosion: { scale: 0.005, weight: 0.08, octaves: 3 },
        detail: {
          scale: 0.04,
          weight: 0.03,
          octaves: 2,
          persistence: 0.3,
          lacunarity: 2.5,
        },
      },
      biomes: {
        gridSize: this.CONFIG.BIOME_GRID_SIZE,
        jitter: this.CONFIG.BIOME_JITTER,
        minInfluence: this.CONFIG.BIOME_MIN_INFLUENCE,
        maxInfluence: this.CONFIG.BIOME_MAX_INFLUENCE,
        gaussianCoeff: this.CONFIG.BIOME_GAUSSIAN_COEFF,
        boundaryNoiseScale: this.CONFIG.BIOME_BOUNDARY_NOISE_SCALE,
        boundaryNoiseAmount: this.CONFIG.BIOME_BOUNDARY_NOISE_AMOUNT,
        mountainHeightThreshold: this.CONFIG.MOUNTAIN_HEIGHT_THRESHOLD,
        mountainWeightBoost: this.CONFIG.MOUNTAIN_WEIGHT_BOOST,
        valleyHeightThreshold: this.CONFIG.VALLEY_HEIGHT_THRESHOLD,
        valleyWeightBoost: this.CONFIG.VALLEY_WEIGHT_BOOST,
        mountainHeightBoost: this.CONFIG.MOUNTAIN_HEIGHT_BOOST,
      },
      island: {
        enabled: this.CONFIG.ISLAND_MASK_ENABLED,
        maxWorldSizeTiles: this.CONFIG.ISLAND_MAX_WORLD_SIZE_TILES,
        falloffTiles: this.CONFIG.ISLAND_FALLOFF_TILES,
        edgeNoiseScale: this.CONFIG.ISLAND_EDGE_NOISE_SCALE,
        edgeNoiseStrength: this.CONFIG.ISLAND_EDGE_NOISE_STRENGTH,
      },
      shoreline: {
        waterLevelNormalized: this.CONFIG.WATER_LEVEL_NORMALIZED,
        threshold: this.CONFIG.SHORELINE_THRESHOLD,
        colorStrength: this.CONFIG.SHORELINE_STRENGTH,
        minSlope: this.CONFIG.SHORELINE_MIN_SLOPE,
        slopeSampleDistance: this.CONFIG.SHORELINE_SLOPE_SAMPLE_DISTANCE,
        landBand: this.CONFIG.SHORELINE_LAND_BAND,
        landMaxMultiplier: this.CONFIG.SHORELINE_LAND_MAX_MULTIPLIER,
        underwaterBand: this.CONFIG.SHORELINE_UNDERWATER_BAND,
        underwaterDepthMultiplier: this.CONFIG.UNDERWATER_DEPTH_MULTIPLIER,
      },
    };

    this.terrainGenerator = new TerrainGenerator(
      terrainConfig,
      biomeDefinitions,
    );

    console.log(
      `[TerrainSystem] Initialized unified TerrainGenerator with seed ${seed}, ` +
        `world size ${worldSizeMeters}m, ${Object.keys(biomeDefinitions).length} biomes`,
    );
  }

  /**
   * Get the unified terrain generator for external use
   * Useful for systems that need standalone terrain queries
   */
  public getTerrainGenerator(): TerrainGenerator {
    return this.terrainGenerator;
  }

  // World Configuration - Your Specifications
  // OSRS-STYLE: Rolling terrain with visible hills
  private readonly CONFIG = {
    // Core World Specs
    TILE_SIZE: 100, // 100m x 100m tiles
    WORLD_SIZE: 100, // 100x100 grid = 10km x 10km world
    TILE_RESOLUTION: 64, // 64x64 vertices per tile for smooth terrain
    MAX_HEIGHT: 50, // 50m max height variation (bumpy terrain to show flat zones)
    WATER_THRESHOLD: TERRAIN_CONSTANTS.WATER_THRESHOLD, // Water appears below this level

    // Performance: Reduced draw distance
    CAMERA_FAR: 400, // Match fog far + buffer
    FOG_NEAR: 150,
    FOG_FAR: 350,

    // LOD (Level of Detail) - Resolution tiers based on distance
    LOD_DISTANCES: [100, 200, 350], // Distance thresholds
    LOD_RESOLUTIONS: [64, 32, 16, 8], // Resolution at each LOD level

    // Chunking - Only adjacent tiles
    VIEW_DISTANCE: 1, // Load only 1 tile in each direction (3x3 = 9 tiles)
    UPDATE_INTERVAL: 0.5, // Check player movement every 0.5 seconds

    // Movement Constraints
    WATER_IMPASSABLE: true, // Water blocks movement
    MAX_WALKABLE_SLOPE: TERRAIN_CONSTANTS.MAX_WALKABLE_SLOPE, // Maximum slope for movement (tan of angle)
    SLOPE_CHECK_DISTANCE: TERRAIN_CONSTANTS.SLOPE_CHECK_DISTANCE, // Distance to check for slope calculation

    // Features
    ROAD_WIDTH: 6, // 6m wide roads for better visibility
    RESOURCE_DENSITY: 0.15, // 15% chance per area for resources (increased for more resources)
    TREE_DENSITY: 0.25, // 25% chance for trees in forest biomes (increased for visibility)
    TOWN_RADIUS: 25, // Safe radius around towns

    // Difficulty Scaling
    DIFFICULTY_MAX_LEVEL: 1000,
    DIFFICULTY_NOISE_SCALE: 0.0007,
    DIFFICULTY_NOISE_WEIGHT: 0.3,
    DIFFICULTY_CURVE_EXPONENT: 2.2,
    DIFFICULTY_TOWN_FALLOFF_RADIUS: 300,

    // Boss Hotspots
    BOSS_HOTSPOT_MAX: 3,
    BOSS_HOTSPOT_GRID_STEP: 500,
    BOSS_HOTSPOT_MIN_SCALAR: 0.85,
    BOSS_HOTSPOT_MIN_DISTANCE: 1200,
    BOSS_HOTSPOT_RADIUS: 120,
    BOSS_MIN_LEVEL: 800,

    // Biome Generation
    BIOME_GRID_SIZE: 3, // 3x3 grid = 9 very large biomes
    BIOME_JITTER: 0.35, // How much to randomize position within grid cell (0-0.5)
    BIOME_MIN_INFLUENCE: 2000, // Biome influence radius in meters
    BIOME_MAX_INFLUENCE: 3500, // Biome influence radius in meters
    BIOME_GAUSSIAN_COEFF: 0.15, // Gaussian falloff (smooth natural decay)
    BIOME_RANGE_MULT: 10, // Not used - no hard cutoff
    BIOME_BOUNDARY_NOISE_SCALE: 0.003, // Larger scale noise for organic boundaries
    BIOME_BOUNDARY_NOISE_AMOUNT: 0.15, // Subtle noise

    // Height-Biome Coupling
    MOUNTAIN_HEIGHT_BOOST: 0.5, // How much mountains raise terrain (0.5 = 50%)
    MOUNTAIN_HEIGHT_THRESHOLD: 0.4, // Height above which mountains get weight boost
    MOUNTAIN_WEIGHT_BOOST: 2.0, // Max weight multiplier for mountains at high elevation
    VALLEY_HEIGHT_THRESHOLD: 0.4, // Height below which valleys/plains get weight boost
    VALLEY_WEIGHT_BOOST: 1.5, // Max weight multiplier for valleys at low elevation

    // Shoreline
    WATER_LEVEL_NORMALIZED: 0.15, // Normalized height where water starts
    SHORELINE_THRESHOLD: 0.25, // Normalized height where shoreline effect ends
    SHORELINE_STRENGTH: 0.6, // How strong the brown tint is (0-1)
    SHORELINE_MIN_SLOPE: 0.06, // Minimum slope to enforce near shorelines
    SHORELINE_SLOPE_SAMPLE_DISTANCE: 1.0, // Sample distance for shoreline slope checks
    SHORELINE_LAND_BAND: 3.0, // Meters above water to shape shoreline
    SHORELINE_LAND_MAX_MULTIPLIER: 1.6, // Max land steepening multiplier
    SHORELINE_UNDERWATER_BAND: 3.0, // Meters below water to deepen shoreline
    UNDERWATER_DEPTH_MULTIPLIER: 1.8, // Max depth multiplier near shoreline

    // Island Mask (default for main world)
    ISLAND_MASK_ENABLED: true,
    ISLAND_MAX_WORLD_SIZE_TILES: 100, // 10km x 10km island
    ISLAND_FALLOFF_TILES: 4, // Coastline falloff width in tiles
    ISLAND_EDGE_NOISE_SCALE: 0.0015, // Noise scale for coastline irregularity
    ISLAND_EDGE_NOISE_STRENGTH: 0.03, // Radius variance as fraction of radius

    // Web Worker settings for parallel terrain generation
    USE_WORKERS: true, // Enable web workers for heightmap generation (client-side only)
    WORKER_POOL_SIZE: 0, // Number of workers (0 = auto, based on CPU cores)
  };

  // Pre-computed terrain data from workers (awaiting geometry creation)
  private pendingWorkerResults = new Map<string, TerrainWorkerOutput>();
  private workerBatchInProgress = false;

  // Biomes now loaded from assets/manifests/biomes.json via DataManager
  // Uses imported BIOMES from world-structure.ts
  // No hardcoded biome data - all definitions in JSON!

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    // Initialize tile size
    this.tileSize = this.CONFIG.TILE_SIZE;
    const runtimeRole = this.resolveRuntimeRole();
    this.runtimeIsServer = runtimeRole.isServer;
    this.runtimeIsClient = runtimeRole.isClient;

    // Initialize deterministic noise from world id
    this.noise = new NoiseGenerator(this.computeSeedFromWorldId());

    // Initialize biome centers using deterministic random placement
    this.initializeBiomeCenters();

    // Initialize the unified terrain generator from @hyperscape/procgen
    // This provides a standalone, testable height generation system
    this.initializeTerrainGenerator();

    // Cache optional TownSystem for difficulty falloff and boss placement
    this.townSystem = this.world.getSystem<TownSystem>("towns") ?? null;

    // Precompute boss hotspots for this world seed
    this.generateBossHotspots();

    // NOTE: Flat zones are loaded later, after DataManager is ready
    // See loadFlatZonesFromManifest() call after the DataManager wait loop

    // Initialize terrain material (client-side only)
    if (this.runtimeIsClient) {
      this.initTerrainMaterial();

      // TEMPORARILY DISABLED - rock system disabled
      // setProcgenRockWorld(this.world);
      // setProcgenPlantWorld(this.world); // DISABLED

      // Pre-warm common rock presets for the world's biomes
      // TEMPORARILY DISABLED
      // const commonRockPresets = ["boulder", "pebble", "granite", "sandstone"];

      // Pre-warm mesh variant caches (rocks only)
      // TEMPORARILY DISABLED
      /*
      preWarmRockCache(commonRockPresets).catch((err) =>
        console.warn("[TerrainSystem] Failed to pre-warm rock cache:", err),
      );

      // Pre-warm impostor caches from IndexedDB (loads without rebaking)
      preWarmRockCache(commonRockPresets)
        .then(() => {
          // Create instancer to enable impostor pre-warming
          const rockInstancer = ProcgenRockInstancer.getInstance(this.world);

          // Pre-warm impostor caches (loads from IndexedDB if available)
          if (rockInstancer) {
            rockInstancer
              .preWarmImpostorCache(commonRockPresets)
              .catch((err) =>
                console.warn(
                  "[TerrainSystem] Failed to pre-warm rock impostors:",
                  err,
                ),
              );
          }
        })
        .catch((err) =>
          console.warn("[TerrainSystem] Failed during cache pre-warming:", err),
        );
      */
    }

    // Initialize water system
    this.waterSystem = new WaterSystem(this.world);
    await this.waterSystem.init();

    // Add water system to scene (required for reflector and debug view)
    if (this.world.stage?.scene) {
      this.waterSystem.addToScene(this.world.stage.scene);
    }

    // Sync water reflections setting from prefs (client-side only)
    if (typeof window !== "undefined" && this.world.prefs) {
      // Set initial value from prefs
      const waterReflectionsEnabled = this.world.prefs.waterReflections ?? true;
      this.waterSystem.setReflectionsEnabled(waterReflectionsEnabled);

      // Listen for prefs changes
      this.world.prefs.on("change", this.onPrefsChange);
    }

    // Get systems references
    // Check if database system exists and has the required method
    const dbSystem = this.world.getSystem("database") as
      | { saveWorldChunk(chunkData: WorldChunkData): void }
      | undefined;
    if (dbSystem) {
      this.databaseSystem = dbSystem;
    }

    // Initialize chunk loading system
    this.initializeChunkLoadingSystem();

    // Initialize serialization system
    this.initializeSerializationSystem();

    // Initialize bounding box verification
    this.initializeBoundingBoxSystem();

    // Environment detection (deferred until network system is available)
    const networkSystem = this.world.network;
    if (networkSystem?.isClient) {
      // Client-side initialization
    } else if (networkSystem?.isServer) {
      // Server-side initialization
    } else {
      // Environment not yet determined
    }
  }

  async start(): Promise<void> {
    // Initialize noise generator if not already initialized (failsafe)
    if (!this.noise) {
      this.noise = new NoiseGenerator(this.computeSeedFromWorldId());
      this.initializeBiomeCenters();
    }

    // CRITICAL: Wait for DataManager to initialize BIOMES data before generating terrain
    // DataManager is initialized in registerSystems() which happens asynchronously
    // We need to wait for it to be ready AND for BIOMES data to be loaded before generating terrain tiles
    const dataManager = DataManager.getInstance();
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();

    // Wait for both DataManager to be ready AND BIOMES data to be loaded
    while (
      (!dataManager.isReady() || Object.keys(BIOMES).length === 0) &&
      Date.now() - startTime < maxWait
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Final check - verify BIOMES data is actually loaded
    if (Object.keys(BIOMES).length === 0) {
      const errorMsg =
        "[TerrainSystem] BIOMES data not loaded! DataManager must initialize before terrain generation. " +
        `DataManager ready: ${dataManager.isReady()}, BIOMES count: ${Object.keys(BIOMES).length}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log(
      `[TerrainSystem] DataManager initialized, ${Object.keys(BIOMES).length} biomes loaded, proceeding with terrain generation`,
    );

    // Load flat zones from manifest (now that DataManager has loaded world-areas.json and stations.json)
    this.loadFlatZonesFromManifest();

    // Final environment detection. world.isClient can be transiently true during
    // server bootstrap, so prefer runtime detection to avoid loading client-only
    // terrain visuals in headless/server mode.
    const { isServer, isClient } = this.resolveRuntimeRole();
    this.runtimeIsServer = isServer;
    this.runtimeIsClient = isClient;

    if (isServer) {
      this.setupServerTerrain();
    } else if (isClient) {
      this.setupClientTerrain();
    } else {
      console.warn(
        "[TerrainSystem] Runtime role unresolved, defaulting to server terrain mode",
      );
      this.runtimeIsServer = true;
      this.runtimeIsClient = false;
      this.setupServerTerrain();
    }

    // Initialize GPU compute context for accelerated terrain operations (client only)
    if (isClient && isTerrainComputeAvailable()) {
      this.terrainComputeContext = new TerrainComputeContext({
        minVerticesForGPU: 1000,
        minRoadsForGPU: 3,
      });
      console.log(
        "[TerrainSystem] GPU compute context created (pending renderer init)",
      );
    }

    // OPTIMIZATION: Wait for roads before generating visual tiles
    // This avoids generating tiles twice (once without roads, once with)
    // getHeightAt() works without tiles, so RoadNetworkSystem can still query heights
    this.world.on(EventType.ROADS_GENERATED, (...args: unknown[]) => {
      // Extract road data from event args
      const data = (args[0] ?? {}) as {
        roadCount?: number;
        townCount?: number;
      };
      console.log(
        `[TerrainSystem] ROADS_GENERATED event received: ${data.roadCount ?? 0} roads, ${data.townCount ?? 0} towns`,
      );

      // Clear the fallback timeout since we received the event
      if (this.roadsTimeoutId) {
        clearTimeout(this.roadsTimeoutId);
        this.roadsTimeoutId = undefined;
      }

      this.roadNetworkSystem = this.world.getSystem("roads") as
        | RoadNetworkSystem
        | undefined;

      // Now that roads are ready, ensure all tiles have road influence data
      if (!this._initialTilesReady) {
        console.log(
          "[TerrainSystem] Roads ready, generating initial tiles with road data",
        );
        this.loadInitialTiles();
        // IMPORTANT: Also refresh road influence on any tiles that were created
        // before roads were ready (e.g., by updatePlayerBasedTerrain or flat zone regeneration)
        if (this.terrainTiles.size > 0) {
          console.log(
            "[TerrainSystem] Refreshing road influence on pre-existing tiles...",
          );
          this.refreshRoadInfluence();
        }
      } else {
        // Tiles already exist - refresh road influence on existing tiles
        console.log(
          "[TerrainSystem] Tiles already exist, refreshing road influence...",
        );
        this.refreshRoadInfluence();
      }
    });

    // Fallback: If no roads event within 15 seconds, generate tiles anyway
    // This is a safety net - normally ROADS_GENERATED should always fire
    // NOTE: Timeout increased from 2s to 15s because TownSystem.start() can take
    // significant time evaluating town candidates (each requires multiple terrain height lookups).
    // With a 15x15 candidate grid and ~136 height lookups per candidate, this can take 5-10 seconds.
    this.roadsTimeoutId = setTimeout(() => {
      if (!this._initialTilesReady) {
        console.warn(
          "[TerrainSystem] Timeout: No roads event received after 15s, generating initial tiles without road data",
        );
        this.loadInitialTiles();
      }
    }, 15000);

    // Start player-based terrain update loop
    this.terrainUpdateIntervalId = setInterval(() => {
      this.updatePlayerBasedTerrain();
    }, 1000); // Update every second

    // Start serialization loop
    this.serializationIntervalId = setInterval(() => {
      this.performPeriodicSerialization();
    }, 60000); // Check every minute

    // Start bounding box verification
    this.boundingBoxIntervalId = setInterval(() => {
      this.verifyTerrainBoundingBoxes();
    }, 30000); // Verify every 30 seconds

    // Mark terrain as initialized - allows update() to start processing
    this._terrainInitialized = true;
    console.log("[TerrainSystem] Terrain initialization complete");
  }

  private setupClientTerrain(): void {
    const stage = this.world.stage as { scene: THREE.Scene };
    const scene = stage.scene;

    // Create terrain container
    this.terrainContainer = new THREE.Group();
    this.terrainContainer.name = "TerrainContainer";
    scene.add(this.terrainContainer);

    // Initialize InstancedMeshManager
    this.instancedMeshManager = new InstancedMeshManager(scene, this.world);
    this.registerInstancedMeshes();

    // Setup initial camera only if no client camera system controls it
    // Leave control to ClientCameraSystem for third-person follow

    // Initial tiles will be loaded in start() method
  }

  private registerInstancedMeshes(): void {
    // Register tree mesh - now with automatic pooling (1000 visible max)
    const treeSize = { x: 1.2, y: 3.0, z: 1.2 };
    const treeGeometry = new THREE.BoxGeometry(
      treeSize.x,
      treeSize.y,
      treeSize.z,
    );
    const treeMaterial = new MeshStandardNodeMaterial({ color: 0x2f7d32 });
    this.instancedMeshManager.registerMesh(
      "tree",
      treeGeometry,
      treeMaterial,
      1000,
    );

    // NOTE: Decorative rocks are now handled by ProcgenRockInstancer
    // with procedurally generated geometry and LODs.
    // Ore meshes remain as placeholder boxes since they are harvestable resources
    // and will be replaced with GLB models from the resource system.
    const oreSize = { x: 1.0, y: 1.0, z: 1.0 };
    const oreGeometry = new THREE.BoxGeometry(oreSize.x, oreSize.y, oreSize.z);
    const oreMaterial = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
    this.instancedMeshManager.registerMesh(
      "ore",
      oreGeometry,
      oreMaterial,
      500,
    );
    this.instancedMeshManager.registerMesh(
      "rare_ore",
      oreGeometry,
      oreMaterial,
      200,
    );

    // Register herb mesh - pooled to 800 visible instances
    const herbSize = { x: 0.6, y: 0.8, z: 0.6 };
    const herbGeometry = new THREE.BoxGeometry(
      herbSize.x,
      herbSize.y,
      herbSize.z,
    );
    const herbMaterial = new THREE.MeshLambertMaterial({ color: 0x66bb6a });
    this.instancedMeshManager.registerMesh(
      "herb",
      herbGeometry,
      herbMaterial,
      800,
    );

    // Register fish mesh (using a simple sphere) - pooled to 300 visible instances
    const fishGeometry = new THREE.SphereGeometry(0.6);
    const fishMaterial = new THREE.MeshLambertMaterial({
      color: 0x3aa7ff,
      transparent: true,
      opacity: 0.7,
    });
    this.instancedMeshManager.registerMesh(
      "fish",
      fishGeometry,
      fishMaterial,
      300,
    );

    // Grass rendering now handled by ProceduralGrassSystem
  }

  private setupServerTerrain(): void {
    if (!this.serverMeshCollisionEnabled) {
      console.log(
        "[TerrainSystem] Server mesh collision generation disabled (set TERRAIN_SERVER_MESH_COLLISION_ENABLED=true to enable)",
      );
    }

    // Setup chunk save interval for persistence
    if (this.databaseSystem) {
      this.chunkSaveInterval = setInterval(() => {
        this.saveModifiedChunks();
      }, 30000); // Save every 30 seconds
    }

    // Initial tiles will be loaded in start() method
  }

  /**
   * Resolve terrain focus centers for streaming.
   *
   * In spectator/stream mode (no local player), center generation on the
   * current camera target instead of all remote players to avoid loading the
   * whole world and to keep duel views fast.
   */
  private getTerrainCenters(): Array<{ id: string; position: THREE.Vector3 }> {
    // Spectator/streaming client: use camera target when there is no local player.
    if (this.runtimeIsClient) {
      const localPlayer = this.world.getPlayer?.();
      if (!localPlayer) {
        // Prefer server-assigned spectator target (snapshot/stream updates),
        // then fall back to URL config hints.
        const followEntityId = (() => {
          const network = this.world.getSystem("network") as {
            getSpectatorFollowEntity?: () => string | undefined;
            spectatorFollowEntity?: string;
          } | null;

          const assignedTarget =
            network?.getSpectatorFollowEntity?.() ??
            network?.spectatorFollowEntity;
          if (typeof assignedTarget === "string" && assignedTarget.length > 0) {
            return assignedTarget;
          }

          if (typeof window === "undefined") return undefined;
          const cfg = (
            window as Window & {
              __HYPERSCAPE_CONFIG__?: {
                followEntity?: string;
                characterId?: string;
              };
            }
          ).__HYPERSCAPE_CONFIG__;
          return cfg?.followEntity || cfg?.characterId;
        })();

        if (followEntityId) {
          const followedEntity =
            this.world.entities?.items?.get(followEntityId) ||
            this.world.entities?.players?.get(followEntityId);
          const followedPos = followedEntity?.position as
            | { x: number; y: number; z: number }
            | undefined;
          if (
            followedPos &&
            Number.isFinite(followedPos.x) &&
            Number.isFinite(followedPos.y) &&
            Number.isFinite(followedPos.z)
          ) {
            this._spectatorFocusPos.set(
              followedPos.x,
              followedPos.y,
              followedPos.z,
            );
            return [{ id: followEntityId, position: this._spectatorFocusPos }];
          }

          // If follow target exists in config but entity hasn't spawned yet,
          // preload around duel lobby instead of origin/camera to avoid
          // "world loads in chunks" artifacts for spectator startup.
          const lobby = getDuelArenaConfig().lobbySpawnPoint;
          this._spectatorFocusPos.set(lobby.x, lobby.y, lobby.z);
          return [{ id: followEntityId, position: this._spectatorFocusPos }];
        }

        const cameraSystem =
          (this.world.getSystem("client-camera-system") as
            | {
                getCameraInfo?: () => {
                  target?: {
                    id?: string;
                    data?: { id?: string };
                    position?: { x: number; y: number; z: number };
                  } | null;
                };
              }
            | undefined) ??
          (this.world.getSystem("client-camera") as
            | {
                getCameraInfo?: () => {
                  target?: {
                    id?: string;
                    data?: { id?: string };
                    position?: { x: number; y: number; z: number };
                  } | null;
                };
              }
            | undefined) ??
          (this.world.getSystem("camera") as
            | {
                getCameraInfo?: () => {
                  target?: {
                    id?: string;
                    data?: { id?: string };
                    position?: { x: number; y: number; z: number };
                  } | null;
                };
              }
            | undefined);

        const target = cameraSystem?.getCameraInfo?.().target;
        const targetPos = target?.position;
        if (
          targetPos &&
          Number.isFinite(targetPos.x) &&
          Number.isFinite(targetPos.y) &&
          Number.isFinite(targetPos.z)
        ) {
          const targetId =
            target?.id || target?.data?.id || "spectator-camera-target";
          this._spectatorFocusPos.set(targetPos.x, targetPos.y, targetPos.z);
          return [{ id: targetId, position: this._spectatorFocusPos }];
        }

        // Fallback to camera position until the target entity is available.
        const cameraPos = this.world.camera?.position;
        if (
          cameraPos &&
          (Math.abs(cameraPos.x) > 1 || Math.abs(cameraPos.z) > 1)
        ) {
          this._spectatorFocusPos.set(cameraPos.x, cameraPos.y, cameraPos.z);
          return [
            { id: "spectator-camera", position: this._spectatorFocusPos },
          ];
        }

        // Final fallback: use duel arena lobby so terrain generates at the
        // arena instead of the world origin when no agents exist yet.
        const lobby = getDuelArenaConfig().lobbySpawnPoint;
        this._spectatorFocusPos.set(lobby.x, lobby.y, lobby.z);
        return [
          { id: "spectator-arena-lobby", position: this._spectatorFocusPos },
        ];
      }
    }

    const players = this.world.getPlayers() || [];
    const centers: Array<{ id: string; position: THREE.Vector3 }> = [];
    for (const player of players) {
      if (!player?.node?.position) continue;
      centers.push({
        id: player.id || "player",
        position: player.node.position,
      });
    }

    // If no players at all (spectator on server, or empty world), use arena lobby.
    if (centers.length === 0 && this.runtimeIsClient) {
      const lobby = getDuelArenaConfig().lobbySpawnPoint;
      this._spectatorFocusPos.set(lobby.x, lobby.y, lobby.z);
      return [
        { id: "spectator-arena-lobby", position: this._spectatorFocusPos },
      ];
    }

    return centers;
  }

  private loadInitialTiles(): void {
    const _startTime = performance.now();
    let _tilesGenerated = 0;
    let minHeight = Infinity;
    let maxHeight = -Infinity;

    // Generate initial grid around the active terrain center.
    const centers = this.getTerrainCenters();
    const centerPos =
      centers[0]?.position ??
      this.world.camera?.position ??
      new THREE.Vector3(0, 0, 0);

    const centerTileX = Math.floor(centerPos.x / this.CONFIG.TILE_SIZE);
    const centerTileZ = Math.floor(centerPos.z / this.CONFIG.TILE_SIZE);

    // Full-content core range + terrain-only ring (preload around player)
    const coreRange = this.coreChunkRange;
    const ringRange = Math.max(this.ringChunkRange, coreRange);

    let fullTiles = 0;
    let terrainOnlyTiles = 0;

    for (let dx = -ringRange; dx <= ringRange; dx++) {
      for (let dz = -ringRange; dz <= ringRange; dz++) {
        const generateContent =
          Math.abs(dx) <= coreRange && Math.abs(dz) <= coreRange;
        const tile = this.generateTile(
          centerTileX + dx,
          centerTileZ + dz,
          generateContent,
        );
        _tilesGenerated++;
        if (generateContent) fullTiles++;
        else terrainOnlyTiles++;

        // Sample heights to check variation (core tiles only)
        if (generateContent) {
          for (let i = 0; i < 10; i++) {
            const testX =
              tile.x * this.CONFIG.TILE_SIZE +
              (Math.random() - 0.5) * this.CONFIG.TILE_SIZE;
            const testZ =
              tile.z * this.CONFIG.TILE_SIZE +
              (Math.random() - 0.5) * this.CONFIG.TILE_SIZE;
            const height = this.getHeightAt(testX, testZ);
            minHeight = Math.min(minHeight, height);
            maxHeight = Math.max(maxHeight, height);
          }
        }
      }
    }

    const _endTime = performance.now();

    // Debug: Log flat zone statistics
    console.log(
      `[TerrainSystem] Initial tiles generated around (${centerTileX}, ${centerTileZ}). ` +
        `Tiles: ${_tilesGenerated} (full=${fullTiles}, terrain-only=${terrainOnlyTiles}). ` +
        `Flat zones: ${this.flatZones.size} zones, ` +
        `${this.flatZonesByTile.size} tile keys, ` +
        `${this._flatZoneHitCount} height lookups used flat zones`,
    );

    // Mark initial tiles as ready
    this.lastPlayerTile = { x: centerTileX, z: centerTileZ };
    this._initialTilesReady = true;
  }

  private generateTile(
    tileX: number,
    tileZ: number,
    generateContent = true,
  ): TerrainTile {
    const key = `${tileX}_${tileZ}`;

    // Check if tile already exists
    if (this.terrainTiles.has(key)) {
      return this.terrainTiles.get(key)!;
    }

    // Create geometry for this tile
    const geometry = this.createTileGeometry(tileX, tileZ);

    // Use triplanar terrain shader material (or fallback to vertex colors)
    const material = this.getTerrainMaterial();

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      tileX * this.CONFIG.TILE_SIZE,
      0,
      tileZ * this.CONFIG.TILE_SIZE,
    );
    mesh.name = `Terrain_${key}`;

    // Enable shadow receiving for CSM
    mesh.receiveShadow = true;
    mesh.castShadow = false; // Terrain doesn't cast shadows on itself

    // Enable frustum culling (Three.js built-in)
    mesh.frustumCulled = true;

    // Add userData for click-to-move detection and other systems
    mesh.userData = {
      type: "terrain",
      walkable: true,
      clickable: true,
      biome: this.getBiomeAt(tileX, tileZ),
      tileKey: key,
      tileX: tileX,
      tileZ: tileZ,
    };

    // Generate collision only on server when mesh collision is enabled.
    // Dev defaults disable this to avoid heavy PhysX triangle mesh memory use.
    const collision: PMeshHandle | null = null;
    const isServer = this.world.network?.isServer || false;
    if (isServer && this.serverMeshCollisionEnabled) {
      const collisionKey = `${tileX}_${tileZ}`;
      if (!this.pendingCollisionSet.has(collisionKey)) {
        this.pendingCollisionSet.add(collisionKey);
        this.pendingCollisionKeys.push(collisionKey);
      }
    }

    // Create tile object
    const tile: TerrainTile = {
      key,
      x: tileX,
      z: tileZ,
      mesh,
      collision: collision || null,
      biome: this.getBiomeAt(tileX, tileZ) as TerrainTile["biome"],
      resources: [],
      roads: [],
      generated: true,
      lastActiveTime: new Date(),
      playerCount: 0,
      needsSave: true,
      waterMeshes: [],
      heightData: [],
      chunkSeed: 0,
      heightMap: new Float32Array(0),
      collider: null,
      lastUpdate: Date.now(),
    };

    // Add simple physics plane for the terrain tile (for raycasting).
    // Client-only to avoid server-side rigid-body explosion in large worlds.
    const physics = this.world.physics;
    const PHYSX = getPhysX();

    // Create a simple plane at the average height of the terrain
    // This is sufficient for click-to-move raycasting
    const positionAttribute = geometry.attributes.position;
    const vertices = positionAttribute.array as Float32Array;

    // Calculate average height and bounds
    let minY = Infinity;
    let maxY = -Infinity;
    let avgY = 0;
    const vertexCount = positionAttribute.count;

    for (let i = 0; i < vertexCount; i++) {
      const y = vertices[i * 3 + 1]; // Y is at index 1 in each vertex
      avgY += y;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    avgY /= vertexCount;

    // Create a box shape that covers the terrain tile
    // Use a thicker box to ensure proper collision
    const heightRange = maxY - minY;
    const boxThickness = Math.max(5, heightRange * 0.5); // At least 5 units thick or half the height range
    const halfExtents = {
      x: this.CONFIG.TILE_SIZE / 2, // Half width
      y: boxThickness / 2, // Half thickness of the collision box
      z: this.CONFIG.TILE_SIZE / 2, // Half depth
    };
    if (this.runtimeIsClient && physics && PHYSX) {
      const boxGeometry = new PHYSX!.PxBoxGeometry(
        halfExtents.x,
        halfExtents.y,
        halfExtents.z,
      );

      // Create material and shape
      const physicsMaterial = physics.physics.createMaterial(0.5, 0.5, 0.1);
      const shape = physics.physics.createShape(
        boxGeometry,
        physicsMaterial,
        true,
      );

      // Set the terrain to the 'terrain' layer
      const terrainLayer = Layers.terrain;
      if (terrainLayer) {
        // For filter data:
        // word0 = what group this shape belongs to (terrain.group)
        // word1 = what groups can query/hit this shape (0xFFFFFFFF allows all)
        // This allows raycasts with any layer mask to hit terrain
        const filterData = new PHYSX!.PxFilterData(
          terrainLayer.group,
          0xffffffff,
          0,
          0,
        );
        shape.setQueryFilterData(filterData);

        // For simulation, use the terrain's actual collision mask
        const simFilterData = new PHYSX!.PxFilterData(
          terrainLayer.group,
          terrainLayer.mask,
          0,
          0,
        );
        shape.setSimulationFilterData(simFilterData);
      }

      // Create actor at tile position with average height
      const transform = new PHYSX!.PxTransform(
        new PHYSX!.PxVec3(
          mesh.position.x + this.CONFIG.TILE_SIZE / 2, // Center of tile
          avgY, // Average terrain height
          mesh.position.z + this.CONFIG.TILE_SIZE / 2, // Center of tile
        ),
        new PHYSX!.PxQuat(0, 0, 0, 1),
      );
      const actor = physics.physics.createRigidStatic(transform);
      actor.attachShape(shape);

      const handle: PhysicsHandle = {
        tag: `terrain_${tile.key}`,
        contactedHandles: new Set<PhysicsHandle>(),
        triggeredHandles: new Set<PhysicsHandle>(),
      };
      tile.collider = physics.addActor(actor, handle);
    }

    // Add to scene if client-side
    if (this.terrainContainer) {
      this.terrainContainer.add(mesh);
    }

    if (generateContent) {
      const isServer =
        this.runtimeIsServer || this.world.network?.isServer || false;
      const isClient = this.runtimeIsClient;

      // Server generates authoritative resources
      if (isServer) {
        this.generateTileResources(tile);
      }

      // Client visual path
      if (isClient) {
        // If no server-generated resources are present (e.g., single-player/dev), generate locally for visuals only
        if (!isServer && tile.resources.length === 0) {
          this.generateTileResources(tile);
        }

        // Generate visual features and water meshes
        this.generateVisualFeatures(tile);
        this.generateWaterMeshes(tile);
        // NOTE: Grass rendering is handled by ProceduralGrassSystem

        // Queue resource instances for deferred creation (spreads work across frames)
        if (tile.resources.length > 0 && tile.mesh) {
          this.queueResourceInstances(tile);
        }
      }
    }

    // Emit typed event for other systems (resources, AI nav, etc.)
    const originX = tile.x * this.CONFIG.TILE_SIZE;
    const originZ = tile.z * this.CONFIG.TILE_SIZE;
    const resourcesPayload = tile.resources.map((r) => {
      const pos = {
        x: originX + r.position.x,
        y: r.position.y,
        z: originZ + r.position.z,
      };
      return { id: r.id, type: r.type, position: pos };
    });
    const genericBiome = this.mapBiomeToGeneric(tile.biome as string);
    this.world.emit(EventType.TERRAIN_TILE_GENERATED, {
      tileId: `${tileX},${tileZ}`,
      position: { x: originX, z: originZ },
      biome: genericBiome,
      tileX,
      tileZ,
      resources: resourcesPayload,
    });

    // Also emit resource spawn points for ResourceSystem (server-only authoritative)
    if (tile.resources.length > 0 && this.world.network?.isServer) {
      const spawnPoints = tile.resources.map((r) => {
        const worldPos = {
          x: originX + r.position.x,
          y: r.position.y,
          z: originZ + r.position.z,
        };
        return {
          id: r.id,
          type: r.type,
          // Use actual subType from resource node, or derive from type
          subType: r.subType ?? (r.type === "tree" ? "normal" : undefined),
          position: worldPos,
          // Pass scale and rotation for visual variation
          scale: r.scale,
          rotation: r.rotation,
        };
      });
      this.world.emit(EventType.RESOURCE_SPAWN_POINTS_REGISTERED, {
        spawnPoints,
      });
    } else if (
      tile.resources.length > 0 &&
      this.runtimeIsClient &&
      !this.world.network?.isServer
    ) {
      const spawnPoints = tile.resources.map((r) => {
        const worldPos = {
          x: originX + r.position.x,
          y: r.position.y,
          z: originZ + r.position.z,
        };
        return {
          id: r.id,
          type: r.type,
          // Use actual subType from resource node, or derive from type
          subType: r.subType ?? (r.type === "tree" ? "normal" : undefined),
          position: worldPos,
          // Pass scale and rotation for visual variation
          scale: r.scale,
          rotation: r.rotation,
        };
      });
      this.world.emit(EventType.RESOURCE_SPAWN_POINTS_REGISTERED, {
        spawnPoints,
      });
    }

    // Store tile
    this.terrainTiles.set(key, tile);
    this.activeChunks.add(key);

    return tile;
  }

  /**
   * Get or create the template geometry (shared structure, cloned per tile)
   * PERFORMANCE: Creating PlaneGeometry from scratch is expensive - clone template instead
   */
  private getOrCreateTemplateGeometry(): THREE.PlaneGeometry {
    if (!this.templateGeometry) {
      this.templateGeometry = new THREE.PlaneGeometry(
        this.CONFIG.TILE_SIZE,
        this.CONFIG.TILE_SIZE,
        this.CONFIG.TILE_RESOLUTION - 1,
        this.CONFIG.TILE_RESOLUTION - 1,
      );
      this.templateGeometry.rotateX(-Math.PI / 2);

      // Pre-allocate reusable buffers
      const vertexCount = this.templateGeometry.attributes.position.count;
      this.templateColors = new Float32Array(vertexCount * 3);
      this.templateBiomeIds = new Float32Array(vertexCount);
    }
    return this.templateGeometry;
  }

  private createTileGeometry(
    tileX: number,
    tileZ: number,
  ): THREE.PlaneGeometry {
    // PERFORMANCE: Clone template geometry instead of creating new PlaneGeometry
    const template = this.getOrCreateTemplateGeometry();
    const geometry = template.clone();

    const positions = geometry.attributes.position;
    // Reuse pre-allocated buffers (create new for final attribute, but fill from template)
    const colors = new Float32Array(positions.count * 3);
    const heightData: number[] = [];
    const biomeIds = new Float32Array(positions.count);
    const roadInfluences = new Float32Array(positions.count);

    // Verify biome data is loaded - error if not
    if (Object.keys(BIOMES).length === 0) {
      throw new Error(
        "[TerrainSystem] BIOMES data not loaded! DataManager must initialize before terrain generation.",
      );
    }
    const defaultBiomeData = BIOMES["plains"];
    if (!defaultBiomeData) {
      throw new Error("[TerrainSystem] Plains biome not found in BIOMES data!");
    }

    // Generate heightmap and vertex colors
    // IMPORTANT: Always use getHeightAtComputed during tile generation to ensure
    // deterministic heights. Cached heights (from other tiles) use bilinear interpolation
    // which can differ slightly from computed values, causing seams at ANY position
    // where the shoreline adjustment samples across tile boundaries.
    const positionsArray = positions.array as Float32Array;
    for (let i = 0; i < positions.count; i++) {
      const i3 = i * 3;
      const localX = positionsArray[i3];
      const localZ = positionsArray[i3 + 2];

      // Convert to world coordinates
      const x = localX + tileX * this.CONFIG.TILE_SIZE;
      const z = localZ + tileZ * this.CONFIG.TILE_SIZE;

      // Always use deterministic computed heights during tile generation
      // This ensures identical heights regardless of which tiles are loaded
      // and eliminates seams from cache interpolation differences
      const height = this.getHeightAtComputed(x, z);

      positionsArray[i3 + 1] = height;
      heightData.push(height);

      // Get biome influences for smooth color blending
      const { biomeWeightMap, totalWeight } =
        this.computeBiomeWeightsAtPosition(x, z);
      const normalizedHeight = height / this.CONFIG.MAX_HEIGHT;

      // Store dominant biome ID for shader
      let dominantBiome = "plains";
      let dominantWeight = -Infinity;

      // PERFORMANCE: Reuse _tempColor to avoid GC pressure (no new THREE.Color per vertex)
      // Blend up to 3 biome colors based on influence weights
      let colorR = 0,
        colorG = 0,
        colorB = 0;

      if (totalWeight > 0) {
        const invTotal = 1 / totalWeight;
        for (const [type, rawWeight] of biomeWeightMap) {
          const weight = rawWeight * invTotal;
          if (weight > dominantWeight) {
            dominantWeight = weight;
            dominantBiome = type;
          }

          const biomeData = BIOMES[type];
          if (!biomeData) {
            throw new Error(
              `[TerrainSystem] Biome "${type}" not found in BIOMES data!`,
            );
          }
          // Use _tempColor to parse hex once, then extract RGB (no allocation)
          this._tempColor.set(biomeData.color);

          // Accumulate weighted colors directly to numbers
          colorR += this._tempColor.r * weight;
          colorG += this._tempColor.g * weight;
          colorB += this._tempColor.b * weight;
        }
      } else {
        const biomeData = BIOMES["plains"];
        if (!biomeData) {
          throw new Error(
            `[TerrainSystem] Biome "plains" not found in BIOMES data!`,
          );
        }
        // Use _tempColor to parse hex once, then extract RGB (no allocation)
        this._tempColor.set(biomeData.color);
        colorR = this._tempColor.r;
        colorG = this._tempColor.g;
        colorB = this._tempColor.b;
      }
      biomeIds[i] = this.getBiomeId(dominantBiome);

      // Apply brownish shoreline tint near water level
      const waterLevel = this.CONFIG.WATER_LEVEL_NORMALIZED;
      const shorelineThreshold = this.CONFIG.SHORELINE_THRESHOLD;
      if (
        normalizedHeight > waterLevel &&
        normalizedHeight < shorelineThreshold
      ) {
        // Sandy brown (0x8b7355) pre-computed: r=0.545, g=0.451, b=0.333
        const shoreFactor =
          (1.0 -
            (normalizedHeight - waterLevel) /
              (shorelineThreshold - waterLevel)) *
          this.CONFIG.SHORELINE_STRENGTH;
        colorR = colorR + (0.545 - colorR) * shoreFactor;
        colorG = colorG + (0.451 - colorG) * shoreFactor;
        colorB = colorB + (0.333 - colorB) * shoreFactor;
      }

      // Calculate road influence - shader uses this attribute for road coloring
      // (vertex colors are NOT modified for roads, shader handles this procedurally)
      roadInfluences[i] = this.calculateRoadInfluenceAtVertex(
        x,
        z,
        tileX,
        tileZ,
      );

      // Store biome color (kept for potential fallback/debug rendering)
      colors[i * 3] = colorR;
      colors[i * 3 + 1] = colorG;
      colors[i * 3 + 2] = colorB;
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("biomeId", new THREE.BufferAttribute(biomeIds, 1));
    geometry.setAttribute(
      "roadInfluence",
      new THREE.BufferAttribute(roadInfluences, 1),
    );

    if (TERRAIN_ROAD_INFLUENCE_DEBUG) {
      let nonZeroCount = 0;
      let maxInfluence = 0;
      for (let i = 0; i < roadInfluences.length; i++) {
        if (roadInfluences[i] > 0) {
          nonZeroCount++;
          maxInfluence = Math.max(maxInfluence, roadInfluences[i]);
        }
      }
      if (nonZeroCount > 0) {
        console.log(
          `[TerrainSystem] Tile (${tileX}, ${tileZ}): ${nonZeroCount}/${roadInfluences.length} vertices with road influence, max=${maxInfluence.toFixed(3)}`,
        );
      }
    }

    // Compute normals from overflow height grid (centered differences).
    // Passes the already-computed heightData to avoid recomputing interior heights.
    this.computeHeightFieldNormals(geometry, tileX, tileZ, heightData);
    // Carve terrain triangles inside building flat zones to avoid overdraw
    this.applyFlatZoneCarve(geometry, tileX, tileZ);

    // Store height data for persistence
    this.storeHeightData(tileX, tileZ, heightData);

    return geometry;
  }

  // Track which tiles we've logged road segment info for (to avoid spam)
  private _loggedTileSegments = new Set<string>();

  /**
   * Calculate road influence at a vertex position
   * Returns 0-1 where 1 = center of road, 0 = no road
   *
   * COORDINATE SYSTEM NOTE:
   * - Terrain tiles are centered: tile (0,0) covers world X/Z = -50 to +50
   * - Road tiles use origin-based: tile (0,0) covers world X/Z = 0 to 100
   * - We must convert world coords to road tile coords for correct lookup
   */
  private calculateRoadInfluenceAtVertex(
    worldX: number,
    worldZ: number,
    _tileX: number, // Terrain tile X (unused - we compute road tile from world coords)
    _tileZ: number, // Terrain tile Z (unused - we compute road tile from world coords)
  ): number {
    // Lazy-load road system reference
    this.roadNetworkSystem ??= this.world.getSystem("roads") as
      | RoadNetworkSystem
      | undefined;
    if (!this.roadNetworkSystem) return 0;

    // Convert world coordinates to road tile coordinates
    // Road system uses origin-based tiles: tile (0,0) = world X/Z 0 to 100
    const roadTileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
    const roadTileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);
    let segments: ReadonlyArray<RoadTileSegment>;
    if (
      roadTileX === this._cachedRoadTileX &&
      roadTileZ === this._cachedRoadTileZ
    ) {
      segments = this._cachedRoadSegments;
    } else {
      segments = this.roadNetworkSystem.getRoadSegmentsForTile(
        roadTileX,
        roadTileZ,
      );
      this._cachedRoadTileX = roadTileX;
      this._cachedRoadTileZ = roadTileZ;
      this._cachedRoadSegments = segments;
    }

    if (TERRAIN_ROAD_INFLUENCE_DEBUG) {
      const debugKey = `road_${roadTileX}_${roadTileZ}`;
      if (!this._loggedTileSegments.has(debugKey)) {
        this._loggedTileSegments.add(debugKey);
        if (segments.length > 0) {
          console.log(
            `[TerrainSystem] Road tile (${roadTileX}, ${roadTileZ}) has ${segments.length} road segments`,
          );
        }
      }
    }

    if (segments.length === 0) return 0;

    // Convert world coords to road-tile-local coordinates (0 to TILE_SIZE range)
    const localX = worldX - roadTileX * this.CONFIG.TILE_SIZE;
    const localZ = worldZ - roadTileZ * this.CONFIG.TILE_SIZE;

    // Find minimum distance and width to any road segment
    let minDistanceSq = Infinity;
    let closestWidth = this.CONFIG.ROAD_WIDTH;

    for (const segment of segments) {
      const distanceSq = this.distanceToLineSegmentLocalSq(
        localX,
        localZ,
        segment.start.x,
        segment.start.z,
        segment.end.x,
        segment.end.z,
      );
      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        closestWidth = segment.width;
      }
    }

    // Calculate influence based on distance
    const halfWidth = closestWidth / 2;
    const totalInfluenceWidth = halfWidth + ROAD_BLEND_WIDTH;
    const halfWidthSq = halfWidth * halfWidth;
    const totalInfluenceWidthSq = totalInfluenceWidth * totalInfluenceWidth;

    if (minDistanceSq >= totalInfluenceWidthSq) return 0;
    if (minDistanceSq <= halfWidthSq) return 1.0;

    // In blend zone - apply smoothstep falloff
    const minDistance = Math.sqrt(minDistanceSq);
    const t = 1.0 - (minDistance - halfWidth) / ROAD_BLEND_WIDTH;
    return t * t * (3 - 2 * t); // smoothstep
  }

  /**
   * Calculate squared distance from point to line segment (local coordinates)
   */
  private distanceToLineSegmentLocalSq(
    px: number,
    pz: number,
    x1: number,
    z1: number,
    x2: number,
    z2: number,
  ): number {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lengthSq = dx * dx + dz * dz;

    if (lengthSq === 0) {
      // Segment is a point
      const ddx = px - x1;
      const ddz = pz - z1;
      return ddx * ddx + ddz * ddz;
    }

    // Project point onto segment
    const t = Math.max(
      0,
      Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lengthSq),
    );

    const projX = x1 + t * dx;
    const projZ = z1 + t * dz;

    const ddx = px - projX;
    const ddz = pz - projZ;
    return ddx * ddx + ddz * ddz;
  }

  /**
   * Calculate distance from point to line segment (local coordinates)
   */
  private distanceToLineSegmentLocal(
    px: number,
    pz: number,
    x1: number,
    z1: number,
    x2: number,
    z2: number,
  ): number {
    return Math.sqrt(this.distanceToLineSegmentLocalSq(px, pz, x1, z1, x2, z2));
  }

  /**
   * Initialize GPU compute context from renderer.
   * Should be called when the WebGPU renderer is available.
   */
  public initializeGPUCompute(renderer: THREE.WebGPURenderer): boolean {
    if (!this.terrainComputeContext) {
      return false;
    }

    try {
      this.gpuComputeAvailable =
        this.terrainComputeContext.initializeFromRenderer(renderer);
      if (this.gpuComputeAvailable) {
        console.log("[TerrainSystem] GPU compute initialized successfully");
      }
      return this.gpuComputeAvailable;
    } catch (error) {
      console.warn("[TerrainSystem] GPU compute initialization failed:", error);
      this.gpuComputeAvailable = false;
      return false;
    }
  }

  /**
   * Compute road influence for all vertices in a tile using GPU.
   * Falls back to CPU if GPU is not available.
   *
   * @param vertices - Float32Array of [localX, localZ, ...] pairs
   * @param tileX - Tile X coordinate
   * @param tileZ - Tile Z coordinate
   * @returns Float32Array of influence values (0-1) per vertex
   */
  private async computeRoadInfluenceBatchGPU(
    vertices: Float32Array,
    tileX: number,
    tileZ: number,
  ): Promise<Float32Array | null> {
    // Get road segments
    this.roadNetworkSystem ??= this.world.getSystem("roads") as
      | RoadNetworkSystem
      | undefined;
    if (!this.roadNetworkSystem) return null;

    const segments = this.roadNetworkSystem.getRoadSegmentsForTile(
      tileX,
      tileZ,
    );
    if (segments.length === 0) return null;

    const vertexCount = vertices.length / 2;

    // Check if GPU should be used
    if (
      this.gpuComputeAvailable &&
      this.terrainComputeContext &&
      this.terrainComputeContext.shouldUseGPUForRoadInfluence(
        vertexCount,
        segments.length,
      )
    ) {
      try {
        // Convert segments to GPU format
        const gpuRoads: GPURoadSegment[] = segments.map((seg) => ({
          startX: seg.start.x,
          startZ: seg.start.z,
          endX: seg.end.x,
          endZ: seg.end.z,
          width: seg.width,
        }));

        const tileOffset = {
          x: tileX * this.CONFIG.TILE_SIZE,
          z: tileZ * this.CONFIG.TILE_SIZE,
        };

        // Use GPU compute
        const influences =
          await this.terrainComputeContext.computeRoadInfluence(
            vertices,
            gpuRoads,
            tileOffset,
          );

        return influences;
      } catch (error) {
        console.warn(
          "[TerrainSystem] GPU road influence failed, falling back to CPU:",
          error,
        );
        // Fall through to CPU computation
      }
    }

    // CPU fallback
    return this.computeRoadInfluenceBatchCPU(vertices, tileX, tileZ, segments);
  }

  /**
   * Compute road influence for all vertices using CPU (fallback).
   */
  private computeRoadInfluenceBatchCPU(
    vertices: Float32Array,
    tileX: number,
    tileZ: number,
    segments: Array<{
      start: { x: number; z: number };
      end: { x: number; z: number };
      width: number;
    }>,
  ): Float32Array {
    const vertexCount = vertices.length / 2;
    const influences = new Float32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      const localX = vertices[i * 2];
      const localZ = vertices[i * 2 + 1];

      let minDistanceSq = Infinity;
      let closestWidth = this.CONFIG.ROAD_WIDTH;

      for (const segment of segments) {
        const distanceSq = this.distanceToLineSegmentLocalSq(
          localX,
          localZ,
          segment.start.x,
          segment.start.z,
          segment.end.x,
          segment.end.z,
        );
        if (distanceSq < minDistanceSq) {
          minDistanceSq = distanceSq;
          closestWidth = segment.width;
        }
      }

      // Calculate influence
      const halfWidth = closestWidth / 2;
      const totalInfluenceWidth = halfWidth + ROAD_BLEND_WIDTH;
      const halfWidthSq = halfWidth * halfWidth;
      const totalInfluenceWidthSq = totalInfluenceWidth * totalInfluenceWidth;

      if (minDistanceSq >= totalInfluenceWidthSq) {
        influences[i] = 0;
      } else if (minDistanceSq <= halfWidthSq) {
        influences[i] = 1.0;
      } else {
        const minDistance = Math.sqrt(minDistanceSq);
        const t = 1.0 - (minDistance - halfWidth) / ROAD_BLEND_WIDTH;
        influences[i] = t * t * (3 - 2 * t); // smoothstep
      }
    }

    return influences;
  }

  /**
   * Refresh vertex colors for all loaded tiles
   * Called when road network becomes available to apply road coloring
   *
   * MAIN THREAD PROTECTION: Processes tiles in batches with yielding
   * to prevent frame drops during road color updates.
   */
  /**
   * Refresh road influence for all loaded terrain tiles.
   * Called when road network becomes available to apply road coloring.
   *
   * NOTE: The terrain shader uses the `roadInfluence` attribute for road coloring,
   * NOT vertex colors. Colors are computed procedurally in the shader from height/slope/noise.
   *
   * MAIN THREAD PROTECTION: Processes tiles in batches with yielding.
   */
  private async refreshRoadInfluence(): Promise<void> {
    if (!this.roadNetworkSystem) {
      console.warn(
        "[TerrainSystem] Cannot refresh road influence - road system not available",
      );
      return;
    }

    // Invalidate per-tile road segment lookup cache before recomputing attributes.
    this._cachedRoadTileX = Number.NaN;
    this._cachedRoadTileZ = Number.NaN;
    this._cachedRoadSegments = [];

    const roads = this.roadNetworkSystem.getRoads();
    console.log(
      `[TerrainSystem] Refreshing road influence for ${this.terrainTiles.size} tiles (${roads.length} roads in network)`,
    );

    const tiles = Array.from(this.terrainTiles.values());
    const TILES_PER_BATCH = 4; // Process 4 tiles per batch
    let tilesUpdated = 0;
    let totalVerticesWithRoads = 0;

    for (let tileIdx = 0; tileIdx < tiles.length; tileIdx += TILES_PER_BATCH) {
      const batchEnd = Math.min(tileIdx + TILES_PER_BATCH, tiles.length);

      for (let t = tileIdx; t < batchEnd; t++) {
        const tile = tiles[t];
        if (!tile.mesh) continue;

        const tileX = tile.x;
        const tileZ = tile.z;

        // Terrain tile (tileX, tileZ) covers world coords:
        // X: (tileX * TILE_SIZE - TILE_SIZE/2) to (tileX * TILE_SIZE + TILE_SIZE/2)
        // This overlaps road tiles: floor(worldMin/TILE_SIZE) to floor(worldMax/TILE_SIZE)
        const halfTile = this.CONFIG.TILE_SIZE / 2;
        const worldMinX = tileX * this.CONFIG.TILE_SIZE - halfTile;
        const worldMaxX = tileX * this.CONFIG.TILE_SIZE + halfTile;
        const worldMinZ = tileZ * this.CONFIG.TILE_SIZE - halfTile;
        const worldMaxZ = tileZ * this.CONFIG.TILE_SIZE + halfTile;

        const roadTileMinX = Math.floor(worldMinX / this.CONFIG.TILE_SIZE);
        const roadTileMaxX = Math.floor(worldMaxX / this.CONFIG.TILE_SIZE);
        const roadTileMinZ = Math.floor(worldMinZ / this.CONFIG.TILE_SIZE);
        const roadTileMaxZ = Math.floor(worldMaxZ / this.CONFIG.TILE_SIZE);

        // Check if ANY overlapping road tile has segments
        let hasRoadSegments = false;
        for (
          let rx = roadTileMinX;
          rx <= roadTileMaxX && !hasRoadSegments;
          rx++
        ) {
          for (
            let rz = roadTileMinZ;
            rz <= roadTileMaxZ && !hasRoadSegments;
            rz++
          ) {
            const segments = this.roadNetworkSystem.getRoadSegmentsForTile(
              rx,
              rz,
            );
            if (segments.length > 0) hasRoadSegments = true;
          }
        }
        if (!hasRoadSegments) continue;

        // Get geometry and roadInfluence attribute
        const geometry = (tile.mesh as THREE.Mesh)
          .geometry as THREE.BufferGeometry;
        if (!geometry) continue;

        const positions = geometry.attributes.position;
        const roadInfluenceAttr = geometry.getAttribute("roadInfluence");
        if (!positions || !(roadInfluenceAttr instanceof THREE.BufferAttribute))
          continue;

        const positionArray = positions.array as Float32Array;
        const roadInfluenceArray = roadInfluenceAttr.array as Float32Array;
        let verticesWithRoadInfluence = 0;

        // Update road influence for each vertex
        for (let i = 0; i < positions.count; i++) {
          const i3 = i * 3;
          const localX = positionArray[i3];
          const localZ = positionArray[i3 + 2];
          const worldX = localX + tileX * this.CONFIG.TILE_SIZE;
          const worldZ = localZ + tileZ * this.CONFIG.TILE_SIZE;

          const influence = this.calculateRoadInfluenceAtVertex(
            worldX,
            worldZ,
            tileX,
            tileZ,
          );
          roadInfluenceArray[i] = influence;
          if (influence > 0) verticesWithRoadInfluence++;
        }

        // Mark attribute as needing GPU update
        roadInfluenceAttr.needsUpdate = true;
        tilesUpdated++;
        totalVerticesWithRoads += verticesWithRoadInfluence;
      }

      // Yield to main thread between batches
      if (batchEnd < tiles.length) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    console.log(
      `[TerrainSystem] Road influence refresh complete: ${tilesUpdated}/${tiles.length} tiles updated, ${totalVerticesWithRoads} vertices with road influence`,
    );
    // Log which tiles were skipped (no road segments)
    if (tilesUpdated === 0 && tiles.length > 0) {
      console.warn(
        `[TerrainSystem] WARNING: No tiles had road segments! Check if roads are in the visible area.`,
      );
      // Log tile keys for debugging
      const tileKeys = Array.from(this.terrainTiles.keys()).join(", ");
      console.log(`[TerrainSystem] Existing tile keys: ${tileKeys}`);
    }
  }

  /**
   * Map biome name to numeric ID for shader
   */
  private getBiomeId(biomeName: string): number {
    const biomeIds: Record<string, number> = {
      plains: 0,
      forest: 1,
      valley: 2,
      mountains: 3,
      tundra: 4,
      desert: 5,
      lakes: 6,
      swamp: 7,
    };
    return biomeIds[biomeName] || 0;
  }

  private getIslandMask(worldX: number, worldZ: number): number {
    if (!this.CONFIG.ISLAND_MASK_ENABLED) return 1;

    const maxRadiusMeters = this.getActiveWorldSizeMeters() / 2;
    if (maxRadiusMeters <= 0) return 1;

    const falloffMeters = Math.max(
      this.CONFIG.ISLAND_FALLOFF_TILES * this.CONFIG.TILE_SIZE,
      this.CONFIG.TILE_SIZE,
    );
    const noiseScale = this.CONFIG.ISLAND_EDGE_NOISE_SCALE;
    const noiseStrength = this.CONFIG.ISLAND_EDGE_NOISE_STRENGTH;
    const edgeNoise =
      noiseScale > 0 && noiseStrength > 0
        ? this.noise.simplex2D(worldX * noiseScale, worldZ * noiseScale)
        : 0;
    const radiusVariance = maxRadiusMeters * noiseStrength * edgeNoise;
    const adjustedRadius = Math.max(
      falloffMeters,
      maxRadiusMeters + radiusVariance,
    );
    const falloffStart = adjustedRadius - falloffMeters;

    const distance = Math.sqrt(worldX * worldX + worldZ * worldZ);
    if (distance <= falloffStart) return 1;
    if (distance >= adjustedRadius) return 0;

    const t = (distance - falloffStart) / falloffMeters;
    const smooth = t * t * (3 - 2 * t);
    return 1 - smooth;
  }

  /**
   * Get base terrain height WITHOUT mountain biome boost.
   * Used for biome influence calculation to avoid feedback loops.
   */
  private getBaseHeightAt(worldX: number, worldZ: number): number {
    if (!this.noise) {
      this.noise = new NoiseGenerator(this.computeSeedFromWorldId());
      if (!this.biomeCenters || this.biomeCenters.length === 0) {
        this.initializeBiomeCenters();
      }
    }

    // Multi-layered noise — constants from TerrainHeightParams (single source of truth)
    const continentNoise = this.noise.fractal2D(
      worldX * CONTINENT_LAYER.scale,
      worldZ * CONTINENT_LAYER.scale,
      CONTINENT_LAYER.octaves!,
      CONTINENT_LAYER.persistence!,
      CONTINENT_LAYER.lacunarity!,
    );
    const ridgeNoise = this.noise.ridgeNoise2D(
      worldX * RIDGE_LAYER.scale,
      worldZ * RIDGE_LAYER.scale,
    );
    const hillNoise = this.noise.fractal2D(
      worldX * HILL_LAYER.scale,
      worldZ * HILL_LAYER.scale,
      HILL_LAYER.octaves!,
      HILL_LAYER.persistence!,
      HILL_LAYER.lacunarity!,
    );
    const erosionNoise = this.noise.erosionNoise2D(
      worldX * EROSION_LAYER.scale,
      worldZ * EROSION_LAYER.scale,
      EROSION_LAYER.iterations!,
    );
    const detailNoise = this.noise.fractal2D(
      worldX * DETAIL_LAYER.scale,
      worldZ * DETAIL_LAYER.scale,
      DETAIL_LAYER.octaves!,
      DETAIL_LAYER.persistence!,
      DETAIL_LAYER.lacunarity!,
    );

    let height = 0;
    height += continentNoise * CONTINENT_LAYER.weight;
    height += ridgeNoise * RIDGE_LAYER.weight;
    height += hillNoise * HILL_LAYER.weight;
    height += erosionNoise * EROSION_LAYER.weight;
    height += detailNoise * DETAIL_LAYER.weight;

    height = (height + 1) * 0.5;
    height = Math.max(0, Math.min(1, height));
    height = Math.pow(height, HEIGHT_POWER_CURVE);

    // Natural coastline — noise varies island radius for irregular shoreline
    const distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
    const angle = Math.atan2(worldZ, worldX);
    const cnx = Math.cos(angle) * COASTLINE_CIRCLE_SAMPLE_RADIUS;
    const cnz = Math.sin(angle) * COASTLINE_CIRCLE_SAMPLE_RADIUS;

    const coastNoise1 = this.noise.fractal2D(
      cnx,
      cnz,
      COAST_LARGE.octaves,
      COAST_LARGE.persistence,
      COAST_LARGE.lacunarity,
    );
    const coastNoise2 = this.noise.fractal2D(
      cnx * COAST_MEDIUM.freqMultiplier,
      cnz * COAST_MEDIUM.freqMultiplier,
      COAST_MEDIUM.octaves,
      COAST_MEDIUM.persistence,
      COAST_MEDIUM.lacunarity,
    );
    const coastNoise3 = this.noise.simplex2D(
      cnx * COAST_SMALL.freqMultiplier,
      cnz * COAST_SMALL.freqMultiplier,
    );

    const coastlineVariation =
      coastNoise1 * COAST_LARGE.weight +
      coastNoise2 * COAST_MEDIUM.weight +
      coastNoise3 * COAST_SMALL.weight;
    const effectiveRadius = ISLAND_RADIUS * (1 + coastlineVariation);

    // Island mask — smooth falloff at edges
    let islandMask = 1.0;
    if (distFromCenter > effectiveRadius - ISLAND_FALLOFF) {
      const edgeDist = distFromCenter - (effectiveRadius - ISLAND_FALLOFF);
      const t = Math.min(1.0, edgeDist / ISLAND_FALLOFF);
      const smoothstep = t * t * (3 - 2 * t);
      islandMask = 1.0 - smoothstep;
    }
    if (distFromCenter > effectiveRadius + ISLAND_DEEP_OCEAN_BUFFER) {
      islandMask = 0;
    }

    // Pond — offset from center near spawn
    const distFromPond = Math.sqrt(
      (worldX - POND_CENTER_X) * (worldX - POND_CENTER_X) +
        (worldZ - POND_CENTER_Z) * (worldZ - POND_CENTER_Z),
    );
    let pondDepression = 0;
    if (distFromPond < POND_RADIUS * 2) {
      const pondFactor = 1.0 - distFromPond / (POND_RADIUS * 2);
      pondDepression = pondFactor * pondFactor * POND_DEPTH;
    }

    height = height * islandMask;
    height = height * HEIGHT_TERRAIN_MIX + BASE_ELEVATION * islandMask;
    height -= pondDepression;

    if (islandMask === 0) {
      height = OCEAN_FLOOR_HEIGHT;
    }

    return height * this.CONFIG.MAX_HEIGHT;
  }

  private getHeightAtWithoutShore(worldX: number, worldZ: number): number {
    // Ensure biome centers are initialized
    if (!this.biomeCenters || this.biomeCenters.length === 0) {
      if (!this.noise) {
        this.noise = new NoiseGenerator(this.computeSeedFromWorldId());
      }
      this.initializeBiomeCenters();
    }

    // Check flat zones first (for stations, etc.)
    const flatHeight = this.getFlatZoneHeight(worldX, worldZ);
    if (flatHeight !== null) {
      return flatHeight;
    }

    // Get procedural height with mountain boost
    return this.getProceduralHeightWithBoost(worldX, worldZ);
  }

  /**
   * Get procedural terrain height with mountain biome boost applied.
   * This bypasses flat zones and returns the raw procedural height.
   * Useful for positioning objects that should sit above the terrain mesh.
   */
  getProceduralHeightAt(worldX: number, worldZ: number): number {
    return this.getProceduralHeightWithBoost(worldX, worldZ);
  }

  /**
   * Get procedural terrain height with mountain biome boost applied.
   * Extracted for reuse in flat zone blending.
   */
  private getProceduralHeightWithBoost(worldX: number, worldZ: number): number {
    // Get base height (without mountain boost)
    const baseHeight = this.getBaseHeightAt(worldX, worldZ);
    let height = baseHeight / this.CONFIG.MAX_HEIGHT; // Normalize for boost calc

    // Apply mountain biome height boost
    let mountainBoost = 0;
    for (const center of this.biomeCenters) {
      if (center.type === "mountains") {
        const dx = worldX - center.x;
        const dz = worldZ - center.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const normalizedDist = distance / center.influence;

        if (normalizedDist < MOUNTAIN_BOOST_MAX_NORM_DIST) {
          const boost = Math.exp(
            -normalizedDist * normalizedDist * MOUNTAIN_BOOST_GAUSSIAN_COEFF,
          );
          mountainBoost = Math.max(mountainBoost, boost);
        }
      }
    }

    // Apply mountain height boost from CONFIG
    height = height * (1 + mountainBoost * this.CONFIG.MOUNTAIN_HEIGHT_BOOST);
    height = Math.min(1, height); // Cap at max

    return height * this.CONFIG.MAX_HEIGHT;
  }

  private calculateBaseSlopeAt(
    worldX: number,
    worldZ: number,
    centerHeight: number,
  ): number {
    const checkDistance = this.CONFIG.SHORELINE_SLOPE_SAMPLE_DISTANCE;
    const northHeight = this.getHeightAtWithoutShore(
      worldX,
      worldZ + checkDistance,
    );
    const southHeight = this.getHeightAtWithoutShore(
      worldX,
      worldZ - checkDistance,
    );
    const eastHeight = this.getHeightAtWithoutShore(
      worldX + checkDistance,
      worldZ,
    );
    const westHeight = this.getHeightAtWithoutShore(
      worldX - checkDistance,
      worldZ,
    );

    const slopes = [
      Math.abs(northHeight - centerHeight) / checkDistance,
      Math.abs(southHeight - centerHeight) / checkDistance,
      Math.abs(eastHeight - centerHeight) / checkDistance,
      Math.abs(westHeight - centerHeight) / checkDistance,
    ];

    return Math.max(...slopes);
  }

  private adjustHeightForShoreline(baseHeight: number, slope: number): number {
    const waterThreshold = this.CONFIG.WATER_THRESHOLD;
    if (baseHeight === waterThreshold) return baseHeight;

    const isLand = baseHeight > waterThreshold;
    const band = isLand
      ? this.CONFIG.SHORELINE_LAND_BAND
      : this.CONFIG.SHORELINE_UNDERWATER_BAND;
    if (band <= 0) return baseHeight;

    const delta = Math.abs(baseHeight - waterThreshold);
    if (delta >= band) return baseHeight;

    const minSlope = this.CONFIG.SHORELINE_MIN_SLOPE;
    if (minSlope <= 0) return baseHeight;

    const maxMultiplier = isLand
      ? this.CONFIG.SHORELINE_LAND_MAX_MULTIPLIER
      : this.CONFIG.UNDERWATER_DEPTH_MULTIPLIER;
    if (maxMultiplier <= 1) return baseHeight;

    const slopeSafe = Math.max(0.0001, slope);
    const targetMultiplier = Math.min(
      maxMultiplier,
      Math.max(1, minSlope / slopeSafe),
    );
    const falloff = 1 - delta / band;
    const multiplier = 1 + (targetMultiplier - 1) * falloff;
    const adjustedDelta = delta * multiplier;

    return isLand
      ? waterThreshold + adjustedDelta
      : waterThreshold - adjustedDelta;
  }

  // ============================================================================
  // WORLD ↔ TILE COORDINATE HELPERS (Single source of truth)
  //
  // Terrain geometry is CENTERED at (tileX * TILE_SIZE, 0, tileZ * TILE_SIZE).
  // PlaneGeometry vertices range from -TILE_SIZE/2 to +TILE_SIZE/2.
  // So terrain tile N covers world coords [(N-0.5)*SIZE, (N+0.5)*SIZE).
  //
  // heightData is row-major: heightData[iz * RESOLUTION + ix], where
  //   ix=0 → geom_x = -TILE_SIZE/2,  ix=RESOLUTION-1 → geom_x = +TILE_SIZE/2
  // ============================================================================

  /**
   * World coordinate → terrain tile index (accounts for centered geometry).
   * Tile N's geometry spans world [(N-0.5)*SIZE, (N+0.5)*SIZE).
   */
  private worldToTerrainTileIndex(worldCoord: number): number {
    return Math.floor(
      (worldCoord + this.CONFIG.TILE_SIZE * 0.5) / this.CONFIG.TILE_SIZE,
    );
  }

  /**
   * Geometry-local coordinate → heightData grid index.
   * localCoord is worldCoord - tileIndex * TILE_SIZE, ranging [-SIZE/2, +SIZE/2].
   * Returns a float in [0, RESOLUTION-1] suitable for bilinear interpolation.
   */
  private localToGridIndex(localCoord: number): number {
    const gridStep = this.CONFIG.TILE_SIZE / (this.CONFIG.TILE_RESOLUTION - 1);
    return (localCoord + this.CONFIG.TILE_SIZE * 0.5) / gridStep;
  }

  /**
   * PERFORMANCE: Get height from cached tile data using bilinear interpolation.
   * Returns null if tile not loaded - caller should fallback to getHeightAtComputed().
   * O(1) lookup vs O(n) noise computation.
   */
  private getHeightAtCached(worldX: number, worldZ: number): number | null {
    const tileX = this.worldToTerrainTileIndex(worldX);
    const tileZ = this.worldToTerrainTileIndex(worldZ);
    const key = `${tileX}_${tileZ}`;
    const tile = this.terrainTiles.get(key);

    if (!tile?.heightData || tile.heightData.length === 0) {
      return null;
    }

    const resolution = this.CONFIG.TILE_RESOLUTION;

    const localX = worldX - tileX * this.CONFIG.TILE_SIZE;
    const localZ = worldZ - tileZ * this.CONFIG.TILE_SIZE;

    const gx = this.localToGridIndex(localX);
    const gz = this.localToGridIndex(localZ);

    // Clamp to valid range
    const gxClamped = Math.max(0, Math.min(resolution - 1.001, gx));
    const gzClamped = Math.max(0, Math.min(resolution - 1.001, gz));

    // Integer indices for bilinear interpolation
    const ix0 = Math.floor(gxClamped);
    const iz0 = Math.floor(gzClamped);
    const ix1 = Math.min(ix0 + 1, resolution - 1);
    const iz1 = Math.min(iz0 + 1, resolution - 1);

    // Fractional parts
    const fx = gxClamped - ix0;
    const fz = gzClamped - iz0;

    // Sample four corners (row-major: index = iz * resolution + ix)
    const h00 = tile.heightData[iz0 * resolution + ix0];
    const h10 = tile.heightData[iz0 * resolution + ix1];
    const h01 = tile.heightData[iz1 * resolution + ix0];
    const h11 = tile.heightData[iz1 * resolution + ix1];

    // Bilinear interpolation
    const h0 = h00 + (h10 - h00) * fx;
    const h1 = h01 + (h11 - h01) * fx;
    return h0 + (h1 - h0) * fz;
  }

  /**
   * Compute height using noise functions (expensive, used when tile not cached)
   *
   * CRITICAL: Also checks flat zones to ensure terrain mesh vertices are at the correct
   * height under buildings/stations. Without this, terrain mesh would render at procedural
   * height while building floors are at flat zone height, causing z-fighting.
   */
  private getHeightAtComputed(worldX: number, worldZ: number): number {
    // Check flat zones FIRST - buildings and stations need terrain at their floor height
    // to prevent z-fighting between terrain mesh and building floor geometry
    const flatHeight = this.getFlatZoneHeight(worldX, worldZ);
    if (flatHeight !== null) {
      return flatHeight;
    }

    return this.getHeightAtComputedSkipFlatZone(worldX, worldZ);
  }

  /**
   * Compute height using noise (expensive). Skips flat zone check — caller must check first.
   * PERF: Avoids redundant getFlatZoneHeight() when called from getHeightAt().
   */
  private getHeightAtComputedSkipFlatZone(
    worldX: number,
    worldZ: number,
  ): number {
    const baseHeight = this.getHeightAtWithoutShore(worldX, worldZ);
    const waterThreshold = this.CONFIG.WATER_THRESHOLD;
    const landBand = this.CONFIG.SHORELINE_LAND_BAND;
    const underwaterBand = this.CONFIG.SHORELINE_UNDERWATER_BAND;

    if (
      baseHeight >= waterThreshold + landBand ||
      baseHeight <= waterThreshold - underwaterBand
    ) {
      return baseHeight;
    }

    const slope = this.calculateBaseSlopeAt(worldX, worldZ, baseHeight);
    return this.adjustHeightForShoreline(baseHeight, slope);
  }

  getHeightAt(worldX: number, worldZ: number): number {
    // Validate inputs
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      throw new Error(
        `[TerrainSystem] getHeightAt: invalid coords (${worldX}, ${worldZ})`,
      );
    }

    // CRITICAL: Check flat zones FIRST - they may be registered after terrain generation
    // This ensures buildings and other structures have correct floor heights even when
    // terrain tiles were generated before their flat zones were registered.
    const flatHeight = this.getFlatZoneHeight(worldX, worldZ);
    if (flatHeight !== null) {
      return flatHeight;
    }

    // PERFORMANCE: Try cached tile data (O(1) bilinear interpolation)
    const cachedHeight = this.getHeightAtCached(worldX, worldZ);
    if (cachedHeight !== null) {
      return cachedHeight;
    }

    // Fallback to expensive noise computation
    // PERF: skip flat zone check inside getHeightAtComputed — we already checked above
    return this.getHeightAtComputedSkipFlatZone(worldX, worldZ);
  }

  // ============================================================================
  // FLAT ZONE SYSTEM (Terrain Flattening for Stations)
  // ============================================================================

  /**
   * Check if position is within a flat zone and return modified height.
   * Returns null if no flat zone applies.
   *
   * Uses terrain tile spatial index (100m tiles) for fast lookup.
   */
  // Debug counter to avoid log spam
  private _flatZoneHitCount = 0;
  private _flatZoneLoggedZones = new Set<string>();

  /**
   * Classify a single flat zone relative to a world position.
   * Calls onCore or onBlend if the zone affects this point.
   */
  private classifyZone(
    zone: FlatZone,
    worldX: number,
    worldZ: number,
    bestCoreDist: number,
    bestBlendFactor: number,
    onCore: (zone: FlatZone, dist: number) => void,
    onBlend: (zone: FlatZone, factor: number) => void,
  ): void {
    if (zone.tileMask) {
      const tileX = Math.floor(worldX);
      const tileZ = Math.floor(worldZ);
      const key = `${tileX},${tileZ}`;
      if (zone.tileMask.has(key)) {
        const dx = Math.abs(worldX - zone.centerX);
        const dz = Math.abs(worldZ - zone.centerZ);
        const halfWidth = zone.width / 2;
        const halfDepth = zone.depth / 2;
        const dist = Math.max(
          halfWidth > 0 ? dx / halfWidth : 0,
          halfDepth > 0 ? dz / halfDepth : 0,
        );
        if (dist < bestCoreDist) {
          onCore(zone, dist);
        }
        return;
      }

      const blend = this.getTileMaskBlendFactor(zone, worldX, worldZ);
      if (blend !== null && blend < bestBlendFactor) {
        onBlend(zone, blend);
      }
      return;
    }

    const dx = Math.abs(worldX - zone.centerX);
    const dz = Math.abs(worldZ - zone.centerZ);
    const halfWidth = zone.width / 2;
    const halfDepth = zone.depth / 2;

    if (dx <= halfWidth && dz <= halfDepth) {
      const dist = Math.max(
        halfWidth > 0 ? dx / halfWidth : 0,
        halfDepth > 0 ? dz / halfDepth : 0,
      );
      if (dist < bestCoreDist) {
        onCore(zone, dist);
      }
    } else if (
      dx <= halfWidth + zone.blendRadius &&
      dz <= halfDepth + zone.blendRadius
    ) {
      const blendX = dx > halfWidth ? (dx - halfWidth) / zone.blendRadius : 0;
      const blendZ = dz > halfDepth ? (dz - halfDepth) / zone.blendRadius : 0;
      const blend = Math.max(blendX, blendZ);
      if (blend < bestBlendFactor) {
        onBlend(zone, blend);
      }
    }
  }

  private getTileMaskBlendFactor(
    zone: FlatZone,
    worldX: number,
    worldZ: number,
  ): number | null {
    if (!zone.tileMaskTiles || zone.tileMaskTiles.length === 0) {
      return null;
    }
    if (zone.blendRadius <= 0) {
      return null;
    }

    const bounds = zone.tileMaskBounds;
    if (bounds) {
      const minX = bounds.minX;
      const maxX = bounds.maxX + 1;
      const minZ = bounds.minZ;
      const maxZ = bounds.maxZ + 1;
      const radius = zone.blendRadius;
      if (
        worldX < minX - radius ||
        worldX > maxX + radius ||
        worldZ < minZ - radius ||
        worldZ > maxZ + radius
      ) {
        return null;
      }
    }

    let bestDist = Infinity;
    for (const tile of zone.tileMaskTiles) {
      const tileMinX = tile.x;
      const tileMaxX = tile.x + 1;
      const tileMinZ = tile.z;
      const tileMaxZ = tile.z + 1;

      const dx =
        worldX < tileMinX
          ? tileMinX - worldX
          : worldX > tileMaxX
            ? worldX - tileMaxX
            : 0;
      const dz =
        worldZ < tileMinZ
          ? tileMinZ - worldZ
          : worldZ > tileMaxZ
            ? worldZ - tileMaxZ
            : 0;

      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        if (bestDist === 0) {
          break;
        }
      }
    }

    if (bestDist <= zone.blendRadius) {
      return bestDist / zone.blendRadius;
    }

    return null;
  }

  private getFlatZoneHeight(worldX: number, worldZ: number): number | null {
    if (this.flatZones.size === 0) {
      return null;
    }

    // Use spatial index: check the terrain tile containing this point
    // and its 8 neighbors (zones can span tile boundaries via blend radius).
    const tileSize = this.CONFIG.TILE_SIZE;
    const halfTile = tileSize / 2;
    const terrainTileX = Math.floor((worldX + halfTile) / tileSize);
    const terrainTileZ = Math.floor((worldZ + halfTile) / tileSize);

    // Collect candidate zones from this tile and neighbors (3x3 grid)
    // PERF: reuse class-level Set to avoid allocation per call
    this._flatZoneChecked.clear();
    const checked = this._flatZoneChecked;
    const result = {
      coreZone: null as FlatZone | null,
      coreDist: Infinity,
      blendZone: null as FlatZone | null,
      blendFactor: Infinity,
    };

    for (let dtx = -1; dtx <= 1; dtx++) {
      for (let dtz = -1; dtz <= 1; dtz++) {
        const key = `${terrainTileX + dtx}_${terrainTileZ + dtz}`;
        const zones = this.flatZonesByTile.get(key);
        if (!zones) continue;

        for (const zone of zones) {
          // Deduplicate zones that span multiple terrain tiles
          if (checked.has(zone.id)) continue;
          checked.add(zone.id);

          this.classifyZone(
            zone,
            worldX,
            worldZ,
            result.coreDist,
            result.blendFactor,
            (coreZone, coreDist) => {
              result.coreZone = coreZone;
              result.coreDist = coreDist;
            },
            (blendZone, blendFactor) => {
              result.blendZone = blendZone;
              result.blendFactor = blendFactor;
            },
          );
        }
      }
    }

    const bestCoreZone = result.coreZone;
    const bestBlendZone = result.blendZone;
    const bestBlendFactor = result.blendFactor;

    // If in a core area, return that zone's flat height.
    if (bestCoreZone) {
      // Retain first-hit bookkeeping for diagnostics without per-zone console spam.
      if (!this._flatZoneLoggedZones.has(bestCoreZone.id)) {
        this._flatZoneLoggedZones.add(bestCoreZone.id);
      }
      this._flatZoneHitCount++;
      return bestCoreZone.height;
    }

    // If in a blend area, smoothly interpolate
    if (bestBlendZone) {
      const proceduralHeight = this.getProceduralHeightWithBoost(
        worldX,
        worldZ,
      );

      // Smoothstep: t² × (3 - 2t) for C1 continuous transition
      const t = bestBlendFactor * bestBlendFactor * (3 - 2 * bestBlendFactor);

      // Interpolate from flat height (t=0) to procedural height (t=1)
      return (
        bestBlendZone.height + (proceduralHeight - bestBlendZone.height) * t
      );
    }

    return null;
  }

  /**
   * Check if a world position is inside a flat zone's core area.
   * Used by ProceduralGrassSystem to exclude grass from artificial flat areas (buildings, arenas, etc.)
   *
   * @param worldX - World X coordinate
   * @param worldZ - World Z coordinate
   * @returns true if position is in a flat zone's core area (not blend area)
   */
  isInFlatZone(worldX: number, worldZ: number): boolean {
    // PERF: delegate to getFlatZoneHeight instead of duplicating the spatial lookup logic
    return this.getFlatZoneHeight(worldX, worldZ) !== null;
  }

  /**
   * Get terrain color at a world position by sampling the nearest terrain tile vertex.
   * Used by ProceduralGrassSystem to match grass color to terrain.
   *
   * @param worldX - World X coordinate
   * @param worldZ - World Z coordinate
   * @returns RGB color (0-1 range) or null if no terrain data available
   */
  getTerrainColorAt(
    worldX: number,
    worldZ: number,
  ): { r: number; g: number; b: number } | null {
    const tileX = this.worldToTerrainTileIndex(worldX);
    const tileZ = this.worldToTerrainTileIndex(worldZ);
    const key = `${tileX}_${tileZ}`;

    const tile = this.terrainTiles.get(key);
    if (!tile?.mesh) {
      return null;
    }

    // Get vertex colors from geometry
    const geometry = tile.mesh.geometry as THREE.BufferGeometry;
    const colorAttr = geometry.getAttribute("color") as
      | THREE.BufferAttribute
      | undefined;
    if (!colorAttr) {
      return null;
    }

    const localX = worldX - tileX * this.CONFIG.TILE_SIZE;
    const localZ = worldZ - tileZ * this.CONFIG.TILE_SIZE;

    const resolution = this.CONFIG.TILE_RESOLUTION;
    const vertexX = Math.round(
      Math.max(0, Math.min(resolution - 1, this.localToGridIndex(localX))),
    );
    const vertexZ = Math.round(
      Math.max(0, Math.min(resolution - 1, this.localToGridIndex(localZ))),
    );
    const vertexIndex = vertexZ * resolution + vertexX;

    if (
      vertexIndex < 0 ||
      vertexIndex * 3 + 2 >= colorAttr.count * colorAttr.itemSize
    ) {
      return null;
    }

    return {
      r: colorAttr.getX(vertexIndex),
      g: colorAttr.getY(vertexIndex),
      b: colorAttr.getZ(vertexIndex),
    };
  }

  /**
   * Register a flat zone and update spatial index.
   * Spatial index uses terrain tiles (100m each) for efficient lookup.
   *
   * IMPORTANT: Also regenerates affected terrain tile meshes so that
   * the visual terrain reflects the flat zone heights. This is critical
   * because terrain tiles may have been generated before flat zones
   * were registered (e.g., building flat zones registered after terrain init).
   */
  registerFlatZone(zone: FlatZone): void {
    // Validate zone data
    if (!zone || !zone.id || typeof zone.id !== "string") {
      throw new Error(
        `[TerrainSystem] registerFlatZone: invalid zone id: ${zone?.id}`,
      );
    }
    if (!Number.isFinite(zone.centerX) || !Number.isFinite(zone.centerZ)) {
      throw new Error(
        `[TerrainSystem] registerFlatZone "${zone.id}": invalid center (${zone.centerX}, ${zone.centerZ})`,
      );
    }
    if (!Number.isFinite(zone.width) || zone.width <= 0) {
      throw new Error(
        `[TerrainSystem] registerFlatZone "${zone.id}": invalid width ${zone.width}`,
      );
    }
    if (!Number.isFinite(zone.depth) || zone.depth <= 0) {
      throw new Error(
        `[TerrainSystem] registerFlatZone "${zone.id}": invalid depth ${zone.depth}`,
      );
    }
    if (!Number.isFinite(zone.height)) {
      throw new Error(
        `[TerrainSystem] registerFlatZone "${zone.id}": invalid height ${zone.height}`,
      );
    }
    if (!Number.isFinite(zone.blendRadius) || zone.blendRadius < 0) {
      throw new Error(
        `[TerrainSystem] registerFlatZone "${zone.id}": invalid blendRadius ${zone.blendRadius}`,
      );
    }

    this.flatZones.set(zone.id, zone);

    // Calculate affected terrain tiles
    // IMPORTANT: Visual terrain tiles are CENTERED at (tileX * TILE_SIZE, tileZ * TILE_SIZE)
    // So tile 0 covers world X from -TILE_SIZE/2 to +TILE_SIZE/2, NOT 0 to TILE_SIZE.
    // We must calculate which visual tiles overlap the flat zone's influence area.
    const totalRadius = Math.max(zone.width, zone.depth) / 2 + zone.blendRadius;
    const halfTile = this.CONFIG.TILE_SIZE / 2;

    // For visual tiles centered at tileX * TILE_SIZE:
    // Tile covers [tileX * TILE_SIZE - halfTile, tileX * TILE_SIZE + halfTile]
    // We need tiles where: tileX * TILE_SIZE + halfTile >= zone.minX AND tileX * TILE_SIZE - halfTile <= zone.maxX
    // Simplifying: tileX >= (zone.minX - halfTile) / TILE_SIZE AND tileX <= (zone.maxX + halfTile) / TILE_SIZE
    const zoneMinX = zone.centerX - totalRadius;
    const zoneMaxX = zone.centerX + totalRadius;
    const zoneMinZ = zone.centerZ - totalRadius;
    const zoneMaxZ = zone.centerZ + totalRadius;

    const minTileX = Math.floor((zoneMinX + halfTile) / this.CONFIG.TILE_SIZE);
    const maxTileX = Math.floor((zoneMaxX + halfTile) / this.CONFIG.TILE_SIZE);
    const minTileZ = Math.floor((zoneMinZ + halfTile) / this.CONFIG.TILE_SIZE);
    const maxTileZ = Math.floor((zoneMaxZ + halfTile) / this.CONFIG.TILE_SIZE);

    const tilesToRegenerate: Array<{ x: number; z: number }> = [];

    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let tz = minTileZ; tz <= maxTileZ; tz++) {
        const key = `${tx}_${tz}`;
        let zones = this.flatZonesByTile.get(key);
        if (!zones) {
          zones = [];
          this.flatZonesByTile.set(key, zones);
        }
        zones.push(zone);

        // Track tiles that need regeneration (if they already exist)
        if (this.terrainTiles.has(key)) {
          tilesToRegenerate.push({ x: tx, z: tz });
        }
      }
    }

    // Regenerate any existing terrain tiles to apply flat zone heights
    // This ensures terrain meshes reflect the flat zone even if they were
    // generated before the flat zone was registered
    //
    // Use deduplication set to avoid regenerating the same tile multiple times
    // (e.g., when multiple buildings register flat zones in the same terrain tile)
    if (tilesToRegenerate.length > 0) {
      const uniqueTiles = new Set<string>();
      const filteredTiles = tilesToRegenerate.filter((tile) => {
        const key = `${tile.x}_${tile.z}`;
        if (this._pendingTileRegeneration.has(key)) {
          return false; // Already scheduled for regeneration
        }
        if (uniqueTiles.has(key)) {
          return false; // Duplicate in this batch
        }
        uniqueTiles.add(key);
        this._pendingTileRegeneration.add(key);
        return true;
      });

      if (filteredTiles.length > 0) {
        console.log(
          `[TerrainSystem] Regenerating ${filteredTiles.length} terrain tiles for flat zone "${zone.id}"`,
        );
        for (const tile of filteredTiles) {
          this.queueTerrainTileRegeneration(tile.x, tile.z, "flat_zone");
        }
      }
    }
  }

  /**
   * Queue terrain tile regeneration and flush incrementally.
   * This coalesces many flat-zone updates into small batches to avoid frame stalls.
   */
  private queueTerrainTileRegeneration(
    tileX: number,
    tileZ: number,
    reason: "flat_zone" | "road" | "other",
  ): void {
    const key = `${tileX}_${tileZ}`;
    if (
      this._pendingTileRegeneration.has(key) &&
      this._queuedTileRegenerations.has(key)
    ) {
      return;
    }
    this._pendingTileRegeneration.add(key);
    if (this._queuedTileRegenerations.has(key)) return;

    this._queuedTileRegenerations.set(key, { x: tileX, z: tileZ, reason });

    if (this._tileRegenerationFlushId) return;
    this._tileRegenerationFlushId = setTimeout(() => {
      this._tileRegenerationFlushId = undefined;
      this.flushQueuedTileRegenerations();
    }, 0);
  }

  /**
   * Flush queued tile regenerations in small batches to protect frame time.
   */
  private flushQueuedTileRegenerations(): void {
    if (this._queuedTileRegenerations.size === 0) return;

    const MAX_REGENERATIONS_PER_BATCH = 4;
    let processed = 0;

    for (const [key, tile] of this._queuedTileRegenerations) {
      this._queuedTileRegenerations.delete(key);
      this.regenerateTerrainTile(tile.x, tile.z, tile.reason);
      this._pendingTileRegeneration.delete(key);
      processed++;

      if (processed >= MAX_REGENERATIONS_PER_BATCH) {
        break;
      }
    }

    if (this._queuedTileRegenerations.size > 0) {
      this._tileRegenerationFlushId = setTimeout(() => {
        this._tileRegenerationFlushId = undefined;
        this.flushQueuedTileRegenerations();
      }, 0);
    }
  }

  /**
   * Regenerate a terrain tile's visual mesh to reflect current flat zones.
   * Called when flat zones are registered after terrain tiles were already generated.
   *
   * NOTE: Only updates the visual mesh geometry. Physics height queries already
   * use getHeightAt() which checks flat zones dynamically, so physics doesn't
   * need regeneration.
   */
  private regenerateTerrainTile(
    tileX: number,
    tileZ: number,
    reason: "flat_zone" | "road" | "other" = "other",
  ): void {
    const key = `${tileX}_${tileZ}`;
    const existingTile = this.terrainTiles.get(key);
    if (!existingTile || !existingTile.mesh) return;

    // Regenerate geometry with current flat zones
    const newGeometry = this.createTileGeometry(tileX, tileZ);

    // Update the existing mesh's geometry (preserves material, position, etc.)
    existingTile.mesh.geometry.dispose();
    existingTile.mesh.geometry = newGeometry;
    existingTile.mesh.geometry.computeBoundingSphere();
    existingTile.mesh.geometry.computeBoundingBox();

    console.log(
      `[TerrainSystem] Regenerated terrain tile (${tileX},${tileZ}) for ${reason}`,
    );

    // Emit event so VegetationSystem can regenerate grass/vegetation for this tile
    this.world.emit(EventType.TERRAIN_TILE_REGENERATED, {
      tileId: key,
      tileX,
      tileZ,
      biome: existingTile.biome || "grassland",
      reason,
    });
  }

  /**
   * Remove a flat zone by ID.
   * Used when dynamic structures are removed.
   */
  unregisterFlatZone(id: string): void {
    const zone = this.flatZones.get(id);
    if (!zone) return;

    this.flatZones.delete(id);

    // Remove from spatial index
    const totalRadius = Math.max(zone.width, zone.depth) / 2 + zone.blendRadius;
    const minTileX = Math.floor(
      (zone.centerX - totalRadius) / this.CONFIG.TILE_SIZE,
    );
    const maxTileX = Math.floor(
      (zone.centerX + totalRadius) / this.CONFIG.TILE_SIZE,
    );
    const minTileZ = Math.floor(
      (zone.centerZ - totalRadius) / this.CONFIG.TILE_SIZE,
    );
    const maxTileZ = Math.floor(
      (zone.centerZ + totalRadius) / this.CONFIG.TILE_SIZE,
    );

    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let tz = minTileZ; tz <= maxTileZ; tz++) {
        const key = `${tx}_${tz}`;
        const zones = this.flatZonesByTile.get(key);
        if (zones) {
          const filtered = zones.filter((z) => z.id !== id);
          if (filtered.length > 0) {
            this.flatZonesByTile.set(key, filtered);
          } else {
            this.flatZonesByTile.delete(key);
          }
        }
      }
    }
  }

  /**
   * Get a flat zone at a position (if any).
   */
  getFlatZoneAt(worldX: number, worldZ: number): FlatZone | null {
    const tileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
    const tileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);
    const key = `${tileX}_${tileZ}`;

    const zones = this.flatZonesByTile.get(key);
    if (!zones) return null;

    for (const zone of zones) {
      const dx = Math.abs(worldX - zone.centerX);
      const dz = Math.abs(worldZ - zone.centerZ);
      const halfWidth = zone.width / 2 + zone.blendRadius;
      const halfDepth = zone.depth / 2 + zone.blendRadius;

      if (dx <= halfWidth && dz <= halfDepth) {
        return zone;
      }
    }

    return null;
  }

  /**
   * Load flat zones from world-areas manifest during initialization.
   * Called before any tiles are generated.
   *
   * Note: Station footprints are in movement tiles (1m = 1 tile).
   * Terrain tiles are 100m each, used only for spatial indexing.
   */
  private loadFlatZonesFromManifest(): void {
    // Movement tile size (1m) - used for station footprints
    const MOVEMENT_TILE_SIZE = 1.0;

    let loadedCount = 0;
    const areaNames = Object.keys(ALL_WORLD_AREAS);

    console.log(
      `[TerrainSystem] Loading flat zones from ${areaNames.length} world areas`,
    );

    if (!ALL_WORLD_AREAS["duel_arena"]) {
      console.warn(`[TerrainSystem] duel_arena NOT in ALL_WORLD_AREAS!`);
    }

    for (const [areaId, area] of Object.entries(ALL_WORLD_AREAS)) {
      // Check for both stations and explicit flatZones
      const areaConfig = area as {
        stations?: typeof area.stations;
        flatZones?: Array<{
          id: string;
          centerX: number;
          centerZ: number;
          width: number;
          depth: number;
          height?: number;
          heightOffset?: number;
          blendRadius: number;
        }>;
      };

      // Skip areas with neither stations nor flatZones
      if (!areaConfig.stations?.length && !areaConfig.flatZones?.length) {
        continue;
      }

      // Process stations (if any)
      if (areaConfig.stations) {
        for (const station of areaConfig.stations) {
          const stationData = stationDataProvider.getStationData(station.type);

          // Skip if station type not found or doesn't want ground flattening
          if (!stationData) {
            continue;
          }

          if (!stationData.flattenGround) {
            continue;
          }

          // Get footprint from model bounds (returns movement tiles, e.g., {x: 2, z: 2})
          const footprint = stationDataProvider.getFootprint(station.type);
          const size = resolveFootprint(footprint);

          // Calculate flat zone dimensions in world units (meters)
          const padding = stationData.flattenPadding;
          const blendRadius = stationData.flattenBlendRadius;
          const width = size.x * MOVEMENT_TILE_SIZE + padding * 2;
          const depth = size.z * MOVEMENT_TILE_SIZE + padding * 2;

          // Get procedural height at station center (what terrain would be without flattening)
          const flatHeight = this.getProceduralHeightWithBoost(
            station.position.x,
            station.position.z,
          );

          const zone: FlatZone = {
            id: `station_${station.id}`,
            centerX: station.position.x,
            centerZ: station.position.z,
            width,
            depth,
            height: flatHeight,
            blendRadius,
          };

          this.registerFlatZone(zone);
          loadedCount++;
        }
      }

      // Also load explicit flatZones defined in the area config (e.g., duel arenas, special platforms)
      if (areaConfig.flatZones) {
        for (const zoneConfig of areaConfig.flatZones) {
          // Calculate base height from procedural terrain
          const proceduralHeight = this.getProceduralHeightWithBoost(
            zoneConfig.centerX,
            zoneConfig.centerZ,
          );

          // Use explicit height if provided, otherwise procedural + offset
          const flatHeight =
            zoneConfig.height !== undefined
              ? zoneConfig.height
              : proceduralHeight + (zoneConfig.heightOffset ?? 0);

          const zone: FlatZone = {
            id: zoneConfig.id,
            centerX: zoneConfig.centerX,
            centerZ: zoneConfig.centerZ,
            width: zoneConfig.width,
            depth: zoneConfig.depth,
            height: flatHeight,
            blendRadius: zoneConfig.blendRadius,
          };

          this.registerFlatZone(zone);
          loadedCount++;
        }
      }
    }

    console.log(
      `[TerrainSystem] Flat zone loading complete: ${loadedCount} zones registered`,
    );
  }

  /**
   * Compute the terrain surface normal at a world position.
   * Uses central differences on the scalar height field h(x, z).
   * Returns a normalized THREE.Vector3 where y is the up component.
   */
  getNormalAt(worldX: number, worldZ: number): THREE.Vector3 {
    // Use a small sampling distance relative to tile resolution
    const sampleDistance = 0.5;

    // Sample heights around the point with central differences
    const hL = this.getHeightAt(worldX - sampleDistance, worldZ);
    const hR = this.getHeightAt(worldX + sampleDistance, worldZ);
    const hD = this.getHeightAt(worldX, worldZ - sampleDistance);
    const hU = this.getHeightAt(worldX, worldZ + sampleDistance);

    // Partial derivatives: dh/dx and dh/dz
    const dhdx = (hR - hL) / (2 * sampleDistance);
    const dhdz = (hU - hD) / (2 * sampleDistance);

    // For a heightfield y = h(x, z), a surface normal can be constructed as (-dhdx, 1, -dhdz)
    const normal = this._tempVec3.set(-dhdx, 1, -dhdz);
    normal.normalize();
    return normal;
  }

  /**
   * Compute normals using an overflow height grid (centered differences).
   *
   * Builds a (resolution+2)x(resolution+2) grid — the interior is filled from
   * the already-computed tile heights, and a 1-cell border is computed via
   * getHeightAtComputed (~260 calls). Normals are then derived with pure
   * array lookups instead of 4x getHeightAtComputed per vertex (~16 384 calls
   * previously). This is a ~63x reduction in noise evaluations for normals.
   *
   * When tileHeights is provided (from the vertex generation loop), the interior
   * is copied directly. Otherwise falls back to reading the geometry positions.
   *
   * @param tileHeights - Flat array of tile vertex heights in row-major order
   *                      (iz * resolution + ix). Length must equal resolution^2.
   *                      Pass the heightData array from createTileGeometry or
   *                      createTileGeometryFromWorkerData.
   */
  private computeHeightFieldNormals(
    geometry: THREE.PlaneGeometry,
    tileX: number,
    tileZ: number,
    tileHeights?: ArrayLike<number>,
  ): void {
    const resolution = this.CONFIG.TILE_RESOLUTION; // 64
    const tileSize = this.CONFIG.TILE_SIZE; // 100
    const gridStep = tileSize / (resolution - 1); // ~1.587m
    const halfSize = tileSize / 2; // 50
    const originX = tileX * tileSize;
    const originZ = tileZ * tileSize;

    // (resolution+2)^2 overflow grid — lazily allocate once, reuse across tiles
    const gRes = resolution + 2; // 66
    if (
      !this._overflowHeightGrid ||
      this._overflowHeightGrid.length !== gRes * gRes
    ) {
      this._overflowHeightGrid = new Float32Array(gRes * gRes);
    }
    const grid = this._overflowHeightGrid;

    // --- Fill interior from already-computed tile heights ---
    if (tileHeights && tileHeights.length >= resolution * resolution) {
      for (let iz = 0; iz < resolution; iz++) {
        const srcRow = iz * resolution;
        const dstRow = (iz + 1) * gRes + 1; // offset by 1 in both axes
        for (let ix = 0; ix < resolution; ix++) {
          grid[dstRow + ix] = tileHeights[srcRow + ix];
        }
      }
    } else {
      // Fallback: read Y component from geometry positions
      const posArr = geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < resolution * resolution; i++) {
        const ix = i % resolution;
        const iz = (i - ix) / resolution;
        grid[(iz + 1) * gRes + (ix + 1)] = posArr[i * 3 + 1];
      }
    }

    // --- Fill 1-cell border via getHeightAtComputed (~260 cells) ---
    // World position for overflow grid index (gx, gz):
    //   localX = -halfSize + (gx - 1) * gridStep
    //   localZ = -halfSize + (gz - 1) * gridStep
    for (let gz = 0; gz < gRes; gz++) {
      const localZ = -halfSize + (gz - 1) * gridStep;
      const worldZ = originZ + localZ;
      for (let gx = 0; gx < gRes; gx++) {
        // Skip interior — already filled above
        if (gx >= 1 && gx <= resolution && gz >= 1 && gz <= resolution)
          continue;
        const localX = -halfSize + (gx - 1) * gridStep;
        const worldX = originX + localX;
        grid[gz * gRes + gx] = this.getHeightAtComputed(worldX, worldZ);
      }
    }

    // --- Compute normals via centered finite differences ---
    const positions = geometry.attributes.position;
    const normals = new Float32Array(positions.count * 3);
    const invTwoStep = 1 / (2 * gridStep);

    for (let iz = 0; iz < resolution; iz++) {
      const gz = iz + 1; // overflow grid row
      for (let ix = 0; ix < resolution; ix++) {
        const gx = ix + 1; // overflow grid col

        const hL = grid[gz * gRes + (gx - 1)];
        const hR = grid[gz * gRes + (gx + 1)];
        const hD = grid[(gz - 1) * gRes + gx];
        const hU = grid[(gz + 1) * gRes + gx];

        const dhdx = (hR - hL) * invTwoStep;
        const dhdz = (hU - hD) * invTwoStep;

        const nx = -dhdx;
        const ny = 1;
        const nz = -dhdz;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

        const i3 = (iz * resolution + ix) * 3;
        normals[i3] = nx / len;
        normals[i3 + 1] = ny / len;
        normals[i3 + 2] = nz / len;
      }
    }

    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  }

  /**
   * Carve terrain triangles inside flat zone core areas to prevent overdraw under buildings.
   * Uses the flat zone spatial index and optional carveInset to keep blend padding intact.
   */
  private applyFlatZoneCarve(
    geometry: THREE.PlaneGeometry,
    tileX: number,
    tileZ: number,
  ): void {
    const key = `${tileX}_${tileZ}`;
    const zones = this.flatZonesByTile.get(key);
    if (!zones || zones.length === 0) return;

    const carveZones: Array<
      | {
          type: "rect";
          centerX: number;
          centerZ: number;
          halfWidth: number;
          halfDepth: number;
        }
      | {
          type: "mask";
          tileMask: Set<string>;
        }
    > = [];

    for (const zone of zones) {
      if (zone.tileMask && zone.tileMask.size > 0) {
        carveZones.push({
          type: "mask",
          tileMask: zone.tileMask,
        });
        continue;
      }

      if (
        typeof zone.carveInset !== "number" ||
        !Number.isFinite(zone.carveInset)
      ) {
        continue;
      }
      const halfWidth = zone.width / 2 - zone.carveInset;
      const halfDepth = zone.depth / 2 - zone.carveInset;
      if (halfWidth <= 0 || halfDepth <= 0) continue;
      carveZones.push({
        type: "rect",
        centerX: zone.centerX,
        centerZ: zone.centerZ,
        halfWidth,
        halfDepth,
      });
    }

    if (carveZones.length === 0) return;

    const positions = geometry.attributes.position;
    const vertexCount = positions.count;
    const resolution = Math.round(Math.sqrt(vertexCount));
    if (resolution * resolution !== vertexCount) return;

    const gridSize = resolution - 1;
    if (gridSize <= 0) return;

    const positionsArray = positions.array as Float32Array;
    const indices: number[] = [];
    const tileOffsetX = tileX * this.CONFIG.TILE_SIZE;
    const tileOffsetZ = tileZ * this.CONFIG.TILE_SIZE;

    const isVertexInZone = (
      vertexIndex: number,
      zone:
        | {
            type: "rect";
            centerX: number;
            centerZ: number;
            halfWidth: number;
            halfDepth: number;
          }
        | {
            type: "mask";
            tileMask: Set<string>;
          },
    ): boolean => {
      const base = vertexIndex * 3;
      const worldX = positionsArray[base] + tileOffsetX;
      const worldZ = positionsArray[base + 2] + tileOffsetZ;

      if (zone.type === "mask") {
        const tileX = Math.floor(worldX);
        const tileZ = Math.floor(worldZ);
        return zone.tileMask.has(`${tileX},${tileZ}`);
      }

      const dx = Math.abs(worldX - zone.centerX);
      const dz = Math.abs(worldZ - zone.centerZ);
      return dx <= zone.halfWidth && dz <= zone.halfDepth;
    };

    for (let iz = 0; iz < gridSize; iz += 1) {
      for (let ix = 0; ix < gridSize; ix += 1) {
        const a = ix + resolution * iz;
        const b = ix + resolution * (iz + 1);
        const c = ix + 1 + resolution * (iz + 1);
        const d = ix + 1 + resolution * iz;

        let carved = false;
        for (const zone of carveZones) {
          if (
            isVertexInZone(a, zone) &&
            isVertexInZone(b, zone) &&
            isVertexInZone(c, zone) &&
            isVertexInZone(d, zone)
          ) {
            carved = true;
            break;
          }
        }

        if (!carved) {
          // Same winding as PlaneGeometry: a, b, d and b, c, d
          indices.push(a, b, d, b, c, d);
        }
      }
    }

    geometry.setIndex(indices);
  }

  private generateNoise(x: number, z: number): number {
    const sin1 = Math.sin(x * 2.1 + z * 1.7);
    const cos1 = Math.cos(x * 1.3 - z * 2.4);
    const sin2 = Math.sin(x * 3.7 - z * 4.1);
    const cos2 = Math.cos(x * 5.2 + z * 3.8);

    const result = (sin1 * cos1 + sin2 * cos2 * 0.5) * 0.5;

    return result;
  }

  private getBiomeAt(tileX: number, tileZ: number): string {
    // Get world coordinates for center of tile
    const worldX = tileX * this.CONFIG.TILE_SIZE + this.CONFIG.TILE_SIZE / 2;
    const worldZ = tileZ * this.CONFIG.TILE_SIZE + this.CONFIG.TILE_SIZE / 2;

    // Check if near starter towns first (safe zones)
    const towns = [
      { x: 0, z: 0, name: "Brookhaven" },
      { x: 10, z: 0, name: "Eastport" },
      { x: -10, z: 0, name: "Westfall" },
      { x: 0, z: 10, name: "Northridge" },
      { x: 0, z: -10, name: "Southmere" },
    ];

    for (const town of towns) {
      const distance = Math.sqrt((tileX - town.x) ** 2 + (tileZ - town.z) ** 2);
      if (distance < 3) return "plains";
    }

    return this.getBiomeAtWorldPosition(worldX, worldZ);
  }

  private getBiomeInfluencesAtPosition(
    worldX: number,
    worldZ: number,
  ): Array<{ type: string; weight: number }> {
    const { biomeWeightMap, totalWeight } = this.computeBiomeWeightsAtPosition(
      worldX,
      worldZ,
    );

    const biomeInfluences: Array<{ type: string; weight: number }> = [];
    if (totalWeight > 0) {
      const invTotal = 1 / totalWeight;
      for (const [type, weight] of biomeWeightMap) {
        biomeInfluences.push({ type, weight: weight * invTotal });
      }
    } else {
      // Fallback to plains if no biome centers are nearby
      biomeInfluences.push({ type: "plains", weight: 1.0 });
    }

    return biomeInfluences;
  }

  private computeBiomeWeightsAtPosition(
    worldX: number,
    worldZ: number,
  ): { biomeWeightMap: Map<string, number>; totalWeight: number } {
    // Get BASE height (without mountain boost) to avoid feedback loop
    const baseHeight = this.getBaseHeightAt(worldX, worldZ);
    const normalizedHeight = baseHeight / this.CONFIG.MAX_HEIGHT;

    // Add boundary noise for organic edges
    const boundaryNoise = this.noise.simplex2D(
      worldX * this.CONFIG.BIOME_BOUNDARY_NOISE_SCALE,
      worldZ * this.CONFIG.BIOME_BOUNDARY_NOISE_SCALE,
    );

    // Map to collect and merge same-type biomes.
    // Reusing one map avoids per-vertex map allocations during tile generation.
    const biomeWeightMap = this.biomeWeightScratch;
    biomeWeightMap.clear();

    // Calculate influence from ALL biome centers (no hard cutoff!)
    for (const center of this.biomeCenters) {
      const dx = worldX - center.x;
      const dz = worldZ - center.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Add subtle noise to distance for organic boundaries
      const noisyDistance =
        distance *
        (1 + boundaryNoise * this.CONFIG.BIOME_BOUNDARY_NOISE_AMOUNT);

      // Pure gaussian falloff - NO hard distance cutoff
      // The gaussian naturally approaches 0 at large distances
      const normalizedDistance = noisyDistance / center.influence;
      let weight = Math.exp(
        -normalizedDistance *
          normalizedDistance *
          this.CONFIG.BIOME_GAUSSIAN_COEFF,
      );

      // Height-based weight adjustments (using BASE height, not boosted)
      if (
        center.type === "mountains" &&
        normalizedHeight > this.CONFIG.MOUNTAIN_HEIGHT_THRESHOLD
      ) {
        const heightFactor =
          normalizedHeight - this.CONFIG.MOUNTAIN_HEIGHT_THRESHOLD;
        weight *= 1.0 + heightFactor * this.CONFIG.MOUNTAIN_WEIGHT_BOOST;
      }

      if (
        (center.type === "valley" || center.type === "plains") &&
        normalizedHeight < this.CONFIG.VALLEY_HEIGHT_THRESHOLD
      ) {
        const heightFactor =
          this.CONFIG.VALLEY_HEIGHT_THRESHOLD - normalizedHeight;
        weight *= 1.0 + heightFactor * this.CONFIG.VALLEY_WEIGHT_BOOST;
      }

      // Merge same-type biomes (no threshold - let gaussian handle falloff)
      const existing = biomeWeightMap.get(center.type) || 0;
      biomeWeightMap.set(center.type, existing + weight);
    }

    let totalWeight = 0;
    for (const [type, weight] of biomeWeightMap) {
      totalWeight += weight;
    }

    return { biomeWeightMap, totalWeight };
  }

  private getBiomeAtWorldPosition(worldX: number, worldZ: number): string {
    const influences = this.getBiomeInfluencesAtPosition(worldX, worldZ);
    return influences.length > 0 ? influences[0].type : "plains";
  }

  private getBiomeNoise(x: number, z: number): number {
    // Simple noise function for biome determination
    return (
      Math.sin(x * 2.1 + z * 1.7) * Math.cos(x * 1.3 - z * 2.4) * 0.5 +
      Math.sin(x * 4.2 + z * 3.8) * Math.cos(x * 2.7 - z * 4.1) * 0.3 +
      Math.sin(x * 8.1 - z * 6.2) * Math.cos(x * 5.9 + z * 7.3) * 0.2
    );
  }

  // Map internal biome keys to generic TerrainTileData biome set
  private mapBiomeToGeneric(
    internal: string,
  ):
    | "forest"
    | "plains"
    | "desert"
    | "mountains"
    | "swamp"
    | "tundra"
    | "jungle" {
    switch (internal) {
      case "forest":
        return "forest";
      case "plains":
        return "plains";
      case "valley":
        return "plains";
      case "mountains":
        return "mountains";
      case "tundra":
        return "tundra";
      case "desert":
        return "desert";
      case "lakes":
        return "swamp";
      case "swamp":
        return "swamp";
      default:
        return "plains";
    }
  }

  private generateTileResources(tile: TerrainTile): void {
    const biomeData = BIOMES[tile.biome];

    // Guard against undefined biome data
    if (!biomeData) {
      console.warn(
        `[TerrainSystem] Biome data not found for biome: ${tile.biome}`,
      );
      return;
    }

    // Re-enabled: tree spawning with optimized LOD system
    this.generateTreesForTile(tile, biomeData);

    // Re-enabled for ore LOD testing
    this.generateOtherResourcesForTile(tile, biomeData);

    // Generate decorative rocks (client only)
    const isClient = this.runtimeIsClient;
    if (isClient) {
      this.generateDecorativeRocksForTile(tile, biomeData);
      // NOTE: Plants disabled - not working/looking good yet
      // this.generateDecorativePlantsForTile(tile, biomeData);
    }
    // Roads are now generated using noise patterns instead of segments
  }

  /**
   * Generate decorative (non-harvestable) rocks for a tile.
   * Uses procedural generation from @hyperscape/procgen/rock.
   */
  private generateDecorativeRocksForTile(
    tile: TerrainTile,
    biomeData: BiomeData,
  ): void {
    // Use default rock config if not specified in biome
    // Scale range reduced from [0.3, 1.5] to [0.2, 0.9] for more realistic ground rocks
    const rockConfig = biomeData.rocks ?? {
      enabled: true,
      density: 8, // 8 rocks per 100m²
      presets: BIOME_ROCK_PRESETS[tile.biome] ?? ["boulder", "pebble"],
      scaleRange: [0.2, 0.9] as [number, number],
      clusterChance: 0.3,
      minSpacing: 2.5, // Reduced spacing since rocks are smaller
    };

    if (!rockConfig.enabled) {
      return;
    }

    // Create context for resource generation
    const ctx: ResourceGenerationContext = {
      tileX: tile.x,
      tileZ: tile.z,
      tileKey: tile.key,
      tileSize: this.CONFIG.TILE_SIZE,
      waterThreshold: this.CONFIG.WATER_THRESHOLD,
      getHeightAt: (worldX, worldZ) => this.getHeightAt(worldX, worldZ),
      isOnRoad: this.roadNetworkSystem
        ? (worldX, worldZ) => this.roadNetworkSystem!.isOnRoad(worldX, worldZ)
        : undefined,
      createRng: (salt) => this.createTileRng(tile.x, tile.z, salt),
    };

    // TEMPORARILY DISABLED - rock spawning disabled
    // const rocks = generateRocks(ctx, rockConfig, tile.biome);
    tile.decorativeRockIds = tile.decorativeRockIds ?? [];
  }

  /**
   * Generate decorative (non-harvestable) plants for a tile.
   * Uses procedural generation from @hyperscape/procgen/plant.
   * DISABLED: Plants not working/looking good yet
   */
  // private generateDecorativePlantsForTile(tile: TerrainTile, biomeData: BiomeData): void {
  //   // Use default plant config if not specified in biome
  //   const plantConfig = biomeData.plants ?? {
  //     enabled: true,
  //     density: 15, // 15 plants per 100m²
  //     presets: BIOME_PLANT_PRESETS[tile.biome] ?? ["monstera", "philodendron"],
  //     scaleRange: [0.5, 1.2] as [number, number],
  //     minSpacing: 1.5,
  //     clustering: true,
  //     clusterSize: [2, 4] as [number, number],
  //   };
  //
  //   if (!plantConfig.enabled) {
  //     return;
  //   }
  //
  //   // Create context for resource generation
  //   const ctx: ResourceGenerationContext = {
  //     tileX: tile.x,
  //     tileZ: tile.z,
  //     tileKey: tile.key,
  //     tileSize: this.CONFIG.TILE_SIZE,
  //     waterThreshold: this.CONFIG.WATER_THRESHOLD,
  //     getHeightAt: (worldX, worldZ) => this.getHeightAt(worldX, worldZ),
  //     isOnRoad: this.roadNetworkSystem
  //       ? (worldX, worldZ) => this.roadNetworkSystem!.isOnRoad(worldX, worldZ)
  //       : undefined,
  //     createRng: (salt) => this.createTileRng(tile.x, tile.z, salt),
  //   };
  //
  //   // Generate plant placement data
  //   const plants = generatePlants(ctx, plantConfig, tile.biome);
  //
  //   // Initialize array if not exists
  //   tile.decorativePlantIds = tile.decorativePlantIds ?? [];
  //
  //   // Add each plant to the instancer (async but don't wait)
  //   for (const plant of plants) {
  //     const position = new THREE.Vector3(plant.position.x, plant.position.y, plant.position.z);
  //     addPlantInstance(plant.assetId, position, plant.rotation.y, plant.scale, plant.id)
  //       .then((id) => {
  //         if (id && tile.decorativePlantIds) {
  //           tile.decorativePlantIds.push(id);
  //         }
  //       })
  //       .catch((err) => {
  //         console.warn(`[TerrainSystem] Failed to add plant instance:`, err);
  //       });
  //   }
  // }

  /**
   * Default tree configuration for biomes without explicit tree config.
   * Targets ~1 tree per 20m spacing (density 25 = ~10 trees per 64m tile).
   * Reduced from 100 to prevent exceeding MAX_GLOBAL_LEAVES capacity (100k leaves,
   * ~2000 leaves per tree = ~50 trees max visible at full detail).
   */
  private static readonly DEFAULT_TREE_CONFIG: BiomeTreeConfig = {
    enabled: true,
    distribution: {
      tree_normal: 40, // Quaking Aspen
      tree_oak: 30, // Black Oak
      tree_maple: 15, // Acer (Japanese Maple)
      tree_willow: 10, // Weeping Willow
      tree_yew: 5, // European Larch
    },
    density: 20, // ~8 trees per 64m tile
    minSpacing: 18, // Minimum 18m between trees for natural spacing
    clustering: true,
    clusterSize: 3,
    scaleVariation: [0.8, 1.2],
  };

  /**
   * Generate harvestable trees for a tile based on biome configuration.
   * Uses the extracted BiomeResourceGenerator for the actual algorithm.
   * Falls back to DEFAULT_TREE_CONFIG if biome has no tree config.
   */
  private generateTreesForTile(tile: TerrainTile, biomeData: BiomeData): void {
    // Use biome tree config or fall back to defaults
    const treeConfig = biomeData.trees ?? TerrainSystem.DEFAULT_TREE_CONFIG;
    if (!treeConfig.enabled) {
      return;
    }

    // Create context for resource generation
    const ctx: ResourceGenerationContext = {
      tileX: tile.x,
      tileZ: tile.z,
      tileKey: tile.key,
      tileSize: this.CONFIG.TILE_SIZE,
      waterThreshold: this.CONFIG.WATER_THRESHOLD,
      getHeightAt: (worldX, worldZ) => this.getHeightAt(worldX, worldZ),
      isOnRoad: this.roadNetworkSystem
        ? (worldX, worldZ) => this.roadNetworkSystem!.isOnRoad(worldX, worldZ)
        : undefined,
      createRng: (salt) => this.createTileRng(tile.x, tile.z, salt),
    };

    // Generate trees using the extracted algorithm
    const trees = generateTrees(ctx, treeConfig);
    tile.resources.push(...trees);
  }

  /**
   * Generate ore nodes and other resources for a tile based on biome configuration.
   * Uses the extracted BiomeResourceGenerator for ores.
   */
  private generateOtherResourcesForTile(
    tile: TerrainTile,
    biomeData: BiomeData,
  ): void {
    // Generate ore nodes from biome ore config
    this.generateOresForTile(tile, biomeData);

    // Generate other resources (herbs, fishing spots) from legacy config
    const otherResources = biomeData.resources.filter(
      (r) =>
        r !== "tree" &&
        r !== "trees" &&
        r !== "ore" &&
        r !== "ores" &&
        r !== "rock",
    );

    for (const resourceType of otherResources) {
      const rng = this.createTileRng(tile.x, tile.z, `res:${resourceType}`);
      let resourceCount = 0;

      // Determine count based on resource type and biome
      switch (resourceType) {
        case "fish":
        case "fishing_spots":
          resourceCount = (tile.biome as string) === "lakes" ? 3 : 0;
          break;
        case "herb":
          resourceCount = Math.floor(rng() * 3);
          break;
        case "gem":
          resourceCount = rng() < 0.1 ? 1 : 0; // Rare
          break;
      }

      for (let i = 0; i < resourceCount; i++) {
        const localX = rng() * this.CONFIG.TILE_SIZE;
        const localZ = rng() * this.CONFIG.TILE_SIZE;
        const worldX = tile.x * this.CONFIG.TILE_SIZE + localX;
        const worldZ = tile.z * this.CONFIG.TILE_SIZE + localZ;

        // For fishing spots, place in water only
        if (resourceType === "fish" || resourceType === "fishing_spots") {
          const height = this.getHeightAt(worldX, worldZ);
          if (height >= this.CONFIG.WATER_THRESHOLD) continue;
        }

        const height = this.getHeightAt(worldX, worldZ);

        const resource: ResourceNode = {
          id: `${tile.key}_${resourceType}_${i}`,
          type:
            resourceType === "fishing_spots"
              ? "fish"
              : (resourceType as ResourceNode["type"]),
          position: { x: localX, y: height, z: localZ },
          mesh: null,
          health: 100,
          maxHealth: 100,
          respawnTime: 300000, // 5 minutes
          harvestable: true,
          requiredLevel: 1,
        };

        tile.resources.push(resource);
      }
    }
  }

  /**
   * Generate ore nodes for a tile based on biome ore configuration.
   * Uses the extracted BiomeResourceGenerator for the actual algorithm.
   */
  private generateOresForTile(tile: TerrainTile, biomeData: BiomeData): void {
    const oreConfig = biomeData.ores;
    if (!oreConfig) {
      return;
    }

    // Create context for resource generation
    const ctx: ResourceGenerationContext = {
      tileX: tile.x,
      tileZ: tile.z,
      tileKey: tile.key,
      tileSize: this.CONFIG.TILE_SIZE,
      waterThreshold: this.CONFIG.WATER_THRESHOLD,
      getHeightAt: (worldX, worldZ) => this.getHeightAt(worldX, worldZ),
      isOnRoad: this.roadNetworkSystem
        ? (worldX, worldZ) => this.roadNetworkSystem!.isOnRoad(worldX, worldZ)
        : undefined,
      createRng: (salt) => this.createTileRng(tile.x, tile.z, salt),
    };

    // Generate ores using the extracted algorithm
    const ores = generateOres(ctx, oreConfig);
    tile.resources.push(...ores);
  }

  // DEPRECATED: Roads are now generated using noise patterns instead of segments
  private generateRoadsForTile(_tile: TerrainTile): void {
    // No longer generating road segments - using noise-based paths instead
  }

  /**
   * Calculate road influence for vertex coloring
   */
  private calculateRoadVertexInfluence(
    tileX: number,
    tileZ: number,
  ): Map<string, number> {
    const roadMap = new Map<string, number>();

    // Generate temporary tile to get road data
    const tempTile: TerrainTile = {
      key: `temp_${tileX}_${tileZ}`,
      x: tileX,
      z: tileZ,
      mesh: null as unknown as THREE.Mesh,
      biome: this.getBiomeAt(tileX, tileZ) as TerrainTile["biome"],
      resources: [],
      roads: [],
      generated: false,
      playerCount: 0,
      needsSave: false,
      collision: null,
      waterMeshes: [],
      heightData: [],
      lastActiveTime: new Date(),
      chunkSeed: 0,
      heightMap: new Float32Array(0),
      collider: null,
      lastUpdate: Date.now(),
    };

    // Roads are now generated using noise patterns

    // Calculate influence for each vertex position
    const resolution = this.CONFIG.TILE_RESOLUTION;
    const step = this.CONFIG.TILE_SIZE / (resolution - 1);

    // OPTIMIZATION: Reuse pre-allocated Vector2s to avoid allocations in nested loop
    const pointVec = this._tempVec2;
    const startVec = this._tempVec2_2;
    const endVec = this._tempVec2_3;

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const localX = (i - (resolution - 1) / 2) * step;
        const localZ = (j - (resolution - 1) / 2) * step;

        let maxInfluence = 0;

        // Check distance to each road segment
        for (const road of tempTile.roads) {
          // Set point position
          pointVec.set(localX, localZ);

          // Set start position (reuse if already Vector2, otherwise convert)
          if (road.start instanceof THREE.Vector2) {
            startVec.copy(road.start);
          } else {
            startVec.set(road.start.x, road.start.z);
          }

          // Set end position (reuse if already Vector2, otherwise convert)
          if (road.end instanceof THREE.Vector2) {
            endVec.copy(road.end);
          } else {
            endVec.set(road.end.x, road.end.z);
          }

          const distanceToRoad = this.distanceToLineSegment(
            pointVec,
            startVec,
            endVec,
          );

          // Calculate influence based on distance (closer = more influence)
          const halfWidth = road.width * 0.5;
          if (distanceToRoad <= halfWidth) {
            const influence = 1 - distanceToRoad / halfWidth;
            maxInfluence = Math.max(maxInfluence, influence);
          }
        }

        if (maxInfluence > 0) {
          roadMap.set(
            `${localX.toFixed(1)},${localZ.toFixed(1)}`,
            maxInfluence,
          );
        }
      }
    }

    return roadMap;
  }

  /**
   * Calculate distance from point to line segment
   */
  private distanceToLineSegment(
    point: THREE.Vector2,
    lineStart: THREE.Vector2,
    lineEnd: THREE.Vector2,
  ): number {
    const lineLengthSquared = lineStart.distanceToSquared(lineEnd);

    if (lineLengthSquared === 0) {
      return point.distanceTo(lineStart);
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        this._tempVec2
          .copy(point)
          .sub(lineStart)
          .dot(this._tempVec2_2.copy(lineEnd).sub(lineStart)) /
          lineLengthSquared,
      ),
    );

    const projection = this._tempVec2
      .copy(lineStart)
      .add(this._tempVec2_2.copy(lineEnd).sub(lineStart).multiplyScalar(t));

    return point.distanceTo(projection);
  }

  /**
   * Store height data for persistence and collision generation
   */
  private storeHeightData(
    tileX: number,
    tileZ: number,
    heightData: number[],
  ): void {
    const key = `${tileX}_${tileZ}`;
    const tile = this.terrainTiles.get(key);

    if (tile) {
      tile.heightData = heightData;
      tile.needsSave = true;
    }
  }

  private saveModifiedChunks(): void {
    // Assume database system exists - this method is only called on server
    const chunksToSave = Array.from(this.terrainTiles.values()).filter(
      (tile) => tile.needsSave,
    );

    for (const tile of chunksToSave) {
      const chunkData: WorldChunkData = {
        chunkX: tile.x,
        chunkZ: tile.z,
        data: JSON.stringify({
          biome: tile.biome || "grassland",
          heightData: tile.heightData || [],
          chunkSeed: tile.chunkSeed || 0,
        }),
        lastActive: tile.lastActiveTime?.getTime() || Date.now(),
        playerCount: tile.playerCount || 0,
        version: this.worldStateVersion,
      };

      if (this.databaseSystem) {
        this.databaseSystem.saveWorldChunk(chunkData);
      }
      tile.needsSave = false;
    }

    if (chunksToSave.length > 0) {
      // Chunks successfully saved to database
    }
  }

  update(_deltaTime: number): void {
    // Skip processing until terrain is fully initialized (DataManager loaded BIOMES)
    // This prevents race conditions where update() is called before start() completes
    if (!this._terrainInitialized) {
      return;
    }

    // Dispatch pending tiles to workers for pre-computation (client only)
    if (this.runtimeIsClient && this.CONFIG.USE_WORKERS) {
      this.dispatchWorkerBatch();
    }

    // Process queued tile generations within a small per-frame budget
    // (also processes pre-computed worker results when available)
    this.processTileGenerationQueue();

    // Process queued collision generation on the server
    if (this.world.network?.isServer) {
      this.processCollisionGenerationQueue();
    }

    // Process pending resource instance creation (client only, spreads work across frames)
    if (this.runtimeIsClient) {
      this.processResourceInstanceQueue();
    }

    // Update instance visibility on client based on player position
    if (this.runtimeIsClient && this.instancedMeshManager) {
      this.instancedMeshManager.updateAllInstanceVisibility();

      // TEMPORARILY DISABLED - rock instancer update
      // const rockInstancer = ProcgenRockInstancer.getInstance(null);
      // if (rockInstancer) {
      //   rockInstancer.update(_deltaTime);
      // }
      // Plant instancer disabled - not working/looking good yet
      // const plantInstancer = ProcgenPlantInstancer.getInstance(null);
      // if (plantInstancer) {
      //   plantInstancer.update(_deltaTime);
      // }

      // Log pooling stats occasionally for debugging
      if (Math.random() < 0.002) {
        // Log approximately once every 500 frames at 60fps
        const _stats = this.instancedMeshManager.getPoolingStats();
      }
    }

    // Animate water, grass, and terrain caustics (client-side only)
    if (this.runtimeIsClient) {
      const dt =
        typeof _deltaTime === "number" && isFinite(_deltaTime)
          ? _deltaTime
          : 1 / 60;

      // Update terrain time for animated caustics
      this.terrainTime += dt;
      const materialWithUniforms = this.getTerrainMaterialWithUniforms();
      if (materialWithUniforms) {
        materialWithUniforms.terrainUniforms.time.value = this.terrainTime;

        // Fog texture is the shared fogRenderTarget from FogConfig — no sync needed

        // Update lamppost vertex lights (night-only)
        if (isLamppostLightTextureReady()) {
          updateTerrainVertexLights(materialWithUniforms.terrainUniforms, []);
        } else {
          this.lamppostLightUpdateTimer += dt;
          if (this.lamppostLightUpdateTimer >= LAMP_LIGHT_UPDATE_INTERVAL_SEC) {
            this.lamppostLightUpdateTimer = 0;
            this.syncLamppostVertexLights(materialWithUniforms);
          }
        }
      }

      // Update water system
      if (this.waterSystem) {
        this.waterSystem.update(dt);
      }
    }
  }

  /**
   * Update terrain vertex lights from nearby lampposts (night-only)
   */
  private syncLamppostVertexLights(material: {
    terrainUniforms: TerrainUniforms;
  }): void {
    const environment = this.world.getSystem("environment") as {
      getDayIntensity?: () => number;
    } | null;
    const dayIntensity = environment?.getDayIntensity?.() ?? 1;
    const nightMix = this.computeNightMix(dayIntensity);

    if (nightMix <= 0.001) {
      updateTerrainVertexLights(material.terrainUniforms, []);
      return;
    }

    const landmarksSystem = this.world.getSystem("town-landmarks") as {
      getLamppostLightPositions?: () => ReadonlyArray<THREE.Vector3>;
    } | null;
    const lightPositions = landmarksSystem?.getLamppostLightPositions?.() ?? [];

    if (lightPositions.length === 0) {
      updateTerrainVertexLights(material.terrainUniforms, []);
      return;
    }

    const origin = this.world.rig.position;
    const maxRangeSq = LAMP_LIGHT_SEARCH_RANGE * LAMP_LIGHT_SEARCH_RANGE;

    this.lamppostLightIndices.length = 0;
    this.lamppostLightDistances.length = 0;

    for (let i = 0; i < lightPositions.length; i++) {
      const pos = lightPositions[i];
      const dx = pos.x - origin.x;
      const dy = pos.y - origin.y;
      const dz = pos.z - origin.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > maxRangeSq) continue;

      if (this.lamppostLightIndices.length < MAX_VERTEX_LIGHTS) {
        this.lamppostLightIndices.push(i);
        this.lamppostLightDistances.push(distSq);
        continue;
      }

      let worstIndex = 0;
      let worstDist = this.lamppostLightDistances[0];
      for (let j = 1; j < this.lamppostLightDistances.length; j++) {
        if (this.lamppostLightDistances[j] > worstDist) {
          worstDist = this.lamppostLightDistances[j];
          worstIndex = j;
        }
      }
      if (distSq < worstDist) {
        this.lamppostLightIndices[worstIndex] = i;
        this.lamppostLightDistances[worstIndex] = distSq;
      }
    }

    const count = this.lamppostLightIndices.length;
    if (count === 0) {
      updateTerrainVertexLights(material.terrainUniforms, []);
      return;
    }

    while (this.lamppostActiveLights.length < count) {
      this.lamppostActiveLights.push({
        position: new THREE.Vector3(),
        color: new THREE.Color(),
        intensity: 0,
        range: 1,
      });
    }
    this.lamppostActiveLights.length = count;

    const intensity = LAMP_VERTEX_LIGHT_INTENSITY * nightMix;
    for (let i = 0; i < count; i++) {
      const index = this.lamppostLightIndices[i];
      const pos = lightPositions[index];
      const light = this.lamppostActiveLights[i];
      light.position.copy(pos);
      light.color.copy(LAMP_VERTEX_LIGHT_COLOR);
      light.intensity = intensity;
      light.range = LAMP_VERTEX_LIGHT_RANGE;
    }

    updateTerrainVertexLights(
      material.terrainUniforms,
      this.lamppostActiveLights,
    );
  }

  /**
   * Compute night mix for lamp activation (0 = day, 1 = full night)
   */
  private computeNightMix(dayIntensity: number): number {
    const night = 1 - dayIntensity;
    const t = Math.max(0, Math.min(1, (night - 0.4) / 0.3));
    return t * t * (3 - 2 * t);
  }

  private checkPlayerMovement(): void {
    // Get player positions and update loaded tiles accordingly
    const players = this.world.getPlayers() || [];

    for (const player of players) {
      const x = player.node.position.x;
      const z = player.node.position.z;

      const tileX = Math.floor(x / this.CONFIG.TILE_SIZE);
      const tileZ = Math.floor(z / this.CONFIG.TILE_SIZE);

      // Check if player moved to a new tile
      if (tileX !== this.lastPlayerTile.x || tileZ !== this.lastPlayerTile.z) {
        this.updateTilesAroundPlayer(tileX, tileZ);
        this.lastPlayerTile = { x: tileX, z: tileZ };
      }
    }
  }

  private updateTilesAroundPlayer(centerX: number, centerZ: number): void {
    const requiredTiles = new Set<string>();

    // Generate list of required tiles (3x3 around player)
    for (
      let dx = -this.CONFIG.VIEW_DISTANCE;
      dx <= this.CONFIG.VIEW_DISTANCE;
      dx++
    ) {
      for (
        let dz = -this.CONFIG.VIEW_DISTANCE;
        dz <= this.CONFIG.VIEW_DISTANCE;
        dz++
      ) {
        const tileX = centerX + dx;
        const tileZ = centerZ + dz;
        requiredTiles.add(`${tileX}_${tileZ}`);
      }
    }

    // Unload tiles that are no longer needed
    for (const [key, tile] of this.terrainTiles) {
      if (!requiredTiles.has(key)) {
        this.unloadTile(tile);
      }
    }

    // Load new tiles that are needed
    for (const key of requiredTiles) {
      if (!this.terrainTiles.has(key)) {
        const [tileX, tileZ] = key.split("_").map(Number);
        this.generateTile(tileX, tileZ);
      }
    }
  }

  /**
   * Safely dispose a Three.js material, handling WebGPU NodeMaterial edge cases
   * where the internal nodeBuilderState may be undefined if the material was
   * never rendered or already cleaned up by the renderer.
   */
  private safeDisposeMaterial(material: THREE.Material): void {
    try {
      material.dispose();
    } catch (err) {
      // WebGPU NodeMaterial may throw if nodeBuilderState was never created
      // (e.g., material was never rendered before disposal)
      // This is safe to ignore - the material is still cleaned up
      if (err instanceof TypeError && String(err).includes("usedTimes")) {
        // Expected error for unrendered WebGPU materials - silently ignore
      } else {
        console.warn("[TerrainSystem] Material disposal error:", err);
      }
    }
  }

  private unloadTile(tile: TerrainTile): void {
    // Clean up road meshes
    for (const road of tile.roads) {
      if (road.mesh && road.mesh.parent) {
        road.mesh.parent.remove(road.mesh);
        road.mesh.geometry.dispose();
        if (road.mesh.material instanceof THREE.Material) {
          this.safeDisposeMaterial(road.mesh.material);
        }
        road.mesh = null;
      }
    }

    // Remove instanced meshes for this tile
    if (this.instancedMeshManager) {
      for (const resource of tile.resources) {
        if (resource.instanceId != null && resource.meshType) {
          this.instancedMeshManager.removeInstance(
            resource.meshType,
            resource.instanceId,
          );
        }
      }
    }

    // Remove decorative rock instances
    if (tile.decorativeRockIds?.length) {
      const rockInstancer = ProcgenRockInstancer.getInstance(null);
      if (rockInstancer) {
        for (const id of tile.decorativeRockIds) {
          rockInstancer.removeInstance(id);
        }
      }
      tile.decorativeRockIds = [];
    }

    // Remove decorative plant instances
    if (tile.decorativePlantIds?.length) {
      const plantInstancer = ProcgenPlantInstancer.getInstance(null);
      if (plantInstancer) {
        for (const id of tile.decorativePlantIds) {
          plantInstancer.removeInstance(id);
        }
      }
      tile.decorativePlantIds = [];
    }

    // Clean up water meshes
    if (tile.waterMeshes) {
      for (const waterMesh of tile.waterMeshes) {
        if (waterMesh.parent) {
          waterMesh.parent.remove(waterMesh);
          waterMesh.geometry.dispose();
          if (waterMesh.material instanceof THREE.Material) {
            this.safeDisposeMaterial(waterMesh.material);
          }
        }
      }
      tile.waterMeshes = [];
    }

    // Remove main tile mesh from scene
    if (this.terrainContainer && tile.mesh.parent) {
      this.terrainContainer.remove(tile.mesh);
      tile.mesh.geometry.dispose();
      if (tile.mesh.material instanceof THREE.Material) {
        this.safeDisposeMaterial(tile.mesh.material);
      }
    }

    // Remove collision
    if (tile.collision) {
      tile.collision.release();
    }

    // Save if needed
    if (tile.needsSave && this.databaseSystem) {
      // Save tile data before unloading
      // This would be implemented when we have the database schema
    }

    // Remove from maps
    this.terrainTiles.delete(tile.key);
    this.activeChunks.delete(tile.key);
    // Remove cached bounding box if present
    this.terrainBoundingBoxes.delete(tile.key);
    // Remove pending serialization data to prevent unbounded memory growth
    this.pendingSerializationData.delete(tile.key);
    this.emitTileUnloaded(`${tile.x},${tile.z}`, tile.x, tile.z);
  }

  // ===== TERRAIN MOVEMENT CONSTRAINTS (GDD Requirement) =====

  /**
   * Check if a position is walkable based on terrain constraints
   * Implements GDD rules: "Water bodies are impassable" and "Steep mountain slopes block movement"
   */
  isPositionWalkable(
    worldX: number,
    worldZ: number,
  ): { walkable: boolean; reason?: string } {
    const tileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
    const tileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);
    const biome = this.getBiomeAt(tileX, tileZ);
    const biomeData = BIOMES[biome];

    // Get height at position
    const height = this.getHeightAt(worldX, worldZ);

    // Check if underwater (water impassable rule)
    if (height < this.CONFIG.WATER_THRESHOLD) {
      return { walkable: false, reason: "Water bodies are impassable" };
    }

    // Check slope constraints
    const slope = this.calculateSlope(worldX, worldZ);
    if (slope > biomeData.maxSlope) {
      return {
        walkable: false,
        reason: "Steep mountain slopes block movement",
      };
    }

    // Special case for lakes biome - always impassable
    if (biome === "lakes") {
      return { walkable: false, reason: "Lake water is impassable" };
    }

    return { walkable: true };
  }

  /**
   * Unified walkability check combining CollisionMatrix and terrain.
   *
   * This is the single source of truth for tile walkability:
   * 1. Check CollisionMatrix for static objects (trees, rocks, stations, entities)
   * 2. Check terrain constraints (water, slopes)
   *
   * @param worldX - World X coordinate
   * @param worldZ - World Z coordinate
   * @returns Whether the position is walkable
   */
  isTileWalkable(worldX: number, worldZ: number): boolean {
    // Convert to tile coordinates
    const tile = worldToTile(worldX, worldZ);

    // Check CollisionMatrix for static objects and entities
    if (
      this.world.collision.hasFlags(
        tile.x,
        tile.z,
        CollisionMask.BLOCKS_MOVEMENT,
      )
    ) {
      return false;
    }

    // Check terrain walkability (water, slopes)
    const terrainCheck = this.isPositionWalkable(worldX, worldZ);
    return terrainCheck.walkable;
  }

  /**
   * Calculate slope at a given world position using 8-directional sampling.
   * Includes cardinal and diagonal directions to catch steep slopes that
   * might be missed by 4-directional sampling.
   */
  private calculateSlope(worldX: number, worldZ: number): number {
    const checkDistance = this.CONFIG.SLOPE_CHECK_DISTANCE;
    const centerHeight = this.getHeightAt(worldX, worldZ);

    // Sample heights in 4 cardinal directions
    const northHeight = this.getHeightAt(worldX, worldZ + checkDistance);
    const southHeight = this.getHeightAt(worldX, worldZ - checkDistance);
    const eastHeight = this.getHeightAt(worldX + checkDistance, worldZ);
    const westHeight = this.getHeightAt(worldX - checkDistance, worldZ);

    // Sample heights in 4 diagonal directions
    // Diagonal distance is sqrt(2) * checkDistance for proper slope calculation
    const diagDistance = checkDistance * Math.SQRT2;
    const neHeight = this.getHeightAt(
      worldX + checkDistance,
      worldZ + checkDistance,
    );
    const nwHeight = this.getHeightAt(
      worldX - checkDistance,
      worldZ + checkDistance,
    );
    const seHeight = this.getHeightAt(
      worldX + checkDistance,
      worldZ - checkDistance,
    );
    const swHeight = this.getHeightAt(
      worldX - checkDistance,
      worldZ - checkDistance,
    );

    // Calculate maximum slope in any direction
    // Cardinal slopes use checkDistance, diagonal slopes use diagDistance
    const slopes = [
      // Cardinal directions
      Math.abs(northHeight - centerHeight) / checkDistance,
      Math.abs(southHeight - centerHeight) / checkDistance,
      Math.abs(eastHeight - centerHeight) / checkDistance,
      Math.abs(westHeight - centerHeight) / checkDistance,
      // Diagonal directions (normalized by diagonal distance)
      Math.abs(neHeight - centerHeight) / diagDistance,
      Math.abs(nwHeight - centerHeight) / diagDistance,
      Math.abs(seHeight - centerHeight) / diagDistance,
      Math.abs(swHeight - centerHeight) / diagDistance,
    ];

    return Math.max(...slopes);
  }

  /**
   * Find a walkable path between two points (basic pathfinding)
   */
  findWalkablePath(
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
  ): { path: Array<{ x: number; z: number }>; blocked: boolean } {
    // Simple line-of-sight check first
    const steps = 20;
    const dx = (endX - startX) / steps;
    const dz = (endZ - startZ) / steps;

    const path: Array<{ x: number; z: number }> = [];

    for (let i = 0; i <= steps; i++) {
      const x = startX + dx * i;
      const z = startZ + dz * i;

      const walkableCheck = this.isPositionWalkable(x, z);
      if (!walkableCheck.walkable) {
        // Path is blocked, would need A* pathfinding for complex routing
        return { path: [], blocked: true };
      }

      path.push({ x, z });
    }

    return { path, blocked: false };
  }

  /**
   * Get terrain info at world position (for movement system integration)
   */
  getTerrainInfoAt(
    worldX: number,
    worldZ: number,
  ): {
    height: number;
    biome: string;
    walkable: boolean;
    slope: number;
    underwater: boolean;
  } {
    const height = this.getHeightAt(worldX, worldZ);
    const tileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
    const tileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);
    const biome = this.getBiomeAt(tileX, tileZ);
    const slope = this.calculateSlope(worldX, worldZ);
    const walkableCheck = this.isPositionWalkable(worldX, worldZ);

    return {
      height,
      biome,
      walkable: walkableCheck.walkable,
      slope,
      underwater: height < this.CONFIG.WATER_THRESHOLD,
    };
  }

  // ===== TERRAIN-BASED MOB SPAWNING (GDD Integration) =====

  /**
   * Generate visual features (road meshes, lake meshes) for a tile
   */
  private generateVisualFeatures(tile: TerrainTile): void {
    // Roads are rendered as noise-based color paths; no mesh generation

    // Generate lake meshes for water bodies
    this.generateLakeMeshes(tile);
  }

  /**
   * Generate visual road meshes for better visibility
   */
  private generateRoadMeshes(_tile: TerrainTile): void {}

  /**
   * Generate water meshes for low areas
   * Water geometry is shaped to only cover actual underwater terrain
   * Uses "ocean" shader for water at island boundary, "lake" for inland water
   */
  private generateWaterMeshes(tile: TerrainTile): void {
    if (!this.waterSystem) return;

    // Determine water type based on tile position relative to island
    // Ocean water is at the world boundaries (outside island radius)
    // Lake water is inland (ponds, lakes within the island)
    const waterType = this.determineWaterType(tile);

    // Pass height function so water mesh can be shaped to underwater areas only
    // Water will only be created where terrain is below WATER_THRESHOLD
    // Geometry is shaped to match shorelines (not a full rectangle)
    const waterMesh = this.waterSystem.generateWaterMesh(
      tile,
      this.CONFIG.WATER_THRESHOLD,
      this.CONFIG.TILE_SIZE,
      (worldX: number, worldZ: number) => this.getHeightAt(worldX, worldZ),
      waterType,
    );

    // waterMesh is null if no underwater areas exist
    if (waterMesh && tile.mesh) {
      tile.mesh.add(waterMesh);
      tile.waterMeshes.push(waterMesh);
    }
  }

  /**
   * Determine if a tile's water should be "ocean" (boundary) or "lake" (inland)
   * Ocean: water at world edges where island mask < threshold
   * Lake: inland water bodies (ponds, rivers within the island)
   */
  private determineWaterType(tile: TerrainTile): "lake" | "ocean" {
    // If island mask is disabled, all water is lake
    if (!this.CONFIG.ISLAND_MASK_ENABLED) {
      return "lake";
    }

    // Calculate tile center position
    const tileCenterX = tile.x * this.CONFIG.TILE_SIZE;
    const tileCenterZ = tile.z * this.CONFIG.TILE_SIZE;

    // Get the island mask at tile center
    // Island mask is 1.0 at center, falls to 0.0 at ocean
    const islandMask = this.getIslandMask(tileCenterX, tileCenterZ);

    // If island mask is below threshold, this is ocean water
    // Use 0.3 as threshold - water in the outer 70% of falloff zone is ocean
    const OCEAN_THRESHOLD = 0.3;
    if (islandMask < OCEAN_THRESHOLD) {
      return "ocean";
    }

    return "lake";
  }

  /**
   * Generate visual lake meshes for water bodies
   * Note: generateWaterMeshes now only creates water where terrain is underwater,
   * so this is a no-op. Keeping for future enhancements (special lake effects).
   */
  private generateLakeMeshes(_tile: TerrainTile): void {
    // Water is handled by generateWaterMeshes (only where terrain < WATER_THRESHOLD)
    // Future: Could add special effects for lake biomes here (waves, ripples, etc.)
  }

  /**
   * Find water areas within a tile that need visual representation
   */
  private findWaterAreas(
    tile: TerrainTile,
  ): Array<{ centerX: number; centerZ: number; width: number; depth: number }> {
    const waterAreas: Array<{
      centerX: number;
      centerZ: number;
      width: number;
      depth: number;
    }> = [];
    const biomeData = BIOMES[tile.biome];
    if (!biomeData) return waterAreas;

    // For lakes biome, create a large water area covering most of the tile
    if ((tile.biome as string) === "lakes") {
      waterAreas.push({
        centerX: 0,
        centerZ: 0,
        width: this.CONFIG.TILE_SIZE * 0.8,
        depth: this.CONFIG.TILE_SIZE * 0.8,
      });
    } else {
      // For other biomes, sample the heightmap to find areas below water level
      const sampleSize = 10; // Sample every 10 meters
      const samples: Array<{ x: number; z: number; underwater: boolean }> = [];

      for (
        let x = -this.CONFIG.TILE_SIZE / 2;
        x < this.CONFIG.TILE_SIZE / 2;
        x += sampleSize
      ) {
        for (
          let z = -this.CONFIG.TILE_SIZE / 2;
          z < this.CONFIG.TILE_SIZE / 2;
          z += sampleSize
        ) {
          const worldX = tile.x * this.CONFIG.TILE_SIZE + x;
          const worldZ = tile.z * this.CONFIG.TILE_SIZE + z;
          const height = this.getHeightAt(worldX, worldZ);

          samples.push({
            x,
            z,
            underwater: height < this.CONFIG.WATER_THRESHOLD,
          });
        }
      }

      // Group contiguous underwater areas (simplified approach)
      const underwaterSamples = samples.filter((s) => s.underwater);
      if (underwaterSamples.length > 0) {
        // Create one water area covering the underwater region
        const minX = Math.min(...underwaterSamples.map((s) => s.x));
        const maxX = Math.max(...underwaterSamples.map((s) => s.x));
        const minZ = Math.min(...underwaterSamples.map((s) => s.z));
        const maxZ = Math.max(...underwaterSamples.map((s) => s.z));

        waterAreas.push({
          centerX: (minX + maxX) / 2,
          centerZ: (minZ + maxZ) / 2,
          width: maxX - minX + sampleSize,
          depth: maxZ - minZ + sampleSize,
        });
      }
    }

    return waterAreas;
  }

  /**
   * Get valid mob spawn positions in a tile based on biome and terrain constraints
   */
  getMobSpawnPositionsForTile(
    tileX: number,
    tileZ: number,
    maxSpawns: number = 10,
  ): Array<{
    position: { x: number; y: number; z: number };
    mobTypes: string[];
    biome: string;
    difficulty: number;
  }> {
    const biome = this.getBiomeAt(tileX, tileZ);
    const biomeData = BIOMES[biome];

    // Don't spawn mobs in safe zones
    if (biomeData.difficulty === 0 || biomeData.mobTypes.length === 0) {
      return [];
    }

    const spawnPositions: Array<{
      position: { x: number; y: number; z: number };
      mobTypes: string[];
      biome: string;
      difficulty: number;
    }> = [];

    // Try to find valid spawn positions
    let attempts = 0;
    const maxAttempts = maxSpawns * 3; // Allow some failures

    while (spawnPositions.length < maxSpawns && attempts < maxAttempts) {
      attempts++;

      // Random position within tile
      const worldX =
        tileX * this.CONFIG.TILE_SIZE +
        (Math.random() - 0.5) * this.CONFIG.TILE_SIZE * 0.8;
      const worldZ =
        tileZ * this.CONFIG.TILE_SIZE +
        (Math.random() - 0.5) * this.CONFIG.TILE_SIZE * 0.8;

      // Check if position is suitable for mob spawning
      const terrainInfo = this.getTerrainInfoAt(worldX, worldZ);

      if (!terrainInfo.walkable || terrainInfo.underwater) {
        continue; // Skip unwalkable positions
      }

      // Check distance from roads (don't spawn too close to roads)
      if (this.isPositionNearRoad(worldX, worldZ, 8)) {
        continue; // Skip positions near roads
      }

      // Check distance from starter towns
      if (this.isPositionNearTown(worldX, worldZ, this.CONFIG.TOWN_RADIUS)) {
        continue; // Skip positions near safe towns
      }

      spawnPositions.push({
        position: {
          x: worldX,
          y: terrainInfo.height,
          z: worldZ,
        },
        mobTypes: [...biomeData.mobTypes],
        biome: biome,
        difficulty: biomeData.difficulty,
      });
    }

    return spawnPositions;
  }

  /**
   * Check if position is near a road
   */
  private isPositionNearRoad(
    worldX: number,
    worldZ: number,
    minDistance: number,
  ): boolean {
    const tileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
    const tileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);

    // Check current tile and adjacent tiles for roads
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const checkTileX = tileX + dx;
        const checkTileZ = tileZ + dz;
        const tileKey = `${checkTileX}_${checkTileZ}`;
        const tile = this.terrainTiles.get(tileKey);

        if (tile && tile.roads.length > 0) {
          for (const road of tile.roads) {
            const localX = worldX - checkTileX * this.CONFIG.TILE_SIZE;
            const localZ = worldZ - checkTileZ * this.CONFIG.TILE_SIZE;

            const distanceToRoad = this.distanceToLineSegment(
              new THREE.Vector2(localX, localZ),
              road.start instanceof THREE.Vector2
                ? road.start
                : new THREE.Vector2(road.start.x, road.start.z),
              road.end instanceof THREE.Vector2
                ? road.end
                : new THREE.Vector2(road.end.x, road.end.z),
            );

            if (distanceToRoad < minDistance) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if position is near a starter town
   */
  private isPositionNearTown(
    worldX: number,
    worldZ: number,
    minDistance: number,
  ): boolean {
    const towns = [
      { x: 0, z: 0 },
      { x: 10 * this.CONFIG.TILE_SIZE, z: 0 },
      { x: -10 * this.CONFIG.TILE_SIZE, z: 0 },
      { x: 0, z: 10 * this.CONFIG.TILE_SIZE },
      { x: 0, z: -10 * this.CONFIG.TILE_SIZE },
    ];

    for (const town of towns) {
      const distance = Math.sqrt(
        (worldX - town.x) ** 2 + (worldZ - town.z) ** 2,
      );
      if (distance < minDistance) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all mob types available in a specific biome
   */
  getBiomeMobTypes(biome: string): string[] {
    const biomeData = BIOMES[biome];
    return biomeData ? [...biomeData.mobTypes] : [];
  }

  /**
   * Get biome difficulty level for mob spawning
   */
  getBiomeDifficulty(biome: string): number {
    const biomeData = BIOMES[biome];
    return biomeData ? biomeData.difficulty : 0;
  }

  /**
   * Get difficulty sample at a world position.
   * Scales from biome difficulty with noise and town falloff.
   */
  getDifficultyAtWorldPosition(
    worldX: number,
    worldZ: number,
    overrideDifficultyLevel?: number,
  ): DifficultySample {
    // Ensure noise and biome centers are initialized
    if (!this.noise) {
      this.noise = new NoiseGenerator(this.computeSeedFromWorldId());
      if (this.biomeCenters.length === 0) {
        this.initializeBiomeCenters();
      }
    }

    const biome = this.getBiomeAtWorldPosition(worldX, worldZ);
    const biomeData = BIOMES[biome];
    const biomeDifficulty = biomeData ? biomeData.difficulty : 0;
    const difficultyTier =
      overrideDifficultyLevel !== undefined
        ? overrideDifficultyLevel
        : biomeDifficulty;

    const townDistance = this.getNearestTownDistance(worldX, worldZ);
    const townFalloff =
      townDistance === null
        ? 1
        : Math.min(
            1,
            Math.max(
              0,
              townDistance / this.CONFIG.DIFFICULTY_TOWN_FALLOFF_RADIUS,
            ),
          );

    if (difficultyTier <= 0 || townFalloff <= 0) {
      return {
        level: 0,
        scalar: 0,
        biome,
        difficultyTier,
        isSafe: true,
      };
    }

    const baseScalar = Math.min(1, Math.max(0, difficultyTier / 3));
    const noiseValue = this.noise.simplex2D(
      worldX * this.CONFIG.DIFFICULTY_NOISE_SCALE,
      worldZ * this.CONFIG.DIFFICULTY_NOISE_SCALE,
    );
    const noiseNormalized = (noiseValue + 1) * 0.5;
    const blendedScalar =
      baseScalar * (1 - this.CONFIG.DIFFICULTY_NOISE_WEIGHT) +
      noiseNormalized * this.CONFIG.DIFFICULTY_NOISE_WEIGHT;

    const scalar = Math.min(
      1,
      Math.max(
        0,
        Math.pow(
          blendedScalar * townFalloff,
          this.CONFIG.DIFFICULTY_CURVE_EXPONENT,
        ),
      ),
    );

    const maxLevel = this.CONFIG.DIFFICULTY_MAX_LEVEL;
    const level =
      scalar <= 0 ? 0 : Math.max(1, Math.floor(1 + scalar * (maxLevel - 1)));

    return {
      level,
      scalar,
      biome,
      difficultyTier,
      isSafe: false,
    };
  }

  getBossLevelAtWorldPosition(worldX: number, worldZ: number): number {
    const sample = this.getDifficultyAtWorldPosition(worldX, worldZ);
    const maxLevel = this.CONFIG.DIFFICULTY_MAX_LEVEL;
    if (sample.level <= 0) {
      return this.CONFIG.BOSS_MIN_LEVEL;
    }
    return Math.min(
      maxLevel,
      Math.max(this.CONFIG.BOSS_MIN_LEVEL, sample.level),
    );
  }

  getBossHotspots(): BossHotspot[] {
    if (this.bossHotspots.length === 0) {
      this.generateBossHotspots();
    }
    return [...this.bossHotspots];
  }

  getBossHotspotAtWorldPosition(
    worldX: number,
    worldZ: number,
  ): BossHotspot | null {
    const hotspots = this.getBossHotspots();
    for (const hotspot of hotspots) {
      const dx = worldX - hotspot.x;
      const dz = worldZ - hotspot.z;
      if (dx * dx + dz * dz <= hotspot.radius * hotspot.radius) {
        return hotspot;
      }
    }
    return null;
  }

  private getNearestTownDistance(
    worldX: number,
    worldZ: number,
  ): number | null {
    let nearest: number | null = null;

    if (this.townSystem) {
      const towns = this.townSystem.getTowns();
      if (towns.length > 0) {
        for (const town of towns) {
          const dx = worldX - town.position.x;
          const dz = worldZ - town.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);
          const distanceFromEdge = Math.max(0, distance - town.safeZoneRadius);
          if (nearest === null || distanceFromEdge < nearest) {
            nearest = distanceFromEdge;
          }
        }
      }
    }

    if (nearest !== null) {
      return nearest;
    }

    const fallbackRadius = this.CONFIG.TOWN_RADIUS;
    const fallbackTowns = [
      { x: 0, z: 0 },
      { x: 10 * this.CONFIG.TILE_SIZE, z: 0 },
      { x: -10 * this.CONFIG.TILE_SIZE, z: 0 },
      { x: 0, z: 10 * this.CONFIG.TILE_SIZE },
      { x: 0, z: -10 * this.CONFIG.TILE_SIZE },
    ];

    for (const town of fallbackTowns) {
      const dx = worldX - town.x;
      const dz = worldZ - town.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const distanceFromEdge = Math.max(0, distance - fallbackRadius);
      if (nearest === null || distanceFromEdge < nearest) {
        nearest = distanceFromEdge;
      }
    }

    return nearest;
  }

  private isPositionInSafeWorldArea(worldX: number, worldZ: number): boolean {
    for (const area of Object.values(ALL_WORLD_AREAS)) {
      if (!area.bounds) continue;
      if (!area.safeZone && area.difficultyLevel !== 0) continue;
      const { minX, maxX, minZ, maxZ } = area.bounds;
      if (worldX > minX && worldX <= maxX && worldZ > minZ && worldZ <= maxZ) {
        return true;
      }
    }
    return false;
  }

  private generateBossHotspots(): void {
    if (this.bossHotspots.length > 0) return;

    if (!this.noise) {
      this.noise = new NoiseGenerator(this.computeSeedFromWorldId());
      if (this.biomeCenters.length === 0) {
        this.initializeBiomeCenters();
      }
    }

    const worldSizeMeters = this.getActiveWorldSizeMeters();
    const halfWorld = worldSizeMeters / 2;
    const step = this.CONFIG.BOSS_HOTSPOT_GRID_STEP;
    const minScalar = this.CONFIG.BOSS_HOTSPOT_MIN_SCALAR;
    const candidates: Array<{
      x: number;
      z: number;
      score: number;
      seed: number;
    }> = [];

    const start = -halfWorld + step * 0.5;
    const end = halfWorld - step * 0.5;

    for (let x = start; x <= end; x += step) {
      for (let z = start; z <= end; z += step) {
        const sample = this.getDifficultyAtWorldPosition(x, z);
        if (sample.isSafe || sample.scalar < minScalar) continue;

        const height = this.getHeightAt(x, z);
        if (height < this.CONFIG.WATER_THRESHOLD) continue;

        const slope = this.calculateSlope(x, z);
        if (slope > this.CONFIG.MAX_WALKABLE_SLOPE) continue;

        const townDistance = this.getNearestTownDistance(x, z);
        if (
          townDistance !== null &&
          townDistance < this.CONFIG.DIFFICULTY_TOWN_FALLOFF_RADIUS
        ) {
          continue;
        }

        if (this.isPositionInSafeWorldArea(x, z)) {
          continue;
        }

        const roadAvoidDistance = Math.max(10, this.CONFIG.ROAD_WIDTH * 2);
        if (this.isPositionNearRoad(x, z, roadAvoidDistance)) {
          continue;
        }

        const noiseValue = this.noise.simplex2D(
          x * this.CONFIG.DIFFICULTY_NOISE_SCALE * 1.3 + 12.7,
          z * this.CONFIG.DIFFICULTY_NOISE_SCALE * 1.3 - 8.1,
        );
        const seed = (noiseValue + 1) * 0.5;
        const score = sample.scalar + seed * 0.1;

        candidates.push({ x, z, score, seed });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    const minDistanceSq =
      this.CONFIG.BOSS_HOTSPOT_MIN_DISTANCE *
      this.CONFIG.BOSS_HOTSPOT_MIN_DISTANCE;
    const selected: BossHotspot[] = [];

    for (const candidate of candidates) {
      if (selected.length >= this.CONFIG.BOSS_HOTSPOT_MAX) break;

      let tooClose = false;
      for (const hotspot of selected) {
        const dx = candidate.x - hotspot.x;
        const dz = candidate.z - hotspot.z;
        if (dx * dx + dz * dz < minDistanceSq) {
          tooClose = true;
          break;
        }
      }

      if (tooClose) continue;

      const id = `boss_hotspot_${selected.length}`;
      selected.push({
        id,
        x: candidate.x,
        z: candidate.z,
        radius: this.CONFIG.BOSS_HOTSPOT_RADIUS,
        minLevel: this.CONFIG.BOSS_MIN_LEVEL,
        maxLevel: this.CONFIG.DIFFICULTY_MAX_LEVEL,
        seed: candidate.seed,
      });
    }

    this.bossHotspots = selected;
  }

  /**
   * Get all loaded tiles with their biome (for ProceduralGrassSystem and other systems)
   * Returns ALL tiles regardless of difficulty or mob presence.
   */
  getLoadedTiles(): Array<{
    tileX: number;
    tileZ: number;
    biome: string;
  }> {
    const tilesData: Array<{
      tileX: number;
      tileZ: number;
      biome: string;
    }> = [];

    for (const [_key, tile] of this.terrainTiles.entries()) {
      tilesData.push({
        tileX: tile.x,
        tileZ: tile.z,
        biome: this.mapBiomeToGeneric(tile.biome),
      });
    }

    return tilesData;
  }

  /**
   * Get all loaded tiles with their biome and mob spawn data
   * Note: Only returns tiles with difficulty > 0 AND mobTypes (for mob spawning)
   */
  getLoadedTilesWithSpawnData(): Array<{
    tileX: number;
    tileZ: number;
    biome: string;
    difficulty: number;
    mobTypes: string[];
    spawnPositions: Array<{ x: number; y: number; z: number }>;
  }> {
    const tilesData: Array<{
      tileX: number;
      tileZ: number;
      biome: string;
      difficulty: number;
      mobTypes: string[];
      spawnPositions: Array<{ x: number; y: number; z: number }>;
    }> = [];

    for (const [_key, tile] of this.terrainTiles.entries()) {
      const biomeData = BIOMES[tile.biome];

      if (
        biomeData &&
        biomeData.difficulty > 0 &&
        biomeData.mobTypes.length > 0
      ) {
        const spawnPositions = this.getMobSpawnPositionsForTile(
          tile.x,
          tile.z,
          5,
        );

        tilesData.push({
          tileX: tile.x,
          tileZ: tile.z,
          biome: tile.biome,
          difficulty: biomeData.difficulty,
          mobTypes: [...biomeData.mobTypes],
          spawnPositions: spawnPositions.map((spawn) => spawn.position),
        });
      }
    }

    return tilesData;
  }

  destroy(): void {
    // Terminate terrain worker pool to free resources
    terminateTerrainWorkerPool();

    // Clear pending worker results
    this.pendingWorkerResults.clear();

    // Remove prefs listener
    if (this.world.prefs) {
      this.world.prefs.off("change", this.onPrefsChange);
    }

    // Perform final serialization before shutdown
    this.performImmediateSerialization();

    // Dispose instanced mesh manager
    if (this.instancedMeshManager) {
      this.instancedMeshManager.dispose();
    }

    // Clear save interval
    if (this.chunkSaveInterval) {
      clearInterval(this.chunkSaveInterval);
    }
    if (this.terrainUpdateIntervalId) {
      clearInterval(this.terrainUpdateIntervalId);
    }
    if (this.serializationIntervalId) {
      clearInterval(this.serializationIntervalId);
    }
    if (this.boundingBoxIntervalId) {
      clearInterval(this.boundingBoxIntervalId);
    }
    if (this.roadsTimeoutId) {
      clearTimeout(this.roadsTimeoutId);
    }
    if (this._tileRegenerationFlushId) {
      clearTimeout(this._tileRegenerationFlushId);
      this._tileRegenerationFlushId = undefined;
    }

    // Save all modified chunks before shutdown
    this.saveModifiedChunks();

    // Unload all tiles
    for (const tile of this.terrainTiles.values()) {
      this.unloadTile(tile);
    }

    // Remove terrain container
    if (this.terrainContainer && this.terrainContainer.parent) {
      this.terrainContainer.parent.remove(this.terrainContainer);
    }

    // Clear tracking data
    this.playerChunks.clear();
    this.simulatedChunks.clear();
    this.chunkPlayerCounts.clear();
    this._queuedTileRegenerations.clear();
    this._pendingTileRegeneration.clear();
    this.terrainBoundingBoxes.clear();
    this.pendingSerializationData.clear();

    // Cleanup GPU compute context
    if (this.terrainComputeContext) {
      this.terrainComputeContext.destroy();
      this.terrainComputeContext = null;
      this.gpuComputeAvailable = false;
    }
  }

  private emitTileUnloaded(tileId: string, tileX: number, tileZ: number): void {
    this.world.emit(EventType.TERRAIN_TILE_UNLOADED, { tileId, tileX, tileZ });
  }

  // Methods for chunk persistence (used by tests)
  markChunkActive(chunkX: number, chunkZ: number): void {
    const key = `${chunkX}_${chunkZ}`;

    // Add to simulated chunks if not already there
    this.simulatedChunks.add(key);

    // Update chunk player count
    const currentCount = this.chunkPlayerCounts.get(key) || 0;
    this.chunkPlayerCounts.set(key, currentCount + 1);
  }

  markChunkInactive(chunkX: number, chunkZ: number): void {
    const key = `${chunkX}_${chunkZ}`;

    // Decrease chunk player count
    const currentCount = this.chunkPlayerCounts.get(key) || 0;
    if (currentCount > 1) {
      this.chunkPlayerCounts.set(key, currentCount - 1);
    } else {
      // No more active references - remove from simulation
      this.chunkPlayerCounts.delete(key);
      this.simulatedChunks.delete(key);
    }
  }

  getActiveChunks(): Array<{ x: number; z: number }> {
    // Return currently loaded terrain tiles as "active chunks"
    const activeChunks: Array<{ x: number; z: number }> = [];
    for (const [key, _tile] of this.terrainTiles.entries()) {
      // FIX: Use '_' separator, not ','
      const [x, z] = key.split("_").map(Number);
      activeChunks.push({ x, z });
    }
    return activeChunks;
  }

  async saveAllActiveChunks(): Promise<void> {
    // In a real implementation, this would persist chunk data
    // For now, just save modified chunks
    this.saveModifiedChunks();
  }

  // ===== TEST INTEGRATION METHODS (expected by test-terrain.mjs) =====

  /**
   * Get comprehensive terrain statistics for testing
   */
  getTerrainStats(): {
    tileSize: string;
    worldSize: string;
    totalArea: string;
    maxLoadedTiles: number;
    tilesLoaded: number;
    currentlyLoaded: string[];
    biomeCount: number;
    chunkSize: number;
    worldBounds: {
      min: { x: number; z: number };
      max: { x: number; z: number };
    };
    activeBiomes: string[];
    totalRoads: number;
  } {
    const worldSizeTiles = this.getActiveWorldSizeTiles();
    const worldSizeMeters = worldSizeTiles * this.CONFIG.TILE_SIZE;
    const worldSizeKm = worldSizeMeters / 1000;
    const activeChunks = Array.from(this.terrainTiles.keys());
    return {
      tileSize: `${this.CONFIG.TILE_SIZE}x${this.CONFIG.TILE_SIZE}m`,
      worldSize: `${worldSizeTiles}x${worldSizeTiles}`,
      totalArea: `${worldSizeKm}km x ${worldSizeKm}km`,
      maxLoadedTiles: 9,
      tilesLoaded: this.terrainTiles.size,
      currentlyLoaded: activeChunks,
      biomeCount: Object.keys(BIOMES).length,
      chunkSize: this.CONFIG.TILE_SIZE,
      worldBounds: {
        min: { x: -worldSizeMeters / 2, z: -worldSizeMeters / 2 },
        max: { x: worldSizeMeters / 2, z: worldSizeMeters / 2 },
      },
      activeBiomes: Array.from(
        new Set(Array.from(this.terrainTiles.values()).map((t) => t.biome)),
      ),
      totalRoads: Array.from(this.terrainTiles.values()).reduce(
        (sum, t) => sum + t.roads.length,
        0,
      ),
    };
  }

  /**
   * Get biome name at world position (wrapper for test compatibility)
   */
  getBiomeAtPosition(x: number, z: number): string {
    const tileX = Math.floor(x / this.CONFIG.TILE_SIZE);
    const tileZ = Math.floor(z / this.CONFIG.TILE_SIZE);
    const biome = this.getBiomeAt(tileX, tileZ);
    return biome;
  }

  /**
   * Get height at world position (wrapper for test compatibility)
   */
  getHeightAtPosition(x: number, z: number): number {
    return this.getHeightAt(x, z);
  }

  // ===== MMOCHUNK LOADING AND SIMULATION SYSTEM =====

  /**
   * Initialize chunk loading system with 9 core + ring strategy
   */
  private initializeChunkLoadingSystem(): void {
    const isEmbeddedSpectator = (() => {
      if (typeof window === "undefined") return false;
      const win = window as Window & {
        __HYPERSCAPE_EMBEDDED__?: boolean;
        __HYPERSCAPE_CONFIG__?: { mode?: string };
      };
      return (
        win.__HYPERSCAPE_EMBEDDED__ === true &&
        win.__HYPERSCAPE_CONFIG__?.mode === "spectator"
      );
    })();
    // world.isServer can be false during early bootstrap (before network mode
    // is finalized). Resolve runtime role explicitly so server startup always
    // uses tight headless chunk ranges.
    const { isServer: isServerRuntime } = this.resolveRuntimeRole();

    // Embedded spectator prioritizes first-frame time over long-range preload.
    if (isServerRuntime) {
      // Server does not render horizon terrain, so keep chunk windows tight to
      // avoid runaway memory when many autonomous agents are active.
      this.coreChunkRange = 1; // 3x3 core grid
      this.ringChunkRange = 1; // No extra preload ring
      this.terrainOnlyChunkRange = 0; // Never load render-only distant tiles
      this.maxTilesPerFrame = 2;
      this.generationBudgetMsPerFrame = 4;
    } else if (isEmbeddedSpectator) {
      this.coreChunkRange = 1; // 3x3 core grid
      this.ringChunkRange = 2; // Preload ring up to 5x5
      this.terrainOnlyChunkRange = 2; // Avoid far-horizon churn in embedded stream view
      this.maxTilesPerFrame = 4; // Catch up faster after camera retargets
      this.generationBudgetMsPerFrame = 10;
    } else {
      // Balanced load radius to reduce generation spikes when moving
      this.coreChunkRange = 2; // 5x5 core grid
      this.ringChunkRange = 3; // Preload ring up to ~7x7
      this.terrainOnlyChunkRange = 5;
      this.maxTilesPerFrame = 2;
      this.generationBudgetMsPerFrame = 6;
    }

    // Initialize tracking maps
    this.playerChunks.clear();
    this.simulatedChunks.clear();
    this.chunkPlayerCounts.clear();
  }

  /**
   * Initialize 15-minute serialization system
   */
  private initializeSerializationSystem(): void {
    this.lastSerializationTime = Date.now();
    this.serializationInterval = 15 * 60 * 1000; // 15 minutes
    this.worldStateVersion = 1;
    this.pendingSerializationData.clear();
  }

  /**
   * Initialize bounding box verification system
   */
  private initializeBoundingBoxSystem(): void {
    // Set world bounds based on active world size
    const halfWorldMeters = this.getActiveWorldSizeMeters() / 2;
    this.worldBounds = {
      minX: -halfWorldMeters,
      maxX: halfWorldMeters,
      minZ: -halfWorldMeters,
      maxZ: halfWorldMeters,
      minY: -50,
      maxY: 100,
    };

    this.terrainBoundingBoxes.clear();
  }

  /**
   * Player-based terrain update with 9 core + ring strategy
   */
  private updatePlayerBasedTerrain(): void {
    if (this.isGenerating) return;

    // Resolve terrain centers (local players, or spectator camera target).
    const centers = this.getTerrainCenters();

    // Clear previous player chunk tracking
    this.playerChunks.clear();
    this.chunkPlayerCounts.clear();

    // Track which tiles are needed based on 9 core + ring strategy
    const neededTiles = new Set<string>();
    const simulationTiles = new Set<string>();

    for (const center of centers) {
      const playerPos = center.position;
      const playerId = center.id || "unknown";

      const x = playerPos.x;
      const z = playerPos.z;

      // Calculate tile position
      const tileX = Math.floor(x / this.CONFIG.TILE_SIZE);
      const tileZ = Math.floor(z / this.CONFIG.TILE_SIZE);

      // 9 core chunks (5x5 grid) - these get full simulation
      const coreChunks = new Set<string>();
      for (let dx = -this.coreChunkRange; dx <= this.coreChunkRange; dx++) {
        for (let dz = -this.coreChunkRange; dz <= this.coreChunkRange; dz++) {
          const tx = tileX + dx;
          const tz = tileZ + dz;
          const key = `${tx}_${tz}`;
          coreChunks.add(key);
          neededTiles.add(key);
          simulationTiles.add(key);
        }
      }

      // Ring chunks around core - these are loaded but not simulated
      for (let dx = -this.ringChunkRange; dx <= this.ringChunkRange; dx++) {
        for (let dz = -this.ringChunkRange; dz <= this.ringChunkRange; dz++) {
          // Skip core chunks
          if (
            Math.abs(dx) <= this.coreChunkRange &&
            Math.abs(dz) <= this.coreChunkRange
          ) {
            continue;
          }

          const tx = tileX + dx;
          const tz = tileZ + dz;
          const key = `${tx}_${tz}`;
          neededTiles.add(key);
        }
      }

      // Terrain-only chunks for the horizon
      for (
        let dx = -this.terrainOnlyChunkRange;
        dx <= this.terrainOnlyChunkRange;
        dx++
      ) {
        for (
          let dz = -this.terrainOnlyChunkRange;
          dz <= this.terrainOnlyChunkRange;
          dz++
        ) {
          if (
            Math.abs(dx) <= this.ringChunkRange &&
            Math.abs(dz) <= this.ringChunkRange
          ) {
            continue;
          }

          const tx = tileX + dx;
          const tz = tileZ + dz;
          const key = `${tx}_${tz}`;
          neededTiles.add(key);
        }
      }

      // Track player chunks for shared world simulation
      this.playerChunks.set(playerId, coreChunks);

      // Count players per chunk for shared simulation
      for (const chunkKey of coreChunks) {
        const currentCount = this.chunkPlayerCounts.get(chunkKey) || 0;
        this.chunkPlayerCounts.set(chunkKey, currentCount + 1);
      }
    }

    // Update simulated chunks - only chunks with players get simulation
    this.simulatedChunks.clear();
    for (const chunkKey of simulationTiles) {
      if (this.chunkPlayerCounts.get(chunkKey)! > 0) {
        this.simulatedChunks.add(chunkKey);
      }
    }

    // Approximate each player's center from their core chunk set
    const playerCenters: Array<{ x: number; z: number }> = [];
    for (const center of centers) {
      const playerPos = center.position;
      if (playerPos) {
        const tileX = Math.floor(playerPos.x / this.CONFIG.TILE_SIZE);
        const tileZ = Math.floor(playerPos.z / this.CONFIG.TILE_SIZE);
        playerCenters.push({ x: tileX, z: tileZ });
      }
    }

    // Queue missing tiles for smooth generation
    for (const tileKey of neededTiles) {
      if (!this.terrainTiles.has(tileKey)) {
        const [x, z] = tileKey.split("_").map(Number);

        let generateContent = true;

        if (playerCenters.length > 0) {
          let minChebyshev = Infinity;
          for (const c of playerCenters) {
            const d = Math.max(Math.abs(x - c.x), Math.abs(z - c.z));
            if (d < minChebyshev) minChebyshev = d;
          }
          if (minChebyshev > this.ringChunkRange) {
            generateContent = false;
          }
        }

        this.enqueueTileForGeneration(x, z, generateContent);
      }
    }

    // Remove tiles that are no longer needed, with hysteresis padding
    // Approximate each player's center from their core chunk set
    for (const [tileKey, tile] of this.terrainTiles) {
      if (!neededTiles.has(tileKey)) {
        let minChebyshev = Infinity;
        for (const c of playerCenters) {
          const d = Math.max(Math.abs(tile.x - c.x), Math.abs(tile.z - c.z));
          if (d < minChebyshev) minChebyshev = d;
        }
        if (minChebyshev > this.terrainOnlyChunkRange + this.unloadPadding) {
          this.unloadTile(tile);
        }
      }
    }

    // Log simulation status every 10 updates
    if (Math.random() < 0.1) {
      const _totalPlayers = centers.length;
      const _simulatedChunkCount = this.simulatedChunks.size;
      const _loadedChunkCount = this.terrainTiles.size;

      // Simulation status tracked for debugging

      // Log shared world status
      const sharedChunks = Array.from(this.chunkPlayerCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([key, count]) => `${key}(${count})`)
        .join(", ");

      if (sharedChunks) {
        // Multiple players sharing chunks - enhanced simulation active
      }
    }
  }

  /**
   * Perform periodic serialization every 15 minutes
   */
  private performPeriodicSerialization(): void {
    const now = Date.now();

    if (now - this.lastSerializationTime >= this.serializationInterval) {
      this.performImmediateSerialization();
      this.lastSerializationTime = now;
    }
  }

  /**
   * Perform immediate serialization of all world state
   */
  private performImmediateSerialization(): void {
    const startTime = Date.now();
    let _serializedChunks = 0;

    // Serialize all active chunks
    for (const [key, tile] of this.terrainTiles) {
      const serializationData = {
        key: key,
        tileX: tile.x,
        tileZ: tile.z,
        biome: tile.biome,
        heightData: tile.heightData,
        resourceStates: tile.resources.map((r) => ({
          id: r.id,
          type: r.type,
          position: [r.position.x, r.position.y, r.position.z] as [
            number,
            number,
            number,
          ],
        })),
        roadData: tile.roads.map((r) => {
          // Roads use {x, z} format based on generateRoadsForTile implementation
          const startZ = (r.start as { x: number; z: number }).z;
          const endZ = (r.end as { x: number; z: number }).z;
          return {
            start: [r.start.x, startZ] as [number, number],
            end: [r.end.x, endZ] as [number, number],
            width: r.width,
          };
        }),
        playerCount: this.chunkPlayerCounts.get(key) || 0,
        lastActiveTime: tile.lastActiveTime,
        isSimulated: this.simulatedChunks.has(key),
        worldStateVersion: this.worldStateVersion,
        timestamp: Date.now(),
      };

      // Store for database persistence with proper tuple types
      const typedSerializationData = {
        ...serializationData,
        resourceStates: serializationData.resourceStates.map((rs) => ({
          ...rs,
          position: rs.position as [number, number, number],
        })),
        roadData: serializationData.roadData.map((rd) => ({
          ...rd,
          start: rd.start as [number, number],
          end: rd.end as [number, number],
        })),
      };
      this.pendingSerializationData.set(key, typedSerializationData);

      // Save to database if available
      if (this.databaseSystem) {
        const chunkData: WorldChunkData = {
          chunkX: tile.x,
          chunkZ: tile.z,
          data: JSON.stringify({
            biome: tile.biome || "grassland",
            heightData: tile.heightData || [],
            chunkSeed: tile.chunkSeed || 0,
            resourceStates: serializationData.resourceStates,
            roadData: serializationData.roadData,
          }),
          lastActive: tile.lastActiveTime?.getTime() || Date.now(),
          playerCount: this.chunkPlayerCounts.get(key) || 0,
          version: this.worldStateVersion,
        };

        this.databaseSystem.saveWorldChunk(chunkData);
        _serializedChunks++;
      }
    }

    // Cap pendingSerializationData to prevent unbounded memory growth.
    // Evict oldest entries (by insertion order) when over the limit.
    if (
      this.pendingSerializationData.size > MAX_PENDING_SERIALIZATION_ENTRIES
    ) {
      const excess =
        this.pendingSerializationData.size - MAX_PENDING_SERIALIZATION_ENTRIES;
      let evicted = 0;
      for (const evictKey of this.pendingSerializationData.keys()) {
        if (evicted >= excess) break;
        // Only evict tiles that are no longer loaded
        if (!this.terrainTiles.has(evictKey)) {
          this.pendingSerializationData.delete(evictKey);
          evicted++;
        }
      }
    }

    // Increment world state version
    this.worldStateVersion++;

    const _elapsed = Date.now() - startTime;
  }

  /**
   * Verify terrain bounding boxes for size validation
   */
  private verifyTerrainBoundingBoxes(): void {
    let _validBoxes = 0;
    let _invalidBoxes = 0;
    const oversizedTiles: string[] = [];

    for (const [key, tile] of this.terrainTiles) {
      // Calculate bounding box for this tile
      const box = this._tempBox3;

      if (tile.mesh && tile.mesh.geometry) {
        box.setFromObject(tile.mesh);

        // Verify tile is within expected size bounds
        const tempVector = this._tempVec3;
        const size = box.getSize(tempVector);
        const expectedSize = this.CONFIG.TILE_SIZE;

        if (size.x > expectedSize * 1.1 || size.z > expectedSize * 1.1) {
          _invalidBoxes++;
          oversizedTiles.push(key);
        } else {
          _validBoxes++;
        }

        // Store bounding box for future reference
        this.terrainBoundingBoxes.set(key, box.clone());

        // Verify tile is within world bounds
        if (
          box.min.x < this.worldBounds.minX ||
          box.max.x > this.worldBounds.maxX ||
          box.min.z < this.worldBounds.minZ ||
          box.max.z > this.worldBounds.maxZ
        ) {
          // Tile exceeds world bounds - tracked but no logging
        }
      }
    }

    // Verification completed - results available via getChunkSimulationStatus()
  }

  /**
   * Get chunk simulation status for debugging
   */
  getChunkSimulationStatus(): {
    totalChunks: number;
    simulatedChunks: number;
    playerChunks: Map<string, Set<string>>;
    chunkPlayerCounts: Map<string, number>;
    lastSerializationTime: number;
    nextSerializationIn: number;
    worldStateVersion: number;
  } {
    return {
      totalChunks: this.terrainTiles.size,
      simulatedChunks: this.simulatedChunks.size,
      playerChunks: new Map(this.playerChunks),
      chunkPlayerCounts: new Map(this.chunkPlayerCounts),
      lastSerializationTime: this.lastSerializationTime,
      nextSerializationIn:
        this.serializationInterval - (Date.now() - this.lastSerializationTime),
      worldStateVersion: this.worldStateVersion,
    };
  }

  /**
   * Check if a chunk is being simulated
   */
  isChunkSimulated(chunkX: number, chunkZ: number): boolean {
    const key = `${chunkX}_${chunkZ}`;
    return this.simulatedChunks.has(key);
  }

  /**
   * Get players in a specific chunk
   */
  getPlayersInChunk(chunkX: number, chunkZ: number): string[] {
    const key = `${chunkX}_${chunkZ}`;
    const playersInChunk: string[] = [];

    for (const [playerId, chunks] of this.playerChunks) {
      if (chunks.has(key)) {
        playersInChunk.push(playerId);
      }
    }

    return playersInChunk;
  }

  /**
   * Force immediate serialization (for testing/admin commands)
   */
  forceSerialization(): void {
    this.performImmediateSerialization();
  }

  public getTiles(): Map<string, TerrainTile> {
    return this.terrainTiles;
  }

  /**
   * Checks if the physics mesh for a specific world coordinate is ready.
   * @param worldX The world X coordinate.
   * @param worldZ The world Z coordinate.
   * @returns True if the physics mesh for the containing tile exists.
   */
  public isPhysicsReadyAt(worldX: number, worldZ: number): boolean {
    const tileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
    const tileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);
    const key = `${tileX}_${tileZ}`;

    const tile = this.terrainTiles.get(key);
    if (!this.serverMeshCollisionEnabled) {
      return !!tile;
    }
    return !!(tile && (tile.collision as PMeshHandle | null));
  }

  /**
   * Check if terrain system is ready for players to spawn
   */
  public isReady(): boolean {
    return this._initialTilesReady && this.noise !== undefined;
  }

  public getTileSize(): number {
    return this.CONFIG.TILE_SIZE;
  }

  /**
   * Get biome data by ID - used by VegetationSystem to get vegetation config
   */
  public getBiomeData(biomeId: string): (typeof BIOMES)[string] | null {
    return BIOMES[biomeId] ?? null;
  }

  /**
   * Handle preference changes - specifically water reflections
   */
  private onPrefsChange = (changes: {
    waterReflections?: { value: boolean };
  }) => {
    if (changes.waterReflections && this.waterSystem) {
      this.waterSystem.setReflectionsEnabled(changes.waterReflections.value);
    }
  };

  // ============================================================================
  // DEBUG / DEVELOPMENT METHODS
  // ============================================================================

  /**
   * Force refresh road influence on all loaded terrain tiles.
   * Call this from the browser console if roads aren't visible:
   *   world.getSystem('terrain').forceRefreshRoads()
   *
   * This recalculates road influence for every vertex in every loaded tile,
   * which should make roads visible if the road data exists.
   */
  public async forceRefreshRoads(): Promise<void> {
    console.log(
      "[TerrainSystem] Force refreshing road influence on all tiles...",
    );

    // Ensure road system reference is current
    this.roadNetworkSystem = this.world.getSystem("roads") as
      | RoadNetworkSystem
      | undefined;

    if (!this.roadNetworkSystem) {
      console.error("[TerrainSystem] Road system not found!");
      return;
    }

    const roads = this.roadNetworkSystem.getRoads();
    console.log(`[TerrainSystem] Road system has ${roads.length} roads`);

    // Clear the logged tiles set to see fresh logs
    this._loggedTileSegments.clear();

    // Force refresh
    await this.refreshRoadInfluence();

    console.log(
      "[TerrainSystem] Road refresh complete. If roads are still not visible:",
    );
    console.log("  1. Check that tiles have road segments (see logs above)");
    console.log(
      "  2. Try regenerating tiles: world.getSystem('terrain').regenerateAllTiles()",
    );
  }

  /**
   * Regenerate all loaded terrain tiles from scratch.
   * This is more aggressive than forceRefreshRoads() - it completely
   * recreates the geometry including road influence calculation.
   *
   * Call from console: world.getSystem('terrain').regenerateAllTiles()
   */
  public async regenerateAllTiles(): Promise<void> {
    console.log("[TerrainSystem] Regenerating all terrain tiles...");

    // Ensure road system reference is current
    this.roadNetworkSystem = this.world.getSystem("roads") as
      | RoadNetworkSystem
      | undefined;

    // Clear the logged tiles set to see fresh logs
    this._loggedTileSegments.clear();

    const tiles = Array.from(this.terrainTiles.entries());
    console.log(`[TerrainSystem] Regenerating ${tiles.length} tiles...`);

    for (const [key, tile] of tiles) {
      // Remove old mesh from scene
      if (tile.mesh && this.terrainContainer) {
        this.terrainContainer.remove(tile.mesh);
        tile.mesh.geometry.dispose();
      }

      // Remove from tiles map
      this.terrainTiles.delete(key);
    }

    // Regenerate tiles
    const tileCoords = tiles.map(([key]) => {
      const [x, z] = key.split("_").map(Number);
      return { x, z };
    });

    for (const { x, z } of tileCoords) {
      this.generateTile(x, z);
    }

    console.log(`[TerrainSystem] Regenerated ${tileCoords.length} tiles`);
  }

  /**
   * Debug: Get road influence at a specific world position
   * Call from console: world.getSystem('terrain').debugRoadInfluenceAt(x, z)
   */
  public debugRoadInfluenceAt(worldX: number, worldZ: number): void {
    // Road tile coordinates (road system uses origin-based tiles)
    const roadTileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
    const roadTileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);

    const terrainTileX = this.worldToTerrainTileIndex(worldX);
    const terrainTileZ = this.worldToTerrainTileIndex(worldZ);

    console.log(
      `[TerrainSystem] Debug road influence at (${worldX}, ${worldZ}):`,
    );
    console.log(`  Road tile: (${roadTileX}, ${roadTileZ})`);
    console.log(`  Terrain tile: (${terrainTileX}, ${terrainTileZ})`);

    // Check road system
    this.roadNetworkSystem ??= this.world.getSystem("roads") as
      | RoadNetworkSystem
      | undefined;

    if (!this.roadNetworkSystem) {
      console.log("  Road system: NOT FOUND");
      return;
    }

    const segments = this.roadNetworkSystem.getRoadSegmentsForTile(
      roadTileX,
      roadTileZ,
    );
    console.log(
      `  Road segments in road tile (${roadTileX}, ${roadTileZ}): ${segments.length}`,
    );

    if (segments.length > 0) {
      // Calculate influence
      const influence = this.calculateRoadInfluenceAtVertex(
        worldX,
        worldZ,
        terrainTileX,
        terrainTileZ,
      );
      console.log(`  Calculated road influence: ${influence.toFixed(4)}`);

      // Show nearest segment - use road-tile-local coordinates
      const localX = worldX - roadTileX * this.CONFIG.TILE_SIZE;
      const localZ = worldZ - roadTileZ * this.CONFIG.TILE_SIZE;
      let minDist = Infinity;
      let nearestSeg: RoadTileSegment | null = null;
      for (const seg of segments) {
        const dist = this.distanceToLineSegmentLocal(
          localX,
          localZ,
          seg.start.x,
          seg.start.z,
          seg.end.x,
          seg.end.z,
        );
        if (dist < minDist) {
          minDist = dist;
          nearestSeg = seg;
        }
      }
      console.log(`  Distance to nearest road segment: ${minDist.toFixed(2)}m`);
      if (nearestSeg) {
        console.log(
          `  Nearest segment: (${nearestSeg.start.x.toFixed(1)}, ${nearestSeg.start.z.toFixed(1)}) -> (${nearestSeg.end.x.toFixed(1)}, ${nearestSeg.end.z.toFixed(1)}), width=${nearestSeg.width}`,
        );
      }
    }

    // Check if terrain tile exists and has roadInfluence attribute
    const tileKey = `${terrainTileX}_${terrainTileZ}`;
    const tile = this.terrainTiles.get(tileKey);
    if (tile?.mesh) {
      const geometry = (tile.mesh as THREE.Mesh)
        .geometry as THREE.BufferGeometry;
      const roadAttr = geometry.getAttribute("roadInfluence");
      if (roadAttr) {
        const arr = roadAttr.array as Float32Array;
        let nonZero = 0;
        let maxVal = 0;
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] > 0) nonZero++;
          maxVal = Math.max(maxVal, arr[i]);
        }
        console.log(
          `  Tile roadInfluence attribute: ${nonZero}/${arr.length} non-zero, max=${maxVal.toFixed(4)}`,
        );
      } else {
        console.log(`  Tile roadInfluence attribute: NOT FOUND`);
      }
    } else {
      console.log(`  Terrain tile mesh: NOT LOADED (key: ${tileKey})`);
    }
  }
}
