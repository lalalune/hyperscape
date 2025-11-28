/**
 * Tile System
 *
 * Core constants and utilities for RuneScape-style tile-based movement.
 * The game world is divided into discrete tiles, and entities move
 * one tile at a time in sync with server ticks.
 *
 * Key concepts:
 * - TILE_SIZE: World units per tile (1.0 = 1 meter per tile)
 * - TICK_DURATION_MS: Server tick interval (600ms like RuneScape)
 * - Movement happens discretely: 1 tile/tick (walk) or 2 tiles/tick (run)
 * - Client interpolates visually between tile positions
 */

/**
 * Core tile system constants
 *
 * OSRS uses 600ms ticks with 1 tile/tick walk, 2 tiles/tick run.
 * We use 2x speed (2/4 tiles per tick) for a snappier modern feel
 * while keeping the tick-based movement system.
 */
export const TILE_SIZE = 1.0; // 1 world unit = 1 tile
export const TICK_DURATION_MS = 600; // 0.6 seconds per server tick
export const TILES_PER_TICK_WALK = 2; // Walking: 2 tiles per tick (2x OSRS)
export const TILES_PER_TICK_RUN = 4; // Running: 4 tiles per tick (2x OSRS)
export const MAX_PATH_LENGTH = 25; // Maximum checkpoint tiles in a path
export const PATHFIND_RADIUS = 128; // BFS search radius in tiles

/**
 * Tile coordinate (always integers)
 * Y is intentionally omitted - tiles are 2D, height comes from terrain
 */
export interface TileCoord {
  x: number; // Integer tile X
  z: number; // Integer tile Z
}

/**
 * Movement state for a single entity
 */
export interface TileMovementState {
  currentTile: TileCoord; // Current tile position
  path: TileCoord[]; // Queue of tiles to walk through
  pathIndex: number; // Current position in path
  isRunning: boolean; // Walk (1 tile/tick) vs Run (2 tiles/tick)
}

/**
 * Tile flags for collision/walkability
 */
export interface TileFlags {
  walkable: boolean; // Can entities stand on this tile?
  blockedNorth: boolean; // Is north edge blocked?
  blockedEast: boolean; // Is east edge blocked?
  blockedSouth: boolean; // Is south edge blocked?
  blockedWest: boolean; // Is west edge blocked?
}

/**
 * Convert world coordinates to tile coordinates
 * Uses floor to ensure consistent tile boundaries
 */
export function worldToTile(worldX: number, worldZ: number): TileCoord {
  return {
    x: Math.floor(worldX / TILE_SIZE),
    z: Math.floor(worldZ / TILE_SIZE),
  };
}

/**
 * Convert tile coordinates to world coordinates (tile center)
 * Returns the center of the tile, not the corner
 */
export function tileToWorld(tile: TileCoord): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: (tile.x + 0.5) * TILE_SIZE,
    y: 0, // Y will be set from terrain height
    z: (tile.z + 0.5) * TILE_SIZE,
  };
}

/**
 * Calculate Manhattan distance between two tiles
 * Used for simple distance checks (not pathfinding)
 */
export function tileManhattanDistance(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

/**
 * Calculate Chebyshev distance (max of dx, dz)
 * This is the actual "tile distance" for diagonal movement
 */
export function tileChebyshevDistance(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

/**
 * Check if two tile coordinates are equal
 */
export function tilesEqual(a: TileCoord, b: TileCoord): boolean {
  return a.x === b.x && a.z === b.z;
}

/**
 * Get adjacent tiles (8 directions - RuneScape order)
 * Order: W, E, S, N, SW, SE, NW, NE
 */
export function getAdjacentTiles(tile: TileCoord): TileCoord[] {
  return [
    { x: tile.x - 1, z: tile.z }, // West
    { x: tile.x + 1, z: tile.z }, // East
    { x: tile.x, z: tile.z - 1 }, // South
    { x: tile.x, z: tile.z + 1 }, // North
    { x: tile.x - 1, z: tile.z - 1 }, // Southwest
    { x: tile.x + 1, z: tile.z - 1 }, // Southeast
    { x: tile.x - 1, z: tile.z + 1 }, // Northwest
    { x: tile.x + 1, z: tile.z + 1 }, // Northeast
  ];
}

/**
 * Direction vectors matching RuneScape's neighbor check order
 */
export const TILE_DIRECTIONS = [
  { x: -1, z: 0 }, // West
  { x: 1, z: 0 }, // East
  { x: 0, z: -1 }, // South
  { x: 0, z: 1 }, // North
  { x: -1, z: -1 }, // Southwest
  { x: 1, z: -1 }, // Southeast
  { x: -1, z: 1 }, // Northwest
  { x: 1, z: 1 }, // Northeast
] as const;

/**
 * Check if a direction is diagonal
 */
export function isDiagonal(dx: number, dz: number): boolean {
  return dx !== 0 && dz !== 0;
}

/**
 * Create a unique key for a tile (for Map/Set storage)
 */
export function tileKey(tile: TileCoord): string {
  return `${tile.x},${tile.z}`;
}

/**
 * Parse a tile key back into a TileCoord
 */
export function parseTileKey(key: string): TileCoord {
  const [x, z] = key.split(",").map(Number);
  return { x, z };
}

/**
 * Clamp a tile coordinate within bounds
 */
export function clampTile(
  tile: TileCoord,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): TileCoord {
  return {
    x: Math.max(minX, Math.min(maxX, tile.x)),
    z: Math.max(minZ, Math.min(maxZ, tile.z)),
  };
}

/**
 * Create an empty tile movement state
 */
export function createTileMovementState(
  startTile: TileCoord,
): TileMovementState {
  return {
    currentTile: { ...startTile },
    path: [],
    pathIndex: 0,
    isRunning: false,
  };
}
