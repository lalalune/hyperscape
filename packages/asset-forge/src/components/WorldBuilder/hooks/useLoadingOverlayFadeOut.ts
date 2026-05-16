/**
 * useLoadingOverlayFadeOut — schedule the DOM removal of the
 * studio's initial-load overlay once the fade-out animation
 * completes.
 *
 * Phase 1.1 fifteenth carve from `TileBasedTerrain.tsx`.
 *
 * The overlay uses two pieces of state that work together:
 *
 *  1. `initialLoadComplete` — set when the world is ready
 *     enough to interact with (terrain mesh exists, animation
 *     loop is ticking). When this flips true, the overlay's
 *     CSS class triggers an opacity fade.
 *  2. `loadingOverlayVisible` — controls whether the overlay is
 *     mounted in the DOM at all. Stays true while the CSS fade
 *     plays out, then flips false to remove the overlay node so
 *     it doesn't capture pointer events.
 *
 * This hook owns the timer that bridges (1) → (2) — after a
 * fixed delay (matching the CSS animation duration), it calls
 * `onHide()` so the parent can flip `loadingOverlayVisible` to
 * false.
 *
 * The hook cleans up its timer on unmount and on dep change
 * (no double-fire if the parent re-renders mid-fade).
 */

import { useEffect } from "react";

export interface UseLoadingOverlayFadeOutOpts {
  /** Has the world finished initial load? Triggers fade when true. */
  initialLoadComplete: boolean;
  /** Is the overlay still mounted? Only schedule when both flags align. */
  loadingOverlayVisible: boolean;
  /**
   * Delay after `initialLoadComplete` becomes true before
   * invoking `onHide()`. Must match the CSS fade-out animation
   * duration — too short clips the animation, too long leaves
   * a transparent overlay capturing input.
   */
  fadeOutDelayMs: number;
  /** Called after the delay; parent flips its visible state. */
  onHide: () => void;
}

export function useLoadingOverlayFadeOut(
  opts: UseLoadingOverlayFadeOutOpts,
): void {
  const { initialLoadComplete, loadingOverlayVisible, fadeOutDelayMs, onHide } =
    opts;

  useEffect(() => {
    if (initialLoadComplete && loadingOverlayVisible) {
      const timer = setTimeout(() => onHide(), fadeOutDelayMs);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [initialLoadComplete, loadingOverlayVisible, fadeOutDelayMs, onHide]);
}
