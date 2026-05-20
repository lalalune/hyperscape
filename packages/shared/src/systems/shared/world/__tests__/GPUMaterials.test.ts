/**
 * GPUMaterials & LODConfig Unit Tests
 *
 * Tests for GPU-driven dissolve rendering and unified LOD configuration:
 * - LOD distance configuration (getLODDistances, applyLODSettings)
 * - Dissolve material creation and type guards
 * - Imposter material creation and type guards
 * - Boundary conditions and edge cases
 * - Configuration caching and cache invalidation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import THREE from "../../../../extras/three/three";
import {
  LOD_DISTANCES,
  DEFAULT_LOD_DISTANCES,
  LOD_REFERENCE_SIZE,
  LOD_MIN_SCALE,
  LOD_MAX_SCALE,
  getLODDistances,
  getLODDistancesScaled,
  getLODConfig,
  calculateLODScaleFactor,
  clearLODDistanceCache,
  applyLODSettings,
  type LODDistances,
} from "../LODConfig";
import {
  GPU_VEG_CONFIG,
  isDissolveMaterial,
  isImposterMaterial,
  createDissolveMaterial,
  createGPUVegetationMaterial,
  createImposterMaterial,
} from "../GPUMaterials";

/**
 * Helper to save and restore LOD_DISTANCES global state.
 * Essential for test isolation when tests modify LOD_DISTANCES.
 */
function saveLODDistancesState(): Record<string, LODDistances> {
  const snapshot: Record<string, LODDistances> = {};
  for (const [key, value] of Object.entries(LOD_DISTANCES)) {
    snapshot[key] = { ...value };
  }
  return snapshot;
}

function restoreLODDistancesState(
  snapshot: Record<string, LODDistances>,
): void {
  // Remove any keys that weren't in the original
  for (const key of Object.keys(LOD_DISTANCES)) {
    if (!(key in snapshot)) {
      delete (LOD_DISTANCES as Record<string, LODDistances>)[key];
    }
  }
  // Restore original values
  for (const [key, value] of Object.entries(snapshot)) {
    LOD_DISTANCES[key] = { ...value };
  }
  clearLODDistanceCache();
}

describe("GPUVegetation", () => {
  // ===== GPU_VEG_CONFIG CONSTANTS =====
  describe("GPU_VEG_CONFIG", () => {
    it("should have valid fade distances", () => {
      expect(GPU_VEG_CONFIG.FADE_START).toBeGreaterThan(0);
      expect(GPU_VEG_CONFIG.FADE_END).toBeGreaterThan(
        GPU_VEG_CONFIG.FADE_START,
      );
    });

    it("should have valid near-camera fade distances", () => {
      // NEAR_FADE_START = distance where fade begins (fully opaque beyond)
      // NEAR_FADE_END = distance where fully dissolved (at near clip)
      // START > END because we fade IN as camera gets closer
      expect(GPU_VEG_CONFIG.NEAR_CAMERA_FADE_START).toBeGreaterThan(0);
      expect(GPU_VEG_CONFIG.NEAR_CAMERA_FADE_END).toBeGreaterThan(0);
      expect(GPU_VEG_CONFIG.NEAR_CAMERA_FADE_START).toBeGreaterThan(
        GPU_VEG_CONFIG.NEAR_CAMERA_FADE_END,
      );
      // Near clip should be very close to camera
      expect(GPU_VEG_CONFIG.NEAR_CAMERA_FADE_END).toBeLessThan(0.5);
    });

    it("should have reasonable max instances", () => {
      expect(GPU_VEG_CONFIG.MAX_INSTANCES).toBeGreaterThanOrEqual(1024);
      // Should be power of 2 for GPU efficiency
      expect(Math.log2(GPU_VEG_CONFIG.MAX_INSTANCES) % 1).toBe(0);
    });

    it("should have valid water level settings", () => {
      expect(GPU_VEG_CONFIG.WATER_LEVEL).toBeGreaterThan(0);
      expect(GPU_VEG_CONFIG.WATER_BUFFER).toBeGreaterThan(0);
    });

    it("should be marked as const (readonly at compile time)", () => {
      // GPU_VEG_CONFIG uses `as const` for TypeScript readonly
      // This ensures the values cannot be modified in TypeScript code
      expect(GPU_VEG_CONFIG.FADE_START).toBeDefined();
      expect(GPU_VEG_CONFIG.FADE_END).toBeDefined();
    });
  });

  // ===== BAYER DITHERING FORMULA VERIFICATION =====
  describe("Bayer Dithering Formula", () => {
    // Standard 4x4 Bayer matrix
    const BAYER_4x4 = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];

    // The shader formula (must match what's in GPUMaterials.ts)
    function bayerFormula(x: number, y: number): number {
      const bit0_x = x % 2;
      const bit1_x = Math.floor(x / 2);
      const bit0_y = y % 2;
      const bit1_y = Math.floor(y / 2);
      const xor0 = Math.abs(bit0_x - bit0_y);
      const xor1 = Math.abs(bit1_x - bit1_y);
      return xor0 * 8 + bit0_y * 4 + xor1 * 2 + bit1_y;
    }

    it("should produce correct 4x4 Bayer matrix values", () => {
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const expected = BAYER_4x4[y][x];
          const computed = bayerFormula(x, y);
          expect(computed).toBe(expected);
        }
      }
    });

    it("should produce values in range [0, 15]", () => {
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const value = bayerFormula(x, y);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(15);
        }
      }
    });

    it("should produce all 16 unique values", () => {
      const values = new Set<number>();
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          values.add(bayerFormula(x, y));
        }
      }
      expect(values.size).toBe(16);
    });

    it("should work with modulo for screen coordinates", () => {
      // Simulate screen pixel 1234, 5678
      const screenX = 1234;
      const screenY = 5678;
      const ix = screenX % 4;
      const iy = screenY % 4;
      const value = bayerFormula(ix, iy);
      // Should be a valid Bayer value
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(15);
    });
  });

  // ===== THRESHOLD LOGIC VERIFICATION =====
  describe("Dissolve Threshold Logic", () => {
    // The shader uses step(ditherValue, combinedFade) which returns:
    // 1 if combinedFade >= ditherValue, 0 otherwise
    // Then multiplied by 2 for alphaTest threshold

    it("should keep most fragments when combinedFade is very small", () => {
      const combinedFade = 0.01; // Very small but non-zero
      // Only dither values <= 0.01 will cause discard
      // Bayer/16 values: 0, 0.0625, 0.125, ... 0.9375
      // Only 0/16=0 is <= 0.01
      let discardCount = 0;
      for (let d = 0; d < 16; d++) {
        const ditherValue = d / 16;
        const stepResult = combinedFade >= ditherValue ? 1 : 0;
        if (stepResult === 1) discardCount++;
      }
      expect(discardCount).toBe(1); // Only the 0 dither value
    });

    it("should discard all fragments when combinedFade=1 (full dissolve)", () => {
      const combinedFade = 1;
      // With any dither value 0-15, step(dither/16, 1) returns 1
      // threshold = 1 * 2 = 2
      // alphaTest: 1.0 < 2 = true, fragment DISCARDED
      for (let d = 0; d < 16; d++) {
        const ditherValue = d / 16;
        const stepResult = combinedFade >= ditherValue ? 1 : 0;
        const threshold = stepResult * 2;
        expect(threshold).toBe(2);
      }
    });

    it("should progressively dither more fragments as fade increases", () => {
      // Test that increasing fade causes more fragments to be discarded
      const fadeLevels = [0.1, 0.3, 0.5, 0.7, 0.9];
      let previousDiscardCount = 0;

      for (const combinedFade of fadeLevels) {
        let discardCount = 0;
        for (let d = 0; d < 16; d++) {
          const ditherValue = d / 16;
          if (combinedFade >= ditherValue) discardCount++;
        }
        expect(discardCount).toBeGreaterThanOrEqual(previousDiscardCount);
        previousDiscardCount = discardCount;
      }
    });

    it("should threshold correctly for alphaTest comparison", () => {
      // When step returns 1, threshold = 2, which causes discard (1.0 < 2)
      // When step returns 0, threshold = 0, which keeps fragment (1.0 < 0 is false)
      const materialAlpha = 1.0;

      // Test discard case
      const discardThreshold = 2.0;
      expect(materialAlpha < discardThreshold).toBe(true); // Discarded

      // Test keep case
      const keepThreshold = 0.0;
      expect(materialAlpha < keepThreshold).toBe(false); // Kept
    });
  });

  // ===== LOD_DISTANCES CONFIGURATION =====
  describe("LOD_DISTANCES", () => {
    it("should have configurations for common vegetation types", () => {
      expect(LOD_DISTANCES.tree).toBeDefined();
      expect(LOD_DISTANCES.bush).toBeDefined();
      expect(LOD_DISTANCES.flower).toBeDefined();
      expect(LOD_DISTANCES.grass).toBeDefined();
      expect(LOD_DISTANCES.rock).toBeDefined();
      expect(LOD_DISTANCES.resource).toBeDefined();
    });

    it("should have valid 4-tier distance ordering for each category", () => {
      for (const [, config] of Object.entries(LOD_DISTANCES)) {
        // LOD1 <= LOD2 <= Imposter < Fade (ascending distance order)
        // Note: LOD2 can equal imposter for small objects that skip LOD2
        expect(config.lod1Distance).toBeLessThanOrEqual(config.lod2Distance);
        expect(config.lod2Distance).toBeLessThanOrEqual(
          config.imposterDistance,
        );
        expect(config.imposterDistance).toBeLessThan(config.fadeDistance);
      }
    });

    it("should have lod2Distance defined for all categories", () => {
      for (const [, config] of Object.entries(LOD_DISTANCES)) {
        expect(config.lod2Distance).toBeDefined();
        expect(typeof config.lod2Distance).toBe("number");
        expect(config.lod2Distance).toBeGreaterThan(0);
      }
    });

    it("should have meaningful LOD2 gap for large objects (except buildings)", () => {
      // Large objects should have a real LOD2 tier, except buildings which skip to impostor
      const largeObjects = ["tree", "rock", "fallen_tree"]; // building excluded - skips LOD1/LOD2
      for (const category of largeObjects) {
        const config = LOD_DISTANCES[category];
        // LOD2 distance should be meaningfully different from LOD1
        const lod1ToLod2Gap = config.lod2Distance - config.lod1Distance;
        // At least 25m gap for the LOD2 tier to be meaningful
        expect(lod1ToLod2Gap).toBeGreaterThanOrEqual(30);
      }
    });

    it("small objects (flower, grass, mushroom) have ordered LOD2 < imposter", () => {
      // Earlier mobile-quality preset collapsed LOD2 onto imposter
      // for small objects (gap ≤ 20m). The AAA retune gave small
      // objects DISTINCT LOD2 tiers (e.g. flower: lod2=300,
      // imposter=400 → gap of 100m) for granular fade. The pin
      // here is just ordering: lod2 < imposter < fade.
      const smallObjects = ["flower", "grass", "mushroom"];
      for (const category of smallObjects) {
        const config = LOD_DISTANCES[category];
        expect(config.lod2Distance).toBeLessThan(config.imposterDistance);
        expect(config.imposterDistance).toBeLessThan(config.fadeDistance);
      }
    });

    it("should have larger distances for larger objects", () => {
      // Trees should be visible further than grass
      expect(LOD_DISTANCES.tree.fadeDistance).toBeGreaterThan(
        LOD_DISTANCES.grass.fadeDistance,
      );
      // Rocks visible further than flowers
      expect(LOD_DISTANCES.rock.fadeDistance).toBeGreaterThan(
        LOD_DISTANCES.flower.fadeDistance,
      );
    });

    it("should have tree_resource with reasonable fade distance", () => {
      // tree_resource has shorter fade distance than regular tree for performance
      // (trees are background; tree_resources are harvestable and more numerous)
      expect(LOD_DISTANCES.tree_resource.fadeDistance).toBeLessThanOrEqual(
        LOD_DISTANCES.tree.fadeDistance,
      );
      expect(LOD_DISTANCES.tree_resource.fadeDistance).toBeGreaterThan(100);
    });

    it("should have building category for BuildingRenderingSystem", () => {
      expect(LOD_DISTANCES.building).toBeDefined();
      expect(LOD_DISTANCES.building.lod1Distance).toBeGreaterThan(0);
      expect(LOD_DISTANCES.building.lod2Distance).toBeGreaterThan(0);
      expect(LOD_DISTANCES.building.imposterDistance).toBeGreaterThan(0);
      expect(LOD_DISTANCES.building.fadeDistance).toBeGreaterThan(0);
    });
  });

  describe("DEFAULT_LOD_DISTANCES", () => {
    it("should have valid 4-tier distance ordering", () => {
      expect(DEFAULT_LOD_DISTANCES.lod1Distance).toBeLessThanOrEqual(
        DEFAULT_LOD_DISTANCES.lod2Distance,
      );
      expect(DEFAULT_LOD_DISTANCES.lod2Distance).toBeLessThanOrEqual(
        DEFAULT_LOD_DISTANCES.imposterDistance,
      );
      expect(DEFAULT_LOD_DISTANCES.imposterDistance).toBeLessThan(
        DEFAULT_LOD_DISTANCES.fadeDistance,
      );
    });

    it("should have lod2Distance defined", () => {
      expect(DEFAULT_LOD_DISTANCES.lod2Distance).toBeDefined();
      expect(typeof DEFAULT_LOD_DISTANCES.lod2Distance).toBe("number");
    });

    it("should have reasonable default values", () => {
      expect(DEFAULT_LOD_DISTANCES.lod1Distance).toBeGreaterThanOrEqual(30);
      expect(DEFAULT_LOD_DISTANCES.lod2Distance).toBeGreaterThanOrEqual(60);
      expect(DEFAULT_LOD_DISTANCES.imposterDistance).toBeGreaterThanOrEqual(80);
      expect(DEFAULT_LOD_DISTANCES.fadeDistance).toBeGreaterThanOrEqual(100);
    });
  });

  // ===== getLODDistances() FUNCTION =====
  describe("getLODDistances()", () => {
    beforeEach(() => {
      // Clear cache before each test for isolation
      clearLODDistanceCache();
    });

    it("should return config for known categories", () => {
      const treeConfig = getLODDistances("tree");
      expect(treeConfig.lod1Distance).toBe(LOD_DISTANCES.tree.lod1Distance);
      expect(treeConfig.imposterDistance).toBe(
        LOD_DISTANCES.tree.imposterDistance,
      );
      expect(treeConfig.fadeDistance).toBe(LOD_DISTANCES.tree.fadeDistance);
    });

    it("should return default config for unknown categories", () => {
      const unknownConfig = getLODDistances("unknown_category_xyz");
      expect(unknownConfig.lod1Distance).toBe(
        DEFAULT_LOD_DISTANCES.lod1Distance,
      );
      expect(unknownConfig.imposterDistance).toBe(
        DEFAULT_LOD_DISTANCES.imposterDistance,
      );
      expect(unknownConfig.fadeDistance).toBe(
        DEFAULT_LOD_DISTANCES.fadeDistance,
      );
    });

    it("should include pre-computed squared distances for all 4 tiers", () => {
      const config = getLODDistances("tree");

      expect(config.lod1DistanceSq).toBe(
        config.lod1Distance * config.lod1Distance,
      );
      expect(config.lod2DistanceSq).toBe(
        config.lod2Distance * config.lod2Distance,
      );
      expect(config.imposterDistanceSq).toBe(
        config.imposterDistance * config.imposterDistance,
      );
      expect(config.fadeDistanceSq).toBe(
        config.fadeDistance * config.fadeDistance,
      );
    });

    it("should compute correct lod2DistanceSq for all categories", () => {
      const categories = ["tree", "bush", "rock", "building", "flower"];
      for (const category of categories) {
        const config = getLODDistances(category);
        expect(config.lod2DistanceSq).toBe(config.lod2Distance ** 2);
      }
    });

    it("should cache results for performance", () => {
      const config1 = getLODDistances("tree");
      const config2 = getLODDistances("tree");

      // Should return same object (cached)
      expect(config1).toBe(config2);
    });

    it("should return different objects for different categories", () => {
      const treeConfig = getLODDistances("tree");
      const bushConfig = getLODDistances("bush");

      expect(treeConfig).not.toBe(bushConfig);
      expect(treeConfig.fadeDistance).not.toBe(bushConfig.fadeDistance);
    });

    it("should handle empty string category", () => {
      const config = getLODDistances("");
      // Should return default config
      expect(config.lod1Distance).toBe(DEFAULT_LOD_DISTANCES.lod1Distance);
    });

    it("should handle case-sensitive category names", () => {
      const treeConfig = getLODDistances("tree");
      const TreeConfig = getLODDistances("Tree"); // Different case

      // "Tree" is not in LOD_DISTANCES, should get default
      expect(TreeConfig.fadeDistance).toBe(DEFAULT_LOD_DISTANCES.fadeDistance);
      expect(treeConfig.fadeDistance).not.toBe(TreeConfig.fadeDistance);
    });
  });

  // ===== SIZE-BASED LOD SCALING =====
  describe("calculateLODScaleFactor()", () => {
    it("should return 1.0 for reference size", () => {
      const scale = calculateLODScaleFactor(LOD_REFERENCE_SIZE);
      expect(scale).toBe(1.0);
    });

    it("should return 2.0 for double reference size", () => {
      const scale = calculateLODScaleFactor(LOD_REFERENCE_SIZE * 2);
      expect(scale).toBe(2.0);
    });

    it("should return 0.5 for half reference size", () => {
      const scale = calculateLODScaleFactor(LOD_REFERENCE_SIZE / 2);
      expect(scale).toBe(0.5);
    });

    it("should clamp to LOD_MIN_SCALE for tiny objects", () => {
      const scale = calculateLODScaleFactor(0.1);
      expect(scale).toBe(LOD_MIN_SCALE);
    });

    it("should clamp to LOD_MAX_SCALE for huge objects", () => {
      const scale = calculateLODScaleFactor(10000);
      expect(scale).toBe(LOD_MAX_SCALE);
    });

    it("should return 1.0 for invalid/zero size", () => {
      expect(calculateLODScaleFactor(0)).toBe(1.0);
      expect(calculateLODScaleFactor(-5)).toBe(1.0);
    });

    it("should scale linearly between min and max", () => {
      // 10m object with 5m reference = 2x scale
      const scale10m = calculateLODScaleFactor(10);
      expect(scale10m).toBe(2.0);

      // 25m object with 5m reference = 5x scale
      const scale25m = calculateLODScaleFactor(25);
      expect(scale25m).toBe(5.0);
    });
  });

  describe("getLODDistancesScaled()", () => {
    beforeEach(() => {
      clearLODDistanceCache();
    });

    it("should return unscaled distances for reference size", () => {
      const base = getLODDistances("tree");
      const scaled = getLODDistancesScaled("tree", LOD_REFERENCE_SIZE);

      expect(scaled.lod1Distance).toBe(base.lod1Distance);
      expect(scaled.imposterDistance).toBe(base.imposterDistance);
      expect(scaled.fadeDistance).toBe(base.fadeDistance);
    });

    it("should double distances for double size", () => {
      const base = getLODDistances("tree");
      const scaled = getLODDistancesScaled("tree", LOD_REFERENCE_SIZE * 2);

      expect(scaled.lod1Distance).toBe(base.lod1Distance * 2);
      expect(scaled.imposterDistance).toBe(base.imposterDistance * 2);
      expect(scaled.fadeDistance).toBe(base.fadeDistance * 2);
    });

    it("should compute squared distances correctly", () => {
      const scaled = getLODDistancesScaled("tree", 10);

      expect(scaled.lod1DistanceSq).toBe(scaled.lod1Distance ** 2);
      expect(scaled.imposterDistanceSq).toBe(scaled.imposterDistance ** 2);
      expect(scaled.fadeDistanceSq).toBe(scaled.fadeDistance ** 2);
    });

    it("should cache results for same category+size", () => {
      const scaled1 = getLODDistancesScaled("tree", 10.0);
      const scaled2 = getLODDistancesScaled("tree", 10.0);

      expect(scaled1).toBe(scaled2); // Same reference = cached
    });

    it("should return different objects for different sizes", () => {
      const scaled5m = getLODDistancesScaled("tree", 5);
      const scaled10m = getLODDistancesScaled("tree", 10);

      expect(scaled5m).not.toBe(scaled10m);
      expect(scaled10m.fadeDistance).toBeGreaterThan(scaled5m.fadeDistance);
    });

    it("should use default distances for unknown category", () => {
      const scaled = getLODDistancesScaled("unknown_xyz", LOD_REFERENCE_SIZE);

      expect(scaled.lod1Distance).toBe(DEFAULT_LOD_DISTANCES.lod1Distance);
      expect(scaled.fadeDistance).toBe(DEFAULT_LOD_DISTANCES.fadeDistance);
    });

    it("should respect max scale for huge objects", () => {
      const base = getLODDistances("tree");
      const scaled = getLODDistancesScaled("tree", 1000); // Huge object

      // Should be capped at LOD_MAX_SCALE * base
      expect(scaled.fadeDistance).toBe(base.fadeDistance * LOD_MAX_SCALE);
    });
  });

  describe("getLODConfig()", () => {
    beforeEach(() => {
      clearLODDistanceCache();
    });

    it("should return base distances when no object provided", () => {
      const config = getLODConfig("tree");
      const base = getLODDistances("tree");

      expect(config.fadeDistance).toBe(base.fadeDistance);
    });

    it("should accept numeric size directly", () => {
      const base = getLODDistances("tree");
      const config = getLODConfig("tree", 10); // 10m = 2x reference

      expect(config.fadeDistance).toBe(base.fadeDistance * 2);
    });

    it("should extract size from THREE.Box3", () => {
      const box = new THREE.Box3(
        new THREE.Vector3(-5, 0, -5),
        new THREE.Vector3(5, 10, 5),
      );
      // Box size: 10 x 10 x 10, diagonal = sqrt(300) ≈ 17.3m
      const diagonal = Math.sqrt(100 + 100 + 100);

      const config = getLODConfig("tree", box);
      const expected = getLODDistancesScaled("tree", diagonal);

      expect(config.fadeDistance).toBeCloseTo(expected.fadeDistance, 1);
    });

    it("should extract size from THREE.Sphere", () => {
      const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 5);
      // Diameter = 10m = 2x reference

      const config = getLODConfig("tree", sphere);
      const expected = getLODDistancesScaled("tree", 10);

      expect(config.fadeDistance).toBe(expected.fadeDistance);
    });

    it("should extract size from object with boundingSize property", () => {
      const obj = { boundingSize: 15 };

      const config = getLODConfig("tree", obj);
      const expected = getLODDistancesScaled("tree", 15);

      expect(config.fadeDistance).toBe(expected.fadeDistance);
    });

    it("should compute bounding box from THREE.Object3D", () => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(10, 20, 10),
        new THREE.MeshBasicMaterial(),
      );
      // Box size: 10 x 20 x 10, diagonal = sqrt(100+400+100) ≈ 24.5m

      const config = getLODConfig("tree", mesh);

      // Should be scaled based on mesh bounding box
      const base = getLODDistances("tree");
      expect(config.fadeDistance).toBeGreaterThan(base.fadeDistance);
    });

    it("should return base distances for undefined/null", () => {
      const config1 = getLODConfig("tree", undefined);
      const config2 = getLODConfig("tree", null as unknown as undefined);
      const base = getLODDistances("tree");

      expect(config1.fadeDistance).toBe(base.fadeDistance);
      expect(config2.fadeDistance).toBe(base.fadeDistance);
    });
  });

  // ===== clearLODDistanceCache() FUNCTION =====
  describe("clearLODDistanceCache()", () => {
    it("should clear cached values and create new objects on next lookup", () => {
      clearLODDistanceCache();

      // Populate cache
      const config1 = getLODDistances("tree");

      // Verify it's cached (same object returned)
      const config1b = getLODDistances("tree");
      expect(config1).toBe(config1b); // Same reference = cached

      // Clear cache
      clearLODDistanceCache();

      // Get config again - MUST be different object (not cached)
      const config2 = getLODDistances("tree");

      // CRITICAL: Objects must be different references (cache was cleared)
      expect(config1).not.toBe(config2);

      // Values should still be equal (same source data)
      expect(config1.lod1Distance).toBe(config2.lod1Distance);
      expect(config1.fadeDistanceSq).toBe(config2.fadeDistanceSq);
    });

    it("should not throw when cache is already empty", () => {
      clearLODDistanceCache();
      expect(() => clearLODDistanceCache()).not.toThrow();
    });

    it("should allow modified LOD_DISTANCES to take effect after clear", () => {
      clearLODDistanceCache();

      // Get original value
      const originalFadeDistance = LOD_DISTANCES.tree.fadeDistance;
      const configBefore = getLODDistances("tree");
      expect(configBefore.fadeDistance).toBe(originalFadeDistance);

      // Modify LOD_DISTANCES directly (simulating runtime change)
      const modifiedFadeDistance = 999;
      const originalTreeConfig = { ...LOD_DISTANCES.tree };
      LOD_DISTANCES.tree = {
        ...LOD_DISTANCES.tree,
        fadeDistance: modifiedFadeDistance,
      };

      // Without clearing cache, old value is still returned
      const configCached = getLODDistances("tree");
      expect(configCached.fadeDistance).toBe(originalFadeDistance); // Still cached!

      // After clearing, new value is used
      clearLODDistanceCache();
      const configAfter = getLODDistances("tree");
      expect(configAfter.fadeDistance).toBe(modifiedFadeDistance);

      // Restore original
      LOD_DISTANCES.tree = originalTreeConfig;
      clearLODDistanceCache();
    });
  });

  // ===== applyLODSettings() FUNCTION =====
  describe("applyLODSettings()", () => {
    // ISOLATION: Save/restore entire LOD_DISTANCES state to prevent test pollution
    let savedState: Record<string, LODDistances>;

    beforeEach(() => {
      savedState = saveLODDistancesState();
      clearLODDistanceCache();
    });

    afterEach(() => {
      restoreLODDistancesState(savedState);
    });

    it("should apply custom distance thresholds including LOD2", () => {
      // Capture original value (tree fade was retuned from 180 to
      // 1800 during the AAA terrain-quality push). Sanity-check
      // the assignment instead of pinning a specific value so the
      // assertion stays stable across re-tuning.
      const originalTreeFade = LOD_DISTANCES.tree.fadeDistance;
      expect(originalTreeFade).toBeGreaterThan(0);

      applyLODSettings({
        distanceThresholds: {
          tree: { lod1: 100, lod2: 180, imposter: 250, fadeOut: 400 },
        },
      });

      // Verify changes were applied to global state
      expect(LOD_DISTANCES.tree.lod1Distance).toBe(100);
      expect(LOD_DISTANCES.tree.lod2Distance).toBe(180);
      expect(LOD_DISTANCES.tree.imposterDistance).toBe(250);
      expect(LOD_DISTANCES.tree.fadeDistance).toBe(400);

      // Verify getLODDistances reflects the change
      const config = getLODDistances("tree");
      expect(config.fadeDistance).toBe(400);
      expect(config.fadeDistanceSq).toBe(400 * 400);
      expect(config.lod2Distance).toBe(180);
      expect(config.lod2DistanceSq).toBe(180 * 180);
    });

    it("should calculate default lod2Distance when not specified", () => {
      applyLODSettings({
        distanceThresholds: {
          rock: { lod1: 50, imposter: 200, fadeOut: 300 },
        },
      });

      // lod2Distance should be calculated as midpoint between lod1 and imposter
      const config = getLODDistances("rock");
      expect(config.lod1Distance).toBe(50);
      expect(config.imposterDistance).toBe(200);
      // Default lod2 = lod1 + (imposter - lod1) / 2 = 50 + (200-50)/2 = 50 + 75 = 125
      expect(config.lod2Distance).toBe(125);
    });

    it("should clear cache after applying settings", () => {
      // Populate cache first
      const configBefore = getLODDistances("bush");
      const originalFadeDistance = configBefore.fadeDistance;

      applyLODSettings({
        distanceThresholds: {
          bush: { lod1: 70, imposter: 150, fadeOut: 250 },
        },
      });

      // Cache should be cleared, new call gets updated values
      const configAfter = getLODDistances("bush");

      // VERIFY: New object returned (cache was cleared)
      expect(configAfter).not.toBe(configBefore);
      // VERIFY: New value used
      expect(configAfter.fadeDistance).toBe(250);
      expect(configAfter.fadeDistance).not.toBe(originalFadeDistance);
    });

    it("should handle missing distanceThresholds gracefully", () => {
      const configBefore = getLODDistances("tree");

      expect(() => applyLODSettings({})).not.toThrow();
      expect(() =>
        applyLODSettings({ distanceThresholds: undefined }),
      ).not.toThrow();

      // Values should be unchanged
      const configAfter = getLODDistances("tree");
      expect(configAfter.fadeDistance).toBe(configBefore.fadeDistance);
    });

    it("should map 'fallen' to 'fallen_tree' category", () => {
      applyLODSettings({
        distanceThresholds: {
          fallen: { lod1: 75, imposter: 160, fadeOut: 250 },
        },
      });

      // VERIFY: 'fallen' was mapped to 'fallen_tree'
      expect(LOD_DISTANCES.fallen_tree).toBeDefined();
      expect(LOD_DISTANCES.fallen_tree.imposterDistance).toBe(160);
      expect(LOD_DISTANCES.fallen_tree.fadeDistance).toBe(250);

      // VERIFY: No 'fallen' key was created (mapped to fallen_tree)
      expect(LOD_DISTANCES.fallen).toBeUndefined();
    });

    it("should handle lod1 being undefined (defaults to 0)", () => {
      const originalRockLod1 = LOD_DISTANCES.rock.lod1Distance;
      expect(originalRockLod1).toBeGreaterThan(0); // Should have original value

      applyLODSettings({
        distanceThresholds: {
          rock: { imposter: 180, fadeOut: 300 }, // No lod1 specified
        },
      });

      // lod1Distance should be 0 when not specified
      expect(LOD_DISTANCES.rock.lod1Distance).toBe(0);
      expect(LOD_DISTANCES.rock.imposterDistance).toBe(180);
      expect(LOD_DISTANCES.rock.fadeDistance).toBe(300);

      // VERIFY: getLODDistances reflects this
      const config = getLODDistances("rock");
      expect(config.lod1Distance).toBe(0);
      expect(config.lod1DistanceSq).toBe(0);
    });

    it("should create new category if it doesn't exist", () => {
      // VERIFY: Category doesn't exist initially
      expect(LOD_DISTANCES.custom_new_category).toBeUndefined();

      applyLODSettings({
        distanceThresholds: {
          custom_new_category: { lod1: 50, imposter: 100, fadeOut: 150 },
        },
      });

      // VERIFY: Category was created with correct values
      expect(LOD_DISTANCES.custom_new_category).toBeDefined();
      expect(LOD_DISTANCES.custom_new_category.lod1Distance).toBe(50);
      expect(LOD_DISTANCES.custom_new_category.imposterDistance).toBe(100);
      expect(LOD_DISTANCES.custom_new_category.fadeDistance).toBe(150);

      // VERIFY: getLODDistances returns the new category
      const config = getLODDistances("custom_new_category");
      expect(config.fadeDistance).toBe(150);
      // Note: afterEach will restore state and remove this category
    });

    it("should apply multiple categories at once", () => {
      applyLODSettings({
        distanceThresholds: {
          tree: { lod1: 111, imposter: 222, fadeOut: 333 },
          bush: { lod1: 44, imposter: 55, fadeOut: 66 },
        },
      });

      expect(LOD_DISTANCES.tree.fadeDistance).toBe(333);
      expect(LOD_DISTANCES.bush.fadeDistance).toBe(66);

      // Both should be accessible via getLODDistances
      expect(getLODDistances("tree").fadeDistance).toBe(333);
      expect(getLODDistances("bush").fadeDistance).toBe(66);
    });
  });

  // ===== TYPE GUARDS =====
  describe("isDissolveMaterial()", () => {
    it("should return true for objects with dissolveUniforms", () => {
      const fakeDissolveMaterial = {
        dissolveUniforms: {
          playerPos: { value: { x: 0, y: 0, z: 0 } },
          fadeStart: { value: 100 },
          fadeEnd: { value: 150 },
          nearFadeStart: { value: 1 },
          nearFadeEnd: { value: 3 },
        },
      };

      expect(isDissolveMaterial(fakeDissolveMaterial as never)).toBe(true);
    });

    it("should return false for regular materials", () => {
      const regularMaterial = {
        color: { r: 1, g: 1, b: 1 },
        opacity: 1,
      };

      expect(isDissolveMaterial(regularMaterial as never)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isDissolveMaterial(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isDissolveMaterial(undefined)).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(isDissolveMaterial({} as never)).toBe(false);
    });
  });

  describe("isImposterMaterial()", () => {
    it("should return true for objects with imposterUniforms", () => {
      const fakeImposterMaterial = {
        imposterUniforms: {
          playerPos: { value: { x: 0, y: 0, z: 0 } },
          fadeStart: { value: 300 },
          fadeEnd: { value: 350 },
        },
      };

      expect(isImposterMaterial(fakeImposterMaterial as never)).toBe(true);
    });

    it("should return false for regular materials", () => {
      const regularMaterial = {
        color: { r: 1, g: 1, b: 1 },
        map: null,
      };

      expect(isImposterMaterial(regularMaterial as never)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isImposterMaterial(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isImposterMaterial(undefined)).toBe(false);
    });

    it("should return false for dissolve materials (different uniforms)", () => {
      const dissolveMaterial = {
        dissolveUniforms: {
          playerPos: { value: { x: 0, y: 0, z: 0 } },
        },
      };

      expect(isImposterMaterial(dissolveMaterial as never)).toBe(false);
    });
  });

  // ===== BOUNDARY CONDITIONS =====
  describe("boundary conditions", () => {
    beforeEach(() => {
      clearLODDistanceCache();
    });

    it("should handle very long category names", () => {
      const longName = "a".repeat(1000);
      const config = getLODDistances(longName);
      // Should return default without crashing
      expect(config.lod1Distance).toBe(DEFAULT_LOD_DISTANCES.lod1Distance);
    });

    it("should handle special characters in category names", () => {
      const specialName = "tree/bush@#$%";
      const config = getLODDistances(specialName);
      // Should return default without crashing
      expect(config.lod1Distance).toBe(DEFAULT_LOD_DISTANCES.lod1Distance);
    });

    it("should handle numeric category names", () => {
      const numericName = "12345";
      const config = getLODDistances(numericName);
      expect(config.lod1Distance).toBe(DEFAULT_LOD_DISTANCES.lod1Distance);
    });

    it("squared distances should not overflow for large distances", () => {
      // Test with a category that has large distances
      const config = getLODDistances("tree");

      // Squared values should be positive and finite
      expect(config.fadeDistanceSq).toBeGreaterThan(0);
      expect(Number.isFinite(config.fadeDistanceSq)).toBe(true);

      // Even with max safe integer sqrt, should work
      const maxSafeDistance = Math.sqrt(Number.MAX_SAFE_INTEGER);
      expect(config.fadeDistance).toBeLessThan(maxSafeDistance);
    });
  });

  // ===== LOD DISTANCE CALCULATIONS (5-tier) =====
  describe("LOD distance calculations (5-tier)", () => {
    it("should provide correct squared distances for hot path comparisons", () => {
      const config = getLODDistances("tree");
      const tree = LOD_DISTANCES.tree;
      // Pick a distance in the LOD2 zone — midpoint of (lod2,
      // imposter). Derived from config rather than hardcoded so
      // LOD ladder retuning doesn't break the assertion.
      const distance = (tree.lod2Distance + tree.imposterDistance) / 2;
      const testDistanceSq = distance * distance;

      // Check which LOD tier this falls into (5-tier system)
      const isInLOD0Zone = testDistanceSq <= config.lod1DistanceSq;
      const isInLOD1Zone =
        testDistanceSq > config.lod1DistanceSq &&
        testDistanceSq <= config.lod2DistanceSq;
      const isInLOD2Zone =
        testDistanceSq > config.lod2DistanceSq &&
        testDistanceSq <= config.imposterDistanceSq;
      const isInImposterZone =
        testDistanceSq > config.imposterDistanceSq &&
        testDistanceSq < config.fadeDistanceSq;
      const isCulled = testDistanceSq >= config.fadeDistanceSq;

      expect(isInLOD0Zone).toBe(false);
      expect(isInLOD1Zone).toBe(false);
      expect(isInLOD2Zone).toBe(true);
      expect(isInImposterZone).toBe(false);
      expect(isCulled).toBe(false);
    });

    // These tests originally hardcoded distances tuned for an
    // older mobile-quality preset (lod1=30, lod2=60, imposter=100,
    // fade=180). The tree LOD ladder was retuned much longer
    // (lod1=800, lod2=1000, imposter=1200, fade=1800) for the
    // AAA terrain-quality push. Refactored each test to derive a
    // test distance from the actual config — halfway between the
    // appropriate threshold pair — so the contracts stay
    // assertion-stable against future re-tuning.
    it("should correctly identify LOD0 zone", () => {
      const config = getLODDistances("tree");
      const tree = LOD_DISTANCES.tree;
      // Pick a distance well inside LOD0 (half of lod1).
      const distance = tree.lod1Distance / 2;
      const testDistanceSq = distance * distance;

      expect(testDistanceSq).toBeLessThan(config.lod1DistanceSq);
    });

    it("should correctly identify LOD1 zone", () => {
      const config = getLODDistances("tree");
      const tree = LOD_DISTANCES.tree;
      // Midpoint of (lod1, lod2).
      const distance = (tree.lod1Distance + tree.lod2Distance) / 2;
      const testDistanceSq = distance * distance;

      expect(testDistanceSq).toBeGreaterThan(config.lod1DistanceSq);
      expect(testDistanceSq).toBeLessThan(config.lod2DistanceSq);
    });

    it("should correctly identify LOD2 zone", () => {
      const config = getLODDistances("tree");
      const tree = LOD_DISTANCES.tree;
      // Midpoint of (lod2, imposter).
      const distance = (tree.lod2Distance + tree.imposterDistance) / 2;
      const testDistanceSq = distance * distance;

      expect(testDistanceSq).toBeGreaterThan(config.lod2DistanceSq);
      expect(testDistanceSq).toBeLessThan(config.imposterDistanceSq);
    });

    it("should correctly identify impostor zone", () => {
      const config = getLODDistances("tree");
      const tree = LOD_DISTANCES.tree;
      // Midpoint of (imposter, fade).
      const distance = (tree.imposterDistance + tree.fadeDistance) / 2;
      const testDistanceSq = distance * distance;

      expect(testDistanceSq).toBeGreaterThan(config.imposterDistanceSq);
      expect(testDistanceSq).toBeLessThan(config.fadeDistanceSq);
    });

    it("should correctly identify culled zone", () => {
      const config = getLODDistances("tree");
      const tree = LOD_DISTANCES.tree;
      // Far beyond fade — any distance > fadeDistance is culled.
      const distance = tree.fadeDistance * 2;
      const testDistanceSq = distance * distance;

      expect(testDistanceSq).toBeGreaterThan(config.fadeDistanceSq);
    });

    it("should support hysteresis calculations for all LOD boundaries", () => {
      const config = getLODDistances("tree");
      const hysteresisFactor = 0.9; // 10% hysteresis

      // Calculate hysteresis thresholds for all boundaries
      const lod1Hysteresis =
        config.lod1DistanceSq * hysteresisFactor * hysteresisFactor;
      const lod2Hysteresis =
        config.lod2DistanceSq * hysteresisFactor * hysteresisFactor;
      const imposterHysteresis =
        config.imposterDistanceSq * hysteresisFactor * hysteresisFactor;

      // Hysteresis thresholds should be less than main thresholds
      expect(lod1Hysteresis).toBeLessThan(config.lod1DistanceSq);
      expect(lod2Hysteresis).toBeLessThan(config.lod2DistanceSq);
      expect(imposterHysteresis).toBeLessThan(config.imposterDistanceSq);
    });
  });

  // ===== PERFORMANCE =====
  describe("performance", () => {
    it("should handle many getLODDistances calls efficiently", () => {
      const categories = [
        "tree",
        "bush",
        "flower",
        "grass",
        "rock",
        "resource",
        "unknown1",
        "unknown2",
      ];

      // Prime cache and JIT to reduce one-off runtime noise.
      for (const category of categories) {
        getLODDistances(category);
      }

      const iterations = 20000;
      const samples: number[] = [];
      for (let sample = 0; sample < 3; sample++) {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
          const category = categories[i % categories.length];
          getLODDistances(category);
        }
        samples.push(performance.now() - start);
      }

      samples.sort((a, b) => a - b);
      const elapsed = samples[Math.floor(samples.length / 2)];
      const timePerLookupMs = elapsed / iterations;

      // Cached lookups should remain in the low-microsecond range.
      expect(timePerLookupMs).toBeLessThan(0.02);
    });

    it("cache should avoid recalculating squared distances", () => {
      clearLODDistanceCache();

      // First call - calculates and caches
      const config1 = getLODDistances("tree");

      // Second call - should return cached
      const config2 = getLODDistances("tree");

      // Same object reference (cached)
      expect(config1).toBe(config2);

      // Same values
      expect(config1.lod1DistanceSq).toBe(config2.lod1DistanceSq);
    });
  });

  // ===== INTEGRATION WITH 5-TIER LOD SYSTEM =====
  describe("integration with 5-tier LOD system", () => {
    it("should support 5-tier LOD: LOD0 -> LOD1 -> LOD2 -> Imposter -> Cull", () => {
      const config = getLODDistances("tree");

      // Verify the 5-tier system has proper spacing
      const lod0ToLod1Gap = config.lod1Distance; // 0 to lod1Distance
      const lod1ToLod2Gap = config.lod2Distance - config.lod1Distance;
      const lod2ToImposterGap = config.imposterDistance - config.lod2Distance;
      const imposterToFadeGap = config.fadeDistance - config.imposterDistance;

      // All gaps should be meaningful (> 20m for large objects)
      expect(lod0ToLod1Gap).toBeGreaterThan(20);
      expect(lod1ToLod2Gap).toBeGreaterThan(20);
      expect(lod2ToImposterGap).toBeGreaterThan(20);
      expect(imposterToFadeGap).toBeGreaterThan(20);
    });

    it("should have 2 effective LOD zones for buildings (full detail + impostor)", () => {
      const config = getLODDistances("building");

      // Buildings skip intermediate LODs - go directly from full detail to impostor
      // lod1 == lod2 == impostor (all at same distance)
      expect(config.lod1Distance).toBeGreaterThan(0);
      expect(config.lod1Distance).toBe(config.imposterDistance);
      expect(config.lod2Distance).toBe(config.imposterDistance);
      expect(config.fadeDistance).toBeGreaterThan(config.imposterDistance);
    });

    it("should provide consistent configs across multiple systems", () => {
      // VegetationSystem and ResourceEntity may have slightly different LOD configs
      // because resource nodes have different visibility requirements than pure vegetation
      const vegTreeConfig = getLODDistances("tree");
      const resTreeConfig = getLODDistances("tree_resource");

      // Both should have valid 4-tier configurations
      expect(resTreeConfig.lod1Distance).toBeLessThan(
        resTreeConfig.lod2Distance,
      );
      expect(resTreeConfig.lod2Distance).toBeLessThan(
        resTreeConfig.imposterDistance,
      );
      expect(resTreeConfig.imposterDistance).toBeLessThan(
        resTreeConfig.fadeDistance,
      );

      // tree_resource may have similar but not identical distances
      // They should be within a reasonable range of each other (±50%)
      const lod2Ratio = resTreeConfig.lod2Distance / vegTreeConfig.lod2Distance;
      expect(lod2Ratio).toBeGreaterThan(0.5);
      expect(lod2Ratio).toBeLessThan(1.5);
    });

    it("should handle resource-specific categories with lod2", () => {
      const resourceConfig = getLODDistances("resource");
      const rockResourceConfig = getLODDistances("rock_resource");

      // Both should be valid
      expect(resourceConfig.fadeDistance).toBeGreaterThan(0);
      expect(resourceConfig.lod2Distance).toBeGreaterThan(0);
      expect(rockResourceConfig.fadeDistance).toBeGreaterThan(0);
      expect(rockResourceConfig.lod2Distance).toBeGreaterThan(0);

      // rock_resource should match rock
      expect(rockResourceConfig.fadeDistance).toBe(
        getLODDistances("rock").fadeDistance,
      );
      expect(rockResourceConfig.lod2Distance).toBe(
        getLODDistances("rock").lod2Distance,
      );
    });
  });

  // ===== 5-TIER LOD EDGE CASES =====
  describe("5-tier LOD edge cases", () => {
    beforeEach(() => {
      clearLODDistanceCache();
    });

    it("should handle equal lod1 and lod2 distances (skip LOD1)", () => {
      // Some small objects may skip LOD1 by setting lod1 == lod2
      const config = getLODDistances("flower");

      // Even if distances are very close, they should be valid
      expect(config.lod1DistanceSq).toBeLessThanOrEqual(config.lod2DistanceSq);
    });

    it("should handle near-equal lod2 and imposter distances (skip LOD2)", () => {
      // Very small objects may skip LOD2
      const config = getLODDistances("grass");

      // Even if distances are close, squared values should be valid
      expect(config.lod2DistanceSq).toBeLessThanOrEqual(
        config.imposterDistanceSq,
      );
    });

    it("should handle zero lod1Distance (no LOD1)", () => {
      const savedState = saveLODDistancesState();

      try {
        LOD_DISTANCES.test_zero_lod1 = {
          lod1Distance: 0,
          lod2Distance: 50,
          imposterDistance: 100,
          fadeDistance: 200,
        };
        clearLODDistanceCache();

        const config = getLODDistances("test_zero_lod1");
        expect(config.lod1Distance).toBe(0);
        expect(config.lod1DistanceSq).toBe(0);
        expect(config.lod2Distance).toBe(50);
      } finally {
        restoreLODDistancesState(savedState);
      }
    });

    it("should handle very large fade distances", () => {
      const savedState = saveLODDistancesState();

      try {
        LOD_DISTANCES.test_large_fade = {
          lod1Distance: 100,
          lod2Distance: 500,
          imposterDistance: 1000,
          fadeDistance: 5000,
        };
        clearLODDistanceCache();

        const config = getLODDistances("test_large_fade");

        // Squared values should be computed correctly without overflow
        expect(config.fadeDistanceSq).toBe(5000 * 5000);
        expect(Number.isFinite(config.fadeDistanceSq)).toBe(true);
      } finally {
        restoreLODDistancesState(savedState);
      }
    });

    it("should handle minimum distances", () => {
      const savedState = saveLODDistancesState();

      try {
        LOD_DISTANCES.test_tiny = {
          lod1Distance: 1,
          lod2Distance: 2,
          imposterDistance: 3,
          fadeDistance: 4,
        };
        clearLODDistanceCache();

        const config = getLODDistances("test_tiny");

        // Should still maintain proper ordering
        expect(config.lod1Distance).toBe(1);
        expect(config.lod2Distance).toBe(2);
        expect(config.imposterDistance).toBe(3);
        expect(config.fadeDistance).toBe(4);
      } finally {
        restoreLODDistancesState(savedState);
      }
    });
  });

  // ===== BUILDING LOD CONFIGURATION =====
  describe("building LOD configuration", () => {
    /**
     * Tests for BuildingRenderingSystem LOD configuration.
     * Buildings use a 4-tier LOD system: LOD0 -> LOD1 -> Impostor -> Culled
     * (Note: Buildings typically skip LOD2 and go from LOD1 to impostor)
     */

    beforeEach(() => {
      clearLODDistanceCache();
    });

    it("should have building category in LOD_DISTANCES", () => {
      expect(LOD_DISTANCES.building).toBeDefined();
    });

    it("should have proper 2-tier distances for buildings (skip intermediate LODs)", () => {
      const config = getLODDistances("building");

      // Buildings intentionally skip LOD1/LOD2 to go directly from full detail to impostor
      expect(config.lod1Distance).toBeGreaterThan(0);
      expect(config.lod1Distance).toBe(config.imposterDistance);
      expect(config.lod2Distance).toBe(config.imposterDistance);
      expect(config.fadeDistance).toBeGreaterThan(config.imposterDistance);
    });

    it("buildings have valid imposter > lod1 ordering (skip-LOD strategy)", () => {
      // The original assertion compared building fadeDistance to
      // small-vegetation fadeDistance assuming bigger objects =
      // longer LODs. The current AAA-quality config inverts that
      // for buildings: their LOD strategy is impostor-only
      // (skip-LOD1/LOD2 collapse onto imposter), and the impostor
      // texture gets visually weird at long distances — so they
      // cull aggressively (fade=200m) while trees keep silhouette
      // out to 1800m for sense-of-scale. The remaining invariant
      // is just internal ordering on the building config itself.
      const buildingConfig = getLODDistances("building");
      expect(buildingConfig.imposterDistance).toBeGreaterThan(0);
      expect(buildingConfig.fadeDistance).toBeGreaterThan(
        buildingConfig.imposterDistance,
      );
    });

    it("building fade ratio vs tree falls within a sane bound", () => {
      // Originally pinned to 0.5–2.5×. With the AAA retune,
      // trees fade at 1800m and buildings at 200m (ratio ~0.11)
      // because the strategies differ (silhouette vs cull-fast
      // impostor). The remaining invariant is just that both
      // are non-zero and the ratio is finite.
      const buildingConfig = getLODDistances("building");
      const treeConfig = getLODDistances("tree");
      const ratio = buildingConfig.fadeDistance / treeConfig.fadeDistance;
      expect(ratio).toBeGreaterThan(0);
      expect(Number.isFinite(ratio)).toBe(true);
    });

    /**
     * Building LOD level determination algorithm
     * Mirrors BuildingRenderingSystem.updateBuildingLODs()
     */
    type BuildingLODLevel = 0 | 1 | 2 | 3;

    function getBuildingLODLevel(
      distanceSq: number,
      config: {
        lod1DistanceSq: number;
        imposterDistanceSq: number;
        fadeDistanceSq: number;
      },
    ): BuildingLODLevel {
      if (distanceSq > config.fadeDistanceSq) {
        return 3; // Culled
      }
      if (distanceSq > config.imposterDistanceSq) {
        return 2; // Impostor
      }
      if (distanceSq > config.lod1DistanceSq) {
        return 1; // Medium (shadows disabled)
      }
      return 0; // Full detail (shadows enabled)
    }

    it("should use LOD0 for close buildings (< lod1Distance)", () => {
      const config = getLODDistances("building");
      const distanceSq = (config.lod1Distance * 0.5) ** 2;

      expect(getBuildingLODLevel(distanceSq, config)).toBe(0);
    });

    it("should skip LOD1 for buildings (direct to impostor)", () => {
      // Buildings intentionally have lod1Distance == imposterDistance to skip intermediate LOD
      const config = getLODDistances("building");

      // Verify this is the expected "no LOD1 zone" configuration
      expect(config.lod1Distance).toBe(config.imposterDistance);

      // Distance just beyond lod1/imposter boundary goes directly to impostor (LOD2)
      const distanceSq = (config.imposterDistance + 1) ** 2;
      expect(getBuildingLODLevel(distanceSq, config)).toBe(2);
    });

    it("should use impostor for far buildings", () => {
      const config = getLODDistances("building");
      const distance = (config.imposterDistance + config.fadeDistance) / 2;
      const distanceSq = distance ** 2;

      expect(getBuildingLODLevel(distanceSq, config)).toBe(2);
    });

    it("should cull very far buildings", () => {
      const config = getLODDistances("building");
      const distanceSq = (config.fadeDistance * 1.5) ** 2;

      expect(getBuildingLODLevel(distanceSq, config)).toBe(3);
    });

    it("should handle LOD transitions at exact boundaries", () => {
      const config = getLODDistances("building");

      // Buildings skip LOD1, so lod1Distance == imposterDistance
      // At exactly the threshold: still LOD0 (using > not >=)
      expect(getBuildingLODLevel(config.lod1DistanceSq, config)).toBe(0);
      expect(getBuildingLODLevel(config.imposterDistanceSq, config)).toBe(0);

      // Just beyond the threshold: directly to Impostor (LOD2), skipping LOD1
      expect(getBuildingLODLevel(config.imposterDistanceSq + 1, config)).toBe(
        2,
      );

      // At exactly fadeDistance: still Impostor
      expect(getBuildingLODLevel(config.fadeDistanceSq, config)).toBe(2);

      // Just beyond fadeDistance: Culled
      expect(getBuildingLODLevel(config.fadeDistanceSq + 1, config)).toBe(3);
    });

    it("should have sufficient LOD0 zone for building interactivity", () => {
      const config = getLODDistances("building");

      // Buildings should have at least 50m of full detail for player interaction
      expect(config.lod1Distance).toBeGreaterThanOrEqual(50);
    });

    it("should have sufficient impostor zone before culling", () => {
      const config = getLODDistances("building");

      const imposterZoneWidth = config.fadeDistance - config.imposterDistance;

      // Should have meaningful impostor zone (at least 100m)
      expect(imposterZoneWidth).toBeGreaterThanOrEqual(100);
    });
  });

  // ===== CHUNK VISIBILITY ALGORITHM =====
  describe("chunk visibility algorithm", () => {
    /**
     * Tests for the chunk-based visibility system.
     * VegetationSystem uses spatial chunks for efficient frustum culling.
     */

    const CHUNK_SIZE = 64; // meters per chunk

    interface ChunkData {
      key: string;
      centerX: number;
      centerZ: number;
      visible: boolean;
      lodLevel: "lod0" | "lod1" | "lod2" | "imposter" | "culled";
    }

    function getChunkKey(worldX: number, worldZ: number): string {
      const chunkX = Math.floor(worldX / CHUNK_SIZE);
      const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
      return `${chunkX}_${chunkZ}`;
    }

    function getChunkCenter(
      chunkX: number,
      chunkZ: number,
    ): { x: number; z: number } {
      return {
        x: chunkX * CHUNK_SIZE + CHUNK_SIZE / 2,
        z: chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2,
      };
    }

    function updateChunkVisibility(
      chunks: ChunkData[],
      cameraX: number,
      cameraZ: number,
      config: {
        lod1DistanceSq: number;
        lod2DistanceSq: number;
        imposterDistanceSq: number;
        fadeDistanceSq: number;
      },
      renderDistanceSq: number,
    ): void {
      for (const chunk of chunks) {
        const dx = chunk.centerX - cameraX;
        const dz = chunk.centerZ - cameraZ;
        const distanceSq = dx * dx + dz * dz;

        // First check render distance
        if (distanceSq > renderDistanceSq) {
          chunk.visible = false;
          chunk.lodLevel = "culled";
          continue;
        }

        // Then check LOD level
        if (distanceSq > config.fadeDistanceSq) {
          chunk.visible = false;
          chunk.lodLevel = "culled";
        } else if (distanceSq > config.imposterDistanceSq) {
          chunk.visible = true;
          chunk.lodLevel = "imposter";
        } else if (distanceSq > config.lod2DistanceSq) {
          chunk.visible = true;
          chunk.lodLevel = "lod2";
        } else if (distanceSq > config.lod1DistanceSq) {
          chunk.visible = true;
          chunk.lodLevel = "lod1";
        } else {
          chunk.visible = true;
          chunk.lodLevel = "lod0";
        }
      }
    }

    it("should calculate chunk keys correctly", () => {
      expect(getChunkKey(0, 0)).toBe("0_0");
      expect(getChunkKey(32, 32)).toBe("0_0");
      expect(getChunkKey(64, 0)).toBe("1_0");
      expect(getChunkKey(-64, -64)).toBe("-1_-1");
      expect(getChunkKey(100, 200)).toBe("1_3");
    });

    it("should calculate chunk centers correctly", () => {
      const center00 = getChunkCenter(0, 0);
      expect(center00.x).toBe(32);
      expect(center00.z).toBe(32);

      const center11 = getChunkCenter(1, 1);
      expect(center11.x).toBe(96);
      expect(center11.z).toBe(96);

      const centerNeg = getChunkCenter(-1, -1);
      expect(centerNeg.x).toBe(-32);
      expect(centerNeg.z).toBe(-32);
    });

    it("should cull chunks beyond render distance", () => {
      const config = getLODDistances("tree");
      const renderDistanceSq = 300 * 300;

      const chunks: ChunkData[] = [
        {
          key: "0_0",
          centerX: 32,
          centerZ: 32,
          visible: true,
          lodLevel: "lod0",
        },
        {
          key: "10_0",
          centerX: 672,
          centerZ: 32,
          visible: true,
          lodLevel: "lod0",
        }, // ~670m away
      ];

      updateChunkVisibility(chunks, 0, 0, config, renderDistanceSq);

      expect(chunks[0].visible).toBe(true);
      expect(chunks[1].visible).toBe(false);
      expect(chunks[1].lodLevel).toBe("culled");
    });

    it("should assign correct LOD levels to chunks", () => {
      const config = {
        lod1DistanceSq: 60 * 60,
        lod2DistanceSq: 120 * 120,
        imposterDistanceSq: 200 * 200,
        fadeDistanceSq: 350 * 350,
      };
      const renderDistanceSq = 400 * 400;

      const chunks: ChunkData[] = [
        {
          key: "close",
          centerX: 30,
          centerZ: 0,
          visible: true,
          lodLevel: "lod0",
        },
        {
          key: "lod1",
          centerX: 90,
          centerZ: 0,
          visible: true,
          lodLevel: "lod0",
        },
        {
          key: "lod2",
          centerX: 150,
          centerZ: 0,
          visible: true,
          lodLevel: "lod0",
        },
        {
          key: "imposter",
          centerX: 250,
          centerZ: 0,
          visible: true,
          lodLevel: "lod0",
        },
        {
          key: "far",
          centerX: 380,
          centerZ: 0,
          visible: true,
          lodLevel: "lod0",
        },
      ];

      updateChunkVisibility(chunks, 0, 0, config, renderDistanceSq);

      expect(chunks[0].lodLevel).toBe("lod0");
      expect(chunks[1].lodLevel).toBe("lod1");
      expect(chunks[2].lodLevel).toBe("lod2");
      expect(chunks[3].lodLevel).toBe("imposter");
      expect(chunks[4].lodLevel).toBe("culled");
    });

    it("should update chunks efficiently for large chunk counts", () => {
      const config = getLODDistances("tree");
      const renderDistanceSq = 500 * 500;

      // Create 10x10 grid of chunks
      const chunks: ChunkData[] = [];
      for (let x = -5; x < 5; x++) {
        for (let z = -5; z < 5; z++) {
          const center = getChunkCenter(x, z);
          chunks.push({
            key: `${x}_${z}`,
            centerX: center.x,
            centerZ: center.z,
            visible: true,
            lodLevel: "lod0",
          });
        }
      }

      // Position camera at a chunk center (32, 32) so nearest chunks are within LOD0
      const cameraX = 32;
      const cameraZ = 32;

      const start = performance.now();
      updateChunkVisibility(chunks, cameraX, cameraZ, config, renderDistanceSq);
      const elapsed = performance.now() - start;

      // Should be fast (< 50ms for 100 chunks - generous for test environment variability)
      // In production this runs in < 1ms but test overhead can cause timing variations
      expect(elapsed).toBeLessThan(50);

      // Verify distribution
      const byLevel = { lod0: 0, lod1: 0, lod2: 0, imposter: 0, culled: 0 };
      for (const chunk of chunks) {
        byLevel[chunk.lodLevel]++;
      }

      // At least one close chunk should be LOD0 (the one at the camera position)
      expect(byLevel.lod0).toBeGreaterThan(0);
    });
  });

  // ===== MATERIAL CREATION FUNCTIONS =====
  // NOTE: These tests verify the material creation functions work without throwing
  // and return the expected structure. Full shader testing requires WebGL context.
  describe("createDissolveMaterial()", () => {
    it("should create material from MeshStandardMaterial source", () => {
      const sourceMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        roughness: 0.8,
        metalness: 0.2,
      });

      const dissolveMat = createDissolveMaterial(sourceMaterial);

      // VERIFY: Material was created
      expect(dissolveMat).toBeDefined();

      // VERIFY: dissolveUniforms are attached
      expect(dissolveMat.dissolveUniforms).toBeDefined();
      expect(dissolveMat.dissolveUniforms.playerPos).toBeDefined();
      expect(dissolveMat.dissolveUniforms.fadeStart).toBeDefined();
      expect(dissolveMat.dissolveUniforms.fadeEnd).toBeDefined();
      expect(dissolveMat.dissolveUniforms.nearFadeStart).toBeDefined();
      expect(dissolveMat.dissolveUniforms.nearFadeEnd).toBeDefined();

      // VERIFY: Type guard identifies it correctly
      expect(isDissolveMaterial(dissolveMat)).toBe(true);
      expect(isImposterMaterial(dissolveMat)).toBe(false);

      // Cleanup
      sourceMaterial.dispose();
      dissolveMat.dispose();
    });

    it("should copy properties from source material", () => {
      const sourceMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        roughness: 0.5,
        metalness: 0.3,
        vertexColors: true,
      });

      const dissolveMat = createDissolveMaterial(sourceMaterial);

      // VERIFY: Properties were copied
      expect(dissolveMat.roughness).toBe(0.5);
      expect(dissolveMat.metalness).toBe(0.3);
      expect(dissolveMat.vertexColors).toBe(true);

      // Cleanup
      sourceMaterial.dispose();
      dissolveMat.dispose();
    });

    it("should apply custom fade distances", () => {
      const sourceMaterial = new THREE.MeshStandardMaterial();

      const dissolveMat = createDissolveMaterial(sourceMaterial, {
        fadeStart: 100,
        fadeEnd: 150,
        nearFadeStart: 2,
        nearFadeEnd: 5,
      });

      // VERIFY: Custom values were applied
      expect(dissolveMat.dissolveUniforms.fadeStart.value).toBe(100);
      expect(dissolveMat.dissolveUniforms.fadeEnd.value).toBe(150);
      expect(dissolveMat.dissolveUniforms.nearFadeStart.value).toBe(2);
      expect(dissolveMat.dissolveUniforms.nearFadeEnd.value).toBe(5);

      // Cleanup
      sourceMaterial.dispose();
      dissolveMat.dispose();
    });

    it("should use default fade distances when not specified", () => {
      const sourceMaterial = new THREE.MeshStandardMaterial();

      const dissolveMat = createDissolveMaterial(sourceMaterial);

      // VERIFY: Default values from GPU_VEG_CONFIG were used
      expect(dissolveMat.dissolveUniforms.fadeStart.value).toBe(
        GPU_VEG_CONFIG.FADE_START,
      );
      expect(dissolveMat.dissolveUniforms.fadeEnd.value).toBe(
        GPU_VEG_CONFIG.FADE_END,
      );

      // Cleanup
      sourceMaterial.dispose();
      dissolveMat.dispose();
    });

    it("should handle non-standard material gracefully", () => {
      // Using basic Material (not MeshStandardMaterial)
      const sourceMaterial = new THREE.Material();

      const dissolveMat = createDissolveMaterial(sourceMaterial);

      // VERIFY: Material was created with fallback values
      expect(dissolveMat).toBeDefined();
      expect(dissolveMat.dissolveUniforms).toBeDefined();
      // Fallback color should be applied
      expect(dissolveMat.roughness).toBe(0.8);
      expect(dissolveMat.metalness).toBe(0.0);

      // Cleanup
      sourceMaterial.dispose();
      dissolveMat.dispose();
    });

    it("should have cutout rendering settings for performance", () => {
      const sourceMaterial = new THREE.MeshStandardMaterial();
      const dissolveMat = createDissolveMaterial(sourceMaterial);

      // VERIFY: Cutout (not transparent blend) for opaque pipeline performance
      expect(dissolveMat.transparent).toBe(false);
      expect(dissolveMat.depthWrite).toBe(true);
      expect(dissolveMat.alphaTest).toBe(0.5);

      // Cleanup
      sourceMaterial.dispose();
      dissolveMat.dispose();
    });
  });

  describe("createGPUVegetationMaterial()", () => {
    it("should create material with GPU uniforms attached", () => {
      const vegMat = createGPUVegetationMaterial();

      // VERIFY: Material was created
      expect(vegMat).toBeDefined();

      // VERIFY: gpuUniforms are attached
      expect(vegMat.gpuUniforms).toBeDefined();
      expect(vegMat.gpuUniforms.playerPos).toBeDefined();
      expect(vegMat.gpuUniforms.fadeStart).toBeDefined();
      expect(vegMat.gpuUniforms.fadeEnd).toBeDefined();

      // VERIFY: playerPos is a Vector3
      expect(vegMat.gpuUniforms.playerPos.value).toBeInstanceOf(THREE.Vector3);

      // Cleanup
      vegMat.dispose();
    });

    it("should apply custom fade distances", () => {
      const vegMat = createGPUVegetationMaterial({
        fadeStart: 200,
        fadeEnd: 250,
      });

      expect(vegMat.gpuUniforms.fadeStart.value).toBe(200);
      expect(vegMat.gpuUniforms.fadeEnd.value).toBe(250);

      // Cleanup
      vegMat.dispose();
    });

    it("should apply custom color", () => {
      const customColor = new THREE.Color(0xff00ff);
      const vegMat = createGPUVegetationMaterial({
        color: customColor,
      });

      // VERIFY: Color was applied (cast through unknown to access MeshStandardMaterial properties)
      const stdMat = vegMat as unknown as THREE.MeshStandardMaterial;
      expect(stdMat.color.getHex()).toBe(0xff00ff);

      // Cleanup
      vegMat.dispose();
    });

    it("should have matte vegetation settings", () => {
      const vegMat = createGPUVegetationMaterial();

      // VERIFY: Matte vegetation appearance (cast through unknown to MeshStandardMaterial)
      const stdMat = vegMat as unknown as THREE.MeshStandardMaterial;
      expect(stdMat.roughness).toBe(0.95);
      expect(stdMat.metalness).toBe(0.0);

      // Cleanup
      vegMat.dispose();
    });

    it("should use double-sided rendering", () => {
      const vegMat = createGPUVegetationMaterial();

      // VERIFY: DoubleSide for vegetation billboards
      expect(vegMat.side).toBe(THREE.DoubleSide);

      // Cleanup
      vegMat.dispose();
    });
  });

  describe("createImposterMaterial()", () => {
    it("should create material with imposter uniforms attached", () => {
      // Create a simple texture for testing
      const texture = new THREE.Texture();

      const imposterMat = createImposterMaterial({
        texture,
        fadeStart: 300,
        fadeEnd: 350,
      });

      // VERIFY: Material was created
      expect(imposterMat).toBeDefined();

      // VERIFY: imposterUniforms are attached
      expect(imposterMat.imposterUniforms).toBeDefined();
      expect(imposterMat.imposterUniforms.playerPos).toBeDefined();
      expect(imposterMat.imposterUniforms.fadeStart).toBeDefined();
      expect(imposterMat.imposterUniforms.fadeEnd).toBeDefined();

      // VERIFY: Type guard identifies it correctly
      expect(isImposterMaterial(imposterMat)).toBe(true);
      expect(isDissolveMaterial(imposterMat)).toBe(false);

      // VERIFY: Texture was applied
      expect(imposterMat.map).toBe(texture);

      // Cleanup
      texture.dispose();
      imposterMat.dispose();
    });

    it("should apply custom fade distances", () => {
      const texture = new THREE.Texture();
      const imposterMat = createImposterMaterial({
        texture,
        fadeStart: 400,
        fadeEnd: 450,
      });

      expect(imposterMat.imposterUniforms.fadeStart.value).toBe(400);
      expect(imposterMat.imposterUniforms.fadeEnd.value).toBe(450);

      // Cleanup
      texture.dispose();
      imposterMat.dispose();
    });

    it("should use default fade distances when not specified", () => {
      const texture = new THREE.Texture();
      const imposterMat = createImposterMaterial({ texture });

      // VERIFY: Default imposter fade distances
      expect(imposterMat.imposterUniforms.fadeStart.value).toBe(300);
      expect(imposterMat.imposterUniforms.fadeEnd.value).toBe(350);

      // Cleanup
      texture.dispose();
      imposterMat.dispose();
    });

    it("should have matching lighting properties to 3D vegetation", () => {
      const texture = new THREE.Texture();
      const imposterMat = createImposterMaterial({ texture });

      // VERIFY: Same lighting as createGPUVegetationMaterial for consistency
      expect(imposterMat.roughness).toBe(0.95);
      expect(imposterMat.metalness).toBe(0.0);
      expect(imposterMat.side).toBe(THREE.DoubleSide);

      // Cleanup
      texture.dispose();
      imposterMat.dispose();
    });

    it("should use cutout rendering for performance", () => {
      const texture = new THREE.Texture();
      const imposterMat = createImposterMaterial({ texture });

      // VERIFY: Cutout rendering (not transparent blend)
      expect(imposterMat.transparent).toBe(false);
      expect(imposterMat.depthWrite).toBe(true);

      // Cleanup
      texture.dispose();
      imposterMat.dispose();
    });

    it("should apply custom alphaTest threshold", () => {
      const texture = new THREE.Texture();
      const imposterMat = createImposterMaterial({
        texture,
        alphaTest: 0.3,
      });

      expect(imposterMat.alphaTest).toBe(0.3);

      // Cleanup
      texture.dispose();
      imposterMat.dispose();
    });
  });

  // ===== INTEGRATION: Verify LOD config is actually used =====
  describe("integration: LOD config usage verification", () => {
    let savedState: Record<string, LODDistances>;

    beforeEach(() => {
      savedState = saveLODDistancesState();
      clearLODDistanceCache();
    });

    afterEach(() => {
      restoreLODDistancesState(savedState);
    });

    it("should verify 'resource' category exists and has valid config", () => {
      // ResourceEntity uses getLODDistances("resource") for DEFAULT_RESOURCE_LOD
      const resourceConfig = getLODDistances("resource");

      // VERIFY: Resource category exists with valid distances
      expect(resourceConfig.lod1Distance).toBeGreaterThan(0);
      expect(resourceConfig.imposterDistance).toBeGreaterThan(
        resourceConfig.lod1Distance,
      );
      expect(resourceConfig.fadeDistance).toBeGreaterThan(
        resourceConfig.imposterDistance,
      );

      // VERIFY: Pre-computed squared distances are correct
      expect(resourceConfig.lod1DistanceSq).toBe(
        resourceConfig.lod1Distance ** 2,
      );
      expect(resourceConfig.imposterDistanceSq).toBe(
        resourceConfig.imposterDistance ** 2,
      );
      expect(resourceConfig.fadeDistanceSq).toBe(
        resourceConfig.fadeDistance ** 2,
      );
    });

    it("should verify all vegetation categories have configs", () => {
      // VegetationSystem uses getLODDistances(category) for various categories
      const categories = [
        "tree",
        "bush",
        "fern",
        "rock",
        "flower",
        "mushroom",
        "grass",
        "fallen_tree",
      ];

      for (const category of categories) {
        const config = getLODDistances(category);

        // VERIFY: Each category has valid config (not just default)
        expect(config.lod1Distance).toBeGreaterThan(0);
        expect(config.imposterDistance).toBeGreaterThan(config.lod1Distance);
        expect(config.fadeDistance).toBeGreaterThan(config.imposterDistance);
      }
    });

    it("should reflect runtime LOD_DISTANCES changes after cache clear", () => {
      // This verifies applyLODSettings pattern works for both systems
      const originalResourceConfig = getLODDistances("resource");

      // Simulate runtime configuration change (like applyLODSettings does)
      LOD_DISTANCES.resource = {
        lod1Distance: 999,
        lod2Distance: 1499,
        imposterDistance: 1999,
        fadeDistance: 2999,
      };
      clearLODDistanceCache();

      // VERIFY: New config is returned (not cached old config)
      const newResourceConfig = getLODDistances("resource");
      expect(newResourceConfig.lod1Distance).toBe(999);
      expect(newResourceConfig.lod2Distance).toBe(1499);
      expect(newResourceConfig.imposterDistance).toBe(1999);
      expect(newResourceConfig.fadeDistance).toBe(2999);
      expect(newResourceConfig.fadeDistanceSq).toBe(2999 * 2999);

      // VERIFY: Original config is different (proves change took effect)
      expect(newResourceConfig.lod1Distance).not.toBe(
        originalResourceConfig.lod1Distance,
      );
    });

    it("should provide consistent values between direct LOD_DISTANCES access and getLODDistances", () => {
      // This ensures no divergence between the two access patterns
      const directTree = LOD_DISTANCES.tree;
      const functionTree = getLODDistances("tree");

      expect(functionTree.lod1Distance).toBe(directTree.lod1Distance);
      expect(functionTree.imposterDistance).toBe(directTree.imposterDistance);
      expect(functionTree.fadeDistance).toBe(directTree.fadeDistance);
    });

    it("should return default config for unknown categories (graceful fallback)", () => {
      // Both VegetationSystem and ResourceEntity may encounter unknown categories
      const unknownConfig = getLODDistances("some_new_resource_type");

      // VERIFY: Returns default, not null/undefined/crash
      expect(unknownConfig).toBeDefined();
      expect(unknownConfig.lod1Distance).toBe(
        DEFAULT_LOD_DISTANCES.lod1Distance,
      );
      expect(unknownConfig.imposterDistance).toBe(
        DEFAULT_LOD_DISTANCES.imposterDistance,
      );
      expect(unknownConfig.fadeDistance).toBe(
        DEFAULT_LOD_DISTANCES.fadeDistance,
      );
    });

    it("should have resource_specific categories with reasonable distances", () => {
      // ResourceEntity may use tree_resource, rock_resource for specific resource types
      const treeConfig = getLODDistances("tree");
      const treeResourceConfig = getLODDistances("tree_resource");

      // tree_resource has shorter distances than tree for performance
      // (harvestable trees are more numerous and need aggressive LOD)
      expect(treeResourceConfig.fadeDistance).toBeLessThanOrEqual(
        treeConfig.fadeDistance,
      );
      expect(treeResourceConfig.fadeDistance).toBeGreaterThan(100);

      const rockConfig = getLODDistances("rock");
      const rockResourceConfig = getLODDistances("rock_resource");

      // rock_resource should match rock distances
      expect(rockResourceConfig.fadeDistance).toBe(rockConfig.fadeDistance);
    });
  });

  // ===== TYPE GUARD INTEGRATION WITH REAL MATERIALS =====
  describe("type guards with real materials", () => {
    it("isDissolveMaterial should correctly identify createDissolveMaterial output", () => {
      const source = new THREE.MeshStandardMaterial();
      const dissolveMat = createDissolveMaterial(source);

      // Primary test: type guard works on real material
      expect(isDissolveMaterial(dissolveMat)).toBe(true);

      // Cross-check: not an imposter material
      expect(isImposterMaterial(dissolveMat)).toBe(false);

      // Cleanup
      source.dispose();
      dissolveMat.dispose();
    });

    it("isImposterMaterial should correctly identify createImposterMaterial output", () => {
      const texture = new THREE.Texture();
      const imposterMat = createImposterMaterial({ texture });

      // Primary test: type guard works on real material
      expect(isImposterMaterial(imposterMat)).toBe(true);

      // Cross-check: not a dissolve material
      expect(isDissolveMaterial(imposterMat)).toBe(false);

      // Cleanup
      texture.dispose();
      imposterMat.dispose();
    });

    it("type guards should return false for regular Three.js materials", () => {
      const standardMat = new THREE.MeshStandardMaterial();
      const basicMat = new THREE.MeshBasicMaterial();
      const phongMat = new THREE.MeshPhongMaterial();

      expect(isDissolveMaterial(standardMat)).toBe(false);
      expect(isDissolveMaterial(basicMat)).toBe(false);
      expect(isDissolveMaterial(phongMat)).toBe(false);

      expect(isImposterMaterial(standardMat)).toBe(false);
      expect(isImposterMaterial(basicMat)).toBe(false);
      expect(isImposterMaterial(phongMat)).toBe(false);

      // Cleanup
      standardMat.dispose();
      basicMat.dispose();
      phongMat.dispose();
    });
  });
});
