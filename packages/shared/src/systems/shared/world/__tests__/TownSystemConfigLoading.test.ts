/**
 * Tests for TownSystem config loading from world-config.json
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DataManager } from "../../../../data/DataManager";
import type { WorldConfigManifest } from "../../../../types/world/world-types";
import { loadTownConfig } from "../TownSystem";
import { DEFAULT_LANDMARK_CONFIG } from "@hyperforge/procgen/building/town";

const DEFAULTS = {
  townCount: 25,
  worldSize: 10000,
  minTownSpacing: 800,
  flatnessSampleRadius: 40,
  flatnessSampleCount: 16,
  waterThreshold: 5.4,
  optimalWaterDistanceMin: 30,
  optimalWaterDistanceMax: 150,
} as const;

const DEFAULT_TOWN_SIZES = {
  hamlet: { buildingCount: { min: 3, max: 5 }, radius: 25, safeZoneRadius: 40 },
  village: {
    buildingCount: { min: 6, max: 10 },
    radius: 40,
    safeZoneRadius: 60,
  },
  town: { buildingCount: { min: 11, max: 16 }, radius: 60, safeZoneRadius: 80 },
};

const DEFAULT_BIOME_SUITABILITY: Record<string, number> = {
  forest: 0.8,
  tundra: 0.4,
  canyon: 0.3,
};

// Factory for creating test configs with minimal boilerplate
function makeConfig(
  overrides: {
    towns?: Partial<WorldConfigManifest["towns"]>;
    roads?: Partial<WorldConfigManifest["roads"]>;
  } = {},
): WorldConfigManifest {
  const baseTownSizes = {
    hamlet: {
      minBuildings: 3,
      maxBuildings: 5,
      radius: 25,
      safeZoneRadius: 40,
    },
    village: {
      minBuildings: 6,
      maxBuildings: 10,
      radius: 40,
      safeZoneRadius: 60,
    },
    town: {
      minBuildings: 11,
      maxBuildings: 16,
      radius: 60,
      safeZoneRadius: 80,
    },
  };
  return {
    version: 1,
    terrain: {
      tileSize: 100,
      worldSize: 10000,
      maxHeight: 30,
      waterThreshold: 5.4,
    },
    towns: {
      townCount: 25,
      minTownSpacing: 800,
      flatnessSampleRadius: 40,
      flatnessSampleCount: 16,
      waterThreshold: 5.4,
      optimalWaterDistanceMin: 30,
      optimalWaterDistanceMax: 150,
      townSizes: baseTownSizes,
      biomeSuitability: {},
      ...overrides.towns,
    },
    roads: {
      roadWidth: 4,
      pathStepSize: 20,
      maxPathIterations: 10000,
      extraConnectionsRatio: 0.25,
      costBase: 1.0,
      costSlopeMultiplier: 5.0,
      costWaterPenalty: 1000,
      smoothingIterations: 2,
      noiseDisplacementScale: 0.01,
      noiseDisplacementStrength: 3,
      minPointSpacing: 4,
      heuristicWeight: 2.5,
      costBiomeMultipliers: {},
      ...overrides.roads,
    },
  };
}

describe("TownSystem Config Loading", () => {
  let originalConfig: WorldConfigManifest | null = null;

  beforeEach(() => {
    originalConfig = DataManager.getWorldConfig();
  });
  afterEach(() => {
    if (originalConfig) DataManager.setWorldConfig(originalConfig);
  });

  describe("no manifest", () => {
    it("returns all defaults", () => {
      DataManager.setWorldConfig(null as unknown as WorldConfigManifest);
      const config = loadTownConfig();

      expect(config.townCount).toBe(DEFAULTS.townCount);
      expect(config.minTownSpacing).toBe(DEFAULTS.minTownSpacing);
      expect(config.townSizes.hamlet.buildingCount.min).toBe(
        DEFAULT_TOWN_SIZES.hamlet.buildingCount.min,
      );
      expect(config.biomeSuitability.forest).toBe(
        DEFAULT_BIOME_SUITABILITY.forest,
      );
      expect(config.landmarks).toEqual(DEFAULT_LANDMARK_CONFIG);
    });
  });

  describe("complete manifest", () => {
    it("uses config values", () => {
      DataManager.setWorldConfig(
        makeConfig({
          towns: {
            townCount: 50,
            minTownSpacing: 1000,
            flatnessSampleRadius: 50,
            flatnessSampleCount: 20,
            waterThreshold: 6.0,
            optimalWaterDistanceMin: 40,
            optimalWaterDistanceMax: 200,
            townSizes: {
              hamlet: {
                minBuildings: 4,
                maxBuildings: 6,
                radius: 30,
                safeZoneRadius: 45,
              },
              village: {
                minBuildings: 8,
                maxBuildings: 12,
                radius: 50,
                safeZoneRadius: 70,
              },
              town: {
                minBuildings: 15,
                maxBuildings: 20,
                radius: 70,
                safeZoneRadius: 90,
              },
            },
            biomeSuitability: { forest: 0.9, canyon: 0.5, tundra: 0.1 },
            landmarks: {
              fencesEnabled: false,
              fenceDensity: 0.25,
              fencePostHeight: 1.4,
              lamppostsInVillages: false,
              lamppostSpacing: 20,
              marketStallsEnabled: false,
              decorationsEnabled: true,
            },
          },
        }),
      );
      const config = loadTownConfig();

      expect(config.townCount).toBe(50);
      expect(config.minTownSpacing).toBe(1000);
      expect(config.townSizes.hamlet.buildingCount.min).toBe(4);
      expect(config.townSizes.town.safeZoneRadius).toBe(90);
      expect(config.biomeSuitability.forest).toBe(0.9);
      expect(config.biomeSuitability.tundra).toBe(0.1);
      expect(config.landmarks.fencesEnabled).toBe(false);
      expect(config.landmarks.lamppostSpacing).toBe(20);
    });
  });

  describe("partial manifest", () => {
    it("falls back to defaults for missing fields", () => {
      DataManager.setWorldConfig(
        makeConfig({
          towns: {
            townCount: 30,
            minTownSpacing: undefined as unknown as number,
            townSizes:
              undefined as unknown as WorldConfigManifest["towns"]["townSizes"],
          },
        }),
      );
      const config = loadTownConfig();

      expect(config.townCount).toBe(30);
      expect(config.minTownSpacing).toBe(DEFAULTS.minTownSpacing);
      expect(config.townSizes.hamlet.buildingCount).toEqual(
        DEFAULT_TOWN_SIZES.hamlet.buildingCount,
      );
    });
  });

  describe("boundary conditions", () => {
    it("handles zero and large values", () => {
      DataManager.setWorldConfig(makeConfig({ towns: { townCount: 0 } }));
      expect(loadTownConfig().townCount).toBe(0);

      DataManager.setWorldConfig(
        makeConfig({ towns: { townCount: 10000, minTownSpacing: 10 } }),
      );
      const config = loadTownConfig();
      expect(config.townCount).toBe(10000);
      expect(config.minTownSpacing).toBe(10);
    });

    it("handles biome suitability at 0.0 and 1.0", () => {
      DataManager.setWorldConfig(
        makeConfig({
          towns: {
            biomeSuitability: {
              perfect: 1.0,
              impossible: 0.0,
              epsilon: 0.000001,
            },
          },
        }),
      );
      const config = loadTownConfig();

      expect(config.biomeSuitability.perfect).toBe(1.0);
      expect(config.biomeSuitability.impossible).toBe(0.0);
      expect(config.biomeSuitability.epsilon).toBeCloseTo(0.000001, 10);
    });
  });

  describe("edge cases", () => {
    it("accepts negative values (validation at usage time)", () => {
      DataManager.setWorldConfig(
        makeConfig({
          towns: {
            townCount: -5,
            minTownSpacing: -100,
            townSizes: {
              hamlet: {
                minBuildings: -3,
                maxBuildings: -5,
                radius: -25,
                safeZoneRadius: -40,
              },
              village: {
                minBuildings: 6,
                maxBuildings: 10,
                radius: 40,
                safeZoneRadius: 60,
              },
              town: {
                minBuildings: 11,
                maxBuildings: 16,
                radius: 60,
                safeZoneRadius: 80,
              },
            },
            biomeSuitability: { negativeBiome: -0.5 },
          },
        }),
      );
      const config = loadTownConfig();

      expect(config.townCount).toBe(-5);
      expect(config.townSizes.hamlet.buildingCount.min).toBe(-3);
      expect(config.biomeSuitability.negativeBiome).toBe(-0.5);
    });

    it("only supports predefined town sizes", () => {
      DataManager.setWorldConfig(
        makeConfig({
          towns: {
            townSizes: {
              hamlet: {
                minBuildings: 3,
                maxBuildings: 5,
                radius: 25,
                safeZoneRadius: 40,
              },
              village: {
                minBuildings: 6,
                maxBuildings: 10,
                radius: 40,
                safeZoneRadius: 60,
              },
              town: {
                minBuildings: 11,
                maxBuildings: 16,
                radius: 60,
                safeZoneRadius: 80,
              },
              metropolis: {
                minBuildings: 50,
                maxBuildings: 100,
                radius: 150,
                safeZoneRadius: 200,
              },
            } as unknown as WorldConfigManifest["towns"]["townSizes"],
          },
        }),
      );
      const config = loadTownConfig();

      expect(Object.keys(config.townSizes)).toEqual([
        "hamlet",
        "village",
        "town",
      ]);
    });
  });

  describe("config consistency", () => {
    it("worldSize always uses default", () => {
      DataManager.setWorldConfig(makeConfig());
      expect(loadTownConfig().worldSize).toBe(DEFAULTS.worldSize);
    });

    it("multiple loads return consistent results", () => {
      DataManager.setWorldConfig(
        makeConfig({ towns: { townCount: 42, minTownSpacing: 900 } }),
      );

      const c1 = loadTownConfig();
      const c2 = loadTownConfig();

      expect(c1.townCount).toBe(c2.townCount);
      expect(c1.minTownSpacing).toBe(c2.minTownSpacing);
    });
  });
});
