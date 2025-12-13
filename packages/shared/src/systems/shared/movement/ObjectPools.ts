/**
 * Object Pools for Movement System
 *
 * Minimizes GC pressure in hot paths by reusing data structures.
 * BFS pathfinding can allocate significant memory per call (Set, Map, Array).
 * This pool allows reuse of these structures across pathfinding operations.
 *
 * Memory impact: Without pooling, a 128x128 BFS search can allocate:
 * - Set<string>: ~16k entries worst case
 * - Map<string, TileCoord>: ~16k entries worst case
 * - Array queue: variable, typically 100-1000 entries
 *
 * With pooling, these allocations happen once at startup and are reused.
 */

import type { TileCoord } from "./TileSystem";

// ============================================================================
// BFS DATA STRUCTURE POOL
// ============================================================================

/**
 * Pooled data structures for BFS pathfinding
 */
export interface BFSPooledData {
  /** Visited tile keys (cleared on acquire) */
  visited: Set<string>;
  /** Parent map for path reconstruction (cleared on acquire) */
  parent: Map<string, TileCoord>;
  /** Queue for BFS frontier (cleared on acquire) */
  queue: TileCoord[];
}

/** Pool size - should match max concurrent pathfinding operations */
const BFS_POOL_SIZE = 8;

/**
 * Object pool for BFS data structures
 *
 * Usage:
 * ```typescript
 * const data = bfsPool.acquire();
 * try {
 *   // Use data.visited, data.parent, data.queue
 * } finally {
 *   bfsPool.release(data);
 * }
 * ```
 */
class BFSDataPool {
  private pool: BFSPooledData[] = [];
  private inUse: Set<BFSPooledData> = new Set();
  private allocations = 0;

  constructor() {
    // Pre-allocate pool entries
    for (let i = 0; i < BFS_POOL_SIZE; i++) {
      this.pool.push(this.createEntry());
    }
  }

  /**
   * Acquire a pooled data structure
   * Returns null if pool is exhausted and creates new (logged as warning)
   */
  acquire(): BFSPooledData {
    // Find an available entry
    for (const data of this.pool) {
      if (!this.inUse.has(data)) {
        this.inUse.add(data);
        // Clear for reuse
        data.visited.clear();
        data.parent.clear();
        data.queue.length = 0;
        return data;
      }
    }

    // Pool exhausted - allocate new (this should be rare)
    this.allocations++;
    if (this.allocations <= 5) {
      console.warn(
        `[BFSPool] Pool exhausted (${this.inUse.size}/${BFS_POOL_SIZE} in use), allocating new entry #${this.allocations}`,
      );
    }

    // Create new entry (not added to pool, will be GC'd after release)
    return this.createEntry();
  }

  /**
   * Release a data structure back to the pool
   */
  release(data: BFSPooledData): void {
    this.inUse.delete(data);
  }

  /**
   * Get pool statistics (for debugging/monitoring)
   */
  getStats(): { poolSize: number; inUse: number; allocations: number } {
    return {
      poolSize: this.pool.length,
      inUse: this.inUse.size,
      allocations: this.allocations,
    };
  }

  private createEntry(): BFSPooledData {
    return {
      visited: new Set(),
      parent: new Map(),
      queue: [],
    };
  }
}

/** Singleton BFS data pool */
export const bfsPool = new BFSDataPool();

// ============================================================================
// CACHED TIMESTAMP
// ============================================================================

/**
 * Cached timestamp to avoid Date.now() calls in hot paths.
 *
 * Date.now() is relatively cheap but still:
 * - Creates a number allocation
 * - Requires system call overhead
 * - Adds up when called thousands of times per tick
 *
 * Update once per tick, read many times.
 */
let cachedTimestamp = Date.now();

/**
 * Get the cached timestamp
 * Use this instead of Date.now() in hot paths
 */
export function getCachedTimestamp(): number {
  return cachedTimestamp;
}

/**
 * Update the cached timestamp
 * Call this once at the start of each tick
 */
export function updateCachedTimestamp(): void {
  cachedTimestamp = Date.now();
}

// ============================================================================
// TILE COORDINATE POOL (for future use)
// ============================================================================

/**
 * Simple object pool for TileCoord objects
 * Useful if we need to reduce TileCoord allocations in the future
 */
class TileCoordPool {
  private pool: TileCoord[] = [];
  private maxSize = 256;

  acquire(x: number, z: number): TileCoord {
    const coord = this.pool.pop();
    if (coord) {
      coord.x = x;
      coord.z = z;
      return coord;
    }
    return { x, z };
  }

  release(coord: TileCoord): void {
    if (this.pool.length < this.maxSize) {
      this.pool.push(coord);
    }
  }

  getSize(): number {
    return this.pool.length;
  }
}

/** Singleton tile coordinate pool */
export const tileCoordPool = new TileCoordPool();
