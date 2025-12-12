/**
 * World Structure - Data-Driven Implementation
 *
 * ALL biome and zone data is loaded from JSON manifests at runtime by DataManager.
 * This keeps world structure definitions data-driven and separate from code.
 *
 * Data loaded from:
 * - assets/manifests/biomes.json
 * - assets/manifests/zones.json
 *
 * To modify biomes or zones:
 * 1. Edit the appropriate JSON file
 * 2. Restart server to reload manifests
 *
 * DO NOT add biome/zone data here - keep it in JSON!
 */

import type { BiomeData, ZoneData } from "../types/core/core";
import { calculateDistance2D } from "../utils/game/EntityUtils";

// Re-export types for external use
export type { DeathLocationData } from "../types/core/core";

/**
 * Biome Database - Populated at runtime from JSON manifests
 * DataManager loads from assets/manifests/biomes.json
 */
export const BIOMES: Record<string, BiomeData> = {};

/**
 * World Zones - Populated at runtime from JSON manifests
 * DataManager loads from assets/manifests/zones.json
 */
export const WORLD_ZONES: ZoneData[] = [];

/**
 * Starter Zones - Computed from loaded zones (ZoneData[] type)
 * Note: This is different from STARTER_TOWNS in world-areas.ts which uses WorldArea type
 */
export const STARTER_ZONES: ZoneData[] = [];

/**
 * Helper Functions
 */
export function getNearestTown(position: {
  x: number;
  y: number;
  z: number;
}): ZoneData | null {
  const towns = WORLD_ZONES.filter((zone) => zone.isTown);
  if (towns.length === 0) return null;

  let nearestTown = towns[0];
  let minDistance = Infinity;

  for (const town of towns) {
    const spawnPoint = town.spawnPoints.find((sp) => sp.type === "player");
    if (spawnPoint) {
      const distance = calculateDistance2D(position, spawnPoint.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestTown = town;
      }
    }
  }

  return nearestTown;
}

export function getRandomTown(): ZoneData | null {
  const towns = WORLD_ZONES.filter((zone) => zone.isTown);
  if (towns.length === 0) return null;
  return towns[Math.floor(Math.random() * towns.length)];
}

export function getZoneByPosition(position: {
  x: number;
  z: number;
}): ZoneData | null {
  for (const zone of WORLD_ZONES) {
    const bounds = zone.bounds;
    if (
      position.x >= bounds.x &&
      position.x <= bounds.x + bounds.width &&
      position.z >= bounds.z &&
      position.z <= bounds.z + bounds.height
    ) {
      return zone;
    }
  }
  return null;
}

export function getZonesByDifficulty(level: 0 | 1 | 2 | 3): ZoneData[] {
  return WORLD_ZONES.filter((zone) => zone.difficultyLevel === level);
}

export function isValidPlayerMovement(
  _from: { x: number; z: number },
  _to: { x: number; z: number },
): boolean {
  // Check if movement crosses water bodies or impassable terrain
  // For MVP, all land movement is valid
  return true;
}

export function getTerrainHeight(_x: number, _z: number): number {
  // Return ground level height for position
  // For MVP, return standard ground level
  return 2;
}

/**
 * World Structure Constants (grid, terrain, zones)
 * Note: Different from WORLD_GENERATION_CONSTANTS in world-areas.ts
 */
export const WORLD_STRUCTURE_CONSTANTS = {
  GRID_SIZE: 4, // Block size for grid-based movement
  DEFAULT_SPAWN_HEIGHT: 2,
  WATER_LEVEL: 0,
  MAX_BUILD_HEIGHT: 100,
  SAFE_ZONE_RADIUS: 15, // Radius around starter towns with no hostile mobs
  RESPAWN_TIME: 30000, // 30 seconds respawn timer per GDD
  DEATH_ITEM_DESPAWN_TIME: 300000, // 5 minutes for items to despawn at death location
} as const;
