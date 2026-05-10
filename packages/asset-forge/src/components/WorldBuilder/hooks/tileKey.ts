/**
 * Tile coordinate ↔ key helpers. Pure functions used by the
 * tile streamer's hot path — keys go into `Map<string, ...>`
 * for tile lookup, and the packed-integer form is the cache
 * key inside `TileBasedTerrain.tsx`.
 *
 * Phase 1.1 fourteenth carve from `TileBasedTerrain.tsx`
 * (PLAN_AAA_MASTER_AUDIT debt #2 — split the 5,000+ line
 * monolith). Behavior preserved verbatim from the inlined
 * version: `(tx + 500) * 1000 + (tz + 500)` packing means the
 * supported range is roughly tile coordinates in [-500, 500]
 * — well within any reasonable worldSize (the studio defaults
 * to 100×100 tiles).
 */

/**
 * Format a tile coordinate pair as the canonical `"x_z"` key
 * string used throughout the tile streamer. Pure stringification —
 * no caching at this layer; the hook adds memoization on top.
 */
export function formatTileKey(tileX: number, tileZ: number): string {
  return `${tileX}_${tileZ}`;
}

/**
 * Pack a `(tileX, tileZ)` pair into a single integer for use
 * as a cache map key. The `+500` offset means negative coords
 * up to -500 are still positive in the packed form (small,
 * uniformly-distributed Map keys).
 *
 * Supported range: tile coordinates in roughly `[-500, 500]`.
 * Outside that range the packing collides (e.g. tile (-501, 0)
 * packs to -1 * 1000 + 500 = -500, identical to (-500, 0) ×
 * other coords). The studio's default world size is 100 tiles,
 * which is well within bounds.
 */
export function packTileKey(tileX: number, tileZ: number): number {
  return (tileX + 500) * 1000 + (tileZ + 500);
}

/**
 * Predicate: is the given tile coord pair inside the world
 * bounds (assumed square, [0, worldSize))? Pure — extracted
 * here so the streamer's bounds check is testable without
 * mounting the component.
 */
export function isTileInBounds(
  tileX: number,
  tileZ: number,
  worldSize: number,
): boolean {
  return tileX >= 0 && tileX < worldSize && tileZ >= 0 && tileZ < worldSize;
}
