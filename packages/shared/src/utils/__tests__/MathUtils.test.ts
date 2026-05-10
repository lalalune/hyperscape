/**
 * MathUtils — core spatial math + clamp/random helpers.
 *
 * "Used by multiple systems throughout the engine" per the
 * header comment. Direct tests prevent silent drift in the
 * Euclidean (3D and 2D) distance + clamp behavior shared
 * across combat, pathfinding, AI, range-checking systems.
 *
 * Note: this is the engine's *Euclidean* distance pair —
 * different from the Chebyshev distance in
 * `packages/shared/src/utils/distance.ts` which is the
 * tile-based MMORPG square-range metric. Game-system
 * range checks should use Chebyshev; this Euclidean version
 * is for raw spatial math (rendering, projectile travel,
 * smooth interpolation distances).
 */

import { describe, expect, it, vi } from "vitest";
import {
  calculateDistance,
  calculateDistance2D,
  clamp,
  dist2D,
  num,
} from "../MathUtils";

const ORIGIN = { x: 0, y: 0, z: 0 };

describe("calculateDistance — 3D Euclidean", () => {
  it("returns 0 for identical positions", () => {
    expect(calculateDistance(ORIGIN, ORIGIN)).toBe(0);
  });

  it("returns the Euclidean magnitude on each axis", () => {
    expect(calculateDistance(ORIGIN, { x: 3, y: 0, z: 0 })).toBe(3);
    expect(calculateDistance(ORIGIN, { x: 0, y: 4, z: 0 })).toBe(4);
    expect(calculateDistance(ORIGIN, { x: 0, y: 0, z: 5 })).toBe(5);
  });

  it("computes diagonal correctly (3-4-5 triangle in XZ)", () => {
    expect(calculateDistance(ORIGIN, { x: 3, y: 0, z: 4 })).toBe(5);
  });

  it("includes Y axis (3D) — distinct from calculateDistance2D", () => {
    const r = calculateDistance(ORIGIN, { x: 3, y: 12, z: 4 });
    // 3-4-5 triangle in XZ (=5) + Y leg of 12 → 5-12-13 triangle.
    expect(r).toBe(13);
  });

  it("is symmetric", () => {
    const a = { x: 7, y: 2, z: -1 };
    const b = { x: -3, y: 5, z: 4 };
    expect(calculateDistance(a, b)).toBe(calculateDistance(b, a));
  });

  it("handles negative coordinates", () => {
    expect(calculateDistance({ x: -3, y: 0, z: 0 }, ORIGIN)).toBe(3);
  });
});

describe("calculateDistance2D — XZ Euclidean (Y ignored)", () => {
  it("ignores Y axis entirely", () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 3, y: 1000, z: 4 };
    // Y delta of 1000 should not affect the result.
    expect(calculateDistance2D(a, b)).toBe(5);
  });

  it("returns 0 when X and Z match (regardless of Y)", () => {
    expect(
      calculateDistance2D({ x: 5, y: 0, z: 5 }, { x: 5, y: 99, z: 5 }),
    ).toBe(0);
  });

  it("matches dist2D output for the same XZ coordinates", () => {
    const a = { x: 1, y: 99, z: 2 };
    const b = { x: 4, y: -10, z: 6 };
    expect(calculateDistance2D(a, b)).toBe(dist2D(a.x, a.z, b.x, b.z));
  });
});

describe("dist2D — raw-coord variant (no allocation)", () => {
  it("returns 0 for identical coords", () => {
    expect(dist2D(0, 0, 0, 0)).toBe(0);
    expect(dist2D(5, 5, 5, 5)).toBe(0);
  });

  it("computes the same Euclidean distance as calculateDistance2D", () => {
    expect(dist2D(0, 0, 3, 4)).toBe(5);
    expect(dist2D(0, 0, -3, -4)).toBe(5);
  });

  it("is symmetric in argument order", () => {
    expect(dist2D(1, 2, 3, 4)).toBe(dist2D(3, 4, 1, 2));
  });
});

describe("clamp", () => {
  it("returns the value when within [min, max]", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("clamps below min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(-100, 0, 10)).toBe(0);
  });

  it("clamps above max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(1000, 0, 10)).toBe(10);
  });

  it("handles negative ranges", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-100, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });

  it("collapses to min when min === max", () => {
    expect(clamp(5, 7, 7)).toBe(7);
    expect(clamp(10, 7, 7)).toBe(7);
  });

  it("returns NaN when value is NaN", () => {
    // Math.max/min preserve NaN; clamp should too.
    expect(Number.isNaN(clamp(NaN, 0, 10))).toBe(true);
  });
});

describe("num — random in range with decimal precision", () => {
  it("returns an integer (dp=0) within [min, max]", () => {
    // Use a deterministic Math.random spy so the test isn't flaky.
    const spy = vi.spyOn(Math, "random");
    spy.mockReturnValue(0.5);
    // (0.5 * (10 - 0) + 0) = 5, toFixed(0) = "5" → 5.
    expect(num(0, 10)).toBe(5);
    spy.mockReturnValue(0);
    expect(num(0, 10)).toBe(0);
    spy.mockReturnValue(0.999999);
    expect(num(0, 10)).toBe(10);
    spy.mockRestore();
  });

  it("respects decimal precision (dp=2)", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.7345);
    const result = num(0, 1, 2);
    expect(result).toBe(0.73);
    spy.mockRestore();
  });

  it("respects decimal precision (dp=1)", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.564);
    const result = num(100, 200, 1);
    // (0.564 * 100 + 100) = 156.4
    expect(result).toBe(156.4);
    spy.mockRestore();
  });

  it("min=max returns the constant value", () => {
    expect(num(5, 5)).toBe(5);
    expect(num(5, 5, 3)).toBe(5);
  });

  it("returns a value that ALWAYS lies within [min, max] across many random samples", () => {
    for (let i = 0; i < 200; i++) {
      const v = num(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(20);
    }
  });
});
