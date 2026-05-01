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
      placeNpc: (npc) => actions.addNPC(worldAreaNpcToPlaced(npc, offset)),
      placeMobSpawn: (spawn) =>
        actions.addMobSpawn(worldAreaMobSpawnToPlaced(spawn, offset)),
      placeResource: (resource) =>
        actions.addResource(worldAreaResourceToPlaced(resource, offset)),
      placeStation: (station) =>
        actions.addStation(worldAreaStationToPlaced(station, offset)),
      placeTeleport: (teleport) =>
        actions.addTeleport(worldAreaTeleportToPlaced(teleport, offset)),
      placeRoad: (road) =>
        actions.addCustomRoad(worldAreaRoadToPlaced(road, offset)),
      placePOI: (poi) => actions.addPOI(worldAreaPOIToPlaced(poi, offset)),
      placeDangerSource: (ds) =>
        actions.addDangerSource(worldAreaDangerSourceToPlaced(ds, offset)),
      worldCenterOffset: offset,
    }),
    [actions, offset],
  );
}
