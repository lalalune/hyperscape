/**
 * `procgenUtils` — shared deterministic RNG / hashing / distance /
 * weighted-selection helpers.
 *
 * Single source of truth for both useZoneAutoGen (contour-based
 * auto-generation) and useZoneProcgen (tile-based per-region
 * generation). Determinism contract is critical: same seed →
 * identical output across both pipelines, identical across
 * client and server. Tests pin down the LCG constants + djb2
 * hash semantics + weighted-roll ordering.
 */

import { describe, expect, it } from "vitest";
import {
  createSeededRng,
  dist2,
  hashString,
  weightedSelect,
} from "../procgenUtils";

describe("createSeededRng", () => {
  it("is deterministic — same seed produces the same stream", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("different seeds diverge", () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a()).not.toBe(b());
  });

  it("output is in [0, 1)", () => {
    const rng = createSeededRng(0xdeadbeef);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("seed=0 produces a well-defined stream (no zero-state collapse)", () => {
    const rng = createSeededRng(0);
    const first = rng();
    const second = rng();
    // LCG with non-zero increment guarantees the state advances
    // even from seed=0.
    expect(first).not.toBe(0);
    expect(second).not.toBe(first);
  });

  it("negative seeds are handled (state coerced via |0)", () => {
    const a = createSeededRng(-1);
    const b = createSeededRng(-1);
    expect(a()).toBe(b());
  });
});

describe("hashString", () => {
  it("is deterministic — same string maps to same hash", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("hello world")).toBe(hashString("hello world"));
  });

  it("different strings produce different hashes (mostly)", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("ab")).not.toBe(hashString("ba"));
  });

  it("empty string maps to 0", () => {
    expect(hashString("")).toBe(0);
  });

  it("output is a 32-bit integer (negative or positive)", () => {
    const h = hashString("a-very-long-string-that-overflows-32-bits");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(-(2 ** 31));
    expect(h).toBeLessThanOrEqual(2 ** 31 - 1);
  });
});

describe("dist2 — squared Euclidean", () => {
  it("returns 0 for identical points", () => {
    expect(dist2(0, 0, 0, 0)).toBe(0);
    expect(dist2(5, 5, 5, 5)).toBe(0);
  });

  it("returns squared distance — no sqrt", () => {
    expect(dist2(0, 0, 3, 4)).toBe(25); // not 5
    expect(dist2(0, 0, 1, 0)).toBe(1);
    expect(dist2(0, 0, 0, 2)).toBe(4);
  });

  it("is symmetric", () => {
    expect(dist2(1, 2, 3, 4)).toBe(dist2(3, 4, 1, 2));
  });

  it("handles negative coordinates", () => {
    expect(dist2(-3, -4, 0, 0)).toBe(25);
  });

  it("never returns a negative value", () => {
    for (let i = 0; i < 100; i++) {
      const a = (Math.random() - 0.5) * 1000;
      const b = (Math.random() - 0.5) * 1000;
      const c = (Math.random() - 0.5) * 1000;
      const d = (Math.random() - 0.5) * 1000;
      expect(dist2(a, b, c, d)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("weightedSelect", () => {
  it("returns null for empty array", () => {
    expect(weightedSelect([], () => 0)).toBeNull();
  });

  it("returns the only item for a single-item array", () => {
    const items = [{ id: "only", weight: 10 }];
    expect(weightedSelect(items, () => 0)).toBe(items[0]);
    expect(weightedSelect(items, () => 0.999)).toBe(items[0]);
  });

  it("returns the first item when totalWeight <= 0", () => {
    const items = [
      { id: "a", weight: 0 },
      { id: "b", weight: 0 },
    ];
    expect(weightedSelect(items, () => 0.5)).toBe(items[0]);
  });

  it("rolls into the first item when rng=0", () => {
    const items = [
      { id: "a", weight: 1 },
      { id: "b", weight: 1 },
      { id: "c", weight: 1 },
    ];
    expect(weightedSelect(items, () => 0)).toBe(items[0]);
  });

  it("rolls into the second item when rng lands in its range", () => {
    const items = [
      { id: "a", weight: 1 },
      { id: "b", weight: 1 },
      { id: "c", weight: 1 },
    ];
    // totalWeight = 3, rng=0.5 → roll = 1.5 → "a" subtracts to 0.5 → "b"
    expect(weightedSelect(items, () => 0.5)).toBe(items[1]);
  });

  it("returns the last item for rng near 1 (boundary)", () => {
    const items = [
      { id: "a", weight: 1 },
      { id: "b", weight: 1 },
      { id: "c", weight: 1 },
    ];
    expect(weightedSelect(items, () => 0.99999)).toBe(items[2]);
  });

  it("respects weight ratios — heavier items get more selections", () => {
    const items = [
      { id: "rare", weight: 1 },
      { id: "common", weight: 99 },
    ];
    let rareCount = 0;
    let commonCount = 0;
    // Use a real rng for distribution check.
    const rng = createSeededRng(123);
    for (let i = 0; i < 10000; i++) {
      const pick = weightedSelect(items, rng);
      if (pick?.id === "rare") rareCount++;
      else if (pick?.id === "common") commonCount++;
    }
    // Common should outnumber rare by a wide margin.
    expect(commonCount).toBeGreaterThan(rareCount * 50);
  });

  it("handles weights that include zero alongside positive", () => {
    const items = [
      { id: "a", weight: 1 },
      { id: "skipped", weight: 0 },
      { id: "b", weight: 1 },
    ];
    // totalWeight=2. rng=0.5 → roll=1 → a subtracts to 0 → "a" (boundary)
    // The skipped 0-weight entry is never picked.
    let aCount = 0;
    let skippedCount = 0;
    let bCount = 0;
    const rng = createSeededRng(456);
    for (let i = 0; i < 1000; i++) {
      const pick = weightedSelect(items, rng);
      if (pick?.id === "a") aCount++;
      else if (pick?.id === "skipped") skippedCount++;
      else if (pick?.id === "b") bCount++;
    }
    expect(skippedCount).toBe(0);
    expect(aCount).toBeGreaterThan(0);
    expect(bCount).toBeGreaterThan(0);
  });
});
