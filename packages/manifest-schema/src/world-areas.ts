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
/**
 * Danger source — a placeable point that increases local difficulty
 * beyond the biome's default scalar.
 *
 * P5.b of `PLAN_AGENT_STUDIO_PARITY.md`. Maps to the studio's
 * `PlacedDangerSource` shape. Used for procgen difficulty hooks
 * ("this region is more dangerous than the biome alone implies"
 * — a corrupted shrine deep in a Forest biome bumps mob levels
 * + spawn density nearby).
 *
 * Fields:
 *   id           — unique id
 *   name         — display name ("Cursed Grove")
 *   position     — game-space coords
 *   radius       — radius of influence in meters; positive
 *   intensity    — 0-3, added to the biome's difficulty scalar
 *                  at the danger center; falls off with distance
 *   falloffCurve — how quickly intensity falls off (higher =
 *                  sharper edge); default 1
 *
 * Optional:
 *   description  — tooltip / lore text
 */
export const WorldAreaDangerSourceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    position: Vec3Schema,
    radius: z.number().positive(),
    intensity: z.number().min(0).max(3),
    falloffCurve: z.number().positive(),
    description: z.string().optional(),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaDangerSource = z.infer<typeof WorldAreaDangerSourceSchema>;

/**
 * Point of Interest — a named landmark with a radius, importance
 * weight, and optional road connectivity.
 *
 * P5.a of `PLAN_AGENT_STUDIO_PARITY.md`. Maps to the studio's
 * `PlacedPOI` shape (which already exists in extendedLayers and
 * has full property-panel + outliner integration). The category
 * enum mirrors the studio's exactly so the mapper is a 1:1 field
 * pass-through.
 *
 * Fields:
 *   id          — unique POI id
 *   name        — display name ("Whispering Cave")
 *   category    — fixed enum: "dungeon" | "shrine" | "landmark" |
 *                 "resource_area" | "ruin" | "camp" | "crossing" |
 *                 "waystation" | "fishing_spot"
 *   position    — game-space coords
 *   importance  — 0-1, higher = more road connectivity in procgen
 *   radius      — POI area radius in meters; positive
 *
 * Optional:
 *   connectedRoads — ids of roads that terminate at / pass through
 *                    this POI (so the agent can wire roads + POIs
 *                    together coherently in one PROPOSE chain)
 *   entryPoint     — { x, z, angle } where visitors should enter
 *   assetRef       — pack ref for the POI's anchor model
 */
export const WorldAreaPOISchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: z.enum([
      "dungeon",
      "shrine",
      "landmark",
      "resource_area",
      "ruin",
      "camp",
      "crossing",
      "waystation",
      "fishing_spot",
    ]),
    position: Vec3Schema,
    importance: z.number().min(0).max(1),
    radius: z.number().positive(),
    connectedRoads: z.array(z.string().min(1)).optional(),
    entryPoint: z
      .object({
        x: z.number(),
        z: z.number(),
        angle: z.number(),
      })
      .optional(),
    /** Optional asset pack reference; see WorldAreaNPC.assetRef. */
    assetRef: AssetRefSchema.optional(),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaPOI = z.infer<typeof WorldAreaPOISchema>;

/**
 * Road / path placed by the agent or designer. Connects two
 * points (or, for multi-segment roads, runs through a sequence of
 * waypoints). The studio renders these as ribbons on the terrain
 * mesh; the runtime uses them for navmesh hints + mob patrol
 * paths + travel UX.
 *
 * P2 of `PLAN_AGENT_STUDIO_PARITY.md`. Maps to `CustomRoad` in
 * the studio (which is itself a parallel slot to the procgen-
 * generated `GeneratedRoad`, both rendered together).
 *
 * Position semantics: each `path` waypoint is in game-space
 * (centered, agent's convention). The mapper translates to
 * scene-space when persisting into `world.layers.customRoads`.
 *
 * Fields:
 *   id        — unique road id
 *   name      — display name ("Northern Trade Road")
 *   path      — array of {x,y,z} waypoints; minimum 2 points
 *   width     — road width in meters; positive number
 *   assetRef  — optional pack ref for the road texture/material
 */
export const WorldAreaRoadSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    path: z.array(Vec3Schema).min(2),
    width: z.number().positive(),
    /** Optional asset pack reference; see WorldAreaNPC.assetRef. */
    assetRef: AssetRefSchema.optional(),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaRoad = z.infer<typeof WorldAreaRoadSchema>;

/**
 * R4.P8 of `PLAN_HYPERIA_DECOUPLING.md` — agent-placeable water
 * body (river / lake / pond). Studio's extendedLayers + marker
 * rendering already support this slot; this schema lets the
 * agent's `PROPOSE_WATER_BODY` action validate input.
 *
 *   bodyType  — river (waypoint chain) / lake (polygon) / pond (single point)
 *   id        — unique water body id
 *   name      — display name ("Misty River", "Eternal Lake")
 *   waypoints — for rivers: ordered (x,z,halfWidth,depth) waypoints, min 2
 *   polygon   — for lakes / ponds: closed polygon of (x,z) points, min 3
 *   surfaceY  — water surface elevation (game-space y)
 *   bermWidth — for rivers: width of the embankment beyond the waterway
 */
export const RiverWaypointSchema = z.object({
  x: z.number(),
  z: z.number(),
  halfWidth: z.number().positive(),
  depth: z.number().positive(),
  surfaceY: z.number().optional(),
});
export type RiverWaypoint = z.infer<typeof RiverWaypointSchema>;

export const WaterPolygonPointSchema = z.object({
  x: z.number(),
  z: z.number(),
});
export type WaterPolygonPoint = z.infer<typeof WaterPolygonPointSchema>;

export const WorldAreaWaterBodySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    bodyType: z.enum(["river", "lake", "pond"]),
    /** River shape — ordered waypoints. Required when bodyType === "river". */
    waypoints: z.array(RiverWaypointSchema).min(2).optional(),
    /** Lake / pond shape — closed polygon. Required when bodyType !== "river". */
    polygon: z.array(WaterPolygonPointSchema).min(3).optional(),
    /** Water surface elevation in game-space y. */
    surfaceY: z.number().optional(),
    /** River-only: width of the embankment band on each side. */
    bermWidth: z.number().positive().optional(),
    /** River-only: valley-depth multiplier for the surrounding terrain. */
    valleyMultiplier: z.number().positive().optional(),
    /** Optional asset pack reference; see WorldAreaNPC.assetRef. */
    assetRef: AssetRefSchema.optional(),
  })
  .merge(PlacementCommonSchema)
  .passthrough()
  .refine(
    (v) =>
      v.bodyType === "river"
        ? Array.isArray(v.waypoints) && v.waypoints.length >= 2
        : Array.isArray(v.polygon) && v.polygon.length >= 3,
    {
      message:
        "WaterBody shape mismatch: river requires `waypoints` (>= 2); lake / pond require `polygon` (>= 3).",
    },
  );
export type WorldAreaWaterBody = z.infer<typeof WorldAreaWaterBodySchema>;

/**
 * R4.P8 — agent-placeable audio surfaces. Studio's audioLayers
 * (musicZones / ambientZones / sfxTriggers) supports these
 * already; the schemas let the agent's PROPOSE_MUSIC_ZONE /
 * PROPOSE_AMBIENT_ZONE / PROPOSE_SFX_TRIGGER actions validate
 * input.
 *
 * MusicZone — polygonal area, plays a music track (with
 * optional combat-override) while the player is inside.
 * Higher `priority` wins on zone overlap; `blendDistance`
 * cross-fades at edges.
 */
export const WorldAreaMusicZoneSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    /** Track id from the active music manifest. */
    trackId: z.string().min(1),
    /** Optional override that plays while the player is in
     * combat inside this zone. */
    combatTrackId: z.string().min(1).optional(),
    /** Closed polygon in world (x, z) coords. */
    polygon: z.array(WaterPolygonPointSchema).min(3),
    /** Higher = wins zone-overlap resolution. */
    priority: z.number().int().nonnegative().default(0),
    /** Cross-fade distance at zone edges in meters. */
    blendDistance: z.number().nonnegative().default(8),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaMusicZone = z.infer<typeof WorldAreaMusicZoneSchema>;

/**
 * AmbientZone — polygonal area that layers an environmental
 * loop (wind, surf, cave drips, marketplace bustle). One or
 * more `tracks` play simultaneously; `volume` + `falloffDistance`
 * shape the spatial mix.
 */
export const WorldAreaAmbientZoneSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    /** Themed bucket — used for stacking + UI categorization. */
    ambientType: z.enum([
      "forest",
      "cave",
      "ocean",
      "town",
      "desert",
      "mountain",
      "swamp",
      "custom",
    ]),
    /** Sound asset paths to layer (typically 1-3). */
    tracks: z.array(z.string().min(1)).min(1),
    /** Closed polygon in world (x, z) coords. */
    polygon: z.array(WaterPolygonPointSchema).min(3),
    /** Mix gain (0..1). */
    volume: z.number().min(0).max(1).default(0.5),
    /** Edge falloff in meters. */
    falloffDistance: z.number().nonnegative().default(8),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaAmbientZone = z.infer<typeof WorldAreaAmbientZoneSchema>;

/**
 * SFXTrigger — point-source ambient sound (creaking sign, dripping
 * fountain, distant thunder). Plays while the player is within
 * `radius` meters of `position`.
 */
export const WorldAreaSFXTriggerSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    soundPath: z.string().min(1),
    position: Vec3Schema,
    /** Audible radius in meters. */
    radius: z.number().positive(),
    /** Playback volume (0..1). */
    volume: z.number().min(0).max(1).default(0.7),
    /** Whether the sound loops while the player is in range. */
    looping: z.boolean().default(true),
    /** Optional human-readable description (used by AI auto-pick). */
    description: z.string().optional(),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaSFXTrigger = z.infer<typeof WorldAreaSFXTriggerSchema>;

/**
 * R4.P8 — agent-placeable mine area. Studio's auto-gen
 * pipeline already produces `PlacedMine` entries for the
 * `mines` slot; this schema lets the agent author specific
 * mines (e.g. "place an iron mine in the canyon biome").
 *
 *   id            — unique mine id
 *   name          — display name ("Iron Outcrop")
 *   position      — game-space (x, y, z) center
 *   radius        — base mine area radius in meters (15-25 typical)
 *   radialOffsets — 8 control points for organic shape (0.82-1.18)
 *   entryAngle    — entry direction angle (radians) — rocks form a C
 *                   on the opposite side
 *   biome         — biome id at the mine center
 *   tierIndex     — difficulty tier (0 = starter, higher = harder)
 *   oreRocks      — ore breakdown (resource id + rock count)
 */
export const WorldAreaMineSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    position: Vec3Schema,
    radius: z.number().positive(),
    radialOffsets: z.array(z.number()).optional(),
    entryAngle: z.number().default(0),
    biome: z.string().min(1),
    tierIndex: z.number().int().nonnegative().default(0),
    oreRocks: z.array(
      z.object({
        resourceId: z.string().min(1),
        count: z.number().int().nonnegative(),
      }),
    ),
    /** Optional asset pack reference; see WorldAreaNPC.assetRef. */
    assetRef: AssetRefSchema.optional(),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaMine = z.infer<typeof WorldAreaMineSchema>;

/**
 * R4.P8 — agent-placeable wilderness boundary. Marks the line
 * where PvP unlocks; distance north of the line scales the
 * wilderness level.
 *
 *   points     — east-west polyline (x, z) waypoints (>= 2)
 *   levelScale — meters north of the line per +1 wilderness level
 *   maxLevel   — clamp on the wilderness level scale
 */
export const WorldAreaWildernessBoundarySchema = z
  .object({
    /** Singleton id; today only one boundary is supported per
     * project. Kept on the schema so a future "multi-zone PvP
     * boundary" surface stays additive. */
    id: z.string().min(1).default("wilderness"),
    points: z.array(WaterPolygonPointSchema).min(2),
    levelScale: z.number().positive(),
    maxLevel: z.number().int().positive(),
  })
  .merge(PlacementCommonSchema)
  .passthrough();
export type WorldAreaWildernessBoundary = z.infer<
  typeof WorldAreaWildernessBoundarySchema
>;

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
