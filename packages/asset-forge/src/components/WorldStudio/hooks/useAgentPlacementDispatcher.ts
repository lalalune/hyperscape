/**
 * useAgentPlacementDispatcher — single seam for translating
 * agent-emitted `WorldArea*` placements into studio
 * `extendedLayers` entries.
 *
 * P0.2 of `PLAN_AGENT_STUDIO_PARITY.md`. Replaces the old
 * `setAndPersistAgentX` path (which wrote to a parallel
 * `agentWorldContent` store) with a thin layer that:
 *
 *   1. Reads `worldCenterOffset` from the studio state (derived
 *      from the active project's terrain config).
 *   2. Maps the agent's payload through the bidirectional
 *      mapper from `agentPlacementMapper.ts` (game-space →
 *      scene-space + field translation + assetRef passthrough).
 *   3. Dispatches via the existing studio action creators
 *      (`actions.addNPC`, `addMobSpawn`, `addResource`,
 *      `addStation`, `addTeleport`).
 *
 * Net effect: agent placements land in `state.extendedLayers`
 * alongside designer + procgen entries. The gizmo, properties
 * panel, outliner, undo/redo, and brush systems all "just work"
 * because there's nothing new to wire — they're all subscribed
 * to extendedLayers already.
 *
 * Coordinate-space note: the agent emits in GAME-SPACE
 * (centered, origin = world center). extendedLayers stores in
 * SCENE-SPACE (corner-anchored). The mapper handles the offset.
 * See `agentPlacementMapper.ts` for the full convention.
 */

import { useMemo } from "react";

import type {
  WorldAreaDangerSource,
  WorldAreaMobSpawn,
  WorldAreaNPC,
  WorldAreaPOI,
  WorldAreaResource,
  WorldAreaRoad,
  WorldAreaStation,
  WorldAreaTeleportNode,
} from "@hyperforge/manifest-schema";
import type { WorldData } from "../../WorldBuilder/types";

import { useWorldStudio } from "../WorldStudioContext";
import {
  worldAreaDangerSourceToPlaced,
  worldAreaMobSpawnToPlaced,
  worldAreaNpcToPlaced,
  worldAreaPOIToPlaced,
  worldAreaResourceToPlaced,
  worldAreaRoadToPlaced,
  worldAreaStationToPlaced,
  worldAreaTeleportToPlaced,
} from "../utils/agentPlacementMapper";
import {
  getTerrainHeightAt,
  getWaterLevel,
} from "../utils/terrainQueryRegistry";

/**
 * Snap a Placed entity's position.y onto the terrain mesh.
 *
 * The agent typically emits y=0 (it has no terrain knowledge).
 * Without this, NPCs/mobs/etc. stay at y=0 — which is below
 * terrain on hills/mountains AND in ocean for low-elevation
 * terrain. Result: visible "trees floating in water" failure
 * mode the user reported.
 *
 * We sample the actual terrain mesh (via the registered
 * querier) at the placement's (x, z) and overwrite y. When no
 * querier is registered yet (project not loaded, scene not
 * ready), we leave y untouched.
 *
 * Returns the placed entity (mutated in place — caller already
 * holds the only reference, no aliasing concern).
 */
function snapToTerrain<
  T extends { position: { x: number; y: number; z: number } },
>(placed: T): T {
  const terrainY = getTerrainHeightAt(placed.position.x, placed.position.z);
  if (terrainY !== null) {
    placed.position.y = terrainY;
  }
  return placed;
}

/**
 * Returns true if the (x, z) position is on land — terrain
 * height at the point is at or above water level. Returns true
 * (do nothing) when no querier is registered (graceful
 * degradation; agent can still place during onboarding before
 * the scene's ready).
 */
function isOnLand(x: number, z: number): boolean {
  const terrainY = getTerrainHeightAt(x, z);
  const waterLevel = getWaterLevel();
  if (terrainY === null || waterLevel === null) return true;
  return terrainY >= waterLevel;
}

/**
 * Pure-function derivation: world ↦ world-center offset. Exposed
 * so unit tests can verify the formula without spinning up a
 * React tree. `useWorldCenterOffset` is a thin wrapper around
 * this that subscribes to the studio state.
 *
 * Returns 0 when the world isn't generated yet — placements made
 * before generation still flow into extendedLayers; their game-
 * space coords are treated as scene-space until a world exists.
 * Once the world generates, subsequent placements get the right
 * offset; older entries stay in their pre-generation positions
 * (which is the same behavior as designer-placed entries).
 */
export function computeWorldCenterOffset(world: WorldData | null): number {
  const terrain = world?.foundation?.config?.terrain;
  if (!terrain) return 0;
  return (terrain.worldSize * terrain.tileSize) / 2;
}

export function useWorldCenterOffset(): number {
  const { state } = useWorldStudio();
  return computeWorldCenterOffset(state.builder.editing.world);
}

export interface AgentPlacementDispatcher {
  placeNpc: (npc: WorldAreaNPC) => void;
  placeMobSpawn: (spawn: WorldAreaMobSpawn) => void;
  placeResource: (resource: WorldAreaResource) => void;
  placeStation: (station: WorldAreaStation) => void;
  placeTeleport: (teleport: WorldAreaTeleportNode) => void;
  /**
   * P2.a — agent road placement. Lands in
   * `world.layers.customRoads` via `actions.addCustomRoad`,
   * rendered alongside the procgen-generated foundation roads.
   */
  placeRoad: (road: WorldAreaRoad) => void;
  /**
   * P5.a — agent POI placement (dungeon / shrine / landmark / etc.).
   * Lands in `extendedLayers.pois` via `actions.addPOI`.
   */
  placePOI: (poi: WorldAreaPOI) => void;
  /**
   * P5.b — agent danger source placement. Increases local
   * difficulty beyond biome defaults; feeds procgen's mob-level
   * + spawn-density shaping.
   */
  placeDangerSource: (ds: WorldAreaDangerSource) => void;
  /**
   * Returns true if the (x, z) point is on land — terrain height
   * at the point is at or above water level. Returns true when
   * no querier is registered (graceful degradation; before
   * scene-ready or in onboarding-mode tests).
   *
   * Coordinates are SCENE-space (already offset). To check a
   * game-space coord, add `worldCenterOffset` first.
   */
  isOnLand: (sceneX: number, sceneZ: number) => boolean;
  /**
   * The offset used by all the placement functions in this
   * dispatcher. Exposed so callers (companion / dialog) can
   * surface a useful diagnostic when the offset is 0 (i.e. the
   * project's terrain hasn't been generated yet — agent
   * emissions still land in extendedLayers but their game-space
   * coords are treated as scene-space until a world exists).
   */
  worldCenterOffset: number;
}

export function useAgentPlacementDispatcher(): AgentPlacementDispatcher {
  const { actions } = useWorldStudio();
  const offset = useWorldCenterOffset();

  return useMemo<AgentPlacementDispatcher>(
    () => ({
      placeNpc: (npc) =>
        actions.addNPC(snapToTerrain(worldAreaNpcToPlaced(npc, offset))),
      placeMobSpawn: (spawn) =>
        actions.addMobSpawn(
          snapToTerrain(worldAreaMobSpawnToPlaced(spawn, offset)),
        ),
      placeResource: (resource) =>
        actions.addResource(
          snapToTerrain(worldAreaResourceToPlaced(resource, offset)),
        ),
      placeStation: (station) =>
        actions.addStation(
          snapToTerrain(worldAreaStationToPlaced(station, offset)),
        ),
      placeTeleport: (teleport) =>
        actions.addTeleport(
          snapToTerrain(worldAreaTeleportToPlaced(teleport, offset)),
        ),
      placeRoad: (road) => {
        // Snap each waypoint independently so the road follows
        // terrain elevation across hills + valleys instead of
        // sitting at y=0 underwater.
        const placed = worldAreaRoadToPlaced(road, offset);
        for (const wp of placed.path) {
          const ty = getTerrainHeightAt(wp.x, wp.z);
          if (ty !== null) wp.y = ty;
        }
        actions.addCustomRoad(placed);
      },
      placePOI: (poi) =>
        actions.addPOI(snapToTerrain(worldAreaPOIToPlaced(poi, offset))),
      placeDangerSource: (ds) =>
        actions.addDangerSource(
          snapToTerrain(worldAreaDangerSourceToPlaced(ds, offset)),
        ),
      isOnLand,
      worldCenterOffset: offset,
    }),
    [actions, offset],
  );
}
