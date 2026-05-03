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
  WorldAreaWaterBody,
  WorldAreaMusicZone,
  WorldAreaAmbientZone,
  WorldAreaSFXTrigger,
  WorldAreaMine,
  WorldAreaWildernessBoundary,
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
  worldAreaWaterBodyToPlaced,
  worldAreaMusicZoneToPlaced,
  worldAreaAmbientZoneToPlaced,
  worldAreaSfxTriggerToPlaced,
  worldAreaMineToPlaced,
  worldAreaWildernessBoundaryToPlaced,
} from "../utils/agentPlacementMapper";
import {
  getTerrainHeightAt,
  getWaterLevel,
  onQuerierReady,
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
>(placed: T, onLateSnap?: (snappedY: number) => void): T {
  const terrainY = getTerrainHeightAt(placed.position.x, placed.position.z);
  if (terrainY !== null) {
    placed.position.y = terrainY;
  } else if (onLateSnap) {
    // Bug #2 — querier not registered yet. Defer the snap. Once
    // a querier registers (when ViewportContainer's scene
    // becomes ready), the callback fires with the snapped y so
    // the caller can dispatch an `update*` action that mutates
    // the reducer state. The placement is added immediately
    // with y=0 and updated to the correct elevation a few
    // frames later — better than leaving it underwater forever.
    const x = placed.position.x;
    const z = placed.position.z;
    onQuerierReady((q) => {
      const y = q.getTerrainHeight(x, z);
      onLateSnap(y);
    });
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
  /** R4.P8 — agent water body placement (river / lake / pond). */
  placeWaterBody: (waterBody: WorldAreaWaterBody) => void;
  /** R4.P8 — agent music zone placement (polygonal). */
  placeMusicZone: (zone: WorldAreaMusicZone) => void;
  /** R4.P8 — agent ambient zone placement (polygonal). */
  placeAmbientZone: (zone: WorldAreaAmbientZone) => void;
  /** R4.P8 — agent SFX trigger placement (point-source). */
  placeSfxTrigger: (trigger: WorldAreaSFXTrigger) => void;
  /** R4.P8 — agent mine area placement. */
  placeMine: (mine: WorldAreaMine) => void;
  /**
   * R4.P8 — set the wilderness boundary (singleton). The
   * boundary is a single polyline; subsequent calls overwrite.
   */
  placeWildernessBoundary: (boundary: WorldAreaWildernessBoundary) => void;
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
      placeNpc: (npc) => {
        const placed = worldAreaNpcToPlaced(npc, offset);
        actions.addNPC(
          snapToTerrain(placed, (snappedY) => {
            actions.updateNPC(placed.id, {
              position: { ...placed.position, y: snappedY },
            });
          }),
        );
      },
      placeMobSpawn: (spawn) => {
        const placed = worldAreaMobSpawnToPlaced(spawn, offset);
        actions.addMobSpawn(
          snapToTerrain(placed, (snappedY) => {
            actions.updateMobSpawn(placed.id, {
              position: { ...placed.position, y: snappedY },
            });
          }),
        );
      },
      placeResource: (resource) => {
        const placed = worldAreaResourceToPlaced(resource, offset);
        actions.addResource(
          snapToTerrain(placed, (snappedY) => {
            actions.updateResource(placed.id, {
              position: { ...placed.position, y: snappedY },
            });
          }),
        );
      },
      placeStation: (station) => {
        const placed = worldAreaStationToPlaced(station, offset);
        actions.addStation(
          snapToTerrain(placed, (snappedY) => {
            actions.updateStation(placed.id, {
              position: { ...placed.position, y: snappedY },
            });
          }),
        );
      },
      placeTeleport: (teleport) => {
        const placed = worldAreaTeleportToPlaced(teleport, offset);
        actions.addTeleport(
          snapToTerrain(placed, (snappedY) => {
            actions.updateTeleport(placed.id, {
              position: { ...placed.position, y: snappedY },
            });
          }),
        );
      },
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
      placePOI: (poi) => {
        const placed = worldAreaPOIToPlaced(poi, offset);
        actions.addPOI(
          snapToTerrain(placed, (snappedY) => {
            actions.updatePOI(placed.id, {
              position: { ...placed.position, y: snappedY },
            });
          }),
        );
      },
      placeDangerSource: (ds) => {
        const placed = worldAreaDangerSourceToPlaced(ds, offset);
        actions.addDangerSource(
          snapToTerrain(placed, (snappedY) => {
            // Danger source uses position object — partial update
            // path mirrors the others.
            actions.updateDangerSource(placed.id, {
              position: { ...placed.position, y: snappedY },
            });
          }),
        );
      },
      placeWaterBody: (waterBody) =>
        actions.addWaterBody(worldAreaWaterBodyToPlaced(waterBody, offset)),
      placeMusicZone: (zone) =>
        actions.addMusicZone(worldAreaMusicZoneToPlaced(zone, offset)),
      placeAmbientZone: (zone) =>
        actions.addAmbientZone(worldAreaAmbientZoneToPlaced(zone, offset)),
      placeSfxTrigger: (trigger) => {
        const placed = worldAreaSfxTriggerToPlaced(trigger, offset);
        actions.addSFXTrigger(
          // Snap point-source SFX to terrain so the trigger
          // sphere doesn't sit underwater on a low-elevation
          // patch when the agent emits y=0.
          snapToTerrain(placed, (snappedY) => {
            actions.updateSFXTrigger(placed.id, {
              position: { ...placed.position, y: snappedY },
            });
          }),
        );
      },
      placeMine: (mine) => {
        const placed = worldAreaMineToPlaced(mine, offset);
        actions.addMine(
          // Snap the mine center to terrain. When the querier
          // isn't ready yet, defer — the new `updateMine`
          // reducer action lets the late-snap callback
          // overwrite the position once the scene comes online.
          snapToTerrain(placed, (snappedY) => {
            actions.updateMine(placed.id, {
              position: { ...placed.position, y: snappedY },
            });
          }),
        );
      },
      placeWildernessBoundary: (boundary) => {
        // Wilderness boundary is a polyline — each {x, z} point
        // sits on the terrain edge. The points carry no y today
        // (it's a 2D polyline rendered at terrain height per
        // segment), so this dispatcher just forwards the
        // shape; the renderer samples terrain height per vertex
        // when drawing the boundary line. No snap needed at
        // this layer.
        actions.setWildernessBoundary(
          worldAreaWildernessBoundaryToPlaced(boundary, offset),
        );
      },
      isOnLand,
      worldCenterOffset: offset,
    }),
    [actions, offset],
  );
}
