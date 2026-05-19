/**
 * Combat manifest schema.
 *
 * Source of truth for the data previously hardcoded in
 * `packages/shared/src/constants/CombatConstants.ts`. Extracted as part of
 * Phase A of `PLAN_WORLD_STUDIO_AAA_COMPLETION.md`.
 *
 * Design notes
 * ------------
 * - **One flat schema per concern.** We intentionally do NOT follow the old
 *   nested `COMBAT_CONSTANTS.*` structure — flat groups make editor panels
 *   simpler and Zod validation faster.
 * - **Every field has a minimum viable doc.** That doc renders as tooltip
 *   help in the editor.
 * - **Tick-based values keep their tile-based MMORPG semantics.** 1 tick = 600ms.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Style bonuses
// ---------------------------------------------------------------------------

/** Ranged combat style — trade speed for accuracy or range. */
export const RangedCombatStyleSchema = z.enum([
  "accurate",
  "rapid",
  "longrange",
]);
export type RangedCombatStyle = z.infer<typeof RangedCombatStyleSchema>;

/** Magic combat style — default cast, longer range, or autocast. */
export const MagicCombatStyleSchema = z.enum([
  "accurate",
  "longrange",
  "autocast",
]);
export type MagicCombatStyle = z.infer<typeof MagicCombatStyleSchema>;

/** Per-style stat bonuses and XP distribution for ranged combat. */
export const RangedStyleBonusSchema = z.object({
  attackBonus: z.number().int(),
  speedModifier: z.number().int(),
  rangeModifier: z.number().int(),
  xpSplit: z.enum(["ranged", "ranged_defence"]),
});
export type RangedStyleBonus = z.infer<typeof RangedStyleBonusSchema>;

/** Per-style stat bonuses and XP distribution for magic combat. */
export const MagicStyleBonusSchema = z.object({
  attackBonus: z.number().int(),
  speedModifier: z.number().int(),
  rangeModifier: z.number().int(),
  xpSplit: z.enum(["magic", "magic_defence"]),
});
export type MagicStyleBonus = z.infer<typeof MagicStyleBonusSchema>;

/** Melee style controls which attack/defence bonuses are used. */
export const MeleeAttackStyleSchema = z.enum(["stab", "slash", "crush"]);
export type MeleeAttackStyle = z.infer<typeof MeleeAttackStyleSchema>;

// ---------------------------------------------------------------------------
// Ranges (tiles)
// ---------------------------------------------------------------------------

export const CombatRangesSchema = z.object({
  ranged: z.number().positive().describe("Default ranged attack range (tiles)"),
  magic: z.number().positive().describe("Default magic attack range (tiles)"),
  meleeStandard: z
    .number()
    .positive()
    .describe("Standard melee weapon reach (tiles)"),
  meleeHalberd: z.number().positive().describe("Halberd/polearm reach (tiles)"),
  pickup: z
    .number()
    .positive()
    .describe("How close a player must be to pick up a dropped item (tiles)"),
});
export type CombatRanges = z.infer<typeof CombatRangesSchema>;

// ---------------------------------------------------------------------------
// Ticks
// ---------------------------------------------------------------------------

export const CombatTicksSchema = z.object({
  tickDurationMs: z
    .number()
    .int()
    .positive()
    .describe("Milliseconds per tick (tile-based MMORPG = 600)"),
  defaultAttackSpeedTicks: z
    .number()
    .int()
    .positive()
    .describe("Attack cooldown when weapon/manifest doesn't specify"),
  combatTimeoutTicks: z
    .number()
    .int()
    .positive()
    .describe("Ticks after last hit before leaving combat"),
  logoutPreventionTicks: z.number().int().nonnegative(),
  healthRegenCooldownTicks: z.number().int().nonnegative(),
  healthRegenIntervalTicks: z.number().int().positive(),
  afkDisableRetaliateTicks: z.number().int().positive(),
});
export type CombatTicks = z.infer<typeof CombatTicksSchema>;

// ---------------------------------------------------------------------------
// Food / consumables
// ---------------------------------------------------------------------------

export const CombatFoodSchema = z.object({
  eatDelayTicks: z
    .number()
    .int()
    .nonnegative()
    .describe("Ticks before player can eat again"),
  eatAttackDelayTicks: z
    .number()
    .int()
    .nonnegative()
    .describe("Extra cooldown added to next attack when eating in combat"),
  maxHealAmount: z
    .number()
    .int()
    .positive()
    .describe(
      "Hard cap on heal-per-food to prevent manifest-modification exploit",
    ),
});
export type CombatFood = z.infer<typeof CombatFoodSchema>;

// ---------------------------------------------------------------------------
// Hit delay formulas
// ---------------------------------------------------------------------------

export const CombatHitDelaySchema = z.object({
  meleeBase: z.number().int().nonnegative(),
  rangedBase: z.number().int().nonnegative(),
  rangedDistanceOffset: z.number().int(),
  rangedDistanceDivisor: z.number().int().positive(),
  magicBase: z.number().int().nonnegative(),
  magicDistanceOffset: z.number().int(),
  magicDistanceDivisor: z.number().int().positive(),
  maxHitDelay: z
    .number()
    .int()
    .positive()
    .describe("Absolute ceiling on computed hit delay"),
});
export type CombatHitDelay = z.infer<typeof CombatHitDelaySchema>;

// ---------------------------------------------------------------------------
// Projectile launch
// ---------------------------------------------------------------------------

export const CombatProjectilesSchema = z.object({
  spellLaunchDelayMs: z
    .number()
    .int()
    .nonnegative()
    .describe("Cast wind-up before spell projectile spawns"),
  arrowLaunchDelayMs: z
    .number()
    .int()
    .nonnegative()
    .describe("Draw wind-up before arrow projectile spawns"),
});
export type CombatProjectiles = z.infer<typeof CombatProjectilesSchema>;

// ---------------------------------------------------------------------------
// Rotation (visual)
// ---------------------------------------------------------------------------

export const CombatRotationSchema = z.object({
  combatSlerpSpeed: z.number().positive(),
  movementSlerpSpeed: z.number().positive(),
  facingMaxDistance: z.number().positive(),
  minRotationDistanceSq: z.number().nonnegative(),
});
export type CombatRotation = z.infer<typeof CombatRotationSchema>;

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

export const CombatAnimationSchema = z.object({
  hitFrameRatio: z
    .number()
    .min(0)
    .max(1)
    .describe("0..1 — when in the attack anim the hit registers"),
  minAnimationTicks: z.number().int().positive(),
  hitsplatDelayTicks: z.number().int().nonnegative(),
  hitsplatDurationTicks: z.number().int().positive(),
  emoteCombat: z.string(),
  emoteSwordSwing: z.string(),
  emote2hSlash: z.string(),
  emote2hIdle: z.string(),
  emoteRanged: z.string(),
  emoteMagic: z.string(),
  emoteIdle: z.string(),
  crossfadeDuration: z
    .number()
    .positive()
    .describe("GLB animation crossfade duration in seconds"),
});
export type CombatAnimation = z.infer<typeof CombatAnimationSchema>;

// ---------------------------------------------------------------------------
// Death / loot / respawn
// ---------------------------------------------------------------------------

export const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Vector3Literal = z.infer<typeof Vector3Schema>;

export const CombatDeathSchema = z.object({
  respawnTicksRandomness: z.number().int().nonnegative(),
  gravestoneTicks: z.number().int().positive(),
  groundItemDespawnTicks: z.number().int().positive(),
  untradeableDespawnTicks: z.number().int().positive(),
  lootProtectionTicks: z.number().int().nonnegative(),
  corpseDespawnTicks: z.number().int().positive(),
  animationTicks: z.number().int().positive(),
  cooldownTicks: z.number().int().nonnegative(),
  reconnectRespawnDelayTicks: z.number().int().nonnegative(),
  staleLockAgeTicks: z.number().int().positive(),
  defaultRespawnPosition: Vector3Schema,
  defaultRespawnTown: z.string().min(1),
});
export type CombatDeath = z.infer<typeof CombatDeathSchema>;

// ---------------------------------------------------------------------------
// Damage formulas
// ---------------------------------------------------------------------------

export const CombatDamageSchema = z.object({
  baseConstant: z.number().positive(),
  effectiveLevelConstant: z.number().positive(),
  damageDivisor: z.number().positive(),
  minDamage: z.number().int().nonnegative(),
  maxDamage: z.number().int().positive(),
});
export type CombatDamage = z.infer<typeof CombatDamageSchema>;

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

export const CombatXpSchema = z.object({
  combatXpPerDamage: z.number().nonnegative(),
  hitpointsXpPerDamage: z.number().nonnegative(),
  controlledXpPerDamage: z.number().nonnegative(),
});
export type CombatXp = z.infer<typeof CombatXpSchema>;

// ---------------------------------------------------------------------------
// Defaults for manifest-less entities
// ---------------------------------------------------------------------------

export const CombatNpcDefaultsSchema = z.object({
  attackSpeedTicks: z.number().int().positive(),
  aggroRange: z.number().nonnegative(),
  combatRange: z.number().positive(),
  leashRange: z.number().positive(),
  respawnTicks: z.number().int().positive(),
  wanderRadius: z.number().nonnegative(),
});
export type CombatNpcDefaults = z.infer<typeof CombatNpcDefaultsSchema>;

export const CombatItemDefaultsSchema = z.object({
  attackSpeed: z.number().int().positive(),
  attackRange: z.number().positive(),
});
export type CombatItemDefaults = z.infer<typeof CombatItemDefaultsSchema>;

// ---------------------------------------------------------------------------
// Aggro
// ---------------------------------------------------------------------------

export const AggroConstantsSchema = z.object({
  defaultBehavior: z.enum(["passive", "aggressive", "defensive"]),
  updateIntervalMs: z.number().int().positive(),
  alwaysAggressiveLevel: z.number().int().positive(),
});
export type AggroConstants = z.infer<typeof AggroConstantsSchema>;

// ---------------------------------------------------------------------------
// Level / XP curve
// ---------------------------------------------------------------------------

export const LevelConstantsSchema = z.object({
  defaultCombatLevel: z.number().int().positive(),
  minCombatLevel: z.number().int().positive(),
  maxLevel: z.number().int().positive(),
  xpBase: z.number().positive(),
  xpGrowthFactor: z.number().positive(),
  combatLevelWeights: z.object({
    defenseWeight: z.number().nonnegative(),
    offenseWeight: z.number().nonnegative(),
    rangedMultiplier: z.number().positive(),
  }),
});
export type LevelConstants = z.infer<typeof LevelConstantsSchema>;

// ---------------------------------------------------------------------------
// Style bonus tables (ranged/magic/weapon default melee style)
// ---------------------------------------------------------------------------

export const RangedStyleBonusTableSchema = z.record(
  RangedCombatStyleSchema,
  RangedStyleBonusSchema,
);
export type RangedStyleBonusTable = z.infer<typeof RangedStyleBonusTableSchema>;

export const MagicStyleBonusTableSchema = z.record(
  MagicCombatStyleSchema,
  MagicStyleBonusSchema,
);
export type MagicStyleBonusTable = z.infer<typeof MagicStyleBonusTableSchema>;

/** Maps weapon-type id (e.g., "sword", "dagger") → default melee style. */
export const WeaponDefaultAttackStyleTableSchema = z.record(
  z.string(),
  MeleeAttackStyleSchema,
);
export type WeaponDefaultAttackStyleTable = z.infer<
  typeof WeaponDefaultAttackStyleTableSchema
>;

// ---------------------------------------------------------------------------
// Top-level combat manifest
// ---------------------------------------------------------------------------

/**
 * Full combat manifest. One JSON file per game.
 *
 * Hyperscape ships its own as the reference implementation; alternate
 * GameModes / plugins can ship alternates (e.g., a faster-tick shooter mode).
 */
export const CombatManifestSchema = z.object({
  $schema: z
    .literal("hyperforge.combat.v1")
    .describe("Schema version tag — future-proofs migrations"),

  ranges: CombatRangesSchema,
  ticks: CombatTicksSchema,
  food: CombatFoodSchema,
  hitDelay: CombatHitDelaySchema,
  projectiles: CombatProjectilesSchema,
  rotation: CombatRotationSchema,
  animation: CombatAnimationSchema,
  death: CombatDeathSchema,
  damage: CombatDamageSchema,
  xp: CombatXpSchema,

  npcDefaults: CombatNpcDefaultsSchema,
  itemDefaults: CombatItemDefaultsSchema,

  aggro: AggroConstantsSchema,
  levels: LevelConstantsSchema,

  weaponDefaultAttackStyle: WeaponDefaultAttackStyleTableSchema,
  rangedStyleBonuses: RangedStyleBonusTableSchema,
  magicStyleBonuses: MagicStyleBonusTableSchema,
});
export type CombatManifest = z.infer<typeof CombatManifestSchema>;
