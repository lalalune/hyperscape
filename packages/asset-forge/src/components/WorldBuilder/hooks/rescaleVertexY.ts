/**
 * In-place Y-rescale of a `THREE.BufferGeometry`'s position
 * attribute. Multiplies every vertex's Y by `scale`, then
 * recomputes normals and bounds so downstream rendering /
 * raycasting stay correct.
 *
 * Phase 1.1 twelfth carve from `TileBasedTerrain.tsx`. Used
 * by the maxHeight-change fast-path: rescaling existing tile
 * geometry is much cheaper than tearing them down and
 * regenerating from scratch, especially across hundreds of
 * loaded tiles.
 *
 * Pure function — no React, no scene refs. The "Y at stride
 * index 1, step by 3" pattern is bug-prone (Z is at index 2,
 * not 1) so worth locking in via tests.
 */

import type * as THREE from "three/webgpu";

/**
 * Multiply every vertex's Y coordinate by `scale` in place,
 * then recompute normals + bounding sphere.
 *
 * Returns `true` when the rescale completed (geometry had a
 * `position` attribute), `false` when there was nothing to
 * rescale (no `position` attribute — caller should regenerate
 * the mesh from scratch).
 *
 * Caller is responsible for filtering out degenerate scales
 * (NaN, 0, ±Infinity) — this function will happily multiply by
 * any finite value, including 0 (which collapses the geometry
 * to the XZ plane).
 */
export function rescaleVertexY(
  geometry: THREE.BufferGeometry,
  scale: number,
): boolean {
  const posAttr = geometry.getAttribute("position");
  if (!posAttr) return false;
  const arr = posAttr.array as Float32Array;
  // Each vertex is (x, y, z) so Y starts at index 1 and we
  // step by 3.
  for (let i = 1; i < arr.length; i += 3) {
    arr[i] *= scale;
  }
  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return true;
}
