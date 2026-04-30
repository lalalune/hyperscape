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
  .passthrough();
export type WorldAreaNPC = z.infer<typeof WorldAreaNPCSchema>;

export const WorldAreaResourceSchema = z.object({
  resourceId: z.string().min(1),
  type: z.string().min(1),
  position: Vec3Schema,
  /** Optional asset pack reference; see WorldAreaNPC.assetRef. */
  assetRef: AssetRefSchema.optional(),
});
export type WorldAreaResource = z.infer<typeof WorldAreaResourceSchema>;

export const WorldAreaMobSpawnSchema = z.object({
  mobId: z.string().min(1),
  position: Vec3Schema,
  maxCount: z.number().int().positive(),
  spawnRadius: z.number().nonnegative(),
  /** Optional asset pack reference; see WorldAreaNPC.assetRef. */
  assetRef: AssetRefSchema.optional(),
});
export type WorldAreaMobSpawn = z.infer<typeof WorldAreaMobSpawnSchema>;

export const WorldAreaFishingSchema = z.object({
  enabled: z.boolean(),
  spotCount: z.number().int().nonnegative(),
  spotTypes: z.array(z.string().min(1)),
});

export const WorldAreaStationSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    position: Vec3Schema,
    /** Optional asset pack reference; see WorldAreaNPC.assetRef. */
    assetRef: AssetRefSchema.optional(),
  })
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
  })
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
