/**
 * Gathering manifest schema.
 *
 * Source of truth for the gathering tables previously hardcoded in
 * `packages/shared/src/constants/GatheringConstants.ts`. Extracted as part of
 * Phase A3 of `PLAN_WORLD_STUDIO_AAA_COMPLETION.md`.
 *
 * Design notes
 * ------------
 * - **tile-based MMORPG LERP rates are tables, not constants.** Keeping them as records
 *   keyed by resource id (then, for woodcutting, axe tier) lets GameModes
 *   add new resources/tools without touching engine code.
 * - **Regex survives JSON as a string.** `validResourceIdPattern` stores the
 *   pattern source and the façade compiles the `RegExp`.
 */

import { z } from "zod";

/** tile-based MMORPG success numerator range used in the LERP formula. Values are x/256. */
export const SuccessRateSchema = z.object({
  low: z.number().int().nonnegative().max(256),
  high: z.number().int().nonnegative().max(256),
});
export type SuccessRate = z.infer<typeof SuccessRateSchema>;

/** How a gathering skill interacts with its tool. */
export const SkillMechanicsEntrySchema = z.object({
  type: z.enum([
    "fixed-roll-variable-success",
    "variable-roll-fixed-success",
    "fixed-roll-fixed-success",
  ]),
  baseRollTicks: z.number().int().positive(),
  toolAffectsSuccess: z.boolean(),
  toolAffectsSpeed: z.boolean(),
});
export type SkillMechanicsEntry = z.infer<typeof SkillMechanicsEntrySchema>;

export const GatheringSkillMechanicsSchema = z.object({
  woodcutting: SkillMechanicsEntrySchema,
  mining: SkillMechanicsEntrySchema,
  fishing: SkillMechanicsEntrySchema,
});
export type GatheringSkillMechanics = z.infer<
  typeof GatheringSkillMechanicsSchema
>;

/** Woodcutting success table: treeId → axe tier → rate. */
export const WoodcuttingRateTableSchema = z.record(
  z.string(),
  z.record(z.string(), SuccessRateSchema),
);
export type WoodcuttingRateTable = z.infer<typeof WoodcuttingRateTableSchema>;

/** Mining/fishing success table: resourceId → rate. */
export const FlatRateTableSchema = z.record(z.string(), SuccessRateSchema);
export type FlatRateTable = z.infer<typeof FlatRateTableSchema>;

/** Per-resource tick timers (despawn/respawn). */
export const TickTableSchema = z.record(
  z.string(),
  z.number().int().nonnegative(),
);
export type TickTable = z.infer<typeof TickTableSchema>;

export const FishingSpotMoveSchema = z.object({
  baseTicks: z.number().int().positive(),
  varianceTicks: z.number().int().nonnegative(),
  relocateRadius: z.number().int().positive(),
  relocateMinDistance: z.number().int().nonnegative(),
});
export type FishingSpotMove = z.infer<typeof FishingSpotMoveSchema>;

/**
 * Full gathering manifest. One JSON file per game.
 */
export const GatheringManifestSchema = z.object({
  $schema: z.literal("hyperforge.gathering.v1"),

  skillMechanics: GatheringSkillMechanicsSchema,

  ranges: z.object({
    gatheringRange: z
      .number()
      .positive()
      .describe("Tile-based gathering range (tiles). Matches melee reach."),
    proximitySearchRadius: z
      .number()
      .positive()
      .describe("Fallback world-unit radius when exact-id match fails"),
    defaultInteractionRange: z
      .number()
      .positive()
      .describe("Legacy world-unit range for non-tile callers"),
    positionEpsilon: z
      .number()
      .positive()
      .describe("Floating-point movement tolerance"),
  }),

  timing: z.object({
    minimumCycleTicks: z.number().int().positive(),
    rateLimitMs: z.number().int().positive(),
    staleRateLimitMs: z.number().int().positive(),
    rateLimitCleanupIntervalMs: z.number().int().positive(),
    timerRegenPerTick: z.number().int().positive(),
  }),

  woodcuttingSuccessRates: WoodcuttingRateTableSchema,
  miningSuccessRates: FlatRateTableSchema,
  fishingSuccessRates: FlatRateTableSchema,
  defaultSuccessRate: SuccessRateSchema,

  resourceIdRules: z.object({
    maxLength: z.number().int().positive(),
    validPattern: z
      .string()
      .min(1)
      .describe("JavaScript regex source (compiled at load time)"),
  }),

  treeDespawnTicks: TickTableSchema,
  treeRespawnTicks: TickTableSchema,

  fishingSpotMove: FishingSpotMoveSchema,
});
export type GatheringManifest = z.infer<typeof GatheringManifestSchema>;
