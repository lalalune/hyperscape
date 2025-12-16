/**
 * World Types
 * All world-related type definitions including world generation, zones, biomes, areas, and chunks
 */

import THREE from "../../extras/three/three";
import type { Position3D } from "../core/base-types";

// Temporary imports from core.ts - will be updated when those modules are created
import type { MobData } from "../core/core";
import type { InventoryItem } from "../core/core";

// ============== BASIC WORLD STRUCTURES ==============

/**
 * World position - basic position type for world coordinates
 */
export interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Town data structure
 * Represents a safe zone town with services
 */
export interface Town {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  safeZoneRadius: number;
  hasBank: boolean;
  hasStore: boolean;
  isRespawnPoint: boolean;
}

// ============== WORLD INITIALIZATION ==============

/**
 * World initialization configuration interface
 * Used to configure terrain, biomes, and structures when creating a new world
 */
export interface WorldInitConfig {
  seed?: number;
  config?: {
    terrain?: Record<
      string,
      {
        enabled?: boolean;
        scale?: number;
        octaves?: number;
        persistence?: number;
        lacunarity?: number;
        amplitude?: number;
        [key: string]: unknown;
      }
    >;
    biomes?: Record<
      string,
      {
        enabled?: boolean;
        temperature?: number;
        humidity?: number;
        elevation?: number;
        resources?: string[];
        [key: string]: unknown;
      }
    >;
    structures?: Record<
      string,
      {
        enabled?: boolean;
        frequency?: number;
        minDistance?: number;
        maxDistance?: number;
        [key: string]: unknown;
      }
    >;
  };
}

// ============== BIOME TYPES ==============

/**
 * Biome data - defines characteristics of a biome type
 */
export interface BiomeData {
  id: string;
  name: string;
  description: string;
  difficultyLevel: 0 | 1 | 2 | 3; // 0 = safe zones, 1-3 = mob levels
  terrain:
    | "forest"
    | "wastes"
    | "plains"
    | "frozen"
    | "corrupted"
    | "lake"
    | "mountain";
  resources: string[]; // Available resource types
  mobs: string[]; // Mob types that spawn here
  fogIntensity: number; // 0-1 for visual atmosphere
  ambientSound: string;
  colorScheme: {
    primary: string;
    secondary: string;
    fog: string;
  };
  color: number; // Hex color for terrain rendering
  heightRange: [number, number]; // Min and max height multipliers
  terrainMultiplier: number; // Terrain height multiplier
  waterLevel: number; // Water level threshold
  maxSlope: number; // Maximum walkable slope
  mobTypes: string[]; // Mob types that spawn here
  difficulty: number; // Difficulty level (0-3)
  baseHeight: number; // Base terrain height
  heightVariation: number; // Height variation factor
  resourceDensity: number; // Resource spawn density
  resourceTypes: string[]; // Types of resources that can spawn
}

/**
 * Biome resource - resource spawn location in a biome
 */
export interface BiomeResource {
  type: "tree" | "fishing_spot" | "mine" | "herb_patch";
  position: WorldPosition;
  resourceId: string;
  respawnTime: number;
  level: number; // Required level to harvest
}

// ============== NPC AND MOB LOCATIONS ==============

/**
 * NPC location - where NPCs spawn in the world
 * Only id, type, and position are required - all other data comes from npcs.json manifest
 */
export interface NPCLocation {
  id: string; // Must match ID in npcs.json
  type: "bank" | "general_store" | "skill_trainer" | "quest_giver";
  position: WorldPosition;
  // The following are optional - data should come from npcs.json manifest
  name?: string;
  services?: string[];
  modelPath?: string;
  description?: string;
  storeId?: string; // Links NPC to store in stores.json (for general_store type)
}

/**
 * Mob spawn point - where mobs spawn in the world
 */
export interface MobSpawnPoint {
  mobId: string;
  position: WorldPosition;
  spawnRadius: number;
  maxCount: number;
  respawnTime: number;
}

// ============== WORLD AREAS ==============

/**
 * World area - a region of the world with specific characteristics
 */
export interface WorldArea {
  id: string;
  name: string;
  description: string;
  difficultyLevel: 0 | 1 | 2 | 3; // 0 = safe zone, 1-3 = combat zones
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  biomeType: string;
  safeZone: boolean;
  npcs: NPCLocation[];
  resources: BiomeResource[];
  mobSpawns: MobSpawnPoint[];
}

// ============== ZONE SPAWN POINTS ==============

/**
 * Player spawn point data
 */
export interface PlayerSpawnPointData {
  isMainSpawn: boolean;
}

/**
 * Resource spawn point data
 */
export interface ResourceSpawnPointData {
  type: string; // Can be 'bank', 'general_store', 'tree', 'trees', 'fishing_spot', 'mine', etc.
  name: string;
  resourceId: string;
  respawnTime: number;
}

/**
 * Mob spawn point data
 */
export interface MobSpawnPointData {
  type: string; // Can be mob type like 'goblin', 'bandit', etc.
  mobId: string;
  spawnRadius: number;
  maxCount: number;
  respawnTime: number;
}

/**
 * Zone spawn point data - union type for all spawn point types
 */
export type ZoneSpawnPointData =
  | PlayerSpawnPointData
  | ResourceSpawnPointData
  | MobSpawnPointData;

/**
 * Zone spawn point - a spawn point in a zone
 */
export interface ZoneSpawnPoint {
  type: "player" | "mob" | "resource";
  position: Position3D;
  data: PlayerSpawnPointData | ResourceSpawnPointData | MobSpawnPointData;
}

// ============== ZONE DATA ==============

/**
 * Zone data - a defined area in the world with spawn points
 */
export interface ZoneData {
  id: string;
  name: string;
  biome: string;
  bounds: {
    x: number;
    z: number;
    width: number;
    height: number;
  };
  difficultyLevel: 0 | 1 | 2 | 3;
  isTown: boolean;
  hasBank: boolean;
  hasGeneralStore: boolean;
  spawnPoints: ZoneSpawnPoint[];
}

// ============== WORLD CONTENT ENTITIES ==============

/**
 * NPC entity - runtime instance of an NPC in the world
 */
export interface NPCEntity {
  id: string;
  npc: NPCLocation;
  mesh: THREE.Object3D;
  area: WorldArea;
}

/**
 * Resource entity - runtime instance of a resource in the world
 */
export interface ResourceEntity {
  id: string;
  resource: BiomeResource;
  mesh?: THREE.Object3D;
  instanceId?: number;
  meshType?: string;
  area: WorldArea;
  respawnTime: number;
  isActive: boolean;
}

/**
 * Mob entity - runtime instance of a mob in the world
 */
export interface MobEntity {
  id: string;
  mobData: MobData;
  mesh?: THREE.Object3D;
  instanceId?: number;
  meshType?: string;
  area: WorldArea;
  spawnPoint: MobSpawnPoint;
  currentHealth: number;
  lastRespawn: number;
  isAlive: boolean;
  homePosition: { x: number; y: number; z: number };
}

// ============== RESOURCE TYPES ==============

/**
 * Resource node data interface for world systems
 */
export interface ResourceNodeData {
  type: "tree" | "fishing_spot" | "ore_vein";
  position: Position3D;
  resourceType: string;
  id: string;
}

/**
 * Type for THREE.Mesh with properly typed userData for resources
 */
export interface ResourceMesh extends THREE.Mesh {
  userData: {
    entityId: string;
    type: "mob" | "npc" | "resource" | "item" | "player" | "static";
    name: string;
    interactable: boolean;
    mobData: {
      id: string;
      name: string;
      type: string;
      level: number;
      health: number;
      maxHealth: number;
    } | null;
    entityType: string;
    resourceType: string;
  };
}

// ============== WORLD CHUNKS ==============

/**
 * World chunk - a section of the world with runtime state
 */
export interface WorldChunk {
  id: string;
  chunkX: number;
  chunkZ: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  area: WorldArea;

  // Runtime state
  npcs: NPCEntity[];
  resources: ResourceEntity[];
  mobs: MobEntity[];
  terrainMesh?: THREE.Object3D;
  isLoaded: boolean;

  // Persistent state
  data: Record<string, unknown>;
  lastActivity: Date;
  playerCount: number;
  needsReset: boolean;

  // Chunk properties
  biome: string;
  heightData: number[];
  resourceStates: Record<string, boolean>;
  mobSpawnStates: Record<string, MobSpawnPoint>;
  playerModifications: Record<string, unknown>;
  chunkSeed: number;
  lastActiveTime: Date;
}

// ============== SPECIAL LOCATIONS ==============

/**
 * Death location data - where a player died and their items dropped
 */
export interface DeathLocationData {
  playerId: string;
  deathPosition: { x: number; y: number; z: number };
  timestamp: number;
  items: InventoryItem[]; // Items dropped at death location (headstone)
}

/**
 * Treasure location - treasure chest spawn locations
 */
export interface TreasureLocation {
  id: string;
  position: { x: number; y: number; z: number };
  difficulty: 1 | 2 | 3;
  areaId: string;
  description: string;
  respawnTime: number; // milliseconds
  maxItems: number;
}
