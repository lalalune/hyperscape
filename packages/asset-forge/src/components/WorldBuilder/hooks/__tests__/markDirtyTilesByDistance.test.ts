/**
 * Phase 1.1 ninth carve — locks in the dirty-tile-by-distance
 * helper so the three deduplicated callsites (road change,
 * mine change, terrain-config change) keep matching behavior.
 */

import { describe, expect, it } from "vitest";
import {
  markDirtyTilesByDistance,
  type MarkableTile,
} from "../markDirtyTilesByDistance";

interface TestTile extends MarkableTile {
  tileX: number;
  tileZ: number;
  dirty?: boolean;
}

function makeTiles(coords: ReadonlyArray<[string, number, number]>) {
  const m = new Map<string, TestTile>();
  for (const [key, tx, tz] of coords) {
    m.set(key, { tileX: tx, tileZ: tz });
  }
  return m;
}

describe("markDirtyTilesByDistance", () => {
  it("returns an empty array for an empty input map", () => {
    const tiles = new Map<string, TestTile>();
    expect(markDirtyTilesByDistance(tiles, { tileX: 0, tileZ: 0 })).toEqual([]);
  });

  it("sets dirty=true on every tile in the map", () => {
    const tiles = makeTiles([
      ["a", 0, 0],
      ["b", 5, 5],
      ["c", -3, 2],
    ]);
    markDirtyTilesByDistance(tiles, { tileX: 0, tileZ: 0 });
    for (const t of tiles.values()) {
      expect(t.dirty).toBe(true);
    }
  });

  it("sorts keys by squared distance to camera tile, nearest first", () => {
    const tiles = makeTiles([
      ["far", 10, 10], // dist² = 200
      ["near", 1, 1], // dist² = 2
      ["mid", 3, 4], // dist² = 25
    ]);
    const keys = markDirtyTilesByDistance(tiles, { tileX: 0, tileZ: 0 });
    expect(keys).toEqual(["near", "mid", "far"]);
  });

  it("uses squared distance — no sqrt — but ordering is identical", () => {
    // Same direction, varying magnitudes; squared distance ordering
    // matches Euclidean ordering.
    const tiles = makeTiles([
      ["c", 6, 8], // sqrt-dist = 10
      ["a", 1, 0], // sqrt-dist = 1
      ["b", 3, 4], // sqrt-dist = 5
    ]);
    const keys = markDirtyTilesByDistance(tiles, { tileX: 0, tileZ: 0 });
    expect(keys).toEqual(["a", "b", "c"]);
  });

  it("respects camera tile != origin", () => {
    const tiles = makeTiles([
      ["nearTo10", 11, 10],
      ["farFrom10", 0, 0],
    ]);
    const keys = markDirtyTilesByDistance(tiles, { tileX: 10, tileZ: 10 });
    expect(keys).toEqual(["nearTo10", "farFrom10"]);
  });

  it("preserves tie-breaks via insertion order (Map iteration is insertion-ordered)", () => {
    const m = new Map<string, TestTile>();
    m.set("first", { tileX: 1, tileZ: 0 }); // dist² = 1
    m.set("second", { tileX: 0, tileZ: 1 }); // dist² = 1
    const keys = markDirtyTilesByDistance(m, { tileX: 0, tileZ: 0 });
    // Both equidistant; sort is stable in modern JS so insertion
    // order is preserved.
    expect(keys).toEqual(["first", "second"]);
  });

  it("handles negative tile coordinates", () => {
    const m = new Map<string, TestTile>();
    m.set("near", { tileX: -1, tileZ: -1 }); // dist²=2 from origin
    m.set("far", { tileX: -10, tileZ: -10 }); // dist²=200
    const keys = markDirtyTilesByDistance(m, { tileX: 0, tileZ: 0 });
    expect(keys).toEqual(["near", "far"]);
  });
});
