/**
 * `TerrainQuerier` — DI interface factory tests.
 *
 * The interface decouples pipeline stages from the underlying
 * terrain implementation (editor uses TileBasedTerrain scene
 * refs; tests use controlled mocks; headless uses raw
 * heightmap data). Both factories are tiny but enforce the
 * contract that callers depend on — `getHeight` must agree
 * with `isWater` (waterThreshold check), and the editor
 * factory must flow `queryBiome.height` to BOTH `getHeight`
 * AND `isWater` so a single terrain change propagates
 * consistently.
 */

import { describe, expect, it, vi } from "vitest";
import {
  createEditorTerrainQuerier,
  createTestTerrainQuerier,
} from "../TerrainQuerier";

describe("createTestTerrainQuerier", () => {
  it("returns the supplied constants for all positions", () => {
    const q = createTestTerrainQuerier(42, "forest", 0.7, 5);
    expect(q.getHeight(0, 0)).toBe(42);
    expect(q.getHeight(1000, -1000)).toBe(42);
    expect(q.getBiome(0, 0)).toBe("forest");
    expect(q.getDifficulty(0, 0)).toBe(0.7);
  });

  it("isWater compares height to waterThreshold", () => {
    // height=2, waterThreshold=5 → underwater
    const underwater = createTestTerrainQuerier(2, "swamp", 0.3, 5);
    expect(underwater.isWater(0, 0)).toBe(true);
    // height=10, waterThreshold=5 → above water
    const above = createTestTerrainQuerier(10, "plains", 0.3, 5);
    expect(above.isWater(0, 0)).toBe(false);
    // boundary: height === waterThreshold → NOT underwater (strict <)
    const boundary = createTestTerrainQuerier(5, "plains", 0.3, 5);
    expect(boundary.isWater(0, 0)).toBe(false);
  });

  it("uses sensible defaults when arguments omitted", () => {
    const q = createTestTerrainQuerier();
    expect(q.getHeight(0, 0)).toBe(10);
    expect(q.getBiome(0, 0)).toBe("plains");
    expect(q.getDifficulty(0, 0)).toBe(0.5);
    // waterThreshold default is 0; height=10 > 0 → not water.
    expect(q.isWater(0, 0)).toBe(false);
  });

  it("ignores world-position arguments — constant for all positions", () => {
    const q = createTestTerrainQuerier(10, "plains", 0.5, 0);
    expect(q.getHeight(-9999, 9999)).toBe(q.getHeight(0, 0));
    expect(q.getBiome(-9999, 9999)).toBe(q.getBiome(0, 0));
  });
});

describe("createEditorTerrainQuerier", () => {
  it("forwards (x, z) to queryBiome and returns its height", () => {
    const queryBiome = vi.fn((x: number, _z: number) => ({
      height: x * 2,
      biome: "plains",
    }));
    const q = createEditorTerrainQuerier(queryBiome, () => 0.5, 0);
    expect(q.getHeight(7, 13)).toBe(14);
    expect(queryBiome).toHaveBeenCalledWith(7, 13);
  });

  it("forwards (x, z) to queryBiome and returns its biome", () => {
    const queryBiome = vi.fn((_x: number, z: number) => ({
      height: 10,
      biome: z > 0 ? "forest" : "desert",
    }));
    const q = createEditorTerrainQuerier(queryBiome, () => 0.5, 0);
    expect(q.getBiome(0, 1)).toBe("forest");
    expect(q.getBiome(0, -1)).toBe("desert");
  });

  it("getDifficulty delegates to the supplied callback", () => {
    const getDifficulty = vi.fn((x: number, z: number) => x + z);
    const q = createEditorTerrainQuerier(
      () => ({ height: 0, biome: "plains" }),
      getDifficulty,
      0,
    );
    expect(q.getDifficulty(3, 4)).toBe(7);
    expect(getDifficulty).toHaveBeenCalledWith(3, 4);
  });

  it("isWater consults queryBiome.height vs waterThreshold (consistency with getHeight)", () => {
    const queryBiome = vi.fn((_x: number, _z: number) => ({
      height: 3,
      biome: "lakes",
    }));
    const q = createEditorTerrainQuerier(queryBiome, () => 0, 5);
    // Height 3 < threshold 5 → water.
    expect(q.isWater(0, 0)).toBe(true);
    // getHeight returns the SAME source value.
    expect(q.getHeight(0, 0)).toBe(3);
  });

  it("isWater is FALSE when height === waterThreshold (strict <)", () => {
    const q = createEditorTerrainQuerier(
      () => ({ height: 5, biome: "plains" }),
      () => 0.5,
      5,
    );
    expect(q.isWater(0, 0)).toBe(false);
  });

  it("queryBiome is called once per .getHeight / .getBiome / .isWater call (no internal cache)", () => {
    const queryBiome = vi.fn(() => ({ height: 1, biome: "x" }));
    const q = createEditorTerrainQuerier(queryBiome, () => 0, 0);
    q.getHeight(0, 0);
    q.getBiome(0, 0);
    q.isWater(0, 0);
    // Three independent calls.
    expect(queryBiome).toHaveBeenCalledTimes(3);
  });
});
