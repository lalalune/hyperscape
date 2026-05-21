/**
 * poissonDisc — Poisson disc sampling tests.
 *
 * Pins the core spacing + bounds invariants the shared
 * `poissonDiscSample` provides to `useZoneAutoGen` /
 * `useZoneProcgen` and any future caller. A regression here
 * silently produces clustered or out-of-bounds points
 * downstream.
 */

import { describe, expect, it } from "vitest";

import { poissonDiscSample, type PoissonBounds } from "../poissonDisc";

/**
 * Tiny mulberry32-style PRNG so tests are deterministic. The
 * algorithm itself is well-known; we only need a stable
 * sequence to assert behavior without leaking
 * implementation-detail seed values into the test.
 */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function squareBounds(half: number): PoissonBounds {
  return { minX: -half, maxX: half, minZ: -half, maxZ: half };
}

function squareDist(
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

describe("poissonDiscSample — bounds + spacing invariants", () => {
  it("returns empty when bounds collapse to zero area", () => {
    const out = poissonDiscSample(
      { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
      1,
      10,
      seededRng(1),
      () => true,
    );
    // gridW / gridH collapse to 0 → early return.
    expect(out).toEqual([]);
  });

  it("respects maxPoints cap", () => {
    const out = poissonDiscSample(
      squareBounds(100),
      2,
      5,
      seededRng(42),
      () => true,
    );
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it("every returned point sits inside the AABB", () => {
    const bounds = squareBounds(50);
    const out = poissonDiscSample(bounds, 5, 100, seededRng(7), () => true);
    for (const p of out) {
      expect(p.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(p.x).toBeLessThanOrEqual(bounds.maxX);
      expect(p.z).toBeGreaterThanOrEqual(bounds.minZ);
      expect(p.z).toBeLessThanOrEqual(bounds.maxZ);
    }
  });

  it("no two returned points are closer than minSpacing", () => {
    const minSpacing = 4;
    const out = poissonDiscSample(
      squareBounds(50),
      minSpacing,
      200,
      seededRng(99),
      () => true,
    );
    // Compare each pair (n²/2). The sample is bounded so n is small.
    const min2 = minSpacing * minSpacing;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        expect(squareDist(out[i], out[j])).toBeGreaterThanOrEqual(min2);
      }
    }
  });
});

describe("poissonDiscSample — boundary test", () => {
  it("inBounds=false everywhere → empty result", () => {
    const out = poissonDiscSample(
      squareBounds(50),
      4,
      100,
      seededRng(1),
      () => false,
    );
    expect(out).toEqual([]);
  });

  it("inBounds restricts points to a circular region", () => {
    // Boundary: only accept points within radius 20 of origin.
    const radius = 20;
    const out = poissonDiscSample(
      squareBounds(50),
      3,
      100,
      seededRng(11),
      (x, z) => x * x + z * z <= radius * radius,
    );
    expect(out.length).toBeGreaterThan(0);
    for (const p of out) {
      expect(p.x * p.x + p.z * p.z).toBeLessThanOrEqual(radius * radius);
    }
  });
});

describe("poissonDiscSample — determinism", () => {
  it("identical rng seed → identical point sets", () => {
    const a = poissonDiscSample(
      squareBounds(30),
      3,
      50,
      seededRng(123),
      () => true,
    );
    const b = poissonDiscSample(
      squareBounds(30),
      3,
      50,
      seededRng(123),
      () => true,
    );
    expect(a).toEqual(b);
  });

  it("different rng seeds → different point sets (one comparison)", () => {
    const a = poissonDiscSample(
      squareBounds(30),
      3,
      50,
      seededRng(1),
      () => true,
    );
    const b = poissonDiscSample(
      squareBounds(30),
      3,
      50,
      seededRng(2),
      () => true,
    );
    // Different seeds can produce same FIRST point if both random
    // draws land in the same cell — but the full sequence almost
    // certainly diverges. Test the array as a whole.
    expect(a).not.toEqual(b);
  });
});

describe("poissonDiscSample — density vs spacing", () => {
  it("tighter spacing yields more points in the same bounds", () => {
    const bounds = squareBounds(100);
    const tight = poissonDiscSample(bounds, 4, 1000, seededRng(7), () => true);
    const loose = poissonDiscSample(bounds, 12, 1000, seededRng(7), () => true);
    expect(tight.length).toBeGreaterThan(loose.length);
  });

  it("seeds at least one point when bounds allow any valid placement", () => {
    const out = poissonDiscSample(
      squareBounds(50),
      4,
      10,
      seededRng(0),
      () => true,
    );
    expect(out.length).toBeGreaterThan(0);
  });
});
