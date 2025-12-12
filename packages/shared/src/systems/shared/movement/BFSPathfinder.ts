/**
 * BFS Pathfinder with OSRS-style Naive Diagonal Pathing
 *
 * OSRS has two pathing modes:
 * 1. Click-to-move: Uses BFS with specific neighbor order
 * 2. Follow mode: "naively paths diagonally to the end tile and then straight"
 *
 * The naive diagonal approach feels more intuitive - you walk toward your
 * destination diagonally first, then straight for the remaining distance.
 *
 * This implementation:
 * 1. First tries naive diagonal path (fast, intuitive, no obstacles)
 * 2. Falls back to BFS if obstacles block the naive path
 *
 * @see https://oldschool.runescape.wiki/w/Pathfinding
 */

import {
  TileCoord,
  TILE_DIRECTIONS,
  PATHFIND_RADIUS,
  tileKey,
  tilesEqual,
  isDiagonal,
} from "./TileSystem";

/**
 * Walkability check function type
 * Takes a tile and optional "from" tile for directional blocking
 */
export type WalkabilityChecker = (
  tile: TileCoord,
  fromTile?: TileCoord,
) => boolean;

/**
 * BFS Pathfinder for tile-based movement
 */
export class BFSPathfinder {
  /**
   * Find a path from start to end
   * Uses naive diagonal pathing first (OSRS follow-mode style),
   * falls back to BFS if obstacles are encountered
   */
  findPath(
    start: TileCoord,
    end: TileCoord,
    isWalkable: WalkabilityChecker,
  ): TileCoord[] {
    // Already at destination
    if (tilesEqual(start, end)) {
      return [];
    }

    // Check if end is walkable
    if (!isWalkable(end)) {
      // Find nearest walkable tile to destination
      const nearestWalkable = this.findNearestWalkable(end, isWalkable);
      if (!nearestWalkable) {
        return []; // No path possible
      }
      end = nearestWalkable;
    }

    // First, try naive diagonal path (fast and intuitive)
    const naivePath = this.findNaiveDiagonalPath(start, end, isWalkable);
    if (naivePath.length > 0) {
      return naivePath;
    }

    // Naive path blocked - use BFS to find path around obstacles
    return this.findBFSPath(start, end, isWalkable);
  }

  /**
   * OSRS-style naive diagonal pathing
   * "naively paths diagonally to the end tile and then straight if there's no diagonals left"
   *
   * This creates the intuitive path where you walk toward your target:
   * - First, move diagonally (both X and Z changing) toward target
   * - Then, move straight (only X or Z) for the remaining distance
   */
  private findNaiveDiagonalPath(
    start: TileCoord,
    end: TileCoord,
    isWalkable: WalkabilityChecker,
  ): TileCoord[] {
    const path: TileCoord[] = [];
    let current = { ...start };

    // Maximum iterations to prevent infinite loops
    const maxIterations = 500;
    let iterations = 0;

    while (!tilesEqual(current, end) && iterations < maxIterations) {
      iterations++;

      // Calculate direction to target
      const dx = Math.sign(end.x - current.x);
      const dz = Math.sign(end.z - current.z);

      // Try to find the next tile to move to
      let nextTile: TileCoord | null = null;

      if (dx !== 0 && dz !== 0) {
        // Need to move in both X and Z - try diagonal first
        const diagonal: TileCoord = { x: current.x + dx, z: current.z + dz };

        if (this.canMoveTo(current, diagonal, isWalkable)) {
          nextTile = diagonal;
        } else {
          // Diagonal blocked - try cardinal directions
          // Prefer the axis with more distance remaining
          const xDist = Math.abs(end.x - current.x);
          const zDist = Math.abs(end.z - current.z);

          if (xDist >= zDist) {
            // Try X first, then Z
            const cardinalX: TileCoord = { x: current.x + dx, z: current.z };
            const cardinalZ: TileCoord = { x: current.x, z: current.z + dz };

            if (this.canMoveTo(current, cardinalX, isWalkable)) {
              nextTile = cardinalX;
            } else if (this.canMoveTo(current, cardinalZ, isWalkable)) {
              nextTile = cardinalZ;
            }
          } else {
            // Try Z first, then X
            const cardinalZ: TileCoord = { x: current.x, z: current.z + dz };
            const cardinalX: TileCoord = { x: current.x + dx, z: current.z };

            if (this.canMoveTo(current, cardinalZ, isWalkable)) {
              nextTile = cardinalZ;
            } else if (this.canMoveTo(current, cardinalX, isWalkable)) {
              nextTile = cardinalX;
            }
          }
        }
      } else if (dx !== 0) {
        // Only need to move in X
        const cardinalX: TileCoord = { x: current.x + dx, z: current.z };
        if (this.canMoveTo(current, cardinalX, isWalkable)) {
          nextTile = cardinalX;
        }
      } else if (dz !== 0) {
        // Only need to move in Z
        const cardinalZ: TileCoord = { x: current.x, z: current.z + dz };
        if (this.canMoveTo(current, cardinalZ, isWalkable)) {
          nextTile = cardinalZ;
        }
      }

      // If we couldn't find a valid next tile, naive path is blocked
      if (!nextTile) {
        return []; // Signal to use BFS instead
      }

      path.push(nextTile);
      current = nextTile;

      // Safety limit on path length
      if (path.length > 200) {
        return path;
      }
    }

    return path;
  }

  /**
   * BFS pathfinding - used when naive diagonal path is blocked by obstacles
   */
  private findBFSPath(
    start: TileCoord,
    end: TileCoord,
    isWalkable: WalkabilityChecker,
  ): TileCoord[] {
    // BFS setup
    const visited = new Set<string>();
    const parent = new Map<string, TileCoord>();
    const queue: TileCoord[] = [];

    // Start BFS from start tile
    queue.push(start);
    visited.add(tileKey(start));

    // Track bounds for 128x128 limit
    const minX = start.x - PATHFIND_RADIUS;
    const maxX = start.x + PATHFIND_RADIUS;
    const minZ = start.z - PATHFIND_RADIUS;
    const maxZ = start.z + PATHFIND_RADIUS;

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Found the destination
      if (tilesEqual(current, end)) {
        return this.reconstructPath(start, end, parent);
      }

      // Check all 8 directions in OSRS order: W, E, S, N, SW, SE, NW, NE
      for (const dir of TILE_DIRECTIONS) {
        const neighbor: TileCoord = {
          x: current.x + dir.x,
          z: current.z + dir.z,
        };

        // Skip if out of search bounds
        if (
          neighbor.x < minX ||
          neighbor.x > maxX ||
          neighbor.z < minZ ||
          neighbor.z > maxZ
        ) {
          continue;
        }

        const neighborKey = tileKey(neighbor);

        // Skip if already visited
        if (visited.has(neighborKey)) {
          continue;
        }

        // Check walkability (including diagonal corner checks)
        if (!this.canMoveTo(current, neighbor, isWalkable)) {
          continue;
        }

        // Add to queue
        visited.add(neighborKey);
        parent.set(neighborKey, current);
        queue.push(neighbor);
      }
    }

    // No path found - return partial path to closest point
    return this.findPartialPath(start, end, visited, parent);
  }

  /**
   * Check if movement from one tile to another is valid
   * Handles diagonal corner clipping prevention
   */
  private canMoveTo(
    from: TileCoord,
    to: TileCoord,
    isWalkable: WalkabilityChecker,
  ): boolean {
    // Target must be walkable
    if (!isWalkable(to, from)) {
      return false;
    }

    const dx = to.x - from.x;
    const dz = to.z - from.z;

    // For diagonal movement, check corner clipping
    if (isDiagonal(dx, dz)) {
      // Check both adjacent cardinal tiles
      const cardinalX: TileCoord = { x: from.x + dx, z: from.z };
      const cardinalZ: TileCoord = { x: from.x, z: from.z + dz };

      // Both adjacent tiles must be walkable to prevent corner clipping
      if (!isWalkable(cardinalX, from) || !isWalkable(cardinalZ, from)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Reconstruct path from BFS parent map
   * Returns FULL TILE-BY-TILE path from start (exclusive) to end (inclusive)
   */
  private reconstructPath(
    start: TileCoord,
    end: TileCoord,
    parent: Map<string, TileCoord>,
  ): TileCoord[] {
    const fullPath: TileCoord[] = [];
    let current = end;

    // Trace back from end to start
    while (!tilesEqual(current, start)) {
      fullPath.unshift(current);
      const parentTile = parent.get(tileKey(current));
      if (!parentTile) break;
      current = parentTile;
    }

    // Limit to reasonable max to prevent memory issues
    if (fullPath.length > 200) {
      return fullPath.slice(0, 200);
    }

    return fullPath;
  }

  /**
   * Find nearest walkable tile to a target
   * Used when destination is blocked
   */
  private findNearestWalkable(
    target: TileCoord,
    isWalkable: WalkabilityChecker,
  ): TileCoord | null {
    // Check tiles in expanding rings around target
    for (let radius = 1; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          // Only check tiles on the edge of this ring
          if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) {
            continue;
          }

          const tile: TileCoord = {
            x: target.x + dx,
            z: target.z + dz,
          };

          if (isWalkable(tile)) {
            return tile;
          }
        }
      }
    }

    return null;
  }

  /**
   * Find a partial path when destination is unreachable
   * Returns path to the closest visited tile to the destination
   */
  private findPartialPath(
    start: TileCoord,
    end: TileCoord,
    visited: Set<string>,
    parent: Map<string, TileCoord>,
  ): TileCoord[] {
    // Find the visited tile closest to the destination
    let closestTile: TileCoord | null = null;
    let closestDistance = Infinity;

    for (const key of visited) {
      const [x, z] = key.split(",").map(Number);
      const tile: TileCoord = { x, z };
      const distance = Math.abs(tile.x - end.x) + Math.abs(tile.z - end.z);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestTile = tile;
      }
    }

    if (!closestTile || tilesEqual(closestTile, start)) {
      return [];
    }

    return this.reconstructPath(start, closestTile, parent);
  }

  /**
   * Calculate path length (in tiles walked, not checkpoints)
   */
  getPathLength(path: TileCoord[]): number {
    if (path.length <= 1) {
      return path.length;
    }

    let length = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = Math.abs(path[i].x - path[i - 1].x);
      const dz = Math.abs(path[i].z - path[i - 1].z);
      // Diagonal counts as 1 tile (Chebyshev distance)
      length += Math.max(dx, dz);
    }

    return length;
  }
}
