/**
 * `useMarkDirtyTilesOnArrayChange` — pattern-shared "prop array
 * changed → mark loaded tiles dirty" tests.
 *
 * Pins the bail conditions (unchanged ref, undefined, empty,
 * no-tiles), the mirror-ref sync, and the dirty-key write.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMarkDirtyTilesOnArrayChange } from "../useMarkDirtyTilesOnArrayChange";
import type { MarkableTile } from "../markDirtyTilesByDistance";

interface TestTile extends MarkableTile {
  tileX: number;
  tileZ: number;
}

function tile(tileX: number, tileZ: number): TestTile {
  return { tileX, tileZ };
}

function makeRefs(loadedTiles: Array<[string, TestTile]> = []): {
  runtimeRef: { current: unknown[] | undefined };
  tilesRef: { current: Map<string, TestTile> };
  lastCameraTileRef: { current: { tileX: number; tileZ: number } };
  dirtyTileKeysRef: { current: string[] };
} {
  return {
    runtimeRef: { current: undefined },
    tilesRef: { current: new Map(loadedTiles) },
    lastCameraTileRef: { current: { tileX: 0, tileZ: 0 } },
    dirtyTileKeysRef: { current: [] },
  };
}

describe("useMarkDirtyTilesOnArrayChange — bail conditions", () => {
  it("no-op when items is undefined", () => {
    const refs = makeRefs([["0,0", tile(0, 0)]]);
    renderHook(() =>
      useMarkDirtyTilesOnArrayChange({
        items: undefined,
        label: "Roads",
        runtimeRef: refs.runtimeRef,
        hostRefs: refs,
      }),
    );
    expect(refs.dirtyTileKeysRef.current).toEqual([]);
    // runtimeRef still gets the undefined sync.
    expect(refs.runtimeRef.current).toBeUndefined();
  });

  it("no-op when items is empty", () => {
    const refs = makeRefs([["0,0", tile(0, 0)]]);
    renderHook(() =>
      useMarkDirtyTilesOnArrayChange({
        items: [],
        label: "Roads",
        runtimeRef: refs.runtimeRef,
        hostRefs: refs,
      }),
    );
    expect(refs.dirtyTileKeysRef.current).toEqual([]);
  });

  it("no-op when no tiles are loaded", () => {
    const refs = makeRefs([]); // empty Map
    renderHook(() =>
      useMarkDirtyTilesOnArrayChange({
        items: [{ id: "r1" }],
        label: "Roads",
        runtimeRef: refs.runtimeRef,
        hostRefs: refs,
      }),
    );
    expect(refs.dirtyTileKeysRef.current).toEqual([]);
  });

  it("no-op on re-render with the same array reference", () => {
    const refs = makeRefs([["0,0", tile(0, 0)]]);
    const items = [{ id: "r1" }];
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { rerender } = renderHook(
      ({ items }: { items: Array<{ id: string }> | undefined }) =>
        useMarkDirtyTilesOnArrayChange({
          items,
          label: "Roads",
          runtimeRef: refs.runtimeRef,
          hostRefs: refs,
        }),
      { initialProps: { items } },
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);

    // Same array reference → no extra log.
    rerender({ items });
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });
});

describe("useMarkDirtyTilesOnArrayChange — happy path", () => {
  it("syncs runtimeRef to the current items array", () => {
    const refs = makeRefs([["0,0", tile(0, 0)]]);
    const items = [{ id: "r1" }, { id: "r2" }];
    renderHook(() =>
      useMarkDirtyTilesOnArrayChange({
        items,
        label: "Roads",
        runtimeRef: refs.runtimeRef,
        hostRefs: refs,
      }),
    );
    expect(refs.runtimeRef.current).toBe(items);
  });

  it("writes prioritized dirty-key list to dirtyTileKeysRef when items+tiles+camera present", () => {
    const refs = makeRefs([
      ["0,0", tile(0, 0)],
      ["1,1", tile(1, 1)],
      ["5,5", tile(5, 5)],
    ]);
    renderHook(() =>
      useMarkDirtyTilesOnArrayChange({
        items: [{ id: "m1" }],
        label: "Mines",
        runtimeRef: refs.runtimeRef,
        hostRefs: refs,
      }),
    );
    // markDirtyTilesByDistance returns all 3 keys, ordered by distance
    // from the camera at (0,0). Closest first: 0,0 then 1,1 then 5,5.
    expect(refs.dirtyTileKeysRef.current).toEqual(["0,0", "1,1", "5,5"]);
  });

  it("logs the change with the supplied label", () => {
    const refs = makeRefs([["0,0", tile(0, 0)]]);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    renderHook(() =>
      useMarkDirtyTilesOnArrayChange({
        items: [{ id: "x" }, { id: "y" }],
        label: "Mines",
        runtimeRef: refs.runtimeRef,
        hostRefs: refs,
      }),
    );
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const msg = consoleSpy.mock.calls[0][0] as string;
    expect(msg).toContain("Mines changed");
    expect(msg).toContain("1 tiles dirty");
    expect(msg).toContain("2 mines");
    consoleSpy.mockRestore();
  });

  it("re-runs when items reference changes", () => {
    const refs = makeRefs([["0,0", tile(0, 0)]]);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { rerender } = renderHook(
      ({ items }: { items: Array<{ id: string }> }) =>
        useMarkDirtyTilesOnArrayChange({
          items,
          label: "Roads",
          runtimeRef: refs.runtimeRef,
          hostRefs: refs,
        }),
      { initialProps: { items: [{ id: "r1" }] } },
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);

    // Pass a NEW array reference — effect re-runs.
    rerender({ items: [{ id: "r1" }, { id: "r2" }] });
    expect(consoleSpy).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore();
  });
});
