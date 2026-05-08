/**
 * Tile geometry pool — reuse `THREE.BufferGeometry` instances
 * across tile load/unload cycles instead of disposing them on
 * eviction and recloning templates on creation. Pools by exact
 * vertex count: a 32×32 tile mesh and a 16×16 tile mesh use
 * different pools.
 *
 * Phase 1.1 sixth carve from `TileBasedTerrain.tsx` (`PLAN_AAA_MASTER_AUDIT.md`
 * debt #2 — split the 5,000+ line monolith). Extracted because:
 *   1. Pure module-scope state (a `Map<number, BufferGeometry[]>`),
 *      no React or scene refs.
 *   2. Two tiny functions with zero TileBasedTerrain dependencies.
 *   3. Hot path on camera pan — touches a pooled allocation per
 *      tile load and per tile unload — worth keeping testable.
 *
 * Behavior preserved verbatim from the inlined version: same
 * cap (`MAX_POOLED_PER_SIZE`), same key (`vertex count`), same
 * disposal-when-full fallback.
 */

import type * as THREE from "three/webgpu";

/** Module-scope pool keyed by vertex count. Lives until the
 * module unloads (i.e. the entire app lifetime). */
const _tileGeomPool = new Map<number, THREE.BufferGeometry[]>();

/**
 * Maximum geometries cached per vertex-count bucket. With four
 * concurrent LOD-resolution buckets and ~16 visible tiles each,
 * 32 covers the working set with headroom for camera flicks
 * without growing the pool unbounded.
 */
export const MAX_POOLED_PER_SIZE = 32;

/**
 * Pull a previously-released geometry of the requested vertex
 * count, or `undefined` if none cached. Caller is responsible
 * for resetting attributes/buffers before reuse — the pool
 * doesn't clear them (saves work when the new tile happens to
 * have similar data).
 */
export function acquirePooledGeometry(
  vertexCount: number,
): THREE.BufferGeometry | undefined {
  const pool = _tileGeomPool.get(vertexCount);
  return pool && pool.length > 0 ? pool.pop() : undefined;
}

/**
 * Return a geometry to the pool for later reuse. Pools by
 * `attributes.position.count` (zero-vertex geometries are
 * silently dropped — they shouldn't reach here). When a bucket
 * is full, the geometry is `dispose()`d normally; the pool
 * never grows past `MAX_POOLED_PER_SIZE` per bucket.
 */
export function releaseToGeomPool(geom: THREE.BufferGeometry): void {
  const count = geom.attributes.position?.count ?? 0;
  if (count === 0) return;
  let pool = _tileGeomPool.get(count);
  if (!pool) {
    pool = [];
    _tileGeomPool.set(count, pool);
  }
  if (pool.length < MAX_POOLED_PER_SIZE) {
    pool.push(geom);
  } else {
    geom.dispose();
  }
}

/**
 * Test-only: clear the pool. Disposes every cached geometry
 * before clearing so the test harness doesn't leak GPU
 * buffers across test cases. Production code should never
 * call this — the pool is meant to live for the app lifetime.
 */
export function _resetTileGeomPoolForTest(): void {
  for (const pool of _tileGeomPool.values()) {
    for (const g of pool) g.dispose();
  }
  _tileGeomPool.clear();
}

/**
 * Test-only: report current bucket sizes. Returns a fresh
 * snapshot — mutating it has no effect on the pool.
 */
export function _getTileGeomPoolStateForTest(): ReadonlyMap<number, number> {
  const snapshot = new Map<number, number>();
  for (const [k, v] of _tileGeomPool.entries()) snapshot.set(k, v.length);
  return snapshot;
}
