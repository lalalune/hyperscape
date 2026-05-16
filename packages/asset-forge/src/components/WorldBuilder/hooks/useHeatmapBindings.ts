/**
 * useHeatmapBindings — fan-out the difficulty heatmap's two
 * prop-driven inputs (visibility flag + danger source list) to
 * the live `DifficultyHeatmapManager` instance.
 *
 * Phase 1.1 thirteenth carve from `TileBasedTerrain.tsx`. Two
 * effects with a shared ref consolidated into one hook — the
 * symmetry (both fan props → managerRef.current.setter(prop))
 * makes a single hook a natural unit.
 *
 * What's NOT in scope:
 *
 *  - Manager construction / destruction: the parent still owns
 *    the heatmap manager's lifecycle (it's allocated alongside
 *    other render-side managers in the main scene-init effect).
 *  - Tile-load / unload notifications: those happen inside the
 *    parent's `generateTile` / `unloadTile` callbacks, which
 *    can't be carved without also extracting tile streaming.
 *  - Town-info feed: that flows through the procgen update
 *    pipeline; the heatmap is one of many subscribers.
 *
 * The hook handles the two prop-driven bindings that update at
 * a different cadence than the construction effect.
 */

import { useEffect, type RefObject } from "react";

import type {
  DifficultyHeatmapManager,
  DangerSourceInfo,
} from "../DifficultyHeatmap";

export interface UseHeatmapBindingsOpts {
  showDifficultyHeatmap: boolean;
  /** May be undefined when the parent hasn't received any danger sources yet. */
  dangerSources: ReadonlyArray<DangerSourceInfo> | undefined;
  heatmapManagerRef: RefObject<DifficultyHeatmapManager | null>;
}

export function useHeatmapBindings(opts: UseHeatmapBindingsOpts): void {
  const { showDifficultyHeatmap, dangerSources, heatmapManagerRef } = opts;

  // Visibility toggle — fan the flag into the manager.
  useEffect(() => {
    heatmapManagerRef.current?.setVisible(showDifficultyHeatmap);
  }, [showDifficultyHeatmap, heatmapManagerRef]);

  // Danger source feed — push the latest list into the manager
  // whenever the parent receives a new array. We tolerate the
  // manager being null (construction effect hasn't fired yet);
  // the parent re-pushes on every prop change so a late-arriving
  // manager picks up the current set on its first refresh tick.
  useEffect(() => {
    if (heatmapManagerRef.current && dangerSources) {
      heatmapManagerRef.current.setDangerSources([...dangerSources]);
    }
  }, [dangerSources, heatmapManagerRef]);
}
