/**
 * brushApplication — `reapplyTileSculpts` wrapper tests.
 *
 * Pins the no-op early-out branches + the tile-world offset
 * calculation that absorbs the duplicate setup from
 * `TileBasedTerrain.tsx`'s `generateTile` + `swapTileResolution`
 * paths.
 *
 * Stroke-level math (sphere falloff, mode = raise/lower/flatten,
 * etc.) is covered by `applySculptStrokesToGeometry` upstream;
 * this test exercises only the wrapper's boundary logic.
 */

import { describe, expect, it } from "vitest";
import * as THREE from "three/webgpu";

import { reapplyTileSculpts } from "../brushApplication";
import type { TerrainSculptStroke } from "../../types";

const TILE_SIZE = 100;

/**
 * Build a 4×4 plane geometry centered at origin (local tile
 * space). Mimics what `generateTileGeometry` produces.
 */
function tileGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE, 4, 4);
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  return g;
}

describe("reapplyTileSculpts — early-out branches", () => {
  it("returns false when strokes is undefined", () => {
    const g = tileGeometry();
    expect(reapplyTileSculpts(g, 0, 0, TILE_SIZE, undefined)).toBe(false);
  });

  it("returns false on empty array", () => {
    const g = tileGeometry();
    expect(reapplyTileSculpts(g, 0, 0, TILE_SIZE, [])).toBe(false);
  });

  it("never throws on a tile far from the strokes", () => {
    // Stroke at world (0, 0); tile at (999, 999) in tile coords →
    // world (99950, 99950) — far outside any reasonable radius.
    const stroke: TerrainSculptStroke = {
      center: { x: 0, y: 0, z: 0 },
      radius: 5,
      strength: 1,
      mode: "raise",
      falloff: "smooth",
    };
    const g = tileGeometry();
    expect(() =>
      reapplyTileSculpts(g, 999, 999, TILE_SIZE, [stroke]),
    ).not.toThrow();
  });
});

describe("reapplyTileSculpts — offset math", () => {
  it("computes the same world center as the previous inline pattern", () => {
    // Inline pattern was:
    //   const halfTileOffset = tileSize / 2;
    //   applySculptStrokesToGeometry(
    //     g, tileX * tileSize + halfTileOffset, tileZ * tileSize + halfTileOffset, ...);
    // Verify the wrapper still routes a stroke at the computed
    // tile-center world position to the geometry it would have
    // modified.
    const tileX = 3;
    const tileZ = 5;
    // World center of tile (3, 5) at TILE_SIZE=100 is (350, 550).
    const expectedWorldCenter = { x: 350, z: 550 };
    const stroke: TerrainSculptStroke = {
      center: {
        x: expectedWorldCenter.x,
        y: 0,
        z: expectedWorldCenter.z,
      },
      radius: 60, // bigger than half-tile, so vertices are reachable
      strength: 5,
      mode: "raise",
      falloff: "constant",
    };
    const g = tileGeometry();
    const ret = reapplyTileSculpts(g, tileX, tileZ, TILE_SIZE, [stroke]);
    expect(ret).toBe(true);
  });

  it("computes world position correctly for the origin tile (tileX = tileZ = 0)", () => {
    // World center of tile (0,0) at TILE_SIZE=100 is (50, 50).
    const stroke: TerrainSculptStroke = {
      center: { x: 50, y: 0, z: 50 },
      radius: 60,
      strength: 5,
      mode: "raise",
      falloff: "constant",
    };
    const g = tileGeometry();
    const ret = reapplyTileSculpts(g, 0, 0, TILE_SIZE, [stroke]);
    expect(ret).toBe(true);
  });
});

describe("reapplyTileSculpts — boolean return semantics", () => {
  it("returns the underlying applySculptStrokesToGeometry result for non-empty input", () => {
    // Stroke far away → false (no modification).
    const stroke: TerrainSculptStroke = {
      center: { x: 100000, y: 0, z: 100000 },
      radius: 1,
      strength: 1,
      mode: "raise",
      falloff: "smooth",
    };
    const g = tileGeometry();
    expect(reapplyTileSculpts(g, 0, 0, TILE_SIZE, [stroke])).toBe(false);
  });
});
