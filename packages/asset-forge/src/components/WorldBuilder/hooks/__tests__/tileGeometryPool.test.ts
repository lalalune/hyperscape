/**
 * Phase 1.1 sixth carve — tile geometry pool extraction. Locks
 * in the LRU-like cap behavior + key-by-vertex-count semantics
 * the inlined version had inside `TileBasedTerrain.tsx`.
 */

import * as THREE from "three/webgpu";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_POOLED_PER_SIZE,
  acquirePooledGeometry,
  releaseToGeomPool,
  _getTileGeomPoolStateForTest,
  _resetTileGeomPoolForTest,
} from "../tileGeometryPool";

function makeGeom(vertexCount: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3),
  );
  return g;
}

describe("tileGeometryPool", () => {
  afterEach(() => {
    _resetTileGeomPoolForTest();
    vi.restoreAllMocks();
  });

  it("acquire returns undefined when pool is empty", () => {
    expect(acquirePooledGeometry(100)).toBeUndefined();
    expect(acquirePooledGeometry(0)).toBeUndefined();
  });

  it("release then acquire returns the same geometry", () => {
    const g = makeGeom(64);
    releaseToGeomPool(g);
    const acquired = acquirePooledGeometry(64);
    expect(acquired).toBe(g);
  });

  it("acquire returns undefined for a vertex count that wasn't released", () => {
    const g = makeGeom(64);
    releaseToGeomPool(g);
    expect(acquirePooledGeometry(128)).toBeUndefined();
  });

  it("pool keys are exact vertex counts — different counts go to different buckets", () => {
    const a = makeGeom(64);
    const b = makeGeom(128);
    releaseToGeomPool(a);
    releaseToGeomPool(b);
    const state = _getTileGeomPoolStateForTest();
    expect(state.get(64)).toBe(1);
    expect(state.get(128)).toBe(1);
  });

  it("LIFO ordering — most recently released geometry is acquired first", () => {
    const a = makeGeom(64);
    const b = makeGeom(64);
    releaseToGeomPool(a);
    releaseToGeomPool(b);
    expect(acquirePooledGeometry(64)).toBe(b);
    expect(acquirePooledGeometry(64)).toBe(a);
  });

  it("zero-vertex geometries are silently dropped — they are not pooled", () => {
    const g = new THREE.BufferGeometry();
    // No position attribute set, count = 0.
    releaseToGeomPool(g);
    const state = _getTileGeomPoolStateForTest();
    expect(state.size).toBe(0);
  });

  it("disposes geometry instead of caching when bucket is full", () => {
    // Fill the bucket to the cap.
    for (let i = 0; i < MAX_POOLED_PER_SIZE; i++) {
      releaseToGeomPool(makeGeom(64));
    }
    const overflow = makeGeom(64);
    const disposeSpy = vi.spyOn(overflow, "dispose");

    releaseToGeomPool(overflow);

    expect(disposeSpy).toHaveBeenCalledOnce();
    // Bucket capped at MAX_POOLED_PER_SIZE — the overflow geom
    // is NOT in the pool.
    const state = _getTileGeomPoolStateForTest();
    expect(state.get(64)).toBe(MAX_POOLED_PER_SIZE);
  });

  it("does NOT dispose geometries that fit in the bucket", () => {
    const g = makeGeom(64);
    const disposeSpy = vi.spyOn(g, "dispose");
    releaseToGeomPool(g);
    expect(disposeSpy).not.toHaveBeenCalled();
  });
});
