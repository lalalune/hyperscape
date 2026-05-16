/**
 * `useMaxHeightRescale` — fast-path Y-scale on maxHeight change.
 *
 * Phase 1.1 ninth carve from TileBasedTerrain.tsx + a real bug
 * fix. When the parent's `maxHeight` prop changes, this hook
 * scales every loaded tile's vertex Y positions by the ratio
 * `newMaxHeight / prevMaxHeight` — instant visual response on
 * the slider drag without the cost of full per-tile
 * regeneration. The downstream terrain-config effect's
 * "onlyMaxHeightChanged" branch deliberately skips dirty
 * marking in this case, so this fast-path is the ONLY thing
 * that updates the tile geometry visually.
 *
 * The bug fix: the previous in-monolith implementation kept
 * `prevMaxHeightRef.current = maxHeight` in the terrain-config
 * effect, which runs FIRST in declaration order. By the time
 * the fast-path effect read prev, it equaled the new maxHeight
 * — the bail condition tripped and the rescale never ran. In
 * practice the only-maxHeight-changed code path was visually
 * inert. By moving the prev-ref entirely inside this hook
 * (initialized to the initial value, updated only by this
 * effect), the bail condition fires exactly when intended:
 * skip the rescale when the value didn't change.
 *
 * Responsibility split:
 *   - This hook: prev-ref management, bail conditions, ratio
 *     calculation, per-tile rescale loop.
 *   - Parent: owns `tilesRef`. Must NOT touch any external
 *     `prevMaxHeightRef` — the hook is the sole owner of that
 *     state.
 */

import { useEffect, useRef, type RefObject } from "react";
import type * as THREE from "three/webgpu";

import { rescaleVertexY } from "./rescaleVertexY";

/**
 * Minimum tile shape — the hook reads `tile.mesh.geometry`
 * to apply the Y rescale.
 */
interface RescaleTile {
  mesh: THREE.Mesh;
}

export interface MaxHeightRescaleHostRefs<TTile extends RescaleTile> {
  /** Currently-loaded tiles, keyed by tile id. */
  tilesRef: RefObject<Map<string, TTile>>;
}

export function useMaxHeightRescale<TTile extends RescaleTile>(opts: {
  maxHeight: number;
  hostRefs: MaxHeightRescaleHostRefs<TTile>;
}): void {
  const { maxHeight, hostRefs } = opts;
  const prevMaxHeightRef = useRef<number>(maxHeight);

  useEffect(() => {
    const prev = prevMaxHeightRef.current;
    if (maxHeight === prev) return;
    prevMaxHeightRef.current = maxHeight;

    const scale = maxHeight / prev;
    if (!isFinite(scale) || scale === 0) return;

    const tiles = hostRefs.tilesRef.current;
    if (!tiles) return;
    for (const [, tile] of tiles) {
      rescaleVertexY(tile.mesh.geometry, scale);
    }
    // hostRefs is a stable RefObject collection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxHeight]);
}
