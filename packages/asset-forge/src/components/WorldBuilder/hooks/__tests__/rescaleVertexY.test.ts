/**
 * Phase 1.1 twelfth carve — locks in the Y-rescale stride
 * pattern. The "Y is at index 1, step 3" loop is easy to break
 * (off-by-one rescales Z instead of Y); tests catch that
 * before it reaches a tile.
 */

import * as THREE from "three/webgpu";
import { describe, expect, it, vi } from "vitest";
import { rescaleVertexY } from "../rescaleVertexY";

function makeGeomWithVerts(
  verts: ReadonlyArray<readonly [number, number, number]>,
) {
  const arr = new Float32Array(verts.length * 3);
  for (let i = 0; i < verts.length; i++) {
    arr[i * 3] = verts[i][0];
    arr[i * 3 + 1] = verts[i][1];
    arr[i * 3 + 2] = verts[i][2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  return g;
}

describe("rescaleVertexY", () => {
  it("returns false when geometry has no position attribute", () => {
    const empty = new THREE.BufferGeometry();
    expect(rescaleVertexY(empty, 2)).toBe(false);
  });

  it("multiplies every Y coordinate by scale, leaves X and Z untouched", () => {
    const g = makeGeomWithVerts([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    rescaleVertexY(g, 10);
    const arr = g.getAttribute("position").array as Float32Array;
    expect(Array.from(arr)).toEqual([1, 20, 3, 4, 50, 6, 7, 80, 9]);
  });

  it("returns true when rescale completes", () => {
    const g = makeGeomWithVerts([[0, 1, 0]]);
    expect(rescaleVertexY(g, 5)).toBe(true);
  });

  it("marks position attribute needing update (bumps version)", () => {
    const g = makeGeomWithVerts([[0, 1, 0]]);
    const posAttr = g.getAttribute("position");
    const versionBefore = posAttr.version;
    rescaleVertexY(g, 1);
    // `needsUpdate = true` translates to version++ in three.js;
    // there's no readable `needsUpdate` getter.
    expect(posAttr.version).toBe(versionBefore + 1);
  });

  it("recomputes vertex normals", () => {
    const g = makeGeomWithVerts([
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
    ]);
    const spy = vi.spyOn(g, "computeVertexNormals");
    rescaleVertexY(g, 1);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("recomputes bounding sphere", () => {
    const g = makeGeomWithVerts([[0, 1, 0]]);
    const spy = vi.spyOn(g, "computeBoundingSphere");
    rescaleVertexY(g, 1);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("scale of 1 is a no-op on values", () => {
    const g = makeGeomWithVerts([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    rescaleVertexY(g, 1);
    const arr = g.getAttribute("position").array as Float32Array;
    expect(Array.from(arr)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("collapses to XZ plane when scale = 0", () => {
    const g = makeGeomWithVerts([
      [1, 100, 3],
      [4, 200, 6],
    ]);
    rescaleVertexY(g, 0);
    const arr = g.getAttribute("position").array as Float32Array;
    expect(arr[1]).toBe(0);
    expect(arr[4]).toBe(0);
    // X and Z untouched.
    expect(arr[0]).toBe(1);
    expect(arr[2]).toBe(3);
    expect(arr[3]).toBe(4);
    expect(arr[5]).toBe(6);
  });

  it("negative scale flips the geometry vertically", () => {
    const g = makeGeomWithVerts([
      [0, 5, 0],
      [0, -3, 0],
    ]);
    rescaleVertexY(g, -1);
    const arr = g.getAttribute("position").array as Float32Array;
    expect(arr[1]).toBe(-5);
    expect(arr[4]).toBe(3);
  });
});
