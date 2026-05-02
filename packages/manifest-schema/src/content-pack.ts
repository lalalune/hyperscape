/**
 * Content Pack manifest schema.
 *
 * Phase A of `PLAN_AAA_CONTENT_SYSTEM.md`. Replaces the five
 * separate pack-type wrappers (asset / biome / terrain / water /
 * vegetation pack) with a single delivery unit that can carry
 * any combination of content sections — the UE5 plugin / Unity
 * package shape.
 *
 * A `ContentPack` is the single distribution unit for any
 * authored content that can be installed into a project. The
 * sections are all optional; a "Hyperia trees" pack ships only
 * `assets`, a "Tropical theme" pack ships `biomes` +
 * `vegetationSpecies` + `vegetationDensityRules`, a "Stylized
 * water" pack ships only `waterShaders`. Same schema, same
 * pipeline, different content.
 *
 * The constituent section schemas live next to this file in
 * the kind-specific modules (`asset-pack.ts`,
 * `terrain-pack.ts`, `water-pack.ts`, `vegetation-pack.ts`,
 * `plugin.ts`'s `BiomeContributionSchema`). Phase A retained
 * those modules as the homes for section schemas; only the
 * outer wrappers were dropped.
 *
 * Pack manifests are immutable per `packVersion` — a new cut
 * ships as a new id (`...-v2`) rather than mutating an
 * existing version. Same convention as the prior
 * `AssetPackManifestSchema`.
 */

import { z } from "zod";
import { PackHeaderShape } from "./pack-header.js";
import { AssetPackEntrySchema } from "./asset-pack.js";
import { BiomeContributionSchema } from "./plugin.js";
import {
  TerrainShaderRecipeSchema,
  TerrainHeightmapPresetSchema,
  TerrainNoiseFunctionSchema,
} from "./terrain-pack.js";
import {
  WaterShaderRecipeSchema,
  WaterAnimationProfileSchema,
} from "./water-pack.js";
import {
  VegetationSpeciesSchema,
  VegetationDensityRuleSchema,
} from "./vegetation-pack.js";

export const ContentPackManifestSchema = z.object({
  ...PackHeaderShape,

  // ─── Asset content (3D models, textures, audio) ───
  /**
   * Asset entries this pack contributes — characters, creatures,
   * props, weapons, tools, armor. The studio's Asset Library +
   * agent's `LIST_ASSET_PACKS` action read from the union of
   * installed packs' `assets` arrays.
   */
  assets: z.array(AssetPackEntrySchema).default([]),

  // ─── Biome content (id/name/color/zoning data) ───
  /**
   * Biomes this pack contributes. Composes alongside plugin
   * `contributions.biomes` in the runtime biome registry;
   * plugin contributions win on id collision (gameplay rules).
   */
  biomes: z.array(BiomeContributionSchema).default([]),

  // ─── Terrain content (shader recipes + heightmap presets) ───
  /**
   * Terrain shader recipes — maps to a registry-resolved
   * renderer factory by `recipeId`. The active project's
   * terrain shader is selected from the union of installed
   * packs' shaders.
   */
  terrainShaders: z.array(TerrainShaderRecipeSchema).default([]),
  /** Heightmap presets (radius, edge noise, octaves). */
  terrainHeightmapPresets: z.array(TerrainHeightmapPresetSchema).default([]),
  /** Noise function variants. */
  terrainNoiseFunctions: z.array(TerrainNoiseFunctionSchema).default([]),

  // ─── Water content ───
  /** Water shader recipes — same recipeId+params shape as terrain. */
  waterShaders: z.array(WaterShaderRecipeSchema).default([]),
  /** Animation profiles (calm/stormy/river current). */
  waterAnimations: z.array(WaterAnimationProfileSchema).default([]),

  // ─── Vegetation content ───
  /** Static vegetation species (model ref + scale + slope). */
  vegetationSpecies: z.array(VegetationSpeciesSchema).default([]),
  /** Per-biome density rules driving the procgen scatterer. */
  vegetationDensityRules: z.array(VegetationDensityRuleSchema).default([]),

  // Future sections (not yet defined): materials[],
  // particles[], lightingProfiles[], uiPacks[],
  // dialogueScripts[], procgenTreeRecipes[], …
});
export type ContentPackManifest = z.infer<typeof ContentPackManifestSchema>;

export interface ValidateContentPackManifestResult {
  ok: boolean;
  manifest?: ContentPackManifest;
  issues?: ReadonlyArray<{
    path: string;
    message: string;
    code: string;
  }>;
}

/**
 * Convenience: parse an unknown payload as a content pack
 * manifest. Returns a result discriminated on `ok`. The
 * `issues` array is shaped for direct surfacing back to an
 * LLM (or a human via the studio UI) — same pattern as
 * `validateProject` / `validatePluginManifest`.
 */
export function validateContentPackManifest(
  raw: unknown,
): ValidateContentPackManifestResult {
  const result = ContentPackManifestSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, manifest: result.data };
  }
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({
      path: i.path.join(".") || "(root)",
      message: i.message,
      code: i.code,
    })),
  };
}
