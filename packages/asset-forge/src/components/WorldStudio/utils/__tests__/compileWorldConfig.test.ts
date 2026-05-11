/**
 * `compileWorldConfig` — world-config.json compilation tests.
 *
 * Maps WorldCreationConfig → WorldConfigManifest the runtime
 * client reads. Includes hardcoded runtime defaults
 * (fogNear=150, fogFar=350, cameraFar=400, etc.) that the
 * game's TerrainSystem / TownSystem / VegetationSystem
 * depend on. Tests pin the constants + the field flow from
 * studio config → manifest.
 */

import { describe, expect, it } from "vitest";
import { compileWorldConfig } from "../manifestCompiler";
import type { WorldData } from "../../WorldBuilder/types";

function makeWorld(
  overrides: {
    seed?: number;
    terrain?: Record<string, unknown>;
    towns?: Record<string, unknown>;
    roads?: Record<string, unknown>;
  } = {},
): WorldData {
  return {
    foundation: {
      config: {
        seed: 42,
        terrain: {
          tileSize: 32,
          worldSize: 100,
          tileResolution: 32,
          maxHeight: 200,
          waterThreshold: 8,
          ...overrides.terrain,
        },
        towns: {
          townCount: 5,
          minTownSpacing: 100,
          biomePreferences: {},
          ...overrides.towns,
        },
        roads: {
          roadWidth: 6,
          pathStepSize: 4,
          extraConnectionsRatio: 0.3,
          smoothingIterations: 2,
          costSlopeMultiplier: 1.5,
          costWaterPenalty: 10,
          heuristicWeight: 1.0,
          ...overrides.roads,
        },
        ...(overrides.seed !== undefined ? { seed: overrides.seed } : {}),
      },
      biomes: [],
      towns: [],
    },
    layers: {} as never,
    metadata: {} as never,
  } as unknown as WorldData;
}

describe("compileWorldConfig — top-level shape", () => {
  it("emits version 1", () => {
    const result = compileWorldConfig(makeWorld());
    expect(result.version).toBe(1);
  });

  it("flows seed from foundation.config.seed", () => {
    const result = compileWorldConfig(makeWorld({ seed: 12345 }));
    expect(result.seed).toBe(12345);
  });

  it("emits 4 top-level sections (version, seed, terrain, towns, roads)", () => {
    const result = compileWorldConfig(makeWorld());
    expect(Object.keys(result).sort()).toEqual([
      "roads",
      "seed",
      "terrain",
      "towns",
      "version",
    ]);
  });
});

describe("compileWorldConfig — terrain section", () => {
  it("flows tileSize, worldSize, tileResolution, maxHeight, waterThreshold", () => {
    const result = compileWorldConfig(
      makeWorld({
        terrain: {
          tileSize: 64,
          worldSize: 50,
          tileResolution: 16,
          maxHeight: 500,
          waterThreshold: 12,
        },
      }),
    );
    const terrain = result.terrain as Record<string, unknown>;
    expect(terrain.tileSize).toBe(64);
    expect(terrain.worldSize).toBe(50);
    expect(terrain.tileResolution).toBe(16);
    expect(terrain.maxHeight).toBe(500);
    expect(terrain.waterThreshold).toBe(12);
  });

  it("hardcodes runtime constants: biomeScale=1.0, fogNear=150, fogFar=350, cameraFar=400", () => {
    const terrain = compileWorldConfig(makeWorld()).terrain as Record<
      string,
      unknown
    >;
    expect(terrain.biomeScale).toBe(1.0);
    expect(terrain.fogNear).toBe(150);
    expect(terrain.fogFar).toBe(350);
    expect(terrain.cameraFar).toBe(400);
  });
});

describe("compileWorldConfig — towns section", () => {
  it("flows townCount, minTownSpacing from studio config", () => {
    const result = compileWorldConfig(
      makeWorld({
        towns: {
          townCount: 12,
          minTownSpacing: 200,
        },
      }),
    );
    const towns = result.towns as Record<string, unknown>;
    expect(towns.townCount).toBe(12);
    expect(towns.minTownSpacing).toBe(200);
  });

  it("emits hardcoded sampling + water-distance constants", () => {
    const towns = compileWorldConfig(makeWorld()).towns as Record<
      string,
      unknown
    >;
    expect(towns.flatnessSampleRadius).toBe(40);
    expect(towns.flatnessSampleCount).toBe(16);
    expect(towns.optimalWaterDistanceMin).toBe(30);
    expect(towns.optimalWaterDistanceMax).toBe(150);
  });

  it("emits the 3-size town config table (hamlet / village / town)", () => {
    const towns = compileWorldConfig(makeWorld()).towns as Record<
      string,
      unknown
    >;
    const sizes = towns.townSizes as Record<
      string,
      { minBuildings: number; maxBuildings: number; radius: number }
    >;
    expect(sizes.hamlet).toEqual({
      minBuildings: 2,
      maxBuildings: 4,
      radius: 30,
    });
    expect(sizes.village).toEqual({
      minBuildings: 4,
      maxBuildings: 8,
      radius: 50,
    });
    expect(sizes.town).toEqual({
      minBuildings: 8,
      maxBuildings: 16,
      radius: 80,
    });
  });

  it("defaults biomeSuitability to {} when studio config omits biomePreferences", () => {
    // Force studio config's biomePreferences to undefined.
    const result = compileWorldConfig(
      makeWorld({
        towns: { biomePreferences: undefined } as never,
      }),
    );
    const towns = result.towns as Record<string, unknown>;
    expect(towns.biomeSuitability).toEqual({});
  });

  it("flows biomePreferences → biomeSuitability when set", () => {
    const result = compileWorldConfig(
      makeWorld({
        towns: {
          biomePreferences: { plains: 1.0, desert: 0.2 },
        },
      }),
    );
    const towns = result.towns as Record<string, unknown>;
    expect(towns.biomeSuitability).toEqual({ plains: 1.0, desert: 0.2 });
  });

  it("waterThreshold matches terrain.waterThreshold (consistency)", () => {
    const result = compileWorldConfig(
      makeWorld({
        terrain: { waterThreshold: 15 },
      }),
    );
    const terrain = result.terrain as Record<string, unknown>;
    const towns = result.towns as Record<string, unknown>;
    expect(towns.waterThreshold).toBe(terrain.waterThreshold);
  });
});

describe("compileWorldConfig — roads section", () => {
  it("flows roadWidth, pathStepSize, extraConnectionsRatio, smoothingIterations", () => {
    const result = compileWorldConfig(
      makeWorld({
        roads: {
          roadWidth: 10,
          pathStepSize: 8,
          extraConnectionsRatio: 0.5,
          smoothingIterations: 3,
        },
      }),
    );
    const roads = result.roads as Record<string, unknown>;
    expect(roads.roadWidth).toBe(10);
    expect(roads.pathStepSize).toBe(8);
    expect(roads.extraConnectionsRatio).toBe(0.5);
    expect(roads.smoothingIterations).toBe(3);
  });

  it("flows cost params (costSlopeMultiplier, costWaterPenalty, heuristicWeight)", () => {
    const result = compileWorldConfig(
      makeWorld({
        roads: {
          costSlopeMultiplier: 2.5,
          costWaterPenalty: 20,
          heuristicWeight: 0.8,
        },
      }),
    );
    const roads = result.roads as Record<string, unknown>;
    expect(roads.costSlopeMultiplier).toBe(2.5);
    expect(roads.costWaterPenalty).toBe(20);
    expect(roads.heuristicWeight).toBe(0.8);
  });

  it("emits hardcoded path-search constants", () => {
    const roads = compileWorldConfig(makeWorld()).roads as Record<
      string,
      unknown
    >;
    expect(roads.maxPathIterations).toBe(10000);
    expect(roads.noiseDisplacementScale).toBe(0.01);
    expect(roads.noiseDisplacementStrength).toBe(3);
    expect(roads.minPointSpacing).toBe(4);
    expect(roads.costBase).toBe(1.0);
  });
});
