/**
 * `distance.ts` — engine-canonical Chebyshev distance helpers.
 *
 * The header comment in distance.ts is explicit: "All game systems
 * MUST use these functions for consistency." The choice of
 * Chebyshev (square range) over Euclidean (circular range)
 * matches the tile-based MMORPG genre's discrete mechanics —
 * a (3, 4) offset from origin is Chebyshev 4, Euclidean 5.
 * Drift between the chosen metric and per-system reimplementations
 * would silently break range checks and aggro radii.
 *
 * Note: `WorldBuilder/hooks/tileLodDecisions.ts` exports a
 * `tileChebyshevDistance(dx, dz)` with an explicit per-axis
 * signature for the tile streamer; that's a different shape
 * targeting a different consumer (per-frame hot path with
 * pre-decomposed deltas) but uses identical math. The two
 * helpers should never disagree on Chebyshev semantics; if
 * they do, this test catches the engine side.
 */

import { describe, expect, it } from "vitest";
import {
  chebyshevDistance,
  isWithinDistance,
  type Position2D,
} from "../distance";

const ORIGIN: Position2D = { x: 0, z: 0 };

describe("chebyshevDistance", () => {
  it("returns 0 for identical positions", () => {
    expect(chebyshevDistance(ORIGIN, ORIGIN)).toBe(0);
    expect(chebyshevDistance({ x: 5, z: -3 }, { x: 5, z: -3 })).toBe(0);
  });

  it("returns max(|dx|, |dz|) — the canonical Chebyshev formula", () => {
    expect(chebyshevDistance(ORIGIN, { x: 3, z: 0 })).toBe(3);
    expect(chebyshevDistance(ORIGIN, { x: 0, z: 4 })).toBe(4);
    expect(chebyshevDistance(ORIGIN, { x: 3, z: 4 })).toBe(4);
    // The header comment's example: (3,4) from origin → Chebyshev 4
    expect(chebyshevDistance(ORIGIN, { x: 3, z: 4 })).toBe(4);
  });

  it("is symmetric — d(a, b) === d(b, a)", () => {
    const a = { x: 7, z: -2 };
    const b = { x: -3, z: 5 };
    expect(chebyshevDistance(a, b)).toBe(chebyshevDistance(b, a));
  });

  it("treats negative coordinates correctly (uses |Δ|)", () => {
    expect(chebyshevDistance({ x: -5, z: 0 }, { x: 0, z: 0 })).toBe(5);
    expect(chebyshevDistance({ x: 0, z: 0 }, { x: -5, z: 0 })).toBe(5);
    expect(chebyshevDistance({ x: -3, z: -4 }, { x: 1, z: 1 })).toBe(5);
  });

  it("forms square rings — diagonal and cardinal at same distance are equal", () => {
    // Tiles (3, 0), (3, 3), (0, 3), (-3, 3) are all on the 3-ring.
    expect(chebyshevDistance(ORIGIN, { x: 3, z: 0 })).toBe(3);
    expect(chebyshevDistance(ORIGIN, { x: 3, z: 3 })).toBe(3);
    expect(chebyshevDistance(ORIGIN, { x: 2, z: 3 })).toBe(3);
    expect(chebyshevDistance(ORIGIN, { x: -3, z: 3 })).toBe(3);
  });

  it("differs from Euclidean — the documented (3,4)→4 case", () => {
    // Chebyshev 4 vs Euclidean 5 for offset (3,4). The whole
    // point of this util's existence.
    const dist = chebyshevDistance(ORIGIN, { x: 3, z: 4 });
    expect(dist).toBe(4);
    // Sanity: Euclidean would be 5
    const euclidean = Math.sqrt(3 * 3 + 4 * 4);
    expect(euclidean).toBe(5);
    expect(dist).not.toBe(euclidean);
  });
});

describe("isWithinDistance", () => {
  it("returns true at exact distance (inclusive boundary)", () => {
    expect(isWithinDistance(ORIGIN, { x: 5, z: 0 }, 5)).toBe(true);
    expect(isWithinDistance(ORIGIN, { x: 5, z: 5 }, 5)).toBe(true);
  });

  it("returns true inside the radius", () => {
    expect(isWithinDistance(ORIGIN, { x: 3, z: 0 }, 5)).toBe(true);
    expect(isWithinDistance(ORIGIN, { x: 0, z: 0 }, 5)).toBe(true);
  });

  it("returns false outside the radius", () => {
    expect(isWithinDistance(ORIGIN, { x: 6, z: 0 }, 5)).toBe(false);
    expect(isWithinDistance(ORIGIN, { x: 0, z: 6 }, 5)).toBe(false);
  });

  it("uses Chebyshev semantics — (3, 4) is within range 4 even though Euclidean is 5", () => {
    // The classic-MMORPG-style tile-based attack range is a square,
    // not a circle. (3,4) at range 4 attack: hits.
    expect(isWithinDistance(ORIGIN, { x: 3, z: 4 }, 4)).toBe(true);
    // Euclidean would say (3, 4) is OUT at range 4 (since 5 > 4).
    // Confirming Chebyshev semantics gives the opposite answer.
    expect(isWithinDistance(ORIGIN, { x: 3, z: 4 }, 4)).toBe(true);
  });

  it("returns true for distance 0 (same tile) at any positive range", () => {
    expect(isWithinDistance(ORIGIN, ORIGIN, 0)).toBe(true);
    expect(isWithinDistance(ORIGIN, ORIGIN, 1)).toBe(true);
  });

  it("returns false at range 0 unless on the same tile", () => {
    expect(isWithinDistance(ORIGIN, { x: 1, z: 0 }, 0)).toBe(false);
    expect(isWithinDistance(ORIGIN, { x: 0, z: 1 }, 0)).toBe(false);
    expect(isWithinDistance(ORIGIN, ORIGIN, 0)).toBe(true);
  });

  it("is symmetric — order of (a, b) doesn't matter", () => {
    expect(isWithinDistance({ x: 5, z: 0 }, ORIGIN, 5)).toBe(true);
    expect(isWithinDistance(ORIGIN, { x: 5, z: 0 }, 5)).toBe(true);
  });
});
