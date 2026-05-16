/**
 * `useStandaloneGrass` — game-accurate grass toggle lifecycle tests.
 *
 * Phase 1.1 eleventh carve. Pins:
 *   - Hyperia-content gate (suppress when projectTargetsHyperia
 *     is false, even with enableGrass=true).
 *   - FoliageManager interlock (toggled off when grass on, on
 *     when grass off — avoids duplicate grass instances).
 *   - Tile seeding (every already-loaded tile is registered with
 *     the freshly-created EditorGrassManager so the user sees
 *     grass immediately, not on next tile-load).
 *   - Disposal on `enableGrass=false`, on unmount, and on tileSize
 *     change (the dep that triggers a re-fire).
 *   - The `grassRef` returned to the parent is the SAME ref
 *     instance across rerenders (parent's other call sites
 *     depend on this stability).
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as THREE from "three/webgpu";

import {
  useStandaloneGrass,
  type GrassFoliageManager,
  type GrassTileSeed,
  type GrassTerrainQuerier,
  type GrassHeightFallback,
} from "../useStandaloneGrass";

// Stub the heavy EditorGrassManager — its real constructor builds
// GPU node materials and won't run in jsdom. The hook only
// touches its public surface (constructor + setTerrainCallbacks +
// addTile + dispose). The factory body is hoisted by vitest, so
// the class declaration lives inside it and we re-import to
// access `instances` from tests.
vi.mock("../../EditorGrassManager", () => {
  type AddTileCall = readonly [number, number, number];
  class FakeGrassManager {
    static instances: FakeGrassManager[] = [];
    addTileCalls: AddTileCall[] = [];
    disposeCalls = 0;
    setTerrainCalls = 0;
    constructor(_scene: unknown, _opts?: unknown) {
      FakeCtor.instances.push(this);
    }
    setTerrainCallbacks(
      _querier: unknown,
      _getHeight: unknown,
      _offset: number,
    ) {
      this.setTerrainCalls += 1;
    }
    addTile(centerX: number, centerZ: number, size: number) {
      this.addTileCalls.push([centerX, centerZ, size]);
    }
    dispose() {
      this.disposeCalls += 1;
    }
  }
  return { EditorGrassManager: FakeGrassManager };
});

// Re-import after mock to read the fake's static instances list.
// Vitest re-routes this import to the mock factory output above.
import { EditorGrassManager as FakeGrassManager } from "../../EditorGrassManager";
const FakeCtor = FakeGrassManager as unknown as {
  instances: Array<{
    addTileCalls: ReadonlyArray<readonly [number, number, number]>;
    disposeCalls: number;
    setTerrainCalls: number;
  }>;
};

function makeFoliageManager(): GrassFoliageManager & {
  enabledCalls: boolean[];
} {
  const enabledCalls: boolean[] = [];
  return {
    setEnabled(enabled: boolean) {
      enabledCalls.push(enabled);
    },
    enabledCalls,
  };
}

function makeHostRefs(opts?: {
  tiles?: ReadonlyArray<GrassTileSeed>;
  hyperiaContentEnabled?: boolean;
  worldCenterOffset?: number;
  querier?: GrassTerrainQuerier | null;
  generator?: GrassHeightFallback | null;
  foliage?: GrassFoliageManager | null;
}) {
  const scene = new THREE.Scene();
  const tilesMap = new Map<string, GrassTileSeed>();
  for (const [i, t] of (opts?.tiles ?? []).entries()) {
    tilesMap.set(String(i), t);
  }
  return {
    sceneRef: { current: scene as THREE.Scene | null },
    terrainQuerierRef: {
      current: opts?.querier ?? null,
    } as { current: GrassTerrainQuerier | null },
    generatorRef: {
      current: opts?.generator ?? null,
    } as { current: GrassHeightFallback | null },
    worldCenterOffsetRef: { current: opts?.worldCenterOffset ?? 0 },
    hyperiaContentEnabledRef: {
      current: opts?.hyperiaContentEnabled ?? true,
    },
    foliageManagerRef: {
      current: opts?.foliage ?? null,
    } as { current: GrassFoliageManager | null },
    tilesRef: { current: tilesMap as ReadonlyMap<string, GrassTileSeed> },
  };
}

beforeEach(() => {
  FakeCtor.instances = [];
});

describe("useStandaloneGrass — Hyperia content gate", () => {
  it("does not create a manager when enableGrass=true but Hyperia is off", () => {
    const hostRefs = makeHostRefs({ hyperiaContentEnabled: false });
    renderHook(() =>
      useStandaloneGrass({ enableGrass: true, tileSize: 64, hostRefs }),
    );
    expect(FakeCtor.instances).toHaveLength(0);
  });

  it("does not create a manager when Hyperia is on but grass is off", () => {
    const hostRefs = makeHostRefs({ hyperiaContentEnabled: true });
    renderHook(() =>
      useStandaloneGrass({ enableGrass: false, tileSize: 64, hostRefs }),
    );
    expect(FakeCtor.instances).toHaveLength(0);
  });

  it("creates a manager when both flags are on", () => {
    const hostRefs = makeHostRefs({ hyperiaContentEnabled: true });
    renderHook(() =>
      useStandaloneGrass({ enableGrass: true, tileSize: 64, hostRefs }),
    );
    expect(FakeCtor.instances).toHaveLength(1);
  });
});

describe("useStandaloneGrass — FoliageManager interlock", () => {
  it("disables foliage when grass turns on", () => {
    const foliage = makeFoliageManager();
    const hostRefs = makeHostRefs({ foliage });
    renderHook(() =>
      useStandaloneGrass({ enableGrass: true, tileSize: 64, hostRefs }),
    );
    expect(foliage.enabledCalls).toEqual([false]);
  });

  it("re-enables foliage when grass turns off", () => {
    const foliage = makeFoliageManager();
    const hostRefs = makeHostRefs({ foliage });
    renderHook(() =>
      useStandaloneGrass({ enableGrass: false, tileSize: 64, hostRefs }),
    );
    expect(foliage.enabledCalls).toEqual([true]);
  });

  it("does not throw when no foliage manager is plumbed", () => {
    const hostRefs = makeHostRefs({ foliage: null });
    expect(() =>
      renderHook(() =>
        useStandaloneGrass({ enableGrass: true, tileSize: 64, hostRefs }),
      ),
    ).not.toThrow();
  });
});

describe("useStandaloneGrass — tile seeding", () => {
  it("seeds every already-loaded tile into the freshly-created manager", () => {
    const tiles: GrassTileSeed[] = [
      { tileX: 0, tileZ: 0 },
      { tileX: 1, tileZ: 0 },
      { tileX: 0, tileZ: 1 },
    ];
    const hostRefs = makeHostRefs({ tiles });
    renderHook(() =>
      useStandaloneGrass({ enableGrass: true, tileSize: 64, hostRefs }),
    );
    const mgr = FakeCtor.instances[0]!;
    expect(mgr.addTileCalls).toHaveLength(3);
    // Center-of-tile math: tileX * tileSize + halfTile.
    expect(mgr.addTileCalls).toContainEqual([32, 32, 64]);
    expect(mgr.addTileCalls).toContainEqual([96, 32, 64]);
    expect(mgr.addTileCalls).toContainEqual([32, 96, 64]);
  });

  it("creates an empty manager when no tiles are loaded yet", () => {
    const hostRefs = makeHostRefs({ tiles: [] });
    renderHook(() =>
      useStandaloneGrass({ enableGrass: true, tileSize: 64, hostRefs }),
    );
    const mgr = FakeCtor.instances[0]!;
    expect(mgr.addTileCalls).toEqual([]);
  });

  it("scales tile centers by tileSize", () => {
    const tiles: GrassTileSeed[] = [{ tileX: 2, tileZ: 3 }];
    const hostRefs = makeHostRefs({ tiles });
    renderHook(() =>
      useStandaloneGrass({ enableGrass: true, tileSize: 128, hostRefs }),
    );
    const mgr = FakeCtor.instances[0]!;
    // 2*128 + 64 = 320,  3*128 + 64 = 448
    expect(mgr.addTileCalls).toEqual([[320, 448, 128]]);
  });
});

describe("useStandaloneGrass — terrain callbacks", () => {
  it("calls setTerrainCallbacks exactly once on creation", () => {
    const hostRefs = makeHostRefs();
    renderHook(() =>
      useStandaloneGrass({ enableGrass: true, tileSize: 64, hostRefs }),
    );
    expect(FakeCtor.instances[0]!.setTerrainCalls).toBe(1);
  });
});

describe("useStandaloneGrass — disposal", () => {
  it("disposes the manager when enableGrass flips to false", () => {
    const hostRefs = makeHostRefs();
    const { rerender } = renderHook(
      ({ enableGrass }: { enableGrass: boolean }) =>
        useStandaloneGrass({ enableGrass, tileSize: 64, hostRefs }),
      { initialProps: { enableGrass: true } },
    );
    const mgr = FakeCtor.instances[0]!;
    expect(mgr.disposeCalls).toBe(0);

    rerender({ enableGrass: false });
    expect(mgr.disposeCalls).toBeGreaterThanOrEqual(1);
  });

  it("disposes the manager on unmount", () => {
    const hostRefs = makeHostRefs();
    const { unmount } = renderHook(() =>
      useStandaloneGrass({ enableGrass: true, tileSize: 64, hostRefs }),
    );
    const mgr = FakeCtor.instances[0]!;
    expect(mgr.disposeCalls).toBe(0);

    unmount();
    expect(mgr.disposeCalls).toBeGreaterThanOrEqual(1);
  });

  it("re-creates manager when tileSize changes (effect dep)", () => {
    const hostRefs = makeHostRefs();
    const { rerender } = renderHook(
      ({ tileSize }: { tileSize: number }) =>
        useStandaloneGrass({ enableGrass: true, tileSize, hostRefs }),
      { initialProps: { tileSize: 64 } },
    );
    expect(FakeCtor.instances).toHaveLength(1);

    rerender({ tileSize: 128 });
    // Effect re-fires → old disposed, new instance created.
    expect(FakeCtor.instances).toHaveLength(2);
    expect(FakeCtor.instances[0]!.disposeCalls).toBeGreaterThanOrEqual(1);
  });
});

describe("useStandaloneGrass — grassRef stability", () => {
  it("returns a stable ref instance across rerenders", () => {
    const hostRefs = makeHostRefs();
    const { result, rerender } = renderHook(
      ({ enableGrass }: { enableGrass: boolean }) =>
        useStandaloneGrass({ enableGrass, tileSize: 64, hostRefs }),
      { initialProps: { enableGrass: true } },
    );
    const refOnFirstRender = result.current.grassRef;

    rerender({ enableGrass: false });
    expect(result.current.grassRef).toBe(refOnFirstRender);

    rerender({ enableGrass: true });
    expect(result.current.grassRef).toBe(refOnFirstRender);
  });

  it("populates grassRef.current with the live manager when on", () => {
    const hostRefs = makeHostRefs();
    const { result } = renderHook(() =>
      useStandaloneGrass({ enableGrass: true, tileSize: 64, hostRefs }),
    );
    expect(result.current.grassRef.current).toBe(FakeCtor.instances[0]);
  });

  it("nulls grassRef.current when grass is suppressed", () => {
    const hostRefs = makeHostRefs({ hyperiaContentEnabled: false });
    const { result } = renderHook(() =>
      useStandaloneGrass({ enableGrass: true, tileSize: 64, hostRefs }),
    );
    expect(result.current.grassRef.current).toBeNull();
  });
});

describe("useStandaloneGrass — null scene", () => {
  it("is a no-op when sceneRef.current is null", () => {
    const hostRefs = {
      ...makeHostRefs(),
      sceneRef: { current: null } as { current: THREE.Scene | null },
    };
    expect(() =>
      renderHook(() =>
        useStandaloneGrass({ enableGrass: true, tileSize: 64, hostRefs }),
      ),
    ).not.toThrow();
    expect(FakeCtor.instances).toHaveLength(0);
  });
});
