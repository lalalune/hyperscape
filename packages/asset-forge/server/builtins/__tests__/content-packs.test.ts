/**
 * `BUILTIN_CONTENT_PACKS` — catalog contract tests.
 *
 * The auto-bootstrap upserts these packs on every server boot,
 * so any silent regression in the catalog (a removed biome, a
 * swapped manifest id, a dropped vegetation species) ships
 * immediately to every team. These tests lock the contract
 * each themed pack has agreed to expose, including:
 *
 * - The 6 themed packs are all present (hyperia + 5 climate themes)
 * - Manifest ids follow the `@hyperforge/content-pack-X-v1` convention
 * - Each pack ships at least one biome
 * - Each biome has the required shape (id, name, color, terrainMultiplier,
 *   difficultyLevel, heightRange, maxSlope, resourceDensity)
 * - Tropical and arctic ship the Phase C3 prep `vegetationSpecies`
 *   declarations the agent's catalog reads through to
 * - Themed (non-Hyperia) packs all declare `assetPackDeps` so the
 *   strict-catalog gate can install their dependencies
 */

import { describe, expect, it } from "vitest";
import { BUILTIN_CONTENT_PACKS } from "../content-packs.js";

const EXPECTED_MANIFEST_IDS = [
  "@hyperforge/content-pack-hyperia-v1",
  "@hyperforge/content-pack-arctic-v1",
  "@hyperforge/content-pack-tropical-v1",
  "@hyperforge/content-pack-desert-v1",
  "@hyperforge/content-pack-volcanic-v1",
  "@hyperforge/content-pack-wetland-v1",
] as const;

const HYPERIA_ID = "@hyperforge/content-pack-hyperia-v1";

function findPack(manifestId: string) {
  return BUILTIN_CONTENT_PACKS.find((p) => p.manifestId === manifestId);
}

describe("BUILTIN_CONTENT_PACKS — top-level contract", () => {
  it("ships exactly the 6 expected themed packs", () => {
    const ids = BUILTIN_CONTENT_PACKS.map((p) => p.manifestId).sort();
    expect(ids).toEqual([...EXPECTED_MANIFEST_IDS].sort());
  });

  it("the array is frozen — production-safety guarantee", () => {
    expect(Object.isFrozen(BUILTIN_CONTENT_PACKS)).toBe(true);
  });

  it("every pack has id/name/description/packVersion populated", () => {
    for (const pack of BUILTIN_CONTENT_PACKS) {
      expect(pack.manifestId.length).toBeGreaterThan(0);
      expect(pack.name.length).toBeGreaterThan(0);
      expect(pack.description.length).toBeGreaterThan(0);
      expect(pack.packVersion).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it("every pack has at least one tag", () => {
    for (const pack of BUILTIN_CONTENT_PACKS) {
      expect(pack.tags.length).toBeGreaterThan(0);
    }
  });

  it("every pack ships at least one biome", () => {
    for (const pack of BUILTIN_CONTENT_PACKS) {
      expect(pack.biomes.length).toBeGreaterThan(0);
    }
  });

  it("manifest ids follow the `@hyperforge/content-pack-X-v1` convention", () => {
    for (const pack of BUILTIN_CONTENT_PACKS) {
      expect(pack.manifestId).toMatch(
        /^@hyperforge\/content-pack-[a-z]+-v\d+$/,
      );
    }
  });

  it("biome ids are unique within each pack", () => {
    for (const pack of BUILTIN_CONTENT_PACKS) {
      const ids = pack.biomes.map((b) => b.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    }
  });
});

describe("BUILTIN_CONTENT_PACKS — biome shape", () => {
  it("every biome has the required fields with valid types", () => {
    for (const pack of BUILTIN_CONTENT_PACKS) {
      for (const biome of pack.biomes) {
        expect(biome.id).toMatch(/^[a-z_]+$/);
        expect(biome.name.length).toBeGreaterThan(0);
        expect(typeof biome.color).toBe("number");
        expect(Number.isFinite(biome.terrainMultiplier)).toBe(true);
        expect(biome.difficultyLevel).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(biome.heightRange)).toBe(true);
        expect(biome.heightRange.length).toBe(2);
        expect(biome.heightRange[0]).toBeLessThanOrEqual(biome.heightRange[1]);
        expect(biome.maxSlope).toBeGreaterThanOrEqual(0);
        expect(biome.resourceDensity).toBeGreaterThanOrEqual(0);
        // resourceDensity is a multiplier — values > 1 are valid (e.g. dense forest).
      }
    }
  });

  it("biome colors are valid 24-bit RGB hex (0..0xffffff)", () => {
    for (const pack of BUILTIN_CONTENT_PACKS) {
      for (const biome of pack.biomes) {
        expect(biome.color).toBeGreaterThanOrEqual(0);
        expect(biome.color).toBeLessThanOrEqual(0xffffff);
      }
    }
  });
});

describe("BUILTIN_CONTENT_PACKS — Phase C3 vegetationSpecies declarations", () => {
  it("tropical pack ships vegetationSpecies (5 declared)", () => {
    const tropical = findPack("@hyperforge/content-pack-tropical-v1");
    expect(tropical).toBeDefined();
    expect(tropical?.vegetationSpecies?.length).toBeGreaterThanOrEqual(1);
  });

  it("arctic pack ships vegetationSpecies", () => {
    const arctic = findPack("@hyperforge/content-pack-arctic-v1");
    expect(arctic).toBeDefined();
    expect(arctic?.vegetationSpecies?.length).toBeGreaterThanOrEqual(1);
  });

  it("each declared vegetationSpecies entry has id, name, category, modelRef", () => {
    for (const pack of BUILTIN_CONTENT_PACKS) {
      for (const species of pack.vegetationSpecies ?? []) {
        // Fields the manifest-schema requires.
        expect(species.id).toMatch(/^[a-z_]+$/);
        expect(species.name.length).toBeGreaterThan(0);
        expect(species.category.length).toBeGreaterThan(0);
        // modelRef is `<assetPackId>/<entryId>` or asset://, URL.
        expect(typeof species.modelRef).toBe("string");
        expect(species.modelRef.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("BUILTIN_CONTENT_PACKS — strict-catalog assetPackDeps", () => {
  it("themed (non-Hyperia) packs declare assetPackDeps", () => {
    // Hyperia is the canonical pack and may not need to declare deps;
    // the 5 themed packs each declare a deps array (replaces the
    // unconditional Hyperia trees install).
    for (const pack of BUILTIN_CONTENT_PACKS) {
      if (pack.manifestId === HYPERIA_ID) continue;
      expect(pack.assetPackDeps).toBeDefined();
      expect(pack.assetPackDeps?.length).toBeGreaterThan(0);
    }
  });

  it("every assetPackDeps entry is a well-formed manifest id string", () => {
    for (const pack of BUILTIN_CONTENT_PACKS) {
      for (const dep of pack.assetPackDeps ?? []) {
        expect(dep).toMatch(/^@hyperforge\/asset-pack-[a-z0-9-]+$/);
      }
    }
  });
});

describe("BUILTIN_CONTENT_PACKS — per-theme heightmap presets", () => {
  it("themed packs ship a terrainHeightmapPreset", () => {
    // Phase B of PLAN_AAA_CONTENT_SYSTEM — themed packs need to give
    // each project a visibly different island shape.
    for (const pack of BUILTIN_CONTENT_PACKS) {
      if (pack.manifestId === HYPERIA_ID) continue;
      expect(pack.terrainHeightmapPreset).toBeDefined();
      expect(pack.terrainHeightmapPreset?.id.length).toBeGreaterThan(0);
      expect(pack.terrainHeightmapPreset?.name.length).toBeGreaterThan(0);
    }
  });
});
