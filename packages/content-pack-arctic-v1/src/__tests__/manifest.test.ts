/**
 * Manifest parse + identity tests for
 * `@hyperforge/content-pack-arctic-v1`.
 *
 * Locks the package's manifest gate: any future change to
 * `pack.json` runs through `ContentPackManifestSchema` at module
 * load and re-passes the assertions below. A regression
 * (removing a required field, drifting the id away from the
 * canonical npm name) fails CI before the change lands.
 */

import { describe, expect, it } from "vitest";
import { manifest } from "../index.js";

describe("@hyperforge/content-pack-arctic-v1", () => {
  it("ships a pack.json that parses through ContentPackManifestSchema", () => {
    expect(manifest.version).toBe(1);
    expect(manifest.id).toBe("@hyperforge/content-pack-arctic-v1");
    expect(manifest.name).toBe("Arctic");
    expect(manifest.author.name).toBe("Hyperforge");
    expect(manifest.license).toBe("GPL-3.0");
    expect(manifest.packVersion).toBe("1.0.0");
  });

  it("declares the content-pack tag + theme tags for catalog filtering", () => {
    expect(manifest.tags).toContain("content-pack");
    expect(manifest.tags).toContain("arctic");
    expect(manifest.tags).toContain("snow");
  });

  it("declares the 5 arctic biomes migrated from asset-forge inline data", () => {
    // Phase 3.3 follow-up cut migrated the inline ARCTIC_BIOMES
    // array from asset-forge/server/builtins/content-packs.ts into
    // this manifest. The asset-forge catalog still consumes the
    // inline copy for now; once it imports from here, the inline
    // copy becomes a deprecated alias and eventually deletes.
    const ids = manifest.biomes.map((b) => b.id);
    expect(ids).toEqual([
      "frozen_tundra",
      "snow_plain",
      "glacial_peak",
      "frozen_lake",
      "ice_field",
    ]);
  });

  it("biome shapes match the BiomeContributionSchema fully", () => {
    // Pin: every biome has the required fields the schema requires,
    // plus the optional difficulty/maxSlope/resourceDensity tunings
    // the asset-forge inline data sets. A field renaming on either
    // side surfaces here before runtime drift can hide it.
    for (const b of manifest.biomes) {
      expect(typeof b.id).toBe("string");
      expect(typeof b.name).toBe("string");
      expect(typeof b.color).toBe("number");
      expect(b.color).toBeGreaterThan(0);
      expect(b.color).toBeLessThanOrEqual(0xffffff);
      expect(Array.isArray(b.heightRange)).toBe(true);
      expect(b.heightRange.length).toBe(2);
      expect(typeof b.maxSlope).toBe("number");
    }
  });

  it("ships the arctic-mountain-range heightmap preset", () => {
    // Phase 3.3 follow-up: terrainHeightmapPreset migrated from
    // asset-forge inline data. Schema uses an array; asset-forge's
    // existing wrapping path (terrainHeightmapPresets = [preset])
    // is now a passthrough from manifest.terrainHeightmapPresets[0].
    expect(manifest.terrainHeightmapPresets).toHaveLength(1);
    const preset = manifest.terrainHeightmapPresets[0]!;
    expect(preset.id).toBe("arctic-mountain-range");
    expect(preset.params.terrain).toEqual({
      maxHeight: 90,
      waterThreshold: 14,
    });
  });

  it("still-empty sections (vegetation follow-up)", () => {
    // The vegetationByBiome rules use a different shape than the
    // schema's vegetationDensityRules[] array. Mapping is a
    // separate cut; until then this stays empty in the manifest
    // and the asset-forge inline BuiltinPack literal continues to
    // own those concerns.
    expect(manifest.assets).toEqual([]);
    expect(manifest.terrainShaders).toEqual([]);
    expect(manifest.terrainNoiseFunctions).toEqual([]);
    expect(manifest.waterShaders).toEqual([]);
    expect(manifest.waterAnimations).toEqual([]);
    expect(manifest.vegetationSpecies).toEqual([]);
    expect(manifest.vegetationDensityRules).toEqual([]);
  });
});
