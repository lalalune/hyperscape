/**
 * Biome Pack manifest schema.
 *
 * Phase 1 of `PLAN_PACK_TYPES.md`. A biome pack ships a set of
 * `BiomeContribution` entries (id, name, color, height range,
 * difficulty tier, resource density) without requiring a
 * gameplay plugin install. This decouples "the visual + zoning
 * theme of a world" from "the gameplay systems that make use of
 * those biomes".
 *
 * Today the same `BiomeContribution` shape is contributed by
 * gameplay plugins (`@hyperforge/hyperscape-plugin` ships
 * tundra / forest / canyon). Going forward both surfaces feed
 * the same biome registry — plugins still contribute biomes
 * they need for their gameplay rules, and standalone biome
 * packs can be installed independently when a project wants
 * the visual zoning without the plugin.
 *
 * Two layers, mirroring `AssetPack`:
 *
 *   - `BiomePackEntrySchema` — one biome inside the pack (a
 *     thin wrapper around `BiomeContributionSchema` so packs
 *     stay internally consistent even if the contribution
 *     shape evolves).
 *   - `BiomePackManifestSchema` — the full pack (header +
 *     biomes).
 *
 * Phase 1 intentionally adds no runtime consumers; the
 * registry merge in Phase 3 wires both plugins and biome packs
 * into the same lookup.
 */

import { z } from "zod";
import { PackHeaderShape } from "./pack-header.js";
import { BiomeContributionSchema } from "./plugin.js";

/**
 * One biome inside a `BiomePack`. The shape is literally a
 * `BiomeContribution` today; aliasing here gives us room to
 * add pack-only fields (preview thumbnail, sample heightmap)
 * without churning the plugin contribution surface.
 */
export const BiomePackEntrySchema = BiomeContributionSchema;
export type BiomePackEntry = z.infer<typeof BiomePackEntrySchema>;

export const BiomePackManifestSchema = z.object({
  ...PackHeaderShape,
  /** Biome entries this pack contributes. */
  biomes: z.array(BiomePackEntrySchema).min(1),
});
export type BiomePackManifest = z.infer<typeof BiomePackManifestSchema>;

export interface ValidateBiomePackManifestResult {
  ok: boolean;
  manifest?: BiomePackManifest;
  issues?: ReadonlyArray<{
    path: string;
    message: string;
    code: string;
  }>;
}

export function validateBiomePackManifest(
  raw: unknown,
): ValidateBiomePackManifestResult {
  const result = BiomePackManifestSchema.safeParse(raw);
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
