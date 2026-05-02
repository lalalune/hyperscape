/**
 * Water Pack manifest schema.
 *
 * Phase 1 of `PLAN_PACK_TYPES.md`. A water pack ships a water
 * shader recipe plus animation behavior — wave amplitude,
 * surface tint, foam settings, scroll speed. Lets a project
 * swap "deep blue realistic ocean" for "stylized turquoise
 * cartoon water" without touching the engine.
 *
 * Today the engine has a single hardcoded TSL water shader.
 * Phase 3 replaces it with a registry indexed by the active
 * project's installed `WaterPack`s.
 *
 * Same `recipeId` + `params` pattern as `TerrainPack`: the
 * schema stays loose, the runtime registry pins the concrete
 * shader factory.
 */

import { z } from "zod";
import { PackHeaderShape } from "./pack-header.js";

export const WaterShaderRecipeSchema = z.object({
  /** Pack-scoped id (unique within the pack). */
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  /**
   * Renderer-side recipe id. The water shader registry maps
   * this to a concrete TSL/material factory.
   */
  recipeId: z.string().min(1),
  /**
   * Free-form parameter bag forwarded to the recipe factory
   * (color tint, fresnel power, foam threshold, etc.).
   */
  params: z.record(z.string(), z.unknown()).default({}),
  /** Optional preview thumbnail. */
  thumbnailUrl: z.string().optional(),
});
export type WaterShaderRecipe = z.infer<typeof WaterShaderRecipeSchema>;

/**
 * Animation behavior for water surfaces — wave shapes, scroll
 * speed, normal-map cycling. Authored separately from the
 * shader recipe so a single shader can be reused with multiple
 * animation profiles ("calm", "stormy", "river current").
 */
export const WaterAnimationProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  /**
   * Free-form parameter bag — wave amplitude, frequency, scroll
   * vector, normal-map URL, etc. Keys are determined by the
   * matching shader recipe(s) that consume the profile.
   */
  params: z.record(z.string(), z.unknown()).default({}),
});
export type WaterAnimationProfile = z.infer<typeof WaterAnimationProfileSchema>;

export const WaterPackManifestSchema = z.object({
  ...PackHeaderShape,
  /** Shader recipes this pack contributes. */
  shaders: z.array(WaterShaderRecipeSchema).default([]),
  /** Animation profiles this pack contributes. */
  animations: z.array(WaterAnimationProfileSchema).default([]),
});
export type WaterPackManifest = z.infer<typeof WaterPackManifestSchema>;

export interface ValidateWaterPackManifestResult {
  ok: boolean;
  manifest?: WaterPackManifest;
  issues?: ReadonlyArray<{
    path: string;
    message: string;
    code: string;
  }>;
}

export function validateWaterPackManifest(
  raw: unknown,
): ValidateWaterPackManifestResult {
  const result = WaterPackManifestSchema.safeParse(raw);
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
