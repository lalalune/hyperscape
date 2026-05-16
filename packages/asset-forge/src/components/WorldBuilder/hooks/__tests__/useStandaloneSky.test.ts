/**
 * `useStandaloneSky` — sky lifecycle tests.
 *
 * Phase 1.1 first carve shipped before this session without test
 * coverage. The hook owns the async StandaloneSky lifecycle:
 * construct on enable, race-safe async init, dispose on disable
 * or unmount, scene.background swap with the day-color flat
 * background.
 *
 * StandaloneSky is mocked since it depends on WebGPU + texture
 * loads that don't run cleanly under jsdom/node. The mock surfaces
 * the lifecycle methods the hook calls (init, start, dispose) so
 * the tests pin the call sequence rather than the underlying
 * rendering.
 */

import { renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import * as THREE from "three/webgpu";

// Track all instances created so tests can assert on them.
const createdSkyInstances: Array<{
  init: Mock;
  start: Mock;
  dispose: Mock;
  initResolve: (() => void) | null;
}> = [];

vi.mock("@hyperforge/shared", async () => {
  const actual =
    await vi.importActual<typeof import("@hyperforge/shared")>(
      "@hyperforge/shared",
    );
  return {
    ...actual,
    StandaloneSky: class FakeSky {
      init: Mock;
      start: Mock;
      dispose: Mock;
      initResolve: (() => void) | null = null;
      constructor(
        _scene: unknown,
        _renderer: unknown,
        _camera: unknown,
        _opts: unknown,
      ) {
        // Async init that resolves only when initResolve() is called.
        this.init = vi.fn(
          () =>
            new Promise<void>((resolve) => {
              this.initResolve = resolve;
            }),
        );
        this.start = vi.fn();
        this.dispose = vi.fn();
        createdSkyInstances.push(this);
      }
    },
  };
});

import { useStandaloneSky } from "../useStandaloneSky";

function makeHostRefs(): {
  sceneRef: { current: THREE.Scene | null };
  rendererRef: { current: THREE.WebGPURenderer | null };
  cameraRef: { current: THREE.PerspectiveCamera | null };
} {
  return {
    sceneRef: { current: new THREE.Scene() },
    // Fake renderer/camera — only used to be non-null.
    rendererRef: { current: {} as THREE.WebGPURenderer },
    cameraRef: { current: new THREE.PerspectiveCamera(60, 1, 0.1, 1000) },
  };
}

beforeEach(() => {
  createdSkyInstances.length = 0;
});

afterEach(() => {
  // Flush any pending init resolutions so we don't leak across tests.
  for (const sky of createdSkyInstances) {
    if (sky.initResolve) {
      sky.initResolve();
      sky.initResolve = null;
    }
  }
});

describe("useStandaloneSky — initial state", () => {
  it("returns the expected ref shape", () => {
    const hostRefs = makeHostRefs();
    const { result } = renderHook(() =>
      useStandaloneSky({ enableSky: false, hostRefs }),
    );
    expect(result.current.skyRef).toBeDefined();
    expect(result.current.enableSkyRef).toBeDefined();
    expect(result.current.skyRef.current).toBeNull();
  });

  it("enableSkyRef mirrors the prop on every render", () => {
    const hostRefs = makeHostRefs();
    const { result, rerender } = renderHook(
      ({ enableSky }: { enableSky: boolean }) =>
        useStandaloneSky({ enableSky, hostRefs }),
      { initialProps: { enableSky: false } },
    );
    expect(result.current.enableSkyRef.current).toBe(false);

    rerender({ enableSky: true });
    expect(result.current.enableSkyRef.current).toBe(true);

    rerender({ enableSky: false });
    expect(result.current.enableSkyRef.current).toBe(false);
  });
});

describe("useStandaloneSky — disabled (enableSky=false)", () => {
  it("does NOT construct a sky instance", () => {
    const hostRefs = makeHostRefs();
    renderHook(() => useStandaloneSky({ enableSky: false, hostRefs }));
    expect(createdSkyInstances).toHaveLength(0);
  });

  it("sets scene.background to the flat day color", async () => {
    const hostRefs = makeHostRefs();
    renderHook(() => useStandaloneSky({ enableSky: false, hostRefs }));
    expect(hostRefs.sceneRef.current!.background).toBeInstanceOf(THREE.Color);
  });
});

describe("useStandaloneSky — enabled (enableSky=true)", () => {
  it("constructs a sky instance and clears scene.background", () => {
    const hostRefs = makeHostRefs();
    renderHook(() => useStandaloneSky({ enableSky: true, hostRefs }));
    expect(createdSkyInstances).toHaveLength(1);
    expect(hostRefs.sceneRef.current!.background).toBeNull();
  });

  it("populates skyRef.current with the new instance", () => {
    const hostRefs = makeHostRefs();
    const { result } = renderHook(() =>
      useStandaloneSky({ enableSky: true, hostRefs }),
    );
    expect(result.current.skyRef.current).not.toBeNull();
  });

  it("calls .init() exactly once on construction", () => {
    const hostRefs = makeHostRefs();
    renderHook(() => useStandaloneSky({ enableSky: true, hostRefs }));
    expect(createdSkyInstances[0].init).toHaveBeenCalledOnce();
  });
});

describe("useStandaloneSky — disable transitions", () => {
  it("disposes the active sky when enableSky flips off", () => {
    const hostRefs = makeHostRefs();
    const { rerender } = renderHook(
      ({ enableSky }: { enableSky: boolean }) =>
        useStandaloneSky({ enableSky, hostRefs }),
      { initialProps: { enableSky: true } },
    );
    const sky = createdSkyInstances[0];
    expect(sky.dispose).not.toHaveBeenCalled();

    rerender({ enableSky: false });
    expect(sky.dispose).toHaveBeenCalled();
  });

  it("restores the flat day-color background on disable", () => {
    const hostRefs = makeHostRefs();
    const { rerender } = renderHook(
      ({ enableSky }: { enableSky: boolean }) =>
        useStandaloneSky({ enableSky, hostRefs }),
      { initialProps: { enableSky: true } },
    );
    // Mid-flight: scene.background was nulled on enable.
    expect(hostRefs.sceneRef.current!.background).toBeNull();

    rerender({ enableSky: false });
    expect(hostRefs.sceneRef.current!.background).toBeInstanceOf(THREE.Color);
  });
});

describe("useStandaloneSky — no-op cases", () => {
  it("does nothing when sceneRef.current is null", () => {
    const hostRefs = makeHostRefs();
    hostRefs.sceneRef.current = null;
    renderHook(() => useStandaloneSky({ enableSky: true, hostRefs }));
    expect(createdSkyInstances).toHaveLength(0);
  });

  it("does nothing when rendererRef.current is null", () => {
    const hostRefs = makeHostRefs();
    hostRefs.rendererRef.current = null;
    renderHook(() => useStandaloneSky({ enableSky: true, hostRefs }));
    expect(createdSkyInstances).toHaveLength(0);
  });

  it("does nothing when cameraRef.current is null", () => {
    const hostRefs = makeHostRefs();
    hostRefs.cameraRef.current = null;
    renderHook(() => useStandaloneSky({ enableSky: true, hostRefs }));
    expect(createdSkyInstances).toHaveLength(0);
  });
});
