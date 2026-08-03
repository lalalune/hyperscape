/**
 * Chase Pathfinding (classic MMORPG "Dumb Pathfinder")
 *
 * Simple greedy pathfinding algorithm for NPC chasing behavior.
 * Unlike BFS which searches for optimal paths around obstacles,
 * this algorithm moves directly toward the target.
 *
 * This is intentionally simple - NPCs don't navigate around obstacles,
 * which enables "safespotting" gameplay where players can hide behind objects.
 *
 * Rules-Accurate Algorithm:
 * 1. Calculate direction to target (normalized to -1, 0, or 1)
 * 2. Try diagonal step FIRST (if moving on both axes AND corner-cut is valid)
 * 3. If diagonal blocked, try cardinal steps (prioritize axis with greater distance)
 * 4. Return first walkable tile, or null if blocked (safespotted)
 *
 * Corner-Cutting Rule:
 * Diagonal movement requires BOTH adjacent cardinal tiles to be walkable.
 * To move diagonally from (0,0) to (1,1), both (1,0) and (0,1) must be walkable.
 *
 * Performance Note:
 * - chaseStep() allocates objects per call (for backwards compatibility)
 * - ChasePathfinder class provides zero-allocation alternative for hot paths
 *
 */

import type { TileCoord } from "./TileSystem";

/**
 * Calculate the next tile when chasing a target.
 *
 * This is a greedy/direct pathfinding step - it always tries to move
 * toward the target in the most direct way possible. It does NOT search
 * for paths around obstacles.
 *
 * @param current - The chaser's current tile
 * @param target - The target tile to move toward
 * @param isWalkable - Function to check if a tile is walkable
 * @returns The next tile to move to, or null if blocked/at target
 */
export function chaseStep(
  current: TileCoord,
  target: TileCoord,
  isWalkable: (tile: TileCoord) => boolean,
): TileCoord | null {
  // Calculate direction to target (-1, 0, or 1 for each axis)
  const dx = Math.sign(target.x - current.x);
  const dz = Math.sign(target.z - current.z);

  // If already at target, no movement needed
  if (dx === 0 && dz === 0) {
    return null;
  }

  // Build list of tiles to try, in priority order
  const candidates: TileCoord[] = [];

  // Priority 1: Diagonal (if moving on both axes AND corner-cut is valid)
  // classic MMORPG corner-cutting rule: Both adjacent cardinal tiles must be walkable
  // to move diagonally. This prevents cutting through wall corners.
  if (dx !== 0 && dz !== 0) {
    const cardinalX: TileCoord = { x: current.x + dx, z: current.z };
    const cardinalZ: TileCoord = { x: current.x, z: current.z + dz };
    const diagonal: TileCoord = { x: current.x + dx, z: current.z + dz };

    // Only allow diagonal if both adjacent cardinals AND the diagonal itself are walkable
    if (
      isWalkable(cardinalX) &&
      isWalkable(cardinalZ) &&
      isWalkable(diagonal)
    ) {
      candidates.push(diagonal);
    }
  }

  // Priority 2: Cardinal directions (prioritize greater distance axis)
  const absDx = Math.abs(target.x - current.x);
  const absDz = Math.abs(target.z - current.z);

  if (absDx >= absDz) {
    // X axis has greater or equal distance, try it first
    if (dx !== 0) candidates.push({ x: current.x + dx, z: current.z });
    if (dz !== 0) candidates.push({ x: current.x, z: current.z + dz });
  } else {
    // Z axis has greater distance, try it first
    if (dz !== 0) candidates.push({ x: current.x, z: current.z + dz });
    if (dx !== 0) candidates.push({ x: current.x + dx, z: current.z });
  }

  // Try each candidate in order, return first walkable one
  for (const candidate of candidates) {
    if (isWalkable(candidate)) {
      return candidate;
    }
  }

  // All directions blocked - chaser is stuck
  return null;
}

/**
 * ChasePathfinder - Zero-allocation chase pathfinding
 *
 * Class-based alternative to chaseStep() that pre-allocates all temporary
 * objects to avoid GC pressure in hot paths (tick processing).
 *
 * Use this class when processing many NPCs per tick.
 */
export class ChasePathfinder {
  // Pre-allocated tile buffers (maximum 4 candidates: 1 diagonal + 2 cardinals)
  private readonly _cardinalX: TileCoord = { x: 0, z: 0 };
  private readonly _cardinalZ: TileCoord = { x: 0, z: 0 };
  private readonly _diagonal: TileCoord = { x: 0, z: 0 };
  private readonly _result: TileCoord = { x: 0, z: 0 };

  /**
   * Calculate the next tile when chasing a target (zero-allocation)
   *
   * Same algorithm as chaseStep(), but uses pre-allocated buffers.
   * Returns a reference to an internal buffer - copy if you need to store it.
   *
   * @param current - The chaser's current tile
   * @param target - The target tile to move toward
   * @param isWalkable - Function to check if a tile is walkable
   * @returns The next tile to move to (internal buffer), or null if blocked/at target
   */
  chaseStep(
    current: TileCoord,
    target: TileCoord,
    isWalkable: (tile: TileCoord) => boolean,
  ): TileCoord | null {
    // Calculate direction to target (-1, 0, or 1 for each axis)
    const dx = Math.sign(target.x - current.x);
    const dz = Math.sign(target.z - current.z);

    // If already at target, no movement needed
    if (dx === 0 && dz === 0) {
      return null;
    }

    // Priority 1: Diagonal (if moving on both axes AND corner-cut is valid)
    if (dx !== 0 && dz !== 0) {
      // Update pre-allocated tiles
      this._cardinalX.x = current.x + dx;
      this._cardinalX.z = current.z;
      this._cardinalZ.x = current.x;
      this._cardinalZ.z = current.z + dz;
      this._diagonal.x = current.x + dx;
      this._diagonal.z = current.z + dz;

      // Only allow diagonal if both adjacent cardinals AND diagonal are walkable
      if (
        isWalkable(this._cardinalX) &&
        isWalkable(this._cardinalZ) &&
        isWalkable(this._diagonal)
      ) {
        this._result.x = this._diagonal.x;
        this._result.z = this._diagonal.z;
        return this._result;
      }
    }

    // Priority 2: Cardinal directions (prioritize greater distance axis)
    const absDx = Math.abs(target.x - current.x);
    const absDz = Math.abs(target.z - current.z);

    if (absDx >= absDz) {
      // X axis has greater or equal distance, try it first
      if (dx !== 0) {
        this._result.x = current.x + dx;
        this._result.z = current.z;
        if (isWalkable(this._result)) {
          return this._result;
        }
      }
      if (dz !== 0) {
        this._result.x = current.x;
        this._result.z = current.z + dz;
        if (isWalkable(this._result)) {
          return this._result;
        }
      }
    } else {
      // Z axis has greater distance, try it first
      if (dz !== 0) {
        this._result.x = current.x;
        this._result.z = current.z + dz;
        if (isWalkable(this._result)) {
          return this._result;
        }
      }
      if (dx !== 0) {
        this._result.x = current.x + dx;
        this._result.z = current.z;
        if (isWalkable(this._result)) {
          return this._result;
        }
      }
    }

    // All directions blocked - chaser is stuck
    return null;
  }
}

// Singleton instance for convenience (stateless except for pre-allocated buffers)
let _chasePathfinderInstance: ChasePathfinder | null = null;

/**
 * Get the shared ChasePathfinder instance
 *
 * Use this for zero-allocation chase pathfinding in hot paths.
 */
export function getChasePathfinder(): ChasePathfinder {
  if (!_chasePathfinderInstance) {
    _chasePathfinderInstance = new ChasePathfinder();
  }
  return _chasePathfinderInstance;
}
