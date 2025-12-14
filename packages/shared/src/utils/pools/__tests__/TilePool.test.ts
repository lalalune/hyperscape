/**
 * TilePool Unit Tests
 *
 * Tests for tile coordinate pooling:
 * - Acquire/release operations
 * - World-to-tile conversion
 * - Distance calculations
 * - Convenience methods
 * - Pool statistics
 */

import { describe, it, expect, beforeEach } from "vitest";
import { tilePool, PooledTile } from "../TilePool";

describe("TilePool", () => {
  beforeEach(() => {
    tilePool.reset();
  });

  describe("acquire/release", () => {
    it("acquires a tile with zeroed coordinates", () => {
      const tile = tilePool.acquire();
      expect(tile.x).toBe(0);
      expect(tile.z).toBe(0);
      tilePool.release(tile);
    });

    it("releases tile back to pool", () => {
      const statsBefore = tilePool.getStats();
      const tile = tilePool.acquire();
      const statsAcquired = tilePool.getStats();

      expect(statsAcquired.inUse).toBe(statsBefore.inUse + 1);

      tilePool.release(tile);
      const statsAfter = tilePool.getStats();

      expect(statsAfter.inUse).toBe(statsBefore.inUse);
    });

    it("resets tile coordinates on release", () => {
      const tile = tilePool.acquire();
      tile.x = 100;
      tile.z = 200;
      tilePool.release(tile);

      // Acquire again - should be reset
      const tile2 = tilePool.acquire();
      expect(tile2.x).toBe(0);
      expect(tile2.z).toBe(0);
      tilePool.release(tile2);
    });

    it("grows pool when exhausted", () => {
      const initialStats = tilePool.getStats();
      const initialTotal = initialStats.total;

      // Acquire all initial tiles
      const tiles: PooledTile[] = [];
      for (let i = 0; i < initialTotal + 10; i++) {
        tiles.push(tilePool.acquire());
      }

      const grownStats = tilePool.getStats();
      expect(grownStats.total).toBeGreaterThan(initialTotal);

      // Release all
      tiles.forEach((t) => tilePool.release(t));
    });
  });

  describe("setFromWorld", () => {
    it("converts world coordinates to tile coordinates", () => {
      const tile = tilePool.acquire();
      tilePool.setFromWorld(tile, 5.7, 10.3);

      expect(tile.x).toBe(5);
      expect(tile.z).toBe(10);

      tilePool.release(tile);
    });

    it("handles negative coordinates", () => {
      const tile = tilePool.acquire();
      tilePool.setFromWorld(tile, -5.2, -10.8);

      expect(tile.x).toBe(-6);
      expect(tile.z).toBe(-11);

      tilePool.release(tile);
    });

    it("uses floor for consistent boundaries", () => {
      const tile = tilePool.acquire();
      tilePool.setFromWorld(tile, 0.9, 0.1);

      expect(tile.x).toBe(0);
      expect(tile.z).toBe(0);

      tilePool.release(tile);
    });
  });

  describe("setFromPosition", () => {
    it("converts Position3D to tile (ignores Y)", () => {
      const tile = tilePool.acquire();
      tilePool.setFromPosition(tile, { x: 3.5, y: 100, z: 7.9 });

      expect(tile.x).toBe(3);
      expect(tile.z).toBe(7);

      tilePool.release(tile);
    });
  });

  describe("copy", () => {
    it("copies tile coordinates", () => {
      const source = tilePool.acquire();
      const target = tilePool.acquire();

      source.x = 42;
      source.z = 84;

      tilePool.copy(target, source);

      expect(target.x).toBe(42);
      expect(target.z).toBe(84);

      tilePool.release(source);
      tilePool.release(target);
    });
  });

  describe("set", () => {
    it("sets tile coordinates directly", () => {
      const tile = tilePool.acquire();
      tilePool.set(tile, 15, 25);

      expect(tile.x).toBe(15);
      expect(tile.z).toBe(25);

      tilePool.release(tile);
    });
  });

  describe("withTiles", () => {
    it("provides two tiles and cleans up automatically", () => {
      const statsBefore = tilePool.getStats();

      const result = tilePool.withTiles(
        { x: 5, y: 0, z: 10 },
        { x: 7, y: 0, z: 12 },
        (t1, t2) => {
          expect(t1.x).toBe(5);
          expect(t1.z).toBe(10);
          expect(t2.x).toBe(7);
          expect(t2.z).toBe(12);
          return t1.x + t2.x;
        },
      );

      expect(result).toBe(12);

      const statsAfter = tilePool.getStats();
      expect(statsAfter.inUse).toBe(statsBefore.inUse);
    });

    it("releases tiles even if function throws", () => {
      const statsBefore = tilePool.getStats();

      expect(() => {
        tilePool.withTiles({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }, () => {
          throw new Error("Test error");
        });
      }).toThrow("Test error");

      const statsAfter = tilePool.getStats();
      expect(statsAfter.inUse).toBe(statsBefore.inUse);
    });
  });

  describe("withTile", () => {
    it("provides one tile and cleans up automatically", () => {
      const statsBefore = tilePool.getStats();

      const result = tilePool.withTile({ x: 3.9, y: 0, z: 8.1 }, (t) => {
        expect(t.x).toBe(3);
        expect(t.z).toBe(8);
        return t.x * t.z;
      });

      expect(result).toBe(24);

      const statsAfter = tilePool.getStats();
      expect(statsAfter.inUse).toBe(statsBefore.inUse);
    });
  });

  describe("chebyshevDistance", () => {
    it("calculates max of dx and dz", () => {
      const t1 = tilePool.acquire();
      const t2 = tilePool.acquire();

      tilePool.set(t1, 0, 0);
      tilePool.set(t2, 3, 4);

      expect(tilePool.chebyshevDistance(t1, t2)).toBe(4);

      tilePool.release(t1);
      tilePool.release(t2);
    });

    it("returns 0 for same tile", () => {
      const t1 = tilePool.acquire();
      const t2 = tilePool.acquire();

      tilePool.set(t1, 5, 5);
      tilePool.set(t2, 5, 5);

      expect(tilePool.chebyshevDistance(t1, t2)).toBe(0);

      tilePool.release(t1);
      tilePool.release(t2);
    });

    it("handles diagonal movement correctly", () => {
      const t1 = tilePool.acquire();
      const t2 = tilePool.acquire();

      tilePool.set(t1, 0, 0);
      tilePool.set(t2, 1, 1);

      // Diagonal is 1 in Chebyshev distance (king's move)
      expect(tilePool.chebyshevDistance(t1, t2)).toBe(1);

      tilePool.release(t1);
      tilePool.release(t2);
    });
  });

  describe("manhattanDistance", () => {
    it("calculates sum of dx and dz", () => {
      const t1 = tilePool.acquire();
      const t2 = tilePool.acquire();

      tilePool.set(t1, 0, 0);
      tilePool.set(t2, 3, 4);

      expect(tilePool.manhattanDistance(t1, t2)).toBe(7);

      tilePool.release(t1);
      tilePool.release(t2);
    });
  });

  describe("isWithinRange", () => {
    it("returns true for tiles within range", () => {
      const t1 = tilePool.acquire();
      const t2 = tilePool.acquire();

      tilePool.set(t1, 0, 0);
      tilePool.set(t2, 1, 1);

      expect(tilePool.isWithinRange(t1, t2, 1)).toBe(true);
      expect(tilePool.isWithinRange(t1, t2, 2)).toBe(true);

      tilePool.release(t1);
      tilePool.release(t2);
    });

    it("returns false for tiles out of range", () => {
      const t1 = tilePool.acquire();
      const t2 = tilePool.acquire();

      tilePool.set(t1, 0, 0);
      tilePool.set(t2, 5, 5);

      expect(tilePool.isWithinRange(t1, t2, 1)).toBe(false);
      expect(tilePool.isWithinRange(t1, t2, 4)).toBe(false);

      tilePool.release(t1);
      tilePool.release(t2);
    });

    it("returns false for same tile (distance 0)", () => {
      const t1 = tilePool.acquire();
      const t2 = tilePool.acquire();

      tilePool.set(t1, 5, 5);
      tilePool.set(t2, 5, 5);

      // Can't attack from same tile
      expect(tilePool.isWithinRange(t1, t2, 1)).toBe(false);

      tilePool.release(t1);
      tilePool.release(t2);
    });
  });

  describe("getStats", () => {
    it("returns correct statistics", () => {
      const stats = tilePool.getStats();

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.available).toBeLessThanOrEqual(stats.total);
      expect(stats.inUse).toBe(stats.total - stats.available);
    });

    it("tracks in-use correctly", () => {
      const statsBefore = tilePool.getStats();
      const tile1 = tilePool.acquire();
      const tile2 = tilePool.acquire();

      const statsMiddle = tilePool.getStats();
      expect(statsMiddle.inUse).toBe(statsBefore.inUse + 2);

      tilePool.release(tile1);
      tilePool.release(tile2);

      const statsAfter = tilePool.getStats();
      expect(statsAfter.inUse).toBe(statsBefore.inUse);
    });
  });

  describe("reset", () => {
    it("resets pool to initial state", () => {
      // Acquire and release a few tiles
      const tiles = [tilePool.acquire(), tilePool.acquire()];
      tiles.forEach((t) => tilePool.release(t));

      const statsBefore = tilePool.getStats();

      tilePool.reset();

      const statsAfter = tilePool.getStats();
      // After reset, should have initial pool size
      expect(statsAfter.inUse).toBe(0);
      expect(statsAfter.total).toBeLessThanOrEqual(statsBefore.total);
    });
  });
});
