/**
 * rehydrateExtendedLayersFromWorldContent — load-path counterpart
 * to `useAgentPlacementDispatcher`.
 *
 * P0.6 of `PLAN_AGENT_STUDIO_PARITY.md`. When a project loads,
 * its persisted `worldContent` JSON (game-space, agent-shape) is
 * mapped through the P0.1 forward mappers and dispatched into
 * `extendedLayers` via the existing reducer actions. Result:
 * agent-authored content from prior sessions becomes
 * indistinguishable from designer-placed content — same render
 * path, same property panels, same gizmo, same outliner.
 *
 * Replaces the legacy `rehydrateAgentWorldContentFromProject`
 * for the five placement kinds (NPC / MobSpawn / Resource /
 * Station / Teleport). Quests + zones still flow through the
 * legacy path because they don't have a Placed* counterpart yet
 * (will migrate in P0.7+).
 *
 * Pure-function-of-the-actions-surface — tested via the actions
 * stub. No React, no I/O, no side-effects beyond dispatching.
 */

import {
  WorldAreaMobSpawnSchema,
  WorldAreaNPCSchema,
  WorldAreaResourceSchema,
  WorldAreaStationSchema,
  WorldAreaTeleportNodeSchema,
} from "@hyperforge/manifest-schema";

import {
  worldAreaMobSpawnToPlaced,
  worldAreaNpcToPlaced,
  worldAreaResourceToPlaced,
  worldAreaStationToPlaced,
  worldAreaTeleportToPlaced,
} from "./agentPlacementMapper";

import type {
  PlacedMobSpawn,
  PlacedResource,
  PlacedStation,
  PlacedTeleport,
} from "../types";
import type { PlacedNPC } from "../../WorldBuilder/types";

/**
 * Subset of the WorldStudio `actions` surface this rehydrator
 * needs. Decoupled from the full type so the function can be
 * unit-tested with a minimal stub instead of a full provider.
 */
export interface RehydrateActions {
  addNPC: (npc: PlacedNPC) => void;
  addMobSpawn: (mobSpawn: PlacedMobSpawn) => void;
  addResource: (resource: PlacedResource) => void;
  addStation: (station: PlacedStation) => void;
  addTeleport: (teleport: PlacedTeleport) => void;
}

export interface RehydrateCounts {
  readonly npcs: number;
  readonly spawns: number;
  readonly resources: number;
  readonly stations: number;
  readonly teleports: number;
  readonly dropped: number;
}

/**
 * Walk every placement kind in the project's worldContent JSON,
 * validate each entry against its WorldArea* schema, map to the
 * Placed* shape, and dispatch via the actions surface. Returns
 * counts so the caller can log "rehydrated N agent placements"
 * and surface a warning if any entries dropped on validation.
 *
 * Malformed entries are dropped silently (a partially-corrupt
 * worldContent shouldn't block the rest from loading) but
 * counted via `dropped` so the caller can warn.
 */
export function rehydrateExtendedLayersFromWorldContent(
  worldContent: Record<string, unknown> | null | undefined,
  actions: RehydrateActions,
  worldCenterOffset: number,
): RehydrateCounts {
  const wc = worldContent ?? {};
  let npcs = 0;
  let spawns = 0;
  let resources = 0;
  let stations = 0;
  let teleports = 0;
  let dropped = 0;

  if (Array.isArray(wc.npcs)) {
    for (const raw of wc.npcs as unknown[]) {
      const r = WorldAreaNPCSchema.safeParse(raw);
      if (r.success) {
        actions.addNPC(worldAreaNpcToPlaced(r.data, worldCenterOffset));
        npcs++;
      } else {
        dropped++;
      }
    }
  }

  if (Array.isArray(wc.spawns)) {
    for (const raw of wc.spawns as unknown[]) {
      const r = WorldAreaMobSpawnSchema.safeParse(raw);
      if (r.success) {
        actions.addMobSpawn(
          worldAreaMobSpawnToPlaced(r.data, worldCenterOffset),
        );
        spawns++;
      } else {
        dropped++;
      }
    }
  }

  if (Array.isArray(wc.resources)) {
    for (const raw of wc.resources as unknown[]) {
      const r = WorldAreaResourceSchema.safeParse(raw);
      if (r.success) {
        actions.addResource(
          worldAreaResourceToPlaced(r.data, worldCenterOffset),
        );
        resources++;
      } else {
        dropped++;
      }
    }
  }

  if (Array.isArray(wc.stations)) {
    for (const raw of wc.stations as unknown[]) {
      const r = WorldAreaStationSchema.safeParse(raw);
      if (r.success) {
        actions.addStation(worldAreaStationToPlaced(r.data, worldCenterOffset));
        stations++;
      } else {
        dropped++;
      }
    }
  }

  if (Array.isArray(wc.teleports)) {
    for (const raw of wc.teleports as unknown[]) {
      const r = WorldAreaTeleportNodeSchema.safeParse(raw);
      if (r.success) {
        actions.addTeleport(
          worldAreaTeleportToPlaced(r.data, worldCenterOffset),
        );
        teleports++;
      } else {
        dropped++;
      }
    }
  }

  return { npcs, spawns, resources, stations, teleports, dropped };
}
