/**
 * BFS Pathfinder Unit Tests
 *
 * Tests the BFS pathfinding system with OSRS-style diagonal pathing.
 *
 * Key behaviors tested:
 * - Basic straight-line pathfinding
 * - Naive diagonal pathing (OSRS follow-mode style)
 * - BFS fallback when naive path is blocked
 * - Obstacle avoidance
 * - Corner clipping prevention
 * - Path length limits
 * - Edge cases (same tile, unreachable destinations)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BFSPathfinder } from "../BFSPathfinder";
import { TileCoord, tilesEqual } from "../TileSystem";

describe("BFSPathfinder", () => {
  let pathfinder: BFSPathfinder;

  // Helper to create walkability checker with blocked tiles
  const createWalkabilityChecker = (blockedTiles: TileCoord[]) => {
    return (tile: TileCoord) => !blockedTiles.some((b) => tilesEqual(b, tile));
  };

  // Helper to check if path is valid (each step is adjacent)
  const isValidPath = (path: TileCoord[], start: TileCoord): boolean => {
    if (path.length === 0) return true;

    // Check first tile is adjacent to start
    const first = path[0];
    const dx = Math.abs(first.x - start.x);
    const dz = Math.abs(first.z - start.z);
    if (dx > 1 || dz > 1 || (dx === 0 && dz === 0)) {
      return false;
    }

    // Check each subsequent tile is adjacent to previous
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const stepDx = Math.abs(curr.x - prev.x);
      const stepDz = Math.abs(curr.z - prev.z);
      if (stepDx > 1 || stepDz > 1 || (stepDx === 0 && stepDz === 0)) {
        return false;
      }
    }

    return true;
  };

  beforeEach(() => {
    pathfinder = new BFSPathfinder();
  });

  describe("Basic Pathfinding", () => {
    it("returns empty array when start equals end", () => {
      const start = { x: 0, z: 0 };
      const path = pathfinder.findPath(start, start, () => true);
      expect(path).toEqual([]);
    });

    it("finds straight horizontal path", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 5, z: 0 };
      const path = pathfinder.findPath(start, end, () => true);

      expect(path.length).toBe(5);
      expect(path[path.length - 1]).toEqual(end);
      expect(isValidPath(path, start)).toBe(true);
    });

    it("finds straight vertical path", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 0, z: 5 };
      const path = pathfinder.findPath(start, end, () => true);

      expect(path.length).toBe(5);
      expect(path[path.length - 1]).toEqual(end);
      expect(isValidPath(path, start)).toBe(true);
    });

    it("finds diagonal path (naive diagonal)", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 3, z: 3 };
      const path = pathfinder.findPath(start, end, () => true);

      // Naive diagonal: 3 steps diagonally
      expect(path.length).toBe(3);
      expect(path[path.length - 1]).toEqual(end);
      expect(isValidPath(path, start)).toBe(true);
    });

    it("handles asymmetric diagonal (more X than Z)", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 5, z: 3 };
      const path = pathfinder.findPath(start, end, () => true);

      // Should be 5 steps: 3 diagonal + 2 horizontal
      expect(path.length).toBe(5);
      expect(path[path.length - 1]).toEqual(end);
      expect(isValidPath(path, start)).toBe(true);
    });

    it("handles asymmetric diagonal (more Z than X)", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 2, z: 5 };
      const path = pathfinder.findPath(start, end, () => true);

      // Should be 5 steps: 2 diagonal + 3 vertical
      expect(path.length).toBe(5);
      expect(path[path.length - 1]).toEqual(end);
      expect(isValidPath(path, start)).toBe(true);
    });
  });

  describe("Negative Coordinates", () => {
    it("handles negative start coordinates", () => {
      const start = { x: -5, z: -5 };
      const end = { x: 0, z: 0 };
      const path = pathfinder.findPath(start, end, () => true);

      expect(path.length).toBe(5);
      expect(path[path.length - 1]).toEqual(end);
      expect(isValidPath(path, start)).toBe(true);
    });

    it("handles negative end coordinates", () => {
      const start = { x: 0, z: 0 };
      const end = { x: -5, z: -5 };
      const path = pathfinder.findPath(start, end, () => true);

      expect(path.length).toBe(5);
      expect(path[path.length - 1]).toEqual(end);
      expect(isValidPath(path, start)).toBe(true);
    });

    it("handles both negative coordinates", () => {
      const start = { x: -10, z: -10 };
      const end = { x: -5, z: -5 };
      const path = pathfinder.findPath(start, end, () => true);

      expect(path.length).toBe(5);
      expect(path[path.length - 1]).toEqual(end);
      expect(isValidPath(path, start)).toBe(true);
    });
  });

  describe("Obstacle Avoidance", () => {
    it("paths around single obstacle", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 2, z: 0 };
      const blocked = [{ x: 1, z: 0 }];

      const path = pathfinder.findPath(
        start,
        end,
        createWalkabilityChecker(blocked),
      );

      expect(path.length).toBeGreaterThan(2); // Must go around
      expect(path[path.length - 1]).toEqual(end);
      expect(path.some((t) => tilesEqual(t, blocked[0]))).toBe(false);
      expect(isValidPath(path, start)).toBe(true);
    });

    it("paths around wall", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 0, z: 3 };
      // Wall blocking direct path
      const blocked = [
        { x: -1, z: 1 },
        { x: 0, z: 1 },
        { x: 1, z: 1 },
      ];

      const path = pathfinder.findPath(
        start,
        end,
        createWalkabilityChecker(blocked),
      );

      expect(path.length).toBeGreaterThan(3);
      expect(path[path.length - 1]).toEqual(end);
      blocked.forEach((b) => {
        expect(path.some((t) => tilesEqual(t, b))).toBe(false);
      });
      expect(isValidPath(path, start)).toBe(true);
    });

    it("handles blocked destination (finds nearest walkable)", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 5, z: 0 };
      const blocked = [{ x: 5, z: 0 }]; // Destination blocked

      const path = pathfinder.findPath(
        start,
        end,
        createWalkabilityChecker(blocked),
      );

      // Should path to a tile adjacent to the blocked destination
      if (path.length > 0) {
        const lastTile = path[path.length - 1];
        expect(blocked.some((b) => tilesEqual(b, lastTile))).toBe(false);
      }
    });
  });

  describe("Corner Clipping Prevention", () => {
    it("prevents diagonal through blocked corners", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 1, z: 1 };
      // Block the two tiles that would cause corner clipping
      const blocked = [
        { x: 1, z: 0 },
        { x: 0, z: 1 },
      ];

      const path = pathfinder.findPath(
        start,
        end,
        createWalkabilityChecker(blocked),
      );

      // Should not be able to reach diagonally
      // Either empty or finds a longer path
      if (path.length > 0) {
        expect(path.length).toBeGreaterThan(1);
        expect(isValidPath(path, start)).toBe(true);
      }
    });
  });

  describe("Unreachable Destinations", () => {
    it("returns empty when completely surrounded", () => {
      const start = { x: 5, z: 5 };
      const end = { x: 10, z: 10 };
      // Completely surround start tile
      const blocked = [
        { x: 4, z: 4 },
        { x: 5, z: 4 },
        { x: 6, z: 4 },
        { x: 4, z: 5 },
        { x: 6, z: 5 },
        { x: 4, z: 6 },
        { x: 5, z: 6 },
        { x: 6, z: 6 },
      ];

      const path = pathfinder.findPath(
        start,
        end,
        createWalkabilityChecker(blocked),
      );

      expect(path).toEqual([]);
    });

    it("returns partial path when destination unreachable", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 10, z: 0 };
      // Wall blocking at x=5
      const blocked: TileCoord[] = [];
      for (let z = -128; z <= 128; z++) {
        blocked.push({ x: 5, z });
      }

      const path = pathfinder.findPath(
        start,
        end,
        createWalkabilityChecker(blocked),
      );

      // Should return partial path or empty
      if (path.length > 0) {
        // Verify doesn't cross the wall
        expect(path.every((t) => t.x < 5)).toBe(true);
      }
    });
  });

  describe("Long Paths", () => {
    it("handles 100+ tile path", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 100, z: 50 };
      const path = pathfinder.findPath(start, end, () => true);

      expect(path.length).toBeGreaterThan(0);
      expect(path.length).toBeLessThanOrEqual(200); // Max path length
      expect(isValidPath(path, start)).toBe(true);
    });

    it("respects maximum path length of 200", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 150, z: 150 }; // Would be 150 diagonal steps
      const path = pathfinder.findPath(start, end, () => true);

      expect(path.length).toBeLessThanOrEqual(200);
    });
  });

  describe("Path Length Calculation", () => {
    it("calculates straight path length correctly", () => {
      // Path has 3 tiles, but getPathLength counts steps between them (2 segments)
      const path: TileCoord[] = [
        { x: 1, z: 0 },
        { x: 2, z: 0 },
        { x: 3, z: 0 },
      ];

      const length = pathfinder.getPathLength(path);
      expect(length).toBe(2); // 2 steps: (1,0)->(2,0)->(3,0)
    });

    it("calculates diagonal path length correctly (Chebyshev)", () => {
      // Diagonal steps count as 1 tile each (Chebyshev distance)
      const path: TileCoord[] = [
        { x: 1, z: 1 },
        { x: 2, z: 2 },
        { x: 3, z: 3 },
      ];

      const length = pathfinder.getPathLength(path);
      expect(length).toBe(2); // 2 diagonal steps
    });

    it("returns 0 for empty path", () => {
      expect(pathfinder.getPathLength([])).toBe(0);
    });

    it("returns 1 for single-tile path", () => {
      expect(pathfinder.getPathLength([{ x: 5, z: 5 }])).toBe(1);
    });
  });

  describe("Object Pool Usage", () => {
    it("handles multiple concurrent pathfinding calls", () => {
      // This tests that the object pool works correctly under load
      const paths: TileCoord[][] = [];

      for (let i = 0; i < 20; i++) {
        const start = { x: i * 10, z: 0 };
        const end = { x: i * 10 + 5, z: 5 };
        const path = pathfinder.findPath(start, end, () => true);
        paths.push(path);
      }

      // All paths should be valid
      expect(paths.length).toBe(20);
      paths.forEach((path, i) => {
        const start = { x: i * 10, z: 0 };
        expect(isValidPath(path, start)).toBe(true);
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles single tile distance", () => {
      const start = { x: 0, z: 0 };
      const end = { x: 1, z: 0 };
      const path = pathfinder.findPath(start, end, () => true);

      expect(path.length).toBe(1);
      expect(path[0]).toEqual(end);
    });

    it("handles zero tile distance", () => {
      const tile = { x: 42, z: 42 };
      const path = pathfinder.findPath(tile, tile, () => true);

      expect(path).toEqual([]);
    });

    it("handles large coordinate values", () => {
      const start = { x: 5000, z: 5000 };
      const end = { x: 5010, z: 5010 };
      const path = pathfinder.findPath(start, end, () => true);

      expect(path.length).toBe(10);
      expect(path[path.length - 1]).toEqual(end);
      expect(isValidPath(path, start)).toBe(true);
    });
  });
});
