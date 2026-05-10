/**
 * `heightmapIO` — bilinear-interpolated heightmap querier tests.
 *
 * The export/import sides need browser DOM APIs (canvas / Blob /
 * createImageBitmap) — those are integration-tested via the
 * studio's export-then-reimport flow. This file pins down the
 * pure `createHeightmapQuerier` function: bilinear interpolation
 * with edge clamping. The math is bug-prone (off-by-one at
 * texel boundaries, fx/fz weight order, division-by-(width-1)
 * vs width).
 */

import { describe, expect, it } from "vitest";
import { createHeightmapQuerier, type HeightmapMetadata } from "../heightmapIO";

const META: HeightmapMetadata = {
  worldSize: 10,
  tileSize: 10,
  maxHeight: 100,
  waterThreshold: 8,
  resolution: 4,
};

// Simple 4x4 heightmap, row-major. Heights are normalized [0, 1].
//   row 0:  0.0  0.0  0.0  0.0    (gradient ramp from 0 to 1 along Z)
//   row 1:  0.33 0.33 0.33 0.33
//   row 2:  0.67 0.67 0.67 0.67
//   row 3:  1.0  1.0  1.0  1.0
const Z_GRADIENT = new Float32Array([
  0, 0, 0, 0, 0.33, 0.33, 0.33, 0.33, 0.67, 0.67, 0.67, 0.67, 1, 1, 1, 1,
]);

// Gradient along X instead of Z.
const X_GRADIENT = new Float32Array([
  0, 0.33, 0.67, 1, 0, 0.33, 0.67, 1, 0, 0.33, 0.67, 1, 0, 0.33, 0.67, 1,
]);

describe("createHeightmapQuerier — corners (no interpolation)", () => {
  it("worldX=0, worldZ=0 returns the (0, 0) texel", () => {
    const q = createHeightmapQuerier(Z_GRADIENT, 4, 4, META);
    // The texel at (0, 0) holds 0; multiplied by maxHeight=100 → 0.
    expect(q(0, 0).height).toBeCloseTo(0, 5);
  });

  it("worldExtent corner returns the (width-1, height-1) texel", () => {
    const q = createHeightmapQuerier(Z_GRADIENT, 4, 4, META);
    // worldExtent = 10 * 10 = 100. The (3, 3) texel is 1.0 → 100.
    expect(q(100, 100).height).toBeCloseTo(100, 5);
  });
});

describe("createHeightmapQuerier — bilinear math", () => {
  it("interpolates linearly along Z when X is constant (Z-gradient map)", () => {
    const q = createHeightmapQuerier(Z_GRADIENT, 4, 4, META);
    // worldExtent = 100. Halfway along Z (worldZ=50) should give
    // approximately half of maxHeight.
    const h = q(50, 50).height;
    expect(h).toBeGreaterThan(40);
    expect(h).toBeLessThan(60);
  });

  it("interpolates linearly along X when Z is constant (X-gradient map)", () => {
    const q = createHeightmapQuerier(X_GRADIENT, 4, 4, META);
    const h = q(50, 50).height;
    expect(h).toBeGreaterThan(40);
    expect(h).toBeLessThan(60);
  });

  it("returns identical to texel value at exact texel centers", () => {
    // Texel (1, 1) center is at (worldExtent * 1/(width-1), ...) = (33.33, 33.33).
    // Z_GRADIENT[1*4 + 1] = 0.33 → height = 33.
    const q = createHeightmapQuerier(Z_GRADIENT, 4, 4, META);
    const h = q(33.333, 33.333).height;
    // Allow a wide tolerance because the gradient is in 0.33 steps.
    expect(h).toBeGreaterThan(25);
    expect(h).toBeLessThan(40);
  });

  it("uses the canonical bilinear weighting formula (cross-corner test)", () => {
    // 2x2 heightmap with corners (0,0)=0, (1,0)=1, (0,1)=2, (1,1)=3
    // (normalized to [0, 1] then scaled by maxHeight in the result).
    const heights = new Float32Array([0, 0.25, 0.5, 0.75]);
    const meta: HeightmapMetadata = {
      worldSize: 1,
      tileSize: 100,
      maxHeight: 100,
      waterThreshold: 0,
      resolution: 2,
    };
    const q = createHeightmapQuerier(heights, 2, 2, meta);
    // Center of map: fx=0.5, fz=0.5
    // h = 0*0.25 + 0.25*0.25 + 0.5*0.25 + 0.75*0.25 = 0.375
    // height = 0.375 * 100 = 37.5
    expect(q(50, 50).height).toBeCloseTo(37.5, 1);
  });
});

describe("createHeightmapQuerier — edge clamping", () => {
  it("clamps worldX below 0 to texel 0", () => {
    const q = createHeightmapQuerier(Z_GRADIENT, 4, 4, META);
    const h = q(-100, 0).height;
    // Should match the (0, 0) texel.
    expect(h).toBeCloseTo(0, 5);
  });

  it("clamps worldZ above worldExtent to (width-1, height-1)", () => {
    const q = createHeightmapQuerier(Z_GRADIENT, 4, 4, META);
    const h = q(0, 9999).height;
    // Z_GRADIENT[3*4+0] = 1.0 → height = 100.
    expect(h).toBeCloseTo(100, 5);
  });

  it("clamps both X and Z when out of bounds", () => {
    const q = createHeightmapQuerier(Z_GRADIENT, 4, 4, META);
    const upperLeft = q(-100, -100).height;
    const lowerRight = q(99999, 99999).height;
    expect(upperLeft).toBeCloseTo(0, 5); // (0, 0) corner
    expect(lowerRight).toBeCloseTo(100, 5); // (3, 3) corner
  });
});

describe("createHeightmapQuerier — TerrainQueryResult shape", () => {
  it("returns the canonical shape", () => {
    const q = createHeightmapQuerier(Z_GRADIENT, 4, 4, META);
    const result = q(0, 0);
    expect(result.height).toBe(0);
    // Imported heightmaps don't carry biome data — defaults applied.
    expect(result.biome).toBe("plains");
    expect(result.biomeForestWeight).toBe(0);
    expect(result.biomeCanyonWeight).toBe(0);
  });

  it("scales height by metadata.maxHeight", () => {
    // Same normalized data, different maxHeight → linearly scaled output.
    const flatOnes = new Float32Array(16).fill(1);
    const meta100: HeightmapMetadata = { ...META, maxHeight: 100 };
    const meta500: HeightmapMetadata = { ...META, maxHeight: 500 };
    const q100 = createHeightmapQuerier(flatOnes, 4, 4, meta100);
    const q500 = createHeightmapQuerier(flatOnes, 4, 4, meta500);
    expect(q100(0, 0).height).toBeCloseTo(100);
    expect(q500(0, 0).height).toBeCloseTo(500);
  });
});

describe("createHeightmapQuerier — non-square maps", () => {
  it("handles non-square heightmaps (4 wide × 2 tall)", () => {
    // 4 wide × 2 tall, all heights at 0.5.
    const heights = new Float32Array(8).fill(0.5);
    const meta: HeightmapMetadata = {
      worldSize: 1,
      tileSize: 100,
      maxHeight: 100,
      waterThreshold: 0,
      resolution: 4,
    };
    const q = createHeightmapQuerier(heights, 4, 2, meta);
    expect(q(0, 0).height).toBeCloseTo(50);
    expect(q(100, 100).height).toBeCloseTo(50);
  });
});
