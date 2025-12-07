"use server";

import { dataManager } from "@hyperscape/shared";
import type {
  WorldArea,
  MobSpawnPoint,
  BiomeResource,
  NPCLocation,
  BiomeData,
} from "@hyperscape/shared";

// Define strict interfaces for the UI
export interface WorldState {
  zones: WorldZone[];
  entities: WorldEntity[];
  biomes: BiomeData[];
}

export interface WorldZone {
  id: string;
  name: string;
  description: string;
  difficultyLevel: number;
  biomeType: string;
  safeZone: boolean;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  metadata: Record<string, unknown>;
}

export interface WorldEntity {
  id: string;
  type: "npc" | "mob_spawn" | "resource" | "spawn_point";
  name: string;
  position: { x: number; y: number; z: number };
  zoneId?: string;
  metadata: Record<string, unknown>;
}

export async function getWorldState(): Promise<WorldState> {
  try {
    // Initialize DataManager (fetches manifests from CDN)
    // This ensures we get specific defaults, normalization, and validation just like the game server
    const result = await dataManager.initialize();

    if (!result.isValid) {
      console.warn("DataManager validation warnings:", result.warnings);
      // Valid even with warnings, but log errors if any
      if (result.errors.length > 0) {
        console.error("DataManager validation errors:", result.errors);
      }
    }

    const zones: WorldZone[] = [];
    const entities: WorldEntity[] = [];

    // 1. Process World Areas (Zones)
    const allAreas = dataManager.getAllWorldAreas();

    Object.values(allAreas).forEach((area: WorldArea) => {
      // Add Zone
      zones.push({
        id: area.id,
        name: area.name,
        description: area.description,
        difficultyLevel: area.difficultyLevel,
        biomeType: area.biomeType,
        safeZone: area.safeZone,
        bounds: area.bounds,
        metadata: {
          // Keep metadata for extra fields
          ...area,
        },
      });

      // Add NPCs defined in this area
      if (area.npcs) {
        area.npcs.forEach((npcRef: NPCLocation) => {
          // Look up full NPC details from DataManager to get correct name/type
          const manifestNPC = dataManager.getNPC(npcRef.id);

          entities.push({
            id: `npc_${npcRef.id}_${npcRef.position.x}_${npcRef.position.z}`,
            type: "npc",
            name: manifestNPC?.name || npcRef.id, // Use manifest name if available
            position: npcRef.position,
            zoneId: area.id,
            metadata: {
              npcId: npcRef.id,
              role: npcRef.type, // e.g. "banker", "merchant"
              model: manifestNPC?.appearance?.modelPath,
              services: manifestNPC?.services?.types || [],
              description: manifestNPC?.description,
            },
          });
        });
      }

      // Add Mob Spawns
      if (area.mobSpawns) {
        area.mobSpawns.forEach((spawn: MobSpawnPoint, idx: number) => {
          const mobData = dataManager.getNPC(spawn.mobId);

          entities.push({
            id: `mob_spawn_${area.id}_${idx}`,
            type: "mob_spawn",
            name: `${mobData?.name || spawn.mobId} Spawn`,
            position: spawn.position,
            zoneId: area.id,
            metadata: {
              mobId: spawn.mobId,
              radius: spawn.spawnRadius,
              maxCount: spawn.maxCount,
              respawnTime: spawn.respawnTime,
              // Add combat stats for inspection
              level: mobData?.stats?.level,
              health: mobData?.stats?.health,
              aggressive: mobData?.combat?.aggressive,
            },
          });
        });
      }

      // Add Resources (Explicitly placed ones)
      if (area.resources) {
        area.resources.forEach((resRef: BiomeResource, idx: number) => {
          // DataManager loads resources but doesn't expose them easily via ID lookup in the current version
          // We'll use the ID as the name for now
          entities.push({
            id: `resource_${area.id}_${idx}_${resRef.resourceId}`,
            type: "resource",
            name: resRef.resourceId,
            position: resRef.position,
            zoneId: area.id,
            metadata: {
              resourceId: resRef.resourceId,
              respawnTime: resRef.respawnTime,
            },
          });
        });
      }
    });

    // 2. Process Biomes
    const allBiomes = dataManager.getAllBiomes();
    const biomes = Object.values(allBiomes);

    return {
      zones,
      entities,
      biomes,
    };
  } catch (error) {
    console.error("Failed to load world state via DataManager:", error);
    return { zones: [], entities: [], biomes: [] };
  }
}
