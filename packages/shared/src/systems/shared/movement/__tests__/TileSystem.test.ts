/**
 * TileSystem Unit Tests
 *
 * Tests the core tile-based movement utilities.
 *
 * Key behaviors tested:
 * - World to tile coordinate conversion
 * - Tile to world coordinate conversion
 * - Tile equality checks
 * - Tile adjacency checks
 * - Tile range checks (combat/interaction range)
 * - Tile key generation
 * - Direction calculations
 */

import { describe, it, expect } from "vitest";
import {
  worldToTile,
  tileToWorld,
  tilesEqual,
  tilesAdjacent,
  tilesWithinRange,
  tileKey,
  tileChebyshevDistance,
  TILE_SIZE,
  TILE_DIRECTIONS,
  TileCoord,
} from "../TileSystem";

describe("TileSystem", () => {
  describe("worldToTile", () => {
    it("converts origin correctly", () => {
      expect(worldToTile(0, 0)).toEqual({ x: 0, z: 0 });
    });

    it("converts positive coordinates", () => {
      expect(worldToTile(1.5, 2.5)).toEqual({ x: 1, z: 2 });
    });

    it("converts negative coordinates", () => {
      // Math.floor(-1.5) = -2
      expect(worldToTile(-1.5, -2.5)).toEqual({ x: -2, z: -3 });
    });

    it("handles exact tile boundaries", () => {
      expect(worldToTile(0.0, 0.0)).toEqual({ x: 0, z: 0 });
      expect(worldToTile(1.0, 1.0)).toEqual({ x: 1, z: 1 });
      expect(worldToTile(2.0, 2.0)).toEqual({ x: 2, z: 2 });
    });

    it("handles values just below boundary", () => {
      expect(worldToTile(0.999, 0.999)).toEqual({ x: 0, z: 0 });
      expect(worldToTile(1.999, 1.999)).toEqual({ x: 1, z: 1 });
    });

    it("handles large positive values", () => {
      expect(worldToTile(1000.5, 2000.7)).toEqual({ x: 1000, z: 2000 });
    });

    it("handles large negative values", () => {
      expect(worldToTile(-1000.5, -2000.7)).toEqual({ x: -1001, z: -2001 });
    });
  });

  describe("tileToWorld", () => {
    it("returns center of tile at origin", () => {
      const world = tileToWorld({ x: 0, z: 0 });
      expect(world.x).toBe(0.5 * TILE_SIZE);
      expect(world.z).toBe(0.5 * TILE_SIZE);
      expect(world.y).toBe(0);
    });

    it("returns center of positive tile", () => {
      const world = tileToWorld({ x: 5, z: 10 });
      expect(world.x).toBe(5.5 * TILE_SIZE);
      expect(world.z).toBe(10.5 * TILE_SIZE);
    });

    it("returns center of negative tile", () => {
      const world = tileToWorld({ x: -5, z: -10 });
      expect(world.x).toBe(-4.5 * TILE_SIZE);
      expect(world.z).toBe(-9.5 * TILE_SIZE);
    });

    it("is inverse of worldToTile for tile centers", () => {
      const testTiles: TileCoord[] = [
        { x: 0, z: 0 },
        { x: 5, z: 10 },
        { x: -5, z: -10 },
        { x: 100, z: -50 },
      ];

      for (const tile of testTiles) {
        const world = tileToWorld(tile);
        const backToTile = worldToTile(world.x, world.z);
        expect(backToTile).toEqual(tile);
      }
    });
  });

  describe("tilesEqual", () => {
    it("returns true for same coordinates", () => {
      expect(tilesEqual({ x: 5, z: 10 }, { x: 5, z: 10 })).toBe(true);
    });

    it("returns false for different x", () => {
      expect(tilesEqual({ x: 5, z: 10 }, { x: 6, z: 10 })).toBe(false);
    });

    it("returns false for different z", () => {
      expect(tilesEqual({ x: 5, z: 10 }, { x: 5, z: 11 })).toBe(false);
    });

    it("returns false for both different", () => {
      expect(tilesEqual({ x: 5, z: 10 }, { x: 6, z: 11 })).toBe(false);
    });

    it("handles negative coordinates", () => {
      expect(tilesEqual({ x: -5, z: -10 }, { x: -5, z: -10 })).toBe(true);
      expect(tilesEqual({ x: -5, z: -10 }, { x: 5, z: 10 })).toBe(false);
    });

    it("handles zero coordinates", () => {
      expect(tilesEqual({ x: 0, z: 0 }, { x: 0, z: 0 })).toBe(true);
    });
  });

  describe("tilesAdjacent", () => {
    const center = { x: 5, z: 5 };

    it("returns true for north neighbor", () => {
      expect(tilesAdjacent(center, { x: 5, z: 6 })).toBe(true);
    });

    it("returns true for south neighbor", () => {
      expect(tilesAdjacent(center, { x: 5, z: 4 })).toBe(true);
    });

    it("returns true for east neighbor", () => {
      expect(tilesAdjacent(center, { x: 6, z: 5 })).toBe(true);
    });

    it("returns true for west neighbor", () => {
      expect(tilesAdjacent(center, { x: 4, z: 5 })).toBe(true);
    });

    it("returns true for northeast neighbor (diagonal)", () => {
      expect(tilesAdjacent(center, { x: 6, z: 6 })).toBe(true);
    });

    it("returns true for southeast neighbor (diagonal)", () => {
      expect(tilesAdjacent(center, { x: 6, z: 4 })).toBe(true);
    });

    it("returns true for southwest neighbor (diagonal)", () => {
      expect(tilesAdjacent(center, { x: 4, z: 4 })).toBe(true);
    });

    it("returns true for northwest neighbor (diagonal)", () => {
      expect(tilesAdjacent(center, { x: 4, z: 6 })).toBe(true);
    });

    it("returns false for same tile", () => {
      expect(tilesAdjacent(center, center)).toBe(false);
    });

    it("returns false for distant tile", () => {
      expect(tilesAdjacent(center, { x: 7, z: 5 })).toBe(false);
    });

    it("returns false for 2 tiles away", () => {
      expect(tilesAdjacent(center, { x: 7, z: 7 })).toBe(false);
    });
  });

  describe("tilesWithinRange", () => {
    const center = { x: 5, z: 5 };

    describe("range 1 (melee)", () => {
      it("returns true for adjacent tiles", () => {
        expect(tilesWithinRange(center, { x: 6, z: 5 }, 1)).toBe(true);
        expect(tilesWithinRange(center, { x: 6, z: 6 }, 1)).toBe(true);
      });

      it("returns false for same tile", () => {
        expect(tilesWithinRange(center, center, 1)).toBe(false);
      });

      it("returns false for 2 tiles away", () => {
        expect(tilesWithinRange(center, { x: 7, z: 5 }, 1)).toBe(false);
      });
    });

    describe("range 2", () => {
      it("returns true for 2 tiles away", () => {
        expect(tilesWithinRange(center, { x: 7, z: 5 }, 2)).toBe(true);
        expect(tilesWithinRange(center, { x: 7, z: 7 }, 2)).toBe(true);
      });

      it("returns true for 1 tile away", () => {
        expect(tilesWithinRange(center, { x: 6, z: 5 }, 2)).toBe(true);
      });

      it("returns false for 3 tiles away", () => {
        expect(tilesWithinRange(center, { x: 8, z: 5 }, 2)).toBe(false);
      });
    });

    describe("range 10 (magic/ranged)", () => {
      it("returns true for tiles within range", () => {
        expect(tilesWithinRange(center, { x: 15, z: 5 }, 10)).toBe(true);
        expect(tilesWithinRange(center, { x: 10, z: 10 }, 10)).toBe(true);
      });

      it("returns false for tiles outside range", () => {
        expect(tilesWithinRange(center, { x: 16, z: 5 }, 10)).toBe(false);
      });
    });
  });

  describe("tileKey", () => {
    it("generates unique key for positive coordinates", () => {
      expect(tileKey({ x: 5, z: 10 })).toBe("5,10");
    });

    it("generates unique key for negative coordinates", () => {
      expect(tileKey({ x: -5, z: -10 })).toBe("-5,-10");
    });

    it("generates unique key for zero", () => {
      expect(tileKey({ x: 0, z: 0 })).toBe("0,0");
    });

    it("generates different keys for different tiles", () => {
      const key1 = tileKey({ x: 5, z: 10 });
      const key2 = tileKey({ x: 10, z: 5 });
      const key3 = tileKey({ x: 5, z: 11 });

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });

    it("generates same key for equal tiles", () => {
      expect(tileKey({ x: 5, z: 10 })).toBe(tileKey({ x: 5, z: 10 }));
    });
  });

  describe("tileChebyshevDistance", () => {
    it("returns 0 for same tile", () => {
      expect(tileChebyshevDistance({ x: 5, z: 5 }, { x: 5, z: 5 })).toBe(0);
    });

    it("returns 1 for adjacent cardinal tiles", () => {
      expect(tileChebyshevDistance({ x: 5, z: 5 }, { x: 6, z: 5 })).toBe(1);
      expect(tileChebyshevDistance({ x: 5, z: 5 }, { x: 5, z: 6 })).toBe(1);
    });

    it("returns 1 for adjacent diagonal tiles (Chebyshev)", () => {
      expect(tileChebyshevDistance({ x: 5, z: 5 }, { x: 6, z: 6 })).toBe(1);
    });

    it("calculates correct distance for horizontal line", () => {
      expect(tileChebyshevDistance({ x: 0, z: 0 }, { x: 10, z: 0 })).toBe(10);
    });

    it("calculates correct distance for vertical line", () => {
      expect(tileChebyshevDistance({ x: 0, z: 0 }, { x: 0, z: 10 })).toBe(10);
    });

    it("uses Chebyshev distance (max of dx, dz)", () => {
      // max(5, 3) = 5
      expect(tileChebyshevDistance({ x: 0, z: 0 }, { x: 5, z: 3 })).toBe(5);
      // max(3, 5) = 5
      expect(tileChebyshevDistance({ x: 0, z: 0 }, { x: 3, z: 5 })).toBe(5);
    });

    it("handles negative coordinates", () => {
      expect(tileChebyshevDistance({ x: -5, z: -5 }, { x: 5, z: 5 })).toBe(10);
    });
  });

  describe("TILE_DIRECTIONS", () => {
    it("contains 8 directions", () => {
      expect(TILE_DIRECTIONS.length).toBe(8);
    });

    it("contains all cardinal directions", () => {
      const hasWest = TILE_DIRECTIONS.some((d) => d.x === -1 && d.z === 0);
      const hasEast = TILE_DIRECTIONS.some((d) => d.x === 1 && d.z === 0);
      const hasSouth = TILE_DIRECTIONS.some((d) => d.x === 0 && d.z === -1);
      const hasNorth = TILE_DIRECTIONS.some((d) => d.x === 0 && d.z === 1);

      expect(hasWest).toBe(true);
      expect(hasEast).toBe(true);
      expect(hasSouth).toBe(true);
      expect(hasNorth).toBe(true);
    });

    it("contains all diagonal directions", () => {
      const hasSW = TILE_DIRECTIONS.some((d) => d.x === -1 && d.z === -1);
      const hasSE = TILE_DIRECTIONS.some((d) => d.x === 1 && d.z === -1);
      const hasNW = TILE_DIRECTIONS.some((d) => d.x === -1 && d.z === 1);
      const hasNE = TILE_DIRECTIONS.some((d) => d.x === 1 && d.z === 1);

      expect(hasSW).toBe(true);
      expect(hasSE).toBe(true);
      expect(hasNW).toBe(true);
      expect(hasNE).toBe(true);
    });

    it("has OSRS priority order (W, E, S, N, SW, SE, NW, NE)", () => {
      // OSRS BFS processes neighbors in this order
      expect(TILE_DIRECTIONS[0]).toEqual({ x: -1, z: 0 }); // W
      expect(TILE_DIRECTIONS[1]).toEqual({ x: 1, z: 0 }); // E
      expect(TILE_DIRECTIONS[2]).toEqual({ x: 0, z: -1 }); // S
      expect(TILE_DIRECTIONS[3]).toEqual({ x: 0, z: 1 }); // N
    });
  });

  describe("TILE_SIZE constant", () => {
    it("equals 1 (1 world unit = 1 tile)", () => {
      expect(TILE_SIZE).toBe(1);
    });
  });
});
