/**
 * `geometryBuilders` — shared overlay geometry creation tests.
 *
 * Consolidates duplicated geometry helpers from 3+ overlay hooks
 * (useAudioZoneOverlay, useWaterBodyEditor, useAreaBoundaryOverlay).
 * Each helper produces a raw THREE.BufferGeometry with specific
 * vertex layout assumptions — tests pin down the layout so a
 * future refactor can't silently shift vertex order or count.
 */

import * as THREE from "three/webgpu";
import { describe, expect, it } from "vitest";
import {
  createCircleLineGeometry,
  createPolygonFillGeometry,
  createPolygonLineGeometry,
} from "../geometryBuilders";

// createCanvasLabel is intentionally NOT tested here — jsdom's
// canvas implementation doesn't ship a 2D context, so the
// canvas-based texture builder isn't exercisable in unit tests.
// It's integration-tested via the studio's overlay-render flow.

function readPositions(geom: THREE.BufferGeometry): Float32Array {
  return geom.getAttribute("position").array as Float32Array;
}

describe("createPolygonLineGeometry", () => {
  it("returns an empty geometry for < 2 points", () => {
    const geom = createPolygonLineGeometry([{ x: 0, z: 0 }], 0);
    expect(geom.getAttribute("position")).toBeUndefined();
  });

  it("closed=true closes the loop by appending the first point", () => {
    const pts = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
    ];
    const geom = createPolygonLineGeometry(pts, 5, true);
    const positions = readPositions(geom);
    // 4 vertices (3 + 1 closing) × 3 components
    expect(positions.length).toBe(12);
    // Last vertex equals first
    expect(positions[9]).toBe(positions[0]); // x
    expect(positions[10]).toBe(positions[1]); // y
    expect(positions[11]).toBe(positions[2]); // z
  });

  it("closed=false does NOT append the first point", () => {
    const pts = [
      { x: 0, z: 0 },
      { x: 10, z: 10 },
    ];
    const geom = createPolygonLineGeometry(pts, 0, false);
    const positions = readPositions(geom);
    expect(positions.length).toBe(6); // 2 vertices × 3 components
  });

  it("writes y consistently across all vertices", () => {
    const pts = [
      { x: 0, z: 0 },
      { x: 1, z: 1 },
      { x: 2, z: 2 },
    ];
    const Y = 42;
    const positions = readPositions(createPolygonLineGeometry(pts, Y, true));
    // y is at stride index 1 (x, y, z per vertex)
    for (let i = 1; i < positions.length; i += 3) {
      expect(positions[i]).toBe(Y);
    }
  });

  it("preserves XZ coordinate order (x at stride 0, z at stride 2)", () => {
    const pts = [
      { x: 1, z: 2 },
      { x: 3, z: 4 },
    ];
    const positions = readPositions(createPolygonLineGeometry(pts, 0, false));
    expect(positions[0]).toBe(1); // x of point 0
    expect(positions[2]).toBe(2); // z of point 0
    expect(positions[3]).toBe(3); // x of point 1
    expect(positions[5]).toBe(4); // z of point 1
  });

  it("with only 2 points and closed=true, allocates the closing slot but skips writing it (line, not loop)", () => {
    // Subtle: the function reserves space for the closing vertex
    // (count = closed ? points.length + 1 : points.length = 3 vertices),
    // but only writes the closing-loop body when points.length > 2.
    // So the buffer is 9 floats but the last 3 are zero-initialized.
    const pts = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
    ];
    const positions = readPositions(createPolygonLineGeometry(pts, 5, true));
    expect(positions.length).toBe(9);
    // First two vertices are written; the third (closing slot) stays zero.
    expect(positions[0]).toBe(0);
    expect(positions[3]).toBe(10);
    expect(positions[6]).toBe(0); // unwritten — Float32Array defaults to 0
  });
});

describe("createCircleLineGeometry", () => {
  it("produces segments+1 vertices (closed loop)", () => {
    const geom = createCircleLineGeometry(0, 0, 0, 10, 16);
    const positions = readPositions(geom);
    expect(positions.length).toBe((16 + 1) * 3);
  });

  it("default 48 segments produces 49 vertices", () => {
    const geom = createCircleLineGeometry(0, 0, 0, 10);
    expect(readPositions(geom).length).toBe((48 + 1) * 3);
  });

  it("first and last vertices coincide (loop is closed)", () => {
    const geom = createCircleLineGeometry(0, 0, 0, 10, 32);
    const p = readPositions(geom);
    expect(p[p.length - 3]).toBeCloseTo(p[0]); // x
    expect(p[p.length - 2]).toBeCloseTo(p[1]); // y
    expect(p[p.length - 1]).toBeCloseTo(p[2]); // z
  });

  it("all vertices lie on the circle (distance = radius)", () => {
    const cx = 5;
    const cz = 7;
    const radius = 12;
    const geom = createCircleLineGeometry(cx, cz, 0, radius, 64);
    const p = readPositions(geom);
    for (let i = 0; i < p.length; i += 3) {
      const dx = p[i] - cx;
      const dz = p[i + 2] - cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      expect(dist).toBeCloseTo(radius, 5);
    }
  });

  it("writes y to every vertex", () => {
    const Y = 99;
    const p = readPositions(createCircleLineGeometry(0, 0, Y, 5, 8));
    for (let i = 1; i < p.length; i += 3) {
      expect(p[i]).toBe(Y);
    }
  });

  it("respects center offset (circle centered at cx, cz, not origin)", () => {
    const cx = 100;
    const cz = 200;
    // Use many segments + skip the closing duplicate so the
    // centroid average isn't biased by the doubled first vertex.
    const segments = 64;
    const p = readPositions(createCircleLineGeometry(cx, cz, 0, 5, segments));
    let sumX = 0;
    let sumZ = 0;
    // Skip the final (closing) vertex to avoid double-counting.
    const uniqueVerts = segments;
    for (let i = 0; i < uniqueVerts * 3; i += 3) {
      sumX += p[i];
      sumZ += p[i + 2];
    }
    expect(sumX / uniqueVerts).toBeCloseTo(cx, 1);
    expect(sumZ / uniqueVerts).toBeCloseTo(cz, 1);
  });
});

describe("createPolygonFillGeometry", () => {
  it("returns null for < 3 points", () => {
    expect(createPolygonFillGeometry([], 0)).toBeNull();
    expect(createPolygonFillGeometry([{ x: 0, z: 0 }], 0)).toBeNull();
    expect(
      createPolygonFillGeometry(
        [
          { x: 0, z: 0 },
          { x: 1, z: 1 },
        ],
        0,
      ),
    ).toBeNull();
  });

  it("returns a BufferGeometry for ≥ 3 points", () => {
    const geom = createPolygonFillGeometry(
      [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
      ],
      5,
    );
    expect(geom).not.toBeNull();
    expect(geom!.getAttribute("position")).toBeDefined();
  });

  it("vertices lie at the target y height after XZ rotation", () => {
    // ShapeGeometry builds in XY plane, then rotateX(-π/2) puts it in XZ.
    const Y = 25;
    const geom = createPolygonFillGeometry(
      [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
        { x: 0, z: 10 },
      ],
      Y,
    )!;
    const positions = readPositions(geom);
    // After rotation + translation, all vertices should be at the
    // target Y (within float tolerance).
    for (let i = 1; i < positions.length; i += 3) {
      expect(positions[i]).toBeCloseTo(Y, 4);
    }
  });
});
