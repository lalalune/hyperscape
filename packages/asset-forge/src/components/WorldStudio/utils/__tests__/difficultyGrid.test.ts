/**
 * `difficultyGrid` — Struct-of-Arrays difficulty grid tests.
 *
 * Used by useZoneAutoGen for grid sampling and zone extraction.
 * The SoA layout (Float32 scalars / Uint8 biomes+tiers / Uint16
 * zoneIds) is performance-critical; tests pin down the
 * cell↔world coordinate translation and the unclassified-tier /
 * unassigned-zone sentinel handling so the auto-gen flood-fill
 * doesn't drift over time.
 */

import { describe, expect, it } from "vitest";
import {
  cellToWorld,
  createDifficultyGrid,
  forEachClassifiedCell,
  getCell,
  resolveBiomeIndex,
  setCell,
  UNASSIGNED_ZONE,
  UNCLASSIFIED_TIER,
  worldToCell,
} from "../difficultyGrid";

describe("createDifficultyGrid", () => {
  it("allocates the correct typed-array sizes", () => {
    const grid = createDifficultyGrid(10, 8, 0, 0, 4);
    expect(grid.scalars.length).toBe(80);
    expect(grid.biomes.length).toBe(80);
    expect(grid.tiers.length).toBe(80);
    expect(grid.zoneIds.length).toBe(80);
    expect(grid.width).toBe(10);
    expect(grid.height).toBe(8);
    expect(grid.resolution).toBe(4);
  });

  it("initializes tiers to UNCLASSIFIED_TIER (255)", () => {
    const grid = createDifficultyGrid(4, 4, 0, 0, 1);
    for (let i = 0; i < grid.tiers.length; i++) {
      expect(grid.tiers[i]).toBe(UNCLASSIFIED_TIER);
    }
  });

  it("initializes zoneIds to UNASSIGNED_ZONE (65535)", () => {
    const grid = createDifficultyGrid(4, 4, 0, 0, 1);
    for (let i = 0; i < grid.zoneIds.length; i++) {
      expect(grid.zoneIds[i]).toBe(UNASSIGNED_ZONE);
    }
  });

  it("initializes scalars to 0 and biomes to 0", () => {
    const grid = createDifficultyGrid(4, 4, 0, 0, 1);
    for (let i = 0; i < grid.scalars.length; i++) {
      expect(grid.scalars[i]).toBe(0);
      expect(grid.biomes[i]).toBe(0);
    }
  });

  it("starts with empty biomeIndex", () => {
    const grid = createDifficultyGrid(2, 2, 0, 0, 1);
    expect(grid.biomeIndex).toEqual([]);
  });
});

describe("resolveBiomeIndex", () => {
  it("returns 0 for the first inserted biome", () => {
    const grid = createDifficultyGrid(2, 2, 0, 0, 1);
    expect(resolveBiomeIndex(grid, "forest")).toBe(0);
    expect(grid.biomeIndex).toEqual(["forest"]);
  });

  it("returns the same index for repeated calls with the same name", () => {
    const grid = createDifficultyGrid(2, 2, 0, 0, 1);
    expect(resolveBiomeIndex(grid, "forest")).toBe(0);
    expect(resolveBiomeIndex(grid, "forest")).toBe(0);
    expect(grid.biomeIndex).toHaveLength(1);
  });

  it("assigns ascending indices for distinct names", () => {
    const grid = createDifficultyGrid(2, 2, 0, 0, 1);
    expect(resolveBiomeIndex(grid, "forest")).toBe(0);
    expect(resolveBiomeIndex(grid, "desert")).toBe(1);
    expect(resolveBiomeIndex(grid, "tundra")).toBe(2);
    expect(grid.biomeIndex).toEqual(["forest", "desert", "tundra"]);
  });
});

describe("getCell", () => {
  it("returns null for out-of-bounds coords", () => {
    const grid = createDifficultyGrid(4, 4, 0, 0, 1);
    expect(getCell(grid, -1, 0)).toBeNull();
    expect(getCell(grid, 0, -1)).toBeNull();
    expect(getCell(grid, 4, 0)).toBeNull();
    expect(getCell(grid, 0, 4)).toBeNull();
  });

  it("returns sentinel-resolved values for an empty cell", () => {
    const grid = createDifficultyGrid(4, 4, 0, 0, 1);
    const cell = getCell(grid, 0, 0);
    expect(cell).toEqual({
      scalar: 0,
      biome: "unknown", // biome 0 with empty index → "unknown"
      tierIndex: -1, // UNCLASSIFIED_TIER → -1
      zoneId: -1, // UNASSIGNED_ZONE → -1
    });
  });

  it("returns the actual cell values when set", () => {
    const grid = createDifficultyGrid(4, 4, 0, 0, 1);
    const forestIdx = resolveBiomeIndex(grid, "forest");
    setCell(grid, 1, 2, 0.75, forestIdx, 3);
    grid.zoneIds[2 * 4 + 1] = 7;
    const cell = getCell(grid, 1, 2);
    expect(cell).toEqual({
      scalar: 0.75,
      biome: "forest",
      tierIndex: 3,
      zoneId: 7,
    });
  });
});

describe("setCell", () => {
  it("writes scalar + biome + tier", () => {
    const grid = createDifficultyGrid(4, 4, 0, 0, 1);
    const idx = resolveBiomeIndex(grid, "swamp");
    setCell(grid, 0, 0, 0.5, idx, 2);
    const cell = getCell(grid, 0, 0)!;
    expect(cell.scalar).toBeCloseTo(0.5, 5);
    expect(cell.biome).toBe("swamp");
    expect(cell.tierIndex).toBe(2);
  });

  it("treats negative tierIndex as UNCLASSIFIED_TIER", () => {
    const grid = createDifficultyGrid(2, 2, 0, 0, 1);
    setCell(grid, 0, 0, 0.5, 0, -1);
    expect(grid.tiers[0]).toBe(UNCLASSIFIED_TIER);
    // getCell maps UNCLASSIFIED_TIER back to -1.
    expect(getCell(grid, 0, 0)?.tierIndex).toBe(-1);
  });

  it("doesn't touch zoneIds (separate channel)", () => {
    const grid = createDifficultyGrid(2, 2, 0, 0, 1);
    setCell(grid, 0, 0, 0.5, 0, 1);
    expect(grid.zoneIds[0]).toBe(UNASSIGNED_ZONE);
  });
});

describe("cellToWorld + worldToCell — coordinate roundtrip", () => {
  it("cellToWorld returns CENTER of the cell", () => {
    const grid = createDifficultyGrid(10, 10, 0, 0, 4);
    // cell (0, 0) center is at (2, 2) = origin + 0*4 + 4/2
    expect(cellToWorld(grid, 0, 0)).toEqual({ x: 2, z: 2 });
    // cell (3, 5) center is at (3*4 + 2, 5*4 + 2) = (14, 22)
    expect(cellToWorld(grid, 3, 5)).toEqual({ x: 14, z: 22 });
  });

  it("respects the grid origin offset", () => {
    const grid = createDifficultyGrid(10, 10, -100, 50, 4);
    expect(cellToWorld(grid, 0, 0)).toEqual({ x: -98, z: 52 });
  });

  it("worldToCell floors the world position to a cell index", () => {
    const grid = createDifficultyGrid(10, 10, 0, 0, 4);
    expect(worldToCell(grid, 0, 0)).toEqual({ gx: 0, gz: 0 });
    expect(worldToCell(grid, 3.99, 3.99)).toEqual({ gx: 0, gz: 0 });
    expect(worldToCell(grid, 4, 4)).toEqual({ gx: 1, gz: 1 });
    expect(worldToCell(grid, 7.5, 12.1)).toEqual({ gx: 1, gz: 3 });
  });

  it("roundtrip: cellToWorld → worldToCell returns the original cell", () => {
    const grid = createDifficultyGrid(10, 10, 0, 0, 4);
    for (let gz = 0; gz < grid.height; gz++) {
      for (let gx = 0; gx < grid.width; gx++) {
        const w = cellToWorld(grid, gx, gz);
        const c = worldToCell(grid, w.x, w.z);
        expect(c).toEqual({ gx, gz });
      }
    }
  });

  it("worldToCell handles negative origins correctly", () => {
    const grid = createDifficultyGrid(10, 10, -100, -100, 4);
    expect(worldToCell(grid, -100, -100)).toEqual({ gx: 0, gz: 0 });
    expect(worldToCell(grid, -98, -98)).toEqual({ gx: 0, gz: 0 });
    expect(worldToCell(grid, -96, -96)).toEqual({ gx: 1, gz: 1 });
  });
});

describe("forEachClassifiedCell", () => {
  it("skips unclassified cells", () => {
    const grid = createDifficultyGrid(4, 4, 0, 0, 1);
    const visits: Array<{ gx: number; gz: number }> = [];
    forEachClassifiedCell(grid, (gx, gz) => {
      visits.push({ gx, gz });
    });
    expect(visits).toEqual([]);
  });

  it("visits exactly the cells with classified tiers", () => {
    const grid = createDifficultyGrid(4, 4, 0, 0, 1);
    setCell(grid, 1, 1, 0.5, 0, 2);
    setCell(grid, 3, 0, 0.7, 0, 3);
    setCell(grid, 2, 2, 0.0, 0, 0); // tier 0 is still classified

    const visits: Array<{ gx: number; gz: number }> = [];
    forEachClassifiedCell(grid, (gx, gz) => {
      visits.push({ gx, gz });
    });
    // Order: row-major (gz outer, gx inner).
    expect(visits).toEqual([
      { gx: 3, gz: 0 },
      { gx: 1, gz: 1 },
      { gx: 2, gz: 2 },
    ]);
  });

  it("provides the correct flat index to the callback", () => {
    const grid = createDifficultyGrid(4, 4, 0, 0, 1);
    setCell(grid, 2, 1, 0.3, 0, 1);
    const indices: number[] = [];
    forEachClassifiedCell(grid, (_gx, _gz, index) => {
      indices.push(index);
    });
    // (2, 1) → flat index 1*4 + 2 = 6
    expect(indices).toEqual([6]);
  });
});
