/**
 * `useGameFog` — scene-fog toggle tests.
 *
 * Phase 1.1 second carve shipped before this session without
 * test coverage. Backfill 7 tests pinning the studio-fog vs
 * game-fog parameters (color, near, far) and the enableGameFogRef
 * mirror that the animation loop reads each frame.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as THREE from "three/webgpu";
import { FOG_COLORS } from "@hyperforge/shared";

import { useGameFog } from "../useGameFog";

function makeSceneRef(): { current: THREE.Scene | null } {
  return { current: new THREE.Scene() };
}

describe("useGameFog — studio mode (enableGameFog=false)", () => {
  it("sets sky-blue fog with loose 500-3000m distances", () => {
    const sceneRef = makeSceneRef();
    renderHook(() => useGameFog({ enableGameFog: false, sceneRef }));
    const fog = sceneRef.current!.fog as THREE.Fog;
    expect(fog).toBeInstanceOf(THREE.Fog);
    expect(fog.color.getHex()).toBe(0x87ceeb);
    expect(fog.near).toBe(500);
    expect(fog.far).toBe(3000);
  });
});

describe("useGameFog — game mode (enableGameFog=true)", () => {
  it("sets game-matching fog with tight 400-800m distances", () => {
    const sceneRef = makeSceneRef();
    renderHook(() => useGameFog({ enableGameFog: true, sceneRef }));
    const fog = sceneRef.current!.fog as THREE.Fog;
    expect(fog).toBeInstanceOf(THREE.Fog);
    expect(fog.color.getHex()).toBe(FOG_COLORS.DAY);
    expect(fog.near).toBe(400);
    expect(fog.far).toBe(800);
  });
});

describe("useGameFog — toggle behavior", () => {
  it("flips fog parameters when enableGameFog changes", () => {
    const sceneRef = makeSceneRef();
    const { rerender } = renderHook(
      ({ enableGameFog }: { enableGameFog: boolean }) =>
        useGameFog({ enableGameFog, sceneRef }),
      { initialProps: { enableGameFog: false } },
    );

    // Initial: studio mode.
    expect((sceneRef.current!.fog as THREE.Fog).far).toBe(3000);

    // Flip to game mode.
    rerender({ enableGameFog: true });
    expect((sceneRef.current!.fog as THREE.Fog).far).toBe(800);
    expect((sceneRef.current!.fog as THREE.Fog).color.getHex()).toBe(
      FOG_COLORS.DAY,
    );

    // Flip back to studio.
    rerender({ enableGameFog: false });
    expect((sceneRef.current!.fog as THREE.Fog).far).toBe(3000);
    expect((sceneRef.current!.fog as THREE.Fog).color.getHex()).toBe(0x87ceeb);
  });
});

describe("useGameFog — enableGameFogRef mirror", () => {
  it("returns a ref whose .current tracks the prop on every render", () => {
    const sceneRef = makeSceneRef();
    const { result, rerender } = renderHook(
      ({ enableGameFog }: { enableGameFog: boolean }) =>
        useGameFog({ enableGameFog, sceneRef }),
      { initialProps: { enableGameFog: false } },
    );
    expect(result.current.enableGameFogRef.current).toBe(false);

    rerender({ enableGameFog: true });
    expect(result.current.enableGameFogRef.current).toBe(true);

    rerender({ enableGameFog: false });
    expect(result.current.enableGameFogRef.current).toBe(false);
  });
});

describe("useGameFog — null scene", () => {
  it("is a no-op when sceneRef.current is null", () => {
    const sceneRef: { current: THREE.Scene | null } = { current: null };
    expect(() =>
      renderHook(() => useGameFog({ enableGameFog: true, sceneRef })),
    ).not.toThrow();
  });
});

describe("useGameFog — fog reference replaced each toggle", () => {
  it("creates a new Fog instance on each prop change (doesn't mutate)", () => {
    const sceneRef = makeSceneRef();
    const { rerender } = renderHook(
      ({ enableGameFog }: { enableGameFog: boolean }) =>
        useGameFog({ enableGameFog, sceneRef }),
      { initialProps: { enableGameFog: false } },
    );
    const fog1 = sceneRef.current!.fog;
    rerender({ enableGameFog: true });
    const fog2 = sceneRef.current!.fog;
    rerender({ enableGameFog: false });
    const fog3 = sceneRef.current!.fog;
    expect(fog1).not.toBe(fog2);
    expect(fog2).not.toBe(fog3);
  });
});
