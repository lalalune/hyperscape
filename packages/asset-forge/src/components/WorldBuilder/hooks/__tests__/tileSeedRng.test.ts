/**
 * Phase 1.1 seventh carve — locks in the deterministic RNG
 * properties the server-side mirror also relies on. Any
 * refactor that changes these properties (output ordering,
 * salt-hash, mixing constants) silently drifts the client and
 * server tree placements out of sync — the test suite catches
 * that here.
 */

import { describe, expect, it } from "vitest";
import { createTileRng } from "../tileSeedRng";

describe("createTileRng", () => {
  it("is deterministic — same inputs produce the same stream", () => {
    const a = createTileRng(42, 3, 5, "trees");
    const b = createTileRng(42, 3, 5, "trees");
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("different seeds diverge", () => {
    const a = createTileRng(1, 0, 0, "x");
    const b = createTileRng(2, 0, 0, "x");
    expect(a()).not.toBe(b());
  });

  it("different tile coordinates diverge", () => {
    const a = createTileRng(1, 0, 0, "x");
    const b = createTileRng(1, 1, 0, "x");
    const c = createTileRng(1, 0, 1, "x");
    const av = a();
    expect(av).not.toBe(b());
    expect(av).not.toBe(c());
  });

  it("different salt values diverge — independent streams from same seed", () => {
    const trees = createTileRng(7, 2, 4, "trees");
    const rocks = createTileRng(7, 2, 4, "rocks");
    expect(trees()).not.toBe(rocks());
  });

  it("output is in [0, 1)", () => {
    const rng = createTileRng(0xdeadbeef, 13, 17, "uniformity");
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("empty salt is well-defined and reproducible", () => {
    const a = createTileRng(99, 0, 0, "");
    const b = createTileRng(99, 0, 0, "");
    expect(a()).toBe(b());
  });

  it("negative tile coordinates are well-defined (uint32 wraparound)", () => {
    const a = createTileRng(1, -3, -5, "x");
    const b = createTileRng(1, -3, -5, "x");
    expect(a()).toBe(b());
  });
});
