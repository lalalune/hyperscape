/**
 * ProcgenCacheDB - IndexedDB persistence for procedurally generated content
 *
 * Stores serialized Three.js geometry and metadata in IndexedDB to avoid
 * regenerating procgen variants on every app load. This provides significant
 * startup performance improvements for rocks, trees, plants, etc.
 *
 * Features:
 * - Geometry serialization (positions, normals, colors, indices)
 * - Metadata storage (dimensions, colors, vertex counts)
 * - Version-aware caching (invalidates on version change)
 * - Separate stores for different procgen types
 */

import * as THREE from "three";

// Database configuration
const DB_NAME = "hyperia-procgen-cache";
const DB_VERSION = 1;

// Store names for different procgen types
export const PROCGEN_STORES = {
  rocks: "rock-variants",
  trees: "tree-variants",
  plants: "plant-variants",
} as const;

export type ProcgenStoreType = keyof typeof PROCGEN_STORES;

/**
 * Serialized buffer attribute data
 */
interface SerializedBufferAttribute {
  array: number[];
  itemSize: number;
  normalized: boolean;
}

/**
 * Serialized geometry data
 */
export interface SerializedGeometry {
  position: SerializedBufferAttribute;
  normal?: SerializedBufferAttribute;
  color?: SerializedBufferAttribute;
  uv?: SerializedBufferAttribute;
  index?: number[];
}

/**
 * Serialized rock variant
 */
export interface SerializedRockVariant {
  geometry: SerializedGeometry;
  lod1Geometry?: SerializedGeometry;
  lod2Geometries?: SerializedGeometry[]; // Card planes
  dimensions: { width: number; height: number; depth: number };
  averageColor: { r: number; g: number; b: number };
  vertexCount: number;
  triangleCount: number;
  /** Preset name for material recreation (LOD0 uses triplanar, LOD1+ uses vertex colors) */
  presetName?: string;
}

/**
 * Serialized leaf instance data (for InstancedMesh recreation)
 */
export interface SerializedLeafInstances {
  /** Instance matrix elements (16 floats per instance) */
  matrices: number[];
  /** Number of leaf instances */
  count: number;
  /** Leaf geometry (single leaf card) */
  geometry: SerializedGeometry;
}

/**
 * Serialized tree variant
 */
export interface SerializedTreeVariant {
  geometries: SerializedGeometry[]; // Multiple meshes (trunk, branches, leaves)
  lod1Geometries?: SerializedGeometry[];
  lod2Geometries?: SerializedGeometry[]; // Card planes
  /** Leaf instances for cluster generation (InstancedMesh data) */
  leafInstances?: SerializedLeafInstances;
  dimensions: { width: number; height: number; trunkHeight: number };
  leafColor: { r: number; g: number; b: number };
  barkColor: { r: number; g: number; b: number };
  vertexCount: number;
  triangleCount: number;
  lod1VertexCount: number;
  lod1TriangleCount: number;
  lod2VertexCount: number;
  lod2TriangleCount: number;
}

/**
 * Cache entry stored in IndexedDB
 */
export interface ProcgenCacheEntry<T> {
  presetName: string;
  variants: T[];
  version: number;
  generatedAt: number;
}

/**
 * ProcgenCacheDB singleton - manages IndexedDB for procgen caching
 */
class ProcgenCacheDB {
  private static instance: ProcgenCacheDB;
  private db: IDBDatabase | null = null;
  private dbReady: Promise<boolean>;
  private initAttempted = false;

  private constructor() {
    this.dbReady = this.initIndexedDB();
  }

  static getInstance(): ProcgenCacheDB {
    if (!ProcgenCacheDB.instance) {
      ProcgenCacheDB.instance = new ProcgenCacheDB();
    }
    return ProcgenCacheDB.instance;
  }

  /**
   * Initialize IndexedDB connection
   */
  private async initIndexedDB(): Promise<boolean> {
    if (typeof indexedDB === "undefined" || typeof window === "undefined") {
      return false;
    }

    if (this.initAttempted && !this.db) {
      return false;
    }
    this.initAttempted = true;

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.warn(
            "[ProcgenCacheDB] IndexedDB open failed:",
            request.error,
          );
          resolve(false);
        };

        request.onsuccess = () => {
          this.db = request.result;
          console.log("[ProcgenCacheDB] IndexedDB initialized");
          resolve(true);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create stores for each procgen type
          for (const storeName of Object.values(PROCGEN_STORES)) {
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName, { keyPath: "presetName" });
            }
          }
        };
      } catch (error) {
        console.warn("[ProcgenCacheDB] IndexedDB init error:", error);
        resolve(false);
      }
    });
  }

  /**
   * Check if IndexedDB is available and ready
   */
  async isReady(): Promise<boolean> {
    return this.dbReady;
  }

  /**
   * Load cached variants for a preset
   */
  async loadCachedVariants<T>(
    storeType: ProcgenStoreType,
    presetName: string,
    currentVersion: number,
  ): Promise<T[] | null> {
    const ready = await this.dbReady;
    if (!ready || !this.db) return null;

    return new Promise((resolve) => {
      try {
        const storeName = PROCGEN_STORES[storeType];
        const transaction = this.db!.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(presetName);

        request.onsuccess = () => {
          const entry = request.result as ProcgenCacheEntry<T> | undefined;
          if (entry && entry.version === currentVersion) {
            resolve(entry.variants);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.warn(
            `[ProcgenCacheDB] Load failed for ${presetName}:`,
            request.error,
          );
          resolve(null);
        };
      } catch (error) {
        console.warn(`[ProcgenCacheDB] Load error for ${presetName}:`, error);
        resolve(null);
      }
    });
  }

  /**
   * Save variants to IndexedDB
   */
  async saveCachedVariants<T>(
    storeType: ProcgenStoreType,
    presetName: string,
    variants: T[],
    version: number,
  ): Promise<void> {
    const ready = await this.dbReady;
    if (!ready || !this.db) return;

    return new Promise((resolve) => {
      try {
        const storeName = PROCGEN_STORES[storeType];
        const transaction = this.db!.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);

        const entry: ProcgenCacheEntry<T> = {
          presetName,
          variants,
          version,
          generatedAt: Date.now(),
        };

        const request = store.put(entry);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.warn(
            `[ProcgenCacheDB] Save failed for ${presetName}:`,
            request.error,
          );
          resolve();
        };
      } catch (error) {
        console.warn(`[ProcgenCacheDB] Save error for ${presetName}:`, error);
        resolve();
      }
    });
  }

  /**
   * Clear all cached variants for a store type
   */
  async clearStore(storeType: ProcgenStoreType): Promise<void> {
    const ready = await this.dbReady;
    if (!ready || !this.db) return;

    return new Promise((resolve) => {
      try {
        const storeName = PROCGEN_STORES[storeType];
        const transaction = this.db!.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        store.clear();
        resolve();
      } catch (error) {
        console.warn(`[ProcgenCacheDB] Clear error:`, error);
        resolve();
      }
    });
  }

  /**
   * Clear all procgen caches
   */
  async clearAll(): Promise<void> {
    for (const storeType of Object.keys(PROCGEN_STORES) as ProcgenStoreType[]) {
      await this.clearStore(storeType);
    }
    console.log("[ProcgenCacheDB] All caches cleared");
  }
}

// Export singleton
export const procgenCacheDB = ProcgenCacheDB.getInstance();

// ============================================================================
// Geometry Serialization Utilities
// ============================================================================

/**
 * Serialize a THREE.BufferAttribute to a plain object
 */
export function serializeBufferAttribute(
  attr: THREE.BufferAttribute,
): SerializedBufferAttribute {
  return {
    array: Array.from(attr.array as Float32Array),
    itemSize: attr.itemSize,
    normalized: attr.normalized,
  };
}

/**
 * Deserialize a plain object back to THREE.BufferAttribute
 */
export function deserializeBufferAttribute(
  data: SerializedBufferAttribute,
): THREE.BufferAttribute {
  const array = new Float32Array(data.array);
  return new THREE.BufferAttribute(array, data.itemSize, data.normalized);
}

/**
 * Serialize a THREE.BufferGeometry to a plain object
 */
export function serializeGeometry(
  geometry: THREE.BufferGeometry,
): SerializedGeometry {
  const result: SerializedGeometry = {
    position: serializeBufferAttribute(
      geometry.attributes.position as THREE.BufferAttribute,
    ),
  };

  if (geometry.attributes.normal) {
    result.normal = serializeBufferAttribute(
      geometry.attributes.normal as THREE.BufferAttribute,
    );
  }

  if (geometry.attributes.color) {
    result.color = serializeBufferAttribute(
      geometry.attributes.color as THREE.BufferAttribute,
    );
  }

  if (geometry.attributes.uv) {
    result.uv = serializeBufferAttribute(
      geometry.attributes.uv as THREE.BufferAttribute,
    );
  }

  if (geometry.index) {
    result.index = Array.from(geometry.index.array);
  }

  return result;
}

/**
 * Deserialize a plain object back to THREE.BufferGeometry
 */
export function deserializeGeometry(
  data: SerializedGeometry,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute("position", deserializeBufferAttribute(data.position));

  if (data.normal) {
    geometry.setAttribute("normal", deserializeBufferAttribute(data.normal));
  }

  if (data.color) {
    geometry.setAttribute("color", deserializeBufferAttribute(data.color));
  }

  if (data.uv) {
    geometry.setAttribute("uv", deserializeBufferAttribute(data.uv));
  }

  if (data.index) {
    geometry.setIndex(Array.from(data.index));
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Serialize a THREE.Color to a plain object
 */
export function serializeColor(color: THREE.Color): {
  r: number;
  g: number;
  b: number;
} {
  return { r: color.r, g: color.g, b: color.b };
}

/**
 * Deserialize a plain object back to THREE.Color
 */
export function deserializeColor(data: {
  r: number;
  g: number;
  b: number;
}): THREE.Color {
  return new THREE.Color(data.r, data.g, data.b);
}
