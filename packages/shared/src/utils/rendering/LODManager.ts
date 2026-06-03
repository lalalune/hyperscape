/**
 * LODManager - Auto-LOD generation with worker decimation and GPU impostor baking.
 * Impostors require GPU and are NOT cached (regenerated on load).
 * Integrated with ModelCache.loadModel() - use options.generateLODs=true to enable.
 */

import THREE, { MeshBasicNodeMaterial } from "../../extras/three/three";
import {
  generateLODsAsync,
  generateLODsSync,
  isLODWorkerAvailable,
  LOD_PRESETS,
  type LODWorkerInput,
  type LODLevelOutput,
  type LODLevelConfig,
} from "../workers/LODWorker";
import {
  OctahedralImpostor,
  OctahedronType,
  type ImpostorBakeResult,
  type CompatibleRenderer,
} from "@hyperforge/impostor";
import type { World } from "../../types";

export type LODCategory =
  | "tree"
  | "bush"
  | "rock"
  | "plant"
  | "building"
  | "character"
  | "item"
  | "default";

export interface LODBundle {
  id: string;
  category: LODCategory;
  lod0: THREE.BufferGeometry;
  lod1?: THREE.BufferGeometry;
  lod2?: THREE.BufferGeometry;
  impostor?: ImpostorBakeResult;
  generatedAt: number;
  stats: {
    lod0Vertices: number;
    lod1Vertices?: number;
    lod2Vertices?: number;
    decimationTimeMs: number;
    impostorTimeMs: number;
    totalTimeMs: number;
  };
}

export interface LODGenerationOptions {
  category?: LODCategory;
  generateLOD1?: boolean;
  generateLOD2?: boolean;
  generateImpostor?: boolean;
  useWorkers?: boolean;
  impostorAtlasSize?: number;
  impostorGridX?: number;
  impostorGridY?: number;
  forceRegenerate?: boolean;
}

const DEFAULT_OPTIONS: Required<LODGenerationOptions> = {
  category: "default",
  generateLOD1: true,
  generateLOD2: true,
  generateImpostor: true,
  useWorkers: true,
  impostorAtlasSize: 1024,
  impostorGridX: 16,
  impostorGridY: 8,
  forceRegenerate: false,
};

const DB_NAME = "hyperia-lods";
const STORE_NAME = "lod-bundles";
const CACHE_VERSION = 1;

export class LODManager {
  private static instance: LODManager | null = null;
  private world: World | null = null;
  private octahedralImpostor: OctahedralImpostor | null = null;
  private usesTSL = false;
  private memoryCache = new Map<string, LODBundle>();
  private db: IDBDatabase | null = null;
  private dbReady: Promise<boolean>;
  private processingQueue = new Map<string, Promise<LODBundle>>();

  private constructor() {
    this.dbReady = this.initIndexedDB();
  }

  static getInstance(): LODManager {
    if (!LODManager.instance) {
      LODManager.instance = new LODManager();
    }
    return LODManager.instance;
  }

  initialize(world: World): void {
    this.world = world;
    const graphics = world.graphics as
      | { renderer?: THREE.WebGPURenderer }
      | undefined;
    const renderer = graphics?.renderer;

    if (renderer) {
      this.octahedralImpostor = new OctahedralImpostor(
        renderer as CompatibleRenderer,
      );
      const backend = renderer.backend as
        | { isWebGPUBackend?: boolean }
        | undefined;
      this.usesTSL = !!backend?.isWebGPUBackend;
      console.log(
        `[LODManager] Initialized: usesTSL=${this.usesTSL}, workers=${isLODWorkerAvailable()}`,
      );
    }
  }

  private async initIndexedDB(): Promise<boolean> {
    if (typeof indexedDB === "undefined") {
      if (typeof window !== "undefined") {
        console.warn("[LODManager] IndexedDB not available");
      }
      return false;
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, CACHE_VERSION);

        request.onerror = () => {
          console.warn("[LODManager] IndexedDB open failed:", request.error);
          resolve(false);
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve(true);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
      } catch (error) {
        console.warn("[LODManager] IndexedDB init error:", error);
        resolve(false);
      }
    });
  }

  async generateLODBundle(
    id: string,
    source: THREE.Object3D | THREE.BufferGeometry,
    options: LODGenerationOptions = {},
  ): Promise<LODBundle> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (!opts.forceRegenerate && this.memoryCache.has(id)) {
      return this.memoryCache.get(id)!;
    }
    if (this.processingQueue.has(id)) {
      return this.processingQueue.get(id)!;
    }
    if (!opts.forceRegenerate) {
      const cached = await this.loadFromIndexedDB(id);
      if (cached) {
        this.memoryCache.set(id, cached);
        return cached;
      }
    }

    const processPromise = this.doGenerateLODBundle(id, source, opts);
    this.processingQueue.set(id, processPromise);

    try {
      const bundle = await processPromise;
      this.processingQueue.delete(id);
      return bundle;
    } catch (error) {
      this.processingQueue.delete(id);
      throw error;
    }
  }

  private async doGenerateLODBundle(
    id: string,
    source: THREE.Object3D | THREE.BufferGeometry,
    opts: Required<LODGenerationOptions>,
  ): Promise<LODBundle> {
    const startTime = performance.now();
    const lod0 = this.extractGeometry(source);
    if (!lod0)
      throw new Error(`[LODManager] Could not extract geometry: ${id}`);

    const positions = lod0.getAttribute("position") as THREE.BufferAttribute;
    const indices = lod0.index;
    const uvs = lod0.getAttribute("uv") as THREE.BufferAttribute | undefined;
    if (!positions) throw new Error(`[LODManager] No positions: ${id}`);

    // Check if source contains skinned meshes - skip decimation if so
    // Animation freezing (via Entity HLOD) handles LOD1 for skinned meshes
    const isSkinned =
      !(source instanceof THREE.BufferGeometry) &&
      this.containsSkinnedMesh(source);
    if (isSkinned) {
      console.log(
        `[LODManager] ${id}: Skinned mesh detected - skipping LOD1/LOD2 decimation (use animation freezing)`,
      );
    }

    const bundle: LODBundle = {
      id,
      category: opts.category,
      lod0: lod0.clone(),
      generatedAt: Date.now(),
      stats: {
        lod0Vertices: positions.count,
        decimationTimeMs: 0,
        impostorTimeMs: 0,
        totalTimeMs: 0,
      },
    };

    // Skip LOD1/LOD2 decimation for skinned meshes - decimation loses bone weights
    // Entity HLOD system uses freezeAnimationAtLOD1 to pause animations at distance instead
    if ((opts.generateLOD1 || opts.generateLOD2) && indices && !isSkinned) {
      const decimationStart = performance.now();
      const workerInput: LODWorkerInput = {
        meshId: id,
        positions: new Float32Array(positions.array),
        indices:
          indices.array instanceof Uint32Array
            ? new Uint32Array(indices.array)
            : new Uint32Array(indices.array),
        uvs: uvs ? new Float32Array(uvs.array) : undefined,
        lodConfigs: this.getLODConfigs(opts),
        category: opts.category,
      };

      const useWorkers = opts.useWorkers && isLODWorkerAvailable();
      const lodResult = useWorkers
        ? await generateLODsAsync(workerInput)
        : generateLODsSync(workerInput);

      for (const level of lodResult.levels) {
        const geometry = this.createGeometryFromLODLevel(level);
        if (level.name === "lod1") {
          bundle.lod1 = geometry;
          bundle.stats.lod1Vertices = level.finalVertices;
        } else if (level.name === "lod2") {
          bundle.lod2 = geometry;
          bundle.stats.lod2Vertices = level.finalVertices;
        }
      }
      bundle.stats.decimationTimeMs = performance.now() - decimationStart;
    }

    if (opts.generateImpostor && this.octahedralImpostor) {
      const impostorStart = performance.now();
      const bakeSource =
        source instanceof THREE.BufferGeometry
          ? this.geometryToMesh(source)
          : source;
      // bake() is async and must be awaited
      bundle.impostor = await this.octahedralImpostor.bake(bakeSource, {
        atlasWidth: opts.impostorAtlasSize,
        atlasHeight: opts.impostorAtlasSize,
        gridSizeX: opts.impostorGridX,
        gridSizeY: opts.impostorGridY,
        octType: OctahedronType.HEMI,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
      });
      bundle.stats.impostorTimeMs = performance.now() - impostorStart;
    }

    bundle.stats.totalTimeMs = performance.now() - startTime;
    this.memoryCache.set(id, bundle);
    this.saveToIndexedDB(bundle);

    console.log(
      `[LODManager] ${id}: LOD0=${bundle.stats.lod0Vertices}v, LOD1=${bundle.stats.lod1Vertices ?? "N/A"}v, LOD2=${bundle.stats.lod2Vertices ?? "N/A"}v, ${bundle.stats.totalTimeMs.toFixed(0)}ms`,
    );
    return bundle;
  }

  private getLODConfigs(
    opts: Required<LODGenerationOptions>,
  ): LODLevelConfig[] {
    const presets = LOD_PRESETS[opts.category] ?? LOD_PRESETS.default;
    const configs: LODLevelConfig[] = [];
    if (opts.generateLOD1) {
      const lod1 = presets.find((p) => p.name === "lod1");
      if (lod1) configs.push(lod1);
    }
    if (opts.generateLOD2) {
      const lod2 = presets.find((p) => p.name === "lod2");
      if (lod2) configs.push(lod2);
    }
    return configs;
  }

  /**
   * Check if an object contains skinned meshes (animated characters).
   * Skinned meshes use animation freezing at LOD1 instead of geometry decimation.
   */
  private containsSkinnedMesh(source: THREE.Object3D): boolean {
    let hasSkinned = false;
    source.traverse((node) => {
      if ((node as THREE.SkinnedMesh).isSkinnedMesh) {
        hasSkinned = true;
      }
    });
    return hasSkinned;
  }

  private extractGeometry(
    source: THREE.Object3D | THREE.BufferGeometry,
  ): THREE.BufferGeometry | null {
    if (source instanceof THREE.BufferGeometry) return source;

    // For skinned meshes, still extract geometry for LOD0 and impostor baking
    // LOD1/LOD2 decimation is skipped in doGenerateLODBundle because it would
    // lose bone weight data. Entity HLOD uses animation freezing instead.

    let geometry: THREE.BufferGeometry | null = null;
    source.traverse((node) => {
      if (!geometry && node instanceof THREE.Mesh && node.geometry)
        geometry = node.geometry;
    });
    return geometry;
  }

  private createGeometryFromLODLevel(
    level: LODLevelOutput,
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(level.positions, 3),
    );
    geometry.setIndex(new THREE.BufferAttribute(level.indices, 1));
    if (level.uvs && level.uvs.length > 0)
      geometry.setAttribute("uv", new THREE.BufferAttribute(level.uvs, 2));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  private geometryToMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
    // Use MeshBasicNodeMaterial for WebGPU compatibility
    const mat = new MeshBasicNodeMaterial();
    mat.color = new THREE.Color(0xffffff);
    return new THREE.Mesh(geometry, mat);
  }

  private async loadFromIndexedDB(id: string): Promise<LODBundle | null> {
    await this.dbReady;
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(id);
        request.onsuccess = () =>
          resolve(
            request.result ? this.deserializeBundle(request.result) : null,
          );
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async saveToIndexedDB(bundle: LODBundle): Promise<void> {
    await this.dbReady;
    if (!this.db) return;
    try {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(this.serializeBundle(bundle));
    } catch (error) {
      console.warn("[LODManager] IndexedDB save failed:", error);
    }
  }

  // Impostors NOT serialized - require GPU regeneration
  private serializeBundle(bundle: LODBundle): object {
    const serializeGeom = (geom: THREE.BufferGeometry) => ({
      positions: Array.from(geom.getAttribute("position").array),
      indices: geom.index ? Array.from(geom.index.array) : null,
      uvs: geom.getAttribute("uv")
        ? Array.from((geom.getAttribute("uv") as THREE.BufferAttribute).array)
        : null,
    });
    return {
      id: bundle.id,
      category: bundle.category,
      generatedAt: bundle.generatedAt,
      stats: bundle.stats,
      lod0: serializeGeom(bundle.lod0),
      lod1: bundle.lod1 ? serializeGeom(bundle.lod1) : null,
      lod2: bundle.lod2 ? serializeGeom(bundle.lod2) : null,
    };
  }

  private deserializeBundle(data: {
    id: string;
    category: LODCategory;
    generatedAt: number;
    stats: LODBundle["stats"];
    lod0: {
      positions: number[];
      indices: number[] | null;
      uvs: number[] | null;
    };
    lod1: {
      positions: number[];
      indices: number[] | null;
      uvs: number[] | null;
    } | null;
    lod2: {
      positions: number[];
      indices: number[] | null;
      uvs: number[] | null;
    } | null;
  }): LODBundle {
    const deserializeGeom = (stored: {
      positions: number[];
      indices: number[] | null;
      uvs: number[] | null;
    }) => {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(stored.positions, 3),
      );
      if (stored.indices)
        geom.setIndex(new THREE.Uint32BufferAttribute(stored.indices, 1));
      if (stored.uvs)
        geom.setAttribute(
          "uv",
          new THREE.Float32BufferAttribute(stored.uvs, 2),
        );
      geom.computeVertexNormals();
      return geom;
    };
    return {
      id: data.id,
      category: data.category,
      generatedAt: data.generatedAt,
      stats: data.stats,
      lod0: deserializeGeom(data.lod0),
      lod1: data.lod1 ? deserializeGeom(data.lod1) : undefined,
      lod2: data.lod2 ? deserializeGeom(data.lod2) : undefined,
    };
  }

  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    await this.dbReady;
    if (this.db)
      this.db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .clear();
  }

  getCacheStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      workersAvailable: isLODWorkerAvailable(),
      usesTSL: this.usesTSL,
    };
  }
}

export const lodManager = LODManager.getInstance();
