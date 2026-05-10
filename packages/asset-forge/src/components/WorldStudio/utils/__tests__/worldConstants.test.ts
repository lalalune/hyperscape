/**
 * `worldConstants` — getWorldRadius + getTownSafeRadius unit tests.
 *
 * The constants in worldConstants.ts are referenced across the
 * world-generation hooks (auto-gen entity spacing, vegetation
 * buffers, etc.). The accessor helpers (`getWorldRadius`,
 * `getTownSafeRadius`) are pure functions with simple math but
 * carry implicit fallback semantics — `getTownSafeRadius`'s
 * size→radius mapping (80 for town, 50 for village, 30 for
 * default) is part of the contract that auto-gen relies on.
 */

import { describe, expect, it } from "vitest";
import {
  BASE_MOB_DENSITY,
  BASE_RESOURCE_DENSITY,
  getTownSafeRadius,
  getWorldRadius,
  HAND_PLACED_ENTITY_BUFFER,
  MIN_MOB_SPACING,
  MIN_RESOURCE_SPACING,
  MIN_STATION_SPACING,
  TOWN_STATION_SEARCH_RADIUS,
  VEGETATION_BUFFER,
} from "../worldConstants";

describe("constants — sanity checks", () => {
  it("spacing constants are positive", () => {
    expect(MIN_MOB_SPACING).toBeGreaterThan(0);
    expect(MIN_RESOURCE_SPACING).toBeGreaterThan(0);
    expect(MIN_STATION_SPACING).toBeGreaterThan(0);
    expect(HAND_PLACED_ENTITY_BUFFER).toBeGreaterThan(0);
    expect(VEGETATION_BUFFER).toBeGreaterThan(0);
    expect(TOWN_STATION_SEARCH_RADIUS).toBeGreaterThan(0);
  });

  it("density constants are between 0 and 1 (per m² rates)", () => {
    expect(BASE_MOB_DENSITY).toBeGreaterThan(0);
    expect(BASE_MOB_DENSITY).toBeLessThan(1);
    expect(BASE_RESOURCE_DENSITY).toBeGreaterThan(0);
    expect(BASE_RESOURCE_DENSITY).toBeLessThan(1);
  });

  it("station spacing exceeds resource spacing exceeds (or equals) mob spacing — design intent", () => {
    // Larger entities want more space; the constants encode that hierarchy.
    expect(MIN_STATION_SPACING).toBeGreaterThanOrEqual(MIN_MOB_SPACING);
    expect(MIN_MOB_SPACING).toBeGreaterThanOrEqual(MIN_RESOURCE_SPACING);
  });
});

describe("getWorldRadius", () => {
  it("returns half of (worldSize × tileSize)", () => {
    expect(getWorldRadius({ terrain: { worldSize: 100, tileSize: 32 } })).toBe(
      1600,
    );
  });

  it("scales linearly with worldSize", () => {
    const small = getWorldRadius({
      terrain: { worldSize: 50, tileSize: 32 },
    });
    const big = getWorldRadius({
      terrain: { worldSize: 100, tileSize: 32 },
    });
    expect(big).toBe(small * 2);
  });

  it("scales linearly with tileSize", () => {
    const small = getWorldRadius({
      terrain: { worldSize: 100, tileSize: 16 },
    });
    const big = getWorldRadius({
      terrain: { worldSize: 100, tileSize: 32 },
    });
    expect(big).toBe(small * 2);
  });

  it("returns 0 when worldSize is 0", () => {
    expect(getWorldRadius({ terrain: { worldSize: 0, tileSize: 32 } })).toBe(0);
  });

  it("returns 0 when tileSize is 0", () => {
    expect(getWorldRadius({ terrain: { worldSize: 100, tileSize: 0 } })).toBe(
      0,
    );
  });
});

describe("getTownSafeRadius", () => {
  it("returns explicit safeZoneRadius when set", () => {
    expect(getTownSafeRadius({ safeZoneRadius: 42 })).toBe(42);
  });

  it("explicit radius wins even when size is also set", () => {
    expect(getTownSafeRadius({ safeZoneRadius: 99, size: "town" })).toBe(99);
  });

  it("returns 0 when safeZoneRadius is explicitly 0 (allows tiny zones)", () => {
    expect(getTownSafeRadius({ safeZoneRadius: 0 })).toBe(0);
  });

  it("falls back to size-based heuristic when safeZoneRadius is undefined", () => {
    expect(getTownSafeRadius({ size: "town" })).toBe(80);
    expect(getTownSafeRadius({ size: "village" })).toBe(50);
  });

  it("returns 30 default for unknown size", () => {
    expect(getTownSafeRadius({ size: "metropolis" })).toBe(30);
    expect(getTownSafeRadius({ size: "hamlet" })).toBe(30);
  });

  it("returns 30 default when neither field is set", () => {
    expect(getTownSafeRadius({})).toBe(30);
  });

  it("size hierarchy is ascending — town > village > default", () => {
    const townR = getTownSafeRadius({ size: "town" });
    const villageR = getTownSafeRadius({ size: "village" });
    const defaultR = getTownSafeRadius({});
    expect(townR).toBeGreaterThan(villageR);
    expect(villageR).toBeGreaterThan(defaultR);
  });
});
