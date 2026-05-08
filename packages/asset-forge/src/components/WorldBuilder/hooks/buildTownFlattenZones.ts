/**
 * Per-tile town flatten-zone builder. For each town that overlaps
 * the tile's AABB (with a 1.4× outer-radius pad to catch zones
 * straddling the tile edge), emit a `TownFlattenZone` with the
 * town's center height and inner/outer blend radii. Tiles that
 * touch no towns return `undefined` so callers can skip the
 * flattening pass entirely.
 *
 * Phase 1.1 eighth carve from `TileBasedTerrain.tsx` (PLAN_AAA_MASTER_AUDIT
 * debt #2 — split the 5,000+ line monolith). Pure function: AABB
 * rejection + height query + zone construction. No React, no
 * scene refs.
 */

import type { TerrainQuerier, TownFlattenZone } from "../terrainHelpers";

/** Minimal town shape this builder needs — just position and
 * safeZoneRadius. Structural so callers don't need to import
 * the full `TerrainSceneRefs.runtimeTowns` type. */
export interface FlattenInputTown {
  readonly position: { readonly x: number; readonly z: number };
  readonly safeZoneRadius: number;
}

/**
 * Build the list of flatten zones that overlap a given tile.
 * Empty input or no overlap returns `undefined` so the hot
 * tile-generation loop can branch on a single nullish check
 * instead of iterating an empty array.
 *
 * Inner blend radius is `safeZoneRadius * 0.85` (the flat
 * platform where buildings sit); outer is `safeZoneRadius * 1.4`
 * (the smooth ramp back to natural terrain). Center height is
 * sampled from the supplied `querier` once per overlapping town
 * — this is the single point at which we lock in "the town's
 * floor altitude."
 */
export function buildTownFlattenZones(
  towns: ReadonlyArray<FlattenInputTown>,
  tileX: number,
  tileZ: number,
  tileSize: number,
  wcOffset: number,
  querier: TerrainQuerier,
): TownFlattenZone[] | undefined {
  if (towns.length === 0) return undefined;
  const tileMinX = tileX * tileSize - wcOffset;
  const tileMaxX = tileMinX + tileSize;
  const tileMinZ = tileZ * tileSize - wcOffset;
  const tileMaxZ = tileMinZ + tileSize;
  const zones: TownFlattenZone[] = [];
  for (const t of towns) {
    const r = t.safeZoneRadius;
    const outerR = r * 1.4;
    if (
      t.position.x + outerR < tileMinX ||
      t.position.x - outerR > tileMaxX ||
      t.position.z + outerR < tileMinZ ||
      t.position.z - outerR > tileMaxZ
    )
      continue;
    zones.push({
      x: t.position.x,
      z: t.position.z,
      centerHeight: querier(t.position.x, t.position.z).height,
      innerRadius: r * 0.85,
      outerRadius: outerR,
    });
  }
  return zones.length > 0 ? zones : undefined;
}
