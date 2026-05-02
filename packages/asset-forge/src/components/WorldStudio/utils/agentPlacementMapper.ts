/**
 * agentPlacementMapper — bidirectional translation between the
 * AI agent's `WorldArea*` schemas (manifest-schema, game-space
 * coordinates) and the studio's `Placed*` interfaces
 * (extendedLayers, scene-space coordinates).
 *
 * P0.1 of `PLAN_AGENT_STUDIO_PARITY.md`. Pure functions, no
 * React, no I/O — deterministic mappers tested in isolation.
 *
 * Coordinate spaces (the trap that's bitten us before):
 *
 *   - GAME-SPACE     coordinates are centered: origin (0,0,0) is
 *                    the WORLD CENTER. Range: -worldSize/2 to
 *                    +worldSize/2 on each axis. This is what
 *                    `world-areas.json` ships and what the agent
 *                    emits. WorldArea*.position is always in
 *                    game-space.
 *
 *   - SCENE-SPACE    coordinates are corner-anchored: origin
 *                    (0,0,0) is the WORLD CORNER. Range: 0 to
 *                    worldSize on each axis. This is what
 *                    `extendedLayers` stores and what Three.js
 *                    raycasts return. Placed*.position is in
 *                    scene-space.
 *
 *   Conversion:      sceneX = gameX + worldCenterOffset
 *                    gameX  = sceneX - worldCenterOffset
 *
 * Field-mapping rules:
 *
 *   - Agent's optional fields (rotation, scale, properties,
 *     source, sourceRegionId) added in P1 land directly on the
 *     Placed* shape with sensible defaults (rotation 0, scale 1,
 *     source defaults to "agent" when mapping in, undefined when
 *     mapping out).
 *
 *   - Type-specific renames are applied at the seam:
 *       * NPC.dialogue (Record<string,string>) ↔ PlacedNPC.dialogId
 *         (single id) — when the agent emits a dialogue map, we
 *         fingerprint it and store the first key as `dialogId`;
 *         the full dialogue map round-trips through `properties`.
 *       * Resource.type ↔ PlacedResource.resourceType — restricted
 *         enum on Placed*; we map common values verbatim and
 *         fall back to "mining" for unknowns to avoid type drift.
 *       * Station.type ↔ PlacedStation.stationType — passthrough.
 *
 *   - parentContext on PlacedNPC defaults to `{ type: "world" }`
 *     for agent-placed entries (no town/building containment).
 *     Designers can re-parent via the studio UI later.
 *
 * The reverse mappers (Placed* → WorldArea*) are used at
 * persistence time when serializing `extendedLayers` back to
 * `worldContent` (the JSON shape stored in the project). They're
 * lossless for everything we put in via the forward mapper.
 */

import type {
  WorldAreaNPC,
  WorldAreaMobSpawn,
  WorldAreaResource,
  WorldAreaStation,
  WorldAreaTeleportNode,
  WorldAreaRoad,
  WorldAreaPOI,
  WorldAreaDangerSource,
  WorldAreaWaterBody,
  WorldAreaMusicZone,
  WorldAreaAmbientZone,
  WorldAreaSFXTrigger,
  WorldAreaMine,
  WorldAreaWildernessBoundary,
} from "@hyperforge/manifest-schema";

import type {
  PlacedDangerSource,
  PlacedMobSpawn,
  PlacedPOI,
  PlacedResource,
  PlacedStation,
  PlacedTeleport,
  PlacedWaterBody,
  MusicZone,
  AmbientZone,
  SFXTrigger,
  PlacedMine,
  WildernessBoundary,
} from "../types";
import type { PlacedNPC, CustomRoad } from "../../WorldBuilder/types";

// ───────────────── Coordinate-space conversions ─────────────────

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Game-space (centered) → scene-space (corner-anchored). */
function gameToScene(p: Vec3, worldCenterOffset: number): Vec3 {
  return {
    x: p.x + worldCenterOffset,
    y: p.y,
    z: p.z + worldCenterOffset,
  };
}

/** Scene-space (corner-anchored) → game-space (centered). */
function sceneToGame(p: Vec3, worldCenterOffset: number): Vec3 {
  return {
    x: p.x - worldCenterOffset,
    y: p.y,
    z: p.z - worldCenterOffset,
  };
}

// ───────────────── Resource-type mapping ─────────────────

/**
 * Map the agent's free-form `resource.type` to PlacedResource's
 * restricted `resourceType` enum. Unknowns fall back to "mining"
 * — losing this info is acceptable because the original value
 * round-trips via `properties.originalType` for the reverse
 * mapper, so persistence doesn't lose data.
 */
const RESOURCE_TYPE_MAP: Record<string, PlacedResource["resourceType"]> = {
  tree: "woodcutting",
  woodcutting: "woodcutting",
  rock: "mining",
  ore: "mining",
  mining: "mining",
  fishing: "fishing",
  "fishing-spot": "fishing",
  fish: "fishing",
  farming: "farming",
};

function mapResourceType(t: string): PlacedResource["resourceType"] {
  return RESOURCE_TYPE_MAP[t] ?? "mining";
}

// ───────────────── Forward mappers (agent → studio) ─────────────────

export function worldAreaNpcToPlaced(
  npc: WorldAreaNPC,
  worldCenterOffset: number,
): PlacedNPC {
  // The agent's `dialogue` is a Record<string,string>; PlacedNPC
  // has a single `dialogId`. Capture the first key as the id and
  // round-trip the whole map through `properties.dialogue` so the
  // reverse mapper can reconstruct it losslessly.
  const dialogueKeys = npc.dialogue ? Object.keys(npc.dialogue) : [];
  const dialogId = dialogueKeys[0];

  const properties: Record<string, unknown> = {
    ...(npc.properties ?? {}),
    ...(npc.assetRef ? { assetRef: npc.assetRef } : {}),
    ...(npc.dialogue ? { dialogue: npc.dialogue } : {}),
    ...(npc.type ? { agentType: npc.type } : {}),
  };

  return {
    id: npc.id,
    npcTypeId: npc.type,
    name: npc.name ?? npc.id,
    position: gameToScene(npc.position, worldCenterOffset),
    rotation: npc.rotation ?? 0,
    parentContext: { type: "world" },
    storeId: npc.storeId,
    dialogId,
    properties,
  };
}

export function worldAreaMobSpawnToPlaced(
  spawn: WorldAreaMobSpawn,
  worldCenterOffset: number,
): PlacedMobSpawn {
  const properties: Record<string, unknown> = {
    ...(spawn.properties ?? {}),
    ...(spawn.assetRef ? { assetRef: spawn.assetRef } : {}),
  };

  return {
    // Spawn schemas didn't have an `id` historically; synthesize
    // a stable composite when absent (matches the key shape the
    // companion has used since the agentWorldContent days).
    id:
      spawn.id ??
      `${spawn.mobId}@${spawn.position.x},${spawn.position.y},${spawn.position.z}`,
    mobId: spawn.mobId,
    name: spawn.name ?? spawn.mobId,
    position: gameToScene(spawn.position, worldCenterOffset),
    spawnRadius: spawn.spawnRadius,
    maxCount: spawn.maxCount,
    respawnTicks: spawn.respawnTicks ?? 50,
    source: (spawn.source ?? "agent") as PlacedMobSpawn["source"],
    sourceRegionId: spawn.sourceRegionId,
    properties,
  };
}

export function worldAreaResourceToPlaced(
  resource: WorldAreaResource,
  worldCenterOffset: number,
): PlacedResource {
  const properties: Record<string, unknown> = {
    ...(resource.properties ?? {}),
    ...(resource.assetRef ? { assetRef: resource.assetRef } : {}),
    // Preserve the agent's free-form `type` for the reverse mapper
    // when it doesn't match the PlacedResource enum.
    originalType: resource.type,
  };

  return {
    id:
      resource.id ??
      `${resource.resourceId}@${resource.position.x},${resource.position.y},${resource.position.z}`,
    resourceId: resource.resourceId,
    resourceType: mapResourceType(resource.type),
    name: resource.name ?? resource.resourceId,
    position: gameToScene(resource.position, worldCenterOffset),
    rotation: resource.rotation ?? 0,
    modelVariant: resource.modelVariant ?? 0,
    source: (resource.source ?? "agent") as PlacedResource["source"],
    sourceRegionId: resource.sourceRegionId,
    properties,
  };
}

export function worldAreaStationToPlaced(
  station: WorldAreaStation,
  worldCenterOffset: number,
): PlacedStation {
  const properties: Record<string, unknown> = {
    ...(station.properties ?? {}),
    ...(station.assetRef ? { assetRef: station.assetRef } : {}),
  };

  return {
    id: station.id,
    stationType: station.type,
    name: station.name ?? station.id,
    position: gameToScene(station.position, worldCenterOffset),
    rotation: station.rotation ?? 0,
    bankId: station.bankId,
    runeType: station.runeType,
    source: (station.source ?? "agent") as PlacedStation["source"],
    sourceRegionId: station.sourceRegionId,
    properties,
  };
}

export function worldAreaTeleportToPlaced(
  teleport: WorldAreaTeleportNode,
  worldCenterOffset: number,
): PlacedTeleport {
  // The agent's `type` enum (lodestone/portal/shortcut) and
  // `requirements` shape don't have first-class fields on
  // PlacedTeleport — they round-trip through `properties` so
  // the reverse mapper can reconstitute them.
  const properties: Record<string, unknown> = {
    ...(teleport.properties ?? {}),
    ...(teleport.assetRef ? { assetRef: teleport.assetRef } : {}),
    teleportType: teleport.type,
  };

  return {
    id: teleport.id,
    name: teleport.name,
    position: gameToScene(teleport.position, worldCenterOffset),
    connections: teleport.connections ?? [],
    requirements: {
      questId: teleport.requirements?.questComplete ?? undefined,
      minLevel: teleport.requirements?.level,
      itemId: teleport.requirements?.itemId,
    },
    cost: teleport.cost ?? 0,
    properties,
  };
}

// ───────────────── Reverse mappers (studio → agent) ─────────────────

export function placedNpcToWorldArea(
  placed: PlacedNPC,
  worldCenterOffset: number,
): WorldAreaNPC {
  // Recover assetRef + dialogue from the properties bag if they
  // were folded in by the forward mapper. Strip them from the
  // round-tripped properties so the agent's schema doesn't
  // double-store.
  const props = { ...(placed.properties ?? {}) };
  const assetRef =
    typeof props.assetRef === "string" ? props.assetRef : undefined;
  const dialogue =
    props.dialogue && typeof props.dialogue === "object"
      ? (props.dialogue as Record<string, string>)
      : undefined;
  const agentType =
    typeof props.agentType === "string" ? props.agentType : undefined;
  delete props.assetRef;
  delete props.dialogue;
  delete props.agentType;

  return {
    id: placed.id,
    type: agentType ?? placed.npcTypeId,
    name: placed.name,
    position: sceneToGame(placed.position, worldCenterOffset),
    rotation: placed.rotation,
    storeId: placed.storeId,
    dialogue,
    assetRef,
    properties: Object.keys(props).length > 0 ? props : undefined,
  };
}

export function placedMobSpawnToWorldArea(
  placed: PlacedMobSpawn,
  worldCenterOffset: number,
): WorldAreaMobSpawn {
  const props = { ...(placed.properties ?? {}) };
  const assetRef =
    typeof props.assetRef === "string" ? props.assetRef : undefined;
  delete props.assetRef;

  return {
    id: placed.id,
    name: placed.name,
    mobId: placed.mobId,
    position: sceneToGame(placed.position, worldCenterOffset),
    maxCount: placed.maxCount,
    spawnRadius: placed.spawnRadius,
    respawnTicks: placed.respawnTicks,
    assetRef,
    source: placed.source as WorldAreaMobSpawn["source"],
    sourceRegionId: placed.sourceRegionId,
    properties: Object.keys(props).length > 0 ? props : undefined,
  };
}

export function placedResourceToWorldArea(
  placed: PlacedResource,
  worldCenterOffset: number,
): WorldAreaResource {
  const props = { ...(placed.properties ?? {}) };
  const assetRef =
    typeof props.assetRef === "string" ? props.assetRef : undefined;
  // Prefer the original (agent) type if it survived; otherwise
  // fall back to the studio's canonical resourceType.
  const originalType =
    typeof props.originalType === "string"
      ? props.originalType
      : placed.resourceType;
  delete props.assetRef;
  delete props.originalType;

  return {
    id: placed.id,
    name: placed.name,
    resourceId: placed.resourceId,
    type: originalType,
    position: sceneToGame(placed.position, worldCenterOffset),
    rotation: placed.rotation,
    modelVariant: placed.modelVariant,
    assetRef,
    source: placed.source as WorldAreaResource["source"],
    sourceRegionId: placed.sourceRegionId,
    properties: Object.keys(props).length > 0 ? props : undefined,
  };
}

export function placedStationToWorldArea(
  placed: PlacedStation,
  worldCenterOffset: number,
): WorldAreaStation {
  const props = { ...(placed.properties ?? {}) };
  const assetRef =
    typeof props.assetRef === "string" ? props.assetRef : undefined;
  delete props.assetRef;

  return {
    id: placed.id,
    name: placed.name,
    type: placed.stationType,
    position: sceneToGame(placed.position, worldCenterOffset),
    rotation: placed.rotation,
    bankId: placed.bankId,
    runeType: placed.runeType,
    assetRef,
    source: placed.source as WorldAreaStation["source"],
    sourceRegionId: placed.sourceRegionId,
    properties: Object.keys(props).length > 0 ? props : undefined,
  };
}

export function placedTeleportToWorldArea(
  placed: PlacedTeleport,
  worldCenterOffset: number,
): WorldAreaTeleportNode {
  const props = { ...(placed.properties ?? {}) };
  const assetRef =
    typeof props.assetRef === "string" ? props.assetRef : undefined;
  // Forward mapper stashed the agent's enum type as
  // `properties.teleportType`; recover it on the way back, default
  // to "lodestone" if missing (safest player-visible fallback).
  const teleportType =
    typeof props.teleportType === "string" &&
    (props.teleportType === "lodestone" ||
      props.teleportType === "portal" ||
      props.teleportType === "shortcut")
      ? (props.teleportType as "lodestone" | "portal" | "shortcut")
      : "lodestone";
  delete props.assetRef;
  delete props.teleportType;

  return {
    id: placed.id,
    name: placed.name,
    type: teleportType,
    position: sceneToGame(placed.position, worldCenterOffset),
    requirements:
      placed.requirements.questId !== undefined ||
      placed.requirements.minLevel !== undefined ||
      placed.requirements.itemId !== undefined
        ? {
            questComplete: placed.requirements.questId,
            level: placed.requirements.minLevel,
            itemId: placed.requirements.itemId,
          }
        : undefined,
    cost: placed.cost,
    connections: placed.connections,
    assetRef,
    properties: Object.keys(props).length > 0 ? props : undefined,
  };
}

// ───────────────── Road ─────────────────
//
// Roads differ from point-placements: they're polylines (a path
// of waypoints, not a single position). Each waypoint converts
// game ↔ scene independently. CustomRoad doesn't have rotation /
// scale / source / sourceRegionId / properties (the studio's
// road shape predates PlacementCommonSchema), so the agent's
// optional metadata round-trips through `name` only — the
// reverse mapper preserves what survived.
//
// CustomRoad = { id, name, path, width }

export function worldAreaRoadToPlaced(
  road: WorldAreaRoad,
  worldCenterOffset: number,
): CustomRoad {
  return {
    id: road.id,
    name: road.name,
    path: road.path.map((p) => gameToScene(p, worldCenterOffset)),
    width: road.width,
  };
}

export function placedCustomRoadToWorldArea(
  road: CustomRoad,
  worldCenterOffset: number,
): WorldAreaRoad {
  return {
    id: road.id,
    name: road.name,
    path: road.path.map((p) => sceneToGame(p, worldCenterOffset)),
    width: road.width,
  };
}

// ───────────────── POI ─────────────────
//
// PlacedPOI matches the agent shape almost 1:1 — same category
// enum, same importance/radius/connectedRoads/entryPoint fields.
// The mapper just translates position game ↔ scene and threads
// the optional fields through. assetRef rides in `properties` for
// round-trip (PlacedPOI doesn't have a top-level assetRef field).

export function worldAreaPOIToPlaced(
  poi: WorldAreaPOI,
  worldCenterOffset: number,
): PlacedPOI {
  const properties: Record<string, unknown> = {
    ...(poi.properties ?? {}),
    ...(poi.assetRef ? { assetRef: poi.assetRef } : {}),
  };
  return {
    id: poi.id,
    name: poi.name,
    category: poi.category,
    position: gameToScene(poi.position, worldCenterOffset),
    importance: poi.importance,
    radius: poi.radius,
    connectedRoads: poi.connectedRoads ?? [],
    entryPoint: poi.entryPoint,
    properties,
  };
}

export function placedPOIToWorldArea(
  placed: PlacedPOI,
  worldCenterOffset: number,
): WorldAreaPOI {
  const props = { ...(placed.properties ?? {}) };
  const assetRef =
    typeof props.assetRef === "string" ? props.assetRef : undefined;
  delete props.assetRef;

  return {
    id: placed.id,
    name: placed.name,
    category: placed.category,
    position: sceneToGame(placed.position, worldCenterOffset),
    importance: placed.importance,
    radius: placed.radius,
    connectedRoads: placed.connectedRoads,
    entryPoint: placed.entryPoint,
    assetRef,
    properties: Object.keys(props).length > 0 ? props : undefined,
  };
}

// ───────────────── Danger source ─────────────────
//
// PlacedDangerSource has no `properties` bag (it's a small, focused
// type). The agent's optional `properties` from PlacementCommonSchema
// has no Placed-side home, so we drop it on the way in (acceptable —
// danger sources are simple gradient anchors, not extensible
// entities). Reverse mapping returns no `properties`.

export function worldAreaDangerSourceToPlaced(
  ds: WorldAreaDangerSource,
  worldCenterOffset: number,
): PlacedDangerSource {
  return {
    id: ds.id,
    name: ds.name,
    position: gameToScene(ds.position, worldCenterOffset),
    radius: ds.radius,
    intensity: ds.intensity,
    falloffCurve: ds.falloffCurve,
    description: ds.description,
  };
}

export function placedDangerSourceToWorldArea(
  placed: PlacedDangerSource,
  worldCenterOffset: number,
): WorldAreaDangerSource {
  return {
    id: placed.id,
    name: placed.name,
    position: sceneToGame(placed.position, worldCenterOffset),
    radius: placed.radius,
    intensity: placed.intensity,
    falloffCurve: placed.falloffCurve,
    description: placed.description,
  };
}

// ───────────────── Water body / audio / mine / wilderness ─────────────────
//
// R4.P8 — agent-side mappers for the polygonal/polyline /
// singleton entity types whose schemas use (x, z) coordinates
// in game-space. We translate (x, z) by the world-center offset
// for scene-space rendering, mirroring the (x, y, z) handling
// for points.

function gameToScene2D(
  p: { x: number; z: number },
  worldCenterOffset: number,
): { x: number; z: number } {
  return { x: p.x + worldCenterOffset, z: p.z + worldCenterOffset };
}

export function worldAreaWaterBodyToPlaced(
  wb: WorldAreaWaterBody,
  worldCenterOffset: number,
): PlacedWaterBody {
  return {
    id: wb.id,
    name: wb.name,
    bodyType: wb.bodyType,
    waypoints: wb.waypoints
      ? wb.waypoints.map((w) => ({
          x: w.x + worldCenterOffset,
          z: w.z + worldCenterOffset,
          halfWidth: w.halfWidth,
          depth: w.depth,
          surfaceY: w.surfaceY,
        }))
      : undefined,
    polygon: wb.polygon
      ? wb.polygon.map((p) => gameToScene2D(p, worldCenterOffset))
      : undefined,
    surfaceY: wb.surfaceY,
    bermWidth: wb.bermWidth,
    valleyMultiplier: wb.valleyMultiplier,
    properties: { ...(wb.properties ?? {}) },
  };
}

export function worldAreaMusicZoneToPlaced(
  z: WorldAreaMusicZone,
  worldCenterOffset: number,
): MusicZone {
  return {
    id: z.id,
    name: z.name,
    trackId: z.trackId,
    combatTrackId: z.combatTrackId,
    polygon: z.polygon.map((p) => gameToScene2D(p, worldCenterOffset)),
    priority: z.priority,
    blendDistance: z.blendDistance,
  };
}

export function worldAreaAmbientZoneToPlaced(
  z: WorldAreaAmbientZone,
  worldCenterOffset: number,
): AmbientZone {
  return {
    id: z.id,
    name: z.name,
    ambientType: z.ambientType,
    tracks: [...z.tracks],
    polygon: z.polygon.map((p) => gameToScene2D(p, worldCenterOffset)),
    volume: z.volume,
    falloffDistance: z.falloffDistance,
  };
}

export function worldAreaSfxTriggerToPlaced(
  t: WorldAreaSFXTrigger,
  worldCenterOffset: number,
): SFXTrigger {
  return {
    id: t.id,
    name: t.name,
    soundPath: t.soundPath,
    position: gameToScene(t.position, worldCenterOffset),
    radius: t.radius,
    volume: t.volume,
    looping: t.looping,
    description: t.description,
  };
}

export function worldAreaMineToPlaced(
  m: WorldAreaMine,
  worldCenterOffset: number,
): PlacedMine {
  return {
    id: m.id,
    name: m.name,
    position: gameToScene(m.position, worldCenterOffset),
    radius: m.radius,
    radialOffsets: m.radialOffsets ??
      // 8 control points at 1.0 = perfectly circular (procgen
      // default when the agent omits the array).
      [1, 1, 1, 1, 1, 1, 1, 1],
    entryAngle: m.entryAngle,
    biome: m.biome,
    tierIndex: m.tierIndex,
    oreRocks: m.oreRocks.map((r) => ({ ...r })),
    source:
      (m as { source?: "agent" | "designer" | "procgen" | "hand-placed" })
        .source ?? "agent",
    properties: {
      ...((m as { properties?: Record<string, unknown> }).properties ?? {}),
    },
  };
}

export function worldAreaWildernessBoundaryToPlaced(
  b: WorldAreaWildernessBoundary,
  worldCenterOffset: number,
): WildernessBoundary {
  return {
    points: b.points.map((p) => gameToScene2D(p, worldCenterOffset)),
    levelScale: b.levelScale,
    maxLevel: b.maxLevel,
  };
}
