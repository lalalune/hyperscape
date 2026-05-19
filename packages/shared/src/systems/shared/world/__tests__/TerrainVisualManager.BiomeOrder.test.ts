/**
 * TerrainVisualManager — biome-order plumbing tests.
 *
 * Phase 2.1 follow-up cut 2 pins the contract for the new
 * `setBiomeOrder` API and the optional `biomeOrder` parameter on
 * `updateBiomeData`. The worker reads `biomeOrder` to compute
 * per-vertex `biomeIndices` into a palette texture; getting the
 * ordering wrong silently produces miscolored terrain. These
 * tests lock the bookkeeping so future changes can't drift
 * shader sampling from worker emission.
 *
 * The tests poke into a minimal `TerrainVisualManager` instance
 * without running the renderer or worker — just verifying the
 * field bookkeeping. The full worker round-trip is covered by
 * `TerrainQuadChunkGenerator.NChannel.test.ts`.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";

import { TerrainVisualManager } from "../TerrainVisualManager";
import type { QuadChunkWorkerOutput } from "../../../../utils/workers/QuadChunkWorker";

function makeStubProvider() {
  return {
    TILE_SIZE: 100,
    getTileFromWorldPosition: () => ({ tileX: 0, tileZ: 0 }),
    calculateRoadInfluenceAtVertex: () => 0,
    getFlatZoneHeight: () => null,
    getHeightAtComputed: () => 0,
    computeBiomeWeightsAtPosition: () => ({
      biomeWeightMap: new Map<string, number>([["tundra", 1]]),
      totalWeight: 1,
    }),
    computeBiomeWeightsByPosition: () => ({ tundra: 1 }),
    getBiomeId: () => 0,
    getBiomeColor: () => ({ r: 0.5, g: 0.5, b: 0.5 }),
    WATER_LEVEL_NORMALIZED: 0.16,
    SHORELINE_THRESHOLD: 0.18,
    SHORELINE_STRENGTH: 0.3,
    MAX_HEIGHT: 50,
  };
}

function makeWorkerConfig(): Parameters<typeof TerrainVisualManager>[4] {
  return {
    MAX_HEIGHT: 50,
    BIOME_GAUSSIAN_COEFF: 0.0001,
    BIOME_BOUNDARY_NOISE_SCALE: 0.01,
    BIOME_BOUNDARY_NOISE_AMOUNT: 0.5,
    WATER_THRESHOLD: 16,
    WATER_LEVEL_NORMALIZED: 0.32,
    SHORELINE_THRESHOLD: 0.36,
    SHORELINE_STRENGTH: 0.3,
    SHORELINE_MIN_SLOPE: 0.1,
    SHORELINE_SLOPE_SAMPLE_DISTANCE: 1,
    SHORELINE_LAND_BAND: 0.05,
    SHORELINE_LAND_MAX_MULTIPLIER: 2,
    SHORELINE_UNDERWATER_BAND: 0.05,
    UNDERWATER_DEPTH_MULTIPLIER: 0.5,
  };
}

function makeManager() {
  const provider = makeStubProvider();
  const container = new THREE.Group();
  const material = new THREE.MeshBasicMaterial();
  const biomeCenters: QuadChunkWorkerOutput[] = [];
  const biomes = { tundra: { color: { r: 0.7, g: 0.7, b: 0.7 } } };

  return new TerrainVisualManager(
    {
      minSize: 100,
      maxDepth: 4,
      splitRatio: 1.5,
      unsplitMultiplier: 1.0,
      resolution: 32,
      skirtDrop: 1.0,
    },
    provider,
    container,
    material,
    makeWorkerConfig(),
    /* workerSeed */ 1,
    /* biomeCenters */ biomeCenters as Parameters<
      typeof TerrainVisualManager
    >[6],
    /* workerBiomes */ biomes,
  );
}

describe("TerrainVisualManager.setBiomeOrder", () => {
  let mgr: TerrainVisualManager;
  beforeEach(() => {
    mgr = makeManager();
  });

  it("stores an explicit biome order array", () => {
    const order = ["tundra", "forest", "canyon"];
    mgr.setBiomeOrder(order);
    // Privately read the field — verify storage. The contract
    // is that the worker input includes this array on the next
    // dispatch; testing the input shape ahead of dispatch is
    // sufficient.
    const stored = (
      mgr as unknown as {
        workerBiomeOrder: ReadonlyArray<string> | undefined;
      }
    ).workerBiomeOrder;
    expect(stored).toEqual(["tundra", "forest", "canyon"]);
  });

  it("undefined clears any previously stored order", () => {
    mgr.setBiomeOrder(["tundra", "forest"]);
    mgr.setBiomeOrder(undefined);
    const stored = (
      mgr as unknown as {
        workerBiomeOrder: ReadonlyArray<string> | undefined;
      }
    ).workerBiomeOrder;
    expect(stored).toBeUndefined();
  });

  it("starts as undefined (falls back to 3-channel legacy path)", () => {
    const stored = (
      mgr as unknown as {
        workerBiomeOrder: ReadonlyArray<string> | undefined;
      }
    ).workerBiomeOrder;
    expect(stored).toBeUndefined();
  });

  it("replaces order entirely on each call (no merge)", () => {
    mgr.setBiomeOrder(["tundra", "forest", "canyon"]);
    mgr.setBiomeOrder(["volcanic", "arctic"]);
    const stored = (
      mgr as unknown as {
        workerBiomeOrder: ReadonlyArray<string>;
      }
    ).workerBiomeOrder;
    expect(stored).toEqual(["volcanic", "arctic"]);
  });
});

describe("TerrainVisualManager.updateBiomeData — biomeOrder param", () => {
  let mgr: TerrainVisualManager;
  beforeEach(() => {
    mgr = makeManager();
  });

  it("preserves prior biome order when called without biomeOrder", () => {
    mgr.setBiomeOrder(["tundra", "forest", "canyon"]);
    mgr.updateBiomeData([], { tundra: { color: { r: 0, g: 0, b: 0 } } });
    const stored = (
      mgr as unknown as {
        workerBiomeOrder: ReadonlyArray<string>;
      }
    ).workerBiomeOrder;
    expect(stored).toEqual(["tundra", "forest", "canyon"]);
  });

  it("overwrites biome order when an explicit array is passed", () => {
    mgr.setBiomeOrder(["tundra"]);
    mgr.updateBiomeData(
      [],
      { volcanic: { color: { r: 0.8, g: 0.2, b: 0.1 } } },
      ["volcanic"],
    );
    const stored = (
      mgr as unknown as {
        workerBiomeOrder: ReadonlyArray<string>;
      }
    ).workerBiomeOrder;
    expect(stored).toEqual(["volcanic"]);
  });

  it("treats an empty-array biomeOrder as a real overwrite (not preserve)", () => {
    mgr.setBiomeOrder(["tundra", "forest"]);
    mgr.updateBiomeData([], {}, []);
    const stored = (
      mgr as unknown as {
        workerBiomeOrder: ReadonlyArray<string>;
      }
    ).workerBiomeOrder;
    expect(stored).toEqual([]);
  });
});
