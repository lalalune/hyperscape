/**
 * `useWaterThresholdSync` — fast-path water-plane move on
 * waterThreshold change.
 *
 * Phase 1.1 eighth-and-a-half carve from TileBasedTerrain.tsx.
 * A small but focused useEffect: when the parent's
 * `waterThreshold` prop changes, this hook repositions every
 * water mesh in the scene without a full tile regeneration.
 * The dirty-tile regen path also updates water — but that's
 * progressive and takes multiple frames; this gives instant
 * visual response on the slider drag.
 *
 * The hook owns the internal `prevWaterThresholdRef` so the
 * lifecycle is self-contained (unlike the maxHeight rescale,
 * whose prev-ref is updated by a separate terrain-config
 * effect — that one isn't a clean extraction target).
 *
 * Responsibility split:
 *   - This hook: read previous waterThreshold, bail if
 *     unchanged, update prev, sweep all water meshes setting
 *     `position.y = waterThreshold`.
 *   - Parent: owns `waterContainerRef` (the world-sized water
 *     plane container in studio mode) and `tilesRef` (per-tile
 *     water meshes in standalone mode). The hook reads both at
 *     effect-run time.
 */

import { useEffect, useRef, type RefObject } from "react";

import { THREE } from "@/utils/webgpu-renderer";

/**
 * Minimum shape this hook reads off each tile — only
 * `tile.water` for the position write.
 */
interface WaterTile {
  water: THREE.Mesh | null;
}

export interface WaterThresholdSyncHostRefs<TTile extends WaterTile> {
  /**
   * Studio-mode container holding the single world-sized water
   * plane. In standalone mode this is non-null but holds no
   * children (water lives per-tile via `tilesRef`).
   */
  waterContainerRef: RefObject<THREE.Group | null>;
  /** Per-tile water meshes (standalone mode). */
  tilesRef: RefObject<Map<string, TTile>>;
}

export function useWaterThresholdSync<TTile extends WaterTile>(opts: {
  waterThreshold: number;
  hostRefs: WaterThresholdSyncHostRefs<TTile>;
}): void {
  const { waterThreshold, hostRefs } = opts;
  const prevWaterThresholdRef = useRef<number>(waterThreshold);

  useEffect(() => {
    const prev = prevWaterThresholdRef.current;
    if (waterThreshold === prev) return;
    prevWaterThresholdRef.current = waterThreshold;

    // World-sized water plane(s) live in the container; tile-
    // specific water meshes live on each TileData.
    const wc = hostRefs.waterContainerRef.current;
    if (wc) {
      for (const child of wc.children) {
        child.position.y = waterThreshold;
      }
    }
    const tiles = hostRefs.tilesRef.current;
    if (tiles) {
      for (const [, tile] of tiles) {
        if (tile.water) tile.water.position.y = waterThreshold;
      }
    }
    // hostRefs is a stable RefObject collection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waterThreshold]);
}
