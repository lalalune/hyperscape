import { describe, expect, it } from "vitest";
import * as THREE from "../../../extras/three/three";
import {
  ClientCameraSystem,
  dampStreamingCinematicRadius,
  getStreamingArenaFocus,
  getStreamingAdaptiveFramingSeparation,
  getStreamingAspectFraming,
  getStreamingCinematicPhaseParams,
  getStreamingResolutionArenaPair,
  shouldHoldStreamingArenaCamera,
  shouldUseStreamingResolutionLivePositions,
  type StreamingCinematicPhase,
} from "../ClientCameraSystem";

describe("streaming cinematic framing", () => {
  it("holds only anonymous idle broadcasts at the ring", () => {
    expect(shouldHoldStreamingArenaCamera("IDLE", false)).toBe(true);
    expect(shouldHoldStreamingArenaCamera("ANNOUNCEMENT", false, null)).toBe(
      true,
    );
    expect(
      shouldHoldStreamingArenaCamera("ANNOUNCEMENT", false, {
        agent1: [350, 24, 398],
        agent2: [350, 24, 414],
      }),
    ).toBe(false);
    expect(shouldHoldStreamingArenaCamera("FIGHTING", false)).toBe(false);
    expect(shouldHoldStreamingArenaCamera("IDLE", true)).toBe(false);
  });

  it("holds the inter-cycle camera at the authoritative arena midpoint", () => {
    expect(
      getStreamingArenaFocus({
        agent1: [350.5, 24.25, 398.5],
        agent2: [350.5, 24.25, 414.5],
      }),
    ).toEqual({ x: 350.5, y: 24.25, z: 406.5 });
  });

  it("pins either resolution actor to immutable arena coordinates during cleanup", () => {
    const positions = {
      agent1: [350.5, 24.25, 405.35] as [number, number, number],
      agent2: [350.5, 24.25, 406.65] as [number, number, number],
    };
    expect(
      getStreamingResolutionArenaPair(
        "RESOLUTION",
        positions,
        "agent-1",
        "agent-2",
        "agent-1",
      ),
    ).toEqual({ actor: positions.agent1, opponent: positions.agent2 });
    expect(
      getStreamingResolutionArenaPair(
        "RESOLUTION",
        positions,
        "agent-1",
        "agent-2",
        "agent-2",
      ),
    ).toEqual({ actor: positions.agent2, opponent: positions.agent1 });
    expect(
      getStreamingResolutionArenaPair(
        "FIGHTING",
        positions,
        "agent-1",
        "agent-2",
        "agent-1",
      ),
    ).toBeNull();
    expect(
      getStreamingResolutionArenaPair(
        "RESOLUTION",
        positions,
        "agent-1",
        "agent-2",
        "unrelated-agent",
      ),
    ).toBeNull();
  });

  it("keeps a resolution shot on the contestants' live final arena positions", () => {
    expect(
      shouldUseStreamingResolutionLivePositions(
        "RESOLUTION",
        { x: 343.5, y: 24.25, z: 414.5 },
        { x: 342.5, y: 24.25, z: 411.5 },
      ),
    ).toBe(true);
    expect(
      shouldUseStreamingResolutionLivePositions(
        "RESOLUTION",
        { x: 350.5, y: 24.25, z: 405.5 },
        { x: 0.5, y: 28.4, z: 0.5 },
      ),
    ).toBe(false);
    expect(
      shouldUseStreamingResolutionLivePositions(
        "FIGHTING",
        { x: 343.5, y: 24.25, z: 414.5 },
        { x: 342.5, y: 24.25, z: 411.5 },
      ),
    ).toBe(false);
  });

  it("falls back to the center of arena one before positions arrive", () => {
    expect(getStreamingArenaFocus(null)).toEqual({
      x: 350,
      y: 0.42,
      z: 406,
    });
  });

  it("keeps countdown and combat wide enough for both contestants and the ring", () => {
    const countdown = getStreamingCinematicPhaseParams("COUNTDOWN");
    const fighting = getStreamingCinematicPhaseParams("FIGHTING");

    expect(countdown.radiusMin).toBeGreaterThanOrEqual(7);
    expect(fighting.radiusMin).toBeGreaterThanOrEqual(6.5);
    expect(fighting.radiusMax).toBeGreaterThanOrEqual(9);
    expect(fighting.focusBias).toBe(0.5);
  });

  it("frames the announcement as a tighter elevated two-shot", () => {
    const announcement = getStreamingCinematicPhaseParams("ANNOUNCEMENT");
    const fighting = getStreamingCinematicPhaseParams("FIGHTING");

    expect(announcement.radiusMin).toBe(8.5);
    expect(announcement.radiusMax).toBe(10.5);
    expect(announcement.basePhi).toBeCloseTo(Math.PI * 0.3);
    expect(announcement.targetFov).toBeLessThanOrEqual(fighting.targetFov);
  });

  it("defines bounded broadcast-safe parameters for every phase", () => {
    const phases: StreamingCinematicPhase[] = [
      "IDLE",
      "ANNOUNCEMENT",
      "COUNTDOWN",
      "FIGHTING",
      "RESOLUTION",
    ];

    for (const phase of phases) {
      const params = getStreamingCinematicPhaseParams(phase);
      expect(params.radiusMin).toBeGreaterThan(0);
      expect(params.radiusMax).toBeGreaterThan(params.radiusMin);
      expect(params.targetFov).toBeGreaterThanOrEqual(40);
      expect(params.targetFov).toBeLessThanOrEqual(60);
      expect(params.focusBias).toBeGreaterThanOrEqual(0);
      expect(params.focusBias).toBeLessThanOrEqual(1);
    }
  });

  it("preserves canonical framing at 16:9 and widens boundedly for narrow crops", () => {
    const landscape = getStreamingAspectFraming(9.5, 50, 16 / 9);
    const square = getStreamingAspectFraming(9.5, 50, 1);
    const portrait = getStreamingAspectFraming(9.5, 50, 9 / 16);

    expect(landscape).toEqual({ radius: 9.5, targetFov: 50 });
    expect(square.radius).toBeGreaterThan(landscape.radius);
    expect(square.targetFov).toBeGreaterThan(landscape.targetFov);
    expect(portrait.radius).toBeGreaterThan(square.radius);
    expect(portrait.targetFov).toBeGreaterThan(square.targetFov);
    expect(portrait.radius).toBe(16);
    expect(portrait.targetFov).toBe(61);
  });

  it("keeps a nine-unit same-style matchup inside the 0.9 horizontal safe crop", () => {
    for (const aspect of [16 / 9, 1, 9 / 16]) {
      const framing = getStreamingAspectFraming(9.5, 50, aspect);
      const horizontalSpan =
        2 *
        framing.radius *
        Math.tan((framing.targetFov * Math.PI) / 360) *
        aspect;

      expect(horizontalSpan * 0.9).toBeGreaterThanOrEqual(9.5);
    }
  });

  it("expands immediately for kiting and releases framing room gradually", () => {
    const expanded = getStreamingAdaptiveFramingSeparation(2, 8, 1 / 60);
    expect(expanded).toBe(8);

    const firstRelease = getStreamingAdaptiveFramingSeparation(
      expanded,
      2,
      1 / 60,
    );
    expect(firstRelease).toBeLessThan(expanded);
    expect(firstRelease).toBeGreaterThan(7.9);

    let released = expanded;
    for (let frame = 0; frame < 120; frame += 1) {
      released = getStreamingAdaptiveFramingSeparation(released, 2, 1 / 60);
    }
    expect(released).toBeGreaterThan(2);
    expect(released).toBeLessThan(3);
  });

  it("pulls back quickly without snapping and pushes in more slowly", () => {
    const expanded = dampStreamingCinematicRadius(6.5, 9.5, 1 / 60);
    const contracted = dampStreamingCinematicRadius(9.5, 6.5, 1 / 60);

    expect(expanded).toBeGreaterThan(6.5);
    expect(expanded).toBeLessThan(9.5);
    expect(9.5 - expanded).toBeLessThan(contracted - 6.5);

    let radius = 6.5;
    for (let frame = 0; frame < 15; frame += 1) {
      radius = dampStreamingCinematicRadius(radius, 9.5, 1 / 60);
    }
    expect(radius).toBeGreaterThan(9.3);
  });

  it("keeps the smoothed two-subject look target centered without quaternion lag", () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
    camera.position.set(9, 6, -4);
    camera.lookAt(new THREE.Vector3(100, 1, 100));
    camera.updateMatrixWorld(true);

    const lookAtTarget = new THREE.Vector3(1.5, 1.2, -2);
    const system = Object.create(ClientCameraSystem.prototype) as {
      camera: THREE.PerspectiveCamera;
      lookAtTarget: THREE.Vector3;
      applyCinematicLookDirection(): void;
    };
    system.camera = camera;
    system.lookAtTarget = lookAtTarget;
    system.applyCinematicLookDirection();
    camera.updateMatrixWorld(true);

    const projectedTarget = lookAtTarget.clone().project(camera);
    expect(projectedTarget.x).toBeCloseTo(0, 6);
    expect(projectedTarget.y).toBeCloseTo(0, 6);
  });

  it("clamps unsupported and invalid aspect measurements safely", () => {
    const minimum = getStreamingAspectFraming(9.5, 50, 9 / 16);

    expect(getStreamingAspectFraming(9.5, 50, 0.2)).toEqual(minimum);
    expect(getStreamingAspectFraming(9.5, 50, 0)).toEqual({
      radius: 9.5,
      targetFov: 50,
    });
    expect(getStreamingAspectFraming(9.5, 50, Number.NaN)).toEqual({
      radius: 9.5,
      targetFov: 50,
    });
    expect(getStreamingAspectFraming(9.5, 50, 32 / 9)).toEqual({
      radius: 9.5,
      targetFov: 50,
    });
  });
});
