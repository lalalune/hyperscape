/**
 * World areas manifest schema.
 *
 * Covers `packages/server/world/assets/manifests/world-areas.json` — the
 * hand-authored area catalog. The top level groups areas by difficulty
 * category (starter towns, level 1/2/3 wilderness, special areas like the
 * duel arena).
 *
 * Each area carries axis-aligned bounds, a biome tag, and (optionally)
 * spawn lists for NPCs, resources, mob spawns, fishing spots, and stations.
 */

import { z } from "zod";

const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const BoundsSchema = z.object({
  minX: z.number(),
  maxX: z.number(),
  minZ: z.number(),
  maxZ: z.number(),
});

/**
 * Asset pack reference — `<packManifestId>/<entryId>`. Optional on
 * every world-content placement; when present, the engine renders
 * the named entry's model instead of falling back to a placeholder.
 *
 * Layer A of the AI ↔ assets ↔ plugins integration plan. The
 * AI's `GET_PROJECT_STATE.availableAssets` returns refs in this
 * exact shape so the agent can copy a `ref` value directly into
 * a placement. The studio validates that the pack is in the
 * project's installed list before accepting the proposal.
 *
 * Two slashes are the only required content (separating pack id
 * from entry id); npm-scoped pack ids include their own '@' so
 * the pattern is `@scope/pack-id-vN/entry-id`.
 */
const AssetRefSchema = z
  .string()
  .regex(
    /^.+\/.+$/,
    "assetRef must be `<packManifestId>/<entryId>` (e.g. `@hyperforge/asset-pack-hyperia-trees-v1/tree_oak_v1`)",
  );

/**
 * Common placement metadata shared by every world-content
 * placement — NPCs, mob spawns, resources, stations, teleports.
 *
 * P1 of `PLAN_AGENT_STUDIO_PARITY.md`. These fields are the
 * minimum surface needed for an agent-emitted placement to behave
 * identically to a manually-placed one in World Studio:
 *
 *   - `rotation`        — Y-axis rotation in radians (default 0).
 *                         Lets the gizmo's rotate handle round-trip.
 *   - `scale`           — uniform scale multiplier (default 1).
 *                         Studio applies to the rendered model.
 *   - `properties`      — passthrough extension bag for engine-
 *                         or plugin-specific state that doesn't
 *                         fit the typed schema. Survives
 *                         serialization round-trips.
 *   - `source`          — provenance tag. The studio's outliner
 *                         color-codes by this so a user can see at
 *                         a glance which entities came from where.
 *   - `sourceRegionId`  — when `source = "procgen"`, references
 *                         the generator that produced this entry.
 *                         Used by procgen cleanup to remove a
 *                         whole region's contributions in one go.
 *
 * All fields are optional so existing payloads continue to parse.
 * The studio reads each with sensible defaults when absent.
 */
export const PlacementCommonSchema = z.object({
  rotation: z.number().optional(),
  scale: z.number().positive().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  source: z.enum(["designer", "procgen", "agent"]).optional(),
  sourceRegionId: z.string().min(1).optional(),
});
export type PlacementCommon = z.infer<typeof PlacementCommonSchema>;

/** NPC inside an area — `type` selects role (shop, healer, quest giver, …). */
export const WorldAreaNPCSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    name: z.string().min(1).optional(),
    position: Vec3Schema,
    /** Store id when `type` refers to a shop role. */
    storeId: z.string().min(1).optional(),
    /** Free-form dialogue data — keyed by dialogue id. */
    dialogue: z.record(z.string(), z.string()).optional(),
    /**
     * Optional asset pack reference (`<packId>/<entryId>`). Engine
     * uses this to load the model. If absent, the engine falls
     * back to a generic NPC placeholder.
     */
    assetRef: AssetRefSchema.optional(),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaNPC = z.infer<typeof WorldAreaNPCSchema>;

export const WorldAreaResourceSchema = z
  .object({
    /**
     * Unique placement id. Optional for backward compat (older
     * placements were keyed by composite `resourceId@x,y,z`); when
     * present the studio prefers it for selection / outliner /
     * gizmo edits, matching `PlacedResource.id`.
     */
    id: z.string().min(1).optional(),
    /** Display name. When absent the studio derives one from `resourceId`. */
    name: z.string().min(1).optional(),
    resourceId: z.string().min(1),
    type: z.string().min(1),
    position: Vec3Schema,
    /**
     * Variant index for resources that ship multiple visual
     * variants (e.g. tree_oak has 3 mesh variants for procgen
     * variety). 0-based; the studio clamps to the available
     * variants for the resolved asset.
     */
    modelVariant: z.number().int().nonnegative().optional(),
    /** Optional asset pack reference; see WorldAreaNPC.assetRef. */
    assetRef: AssetRefSchema.optional(),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaResource = z.infer<typeof WorldAreaResourceSchema>;

export const WorldAreaMobSpawnSchema = z
  .object({
    /**
     * Unique placement id. Optional for backward compat (older
     * placements were keyed by composite `mobId@x,y,z`); when
     * present the studio prefers it for selection / outliner /
     * gizmo edits, matching `PlacedMobSpawn.id`.
     */
    id: z.string().min(1).optional(),
    /** Display name. When absent the studio uses `mobId` as the label. */
    name: z.string().min(1).optional(),
    mobId: z.string().min(1),
    position: Vec3Schema,
    maxCount: z.number().int().positive(),
    spawnRadius: z.number().nonnegative(),
    /**
     * Game ticks (600 ms each) between a kill and the next spawn.
     * Default 50 ticks (~30 s). Used by the runtime spawn manager
     * and surfaced in the studio's GameMobSpawnProperties panel.
     */
    respawnTicks: z.number().int().nonnegative().optional(),
    /** Optional asset pack reference; see WorldAreaNPC.assetRef. */
    assetRef: AssetRefSchema.optional(),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaMobSpawn = z.infer<typeof WorldAreaMobSpawnSchema>;

export const WorldAreaFishingSchema = z.object({
  enabled: z.boolean(),
  spotCount: z.number().int().nonnegative(),
  spotTypes: z.array(z.string().min(1)),
});

export const WorldAreaStationSchema = z
  .object({
    id: z.string().min(1),
    /** Display name. When absent the studio derives one from `type`. */
    name: z.string().min(1).optional(),
    type: z.string().min(1),
    position: Vec3Schema,
    /**
     * Bank id for `type === "bank"` stations. References a bank
     * configuration in the project's banking layer; the studio's
     * GameStationProperties panel exposes the picker.
     */
    bankId: z.string().min(1).optional(),
    /**
     * Rune type for runecrafting altars (`type === "altar"`).
     * Determines which rune the altar produces.
     */
    runeType: z.string().min(1).optional(),
    /** Optional asset pack reference; see WorldAreaNPC.assetRef. */
    assetRef: AssetRefSchema.optional(),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaStation = z.infer<typeof WorldAreaStationSchema>;

/**
 * Teleport node within a world area. Categories:
 *   - `lodestone` — unlocks by visiting; always available afterwards
 *   - `portal` — always available (e.g. ancient portal stones)
 *   - `shortcut` — quest-gated travel point
 *
 * Mirrors the in-tree `TeleportNode` interface in
 * `packages/shared/src/types/world/world-types.ts`. Schema-extension
 * slice (2026-04-24) added this so `TeleportSystem` can read teleport
 * data through `worldAreasRegistry` instead of the in-tree
 * `ALL_WORLD_AREAS` constant.
 */
export const WorldAreaTeleportNodeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    position: Vec3Schema,
    type: z.enum(["lodestone", "portal", "shortcut"]),
    requirements: z
      .object({
        questComplete: z.string().nullable().optional(),
        level: z.number().int().nonnegative().optional(),
        itemId: z.string().min(1).optional(),
      })
      .optional(),
    cost: z.number().nonnegative().optional(),
    /**
     * Bidirectional teleport network — ids of other teleport
     * nodes this one connects to. Empty (or absent) means the
     * teleport is a dead-end (lodestones typically pair with the
     * player's home node; portals + shortcuts often connect to
     * a specific destination).
     */
    connections: z.array(z.string().min(1)).optional(),
    /** Optional asset pack reference; see WorldAreaNPC.assetRef. */
    assetRef: AssetRefSchema.optional(),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaTeleportNode = z.infer<typeof WorldAreaTeleportNodeSchema>;

export const WorldAreaSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    difficultyLevel: z.number().int().nonnegative(),
    bounds: BoundsSchema,
    biomeType: z.string().min(1),
    safeZone: z.boolean(),
    pvpEnabled: z.boolean().optional(),
    npcs: z.array(WorldAreaNPCSchema).optional(),
    resources: z.array(WorldAreaResourceSchema).optional(),
    mobSpawns: z.array(WorldAreaMobSpawnSchema).optional(),
    stations: z.array(WorldAreaStationSchema).optional(),
    fishing: WorldAreaFishingSchema.optional(),
    teleports: z.array(WorldAreaTeleportNodeSchema).optional(),
  })
  .passthrough();
export type WorldArea = z.infer<typeof WorldAreaSchema>;

const WorldAreaRecordSchema = z.record(z.string(), WorldAreaSchema);

export const WorldAreasManifestSchema = z.object({
  starterTowns: WorldAreaRecordSchema,
  level1Areas: WorldAreaRecordSchema,
  level2Areas: WorldAreaRecordSchema,
  level3Areas: WorldAreaRecordSchema,
  specialAreas: WorldAreaRecordSchema,
});
export type WorldAreasManifest = z.infer<typeof WorldAreasManifestSchema>;
