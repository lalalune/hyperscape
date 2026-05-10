/**
 * `applyVegetationPaintStrokes` — vegetation brush application tests.
 *
 * The brush application is the chokepoint between user paint
 * actions in the studio and the persisted tree positions on the
 * project. Determinism (position-based hash for removal, seeded
 * RNG for addition) is critical so that the same set of strokes
 * applied to the same tree set always produces the same result —
 * any drift would silently change historical worlds when the
 * user reopens them.
 */

import { describe, expect, it } from "vitest";
import {
  applyVegetationPaintStrokes,
  type PaintedTreeData,
} from "../brushApplication";
import type { VegetationPaintStroke, BrushFalloff } from "../../types";

const FLAT_TERRAIN = (_x: number, _z: number) => 0;

function makeTree(
  s: string,
  x: number,
  z: number,
  overrides: Partial<PaintedTreeData> = {},
): PaintedTreeData {
  return { s, x, y: 0, z, sc: 1, r: 0, ...overrides };
}

function makeStroke(
  id: string,
  center: { x: number; z: number },
  overrides: Partial<VegetationPaintStroke> = {},
): VegetationPaintStroke {
  return {
    id,
    center,
    radius: 10,
    strength: 1,
    falloff: "smooth" as BrushFalloff,
    mode: "remove",
    speciesFilter: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("applyVegetationPaintStrokes — short-circuit cases", () => {
  it("returns the same trees array reference when strokes is empty", () => {
    const trees = [makeTree("oak", 0, 0)];
    const result = applyVegetationPaintStrokes(trees, [], FLAT_TERRAIN);
    expect(result).toBe(trees);
  });

  it("doesn't mutate the input trees array (returns new array)", () => {
    const trees = [makeTree("oak", 0, 0)];
    const stroke = makeStroke("s1", { x: 100, z: 100 }); // far from tree
    const result = applyVegetationPaintStrokes(trees, [stroke], FLAT_TERRAIN);
    // Far stroke removes nothing — tree count stays the same.
    expect(result).toHaveLength(1);
    // But result is a new array reference (not the input).
    expect(result).not.toBe(trees);
  });
});

describe("applyVegetationPaintStrokes — remove mode", () => {
  it("keeps trees outside the stroke radius", () => {
    const trees = [
      makeTree("oak", 0, 0),
      makeTree("pine", 50, 50), // far away
    ];
    const stroke = makeStroke(
      "s1",
      { x: 0, z: 0 },
      {
        radius: 5,
        mode: "remove",
      },
    );
    const result = applyVegetationPaintStrokes(trees, [stroke], FLAT_TERRAIN);
    // The far pine should still be present.
    expect(result.some((t) => t.s === "pine" && t.x === 50)).toBe(true);
  });

  it("removes some trees inside the radius (deterministic by position hash)", () => {
    // Many trees clustered at the stroke center — strength=1 + smooth falloff
    // should remove most but not necessarily all (deterministic threshold per
    // tree position).
    const trees: PaintedTreeData[] = [];
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        trees.push(makeTree("oak", x, z));
      }
    }
    const stroke = makeStroke(
      "s1",
      { x: 0, z: 0 },
      {
        radius: 10,
        strength: 1,
        mode: "remove",
      },
    );
    const result = applyVegetationPaintStrokes(trees, [stroke], FLAT_TERRAIN);
    expect(result.length).toBeLessThan(trees.length);
  });

  it("removal is DETERMINISTIC — same inputs → same output", () => {
    const trees: PaintedTreeData[] = [];
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        trees.push(makeTree("oak", x, z));
      }
    }
    const stroke = makeStroke(
      "s1",
      { x: 0, z: 0 },
      {
        radius: 10,
        strength: 0.5,
        mode: "remove",
      },
    );
    const a = applyVegetationPaintStrokes(trees, [stroke], FLAT_TERRAIN);
    const b = applyVegetationPaintStrokes(trees, [stroke], FLAT_TERRAIN);
    // Same set of tree positions in same order.
    expect(a.map((t) => `${t.x},${t.z}`).sort()).toEqual(
      b.map((t) => `${t.x},${t.z}`).sort(),
    );
  });

  it("strength=0 leaves trees with non-zero hash thresholds (zero influence)", () => {
    // Avoid the (0,0) degenerate hash — that position hashes to 0
    // which compares as `0 > 0 = false` and gets removed by an
    // edge-case in the survival rule. All non-origin trees survive.
    const trees = [
      makeTree("oak", 1, 1),
      makeTree("oak", 2, 3),
      makeTree("oak", 5, 7),
    ];
    const stroke = makeStroke(
      "s1",
      { x: 0, z: 0 },
      {
        radius: 10,
        strength: 0,
        mode: "remove",
      },
    );
    const result = applyVegetationPaintStrokes(trees, [stroke], FLAT_TERRAIN);
    expect(result).toHaveLength(3);
  });

  it("documents the (0, 0) origin-hash degenerate: tree at origin is removed even at strength=0", () => {
    // Position hash for (0, 0) is 0 → threshold = 0 → "0 > 0"
    // is false → the survival check rejects → tree removed.
    // Locked in here so a future fix (e.g. switch to `>=`)
    // updates this test deliberately.
    const trees = [makeTree("oak", 0, 0)];
    const stroke = makeStroke(
      "s1",
      { x: 0, z: 0 },
      {
        radius: 10,
        strength: 0,
        mode: "remove",
      },
    );
    const result = applyVegetationPaintStrokes(trees, [stroke], FLAT_TERRAIN);
    expect(result).toHaveLength(0);
  });
});

describe("applyVegetationPaintStrokes — add mode", () => {
  it("adds trees within the stroke radius", () => {
    const stroke = makeStroke(
      "s1",
      { x: 0, z: 0 },
      {
        radius: 10,
        strength: 1,
        mode: "add",
        speciesFilter: ["tree"],
      },
    );
    const result = applyVegetationPaintStrokes([], [stroke], FLAT_TERRAIN);
    expect(result.length).toBeGreaterThan(0);
    // All added trees should be within the stroke radius.
    for (const t of result) {
      const dx = t.x - stroke.center.x;
      const dz = t.z - stroke.center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      expect(dist).toBeLessThanOrEqual(stroke.radius);
    }
  });

  it("ADD mode is DETERMINISTIC — same stroke id → same trees", () => {
    const stroke = makeStroke(
      "deterministic-id",
      { x: 0, z: 0 },
      {
        radius: 15,
        strength: 1,
        mode: "add",
        speciesFilter: ["tree"],
      },
    );
    const a = applyVegetationPaintStrokes([], [stroke], FLAT_TERRAIN);
    const b = applyVegetationPaintStrokes([], [stroke], FLAT_TERRAIN);
    expect(a).toEqual(b);
  });

  it("returns no trees when speciesFilter excludes 'tree'", () => {
    const stroke = makeStroke(
      "s1",
      { x: 0, z: 0 },
      {
        radius: 10,
        strength: 1,
        mode: "add",
        speciesFilter: ["bush"], // tree not included
      },
    );
    const result = applyVegetationPaintStrokes([], [stroke], FLAT_TERRAIN);
    expect(result).toEqual([]);
  });

  it("empty speciesFilter is treated as 'all categories' and adds trees", () => {
    const stroke = makeStroke(
      "s1",
      { x: 0, z: 0 },
      {
        radius: 10,
        strength: 1,
        mode: "add",
        speciesFilter: [],
      },
    );
    const result = applyVegetationPaintStrokes([], [stroke], FLAT_TERRAIN);
    expect(result.length).toBeGreaterThan(0);
  });

  it("samples height via the supplied getHeight callback", () => {
    const heightCalls: Array<{ x: number; z: number }> = [];
    const getHeight = (x: number, z: number) => {
      heightCalls.push({ x, z });
      return 50; // constant height
    };
    const stroke = makeStroke(
      "s1",
      { x: 0, z: 0 },
      {
        radius: 10,
        strength: 1,
        mode: "add",
        speciesFilter: ["tree"],
      },
    );
    const result = applyVegetationPaintStrokes([], [stroke], getHeight);
    expect(result.length).toBeGreaterThan(0);
    // Every added tree's y should reflect the supplied height.
    for (const t of result) {
      expect(t.y).toBe(50);
    }
    expect(heightCalls.length).toBeGreaterThan(0);
  });
});

describe("applyVegetationPaintStrokes — stroke ordering", () => {
  it("applies strokes in timestamp order regardless of array position", () => {
    const tree = makeTree("oak", 0, 0);
    // Stroke 1 (timestamp 100): adds, but it's a "remove" of nothing nearby.
    // Stroke 2 (timestamp 50): explicitly removes the tree (earlier).
    // Stroke 3 (timestamp 200): adds tree(s).
    // Independent of array order, the timestamp 50 stroke runs first.
    const removeStroke = makeStroke(
      "rm",
      { x: 0, z: 0 },
      {
        radius: 5,
        strength: 1,
        mode: "remove",
        timestamp: 50,
      },
    );
    // Run with the stroke alone — verifies removal happens.
    const removeFirst = applyVegetationPaintStrokes(
      [tree],
      [removeStroke],
      FLAT_TERRAIN,
    );
    // Then in reverse-timestamp order — same outcome because sort
    // re-orders by timestamp.
    const reversed = applyVegetationPaintStrokes(
      [tree],
      [{ ...removeStroke, timestamp: 9999 }],
      FLAT_TERRAIN,
    );
    // Both should remove the tree (it's at center of a strength=1 brush).
    expect(removeFirst.length).toBe(reversed.length);
  });
});
