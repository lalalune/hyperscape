/**
 * `zonePaintEngine` — pure helper tests.
 *
 * The zone paint engine has THREE.js / mesh-building functions
 * that are hard to unit test, but four pure helpers that drive
 * the user-visible behavior:
 *
 *   - createInitialCursorState — no-op factory
 *   - getRegionColor(index)    — modular palette indexing
 *   - getTierColor(region)     — tag + autoGen-difficulty map
 *   - getBrushTiles(cx, cz, n) — brush-shape tile generator
 *
 * All four are deterministic and bug-prone in subtle ways
 * (off-by-one in brush-radius, palette wrap-around, tier
 * range thresholds). Worth direct tests.
 */

import { describe, expect, it } from "vitest";
import {
  createInitialCursorState,
  getBrushTiles,
  getRegionColor,
  getTierColor,
  REGION_COLORS,
} from "../zonePaintEngine";
import type { PlacedRegion } from "../../types";

describe("createInitialCursorState", () => {
  it("returns the empty cursor state with sensible defaults", () => {
    const state = createInitialCursorState();
    expect(state.mesh).toBeNull();
    expect(state.geometry).toBeNull();
    expect(state.outline).toBeNull();
    expect(state.material).toBeNull();
    expect(state.outlineMaterial).toBeNull();
    expect(state.lastTile).toBeNull();
    expect(state.lastBrushSize).toBe(1);
    expect(state.lastErase).toBe(false);
  });

  it("returns a fresh object each call (no shared reference)", () => {
    const a = createInitialCursorState();
    const b = createInitialCursorState();
    expect(a).not.toBe(b);
  });
});

describe("getRegionColor", () => {
  it("returns the indexed entry for in-range indices", () => {
    expect(getRegionColor(0)).toBe(REGION_COLORS[0]);
    expect(getRegionColor(1)).toBe(REGION_COLORS[1]);
  });

  it("wraps via modular indexing past the palette length", () => {
    const wrapped = getRegionColor(REGION_COLORS.length);
    expect(wrapped).toBe(REGION_COLORS[0]);
    const wrappedTwice = getRegionColor(REGION_COLORS.length * 2);
    expect(wrappedTwice).toBe(REGION_COLORS[0]);
  });

  it("never returns undefined for any non-negative index", () => {
    for (let i = 0; i < 200; i++) {
      const c = getRegionColor(i);
      expect(typeof c).toBe("number");
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("getTierColor", () => {
  function makeRegion(overrides: Partial<PlacedRegion> = {}): PlacedRegion {
    return {
      id: "r1",
      name: "Region",
      tileKeys: [],
      color: 0,
      difficultyLevel: 1,
      ...overrides,
    } as unknown as PlacedRegion;
  }

  it("returns the tag-mapped color when the region has a tier tag", () => {
    expect(getTierColor(makeRegion({ tags: ["safe"] }))).toBe(0x2e7d32);
    expect(getTierColor(makeRegion({ tags: ["beginner"] }))).toBe(0x66bb6a);
    expect(getTierColor(makeRegion({ tags: ["low"] }))).toBe(0xfdd835);
    expect(getTierColor(makeRegion({ tags: ["mid"] }))).toBe(0xff9800);
    expect(getTierColor(makeRegion({ tags: ["dangerous"] }))).toBe(0xd32f2f);
    expect(getTierColor(makeRegion({ tags: ["high"] }))).toBe(0xd32f2f);
    expect(getTierColor(makeRegion({ tags: ["extreme"] }))).toBe(0x6a1b9a);
  });

  it("ignores non-tier tags and uses the first matching one", () => {
    expect(
      getTierColor(makeRegion({ tags: ["bossArea", "safe", "extreme"] })),
    ).toBe(0x2e7d32); // first matching = safe
  });

  it("falls back to autoGenBounds difficulty midpoint when no tag matches", () => {
    // mid < 0.05 → safe (0x2e7d32)
    expect(
      getTierColor(
        makeRegion({
          autoGenBounds: { difficultyRange: [0, 0.04] } as never,
        }),
      ),
    ).toBe(0x2e7d32);
    // mid 0.1 → beginner (0x66bb6a)
    expect(
      getTierColor(
        makeRegion({
          autoGenBounds: { difficultyRange: [0.05, 0.15] } as never,
        }),
      ),
    ).toBe(0x66bb6a);
    // mid 0.4 → mid (0xff9800)
    expect(
      getTierColor(
        makeRegion({
          autoGenBounds: { difficultyRange: [0.3, 0.5] } as never,
        }),
      ),
    ).toBe(0xff9800);
    // mid 0.85 → extreme (0x6a1b9a)
    expect(
      getTierColor(
        makeRegion({
          autoGenBounds: { difficultyRange: [0.7, 1] } as never,
        }),
      ),
    ).toBe(0x6a1b9a);
  });

  it("returns the gray fallback (0x888888) when neither tag nor autoGenBounds is set", () => {
    expect(getTierColor(makeRegion())).toBe(0x888888);
    expect(getTierColor(makeRegion({ tags: [] }))).toBe(0x888888);
    expect(getTierColor(makeRegion({ tags: ["unknownTag"] }))).toBe(0x888888);
  });
});

describe("getBrushTiles", () => {
  it("brushSize=1 returns a single tile at center (radius=0)", () => {
    const tiles = getBrushTiles(0, 0, 1);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toEqual({ x: 0, z: 0 });
  });

  it("brushSize=2 returns a single tile (floor(2/2)=1, but loop runs -0..0 since brush 2 / 2 = 1 → radius)", () => {
    // brushSize 2 gives radius=1, so (2*1+1)^2 = 9 tiles around center.
    const tiles = getBrushTiles(0, 0, 2);
    expect(tiles).toHaveLength(9);
  });

  it("brushSize=3 returns a 3x3 patch (radius=1)", () => {
    const tiles = getBrushTiles(0, 0, 3);
    expect(tiles).toHaveLength(9);
    expect(tiles).toContainEqual({ x: -1, z: -1 });
    expect(tiles).toContainEqual({ x: 0, z: 0 });
    expect(tiles).toContainEqual({ x: 1, z: 1 });
  });

  it("brushSize=5 returns a 5x5 patch (radius=2)", () => {
    const tiles = getBrushTiles(0, 0, 5);
    expect(tiles).toHaveLength(25);
    // Corners present
    expect(tiles).toContainEqual({ x: -2, z: -2 });
    expect(tiles).toContainEqual({ x: 2, z: 2 });
  });

  it("offsets the patch around the supplied center", () => {
    const tiles = getBrushTiles(10, 20, 3);
    expect(tiles).toHaveLength(9);
    expect(tiles).toContainEqual({ x: 9, z: 19 });
    expect(tiles).toContainEqual({ x: 10, z: 20 }); // center
    expect(tiles).toContainEqual({ x: 11, z: 21 });
  });

  it("returns floor(brushSize/2) ⇒ even-size brushes are deterministic", () => {
    // Even brush sizes produce a (2*r+1)x(2*r+1) patch where r = floor(size/2).
    expect(getBrushTiles(0, 0, 4)).toHaveLength(25); // r=2 → 5x5
    expect(getBrushTiles(0, 0, 6)).toHaveLength(49); // r=3 → 7x7
  });

  it("returns a fresh array each call (no shared mutation)", () => {
    const a = getBrushTiles(0, 0, 3);
    const b = getBrushTiles(0, 0, 3);
    expect(a).not.toBe(b);
    a.push({ x: 99, z: 99 });
    expect(b).toHaveLength(9);
  });
});
