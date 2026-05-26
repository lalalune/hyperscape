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

  it("starts with empty content sections (Phase 3.3 skeleton)", () => {
    // Phase 3.3 of PLAN_AAA_UE5_PARITY established the package
    // structure first. A follow-up cut migrates the inline
    // BuiltinPack data from asset-forge/server/builtins/
    // content-packs.ts into this manifest's biomes /
    // terrainHeightmapPresets / vegetationDensityRules. Until
    // then every section is an empty array.
    expect(manifest.assets).toEqual([]);
    expect(manifest.biomes).toEqual([]);
    expect(manifest.terrainShaders).toEqual([]);
    expect(manifest.terrainHeightmapPresets).toEqual([]);
    expect(manifest.terrainNoiseFunctions).toEqual([]);
    expect(manifest.waterShaders).toEqual([]);
    expect(manifest.waterAnimations).toEqual([]);
    expect(manifest.vegetationSpecies).toEqual([]);
    expect(manifest.vegetationDensityRules).toEqual([]);
  });
});
