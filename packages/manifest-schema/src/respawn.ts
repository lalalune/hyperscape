/**
 * Respawn manifest schema.
 *
 * Authored policy for character death + return-to-life. Covers the
 * bind-point/graveyard registry (where a character returns on death),
 * death-penalty rules (XP loss, gold loss, durability damage, item
 * drop), corpse-run rules (ghost travel speed, corpse despawn, ghost
 * invisibility), and resurrection rules (rez sickness, instant-rez
 * abilities, auto-rez timer).
 *
 * Scope: authored policy + registry. Runtime `RespawnSystem` owns the
 * death event hook, corpse entity lifecycle, ghost-mode toggle, rez-
 * sickness buff application, bind-point selection UI, and auto-rez
 * countdown — all separate follow-ups.
 *
 * Scope-isolated from `combat.ts` (damage/death math lives there —
 * respawn reacts to a death event), `factions.ts` (some bind points
 * are faction-gated at runtime via the `restriction` field shape),
 * and `level-streaming.ts` (bind points live inside streamable
 * sublevels — respawn does not manage the load).
 */

import { z } from "zod";

/** RespawnBindPointId — lowerCamelCase ASCII identifier. */
const BindPointId = z
  .string()
  .regex(
    /^[a-z][a-zA-Z0-9_-]*$/,
    "bind point id must be lowerCamelCase ASCII identifier",
  );

/** Shape-only reference to another manifest id (loader resolves). */
const ManifestRef = z
  .string()
  .regex(
    /^[a-z][a-zA-Z0-9_-]*$/,
    "manifest reference must be lowerCamelCase ASCII identifier",
  );

/** 3D world-space position. */
const Vec3Schema = z
  .object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  })
  .strict();

/**
 * Bind point kind — where a character respawns from.
 */
export const RespawnBindKindSchema = z.enum([
  "graveyard",
  "innkeeper",
  "capitalSpawn",
  "dungeonEntrance",
  "raidEntrance",
  "playerHousing",
  "custom",
]);
export type RespawnBindKind = z.infer<typeof RespawnBindKindSchema>;

/**
 * Bind point — a place a character can respawn.
 */
export const RespawnBindPointSchema = z
  .object({
    id: BindPointId,
    name: z.string().min(1),
    description: z.string().default(""),
    iconId: z.string().default(""),
    kind: RespawnBindKindSchema,
    zoneId: ManifestRef,
    position: Vec3Schema,
    /** Facing angle on respawn (radians around +Y, 0 = look along +X). */
    facingYawRadians: z
      .number()
      .min(-Math.PI * 2)
      .max(Math.PI * 2)
      .default(0),
    /**
     * If true, players can set this as their active bind via interaction.
     * Graveyards are typically auto-bound; innkeepers are opt-in.
     */
    allowBindHere: z.boolean().default(false),
    /** If true, ghost-mode corpse run can originate from this point. */
    corpseRunAllowed: z.boolean().default(true),
    /** If true, rez sickness is applied on respawn from this point. */
    applyResurrectionSickness: z.boolean().default(true),
    /** Minimum character level to bind here (0 = no gate). */
    minCharacterLevel: z.number().int().min(0).max(200).default(0),
    /** Faction id allow list (empty = any). Shape-only — loader resolves. */
    factionAllowList: z.array(ManifestRef).default([]),
    /**
     * Custom kind key — required when `kind='custom'`, ignored otherwise.
     * Lets plugins register new bind-point kinds (e.g. guild hall,
     * battleground spawn) without schema edits.
     */
    customKey: z.string().default(""),
  })
  .strict()
  .refine(({ kind, customKey }) => kind !== "custom" || customKey.length > 0, {
    message: "kind='custom' requires a non-empty customKey",
  });
export type RespawnBindPoint = z.infer<typeof RespawnBindPointSchema>;

/**
 * Death-penalty rules — what a player loses when they die.
 */
export const DeathPenaltyRulesSchema = z
  .object({
    /** XP loss as a fraction of current-level XP [0..1]. 0 = no XP loss. */
    xpLossFractionOfLevel: z.number().min(0).max(1).default(0),
    /** Also drop progression below the level floor (XP can cost a level). */
    xpLossCanDelevel: z.boolean().default(false),
    /**
     * Gold loss as a fraction of carried gold [0..1]. 0 = no gold loss.
     */
    goldLossFraction: z.number().min(0).max(1).default(0),
    /** Absolute cap on gold loss per death (0 = no cap beyond fraction). */
    goldLossMaxCurrency: z.number().int().min(0).max(1_000_000_000).default(0),
    /** Durability loss on all equipped items as a fraction [0..1]. */
    durabilityLossFraction: z.number().min(0).max(1).default(0.1),
    /** If true, dropped items appear at the corpse as lootable. */
    dropItemsOnDeath: z.boolean().default(false),
    /** Max item count dropped (relevant when dropItemsOnDeath=true). */
    maxItemsDropped: z.number().int().min(0).max(28).default(0),
    /**
     * Ruleset: which items drop when dropItemsOnDeath=true.
     * - `none`: nothing drops
     * - `inventoryUnequipped`: only inventory items (equipment kept)
     * - `inventoryAndEquipped`: everything (hardcore PvP)
     * - `lowestValueFirst`: drop N lowest-value items (tile-based MMORPG 3-item rule)
     */
    dropPolicy: z
      .enum([
        "none",
        "inventoryUnequipped",
        "inventoryAndEquipped",
        "lowestValueFirst",
      ])
      .default("none"),
    /** If true, dropped items are only visible to the owner for graceSec. */
    dropGraceSec: z.number().int().min(0).max(3600).default(60),
  })
  .strict()
  .refine(
    ({ dropItemsOnDeath, dropPolicy }) =>
      !dropItemsOnDeath || dropPolicy !== "none",
    {
      message:
        "dropItemsOnDeath=true requires dropPolicy !== 'none' (otherwise the drop has no target policy)",
    },
  )
  .refine(
    ({ dropItemsOnDeath, maxItemsDropped }) =>
      !dropItemsOnDeath || maxItemsDropped > 0,
    {
      message:
        "dropItemsOnDeath=true requires maxItemsDropped > 0 (else no items ever actually drop)",
    },
  );
export type DeathPenaltyRules = z.infer<typeof DeathPenaltyRulesSchema>;

/**
 * Corpse-run rules — ghost-mode travel from bind point back to corpse.
 */
export const CorpseRunRulesSchema = z
  .object({
    /** If true, corpse-run is available (false = instant respawn at bind). */
    enabled: z.boolean().default(true),
    /** Ghost movement speed multiplier [0.5..3]. */
    ghostSpeedMultiplier: z.number().min(0.5).max(3).default(1.25),
    /** If true, ghost is invisible to enemy players. */
    ghostInvisibleToEnemies: z.boolean().default(true),
    /** If true, ghost cannot attack or be attacked. */
    ghostInvulnerable: z.boolean().default(true),
    /** Minutes before an unclaimed corpse despawns (0 = never). */
    corpseDespawnMinutes: z.number().int().min(0).max(4320).default(120),
    /** If true, other players can loot the corpse (PvP full-loot). */
    corpseLootableByOthers: z.boolean().default(false),
    /** Distance in meters at which the ghost auto-resurrects on reaching. */
    resurrectOnProximityMeters: z.number().min(0).max(50).default(3),
    /**
     * If true, players may teleport back to the corpse from any point (lets
     * late-joining raid members rejoin quickly). If false, corpse-run only.
     */
    allowCorpseTeleport: z.boolean().default(false),
  })
  .strict()
  .refine(
    ({ corpseLootableByOthers, enabled }) => !corpseLootableByOthers || enabled,
    {
      message:
        "corpseLootableByOthers=true requires corpse-run enabled=true (else there's no corpse to loot)",
    },
  );
export type CorpseRunRules = z.infer<typeof CorpseRunRulesSchema>;

/**
 * Resurrection rules — rez sickness + auto-rez timer + instant rez.
 */
export const ResurrectionRulesSchema = z
  .object({
    /** Minutes of rez sickness applied on bind-point respawn. */
    sicknessMinutes: z.number().int().min(0).max(60).default(10),
    /** Stat reduction fraction during sickness [0..1]. */
    sicknessStatReductionFraction: z.number().min(0).max(1).default(0.75),
    /** If true, medic/priest abilities can grant instant (no-sickness) rez. */
    allowInstantResByAbility: z.boolean().default(true),
    /** Seconds before auto-rez at bind point (0 = no auto; ghost required). */
    autoResAtBindAfterSec: z.number().int().min(0).max(1800).default(30),
    /**
     * If true, spirits at graveyards offer an instant rez (loses 25% XP or
     * similar — configured via DeathPenaltyRules). WoW pre-Cata pattern.
     */
    allowSpiritGuideRes: z.boolean().default(false),
    /** Minimum level for rez sickness to apply (rez-free early levels). */
    sicknessMinCharacterLevel: z.number().int().min(0).max(200).default(10),
  })
  .strict()
  .refine(
    ({ sicknessMinutes, sicknessStatReductionFraction }) =>
      sicknessMinutes === 0 || sicknessStatReductionFraction > 0,
    {
      message:
        "sicknessMinutes > 0 requires sicknessStatReductionFraction > 0 (else sickness has no effect)",
    },
  );
export type ResurrectionRules = z.infer<typeof ResurrectionRulesSchema>;

export const RespawnManifestSchema = z
  .object({
    enabled: z.boolean().default(true),
    bindPoints: z.array(RespawnBindPointSchema).default([]),
    deathPenalty: DeathPenaltyRulesSchema.default(() =>
      DeathPenaltyRulesSchema.parse({}),
    ),
    corpseRun: CorpseRunRulesSchema.default(() =>
      CorpseRunRulesSchema.parse({}),
    ),
    resurrection: ResurrectionRulesSchema.default(() =>
      ResurrectionRulesSchema.parse({}),
    ),
  })
  .strict()
  .refine(
    ({ bindPoints }) =>
      new Set(bindPoints.map((b) => b.id)).size === bindPoints.length,
    { message: "respawn bind point ids must be unique" },
  )
  .refine(({ enabled, bindPoints }) => !enabled || bindPoints.length > 0, {
    message:
      "respawn enabled=true requires at least one bind point (players must have somewhere to respawn)",
  })
  .refine(
    ({ enabled, bindPoints }) =>
      !enabled || bindPoints.some((b) => b.allowBindHere),
    {
      message:
        "respawn enabled=true requires at least one bind point with allowBindHere=true (else no player can ever bind)",
    },
  );
export type RespawnManifest = z.infer<typeof RespawnManifestSchema>;
