/**
 * Terrain Generator Tests
 *
 * Comprehensive tests for terrain generation to ensure deterministic,
 * consistent output across different environments.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TerrainGenerator, DEFAULT_TERRAIN_CONFIG } from "./TerrainGenerator";
import { BiomeSystem } from "./BiomeSystem";
import type { BiomeDefinition } from "./types";

const TEST_BIOMES: Record<string, BiomeDefinition> = {
  forest: {
    id: "forest",
    name: "Forest",
    color: 0x2f7d32,
    terrainMultiplier: 1.1,
    difficultyLevel: 1,
    heightRange: [0.2, 0.6],
    resourceDensity: 1.5,
  },
  tundra: {
    id: "tundra",
    name: "Tundra",
    color: 0xb0c4de,
    terrainMultiplier: 1.0,
    difficultyLevel: 3,
    heightRange: [0.3, 0.8],
    resourceDensity: 0.4,
  },
  canyon: {
    id: "canyon",
    name: "Canyon",
    color: 0xdaa520,
    terrainMultiplier: 0.9,
    difficultyLevel: 2,
    heightRange: [0.1, 0.4],
    resourceDensity: 0.3,
  },
};
import { IslandMask } from "./IslandMask";
import {
  NoiseGenerator,
  createTileRNG,
  createSeededRNG,
} from "./NoiseGenerator";
import { createConfigFromPreset, listPresetIds } from "./presets";

describe("TerrainGenerator", () => {
  let generator: TerrainGenerator;

  beforeEach(() => {
    generator = new TerrainGenerator({ seed: 12345 }, TEST_BIOMES);
  });

  describe("initialization", () => {
    it("should create generator with default config", () => {
      const gen = new TerrainGenerator();
      expect(gen.getConfig().seed).toBe(0);
      expect(gen.getTileSize()).toBe(100);
      expect(gen.getTileResolution()).toBe(64);
      // DEFAULT_MAX_HEIGHT is 50 (constants.ts:14) — was 30 before
      // the height pass that raised it; comment in waterLevelNormalized
      // (16/50) corroborates the current value.
      expect(gen.getMaxHeight()).toBe(50);
    });

    it("should create generator with custom config", () => {
      const gen = new TerrainGenerator({
        seed: 54321,
        tileSize: 200,
        maxHeight: 50,
      });
      expect(gen.getConfig().seed).toBe(54321);
      expect(gen.getTileSize()).toBe(200);
      expect(gen.getMaxHeight()).toBe(50);
    });

    it("should create generator from preset", () => {
      const config = createConfigFromPreset("small-island", { seed: 999 });
      const gen = new TerrainGenerator(config);
      expect(gen.getConfig().seed).toBe(999);
      expect(gen.getConfig().worldSize).toBe(10);
    });
  });

  describe("height generation", () => {
    it("should generate deterministic heights", () => {
      const height1 = generator.getHeightAt(100, 200);
      const height2 = generator.getHeightAt(100, 200);
      expect(height1).toBe(height2);
    });

    it("should produce different heights at different positions", () => {
      const height1 = generator.getHeightAt(0, 0);
      const height2 = generator.getHeightAt(100, 100);
      const height3 = generator.getHeightAt(500, 500);
      // Heights should be different (within statistical probability)
      expect(new Set([height1, height2, height3]).size).toBeGreaterThan(1);
    });

    it("should respect max height constraint", () => {
      const maxHeight = generator.getMaxHeight();
      // Sample many points
      for (let i = 0; i < 100; i++) {
        const x = (Math.random() - 0.5) * 1000;
        const z = (Math.random() - 0.5) * 1000;
        const height = generator.getHeightAt(x, z);
        expect(height).toBeLessThanOrEqual(maxHeight);
        expect(height).toBeGreaterThanOrEqual(0);
      }
    });

    it("should produce different results with different seeds", () => {
      const gen1 = new TerrainGenerator({ seed: 111 });
      const gen2 = new TerrainGenerator({ seed: 222 });

      const height1 = gen1.getHeightAt(50, 50);
      const height2 = gen2.getHeightAt(50, 50);
      expect(height1).not.toBe(height2);
    });
  });

  describe("tile generation", () => {
    it("should generate heightmap with correct resolution", () => {
      const tile = generator.generateHeightmap(0, 0);
      const resolution = generator.getTileResolution();
      expect(tile.heights.length).toBe(resolution * resolution);
      expect(tile.biomeIds.length).toBe(resolution * resolution);
      expect(tile.resolution).toBe(resolution);
    });

    it("should generate deterministic tiles", () => {
      const tile1 = generator.generateHeightmap(1, 2);
      const tile2 = generator.generateHeightmap(1, 2);

      expect(tile1.heights).toEqual(tile2.heights);
      expect(tile1.biomeIds).toEqual(tile2.biomeIds);
      expect(tile1.dominantBiome).toBe(tile2.dominantBiome);
    });

    it("should generate different tiles at different coordinates", () => {
      const tile1 = generator.generateHeightmap(0, 0);
      const tile2 = generator.generateHeightmap(5, 5);

      // Heights should be different
      let sumDiff = 0;
      for (let i = 0; i < tile1.heights.length; i++) {
        sumDiff += Math.abs(tile1.heights[i] - tile2.heights[i]);
      }
      expect(sumDiff).toBeGreaterThan(0);
    });

    it("should generate complete tile data", () => {
      const tile = generator.generateTile(0, 0);
      expect(tile.heightmap).toBeDefined();
      expect(tile.colors).toBeDefined();
      expect(tile.colors.colors.length).toBe(tile.heightmap.heights.length * 3);
      expect(tile.colors.roadInfluences.length).toBe(
        tile.heightmap.heights.length,
      );
    });
  });

  describe("point queries", () => {
    it("should return complete point data", () => {
      const point = generator.queryPoint(100, 200);

      expect(point.height).toBeTypeOf("number");
      expect(point.biome).toBeTypeOf("string");
      expect(point.biomeInfluences).toBeInstanceOf(Array);
      expect(point.biomeInfluences.length).toBeGreaterThan(0);
      expect(point.islandMask).toBeGreaterThanOrEqual(0);
      expect(point.islandMask).toBeLessThanOrEqual(1);
      expect(point.normal).toHaveProperty("x");
      expect(point.normal).toHaveProperty("y");
      expect(point.normal).toHaveProperty("z");
    });

    it("should detect underwater positions", () => {
      const config = createConfigFromPreset("large-island");
      const gen = new TerrainGenerator(config);

      // Center of island should be above water
      const centerUnderwater = gen.isUnderwater(0, 0);
      expect(centerUnderwater).toBe(false);

      // Far outside island should be underwater
      const farUnderwater = gen.isUnderwater(10000, 10000);
      expect(farUnderwater).toBe(true);
    });

    it("should return normalized normals", () => {
      const point = generator.queryPoint(50, 75);
      const { x, y, z } = point.normal;
      const length = Math.sqrt(x * x + y * y + z * z);
      expect(length).toBeCloseTo(1.0, 5);
    });
  });

  describe("biome system", () => {
    it("should return biome influences that sum to 1", () => {
      const point = generator.queryPoint(200, 300);
      const total = point.biomeInfluences.reduce((sum, b) => sum + b.weight, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });

    it("should return valid biome names", () => {
      const point = generator.queryPoint(150, 150);
      const validBiomes = Object.keys(TEST_BIOMES);
      expect(validBiomes).toContain(point.biome);
    });

    it("should have dominant biome as first influence", () => {
      const point = generator.queryPoint(100, 100);
      expect(point.biome).toBe(point.biomeInfluences[0].type);
    });
  });
});

describe("NoiseGenerator", () => {
  it("should produce deterministic output", () => {
    const noise1 = new NoiseGenerator(12345);
    const noise2 = new NoiseGenerator(12345);

    for (let i = 0; i < 10; i++) {
      const x = i * 10;
      const y = i * 15;
      expect(noise1.perlin2D(x, y)).toBe(noise2.perlin2D(x, y));
      expect(noise1.simplex2D(x, y)).toBe(noise2.simplex2D(x, y));
      expect(noise1.fractal2D(x, y)).toBe(noise2.fractal2D(x, y));
    }
  });

  it("should produce values in expected ranges", () => {
    const noise = new NoiseGenerator(54321);

    for (let i = 0; i < 100; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = (Math.random() - 0.5) * 100;

      const perlin = noise.perlin2D(x, y);
      expect(perlin).toBeGreaterThanOrEqual(-1);
      expect(perlin).toBeLessThanOrEqual(1);

      const ridge = noise.ridgeNoise2D(x, y);
      expect(ridge).toBeGreaterThanOrEqual(0);
      expect(ridge).toBeLessThanOrEqual(1);
    }
  });

  it("should produce different output with different seeds", () => {
    const noise1 = new NoiseGenerator(111);
    const noise2 = new NoiseGenerator(222);

    // Check multiple points - at least one should differ
    let differenceFound = false;
    const testPoints = [
      [10, 10],
      [25, 75],
      [50, 50],
      [100, 200],
      [33.7, 66.2],
    ];

    for (const [x, y] of testPoints) {
      const val1 = noise1.perlin2D(x, y);
      const val2 = noise2.perlin2D(x, y);
      if (val1 !== val2) {
        differenceFound = true;
        break;
      }
    }

    expect(differenceFound).toBe(true);
  });
});

describe("BiomeSystem", () => {
  let biomeSystem: BiomeSystem;

  beforeEach(() => {
    biomeSystem = new BiomeSystem(12345, 10000, {}, TEST_BIOMES);
  });

  it("should create biome centers", () => {
    const centers = biomeSystem.getBiomeCenters();
    expect(centers.length).toBeGreaterThan(0);
  });

  it("should return influences that sum to 1", () => {
    const influences = biomeSystem.getBiomeInfluencesAtPosition(0, 0, 0.5);
    const total = influences.reduce((sum, b) => sum + b.weight, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it("should return valid biome types", () => {
    const validTypes = Object.keys(TEST_BIOMES);
    const influences = biomeSystem.getBiomeInfluencesAtPosition(500, 500, 0.3);

    for (const influence of influences) {
      expect(validTypes).toContain(influence.type);
    }
  });

  it("should blend colors correctly", () => {
    const influences = [
      { type: "forest", weight: 0.5 },
      { type: "tundra", weight: 0.5 },
    ];
    const color = biomeSystem.blendBiomeColors(influences);

    expect(color.r).toBeGreaterThan(0);
    expect(color.g).toBeGreaterThan(0);
    expect(color.b).toBeGreaterThanOrEqual(0);
    expect(color.r).toBeLessThanOrEqual(1);
    expect(color.g).toBeLessThanOrEqual(1);
    expect(color.b).toBeLessThanOrEqual(1);
  });
});

describe("IslandMask", () => {
  let islandMask: IslandMask;

  beforeEach(() => {
    islandMask = new IslandMask(12345, 100); // 100m tiles
  });

  it("should return 1.0 at center of island", () => {
    const mask = islandMask.getIslandMaskAt(0, 0);
    expect(mask).toBe(1.0);
  });

  it("should return 0.0 far outside island", () => {
    const mask = islandMask.getIslandMaskAt(100000, 100000);
    expect(mask).toBe(0.0);
  });

  it("should transition smoothly at edges", () => {
    const worldSize = islandMask.getActiveWorldSizeMeters();
    const edgeDistance = worldSize / 2 - 100; // Near edge

    // Sample points in a circle at edge distance
    const masks: number[] = [];
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const x = Math.cos(angle) * edgeDistance;
      const z = Math.sin(angle) * edgeDistance;
      masks.push(islandMask.getIslandMaskAt(x, z));
    }

    // All should be between 0 and 1
    for (const mask of masks) {
      expect(mask).toBeGreaterThanOrEqual(0);
      expect(mask).toBeLessThanOrEqual(1);
    }
  });

  it("should calculate pond depression correctly", () => {
    const pondConfig = islandMask.getPondConfig();
    const depression = islandMask.getPondDepression(
      pondConfig.centerX,
      pondConfig.centerZ,
    );
    expect(depression).toBeGreaterThan(0);

    // Far from pond should have no depression
    const farDepression = islandMask.getPondDepression(10000, 10000);
    expect(farDepression).toBe(0);
  });
});

describe("Seeded RNG utilities", () => {
  it("should create deterministic seeded RNG", () => {
    const rng1 = createSeededRNG(12345);
    const rng2 = createSeededRNG(12345);

    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("should create deterministic tile RNG", () => {
    const rng1 = createTileRNG(12345, 5, 10, "vegetation");
    const rng2 = createTileRNG(12345, 5, 10, "vegetation");

    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("should produce different values for different tiles", () => {
    const rng1 = createTileRNG(12345, 0, 0, "test");
    const rng2 = createTileRNG(12345, 1, 1, "test");

    const val1 = rng1();
    const val2 = rng2();
    expect(val1).not.toBe(val2);
  });

  it("should produce different values for different salts", () => {
    const rng1 = createTileRNG(12345, 5, 5, "salt1");
    const rng2 = createTileRNG(12345, 5, 5, "salt2");

    const val1 = rng1();
    const val2 = rng2();
    expect(val1).not.toBe(val2);
  });

  it("should produce values in [0, 1) range", () => {
    const rng = createSeededRNG(99999);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe("Presets", () => {
  it("should list all available presets", () => {
    const presets = listPresetIds();
    expect(presets).toContain("small-island");
    expect(presets).toContain("large-island");
    expect(presets).toContain("continent");
    expect(presets.length).toBeGreaterThan(5);
  });

  it("should create valid config from each preset", () => {
    const presets = listPresetIds();

    for (const presetId of presets) {
      const config = createConfigFromPreset(presetId);
      expect(config.tileSize).toBeGreaterThan(0);
      expect(config.worldSize).toBeGreaterThan(0);
      expect(config.maxHeight).toBeGreaterThan(0);
      expect(config.noise).toBeDefined();
      expect(config.biomes).toBeDefined();
      expect(config.island).toBeDefined();
      expect(config.shoreline).toBeDefined();
    }
  });

  it("should allow overriding preset values", () => {
    const config = createConfigFromPreset("small-island", {
      seed: 999,
      maxHeight: 100,
    });
    expect(config.seed).toBe(999);
    expect(config.maxHeight).toBe(100);
  });

  it("should use default for unknown preset", () => {
    const config = createConfigFromPreset("nonexistent-preset");
    expect(config.tileSize).toBe(DEFAULT_TERRAIN_CONFIG.tileSize);
  });
});

describe("Edge cases", () => {
  it("should handle negative coordinates", () => {
    const gen = new TerrainGenerator({ seed: 12345 });
    const height = gen.getHeightAt(-500, -300);
    expect(height).toBeTypeOf("number");
    expect(height).toBeGreaterThanOrEqual(0);
  });

  it("should handle very large coordinates", () => {
    const gen = new TerrainGenerator({ seed: 12345 });
    const height = gen.getHeightAt(50000, 50000);
    expect(height).toBeTypeOf("number");
  });

  it("should handle zero seed", () => {
    const gen = new TerrainGenerator({ seed: 0 });
    const height = gen.getHeightAt(100, 100);
    expect(height).toBeTypeOf("number");
  });

  it("should handle negative tiles", () => {
    const gen = new TerrainGenerator({ seed: 12345 });
    const tile = gen.generateHeightmap(-5, -3);
    expect(tile.tileX).toBe(-5);
    expect(tile.tileZ).toBe(-3);
    expect(tile.heights.length).toBeGreaterThan(0);
  });
});
