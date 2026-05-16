/**
 * `useMaxHeightRescale` — fast-path Y-scale tests.
 *
 * Pins the lifecycle the hook fixes: prev-ref managed entirely
 * inside the hook (initialized to current, updated only by this
 * effect), bail conditions for no-change / non-finite / zero
 * scale, per-tile rescaleVertexY application.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three/webgpu";

import { useMaxHeightRescale } from "../useMaxHeightRescale";

// Mock rescaleVertexY so tests don't depend on its internals — we
// just want to know it was called with the right scale.
vi.mock("../rescaleVertexY", () => ({
  rescaleVertexY: vi.fn(),
}));

import { rescaleVertexY } from "../rescaleVertexY";

interface TestTile {
  mesh: THREE.Mesh;
}

function makeTile(): TestTile {
  return {
    mesh: new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial(),
    ),
  };
}

describe("useMaxHeightRescale — initial render", () => {
  it("is a no-op on the first render (prev === current)", () => {
    vi.mocked(rescaleVertexY).mockClear();
    const tiles = new Map([["0,0", makeTile()]]);

    renderHook(() =>
      useMaxHeightRescale({
        maxHeight: 200,
        hostRefs: { tilesRef: { current: tiles } },
      }),
    );

    expect(rescaleVertexY).not.toHaveBeenCalled();
  });
});

describe("useMaxHeightRescale — maxHeight changes", () => {
  it("applies rescaleVertexY to every tile with the correct ratio", () => {
    vi.mocked(rescaleVertexY).mockClear();
    const tile1 = makeTile();
    const tile2 = makeTile();
    const tiles = new Map([
      ["0,0", tile1],
      ["1,0", tile2],
    ]);

    const { rerender } = renderHook(
      ({ maxHeight }: { maxHeight: number }) =>
        useMaxHeightRescale({
          maxHeight,
          hostRefs: { tilesRef: { current: tiles } },
        }),
      { initialProps: { maxHeight: 200 } },
    );

    rerender({ maxHeight: 300 });

    // ratio = 300/200 = 1.5
    expect(rescaleVertexY).toHaveBeenCalledTimes(2);
    expect(rescaleVertexY).toHaveBeenNthCalledWith(1, tile1.mesh.geometry, 1.5);
    expect(rescaleVertexY).toHaveBeenNthCalledWith(2, tile2.mesh.geometry, 1.5);
  });

  it("uses the previous render's value (not the next one) for the prev-ref", () => {
    // This is the actual bug fix: prev tracks the last-seen value
    // EXCLUSIVELY through this hook's lifecycle. Validate by
    // chaining 3 changes.
    vi.mocked(rescaleVertexY).mockClear();
    const tile = makeTile();
    const tiles = new Map([["0,0", tile]]);

    const { rerender } = renderHook(
      ({ maxHeight }: { maxHeight: number }) =>
        useMaxHeightRescale({
          maxHeight,
          hostRefs: { tilesRef: { current: tiles } },
        }),
      { initialProps: { maxHeight: 100 } },
    );

    rerender({ maxHeight: 200 });
    // ratio: 200/100 = 2
    expect(rescaleVertexY).toHaveBeenLastCalledWith(tile.mesh.geometry, 2);

    rerender({ maxHeight: 50 });
    // ratio: 50/200 = 0.25
    expect(rescaleVertexY).toHaveBeenLastCalledWith(tile.mesh.geometry, 0.25);

    rerender({ maxHeight: 400 });
    // ratio: 400/50 = 8
    expect(rescaleVertexY).toHaveBeenLastCalledWith(tile.mesh.geometry, 8);

    expect(rescaleVertexY).toHaveBeenCalledTimes(3);
  });

  it("same-value rerender is a no-op (verifies prev-ref updates on each change)", () => {
    vi.mocked(rescaleVertexY).mockClear();
    const tiles = new Map([["0,0", makeTile()]]);

    const { rerender } = renderHook(
      ({ maxHeight }: { maxHeight: number }) =>
        useMaxHeightRescale({
          maxHeight,
          hostRefs: { tilesRef: { current: tiles } },
        }),
      { initialProps: { maxHeight: 100 } },
    );

    rerender({ maxHeight: 200 });
    expect(rescaleVertexY).toHaveBeenCalledTimes(1);

    rerender({ maxHeight: 200 }); // same → no-op
    expect(rescaleVertexY).toHaveBeenCalledTimes(1);

    rerender({ maxHeight: 200 }); // same again
    expect(rescaleVertexY).toHaveBeenCalledTimes(1);
  });
});

describe("useMaxHeightRescale — bail conditions", () => {
  it("bails when prev maxHeight is 0 (division would produce Infinity)", () => {
    vi.mocked(rescaleVertexY).mockClear();
    const tiles = new Map([["0,0", makeTile()]]);

    const { rerender } = renderHook(
      ({ maxHeight }: { maxHeight: number }) =>
        useMaxHeightRescale({
          maxHeight,
          hostRefs: { tilesRef: { current: tiles } },
        }),
      { initialProps: { maxHeight: 0 } },
    );

    rerender({ maxHeight: 100 });
    // 100/0 = Infinity → !isFinite bail.
    expect(rescaleVertexY).not.toHaveBeenCalled();
  });

  it("bails when newMaxHeight is 0 (scale === 0 sentinel)", () => {
    vi.mocked(rescaleVertexY).mockClear();
    const tiles = new Map([["0,0", makeTile()]]);

    const { rerender } = renderHook(
      ({ maxHeight }: { maxHeight: number }) =>
        useMaxHeightRescale({
          maxHeight,
          hostRefs: { tilesRef: { current: tiles } },
        }),
      { initialProps: { maxHeight: 100 } },
    );

    rerender({ maxHeight: 0 });
    expect(rescaleVertexY).not.toHaveBeenCalled();
  });

  it("handles missing tilesRef.current gracefully", () => {
    vi.mocked(rescaleVertexY).mockClear();
    const { rerender } = renderHook(
      ({ maxHeight }: { maxHeight: number }) =>
        useMaxHeightRescale({
          maxHeight,
          hostRefs: {
            tilesRef: { current: null as unknown as Map<string, TestTile> },
          },
        }),
      { initialProps: { maxHeight: 100 } },
    );

    expect(() => rerender({ maxHeight: 200 })).not.toThrow();
    expect(rescaleVertexY).not.toHaveBeenCalled();
  });
});
