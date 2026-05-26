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

  it("starts with empty content sections (Phase 3.3 skeleton)", () => {
    // Phase 3.3 of PLAN_AAA_UE5_PARITY established the package
    // structure first; content entries land in a follow-up cut
    // once the model bake pipeline is wired. Until then every
    // section is an empty array.
    expect(manifest.assets).toEqual([]);
    expect(manifest.vegetationSpecies).toEqual([]);
    expect(manifest.vegetationDensityRules).toEqual([]);
    expect(manifest.biomes).toEqual([]);
    expect(manifest.terrainShaders).toEqual([]);
    expect(manifest.terrainHeightmapPresets).toEqual([]);
    expect(manifest.terrainNoiseFunctions).toEqual([]);
    expect(manifest.waterShaders).toEqual([]);
    expect(manifest.waterAnimations).toEqual([]);
  });
});
