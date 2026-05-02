/**
 * Water section schemas — entries that show up in a
 * `ContentPack`'s `waterShaders[]` / `waterAnimations[]`
 * sections.
 *
 * Originally defined as the standalone `WaterPack` schema
 * (`PLAN_PACK_TYPES.md` Phase 1). Phase A of
 * `PLAN_AAA_CONTENT_SYSTEM.md` collapsed every pack-type
 * wrapper into one `ContentPackManifestSchema`; this file
 * now hosts only the section-level schemas. Same
 * `recipeId` + `params` shape as terrain.
 */

import { z } from "zod";

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
