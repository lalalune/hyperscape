/**
 * Vegetation Pack manifest schema.
 *
 * Phase 1 of `PLAN_PACK_TYPES.md`. A vegetation pack ships
 * tree/plant species definitions plus density rules — the
 * data the procgen vegetation scatterer reads to decide
 * "where do trees go and what do they look like". Today the
 * 18 hardcoded species in `procgen/src/params/presets.ts` are
 * the only inventory available; Phase 3 walks installed
 * vegetation packs instead.
 *
 * Note: the existing `vegetation.ts` schema in this package
 * covers the *runtime asset catalog* the scatterer reads —
 * the GLB models, scale variation, slope tolerance, etc.
 * `VegetationPack` is the *author-facing bundle* that ships
 * those assets together with species data. Both surfaces will
 * coexist: a `VegetationPack` produces `VegetationManifest`
 * entries when it's resolved at runtime.
 */

import { z } from "zod";
import { PackHeaderShape } from "./pack-header.js";

/**
 * One plant/tree species. Combines visual data (model URL,
 * scale variation), placement rules (density, slope, height
 * range), and per-species procgen knobs (clustering,
 * noise-driven distribution).
 *
 * Loosely mirrors the legacy `VegetationAsset` from
 * `vegetation.ts` so the same renderer code can consume both,
 * but with the extra fields a procgen scatterer needs for
 * density-driven authoring.
 */
export const VegetationSpeciesSchema = z.object({
  /** Pack-scoped id (unique within the pack). */
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  /**
   * High-level grouping ("tree", "bush", "grass", "flower"...).
   * Procgen biome rules reference categories, not concrete
   * species — keeping this field stable means the same biome
   * pack works with multiple vegetation packs.
   */
  category: z.string().min(1),
  /**
   * Asset reference — `<assetPackId>/<entryId>` or a direct
   * `asset://` / URL. When the format is `<id>/<id>` the
   * runtime resolves through the installed asset packs first.
   */
  modelRef: z.string().min(1),
  /** Optional preview thumbnail. */
  thumbnailUrl: z.string().optional(),
  /** Base uniform scale at placement time. */
  baseScale: z.number().positive().default(1),
  /** [min, max] uniform scale multiplier sampled per instance. */
  scaleVariation: z
    .tuple([z.number().positive(), z.number().positive()])
    .default([1, 1]),
  /** True = random Y rotation per instance. */
  randomRotation: z.boolean().default(true),
  /** Whether the species aligns to terrain normals (vs. up vector). */
  alignToNormal: z.boolean().default(false),
  /** Vertical offset applied to placement (sinks roots / lifts off ground). */
  yOffset: z.number().default(0),
  /** Maximum slope (0–1, where 1 = vertical) the species tolerates. */
  maxSlope: z.number().min(0).max(1).default(0.5),
  /**
   * Optional minimum and maximum elevation (meters) the species
   * appears at. Absent = unrestricted.
   */
  minHeight: z.number().optional(),
  maxHeight: z.number().optional(),
  /** Free-form tags for filtering / search. */
  tags: z.array(z.string()).default([]),
});
export type VegetationSpecies = z.infer<typeof VegetationSpeciesSchema>;

/**
 * A density rule — "in biome X, place species in category Y at
 * density Z, respecting these clustering / spacing constraints".
 * Plays the same role as `BiomeVegetationLayer` in `biomes.ts`,
 * authored at the pack level so it can be paired with whichever
 * biome pack the project ends up using.
 */
export const VegetationDensityRuleSchema = z.object({
  id: z.string().min(1),
  /** Biome id this rule targets (matches `BiomeContribution.id`). */
  biomeId: z.string().min(1),
  /** Category of species to scatter (matches `VegetationSpecies.category`). */
  category: z.string().min(1),
  /** Density (instances per square unit, scatterer-defined). */
  density: z.number().nonnegative(),
  /** Minimum distance between instances. */
  minSpacing: z.number().nonnegative().default(0),
  /** Whether to cluster instances rather than scatter uniformly. */
  clustering: z.boolean().default(false),
  /** Cluster size (instances per cluster) when `clustering` is true. */
  clusterSize: z.number().int().positive().optional(),
  /** Noise frequency that gates placement (higher = finer detail). */
  noiseScale: z.number().positive().default(1),
  /** Noise threshold (0–1) — lower = more coverage. */
  noiseThreshold: z.number().min(0).max(1).default(0.5),
  /** Skip placement on water tiles. */
  avoidWater: z.boolean().default(true),
  /** Skip placement on slopes above the species' `maxSlope`. */
  avoidSteepSlopes: z.boolean().default(true),
});
export type VegetationDensityRule = z.infer<typeof VegetationDensityRuleSchema>;

export const VegetationPackManifestSchema = z.object({
  ...PackHeaderShape,
  /** Species this pack contributes. */
  species: z.array(VegetationSpeciesSchema).min(1),
  /** Density rules this pack contributes. */
  densityRules: z.array(VegetationDensityRuleSchema).default([]),
});
export type VegetationPackManifest = z.infer<
  typeof VegetationPackManifestSchema
>;

export interface ValidateVegetationPackManifestResult {
  ok: boolean;
  manifest?: VegetationPackManifest;
  issues?: ReadonlyArray<{
    path: string;
    message: string;
    code: string;
  }>;
}

export function validateVegetationPackManifest(
  raw: unknown,
): ValidateVegetationPackManifestResult {
  const result = VegetationPackManifestSchema.safeParse(raw);
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
