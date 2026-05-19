/**
 * Gathering resource manifest schemas.
 *
 * Covers the three rich resource catalogs under
 * `packages/server/world/assets/manifests/gathering/`:
 *   - `woodcutting.json` — trees
 *   - `mining.json` — rocks
 *   - `fishing.json` — fishing spots
 *
 * These are distinct from the sparse `trees.json` record consumed by
 * `TreeManifestSchema` — these carry full harvest mechanics per resource
 * (tool required, yield tables, respawn timing, visual model paths).
 *
 * Design notes
 * ------------
 * - `modelPath` and `depletedModelPath` are `string | null` — some resources
 *   use `modelVariants` instead (trees pick a random variant) or have no
 *   visible model (fishing spots are transparent click targets).
 * - `harvestYield` base entry applies to all three skills. Fishing extends it
 *   with `levelRequired`, `catchLow`, `catchHigh` for tile-based-MMORPG-accurate per-fish
 *   catch-rate curves.
 * - JSON `$schema` values are file paths (`../schemas/gathering-xxx.schema.json`)
 *   rather than version literals — we accept any string here.
 */

import { z } from "zod";

/** Common base fields for a single harvest yield row. */
const HarvestYieldBaseSchema = z.object({
  itemId: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  chance: z.number().min(0).max(1),
  xpAmount: z.number().nonnegative(),
  stackable: z.boolean(),
});

/** Woodcutting / mining yield — base only. */
export const GatheringYieldSchema = HarvestYieldBaseSchema;
export type GatheringYield = z.infer<typeof GatheringYieldSchema>;

/**
 * Fishing yield — base + tile-based-MMORPG-style per-fish rates.
 * `catchLow` / `catchHigh` are the x/256 rate endpoints used by the
 * fishing-spot LERP.
 */
export const FishingYieldSchema = HarvestYieldBaseSchema.extend({
  levelRequired: z.number().int().positive(),
  catchLow: z.number().int().nonnegative().max(256),
  catchHigh: z.number().int().nonnegative().max(256),
});
export type FishingYield = z.infer<typeof FishingYieldSchema>;

/**
 * Common shape for a gathering resource (tree / rock / fishing spot).
 * `yieldSchema` is injected by callers so trees and rocks get base yields
 * while fishing spots get the extended fishing yield.
 */
function gatheringResource<TYield extends z.ZodTypeAny>(yieldSchema: TYield) {
  return z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z
      .string()
      .min(1)
      .describe("Entity discriminator, e.g., 'tree', 'ore', 'fishing_spot'"),
    examine: z.string().default(""),
    modelPath: z.string().nullable(),
    /** Optional LOD1 model path for medium distance rendering. */
    lod1ModelPath: z.string().nullable().optional(),
    /** Optional LOD2 model path for far distance rendering. */
    lod2ModelPath: z.string().nullable().optional(),
    /**
     * Optional procgen preset name. When set, the runtime generates
     * the mesh via `@hyperforge/procgen` instead of loading `modelPath`.
     */
    procgenPreset: z.string().min(1).optional(),
    modelVariants: z.array(z.string().min(1)).optional(),
    depletedModelPath: z.string().nullable(),
    scale: z.number().positive(),
    depletedScale: z.number().positive(),
    harvestSkill: z.enum(["woodcutting", "mining", "fishing"]),
    /**
     * Tool required to harvest. `null` means the resource is free to
     * interact with — used by some fishing spots where the rod is
     * implicit or for test fixtures.
     */
    toolRequired: z.string().min(1).nullable(),
    /**
     * Optional secondary consumable (e.g. `fishing_bait`, `feathers`)
     * consumed on each successful harvest.
     */
    secondaryRequired: z.string().min(1).optional(),
    levelRequired: z.number().int().positive(),
    baseCycleTicks: z.number().int().positive(),
    depleteChance: z.number().min(0).max(1),
    respawnTicks: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "0 paired with depleteChance 0 means the resource never depletes",
      ),
    harvestYield: z.array(yieldSchema).nonempty(),
  });
}

/** A tree entry in `gathering/woodcutting.json`. */
export const TreeResourceSchema = gatheringResource(GatheringYieldSchema);
export type TreeResource = z.infer<typeof TreeResourceSchema>;

/** A rock entry in `gathering/mining.json`. */
export const RockResourceSchema = gatheringResource(GatheringYieldSchema);
export type RockResource = z.infer<typeof RockResourceSchema>;

/** A fishing spot entry in `gathering/fishing.json`. */
export const FishingSpotSchema = gatheringResource(FishingYieldSchema);
export type FishingSpot = z.infer<typeof FishingSpotSchema>;

/** Wrapper for `gathering/woodcutting.json`. */
export const WoodcuttingManifestSchema = z
  .object({
    $schema: z.string().optional(),
    _comment: z.string().optional(),
    trees: z.array(TreeResourceSchema).nonempty(),
  })
  .passthrough();
export type WoodcuttingManifest = z.infer<typeof WoodcuttingManifestSchema>;

/** Wrapper for `gathering/mining.json`. */
export const MiningManifestSchema = z
  .object({
    $schema: z.string().optional(),
    _comment: z.string().optional(),
    rocks: z.array(RockResourceSchema).nonempty(),
  })
  .passthrough();
export type MiningManifest = z.infer<typeof MiningManifestSchema>;

/** Wrapper for `gathering/fishing.json`. */
export const FishingManifestSchema = z
  .object({
    $schema: z.string().optional(),
    _comment: z.string().optional(),
    spots: z.array(FishingSpotSchema).nonempty(),
  })
  .passthrough();
export type FishingManifest = z.infer<typeof FishingManifestSchema>;
