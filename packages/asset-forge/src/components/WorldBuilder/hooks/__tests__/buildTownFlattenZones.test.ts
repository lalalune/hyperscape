/**
 * Phase 1.1 eighth carve — locks in the per-tile town flatten
 * builder's AABB rejection + zone construction. The math is
 * subtle (1.4× outer pad, 0.85× inner platform, single-sample
 * center-height) so a regression here would silently corrupt
 * town placements at tile borders.
 */

import { describe, expect, it, vi } from "vitest";
import { buildTownFlattenZones } from "../buildTownFlattenZones";
import type { TerrainQuerier, TerrainQueryResult } from "../../terrainHelpers";

function makeQuerier(height: number = 100): {
  fn: TerrainQuerier;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn(
    (_x: number, _z: number) =>
      ({
        height,
        biomeForestWeight: 0,
        biomeCanyonWeight: 0,
      }) as unknown as TerrainQueryResult,
  );
  return { fn: spy as unknown as TerrainQuerier, spy };
}

const TILE_SIZE = 64;
const WC_OFFSET = 1024;

describe("buildTownFlattenZones", () => {
  it("returns undefined for empty towns input", () => {
    const { fn } = makeQuerier();
    const result = buildTownFlattenZones([], 0, 0, TILE_SIZE, WC_OFFSET, fn);
    expect(result).toBeUndefined();
  });

  it("returns undefined when no towns overlap the tile AABB", () => {
    const { fn } = makeQuerier();
    // Tile (0, 0) covers world-space [-WC_OFFSET, -WC_OFFSET + TILE_SIZE]
    // = [-1024, -960] in both axes. A town at (5000, 5000) with
    // safeZoneRadius=10 (outerR=14) is far outside.
    const result = buildTownFlattenZones(
      [{ position: { x: 5000, z: 5000 }, safeZoneRadius: 10 }],
      0,
      0,
      TILE_SIZE,
      WC_OFFSET,
      fn,
    );
    expect(result).toBeUndefined();
  });

  it("emits a zone for an overlapping town with correct radii", () => {
    const { fn } = makeQuerier(123);
    // Place a town inside tile (16, 16) — world-space center
    // ≈ (16*64 - 1024 + 32, ...) = (32, 32).
    const result = buildTownFlattenZones(
      [{ position: { x: 32, z: 32 }, safeZoneRadius: 20 }],
      16,
      16,
      TILE_SIZE,
      WC_OFFSET,
      fn,
    );
    expect(result).toHaveLength(1);
    expect(result![0]).toEqual({
      x: 32,
      z: 32,
      centerHeight: 123,
      innerRadius: 17, // 20 * 0.85
      outerRadius: 28, // 20 * 1.4
    });
  });

  it("rejects towns outside the AABB even when within the bounding-box-of-bounding-boxes", () => {
    // Town slightly past the +x edge by more than outerR. tile (16,16)
    // covers x ∈ [0, 64] in world coords; a town at x=100 with
    // outerR=10 is outside (100 - 10 = 90 > 64).
    const { fn } = makeQuerier();
    const result = buildTownFlattenZones(
      [{ position: { x: 100, z: 32 }, safeZoneRadius: 10 / 1.4 }], // outerR ≈ 10
      16,
      16,
      TILE_SIZE,
      WC_OFFSET,
      fn,
    );
    expect(result).toBeUndefined();
  });

  it("includes a town that straddles the tile edge (within outer-radius pad)", () => {
    // tile (16,16) world AABB is [0,64]. Town at x=70 with
    // outerR=10 → x-outerR = 60, which is INSIDE the tile.
    // Should be included.
    const { fn } = makeQuerier();
    const result = buildTownFlattenZones(
      [{ position: { x: 70, z: 32 }, safeZoneRadius: 10 / 1.4 }], // outerR = 10
      16,
      16,
      TILE_SIZE,
      WC_OFFSET,
      fn,
    );
    expect(result).toHaveLength(1);
  });

  it("samples each overlapping town's center height exactly once", () => {
    const { fn, spy } = makeQuerier(50);
    buildTownFlattenZones(
      [
        { position: { x: 30, z: 30 }, safeZoneRadius: 20 },
        { position: { x: 40, z: 40 }, safeZoneRadius: 20 },
      ],
      16,
      16,
      TILE_SIZE,
      WC_OFFSET,
      fn,
    );
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 30, 30);
    expect(spy).toHaveBeenNthCalledWith(2, 40, 40);
  });

  it("does NOT call the querier for non-overlapping towns", () => {
    const { fn, spy } = makeQuerier();
    buildTownFlattenZones(
      [{ position: { x: 5000, z: 5000 }, safeZoneRadius: 10 }],
      0,
      0,
      TILE_SIZE,
      WC_OFFSET,
      fn,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("emits multiple zones when multiple towns overlap one tile", () => {
    const { fn } = makeQuerier(7);
    const result = buildTownFlattenZones(
      [
        { position: { x: 10, z: 10 }, safeZoneRadius: 15 },
        { position: { x: 50, z: 50 }, safeZoneRadius: 12 },
      ],
      16,
      16,
      TILE_SIZE,
      WC_OFFSET,
      fn,
    );
    expect(result).toHaveLength(2);
    expect(result![0]?.x).toBe(10);
    expect(result![1]?.x).toBe(50);
  });
});
