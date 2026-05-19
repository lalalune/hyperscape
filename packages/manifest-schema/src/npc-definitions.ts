/**
 * NPC definitions manifest schema.
 *
 * Source of truth for the rich NPC catalog at
 * `packages/server/world/assets/manifests/npcs.json` — combat stats,
 * drops, movement, dialogue, services, appearance.
 *
 * Distinct from `./npcs.ts` which covers ONLY the global
 * `NPC_SPAWN_CONSTANTS` (respawn time, max-per-zone, aggro thresholds).
 * That schema was kept narrow for the spawn-tuning hot-reload path;
 * this one covers the full per-NPC definitions.
 *
 * Mirrors the runtime `NPCData` type in
 * `packages/shared/src/types/entities/npc-mob-types.ts`. Most nested
 * sub-objects use `passthrough()` so the schema acts as a thin gate
 * over the rich runtime shape — runtime-only fields (cached compiled
 * scripts, runtime mutable state) survive validation without forcing
 * each one to be enumerated here. Extend the explicit fields as
 * editor-side validation needs tighten.
 *
 * Phase A11 / Phase F (Progression / Economy) of
 * PLAN_WORLD_STUDIO_AAA_COMPLETION.md. Unblocks the registry-prefer
 * wiring for ~10 consumers (CombatSystem, CombatAnimationManager,
 * MagicAttackHandler, AttackContext, RangedAttackHandler,
 * MobNPCSpawnerSystem, LootTableService, DialogueSystem, …) that
 * read `getNPCById(id)` today.
 */

import { z } from "zod";

const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

/** tile-based-MMORPG-style stats. ALL NPCs carry the full block; defaults are 1. */
export const NpcDefinitionStatsSchema = z
  .object({
    level: z.number().int().nonnegative(),
    health: z.number().int().nonnegative(),
    attack: z.number().int().nonnegative(),
    strength: z.number().int().nonnegative(),
    defense: z.number().int().nonnegative(),
    defenseBonus: z.number().int().default(0),
    ranged: z.number().int().nonnegative(),
    magic: z.number().int().nonnegative(),
  })
  .passthrough();
export type NpcDefinitionStats = z.infer<typeof NpcDefinitionStatsSchema>;

/**
 * Combat config. EVERY field is optional — neutral NPCs (bank
 * clerks, shopkeepers, quest givers) typically only set
 * `attackable: false` and let the rest default. Combat NPCs
 * (mobs, bosses) author the full block. DataManager.normalizeNPC
 * fills any unset field with the runtime default before storing
 * the NPCData in ALL_NPCS.
 */
export const NpcDefinitionCombatSchema = z
  .object({
    attackable: z.boolean().optional(),
    aggressive: z.boolean().optional(),
    retaliates: z.boolean().optional(),
    aggroRange: z.number().nonnegative().optional(),
    combatRange: z.number().nonnegative().optional(),
    leashRange: z.number().nonnegative().optional(),
    attackSpeedTicks: z.number().int().positive().optional(),
    /** Manifest input — DataManager normalizes to respawnTime ms. */
    respawnTicks: z.number().int().nonnegative().optional(),
    respawnTime: z.number().nonnegative().optional(),
    xpReward: z.number().nonnegative().optional(),
    poisonous: z.boolean().optional(),
    immuneToPoison: z.boolean().optional(),
    attackType: z.enum(["melee", "ranged", "magic"]).optional(),
    spellId: z.string().min(1).optional(),
    arrowId: z.string().min(1).optional(),
  })
  .passthrough();
export type NpcDefinitionCombat = z.infer<typeof NpcDefinitionCombatSchema>;

/** Tiered drop entry. */
export const NpcDropEntrySchema = z
  .object({
    itemId: z.string().min(1),
    minQuantity: z.number().int().positive().default(1),
    maxQuantity: z.number().int().positive().default(1),
    chance: z.number().min(0).max(1).default(1),
  })
  .passthrough();
export type NpcDropEntry = z.infer<typeof NpcDropEntrySchema>;

/** Per-NPC default drop (bones / ashes / coin pile). */
export const NpcDefaultDropSchema = z
  .object({
    enabled: z.boolean().default(true),
    itemId: z.string().min(1).default("bones"),
    quantity: z.number().int().positive().default(1),
  })
  .passthrough();
export type NpcDefaultDrop = z.infer<typeof NpcDefaultDropSchema>;

/** Tiered drop tables — tile-based-MMORPG-style 5-tier rarity. */
export const NpcDefinitionDropsSchema = z
  .object({
    defaultDrop: NpcDefaultDropSchema,
    always: z.array(NpcDropEntrySchema).default([]),
    common: z.array(NpcDropEntrySchema).default([]),
    uncommon: z.array(NpcDropEntrySchema).default([]),
    rare: z.array(NpcDropEntrySchema).default([]),
    veryRare: z.array(NpcDropEntrySchema).default([]),
    rareDropTable: z.boolean().default(false),
    rareDropTableChance: z.number().min(0).max(1).optional(),
  })
  .passthrough();
export type NpcDefinitionDrops = z.infer<typeof NpcDefinitionDropsSchema>;

/** Movement config. Fully passthrough — patrol paths, biome-restrictions, etc. */
export const NpcDefinitionMovementSchema = z
  .object({
    type: z.enum(["stationary", "wander", "patrol"]).default("stationary"),
    speed: z.number().nonnegative().default(0),
    wanderRadius: z.number().nonnegative().default(0),
    roaming: z.boolean().default(false),
  })
  .passthrough();
export type NpcDefinitionMovement = z.infer<typeof NpcDefinitionMovementSchema>;

/** NPC categories — gameplay role. */
export const NpcCategorySchema = z.enum(["mob", "boss", "neutral", "quest"]);
export type NpcCategory = z.infer<typeof NpcCategorySchema>;

/** Single NPC definition. Most sub-objects passthrough so runtime-only
 * fields (services, behavior, dialogue, appearance — each rich enough
 * to warrant its own schema later) survive without being enumerated
 * here. Extend explicitly as editor validation needs grow. */
export const NpcDefinitionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(""),
    category: NpcCategorySchema,
    faction: z.string().min(1).default("neutral"),
    /** Optional level range — array `[min,max]` or object `{min,max}` accepted. */
    levelRange: z
      .union([
        z.tuple([z.number(), z.number()]),
        z.object({ min: z.number(), max: z.number() }),
      ])
      .optional(),
    /** Combat stats. Optional — neutral/quest NPCs (bank clerks,
     *  shopkeepers) skip this. DataManager.normalizeNPC fills
     *  defaults (level 1, 1 HP, all stats 1) before storing. */
    stats: NpcDefinitionStatsSchema.optional(),
    /** Combat config. Optional for neutral NPCs (only attackable=false). */
    combat: NpcDefinitionCombatSchema.optional(),
    movement: NpcDefinitionMovementSchema.optional(),
    /** Drop tables. Optional — neutral NPCs typically don't drop. */
    drops: NpcDefinitionDropsSchema.optional(),
    /** Services: bank/shop/quest/skill_trainer/teleport offerings.
     *  Passthrough so the rich shape (shopInventory, questIds, etc.)
     *  flows through without listing every field here. */
    services: z.object({}).passthrough().optional(),
    /** Behavior tree / AI config. Passthrough — graph payloads vary. */
    behavior: z.object({}).passthrough().optional(),
    /** Dialogue tree id or inline definition. Passthrough. */
    dialogue: z.object({}).passthrough().optional(),
    /** Visual config — modelPath, scale, animations, materials. */
    appearance: z.object({}).passthrough().optional(),
    /** Spawn position (world coords). Optional — for static placements. */
    position: Vec3Schema.optional(),
    /** Biome ids this NPC may spawn in. */
    spawnBiomes: z.array(z.string().min(1)).optional(),
    /** Role tag matching building npcType (e.g., "store", "smithy"). */
    buildingRole: z.string().min(1).optional(),
  })
  .passthrough();
export type NpcDefinition = z.infer<typeof NpcDefinitionSchema>;

/** The manifest is a bare array. */
export const NpcDefinitionsManifestSchema = z.array(NpcDefinitionSchema);
export type NpcDefinitionsManifest = z.infer<
  typeof NpcDefinitionsManifestSchema
>;
