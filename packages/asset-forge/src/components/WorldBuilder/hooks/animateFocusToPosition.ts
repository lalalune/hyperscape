/**
 * `animateFocusToPosition` — smooth camera-focus animation.
 *
 * Phase 1.1 tenth carve from TileBasedTerrain.tsx. The body of
 * the `focusOnPosition` imperative-handle method was a 33-line
 * inline arrow function with a captured RAF loop. Extracted as
 * a pure utility so it's independently testable (the math /
 * easing / RAF loop) and the imperative-handle method shrinks
 * to a one-line delegation.
 *
 * Behavior pinned:
 *   - Camera distance scales with the target's radius: max(radius * 2.5, 10)
 *     world units back from the focus point, projected through
 *     the camera's vertical FOV.
 *   - Animation duration is 300ms with ease-out cubic.
 *   - Both orbit controls' target AND camera position lerp in
 *     parallel; ctrl.update() is called every RAF tick.
 *   - Animation cancels naturally when t >= 1 (no explicit cleanup).
 *
 * Concerns NOT owned by this utility:
 *   - When to call it (the imperative-handle method on the
 *     parent's ref dispatches it).
 *   - Cancelling mid-animation if a new focus is requested
 *     (current behavior: the new animation starts and the two
 *     RAF loops run concurrently until the older one finishes;
 *     since they both target the same camera + ctrl, the LATER
 *     one wins frame-by-frame).
 */

import type * as THREE from "three/webgpu";

/**
 * Minimum orbit-controls shape — uses target.clone() / lerpVectors,
 * and an update() method. Matches OrbitControls' public surface
 * without coupling to the full type.
 */
export interface FocusableOrbitControls {
  target: THREE.Vector3;
  update: () => void;
}

/**
 * Animate `camera` + `orbitControls.target` to focus on `target`
 * (the world-space position the user wants framed) with a back-off
 * distance derived from `radius`. Returns immediately; the
 * animation runs on requestAnimationFrame and completes after
 * 300ms.
 *
 * `requestAnimationFrameImpl` is injectable for tests — defaults
 * to the global RAF when omitted.
 */
export function animateFocusToPosition(
  camera: THREE.PerspectiveCamera,
  orbitControls: FocusableOrbitControls,
  target: THREE.Vector3,
  radius: number,
  requestAnimationFrameImpl?: (cb: FrameRequestCallback) => number,
): void {
  // Calculate camera distance to frame the object — radius * 2.5
  // gives some padding; minimum 10m so tiny objects still produce
  // a sensible camera distance. Projected through FOV so taller
  // FOVs zoom in further.
  const fov = camera.fov * (Math.PI / 180);
  const distance = Math.max(radius * 2.5, 10) / Math.tan(fov / 2);

  const startTarget = orbitControls.target.clone();
  const startPos = camera.position.clone();
  const endTarget = target.clone();
  const endPos = target
    .clone()
    .add(
      camera.position
        .clone()
        .sub(orbitControls.target)
        .normalize()
        .multiplyScalar(distance),
    );

  const duration = 300;
  const startTime =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const raf =
    requestAnimationFrameImpl ??
    (typeof requestAnimationFrame !== "undefined"
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as never);

  const animateFocus = (): void => {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    // Ease-out cubic.
    const ease = 1 - Math.pow(1 - t, 3);
    orbitControls.target.lerpVectors(startTarget, endTarget, ease);
    camera.position.lerpVectors(startPos, endPos, ease);
    orbitControls.update();
    if (t < 1) raf(animateFocus);
  };
  animateFocus();
}
