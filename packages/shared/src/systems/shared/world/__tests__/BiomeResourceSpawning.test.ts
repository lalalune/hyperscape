/**
 * Tests for biome-based resource spawning.
 *
 * IMPORTANT: These tests use the ACTUAL BiomeResourceGenerator functions,
 * not duplicated implementations. This ensures we're testing real code.
 *
 * Coverage:
 * - Tree distribution per biome
 * - Ore distribution per biome
 * - Weighted random selection
 * - Level requirement assignment
 * - Spacing and clustering
 * - Real height callbacks
 */

import { describe, it, expect } from "vitest";
import {
  generateTrees,
  generateOres,
  getTreeLevelRequirement,
  getOreLevelRequirement,
  TREE_LEVEL_REQUIREMENTS,
  ORE_LEVEL_REQUIREMENTS,
  type ResourceGenerationContext,
} from "../BiomeResourceGenerator";
import type {
  BiomeTreeConfig,
  BiomeOreConfig,
} from "../../../../types/world/world-types";

/**
 * Create a deterministic RNG for testing.
 * Uses the same LCG algorithm as TerrainSystem.
 */
function createTestRng(
  baseSeed: number,
  tileX: number,
  tileZ: number,
  salt: string,
): () => number {
  let saltHash = 5381 >>> 0;
  for (let i = 0; i < salt.length; i++) {
    saltHash = (((saltHash << 5) + saltHash) ^ salt.charCodeAt(i)) >>> 0;
  }
  let state =
    (baseSeed ^
      ((tileX * 73856093) >>> 0) ^
      ((tileZ * 19349663) >>> 0) ^
      saltHash) >>>
    0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

/**
 * Create a test context that simulates TerrainSystem environment.
 */
function createTestContext(
  tileX: number,
  tileZ: number,
  options: {
    seed?: number;
    tileSize?: number;
    waterThreshold?: number;
    heightMap?: (x: number, z: number) => number;
    roadChecker?: (x: number, z: number) => boolean;
  } = {},
): ResourceGenerationContext {
  const seed = options.seed ?? 12345;
  const tileSize = options.tileSize ?? 100;
  const waterThreshold = options.waterThreshold ?? 5.4;

  // Default height map: flat terrain at 10m (above water)
  const getHeightAt = options.heightMap ?? (() => 10);

  return {
    tileX,
    tileZ,
    tileKey: `${tileX}_${tileZ}`,
    tileSize,
    waterThreshold,
    getHeightAt,
    isOnRoad: options.roadChecker,
    createRng: (salt) => createTestRng(seed, tileX, tileZ, salt),
  };
}

describe("BiomeResourceGenerator", () => {
  describe("generateTrees", () => {
    const forestTreeConfig: BiomeTreeConfig = {
      enabled: true,
      trees: {
        tree_normal: { weight: 0.5 },
        tree_oak: { weight: 0.35 },
        tree_willow: { weight: 0.15 },
      },
      density: 8,
      minSpacing: 8,
      clustering: true,
      clusterSize: 5,
    };

    it("generates trees when enabled", () => {
      const ctx = createTestContext(0, 0);
      const trees = generateTrees(ctx, forestTreeConfig);

      expect(trees.length).toBeGreaterThan(0);
      expect(trees.every((r) => r.type === "tree")).toBe(true);
    });

    it("returns empty array when disabled", () => {
      const ctx = createTestContext(0, 0);
      const trees = generateTrees(ctx, { ...forestTreeConfig, enabled: false });

      expect(trees).toEqual([]);
    });

    it("respects weighted distribution", () => {
      // Use a 2-species config with a large weight gap so the dominant
      // species stays dominant even after the 10x species-zoning boost.
      const weightedConfig: BiomeTreeConfig = {
        enabled: true,
        trees: {
          tree_normal: { weight: 0.85 },
          tree_willow: { weight: 0.15 },
        },
        density: 8,
        minSpacing: 8,
        clustering: false,
      };

      const allTrees: ReturnType<typeof generateTrees> = [];
      for (let i = 0; i < 30; i++) {
        for (let j = 0; j < 30; j++) {
          const ctx = createTestContext(i, j);
          allTrees.push(...generateTrees(ctx, weightedConfig));
        }
      }

      const normalCount = allTrees.filter((r) => r.subType === "normal").length;
      const willowCount = allTrees.filter((r) => r.subType === "willow").length;

      // Normal (85%) should be significantly more common than willow (15%)
      expect(normalCount).toBeGreaterThan(willowCount);
    });

    it("assigns correct level requirements from shared constants", () => {
      const ctx = createTestContext(0, 0);
      const mapleConfig: BiomeTreeConfig = {
        enabled: true,
        trees: { tree_maple: { weight: 1.0 } },
        density: 5,
        minSpacing: 5,
        clustering: false,
      };

      const trees = generateTrees(ctx, mapleConfig);

      expect(trees.length).toBeGreaterThan(0);
      // Level should come from TREE_LEVEL_REQUIREMENTS constant
      expect(
        trees.every((r) => r.requiredLevel === TREE_LEVEL_REQUIREMENTS.maple),
      ).toBe(true);
      expect(trees.every((r) => r.requiredLevel === 45)).toBe(true);
    });

    it("respects minimum spacing between trees", () => {
      const ctx = createTestContext(0, 0);
      const spacedConfig: BiomeTreeConfig = {
        enabled: true,
        trees: { tree_normal: { weight: 1.0 } },
        density: 50,
        minSpacing: 20,
        clustering: false,
      };

      const trees = generateTrees(ctx, spacedConfig);

      // Check all pairs respect minimum spacing
      const minSpacingSq = 20 * 20;
      for (let i = 0; i < trees.length; i++) {
        for (let j = i + 1; j < trees.length; j++) {
          const a = trees[i].position;
          const b = trees[j].position;
          const dx = a.x - b.x;
          const dz = a.z - b.z;
          const distSq = dx * dx + dz * dz;
          expect(distSq).toBeGreaterThanOrEqual(minSpacingSq * 0.99);
        }
      }
    });

    it("skips positions below water threshold", () => {
      // Create a height map where left half is underwater
      const ctx = createTestContext(0, 0, {
        heightMap: (x) => (x < 50 ? 0 : 10), // Left half underwater (0 < 5.4)
      });

      const trees = generateTrees(ctx, forestTreeConfig);

      // All trees should be in right half (x >= some threshold due to clustering)
      // With clustering, this is harder to verify precisely, but no trees should be at height 0
      expect(trees.every((r) => r.position.y >= 5.4)).toBe(true);
    });

    it("skips positions on roads when road checker provided", () => {
      // Create a road checker that marks center stripe as road
      const ctx = createTestContext(0, 0, {
        roadChecker: (_x, z) => z >= 45 && z <= 55, // Road in center of tile
      });

      const trees = generateTrees(ctx, forestTreeConfig);

      // Trees should avoid the road stripe
      const treesOnRoad = trees.filter(
        (t) => t.position.z >= 45 && t.position.z <= 55,
      );
      expect(treesOnRoad.length).toBe(0);
    });

    it("generates deterministically with same seed", () => {
      const ctx1 = createTestContext(5, 10, { seed: 12345 });
      const ctx2 = createTestContext(5, 10, { seed: 12345 });

      const trees1 = generateTrees(ctx1, forestTreeConfig);
      const trees2 = generateTrees(ctx2, forestTreeConfig);

      expect(trees1.length).toBe(trees2.length);
      for (let i = 0; i < trees1.length; i++) {
        expect(trees1[i].subType).toBe(trees2[i].subType);
        expect(trees1[i].position.x).toBeCloseTo(trees2[i].position.x, 5);
        expect(trees1[i].position.z).toBeCloseTo(trees2[i].position.z, 5);
      }
    });

    it("generates different results for different tiles", () => {
      const ctx1 = createTestContext(0, 0, { seed: 12345 });
      const ctx2 = createTestContext(1, 1, { seed: 12345 });

      const trees1 = generateTrees(ctx1, forestTreeConfig);
      const trees2 = generateTrees(ctx2, forestTreeConfig);

      // Position sets should differ
      const positions1 = new Set(
        trees1.map(
          (t) => `${t.position.x.toFixed(2)},${t.position.z.toFixed(2)}`,
        ),
      );
      const positions2 = new Set(
        trees2.map(
          (t) => `${t.position.x.toFixed(2)},${t.position.z.toFixed(2)}`,
        ),
      );

      // Should have different positions
      let matchCount = 0;
      for (const pos of positions1) {
        if (positions2.has(pos)) matchCount++;
      }
      expect(matchCount).toBeLessThan(trees1.length * 0.1); // Less than 10% overlap
    });
  });

  describe("generateOres", () => {
    const mountainOreConfig: BiomeOreConfig = {
      enabled: true,
      distribution: {
        ore_iron: 0.3,
        ore_coal: 0.35,
        ore_mithril: 0.2,
        ore_adamant: 0.1,
        ore_runite: 0.05,
      },
      density: 2.5,
      minSpacing: 10,
      veins: true,
      veinSize: 3,
    };

    it("generates ores when enabled", () => {
      const ctx = createTestContext(0, 0);
      const ores = generateOres(ctx, mountainOreConfig);

      expect(ores.length).toBeGreaterThan(0);
      expect(ores.every((r) => r.type === "ore")).toBe(true);
    });

    it("returns empty array when disabled", () => {
      const ctx = createTestContext(0, 0);
      const ores = generateOres(ctx, { ...mountainOreConfig, enabled: false });

      expect(ores).toEqual([]);
    });

    it("respects weighted distribution", () => {
      const allOres: ReturnType<typeof generateOres> = [];
      for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
          const ctx = createTestContext(i, j);
          allOres.push(...generateOres(ctx, mountainOreConfig));
        }
      }

      const coalCount = allOres.filter((r) => r.subType === "coal").length;
      const ironCount = allOres.filter((r) => r.subType === "iron").length;
      const mithrilCount = allOres.filter(
        (r) => r.subType === "mithril",
      ).length;
      const runiteCount = allOres.filter((r) => r.subType === "runite").length;

      // Coal (35%) should be most common
      expect(coalCount).toBeGreaterThan(mithrilCount);
      // Iron (30%) should be more than mithril (20%)
      expect(ironCount).toBeGreaterThan(mithrilCount);
      // Runite (5%) should be rarest
      expect(runiteCount).toBeLessThan(mithrilCount);
    });

    it("assigns correct level requirements from shared constants", () => {
      const ctx = createTestContext(0, 0);
      const runiteConfig: BiomeOreConfig = {
        enabled: true,
        distribution: { ore_runite: 1.0 },
        density: 3,
        minSpacing: 10,
        veins: false,
      };

      const ores = generateOres(ctx, runiteConfig);

      expect(ores.length).toBeGreaterThan(0);
      // Level should come from ORE_LEVEL_REQUIREMENTS constant
      expect(
        ores.every((r) => r.requiredLevel === ORE_LEVEL_REQUIREMENTS.runite),
      ).toBe(true);
      expect(ores.every((r) => r.requiredLevel === 85)).toBe(true);
    });

    it("respects minimum spacing between ores", () => {
      const ctx = createTestContext(0, 0);
      const spacedConfig: BiomeOreConfig = {
        enabled: true,
        distribution: { ore_copper: 1.0 },
        density: 10,
        minSpacing: 15,
        veins: false,
      };

      const ores = generateOres(ctx, spacedConfig);

      const minSpacingSq = 15 * 15;
      for (let i = 0; i < ores.length; i++) {
        for (let j = i + 1; j < ores.length; j++) {
          const a = ores[i].position;
          const b = ores[j].position;
          const dx = a.x - b.x;
          const dz = a.z - b.z;
          const distSq = dx * dx + dz * dz;
          expect(distSq).toBeGreaterThanOrEqual(minSpacingSq * 0.99);
        }
      }
    });

    it("clusters ores in veins when enabled", () => {
      const ctx = createTestContext(0, 0);
      const veinConfig: BiomeOreConfig = {
        enabled: true,
        distribution: { ore_iron: 1.0 },
        density: 10,
        minSpacing: 5,
        veins: true,
        veinSize: 4,
      };

      const ores = generateOres(ctx, veinConfig);

      if (ores.length < 2) return; // Skip if not enough ores

      // Calculate average nearest neighbor distance
      let totalNearestDist = 0;
      for (let i = 0; i < ores.length; i++) {
        let minDist = Infinity;
        for (let j = 0; j < ores.length; j++) {
          if (i === j) continue;
          const a = ores[i].position;
          const b = ores[j].position;
          const dx = a.x - b.x;
          const dz = a.z - b.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < minDist) minDist = dist;
        }
        if (minDist < Infinity) totalNearestDist += minDist;
      }

      const avgNearestDist = totalNearestDist / ores.length;

      // With veins, ores should cluster (avg nearest < 30m reasonable)
      expect(avgNearestDist).toBeLessThan(30);
    });
  });

  describe("Level Requirements (Single Source of Truth)", () => {
    it("tree level requirements match progression", () => {
      // These should match the actual TREE_TYPES definitions
      // Unknown types default to level 1
      expect(getTreeLevelRequirement("pine")).toBe(1);
      expect(getTreeLevelRequirement("oak")).toBe(15);
      expect(getTreeLevelRequirement("maple")).toBe(45);
      expect(getTreeLevelRequirement("mahogany")).toBe(50);
      expect(getTreeLevelRequirement("magic")).toBe(60);

      // Verify against exported constant
      expect(getTreeLevelRequirement("maple")).toBe(
        TREE_LEVEL_REQUIREMENTS.maple,
      );
    });

    it("ore level requirements match classic MMORPG progression", () => {
      expect(getOreLevelRequirement("copper")).toBe(1);
      expect(getOreLevelRequirement("tin")).toBe(1);
      expect(getOreLevelRequirement("iron")).toBe(15);
      expect(getOreLevelRequirement("coal")).toBe(30);
      expect(getOreLevelRequirement("mithril")).toBe(55);
      expect(getOreLevelRequirement("adamant")).toBe(70);
      expect(getOreLevelRequirement("runite")).toBe(85);

      // Verify against exported constant
      expect(getOreLevelRequirement("runite")).toBe(
        ORE_LEVEL_REQUIREMENTS.runite,
      );
    });

    it("unknown types default to level 1", () => {
      expect(getTreeLevelRequirement("unknown")).toBe(1);
      expect(getOreLevelRequirement("unknown")).toBe(1);
    });
  });

  describe("Biome Configuration Integration", () => {
    const plainsConfig = {
      trees: {
        enabled: true,
        trees: {
          tree_normal: { weight: 0.85 },
          tree_oak: { weight: 0.15 },
        },
        density: 3,
        minSpacing: 12,
        clustering: true,
        clusterSize: 3,
      } as BiomeTreeConfig,
      ores: {
        enabled: true,
        distribution: {
          ore_copper: 0.5,
          ore_tin: 0.5,
        },
        density: 0.5,
        minSpacing: 20,
        veins: false,
      } as BiomeOreConfig,
    };

    const tundraConfig = {
      trees: {
        enabled: true,
        trees: {
          tree_yew: { weight: 0.4 },
          tree_magic: { weight: 0.6 },
        },
        density: 0.5,
        minSpacing: 30,
        clustering: false,
      } as BiomeTreeConfig,
      ores: {
        enabled: true,
        distribution: {
          ore_coal: 0.2,
          ore_mithril: 0.3,
          ore_adamant: 0.3,
          ore_runite: 0.2,
        },
        density: 1.5,
        minSpacing: 15,
        veins: true,
        veinSize: 2,
      } as BiomeOreConfig,
    };

    it("plains biome produces mostly normal trees", () => {
      const allTrees: ReturnType<typeof generateTrees> = [];
      for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
          const ctx = createTestContext(i, j);
          allTrees.push(...generateTrees(ctx, plainsConfig.trees));
        }
      }

      const normalCount = allTrees.filter((r) => r.subType === "normal").length;
      const oakCount = allTrees.filter((r) => r.subType === "oak").length;

      // With 85%/15% distribution, normal should dominate
      expect(normalCount).toBeGreaterThan(oakCount * 2);
      expect(normalCount).toBeGreaterThan(allTrees.length / 2);
    });

    it("plains biome produces only low-level ores", () => {
      const allOres: ReturnType<typeof generateOres> = [];
      for (let i = 0; i < 10; i++) {
        const ctx = createTestContext(i, 0);
        allOres.push(...generateOres(ctx, plainsConfig.ores));
      }

      // All ores should be copper (lvl 1) or tin (lvl 1)
      expect(allOres.every((o) => o.requiredLevel <= 1)).toBe(true);
    });

    it("tundra biome produces only high-level trees", () => {
      const allTrees: ReturnType<typeof generateTrees> = [];
      for (let i = 0; i < 20; i++) {
        const ctx = createTestContext(i, 0);
        allTrees.push(...generateTrees(ctx, tundraConfig.trees));
      }

      // All trees should be yew (60) or magic (75)
      expect(allTrees.every((t) => t.requiredLevel >= 60)).toBe(true);
    });

    it("tundra biome produces only high-level ores", () => {
      const allOres: ReturnType<typeof generateOres> = [];
      for (let i = 0; i < 10; i++) {
        const ctx = createTestContext(i, 0);
        allOres.push(...generateOres(ctx, tundraConfig.ores));
      }

      // All ores should be coal (30), mithril (55), adamant (70), or runite (85)
      expect(allOres.every((o) => o.requiredLevel >= 30)).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty distribution gracefully", () => {
      const ctx = createTestContext(0, 0);
      const emptyConfig: BiomeTreeConfig = {
        enabled: true,
        trees: {},
        density: 10,
        minSpacing: 5,
        clustering: false,
      };

      const trees = generateTrees(ctx, emptyConfig);
      expect(trees).toEqual([]);
    });

    it("handles zero total weight gracefully", () => {
      const ctx = createTestContext(0, 0);
      const zeroWeightConfig: BiomeTreeConfig = {
        enabled: true,
        trees: { tree_normal: { weight: 0 }, tree_oak: { weight: 0 } },
        density: 10,
        minSpacing: 5,
        clustering: false,
      };

      const trees = generateTrees(ctx, zeroWeightConfig);
      expect(trees).toEqual([]);
    });

    it("handles zero density gracefully", () => {
      const ctx = createTestContext(0, 0);
      const zeroDensityConfig: BiomeTreeConfig = {
        enabled: true,
        trees: { tree_normal: { weight: 1.0 } },
        density: 0,
        minSpacing: 5,
        clustering: false,
      };

      const trees = generateTrees(ctx, zeroDensityConfig);
      expect(trees).toEqual([]);
    });

    it("handles negative tile coordinates", () => {
      const ctx = createTestContext(-5, -10);
      const config: BiomeTreeConfig = {
        enabled: true,
        trees: { tree_normal: { weight: 1.0 } },
        density: 5,
        minSpacing: 5,
        clustering: false,
      };

      const trees = generateTrees(ctx, config);

      // Should still generate trees
      expect(trees.length).toBeGreaterThan(0);
      // IDs should include negative coordinates
      expect(trees[0].id).toContain("-5_-10");
    });

    it("handles clustering without clusterSize", () => {
      const ctx = createTestContext(0, 0);
      const noClusterSizeConfig: BiomeTreeConfig = {
        enabled: true,
        trees: { tree_normal: { weight: 1.0 } },
        density: 5,
        minSpacing: 5,
        clustering: true,
        // clusterSize intentionally omitted
      };

      // Should not throw, just use uniform placement
      const trees = generateTrees(ctx, noClusterSizeConfig);
      expect(trees.length).toBeGreaterThan(0);
    });

    it("handles very high density with tight spacing", () => {
      const ctx = createTestContext(0, 0);
      const highDensityConfig: BiomeTreeConfig = {
        enabled: true,
        trees: { tree_normal: { weight: 1.0 } },
        density: 100, // Very high
        minSpacing: 50, // Large spacing limits actual placement
        clustering: false,
      };

      // Should hit max attempts and return fewer trees than requested
      const trees = generateTrees(ctx, highDensityConfig);
      // With 50m spacing on 100m tile, can only fit ~4 trees
      expect(trees.length).toBeLessThan(100);
      expect(trees.length).toBeGreaterThan(0);
    });

    it("handles entirely underwater tile", () => {
      const ctx = createTestContext(0, 0, {
        heightMap: () => 0, // Entire tile underwater (below 5.4)
      });
      const config: BiomeTreeConfig = {
        enabled: true,
        trees: { tree_normal: { weight: 1.0 } },
        density: 10,
        minSpacing: 5,
        clustering: false,
      };

      const trees = generateTrees(ctx, config);
      expect(trees).toEqual([]);
    });

    it("handles entirely road-covered tile", () => {
      const ctx = createTestContext(0, 0, {
        roadChecker: () => true, // Entire tile is road
      });
      const config: BiomeTreeConfig = {
        enabled: true,
        trees: { tree_normal: { weight: 1.0 } },
        density: 10,
        minSpacing: 5,
        clustering: false,
      };

      const trees = generateTrees(ctx, config);
      expect(trees).toEqual([]);
    });
  });

  describe("Real Height Map Integration", () => {
    it("uses actual height values in resource positions", () => {
      // Create a sloped terrain
      const ctx = createTestContext(0, 0, {
        heightMap: (x, _z) => 10 + x * 0.5, // Slope from 10 to 60
      });

      const config: BiomeTreeConfig = {
        enabled: true,
        trees: { tree_normal: { weight: 1.0 } },
        density: 10,
        minSpacing: 5,
        clustering: false,
      };

      const trees = generateTrees(ctx, config);

      // Each tree's Y position should match the height at its X position
      for (const tree of trees) {
        const expectedHeight = 10 + tree.position.x * 0.5;
        expect(tree.position.y).toBeCloseTo(expectedHeight, 3);
      }
    });

    it("correctly filters out underwater positions", () => {
      // Create terrain with half underwater
      const ctx = createTestContext(0, 0, {
        waterThreshold: 5.4,
        heightMap: (x) => (x < 50 ? 3 : 15), // Left half at 3m (underwater), right at 15m
      });

      const config: BiomeTreeConfig = {
        enabled: true,
        trees: { tree_normal: { weight: 1.0 } },
        density: 20,
        minSpacing: 5,
        clustering: false,
      };

      const trees = generateTrees(ctx, config);

      // All trees should have height >= 5.4 (above water)
      expect(trees.every((t) => t.position.y >= 5.4)).toBe(true);
      // All trees should have height = 15 (the above-water height)
      expect(trees.every((t) => t.position.y === 15)).toBe(true);
    });
  });
});
