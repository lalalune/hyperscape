/**
 * usePointerLockSync — subscribe to `pointerlockchange` and
 * notify the caller whether the supplied element currently owns
 * the pointer lock.
 *
 * Phase 1.1 fourteenth carve from `TileBasedTerrain.tsx`. The
 * studio uses this to drive the "fly mode" UI badge — when the
 * user right-clicks the viewport and the browser engages
 * pointer lock on the container element, the editor enters fly
 * mode; the UI needs to reflect that even though pointer lock
 * lifecycle is driven by the browser, not by React state.
 *
 * The hook is intentionally generic — it doesn't know what
 * "fly mode" is. It just maps document.pointerLockElement
 * comparisons against the supplied containerRef to a boolean
 * stream piped through `onChange`.
 *
 * Why a separate hook:
 *
 *  - DOM event subscriptions with cleanup are a classic
 *    extract-into-hook target.
 *  - The active-element comparison logic is reusable for any
 *    pointer-lock-using surface; the studio's main viewport is
 *    one such surface, future overlays (e.g. minimap pan-by-
 *    drag) could share this hook.
 *  - jsdom supports `pointerlockchange` events out of the box,
 *    so the hook is straightforwardly testable.
 */

import { useEffect, type RefObject } from "react";

export interface UsePointerLockSyncOpts {
  /**
   * The element whose pointer lock state to track. When
   * `document.pointerLockElement === containerRef.current`,
   * the hook reports `true`; otherwise `false`.
   */
  containerRef: RefObject<HTMLElement | null>;
  /**
   * Called on every `pointerlockchange` with the latest
   * active-state boolean. Parent typically pipes this into a
   * `useState` setter that drives a UI badge.
   */
  onChange: (active: boolean) => void;
}

export function usePointerLockSync(opts: UsePointerLockSyncOpts): void {
  const { containerRef, onChange } = opts;

  useEffect(() => {
    const handler = () => {
      onChange(document.pointerLockElement === containerRef.current);
    };
    document.addEventListener("pointerlockchange", handler);
    return () => {
      document.removeEventListener("pointerlockchange", handler);
    };
  }, [containerRef, onChange]);
}
