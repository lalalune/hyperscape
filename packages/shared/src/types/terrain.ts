/**
 * Terrain and resource-related type definitions
 *
 * These interfaces define terrain generation, resource spawning, and world tile management.
 * Common terrain types have been moved to core.ts to avoid duplication.
 */

import THREE from "../extras/three";
import type { Position3D } from "./core";
import type { PMeshHandle } from "../extras/geometryToPxMesh";
import type { ActorHandle } from "./physics";

export interface Heightfield {
  // Core elevation
  height: number;
  liquidHeight: number;

  // Classification
  biome: string;
  liquidType: "none" | "ocean" | "river" | "lava";

  // Geometry
  slope: number;
  normal: { x: number; y: number; z: number };

  // Materials (up to 4 blended)
  materials: [number, number, number, number]; // Material indices
  materialsWeights: [number, number, number, number]; // Blend weights

  // Instance data
  hash: number; // Random seed for this position
  wetness: number; // Moisture level (0-1)
  treeVisibility: number;
  rockVisibility: number;
  stoneVisibility: number;
  grassVisibility: number;
  flowerVisibility: number;
  flowDirection: number; // For water
}

// Terrain resource interfaces
export interface TerrainResourceSpawnPoint {
  position: Position3D;
  type: "tree" | "rock" | "ore" | "herb" | "fish" | "gem" | "rare_ore";
  subType:
    | "willow"
    | "oak"
    | "yew"
    | "coal"
    | "iron"
    | "mithril"
    | "adamant"
    | "runite"
    | "copper"
    | "tin";
}

export interface TerrainTileData {
  tileId: string;
  position: { x: number; z: number };
  biome:
    | "forest"
    | "plains"
    | "desert"
    | "mountains"
    | "swamp"
    | "tundra"
    | "jungle";
  tileX: number;
  tileZ: number;
  resources: TerrainResource[];
}

export interface TerrainResource {
  position: Position3D;
  type: "tree" | "rock" | "ore" | "herb" | "fish" | "gem" | "rare_ore";
  id: string;
}

// Terrain system interfaces
export interface TerrainTile {
  key: string;
  x: number;
  z: number;
  mesh: THREE.Mesh;
  collision: PMeshHandle | null;
  biome:
    | "forest"
    | "plains"
    | "desert"
    | "mountains"
    | "swamp"
    | "tundra"
    | "jungle";
  resources: ResourceNode[];
  roads: RoadSegment[];
  waterMeshes: THREE.Mesh[];
  generated: boolean;
  heightData: number[];
  lastActiveTime: Date;
  playerCount: number;
  needsSave: boolean;
  chunkSeed: number;
  heightMap: Float32Array;
  collider: ActorHandle | null;
  lastUpdate: number;
}

export interface ResourceNode {
  id: string;
  type:
    | "tree"
    | "rock"
    | "ore"
    | "herb"
    | "fish"
    | "gem"
    | "rare_ore"
    | "stone";
  position: Position3D | THREE.Vector3;
  mesh?: THREE.Mesh | null; // For non-instanced meshes
  instanceId?: number | null;
  meshType?: string;
  health: number;
  maxHealth: number;
  respawnTime: number;
  harvestable: boolean;
  requiredLevel: number;
  variation?: number;
  rotation?: THREE.Euler;
  scale?: THREE.Vector3;
}

export interface RoadSegment {
  start: THREE.Vector2 | { x: number; z: number };
  end: THREE.Vector2 | { x: number; z: number };
  width: number;
  mesh: THREE.Mesh | null;
  material: "stone" | "dirt" | "cobblestone";
  condition: number; // 0-100
}

// BiomeData moved to core.ts to avoid duplication

// ResourceNodeData and ResourceMesh moved to core.ts to avoid duplication
