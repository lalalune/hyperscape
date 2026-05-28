/**
 * Acceptance test for content-pack composition.
 *
 * Phase 3.3 of PLAN_AAA_UE5_PARITY extracted six themed content
 * packs (Hyperia, Arctic, Tropical, Desert, Volcanic, Wetland)
 * plus the Hyperia trees asset pack into separate workspace
 * packages. This test pins the cross-pack composition invariants
 * the asset-forge catalog + the game runtime registry both
 * depend on:
 *
 *   - Every pack id is unique across the installed set.
 *   - Every biome id is globally unique. The runtime aggregates
 *     all installed packs' biomes into one registry; collisions
 *     are silent overwrites if not caught here.
 *   - Every terrainHeightmapPreset id is unique — they live in
 *     the same flat preset registry.
 *   - Every species id in the trees asset pack stays unique.
 *
 * If a future themed pack ships with a biome id that overlaps an
 * existing pack (e.g. two `forest` biomes), this test fails
 * before the conflict can ship.
 */

import { describe, expect, it } from "vitest";

import { manifest as arctic } from "@hyperforge/content-pack-arctic-v1";
import { manifest as hyperia } from "@hyperforge/content-pack-hyperia-v1";
import { manifest as tropical } from "@hyperforge/content-pack-tropical-v1";
import { manifest as desert } from "@hyperforge/content-pack-desert-v1";
import { manifest as volcanic } from "@hyperforge/content-pack-volcanic-v1";
import { manifest as wetland } from "@hyperforge/content-pack-wetland-v1";
import { manifest as trees } from "@hyperforge/asset-pack-hyperia-trees-v1";

const ALL_CONTENT_PACKS = [
  arctic,
  hyperia,
  tropical,
  desert,
  volcanic,
  wetland,
] as const;

const ALL_PACKS = [...ALL_CONTENT_PACKS, trees] as const;

describe("content-pack composition — Phase 3.3 acceptance", () => {
  it("every pack id is unique across the installed set", () => {
    const ids = ALL_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every biome id is globally unique across themed content packs", () => {
    // The runtime aggregates `biomes` arrays from all installed
    // packs into one GAME_BIOME_DEFINITIONS registry. A duplicate
    // id silently overwrites — which would render the loser's
    // biome unreachable + the editor's biome browser shows
    // confusing duplicates.
    const allBiomeIds: string[] = [];
    for (const pack of ALL_CONTENT_PACKS) {
      for (const biome of pack.biomes) {
        allBiomeIds.push(biome.id);
      }
    }
    expect(new Set(allBiomeIds).size).toBe(allBiomeIds.length);
  });

  it("every terrainHeightmapPreset id is globally unique", () => {
    const allPresetIds: string[] = [];
    for (const pack of ALL_CONTENT_PACKS) {
      for (const preset of pack.terrainHeightmapPresets) {
        allPresetIds.push(preset.id);
      }
    }
    expect(new Set(allPresetIds).size).toBe(allPresetIds.length);
  });

  it("trees asset pack species ids are unique among themselves", () => {
    const ids = trees.vegetationSpecies.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every themed pack declares at least one biome (not a skeleton)", () => {
    // Catches a regression where one of the content-pack
    // extractions accidentally ships an empty biomes array.
    // Every themed pack should carry real content after the
    // Phase 3.3 biome migration landed.
    for (const pack of ALL_CONTENT_PACKS) {
      expect(pack.biomes.length).toBeGreaterThan(0);
    }
  });

  it("every themed pack declares exactly one terrainHeightmapPreset", () => {
    // asset-forge's BUILTIN_CONTENT_PACKS literal uses the
    // singular `terrainHeightmapPreset` field (picks
    // `terrainHeightmapPresets[0]`). If a pack ever ships zero
    // or multiple presets the consumer breaks; catch it here.
    for (const pack of ALL_CONTENT_PACKS) {
      expect(pack.terrainHeightmapPresets.length).toBe(1);
    }
  });

  it("every themed pack tags contains 'content-pack' (catalog filter contract)", () => {
    // The DesignWithAIDialog catalog filters by the
    // `content-pack` tag to distinguish themed packs from asset
    // packs. Missing tag means a pack vanishes from the picker.
    for (const pack of ALL_CONTENT_PACKS) {
      expect(pack.tags).toContain("content-pack");
    }
  });

  it("the trees asset pack tags contains 'asset-pack' (not 'content-pack')", () => {
    expect(trees.tags).toContain("asset-pack");
    expect(trees.tags).not.toContain("content-pack");
  });
});
