/**
 * Terrain and resource-related type definitions
 *
 * These interfaces define terrain generation, resource spawning, and world tile management.
 * Common terrain types have been moved to core.ts to avoid duplication.
 */

import * as THREE from "../../extras/three/three";
import type { Position3D } from "../core/core";
import type { PMeshHandle } from "../../extras/three/geometryToPxMesh";
import type { ActorHandle } from "../systems/physics";

// Terrain resource interfaces
/**
 * Tree subtypes that can spawn in the world.
 * These map to tree_<subtype> in woodcutting.json manifest.
 */
export type TreeSubType =
  | "normal"
  | "oak"
  | "willow"
  | "teak"
  | "maple"
  | "mahogany"
  | "yew"
  | "magic";

/**
 * Ore subtypes that can spawn in the world.
 * These map to ore_<subtype> in mining.json manifest.
 */
export type OreSubType =
  | "copper"
  | "tin"
  | "iron"
  | "coal"
  | "mithril"
  | "adamant"
  | "runite"
  | "essence";

/**
 * Combined resource subtype for spawn points.
 */
export type ResourceSubType = TreeSubType | OreSubType;

export interface TerrainResourceSpawnPoint {
  position: Position3D;
  type: "tree" | "rock" | "ore" | "herb" | "fish" | "gem" | "rare_ore";
  /** Optional subtype for variant selection (e.g., "oak" for tree_oak, "copper" for ore_copper) */
  subType?: ResourceSubType;
  /** Scale multiplier for visual variation (default: 1.0) */
  scale?: number;
  /** Y-axis rotation in radians for visual variation */
  rotation?: number;
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
  /** Decorative rock instance IDs for cleanup when tile is unloaded */
  decorativeRockIds?: string[];
  /** Decorative plant instance IDs for cleanup when tile is unloaded */
  decorativePlantIds?: string[];
}

export interface ResourceNode {
  id: string;
  type: "tree" | "rock" | "ore" | "herb" | "fish" | "gem" | "rare_ore";
  /** Specific variant (e.g., "oak" for tree_oak, "copper" for ore_copper) */
  subType?: ResourceSubType;
  position: Position3D | THREE.Vector3;
  mesh?: THREE.Mesh | null; // For non-instanced meshes
  instanceId?: number | null;
  meshType?: string;
  health: number;
  maxHealth: number;
  respawnTime: number;
  harvestable: boolean;
  requiredLevel: number;
  /** Scale multiplier for visual variation (default: 1.0) */
  scale?: number;
  /** Y-axis rotation in radians for visual variation */
  rotation?: number;
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

// ============================================================================
// TERRAIN FLATTENING
// ============================================================================

/**
 * A single tile coordinate for flat zone masking.
 */
export interface FlatZoneTile {
  /** Tile X coordinate (world tile coords, 1m per tile) */
  x: number;
  /** Tile Z coordinate (world tile coords, 1m per tile) */
  z: number;
}

/**
 * Inclusive tile bounds for quick rejection in tile-mask queries.
 */
export interface FlatZoneTileBounds {
  /** Minimum tile X (inclusive) */
  minX: number;
  /** Maximum tile X (inclusive) */
  maxX: number;
  /** Minimum tile Z (inclusive) */
  minZ: number;
  /** Maximum tile Z (inclusive) */
  maxZ: number;
}

/**
 * Defines an area where terrain should be flattened.
 * Used for stations, buildings, and other world objects that need level ground.
 *
 * When `tileMask` is provided, the core flat area uses the exact tile set
 * instead of a rectangular half-width/half-depth check. This supports
 * L-shaped and other non-rectangular building footprints.
 */
export interface FlatZone {
  /** Unique identifier (e.g., "station_furnace_lumbridge_1") */
  id: string;
  /** Center X position in world coordinates (meters) */
  centerX: number;
  /** Center Z position in world coordinates (meters) */
  centerZ: number;
  /** Width in meters (X axis) - used for rectangular zones and blend indexing */
  width: number;
  /** Depth in meters (Z axis) - used for rectangular zones and blend indexing */
  depth: number;
  /** Target height for the flat area (meters) */
  height: number;
  /** Blend radius for smooth transition to procedural terrain (meters) */
  blendRadius: number;
  /**
   * Optional carve inset for removing terrain triangles in the flat zone core.
   * If provided, terrain will be carved inside the core area shrunk by this inset.
   * Use this for buildings to avoid terrain overdraw under volumes.
   */
  carveInset?: number;
  /**
   * Optional tile mask for non-rectangular flat zones (building footprints).
   * Keys use "tileX,tileZ" format (see building-collision-types tileKey).
   */
  tileMask?: Set<string>;
  /**
   * Optional tile list for blend distance queries.
   */
  tileMaskTiles?: FlatZoneTile[];
  /**
   * Optional bounds (inclusive) for quick tile-mask rejection.
   */
  tileMaskBounds?: FlatZoneTileBounds;
}

/**
 * Spatial index key for flat zone lookup.
 * Format: "tileX_tileZ" where tiles are terrain tiles (100m each).
 */
export type FlatZoneKey = `${number}_${number}`;
