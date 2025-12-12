/**
 * MobPool - Object Pool for Mob Entity Reuse
 *
 * Reduces garbage collection pressure by reusing MobEntity objects instead of
 * creating/destroying them on spawn/death cycles.
 *
 * **Why Pooling Matters:**
 * - Creating objects is expensive (memory allocation, constructor logic)
 * - GC pauses cause frame stutters
 * - Mobs respawn frequently (15-minute cycle per GDD)
 * - Open world = many mobs spawning/despawning as player moves
 *
 * **How It Works:**
 * - Pre-allocate pool of inactive MobEntity objects
 * - On spawn: grab from pool, reset state, return to world
 * - On death: remove from world, reset state, return to pool
 * - Pool grows dynamically if needed (but warns)
 *
 * **Usage:**
 * ```ts
 * const pool = new MobPool(world, 100); // Pre-allocate 100 mobs
 *
 * // Spawn
 * const mob = pool.acquire('goblin', spawnConfig);
 *
 * // Death/Despawn
 * pool.release(mob);
 * ```
 *
 * @see MobEntity for the entity being pooled
 * @see MobNPCSpawnerSystem for spawn/despawn triggers
 */

import type { World } from "../../core/World";
import type { MobEntityConfig } from "../../types/entities";
import { Matrix4, Vector3 } from "../../extras/three/three";

/**
 * Pool entry tracking a mob's state
 */
interface PoolEntry<T> {
  /** The pooled object */
  object: T;
  /** Whether currently in use */
  inUse: boolean;
  /** Mob type this entry is configured for */
  mobType: string | null;
  /** Last time this entry was used */
  lastUsedTime: number;
}

/**
 * Statistics about pool usage
 */
export interface PoolStats {
  /** Total entries in pool */
  totalEntries: number;
  /** Entries currently in use */
  inUse: number;
  /** Entries available for reuse */
  available: number;
  /** Times pool had to grow */
  growthCount: number;
  /** Peak concurrent usage */
  peakUsage: number;
  /** Per-type breakdown */
  byType: Record<string, { inUse: number; available: number }>;
}

/**
 * Generic object pool implementation
 */
export class ObjectPool<T> {
  private pool: PoolEntry<T>[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private growthCount = 0;
  private peakUsage = 0;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 0,
  ) {
    this.factory = factory;
    this.reset = reset;

    // Pre-allocate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push({
        object: this.factory(),
        inUse: false,
        mobType: null,
        lastUsedTime: 0,
      });
    }
  }

  /**
   * Acquire an object from the pool
   */
  acquire(): T {
    // Find an available entry
    for (const entry of this.pool) {
      if (!entry.inUse) {
        entry.inUse = true;
        entry.lastUsedTime = Date.now();
        this.updatePeakUsage();
        return entry.object;
      }
    }

    // Pool exhausted - grow it
    this.growthCount++;
    console.warn(
      `[ObjectPool] Pool exhausted, growing. Total size: ${this.pool.length + 1}`,
    );

    const newEntry: PoolEntry<T> = {
      object: this.factory(),
      inUse: true,
      mobType: null,
      lastUsedTime: Date.now(),
    };
    this.pool.push(newEntry);
    this.updatePeakUsage();

    return newEntry.object;
  }

  /**
   * Release an object back to the pool
   */
  release(obj: T): void {
    for (const entry of this.pool) {
      if (entry.object === obj) {
        if (!entry.inUse) {
          console.warn(
            "[ObjectPool] Attempted to release already-released object",
          );
          return;
        }
        entry.inUse = false;
        this.reset(entry.object);
        return;
      }
    }
    console.warn("[ObjectPool] Attempted to release object not from this pool");
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    inUse: number;
    available: number;
    growthCount: number;
    peakUsage: number;
  } {
    let inUse = 0;
    for (const entry of this.pool) {
      if (entry.inUse) inUse++;
    }
    return {
      total: this.pool.length,
      inUse,
      available: this.pool.length - inUse,
      growthCount: this.growthCount,
      peakUsage: this.peakUsage,
    };
  }

  /**
   * Clear all entries from pool
   */
  clear(): void {
    this.pool = [];
    this.growthCount = 0;
    this.peakUsage = 0;
  }

  private updatePeakUsage(): void {
    let inUse = 0;
    for (const entry of this.pool) {
      if (entry.inUse) inUse++;
    }
    this.peakUsage = Math.max(this.peakUsage, inUse);
  }
}

/**
 * Specialized pool for mob configurations
 * Caches and reuses mob config objects to reduce allocations
 */
export class MobConfigPool {
  private configPools = new Map<string, MobEntityConfig[]>();
  private maxPerType = 50;

  /**
   * Get or create a config object for a mob type
   */
  acquire(mobType: string, baseConfig: MobEntityConfig): MobEntityConfig {
    let pool = this.configPools.get(mobType);
    if (!pool) {
      pool = [];
      this.configPools.set(mobType, pool);
    }

    // Try to reuse existing config
    const existingConfig = pool.pop();
    if (existingConfig) {
      // Reset and copy new values
      Object.assign(existingConfig, baseConfig);
      return existingConfig;
    }

    // Create new config (will be pooled on release)
    return { ...baseConfig };
  }

  /**
   * Return a config to the pool
   */
  release(config: MobEntityConfig): void {
    const mobType = config.mobType;
    let pool = this.configPools.get(mobType);
    if (!pool) {
      pool = [];
      this.configPools.set(mobType, pool);
    }

    if (pool.length < this.maxPerType) {
      pool.push(config);
    }
    // If pool is full, let GC collect it
  }

  /**
   * Get pool statistics
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [type, pool] of this.configPools) {
      stats[type] = pool.length;
    }
    return stats;
  }

  /**
   * Clear all pooled configs
   */
  clear(): void {
    this.configPools.clear();
  }
}

/**
 * Matrix pool for reusing Matrix4 objects
 * Prevents allocation during transform updates
 */
export class MatrixPool {
  private pool: Matrix4[] = [];
  private inUse = new Set<Matrix4>();

  constructor(initialSize: number = 100) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(new Matrix4());
    }
  }

  acquire(): Matrix4 {
    const matrix = this.pool.pop();
    if (matrix) {
      this.inUse.add(matrix);
      return matrix;
    }

    // Pool exhausted - create new
    const newMatrix = new Matrix4();
    this.inUse.add(newMatrix);
    return newMatrix;
  }

  release(matrix: Matrix4): void {
    if (this.inUse.has(matrix)) {
      this.inUse.delete(matrix);
      matrix.identity(); // Reset to identity
      this.pool.push(matrix);
    }
  }

  getStats(): { available: number; inUse: number } {
    return {
      available: this.pool.length,
      inUse: this.inUse.size,
    };
  }
}

/**
 * Vector3 pool for reusing Vector3 objects
 */
export class Vector3Pool {
  private pool: Vector3[] = [];
  private inUse = new Set<Vector3>();

  constructor(initialSize: number = 200) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(new Vector3());
    }
  }

  acquire(): Vector3 {
    const vec = this.pool.pop();
    if (vec) {
      this.inUse.add(vec);
      return vec;
    }

    const newVec = new Vector3();
    this.inUse.add(newVec);
    return newVec;
  }

  release(vec: Vector3): void {
    if (this.inUse.has(vec)) {
      this.inUse.delete(vec);
      vec.set(0, 0, 0);
      this.pool.push(vec);
    }
  }

  getStats(): { available: number; inUse: number } {
    return {
      available: this.pool.length,
      inUse: this.inUse.size,
    };
  }
}

/**
 * Centralized pool manager for mob-related objects
 */
export class MobPoolManager {
  private world: World;
  private configPool: MobConfigPool;
  private matrixPool: MatrixPool;
  private vectorPool: Vector3Pool;

  constructor(world: World) {
    this.world = world;
    this.configPool = new MobConfigPool();
    this.matrixPool = new MatrixPool(100);
    this.vectorPool = new Vector3Pool(200);
  }

  /**
   * Acquire a mob config from pool
   */
  acquireConfig(mobType: string, baseConfig: MobEntityConfig): MobEntityConfig {
    return this.configPool.acquire(mobType, baseConfig);
  }

  /**
   * Release a mob config back to pool
   */
  releaseConfig(config: MobEntityConfig): void {
    this.configPool.release(config);
  }

  /**
   * Acquire a matrix from pool
   */
  acquireMatrix(): Matrix4 {
    return this.matrixPool.acquire();
  }

  /**
   * Release a matrix back to pool
   */
  releaseMatrix(matrix: Matrix4): void {
    this.matrixPool.release(matrix);
  }

  /**
   * Acquire a vector from pool
   */
  acquireVector(): Vector3 {
    return this.vectorPool.acquire();
  }

  /**
   * Release a vector back to pool
   */
  releaseVector(vec: Vector3): void {
    this.vectorPool.release(vec);
  }

  /**
   * Get comprehensive pool statistics
   */
  getStats(): {
    configs: Record<string, number>;
    matrices: { available: number; inUse: number };
    vectors: { available: number; inUse: number };
  } {
    return {
      configs: this.configPool.getStats(),
      matrices: this.matrixPool.getStats(),
      vectors: this.vectorPool.getStats(),
    };
  }

  /**
   * Clear all pools
   */
  clear(): void {
    this.configPool.clear();
  }
}
