/**
 * Skill unlocks manifest schema.
 *
 * tile-based-MMORPG-style content unlocks per skill level (displayed in the
 * level-up notification popup). The JSON is loaded at runtime by
 * `DataManager` and handed to `loadSkillUnlocks()` in
 * `packages/shared/src/data/skill-unlocks.ts`.
 *
 * Extracted as part of Phase A11 of
 * `PLAN_WORLD_STUDIO_AAA_COMPLETION.md`.
 */

import { z } from "zod";

export const SkillUnlockTypeSchema = z.enum([
  "item",
  "ability",
  "area",
  "quest",
  "activity",
]);
export type SkillUnlockType = z.infer<typeof SkillUnlockTypeSchema>;

export const SkillUnlockEntrySchema = z.object({
  level: z.number().int().min(1).max(99),
  description: z.string().min(1),
  type: SkillUnlockTypeSchema,
});
export type SkillUnlockEntry = z.infer<typeof SkillUnlockEntrySchema>;

export const SkillUnlocksManifestSchema = z.object({
  /** Optional JSON Schema pointer field retained from legacy docs. */
  $schema: z.string().optional(),
  /** Free-form comment field retained from legacy docs. */
  _comment: z.string().optional(),
  /** Per-skill unlock arrays, keyed by tile-based MMORPG skill name. */
  skills: z.record(z.string().min(1), z.array(SkillUnlockEntrySchema)),
});
export type SkillUnlocksManifest = z.infer<typeof SkillUnlocksManifestSchema>;
