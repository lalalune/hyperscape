/**
 * World Areas - Data-Driven Implementation
 * 
 * ALL world area data is loaded from JSON manifests at runtime by DataManager.
 * This keeps world definitions data-driven and separate from code.
 * 
 * Data loaded from: assets/manifests/world-areas.json
 * 
 * To modify world areas:
 * 1. Edit assets/manifests/world-areas.json
 * 2. Restart server to reload manifests
 * 
 * DO NOT add world area data here - keep it in JSON!
 */

import type {
  WorldPosition,
  BiomeResource,
  NPCLocation,
  MobSpawnPoint,
  WorldArea
} from '../types/core';

// Re-export types from core
export type { WorldArea, BiomeResource, NPCLocation, MobSpawnPoint } from '../types/core';

/**
 * World Areas Database - Populated at runtime from JSON manifests
 * DataManager loads from assets/manifests/world-areas.json
 */
export const ALL_WORLD_AREAS: Record<string, WorldArea> = {};

/**
 * Starter Towns - Populated by DataManager from world-areas.json
 */
export const STARTER_TOWNS: Record<string, WorldArea> = {};

/**
 * Helper Functions
 */
export function getAreaById(areaId: string): WorldArea | null {
  return ALL_WORLD_AREAS[areaId] || null;
}

export function getAreasByDifficulty(level: 0 | 1 | 2 | 3): WorldArea[] {
  return Object.values(ALL_WORLD_AREAS).filter(area => area.difficultyLevel === level);
}

export function getSafeZones(): WorldArea[] {
  return Object.values(ALL_WORLD_AREAS).filter(area => area.safeZone);
}

export function getConnectedAreas(areaId: string): WorldArea[] {
  const area = getAreaById(areaId);
  if (!area) return [];
  
  return area.connections
    .map(id => getAreaById(id))
    .filter(area => area !== null) as WorldArea[];
}

export function getNPCsInArea(areaId: string): NPCLocation[] {
  const area = getAreaById(areaId);
  return area ? area.npcs : [];
}

export function getResourcesInArea(areaId: string): BiomeResource[] {
  const area = getAreaById(areaId);
  return area ? area.resources : [];
}

export function getMobSpawnsInArea(areaId: string): MobSpawnPoint[] {
  const area = getAreaById(areaId);
  return area ? area.mobSpawns : [];
}

/**
 * Player Spawn Points - Computed from loaded world areas
 */
export function getPlayerSpawnPoints(): WorldPosition[] {
  const spawnPoints: WorldPosition[] = [];
  for (const area of Object.values(ALL_WORLD_AREAS)) {
    if (area.safeZone && area.difficultyLevel === 0) {
      // Use center of safe zone as spawn point
      const centerX = (area.bounds.minX + area.bounds.maxX) / 2;
      const centerZ = (area.bounds.minZ + area.bounds.maxZ) / 2;
      spawnPoints.push({ x: centerX, y: 0, z: centerZ });
    }
  }
  return spawnPoints;
}

export function getRandomSpawnPoint(): WorldPosition {
  const spawnPoints = getPlayerSpawnPoints();
  if (spawnPoints.length === 0) {
    // Fallback to origin if no spawn points loaded yet
    return { x: 0, y: 0, z: 0 };
  }
  const index = Math.floor(Math.random() * spawnPoints.length);
  return { ...spawnPoints[index] };
}

/**
 * World Generation Constants
 */
export const WORLD_CONSTANTS = {
  TOTAL_WORLD_SIZE: 500, // 500x500 meter world
  SAFE_ZONE_RADIUS: 25,  // 25 meter radius around spawn points
  RESOURCE_RESPAWN_VARIANCE: 0.2, // ±20% respawn time variance
  MOB_SPAWN_CHECK_RADIUS: 5, // Don't spawn mobs within 5m of players
  AREA_TRANSITION_OVERLAP: 5, // 5 meter overlap between adjacent areas
} as const;
