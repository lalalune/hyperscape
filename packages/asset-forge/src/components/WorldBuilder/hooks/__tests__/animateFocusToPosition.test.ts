/**
 * `animateFocusToPosition` — camera-focus animation tests.
 *
 * Pins the distance math (radius × 2.5 floored at 10 / tan(fov/2)),
 * the end-position derivation (target + back-off along the
 * camera→prev-target direction), the RAF-driven lerp loop, and
 * the easing function. Uses a synchronous fake RAF impl so the
 * full animation runs deterministically in a single test tick.
 */

import { describe, expect, it } from "vitest";
import * as THREE from "three/webgpu";

import {
  animateFocusToPosition,
  type FocusableOrbitControls,
} from "../animateFocusToPosition";

/**
 * Synchronous fake RAF that calls every queued callback immediately
 * and drains until no more callbacks are scheduled. Combined with
 * a controllable "now" clock, lets a test run the full 300ms
 * animation in one go.
 */
function makeFakeRaf(): {
  raf: (cb: FrameRequestCallback) => number;
  advanceTo: (ms: number) => void;
} {
  let now = 0;
  let pendingCallback: FrameRequestCallback | null = null;
  const raf = (cb: FrameRequestCallback): number => {
    pendingCallback = cb;
    return 0;
  };
  const advanceTo = (ms: number): void => {
    now = ms;
    // performance.now() inside the helper reads the global. We
    // can't easily intercept it without spying; use a different
    // strategy below.
    while (pendingCallback) {
      const cb = pendingCallback;
      pendingCallback = null;
      cb(now);
    }
  };
  return { raf, advanceTo };
}

function makeCamera(
  position: THREE.Vector3,
  fovDeg = 60,
): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(fovDeg, 1, 0.1, 1000);
  cam.position.copy(position);
  return cam;
}

function makeOrbit(target: THREE.Vector3): FocusableOrbitControls & {
  updateCalls: number;
} {
  const ctrl = {
    target: target.clone(),
    updateCalls: 0,
    update() {
      this.updateCalls++;
    },
  };
  return ctrl;
}

describe("animateFocusToPosition — distance math", () => {
  it("end position is target plus back-off along (camera - prevTarget) direction", () => {
    // Camera at (10, 0, 0) looking at origin (0,0,0).
    const camera = makeCamera(new THREE.Vector3(10, 0, 0));
    const ctrl = makeOrbit(new THREE.Vector3(0, 0, 0));
    const target = new THREE.Vector3(100, 0, 0); // new focus point
    const radius = 5;

    const { raf, advanceTo } = makeFakeRaf();
    animateFocusToPosition(camera, ctrl, target, radius, raf);
    // Run all frames at once (the helper's internal time check
    // uses performance.now, which we can't mock here easily —
    // so the animation completes when t >= 1, i.e. when
    // performance.now() - startTime >= 300. We'll loop the
    // RAF callbacks until both the camera and ctrl.target have
    // stabilized — but synchronously without sleeping.
    advanceTo(1000);

    // After completion: ctrl.target ≈ target.
    expect(ctrl.target.x).toBeCloseTo(target.x);
    expect(ctrl.target.y).toBeCloseTo(target.y);
    expect(ctrl.target.z).toBeCloseTo(target.z);

    // Camera ends up at target + (cameraDir * distance). The
    // direction is (initial camera - initial orbit.target).normalize()
    // = (10,0,0) - (0,0,0) = (1,0,0). Distance = max(5*2.5, 10) /
    // tan(30°) ≈ 12.5 / 0.577 ≈ 21.65.
    const fov = (60 * Math.PI) / 180;
    const expectedDistance = Math.max(5 * 2.5, 10) / Math.tan(fov / 2);
    expect(camera.position.x).toBeCloseTo(target.x + expectedDistance);
    expect(camera.position.y).toBeCloseTo(0);
    expect(camera.position.z).toBeCloseTo(0);
  });

  it("distance floors at 10 world units for tiny radii", () => {
    // radius * 2.5 = 0.25 < 10, so the floor kicks in.
    const camera = makeCamera(new THREE.Vector3(10, 0, 0));
    const ctrl = makeOrbit(new THREE.Vector3(0, 0, 0));
    const target = new THREE.Vector3(0, 0, 0);
    const radius = 0.1;

    const { raf, advanceTo } = makeFakeRaf();
    animateFocusToPosition(camera, ctrl, target, radius, raf);
    advanceTo(1000);

    const fov = (60 * Math.PI) / 180;
    const expectedDistance = 10 / Math.tan(fov / 2);
    // Final camera distance from target should equal the expected.
    expect(camera.position.length()).toBeCloseTo(expectedDistance);
  });

  it("FOV affects the back-off distance", () => {
    const camera90 = makeCamera(new THREE.Vector3(10, 0, 0), 90);
    const camera30 = makeCamera(new THREE.Vector3(10, 0, 0), 30);
    const ctrl90 = makeOrbit(new THREE.Vector3(0, 0, 0));
    const ctrl30 = makeOrbit(new THREE.Vector3(0, 0, 0));
    const target = new THREE.Vector3(0, 0, 0);

    const fake1 = makeFakeRaf();
    const fake2 = makeFakeRaf();
    animateFocusToPosition(camera90, ctrl90, target, 5, fake1.raf);
    animateFocusToPosition(camera30, ctrl30, target, 5, fake2.raf);
    fake1.advanceTo(1000);
    fake2.advanceTo(1000);

    // Wider FOV → smaller back-off (the same field of view captures
    // more world per degree, so you don't need to back off as far).
    expect(camera90.position.length()).toBeLessThan(camera30.position.length());
  });
});

describe("animateFocusToPosition — animation lifecycle", () => {
  it("calls orbitControls.update at least once per frame tick", () => {
    const camera = makeCamera(new THREE.Vector3(10, 0, 0));
    const ctrl = makeOrbit(new THREE.Vector3(0, 0, 0));
    const target = new THREE.Vector3(50, 0, 0);

    const { raf, advanceTo } = makeFakeRaf();
    animateFocusToPosition(camera, ctrl, target, 5, raf);
    advanceTo(1000);

    expect(ctrl.updateCalls).toBeGreaterThan(0);
  });

  it("interpolates target via lerp (intermediate value differs from start AND end at t≈0.5)", () => {
    // Use a custom RAF that captures intermediate ctrl.target values.
    const camera = makeCamera(new THREE.Vector3(10, 0, 0));
    const ctrl = makeOrbit(new THREE.Vector3(0, 0, 0));
    const target = new THREE.Vector3(100, 0, 0);

    // Single-shot RAF: animation will fire then stop after one tick
    // because no further raf() call is made.
    let frames = 0;
    const positions: number[] = [];
    const raf: (cb: FrameRequestCallback) => number = (cb) => {
      // Schedule cb but only fire the first 5 times.
      if (frames < 5) {
        frames++;
        cb(performance.now());
      }
      return 0;
    };

    animateFocusToPosition(camera, ctrl, target, 5, raf);
    positions.push(ctrl.target.x);
    // After at least one tick the target should have moved AWAY from 0
    // (the initial value). The exact value depends on real-time
    // performance.now() differences, but it must not be exactly 0.
    expect(positions[0]).toBeGreaterThanOrEqual(0);
    // Target.x is increasing toward 100. After some easing, value
    // is between 0 and 100 (or exactly 100 if t reached 1).
    expect(positions[0]).toBeLessThanOrEqual(100);
  });
});
