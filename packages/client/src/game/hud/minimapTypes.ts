/**
 * minimapTypes.ts - Shared types and utilities for minimap components.
 *
 * Extracted from MinimapRenderer.ts during worker migration.
 * Used by Minimap.tsx and useMinimapInteraction.ts.
 */

import { THREE } from "@hyperscape/shared";

/** Per-instance render state factory. Each Minimap instance gets isolated scratch data. */
export interface MinimapRenderState {
  forwardVec: THREE.Vector3;
  projectVec: THREE.Vector3;
  destVec: THREE.Vector3;
  unprojectVec: THREE.Vector3;
  targetPos: { x: number; z: number };
  projectionViewMatrix: THREE.Matrix4;
  hasCachedMatrix: boolean;
}

/** Augmented window type covering all Hyperscape globals written to window */
export type HyperscapeWindow = Window &
  typeof globalThis & {
    __lastRaycastTarget?: { x: number; y: number; z: number; method: string };
    __HYPERSCAPE_CONFIG__?: { mode?: string; followEntity?: string };
  };

export function createRenderState(): MinimapRenderState {
  return {
    forwardVec: new THREE.Vector3(),
    projectVec: new THREE.Vector3(),
    destVec: new THREE.Vector3(),
    unprojectVec: new THREE.Vector3(),
    targetPos: { x: 0, z: 0 },
    projectionViewMatrix: new THREE.Matrix4(),
    hasCachedMatrix: false,
  };
}

export interface SpectatorTarget {
  id?: string;
  position: { x: number; z: number };
}

export function getSpectatorTarget(world: {
  getSystem: (name: string) => unknown;
}): SpectatorTarget | null {
  if ((window as HyperscapeWindow).__HYPERSCAPE_CONFIG__?.mode !== "spectator")
    return null;
  const cameraSystem = world.getSystem("client-camera-system") as {
    getCameraInfo?: () => {
      target?: {
        id?: string;
        node?: { position?: THREE.Vector3 };
        position?: { x: number; z: number };
      };
    };
  } | null;
  const info = cameraSystem?.getCameraInfo?.();
  if (!info?.target) return null;
  const pos = info.target.node?.position ?? info.target.position;
  if (!pos) return null;
  return { id: info.target.id, position: { x: pos.x, z: pos.z } };
}
