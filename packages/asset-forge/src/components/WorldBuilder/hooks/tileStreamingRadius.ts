/**
 * Tile streaming radius computation — extracted from
 * `TileBasedTerrain.tsx` (Phase 1.1 fifth carve, first piece of
 * the tile-streamer extraction outlined in
 * `PLAN_AAA_MASTER_AUDIT.md` debt #2).
 *
 * Pure functions + module-level constants — no React, no THREE,
 * no side effects. Independently testable.
 *
 * The tile streamer's question per camera move: "how many tiles
 * radius around the camera should be loaded at full detail vs
 * low-res LOD vs unloaded entirely?" The answer scales with
 * camera altitude (zoomed out → see further → load further) and
 * differs by host context (standalone preview holds a fixed
 * budget; World Studio scales aggressively to fill the visible
 * minimap-like overhead view).
 */

/**
 * Tiles in each direction from camera that get FULL-resolution
 * geometry (32×32 verts) in standalone preview / play mode.
 * Fixed — standalone doesn't fly the camera way out.
 */
export const TILE_LOAD_RADIUS_STANDALONE = 5;

/**
 * Tiles in each direction at FULL resolution for World Studio's
 * default (low-altitude) view. Scales up with altitude via
 * `getDynamicLoadRadius`. Lower than standalone because studio
 * also surrounds with low-res LOD tiles for the wide overhead
 * view.
 */
export const TILE_LOAD_RADIUS_STUDIO = 3;

/**
 * Tiles in each direction beyond which standalone unloads.
 * (Studio mode keeps everything loaded — `unloadRadius =
 * Infinity` in the streamer.)
 */
export const TILE_UNLOAD_RADIUS = 7;

/**
 * Per-frame full-resolution tile generation budget AFTER the
 * initial loading overlay clears. Keeps interactive FPS high
 * during normal editing — 2 tiles is roughly 16ms at typical
 * mesh-gen cost, leaving headroom for the rest of the frame.
 */
export const MAX_TILES_PER_FRAME = 2;

/**
 * Per-frame full-resolution tile generation budget WHILE the
 * loading overlay is still visible (initial world paint).
 * Viewport is hidden behind the overlay, so we can spend much
 * more time per frame meshing without dropping user-visible
 * FPS. Pairs with the existing 32ms `LOW_RES_TIME_BUDGET_MS`
 * during init — both scale up together so a 100×100-tile
 * world finishes its first paint in ~30s instead of ~5min.
 */
export const MAX_TILES_PER_FRAME_INITIAL_LOAD = 16;

/**
 * Vertex resolution for far/low-LOD tiles. 8×8 grid (64 verts)
 * vs the full 32×32 (1024 verts) — 16× cheaper to generate
 * and the visual difference at distance is imperceptible.
 */
export const TILE_LOD_LOW_RESOLUTION = 8;

/**
 * Per-frame low-res LOD tile generation budget. Low-res tiles
 * are tiny (64 verts) so we can churn through many per frame
 * without affecting interactive FPS.
 */
export const MAX_LOW_RES_TILES_PER_FRAME = 32;

/**
 * Compute the dynamic load radius based on camera altitude.
 *
 * Standalone mode returns the fixed `TILE_LOAD_RADIUS_STANDALONE`
 * — standalone never flies the camera way out so a static
 * budget is enough.
 *
 * World Studio mode scales linearly with altitude. The mapping
 * (verified by tests):
 *   - Y=50  → 3  (49 tiles total)
 *   - Y=200 → 5  (121 tiles)
 *   - Y=400 → 8  (289 tiles)
 *   - Y=800 → 13 (729 tiles)
 *   - Y=1500 → 20 (1681 tiles)
 *   - Y=3000+ → 40 (6561 tiles, capped at 50 = 10201 tiles)
 *
 * The scale factor (1 tile per 80m of altitude) is empirical —
 * tuned so the visible horizon stays roughly filled at all
 * camera heights without over-loading near the ground.
 *
 * Cap of 50 prevents pathological loads at extreme altitudes
 * (50² × 4 = 10,201 tiles is already the practical worst case
 * for memory; going higher just hides everything in fog
 * anyway).
 */
export function getDynamicLoadRadius(
  cameraY: number,
  isStudio: boolean,
): number {
  if (!isStudio) return TILE_LOAD_RADIUS_STANDALONE;
  const base = TILE_LOAD_RADIUS_STUDIO;
  const extra = Math.max(0, cameraY - 50) / 80;
  return Math.min(50, Math.round(base + extra));
}
