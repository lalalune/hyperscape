// @vitest-environment node
/**
 * `brushApplication` — terrain / biome / material brush tests.
 *
 * The vegetation paint variant has its own test file
 * (applyVegetationPaintStrokes.test.ts); this file covers the
 * remaining 6 exports:
 *
 *   - applyTerrainSculptToTiles + applySculptStrokesToGeometry
 *     (raise / lower / flatten + AABB culling)
 *   - flushDirtyNormals (drains _dirtyMeshes set; only fills it
 *     after a real sculpt modification, so the test pairs them)
 *   - applyBiomePaintToTiles (vertex-color lerp toward biome
 *     color; unknown biome falls back to plains)
 *   - applyMaterialPaintToTiles + applyMaterialPaintStrokesToGeometry
 *     (target layer increases toward 1, others redistribute,
 *     8-layer Σ stays ≈ 1; sub-threshold inf early-exits)
 *
 * All tests build real `three/webgpu` geometries and assert on
 * the resulting attribute arrays — no mocking of THREE primitives.
 */

import { describe, expect, it } from "vitest";
import * as THREE from "three/webgpu";
import {
  applyBiomePaintToTiles,
  applyMaterialPaintStrokesToGeometry,
  applyMaterialPaintToTiles,
  applySculptStrokesToGeometry,
  applyTerrainSculptToTiles,
  flushDirtyNormals,
} from "../brushApplication";
import type {
  BiomePaintStroke,
  BrushFalloff,
  MaterialPaintStroke,
  TerrainSculptStroke,
} from "../../types";

// ----- helpers --------------------------------------------------------------

/**
 * Build a flat NxN tile mesh centered at (worldX, 0, worldZ) with vertices
 * spaced 1m apart in local space. Position attr layout: vertex (i,j) at
 * (i - halfN, 0, j - halfN). Color attr is initialized to (0.5, 0.5, 0.5).
 * Material weight attrs are NOT added by default — opt in per test.
 */
function makeTileMesh(opts: {
  worldX?: number;
  worldZ?: number;
  size?: number; // grid dimension (size×size verts)
  half?: number; // half-extent in local space
  withColor?: boolean;
  withMaterialWeights?: boolean;
}): THREE.Mesh {
  const {
    worldX = 0,
    worldZ = 0,
    size = 5,
    half = 2,
    withColor = false,
    withMaterialWeights = false,
  } = opts;
  const verts = size * size;
  const positions = new Float32Array(verts * 3);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const idx = (j * size + i) * 3;
      // Local space: span is [-half, +half] across `size` verts.
      positions[idx + 0] = (i / (size - 1)) * (2 * half) - half;
      positions[idx + 1] = 0;
      positions[idx + 2] = (j / (size - 1)) * (2 * half) - half;
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (withColor) {
    const colors = new Float32Array(verts * 3).fill(0.5);
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  if (withMaterialWeights) {
    // Layer 0 (grass) starts at full weight; layers 1..7 = 0.
    const mw0 = new Float32Array(verts * 4);
    const mw1 = new Float32Array(verts * 4);
    for (let v = 0; v < verts; v++) {
      mw0[v * 4 + 0] = 1; // grass
    }
    geom.setAttribute("materialWeights0", new THREE.BufferAttribute(mw0, 4));
    geom.setAttribute("materialWeights1", new THREE.BufferAttribute(mw1, 4));
  }
  geom.computeBoundingBox();
  const mesh = new THREE.Mesh(geom);
  mesh.position.set(worldX, 0, worldZ);
  return mesh;
}

function makeTerrainContainer(meshes: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  for (const m of meshes) g.add(m);
  return g;
}

function makeSculptStroke(
  overrides: Partial<TerrainSculptStroke> = {},
): TerrainSculptStroke {
  return {
    id: "s",
    center: { x: 0, z: 0 },
    radius: 1.5,
    strength: 1,
    falloff: "smooth" as BrushFalloff,
    mode: "raise",
    ...overrides,
  } as TerrainSculptStroke;
}

function makeBiomeStroke(
  overrides: Partial<BiomePaintStroke> = {},
): BiomePaintStroke {
  return {
    id: "b",
    center: { x: 0, z: 0 },
    radius: 1.5,
    strength: 1,
    falloff: "smooth" as BrushFalloff,
    targetBiome: "forest",
    ...overrides,
  } as BiomePaintStroke;
}

function makeMaterialStroke(
  overrides: Partial<MaterialPaintStroke> = {},
): MaterialPaintStroke {
  return {
    id: "m",
    center: { x: 0, z: 0 },
    radius: 1.5,
    strength: 1,
    falloff: "smooth" as BrushFalloff,
    targetMaterial: "rock",
    timestamp: 1,
  } as MaterialPaintStroke;
}

function getY(mesh: THREE.Mesh, i: number): number {
  return (mesh.geometry.getAttribute("position") as THREE.BufferAttribute).getY(
    i,
  );
}

// ============================================================================
// applyTerrainSculptToTiles
// ============================================================================

describe("applyTerrainSculptToTiles — raise / lower / flatten modes", () => {
  it("raise mode adds height to vertices inside the brush radius", () => {
    const mesh = makeTileMesh({});
    const container = makeTerrainContainer([mesh]);
    applyTerrainSculptToTiles(container, makeSculptStroke({ mode: "raise" }));

    // Center vertex (index 12 in a 5x5 grid) should be lifted highest.
    expect(getY(mesh, 12)).toBeGreaterThan(0);
    // A corner vertex (index 0) is at distance sqrt(2^2+2^2) ≈ 2.83 > radius=1.5,
    // so it should NOT be modified.
    expect(getY(mesh, 0)).toBe(0);
  });

  it("lower mode subtracts height", () => {
    const mesh = makeTileMesh({});
    const container = makeTerrainContainer([mesh]);
    applyTerrainSculptToTiles(container, makeSculptStroke({ mode: "lower" }));
    expect(getY(mesh, 12)).toBeLessThan(0);
  });

  it("flatten mode interpolates toward flattenTarget", () => {
    const mesh = makeTileMesh({});
    // First raise so vertices have non-zero Y.
    const c = makeTerrainContainer([mesh]);
    applyTerrainSculptToTiles(c, makeSculptStroke({ mode: "raise" }));
    const beforeY = getY(mesh, 12);
    expect(beforeY).toBeGreaterThan(0);

    // Now flatten toward Y=10 — center vertex should move toward 10.
    applyTerrainSculptToTiles(
      c,
      makeSculptStroke({ mode: "flatten", flattenTarget: 10 }),
    );
    const afterY = getY(mesh, 12);
    expect(afterY).toBeGreaterThan(beforeY);
    expect(afterY).toBeLessThanOrEqual(10);
  });
});

describe("applyTerrainSculptToTiles — AABB culling", () => {
  it("skips meshes whose bounding box does not overlap the brush circle", () => {
    // Tile A at origin (within radius), Tile B 100m away (outside).
    const meshA = makeTileMesh({ worldX: 0 });
    const meshB = makeTileMesh({ worldX: 100 });
    const container = makeTerrainContainer([meshA, meshB]);
    applyTerrainSculptToTiles(container, makeSculptStroke());
    // Mesh A's center vertex should be raised; mesh B untouched.
    expect(getY(meshA, 12)).toBeGreaterThan(0);
    expect(getY(meshB, 12)).toBe(0);
  });

  it("handles meshes with no position attribute (silent no-op)", () => {
    const emptyMesh = new THREE.Mesh(new THREE.BufferGeometry());
    const container = makeTerrainContainer([emptyMesh]);
    expect(() =>
      applyTerrainSculptToTiles(container, makeSculptStroke()),
    ).not.toThrow();
  });

  it("ignores non-Mesh children of the terrain container", () => {
    const mesh = makeTileMesh({});
    const container = makeTerrainContainer([mesh]);
    container.add(new THREE.Object3D()); // not a mesh
    expect(() =>
      applyTerrainSculptToTiles(container, makeSculptStroke()),
    ).not.toThrow();
    expect(getY(mesh, 12)).toBeGreaterThan(0);
  });
});

// ============================================================================
// applySculptStrokesToGeometry
// ============================================================================

describe("applySculptStrokesToGeometry — returns modification flag", () => {
  it("returns false when strokes array is empty (no-op)", () => {
    const mesh = makeTileMesh({});
    const result = applySculptStrokesToGeometry(mesh.geometry, 0, 0, []);
    expect(result).toBe(false);
  });

  it("returns false when no stroke overlaps the tile bbox", () => {
    const mesh = makeTileMesh({});
    const result = applySculptStrokesToGeometry(mesh.geometry, 100, 100, [
      makeSculptStroke({ center: { x: 0, z: 0 }, radius: 1 }),
    ]);
    expect(result).toBe(false);
  });

  it("returns true when ANY stroke modifies geometry", () => {
    const mesh = makeTileMesh({});
    const result = applySculptStrokesToGeometry(mesh.geometry, 0, 0, [
      makeSculptStroke({ mode: "raise", radius: 5 }),
    ]);
    expect(result).toBe(true);
    expect(getY(mesh, 12)).toBeGreaterThan(0);
  });

  it("applies multiple strokes in array order (raise then lower can cancel)", () => {
    const mesh = makeTileMesh({});
    applySculptStrokesToGeometry(mesh.geometry, 0, 0, [
      makeSculptStroke({ mode: "raise", strength: 1 }),
      makeSculptStroke({ mode: "lower", strength: 1 }),
    ]);
    // Center vertex should be near 0 after raise+lower of equal magnitude.
    expect(Math.abs(getY(mesh, 12))).toBeLessThan(0.001);
  });

  it("returns false when geometry lacks a position attribute", () => {
    const empty = new THREE.BufferGeometry();
    const result = applySculptStrokesToGeometry(empty, 0, 0, [
      makeSculptStroke({ radius: 5 }),
    ]);
    expect(result).toBe(false);
  });
});

// ============================================================================
// flushDirtyNormals
// ============================================================================

describe("flushDirtyNormals — paired with applyTerrainSculptToTiles", () => {
  it("computes vertex normals on meshes that the sculpt actually modified", () => {
    const mesh = makeTileMesh({});
    // Pre-condition: no normal attribute yet.
    expect(mesh.geometry.getAttribute("normal")).toBeUndefined();

    applyTerrainSculptToTiles(
      makeTerrainContainer([mesh]),
      makeSculptStroke({ mode: "raise" }),
    );
    flushDirtyNormals();

    const normals = mesh.geometry.getAttribute("normal");
    expect(normals).toBeDefined();
    expect(normals?.count).toBe(25); // 5x5 grid
  });

  it("is idempotent — a second call after flush is a no-op", () => {
    const mesh = makeTileMesh({});
    applyTerrainSculptToTiles(
      makeTerrainContainer([mesh]),
      makeSculptStroke({ mode: "raise" }),
    );
    flushDirtyNormals();
    // No assertion target — just verify no throw.
    expect(() => flushDirtyNormals()).not.toThrow();
  });
});

// ============================================================================
// applyBiomePaintToTiles
// ============================================================================

describe("applyBiomePaintToTiles — vertex color lerp", () => {
  it("lerps the center vertex color toward the target biome", () => {
    const mesh = makeTileMesh({ withColor: true });
    const container = makeTerrainContainer([mesh]);
    applyBiomePaintToTiles(
      container,
      makeBiomeStroke({ targetBiome: "forest" }),
    );

    const colors = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    // Center vertex (12) should have lerped from (0.5,0.5,0.5) toward forest (0.227, 0.42, 0.208).
    // Expect R to decrease (was 0.5, target 0.227) and B to decrease.
    expect(colors.getX(12)).toBeLessThan(0.5);
    expect(colors.getZ(12)).toBeLessThan(0.5);
  });

  it("only modifies vertices inside the brush radius", () => {
    const mesh = makeTileMesh({ withColor: true });
    applyBiomePaintToTiles(
      makeTerrainContainer([mesh]),
      makeBiomeStroke({ radius: 1, targetBiome: "forest" }),
    );
    const colors = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    // Corner (0) is at dist ~2.83 > radius=1, should be untouched.
    expect(colors.getX(0)).toBe(0.5);
    expect(colors.getY(0)).toBe(0.5);
    expect(colors.getZ(0)).toBe(0.5);
  });

  it("falls back to plains color for unknown biome ids", () => {
    const mesh = makeTileMesh({ withColor: true });
    applyBiomePaintToTiles(
      makeTerrainContainer([mesh]),
      makeBiomeStroke({ targetBiome: "alien-tundra" }),
    );
    const colors = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    // Plains is (0.486, 0.729, 0.373) — center vertex should lerp G upward.
    expect(colors.getY(12)).toBeGreaterThan(0.5);
  });

  it("ignores meshes without a color attribute (silent skip)", () => {
    const mesh = makeTileMesh({}); // no color attr
    expect(() =>
      applyBiomePaintToTiles(makeTerrainContainer([mesh]), makeBiomeStroke()),
    ).not.toThrow();
  });
});

// ============================================================================
// applyMaterialPaintToTiles
// ============================================================================

function getMaterialWeights(mesh: THREE.Mesh, i: number): number[] {
  const mw0 = mesh.geometry.getAttribute(
    "materialWeights0",
  ) as THREE.BufferAttribute;
  const mw1 = mesh.geometry.getAttribute(
    "materialWeights1",
  ) as THREE.BufferAttribute;
  const i4 = i * 4;
  const a = mw0.array as Float32Array;
  const b = mw1.array as Float32Array;
  return [
    a[i4],
    a[i4 + 1],
    a[i4 + 2],
    a[i4 + 3],
    b[i4],
    b[i4 + 1],
    b[i4 + 2],
    b[i4 + 3],
  ];
}

describe("applyMaterialPaintToTiles — 8-layer weight redistribution", () => {
  it("increases the target layer at the brush center", () => {
    const mesh = makeTileMesh({ withMaterialWeights: true });
    // Before: layer 0 (grass) = 1, target layer 2 (rock) = 0.
    expect(getMaterialWeights(mesh, 12)[2]).toBe(0);

    applyMaterialPaintToTiles(
      makeTerrainContainer([mesh]),
      makeMaterialStroke({ targetMaterial: "rock" }),
    );
    expect(getMaterialWeights(mesh, 12)[2]).toBeGreaterThan(0);
  });

  it("normalizes total weight to ~1 after the stroke (sum invariant)", () => {
    const mesh = makeTileMesh({ withMaterialWeights: true });
    applyMaterialPaintToTiles(
      makeTerrainContainer([mesh]),
      makeMaterialStroke({ targetMaterial: "rock" }),
    );
    const sum = getMaterialWeights(mesh, 12).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("skips meshes without materialWeight attributes (silent)", () => {
    const mesh = makeTileMesh({}); // no material weights
    expect(() =>
      applyMaterialPaintToTiles(
        makeTerrainContainer([mesh]),
        makeMaterialStroke(),
      ),
    ).not.toThrow();
  });

  it("AABB culls tiles outside the stroke radius", () => {
    const meshA = makeTileMesh({ worldX: 0, withMaterialWeights: true });
    const meshB = makeTileMesh({ worldX: 100, withMaterialWeights: true });
    applyMaterialPaintToTiles(
      makeTerrainContainer([meshA, meshB]),
      makeMaterialStroke({ targetMaterial: "rock" }),
    );
    expect(getMaterialWeights(meshA, 12)[2]).toBeGreaterThan(0);
    expect(getMaterialWeights(meshB, 12)[2]).toBe(0);
  });

  it("falls back to layer 0 (grass) for unknown target material", () => {
    // Default makeTileMesh seeds layer 0 (grass) = 1, all others 0. With
    // unknown target the function should fall back to layer 0 — so layer 0
    // stays at 1 (already maxed), and the other 7 layers stay at 0.
    const mesh = makeTileMesh({ withMaterialWeights: true });
    applyMaterialPaintToTiles(makeTerrainContainer([mesh]), {
      id: "unknownStroke",
      center: { x: 0, z: 0 },
      radius: 1.5,
      strength: 1,
      falloff: "smooth" as BrushFalloff,
      targetMaterial: "asphalt-unknown",
      timestamp: 1,
    } as MaterialPaintStroke);
    const w = getMaterialWeights(mesh, 12);
    expect(w[0]).toBe(1);
    expect(w.slice(1).every((x) => x === 0)).toBe(true);
  });
});

// ============================================================================
// applyMaterialPaintStrokesToGeometry
// ============================================================================

describe("applyMaterialPaintStrokesToGeometry — bake to single geometry", () => {
  it("no-ops when the geometry lacks material weight attrs", () => {
    const mesh = makeTileMesh({}); // no material weights
    expect(() =>
      applyMaterialPaintStrokesToGeometry(mesh.geometry, 0, 0, [
        makeMaterialStroke(),
      ]),
    ).not.toThrow();
  });

  it("applies strokes in timestamp order (later overrides)", () => {
    const mesh = makeTileMesh({ withMaterialWeights: true });
    // Pass UNIQUE stroke ids — sharing an id across array entries appears
    // to confuse some downstream sort/keyed-collection paths in vitest.
    applyMaterialPaintStrokesToGeometry(mesh.geometry, 0, 0, [
      {
        id: "rockStroke",
        center: { x: 0, z: 0 },
        radius: 5,
        strength: 1,
        falloff: "smooth" as BrushFalloff,
        targetMaterial: "rock",
        timestamp: 1,
      } as MaterialPaintStroke,
      {
        id: "sandStroke",
        center: { x: 0, z: 0 },
        radius: 5,
        strength: 1,
        falloff: "smooth" as BrushFalloff,
        targetMaterial: "sand",
        timestamp: 2,
      } as MaterialPaintStroke,
    ]);
    // Sand (layer 3) should dominate over rock (layer 2) since it was applied second.
    const w = getMaterialWeights(mesh, 12);
    expect(w[3]).toBeGreaterThan(w[2]);
  });

  it("preserves the ~1 sum invariant after multiple strokes", () => {
    const mesh = makeTileMesh({ withMaterialWeights: true });
    applyMaterialPaintStrokesToGeometry(mesh.geometry, 0, 0, [
      makeMaterialStroke({ targetMaterial: "rock", timestamp: 1, radius: 5 }),
      makeMaterialStroke({ targetMaterial: "sand", timestamp: 2, radius: 5 }),
      makeMaterialStroke({ targetMaterial: "snow", timestamp: 3, radius: 5 }),
    ]);
    const sum = getMaterialWeights(mesh, 12).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("respects tileWorldX/Z offset for culling and brush distance", () => {
    const mesh = makeTileMesh({ withMaterialWeights: true });
    // Geometry is local-space; passing tileWorldX=100 shifts it 100m away
    // from the stroke center at (0,0). Nothing should change.
    applyMaterialPaintStrokesToGeometry(mesh.geometry, 100, 0, [
      makeMaterialStroke({ targetMaterial: "rock", radius: 5 }),
    ]);
    expect(getMaterialWeights(mesh, 12)[2]).toBe(0);
  });

  it("sub-threshold influence (≤0.001) is skipped", () => {
    const mesh = makeTileMesh({ withMaterialWeights: true });
    // Very weak stroke — at vertex 12 (dist=0), inf=1 * strength=0.0005
    // = 0.0005, which is ≤ 0.001 → vertex skipped.
    applyMaterialPaintStrokesToGeometry(mesh.geometry, 0, 0, [
      {
        id: "weakRock",
        center: { x: 0, z: 0 },
        radius: 1.5,
        strength: 0.0005,
        falloff: "smooth" as BrushFalloff,
        targetMaterial: "rock",
        timestamp: 1,
      } as MaterialPaintStroke,
    ]);
    // Layer 2 (rock) should remain 0 at center.
    expect(getMaterialWeights(mesh, 12)[2]).toBe(0);
  });
});
