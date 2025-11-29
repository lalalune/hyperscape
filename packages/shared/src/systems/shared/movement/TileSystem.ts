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
  moveSeq: number; // Movement sequence number (incremented on each new path)
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
 * Check if two tiles are adjacent (Chebyshev distance = 1)
 * This includes diagonal adjacency (8 directions).
 * Used for general "next to each other" checks.
 *
 * OSRS Reference: Entities are considered "in melee range" when adjacent.
 */
export function tilesAdjacent(a: TileCoord, b: TileCoord): boolean {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  // Adjacent if max distance is 1 and not the same tile
  return dx <= 1 && dz <= 1 && (dx > 0 || dz > 0);
}

/**
 * Check if two tiles are cardinally adjacent (Manhattan distance = 1)
 * This is N/S/E/W only, no diagonals.
 * In OSRS, melee attacks are cardinal-only (except salamanders).
 *
 * OSRS Reference: Standard melee can only attack N/S/E/W, not diagonally.
 */
export function tilesCardinallyAdjacent(a: TileCoord, b: TileCoord): boolean {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  // Cardinal if exactly 1 step in only one axis
  return (dx === 1 && dz === 0) || (dx === 0 && dz === 1);
}

/**
 * Get the best adjacent tile to stand on when attacking a target.
 * Returns the adjacent tile to `target` that is closest to `attacker`.
 * This is used for melee combat positioning - stand next to target, not on it.
 *
 * OSRS Reference: NPCs path to an adjacent tile when chasing for melee combat.
 *
 * @param target - The tile the target is standing on
 * @param attacker - The tile the attacker is currently on
 * @param cardinalOnly - If true, only consider N/S/E/W tiles (OSRS melee behavior)
 * @param isWalkable - Optional function to check if a tile is walkable
 * @returns The best adjacent tile to stand on, or null if none available
 */
export function getBestAdjacentTile(
  target: TileCoord,
  attacker: TileCoord,
  cardinalOnly: boolean = false,
  isWalkable?: (tile: TileCoord) => boolean,
): TileCoord | null {
  // Get candidate tiles (cardinal or all 8 directions)
  const candidates = cardinalOnly
    ? [
        { x: target.x - 1, z: target.z }, // West
        { x: target.x + 1, z: target.z }, // East
        { x: target.x, z: target.z - 1 }, // South
        { x: target.x, z: target.z + 1 }, // North
      ]
    : getAdjacentTiles(target);

  // Filter out unwalkable tiles if isWalkable function provided
  const walkableCandidates = isWalkable
    ? candidates.filter(isWalkable)
    : candidates;

  if (walkableCandidates.length === 0) {
    return null;
  }

  // If attacker is already on one of these tiles, return that tile
  for (const candidate of walkableCandidates) {
    if (tilesEqual(candidate, attacker)) {
      return candidate;
    }
  }

  // Find the candidate closest to the attacker using Chebyshev distance
  let best = walkableCandidates[0];
  let bestDist = tileChebyshevDistance(best, attacker);

  for (let i = 1; i < walkableCandidates.length; i++) {
    const dist = tileChebyshevDistance(walkableCandidates[i], attacker);
    if (dist < bestDist) {
      best = walkableCandidates[i];
      bestDist = dist;
    }
  }

  return best;
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
    moveSeq: 0,
  };
}
