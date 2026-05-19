/**
 * Skill icons manifest schema.
 *
 * Source of truth for UI display metadata (label, emoji icon,
 * category, default level) per tile-based-MMORPG-style skill, plus the broader
 * emoji icon lookup table covering legacy/alias skill keys.
 * Previously hardcoded in `packages/shared/src/data/skill-icons.ts`.
 *
 * Extracted as part of Phase A11 of
 * `PLAN_WORLD_STUDIO_AAA_COMPLETION.md`.
 */

import { z } from "zod";

export const SkillCategorySchema = z.enum([
  "combat",
  "gathering",
  "production",
]);
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const SkillDefinitionSchema = z.object({
  /** Skill key (matches `keyof Skills`). */
  key: z.string().min(1),
  /** UI display label. */
  label: z.string().min(1),
  /** Emoji icon. */
  icon: z.string().min(1),
  /** Category for grouping. */
  category: SkillCategorySchema,
  /** Default starting level (usually 1; constitution starts at 10). */
  defaultLevel: z.number().int().min(1).max(99),
});
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

export const SkillIconsManifestSchema = z.object({
  $schema: z.literal("hyperforge.skill-icons.v1"),
  /** Skill definitions in tile-based-MMORPG-style display order. */
  definitions: z.array(SkillDefinitionSchema).min(1),
  /** Emoji icons keyed by lowercase skill name (covers aliases). */
  icons: z.record(z.string().min(1), z.string().min(1)),
  /** Fallback emoji for unknown skill names. */
  fallbackIcon: z.string().min(1),
});
export type SkillIconsManifest = z.infer<typeof SkillIconsManifestSchema>;
