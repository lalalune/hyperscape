/**
 * VegetationSystem.ts - GPU Instanced Vegetation Rendering
 *
 * Provides efficient rendering of vegetation (trees, bushes, grass, flowers, rocks)
 * using Three.js InstancedMesh for batched GPU rendering.
 *
 * **Features:**
 * - GPU-instanced rendering for thousands of vegetation objects in few draw calls
 * - Procedural placement based on biome vegetation configuration
 * - Automatic LOD culling based on player distance
 * - Deterministic placement using seeded PRNG (same vegetation on client/server)
 * - Per-tile vegetation generation synced with terrain system
 * - Noise-based distribution for natural-looking placement
 * - Clustering support for natural groupings of vegetation
 *
 * **Performance:**
 * - Each vegetation type renders in a single draw call via InstancedMesh
 * - Dynamic visibility culling shows closest N instances
 * - Tile-based generation/unloading tied to terrain system
 *
 * **Integration:**
 * - Listens to TerrainSystem tile events for generation triggers
 * - Uses biome vegetation config from biomes.json
 * - Loads asset definitions from vegetation.json manifest
 *
 * **Runs on:** Client only (vegetation is purely visual)
 */

import * as THREE from "../../../extras/three/three";
import { System } from "../infrastructure/System";
import type { World, WorldOptions } from "../../../types";
import type {
  VegetationAsset,
  VegetationLayer,
  VegetationInstance,
  BiomeVegetationConfig,
} from "../../../types/world/world-types";
import { EventType } from "../../../types/events";
import { modelCache } from "../../../utils/rendering/ModelCache";
import { NoiseGenerator } from "../../../utils/NoiseGenerator";
import {
  createGPUVegetationMaterial,
  type GPUVegetationMaterial,
} from "./GPUVegetation";
import { csmLevels } from "./Environment";
import type { RoadNetworkSystem } from "./RoadNetworkSystem";

/**
 * Vegetation rendering configuration.
 *
 * CULLING HIERARCHY (most to least aggressive):
 * 1. CPU Tile Loading: Only generate vegetation for tiles within MAX_VEGETATION_TILE_RADIUS
 * 2. CPU Chunk Visibility: Hide chunks beyond CHUNK_RENDER_DISTANCE or outside camera frustum
 * 3. GPU Shader Fade: Dissolve individual instances between FADE_START and FADE_END
 *
 * IMPORTANT: Vegetation fade must happen BEFORE shadow cutoff to avoid unshadowed trees!
 * Fade distances are dynamically set based on shadow quality in start()
 */
const VEGETATION_CHUNK_SIZE = 64; // meters per chunk
const MAX_INSTANCES_PER_CHUNK = 256;

// Default fade distances - will be overridden by shadow quality settings
// These are used if shadow quality can't be determined
let FADE_START = 180; // Shader fade begins (fully opaque inside)
let FADE_END = 200; // Shader fully culls (invisible beyond)
let CHUNK_RENDER_DISTANCE = 300; // CPU hides chunks (buffer zone for loading)
let CHUNK_RENDER_DISTANCE_SQ = CHUNK_RENDER_DISTANCE * CHUNK_RENDER_DISTANCE;

// Bounding sphere buffer to account for model heights and scale variations
// Trees can be 15-20m tall with 1.0-1.5x scale, so need generous buffer
const BOUNDING_SPHERE_BUFFER = 40;

/**
 * Chunked instanced mesh - one per spatial chunk per asset type
 */
interface ChunkedInstancedMesh {
  /** The InstancedMesh for this chunk */
  mesh: THREE.InstancedMesh;
  /** Current instance count */
  count: number;
  /** Instance attributes */
  positionAttr: THREE.InstancedBufferAttribute;
  scaleAttr: THREE.InstancedBufferAttribute;
  rotationAttr: THREE.InstancedBufferAttribute;
  /** Chunk world bounds (for bounding sphere) */
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/**
 * Asset data - tracks geometry/material for a loaded GLB (shared across chunks)
 */
interface AssetData {
  /** The GLB geometry */
  geometry: THREE.BufferGeometry;
  /** Material(s) from the model */
  material: THREE.Material | THREE.Material[];
  /** Asset definition */
  asset: VegetationAsset;
  /** Y offset to lift model so its base sits on terrain */
  modelBaseOffset: number;
  /** GPU material (shared across all chunks) */
  gpuMaterial: GPUVegetationMaterial;
}

/**
 * Instanced asset data - tracks one InstancedMesh per loaded GLB
 * @deprecated Use chunked system instead
 */
interface InstancedAssetData {
  /** The GLB model scene (cloned for instancing) */
  geometry: THREE.BufferGeometry;
  /** Material(s) from the model */
  material: THREE.Material | THREE.Material[];
  /** The InstancedMesh for GPU batching */
  instancedMesh: THREE.InstancedMesh;
  /** Map from instance ID to matrix index */
  instanceMap: Map<string, number>;
  /** Reverse map: matrix index to instance data */
  instances: VegetationInstance[];
  /** Maximum instances this mesh can hold */
  maxInstances: number;
  /** Current active instance count */
  activeCount: number;
  /** Asset definition */
  asset: VegetationAsset;
  /** Y offset to lift model so its base sits on terrain (computed from bounding box) */
  modelBaseOffset: number;

  /** GPU instance attributes (shader handles all transforms) */
  gpuMaterial?: GPUVegetationMaterial;
  positionAttr?: THREE.InstancedBufferAttribute;
  scaleAttr?: THREE.InstancedBufferAttribute;
  rotationAttr?: THREE.InstancedBufferAttribute;
}

/**
 * Tile vegetation data - tracks all instances for a terrain tile
 */
interface TileVegetationData {
  /** Tile key (format: "tileX_tileZ") */
  key: string;
  /** All instances in this tile, keyed by instance ID */
  instances: Map<string, VegetationInstance>;
  /** Whether this tile's vegetation has been generated */
  generated: boolean;
  /** Biome this tile belongs to */
  biome: string;
}

/**
 * Configuration for the vegetation system
 */
interface VegetationConfig {
  /** Maximum visible instances per asset type */
  maxInstancesPerAsset: number;
  /** Distance beyond which vegetation is culled */
  cullDistance: number;
  /** Distance at which to switch to imposters (billboards) */
  imposterDistance: number;
  /** How often to update visibility (ms) */
  updateInterval: number;
  /** Minimum player movement to trigger visibility update */
  movementThreshold: number;
}

const DEFAULT_CONFIG: VegetationConfig = {
  maxInstancesPerAsset: 4096, // Power of 2 for GPU efficiency
  cullDistance: 280, // Used for tile loading - must be > fadeEnd (250m) so vegetation loads before visible
  imposterDistance: 120, // Not used in GPU mode (shader handles LOD)
  updateInterval: 100, // Not used in GPU mode
  movementThreshold: 2, // Not used in GPU mode
};

// LOD distances per category - PERFORMANCE: Simplified, shader handles fade
// fadeStart = fully opaque, fadeEnd = fully invisible
const _LOD_CONFIG = {
  tree: { fadeStart: 100, fadeEnd: 150, imposterStart: 80 },
  bush: { fadeStart: 80, fadeEnd: 120, imposterStart: 60 },
  flower: { fadeStart: 60, fadeEnd: 100, imposterStart: 40 },
  fern: { fadeStart: 60, fadeEnd: 100, imposterStart: 40 },
  rock: { fadeStart: 100, fadeEnd: 150, imposterStart: 80 },
  fallen_tree: { fadeStart: 90, fadeEnd: 130, imposterStart: 70 },
} as const;

/** Max tile distance from player to generate vegetation (in tiles, not world units) */
// PERFORMANCE: Reduced from 3 to 2 tiles - vegetation fades before this distance anyway
const MAX_VEGETATION_TILE_RADIUS = 2;

/** Water level in world units - MUST match TerrainSystem.CONFIG.WATER_THRESHOLD */
const WATER_LEVEL = 5.4;

/** Buffer distance from water edge where vegetation shouldn't spawn - generous buffer */
const WATER_EDGE_BUFFER = 6.0; // Min spawn height = 11.4 - well above any shoreline

/**
 * Imposter data for billboard rendering of distant vegetation
 */
interface ImposterData {
  /** Billboard mesh for this asset type */
  billboardMesh: THREE.InstancedMesh;
  /** Maximum billboard instances */
  maxBillboards: number;
  /** Current billboard count */
  activeCount: number;
}

/**
 * VegetationSystem - GPU Instanced Vegetation Rendering
 */
export class VegetationSystem extends System {
  private scene: THREE.Scene | null = null;
  private vegetationGroup: THREE.Group | null = null;

  // Asset management
  private assetDefinitions = new Map<string, VegetationAsset>();
  private loadedAssets = new Map<string, InstancedAssetData>();
  private pendingAssetLoads = new Set<string>();

  // CHUNKED VEGETATION - Spatial chunking for proper frustum culling
  // Key format: "chunkX_chunkZ_assetId"
  private chunkedMeshes = new Map<string, ChunkedInstancedMesh>();
  // Loaded asset data (geometry/material) shared across chunks
  private assetData = new Map<string, AssetData>();

  // Imposter (billboard) management
  private imposters = new Map<string, ImposterData>();
  private billboardGeometry: THREE.PlaneGeometry | null = null;

  // Pre-rendered imposter textures (cached per asset)
  private imposterTextures = new Map<string, THREE.Texture>();
  private imposterRenderTarget: THREE.WebGLRenderTarget | null = null;
  private imposterCamera: THREE.OrthographicCamera | null = null;
  private imposterScene: THREE.Scene | null = null;

  // Tile vegetation tracking
  private tileVegetation = new Map<string, TileVegetationData>();

  // Pending tiles that are too far from player (lazy loading queue)
  private pendingTiles = new Map<
    string,
    { tileX: number; tileZ: number; biome: string }
  >();

  // Configuration
  private config: VegetationConfig = DEFAULT_CONFIG;

  // SHARED MATERIAL - All vegetation uses ONE material for minimal draw call overhead
  // Even though we have separate InstancedMeshes per asset (can't merge without MultiDrawIndirect),
  // sharing the material eliminates shader program switches between draw calls
  private sharedVegetationMaterial: GPUVegetationMaterial | null = null;

  // Noise generator for procedural placement
  private noise: NoiseGenerator | null = null;

  // Road network system for road avoidance
  private roadNetworkSystem: RoadNetworkSystem | null = null;

  // Temp objects to avoid allocations
  private _tempMatrix = new THREE.Matrix4();
  private _tempPosition = new THREE.Vector3();
  private _tempQuaternion = new THREE.Quaternion();
  private _tempScale = new THREE.Vector3();
  private _tempEuler = new THREE.Euler();
  private _dummy = new THREE.Object3D();
  private _billboardQuat = new THREE.Quaternion();
  // Pre-allocated vectors for hot loops to avoid GC pressure
  private _yAxis = new THREE.Vector3(0, 1, 0);
  private _origin = new THREE.Vector3(0, 0, 0);
  private _lookAtMatrix = new THREE.Matrix4();

  // Frustum culling - view-dependent culling using camera frustum
  private _frustum = new THREE.Frustum();
  private _projScreenMatrix = new THREE.Matrix4();

  constructor(world: World) {
    super(world);
  }

  override getDependencies() {
    return { required: ["stage", "terrain"], optional: ["roads"] };
  }

  async init(_options?: WorldOptions): Promise<void> {
    // Client-only system
    if (!this.world.isClient || typeof window === "undefined") {
      return;
    }

    // Initialize noise generator with world seed
    const seed = this.computeSeedFromWorldId();
    this.noise = new NoiseGenerator(seed);

    // Create shared billboard geometry for imposters (1x1 plane)
    this.billboardGeometry = new THREE.PlaneGeometry(1, 1);

    // Get road network system for road avoidance
    this.roadNetworkSystem = this.world.getSystem(
      "roads",
    ) as RoadNetworkSystem | null;
  }

  /**
   * Initialize the imposter rendering system
   * Creates a render target and camera for pre-rendering models to textures
   */
  private initImposterRenderer(): void {
    if (this.imposterRenderTarget) return; // Already initialized

    // Create render target for imposter textures (256x256 with alpha)
    this.imposterRenderTarget = new THREE.WebGLRenderTarget(256, 256, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });

    // Create orthographic camera for rendering (will be adjusted per model)
    this.imposterCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

    // Create isolated scene for rendering imposters
    this.imposterScene = new THREE.Scene();
    this.imposterScene.background = null; // Transparent background

    // Add ambient light for consistent rendering
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.imposterScene.add(ambient);

    // Add directional light matching sun direction
    const dirLight = new THREE.DirectionalLight(0xfff8f0, 0.6);
    dirLight.position.set(1, 2, 1);
    this.imposterScene.add(dirLight);
  }

  /**
   * Pre-render a model to a texture for use as an imposter billboard
   */
  private preRenderImposterTexture(
    assetId: string,
    modelScene: THREE.Object3D,
  ): THREE.Texture | null {
    // Check cache first
    if (this.imposterTextures.has(assetId)) {
      return this.imposterTextures.get(assetId)!;
    }

    // Initialize renderer if needed
    this.initImposterRenderer();

    // Get the renderer from world graphics system
    const graphics = this.world.graphics as
      | { renderer?: THREE.WebGPURenderer }
      | undefined;
    const renderer = graphics?.renderer;
    if (
      !renderer ||
      !this.imposterRenderTarget ||
      !this.imposterCamera ||
      !this.imposterScene
    ) {
      return null;
    }

    // Clone the model to avoid modifying the original
    const modelClone = modelScene.clone();

    // Compute bounding box to fit camera
    const bbox = new THREE.Box3().setFromObject(modelClone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bbox.getSize(size);
    bbox.getCenter(center);

    // Position model at origin (centered)
    modelClone.position.sub(center);
    modelClone.position.y += size.y / 2; // Lift so base is at y=0

    // Add model to imposter scene
    this.imposterScene.add(modelClone);

    // Configure orthographic camera to fit the model
    const maxDim = Math.max(size.x, size.y) * 1.2; // Add 20% margin
    this.imposterCamera.left = -maxDim / 2;
    this.imposterCamera.right = maxDim / 2;
    this.imposterCamera.top = size.y * 0.6;
    this.imposterCamera.bottom = -size.y * 0.6;
    this.imposterCamera.near = 0.1;
    this.imposterCamera.far = maxDim * 4;
    this.imposterCamera.updateProjectionMatrix();

    // Position camera looking at model from front-side angle
    const cameraDistance = maxDim * 2;
    this.imposterCamera.position.set(
      cameraDistance * 0.7,
      size.y * 0.4,
      cameraDistance * 0.7,
    );
    this.imposterCamera.lookAt(0, size.y * 0.3, 0);

    // Store current renderer state
    const currentRenderTarget = renderer.getRenderTarget();
    const currentClearAlpha = renderer.getClearAlpha();
    const currentAutoClear = renderer.autoClear;

    // Render to texture
    renderer.autoClear = true;
    renderer.setClearAlpha(0); // Transparent background
    renderer.setRenderTarget(this.imposterRenderTarget);
    renderer.clear();
    renderer.render(this.imposterScene, this.imposterCamera);

    // Restore renderer state
    renderer.setRenderTarget(currentRenderTarget);
    renderer.setClearAlpha(currentClearAlpha);
    renderer.autoClear = currentAutoClear;

    // Remove model from imposter scene
    this.imposterScene.remove(modelClone);

    // Clone the texture from render target (so it persists after target is reused)
    const texture = this.imposterRenderTarget.texture.clone();
    texture.needsUpdate = true;

    // Cache the texture
    this.imposterTextures.set(assetId, texture);

    console.log(
      `[VegetationSystem] 📸 Pre-rendered imposter texture for: ${assetId}`,
    );

    return texture;
  }

  /**
   * Create imposter (billboard) mesh for an asset type
   * Uses pre-rendered textures for realistic appearance
   */
  private createImposter(
    assetId: string,
    asset: VegetationAsset,
    _material: THREE.Material | THREE.Material[],
  ): ImposterData {
    const maxBillboards = Math.floor(this.config.maxInstancesPerAsset * 0.3);

    // Try to get pre-rendered texture
    const imposterTexture = this.imposterTextures.get(assetId);

    // Create billboard material with texture or fallback to silhouette
    let billboardMaterial: THREE.Material;

    if (imposterTexture) {
      // Use pre-rendered texture - looks like the actual model
      billboardMaterial = new THREE.MeshBasicMaterial({
        map: imposterTexture,
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.NormalBlending,
        vertexColors: true, // For per-instance fading
      });
    } else {
      // Fallback: subtle silhouette (shouldn't happen if prerender succeeds)
      billboardMaterial = new THREE.MeshBasicMaterial({
        color: 0x2a4a1a,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.NormalBlending,
        vertexColors: true,
      });

      // Adjust color based on asset category
      const mat = billboardMaterial as THREE.MeshBasicMaterial;
      if (asset.category === "bush" || asset.category === "fern") {
        mat.color.setHex(0x1a3a1a);
        mat.opacity = 0.25;
      } else if (asset.category === "rock") {
        mat.color.setHex(0x4a4a4a);
        mat.opacity = 0.35;
      } else if (asset.category === "flower") {
        mat.color.setHex(0x2a4a2a);
        mat.opacity = 0.2;
      } else if (asset.category === "fallen_tree") {
        mat.color.setHex(0x3a2a1a);
        mat.opacity = 0.3;
      } else {
        mat.opacity = 0.3;
      }
    }

    const billboardMesh = new THREE.InstancedMesh(
      this.billboardGeometry!,
      billboardMaterial,
      maxBillboards,
    );

    billboardMesh.frustumCulled = false; // Disable to prevent popping
    billboardMesh.count = 0;
    billboardMesh.name = `Imposter_${assetId}`;

    // Enable instance colors for per-instance opacity/fade
    billboardMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(maxBillboards * 3),
      3,
    );

    // Initialize all colors to white (full opacity)
    for (let i = 0; i < maxBillboards; i++) {
      billboardMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }

    return {
      billboardMesh,
      maxBillboards,
      activeCount: 0,
    };
  }

  /**
   * Compute a deterministic seed from world configuration
   */
  private computeSeedFromWorldId(): number {
    const worldConfig = (this.world as { config?: { terrainSeed?: number } })
      .config;
    if (worldConfig?.terrainSeed !== undefined) {
      return worldConfig.terrainSeed;
    }

    if (typeof process !== "undefined" && process.env?.TERRAIN_SEED) {
      const envSeed = parseInt(process.env.TERRAIN_SEED, 10);
      if (!isNaN(envSeed)) {
        return envSeed;
      }
    }

    return 0; // Fixed seed for deterministic vegetation
  }

  /**
   * Load vegetation asset definitions from manifest
   */
  private async loadAssetDefinitions(): Promise<void> {
    try {
      const assetsUrl = (this.world.assetsUrl || "").replace(/\/$/, "");
      const manifestUrl = `${assetsUrl}/manifests/vegetation.json`;

      const response = await fetch(manifestUrl);
      if (!response.ok) {
        console.warn(
          `[VegetationSystem] Failed to load vegetation manifest: ${response.status}`,
        );
        return;
      }

      const manifest = (await response.json()) as {
        version: number;
        assets: VegetationAsset[];
      };

      for (const asset of manifest.assets) {
        this.assetDefinitions.set(asset.id, asset);
      }

      console.log(
        `[VegetationSystem] Loaded ${this.assetDefinitions.size} vegetation asset definitions`,
      );
    } catch (error) {
      console.error(
        "[VegetationSystem] Error loading vegetation manifest:",
        error,
      );
    }
  }

  async start(): Promise<void> {
    if (!this.world.isClient || typeof window === "undefined") return;
    if (!this.world.stage?.scene) return;

    this.scene = this.world.stage.scene as THREE.Scene;

    // Sync vegetation fade distances with shadow quality
    // Vegetation must dissolve BEFORE shadow cutoff to avoid unshadowed trees
    //
    // DISTANCE HIERARCHY (must be in this order):
    // 1. FADE_START - vegetation starts dissolving (dithering begins)
    // 2. FADE_END - vegetation fully dissolved (invisible)
    // 3. Shadow maxFar - shadows end (must be >= FADE_END to avoid unshadowed trees!)
    // 4. CHUNK_RENDER_DISTANCE - chunks become visible (must be > FADE_END for dissolve to work)
    const shadowsLevel = (this.world.prefs?.shadows as string) || "med";
    const csmConfig =
      csmLevels[shadowsLevel as keyof typeof csmLevels] || csmLevels.med;
    const shadowMaxFar = csmConfig.maxFar;

    // Sync fade distances with shadow range
    // Vegetation fully dissolves AT shadow maxFar so we never see unshadowed trees
    FADE_END = shadowMaxFar; // Fully dissolved at shadow cutoff
    FADE_START = shadowMaxFar * 0.9; // Start dissolving at 90% of shadow range
    CHUNK_RENDER_DISTANCE = shadowMaxFar * 1.2; // Chunks visible 20% beyond shadow range
    CHUNK_RENDER_DISTANCE_SQ = CHUNK_RENDER_DISTANCE * CHUNK_RENDER_DISTANCE;

    console.log(
      `[VegetationSystem] Synced with shadows "${shadowsLevel}": fade ${FADE_START.toFixed(0)}-${FADE_END.toFixed(0)}m, chunks ${CHUNK_RENDER_DISTANCE.toFixed(0)}m`,
    );

    // Load vegetation asset definitions now that world.assetsUrl is set
    await this.loadAssetDefinitions();

    // Create root group for all vegetation
    this.vegetationGroup = new THREE.Group();
    this.vegetationGroup.name = "VegetationSystem";
    this.vegetationGroup.frustumCulled = false; // Disable culling on group
    this.scene.add(this.vegetationGroup);

    // Create SHARED material for all vegetation (reduces shader switches)
    // All vegetation uses vertex colors, so one material works for everything
    // Simple distance culling - no expensive LOD scaling
    this.sharedVegetationMaterial = createGPUVegetationMaterial({
      vertexColors: true,
      alphaTest: 0.5,
      fadeStart: FADE_START,
      fadeEnd: FADE_END,
    });
    console.log(
      `[VegetationSystem] Created shared material (fade: ${FADE_START.toFixed(0)}-${FADE_END.toFixed(0)}m, chunks: ${CHUNK_RENDER_DISTANCE.toFixed(0)}m)`,
    );

    // PERFORMANCE: Enable layer 1 for main camera so it can see vegetation
    // Minimap camera only sees layer 0, so vegetation won't render in minimap
    if (this.world.camera) {
      this.world.camera.layers.enable(1);
    }

    // Listen for terrain tile events
    this.world.on(
      EventType.TERRAIN_TILE_GENERATED,
      this.onTileGenerated.bind(this),
    );
    this.world.on(
      EventType.TERRAIN_TILE_UNLOADED,
      this.onTileUnloaded.bind(this),
    );

    console.log(
      `[VegetationSystem] ✅ Started with ${this.assetDefinitions.size} assets, radius=${MAX_VEGETATION_TILE_RADIUS} tiles`,
    );

    // Process existing terrain tiles that were generated before we subscribed
    await this.processExistingTiles();
  }

  /**
   * Process terrain tiles that already exist when VegetationSystem starts
   * Only processes tiles near the player for performance
   */
  private async processExistingTiles(): Promise<void> {
    const terrainSystemRaw = this.world.getSystem("terrain");
    if (!terrainSystemRaw) return;

    // Type assertion for terrain system - use the public getTiles() method
    const terrainSystem = terrainSystemRaw as unknown as {
      getTiles?: () => Map<string, { x: number; z: number; biome: string }>;
      CONFIG?: { TILE_SIZE: number };
    };

    if (!terrainSystem.getTiles) return;

    const tileSize = terrainSystem.CONFIG?.TILE_SIZE || 100;
    const playerPos = this.getPlayerPosition();
    const playerTileX = playerPos ? Math.floor(playerPos.x / tileSize) : 0;
    const playerTileZ = playerPos ? Math.floor(playerPos.z / tileSize) : 0;

    const tiles = terrainSystem.getTiles();
    const allTiles = Array.from(tiles.entries()).map(([_key, tile]) => ({
      tileX: tile.x,
      tileZ: tile.z,
      biome: tile.biome || "plains",
    }));

    // Separate into nearby tiles (generate now) and distant tiles (lazy load later)
    const nearbyTiles: typeof allTiles = [];
    const distantTiles: typeof allTiles = [];

    for (const tile of allTiles) {
      const dx = Math.abs(tile.tileX - playerTileX);
      const dz = Math.abs(tile.tileZ - playerTileZ);
      if (Math.max(dx, dz) <= MAX_VEGETATION_TILE_RADIUS) {
        nearbyTiles.push(tile);
      } else {
        distantTiles.push(tile);
      }
    }

    // Sort nearby by distance (closest first)
    nearbyTiles.sort((a, b) => {
      const distA = Math.max(
        Math.abs(a.tileX - playerTileX),
        Math.abs(a.tileZ - playerTileZ),
      );
      const distB = Math.max(
        Math.abs(b.tileX - playerTileX),
        Math.abs(b.tileZ - playerTileZ),
      );
      return distA - distB;
    });

    // Process nearby tiles immediately
    for (const tile of nearbyTiles) {
      await this.onTileGenerated(tile);
    }

    // Queue distant tiles for lazy loading
    for (const tile of distantTiles) {
      this.pendingTiles.set(`${tile.tileX}_${tile.tileZ}`, tile);
    }

    console.log(
      `[VegetationSystem] 🌲 Processed ${nearbyTiles.length} nearby tiles, ${distantTiles.length} queued for lazy loading`,
    );
  }

  /**
   * Get player's current tile coordinates
   */
  private getPlayerTile(): { x: number; z: number } | null {
    const terrainSystemRaw = this.world.getSystem("terrain");
    const tileSize =
      (terrainSystemRaw as unknown as { CONFIG?: { TILE_SIZE: number } })
        ?.CONFIG?.TILE_SIZE || 100;

    const playerPos = this.getPlayerPosition();
    if (!playerPos) return null;

    return {
      x: Math.floor(playerPos.x / tileSize),
      z: Math.floor(playerPos.z / tileSize),
    };
  }

  /**
   * Check if a tile is within vegetation generation range of the player
   */
  private isTileInRange(tileX: number, tileZ: number): boolean {
    const playerTile = this.getPlayerTile();
    if (!playerTile) return true; // Generate if we can't determine player position

    const dx = Math.abs(tileX - playerTile.x);
    const dz = Math.abs(tileZ - playerTile.z);
    return Math.max(dx, dz) <= MAX_VEGETATION_TILE_RADIUS;
  }

  /**
   * Handle terrain tile generation - spawn vegetation for the tile
   * Only generates vegetation if the tile is within range of the player
   */
  private async onTileGenerated(data: {
    tileX: number;
    tileZ: number;
    biome: string;
  }): Promise<void> {
    const key = `${data.tileX}_${data.tileZ}`;

    // Skip if already generated
    if (this.tileVegetation.has(key)) {
      return;
    }

    // Skip if tile is too far from player (lazy loading)
    if (!this.isTileInRange(data.tileX, data.tileZ)) {
      // Store as pending for later generation when player gets closer
      this.pendingTiles.set(key, data);
      return;
    }

    // Get biome vegetation configuration for trees/bushes/etc
    const biomeConfig = await this.getBiomeVegetationConfig(data.biome);

    if (!biomeConfig || !biomeConfig.enabled) {
      // Still remove from pending even if no other vegetation
      this.pendingTiles.delete(key);
      return;
    }

    // Create tile vegetation data
    const tileData: TileVegetationData = {
      key,
      instances: new Map(),
      generated: false,
      biome: data.biome,
    };
    this.tileVegetation.set(key, tileData);

    // Generate vegetation instances for this tile (trees, bushes, etc)
    await this.generateTileVegetation(data.tileX, data.tileZ, biomeConfig);
    tileData.generated = true;

    console.log(
      `[VegetationSystem] 🌲 Tile ${key} vegetation: ${tileData.instances.size} instances`,
    );

    // Remove from pending if it was there
    this.pendingTiles.delete(key);
  }

  /**
   * Handle terrain tile unload - remove vegetation instances
   */
  private onTileUnloaded(data: { tileX: number; tileZ: number }): void {
    const key = `${data.tileX}_${data.tileZ}`;
    const tileData = this.tileVegetation.get(key);

    if (tileData) {
      // Remove all instances for this tile
      for (const instance of tileData.instances.values()) {
        this.removeInstance(instance);
      }
      this.tileVegetation.delete(key);
    }
  }

  /**
   * Get biome vegetation configuration from BIOMES data
   */
  private async getBiomeVegetationConfig(
    biomeId: string,
  ): Promise<BiomeVegetationConfig | null> {
    // Access BIOMES data through the terrain system or data manager
    const terrainSystem = this.world.getSystem("terrain") as {
      getBiomeData?: (id: string) => { vegetation?: BiomeVegetationConfig };
    };

    if (terrainSystem?.getBiomeData) {
      const biomeData = terrainSystem.getBiomeData(biomeId);
      return biomeData?.vegetation ?? null;
    }

    // Fallback: try to get from global BIOMES using dynamic import
    try {
      const worldStructure = await import("../../../data/world-structure");
      const biome = worldStructure.BIOMES[biomeId];
      return biome?.vegetation ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Generate vegetation instances for a terrain tile
   */
  private async generateTileVegetation(
    tileX: number,
    tileZ: number,
    config: BiomeVegetationConfig,
  ): Promise<void> {
    const tileKey = `${tileX}_${tileZ}`;
    const tileData = this.tileVegetation.get(tileKey);
    if (!tileData) return;

    // Generate vegetation for each layer

    const terrainSystemRaw = this.world.getSystem("terrain");
    if (!terrainSystemRaw) {
      console.warn("[VegetationSystem] TerrainSystem not available");
      return;
    }

    // Type assertion through unknown to satisfy TypeScript
    const terrainSystem = terrainSystemRaw as unknown as {
      getHeightAt: (x: number, z: number) => number;
      getNormalAt?: (x: number, z: number) => THREE.Vector3;
      getTileSize: () => number;
    };

    if (!terrainSystem.getHeightAt) {
      console.warn("[VegetationSystem] TerrainSystem missing getHeightAt");
      return;
    }

    const tileSize = terrainSystem.getTileSize();
    const tileWorldX = tileX * tileSize;
    const tileWorldZ = tileZ * tileSize;

    // Process each vegetation layer
    for (const layer of config.layers) {
      await this.generateLayerVegetation(
        tileKey,
        tileWorldX,
        tileWorldZ,
        tileSize,
        layer,
        terrainSystem,
      );
    }

    // Finalize all chunks - update bounding spheres for proper frustum culling
    this.finalizeAllChunks();
  }

  /**
   * Generate vegetation for a single layer within a tile
   */
  private async generateLayerVegetation(
    tileKey: string,
    tileWorldX: number,
    tileWorldZ: number,
    tileSize: number,
    layer: VegetationLayer,
    terrainSystem: {
      getHeightAt: (x: number, z: number) => number;
      getNormalAt?: (x: number, z: number) => THREE.Vector3;
    },
  ): Promise<void> {
    const tileData = this.tileVegetation.get(tileKey);
    if (!tileData) return;

    // Compute number of instances to generate based on density
    const targetCount = Math.floor(layer.density * (tileSize / 100) ** 2);

    // Create deterministic RNG for this tile/layer
    const rng = this.createTileLayerRng(tileKey, layer.category);

    // Get valid asset definitions for this layer
    const validAssets = layer.assets
      .map((id) => this.assetDefinitions.get(id))
      .filter((a): a is VegetationAsset => a !== undefined);

    if (validAssets.length === 0) {
      return;
    }

    // Calculate total weight for weighted random selection
    const totalWeight = validAssets.reduce((sum, a) => sum + a.weight, 0);

    // Generate candidate positions with clustering support
    const positions = this.generatePlacementPositions(
      tileWorldX,
      tileWorldZ,
      tileSize,
      targetCount,
      layer,
      rng,
    );

    // Bind getHeightAt to preserve context (needed for internal state access)
    const getHeight = terrainSystem.getHeightAt.bind(terrainSystem);

    // Place instances at valid positions
    let placedCount = 0;
    for (const pos of positions) {
      if (placedCount >= targetCount) break;

      // Get terrain height at position
      const height = getHeight(pos.x, pos.z);

      // Check height constraints
      if (layer.minHeight !== undefined && height < layer.minHeight) continue;
      if (layer.maxHeight !== undefined && height > layer.maxHeight) continue;

      // Check water avoidance - ALWAYS avoid water unless explicitly disabled
      // layer.avoidWater defaults to true if not specified
      const shouldAvoidWater = layer.avoidWater !== false;
      const waterThreshold = WATER_LEVEL + WATER_EDGE_BUFFER;
      if (shouldAvoidWater && height < waterThreshold) {
        continue;
      }

      // Check road avoidance - never place vegetation on roads
      if (
        this.roadNetworkSystem &&
        this.roadNetworkSystem.isOnRoad(pos.x, pos.z)
      ) {
        continue;
      }

      // Calculate slope once for all checks
      const slope = this.estimateSlope(pos.x, pos.z, getHeight);

      // Check slope constraints
      if (layer.avoidSteepSlopes) {
        if (slope > 0.6) continue; // Skip steep slopes
      }

      // Select asset based on weighted random
      const asset = this.selectWeightedAsset(validAssets, totalWeight, rng);
      if (!asset) continue;

      // Check asset-specific slope constraints
      if (asset.minSlope !== undefined && slope < asset.minSlope) continue;
      if (asset.maxSlope !== undefined && slope > asset.maxSlope) continue;

      // Calculate instance transform
      const scale =
        asset.baseScale *
        (asset.scaleVariation[0] +
          rng() * (asset.scaleVariation[1] - asset.scaleVariation[0]));

      const rotationY = asset.randomRotation ? rng() * Math.PI * 2 : 0;
      let rotationX = 0;
      let rotationZ = 0;

      // Align to terrain normal if requested
      if (asset.alignToNormal && terrainSystem.getNormalAt) {
        const normal = terrainSystem.getNormalAt(pos.x, pos.z);
        // Calculate rotation to align with normal (using pre-allocated objects)
        this._tempEuler.setFromRotationMatrix(
          this._lookAtMatrix.lookAt(this._origin, normal, this._yAxis),
        );
        rotationX = this._tempEuler.x;
        rotationZ = this._tempEuler.z;
      }

      // Create instance
      const instance: VegetationInstance = {
        id: `${tileKey}_${layer.category}_${placedCount}`,
        assetId: asset.id,
        category: layer.category,
        position: {
          x: pos.x,
          y: height + (asset.yOffset ?? 0),
          z: pos.z,
        },
        rotation: { x: rotationX, y: rotationY, z: rotationZ },
        scale,
        tileKey,
      };

      // Add instance to tile data
      tileData.instances.set(instance.id, instance);

      // Add to instanced mesh (will load asset if needed)
      await this.addInstance(instance);

      placedCount++;
    }
  }

  /**
   * Generate placement positions with optional clustering
   */
  private generatePlacementPositions(
    tileWorldX: number,
    tileWorldZ: number,
    tileSize: number,
    targetCount: number,
    layer: VegetationLayer,
    rng: () => number,
  ): Array<{ x: number; z: number }> {
    const positions: Array<{ x: number; z: number }> = [];
    const noiseScale = layer.noiseScale ?? 0.05;
    const noiseThreshold = layer.noiseThreshold ?? 0.3;
    const minSpacing = layer.minSpacing;

    // Generate more candidates than needed, then filter
    const candidateMultiplier = 3;
    const maxCandidates = targetCount * candidateMultiplier;

    for (let i = 0; i < maxCandidates && positions.length < targetCount; i++) {
      let x: number;
      let z: number;

      if (layer.clustering && layer.clusterSize) {
        // Clustering: generate cluster centers, then scatter around them
        const clusterCount = Math.max(
          1,
          Math.floor(targetCount / layer.clusterSize),
        );
        const clusterIndex = Math.floor(rng() * clusterCount);

        // Deterministic cluster center
        const clusterRng = this.createTileLayerRng(
          `${tileWorldX}_${tileWorldZ}_cluster_${clusterIndex}`,
          layer.category,
        );
        const clusterCenterX =
          tileWorldX + tileSize * 0.1 + clusterRng() * tileSize * 0.8;
        const clusterCenterZ =
          tileWorldZ + tileSize * 0.1 + clusterRng() * tileSize * 0.8;

        // Scatter around cluster center with Gaussian-like distribution
        const angle = rng() * Math.PI * 2;
        const radius = rng() * rng() * minSpacing * layer.clusterSize;
        x = clusterCenterX + Math.cos(angle) * radius;
        z = clusterCenterZ + Math.sin(angle) * radius;
      } else {
        // Uniform random distribution
        x = tileWorldX + rng() * tileSize;
        z = tileWorldZ + rng() * tileSize;
      }

      // Ensure within tile bounds
      if (
        x < tileWorldX ||
        x >= tileWorldX + tileSize ||
        z < tileWorldZ ||
        z >= tileWorldZ + tileSize
      ) {
        continue;
      }

      // Noise-based filtering
      if (this.noise) {
        const noiseValue =
          (this.noise.perlin2D(x * noiseScale, z * noiseScale) + 1) / 2;
        if (noiseValue < noiseThreshold) continue;
      }

      // Minimum spacing check
      let tooClose = false;
      for (const existing of positions) {
        const dx = existing.x - x;
        const dz = existing.z - z;
        if (dx * dx + dz * dz < minSpacing * minSpacing) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      positions.push({ x, z });
    }

    return positions;
  }

  /**
   * Estimate terrain slope at a position
   */
  private estimateSlope(
    x: number,
    z: number,
    getHeight: (x: number, z: number) => number,
  ): number {
    const delta = 1.0;
    const _hCenter = getHeight(x, z); // Not used but called for consistency
    const hN = getHeight(x, z - delta);
    const hS = getHeight(x, z + delta);
    const hE = getHeight(x + delta, z);
    const hW = getHeight(x - delta, z);

    const dhdx = (hE - hW) / (2 * delta);
    const dhdz = (hS - hN) / (2 * delta);

    return Math.sqrt(dhdx * dhdx + dhdz * dhdz);
  }

  /**
   * Setup a vegetation material for proper lighting
   * Converts to MeshStandardMaterial and configures for CSM shadows
   * OPTIMIZATION: Prefers vertex colors over textures when available
   */
  private setupVegetationMaterial(
    material: THREE.Material,
    _asset: VegetationAsset,
  ): THREE.Material {
    // Extract properties from any material type
    const matAny = material as THREE.MeshStandardMaterial;
    const hasVertexColors = matAny.vertexColors || false;

    // OPTIMIZATION: Only use textures if vertex colors are not available
    // Vertex colors are faster (no texture sampling) and use less GPU memory
    // NOTE: Use undefined instead of null for optional textures
    // Setting null causes WebGPU texture cache corruption (WeakMap key error)
    const map = hasVertexColors ? undefined : matAny.map || undefined;
    const color = matAny.color || new THREE.Color(0xffffff);
    const alphaMap = hasVertexColors ? undefined : matAny.alphaMap || undefined;

    // Create fresh MeshStandardMaterial for vegetation
    const stdMat = new THREE.MeshStandardMaterial({
      color: color,
      map: map,
      alphaMap: alphaMap,
      vertexColors: hasVertexColors,
      // Alpha handling - use alphaTest for hard edges (faster than blending)
      transparent: false,
      alphaTest: hasVertexColors ? 0.1 : 0.5, // Lower alpha test for vertex color models
      // Double-sided for foliage
      side: THREE.DoubleSide,
      // Matte surface - no specular, no reflections
      roughness: 1.0,
      metalness: 0.0,
      // NOTE: Don't set envMap to null - it causes WebGPU texture cache corruption
      // Setting envMapIntensity to 0 is sufficient to disable the environment map effect
      envMapIntensity: 0,
      // Enable fog
      fog: true,
    });

    // Ensure texture colorspace is correct (only if using texture)
    if (stdMat.map) {
      stdMat.map.colorSpace = THREE.SRGBColorSpace;
    }

    // Setup for CSM shadows (realtime lighting)
    if (this.world.setupMaterial) {
      this.world.setupMaterial(stdMat);
    }

    stdMat.needsUpdate = true;
    return stdMat;
  }

  /**
   * Select a vegetation asset based on weighted probability
   */
  private selectWeightedAsset(
    assets: VegetationAsset[],
    totalWeight: number,
    rng: () => number,
  ): VegetationAsset | null {
    let random = rng() * totalWeight;
    for (const asset of assets) {
      random -= asset.weight;
      if (random <= 0) {
        return asset;
      }
    }
    return assets[assets.length - 1] ?? null;
  }

  /**
   * Create a deterministic RNG for a tile and layer
   */
  private createTileLayerRng(tileKey: string, category: string): () => number {
    // Hash the tile key and category into a seed
    let hash = 5381;
    const str = `${tileKey}_${category}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }

    let state = (hash >>> 0) ^ this.computeSeedFromWorldId();

    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
  }

  // ============================================================================
  // CHUNKED VEGETATION SYSTEM
  // ============================================================================

  /**
   * Get chunk coordinates from world position
   */
  private getChunkCoords(
    x: number,
    z: number,
  ): { chunkX: number; chunkZ: number } {
    return {
      chunkX: Math.floor(x / VEGETATION_CHUNK_SIZE),
      chunkZ: Math.floor(z / VEGETATION_CHUNK_SIZE),
    };
  }

  /**
   * Get chunk key from world position and asset ID
   */
  private getChunkKey(x: number, z: number, assetId: string): string {
    const { chunkX, chunkZ } = this.getChunkCoords(x, z);
    return `${chunkX}_${chunkZ}_${assetId}`;
  }

  /**
   * Get or create a chunked mesh for a position and asset
   */
  private getOrCreateChunkedMesh(
    x: number,
    z: number,
    assetId: string,
    assetDataRef: AssetData,
  ): ChunkedInstancedMesh | null {
    const chunkKey = this.getChunkKey(x, z, assetId);

    // Return existing chunk mesh
    let chunked = this.chunkedMeshes.get(chunkKey);
    if (chunked) return chunked;

    // Create new chunk mesh
    const geometry = assetDataRef.geometry.clone();

    // Create instance attributes
    const positionAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_INSTANCES_PER_CHUNK * 3),
      3,
    );
    const scaleAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_INSTANCES_PER_CHUNK),
      1,
    );
    const rotationAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_INSTANCES_PER_CHUNK),
      1,
    );

    positionAttr.setUsage(THREE.DynamicDrawUsage);
    scaleAttr.setUsage(THREE.DynamicDrawUsage);
    rotationAttr.setUsage(THREE.DynamicDrawUsage);

    geometry.setAttribute("instancePosition", positionAttr);
    geometry.setAttribute("instanceScale", scaleAttr);
    geometry.setAttribute("instanceRotationY", rotationAttr);

    // Create instanced mesh with shared material
    const mesh = new THREE.InstancedMesh(
      geometry,
      assetDataRef.gpuMaterial,
      MAX_INSTANCES_PER_CHUNK,
    );
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    // DISABLE Three.js frustum culling - we do manual frustum culling in updateChunkVisibility()
    // which sets mesh.visible = false. Manual culling is more efficient because:
    // 1. We batch all checks in one loop before render
    // 2. Setting visible=false skips the entire render pipeline for that mesh
    // 3. Avoids redundant frustum checks (we'd be checking twice otherwise)
    mesh.frustumCulled = false;
    // Vegetation casts shadows but does NOT receive them
    // Receiving shadows on thin/double-sided geometry (leaves) causes severe banding artifacts
    // The visual difference is minimal - trees look fine without self-shadowing
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.name = `VegChunk_${chunkKey}`;
    mesh.layers.set(1);

    // Add to scene
    if (this.vegetationGroup) {
      this.vegetationGroup.add(mesh);
    }

    // Track chunk bounds
    const { chunkX: _chunkX, chunkZ: _chunkZ } = this.getChunkCoords(x, z);

    chunked = {
      mesh,
      count: 0,
      positionAttr,
      scaleAttr,
      rotationAttr,
      // Track ACTUAL instance bounds (not chunk bounds)
      minX: Infinity,
      minY: Infinity,
      minZ: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
      maxZ: -Infinity,
    };

    this.chunkedMeshes.set(chunkKey, chunked);
    return chunked;
  }

  /**
   * Add instance to chunked mesh
   */
  private addInstanceToChunk(
    instance: VegetationInstance,
    assetDataRef: AssetData,
  ): boolean {
    const { x, z } = instance.position;
    const worldY =
      instance.position.y + assetDataRef.modelBaseOffset * instance.scale;

    // Water check
    const waterCutoff = WATER_LEVEL + WATER_EDGE_BUFFER;
    if (worldY < waterCutoff) return false;

    // Get or create chunk mesh
    const chunked = this.getOrCreateChunkedMesh(
      x,
      z,
      instance.assetId,
      assetDataRef,
    );
    if (!chunked || chunked.count >= MAX_INSTANCES_PER_CHUNK) return false;

    const idx = chunked.count;
    const i3 = idx * 3;

    // Write instance attributes
    chunked.positionAttr.array[i3] = x;
    chunked.positionAttr.array[i3 + 1] = worldY;
    chunked.positionAttr.array[i3 + 2] = z;
    chunked.scaleAttr.array[idx] = instance.scale;
    chunked.rotationAttr.array[idx] = instance.rotation.y;

    // Update bounds for bounding sphere (track ALL axes)
    chunked.minX = Math.min(chunked.minX, x);
    chunked.maxX = Math.max(chunked.maxX, x);
    chunked.minY = Math.min(chunked.minY, worldY);
    chunked.maxY = Math.max(chunked.maxY, worldY);
    chunked.minZ = Math.min(chunked.minZ, z);
    chunked.maxZ = Math.max(chunked.maxZ, z);

    // Write instance matrix
    this._tempPosition.set(x, worldY, z);
    this._tempEuler.set(0, instance.rotation.y, 0);
    this._tempQuaternion.setFromEuler(this._tempEuler);
    this._tempScale.setScalar(instance.scale);
    this._tempMatrix.compose(
      this._tempPosition,
      this._tempQuaternion,
      this._tempScale,
    );
    chunked.mesh.setMatrixAt(idx, this._tempMatrix);

    chunked.count++;
    return true;
  }

  /**
   * Finalize chunk - update bounding sphere and GPU buffers
   *
   * IMPORTANT: The bounding sphere is stored in geometry.boundingSphere but with
   * WORLD coordinates (not local). This works because chunk meshes are always at
   * the origin with identity transforms. The frustum test in updateChunkVisibility()
   * passes this sphere directly to Frustum.intersectsSphere() which expects world space.
   */
  private finalizeChunk(chunkKey: string): void {
    const chunked = this.chunkedMeshes.get(chunkKey);
    if (!chunked || chunked.count === 0) return;

    // Update mesh count
    chunked.mesh.count = chunked.count;

    // Mark attributes for upload
    chunked.positionAttr.needsUpdate = true;
    chunked.scaleAttr.needsUpdate = true;
    chunked.rotationAttr.needsUpdate = true;
    chunked.mesh.instanceMatrix.needsUpdate = true;

    // Compute bounding sphere for frustum culling (in WORLD space)
    // Note: We store world coords in geometry.boundingSphere which is normally local space.
    // This works because chunk meshes have identity transforms (position=0, no rotation/scale).
    const geometry = chunked.mesh.geometry;
    const centerX = (chunked.minX + chunked.maxX) / 2;
    const centerY = (chunked.minY + chunked.maxY) / 2;
    const centerZ = (chunked.minZ + chunked.maxZ) / 2;

    // Radius calculation:
    // - Half diagonal of instance positions (where bases are placed)
    // - Plus BOUNDING_SPHERE_BUFFER for model heights and scale variations
    // The buffer accounts for: tree height (~15-20m), scale variations (0.8-1.5x),
    // and ensures the sphere fully contains all visible geometry
    const dx = chunked.maxX - chunked.minX;
    const dy = chunked.maxY - chunked.minY;
    const dz = chunked.maxZ - chunked.minZ;
    const diagonal = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const radius = diagonal / 2 + BOUNDING_SPHERE_BUFFER;

    if (!geometry.boundingSphere) {
      geometry.boundingSphere = new THREE.Sphere();
    }
    geometry.boundingSphere.center.set(centerX, centerY, centerZ);
    geometry.boundingSphere.radius = radius;
  }

  /**
   * Finalize all chunks after population
   */
  private finalizeAllChunks(): void {
    let totalChunks = 0;
    let totalInstances = 0;

    for (const [chunkKey, chunked] of this.chunkedMeshes) {
      if (chunked.count > 0) {
        this.finalizeChunk(chunkKey);
        totalChunks++;
        totalInstances += chunked.count;
      }
    }

    console.log(
      `[VegetationSystem] 📦 Finalized ${totalChunks} chunks with ${totalInstances} total instances`,
    );
  }

  /**
   * Add a vegetation instance to the scene using chunked system
   */
  private async addInstance(instance: VegetationInstance): Promise<void> {
    const asset = this.assetDefinitions.get(instance.assetId);
    if (!asset) return;

    // Ensure asset data is loaded
    let assetDataRef = this.assetData.get(instance.assetId);
    if (!assetDataRef) {
      // Load the asset
      const loaded = await this.loadAssetData(asset);
      if (!loaded) return;
      assetDataRef = loaded;
    }

    // Add to chunked mesh
    this.addInstanceToChunk(instance, assetDataRef);
  }

  /**
   * Load asset geometry/material for chunked system
   */
  private async loadAssetData(
    asset: VegetationAsset,
  ): Promise<AssetData | null> {
    // Check if already loaded
    const existing = this.assetData.get(asset.id);
    if (existing) return existing;

    // Check if currently loading
    if (this.pendingAssetLoads.has(asset.id)) {
      // Wait for load to complete
      while (this.pendingAssetLoads.has(asset.id)) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return this.assetData.get(asset.id) ?? null;
    }

    this.pendingAssetLoads.add(asset.id);

    try {
      const baseUrl = (this.world.assetsUrl || "").replace(/\/$/, "");
      const modelPath = `${baseUrl}/${asset.model}`;

      // Use modelCache which has proper meshopt decoder setup
      const { scene } = await modelCache.loadModel(modelPath, this.world);

      // Extract geometry and material from loaded scene
      let geometry: THREE.BufferGeometry | null = null;
      let material: THREE.Material | THREE.Material[] =
        new THREE.MeshStandardMaterial();

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && !geometry) {
          geometry = child.geometry;
          material = child.material;
        }
      });

      if (!geometry) {
        console.warn(`[VegetationSystem] No geometry found in ${asset.id}`);
        return null;
      }

      // Type assertion after null check
      const validGeometry = geometry as THREE.BufferGeometry;

      // Compute model base offset
      validGeometry.computeBoundingBox();
      const modelBaseOffset = validGeometry.boundingBox
        ? -validGeometry.boundingBox.min.y
        : 0;

      // Create asset data
      const data: AssetData = {
        geometry: validGeometry,
        material,
        asset,
        modelBaseOffset,
        gpuMaterial: this.sharedVegetationMaterial!,
      };

      this.assetData.set(asset.id, data);
      console.log(`[VegetationSystem] ✅ Loaded asset data for ${asset.id}`);

      return data;
    } catch (err) {
      console.error(`[VegetationSystem] Failed to load ${asset.id}:`, err);
      return null;
    } finally {
      this.pendingAssetLoads.delete(asset.id);
    }
  }

  /**
   * Remove a vegetation instance from the scene.
   *
   * WARNING: This method operates on the DEPRECATED loadedAssets system.
   * The current chunked system (chunkedMeshes) does not support per-instance removal.
   * For chunked vegetation, instances are permanent once created.
   *
   * In practice, tiles are rarely unloaded (terrain keeps tiles loaded within radius),
   * so this limitation has minimal impact. If tile unloading becomes important,
   * we'd need to implement chunk rebuilding or disposal.
   *
   * @deprecated Use chunked system which doesn't support removal
   */
  private removeInstance(instance: VegetationInstance): void {
    // This only works for the deprecated loadedAssets system
    const assetData = this.loadedAssets.get(instance.assetId);
    if (!assetData) {
      // Instance is in chunked system - removal not supported
      // Chunked instances persist until the chunk is disposed
      return;
    }

    const matrixIndex = assetData.instanceMap.get(instance.id);
    if (matrixIndex === undefined) return;

    // Swap with last instance to maintain contiguous array
    const lastIndex = assetData.activeCount - 1;
    if (matrixIndex !== lastIndex) {
      // Get last instance's matrix
      assetData.instancedMesh.getMatrixAt(lastIndex, this._tempMatrix);
      assetData.instancedMesh.setMatrixAt(matrixIndex, this._tempMatrix);

      // Update tracking for swapped instance
      const lastInstance = assetData.instances[lastIndex];
      if (lastInstance) {
        assetData.instanceMap.set(lastInstance.id, matrixIndex);
        assetData.instances[matrixIndex] = lastInstance;
        lastInstance.matrixIndex = matrixIndex;
      }
    }

    // Remove from tracking
    assetData.instanceMap.delete(instance.id);
    assetData.instances.pop();
    assetData.activeCount--;

    // Update instance count
    assetData.instancedMesh.count = assetData.activeCount;
    assetData.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Load a vegetation asset and create InstancedMesh
   */
  private async loadAsset(
    asset: VegetationAsset,
  ): Promise<InstancedAssetData | null> {
    // Prevent duplicate loads
    if (this.pendingAssetLoads.has(asset.id)) {
      // Wait for existing load to complete
      while (this.pendingAssetLoads.has(asset.id)) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return this.loadedAssets.get(asset.id) ?? null;
    }

    this.pendingAssetLoads.add(asset.id);

    try {
      // Use asset:// protocol so URL resolution is consistent with preloader
      const modelPath = `asset://${asset.model}`;

      // Load the GLB model - will use cache if preloaded
      const { scene } = await modelCache.loadModel(modelPath, this.world);

      // Extract geometry and material from the loaded model
      let geometry: THREE.BufferGeometry | null = null;
      let material: THREE.Material | THREE.Material[] | null = null;

      // Find the first mesh in the scene hierarchy
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && !geometry) {
          geometry = child.geometry;
          material = child.material;
        }
      });

      if (!geometry || !material) {
        console.warn(`[VegetationSystem] No mesh found in asset: ${asset.id}`);
        return null;
      }

      // Type assertions after null check (TypeScript can't track traverse callback)
      const validGeometry = geometry as THREE.BufferGeometry;
      const validMaterial = material as THREE.Material | THREE.Material[];

      // Compute bounding box to find model's base (minimum Y)
      // This fixes models that are centered rather than having origin at base
      validGeometry.computeBoundingBox();
      const boundingBox = validGeometry.boundingBox;
      let modelBaseOffset = 0;
      if (boundingBox) {
        // If model's min Y is negative, we need to lift it up by that amount
        modelBaseOffset = -boundingBox.min.y;
        console.log(
          `[VegetationSystem] Asset ${asset.id} base offset: ${modelBaseOffset.toFixed(2)} (bbox.min.y = ${boundingBox.min.y.toFixed(2)})`,
        );
      }

      // Setup materials for proper lighting and CSM shadows
      let finalMaterial: THREE.Material | THREE.Material[] = validMaterial;
      if (Array.isArray(finalMaterial)) {
        finalMaterial = finalMaterial.map((mat) =>
          this.setupVegetationMaterial(mat, asset),
        );
      } else {
        finalMaterial = this.setupVegetationMaterial(finalMaterial, asset);
      }

      // Create InstancedMesh
      const instancedMesh = new THREE.InstancedMesh(
        validGeometry,
        finalMaterial,
        this.config.maxInstancesPerAsset,
      );
      instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instancedMesh.count = 0;

      // DISABLE frustum culling - InstancedMesh can't frustum cull scattered instances correctly
      // because it uses ONE bounding sphere for ALL instances. When instances are spread
      // across the terrain, turning the camera causes them all to disappear at once.
      // GPU shader handles distance culling via opacity instead.
      instancedMesh.frustumCulled = false;

      // Vegetation casts shadows but does NOT receive them (prevents self-shadow banding)
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = false;
      instancedMesh.name = `Vegetation_${asset.id}`;

      // PERFORMANCE: Layer 1 = main camera only (not minimap which uses layer 0)
      // This prevents vegetation from being rendered in the minimap, improving performance
      instancedMesh.layers.set(1);

      // Add to scene
      if (this.vegetationGroup) {
        this.vegetationGroup.add(instancedMesh);
      }

      // Set up GPU instance buffer attributes for shader-based transforms
      const maxInst = this.config.maxInstancesPerAsset;
      const positionAttr = new THREE.InstancedBufferAttribute(
        new Float32Array(maxInst * 3),
        3,
      );
      const scaleAttr = new THREE.InstancedBufferAttribute(
        new Float32Array(maxInst),
        1,
      );
      const rotationAttr = new THREE.InstancedBufferAttribute(
        new Float32Array(maxInst),
        1,
      );

      // Dynamic usage for initial population, switches to static after upload
      positionAttr.setUsage(THREE.DynamicDrawUsage);
      scaleAttr.setUsage(THREE.DynamicDrawUsage);
      rotationAttr.setUsage(THREE.DynamicDrawUsage);

      // Attach to geometry for shader access
      instancedMesh.geometry.setAttribute("instancePosition", positionAttr);
      instancedMesh.geometry.setAttribute("instanceScale", scaleAttr);
      instancedMesh.geometry.setAttribute("instanceRotationY", rotationAttr);

      // Check if geometry has vertex colors
      const hasVertexColors = validGeometry.attributes.color !== undefined;

      // Use shared material for all vegetation (no textures)
      const gpuMaterial = this.sharedVegetationMaterial!;
      console.log(
        `[VegetationSystem] ✅ Using SHARED material for ${asset.id} (vertexColors: ${hasVertexColors})`,
      );

      instancedMesh.material = gpuMaterial;

      const assetData: InstancedAssetData = {
        geometry: validGeometry,
        material: validMaterial,
        instancedMesh,
        instanceMap: new Map(),
        instances: [],
        maxInstances: this.config.maxInstancesPerAsset,
        activeCount: 0,
        asset,
        modelBaseOffset,
        gpuMaterial,
        positionAttr,
        scaleAttr,
        rotationAttr,
      };

      this.loadedAssets.set(asset.id, assetData);

      // Pre-render imposter texture from the loaded model
      // This captures the actual appearance for use as a billboard at distance
      try {
        this.preRenderImposterTexture(asset.id, scene);
      } catch (err) {
        console.warn(
          `[VegetationSystem] Failed to pre-render imposter for ${asset.id}:`,
          err,
        );
      }

      console.log(`[VegetationSystem] Loaded asset: ${asset.id}`);

      return assetData;
    } catch (error) {
      console.error(
        `[VegetationSystem] Error loading asset ${asset.id}:`,
        error,
      );
      return null;
    } finally {
      this.pendingAssetLoads.delete(asset.id);
    }
  }

  // Visibility is now handled by THREE.js frustum culling on the InstancedMesh
  // We don't need to constantly re-sort and update matrices - that caused stuttering

  /**
   * Get the reference position for distance-based culling and fade.
   *
   * Uses camera position (not player) because:
   * 1. In third-person view, fade should be relative to what the player SEES
   * 2. Camera position gives intuitive "fog of war" effect
   * 3. Frustum culling already uses camera, so distances should match
   *
   * NOTE: Returns a reused temp vector - do not store the result!
   */
  private getPlayerPosition(): THREE.Vector3 | null {
    // Use camera position for view-relative culling
    if (this.world.camera?.position) {
      return this._tempPosition.copy(this.world.camera.position);
    }

    // Fallback to player position if no camera available
    const players = this.world.getPlayers();
    if (!players || players.length === 0) return null;

    const player = players[0];
    if (player.node?.position) {
      return this._tempPosition.set(
        player.node.position.x,
        player.node.position.y,
        player.node.position.z,
      );
    }

    return null;
  }

  // Debug: periodic stats logging
  private lastStatsLog = 0;
  private lastPendingCheck = 0;
  private lastPlayerTileKey = "";

  // Camera layer setup
  private cameraLayerSet = false;

  /**
   * Per-frame update for vegetation culling.
   *
   * CULLING PIPELINE (each frame):
   * 1. updateGPUUniforms() - Pass camera position to shader for GPU fade
   * 2. updateChunkVisibility() - CPU distance + frustum culling (sets mesh.visible)
   * 3. GPU shader - Per-fragment dithered dissolve based on distance
   *
   * This hybrid approach is optimal because:
   * - CPU culling skips entire draw calls (mesh.visible = false)
   * - GPU fade provides smooth transitions without CPU overhead
   * - Frustum culling prevents rendering behind the camera
   */
  override update(_delta: number): void {
    if (!this.world.isClient) return;

    // Ensure camera can see vegetation layer (one-time setup)
    // Layer 1 = main camera only (minimap uses layer 0)
    if (!this.cameraLayerSet && this.world.camera) {
      this.world.camera.layers.enable(1);
      this.cameraLayerSet = true;
    }

    const now = Date.now();
    // Get camera position (used for distance-based culling and shader fade)
    // We use camera position (not player position) for proper third-person view fade
    const cameraPos = this.getPlayerPosition();

    // Update GPU uniforms and perform CPU-side culling
    if (cameraPos) {
      // GPU uniforms: playerPos used by shader for distance fade calculation
      this.updateGPUUniforms(cameraPos.x, cameraPos.y, cameraPos.z);

      // CPU culling: hide chunks outside camera frustum or beyond render distance
      // This is more efficient than GPU culling because we skip entire draw calls
      this.updateChunkVisibility(cameraPos.x, cameraPos.z);
    }

    // Lazy load pending tiles as player moves
    if (now - this.lastPendingCheck > 1000) {
      this.lastPendingCheck = now;
      this.processPendingTiles();
    }

    // Periodic stats logging (debug only)
    if (now - this.lastStatsLog > 30000) {
      this.lastStatsLog = now;
    }
  }

  /**
   * Update GPU material uniforms. This is the ONLY CPU work per frame (~16 bytes).
   * All distance fade, water culling, and transforms happen in the shader.
   */
  private updateGPUUniforms(
    playerX: number,
    playerY: number,
    playerZ: number,
  ): void {
    // OPTIMIZATION: Update shared material ONCE (used by all vertex-color vegetation)
    if (this.sharedVegetationMaterial) {
      this.sharedVegetationMaterial.gpuUniforms.playerPos.value.set(
        playerX,
        playerY,
        playerZ,
      );
    }

    // Update any per-asset materials (fallback for textured models)
    for (const [, assetData] of this.loadedAssets) {
      // Skip if using shared material (already updated above)
      if (assetData.gpuMaterial === this.sharedVegetationMaterial) continue;

      if (assetData.gpuMaterial) {
        assetData.gpuMaterial.gpuUniforms.playerPos.value.set(
          playerX,
          playerY,
          playerZ,
        );
      }
    }
  }

  /**
   * Show/hide chunks based on camera view frustum and distance.
   *
   * This is the primary CPU-side culling for vegetation, running every frame.
   * It's more efficient than Three.js built-in frustum culling because:
   * 1. We batch all checks in one loop before render starts
   * 2. Setting visible=false skips the entire render pipeline
   * 3. We combine distance + frustum checks to minimize work
   *
   * @param cameraX - Camera X position (used for distance culling)
   * @param cameraZ - Camera Z position (used for distance culling)
   */
  private updateChunkVisibility(cameraX: number, cameraZ: number): void {
    const camera = this.world.camera;
    if (!camera) return;

    // Update frustum from camera's projection and view matrices
    // matrixWorldInverse is the view matrix (world->camera transform)
    // projectionMatrix * matrixWorldInverse = clip space transform
    //
    // IMPORTANT: updateMatrixWorld() updates matrixWorld but NOT matrixWorldInverse
    // We must explicitly compute matrixWorldInverse from matrixWorld
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    this._projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

    for (const [, chunked] of this.chunkedMeshes) {
      // Get bounding sphere (stored in world coordinates, see finalizeChunk)
      const bs = chunked.mesh.geometry.boundingSphere;
      if (!bs) {
        chunked.mesh.visible = false;
        continue;
      }

      // STAGE 1: Fast distance pre-filter (horizontal distance only)
      // Chunks beyond CHUNK_RENDER_DISTANCE are hidden regardless of view direction
      // This is cheaper than frustum test and catches most distant chunks
      const dx = bs.center.x - cameraX;
      const dz = bs.center.z - cameraZ;
      const distSq = dx * dx + dz * dz;

      if (distSq >= CHUNK_RENDER_DISTANCE_SQ) {
        chunked.mesh.visible = false;
        continue;
      }

      // STAGE 2: Camera frustum culling
      // Hide chunks outside the camera's view (behind camera, off-screen)
      // Uses the world-space bounding sphere we computed in finalizeChunk
      chunked.mesh.visible = this._frustum.intersectsSphere(bs);
    }
  }

  /**
   * Process pending tiles that are now within range of the player
   */
  private async processPendingTiles(): Promise<void> {
    if (this.pendingTiles.size === 0) return;

    const playerTile = this.getPlayerTile();
    if (!playerTile) return;

    const currentTileKey = `${playerTile.x}_${playerTile.z}`;

    // Only check if player has moved to a new tile
    if (currentTileKey === this.lastPlayerTileKey) return;
    this.lastPlayerTileKey = currentTileKey;

    // Find pending tiles that are now in range
    const tilesToGenerate: Array<{
      tileX: number;
      tileZ: number;
      biome: string;
    }> = [];

    for (const [key, tileData] of this.pendingTiles) {
      if (this.isTileInRange(tileData.tileX, tileData.tileZ)) {
        tilesToGenerate.push(tileData);
        this.pendingTiles.delete(key);
      }
    }

    // Sort by distance (closest first) and generate
    if (tilesToGenerate.length > 0) {
      tilesToGenerate.sort((a, b) => {
        const distA = Math.max(
          Math.abs(a.tileX - playerTile.x),
          Math.abs(a.tileZ - playerTile.z),
        );
        const distB = Math.max(
          Math.abs(b.tileX - playerTile.x),
          Math.abs(b.tileZ - playerTile.z),
        );
        return distA - distB;
      });

      // Generate one tile per frame to avoid hitches
      const tile = tilesToGenerate[0];
      await this.onTileGenerated(tile);

      // Re-add remaining tiles to pending
      for (let i = 1; i < tilesToGenerate.length; i++) {
        const t = tilesToGenerate[i];
        this.pendingTiles.set(`${t.tileX}_${t.tileZ}`, t);
      }
    }
  }

  /**
   * Configure the vegetation system
   */
  setConfig(config: Partial<VegetationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics about vegetation system
   */
  getStats(): {
    totalAssets: number;
    loadedAssets: number;
    totalInstances: number;
    visibleInstances: number;
    tilesWithVegetation: number;
  } {
    let totalInstances = 0;
    let visibleInstances = 0;

    for (const assetData of this.loadedAssets.values()) {
      totalInstances += assetData.instances.length;
      visibleInstances += assetData.instancedMesh.count;
    }

    return {
      totalAssets: this.assetDefinitions.size,
      loadedAssets: this.loadedAssets.size,
      totalInstances,
      visibleInstances,
      tilesWithVegetation: this.tileVegetation.size,
    };
  }

  /**
   * Get detailed render statistics for debugging performance issues
   * Call this from console: world.getSystem('vegetation').getDetailedStats()
   */
  getDetailedStats(): void {
    console.log("=== VEGETATION SYSTEM DETAILED STATS ===");
    console.log(`Asset definitions: ${this.assetDefinitions.size}`);
    console.log(`Loaded assets (draw calls): ${this.loadedAssets.size}`);
    console.log(`Tiles with vegetation: ${this.tileVegetation.size}`);
    console.log("");

    let totalTriangles = 0;
    let totalVertices = 0;
    let totalInstances = 0;
    let totalVisibleInstances = 0;
    const uniqueMaterials = new Set<THREE.Material>();
    const uniqueTextures = new Set<THREE.Texture>();

    console.log("--- Per-Asset Breakdown ---");
    for (const [assetId, assetData] of this.loadedAssets) {
      const mesh = assetData.instancedMesh;
      const geo = mesh.geometry;
      const vertCount = geo.attributes.position?.count ?? 0;
      const indexCount = geo.index?.count ?? vertCount;
      const triCount = Math.floor(indexCount / 3);
      const instanceCount = assetData.activeCount;
      const visibleCount = mesh.count;

      totalTriangles += triCount * visibleCount;
      totalVertices += vertCount * visibleCount;
      totalInstances += instanceCount;
      totalVisibleInstances += visibleCount;

      // Track materials
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const mat of mats) {
        uniqueMaterials.add(mat);
        const stdMat = mat as THREE.MeshStandardMaterial;
        if (stdMat.map) uniqueTextures.add(stdMat.map);
        if (stdMat.normalMap) uniqueTextures.add(stdMat.normalMap);
        if (stdMat.alphaMap) uniqueTextures.add(stdMat.alphaMap);
      }

      console.log(
        `  ${assetId}: ${vertCount} verts, ${triCount} tris/inst, ${instanceCount} instances (${visibleCount} visible) = ${triCount * visibleCount} tris rendered`,
      );
    }

    console.log("");
    console.log("--- Totals ---");
    console.log(`Draw calls: ${this.loadedAssets.size}`);
    console.log(`Unique materials: ${uniqueMaterials.size}`);
    console.log(`Unique textures: ${uniqueTextures.size}`);
    console.log(`Total instances: ${totalInstances}`);
    console.log(`Visible instances: ${totalVisibleInstances}`);
    console.log(`Total triangles rendered: ${totalTriangles.toLocaleString()}`);
    console.log(`Total vertices: ${totalVertices.toLocaleString()}`);
    console.log("============================================");
  }

  override destroy(): void {
    // Remove from scene
    if (this.vegetationGroup && this.vegetationGroup.parent) {
      this.vegetationGroup.parent.remove(this.vegetationGroup);
    }

    // Dispose all instanced meshes
    for (const assetData of this.loadedAssets.values()) {
      assetData.instancedMesh.dispose();
    }

    // Dispose any remaining imposters (if any were created)
    for (const imposterData of this.imposters.values()) {
      imposterData.billboardMesh.dispose();
    }
    this.imposters.clear();

    this.loadedAssets.clear();
    this.tileVegetation.clear();
    this.assetDefinitions.clear();
    this.vegetationGroup = null;
    this.scene = null;
  }
}

export default VegetationSystem;
