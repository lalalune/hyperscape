/**
 * `useWaterThresholdSync` — fast-path water-plane move tests.
 *
 * Pins the bail conditions (unchanged value), the prev-ref
 * self-management, and the position.y sweep over both world-
 * sized plane containers (studio mode) and per-tile water
 * meshes (standalone mode).
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as THREE from "three/webgpu";

import { useWaterThresholdSync } from "../useWaterThresholdSync";

interface FakeTile {
  water: THREE.Mesh | null;
}

function makeWater(y = 0): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial(),
  );
  m.position.y = y;
  return m;
}

describe("useWaterThresholdSync — initial render", () => {
  it("is a no-op on the first render (prev === current)", () => {
    const water1 = makeWater(0);
    const tile1: FakeTile = { water: makeWater(0) };
    const tiles = new Map([["0,0", tile1]]);
    const wc = new THREE.Group();
    wc.add(water1);

    renderHook(() =>
      useWaterThresholdSync({
        waterThreshold: 5,
        hostRefs: {
          waterContainerRef: { current: wc },
          tilesRef: { current: tiles },
        },
      }),
    );

    // Initial render: prev is initialized to current waterThreshold,
    // bail condition triggers, nothing moves.
    expect(water1.position.y).toBe(0);
    expect(tile1.water!.position.y).toBe(0);
  });
});

describe("useWaterThresholdSync — threshold change", () => {
  it("sweeps every container child's position.y to the new threshold", () => {
    const waterA = makeWater(0);
    const waterB = makeWater(0);
    const wc = new THREE.Group();
    wc.add(waterA);
    wc.add(waterB);

    const { rerender } = renderHook(
      ({ waterThreshold }: { waterThreshold: number }) =>
        useWaterThresholdSync({
          waterThreshold,
          hostRefs: {
            waterContainerRef: { current: wc },
            tilesRef: { current: new Map() },
          },
        }),
      { initialProps: { waterThreshold: 0 } },
    );

    rerender({ waterThreshold: 12 });

    expect(waterA.position.y).toBe(12);
    expect(waterB.position.y).toBe(12);
  });

  it("sweeps every loaded tile's water.position.y", () => {
    const tile1: FakeTile = { water: makeWater(0) };
    const tile2: FakeTile = { water: makeWater(0) };
    const tile3WithoutWater: FakeTile = { water: null };
    const tiles = new Map([
      ["0,0", tile1],
      ["1,0", tile2],
      ["2,0", tile3WithoutWater],
    ]);

    const { rerender } = renderHook(
      ({ waterThreshold }: { waterThreshold: number }) =>
        useWaterThresholdSync({
          waterThreshold,
          hostRefs: {
            waterContainerRef: { current: null },
            tilesRef: { current: tiles },
          },
        }),
      { initialProps: { waterThreshold: 0 } },
    );

    rerender({ waterThreshold: 7 });

    expect(tile1.water!.position.y).toBe(7);
    expect(tile2.water!.position.y).toBe(7);
    // Tile with null water is skipped without error.
    expect(tile3WithoutWater.water).toBeNull();
  });

  it("handles null waterContainerRef and missing tilesRef gracefully", () => {
    const { rerender } = renderHook(
      ({ waterThreshold }: { waterThreshold: number }) =>
        useWaterThresholdSync({
          waterThreshold,
          hostRefs: {
            waterContainerRef: { current: null },
            tilesRef: { current: new Map() },
          },
        }),
      { initialProps: { waterThreshold: 0 } },
    );

    expect(() => rerender({ waterThreshold: 7 })).not.toThrow();
  });
});

describe("useWaterThresholdSync — repeated changes", () => {
  it("each change moves planes to the new value", () => {
    const water = makeWater(0);
    const wc = new THREE.Group();
    wc.add(water);

    const { rerender } = renderHook(
      ({ waterThreshold }: { waterThreshold: number }) =>
        useWaterThresholdSync({
          waterThreshold,
          hostRefs: {
            waterContainerRef: { current: wc },
            tilesRef: { current: new Map() },
          },
        }),
      { initialProps: { waterThreshold: 0 } },
    );

    rerender({ waterThreshold: 5 });
    expect(water.position.y).toBe(5);
    rerender({ waterThreshold: 10 });
    expect(water.position.y).toBe(10);
    rerender({ waterThreshold: -3 });
    expect(water.position.y).toBe(-3);
  });

  it("re-render with same value is a no-op (verified via setter on a mutable mesh)", () => {
    const water = makeWater(0);
    const wc = new THREE.Group();
    wc.add(water);

    const { rerender } = renderHook(
      ({ waterThreshold }: { waterThreshold: number }) =>
        useWaterThresholdSync({
          waterThreshold,
          hostRefs: {
            waterContainerRef: { current: wc },
            tilesRef: { current: new Map() },
          },
        }),
      { initialProps: { waterThreshold: 0 } },
    );

    rerender({ waterThreshold: 5 });
    expect(water.position.y).toBe(5);

    // Externally tamper with the mesh's Y; if the hook re-ran on
    // same-value rerender it would clobber our 999.
    water.position.y = 999;
    rerender({ waterThreshold: 5 });
    expect(water.position.y).toBe(999);
  });
});
