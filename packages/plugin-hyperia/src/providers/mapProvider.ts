/**
 * mapProvider - Provides world map knowledge to the agent
 *
 * Gives the LLM context about all towns, POIs, distances from the player,
 * and cardinal direction summaries so it can reason about where to explore.
 *
 * Also populates KNOWN_LOCATIONS dynamically from world map data.
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperiaService } from "../services/HyperiaService.js";
import {
  getWorldMapSignature,
  populateKnownLocationsFromWorldMap,
} from "./goalProvider.js";

const MAP_PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_MAP_PROVIDER_CACHE_ENTRIES = 128;

/** Calculate 2D distance between player and a world position */
function dist2D(px: number, pz: number, tx: number, tz: number): number {
  return Math.sqrt((tx - px) ** 2 + (tz - pz) ** 2);
}

/** Get a compass direction label from player to target */
function getDirection(px: number, pz: number, tx: number, tz: number): string {
  const dx = tx - px;
  const dz = tz - pz;
  const angle = Math.atan2(dz, dx) * (180 / Math.PI);

  if (angle >= -22.5 && angle < 22.5) return "east";
  if (angle >= 22.5 && angle < 67.5) return "southeast";
  if (angle >= 67.5 && angle < 112.5) return "south";
  if (angle >= 112.5 && angle < 157.5) return "southwest";
  if (angle >= 157.5 || angle < -157.5) return "west";
  if (angle >= -157.5 && angle < -112.5) return "northwest";
  if (angle >= -112.5 && angle < -67.5) return "north";
  return "northeast";
}

interface CachedMapProviderResult {
  expiresAt: number;
  playerPositionKey: string;
  result: ProviderResult;
  worldMapSignature: string;
}

const mapProviderCache = new Map<string, CachedMapProviderResult>();
let lastWorldMapSignature: string | null = null;

export function clearMapProviderCache(agentId?: string): void {
  if (agentId) {
    mapProviderCache.delete(agentId);
    if (mapProviderCache.size === 0) {
      lastWorldMapSignature = null;
    }
    return;
  }

  mapProviderCache.clear();
  lastWorldMapSignature = null;
}

function pruneMapProviderCache(now: number): void {
  for (const [agentId, cached] of mapProviderCache) {
    if (cached.expiresAt <= now) {
      mapProviderCache.delete(agentId);
    }
  }

  while (mapProviderCache.size > MAX_MAP_PROVIDER_CACHE_ENTRIES) {
    const oldestAgentId = mapProviderCache.keys().next().value;
    if (!oldestAgentId) {
      break;
    }
    mapProviderCache.delete(oldestAgentId);
  }
}

function getPlayerPositionXZ(playerPosition: unknown): {
  x: number;
  z: number;
} {
  if (Array.isArray(playerPosition) && playerPosition.length >= 3) {
    return { x: playerPosition[0], z: playerPosition[2] };
  }
  if (
    playerPosition &&
    typeof playerPosition === "object" &&
    "x" in playerPosition &&
    "z" in playerPosition
  ) {
    const pos = playerPosition as { x: number; z: number };
    return { x: pos.x, z: pos.z };
  }
  return { x: 0, z: 0 };
}

function getPlayerPositionKey(playerPosition: unknown): string {
  const { x, z } = getPlayerPositionXZ(playerPosition);
  return `${x.toFixed(2)}:${z.toFixed(2)}`;
}

export const mapProvider: Provider = {
  name: "worldMap",
  description:
    "Provides world map knowledge: towns, POIs, distances, and compass directions for navigation",
  dynamic: true,
  position: 1, // Run after goalProvider

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) {
      clearMapProviderCache(runtime.agentId);
      return { text: "", values: {}, data: {} };
    }

    const worldMap = service.getWorldMap();
    if (
      !worldMap ||
      (worldMap.towns.length === 0 && worldMap.pois.length === 0)
    ) {
      clearMapProviderCache(runtime.agentId);
      return {
        text: "## World Map\nNo map data available yet.",
        values: { hasWorldMap: false },
        data: {},
      };
    }

    const now = Date.now();
    pruneMapProviderCache(now);
    const player = service.getPlayerEntity();
    const playerPositionKey = getPlayerPositionKey(player?.position);
    const worldMapSignature =
      service.getWorldMapSignature?.() ?? getWorldMapSignature(worldMap);

    if (lastWorldMapSignature !== worldMapSignature) {
      populateKnownLocationsFromWorldMap(worldMap);
      lastWorldMapSignature = worldMapSignature;
      logger.info(
        `[mapProvider] Populated KNOWN_LOCATIONS with ${worldMap.towns.length} towns and ${worldMap.pois.length} POIs`,
      );
    }

    const cached = mapProviderCache.get(runtime.agentId);
    if (
      cached &&
      cached.expiresAt > now &&
      cached.playerPositionKey === playerPositionKey &&
      cached.worldMapSignature === worldMapSignature
    ) {
      cached.expiresAt = now + MAP_PROVIDER_CACHE_TTL_MS;
      mapProviderCache.delete(runtime.agentId);
      mapProviderCache.set(runtime.agentId, cached);
      return cached.result;
    }

    if (cached && cached.expiresAt <= now) {
      mapProviderCache.delete(runtime.agentId);
    }

    const { x: px, z: pz } = getPlayerPositionXZ(player?.position);

    // Format towns sorted by distance
    const townEntries = worldMap.towns
      .map((t) => ({
        ...t,
        distance: dist2D(px, pz, t.position.x, t.position.z),
        direction: getDirection(px, pz, t.position.x, t.position.z),
      }))
      .sort((a, b) => a.distance - b.distance);

    const townLines = townEntries
      .slice(0, 10) // Show nearest 10
      .map((t) => {
        const buildingTypes = [...new Set(t.buildings.map((b) => b.type))].join(
          ", ",
        );
        return `- **${t.name}** (${t.size}, ${t.biome}) - ${Math.round(t.distance)}m ${t.direction} - has: ${buildingTypes || "houses"}`;
      });

    // Format POIs sorted by distance
    const poiEntries = worldMap.pois
      .map((p) => ({
        ...p,
        distance: dist2D(px, pz, p.position.x, p.position.z),
        direction: getDirection(px, pz, p.position.x, p.position.z),
      }))
      .sort((a, b) => a.distance - b.distance);

    const poiLines = poiEntries
      .slice(0, 10)
      .map(
        (p) =>
          `- **${p.name}** (${p.category}) - ${Math.round(p.distance)}m ${p.direction}`,
      );

    // Cardinal direction summary
    const directions = ["north", "south", "east", "west"] as const;
    const directionSummaries = directions.map((dir) => {
      const nearestTown = townEntries.find(
        (t) => t.direction === dir || t.direction.includes(dir),
      );
      const nearestPOI = poiEntries.find(
        (p) => p.direction === dir || p.direction.includes(dir),
      );
      const parts: string[] = [];
      if (nearestTown)
        parts.push(
          `nearest town "${nearestTown.name}" ${Math.round(nearestTown.distance)}m`,
        );
      if (nearestPOI)
        parts.push(
          `nearest POI "${nearestPOI.name}" ${Math.round(nearestPOI.distance)}m`,
        );
      return `- **${dir}**: ${parts.length > 0 ? parts.join(", ") : "unexplored"}`;
    });

    const text = `## World Map
### Towns (${worldMap.towns.length} total, showing nearest ${townLines.length})
${townLines.join("\n")}

### Points of Interest (${worldMap.pois.length} total, showing nearest ${poiLines.length})
${poiLines.join("\n")}

### Cardinal Directions
${directionSummaries.join("\n")}

Use EXPLORE with a direction (e.g., "EXPLORE north") or town/POI name (e.g., "EXPLORE toward ${townEntries[0]?.name || "town"}") to navigate to distant locations.`;

    const result: ProviderResult = {
      text,
      values: {
        hasWorldMap: true,
        townCount: worldMap.towns.length,
        poiCount: worldMap.pois.length,
        nearestTownName: townEntries[0]?.name || null,
        nearestTownDistance: townEntries[0]?.distance || null,
      },
      data: {
        worldMap,
        townEntries: townEntries.slice(0, 5),
        poiEntries: poiEntries.slice(0, 5),
      },
    };

    mapProviderCache.set(runtime.agentId, {
      expiresAt: now + MAP_PROVIDER_CACHE_TTL_MS,
      playerPositionKey,
      result,
      worldMapSignature,
    });

    return result;
  },
};
