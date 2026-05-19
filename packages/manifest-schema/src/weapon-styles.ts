/**
 * Weapon-style manifest schema.
 *
 * Source of truth for the tile-based-MMORPG-accurate combat style availability table
 * previously hardcoded in `packages/shared/src/constants/WeaponStyleConfig.ts`.
 * Extracted as part of Phase A8 of `PLAN_WORLD_STUDIO_AAA_COMPLETION.md`.
 *
 * Keys match the `WeaponType` enum values in
 * `packages/shared/src/types/game/item-types.ts`. Styles match the
 * `CombatStyleExtended` string union.
 */

import { z } from "zod";

export const CombatStyleExtendedSchema = z.enum([
  "accurate",
  "aggressive",
  "defensive",
  "controlled",
  "longrange",
  "rapid",
  "autocast",
]);
export type CombatStyleExtendedLiteral = z.infer<
  typeof CombatStyleExtendedSchema
>;

export const WeaponTypeIdSchema = z.enum([
  "sword",
  "axe",
  "mace",
  "dagger",
  "spear",
  "bow",
  "crossbow",
  "staff",
  "wand",
  "shield",
  "scimitar",
  "longsword",
  "two_hand_sword",
  "halberd",
  "none",
]);
export type WeaponTypeId = z.infer<typeof WeaponTypeIdSchema>;

export const WeaponStylesManifestSchema = z.object({
  $schema: z.literal("hyperforge.weapon-styles.v1"),
  /**
   * For each `WeaponType`, the ordered list of combat styles that weapon
   * may use. The first entry is treated as the default style.
   */
  styles: z.record(
    WeaponTypeIdSchema,
    z.array(CombatStyleExtendedSchema).min(1),
  ),
});
export type WeaponStylesManifest = z.infer<typeof WeaponStylesManifestSchema>;
