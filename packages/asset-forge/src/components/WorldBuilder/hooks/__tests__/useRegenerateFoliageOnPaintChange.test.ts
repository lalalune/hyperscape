/**
 * `useRegenerateFoliageOnPaintChange` — paint-stroke regen tests.
 *
 * Phase 1.1 twelfth carve. Pins:
 *   - No-ops when foliage manager or querier is null.
 *   - On fire, clearAll + scheduleTile for every loaded tile.
 *   - scheduleTile uses the LATEST brushOverlaysRef.current at
 *     fire-time (ref-read semantics, not closure capture).
 *   - Re-fires on foliagePaintCount / tileSize / waterThreshold
 *     changes.
 *   - Does NOT re-fire on identical deps (avoids redundant
 *     thrash when other parent state changes).
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  useRegenerateFoliageOnPaintChange,
  type FoliageTileSeed,
  type FoliageTerrainQuerier,
  type UseRegenerateFoliageOnPaintChangeRefs,
} from "../useRegenerateFoliageOnPaintChange";
import type {
  FoliageManager,
  FoliageGenerateOptions,
} from "../../FoliageRenderer";

type Scheduled = Parameters<FoliageManager["scheduleTile"]>[0];

function makeFakeManager() {
  const scheduleCalls: Scheduled[] = [];
  let clearCalls = 0;
  return {
    instance: {
      scheduleTile(opts: Scheduled) {
        scheduleCalls.push(opts);
      },
      clearAll() {
        clearCalls += 1;
      },
    } as unknown as FoliageManager,
    scheduleCalls,
    getClearCalls: () => clearCalls,
  };
}

function makeQuerier(): FoliageTerrainQuerier {
  return ((_x: number, _z: number) => ({
    height: 0,
    biomeForestWeight: 0,
    biomeCanyonWeight: 0,
  })) as unknown as FoliageTerrainQuerier;
}

function makeRefs(opts: {
  manager?: FoliageManager | null;
  querier?: FoliageTerrainQuerier | null;
  tiles?: ReadonlyArray<FoliageTileSeed>;
  seed?: number;
  brushOverlays?: {
    foliagePaints?: FoliageGenerateOptions["foliagePaints"];
  } | null;
}): UseRegenerateFoliageOnPaintChangeRefs {
  const tilesMap = new Map<string, FoliageTileSeed>();
  for (const [i, t] of (opts.tiles ?? []).entries()) tilesMap.set(String(i), t);
  return {
    foliageManagerRef: {
      current: opts.manager ?? null,
    } as { current: FoliageManager | null },
    terrainQuerierRef: {
      current: opts.querier ?? null,
    } as { current: FoliageTerrainQuerier | null },
    tilesRef: { current: tilesMap as ReadonlyMap<string, FoliageTileSeed> },
    configSeedRef: { current: opts.seed ?? 0 },
    brushOverlaysRef: {
      current: opts.brushOverlays ?? null,
    } as UseRegenerateFoliageOnPaintChangeRefs["brushOverlaysRef"],
  };
}

describe("useRegenerateFoliageOnPaintChange — guard clauses", () => {
  it("no-ops when foliage manager is null", () => {
    const refs = makeRefs({ manager: null, querier: makeQuerier() });
    expect(() =>
      renderHook(() =>
        useRegenerateFoliageOnPaintChange({
          foliagePaintCount: 1,
          tileSize: 64,
          waterThreshold: 0.1,
          refs,
        }),
      ),
    ).not.toThrow();
  });

  it("no-ops when terrain querier is null", () => {
    const fm = makeFakeManager();
    const refs = makeRefs({ manager: fm.instance, querier: null });
    renderHook(() =>
      useRegenerateFoliageOnPaintChange({
        foliagePaintCount: 1,
        tileSize: 64,
        waterThreshold: 0.1,
        refs,
      }),
    );
    expect(fm.getClearCalls()).toBe(0);
    expect(fm.scheduleCalls).toHaveLength(0);
  });
});

describe("useRegenerateFoliageOnPaintChange — schedule semantics", () => {
  it("calls clearAll once + scheduleTile for every loaded tile on fire", () => {
    const fm = makeFakeManager();
    const tiles: FoliageTileSeed[] = [
      { tileX: 0, tileZ: 0 },
      { tileX: 1, tileZ: 0 },
      { tileX: 0, tileZ: 1 },
    ];
    const refs = makeRefs({
      manager: fm.instance,
      querier: makeQuerier(),
      tiles,
      seed: 42,
    });

    renderHook(() =>
      useRegenerateFoliageOnPaintChange({
        foliagePaintCount: 2,
        tileSize: 64,
        waterThreshold: 0.15,
        refs,
      }),
    );

    expect(fm.getClearCalls()).toBe(1);
    expect(fm.scheduleCalls).toHaveLength(3);
    expect(fm.scheduleCalls[0]).toMatchObject({
      tileSize: 64,
      worldSeed: 42,
      waterThreshold: 0.15,
    });
  });

  it("scheduleTile picks up latest brushOverlaysRef.current at fire-time", () => {
    const fm = makeFakeManager();
    const refs = makeRefs({
      manager: fm.instance,
      querier: makeQuerier(),
      tiles: [{ tileX: 0, tileZ: 0 }],
      brushOverlays: { foliagePaints: [] },
    });
    const initialPaints: NonNullable<FoliageGenerateOptions["foliagePaints"]> =
      [];
    refs.brushOverlaysRef = {
      current: { foliagePaints: initialPaints },
    } as UseRegenerateFoliageOnPaintChangeRefs["brushOverlaysRef"];

    const { rerender } = renderHook(
      ({ count }: { count: number }) =>
        useRegenerateFoliageOnPaintChange({
          foliagePaintCount: count,
          tileSize: 64,
          waterThreshold: 0.1,
          refs,
        }),
      { initialProps: { count: 0 } },
    );

    // Mutate the ref to simulate the parent prop changing.
    const updatedPaints: NonNullable<FoliageGenerateOptions["foliagePaints"]> =
      Array(3)
        .fill(0)
        .map(
          (_, i) =>
            ({ id: `s${i}` }) as unknown as NonNullable<
              FoliageGenerateOptions["foliagePaints"]
            >[number],
        );
    (refs.brushOverlaysRef as unknown as { current: unknown }).current = {
      foliagePaints: updatedPaints,
    };

    rerender({ count: 3 });

    // The most recent scheduleTile call reads the new array.
    const last = fm.scheduleCalls.at(-1)!;
    expect(last.foliagePaints).toBe(updatedPaints);
  });
});

describe("useRegenerateFoliageOnPaintChange — re-fire conditions", () => {
  it("re-fires when foliagePaintCount changes", () => {
    const fm = makeFakeManager();
    const refs = makeRefs({
      manager: fm.instance,
      querier: makeQuerier(),
      tiles: [{ tileX: 0, tileZ: 0 }],
    });
    const { rerender } = renderHook(
      ({ count }: { count: number }) =>
        useRegenerateFoliageOnPaintChange({
          foliagePaintCount: count,
          tileSize: 64,
          waterThreshold: 0.1,
          refs,
        }),
      { initialProps: { count: 0 } },
    );
    expect(fm.getClearCalls()).toBe(1);

    rerender({ count: 1 });
    expect(fm.getClearCalls()).toBe(2);

    rerender({ count: 2 });
    expect(fm.getClearCalls()).toBe(3);
  });

  it("re-fires when tileSize changes", () => {
    const fm = makeFakeManager();
    const refs = makeRefs({
      manager: fm.instance,
      querier: makeQuerier(),
      tiles: [{ tileX: 0, tileZ: 0 }],
    });
    const { rerender } = renderHook(
      ({ tileSize }: { tileSize: number }) =>
        useRegenerateFoliageOnPaintChange({
          foliagePaintCount: 0,
          tileSize,
          waterThreshold: 0.1,
          refs,
        }),
      { initialProps: { tileSize: 64 } },
    );
    expect(fm.getClearCalls()).toBe(1);

    rerender({ tileSize: 128 });
    expect(fm.getClearCalls()).toBe(2);
  });

  it("re-fires when waterThreshold changes", () => {
    const fm = makeFakeManager();
    const refs = makeRefs({
      manager: fm.instance,
      querier: makeQuerier(),
      tiles: [{ tileX: 0, tileZ: 0 }],
    });
    const { rerender } = renderHook(
      ({ wt }: { wt: number }) =>
        useRegenerateFoliageOnPaintChange({
          foliagePaintCount: 0,
          tileSize: 64,
          waterThreshold: wt,
          refs,
        }),
      { initialProps: { wt: 0.1 } },
    );
    expect(fm.getClearCalls()).toBe(1);

    rerender({ wt: 0.2 });
    expect(fm.getClearCalls()).toBe(2);
  });

  it("does NOT re-fire when identical deps are passed", () => {
    const fm = makeFakeManager();
    const refs = makeRefs({
      manager: fm.instance,
      querier: makeQuerier(),
      tiles: [{ tileX: 0, tileZ: 0 }],
    });
    const { rerender } = renderHook(
      ({ count }: { count: number }) =>
        useRegenerateFoliageOnPaintChange({
          foliagePaintCount: count,
          tileSize: 64,
          waterThreshold: 0.1,
          refs,
        }),
      { initialProps: { count: 5 } },
    );
    expect(fm.getClearCalls()).toBe(1);

    rerender({ count: 5 });
    expect(fm.getClearCalls()).toBe(1); // No change.
  });
});

describe("useRegenerateFoliageOnPaintChange — empty tile map", () => {
  it("clears but does not schedule when no tiles are loaded", () => {
    const fm = makeFakeManager();
    const refs = makeRefs({
      manager: fm.instance,
      querier: makeQuerier(),
      tiles: [],
    });
    renderHook(() =>
      useRegenerateFoliageOnPaintChange({
        foliagePaintCount: 1,
        tileSize: 64,
        waterThreshold: 0.1,
        refs,
      }),
    );
    expect(fm.getClearCalls()).toBe(1);
    expect(fm.scheduleCalls).toHaveLength(0);
  });
});
