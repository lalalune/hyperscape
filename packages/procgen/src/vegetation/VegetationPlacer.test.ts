/**
 * VegetationPlacer Tests
 *
 * Tests for procedural vegetation placement.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VegetationPlacer } from "./VegetationPlacer";
import type {
  VegetationAsset,
  BiomeVegetationConfig,
  VegetationTerrainProvider,
} from "./types";
import { createVegetationTerrainProvider } from "./types";

// Mock terrain provider
const createMockTerrain = (
  seed: number = 12345,
): VegetationTerrainProvider => ({
  getHeightAt: (x: number, z: number): number => {
    // Simple deterministic height function - high enough to avoid water
    const hash = Math.sin(x * 0.01 + seed) * Math.cos(z * 0.01 + seed);
    return 20 + hash * 5; // Heights between 15 and 25 (well above water threshold)
  },
  getBiomeAt: (x: number, z: number): string => {
    // Quadrant-based biomes for testing
    if (x >= 0 && z >= 0) return "plains";
    if (x < 0 && z >= 0) return "forest";
    if (x < 0 && z < 0) return "valley";
    return "mountains";
  },
  getWaterThreshold: () => 5.4,
});

// Sample assets
const SAMPLE_ASSETS: VegetationAsset[] = [
  {
    id: "tree_oak",
    category: "tree",
    model: "trees/oak.glb",
    baseScale: 1.0,
    scaleVariation: [0.8, 1.2],
    weight: 10,
    randomRotation: true,
  },
  {
    id: "tree_pine",
    category: "tree",
    model: "trees/pine.glb",
    baseScale: 1.2,
    scaleVariation: [0.9, 1.1],
    weight: 8,
    randomRotation: true,
    biomes: ["forest", "mountains"],
  },
  {
    id: "bush_small",
    category: "bush",
    model: "bushes/small.glb",
    baseScale: 0.5,
    scaleVariation: [0.7, 1.3],
    weight: 15,
    randomRotation: true,
  },
  {
    id: "grass_tuft",
    category: "grass",
    model: "grass/tuft.glb",
    baseScale: 0.3,
    scaleVariation: [0.8, 1.2],
    weight: 20,
    randomRotation: true,
  },
];

// Sample biome configs
const SAMPLE_BIOME_CONFIGS: BiomeVegetationConfig[] = [
  {
    biomeId: "plains",
    name: "Plains",
    layers: [
      {
        category: "tree",
        density: 10,
        minSpacing: 15,
        noiseScale: 0.02,
        noiseThreshold: 0.4,
      },
      {
        category: "bush",
        density: 30,
        minSpacing: 5,
        noiseScale: 0.05,
        noiseThreshold: 0.3,
      },
      {
        category: "grass",
        density: 100,
        minSpacing: 2,
        noiseScale: 0.1,
        noiseThreshold: 0.2,
      },
    ],
  },
  {
    biomeId: "forest",
    name: "Forest",
    layers: [
      {
        category: "tree",
        density: 50,
        minSpacing: 8,
        noiseScale: 0.03,
        noiseThreshold: 0.2,
        clustering: true,
        clusterSize: 5,
      },
      {
        category: "bush",
        density: 40,
        minSpacing: 4,
        noiseScale: 0.05,
        noiseThreshold: 0.25,
      },
    ],
  },
];

describe("VegetationPlacer", () => {
  let placer: VegetationPlacer;
  let terrain: VegetationTerrainProvider;

  beforeEach(() => {
    terrain = createMockTerrain(12345);
    placer = new VegetationPlacer(terrain, {
      config: { seed: 12345 },
      assets: SAMPLE_ASSETS,
      biomeConfigs: SAMPLE_BIOME_CONFIGS,
    });
  });

  describe("initialization", () => {
    it("should create placer with default config", () => {
      const p = new VegetationPlacer(terrain);
      const config = p.getConfig();
      expect(config.tileSize).toBe(100);
      expect(config.waterEdgeBuffer).toBe(6.0);
    });

    it("should create placer with custom config", () => {
      const p = new VegetationPlacer(terrain, {
        config: { seed: 54321, tileSize: 200 },
      });
      const config = p.getConfig();
      expect(config.seed).toBe(54321);
      expect(config.tileSize).toBe(200);
    });

    it("should store assets correctly", () => {
      expect(placer.getAsset("tree_oak")).toBeDefined();
      expect(placer.getAsset("tree_pine")).toBeDefined();
      expect(placer.getAsset("bush_small")).toBeDefined();
    });

    it("should store biome configs correctly", () => {
      expect(placer.getBiomeConfig("plains")).toBeDefined();
      expect(placer.getBiomeConfig("forest")).toBeDefined();
      expect(placer.getBiomeConfig("desert")).toBeUndefined();
    });
  });

  describe("asset management", () => {
    it("should filter assets by category", () => {
      const trees = placer.getAssetsByCategory("tree");
      expect(trees.length).toBe(2);
      expect(trees.every((a) => a.category === "tree")).toBe(true);

      const bushes = placer.getAssetsByCategory("bush");
      expect(bushes.length).toBe(1);
    });

    it("should update assets", () => {
      const newAssets: VegetationAsset[] = [
        {
          id: "new_tree",
          category: "tree",
          model: "trees/new.glb",
          baseScale: 1.0,
          scaleVariation: [1, 1],
          weight: 10,
          randomRotation: true,
        },
      ];
      placer.setAssets(newAssets);
      expect(placer.getAsset("new_tree")).toBeDefined();
      expect(placer.getAsset("tree_oak")).toBeUndefined();
    });
  });

  describe("tile generation", () => {
    it("should generate vegetation for a tile", () => {
      const result = placer.generateTile({ tileX: 0, tileZ: 0 });

      expect(result.tileKey).toBe("0_0");
      expect(result.tileX).toBe(0);
      expect(result.tileZ).toBe(0);
      expect(result.biome).toBe("plains");
      expect(result.placements.length).toBeGreaterThan(0);
    });

    it("should generate deterministic results", () => {
      const result1 = placer.generateTile({ tileX: 1, tileZ: 1 });
      const result2 = placer.generateTile({ tileX: 1, tileZ: 1 });

      expect(result1.placements.length).toBe(result2.placements.length);
      for (let i = 0; i < result1.placements.length; i++) {
        expect(result1.placements[i].position.x).toBe(
          result2.placements[i].position.x,
        );
        expect(result1.placements[i].position.z).toBe(
          result2.placements[i].position.z,
        );
        expect(result1.placements[i].assetId).toBe(
          result2.placements[i].assetId,
        );
      }
    });

    it("should produce different results with different seeds", () => {
      const placer1 = new VegetationPlacer(terrain, {
        config: { seed: 111 },
        assets: SAMPLE_ASSETS,
        biomeConfigs: SAMPLE_BIOME_CONFIGS,
      });
      const placer2 = new VegetationPlacer(terrain, {
        config: { seed: 222 },
        assets: SAMPLE_ASSETS,
        biomeConfigs: SAMPLE_BIOME_CONFIGS,
      });

      const result1 = placer1.generateTile({ tileX: 0, tileZ: 0 });
      const result2 = placer2.generateTile({ tileX: 0, tileZ: 0 });

      // Different seeds should produce different placements
      // (at least some positions should differ)
      let differentCount = 0;
      const minLength = Math.min(
        result1.placements.length,
        result2.placements.length,
      );
      for (let i = 0; i < minLength; i++) {
        if (
          result1.placements[i].position.x !== result2.placements[i].position.x
        ) {
          differentCount++;
        }
      }
      expect(differentCount).toBeGreaterThan(0);
    });

    it("should respect biome boundaries", () => {
      // Tile at (0, 0) is in "plains"
      const plainsResult = placer.generateTile({ tileX: 0, tileZ: 0 });
      expect(plainsResult.biome).toBe("plains");

      // Tile at (-1, 0) is in "forest"
      const forestResult = placer.generateTile({ tileX: -1, tileZ: 0 });
      expect(forestResult.biome).toBe("forest");
    });

    it("should filter by category when specified", () => {
      const result = placer.generateTile({
        tileX: 0,
        tileZ: 0,
        categories: ["tree"],
      });

      expect(result.placements.every((p) => p.category === "tree")).toBe(true);
    });

    it("should return empty for unknown biome", () => {
      // Tile at (-1, -1) has biome "valley" which has no config
      const result = placer.generateTile({ tileX: -1, tileZ: -1 });
      expect(result.placements.length).toBe(0);
    });
  });

  describe("region generation", () => {
    it("should generate multiple tiles", () => {
      const results = placer.generateTiles([
        { tileX: 0, tileZ: 0 },
        { tileX: 1, tileZ: 0 },
        { tileX: 0, tileZ: 1 },
      ]);

      expect(results.length).toBe(3);
      expect(results[0].tileKey).toBe("0_0");
      expect(results[1].tileKey).toBe("1_0");
      expect(results[2].tileKey).toBe("0_1");
    });

    it("should generate region", () => {
      const results = placer.generateRegion(0, 0, 1, 1);

      expect(results.length).toBe(4); // 2x2 grid
      expect(results.some((r) => r.tileKey === "0_0")).toBe(true);
      expect(results.some((r) => r.tileKey === "1_0")).toBe(true);
      expect(results.some((r) => r.tileKey === "0_1")).toBe(true);
      expect(results.some((r) => r.tileKey === "1_1")).toBe(true);
    });
  });

  describe("placement properties", () => {
    it("should assign unique IDs to placements", () => {
      const result = placer.generateTile({ tileX: 0, tileZ: 0 });
      const ids = new Set(result.placements.map((p) => p.id));
      expect(ids.size).toBe(result.placements.length);
    });

    it("should set valid positions within tile", () => {
      const result = placer.generateTile({ tileX: 5, tileZ: 3 });
      const tileSize = placer.getTileSize();
      const minX = 5 * tileSize;
      const minZ = 3 * tileSize;
      const maxX = minX + tileSize;
      const maxZ = minZ + tileSize;

      for (const placement of result.placements) {
        expect(placement.position.x).toBeGreaterThanOrEqual(minX);
        expect(placement.position.x).toBeLessThan(maxX);
        expect(placement.position.z).toBeGreaterThanOrEqual(minZ);
        expect(placement.position.z).toBeLessThan(maxZ);
      }
    });

    it("should set terrain-based Y position", () => {
      const result = placer.generateTile({ tileX: 0, tileZ: 0 });

      for (const placement of result.placements) {
        // Y should be close to terrain height (with possible offset)
        const terrainHeight = terrain.getHeightAt(
          placement.position.x,
          placement.position.z,
        );
        // Allow for yOffset
        expect(placement.position.y).toBeGreaterThan(0);
        expect(Math.abs(placement.position.y - terrainHeight)).toBeLessThan(10);
      }
    });

    it("should set valid scale", () => {
      const result = placer.generateTile({ tileX: 0, tileZ: 0 });

      for (const placement of result.placements) {
        expect(placement.scale).toBeGreaterThan(0);
        expect(placement.scale).toBeLessThan(10); // Reasonable scale range
      }
    });

    it("should set rotation", () => {
      const result = placer.generateTile({ tileX: 0, tileZ: 0 });

      for (const placement of result.placements) {
        // Y rotation should be in valid range
        expect(placement.rotation.y).toBeGreaterThanOrEqual(0);
        expect(placement.rotation.y).toBeLessThan(Math.PI * 2 + 0.001);
      }
    });
  });

  describe("createVegetationTerrainProvider helper", () => {
    it("should create provider from generator-like object", () => {
      const mockGenerator = {
        getHeightAt: (x: number, z: number) => 10 + x * 0.01 + z * 0.01,
        queryPoint: (x: number, _z: number) => ({
          biome: x > 0 ? "plains" : "forest",
        }),
        getWaterThreshold: () => 5.0,
      };

      const provider = createVegetationTerrainProvider(mockGenerator);

      expect(provider.getHeightAt(100, 100)).toBe(12);
      expect(provider.getBiomeAt(100, 0)).toBe("plains");
      expect(provider.getBiomeAt(-100, 0)).toBe("forest");
      expect(provider.getWaterThreshold()).toBe(5.0);
    });

    it("should work without optional methods", () => {
      const minimalGenerator = {
        getHeightAt: () => 15,
      };

      const provider = createVegetationTerrainProvider(minimalGenerator);

      expect(provider.getHeightAt(0, 0)).toBe(15);
      expect(provider.getBiomeAt(0, 0)).toBe("plains"); // Default
      // Default water threshold tracks DEFAULT_WATER_THRESHOLD in
      // terrain/constants.ts — was 5.4 before the height pass that
      // raised maxHeight to 50 (waterLevelNormalized = 16/50 = 0.32).
      expect(provider.getWaterThreshold()).toBe(16);
    });
  });

  describe("water avoidance", () => {
    it("should avoid underwater positions", () => {
      // Create terrain where some areas are underwater
      const wetTerrain: VegetationTerrainProvider = {
        getHeightAt: (x: number, z: number): number => {
          // Water in the middle of the tile
          if (x > 40 && x < 60 && z > 40 && z < 60) {
            return 3; // Below water threshold
          }
          return 15; // Above water
        },
        getBiomeAt: () => "plains",
        getWaterThreshold: () => 5.4,
      };

      const wetPlacer = new VegetationPlacer(wetTerrain, {
        config: { seed: 12345 },
        assets: SAMPLE_ASSETS,
        biomeConfigs: SAMPLE_BIOME_CONFIGS,
      });

      const result = wetPlacer.generateTile({ tileX: 0, tileZ: 0 });

      // No placements should be in the underwater area
      for (const placement of result.placements) {
        const height = wetTerrain.getHeightAt(
          placement.position.x,
          placement.position.z,
        );
        const waterThreshold = wetTerrain.getWaterThreshold() + 6.0; // waterEdgeBuffer
        expect(height).toBeGreaterThanOrEqual(waterThreshold);
      }
    });
  });
});
