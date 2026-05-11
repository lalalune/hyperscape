/**
 * `compileBrushOverlays` — brush-stroke manifest compilation tests.
 *
 * Brush strokes (terrain sculpt / biome paint / vegetation paint /
 * material paint / tile collisions) are persisted to
 * brush-overlays.json so the runtime TerrainSystem can replay
 * them against the procgen baseline. Two subtle invariants:
 *
 *   1. Returns null when ALL five stroke arrays are empty (so
 *      the studio's save flow can skip the file entirely).
 *   2. Conditional emission: flattenTarget on sculpts and edges
 *      on tile collisions are omitted when unset (vs emitted as
 *      undefined, which JSON.stringify would skip but the test
 *      explicitly verifies).
 *
 * Plus a metadata block at the tail that counts each kind —
 * a contract the studio UI surfaces.
 */

import { describe, expect, it } from "vitest";
import { compileBrushOverlays } from "../manifestCompiler";
import { EMPTY_BRUSH_OVERLAYS } from "../../types";

describe("compileBrushOverlays — empty case", () => {
  it("returns null when all stroke arrays are empty", () => {
    expect(compileBrushOverlays(EMPTY_BRUSH_OVERLAYS)).toBeNull();
  });

  it("returns null when individual arrays are empty (no false positives)", () => {
    expect(
      compileBrushOverlays({
        ...EMPTY_BRUSH_OVERLAYS,
        terrainSculpts: [],
        biomePaints: [],
      }),
    ).toBeNull();
  });
});

describe("compileBrushOverlays — non-empty cases", () => {
  it("emits a versioned object when any stroke array is non-empty", () => {
    const result = compileBrushOverlays({
      ...EMPTY_BRUSH_OVERLAYS,
      terrainSculpts: [
        {
          id: "s1",
          center: { x: 0, z: 0 },
          radius: 10,
          strength: 1,
          falloff: "smooth" as never,
          mode: "raise" as never,
        },
      ] as never,
    });
    expect(result).not.toBeNull();
    expect((result as { version: number }).version).toBe(1);
  });

  it("emits flattenTarget on terrain sculpts ONLY when set", () => {
    const result = compileBrushOverlays({
      ...EMPTY_BRUSH_OVERLAYS,
      terrainSculpts: [
        {
          id: "with",
          center: { x: 0, z: 0 },
          radius: 10,
          strength: 1,
          falloff: "smooth" as never,
          mode: "flatten" as never,
          flattenTarget: 25,
        },
        {
          id: "without",
          center: { x: 0, z: 0 },
          radius: 10,
          strength: 1,
          falloff: "smooth" as never,
          mode: "raise" as never,
        },
      ] as never,
    });
    const sculpts = (
      result as { terrainSculpts: Array<Record<string, unknown>> }
    ).terrainSculpts;
    expect(sculpts[0].flattenTarget).toBe(25);
    expect(sculpts[1]).not.toHaveProperty("flattenTarget");
  });

  it("emits edges on tile collisions ONLY when set", () => {
    const result = compileBrushOverlays({
      ...EMPTY_BRUSH_OVERLAYS,
      tileCollisions: [
        {
          tileX: 0,
          tileZ: 0,
          blocked: true,
          edges: { north: true, south: false, east: false, west: false },
        },
        {
          tileX: 1,
          tileZ: 0,
          blocked: false,
        },
      ] as never,
    });
    const collisions = (
      result as { tileCollisions: Array<Record<string, unknown>> }
    ).tileCollisions;
    expect(collisions[0].edges).toBeDefined();
    expect(collisions[1]).not.toHaveProperty("edges");
  });

  it("preserves stroke shape: id / center / radius / strength / falloff", () => {
    const result = compileBrushOverlays({
      ...EMPTY_BRUSH_OVERLAYS,
      biomePaints: [
        {
          id: "p1",
          center: { x: 10, z: 20 },
          radius: 15,
          strength: 0.8,
          falloff: "linear" as never,
          targetBiome: "forest",
        },
      ] as never,
    });
    const paint = (result as { biomePaints: Array<Record<string, unknown>> })
      .biomePaints[0];
    expect(paint.id).toBe("p1");
    expect(paint.center).toEqual({ x: 10, z: 20 });
    expect(paint.radius).toBe(15);
    expect(paint.strength).toBe(0.8);
    expect(paint.falloff).toBe("linear");
    expect(paint.targetBiome).toBe("forest");
  });

  it("preserves vegetation paint mode + speciesFilter + timestamp", () => {
    const result = compileBrushOverlays({
      ...EMPTY_BRUSH_OVERLAYS,
      vegetationPaints: [
        {
          id: "v1",
          center: { x: 0, z: 0 },
          radius: 10,
          strength: 1,
          falloff: "smooth" as never,
          mode: "remove" as never,
          speciesFilter: ["oak", "pine"],
          timestamp: 1234567890,
        },
      ] as never,
    });
    const v = (result as { vegetationPaints: Array<Record<string, unknown>> })
      .vegetationPaints[0];
    expect(v.mode).toBe("remove");
    expect(v.speciesFilter).toEqual(["oak", "pine"]);
    expect(v.timestamp).toBe(1234567890);
  });

  it("strips center.y from sculpts (only x, z make it to disk)", () => {
    const result = compileBrushOverlays({
      ...EMPTY_BRUSH_OVERLAYS,
      terrainSculpts: [
        {
          id: "s1",
          center: { x: 5, y: 999, z: 7 } as never, // y should be dropped
          radius: 10,
          strength: 1,
          falloff: "smooth" as never,
          mode: "raise" as never,
        },
      ] as never,
    });
    const sculpt = (
      result as { terrainSculpts: Array<Record<string, unknown>> }
    ).terrainSculpts[0];
    expect(sculpt.center).toEqual({ x: 5, z: 7 });
  });
});

describe("compileBrushOverlays — metadata block", () => {
  it("counts each stroke kind correctly", () => {
    // Minimal valid shapes — manifestCompiler reads center.x etc.
    const sculpt = {
      id: "s",
      center: { x: 0, z: 0 },
      radius: 1,
      strength: 1,
      falloff: "smooth",
      mode: "raise",
    } as never;
    const paint = {
      id: "p",
      center: { x: 0, z: 0 },
      radius: 1,
      strength: 1,
      falloff: "smooth",
      targetBiome: "x",
    } as never;
    const veg = {
      id: "v",
      center: { x: 0, z: 0 },
      radius: 1,
      strength: 1,
      falloff: "smooth",
      mode: "add",
      speciesFilter: [],
      timestamp: 0,
    } as never;
    const collision = { tileX: 0, tileZ: 0, blocked: true } as never;
    const result = compileBrushOverlays({
      ...EMPTY_BRUSH_OVERLAYS,
      terrainSculpts: [sculpt, sculpt, sculpt],
      biomePaints: [paint],
      vegetationPaints: [veg, veg],
      materialPaints: [],
      tileCollisions: [collision, collision, collision, collision],
    });
    const meta = (result as { metadata: Record<string, number> }).metadata;
    expect(meta.sculptCount).toBe(3);
    expect(meta.paintCount).toBe(1);
    expect(meta.vegetationCount).toBe(2);
    expect(meta.materialPaintCount).toBe(0);
    expect(meta.collisionCount).toBe(4);
  });
});
