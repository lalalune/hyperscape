import type { World } from "../types";
import type { WorldChunkData } from "../types/database";
import { geometryToPxMesh, PMeshHandle } from "../extras/geometryToPxMesh";
import THREE from "../extras/three";
import { System } from "./System";
import { EventType } from "../types/events";
import { NoiseGenerator } from "../utils/NoiseGenerator";
import { InstancedMeshManager } from "../utils/InstancedMeshManager";
import { TextureAtlasManager } from "../utils/TextureAtlasManager";
import { TriplanarTerrainMaterial } from "../materials/TriplanarTerrainMaterial";
import { TerrainLODManager } from "./TerrainLODManager";

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

import type { BiomeData } from "../types/core";
import type { Heightfield, ResourceNode, TerrainTile } from "../types/terrain";
import { PhysicsHandle } from "../types/physics";
import { getPhysX } from "../PhysXManager";
import { Layers } from "../extras/Layers";
import { BIOMES } from "../data/world-structure";
import { GrassSystem } from "./GrassSystem";
import { WaterSystem } from "./WaterSystem";
import type { DatabaseSystem } from "../types/system-interfaces";

interface BiomeCenter {
  x: number;
  z: number;
  type: string;
  influence: number;
}

export class TerrainSystem extends System {
  private terrainTiles = new Map<string, TerrainTile>();
  private terrainContainer!: THREE.Group;
  public instancedMeshManager!: InstancedMeshManager;
  private _terrainInitialized = false;
  private _initialTilesReady = false; // Track when initial tiles are loaded
  private lastPlayerTile = { x: 0, z: 0 };
  private noise!: NoiseGenerator;
  private biomeCenters: BiomeCenter[] = [];
  private databaseSystem!: DatabaseSystem; // DatabaseSystem reference
  private chunkSaveInterval?: NodeJS.Timeout;
  private terrainUpdateIntervalId?: NodeJS.Timeout;
  private serializationIntervalId?: NodeJS.Timeout;
  private boundingBoxIntervalId?: NodeJS.Timeout;
  private activeChunks = new Set<string>();

  // Chunk tracking for multiplayer and serialization
  private playerChunks = new Map<string, Set<string>>(); // player -> chunk keys
  private simulatedChunks = new Set<string>(); // chunks with active simulation
  private isGenerating = false; // Track if terrain generation is in progress
  private chunkPlayerCounts = new Map<string, number>(); // chunk -> player count
  // Smooth generation queue to avoid main-thread spikes when player moves
  private pendingTileKeys: Array<{
    key: string;
    tileX: number;
    tileZ: number;
    lod: number;
    lodArray: [number, number];
  }> = [];
  private pendingTileSet = new Set<string>();
  private pendingCollisionKeys: string[] = [];
  private pendingCollisionSet = new Set<string>();
  private maxTilesPerFrame = 2; // cap tiles generated per frame
  private generationBudgetMsPerFrame = 6; // time budget per frame (ms)
  private _tempVec3 = new THREE.Vector3();
  private _tempVec3_2 = new THREE.Vector3();
  private _tempVec2 = new THREE.Vector2();
  private _tempVec2_2 = new THREE.Vector2();
  private _tempBox3 = new THREE.Box3();
  private grassSystem?: GrassSystem;
  private waterSystem?: WaterSystem;
  private textureAtlasManager!: TextureAtlasManager;
  private terrainMaterial!: TriplanarTerrainMaterial;
  private lodManager!: TerrainLODManager;

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

  /**
   * Queue a tile for generation if not already queued or present
   */
  private enqueueTileForGeneration(
    tileX: number,
    tileZ: number,
    lod: number,
    lodArray: [number, number],
  ): void {
    const key = `${tileX}_${tileZ}_${lod}`;
    if (this.terrainTiles.has(key) || this.pendingTileSet.has(key)) return;

    this.pendingTileSet.add(key);
    this.pendingTileKeys.push({ key, tileX, tileZ, lod, lodArray });
  }

  /**
   * Process queued tile generations within per-frame time and count budgets
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
      const tileData = this.pendingTileKeys.shift()!;
      this.pendingTileSet.delete(tileData.key);

      this.generateTile(
        tileData.tileX,
        tileData.tileZ,
        true,
        tileData.lod,
        tileData.lodArray,
      );
      generated++;
    }
  }

  private processCollisionGenerationQueue(): void {
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

  private initializeBiomeCenters(): void {
    const worldSize = this.CONFIG.WORLD_SIZE * this.CONFIG.TILE_SIZE; // 10km x 10km
    const numCenters = Math.floor((worldSize * worldSize) / 1000000); // Roughly 100 centers for 10km x 10km

    // Use deterministic PRNG for reproducible biome placement
    const baseSeed = this.computeSeedFromWorldId();
    let randomState = baseSeed;

    const nextRandom = () => {
      // Linear congruential generator for deterministic random
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 0xffffffff;
    };

    const biomeTypes = [
      "plains",
      "forest",
      "valley",
      "mountains",
      "tundra",
      "desert",
      "lakes",
      "swamp",
    ];

    // Clear any existing centers
    this.biomeCenters = [];

    for (let i = 0; i < numCenters; i++) {
      const x = (nextRandom() - 0.5) * worldSize;
      const z = (nextRandom() - 0.5) * worldSize;
      const typeIndex = Math.floor(nextRandom() * biomeTypes.length);
      const influence = 200 + nextRandom() * 400; // 200-600m influence radius

      this.biomeCenters.push({
        x,
        z,
        type: biomeTypes[typeIndex],
        influence,
      });
    }
  }

  // World Configuration - Your Specifications
  private readonly CONFIG = {
    // Core World Specs
    TILE_SIZE: 100, // 100m x 100m tiles
    WORLD_SIZE: 100, // 100x100 grid = 10km x 10km world
    TILE_RESOLUTION: 64, // 64x64 vertices per tile for smooth terrain
    MAX_HEIGHT: 80, // 80m max height variation
    WATER_THRESHOLD: 14.4, // Water appears below 14.4m (0.18 * MAX_HEIGHT)

    // Chunking - Only adjacent tiles
    VIEW_DISTANCE: 1, // Load only 1 tile in each direction (3x3 = 9 tiles)
    UPDATE_INTERVAL: 0.5, // Check player movement every 0.5 seconds

    // Movement Constraints
    WATER_IMPASSABLE: true, // Water blocks movement
    MAX_WALKABLE_SLOPE: 0.7, // Maximum slope for movement (tan of angle)
    SLOPE_CHECK_DISTANCE: 1, // Distance to check for slope calculation

    // Features
    ROAD_WIDTH: 4, // 4m wide roads
    RESOURCE_DENSITY: 0.15, // 15% chance per area for resources (increased for more resources)
    TREE_DENSITY: 0.25, // 25% chance for trees in forest biomes (increased for visibility)
    TOWN_RADIUS: 25, // Safe radius around towns
  };

  // Biomes now loaded from assets/manifests/biomes.json via DataManager
  // Uses imported BIOMES from world-structure.ts
  // No hardcoded biome data - all definitions in JSON!

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    // Initialize tile size
    this.tileSize = this.CONFIG.TILE_SIZE;

    // Initialize deterministic noise from world id
    this.noise = new NoiseGenerator(this.computeSeedFromWorldId());

    // Initialize biome centers using deterministic random placement
    this.initializeBiomeCenters();

    // Initialize texture atlas manager on client
    if (this.world.isClient) {
      console.log("[TerrainSystem] Initializing texture atlas on client...");
      this.textureAtlasManager = new TextureAtlasManager();
      await this.textureAtlasManager.init();
      console.log("[TerrainSystem] Texture atlas initialized");

      const cdnUrl =
        typeof window !== "undefined"
          ? (window as any).__CDN_URL || "http://localhost:8088"
          : "http://localhost:8088";

      const noiseTexture = await new THREE.TextureLoader().loadAsync(
        `${cdnUrl}/noise/simplex-noise.png`,
      );
      noiseTexture.wrapS = THREE.RepeatWrapping;
      noiseTexture.wrapT = THREE.RepeatWrapping;

      this.terrainMaterial = new TriplanarTerrainMaterial(
        this.textureAtlasManager.getAtlas()!,
        this.textureAtlasManager.getNormalAtlas()!,
        noiseTexture,
        this.textureAtlasManager.getMaterialScales(),
      );
      console.log("[TerrainSystem] Triplanar material created successfully");
    }

    // Initialize grass and water systems
    this.grassSystem = new GrassSystem(this.world);
    await this.grassSystem.init();
    this.waterSystem = new WaterSystem(this.world);
    await this.waterSystem.init();

    // Get systems references
    this.databaseSystem = this.world.getSystem("database") as DatabaseSystem;

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

    // Final environment detection - use world.isServer/isClient (which check network internally)
    const isServer = this.world.isServer;
    const isClient = this.world.isClient;

    if (isClient) {
      await this.setupClientTerrain();
    } else if (isServer) {
      this.setupServerTerrain();
    } else {
      // Should never happen since isClient defaults to true if network not set
      console.error(
        "[TerrainSystem] Neither client nor server detected - this should not happen!",
      );
      console.error("[TerrainSystem] world.network:", this.world.network);
      console.error("[TerrainSystem] world.isClient:", this.world.isClient);
      console.error("[TerrainSystem] world.isServer:", this.world.isServer);
      // Default to client mode to avoid blocking
      await this.setupClientTerrain();
    }

    // Start player-based terrain update loop (this will load initial tiles via LOD)
    this.terrainUpdateIntervalId = setInterval(() => {
      this.updateLODBasedTerrain();
    }, 500); // Update twice per second

    // Force immediate LOD update to load initial tiles
    if (this.world.isClient && this.lodManager) {
      setTimeout(() => {
        this.updateLODBasedTerrain();
      }, 100);
    }

    // Start serialization loop
    this.serializationIntervalId = setInterval(() => {
      this.performPeriodicSerialization();
    }, 60000); // Check every minute

    // Start bounding box verification
    this.boundingBoxIntervalId = setInterval(() => {
      this.verifyTerrainBoundingBoxes();
    }, 30000); // Verify every 30 seconds
  }

  private async setupClientTerrain(): Promise<void> {
    const stage = this.world.stage as { scene: THREE.Scene };
    const scene = stage.scene;

    // Create terrain container
    this.terrainContainer = new THREE.Group();
    this.terrainContainer.name = "TerrainContainer";
    scene.add(this.terrainContainer);

    // Initialize InstancedMeshManager
    this.instancedMeshManager = new InstancedMeshManager(scene, this.world);
    await this.registerInstancedMeshes();

    // Setup initial camera only if no client camera system controls it
    // Leave control to ClientCameraSystem for third-person follow

    // Initial tiles will be loaded in start() method

    this.lodManager = new TerrainLODManager(this);
  }

  private async registerInstancedMeshes(): Promise<void> {
    const extractGeometryAndMaterial = (
      obj: THREE.Object3D,
    ): { geometry: THREE.BufferGeometry; material: THREE.Material } | null => {
      let mesh: THREE.Mesh | null = null;

      obj.traverse((child) => {
        if (!mesh && child instanceof THREE.Mesh && child.geometry) {
          mesh = child;
        }
      });

      if (mesh?.geometry) {
        return {
          geometry: mesh.geometry.clone(),
          material:
            mesh.material instanceof THREE.Material
              ? mesh.material.clone()
              : new THREE.MeshStandardMaterial(),
        };
      }
      return null;
    };

    const loadModelFromNodes = async (
      path: string,
    ): Promise<THREE.Object3D | null> => {
      try {
        const loadedModel = (await this.world.loader.load("model", path)) as {
          toNodes: () => Map<string, THREE.Object3D>;
        };
        if (!loadedModel || !loadedModel.toNodes) {
          console.warn(
            `[TerrainSystem] Loaded model from ${path} doesn't have toNodes method`,
          );
          return null;
        }

        const nodeMap = loadedModel.toNodes();
        const rootNode = nodeMap.get("root");

        if (!rootNode || !(rootNode instanceof THREE.Object3D)) {
          console.warn(`[TerrainSystem] No valid root node found in ${path}`);
          return null;
        }

        return rootNode;
      } catch (e) {
        console.warn(`[TerrainSystem] Failed to load model from ${path}:`, e);
        return null;
      }
    };

    // Load jungle tree model (medium variant - most common)
    try {
      const treeModel = await loadModelFromNodes(
        "asset://vegetation/jungle-trees/jungle_tree_1.glb",
      );
      if (treeModel) {
        const extracted = extractGeometryAndMaterial(treeModel);
        if (extracted) {
          this.instancedMeshManager.registerMesh(
            "tree",
            extracted.geometry,
            extracted.material,
            2000,
          );
          console.log("[TerrainSystem] Registered jungle tree mesh from GLB");
        } else {
          throw new Error("No mesh found in tree model");
        }
      } else {
        throw new Error("Failed to load tree model nodes");
      }
    } catch (e) {
      console.warn(
        "[TerrainSystem] Failed to load tree model, using placeholder:",
        e,
      );
      const treeGeometry = new THREE.BoxGeometry(1.2, 3.0, 1.2);
      const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x2f7d32 });
      this.instancedMeshManager.registerMesh(
        "tree",
        treeGeometry,
        treeMaterial,
        2000,
      );
    }

    // Load big rock model
    try {
      const rockModel = await loadModelFromNodes(
        "asset://rocks/big_rock_v2.glb",
      );
      if (rockModel) {
        const extracted = extractGeometryAndMaterial(rockModel);
        if (extracted) {
          this.instancedMeshManager.registerMesh(
            "rock",
            extracted.geometry,
            extracted.material,
            1000,
          );
          this.instancedMeshManager.registerMesh(
            "ore",
            extracted.geometry,
            extracted.material,
            500,
          );
          this.instancedMeshManager.registerMesh(
            "rare_ore",
            extracted.geometry,
            extracted.material,
            200,
          );
          console.log("[TerrainSystem] Registered big rock mesh from GLB");
        } else {
          throw new Error("No mesh found in rock model");
        }
      } else {
        throw new Error("Failed to load rock model nodes");
      }
    } catch (e) {
      console.warn(
        "[TerrainSystem] Failed to load rock model, using placeholder:",
        e,
      );
      const rockGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
      const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
      this.instancedMeshManager.registerMesh(
        "rock",
        rockGeometry,
        rockMaterial,
        1000,
      );
      this.instancedMeshManager.registerMesh(
        "ore",
        rockGeometry,
        rockMaterial,
        500,
      );
      this.instancedMeshManager.registerMesh(
        "rare_ore",
        rockGeometry,
        rockMaterial,
        200,
      );
    }

    // Register herb/bush mesh
    try {
      const bushModel = await loadModelFromNodes(
        "asset://vegetation/bushes/bush_1.glb",
      );
      if (bushModel) {
        const extracted = extractGeometryAndMaterial(bushModel);
        if (extracted) {
          this.instancedMeshManager.registerMesh(
            "herb",
            extracted.geometry,
            extracted.material,
            800,
          );
          console.log("[TerrainSystem] Registered herb mesh from GLB");
        } else {
          throw new Error("No mesh found in bush model");
        }
      } else {
        throw new Error("Failed to load bush model nodes");
      }
    } catch (e) {
      console.warn(
        "[TerrainSystem] Failed to load bush model, using placeholder:",
        e,
      );
      const herbGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.6);
      const herbMaterial = new THREE.MeshLambertMaterial({ color: 0x66bb6a });
      this.instancedMeshManager.registerMesh(
        "herb",
        herbGeometry,
        herbMaterial,
        800,
      );
    }

    // Load medium rock for stones (smaller rocks around big rocks)
    try {
      const stoneModel = await loadModelFromNodes(
        "asset://rocks/med_rock_v2.glb",
      );
      if (stoneModel) {
        const extracted = extractGeometryAndMaterial(stoneModel);
        if (extracted) {
          this.instancedMeshManager.registerMesh(
            "stone",
            extracted.geometry,
            extracted.material,
            1000,
          );
          console.log("[TerrainSystem] Registered stone mesh from GLB");
        } else {
          throw new Error("No mesh found in stone model");
        }
      } else {
        throw new Error("Failed to load stone model nodes");
      }
    } catch (e) {
      console.warn(
        "[TerrainSystem] Failed to load stone model, using placeholder:",
        e,
      );
      const stoneGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x999999 });
      this.instancedMeshManager.registerMesh(
        "stone",
        stoneGeometry,
        stoneMaterial,
        1000,
      );
    }

    // Register fish mesh
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
  }

  private setupServerTerrain(): void {
    // Setup chunk save interval for persistence
    if (this.databaseSystem) {
      this.chunkSaveInterval = setInterval(() => {
        this.saveModifiedChunks();
      }, 30000); // Save every 30 seconds
    }

    // Load initial tiles so terrain system becomes ready
    this.loadInitialTiles();
  }

  private loadInitialTiles(): void {
    const _startTime = performance.now();
    let _tilesGenerated = 0;
    let minHeight = Infinity;
    let maxHeight = -Infinity;

    // Generate initial 3x3 grid around origin
    const initialRange = 1;
    for (let dx = -initialRange; dx <= initialRange; dx++) {
      for (let dz = -initialRange; dz <= initialRange; dz++) {
        const tile = this.generateTile(dx, dz);
        _tilesGenerated++;

        // Sample heights to check variation
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

    const _endTime = performance.now();

    // Mark initial tiles as ready
    this._initialTilesReady = true;
  }

  private generateTile(
    tileX: number,
    tileZ: number,
    generateContent = true,
    lod = 1,
    lodArray: [number, number] = [1, 1],
  ): TerrainTile {
    const key = `${tileX}_${tileZ}_${lod}`;

    // Check if tile already exists
    if (this.terrainTiles.has(key)) {
      return this.terrainTiles.get(key)!;
    }

    // Check if ANY tile exists at this position (different LOD)
    const existingAtPosition = Array.from(this.terrainTiles.values()).find(
      (t) => t.x === tileX && t.z === tileZ,
    );

    if (existingAtPosition) {
      console.log(
        `[TerrainSystem] Tile already exists at ${tileX},${tileZ} with key ${existingAtPosition.key}, skipping new tile ${key}`,
      );
      return existingAtPosition;
    }

    // Create geometry for this tile
    const geometry = this.createTileGeometry(tileX, tileZ, lod, lodArray);

    // Create material (client only)
    let material: THREE.Material;
    if (
      this.world.isClient &&
      this.textureAtlasManager &&
      this.terrainMaterial
    ) {
      const noiseTexture = (this.terrainMaterial as THREE.ShaderMaterial)
        .uniforms.uNoiseTexture.value;
      material = new TriplanarTerrainMaterial(
        this.textureAtlasManager.getAtlas()!,
        this.textureAtlasManager.getNormalAtlas()!,
        noiseTexture,
        this.textureAtlasManager.getMaterialScales(),
      );
    } else {
      // Fallback - use visible green material for debugging
      console.warn(
        "[TerrainSystem] Using fallback material - textures not loaded. isClient:",
        this.world.isClient,
        "hasAtlas:",
        !!this.textureAtlasManager,
        "hasMaterial:",
        !!this.terrainMaterial,
      );
      material = new THREE.MeshStandardMaterial({
        color: 0x228b22,
        wireframe: false,
        side: THREE.DoubleSide,
      });
    }

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      tileX * this.CONFIG.TILE_SIZE,
      0,
      tileZ * this.CONFIG.TILE_SIZE,
    );
    mesh.name = `Terrain_${key}`;
    mesh.visible = true;
    mesh.frustumCulled = false; // Always render terrain

    // Enable shadow receiving for CSM
    mesh.receiveShadow = true;
    mesh.castShadow = false; // Terrain doesn't cast shadows on itself

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

    // Generate collision only on server to avoid client-side heavy work
    const collision: PMeshHandle | null = null;
    const isServer = this.world.network?.isServer || false;
    if (isServer) {
      // Use full key with LOD to match terrainTiles Map
      if (!this.pendingCollisionSet.has(key)) {
        this.pendingCollisionSet.add(key);
        this.pendingCollisionKeys.push(key);
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

    // Add simple physics plane for the terrain tile (for raycasting)
    // Create on both client and server for click-to-move raycasting
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

    // Add to scene if client-side
    if (this.terrainContainer) {
      // Check if another tile already exists at this exact position
      const existingAtPosition = Array.from(this.terrainTiles.values()).find(
        (t) =>
          t.key !== key &&
          t.mesh.position.x === mesh.position.x &&
          t.mesh.position.z === mesh.position.z,
      );

      if (existingAtPosition) {
        console.warn("[TerrainSystem] Duplicate tile detected!", {
          newKey: key,
          existingKey: existingAtPosition.key,
          position: mesh.position,
        });
        // Don't add duplicate
        return tile;
      }

      this.terrainContainer.add(mesh);
      console.log("[TerrainSystem] Added terrain mesh to scene:", {
        key,
        position: mesh.position,
        totalTilesInScene: this.terrainContainer.children.length,
      });
    }

    if (generateContent) {
      const isServer = this.world.network?.isServer || false;
      const isClient = this.world.network?.isClient || false;

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

        // Generate grass for this tile
        this.generateGrassForTile(tile, BIOMES[tile.biome]);

        // Add visible resource meshes (instanced proxies) on client
        if (tile.resources.length > 0 && tile.mesh) {
          for (const resource of tile.resources) {
            if (resource.instanceId != null) continue;

            const worldPosition = new THREE.Vector3(
              tile.x * this.CONFIG.TILE_SIZE + resource.position.x,
              resource.position.y,
              tile.z * this.CONFIG.TILE_SIZE + resource.position.z,
            );

            const instanceId = this.instancedMeshManager.addInstance(
              resource.type,
              resource.id,
              worldPosition,
              resource.rotation,
              resource.scale,
            );

            if (instanceId !== null) {
              resource.instanceId = instanceId;
              resource.meshType = resource.type;

              // Emit resource created event for InteractionSystem registration
              // For instanced resources, we pass the instanceId instead of a mesh
              this.world.emit(EventType.RESOURCE_MESH_CREATED, {
                mesh: undefined,
                instanceId: instanceId,
                resourceId: resource.id,
                resourceType: resource.type,
                worldPosition: {
                  x: worldPosition.x,
                  y: worldPosition.y,
                  z: worldPosition.z,
                },
              });
            }
          }
        }

        // Force immediate visibility update for this tile's resources
        if (tile.resources.length > 0) {
          this.instancedMeshManager.updateAllInstanceVisibility(true);
          console.log(
            `[TerrainSystem] Forced visibility update after adding ${tile.resources.length} resources`,
          );
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
          subType: r.type === "tree" ? "normal_tree" : r.type,
          position: worldPos,
        };
      });
      this.world.emit(EventType.RESOURCE_SPAWN_POINTS_REGISTERED, {
        spawnPoints,
      });
    } else if (
      tile.resources.length > 0 &&
      this.world.network?.isClient &&
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
          subType: r.type === "tree" ? "normal_tree" : r.type,
          position: worldPos,
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

  private createTileGeometry(
    tileX: number,
    tileZ: number,
    lod = 1,
    _lodArray: [number, number] = [1, 1],
  ): THREE.PlaneGeometry {
    const baseResolution = this.CONFIG.TILE_RESOLUTION;
    const lodScale = 2 ** (lod - 1);
    const resolution = Math.max(2, Math.floor(baseResolution / lodScale));

    const geometry = new THREE.PlaneGeometry(
      this.CONFIG.TILE_SIZE * lodScale,
      this.CONFIG.TILE_SIZE * lodScale,
      resolution - 1,
      resolution - 1,
    );

    // Rotate to be horizontal
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const vertexCount = positions.count;

    // Store heightfields for this tile
    const heightfields: Heightfield[] = [];
    const materials = new Int32Array(vertexCount * 4);
    const materialsWeights = new Float32Array(vertexCount * 4);

    // Generate heightmap and vertex colors
    for (let i = 0; i < vertexCount; i++) {
      const localX = positions.getX(i);
      const localZ = positions.getZ(i);

      // Calculate world coordinates
      const x = localX + tileX * this.CONFIG.TILE_SIZE;
      const z = localZ + tileZ * this.CONFIG.TILE_SIZE;

      // Generate complete heightfield
      const heightfield = this.generateHeightfield(x, z);
      heightfields.push(heightfield);

      // Set height
      positions.setY(i, heightfield.height);

      // Set materials
      for (let j = 0; j < 4; j++) {
        materials[i * 4 + j] = heightfield.materials[j];
        materialsWeights[i * 4 + j] = heightfield.materialsWeights[j];
      }
    }

    // Add custom attributes (Int32 for materials, Float32 for weights)
    geometry.setAttribute(
      "materials",
      new THREE.Int32BufferAttribute(materials, 4),
    );
    geometry.setAttribute(
      "materialsWeights",
      new THREE.Float32BufferAttribute(materialsWeights, 4),
    );

    geometry.computeVertexNormals();

    // Store heightfields for instance generation
    (
      geometry as THREE.BufferGeometry & { heightfields: Heightfield[] }
    ).heightfields = heightfields;

    return geometry;
  }

  private generateHeightfield(worldX: number, worldZ: number): Heightfield {
    // 1. Calculate height using improved noise
    const height = this.getHeightAt(worldX, worldZ);

    // 2. Determine biome influences
    const _temp = this.noise.temperatureNoise(worldX, worldZ);
    const _humidity = this.noise.humidityNoise(worldX, worldZ);
    // TODO: Implement getBiomeFromTempHumidity
    const biome = this.getBiomeAtWorldPosition(worldX, worldZ);

    // 3. Calculate liquid
    const oceanValue = this.noise.oceanNoise(worldX, worldZ);
    const riverValue = this.noise.riverNoise(worldX, worldZ, oceanValue);
    // TODO: Implement determineLiquidType and calculateLiquidHeight
    const liquidType =
      height < this.CONFIG.WATER_THRESHOLD
        ? oceanValue > 0.5
          ? "ocean"
          : riverValue > 0.7
            ? "river"
            : "none"
        : "none";
    const liquidHeight =
      liquidType !== "none" ? this.CONFIG.WATER_THRESHOLD : 0;

    // 4. Calculate slope and normal
    const slope = this.calculateSlope(worldX, worldZ);
    const normal = this.getNormalAt(worldX, worldZ);

    // 5. Determine materials based on height, slope, biome
    const materials = this.calculateMaterials(
      height,
      slope,
      biome,
      liquidType,
      worldX,
      worldZ,
    );

    // 6. Calculate instance visibility
    const wetness = this.noise.wetnessNoise(worldX, worldZ);
    const heightfield: Heightfield = {
      height,
      liquidHeight,
      biome,
      liquidType,
      slope,
      normal: { x: normal.x, y: normal.y, z: normal.z },
      materials: materials.indices,
      materialsWeights: materials.weights,
      hash: this.noise.hashNoise(worldX, worldZ),
      wetness,
      treeVisibility: this.noise.treeVisibility(worldX, worldZ, wetness),
      rockVisibility: this.noise.rockVisibility(worldX, worldZ),
      stoneVisibility: this.noise.stoneVisibility(worldX, worldZ),
      grassVisibility: this.noise.grassVisibility(worldX, worldZ, wetness),
      flowerVisibility: 0, // Calculated after grass
      flowDirection:
        liquidType !== "none" ? this.noise.flowNoise(worldX, worldZ) : 0,
    };

    // Flowers only where grass exists
    if (heightfield.grassVisibility > 0) {
      heightfield.flowerVisibility = this.noise.flowerVisibility(
        worldX,
        worldZ,
        heightfield.grassVisibility,
      );
    }

    return heightfield;
  }

  private calculateMaterials(
    height: number,
    slope: number,
    _biome: string,
    liquidType: string,
    worldX: number,
    worldZ: number,
  ): {
    indices: [number, number, number, number];
    weights: [number, number, number, number];
  } {
    const materials = [0, 0, 0, 0];
    const weights = [0, 0, 0, 0];

    // Water gets no materials
    if (liquidType !== "none") {
      materials[0] = 1; // Dirt/sand under water
      weights[0] = 1.0;
      return {
        indices: materials as [number, number, number, number],
        weights: weights as [number, number, number, number],
      };
    }

    // Add noise variation for more natural blending
    const detailNoise = this.noise.simplex2D(worldX * 0.05, worldZ * 0.05);
    const adjustedHeight = height + detailNoise * 2.0;
    const adjustedSlope = slope + detailNoise * 0.05;

    // Material 0: Grass (low elevation, flat)
    let grassWeight = 1.0 - Math.min(1.0, adjustedHeight / 15.0);
    grassWeight *= 1.0 - Math.min(1.0, adjustedSlope / 0.5);
    grassWeight = Math.max(0, grassWeight);

    // Material 1: Dirt (mid elevation)
    let dirtWeight = 1.0 - Math.abs(adjustedHeight - 8.0) / 10.0;
    dirtWeight = Math.max(0, Math.min(1.0, dirtWeight));

    // Material 2: Rock (steep slopes or high elevation)
    let rockWeight = Math.max(
      adjustedSlope / 0.6,
      Math.max(0, (adjustedHeight - 12.0) / 8.0),
    );
    rockWeight = Math.min(1.0, rockWeight);

    // Material 3: Snow (very high elevation)
    let snowWeight = Math.max(0, (adjustedHeight - 18.0) / 10.0);
    snowWeight = Math.min(1.0, snowWeight);

    // Store weights
    weights[0] = grassWeight;
    weights[1] = dirtWeight;
    weights[2] = rockWeight;
    weights[3] = snowWeight;

    // Add roads - blend in more dirt
    const pathNoise = this.noise.simplex2D(worldX * 0.002, worldZ * 0.002);
    const pathInfluence = Math.pow(
      Math.max(0, 1.0 - Math.abs(pathNoise) * 4),
      3,
    );

    if (pathInfluence > 0.3) {
      // Blend dirt into the mix for roads
      weights[1] += pathInfluence * 0.7;
      weights[0] *= 1.0 - pathInfluence * 0.5;
    }

    // Normalize weights
    let totalWeight = weights[0] + weights[1] + weights[2] + weights[3];
    if (totalWeight < 0.01) {
      // Fallback to grass
      weights[0] = 1.0;
      totalWeight = 1.0;
    }

    for (let i = 0; i < 4; i++) {
      weights[i] /= totalWeight;
    }

    // Set material indices
    materials[0] = 0; // Grass
    materials[1] = 1; // Dirt
    materials[2] = 2; // Rock
    materials[3] = 3; // Snow

    return {
      indices: materials as [number, number, number, number],
      weights: weights as [number, number, number, number],
    };
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

  getHeightAt(worldX: number, worldZ: number): number {
    // Ensure noise generator is initialized even if init()/start() haven't run yet
    if (!this.noise) {
      this.noise = new NoiseGenerator(this.computeSeedFromWorldId());
      if (!this.biomeCenters || this.biomeCenters.length === 0) {
        this.initializeBiomeCenters();
      }
    }

    // Multi-layered noise for realistic terrain
    // Layer 1: Continental shelf - very large scale features
    const continentScale = 0.0008;
    const continentNoise = this.noise.fractal2D(
      worldX * continentScale,
      worldZ * continentScale,
      5,
      0.7,
      2.0,
    );

    // Layer 2: Mountain ridges - creates dramatic peaks and valleys
    const ridgeScale = 0.003;
    const ridgeNoise = this.noise.ridgeNoise2D(
      worldX * ridgeScale,
      worldZ * ridgeScale,
    );

    // Layer 3: Hills and valleys - medium scale variation
    const hillScale = 0.012;
    const hillNoise = this.noise.fractal2D(
      worldX * hillScale,
      worldZ * hillScale,
      4,
      0.5,
      2.2,
    );

    // Layer 4: Erosion - smooths valleys and creates river beds
    const erosionScale = 0.005;
    const erosionNoise = this.noise.erosionNoise2D(
      worldX * erosionScale,
      worldZ * erosionScale,
      3,
    );

    // Layer 5: Fine detail - small bumps and texture
    const detailScale = 0.04;
    const detailNoise = this.noise.fractal2D(
      worldX * detailScale,
      worldZ * detailScale,
      2,
      0.3,
      2.5,
    );

    // Combine layers with carefully tuned weights
    let height = 0;

    // Base continental elevation (40% weight)
    height += continentNoise * 0.4;

    // Add mountain ridges with squared effect for sharper peaks (30% weight)
    const ridgeContribution = ridgeNoise * Math.abs(ridgeNoise);
    height += ridgeContribution * 0.3;

    // Add rolling hills (20% weight)
    height += hillNoise * 0.2;

    // Apply erosion to create valleys (10% weight, subtractive)
    height += erosionNoise * 0.1;

    // Add fine detail (5% weight)
    height += detailNoise * 0.05;

    // Normalize to [0, 1] range
    height = (height + 1) * 0.5;
    height = Math.max(0, Math.min(1, height));

    // Apply power curve to create more dramatic elevation changes
    // Lower values = more valleys, higher values = more peaks
    height = Math.pow(height, 1.4);

    // Create ocean depressions
    const oceanScale = 0.0015;
    const oceanMask = this.noise.simplex2D(
      worldX * oceanScale,
      worldZ * oceanScale,
    );

    // If in ocean zone, depress the terrain
    if (oceanMask < -0.3) {
      const oceanDepth = (-0.3 - oceanMask) * 2; // How deep into ocean
      height *= Math.max(0.1, 1 - oceanDepth);
    }

    // Scale to actual world height
    const MAX_HEIGHT = 80; // Maximum terrain height in meters
    const finalHeight = height * MAX_HEIGHT;

    return finalHeight;
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
    // Get height for biome weighting
    const height = this.getHeightAt(worldX, worldZ);
    const normalizedHeight = height / 80;

    const biomeInfluences: Array<{ type: string; weight: number }> = [];

    // Calculate influence from each biome center
    for (const center of this.biomeCenters) {
      const distance = Math.sqrt(
        (worldX - center.x) ** 2 + (worldZ - center.z) ** 2,
      );

      // Use smoother falloff for more organic blending
      if (distance < center.influence * 3) {
        // Use a smoother gaussian falloff
        const normalizedDistance = distance / center.influence;
        const weight = Math.exp(-normalizedDistance * normalizedDistance * 0.5);

        // Adjust weight based on height appropriateness for the biome
        let heightMultiplier = 1.0;

        if (center.type === "lakes" && normalizedHeight < 0.2) {
          heightMultiplier = 1.8;
        } else if (center.type === "tundra" && normalizedHeight > 0.6) {
          heightMultiplier = 1.8;
        } else if (
          center.type === "forest" &&
          normalizedHeight > 0.3 &&
          normalizedHeight < 0.7
        ) {
          heightMultiplier = 1.4;
        } else if (
          center.type === "plains" &&
          normalizedHeight > 0.2 &&
          normalizedHeight < 0.4
        ) {
          heightMultiplier = 1.4;
        }

        if (weight > 0.001) {
          biomeInfluences.push({
            type: center.type,
            weight: weight * heightMultiplier,
          });
        }
      }
    }

    // Normalize weights
    const totalWeight = biomeInfluences.reduce((sum, b) => sum + b.weight, 0);
    if (totalWeight > 0) {
      for (const influence of biomeInfluences) {
        influence.weight /= totalWeight;
      }
    } else {
      const heightBasedBiome =
        normalizedHeight < 0.15
          ? "lakes"
          : normalizedHeight < 0.35
            ? "plains"
            : normalizedHeight < 0.6
              ? "forest"
              : "tundra";
      biomeInfluences.push({ type: heightBasedBiome, weight: 1.0 });
    }

    return biomeInfluences;
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
    let biomeData = BIOMES[tile.biome];
    const heightfields = (
      tile.mesh.geometry as THREE.BufferGeometry & {
        heightfields: Heightfield[];
      }
    ).heightfields;

    // Fallback biome data if JSON not loaded
    if (!biomeData) {
      console.warn(
        `[TerrainSystem] BIOMES[${tile.biome}] not found - using fallback. Available biomes:`,
        Object.keys(BIOMES),
      );
      biomeData = {
        id: tile.biome,
        name: tile.biome,
        description: "Fallback biome data",
        difficultyLevel: 1,
        terrain: "plains",
        resources: ["tree", "rock", "herb"],
        mobs: [],
        fogIntensity: 0.1,
        ambientSound: "",
        colorScheme: {
          primary: "#88cc88",
          secondary: "#66aa66",
          fog: "#aacccc",
        },
        color: 0x88cc88,
        heightRange: [0, 10],
        terrainMultiplier: 1.0,
        waterLevel: 0,
        maxSlope: 0.5,
        mobTypes: [],
        difficulty: 1,
        baseHeight: 0,
        heightVariation: 5.0,
        resourceDensity: 0.5,
        resourceTypes: ["tree", "rock", "herb"],
      };
    }

    if (!heightfields) {
      console.warn(`[TerrainSystem] No heightfields for tile ${tile.key}`);
      return;
    }

    console.log(
      `[TerrainSystem] Generating resources for tile ${tile.key}, biome: ${tile.biome}, resources: [${biomeData.resources.join(", ")}]`,
    );
    this.generateTreesForTile(tile, biomeData, heightfields);
    this.generateRocksForTile(tile, biomeData, heightfields);
    this.generateOtherResourcesForTile(tile, biomeData);
    this.generateGrassForTile(tile, biomeData);
    console.log(
      `[TerrainSystem] Generated ${tile.resources.length} resources for tile ${tile.key}`,
    );
  }

  private generateTreesForTile(
    tile: TerrainTile,
    biomeData: BiomeData,
    heightfields: Heightfield[],
  ): void {
    const hasTrees =
      biomeData.resources.includes("tree") ||
      biomeData.resources.includes("trees");
    if (!hasTrees) {
      return;
    }

    const CHUNK_SIZE = 16; // meters per chunk
    const chunksPerSide = Math.floor(this.CONFIG.TILE_SIZE / CHUNK_SIZE);
    const MAX_TREES_PER_CHUNK = 12;
    const TREE_THRESHOLD = 0.3;

    for (let cz = 0; cz < chunksPerSide; cz++) {
      for (let cx = 0; cx < chunksPerSide; cx++) {
        const chunkWorldX = tile.x * this.CONFIG.TILE_SIZE + cx * CHUNK_SIZE;
        const chunkWorldZ = tile.z * this.CONFIG.TILE_SIZE + cz * CHUNK_SIZE;

        const chunkSeed = this.noise.hashNoise(chunkWorldX, chunkWorldZ);
        const chunkRng = this.seedRngFromFloat(chunkSeed);

        for (let i = 0; i < MAX_TREES_PER_CHUNK; i++) {
          const offsetX = chunkRng() * CHUNK_SIZE;
          const offsetZ = chunkRng() * CHUNK_SIZE;
          const worldX = chunkWorldX + offsetX;
          const worldZ = chunkWorldZ + offsetZ;

          const heightfield = this.getHeightfieldAt(
            worldX,
            worldZ,
            tile,
            heightfields,
          );
          if (!heightfield) continue;

          if (heightfield.treeVisibility > TREE_THRESHOLD) {
            if (
              heightfield.liquidType === "none" &&
              heightfield.slope < 0.13 &&
              heightfield.height >= this.CONFIG.WATER_THRESHOLD
            ) {
              const variationSeed = this.noise.hashNoise(
                worldX * 5,
                worldZ * 5,
              );
              const treeVariation = Math.floor(variationSeed * 3);

              const scaleNoise = this.noise.scaleNoise(worldX, worldZ);
              const scale = 1.0 + scaleNoise * 0.4;

              const rotation = this.noise.rotationNoise(worldX, worldZ);

              const tree: ResourceNode = {
                id: `${tile.key}_tree_${cx}_${cz}_${i}`,
                type: "tree",
                variation: treeVariation,
                position: new THREE.Vector3(
                  worldX - tile.x * this.CONFIG.TILE_SIZE,
                  heightfield.height,
                  worldZ - tile.z * this.CONFIG.TILE_SIZE,
                ),
                rotation: new THREE.Euler(0, rotation.y * Math.PI * 2, 0),
                scale: new THREE.Vector3(scale, scale, scale),
                mesh: null,
                health: 100,
                maxHealth: 100,
                respawnTime: 300000,
                harvestable: true,
                requiredLevel: 1,
              };
              tile.resources.push(tree);
            }
          }
        }
      }
    }
  }

  private generateRocksForTile(
    tile: TerrainTile,
    biomeData: BiomeData,
    heightfields: Heightfield[],
  ) {
    const hasRocks = biomeData.resources.includes("rock");
    if (!hasRocks) return;

    const CHUNK_SIZE = 16;
    const chunksPerSide = Math.floor(this.CONFIG.TILE_SIZE / CHUNK_SIZE);
    const MAX_ROCKS_PER_CHUNK = 10;
    const ROCK_THRESHOLD = 0.5;

    for (let cz = 0; cz < chunksPerSide; cz++) {
      for (let cx = 0; cx < chunksPerSide; cx++) {
        const chunkWorldX = tile.x * this.CONFIG.TILE_SIZE + cx * CHUNK_SIZE;
        const chunkWorldZ = tile.z * this.CONFIG.TILE_SIZE + cz * CHUNK_SIZE;

        const chunkSeed = this.noise.hashNoise(chunkWorldX, chunkWorldZ);
        const chunkRng = this.seedRngFromFloat(chunkSeed);

        for (let i = 0; i < MAX_ROCKS_PER_CHUNK; i++) {
          const offsetX = chunkRng() * CHUNK_SIZE;
          const offsetZ = chunkRng() * CHUNK_SIZE;
          const worldX = chunkWorldX + offsetX;
          const worldZ = chunkWorldZ + offsetZ;

          const heightfield = this.getHeightfieldAt(
            worldX,
            worldZ,
            tile,
            heightfields,
          );
          if (!heightfield) continue;

          if (heightfield.rockVisibility > ROCK_THRESHOLD) {
            if (heightfield.liquidType === "none" && heightfield.slope < 0.13) {
              const scale = 0.85 + this.noise.scaleNoise(worldX, worldZ) * 0.25;
              const rotation = this.noise.rotationNoise(worldX, worldZ);

              const rock: ResourceNode = {
                id: `${tile.key}_rock_${cx}_${cz}_${i}`,
                type: "rock",
                position: new THREE.Vector3(
                  worldX - tile.x * this.CONFIG.TILE_SIZE,
                  heightfield.height,
                  worldZ - tile.z * this.CONFIG.TILE_SIZE,
                ),
                rotation: new THREE.Euler(0, rotation.y * Math.PI * 2, 0),
                scale: new THREE.Vector3(scale, scale, scale),
                mesh: null,
                health: 100,
                maxHealth: 100,
                respawnTime: 300000,
                harvestable: true,
                requiredLevel: 1,
              };
              tile.resources.push(rock);

              this.generateSurroundingStones(
                tile,
                cx,
                cz,
                worldX,
                worldZ,
                heightfield.height,
                chunkRng,
              );
            }
          }
        }
      }
    }
  }

  private generateSurroundingStones(
    tile: TerrainTile,
    cx: number,
    cz: number,
    centerX: number,
    centerZ: number,
    _centerHeight: number,
    rng: () => number,
  ): void {
    const NUM_STONES = 4;
    const BASE_OFFSET = 15.0;
    const OFFSET_RANGE = 3.0;

    for (let i = 0; i < NUM_STONES; i++) {
      const offsetX = rng() * 2 - 1;
      const offsetZ = rng() * 2 - 1;

      const signX = offsetX >= 0 ? 1 : -1;
      const signZ = offsetZ >= 0 ? 1 : -1;

      const stoneX = centerX + BASE_OFFSET * signX + offsetX * OFFSET_RANGE;
      const stoneZ = centerZ + BASE_OFFSET * signZ + offsetZ * OFFSET_RANGE;

      const stoneHeight = this.getHeightAt(stoneX, stoneZ);

      const scale = 0.8 + rng() * 0.2;
      const rotation = rng() * Math.PI * 2;

      const stone: ResourceNode = {
        id: `${tile.key}_stone_${cx}_${cz}_${i}`,
        type: "stone",
        position: new THREE.Vector3(
          stoneX - tile.x * this.CONFIG.TILE_SIZE,
          stoneHeight,
          stoneZ - tile.z * this.CONFIG.TILE_SIZE,
        ),
        rotation: new THREE.Euler(0, rotation, 0),
        scale: new THREE.Vector3(scale, scale, scale),
        mesh: null,
        health: 50,
        maxHealth: 50,
        respawnTime: 180000,
        harvestable: true,
        requiredLevel: 1,
      };

      tile.resources.push(stone);
    }
  }

  private generateOtherResourcesForTile(
    tile: TerrainTile,
    biomeData: BiomeData,
  ): void {
    // Generate other resources (ore, herbs, fishing spots, etc.)
    // Filter out both 'tree' and 'trees' variations
    const otherResources = biomeData.resources.filter(
      (r) => r !== "tree" && r !== "trees",
    );

    for (const resourceType of otherResources) {
      const rng = this.createTileRng(tile.x, tile.z, `res:${resourceType}`);
      let resourceCount = 0;

      // Determine count based on resource type and biome
      switch (resourceType) {
        case "fish":
          resourceCount = (tile.biome as string) === "lakes" ? 3 : 0;
          break;
        case "ore":
        case "rare_ore":
          resourceCount = rng() < 0.3 ? 1 : 0;
          break;
        case "herb":
          resourceCount = Math.floor(rng() * 3);
          break;
        case "rock":
          resourceCount = Math.floor(rng() * 2);
          break;
        case "gem":
          resourceCount = rng() < 0.1 ? 1 : 0; // Rare
          break;
      }

      for (let i = 0; i < resourceCount; i++) {
        const worldX =
          tile.x * this.CONFIG.TILE_SIZE +
          (rng() - 0.5) * this.CONFIG.TILE_SIZE;
        const worldZ =
          tile.z * this.CONFIG.TILE_SIZE +
          (rng() - 0.5) * this.CONFIG.TILE_SIZE;

        // For fishing spots, place in water only
        if (resourceType === "fish") {
          const height = this.getHeightAt(worldX, worldZ);
          if (height >= this.CONFIG.WATER_THRESHOLD) continue; // Only place fish in water
        }

        const height = this.getHeightAt(worldX, worldZ);
        const position = this._tempVec3.set(
          worldX - tile.x * this.CONFIG.TILE_SIZE,
          height,
          worldZ - tile.z * this.CONFIG.TILE_SIZE,
        );

        const resource: ResourceNode = {
          id: `${tile.key}_${resourceType}_${i}`,
          type: resourceType as ResourceNode["type"],
          position,
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

  private generateGrassForTile(tile: TerrainTile, biomeData: BiomeData): void {
    if (!this.world.network?.isClient) return;
    if (!this.grassSystem) return;

    this.grassSystem.generateGrassForTile(
      tile,
      (
        tile.mesh.geometry as THREE.BufferGeometry & {
          heightfields: Heightfield[];
        }
      ).heightfields,
      biomeData as { [key: string]: unknown },
      {
        CONFIG: this.CONFIG,
        noise: this.noise,
        seedRngFromFloat: this.seedRngFromFloat.bind(this),
        getHeightfieldAt: this.getHeightfieldAt.bind(this),
      },
    );
  }

  private getHeightfieldAt(
    worldX: number,
    worldZ: number,
    tile: TerrainTile,
    heightfields: Heightfield[],
  ): Heightfield | null {
    const localX = worldX - tile.x * this.CONFIG.TILE_SIZE;
    const localZ = worldZ - tile.z * this.CONFIG.TILE_SIZE;

    const resolution = this.CONFIG.TILE_RESOLUTION;
    const step = this.CONFIG.TILE_SIZE / (resolution - 1);

    // Calculate grid indices
    const gridX = Math.round((localX + this.CONFIG.TILE_SIZE / 2) / step);
    const gridZ = Math.round((localZ + this.CONFIG.TILE_SIZE / 2) / step);

    const index = gridZ * resolution + gridX;

    if (index >= 0 && index < heightfields.length) {
      return heightfields[index];
    }

    return null; // Out of bounds
  }

  private seedRngFromFloat(seed: number): () => number {
    let state = Math.floor(seed * 0xffffffff);
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
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
      mesh: null!,
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

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const localX = (i - (resolution - 1) / 2) * step;
        const localZ = (j - (resolution - 1) / 2) * step;

        let maxInfluence = 0;

        // Check distance to each road segment
        for (const road of tempTile.roads) {
          const distanceToRoad = this.distanceToLineSegment(
            new THREE.Vector2(localX, localZ),
            road.start instanceof THREE.Vector2
              ? road.start
              : new THREE.Vector2(road.start.x, road.start.z),
            road.end instanceof THREE.Vector2
              ? road.end
              : new THREE.Vector2(road.end.x, road.end.z),
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
    // Process queued tile generations within a small per-frame budget
    this.processTileGenerationQueue();

    // Process queued collision generation on the server
    if (this.world.network?.isServer) {
      this.processCollisionGenerationQueue();
    }

    // Update instance visibility on client based on player position
    if (this.world.network?.isClient && this.instancedMeshManager) {
      this.instancedMeshManager.updateAllInstanceVisibility();

      // Log pooling stats occasionally for debugging
      if (Math.random() < 0.002) {
        // Log approximately once every 500 frames at 60fps
        const _stats = this.instancedMeshManager.getPoolingStats();
      }
    }

    // Animate water and grass (client-side only)
    if (this.world.network?.isClient) {
      const dt =
        typeof _deltaTime === "number" && isFinite(_deltaTime)
          ? _deltaTime
          : 1 / 60;

      if (this.grassSystem) {
        this.grassSystem.update(dt);
      }

      // Update water system
      if (this.waterSystem) {
        const allWaterMeshes: THREE.Mesh[] = [];
        for (const tile of this.terrainTiles.values()) {
          if (tile.waterMeshes) {
            allWaterMeshes.push(...tile.waterMeshes);
          }
        }
        this.waterSystem.update(dt, allWaterMeshes);
      }
    }
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

  private unloadTile(tile: TerrainTile): void {
    // Clean up road meshes
    for (const road of tile.roads) {
      if (road.mesh && road.mesh.parent) {
        road.mesh.parent.remove(road.mesh);
        road.mesh.geometry.dispose();
        if (road.mesh.material instanceof THREE.Material) {
          road.mesh.material.dispose();
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

    // Clean up water meshes
    if (tile.waterMeshes) {
      for (const waterMesh of tile.waterMeshes) {
        if (waterMesh.parent) {
          waterMesh.parent.remove(waterMesh);
          waterMesh.geometry.dispose();
          if (waterMesh.material instanceof THREE.Material) {
            waterMesh.material.dispose();
          }
        }
      }
      tile.waterMeshes = [];
    }

    // Clean up grass meshes
    const grassMeshes = (tile as { grassMeshes?: THREE.InstancedMesh[] })
      .grassMeshes;
    if (grassMeshes) {
      for (const grassMesh of grassMeshes) {
        if (grassMesh.parent) {
          grassMesh.parent.remove(grassMesh);
        }
        grassMesh.geometry.dispose();
      }
      (tile as { grassMeshes?: THREE.InstancedMesh[] }).grassMeshes = [];
    }

    // Remove main tile mesh from scene
    if (this.terrainContainer && tile.mesh.parent) {
      this.terrainContainer.remove(tile.mesh);
      tile.mesh.geometry.dispose();
      if (tile.mesh.material instanceof THREE.Material) {
        tile.mesh.material.dispose();
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
    this.emitTileUnloaded(`${tile.x},${tile.z}`);
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

    // Guard against missing biome data
    if (!biomeData) {
      console.warn(`[TerrainSystem] Biome data not found for biome: ${biome}`);
      return { walkable: true }; // Default to walkable if biome data missing
    }

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
   * Calculate slope at a given world position
   */
  private calculateSlope(worldX: number, worldZ: number): number {
    const checkDistance = this.CONFIG.SLOPE_CHECK_DISTANCE;
    const centerHeight = this.getHeightAt(worldX, worldZ);

    // Sample heights in 4 directions
    const northHeight = this.getHeightAt(worldX, worldZ + checkDistance);
    const southHeight = this.getHeightAt(worldX, worldZ - checkDistance);
    const eastHeight = this.getHeightAt(worldX + checkDistance, worldZ);
    const westHeight = this.getHeightAt(worldX - checkDistance, worldZ);

    // Calculate maximum slope in any direction
    const slopes = [
      Math.abs(northHeight - centerHeight) / checkDistance,
      Math.abs(southHeight - centerHeight) / checkDistance,
      Math.abs(eastHeight - centerHeight) / checkDistance,
      Math.abs(westHeight - centerHeight) / checkDistance,
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
   * Simple v1: Just a flat plane at the fixed water threshold height
   */
  private generateWaterMeshes(tile: TerrainTile): void {
    if (!this.waterSystem) return;

    const waterMesh = this.waterSystem.generateWaterMesh(
      tile,
      this.CONFIG.WATER_THRESHOLD,
      this.CONFIG.TILE_SIZE,
    );

    if (tile.mesh) {
      tile.mesh.add(waterMesh);
      tile.waterMeshes.push(waterMesh);
    }
  }

  /**
   * Generate visual lake meshes for water bodies
   * Note: generateWaterMeshes already handles the global water plane,
   * so this is now a no-op. Keeping for future enhancements.
   */
  private generateLakeMeshes(_tile: TerrainTile): void {
    // V1: Global water plane is handled by generateWaterMeshes
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

    // Guard against missing biome data or safe zones
    if (
      !biomeData ||
      biomeData.difficulty === 0 ||
      biomeData.mobTypes.length === 0
    ) {
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
   * Get all loaded tiles with their biome and mob spawn data
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
    this.terrainBoundingBoxes.clear();
    this.pendingSerializationData.clear();
  }

  private emitTileUnloaded(tileId: string): void {
    this.world.emit(EventType.TERRAIN_TILE_UNLOADED, { tileId });
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
    const activeChunks = Array.from(this.terrainTiles.keys());
    return {
      tileSize: "100x100m",
      worldSize: "100x100",
      totalArea: "10km x 10km",
      maxLoadedTiles: 9,
      tilesLoaded: this.terrainTiles.size,
      currentlyLoaded: activeChunks,
      biomeCount: Object.keys(BIOMES).length,
      chunkSize: this.CONFIG.TILE_SIZE,
      worldBounds: {
        min: { x: -this.CONFIG.WORLD_SIZE / 2, z: -this.CONFIG.WORLD_SIZE / 2 },
        max: { x: this.CONFIG.WORLD_SIZE / 2, z: this.CONFIG.WORLD_SIZE / 2 },
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
   * Initialize chunk loading system
   * Uses LOD-based loading controlled by TerrainLODManager
   */
  private initializeChunkLoadingSystem(): void {
    // Initialize tracking maps for multiplayer
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
    // Set world bounds based on 100x100 tile grid
    this.worldBounds = {
      minX: -50 * this.CONFIG.TILE_SIZE,
      maxX: 50 * this.CONFIG.TILE_SIZE,
      minZ: -50 * this.CONFIG.TILE_SIZE,
      maxZ: 50 * this.CONFIG.TILE_SIZE,
      minY: -50,
      maxY: 100,
    };

    this.terrainBoundingBoxes.clear();
  }

  /**
   * LOD-based terrain update system
   * Updates terrain tiles based on player position and LOD requirements
   */
  private updateLODBasedTerrain(): void {
    if (this.isGenerating) return;
    if (!this.lodManager) return; // Server doesn't have LOD manager

    const players = this.world.getPlayers() || [];
    if (players.length === 0) return;

    const player = players[0];
    const playerPos = player.node.position as THREE.Vector3;

    const { toAdd, toRemove } = this.lodManager.update(playerPos);

    for (const chunk of toRemove) {
      const tile = this.terrainTiles.get(chunk.key);
      if (tile) {
        this.unloadTile(tile);
      }
    }

    for (const chunk of toAdd) {
      // Remove any existing tiles at this position with different LOD first
      const existingKeys = Array.from(this.terrainTiles.keys()).filter(
        (key) => {
          const parts = key.split("_");
          return (
            parts[0] === chunk.x.toString() && parts[1] === chunk.z.toString()
          );
        },
      );

      for (const existingKey of existingKeys) {
        const existingTile = this.terrainTiles.get(existingKey);
        if (existingTile && existingKey !== chunk.key) {
          this.unloadTile(existingTile);
        }
      }

      this.enqueueTileForGeneration(
        chunk.x,
        chunk.z,
        chunk.lod,
        chunk.lodArray,
      );
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

  public getWaterLevel(): number {
    return this.CONFIG.WATER_THRESHOLD;
  }
}
