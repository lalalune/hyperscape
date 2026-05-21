/**
 * Merge multiple installed content-pack manifests into the
 * single `ContentPackContentInput` shape `setContentPackContent`
 * consumes.
 *
 * Phase 5.4 of `PLAN_AAA_MASTER_AUDIT.md` — the helper that
 * composes contributions from a project's installed packs into
 * one unified registry input. Pulled out of the inline loop in
 * `useProjectLoader.fetchContentPacksAndRegister` so the
 * composition rule has a single, testable home.
 *
 * The composition rule (mirrored at the registry layer by
 * `setContentPackContent`'s `Map.set(id, …)` semantics):
 *
 *   - Each section is concatenated across packs in input order.
 *   - When two packs contribute the same id within one section,
 *     the LATER pack wins (Map.set overwrites). Callers control
 *     pack iteration order to pin "which pack wins" semantics —
 *     project install order today, future priority hints later.
 *   - Sections a pack doesn't ship (or ships as `undefined`)
 *     contribute nothing — they don't blank out other packs'
 *     entries.
 *
 * Pure — no fetch, no React, no DOM. Easy to test in isolation.
 */

import type {
  BiomeContribution,
  TerrainShaderRecipe,
  TerrainHeightmapPreset,
  TerrainNoiseFunction,
  WaterShaderRecipe,
  WaterAnimationProfile,
  VegetationSpecies,
  VegetationDensityRule,
} from "@hyperforge/manifest-schema";

import type { ContentPackContentInput } from "./contentRegistry";

/**
 * Structural subset of a content-pack manifest that the merger
 * reads. Mirrors `ContentPackContentInput` 1:1 — kept as its
 * own type so callers passing partial manifests (the
 * installed-packs HTTP endpoint emits exactly this shape)
 * don't need to cast.
 */
export interface ContentPackManifestSlice {
  readonly biomes?: ReadonlyArray<BiomeContribution>;
  readonly terrainShaders?: ReadonlyArray<TerrainShaderRecipe>;
  readonly terrainHeightmapPresets?: ReadonlyArray<TerrainHeightmapPreset>;
  readonly terrainNoiseFunctions?: ReadonlyArray<TerrainNoiseFunction>;
  readonly waterShaders?: ReadonlyArray<WaterShaderRecipe>;
  readonly waterAnimations?: ReadonlyArray<WaterAnimationProfile>;
  readonly vegetationSpecies?: ReadonlyArray<VegetationSpecies>;
  readonly vegetationDensityRules?: ReadonlyArray<VegetationDensityRule>;
}

/**
 * Merge `n` content-pack manifests into one
 * `ContentPackContentInput`. Each section is the concatenation
 * across packs in input order; later packs win on id conflicts
 * at the registry layer.
 *
 * Empty input → all-empty-array output (not `undefined`), so
 * callers can blast the result straight into
 * `setContentPackContent` to clear prior state.
 */
export function mergeContentPackManifests(
  manifests: ReadonlyArray<ContentPackManifestSlice>,
): ContentPackContentInput {
  const merged: ContentPackContentInput = {
    biomes: [],
    terrainShaders: [],
    terrainHeightmapPresets: [],
    terrainNoiseFunctions: [],
    waterShaders: [],
    waterAnimations: [],
    vegetationSpecies: [],
    vegetationDensityRules: [],
  };
  for (const m of manifests) {
    if (m.biomes) (merged.biomes as unknown[])!.push(...m.biomes);
    if (m.terrainShaders)
      (merged.terrainShaders as unknown[])!.push(...m.terrainShaders);
    if (m.terrainHeightmapPresets)
      (merged.terrainHeightmapPresets as unknown[])!.push(
        ...m.terrainHeightmapPresets,
      );
    if (m.terrainNoiseFunctions)
      (merged.terrainNoiseFunctions as unknown[])!.push(
        ...m.terrainNoiseFunctions,
      );
    if (m.waterShaders)
      (merged.waterShaders as unknown[])!.push(...m.waterShaders);
    if (m.waterAnimations)
      (merged.waterAnimations as unknown[])!.push(...m.waterAnimations);
    if (m.vegetationSpecies)
      (merged.vegetationSpecies as unknown[])!.push(...m.vegetationSpecies);
    if (m.vegetationDensityRules)
      (merged.vegetationDensityRules as unknown[])!.push(
        ...m.vegetationDensityRules,
      );
  }
  return merged;
}
