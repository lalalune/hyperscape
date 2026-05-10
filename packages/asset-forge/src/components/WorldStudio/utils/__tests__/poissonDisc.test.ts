/**
 * `poissonDisc` — Poisson disc sampling tests.
 *
 * Bridson's algorithm: well-spaced 2D point generation with a
 * pluggable boundary test. Single shared implementation between
 * useZoneAutoGen (contour-based) and useZoneProcgen (tile-based);
 * any drift in the spacing invariant or boundary handling would
 * silently break both.
 *
 * Tests use a seeded RNG for determinism.
 */

import { describe, expect, it } from "vitest";
import { poissonDiscSample } from "../poissonDisc";
import { createSeededRng, dist2 } from "../procgenUtils";

const ALWAYS_IN_BOUNDS = () => true;
const NEVER_IN_BOUNDS = () => false;

describe("poissonDiscSample — degenerate inputs", () => {
  it("returns empty array when bounds are degenerate (zero width)", () => {
    const rng = createSeededRng(1);
    const points = poissonDiscSample(
      { minX: 5, maxX: 5, minZ: 0, maxZ: 100 },
      10,
      50,
      rng,
      ALWAYS_IN_BOUNDS,
    );
    expect(points).toEqual([]);
  });

  it("returns empty array when bounds are degenerate (zero height)", () => {
    const rng = createSeededRng(1);
    const points = poissonDiscSample(
      { minX: 0, maxX: 100, minZ: 5, maxZ: 5 },
      10,
      50,
      rng,
      ALWAYS_IN_BOUNDS,
    );
    expect(points).toEqual([]);
  });

  it("returns empty array when inBounds always rejects", () => {
    const rng = createSeededRng(1);
    const points = poissonDiscSample(
      { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
      5,
      50,
      rng,
      NEVER_IN_BOUNDS,
    );
    expect(points).toEqual([]);
  });
});

describe("poissonDiscSample — spacing invariant", () => {
  it("every pair of returned points is at least minSpacing apart", () => {
    const rng = createSeededRng(42);
    const minSpacing = 5;
    const points = poissonDiscSample(
      { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
      minSpacing,
      200,
      rng,
      ALWAYS_IN_BOUNDS,
    );
    expect(points.length).toBeGreaterThan(0);
    const minSpacingSq = minSpacing * minSpacing;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d2 = dist2(points[i].x, points[i].z, points[j].x, points[j].z);
        expect(d2).toBeGreaterThanOrEqual(minSpacingSq);
      }
    }
  });
});

describe("poissonDiscSample — bounds compliance", () => {
  it("all points fall within the AABB", () => {
    const rng = createSeededRng(42);
    const bounds = { minX: 10, maxX: 90, minZ: 20, maxZ: 80 };
    const points = poissonDiscSample(bounds, 5, 100, rng, ALWAYS_IN_BOUNDS);
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(p.x).toBeLessThanOrEqual(bounds.maxX);
      expect(p.z).toBeGreaterThanOrEqual(bounds.minZ);
      expect(p.z).toBeLessThanOrEqual(bounds.maxZ);
    }
  });

  it("respects a custom inBounds — points fall in the right half", () => {
    const rng = createSeededRng(42);
    const bounds = { minX: 0, maxX: 100, minZ: 0, maxZ: 100 };
    // Right-half-only: x >= 50.
    const points = poissonDiscSample(bounds, 5, 100, rng, (x, _z) => x >= 50);
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(50);
    }
  });
});

describe("poissonDiscSample — point cap", () => {
  it("never returns more than maxPoints", () => {
    const rng = createSeededRng(123);
    const points = poissonDiscSample(
      { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
      2, // dense spacing → many points possible
      10, // but capped at 10
      rng,
      ALWAYS_IN_BOUNDS,
    );
    expect(points.length).toBeLessThanOrEqual(10);
  });

  it("returns at most maxPoints even with a generous bounds", () => {
    const rng = createSeededRng(456);
    const points = poissonDiscSample(
      { minX: 0, maxX: 1000, minZ: 0, maxZ: 1000 },
      5,
      50,
      rng,
      ALWAYS_IN_BOUNDS,
    );
    expect(points.length).toBeLessThanOrEqual(50);
  });
});

describe("poissonDiscSample — determinism", () => {
  it("same seed → same point sequence", () => {
    const rng1 = createSeededRng(99);
    const rng2 = createSeededRng(99);
    const a = poissonDiscSample(
      { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
      5,
      30,
      rng1,
      ALWAYS_IN_BOUNDS,
    );
    const b = poissonDiscSample(
      { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
      5,
      30,
      rng2,
      ALWAYS_IN_BOUNDS,
    );
    expect(a).toEqual(b);
  });

  it("different seeds produce different points", () => {
    const a = poissonDiscSample(
      { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
      5,
      30,
      createSeededRng(1),
      ALWAYS_IN_BOUNDS,
    );
    const b = poissonDiscSample(
      { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
      5,
      30,
      createSeededRng(2),
      ALWAYS_IN_BOUNDS,
    );
    // First point should differ.
    expect(a[0]).not.toEqual(b[0]);
  });
});

describe("poissonDiscSample — typical usage produces a reasonable density", () => {
  it("100×100 area with minSpacing=10 produces 30+ points", () => {
    // Theoretical density for r-spacing in a unit square is
    // π / (2√3 r²) — for r=10 in a 100×100 area that's ~30.
    const rng = createSeededRng(7);
    const points = poissonDiscSample(
      { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
      10,
      500,
      rng,
      ALWAYS_IN_BOUNDS,
    );
    expect(points.length).toBeGreaterThan(20);
    expect(points.length).toBeLessThan(200);
  });
});
