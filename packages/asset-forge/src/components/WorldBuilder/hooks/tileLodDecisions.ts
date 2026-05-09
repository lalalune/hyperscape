/**
 * Pure predicates for the tile streamer's LOD + eviction
 * decisions. These are the "should this tile load full-res or
 * low-res?" / "is this tile far enough away to evict?" rules
 * that live inside the 200-line `updateTiles` callback in
 * `TileBasedTerrain.tsx`.
 *
 * Phase 1.1 thirteenth carve from `TileBasedTerrain.tsx`
 * (PLAN_AAA_MASTER_AUDIT debt #2 — split the 5,000+ line
 * monolith). Pure functions; no React, no scene refs. Lifting
 * them out lets us unit-test the rules in isolation — the
 * Chebyshev-vs-Manhattan distance choice, the eviction grace
 * threshold, and the LOD-resolution selection — instead of
 * driving them through a full mounted component.
 */

/**
 * Vertex resolution sentinel used by the tile streamer. The
 * streamer treats any resolution `<= TILE_LOD_LOW_RESOLUTION`
 * as "low-res LOD", and anything strictly greater as "full-res".
 * Imported as a constant rather than re-declared so the carve
 * stays in lockstep with `tileStreamingRadius.ts`.
 */
import { TILE_LOD_LOW_RESOLUTION } from "./tileStreamingRadius";

/**
 * Chebyshev distance — `max(|dx|, |dz|)`. The tile streamer
 * uses this (not Euclidean / Manhattan) because it produces
 * SQUARE rings around the camera tile that match the world's
 * grid structure. A radius of 3 with Chebyshev = exactly the
 * 7×7 tile patch around the camera; with Manhattan it'd be a
 * diamond, with Euclidean it'd be a circle clipped to grid.
 */
export function tileChebyshevDistance(dx: number, dz: number): number {
  return Math.max(Math.abs(dx), Math.abs(dz));
}

/**
 * Manhattan distance — `|dx| + |dz|`. Used by the tile
 * streamer's queue-priority sort: tiles closer (in
 * Manhattan distance) to the camera generate first. Manhattan
 * is the right choice here because it weights diagonal tiles
 * fairly against the cardinal directions, whereas Chebyshev
 * collapses 8 cells onto each "ring" — bad for ordering.
 */
export function tileManhattanDistance(dx: number, dz: number): number {
  return Math.abs(dx) + Math.abs(dz);
}

/**
 * Decide which vertex resolution a tile should load at given
 * its Chebyshev distance to the camera and the current full-
 * detail radius. Returns the requested resolution.
 *
 * - `dist <= fullDetailRadius` → `baseResolution` (typically 32)
 * - else → `TILE_LOD_LOW_RESOLUTION` (8) — the cheap LOD
 */
export function pickTileResolution(
  chebyshevDist: number,
  fullDetailRadius: number,
  baseResolution: number,
): number {
  return chebyshevDist <= fullDetailRadius
    ? baseResolution
    : TILE_LOD_LOW_RESOLUTION;
}

/**
 * Predicate: is the given resolution "full-res" (>
 * `TILE_LOD_LOW_RESOLUTION`) vs "low-res LOD"? The streamer
 * branches on this constantly (separate budgets for full-res
 * vs low-res tile generation).
 */
export function isFullResResolution(resolution: number): boolean {
  return resolution > TILE_LOD_LOW_RESOLUTION;
}

/** Grace period after a tile was last accessed before the
 * streamer is allowed to evict it. Prevents flicker if the
 * camera momentarily crosses an unload boundary. Tunable. */
export const TILE_EVICTION_GRACE_MS = 1000;

/**
 * Predicate: should this tile evict given (a) it's outside
 * the unload radius (Chebyshev) and (b) the last-accessed
 * grace period has elapsed? The streamer calls this for every
 * loaded tile per camera-tile-change frame.
 *
 * Studio mode never evicts (the streamer skips this whole
 * branch), so this helper assumes standalone-mode semantics.
 */
export function shouldEvictTile(
  dx: number,
  dz: number,
  unloadRadius: number,
  frameTime: number,
  lastAccessed: number,
): boolean {
  const absDx = Math.abs(dx);
  const absDz = Math.abs(dz);
  if (absDx <= unloadRadius && absDz <= unloadRadius) return false;
  return frameTime - lastAccessed > TILE_EVICTION_GRACE_MS;
}
