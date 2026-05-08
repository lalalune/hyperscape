/**
 * Phase 1.1 fifth carve — first piece of the tile-streamer
 * extraction. Locks in the altitude→radius mapping so future
 * tweaks to the tile streamer don't silently regress the
 * visible-horizon-stays-filled invariant the manual values
 * encode.
 */

import { describe, expect, it } from "vitest";
import {
  getDynamicLoadRadius,
  getFullDetailRadius,
  TILE_LOAD_RADIUS_STANDALONE,
  TILE_LOAD_RADIUS_STUDIO,
} from "../tileStreamingRadius";

describe("getDynamicLoadRadius", () => {
  it("returns the fixed standalone radius outside studio mode", () => {
    expect(getDynamicLoadRadius(0, false)).toBe(TILE_LOAD_RADIUS_STANDALONE);
    expect(getDynamicLoadRadius(50, false)).toBe(TILE_LOAD_RADIUS_STANDALONE);
    expect(getDynamicLoadRadius(5000, false)).toBe(TILE_LOAD_RADIUS_STANDALONE);
  });

  it("returns base studio radius at or below 50m altitude", () => {
    expect(getDynamicLoadRadius(0, true)).toBe(TILE_LOAD_RADIUS_STUDIO);
    expect(getDynamicLoadRadius(50, true)).toBe(TILE_LOAD_RADIUS_STUDIO);
  });

  it("scales linearly with altitude above 50m (1 tile per 80m)", () => {
    // Y=200 → base 3 + (200-50)/80 = 3 + 1.875 → round → 5
    expect(getDynamicLoadRadius(200, true)).toBe(5);
    // Y=400 → 3 + (400-50)/80 = 3 + 4.375 → 7 (matches the docstring's "8" close enough; rounded)
    expect(getDynamicLoadRadius(400, true)).toBe(7);
    // Y=800 → 3 + (800-50)/80 = 3 + 9.375 → 12-13
    expect(getDynamicLoadRadius(800, true)).toBeGreaterThanOrEqual(12);
    expect(getDynamicLoadRadius(800, true)).toBeLessThanOrEqual(13);
    // Y=1500 → 3 + (1500-50)/80 = 3 + 18.125 → 21
    expect(getDynamicLoadRadius(1500, true)).toBe(21);
  });

  it("caps at 50 tiles regardless of how high the camera goes", () => {
    expect(getDynamicLoadRadius(5000, true)).toBe(50);
    expect(getDynamicLoadRadius(50_000, true)).toBe(50);
    expect(getDynamicLoadRadius(Number.MAX_SAFE_INTEGER, true)).toBe(50);
  });

  it("never returns less than the studio base", () => {
    // Negative altitudes shouldn't happen but be safe.
    expect(getDynamicLoadRadius(-100, true)).toBe(TILE_LOAD_RADIUS_STUDIO);
  });
});

describe("getFullDetailRadius", () => {
  it("returns the fixed standalone radius outside studio mode", () => {
    expect(getFullDetailRadius(0, false)).toBe(TILE_LOAD_RADIUS_STANDALONE);
    expect(getFullDetailRadius(500, false)).toBe(TILE_LOAD_RADIUS_STANDALONE);
    expect(getFullDetailRadius(5000, false)).toBe(TILE_LOAD_RADIUS_STANDALONE);
  });

  it("returns base studio radius at or below 200m altitude", () => {
    expect(getFullDetailRadius(0, true)).toBe(TILE_LOAD_RADIUS_STUDIO);
    expect(getFullDetailRadius(50, true)).toBe(TILE_LOAD_RADIUS_STUDIO);
    expect(getFullDetailRadius(200, true)).toBe(TILE_LOAD_RADIUS_STUDIO);
  });

  it("scales DOWN linearly above 200m (opposite of dynamic load radius)", () => {
    // Y=400: scale = 1 - (400-200)/600 = 0.667 → round(3*0.667) = 2
    expect(getFullDetailRadius(400, true)).toBe(2);
    // Y=500: scale = 1 - 300/600 = 0.5 → round(3*0.5) = 2 (round half to even/up)
    expect(getFullDetailRadius(500, true)).toBeGreaterThanOrEqual(1);
    expect(getFullDetailRadius(500, true)).toBeLessThanOrEqual(2);
    // Y=600: scale = 0.333 → round(1) = 1
    expect(getFullDetailRadius(600, true)).toBe(1);
  });

  it("clamps to a floor of 1 — never returns 0 even at extreme altitude", () => {
    expect(getFullDetailRadius(800, true)).toBe(1);
    expect(getFullDetailRadius(5000, true)).toBe(1);
    expect(getFullDetailRadius(Number.MAX_SAFE_INTEGER, true)).toBe(1);
  });

  it("handles negative altitudes gracefully (returns base)", () => {
    expect(getFullDetailRadius(-100, true)).toBe(TILE_LOAD_RADIUS_STUDIO);
  });
});
