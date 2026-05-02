/**
 * Terrain Pack manifest schema.
 *
 * Phase 1 of `PLAN_PACK_TYPES.md`. A terrain pack ships a
 * shader recipe + heightmap presets + noise function variants
 * — everything that decides "what does the ground look like
 * and how is it shaped". Two projects with different
 * `TerrainPack`s installed look visibly different even when
 * they share the same biomes.
 *
 * Today the engine ships a single hardcoded TSL shader
 * (`packages/procgen/src/terrain/TerrainShaderTSL.ts`) plus a
 * single `IslandMask` preset. Phase 3 of `PLAN_PACK_TYPES.md`
 * replaces both with registry lookups keyed by the active
 * project's installed `TerrainPack`s.
 *
 * Phase 1 intentionally avoids defining a full shader DSL.
 * Each `recipe` carries a stable `recipeId` (the registry
 * resolves it at runtime) plus a free-form `params` record;
 * the catalog of valid recipe ids is contributed by whichever
 * package owns the renderer. This keeps the schema stable
 * while the renderer side iterates.
 */

import { z } from "zod";
import { PackHeaderShape } from "./pack-header.js";

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

export const TerrainPackManifestSchema = z.object({
  ...PackHeaderShape,
  /** Shader recipes this pack contributes. */
  shaders: z.array(TerrainShaderRecipeSchema).default([]),
  /** Heightmap presets this pack contributes. */
  heightmapPresets: z.array(TerrainHeightmapPresetSchema).default([]),
  /** Noise function variants this pack contributes. */
  noiseFunctions: z.array(TerrainNoiseFunctionSchema).default([]),
});
export type TerrainPackManifest = z.infer<typeof TerrainPackManifestSchema>;

export interface ValidateTerrainPackManifestResult {
  ok: boolean;
  manifest?: TerrainPackManifest;
  issues?: ReadonlyArray<{
    path: string;
    message: string;
    code: string;
  }>;
}

export function validateTerrainPackManifest(
  raw: unknown,
): ValidateTerrainPackManifestResult {
  const result = TerrainPackManifestSchema.safeParse(raw);
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
