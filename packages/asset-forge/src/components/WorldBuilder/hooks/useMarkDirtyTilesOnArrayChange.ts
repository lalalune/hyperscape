/**
 * `useMarkDirtyTilesOnArrayChange` — pattern-shared hook that
 * marks loaded tiles dirty when a prop array changes.
 *
 * Phase 1.1 eighth carve from TileBasedTerrain.tsx. The roads-
 * change and mines-change useEffects in the monolith were
 * structurally identical (track prev value, skip-if-unchanged,
 * mirror to runtime ref, skip-if-empty, skip-if-no-tiles, log,
 * call `markDirtyTilesByDistance`). This hook consolidates the
 * pattern so future "X changed → regenerate tiles for X
 * influence" props are a one-line addition instead of a copied
 * useEffect block.
 *
 * Concerns owned by the hook:
 *   - Track the previously-seen array reference via an internal
 *     useRef; bail when unchanged (cheap referential equality
 *     check, NOT a deep diff — matches existing semantics).
 *   - Mirror the current array into the caller-supplied
 *     `runtimeRef` so other code paths (tile generation
 *     callbacks) read the latest value via ref instead of
 *     captured prop.
 *   - Mark all loaded tiles dirty (via the shared
 *     `markDirtyTilesByDistance` utility) and write the
 *     resulting key list into `dirtyTileKeysRef`.
 *   - Skip when the array is empty / undefined or when no tiles
 *     have been loaded yet.
 *
 * The label is used for the dev console log that fires on each
 * change — preserves the existing observability in the monolith.
 */

import { useEffect, useRef, type RefObject } from "react";

import {
  markDirtyTilesByDistance,
  type MarkableTile,
} from "./markDirtyTilesByDistance";

export interface MarkDirtyTilesHostRefs<TTile extends MarkableTile> {
  /** Current set of loaded tiles, keyed by tile id. */
  tilesRef: RefObject<Map<string, TTile>>;
  /** Most-recent camera tile coordinates. */
  lastCameraTileRef: RefObject<{ tileX: number; tileZ: number }>;
  /** Where to write the prioritized dirty-key list. */
  dirtyTileKeysRef: RefObject<string[]>;
}

export function useMarkDirtyTilesOnArrayChange<
  T,
  TTile extends MarkableTile,
>(opts: {
  /** The prop array (roads, mines, etc.). May be `undefined`. */
  items: ReadonlyArray<T> | undefined;
  /** Human label for the dev console log ("Roads", "Mines", …). */
  label: string;
  /**
   * Mirror ref the parent reads from non-effect callbacks (e.g.
   * tile generation). Hook writes the current `items` here on
   * every change so the latest value is visible without a
   * full re-render.
   */
  runtimeRef: RefObject<ReadonlyArray<T> | undefined>;
  hostRefs: MarkDirtyTilesHostRefs<TTile>;
}): void {
  const { items, label, runtimeRef, hostRefs } = opts;
  const prevItemsRef = useRef<ReadonlyArray<T> | undefined>(undefined);

  useEffect(() => {
    if (items === prevItemsRef.current) return;
    prevItemsRef.current = items;
    runtimeRef.current = items;

    if (!items || items.length === 0) return;
    if (hostRefs.tilesRef.current?.size === 0) return;

    console.log(
      `[TileBasedTerrain] ${label} changed — marking ${
        hostRefs.tilesRef.current?.size ?? 0
      } tiles dirty for ${items.length} ${label.toLowerCase()}`,
    );

    if (!hostRefs.tilesRef.current || !hostRefs.lastCameraTileRef.current) {
      return;
    }
    hostRefs.dirtyTileKeysRef.current = markDirtyTilesByDistance(
      hostRefs.tilesRef.current,
      hostRefs.lastCameraTileRef.current,
    );
    // hostRefs is a stable RefObject collection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}
