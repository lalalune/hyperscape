/**
 * Phase 1.1 thirteenth carve — locks in the tile streamer's
 * LOD + eviction predicates. These rules drive every camera-
 * move frame in studio mode (and most frames in standalone),
 * so silent regressions here would manifest as visible
 * tile-load flicker, wasted GPU vertex work, or stuck old
 * tiles after the camera flies away.
 */

import { describe, expect, it } from "vitest";
import {
  isFullResResolution,
  pickTileResolution,
  shouldEvictTile,
  tileChebyshevDistance,
  tileManhattanDistance,
  TILE_EVICTION_GRACE_MS,
} from "../tileLodDecisions";
import { TILE_LOD_LOW_RESOLUTION } from "../tileStreamingRadius";

describe("tileChebyshevDistance", () => {
  it("returns max of |dx| and |dz|", () => {
    expect(tileChebyshevDistance(0, 0)).toBe(0);
    expect(tileChebyshevDistance(3, 0)).toBe(3);
    expect(tileChebyshevDistance(0, -4)).toBe(4);
    expect(tileChebyshevDistance(-2, 5)).toBe(5);
    expect(tileChebyshevDistance(7, 7)).toBe(7);
  });

  it("forms square rings — diagonal and cardinal at same dist are equal", () => {
    // 3-ring contains (3,0), (3,3), (0,3), (-3,3), (-3,0), etc.
    expect(tileChebyshevDistance(3, 0)).toBe(3);
    expect(tileChebyshevDistance(3, 3)).toBe(3);
    expect(tileChebyshevDistance(2, 3)).toBe(3);
    expect(tileChebyshevDistance(-3, 3)).toBe(3);
  });
});

describe("tileManhattanDistance", () => {
  it("returns |dx| + |dz|", () => {
    expect(tileManhattanDistance(0, 0)).toBe(0);
    expect(tileManhattanDistance(3, 0)).toBe(3);
    expect(tileManhattanDistance(0, -4)).toBe(4);
    expect(tileManhattanDistance(3, 4)).toBe(7);
    expect(tileManhattanDistance(-2, -5)).toBe(7);
  });

  it("differs from Chebyshev on diagonals — orders queue priority correctly", () => {
    // Tile at (1, 0) is closer than tile at (1, 1) by Manhattan.
    expect(tileManhattanDistance(1, 0)).toBeLessThan(
      tileManhattanDistance(1, 1),
    );
    // But Chebyshev treats them as equal.
    expect(tileChebyshevDistance(1, 0)).toBe(tileChebyshevDistance(1, 1));
  });
});

describe("pickTileResolution", () => {
  it("returns baseResolution when within full-detail radius", () => {
    expect(pickTileResolution(0, 3, 32)).toBe(32);
    expect(pickTileResolution(1, 3, 32)).toBe(32);
    expect(pickTileResolution(3, 3, 32)).toBe(32); // exactly at boundary
  });

  it("returns LOW_RESOLUTION when beyond full-detail radius", () => {
    expect(pickTileResolution(4, 3, 32)).toBe(TILE_LOD_LOW_RESOLUTION);
    expect(pickTileResolution(10, 3, 32)).toBe(TILE_LOD_LOW_RESOLUTION);
  });

  it("respects custom base resolution", () => {
    expect(pickTileResolution(0, 5, 64)).toBe(64);
    expect(pickTileResolution(6, 5, 64)).toBe(TILE_LOD_LOW_RESOLUTION);
  });
});

describe("isFullResResolution", () => {
  it("returns true for resolutions strictly greater than LOW", () => {
    expect(isFullResResolution(TILE_LOD_LOW_RESOLUTION + 1)).toBe(true);
    expect(isFullResResolution(32)).toBe(true);
  });

  it("returns false at the LOW boundary and below", () => {
    expect(isFullResResolution(TILE_LOD_LOW_RESOLUTION)).toBe(false);
    expect(isFullResResolution(0)).toBe(false);
  });
});

describe("shouldEvictTile", () => {
  const NOW = 10_000;

  it("does NOT evict tiles inside the unload radius", () => {
    // (3, 0) within unloadRadius=5 — should not evict regardless of age.
    expect(shouldEvictTile(3, 0, 5, NOW, 0)).toBe(false);
    expect(shouldEvictTile(0, -3, 5, NOW, 0)).toBe(false);
  });

  it("does NOT evict tiles outside radius if within grace period", () => {
    // (10, 0) outside unloadRadius=5; lastAccessed = NOW - 500 (within 1000ms grace).
    expect(shouldEvictTile(10, 0, 5, NOW, NOW - 500)).toBe(false);
  });

  it("evicts tiles outside radius once grace elapsed", () => {
    expect(
      shouldEvictTile(10, 0, 5, NOW, NOW - TILE_EVICTION_GRACE_MS - 1),
    ).toBe(true);
    expect(shouldEvictTile(0, 8, 5, NOW, 0)).toBe(true); // very old
  });

  it("evicts when only one axis exceeds the radius", () => {
    // (6, 0) — outside radius 5 by x, well within grace? Test x-only:
    expect(shouldEvictTile(6, 0, 5, NOW, 0)).toBe(true);
    // (0, 6) — outside by z:
    expect(shouldEvictTile(0, 6, 5, NOW, 0)).toBe(true);
  });

  it("uses Chebyshev semantics — diagonal tiles only evict if BOTH axes are inside", () => {
    // (5, 5) — both axes at radius boundary → inside → don't evict.
    expect(shouldEvictTile(5, 5, 5, NOW, 0)).toBe(false);
    // (5, 6) — z exceeds → evict (if grace elapsed).
    expect(shouldEvictTile(5, 6, 5, NOW, 0)).toBe(true);
  });

  it("treats the unloadRadius boundary as inclusive (don't evict at exact distance)", () => {
    expect(shouldEvictTile(5, 0, 5, NOW, 0)).toBe(false);
    expect(shouldEvictTile(0, -5, 5, NOW, 0)).toBe(false);
  });
});
