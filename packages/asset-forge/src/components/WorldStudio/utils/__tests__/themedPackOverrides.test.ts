/**
 * themedPackOverrides — manifest field extraction tests.
 *
 * Pins the "first preset wins" rule + the per-field null-safe
 * extraction. Both dialog and companion share this helper to
 * read a themed pack's heightmap preset + vegetation overrides
 * from its manifest.
 */

import { describe, it, expect } from "vitest";

import {
  extractThemedPackOverrides,
  type ThemedPackManifestLike,
} from "../themedPackOverrides";

describe("extractThemedPackOverrides — null/undefined safety", () => {
  it("returns all-null when manifest is null", () => {
    expect(extractThemedPackOverrides(null)).toEqual({
      heightmapPresetParams: null,
      vegetationByBiome: null,
      heightmapPresetId: null,
    });
  });

  it("returns all-null when manifest is undefined", () => {
    expect(extractThemedPackOverrides(undefined)).toEqual({
      heightmapPresetParams: null,
      vegetationByBiome: null,
      heightmapPresetId: null,
    });
  });

  it("returns all-null when manifest has neither field", () => {
    expect(extractThemedPackOverrides({})).toEqual({
      heightmapPresetParams: null,
      vegetationByBiome: null,
      heightmapPresetId: null,
    });
  });
});

describe("extractThemedPackOverrides — heightmap preset", () => {
  it("extracts the FIRST preset's params + id", () => {
    const m: ThemedPackManifestLike = {
      terrainHeightmapPresets: [
        { id: "tropical-atoll", params: { maxHeight: 80 } },
        { id: "tropical-flat", params: { maxHeight: 20 } },
      ],
    };
    const out = extractThemedPackOverrides(m);
    expect(out.heightmapPresetParams).toEqual({ maxHeight: 80 });
    expect(out.heightmapPresetId).toBe("tropical-atoll");
  });

  it("returns null params when first preset has no params field", () => {
    const m: ThemedPackManifestLike = {
      terrainHeightmapPresets: [{ id: "no-params" }],
    };
    expect(extractThemedPackOverrides(m).heightmapPresetParams).toBeNull();
  });

  it("returns null id when first preset has no id field", () => {
    const m: ThemedPackManifestLike = {
      terrainHeightmapPresets: [{ params: { maxHeight: 50 } }],
    };
    expect(extractThemedPackOverrides(m).heightmapPresetId).toBeNull();
    expect(extractThemedPackOverrides(m).heightmapPresetParams).toEqual({
      maxHeight: 50,
    });
  });

  it("returns null when terrainHeightmapPresets is empty array", () => {
    const m: ThemedPackManifestLike = { terrainHeightmapPresets: [] };
    const out = extractThemedPackOverrides(m);
    expect(out.heightmapPresetParams).toBeNull();
    expect(out.heightmapPresetId).toBeNull();
  });
});

describe("extractThemedPackOverrides — vegetationByBiome", () => {
  it("extracts vegetationByBiome verbatim when present", () => {
    const m: ThemedPackManifestLike = {
      vegetationByBiome: {
        forest: { density: 0.5, species: { tree_oak: 1.0 } },
        plains: { density: 0.1, species: {} },
      },
    };
    const out = extractThemedPackOverrides(m);
    expect(out.vegetationByBiome).toEqual({
      forest: { density: 0.5, species: { tree_oak: 1.0 } },
      plains: { density: 0.1, species: {} },
    });
  });

  it("returns null when vegetationByBiome is missing", () => {
    expect(extractThemedPackOverrides({}).vegetationByBiome).toBeNull();
  });

  it("returns the empty object as-is when vegetationByBiome is {}", () => {
    const out = extractThemedPackOverrides({ vegetationByBiome: {} });
    expect(out.vegetationByBiome).toEqual({});
  });
});

describe("extractThemedPackOverrides — both fields together", () => {
  it("returns both heightmap + vegetation when both present", () => {
    const m: ThemedPackManifestLike = {
      terrainHeightmapPresets: [
        { id: "arctic-flat", params: { maxHeight: 30 } },
      ],
      vegetationByBiome: { tundra: { density: 0.05 } },
    };
    const out = extractThemedPackOverrides(m);
    expect(out.heightmapPresetParams).toEqual({ maxHeight: 30 });
    expect(out.heightmapPresetId).toBe("arctic-flat");
    expect(out.vegetationByBiome).toEqual({ tundra: { density: 0.05 } });
  });

  it("returns vegetation but null heightmap when only vegetation present", () => {
    const out = extractThemedPackOverrides({
      vegetationByBiome: { forest: { density: 0.5 } },
    });
    expect(out.heightmapPresetParams).toBeNull();
    expect(out.vegetationByBiome).toEqual({ forest: { density: 0.5 } });
  });
});
