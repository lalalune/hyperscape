/**
 * useStandaloneSky — owns the StandaloneSky instance lifecycle.
 *
 * Phase 1.1 first carve from `TileBasedTerrain.tsx` — the 5,130-
 * line monolith that PLAN_AAA_MASTER_AUDIT flags as the biggest-
 * leverage refactor. Each carve extracts ONE concern into a
 * focused hook, making the parent component slimmer and the
 * extracted logic independently testable / replaceable.
 *
 * Concern owned by this hook:
 *   - Create/destroy the `StandaloneSky` instance based on the
 *     `enableSky` flag.
 *   - Async-init the sky (loads sky textures from `/textures/`)
 *     and only `start()` it if the same instance is still
 *     mounted (avoids the race where a fast toggle creates +
 *     destroys before init resolves).
 *   - Replace the scene's flat background color with the sky
 *     dome when enabled; restore the day-color flat background
 *     when disabled.
 *   - Clean disposal on unmount + on `enableSky=false`.
 *
 * Concerns left in `TileBasedTerrain.tsx` (callers):
 *   - The animation-loop tick: `skyRef.current.update(...)` +
 *     `skyRef.current.lateUpdate(camera.position)`. The hook
 *     can't own this without also owning the animation loop.
 *     The parent reads `skyRef` (stable across renders) inside
 *     its existing per-frame callback.
 *   - Scene fog and background interactions when `enableSky` is
 *     mid-toggle. The parent already has these branched in its
 *     fog effect; this hook just nulls / restores the flat
 *     background.
 */

import { useEffect, useRef, type RefObject } from "react";
import { StandaloneSky } from "@hyperforge/shared";
import { FOG_COLORS } from "@hyperforge/shared";

import { THREE } from "@/utils/webgpu-renderer";

/**
 * Refs the hook needs from its parent. Three stable RefObjects
 * pointing into the parent's THREE.js scene graph. The hook
 * doesn't manage their lifecycle — it just reads `.current` at
 * effect time.
 */
export interface StandaloneSkyHostRefs {
  sceneRef: RefObject<THREE.Scene | null>;
  rendererRef: RefObject<THREE.WebGPURenderer | null>;
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
}

export interface UseStandaloneSkyResult {
  /**
   * Stable RefObject holding the live StandaloneSky instance, or
   * null when sky is disabled / not yet initialized. The
   * animation loop in the parent component reads this each frame
   * to call `update(deltaTime, worldTimeSec)` and
   * `lateUpdate(cameraPos)`.
   */
  skyRef: RefObject<StandaloneSky | null>;
  /**
   * Stable RefObject mirroring the `enableSky` flag for
   * synchronous reads inside the animation loop (where we can't
   * rely on closure capture from the previous render). Set in
   * the hook on every render.
   */
  enableSkyRef: RefObject<boolean>;
}

/**
 * Manages a `StandaloneSky` instance bound to the parent's
 * THREE.js scene. See module-level docstring for what the hook
 * owns vs leaves to the caller.
 */
export function useStandaloneSky(opts: {
  enableSky: boolean;
  hostRefs: StandaloneSkyHostRefs;
}): UseStandaloneSkyResult {
  const { enableSky, hostRefs } = opts;

  // Stable refs returned to caller. Lifecycle owned by the
  // effect below.
  const skyRef = useRef<StandaloneSky | null>(null);
  const enableSkyRef = useRef<boolean>(enableSky);
  // Mirror the prop into the ref every render so the parent's
  // animation loop reads a current value (refs are stable but
  // their `.current` updates synchronously here).
  enableSkyRef.current = enableSky;

  useEffect(() => {
    const scene = hostRefs.sceneRef.current;
    const renderer = hostRefs.rendererRef.current;
    const camera = hostRefs.cameraRef.current;
    if (!scene || !renderer || !camera) return;

    if (enableSky) {
      const sky = new StandaloneSky(scene, renderer, camera, {
        textureBasePath: "/textures/",
      });
      skyRef.current = sky;
      // Remove flat background — the sky dome replaces it.
      scene.background = null;
      // Async init then start. Guard against races where a fast
      // toggle disposes the instance before init resolves.
      sky
        .init()
        .then(() => {
          if (skyRef.current === sky) sky.start();
        })
        .catch((e: unknown) =>
          console.warn("[useStandaloneSky] Sky init failed:", e),
        );
    } else {
      if (skyRef.current) {
        skyRef.current.dispose();
        skyRef.current = null;
      }
      // Restore the flat day-color background.
      scene.background = new THREE.Color(FOG_COLORS.DAY);
    }

    return () => {
      if (skyRef.current) {
        skyRef.current.dispose();
        skyRef.current = null;
      }
    };
    // hostRefs are stable RefObjects; React doesn't need to track
    // them as deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableSky]);

  return { skyRef, enableSkyRef };
}
