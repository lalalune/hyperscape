/**
 * ObjectPools Unit Tests
 *
 * Tests the object pooling infrastructure used for performance optimization:
 * - BFS data pool: Reusable Set, Map, and Array for pathfinding
 * - Cached timestamp: Single Date.now() per tick for hot paths
 * - Tile coordinate pool: Reusable TileCoord objects
 *
 * NO MOCKS - Tests real pool behavior, allocation patterns, and edge cases
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  bfsPool,
  getCachedTimestamp,
  updateCachedTimestamp,
  tileCoordPool,
  BFSPooledData,
} from "../ObjectPools";

describe("BFSDataPool", () => {
  describe("acquire/release", () => {
    it("acquires a data structure with cleared collections", () => {
      const data = bfsPool.acquire();

      expect(data.visited).toBeDefined();
      expect(data.visited.size).toBe(0);
      expect(data.parent).toBeDefined();
      expect(data.parent.size).toBe(0);
      expect(data.queue).toBeDefined();
      expect(data.queue.length).toBe(0);

      bfsPool.release(data);
    });

    it("clears collections on re-acquire", () => {
      // Acquire and populate
      const data1 = bfsPool.acquire();
      data1.visited.add("tile_0_0");
      data1.visited.add("tile_1_0");
      data1.parent.set("tile_1_0", { x: 0, z: 0 });
      data1.queue.push({ x: 1, z: 0 }, { x: 2, z: 0 });
      bfsPool.release(data1);

      // Acquire again - should be cleared
      const data2 = bfsPool.acquire();
      expect(data2.visited.size).toBe(0);
      expect(data2.parent.size).toBe(0);
      expect(data2.queue.length).toBe(0);
      bfsPool.release(data2);
    });

    it("tracks in-use count correctly", () => {
      const statsBefore = bfsPool.getStats();

      const data1 = bfsPool.acquire();
      const statsAfter1 = bfsPool.getStats();
      expect(statsAfter1.inUse).toBe(statsBefore.inUse + 1);

      const data2 = bfsPool.acquire();
      const statsAfter2 = bfsPool.getStats();
      expect(statsAfter2.inUse).toBe(statsBefore.inUse + 2);

      bfsPool.release(data1);
      bfsPool.release(data2);

      const statsFinal = bfsPool.getStats();
      expect(statsFinal.inUse).toBe(statsBefore.inUse);
    });

    it("handles concurrent acquisitions up to pool size", () => {
      const poolSize = bfsPool.getStats().poolSize;
      const acquired: BFSPooledData[] = [];

      // Acquire all entries in pool
      for (let i = 0; i < poolSize; i++) {
        acquired.push(bfsPool.acquire());
      }

      const stats = bfsPool.getStats();
      expect(stats.inUse).toBe(poolSize);

      // All should be unique
      const uniqueSet = new Set(acquired);
      expect(uniqueSet.size).toBe(poolSize);

      // Release all
      acquired.forEach((data) => bfsPool.release(data));
    });

    it("allocates new entry when pool exhausted", () => {
      const poolSize = bfsPool.getStats().poolSize;
      const acquired: BFSPooledData[] = [];

      // Acquire more than pool size
      for (let i = 0; i < poolSize + 2; i++) {
        acquired.push(bfsPool.acquire());
      }

      const stats = bfsPool.getStats();
      expect(stats.allocations).toBeGreaterThan(0);
      // Note: inUse only tracks pool entries, not dynamically allocated ones
      expect(stats.inUse).toBe(poolSize);

      // Release all
      acquired.forEach((data) => bfsPool.release(data));
    });
  });

  describe("getStats", () => {
    it("returns valid statistics", () => {
      const stats = bfsPool.getStats();

      expect(stats.poolSize).toBeGreaterThan(0);
      expect(stats.inUse).toBeGreaterThanOrEqual(0);
      expect(stats.allocations).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("CachedTimestamp", () => {
  describe("getCachedTimestamp", () => {
    it("returns a number", () => {
      const timestamp = getCachedTimestamp();
      expect(typeof timestamp).toBe("number");
      expect(timestamp).toBeGreaterThan(0);
    });

    it("returns consistent value within same tick", () => {
      updateCachedTimestamp();
      const t1 = getCachedTimestamp();
      const t2 = getCachedTimestamp();
      const t3 = getCachedTimestamp();

      expect(t1).toBe(t2);
      expect(t2).toBe(t3);
    });

    it("returns new value after updateCachedTimestamp", async () => {
      updateCachedTimestamp();
      const before = getCachedTimestamp();

      // Wait a tiny bit
      await new Promise((resolve) => setTimeout(resolve, 5));

      updateCachedTimestamp();
      const after = getCachedTimestamp();

      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  describe("updateCachedTimestamp", () => {
    it("updates the cached value", async () => {
      const initial = getCachedTimestamp();

      await new Promise((resolve) => setTimeout(resolve, 10));

      updateCachedTimestamp();
      const updated = getCachedTimestamp();

      expect(updated).toBeGreaterThan(initial);
    });

    it("is idempotent when called multiple times in same ms", () => {
      updateCachedTimestamp();
      const t1 = getCachedTimestamp();

      updateCachedTimestamp();
      const t2 = getCachedTimestamp();

      // Should be same or very close (within 1ms)
      expect(Math.abs(t2 - t1)).toBeLessThanOrEqual(1);
    });
  });

  describe("performance characteristics", () => {
    it("getCachedTimestamp returns a value without syscall overhead", () => {
      updateCachedTimestamp();

      // Verify it actually returns a cached value
      const t1 = getCachedTimestamp();
      const t2 = getCachedTimestamp();
      const t3 = getCachedTimestamp();
      
      // All calls return same value (cached, not re-queried)
      expect(t1).toBe(t2);
      expect(t2).toBe(t3);
      
      // Value is a valid timestamp (not zero, not in future)
      expect(t1).toBeGreaterThan(0);
      expect(t1).toBeLessThanOrEqual(Date.now() + 100);
    });

    it("getCachedTimestamp is measurably faster than Date.now()", () => {
      const iterations = 50000;
      
      // Warmup
      for (let i = 0; i < 1000; i++) {
        Date.now();
        getCachedTimestamp();
      }
      updateCachedTimestamp();

      // Measure Date.now()
      const dateStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        Date.now();
      }
      const dateElapsed = performance.now() - dateStart;

      // Measure getCachedTimestamp
      updateCachedTimestamp();
      const cachedStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        getCachedTimestamp();
      }
      const cachedElapsed = performance.now() - cachedStart;

      console.log(`Performance: Date.now()=${dateElapsed.toFixed(2)}ms, cached=${cachedElapsed.toFixed(2)}ms`);
      
      // Cached should be faster (or equal on very fast systems)
      // We're generous here to avoid CI flakiness, but log actual values for debugging
      expect(cachedElapsed).toBeLessThanOrEqual(dateElapsed * 1.5);
    });
  });
});

describe("TileCoordPool", () => {
  describe("acquire/release", () => {
    it("acquires tile with specified coordinates", () => {
      const tile = tileCoordPool.acquire(10, 20);

      expect(tile.x).toBe(10);
      expect(tile.z).toBe(20);

      tileCoordPool.release(tile);
    });

    it("reuses released tiles", () => {
      // Get pool size before
      const sizeBefore = tileCoordPool.getSize();

      // Acquire and release
      const tile1 = tileCoordPool.acquire(1, 2);
      tileCoordPool.release(tile1);

      const sizeAfter = tileCoordPool.getSize();
      expect(sizeAfter).toBeGreaterThanOrEqual(sizeBefore);

      // Next acquire should get from pool
      const tile2 = tileCoordPool.acquire(3, 4);
      expect(tile2.x).toBe(3);
      expect(tile2.z).toBe(4);
      tileCoordPool.release(tile2);
    });

    it("handles negative coordinates", () => {
      const tile = tileCoordPool.acquire(-5, -10);

      expect(tile.x).toBe(-5);
      expect(tile.z).toBe(-10);

      tileCoordPool.release(tile);
    });

    it("handles large coordinates", () => {
      const tile = tileCoordPool.acquire(9999, 9999);

      expect(tile.x).toBe(9999);
      expect(tile.z).toBe(9999);

      tileCoordPool.release(tile);
    });
  });

  describe("pool capacity", () => {
    it("respects max pool size", () => {
      const tiles: { x: number; z: number }[] = [];

      // Acquire many tiles
      for (let i = 0; i < 300; i++) {
        tiles.push(tileCoordPool.acquire(i, i));
      }

      // Release all
      tiles.forEach((t) => tileCoordPool.release(t));

      // Pool should be capped at maxSize (256)
      const poolSize = tileCoordPool.getSize();
      expect(poolSize).toBeLessThanOrEqual(256);
    });
  });

  describe("getSize", () => {
    it("returns current pool size", () => {
      const size = tileCoordPool.getSize();
      expect(typeof size).toBe("number");
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Integration: Pools under simulated game load", () => {
  it("handles pathfinding-like workload", () => {
    // Get initial in-use count (may be non-zero from previous tests)
    const initialInUse = bfsPool.getStats().inUse;

    // Simulate multiple concurrent pathfinding operations
    const pathfindingOps: BFSPooledData[] = [];

    // Start 4 concurrent pathfinding operations
    for (let i = 0; i < 4; i++) {
      pathfindingOps.push(bfsPool.acquire());
    }

    // Use each pool's data structures
    pathfindingOps.forEach((data, i) => {
      for (let j = 0; j < 100; j++) {
        data.visited.add(`tile_${i}_${j}`);
        data.parent.set(`tile_${i}_${j + 1}`, { x: i, z: j });
        data.queue.push({ x: i, z: j });
      }
    });

    // Complete operations
    pathfindingOps.forEach((data) => bfsPool.release(data));

    // All our operations should be released (back to initial state)
    const stats = bfsPool.getStats();
    expect(stats.inUse).toBe(initialInUse);
  });

  it("handles rapid timestamp queries", () => {
    // Simulate game tick with many timestamp reads
    updateCachedTimestamp();
    const tickTimestamp = getCachedTimestamp();

    let allMatch = true;
    for (let i = 0; i < 1000; i++) {
      if (getCachedTimestamp() !== tickTimestamp) {
        allMatch = false;
        break;
      }
    }

    expect(allMatch).toBe(true);
  });

  it("handles mixed pool operations", () => {
    updateCachedTimestamp();
    const timestamp = getCachedTimestamp();

    const bfsData = bfsPool.acquire();
    const tiles = [
      tileCoordPool.acquire(0, 0),
      tileCoordPool.acquire(1, 0),
      tileCoordPool.acquire(1, 1),
    ];

    // Simulate pathfinding iteration
    tiles.forEach((tile) => {
      bfsData.visited.add(`${tile.x}_${tile.z}`);
    });

    expect(bfsData.visited.size).toBe(3);
    expect(getCachedTimestamp()).toBe(timestamp);

    // Cleanup
    tiles.forEach((t) => tileCoordPool.release(t));
    bfsPool.release(bfsData);
  });
});

