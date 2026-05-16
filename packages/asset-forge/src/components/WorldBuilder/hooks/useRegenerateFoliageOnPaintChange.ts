/**
 * useRegenerateFoliageOnPaintChange — re-schedule foliage tile
 * generation whenever the user paints / erases foliage strokes,
 * the tile size changes, or the water threshold changes.
 *
 * Phase 1.1 twelfth carve from `TileBasedTerrain.tsx`. The
 * effect's lifecycle is owned here; the parent retains the refs
 * the hook reads.
 *
 * Why it lives here:
 *
 * Foliage placement is per-tile; once a tile is scheduled with
 * one stroke set, subsequent strokes don't retroactively update
 * already-placed instances. Clearing and re-scheduling every
 * loaded tile is the simplest way to reflect a fresh stroke
 * set without per-instance bookkeeping.
 *
 * The hook re-fires on three deps:
 *   - `foliagePaintCount` — the number of strokes; a change
 *     means at least one stroke was added or removed.
 *   - `tileSize` — affects per-tile bounds the manager needs.
 *   - `waterThreshold` — the height-based mask the placement
 *     uses to skip below-water vertices.
 *
 * Note on completeness: stroke metadata changes that don't
 * affect the count (e.g. moving a brush size slider mid-stroke)
 * don't trigger a re-fire; for that the parent re-renders the
 * brushOverlays prop which the manager reads through
 * `brushOverlaysRef.current` at scheduleTile time. So the count
 * is a sufficient trigger.
 */

import { useEffect, type RefObject } from "react";

import type {
  FoliageManager,
  FoliageGenerateOptions,
} from "../FoliageRenderer";

/**
 * Minimal tile-coord shape the hook reads from the parent's
 * `tilesRef`. Structural subset of `TileData` so the hook
 * doesn't import the parent's internal type.
 */
export interface FoliageTileSeed {
  tileX: number;
  tileZ: number;
}

/**
 * The querier shape the FoliageManager consumes. Re-exported
 * here only for the hook's call signature — the parent uses the
 * full `TerrainQuerier` from `./TerrainQuerier`.
 */
export type FoliageTerrainQuerier = FoliageGenerateOptions["querier"];

export interface UseRegenerateFoliageOnPaintChangeRefs {
  foliageManagerRef: RefObject<FoliageManager | null>;
  terrainQuerierRef: RefObject<FoliageTerrainQuerier | null>;
  tilesRef: RefObject<ReadonlyMap<string, FoliageTileSeed>>;
  /** World seed used by foliage placement RNG. */
  configSeedRef: RefObject<number>;
  /**
   * Latest brush-overlays prop snapshot read at fire-time.
   * Structurally requires only the foliagePaints field — other
   * brush-overlay fields (terrainSculpts, etc.) are ignored by
   * this hook and tolerated via the index signature.
   */
  brushOverlaysRef: RefObject<
    | {
        foliagePaints?: FoliageGenerateOptions["foliagePaints"];
        [key: string]: unknown;
      }
    | null
    | undefined
  >;
}

export function useRegenerateFoliageOnPaintChange(opts: {
  foliagePaintCount: number;
  tileSize: number;
  waterThreshold: number;
  refs: UseRegenerateFoliageOnPaintChangeRefs;
}): void {
  const { foliagePaintCount, tileSize, waterThreshold, refs } = opts;

  useEffect(() => {
    const mgr = refs.foliageManagerRef.current;
    const querier = refs.terrainQuerierRef.current;
    if (!mgr || !querier) return;

    mgr.clearAll();
    const tiles = refs.tilesRef.current;
    if (!tiles) return;
    for (const [, tileData] of tiles) {
      mgr.scheduleTile({
        tileX: tileData.tileX,
        tileZ: tileData.tileZ,
        tileSize,
        worldSeed: refs.configSeedRef.current ?? 0,
        querier,
        waterThreshold,
        foliagePaints: refs.brushOverlaysRef.current?.foliagePaints,
      });
    }
  }, [
    foliagePaintCount,
    tileSize,
    waterThreshold,
    refs.brushOverlaysRef,
    refs.configSeedRef,
    refs.foliageManagerRef,
    refs.terrainQuerierRef,
    refs.tilesRef,
  ]);
}
