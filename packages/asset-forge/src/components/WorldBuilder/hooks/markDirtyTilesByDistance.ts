/**
 * Mark every loaded tile dirty and return their keys ordered by
 * distance to the camera tile. Used when a config change
 * (terrain, roads, mines) invalidates every tile but we want
 * to regenerate visible ones first so the player sees the new
 * terrain near them before the far horizon catches up.
 *
 * Phase 1.1 ninth carve from `TileBasedTerrain.tsx` (PLAN_AAA_MASTER_AUDIT
 * debt #2 — split the 5,000+ line monolith). Three identical
 * inline copies of this loop existed at the road, mine, and
 * terrain-config change sites — extracted to a single tested
 * helper so future tweaks (e.g. priority-by-screen-area instead
 * of flat camera-distance) only happen in one place.
 *
 * Mutates each tile's `dirty` flag in place. Pure on the
 * input Map (just iterates and reads coords) but does set
 * `tile.dirty = true` as a side effect — that's the whole
 * point of the call.
 */

/** Minimum tile shape this helper needs — coordinates plus the
 * dirty flag to set. Structural so callers don't have to expose
 * the full `TileData` type. */
export interface MarkableTile {
  /** Tile-grid x coordinate. */
  readonly tileX: number;
  /** Tile-grid z coordinate. */
  readonly tileZ: number;
  /** Set to true by this function. */
  dirty?: boolean;
}

/**
 * Set `dirty = true` on every tile in the map and return the
 * keys ordered by squared distance to `camTile`, ascending.
 * Empty input → empty array.
 */
export function markDirtyTilesByDistance<T extends MarkableTile>(
  tiles: ReadonlyMap<string, T>,
  camTile: { readonly tileX: number; readonly tileZ: number },
): string[] {
  const entries: Array<{ key: string; dist: number }> = [];
  for (const [key, tile] of tiles) {
    tile.dirty = true;
    const dx = tile.tileX - camTile.tileX;
    const dz = tile.tileZ - camTile.tileZ;
    entries.push({ key, dist: dx * dx + dz * dz });
  }
  entries.sort((a, b) => a.dist - b.dist);
  return entries.map((e) => e.key);
}
