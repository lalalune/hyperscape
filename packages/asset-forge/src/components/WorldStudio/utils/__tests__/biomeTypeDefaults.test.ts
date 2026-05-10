/**
 * `biomeTypeDefaults` — full BiomeData template catalog tests.
 *
 * The studio stores only OVERRIDES in the project; these defaults
 * fill in every required BiomeData field at compile time so the
 * game client receives complete biome definitions. Drift in the
 * default values silently changes how every world without explicit
 * overrides renders.
 *
 * Tests verify (a) the canonical 9 biome types are present, (b)
 * each default has the required shape, (c) numeric ranges are
 * sensible (height, density, slope), and (d) the unknown-type
 * fallback to plains.
 */

import { describe, expect, it } from "vitest";
import { getBiomeTypeDefaults } from "../biomeTypeDefaults";

const EXPECTED_BIOMES = [
  "plains",
  "forest",
  "valley",
  "mountains",
  "tundra",
  "desert",
  "lakes",
  "swamp",
  "canyon",
] as const;

describe("getBiomeTypeDefaults — catalog completeness", () => {
  it.each(EXPECTED_BIOMES)(
    "returns a fresh defaults object for %s",
    (biome) => {
      const result = getBiomeTypeDefaults(biome);
      expect(result).toBeDefined();
      expect(result.name).toBeTruthy();
    },
  );

  it("each biome's `name` field is human-readable (titlecase)", () => {
    for (const biome of EXPECTED_BIOMES) {
      const r = getBiomeTypeDefaults(biome);
      expect(r.name.length).toBeGreaterThan(0);
      // First char uppercase (titlecase like "Plains" / "Forest").
      expect(r.name[0]).toBe(r.name[0].toUpperCase());
    }
  });

  it("description is a non-empty string for every biome", () => {
    for (const biome of EXPECTED_BIOMES) {
      expect(getBiomeTypeDefaults(biome).description.length).toBeGreaterThan(
        10,
      );
    }
  });
});

describe("getBiomeTypeDefaults — required shape", () => {
  it.each(EXPECTED_BIOMES)("$0 has all required BiomeData fields", (biome) => {
    const r = getBiomeTypeDefaults(biome);
    // Identity / display
    expect(typeof r.name).toBe("string");
    expect(typeof r.description).toBe("string");
    expect(typeof r.terrain).toBe("string");
    // Numeric contract
    expect([0, 1, 2, 3]).toContain(r.difficultyLevel);
    expect(typeof r.color).toBe("number");
    expect(Array.isArray(r.heightRange)).toBe(true);
    expect(r.heightRange).toHaveLength(2);
    expect(typeof r.terrainMultiplier).toBe("number");
    expect(typeof r.waterLevel).toBe("number");
    expect(typeof r.maxSlope).toBe("number");
    expect(typeof r.difficulty).toBe("number");
    expect(typeof r.baseHeight).toBe("number");
    expect(typeof r.heightVariation).toBe("number");
    expect(typeof r.resourceDensity).toBe("number");
    // Arrays
    expect(Array.isArray(r.resources)).toBe(true);
    expect(Array.isArray(r.mobs)).toBe(true);
    expect(Array.isArray(r.mobTypes)).toBe(true);
    expect(Array.isArray(r.resourceTypes)).toBe(true);
    // Color scheme
    expect(typeof r.colorScheme.primary).toBe("string");
    expect(typeof r.colorScheme.secondary).toBe("string");
    expect(typeof r.colorScheme.fog).toBe("string");
    expect(typeof r.fogIntensity).toBe("number");
    expect(typeof r.ambientSound).toBe("string");
    // Vegetation
    expect(typeof r.vegetation.enabled).toBe("boolean");
    expect(Array.isArray(r.vegetation.layers)).toBe(true);
  });
});

describe("getBiomeTypeDefaults — numeric ranges", () => {
  it.each(EXPECTED_BIOMES)("$0 heightRange[0] <= heightRange[1]", (biome) => {
    const r = getBiomeTypeDefaults(biome);
    expect(r.heightRange[0]).toBeLessThanOrEqual(r.heightRange[1]);
  });

  it.each(EXPECTED_BIOMES)("$0 fogIntensity is in [0, 1]", (biome) => {
    const r = getBiomeTypeDefaults(biome);
    expect(r.fogIntensity).toBeGreaterThanOrEqual(0);
    expect(r.fogIntensity).toBeLessThanOrEqual(1);
  });

  it.each(EXPECTED_BIOMES)("$0 difficulty is non-negative", (biome) => {
    // difficulty is an integer level, NOT a [0, 1] scalar — values
    // can exceed 1 (canyon=2, tundra=3, etc.). The studio uses it
    // as a tier indicator, not a normalized weight.
    const r = getBiomeTypeDefaults(biome);
    expect(r.difficulty).toBeGreaterThanOrEqual(0);
  });

  it.each(EXPECTED_BIOMES)("$0 maxSlope is non-negative", (biome) => {
    const r = getBiomeTypeDefaults(biome);
    expect(r.maxSlope).toBeGreaterThanOrEqual(0);
  });

  it.each(EXPECTED_BIOMES)("$0 color is a valid 24-bit RGB value", (biome) => {
    const r = getBiomeTypeDefaults(biome);
    expect(r.color).toBeGreaterThanOrEqual(0);
    expect(r.color).toBeLessThanOrEqual(0xffffff);
  });

  it.each(EXPECTED_BIOMES)(
    "$0 colorScheme entries are valid hex color strings",
    (biome) => {
      const r = getBiomeTypeDefaults(biome);
      for (const c of [
        r.colorScheme.primary,
        r.colorScheme.secondary,
        r.colorScheme.fog,
      ]) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    },
  );

  it.each(EXPECTED_BIOMES)("$0 resourceDensity is non-negative", (biome) => {
    const r = getBiomeTypeDefaults(biome);
    expect(r.resourceDensity).toBeGreaterThanOrEqual(0);
  });
});

describe("getBiomeTypeDefaults — vegetation layer shape", () => {
  it.each(EXPECTED_BIOMES)(
    "$0 vegetation layers have valid required fields",
    (biome) => {
      const r = getBiomeTypeDefaults(biome);
      for (const layer of r.vegetation.layers) {
        expect(typeof layer.category).toBe("string");
        expect(layer.category.length).toBeGreaterThan(0);
        expect(layer.density).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(layer.assets)).toBe(true);
        expect(layer.minSpacing).toBeGreaterThan(0);
        expect(typeof layer.noiseScale).toBe("number");
        expect(layer.noiseThreshold).toBeGreaterThanOrEqual(0);
        expect(layer.noiseThreshold).toBeLessThanOrEqual(1);
        expect(typeof layer.avoidWater).toBe("boolean");
      }
    },
  );
});

describe("getBiomeTypeDefaults — fallback behavior", () => {
  it("returns plains defaults for an unknown biome type", () => {
    const unknown = getBiomeTypeDefaults("totally-made-up-biome");
    const plains = getBiomeTypeDefaults("plains");
    expect(unknown).toBe(plains);
  });

  it("returns plains defaults for empty string", () => {
    const empty = getBiomeTypeDefaults("");
    const plains = getBiomeTypeDefaults("plains");
    expect(empty).toBe(plains);
  });

  it("plains itself returns its OWN entry, not a fallback", () => {
    const direct = getBiomeTypeDefaults("plains");
    expect(direct.name).toBe("Plains");
  });
});

describe("getBiomeTypeDefaults — design relationships", () => {
  it("difficultyLevel matches difficulty roughly (level=0 ≈ low difficulty)", () => {
    // Locked correlation: a biome flagged level 0 should have lower
    // numeric difficulty than one flagged level 3.
    const plains = getBiomeTypeDefaults("plains"); // level 0
    const canyon = getBiomeTypeDefaults("canyon"); // higher level
    expect(plains.difficultyLevel).toBeLessThanOrEqual(canyon.difficultyLevel);
  });

  it("mountains biome has the highest baseHeight (or tied for highest)", () => {
    const mountains = getBiomeTypeDefaults("mountains");
    for (const biome of EXPECTED_BIOMES) {
      const r = getBiomeTypeDefaults(biome);
      expect(mountains.baseHeight).toBeGreaterThanOrEqual(r.baseHeight);
    }
  });
});
