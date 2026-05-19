/**
 * Tier requirements manifest schema.
 *
 * Source of truth for tile-based-MMORPG-accurate tier → skill-requirement
 * mappings used by equipment and tools. The JSON is loaded at
 * runtime by `DataManager` and handed to `loadTierRequirements()`
 * in `packages/shared/src/data/TierDataProvider.ts`.
 *
 * Extracted as part of Phase A11 of
 * `PLAN_WORLD_STUDIO_AAA_COMPLETION.md`.
 */

import { z } from "zod";

export const MeleeTierDataSchema = z.object({
  attack: z.number().int().min(1).max(99),
  defence: z.number().int().min(1).max(99),
});
export type MeleeTierData = z.infer<typeof MeleeTierDataSchema>;

export const ToolTierDataSchema = z.object({
  attack: z.number().int().min(1).max(99),
  woodcutting: z.number().int().min(1).max(99),
  mining: z.number().int().min(1).max(99),
});
export type ToolTierData = z.infer<typeof ToolTierDataSchema>;

export const RangedTierDataSchema = z.object({
  ranged: z.number().int().min(1).max(99),
  defence: z.number().int().min(1).max(99),
});
export type RangedTierData = z.infer<typeof RangedTierDataSchema>;

export const MagicTierDataSchema = z.object({
  magic: z.number().int().min(1).max(99),
  defence: z.number().int().min(1).max(99).optional(),
});
export type MagicTierData = z.infer<typeof MagicTierDataSchema>;

export const TierRequirementsManifestSchema = z.object({
  /** Optional `$schema` marker retained from legacy JSON. */
  $schema: z.string().optional(),
  melee: z.record(z.string().min(1), MeleeTierDataSchema),
  tools: z.record(z.string().min(1), ToolTierDataSchema),
  ranged: z.record(z.string().min(1), RangedTierDataSchema),
  magic: z.record(z.string().min(1), MagicTierDataSchema),
});
export type TierRequirementsManifest = z.infer<
  typeof TierRequirementsManifestSchema
>;
