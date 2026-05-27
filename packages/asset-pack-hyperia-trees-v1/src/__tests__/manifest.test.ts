/**
 * Manifest parse + identity tests for
 * `@hyperforge/asset-pack-hyperia-trees-v1`.
 *
 * Locks the package's manifest gate: any future change to
 * `pack.json` runs through `ContentPackManifestSchema` at module
 * load and re-passes the assertions below. A regression (e.g.
 * removing a required field, drifting the id away from the
 * canonical npm name) fails CI before the change can land.
 */

import { describe, expect, it } from "vitest";
import { manifest } from "../index.js";

describe("@hyperforge/asset-pack-hyperia-trees-v1", () => {
  it("ships a pack.json that parses through ContentPackManifestSchema", () => {
    expect(manifest.version).toBe(1);
    expect(manifest.id).toBe("@hyperforge/asset-pack-hyperia-trees-v1");
    expect(manifest.name).toBe("Hyperia Trees");
    expect(manifest.author.name).toBe("Hyperforge");
    expect(manifest.license).toBe("GPL-3.0");
  });

  it("declares the asset-pack tag so callers can filter by kind", () => {
    expect(manifest.tags).toContain("asset-pack");
    expect(manifest.tags).toContain("trees");
  });

  it("ships the 13 canonical Hyperia tree species", () => {
    // Phase 3.3 follow-up: vegetationSpecies populated. Every
    // species id matches a Hyperia TreeId enum value and points
    // at a model in the assets repo's models/trees/<species>/
    // directory.
    const ids = manifest.vegetationSpecies.map((s) => s.id);
    expect(ids).toEqual([
      "tree_pine",
      "tree_oak",
      "tree_maple",
      "tree_palm",
      "tree_banana",
      "tree_dead",
      "tree_pineDead",
      "tree_bamboo",
      "tree_eucalyptus",
      "tree_general",
      "tree_magic",
      "tree_mahogany",
      "tree_wood",
    ]);
  });

  it("every species declares category=tree and an asset:// modelRef", () => {
    for (const s of manifest.vegetationSpecies) {
      expect(s.category).toBe("tree");
      expect(s.modelRef.startsWith("asset://models/trees/")).toBe(true);
    }
  });

  it("still-empty sections (density rules + asset entries follow)", () => {
    // The species catalog above is the schema's "what species
    // exist." Density rules ("scatter this species in biome X
    // at rate Y") live in the themed content packs, not in the
    // shared trees asset pack. Asset bake entries are populated
    // by the build pipeline once it lands.
    expect(manifest.assets).toEqual([]);
    expect(manifest.vegetationDensityRules).toEqual([]);
    expect(manifest.biomes).toEqual([]);
    expect(manifest.terrainShaders).toEqual([]);
    expect(manifest.terrainHeightmapPresets).toEqual([]);
    expect(manifest.terrainNoiseFunctions).toEqual([]);
    expect(manifest.waterShaders).toEqual([]);
    expect(manifest.waterAnimations).toEqual([]);
  });
});
