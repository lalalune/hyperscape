/**
 * Terrain section schemas — entries that show up in a
 * `ContentPack`'s `terrainShaders[]` /
 * `terrainHeightmapPresets[]` / `terrainNoiseFunctions[]`
 * sections.
 *
 * Originally defined as the standalone `TerrainPack` schema
 * (`PLAN_PACK_TYPES.md` Phase 1). Phase A of
 * `PLAN_AAA_CONTENT_SYSTEM.md` collapsed every pack-type
 * wrapper into one `ContentPackManifestSchema`; this file
 * now hosts only the section-level schemas.
 *
 * Each `recipe` carries a stable `recipeId` that the runtime
 * registry resolves to a concrete renderer factory plus a
 * free-form `params` record. This keeps the schema stable
 * while the renderer iterates on the recipe catalog.
 */

import { z } from "zod";

/**
 * A terrain shader recipe. `recipeId` is the runtime key (e.g.
 * `"tsl-default"`, `"tsl-stylized-cell"`, `"voxel-flat"`). The
 * runtime resolves the id against the terrain shader registry;
 * unknown ids surface a load-time error so authors don't ship
 * dead packs.
 */
export const TerrainShaderRecipeSchema = z.object({
  /** Pack-scoped id (unique within the pack). */
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  /**
   * Renderer-side recipe id. The terrain shader registry maps
   * this to a concrete TSL/material factory. New recipe ids
   * land alongside the renderer that adds them.
   */
  recipeId: z.string().min(1),
  /**
   * Free-form parameter bag forwarded to the recipe factory.
   * Per-recipe documentation pins the expected keys; the
   * schema stays loose here to avoid one-fork-per-recipe.
   */
  params: z.record(z.string(), z.unknown()).default({}),
  /** Optional preview thumbnail (asset:// or absolute URL). */
  thumbnailUrl: z.string().optional(),
});
export type TerrainShaderRecipe = z.infer<typeof TerrainShaderRecipeSchema>;

/**
 * A heightmap preset — the inputs the procgen island/continent
 * generator uses for shape (radius, edge noise, frequency,
 * octaves, …). Today these live as `DEFAULT_ISLAND_CONFIG` /
 * `LARGE_ISLAND_PRESET` constants in `procgen`; Phase 3
 * replaces the constants with a registry walked from active
 * terrain packs.
 */
export const TerrainHeightmapPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  /**
   * Free-form parameter bag — radius, edge noise strength /
   * frequency, octave count, etc. The exact keys consumed are
   * determined by the noise function the preset references.
   */
  params: z.record(z.string(), z.unknown()).default({}),
  /**
   * Optional reference to a noise function variant. When
   * absent, the renderer's default noise is used. Format mirrors
   * `recipeId`: a runtime registry lookup.
   */
  noiseFunctionId: z.string().min(1).optional(),
});
export type TerrainHeightmapPreset = z.infer<
  typeof TerrainHeightmapPresetSchema
>;

/**
 * A noise function variant — declarative wrapper around the
 * (FBM, ridged, simplex, voronoi, …) families a terrain pack
 * wants to expose. Like `recipeId`, the runtime resolves
 * `functionId` against a registry; the params bag is
 * forwarded verbatim.
 */
export const TerrainNoiseFunctionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  functionId: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type TerrainNoiseFunction = z.infer<typeof TerrainNoiseFunctionSchema>;
