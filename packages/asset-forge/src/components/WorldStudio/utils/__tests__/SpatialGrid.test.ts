/**
 * `SpatialGrid` — generic spatial hash grid unit tests.
 *
 * Used by zone auto-gen for mob-resource proximity buffer checks
 * and available for editor entity queries / overlap detection.
 * The 3x3 neighborhood scan in `nearestDistance` and `nearest`
 * is correct only when the search radius ≤ cellSize; larger
 * queries must use `queryRadius` (which scales the neighborhood
 * via `ceil(radius / cellSize)`). These tests pin down both
 * regimes so the cell-size assumption can't drift.
 */

import { describe, expect, it } from "vitest";
import { SpatialGrid } from "../SpatialGrid";

describe("SpatialGrid — empty grid", () => {
  it("size is 0 when nothing inserted", () => {
    const grid = new SpatialGrid<void>(10);
    expect(grid.size).toBe(0);
  });

  it("nearestDistance returns Infinity when empty", () => {
    const grid = new SpatialGrid<void>(10);
    expect(grid.nearestDistance(5, 5)).toBe(Infinity);
  });

  it("nearest returns null when empty", () => {
    const grid = new SpatialGrid<void>(10);
    expect(grid.nearest(0, 0)).toBeNull();
  });

  it("queryRadius returns empty array when empty", () => {
    const grid = new SpatialGrid<void>(10);
    expect(grid.queryRadius(0, 0, 5)).toEqual([]);
  });
});

describe("SpatialGrid — insertion + size", () => {
  it("size increments per insert", () => {
    const grid = new SpatialGrid<void>(10);
    grid.insert(0, 0);
    expect(grid.size).toBe(1);
    grid.insert(15, 15);
    expect(grid.size).toBe(2);
    grid.insert(0, 0); // duplicate position — separate entry
    expect(grid.size).toBe(3);
  });

  it("clear() resets size to 0", () => {
    const grid = new SpatialGrid<void>(10);
    grid.insert(0, 0);
    grid.insert(15, 15);
    grid.clear();
    expect(grid.size).toBe(0);
    expect(grid.nearestDistance(0, 0)).toBe(Infinity);
  });
});

describe("SpatialGrid — nearestDistance", () => {
  it("returns 0 when querying at a point's exact position", () => {
    const grid = new SpatialGrid<void>(10);
    grid.insert(5, 5);
    expect(grid.nearestDistance(5, 5)).toBe(0);
  });

  it("returns Euclidean distance to a point in the same cell", () => {
    const grid = new SpatialGrid<void>(10);
    grid.insert(0, 0);
    expect(grid.nearestDistance(3, 4)).toBe(5); // 3-4-5 triangle
  });

  it("finds points in adjacent cells (3x3 neighborhood)", () => {
    const grid = new SpatialGrid<void>(10);
    grid.insert(15, 15); // cell (1, 1)
    expect(grid.nearestDistance(5, 5)).toBeCloseTo(Math.sqrt(200), 5);
  });

  it("returns the MIN distance when multiple points are in range", () => {
    const grid = new SpatialGrid<void>(10);
    grid.insert(5, 5); // dist 0 from (5,5)
    grid.insert(8, 5); // dist 3 from (5,5)
    grid.insert(15, 15); // dist sqrt(200) from (5,5)
    expect(grid.nearestDistance(5, 5)).toBe(0);
  });
});

describe("SpatialGrid — nearest with associated data", () => {
  it("returns closest point + data + distance", () => {
    const grid = new SpatialGrid<string>(10);
    grid.insert(0, 0, "origin");
    grid.insert(8, 6, "diagonal");
    const result = grid.nearest(3, 4);
    expect(result?.data).toBe("origin");
    expect(result?.distance).toBe(5);
    expect(result?.x).toBe(0);
    expect(result?.z).toBe(0);
  });

  it("returns null when no points are within the 3x3 neighborhood", () => {
    const grid = new SpatialGrid<void>(10);
    // Place a point far away — outside the 3x3 cells around (0, 0).
    grid.insert(100, 100); // cell (10, 10)
    expect(grid.nearest(0, 0)).toBeNull();
  });
});

describe("SpatialGrid — queryRadius", () => {
  it("returns all points within the radius (small radius, single cell)", () => {
    const grid = new SpatialGrid<string>(10);
    grid.insert(0, 0, "a");
    grid.insert(2, 2, "b");
    grid.insert(8, 8, "c");
    const results = grid.queryRadius(0, 0, 5);
    const data = results.map((r) => r.data).sort();
    expect(data).toEqual(["a", "b"]); // c is distance √128 > 5
  });

  it("includes points at exactly the boundary distance", () => {
    const grid = new SpatialGrid<void>(10);
    grid.insert(5, 0); // dist 5 from origin
    expect(grid.queryRadius(0, 0, 5)).toHaveLength(1);
  });

  it("scales the neighborhood for radii larger than cellSize", () => {
    // cellSize=10, radius=25 → cellsToCheck = 3 → 7×7 neighborhood
    const grid = new SpatialGrid<string>(10);
    grid.insert(20, 0, "far"); // 2 cells away
    grid.insert(0, 0, "origin");
    const results = grid.queryRadius(0, 0, 25);
    const ids = results.map((r) => r.data).sort();
    expect(ids).toEqual(["far", "origin"]);
  });

  it("excludes points outside the radius even when in same cell", () => {
    const grid = new SpatialGrid<void>(100);
    grid.insert(0, 0);
    grid.insert(50, 50); // same cell, dist √5000 ≈ 70.7
    expect(grid.queryRadius(0, 0, 50)).toHaveLength(1); // only origin
    expect(grid.queryRadius(0, 0, 75)).toHaveLength(2); // both
  });

  it("handles duplicate points at the same position", () => {
    const grid = new SpatialGrid<string>(10);
    grid.insert(5, 5, "a");
    grid.insert(5, 5, "b");
    grid.insert(5, 5, "c");
    expect(grid.queryRadius(5, 5, 1)).toHaveLength(3);
  });
});

describe("SpatialGrid — generic data", () => {
  it("stores typed data per insertion", () => {
    interface Mob {
      id: string;
      level: number;
    }
    const grid = new SpatialGrid<Mob>(10);
    grid.insert(0, 0, { id: "goblin1", level: 5 });
    grid.insert(5, 5, { id: "goblin2", level: 7 });
    const closest = grid.nearest(1, 1);
    expect(closest?.data.id).toBe("goblin1");
    expect(closest?.data.level).toBe(5);
  });

  it("preserves data when querying by radius", () => {
    interface Mob {
      id: string;
    }
    const grid = new SpatialGrid<Mob>(10);
    grid.insert(0, 0, { id: "g1" });
    grid.insert(3, 3, { id: "g2" });
    const results = grid.queryRadius(0, 0, 5);
    expect(results.map((r) => r.data.id).sort()).toEqual(["g1", "g2"]);
  });
});
