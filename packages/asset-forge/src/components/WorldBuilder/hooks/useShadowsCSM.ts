/**
 * useShadowsCSM — owns the dynamic shadow toggle with Cascaded
 * Shadow Maps lifecycle.
 *
 * Phase 1.1 third carve from `TileBasedTerrain.tsx`. Three
 * concerns merged into one effect because they all hinge on the
 * same `enableShadows` flag:
 *   1. Renderer-level `shadowMap.enabled` flag.
 *   2. Sun's `castShadow` flag.
 *   3. CSM (Cascaded Shadow Map) node attached to
 *      `sun.shadow.shadowNode` when shadows are on, disposed
 *      when off.
 *
 * The CSM uses three.js's `customSplitsCallback` with a
 * lambda=0.8 log/uniform blend (matches the game's "med" preset:
 * 3 cascades, 300m maxFar, 150m light margin).
 *
 * Studio-mode override: when the parent runs in studio
 * (`hideBuiltinOverlays=true` → `isStudioModeRef.current=true`),
 * shadows respect the prop. Outside studio mode they're always
 * on (matches the live game).
 */

import { useEffect, type RefObject, useRef } from "react";
import { CSMShadowNode } from "three/addons/csm/CSMShadowNode.js";

import { THREE } from "@/utils/webgpu-renderer";
import type { HyperForgeRenderer } from "@/utils/webgpu-renderer";

export interface UseShadowsCSMHostRefs {
  rendererRef: RefObject<HyperForgeRenderer | null>;
  sunRef: RefObject<THREE.DirectionalLight | null>;
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
  isStudioModeRef: RefObject<boolean>;
}

export interface UseShadowsCSMResult {
  /**
   * Stable RefObject mirroring the `enableShadows` flag. The
   * parent's animation loop and other effects consult this when
   * deciding whether to perform shadow-related work that should
   * skip when shadows are off.
   */
  enableShadowsRef: RefObject<boolean>;
}

export function useShadowsCSM(opts: {
  enableShadows: boolean;
  hostRefs: UseShadowsCSMHostRefs;
}): UseShadowsCSMResult {
  const { enableShadows, hostRefs } = opts;
  const enableShadowsRef = useRef<boolean>(enableShadows);
  enableShadowsRef.current = enableShadows;
  // CSM node ref is owned by the hook — when the effect disposes
  // it, no other code path holds the reference.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const csmShadowNodeRef = useRef<any>(null);

  useEffect(() => {
    const renderer = hostRefs.rendererRef.current;
    const sun = hostRefs.sunRef.current;
    const camera = hostRefs.cameraRef.current;
    if (!renderer || !sun) return;
    const shouldEnable = !hostRefs.isStudioModeRef.current || enableShadows;
    renderer.shadowMap.enabled = shouldEnable;
    sun.castShadow = shouldEnable;

    // Dispose existing CSM before creating a new one — handles
    // re-fires of this effect (`enableShadows` toggled).
    if (csmShadowNodeRef.current) {
      csmShadowNodeRef.current.dispose();
      csmShadowNodeRef.current = null;
      sun.shadow.shadowNode = undefined;
    }

    if (shouldEnable && camera) {
      // Game's "med" preset: 3 cascades, lambda=0.8 log/uniform
      // blend. Custom split callback matches the live game's
      // shadow-distance allocation.
      const customSplitCallback = (
        cascades: number,
        near: number,
        far: number,
        breaks: number[],
      ) => {
        const lambda = 0.8;
        for (let i = 1; i < cascades; i++) {
          const log = (near * Math.pow(far / near, i / cascades)) / far;
          const uni = (near + ((far - near) * i) / cascades) / far;
          breaks.push(lambda * log + (1 - lambda) * uni);
        }
        breaks.push(1);
      };

      try {
        const csm = new CSMShadowNode(sun, {
          cascades: 3,
          maxFar: 300,
          mode: "custom",
          customSplitsCallback: customSplitCallback,
          lightMargin: 150,
        });
        csm.fade = true;
        sun.shadow.shadowNode = csm;
        csmShadowNodeRef.current = csm;
      } catch (err) {
        console.warn(
          "[useShadowsCSM] CSM init failed, using basic shadows:",
          err,
        );
      }
    }

    return () => {
      if (csmShadowNodeRef.current) {
        csmShadowNodeRef.current.dispose();
        csmShadowNodeRef.current = null;
        if (sun) sun.shadow.shadowNode = undefined;
      }
    };
    // hostRefs are stable; React doesn't need to track them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableShadows]);

  return { enableShadowsRef };
}
