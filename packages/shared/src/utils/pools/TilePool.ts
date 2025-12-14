/**
 * TilePool - Object pool for tile coordinates
 *
 * Eliminates allocations in hot paths like combat range checks.
 * Uses a simple pooling pattern with automatic growth.
 *
 * Performance characteristics:
 * - O(1) acquire/release operations
 * - Zero allocations after warmup (unless pool exhausted)
 * - Automatic pool growth when exhausted
 *
 * Usage:
 *   const tile = tilePool.acquire();
 *   tilePool.setFromWorld(tile, worldX, worldZ);
 *   // ... use tile ...
 *   tilePool.release(tile);
 *
 *   // Or use convenience method:
 *   const inRange = tilePool.withTiles(pos1, pos2, (t1, t2) => {
 *     return tilesWithinRange(t1, t2, range);
 *   });
 */

/**
 * Pooled tile coordinate
 */
export interface PooledTile {
  x: number;
  z: number;
  /** Internal pool index - do not modify */
  _poolIndex: number;
}

/**
 * Position interface for world coordinates
 */
interface Position3D {
  x: number;
  y: number;
  z: number;
}

/** Tile size in world units (1 meter = 1 tile) */
const TILE_SIZE = 1.0;

/**
 * Object pool for tile coordinates used in distance calculations.
 * Thread-safe within single tick (no async between acquire/release).
 */
class TilePoolImpl {
  private pool: PooledTile[] = [];
  private available: number[] = [];
  private readonly INITIAL_SIZE = 64;
  private readonly GROW_SIZE = 32;

  constructor() {
    this.grow(this.INITIAL_SIZE);
  }

  /**
   * Grow the pool by adding more tiles
   */
  private grow(count: number): void {
    const startIndex = this.pool.length;
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      this.pool.push({
        x: 0,
        z: 0,
        _poolIndex: index,
      });
      this.available.push(index);
    }
  }

  /**
   * Acquire a tile from the pool.
   * Returns a reset tile (0, 0).
   *
   * IMPORTANT: Must call release() when done to return to pool.
   */
  acquire(): PooledTile {
    if (this.available.length === 0) {
      this.grow(this.GROW_SIZE);
    }
    const index = this.available.pop()!;
    return this.pool[index];
  }

  /**
   * Release a tile back to the pool.
   * Resets tile coordinates before returning.
   */
  release(tile: PooledTile): void {
    // Reset to zero
    tile.x = 0;
    tile.z = 0;
    this.available.push(tile._poolIndex);
  }

  /**
   * Set tile coordinates from world position.
   * Uses floor to ensure consistent tile boundaries.
   */
  setFromWorld(tile: PooledTile, worldX: number, worldZ: number): void {
    tile.x = Math.floor(worldX / TILE_SIZE);
    tile.z = Math.floor(worldZ / TILE_SIZE);
  }

  /**
   * Set tile coordinates from a Position3D (ignores Y).
   */
  setFromPosition(tile: PooledTile, pos: Position3D): void {
    tile.x = Math.floor(pos.x / TILE_SIZE);
    tile.z = Math.floor(pos.z / TILE_SIZE);
  }

  /**
   * Copy values from another tile.
   */
  copy(target: PooledTile, source: { x: number; z: number }): void {
    target.x = source.x;
    target.z = source.z;
  }

  /**
   * Set tile coordinates directly.
   */
  set(tile: PooledTile, x: number, z: number): void {
    tile.x = x;
    tile.z = z;
  }

  /**
   * Convenience method for operations requiring two tiles.
   * Automatically handles acquire/release.
   *
   * Example:
   *   const inRange = tilePool.withTiles(attackerPos, targetPos, (t1, t2) => {
   *     return tilesWithinRange(t1, t2, combatRange);
   *   });
   */
  withTiles<T>(
    pos1: Position3D,
    pos2: Position3D,
    fn: (tile1: PooledTile, tile2: PooledTile) => T,
  ): T {
    const t1 = this.acquire();
    const t2 = this.acquire();
    try {
      this.setFromPosition(t1, pos1);
      this.setFromPosition(t2, pos2);
      return fn(t1, t2);
    } finally {
      this.release(t1);
      this.release(t2);
    }
  }

  /**
   * Convenience method for single tile operations.
   * Automatically handles acquire/release.
   */
  withTile<T>(pos: Position3D, fn: (tile: PooledTile) => T): T {
    const t = this.acquire();
    try {
      this.setFromPosition(t, pos);
      return fn(t);
    } finally {
      this.release(t);
    }
  }

  /**
   * Calculate Chebyshev distance between two tiles.
   * This is the OSRS-style distance used for range checks.
   */
  chebyshevDistance(a: PooledTile, b: PooledTile): number {
    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs(a.z - b.z);
    return Math.max(dx, dz);
  }

  /**
   * Calculate Manhattan distance between two tiles.
   * Useful for cardinal-only movement checks.
   */
  manhattanDistance(a: PooledTile, b: PooledTile): number {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }

  /**
   * Check if two tiles are within range (Chebyshev distance).
   * Returns false if tiles are the same (range 0).
   */
  isWithinRange(a: PooledTile, b: PooledTile, range: number): boolean {
    const dist = this.chebyshevDistance(a, b);
    return dist > 0 && dist <= Math.max(1, Math.floor(range));
  }

  /**
   * Get pool statistics (for monitoring/debugging).
   */
  getStats(): { total: number; available: number; inUse: number } {
    return {
      total: this.pool.length,
      available: this.available.length,
      inUse: this.pool.length - this.available.length,
    };
  }

  /**
   * Reset pool to initial state.
   * Use with caution - invalidates all acquired tiles.
   */
  reset(): void {
    this.pool = [];
    this.available = [];
    this.grow(this.INITIAL_SIZE);
  }
}

/**
 * Global tile pool instance.
 * Use this singleton for all combat distance calculations.
 */
export const tilePool = new TilePoolImpl();
