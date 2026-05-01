/**
 * buildTerrainSummary — distill the project's generated world
 * foundation into a compact JSON payload for the agent's
 * `projectContext.terrainSummary` field.
 *
 * Companion calls this every turn so the agent knows where land
 * is, where biome centers are, and where towns sit. Without
 * this, the agent picks raw (x, y, z) coords and routinely lands
 * placements in the ocean (the user-reported failure mode that
 * motivated this slice).
 *
 * Output is compact (<2K tokens for a default 50×50 world with
 * 16 biomes + 4 towns) so it can ride on every chat turn without
 * blowing the context window.
 *
 * Coordinates are in game-space (centered, agent's convention).
 * Studio's foundation stores biome centers and town positions in
 * scene-space; this helper subtracts `worldCenterOffset` to get
 * the agent-friendly form.
 */

import type { WorldData } from "../../WorldBuilder/types";
import { computeWorldCenterOffset } from "../hooks/useAgentPlacementDispatcher";

export interface TerrainSummary {
  worldSize: number;
  tileSize: number;
  worldExtent: number;
  biomes: Array<{
    id: string;
    type: string;
    center: { x: number; z: number };
    influenceRadius: number;
  }>;
  towns: Array<{
    id: string;
    name: string;
    position: { x: number; z: number };
    safeZoneRadius: number;
  }>;
}

/**
 * Returns null when no world is generated yet (the agent doesn't
 * have terrain to reason about, just emit PROPOSE_TERRAIN_CONFIG
 * first).
 */
export function buildTerrainSummary(
  world: WorldData | null | undefined,
): TerrainSummary | null {
  if (!world?.foundation?.config?.terrain) return null;

  const { worldSize, tileSize } = world.foundation.config.terrain;
  const offset = computeWorldCenterOffset(world);
  const worldExtent = (worldSize * tileSize) / 2;

  const biomes = world.foundation.biomes.map((b) => ({
    id: b.id,
    type: b.type,
    center: {
      x: b.center.x - offset,
      z: b.center.z - offset,
    },
    influenceRadius: b.influenceRadius,
  }));

  const towns = world.foundation.towns.map((t) => ({
    id: t.id,
    name: t.name,
    position: {
      x: t.position.x - offset,
      z: t.position.z - offset,
    },
    safeZoneRadius: t.safeZoneRadius ?? 50,
  }));

  return {
    worldSize,
    tileSize,
    worldExtent,
    biomes,
    towns,
  };
}
