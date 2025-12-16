import type { World } from "../../../types";
import type { WorldChunkData } from "../../../types/network/database";
import {
  geometryToPxMesh,
  PMeshHandle,
} from "../../../extras/three/geometryToPxMesh";
import THREE from "../../../extras/three/three";
import { System } from "../infrastructure/System";
import { EventType } from "../../../types/events";
import { NoiseGenerator } from "../../../utils/NoiseGenerator";
import { InstancedMeshManager } from "../../../utils/rendering/InstancedMeshManager";
import { TextureAtlasManager } from "../../../utils/TextureAtlasManager";
import { TriplanarTerrainMaterial } from "../../../materials/TriplanarTerrainMaterial";
import { TerrainLODManager } from "../../TerrainLODManager";
import { modelCache } from "../../../utils/rendering/ModelCache";

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
import type {
  Heightfield,
  ResourceNode,
  TerrainTile,
} from "../../../types/world/terrain";
import { PhysicsHandle } from "../../../types/systems/physics";
import { getPhysX } from "../../../physics/PhysXManager";
import { Layers } from "../../../physics/Layers";
import { BIOMES } from "../../../data/world-structure";
import { GrassSystem } from "..";
import { WaterSystem } from "..";
import type { DatabaseSystem } from "../../../types/systems/system-interfaces";
import { Logger } from "../../../utils/Logger";

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
  private _tempBox3 = new THREE.Box3();
  // Reusable array for water meshes to avoid array spreading allocations
  private readonly _reusableWaterMeshes: THREE.Mesh[] = [];
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

  // World Configuration
  // Gentle rolling hills with very occasional dramatic peaks
  private readonly CONFIG = {
    // Core World Specs
    TILE_SIZE: 100, // 100m x 100m tiles
    WORLD_SIZE: 100, // 100x100 grid = 10km x 10km world
    TILE_RESOLUTION: 64, // 64x64 vertices per tile for smooth terrain
    MAX_HEIGHT: 60, // 60m max height for gentle hills with occasional peaks
    WATER_THRESHOLD: 4.0, // Water appears below 4m (creates lakes in depressions)

    // Chunking - Only adjacent tiles
    VIEW_DISTANCE: 1, // Load only 1 tile in each direction (3x3 = 9 tiles)
    UPDATE_INTERVAL: 0.5, // Check player movement every 0.5 seconds

    // Movement Constraints
    WATER_IMPASSABLE: true, // Water blocks movement
    MAX_WALKABLE_SLOPE: 0.7, // Maximum slope for movement (tan of angle)
    SLOPE_CHECK_DISTANCE: 1, // Distance to check for slope calculation

    // Features
    ROAD_WIDTH: 4, // 4m wide roads
    RESOURCE_DENSITY: 0.15, // 15% chance per area for resources
    TREE_DENSITY: 0.25, // 25% chance for trees in forest biomes
    TOWN_RADIUS: 25, // Safe radius around towns
    
    // Height variation by biome type
    BIOME_HEIGHT_MULTIPLIERS: {
      plains: 0.4,     // Very gentle
      forest: 0.5,     // Slightly more varied
      valley: 0.3,     // Low-lying, gentle
      mountains: 1.5,  // Dramatic peaks (very occasional)
      tundra: 0.8,     // Moderate with some peaks
      desert: 0.35,    // Gentle dunes
      lakes: 0.2,      // Very flat around water
      swamp: 0.25,     // Very flat, wet
    } as Record<string, number>,
    
    // Mountain occurrence (lower = rarer)
    MOUNTAIN_RARITY: 0.08, // Only ~8% of terrain has mountain-level peaks
  };

  // Biomes now loaded from assets/manifests/biomes.json via DataManager
  // Uses imported BIOMES from world-structure.ts
  // No hardcoded biome data - all definitions in JSON!

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    this.tileSize = this.CONFIG.TILE_SIZE;
    this.noise = new NoiseGenerator(this.computeSeedFromWorldId());
    this.initializeBiomeCenters();

    if (this.world.isClient) {
      this.textureAtlasManager = new TextureAtlasManager();
      await this.textureAtlasManager.init();

      const cdnUrl =
        typeof window !== "undefined"
          ? ((window as { __CDN_URL?: string }).__CDN_URL ??
            "http://localhost:8080")
          : "http://localhost:8080";

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
    }

    this.grassSystem = new GrassSystem(this.world);
    await this.grassSystem.init();
    this.waterSystem = new WaterSystem(this.world);
    await this.waterSystem.init();

    this.databaseSystem = this.world.getSystem("database") as DatabaseSystem;
    this.initializeChunkLoadingSystem();
    this.initializeSerializationSystem();
    this.initializeBoundingBoxSystem();
  }

  async start(): Promise<void> {
    if (!this.noise) {
      this.noise = new NoiseGenerator(this.computeSeedFromWorldId());
      this.initializeBiomeCenters();
    }

    if (this.world.isServer) {
      this.setupServerTerrain();
    } else {
      await this.setupClientTerrain();
    }

    this.terrainUpdateIntervalId = setInterval(() => {
      this.updateLODBasedTerrain();
    }, 500);

    if (this.world.isClient && this.lodManager) {
      setTimeout(() => this.updateLODBasedTerrain(), 100);
    }

    this.serializationIntervalId = setInterval(() => {
      this.performPeriodicSerialization();
    }, 60000);

    this.boundingBoxIntervalId = setInterval(() => {
      this.verifyTerrainBoundingBoxes();
    }, 30000);
  }

  private async setupClientTerrain(): Promise<void> {
    const scene = (this.world.stage as { scene: THREE.Scene }).scene;

    this.terrainContainer = new THREE.Group();
    this.terrainContainer.name = "TerrainContainer";
    scene.add(this.terrainContainer);

    this.instancedMeshManager = new InstancedMeshManager(scene, this.world);
    await this.registerInstancedMeshes();
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

    const loadModelFromCache = async (
      path: string,
    ): Promise<THREE.Object3D | null> => {
      try {
        // Use modelCache which returns pure THREE.Object3D (not Hyperscape Nodes)
        const result = await modelCache.loadModel(path, this.world);
        if (!result || !result.scene) {
          Logger.systemWarn(
            "TerrainSystem",
            `Failed to load model from ${path}`,
          );
          return null;
        }
        return result.scene;
      } catch (e) {
        Logger.systemWarn(
          "TerrainSystem",
          `Failed to load model from ${path}`,
          e instanceof Error
            ? { error: e.message, stack: e.stack }
            : { error: String(e) },
        );
        return null;
      }
    };

    // Load jungle tree model (medium variant - most common)
    try {
      const treeModel = await loadModelFromCache(
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
          Logger.system(
            "TerrainSystem",
            "Registered jungle tree mesh from GLB",
          );
        } else {
          throw new Error("No mesh found in tree model");
        }
      } else {
        throw new Error("Failed to load tree model nodes");
      }
    } catch (e) {
      Logger.systemWarn(
        "TerrainSystem",
        "Failed to load tree model, using placeholder",
        e instanceof Error
          ? { error: e.message, stack: e.stack }
          : { error: String(e) },
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
      const rockModel = await loadModelFromCache(
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
          Logger.system("TerrainSystem", "Registered big rock mesh from GLB");
        } else {
          throw new Error("No mesh found in rock model");
        }
      } else {
        throw new Error("Failed to load rock model nodes");
      }
    } catch (e) {
      Logger.systemWarn(
        "TerrainSystem",
        "Failed to load rock model, using placeholder",
        e instanceof Error
          ? { error: e.message, stack: e.stack }
          : { error: String(e) },
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
      const bushModel = await loadModelFromCache(
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
          Logger.system("TerrainSystem", "Registered herb mesh from GLB");
        } else {
          throw new Error("No mesh found in bush model");
        }
      } else {
        throw new Error("Failed to load bush model nodes");
      }
    } catch (e) {
      Logger.systemWarn(
        "TerrainSystem",
        "Failed to load bush model, using placeholder",
        e instanceof Error
          ? { error: e.message, stack: e.stack }
          : { error: String(e) },
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
      const stoneModel = await loadModelFromCache(
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
          Logger.system("TerrainSystem", "Registered stone mesh from GLB");
        } else {
          throw new Error("No mesh found in stone model");
        }
      } else {
        throw new Error("Failed to load stone model nodes");
      }
    } catch (e) {
      Logger.systemWarn(
        "TerrainSystem",
        "Failed to load stone model, using placeholder",
        e instanceof Error
          ? { error: e.message, stack: e.stack }
          : { error: String(e) },
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
      Logger.system(
        "TerrainSystem",
        `Tile already exists at ${tileX},${tileZ} with key ${existingAtPosition.key}, skipping new tile ${key}`,
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
      Logger.systemWarn(
        "TerrainSystem",
        "Using fallback material - textures not loaded",
        {
          isClient: this.world.isClient,
          hasAtlas: !!this.textureAtlasManager,
          hasMaterial: !!this.terrainMaterial,
        },
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

    // Skip physics if not available (e.g., in tests)
    if (!physics || !PHYSX) {
      this.terrainTiles.set(key, tile);
      return tile;
    }

    // Create a collision box that covers the full terrain height range
    // This prevents players from falling through near water edges
    const positionAttribute = geometry.attributes.position;
    const vertices = positionAttribute.array as Float32Array;

    // Calculate min/max height bounds
    let minY = Infinity;
    let maxY = -Infinity;
    const vertexCount = positionAttribute.count;

    for (let i = 0; i < vertexCount; i++) {
      const y = vertices[i * 3 + 1]; // Y is at index 1 in each vertex
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    // Create a box shape that covers the FULL terrain height range
    // Add buffer below minY to prevent edge cases near water
    const bufferBelow = 10; // 10m buffer below lowest point
    const bufferAbove = 2; // 2m buffer above highest point
    const effectiveMinY = minY - bufferBelow;
    const effectiveMaxY = maxY + bufferAbove;
    const boxHeight = effectiveMaxY - effectiveMinY;
    const boxCenterY = (effectiveMinY + effectiveMaxY) / 2;

    const halfExtents = {
      x: this.CONFIG.TILE_SIZE / 2, // Half width
      y: boxHeight / 2, // Half height of the collision box
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

    // Create actor at tile position, centered on the full height range
    const transform = new PHYSX!.PxTransform(
      new PHYSX!.PxVec3(
        mesh.position.x + this.CONFIG.TILE_SIZE / 2, // Center of tile X
        boxCenterY, // Center of the full height range
        mesh.position.z + this.CONFIG.TILE_SIZE / 2, // Center of tile Z
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
        Logger.systemWarn("TerrainSystem", "Duplicate tile detected", {
          newKey: key,
          existingKey: existingAtPosition.key,
          position: {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,
          },
        });
        // Don't add duplicate
        return tile;
      }

      this.terrainContainer.add(mesh);
      Logger.system("TerrainSystem", "Added terrain mesh to scene", {
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
        // PERFORMANCE: Use _tempVec3 to avoid allocation per resource
        if (tile.resources.length > 0 && tile.mesh) {
          for (const resource of tile.resources) {
            if (resource.instanceId != null) continue;

            // Reuse temp vector - addInstance clones internally
            this._tempVec3.set(
              tile.x * this.CONFIG.TILE_SIZE + resource.position.x,
              resource.position.y,
              tile.z * this.CONFIG.TILE_SIZE + resource.position.z,
            );

            const instanceId = this.instancedMeshManager.addInstance(
              resource.type,
              resource.id,
              this._tempVec3,
              resource.rotation,
              resource.scale,
            );

            if (instanceId !== null) {
              resource.instanceId = instanceId;
              resource.meshType = resource.type;

              // Emit resource created event for InteractionSystem registration
              this.world.emit(EventType.RESOURCE_MESH_CREATED, {
                mesh: undefined,
                instanceId: instanceId,
                resourceId: resource.id,
                resourceType: resource.type,
                worldPosition: {
                  x: this._tempVec3.x,
                  y: this._tempVec3.y,
                  z: this._tempVec3.z,
                },
              });
            }
          }
        }

        // Force immediate visibility update for this tile's resources
        if (tile.resources.length > 0) {
          this.instancedMeshManager.updateAllInstanceVisibility(true);
          Logger.system(
            "TerrainSystem",
            `Forced visibility update after adding ${tile.resources.length} resources`,
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

    // NOTE: Procedural resources (trees, rocks) are VISUAL DECORATION ONLY
    // They are rendered via InstancedMeshManager but are NOT interactable
    // Interactable resources come ONLY from world-areas.json manifest
    // via ResourceSystem.initializeWorldAreaResources()
    //
    // DO NOT emit RESOURCE_SPAWN_POINTS_REGISTERED for procedural resources
    // This prevents duplicate trees and ensures manifest-driven approach

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

    // 2. Get blended biome influences for soft transitions
    const biomeInfluences = this.getBiomeInfluencesAtPosition(worldX, worldZ);
    const primaryBiome = biomeInfluences.length > 0 ? biomeInfluences[0].type : "plains";

    // 3. Calculate liquid
    const oceanValue = this.noise.oceanNoise(worldX, worldZ);
    const riverValue = this.noise.riverNoise(worldX, worldZ, oceanValue);
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

    // 5. Calculate materials with blended biome influences for soft transitions
    const materials = this.calculateMaterialsWithBiomeBlending(
      height,
      slope,
      biomeInfluences,
      liquidType,
      worldX,
      worldZ,
    );

    // 6. Calculate instance visibility using blended biome properties
    const wetness = this.noise.wetnessNoise(worldX, worldZ);
    
    // Blend grass visibility based on biome influences
    let blendedGrassVisibility = 0;
    for (const influence of biomeInfluences) {
      const biomeGrassMultiplier = this.getBiomeGrassMultiplier(influence.type);
      blendedGrassVisibility += this.noise.grassVisibility(worldX, worldZ, wetness) * 
        biomeGrassMultiplier * influence.weight;
    }
    
    const heightfield: Heightfield = {
      height,
      liquidHeight,
      biome: primaryBiome,
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
      grassVisibility: blendedGrassVisibility,
      flowerVisibility: 0,
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

  /**
   * Get grass visibility multiplier for biome type
   */
  private getBiomeGrassMultiplier(biome: string): number {
    const multipliers: Record<string, number> = {
      plains: 1.2,
      forest: 1.0,
      valley: 1.3,
      mountains: 0.3,
      tundra: 0.2,
      desert: 0.05,
      lakes: 0.8,
      swamp: 0.6,
    };
    return multipliers[biome] ?? 1.0;
  }

  /**
   * Calculate materials with soft biome blending for smooth transitions
   */
  private calculateMaterialsWithBiomeBlending(
    height: number,
    slope: number,
    biomeInfluences: Array<{ type: string; weight: number }>,
    liquidType: string,
    worldX: number,
    worldZ: number,
  ): {
    indices: [number, number, number, number];
    weights: [number, number, number, number];
  } {
    // For single or very dominant biome, use standard calculation
    if (biomeInfluences.length <= 1 || biomeInfluences[0].weight > 0.85) {
      const primaryBiome = biomeInfluences.length > 0 ? biomeInfluences[0].type : "plains";
      return this.calculateMaterials(height, slope, primaryBiome, liquidType, worldX, worldZ);
    }

    // For blended biomes, calculate weighted material contributions
    const blendedWeights = [0, 0, 0, 0, 0, 0]; // 6 materials
    
    for (const influence of biomeInfluences) {
      if (influence.weight < 0.05) continue; // Skip negligible influences
      
      const biomeMaterials = this.calculateMaterials(
        height, slope, influence.type, liquidType, worldX, worldZ
      );
      
      // Accumulate weighted material contributions
      for (let i = 0; i < 4; i++) {
        const materialIndex = biomeMaterials.indices[i];
        blendedWeights[materialIndex] += biomeMaterials.weights[i] * influence.weight;
      }
    }

    // Find top 4 materials by blended weight
    const materialWeights = blendedWeights.map((weight, index) => ({ index, weight }));
    materialWeights.sort((a, b) => b.weight - a.weight);
    const top4 = materialWeights.slice(0, 4);

    // Normalize
    const totalWeight = top4.reduce((sum, m) => sum + m.weight, 0);
    const materials = [0, 0, 0, 0];
    const weights = [0, 0, 0, 0];

    if (totalWeight > 0.01) {
      for (let i = 0; i < 4; i++) {
        materials[i] = top4[i].index;
        weights[i] = top4[i].weight / totalWeight;
      }
    } else {
      // Fallback to grass
      materials[0] = 0;
      weights[0] = 1.0;
    }

    return {
      indices: materials as [number, number, number, number],
      weights: weights as [number, number, number, number],
    };
  }

  /**
   * Material indices:
   * 0 = Grass (stylized_grass)
   * 1 = Dirt (dirt_ground)
   * 2 = Rock (stylized_stone)
   * 3 = Snow (stylized_snow)
   */
  private calculateMaterials(
    height: number,
    slope: number,
    biome: string,
    liquidType: string,
    worldX: number,
    worldZ: number,
  ): {
    indices: [number, number, number, number];
    weights: [number, number, number, number];
  } {
    const materials = [0, 0, 0, 0];
    const weights = [0, 0, 0, 0];

    // Water gets underwater materials
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

    // =========================================================
    // BIOME-SPECIFIC MATERIAL WEIGHTS
    // Material indices: 0=Grass, 1=Dirt, 2=Rock, 3=Snow, 4=Sand, 5=Cobblestone
    // Each biome has different base material preferences
    // =========================================================

    let grassWeight = 0;
    let dirtWeight = 0;
    let rockWeight = 0;
    let snowWeight = 0;
    let sandWeight = 0;
    let cobblestoneWeight = 0;

    switch (biome) {
      case "desert":
        // Desert: Primarily sand, some rock on slopes
        sandWeight = 0.85 + detailNoise * 0.1;
        rockWeight = 0.1 + Math.max(0, adjustedSlope * 0.5);
        grassWeight = Math.max(0, 0.05 - adjustedSlope); // Very rare oasis grass
        dirtWeight = Math.max(0, 0.1 - sandWeight * 0.1);
        break;

      case "tundra":
        // Tundra: Snow-covered with rock outcrops
        snowWeight = 0.75 + detailNoise * 0.15;
        rockWeight = 0.15 + Math.max(0, adjustedSlope * 0.4);
        grassWeight = Math.max(0, 0.08 - height / 25.0); // Low areas might have sparse grass
        dirtWeight = Math.max(0, 0.1 - snowWeight * 0.15);
        break;

      case "mountains":
        // Mountains: Rock dominant, snow on peaks, sparse grass at base
        rockWeight = 0.55 + Math.min(0.35, adjustedSlope);
        snowWeight = Math.max(0, (adjustedHeight - 35.0) / 15.0);
        grassWeight = Math.max(0, 0.25 - adjustedHeight / 40.0);
        dirtWeight = Math.max(0, 0.15 - adjustedSlope);
        break;

      case "swamp":
        // Swamp: Dark dirt/mud dominant, some grass
        dirtWeight = 0.55 + detailNoise * 0.2;
        grassWeight = 0.38 - adjustedSlope * 0.3;
        rockWeight = Math.max(0, adjustedSlope - 0.35);
        sandWeight = Math.max(0, 0.1 - dirtWeight * 0.15);
        break;

      case "lakes":
        // Lake edges: Sand/dirt near water, grass further
        sandWeight = 0.35 + detailNoise * 0.15;
        dirtWeight = 0.25 + detailNoise * 0.1;
        grassWeight = 0.35 - sandWeight * 0.2 - dirtWeight * 0.1;
        rockWeight = Math.max(0, adjustedSlope - 0.4);
        break;

      case "forest":
        // Forest: Lush grass with dirt patches, some leaf litter
        grassWeight = 0.72 + detailNoise * 0.12;
        dirtWeight = 0.22 - detailNoise * 0.08;
        rockWeight = Math.max(0, adjustedSlope * 0.6);
        break;

      case "valley":
        // Valley: Rich grass, some dirt
        grassWeight = 0.82 + detailNoise * 0.08;
        dirtWeight = 0.12;
        rockWeight = Math.max(0, adjustedSlope * 0.5 - 0.05);
        break;

      case "plains":
      default:
        // Plains: Strong grass-dominant terrain with gentle variation
        grassWeight = 0.85;
        grassWeight *= 1.0 - Math.min(0.3, adjustedSlope * 0.5);
        dirtWeight = 0.1 + detailNoise * 0.05;
        rockWeight = Math.max(0, adjustedSlope * 0.4);
        snowWeight = Math.max(0, (adjustedHeight - 45.0) / 20.0);
        break;
    }

    // Apply universal height/slope modifiers
    // High elevation gets snow (very occasional peaks only)
    if (adjustedHeight > 40.0) {
      const highSnow = Math.min(1.0, (adjustedHeight - 40.0) / 15.0);
      snowWeight = Math.max(snowWeight, highSnow * 0.5);
    }

    // Steep slopes always get some rock
    if (adjustedSlope > 0.5) {
      const steepRock = Math.min(1.0, (adjustedSlope - 0.5) / 0.25);
      rockWeight = Math.max(rockWeight, steepRock * 0.65);
    }

    // =========================================================
    // ROAD SYSTEM - Noise-based paths with biome-aware surfacing
    // =========================================================
    
    // Primary road network (larger paths connecting areas)
    const roadNoise1 = this.noise.ridgeNoise2D(worldX * 0.008, worldZ * 0.008);
    const roadNoise2 = this.noise.ridgeNoise2D(worldX * 0.012 + 50, worldZ * 0.012 + 50);
    const combinedRoadNoise = (roadNoise1 + roadNoise2 * 0.6) / 1.6;
    
    // Road threshold - higher values = wider roads
    const roadThreshold = 0.78;
    const isOnRoad = combinedRoadNoise > roadThreshold;
    const roadStrength = isOnRoad ? Math.min(1.0, (combinedRoadNoise - roadThreshold) * 8.0) : 0;
    
    // Check if near a town for cobblestone
    const distToTownCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
    const nearTown = distToTownCenter < this.CONFIG.TOWN_RADIUS * 2;
    
    if (roadStrength > 0.1) {
      if (nearTown) {
        // Cobblestone roads near towns
        cobblestoneWeight = roadStrength * 0.85;
        dirtWeight *= (1.0 - roadStrength * 0.7);
        grassWeight *= (1.0 - roadStrength * 0.9);
      } else {
        // Dirt paths in wilderness
        dirtWeight += roadStrength * 0.75;
        grassWeight *= (1.0 - roadStrength * 0.7);
      }
    }

    // Clamp helper
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    // Build material weights array: [grass, dirt, rock, snow, sand, cobblestone]
    const allWeights = [grassWeight, dirtWeight, rockWeight, snowWeight, sandWeight, cobblestoneWeight]
      .map((w, i) => ({ index: i, weight: clamp01(w) }));
    
    // Sort by weight descending and take top 4 (shader limit)
    allWeights.sort((a, b) => b.weight - a.weight);
    const top4 = allWeights.slice(0, 4);
    const totalWeight = top4.reduce((sum, m) => sum + m.weight, 0);

    // Normalize weights or fallback to pure grass
    if (totalWeight < 0.01) {
      return { indices: [0, 1, 2, 3], weights: [1, 0, 0, 0] };
    }

    for (let i = 0; i < 4; i++) {
      materials[i] = top4[i].index;
      weights[i] = top4[i].weight / totalWeight;
    }

    return {
      indices: materials as [number, number, number, number],
      weights: weights as [number, number, number, number],
    };
  }

  getHeightAt(worldX: number, worldZ: number): number {
    // Ensure noise generator is initialized even if init()/start() haven't run yet
    if (!this.noise) {
      this.noise = new NoiseGenerator(this.computeSeedFromWorldId());
      if (!this.biomeCenters || this.biomeCenters.length === 0) {
        this.initializeBiomeCenters();
      }
    }

    // Get biome for height modulation
    const biome = this.getBiomeAtWorldPosition(worldX, worldZ);
    const biomeMultiplier = this.CONFIG.BIOME_HEIGHT_MULTIPLIERS[biome] ?? 0.5;

    // =========================================================
    // MULTI-LAYERED TERRAIN GENERATION
    // Creates gentle rolling hills with very occasional peaks
    // =========================================================

    // Layer 1: Base terrain - large gentle undulations
    const baseScale = 0.002;
    const baseNoise = this.noise.fractal2D(
      worldX * baseScale,
      worldZ * baseScale,
      3,
      0.6,
      2.0,
    );

    // Layer 2: Rolling hills - primary terrain variation
    const hillScale = 0.008;
    const hillNoise = this.noise.fractal2D(
      worldX * hillScale,
      worldZ * hillScale,
      4,
      0.55,
      2.1,
    );

    // Layer 3: Gentle bumps - small-scale variation
    const bumpScale = 0.025;
    const bumpNoise = this.noise.fractal2D(
      worldX * bumpScale,
      worldZ * bumpScale,
      2,
      0.4,
      2.3,
    );

    // Layer 4: Fine detail - surface texture
    const detailScale = 0.06;
    const detailNoise = this.noise.simplex2D(
      worldX * detailScale,
      worldZ * detailScale,
    );

    // =========================================================
    // VERY OCCASIONAL MOUNTAIN PEAKS
    // Uses cellular noise to create rare, isolated peaks
    // =========================================================
    
    // Check for mountain occurrence (rare peaks)
    const mountainCheckScale = 0.0008;
    const mountainCellular = this.noise.cellular2D(
      worldX * mountainCheckScale,
      worldZ * mountainCheckScale,
      0.7,
    );
    
    // Only create peaks in small percentage of world
    const isMountainPeak = mountainCellular < this.CONFIG.MOUNTAIN_RARITY;
    
    // Mountain peak height (if applicable)
    let peakContribution = 0;
    if (isMountainPeak && (biome === "mountains" || biome === "tundra")) {
      const peakIntensity = 1.0 - (mountainCellular / this.CONFIG.MOUNTAIN_RARITY);
      const ridgeNoise = this.noise.ridgeNoise2D(worldX * 0.004, worldZ * 0.004);
      peakContribution = peakIntensity * ridgeNoise * 0.8;
    }

    // =========================================================
    // LAKE AND WATER DEPRESSIONS
    // Creates natural lakes using cellular noise
    // =========================================================
    
    const lakeScale = 0.003;
    const lakeCellular = this.noise.cellular2D(
      worldX * lakeScale + 100,
      worldZ * lakeScale + 100,
      0.6,
    );
    
    // Lakes form in low cellular areas (near cell centers)
    const isLakeArea = lakeCellular < 0.2 && (biome === "lakes" || biome === "swamp" || biome === "valley");
    let lakeDepression = 0;
    if (lakeCellular < 0.25) {
      const lakeDepth = (0.25 - lakeCellular) / 0.25;
      lakeDepression = lakeDepth * 0.4; // Depress terrain for lakes
    }

    // =========================================================
    // COMBINE ALL LAYERS
    // =========================================================

    // Base height from layers (mostly gentle, some variation)
    let height = 0;
    height += baseNoise * 0.25;        // Large gentle undulations
    height += hillNoise * 0.45;        // Primary rolling hills
    height += bumpNoise * 0.18;        // Gentle bumps
    height += detailNoise * 0.05;      // Fine surface detail
    height += peakContribution * 0.4;  // Rare mountain peaks

    // Normalize to [0, 1] range
    height = (height + 1) * 0.5;
    height = Math.max(0, Math.min(1, height));

    // Apply biome-specific height curve
    // Plains/valley: very gentle (pow 1.0-1.1)
    // Mountains: allow peaks (pow 1.3-1.5)
    const curvePower = biome === "mountains" ? 1.4 : biome === "tundra" ? 1.2 : 1.05;
    height = Math.pow(height, curvePower);

    // Apply biome height multiplier
    height *= biomeMultiplier;

    // Apply lake depression
    if (isLakeArea || lakeDepression > 0.1) {
      height *= (1.0 - lakeDepression);
    }

    // Scale to actual world height
    let finalHeight = height * this.CONFIG.MAX_HEIGHT;

    // Ensure minimum height above water for non-lake areas
    if (!isLakeArea && finalHeight > this.CONFIG.WATER_THRESHOLD - 1) {
      // Keep some terrain just above water level
      finalHeight = Math.max(finalHeight, this.CONFIG.WATER_THRESHOLD + 0.5);
    }

    // Lakes should go below water threshold
    if (isLakeArea) {
      finalHeight = Math.min(finalHeight, this.CONFIG.WATER_THRESHOLD - 1);
    }

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

  /**
   * Compute base height without biome influence to avoid circular dependency.
   * This uses only noise functions and doesn't call getBiomeAtWorldPosition.
   */
  private getBaseHeightAt(worldX: number, worldZ: number): number {
    // Ensure noise generator is initialized
    if (!this.noise) {
      this.noise = new NoiseGenerator(this.computeSeedFromWorldId());
    }
    
    // Base terrain - large gentle undulations
    const baseScale = 0.002;
    const baseNoise = this.noise.fractal2D(worldX * baseScale, worldZ * baseScale, 3, 0.6, 2.0);
    
    // Rolling hills - primary terrain variation
    const hillScale = 0.008;
    const hillNoise = this.noise.fractal2D(worldX * hillScale, worldZ * hillScale, 4, 0.55, 2.1);
    
    // Gentle bumps - small-scale variation
    const bumpScale = 0.025;
    const bumpNoise = this.noise.fractal2D(worldX * bumpScale, worldZ * bumpScale, 2, 0.4, 2.3);
    
    // Fine detail - surface texture
    const detailScale = 0.06;
    const detailNoise = this.noise.simplex2D(worldX * detailScale, worldZ * detailScale);
    
    // Combine layers
    return (
      baseNoise * 0.4 +
      hillNoise * 0.35 +
      bumpNoise * 0.15 +
      detailNoise * 0.1
    );
  }

  private getBiomeInfluencesAtPosition(
    worldX: number,
    worldZ: number,
  ): Array<{ type: string; weight: number }> {
    // Use base height to avoid circular dependency with getHeightAt
    const baseHeight = this.getBaseHeightAt(worldX, worldZ);
    // Normalize: baseHeight is roughly -1 to 1, scale to 0-1 range
    const normalizedHeight = (baseHeight + 1) / 2;

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
      Logger.systemWarn(
        "TerrainSystem",
        `BIOMES[${tile.biome}] not found - using fallback`,
        {
          biome: tile.biome,
          availableBiomes: Object.keys(BIOMES),
        },
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
      Logger.systemWarn(
        "TerrainSystem",
        `No heightfields for tile ${tile.key}`,
      );
      return;
    }

    Logger.system(
      "TerrainSystem",
      `Generating resources for tile ${tile.key}, biome: ${tile.biome}, resources: [${biomeData.resources.join(", ")}]`,
    );
    this.generateTreesForTile(tile, biomeData, heightfields);
    this.generateRocksForTile(tile, biomeData, heightfields);
    this.generateOtherResourcesForTile(tile, biomeData);
    this.generateGrassForTile(tile, biomeData);
    Logger.system(
      "TerrainSystem",
      `Generated ${tile.resources.length} resources for tile ${tile.key}`,
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
              const _scale =
                0.85 + this.noise.scaleNoise(worldX, worldZ) * 0.25;
              const _rotation = this.noise.rotationNoise(worldX, worldZ);

              // PERFORMANCE: Use plain objects instead of THREE types
              tile.resources.push({
                id: `${tile.key}_rock_${cx}_${cz}_${i}`,
                type: "rock",
                position: {
                  x: worldX - tile.x * this.CONFIG.TILE_SIZE,
                  y: heightfield.height,
                  z: worldZ - tile.z * this.CONFIG.TILE_SIZE,
                },
                mesh: null,
                health: 100,
                maxHealth: 100,
                respawnTime: 300000,
                harvestable: true,
                requiredLevel: 1,
              } as ResourceNode);

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

      const _scale = 0.8 + rng() * 0.2;
      const _rotation = rng() * Math.PI * 2;

      // PERFORMANCE: Use plain objects instead of THREE types
      tile.resources.push({
        id: `${tile.key}_stone_${cx}_${cz}_${i}`,
        type: "stone",
        position: {
          x: stoneX - tile.x * this.CONFIG.TILE_SIZE,
          y: stoneHeight,
          z: stoneZ - tile.z * this.CONFIG.TILE_SIZE,
        },
        mesh: null,
        health: 50,
        maxHealth: 50,
        respawnTime: 180000,
        harvestable: true,
        requiredLevel: 1,
      } as ResourceNode);
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
      biomeData as unknown as { [key: string]: unknown },
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
  }

  update(_deltaTime: number): void {
    // Process queued tile generations within a small per-frame budget
    this.processTileGenerationQueue();

    // Process queued collision generation on the server
    if (this.world.network?.isServer) {
      this.processCollisionGenerationQueue();
    }

    // Update instance visibility on client
    if (this.world.network?.isClient && this.instancedMeshManager) {
      this.instancedMeshManager.updateAllInstanceVisibility();
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
        // Optimize: reuse array and push elements directly instead of spreading
        this._reusableWaterMeshes.length = 0;
        for (const tile of this.terrainTiles.values()) {
          if (tile.waterMeshes) {
            const waterMeshes = tile.waterMeshes;
            for (let i = 0; i < waterMeshes.length; i++) {
              this._reusableWaterMeshes.push(waterMeshes[i]);
            }
          }
        }
        this.waterSystem.update(dt, this._reusableWaterMeshes);
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

    // Clean up water meshes (dispose geometry only - material is shared across all tiles)
    if (tile.waterMeshes) {
      for (const waterMesh of tile.waterMeshes) {
        if (waterMesh.parent) {
          waterMesh.parent.remove(waterMesh);
        }
        waterMesh.geometry.dispose();
        // Note: Do NOT dispose material - it's shared via WaterSystem.sharedMaterial
      }
      tile.waterMeshes = [];
    }

    // Clean up grass meshes (dispose geometry only - material is shared)
    const grassMeshes = (tile as { grassMeshes?: THREE.InstancedMesh[] })
      .grassMeshes;
    if (grassMeshes) {
      for (const grassMesh of grassMeshes) {
        if (grassMesh.parent) {
          grassMesh.parent.remove(grassMesh);
        }
        grassMesh.geometry.dispose();
        // Note: Do NOT dispose material - it's shared via GrassSystem.grassMaterial
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
    // FIRST: Check water threshold - must be checked before biome data
    // to ensure underwater positions are marked non-walkable even if biome data is missing
    const height = this.getHeightAt(worldX, worldZ);
    if (height < this.CONFIG.WATER_THRESHOLD) {
      return { walkable: false, reason: "Water bodies are impassable" };
    }

    const tileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
    const tileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);
    const biome = this.getBiomeAt(tileX, tileZ);
    const biomeData = BIOMES[biome];

    // Guard against missing biome data
    if (!biomeData) {
      return { walkable: true }; // Default to walkable if biome data missing
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
   * Generate water meshes for low areas
   * Water geometry is shaped to only cover actual underwater terrain
   */
  private generateWaterMeshes(tile: TerrainTile): void {
    if (!this.waterSystem) return;

    // Pass height function so water mesh can be shaped to underwater areas only
    // Water will only be created where terrain is below WATER_THRESHOLD
    // Geometry is shaped to match shorelines (not a full rectangle)
    const waterMesh = this.waterSystem.generateWaterMesh(
      tile,
      this.CONFIG.WATER_THRESHOLD,
      this.CONFIG.TILE_SIZE,
      (worldX: number, worldZ: number) => this.getHeightAt(worldX, worldZ),
    );

    // waterMesh is null if no underwater areas exist
    if (waterMesh && tile.mesh) {
      tile.mesh.add(waterMesh);
      tile.waterMeshes.push(waterMesh);
    }
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
      // Single-pass min/max calculation to avoid 4 array allocations + spreads
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      let hasUnderwater = false;

      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        if (s.underwater) {
          hasUnderwater = true;
          if (s.x < minX) minX = s.x;
          if (s.x > maxX) maxX = s.x;
          if (s.z < minZ) minZ = s.z;
          if (s.z > maxZ) maxZ = s.z;
        }
      }

      if (hasUnderwater) {
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
   * Check if position is near a road using noise-based road detection
   */
  private isPositionNearRoad(
    worldX: number,
    worldZ: number,
    _minDistance: number,
  ): boolean {
    // Use same noise-based road detection as material calculation
    const roadNoise1 = this.noise.ridgeNoise2D(worldX * 0.008, worldZ * 0.008);
    const roadNoise2 = this.noise.ridgeNoise2D(worldX * 0.012 + 50, worldZ * 0.012 + 50);
    const combinedRoadNoise = (roadNoise1 + roadNoise2 * 0.6) / 1.6;
    
    // Road threshold matching material calculation
    const roadThreshold = 0.78;
    return combinedRoadNoise > roadThreshold;
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
      // Use '_' separator, not ','
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

  /**
   * Get the water threshold height
   * Terrain below this height is considered underwater
   */
  getWaterThreshold(): number {
    return this.CONFIG.WATER_THRESHOLD;
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

  /**
   * Clean up all terrain resources and intervals
   */
  destroy(): void {
    // Clear all intervals to prevent memory leaks
    if (this.terrainUpdateIntervalId) {
      clearInterval(this.terrainUpdateIntervalId);
      this.terrainUpdateIntervalId = undefined;
    }
    if (this.serializationIntervalId) {
      clearInterval(this.serializationIntervalId);
      this.serializationIntervalId = undefined;
    }
    if (this.boundingBoxIntervalId) {
      clearInterval(this.boundingBoxIntervalId);
      this.boundingBoxIntervalId = undefined;
    }
    if (this.chunkSaveInterval) {
      clearInterval(this.chunkSaveInterval);
      this.chunkSaveInterval = undefined;
    }

    // Unload all tiles
    for (const tile of this.terrainTiles.values()) {
      this.unloadTile(tile);
    }
    this.terrainTiles.clear();

    // Dispose grass system
    if (this.grassSystem) {
      this.grassSystem.dispose();
    }

    // Dispose water system
    if (this.waterSystem) {
      this.waterSystem.dispose();
    }

    // Dispose instanced mesh manager
    if (this.instancedMeshManager) {
      this.instancedMeshManager.dispose();
    }

    // Dispose texture atlas
    if (this.textureAtlasManager) {
      this.textureAtlasManager.dispose();
    }

    // Remove terrain container from scene
    if (this.terrainContainer && this.terrainContainer.parent) {
      this.terrainContainer.parent.remove(this.terrainContainer);
    }

    // Clear pending queues
    this.pendingTileKeys.length = 0;
    this.pendingTileSet.clear();
    this.pendingCollisionKeys.length = 0;
    this.pendingCollisionSet.clear();
    this.activeChunks.clear();
    this.biomeCenters.length = 0;

    this._terrainInitialized = false;
    this._initialTilesReady = false;
  }
}
