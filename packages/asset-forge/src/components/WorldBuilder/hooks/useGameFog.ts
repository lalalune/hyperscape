/**
 * useGameFog — owns the scene-fog toggle between studio fog and
 * game-matching fog.
 *
 * Phase 1.1 second carve from `TileBasedTerrain.tsx`. Mirrors the
 * `useStandaloneSky` pattern: the hook owns the effect + the ref
 * mirroring the prop, the parent reads the ref from its animation
 * loop (where the day-cycle update interpolates fog color and
 * verifies near/far still match the active mode).
 *
 * Studio fog: sky-blue with loose distances (500-3000m) — flat
 * baseline that lets the editor see far across the world.
 *
 * Game fog: warm sandy color matching `FOG_COLORS.DAY`, tight
 * near/far (400-800m) — what the live game renders. Toggling
 * this on previews how a player will experience the same world
 * without leaving the editor.
 */

import { useEffect, useRef, type RefObject } from "react";
import { FOG_COLORS } from "@hyperforge/shared";

import { THREE } from "@/utils/webgpu-renderer";

export interface UseGameFogResult {
  /**
   * Stable RefObject mirroring the `enableGameFog` flag.
   * Animation loop in the parent reads this each frame to
   * verify fog near/far still match the active mode (the day-
   * cycle color interpolation can drift if the user toggled
   * mid-frame).
   */
  enableGameFogRef: RefObject<boolean>;
}

export function useGameFog(opts: {
  enableGameFog: boolean;
  sceneRef: RefObject<THREE.Scene | null>;
}): UseGameFogResult {
  const { enableGameFog, sceneRef } = opts;

  const enableGameFogRef = useRef<boolean>(enableGameFog);
  enableGameFogRef.current = enableGameFog;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (enableGameFog) {
      // Match game fog: warm sandy color, tight near/far (from
      // shared `FogConfig.ts`).
      scene.fog = new THREE.Fog(FOG_COLORS.DAY, 400, 800);
    } else {
      // Default studio fog: sky blue, loose distances.
      scene.fog = new THREE.Fog(0x87ceeb, 500, 3000);
    }
    // sceneRef is stable; React doesn't need to track it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableGameFog]);

  return { enableGameFogRef };
}
