/**
 * ImpostorManager.ts - Centralized Impostor Generation & Caching System
 *
 * Provides on-demand impostor generation for any 3D entity with:
 * - Async queue-based baking (non-blocking, idle-time processing)
 * - Multi-level caching (memory + IndexedDB for persistence)
 * - Priority system (visible objects baked first)
 * - Unified API for all entity types (vegetation, resources, mobs, buildings, items)
 *
 * **Architecture:**
 * - Main thread: GPU baking via OctahedralImpostor
 * - IndexedDB: Persistent atlas storage across sessions
 * - Memory cache: Fast access for active impostors
 *
 * **Usage:**
 * ```ts
 * const manager = ImpostorManager.getInstance(world);
 * const impostor = await manager.getOrCreate(modelId, mesh, options);
 * // Returns cached or newly baked ImpostorBakeResult
 * ```
 *
 * @module ImpostorManager
 */

// Browser API type declarations for non-DOM environments
declare function requestIdleCallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions,
): number;
interface IdleRequestOptions {
  timeout?: number;
}
interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining(): number;
}
type IdleRequestCallback = (deadline: IdleDeadline) => void;

import THREE from "../../../extras/three/three";
import {
  OctahedralImpostor,
  OctahedronType,
  buildOctahedronMesh,
  lerpOctahedronGeometry,
  type ImpostorBakeResult,
  type ImpostorBakeConfig,
  type CompatibleRenderer,
  type DissolveConfig,
} from "@hyperforge/impostor";
import type { World } from "../../../types";
import { LoadPriority } from "../../../types";
import { getKTX2Loader } from "../../../extras/three/ktx2TextureLoader";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Impostor manager configuration
 */
export const IMPOSTOR_CONFIG = {
  /** Default atlas size for baked impostors */
  ATLAS_SIZE: 1024,
  /** High-quality atlas size (for large objects like buildings) */
  ATLAS_SIZE_HIGH: 2048,
  /** Grid size for hemisphere mapping (ground-viewed objects) */
  GRID_SIZE_HEMI_X: 16,
  GRID_SIZE_HEMI_Y: 8,
  /** Grid size for full sphere mapping (viewed from any angle) */
  GRID_SIZE_FULL: 12,
  /** Maximum bakes per frame to avoid stuttering */
  MAX_BAKES_PER_FRAME: 1,
  /** Minimum time between bakes (ms) */
  MIN_BAKE_INTERVAL: 100,
  /** IndexedDB database name */
  DB_NAME: "hyperia-impostors",
  /** IndexedDB store name */
  STORE_NAME: "atlases",
  /** Cache version (increment to invalidate old caches) */
  // v2: Fixed T-pose issue - now properly captures idle animation pose
  // v3: Added bakeMode support (normal/depth atlas baking)
  // v4: Fixed normal atlas view-space to world-space transformation
  CACHE_VERSION: 4,
} as const;

/**
 * Priority levels for baking queue.
 * Maps to unified LoadPriority for consistency across systems.
 */
export enum BakePriority {
  /** Urgent - object is visible and close (maps to LoadPriority.HIGH) */
  HIGH = LoadPriority.HIGH,
  /** Normal - object is visible but distant (maps to LoadPriority.NORMAL) */
  NORMAL = LoadPriority.NORMAL,
  /** Low - object is not currently visible (maps to LoadPriority.LOW) */
  LOW = LoadPriority.LOW,
}

/**
 * LOD state for an entity
 */
export enum LODLevel {
  /** Full detail mesh */
  LOD0 = 0,
  /** Low-poly mesh */
  LOD1 = 1,
  /** Billboard impostor */
  IMPOSTOR = 2,
  /** Fully culled (not visible) */
  CULLED = 3,
}

/**
 * Bake mode for impostor generation
 */
export enum ImpostorBakeMode {
  /** Basic: albedo only (fastest, smallest) */
  BASIC = "basic",
  /** Standard: albedo + normals (enables dynamic lighting) */
  STANDARD = "standard",
  /** Full: albedo + normals + depth (enables parallax, depth blending, shadows) */
  FULL = "full",
}

/**
 * Options for impostor generation (used by ImpostorManager)
 */
export interface ImpostorOptions {
  /** Atlas texture size (default: 1024) */
  atlasSize?: number;
  /** Use hemisphere mapping (default: true for ground objects) */
  hemisphere?: boolean;
  /** Custom grid size X */
  gridSizeX?: number;
  /** Custom grid size Y */
  gridSizeY?: number;
  /** Baking priority */
  priority?: BakePriority;
  /** Category for LOD distance lookup */
  category?: string;
  /** Force re-bake even if cached */
  forceBake?: boolean;
  /**
   * Bake mode controls which atlas channels are generated:
   * - "basic": albedo only (fastest, smallest)
   * - "standard": albedo + normals (enables dynamic lighting) - DEFAULT
   * - "full": albedo + normals + depth (enables parallax, depth blending)
   *
   * Default: "standard" for best quality/performance balance
   */
  bakeMode?: ImpostorBakeMode;
  /**
   * AAA LOD: Callback to prepare mesh IMMEDIATELY before baking.
   * Called synchronously right before the impostor is captured.
   * Use this to set animated models to idle pose before capturing.
   * This ensures impostors show the idle animation, not T-pose.
   */
  prepareForBake?: () => Promise<void>;
}

/**
 * Options for initializing HLOD/impostor support on entities
 */
export interface ImpostorInitOptions {
  /** Category for LOD distances (default: 'resource') */
  category?: string;
  /** Custom LOD1 mesh (optional) */
  lod1Mesh?: THREE.Object3D;
  /** Atlas size for impostor (default: 1024) */
  atlasSize?: number;
  /** Use hemisphere mapping (default: true) */
  hemisphere?: boolean;
  /** Enable dissolve effect (default: true) */
  enableDissolve?: boolean;
  /** Custom dissolve config */
  dissolve?: DissolveConfig;
  /** Baking priority (default: NORMAL) */
  priority?: BakePriority;
  /**
   * AAA LOD: Callback to prepare mesh before impostor baking.
   * Use this to set animated models to idle pose before capturing.
   * This ensures impostors show the idle animation, not T-pose.
   *
   * @returns Promise that resolves when preparation is complete
   */
  prepareForBake?: () => Promise<void>;
  /**
   * AAA LOD: Whether to freeze animations at LOD1 distance.
   * When true, animations stop updating at medium distance (LOD1),
   * showing the model frozen in its current pose.
   * Default: false for static objects, should be true for animated entities.
   */
  freezeAnimationAtLOD1?: boolean;
  /**
   * Bounding size (diagonal) in meters for size-based LOD distance scaling.
   * Larger objects get proportionally extended draw distances.
   * If not provided, computed from mesh bounding box.
   */
  boundingSize?: number;
}

/**
 * Queued bake request
 */
interface BakeRequest {
  /** Unique model identifier (e.g., "tree1.glb", "mob_goblin") */
  modelId: string;
  /** Source mesh/group to bake */
  source: THREE.Object3D;
  /** Baking options */
  options: ImpostorOptions;
  /** Priority level */
  priority: BakePriority;
  /** Promise resolve function */
  resolve: (result: ImpostorBakeResult) => void;
  /** Promise reject function */
  reject: (error: Error) => void;
  /** Request timestamp */
  timestamp: number;
}

/**
 * Cached impostor data (memory)
 */
interface CachedImpostor {
  /** Bake result with atlas texture */
  result: ImpostorBakeResult;
  /** Last access timestamp */
  lastAccess: number;
  /** Size category for cleanup prioritization */
  sizeCategory: "small" | "medium" | "large";
}

/**
 * Texture compression format for serialized impostors
 */
export type TextureFormat = "png" | "ktx2" | "basis";

/**
 * Serialized impostor data (IndexedDB)
 *
 * Supports two storage formats:
 * - Legacy: Base64 PNG strings (atlasData, normalData, depthData)
 * - Compressed: ArrayBuffer KTX2/Basis (atlasBuffer, normalBuffer, depthBuffer)
 *
 * Compressed format reduces storage by 5-10x and eliminates base64 encoding overhead.
 * Runtime baking stores PNG; pre-compressed assets use KTX2.
 */
interface SerializedImpostor {
  /** Model identifier */
  modelId: string;
  /** Atlas image as base64 (legacy PNG format) */
  atlasData?: string;
  /** Normal atlas image as base64 (legacy PNG format) */
  normalData?: string;
  /** Depth atlas image as base64 (legacy PNG format) */
  depthData?: string;
  /** Atlas as compressed buffer (KTX2/Basis) */
  atlasBuffer?: ArrayBuffer;
  /** Normal atlas as compressed buffer (KTX2/Basis) */
  normalBuffer?: ArrayBuffer;
  /** Depth atlas as compressed buffer (KTX2/Basis) */
  depthBuffer?: ArrayBuffer;
  /** Texture format used */
  textureFormat?: TextureFormat;
  /** Grid sizes */
  gridSizeX: number;
  gridSizeY: number;
  /** Octahedron type */
  octType: number;
  /** Bounding sphere */
  boundingSphere: {
    center: { x: number; y: number; z: number };
    radius: number;
  };
  /** Bounding box (optional) */
  boundingBox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  /** Bake mode used */
  bakeMode?: ImpostorBakeMode;
  /** Cache version */
  version: number;
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// IMPOSTOR MANAGER
// ============================================================================

/**
 * ImpostorManager - Singleton service for centralized impostor management
 */
export class ImpostorManager {
  private static instance: ImpostorManager | null = null;

  private world: World;
  private octahedralImpostor: OctahedralImpostor | null = null;
  private renderer: CompatibleRenderer | null = null;

  // Caching
  private memoryCache = new Map<string, CachedImpostor>();
  private db: IDBDatabase | null = null;
  private dbReady: Promise<void>;

  // Baking queue
  private bakeQueue: BakeRequest[] = [];
  private baking = false;
  private lastBakeTime = 0;

  // Pending bake promises for deduplication - prevents multiple simultaneous bakes of the same key
  private pendingBakes = new Map<string, Promise<ImpostorBakeResult>>();

  // Statistics
  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    totalBaked: 0,
    totalFromIndexedDB: 0,
  };

  private constructor(world: World) {
    this.world = world;
    this.dbReady = this.initIndexedDB();
  }

  /**
   * Get or create the singleton instance
   */
  static getInstance(world: World): ImpostorManager {
    if (!ImpostorManager.instance) {
      ImpostorManager.instance = new ImpostorManager(world);
    }
    return ImpostorManager.instance;
  }

  /**
   * Initialize the OctahedralImpostor system
   * Must be called after renderer is available
   */
  initBaker(): boolean {
    if (this.octahedralImpostor) return true;

    const graphics = this.world.graphics as
      | { renderer?: THREE.WebGPURenderer }
      | undefined;
    const renderer = graphics?.renderer;
    if (!renderer) {
      console.warn("[ImpostorManager] Cannot init baker: no renderer");
      return false;
    }

    this.renderer = renderer as CompatibleRenderer;
    this.octahedralImpostor = new OctahedralImpostor(this.renderer);
    console.log("[ImpostorManager] Baker initialized");
    return true;
  }

  /**
   * Get or create an impostor for a model
   * Returns cached result if available, otherwise queues for baking
   *
   * @param modelId - Unique identifier for this model
   * @param source - Three.js object to bake
   * @param options - Baking options
   * @returns Promise that resolves to ImpostorBakeResult
   */
  async getOrCreate(
    modelId: string,
    source: THREE.Object3D,
    options: ImpostorOptions = {},
  ): Promise<ImpostorBakeResult> {
    const cacheKey = this.getCacheKey(modelId, options);

    // Check memory cache first
    const cached = this.memoryCache.get(cacheKey);
    if (cached && !options.forceBake) {
      cached.lastAccess = Date.now();
      this.stats.cacheHits++;
      console.log(`[ImpostorManager] ✅ Memory cache HIT: ${modelId}`);
      return cached.result;
    }

    // Check IndexedDB cache
    if (!options.forceBake) {
      const serialized = await this.loadFromIndexedDB(cacheKey);
      if (serialized) {
        const result = await this.deserializeImpostor(serialized);
        if (result) {
          this.cacheInMemory(cacheKey, result, options);
          this.stats.totalFromIndexedDB++;
          console.log(
            `[ImpostorManager] ✅ IndexedDB cache HIT: ${modelId} (loaded from persistent storage)`,
          );
          return result;
        }
      }
    }

    // Check if there's already a pending bake for this key (deduplication)
    const pendingBake = this.pendingBakes.get(cacheKey);
    if (pendingBake && !options.forceBake) {
      console.log(
        `[ImpostorManager] ⏳ Bake already pending for ${modelId} - reusing promise`,
      );
      return pendingBake;
    }

    this.stats.cacheMisses++;
    console.log(
      `[ImpostorManager] ❌ Cache MISS: ${modelId} - queuing for bake`,
    );

    // Queue for baking with deduplication
    const bakePromise = new Promise<ImpostorBakeResult>((resolve, reject) => {
      const request: BakeRequest = {
        modelId,
        source,
        options,
        priority: options.priority ?? BakePriority.NORMAL,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Insert in priority order
      const insertIndex = this.bakeQueue.findIndex(
        (r) => r.priority > request.priority,
      );
      if (insertIndex === -1) {
        this.bakeQueue.push(request);
      } else {
        this.bakeQueue.splice(insertIndex, 0, request);
      }

      // Start processing if not already
      this.processBakeQueue();
    });

    // Store pending promise for deduplication
    this.pendingBakes.set(cacheKey, bakePromise);

    // Clean up pending promise when done (success or failure)
    bakePromise.finally(() => {
      this.pendingBakes.delete(cacheKey);
    });

    return bakePromise;
  }

  /**
   * Check if an impostor is cached (memory or IndexedDB)
   */
  async isCached(
    modelId: string,
    options: ImpostorOptions = {},
  ): Promise<boolean> {
    const cacheKey = this.getCacheKey(modelId, options);

    if (this.memoryCache.has(cacheKey)) {
      return true;
    }

    const serialized = await this.loadFromIndexedDB(cacheKey);
    return serialized !== null;
  }

  /**
   * Preload an impostor from cache without the source mesh
   * Returns null if not cached
   */
  async preload(
    modelId: string,
    options: ImpostorOptions = {},
  ): Promise<ImpostorBakeResult | null> {
    const cacheKey = this.getCacheKey(modelId, options);

    // Check memory cache
    const cached = this.memoryCache.get(cacheKey);
    if (cached) {
      cached.lastAccess = Date.now();
      return cached.result;
    }

    // Check IndexedDB
    const serialized = await this.loadFromIndexedDB(cacheKey);
    if (serialized) {
      const result = await this.deserializeImpostor(serialized);
      if (result) {
        this.cacheInMemory(cacheKey, result, options);
        return result;
      }
    }

    return null;
  }

  /**
   * Process the bake queue
   */
  private async processBakeQueue(): Promise<void> {
    if (this.baking) return;
    if (this.bakeQueue.length === 0) return;

    const now = Date.now();
    if (now - this.lastBakeTime < IMPOSTOR_CONFIG.MIN_BAKE_INTERVAL) {
      // Schedule for later
      setTimeout(
        () => this.processBakeQueue(),
        IMPOSTOR_CONFIG.MIN_BAKE_INTERVAL,
      );
      return;
    }

    this.baking = true;

    // Process up to MAX_BAKES_PER_FRAME
    const batchSize = Math.min(
      IMPOSTOR_CONFIG.MAX_BAKES_PER_FRAME,
      this.bakeQueue.length,
    );

    for (let i = 0; i < batchSize; i++) {
      const request = this.bakeQueue.shift();
      if (!request) break;

      try {
        const result = await this.bakeImpostor(request);
        request.resolve(result);
      } catch (error) {
        request.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    this.lastBakeTime = Date.now();
    this.baking = false;

    // Continue processing if more in queue
    if (this.bakeQueue.length > 0) {
      // Use requestIdleCallback if available, otherwise setTimeout
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(() => this.processBakeQueue());
      } else {
        setTimeout(
          () => this.processBakeQueue(),
          IMPOSTOR_CONFIG.MIN_BAKE_INTERVAL,
        );
      }
    }
  }

  /**
   * Bake a single impostor
   */
  private async bakeImpostor(
    request: BakeRequest,
  ): Promise<ImpostorBakeResult> {
    if (!this.initBaker() || !this.octahedralImpostor) {
      throw new Error("ImpostorManager: Baker not initialized");
    }

    const { modelId, source, options } = request;
    const cacheKey = this.getCacheKey(modelId, options);

    // AAA LOD: Prepare mesh IMMEDIATELY before baking (e.g., set idle pose)
    // This is critical - if called earlier, the animation may have moved by bake time
    if (options.prepareForBake) {
      try {
        await options.prepareForBake();
      } catch (err) {
        // Log with ERROR level since this affects visual quality
        console.error(
          `[ImpostorManager] prepareForBake FAILED for ${modelId} - impostor may show wrong pose:`,
          err,
        );
        // Continue baking anyway - a wrong-pose impostor is better than no impostor
        // The error is surfaced to help diagnose visual issues
      }
    }

    // Determine baking config
    const atlasSize = options.atlasSize ?? IMPOSTOR_CONFIG.ATLAS_SIZE;
    const hemisphere = options.hemisphere ?? true;
    const gridSizeX =
      options.gridSizeX ??
      (hemisphere
        ? IMPOSTOR_CONFIG.GRID_SIZE_HEMI_X
        : IMPOSTOR_CONFIG.GRID_SIZE_FULL);
    const gridSizeY =
      options.gridSizeY ??
      (hemisphere
        ? IMPOSTOR_CONFIG.GRID_SIZE_HEMI_Y
        : IMPOSTOR_CONFIG.GRID_SIZE_FULL);

    // Determine bake mode (default to STANDARD for normal maps)
    const bakeMode = options.bakeMode ?? ImpostorBakeMode.STANDARD;

    const config: Partial<ImpostorBakeConfig> = {
      atlasWidth: atlasSize,
      atlasHeight: atlasSize,
      gridSizeX,
      gridSizeY,
      octType: hemisphere ? OctahedronType.HEMI : OctahedronType.FULL,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
    };

    // Bake the impostor using the appropriate method based on bake mode
    let result: ImpostorBakeResult;
    switch (bakeMode) {
      case ImpostorBakeMode.FULL:
        // Full bake: albedo + normals + depth
        result = await this.octahedralImpostor.bakeFull(source, config);
        break;
      case ImpostorBakeMode.STANDARD:
        // Standard bake: albedo + normals (enables dynamic lighting)
        result = await this.octahedralImpostor.bakeWithNormals(source, config);
        break;
      case ImpostorBakeMode.BASIC:
      default:
        // Basic bake: albedo only (fastest, smallest)
        result = await this.octahedralImpostor.bake(source, config);
        break;
    }

    // Debug: Log atlas info
    const atlasImage = result.atlasTexture?.image as
      | { width?: number; height?: number }
      | undefined;
    console.log(
      `[ImpostorManager] Bake result for ${modelId} (mode=${bakeMode}):`,
      {
        atlasWidth: atlasImage?.width ?? "no image",
        atlasHeight: atlasImage?.height ?? "no image",
        gridSizeX: result.gridSizeX,
        gridSizeY: result.gridSizeY,
        hasNormalAtlas: !!result.normalAtlasTexture,
        hasDepthAtlas: !!result.depthAtlasTexture,
        boundingSphere: result.boundingSphere?.radius ?? "none",
      },
    );

    // Cache in memory
    this.cacheInMemory(cacheKey, result, options);

    // Save to IndexedDB (async, don't block)
    this.saveToIndexedDB(cacheKey, result, options).catch((err) => {
      console.warn("[ImpostorManager] Failed to save to IndexedDB:", err);
    });

    this.stats.totalBaked++;
    console.log(
      `[ImpostorManager] Baked impostor: ${modelId} (${atlasSize}x${atlasSize}, ${gridSizeX}x${gridSizeY}, mode=${bakeMode})`,
    );

    return result;
  }

  /**
   * Generate cache key from model ID and options
   *
   * IMPORTANT: Includes all options that affect the baked result to prevent cache collisions.
   * Previously missing gridSizeX/Y could cause wrong-resolution impostors to be returned.
   */
  private getCacheKey(modelId: string, options: ImpostorOptions): string {
    const size = options.atlasSize ?? IMPOSTOR_CONFIG.ATLAS_SIZE;
    const hemi = options.hemisphere ?? true;
    // Include grid size in cache key to prevent collisions
    const gridX = options.gridSizeX ?? (hemi ? 16 : 8);
    const gridY = options.gridSizeY ?? (hemi ? 8 : 8);
    // Include bake mode in cache key (default is "standard" for normals)
    const bakeMode = options.bakeMode ?? ImpostorBakeMode.STANDARD;
    return `${modelId}_${size}_${gridX}x${gridY}_${hemi ? "hemi" : "full"}_${bakeMode}_v${IMPOSTOR_CONFIG.CACHE_VERSION}`;
  }

  /**
   * Cache impostor in memory
   */
  private cacheInMemory(
    key: string,
    result: ImpostorBakeResult,
    options: ImpostorOptions,
  ): void {
    const size = options.atlasSize ?? IMPOSTOR_CONFIG.ATLAS_SIZE;
    const sizeCategory =
      size >= IMPOSTOR_CONFIG.ATLAS_SIZE_HIGH
        ? "large"
        : size >= IMPOSTOR_CONFIG.ATLAS_SIZE
          ? "medium"
          : "small";

    this.memoryCache.set(key, {
      result,
      lastAccess: Date.now(),
      sizeCategory,
    });
  }

  // ============================================================================
  // INDEXEDDB OPERATIONS
  // ============================================================================

  /**
   * Initialize IndexedDB
   */
  private async initIndexedDB(): Promise<void> {
    if (typeof indexedDB === "undefined") {
      console.warn("[ImpostorManager] IndexedDB not available");
      return;
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(
        IMPOSTOR_CONFIG.DB_NAME,
        IMPOSTOR_CONFIG.CACHE_VERSION,
      );

      request.onerror = () => {
        console.warn(
          "[ImpostorManager] Failed to open IndexedDB:",
          request.error,
        );
        resolve(); // Don't fail, just disable persistence
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("[ImpostorManager] IndexedDB initialized");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IMPOSTOR_CONFIG.STORE_NAME)) {
          db.createObjectStore(IMPOSTOR_CONFIG.STORE_NAME, {
            keyPath: "modelId",
          });
        }
      };
    });
  }

  /**
   * Load impostor from IndexedDB
   */
  private async loadFromIndexedDB(
    key: string,
  ): Promise<SerializedImpostor | null> {
    await this.dbReady;
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(
          IMPOSTOR_CONFIG.STORE_NAME,
          "readonly",
        );
        const store = transaction.objectStore(IMPOSTOR_CONFIG.STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const data = request.result as SerializedImpostor | undefined;
          if (data && data.version === IMPOSTOR_CONFIG.CACHE_VERSION) {
            resolve(data);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.warn(
            "[ImpostorManager] IndexedDB read error:",
            request.error,
          );
          resolve(null);
        };
      } catch (err) {
        console.warn("[ImpostorManager] IndexedDB read exception:", err);
        resolve(null);
      }
    });
  }

  /**
   * Save impostor to IndexedDB
   */
  private async saveToIndexedDB(
    key: string,
    result: ImpostorBakeResult,
    options: ImpostorOptions,
  ): Promise<void> {
    await this.dbReady;
    if (!this.db) return;

    // Serialize atlas texture to base64 (pass render target for proper pixel reading)
    const atlasData = await this.textureToBase64(
      result.atlasTexture,
      result.renderTarget,
    );
    if (!atlasData) {
      console.warn(
        `[ImpostorManager] Failed to serialize atlas for ${key} - skipping cache`,
      );
      return;
    }

    const normalData = result.normalAtlasTexture
      ? await this.textureToBase64(
          result.normalAtlasTexture,
          result.normalRenderTarget,
        )
      : undefined;

    const depthData = result.depthAtlasTexture
      ? await this.textureToBase64(
          result.depthAtlasTexture,
          result.depthRenderTarget,
        )
      : undefined;

    const serialized: SerializedImpostor = {
      modelId: key,
      atlasData,
      normalData: normalData ?? undefined,
      depthData: depthData ?? undefined,
      gridSizeX: result.gridSizeX,
      gridSizeY: result.gridSizeY,
      octType: result.octType,
      boundingSphere: {
        center: {
          x: result.boundingSphere.center.x,
          y: result.boundingSphere.center.y,
          z: result.boundingSphere.center.z,
        },
        radius: result.boundingSphere.radius,
      },
      boundingBox: result.boundingBox
        ? {
            min: {
              x: result.boundingBox.min.x,
              y: result.boundingBox.min.y,
              z: result.boundingBox.min.z,
            },
            max: {
              x: result.boundingBox.max.x,
              y: result.boundingBox.max.y,
              z: result.boundingBox.max.z,
            },
          }
        : undefined,
      bakeMode: options.bakeMode ?? ImpostorBakeMode.STANDARD,
      version: IMPOSTOR_CONFIG.CACHE_VERSION,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(
          IMPOSTOR_CONFIG.STORE_NAME,
          "readwrite",
        );
        const store = transaction.objectStore(IMPOSTOR_CONFIG.STORE_NAME);
        const request = store.put(serialized);

        request.onsuccess = () => {
          const totalSize = Math.round(
            (atlasData.length +
              (normalData?.length ?? 0) +
              (depthData?.length ?? 0)) /
              1024,
          );
          console.log(
            `[ImpostorManager] 💾 Saved to IndexedDB: ${key} (${totalSize}KB, normals=${!!normalData}, depth=${!!depthData})`,
          );
          resolve();
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Convert Three.js texture to base64 string
   * Handles both regular textures and render target textures
   *
   * @param texture - The texture to convert
   * @param renderTarget - Optional render target (required for baked impostor textures)
   */
  private async textureToBase64(
    texture: THREE.Texture,
    renderTarget?: THREE.RenderTarget | null,
  ): Promise<string | null> {
    if (!this.renderer) return null;

    try {
      // If we have a render target, read pixels from it (this is how baked impostors work)
      if (renderTarget) {
        const { width, height } = renderTarget;
        let pixels: Uint8Array | null = null;

        // Use async method for WebGPU
        const rendererWithAsync = this.renderer as CompatibleRenderer & {
          readRenderTargetPixelsAsync?: (
            renderTarget: THREE.RenderTarget,
            x: number,
            y: number,
            width: number,
            height: number,
            textureIndex?: number,
            faceIndex?: number,
          ) => Promise<Uint8Array | Float32Array>;
        };

        if (rendererWithAsync.readRenderTargetPixelsAsync) {
          try {
            const result = await rendererWithAsync.readRenderTargetPixelsAsync(
              renderTarget,
              0,
              0,
              width,
              height,
            );
            // Convert to Uint8Array if needed (result could be Float32Array for HDR targets)
            if (result instanceof Uint8Array) {
              pixels = result;
            } else if (result instanceof Float32Array) {
              // Convert float values (0-1) to uint8 (0-255)
              pixels = new Uint8Array(result.length);
              for (let i = 0; i < result.length; i++) {
                pixels[i] = Math.min(
                  255,
                  Math.max(0, Math.round(result[i] * 255)),
                );
              }
            }
          } catch (asyncErr) {
            console.warn(
              "[ImpostorManager] Async pixel read failed, trying sync:",
              asyncErr,
            );
          }
        }

        // WebGPU doesn't have sync readRenderTargetPixels - async is required
        if (!pixels) {
          console.warn(
            "[ImpostorManager] Could not read render target pixels - async method failed",
          );
        }

        if (pixels) {
          // Create canvas and draw pixels
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return null;

          const imageData = ctx.createImageData(width, height);

          // Flip Y axis (WebGPU renders upside down)
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const srcIdx = ((height - y - 1) * width + x) * 4;
              const dstIdx = (y * width + x) * 4;
              imageData.data[dstIdx] = pixels[srcIdx];
              imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
              imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
              imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
            }
          }

          ctx.putImageData(imageData, 0, 0);
          return canvas.toDataURL("image/png");
        }
      }

      // Fallback: try to read from texture image directly
      const textureImage = texture.image as
        | { width?: number; height?: number }
        | undefined;
      const width = textureImage?.width ?? 1024;
      const height = textureImage?.height ?? 1024;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      if (
        texture.image instanceof HTMLImageElement ||
        texture.image instanceof HTMLCanvasElement
      ) {
        ctx.drawImage(texture.image, 0, 0);
        return canvas.toDataURL("image/png");
      } else if (texture.image instanceof ImageData) {
        ctx.putImageData(texture.image, 0, 0);
        return canvas.toDataURL("image/png");
      }

      // No valid source available
      console.warn(
        "[ImpostorManager] Cannot serialize texture: no render target or image source available",
      );
      return null;
    } catch (err) {
      console.warn("[ImpostorManager] Failed to serialize texture:", err);
      return null;
    }
  }

  /**
   * Deserialize impostor from IndexedDB data
   * Supports both legacy base64 PNG and compressed KTX2/Basis formats
   */
  private async deserializeImpostor(
    data: SerializedImpostor,
  ): Promise<ImpostorBakeResult | null> {
    try {
      let atlasTexture: THREE.Texture | null = null;
      let normalAtlasTexture: THREE.Texture | undefined;
      let depthAtlasTexture: THREE.Texture | undefined;

      // Check for KTX2/Basis compressed format first
      if (
        data.textureFormat === "ktx2" ||
        data.textureFormat === "basis" ||
        data.atlasBuffer
      ) {
        // Load compressed textures
        atlasTexture = await this.bufferToKTX2Texture(data.atlasBuffer!, false);
        if (data.normalBuffer) {
          normalAtlasTexture =
            (await this.bufferToKTX2Texture(data.normalBuffer, true)) ??
            undefined;
        }
        if (data.depthBuffer) {
          depthAtlasTexture =
            (await this.bufferToKTX2Texture(data.depthBuffer, true)) ??
            undefined;
        }
      } else if (data.atlasData) {
        // Legacy base64 PNG format
        atlasTexture = await this.base64ToTexture(data.atlasData, false);

        // CRITICAL: Normal and depth textures must use LINEAR color space
        // They contain raw data values (directions, distances), not colors.
        // Using sRGB would apply incorrect gamma decoding and break lighting.
        normalAtlasTexture = data.normalData
          ? ((await this.base64ToTexture(data.normalData, true)) ?? undefined)
          : undefined;

        depthAtlasTexture = data.depthData
          ? ((await this.base64ToTexture(data.depthData, true)) ?? undefined)
          : undefined;
      }

      if (!atlasTexture) return null;

      // Reconstruct bounding sphere and box
      const boundingSphere = new THREE.Sphere(
        new THREE.Vector3(
          data.boundingSphere.center.x,
          data.boundingSphere.center.y,
          data.boundingSphere.center.z,
        ),
        data.boundingSphere.radius,
      );

      const boundingBox = data.boundingBox
        ? new THREE.Box3(
            new THREE.Vector3(
              data.boundingBox.min.x,
              data.boundingBox.min.y,
              data.boundingBox.min.z,
            ),
            new THREE.Vector3(
              data.boundingBox.max.x,
              data.boundingBox.max.y,
              data.boundingBox.max.z,
            ),
          )
        : undefined;

      // Regenerate octMeshData from parameters (it's deterministic)
      // This is needed for view-dependent raycasting
      const octMeshData = buildOctahedronMesh(
        data.octType as 0 | 1,
        data.gridSizeX,
        data.gridSizeY,
        [0, 0, 0],
        false, // useCellCenters
      );
      // Morph to octahedron shape
      lerpOctahedronGeometry(octMeshData, 1.0);
      // Compute bounds for raycasting
      octMeshData.filledMesh.geometry.computeBoundingSphere();
      octMeshData.filledMesh.geometry.computeBoundingBox();
      octMeshData.wireframeMesh.geometry.computeBoundingSphere();
      octMeshData.wireframeMesh.geometry.computeBoundingBox();

      const result: ImpostorBakeResult = {
        atlasTexture,
        renderTarget: null as unknown as THREE.RenderTarget, // Not needed from cache
        normalAtlasTexture: normalAtlasTexture ?? undefined,
        normalRenderTarget: undefined,
        depthAtlasTexture: depthAtlasTexture ?? undefined,
        depthRenderTarget: undefined,
        gridSizeX: data.gridSizeX,
        gridSizeY: data.gridSizeY,
        octType: data.octType as 0 | 1, // OctahedronTypeValue
        boundingSphere,
        boundingBox,
        octMeshData,
      };

      return result;
    } catch (err) {
      console.warn("[ImpostorManager] Failed to deserialize impostor:", err);
      return null;
    }
  }

  /**
   * Convert base64 string to Three.js texture
   * @param base64 - Base64 encoded image data
   * @param isLinear - If true, use LinearSRGBColorSpace (for normals, depth, PBR data)
   */
  private base64ToTexture(
    base64: string,
    isLinear = false,
  ): Promise<THREE.Texture | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const texture = new THREE.Texture(img);
        texture.needsUpdate = true;
        // CRITICAL: Normal/depth/PBR textures must use linear color space
        // to prevent incorrect gamma decoding of raw data values.
        // Only albedo textures should use sRGB.
        texture.colorSpace = isLinear
          ? THREE.LinearSRGBColorSpace
          : THREE.SRGBColorSpace;
        resolve(texture);
      };
      img.onerror = () => {
        console.warn("[ImpostorManager] Failed to load texture from base64");
        resolve(null);
      };
      img.src = base64;
    });
  }

  /**
   * Load a KTX2/Basis compressed texture from an ArrayBuffer
   *
   * @param buffer - The compressed texture data
   * @param isLinear - If true, use LinearSRGBColorSpace (for normals, depth, PBR data)
   */
  private async bufferToKTX2Texture(
    buffer: ArrayBuffer,
    isLinear = false,
  ): Promise<THREE.Texture | null> {
    try {
      // Get the singleton KTX2 loader (must be initialized via initKTX2Loader first)
      const ktx2Loader = getKTX2Loader();
      if (!ktx2Loader) {
        console.warn(
          "[ImpostorManager] KTX2Loader not available. Call initKTX2Loader first.",
        );
        return null;
      }

      // Create a blob URL from the buffer and load it
      const blob = new Blob([buffer], { type: "image/ktx2" });
      const url = URL.createObjectURL(blob);

      try {
        const texture = await ktx2Loader.loadAsync(url);

        // Set color space
        texture.colorSpace = isLinear
          ? THREE.LinearSRGBColorSpace
          : THREE.SRGBColorSpace;

        return texture;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.warn("[ImpostorManager] Failed to load KTX2 texture:", err);
      return null;
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Get statistics
   */
  getStats(): typeof this.stats & {
    queueLength: number;
    memoryCacheSize: number;
  } {
    return {
      ...this.stats,
      queueLength: this.bakeQueue.length,
      memoryCacheSize: this.memoryCache.size,
    };
  }

  /**
   * Clear memory cache
   */
  clearMemoryCache(): void {
    // Dispose textures
    for (const cached of this.memoryCache.values()) {
      cached.result.atlasTexture.dispose();
      cached.result.normalAtlasTexture?.dispose();
      cached.result.depthAtlasTexture?.dispose();
      cached.result.renderTarget?.dispose();
      cached.result.normalRenderTarget?.dispose();
      cached.result.depthRenderTarget?.dispose();
    }
    this.memoryCache.clear();
    console.log("[ImpostorManager] Memory cache cleared");
  }

  /**
   * Clear IndexedDB cache
   */
  async clearIndexedDBCache(): Promise<void> {
    await this.dbReady;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        IMPOSTOR_CONFIG.STORE_NAME,
        "readwrite",
      );
      const store = transaction.objectStore(IMPOSTOR_CONFIG.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log("[ImpostorManager] IndexedDB cache cleared");
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clearMemoryCache();
    this.bakeQueue = [];
    this.octahedralImpostor?.dispose();
    this.octahedralImpostor = null;
    this.db?.close();
    this.db = null;
    ImpostorManager.instance = null;
    console.log("[ImpostorManager] Disposed");
  }
}

export default ImpostorManager;
