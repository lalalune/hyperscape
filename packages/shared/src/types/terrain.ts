/**
 * Terrain and resource-related type definitions
 * 
 * These interfaces define terrain generation, resource spawning, and world tile management.
 * Common terrain types have been moved to core.ts to avoid duplication.
 */

import THREE from '../extras/three';
import type { Position3D } from './core';
import type { PMeshHandle } from '../extras/geometryToPxMesh';

// Terrain resource interfaces
export interface TerrainResourceSpawnPoint {
  position: Position3D;
  type: 'tree' | 'rock' | 'ore' | 'herb' | 'fish' | 'gem' | 'rare_ore';
  subType: 'willow' | 'oak' | 'yew' | 'coal' | 'iron' | 'mithril' | 'adamant' | 'runite' | 'copper' | 'tin';
}

export interface TerrainTileData {
  tileId: string;
  position: { x: number; z: number };
  biome: 'forest' | 'plains' | 'desert' | 'mountains' | 'swamp' | 'tundra' | 'jungle';
  tileX: number;
  tileZ: number;
  resources: TerrainResource[];
}

export interface TerrainResource {
  position: Position3D;
  type: 'tree' | 'rock' | 'ore' | 'herb' | 'fish' | 'gem' | 'rare_ore';
  id: string;
}

// Terrain system interfaces
export interface TerrainTile {
  key: string;
  x: number;
  z: number;
  mesh: THREE.Mesh;
  collision: PMeshHandle | null;
  biome: 'forest' | 'plains' | 'desert' | 'mountains' | 'swamp' | 'tundra' | 'jungle';
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
  collider: THREE.Mesh | null;
  lastUpdate: number;
}

export interface ResourceNode {
  id: string;
  type: 'tree' | 'rock' | 'ore' | 'herb' | 'fish' | 'gem' | 'rare_ore';
  position: Position3D | THREE.Vector3;
  mesh?: THREE.Mesh | null; // For non-instanced meshes
  instanceId?: number | null;
  meshType?: string;
  health: number;
  maxHealth: number;
  respawnTime: number;
  harvestable: boolean;
  requiredLevel: number;
}

export interface RoadSegment {
  start: THREE.Vector2 | { x: number; z: number };
  end: THREE.Vector2 | { x: number; z: number };
  width: number;
  mesh: THREE.Mesh | null;
  material: 'stone' | 'dirt' | 'cobblestone';
  condition: number; // 0-100
}

// BiomeData moved to core.ts to avoid duplication

// ResourceNodeData and ResourceMesh moved to core.ts to avoid duplication
