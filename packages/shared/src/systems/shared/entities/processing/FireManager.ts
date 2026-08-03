/**
 * Fire Manager
 *
 * Manages fire object lifecycle for firemaking skill.
 * Implements rules-accurate walk-west behavior after lighting fires.
 *
 */

import { PROCESSING_CONSTANTS } from "../../../../constants/ProcessingConstants";
import type { PlayerID } from "../../../../types/core/identifiers";
import type { TileCoord } from "../../movement/TileSystem";
import type { Fire } from "./types";
import { getRandomFireDuration } from "./FiremakingCalculator";

/**
 * Direction offsets for walk-west priority.
 * classic MMORPG order: West, East, South, North
 */
const DIRECTION_OFFSETS: Record<string, { x: number; z: number }> = {
  west: { x: -1, z: 0 },
  east: { x: 1, z: 0 },
  south: { x: 0, z: -1 },
  north: { x: 0, z: 1 },
};

/**
 * Generate a unique fire ID.
 */
function generateFireId(): string {
  return `fire_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Fire Manager class.
 *
 * Manages active fires in the world with:
 * - Fire creation with random duration
 * - Position-based lookup
 * - Range-based queries for cooking
 * - Automatic expiration via tick updates
 * - classic MMORPG walk-west movement calculation
 */
export class FireManager {
  /** Active fires by ID */
  private fires: Map<string, Fire> = new Map();

  /** Fires indexed by tile key for O(1) position lookup */
  private firesByTile: Map<string, Fire> = new Map();

  /** Fires indexed by player ID */
  private firesByPlayer: Map<PlayerID, Set<string>> = new Map();

  /**
   * Create a new fire at a position.
   *
   * @param playerId - Player who lit the fire
   * @param position - World position { x, y, z }
   * @param currentTick - Current game tick
   * @returns Created fire object, or null if position is blocked
   */
  createFire(
    playerId: PlayerID,
    position: { x: number; y: number; z: number },
    currentTick: number,
  ): Fire | null {
    const tile = this.worldToTile(position);
    const tileKey = this.getTileKey(tile);

    // Check if tile already has a fire
    if (this.firesByTile.has(tileKey)) {
      return null;
    }

    // Check player fire limit
    const playerFires = this.firesByPlayer.get(playerId);
    if (
      playerFires &&
      playerFires.size >= PROCESSING_CONSTANTS.FIRE.maxFiresPerPlayer
    ) {
      // Remove oldest fire to make room
      const oldestFireId = playerFires.values().next().value;
      if (oldestFireId) {
        this.extinguishFire(oldestFireId);
      }
    }

    // Calculate duration
    const durationTicks = getRandomFireDuration();

    const fire: Fire = {
      id: generateFireId(),
      position: { x: position.x, y: position.y, z: position.z },
      tile: { x: tile.x, z: tile.z },
      playerId,
      createdAtTick: currentTick,
      expiresAtTick: currentTick + durationTicks,
      isActive: true,
    };

    // Index fire
    this.fires.set(fire.id, fire);
    this.firesByTile.set(tileKey, fire);

    // Track by player
    if (!this.firesByPlayer.has(playerId)) {
      this.firesByPlayer.set(playerId, new Set());
    }
    this.firesByPlayer.get(playerId)!.add(fire.id);

    return fire;
  }

  /**
   * Get fire at exact tile position.
   *
   * @param tile - Tile coordinates
   * @returns Fire at position, or null if none
   */
  getFireAtTile(tile: TileCoord): Fire | null {
    const tileKey = this.getTileKey(tile);
    return this.firesByTile.get(tileKey) ?? null;
  }

  /**
   * Get fire at world position.
   *
   * @param position - World position
   * @returns Fire at position, or null if none
   */
  getFireAtPosition(position: {
    x: number;
    y: number;
    z: number;
  }): Fire | null {
    const tile = this.worldToTile(position);
    return this.getFireAtTile(tile);
  }

  /**
   * Get all fires within range of a position.
   *
   * @param position - Center position
   * @param range - Range in tiles (Chebyshev distance)
   * @returns Array of fires within range
   */
  getFiresInRange(
    position: { x: number; y: number; z: number },
    range: number,
  ): Fire[] {
    const centerTile = this.worldToTile(position);
    const result: Fire[] = [];

    for (const fire of this.fires.values()) {
      if (!fire.isActive) continue;

      const dx = Math.abs(fire.tile.x - centerTile.x);
      const dz = Math.abs(fire.tile.z - centerTile.z);
      const distance = Math.max(dx, dz); // Chebyshev distance

      if (distance <= range) {
        result.push(fire);
      }
    }

    return result;
  }

  /**
   * Find nearest fire to a position within range.
   *
   * @param position - Search center position
   * @param maxRange - Maximum range in tiles
   * @returns Nearest fire, or null if none in range
   */
  findNearestFire(
    position: { x: number; y: number; z: number },
    maxRange: number,
  ): Fire | null {
    const centerTile = this.worldToTile(position);
    let nearest: Fire | null = null;
    let nearestDist = Infinity;

    for (const fire of this.fires.values()) {
      if (!fire.isActive) continue;

      const dx = Math.abs(fire.tile.x - centerTile.x);
      const dz = Math.abs(fire.tile.z - centerTile.z);
      const distance = Math.max(dx, dz);

      if (distance <= maxRange && distance < nearestDist) {
        nearestDist = distance;
        nearest = fire;
      }
    }

    return nearest;
  }

  /**
   * Get fire by ID.
   *
   * @param fireId - Fire ID
   * @returns Fire object, or null if not found
   */
  getFireById(fireId: string): Fire | null {
    return this.fires.get(fireId) ?? null;
  }

  /**
   * Get all fires created by a player.
   *
   * @param playerId - Player ID
   * @returns Array of player's active fires
   */
  getFiresByPlayer(playerId: PlayerID): Fire[] {
    const fireIds = this.firesByPlayer.get(playerId);
    if (!fireIds) return [];

    const result: Fire[] = [];
    for (const fireId of fireIds) {
      const fire = this.fires.get(fireId);
      if (fire && fire.isActive) {
        result.push(fire);
      }
    }
    return result;
  }

  /**
   * Extinguish a fire.
   *
   * @param fireId - Fire ID to extinguish
   */
  extinguishFire(fireId: string): void {
    const fire = this.fires.get(fireId);
    if (!fire) return;

    fire.isActive = false;

    // Remove from indexes
    const tileKey = this.getTileKey(fire.tile);
    this.firesByTile.delete(tileKey);

    const playerFires = this.firesByPlayer.get(fire.playerId);
    if (playerFires) {
      playerFires.delete(fireId);
      if (playerFires.size === 0) {
        this.firesByPlayer.delete(fire.playerId);
      }
    }

    this.fires.delete(fireId);
  }

  /**
   * Process tick - expire old fires.
   *
   * @param currentTick - Current game tick
   * @returns Number of fires expired
   */
  processTick(currentTick: number): number {
    let expiredCount = 0;

    for (const [fireId, fire] of this.fires) {
      if (fire.isActive && currentTick >= fire.expiresAtTick) {
        this.extinguishFire(fireId);
        expiredCount++;
      }
    }

    return expiredCount;
  }

  /**
   * Calculate post-fire position using classic MMORPG walk-west behavior.
   *
   * After lighting a fire, the player walks in priority order:
   * 1. West (preferred)
   * 2. East (if west blocked)
   * 3. South (if east blocked)
   * 4. North (if south blocked)
   *
   * @param playerTile - Player's current tile
   * @param isWalkable - Function to check if a tile is walkable
   * @returns Target tile to walk to, or null if all directions blocked
   */
  calculatePostFireTile(
    playerTile: TileCoord,
    isWalkable: (tile: TileCoord) => boolean,
  ): TileCoord | null {
    for (const direction of PROCESSING_CONSTANTS.FIRE_WALK_PRIORITY) {
      const offset = DIRECTION_OFFSETS[direction];
      const targetTile: TileCoord = {
        x: playerTile.x + offset.x,
        z: playerTile.z + offset.z,
      };

      // Check if target tile is walkable and doesn't have a fire
      if (isWalkable(targetTile) && !this.getFireAtTile(targetTile)) {
        return targetTile;
      }
    }

    // All directions blocked - stay in place
    return null;
  }

  /**
   * Calculate post-fire world position.
   *
   * @param playerPosition - Player's world position
   * @param isWalkable - Function to check if a tile is walkable
   * @returns Target world position, or null if all blocked
   */
  calculatePostFirePosition(
    playerPosition: { x: number; y: number; z: number },
    isWalkable: (tile: TileCoord) => boolean,
  ): { x: number; y: number; z: number } | null {
    const playerTile = this.worldToTile(playerPosition);
    const targetTile = this.calculatePostFireTile(playerTile, isWalkable);

    if (!targetTile) return null;

    return this.tileToWorld(targetTile, playerPosition.y);
  }

  /**
   * Get total number of active fires.
   */
  getFireCount(): number {
    return this.fires.size;
  }

  /**
   * Clear all fires (for testing/reset).
   */
  clearAllFires(): void {
    this.fires.clear();
    this.firesByTile.clear();
    this.firesByPlayer.clear();
  }

  /**
   * Convert world position to tile coordinates.
   * Assumes 1 unit = 1 tile.
   */
  private worldToTile(position: { x: number; z: number }): TileCoord {
    return {
      x: Math.floor(position.x),
      z: Math.floor(position.z),
    };
  }

  /**
   * Convert tile to world position (center of tile).
   */
  private tileToWorld(
    tile: TileCoord,
    y: number,
  ): { x: number; y: number; z: number } {
    return {
      x: tile.x + 0.5,
      y,
      z: tile.z + 0.5,
    };
  }

  /**
   * Generate tile key for indexing.
   */
  private getTileKey(tile: TileCoord): string {
    return `${tile.x},${tile.z}`;
  }
}

/**
 * Singleton instance for server-side use.
 * Client should create own instance or receive state from server.
 */
let _fireManagerInstance: FireManager | null = null;

/**
 * Get or create the fire manager singleton.
 */
export function getFireManager(): FireManager {
  if (!_fireManagerInstance) {
    _fireManagerInstance = new FireManager();
  }
  return _fireManagerInstance;
}

/**
 * Reset the fire manager singleton (for testing).
 */
export function resetFireManager(): void {
  _fireManagerInstance?.clearAllFires();
  _fireManagerInstance = null;
}
