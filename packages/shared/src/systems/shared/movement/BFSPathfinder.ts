/**
 * BFS Pathfinder — OSRS "Smartpathing"
 *
 * OSRS player movement uses BFS ("smartpathing") as the primary algorithm.
 * Naive/dumb diagonal pathing is ONLY used by NPC chase movement (see ChasePathfinding.ts).
 *
 * Key features:
 * - BFS with OSRS neighbor order (W,E,S,N,SW,SE,NW,NE)
 * - findPathToAny(): Multi-destination BFS for combat — terminates at the first
 *   valid combat tile reached, naturally finding the shortest path.
 * - findNaivePath(): Exposed for NPC chase systems only, never called from findPath().
 *
 * **BFS Iteration Limit:**
 *
 * To prevent main thread blocking on complex maps, BFS is limited to
 * MAX_BFS_ITERATIONS (2000) iterations. If the limit is reached:
 * 1. A partial path to the closest explored tile is returned
 * 2. `wasLastPathPartial()` returns true
 * 3. A warning is logged (throttled to avoid spam)
 *
 * Callers can check `wasLastPathPartial()` after `findPath()` to determine
 * if the returned path reaches the actual destination or just a partial point.
 * This can be used to show a visual indicator to the player.
 *
 * **Search Radius:**
 *
 * BFS is limited to PATHFIND_RADIUS (128 tiles) from the start position.
 * Destinations outside this radius will result in partial paths.
 *
 * @see https://oldschool.runescape.wiki/w/Pathfinding
 */

import {
  TileCoord,
  TILE_DIRECTIONS,
  PATHFIND_RADIUS,
  MAX_PATH_LENGTH as _MAX_PATH_LENGTH,
  tileKeyNumeric,
  tilesEqual,
  isDiagonal,
} from "./TileSystem";
import { bfsPool } from "./ObjectPools";

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
   * Track whether the last path was partial (didn't reach destination).
   * Set to true when BFS iteration limit is reached or target is unreachable.
   */
  private _lastPathWasPartial = false;

  /**
   * Track the actual destination for the last path request.
   * Used to compare against partial path endpoint.
   */
  private _lastRequestedDestination: TileCoord | null = null;

  /**
   * Check if the last path returned by findPath() was partial.
   * A partial path means the destination wasn't reached due to:
   * - BFS iteration limit (MAX_BFS_ITERATIONS)
   * - Destination outside search radius (PATHFIND_RADIUS)
   * - Destination is blocked (path goes to nearest walkable)
   *
   * @returns true if last path was partial, false if it reached destination
   */
  wasLastPathPartial(): boolean {
    return this._lastPathWasPartial;
  }

  /**
   * Get the destination that was requested for the last path.
   * Useful for comparing against the actual path endpoint to show
   * the player where they wanted to go vs where they'll actually end up.
   */
  getLastRequestedDestination(): TileCoord | null {
    return this._lastRequestedDestination;
  }

  /**
   * Find a path from start to end using BFS (OSRS "smartpathing").
   * BFS is the primary pathfinder for all player movement.
   *
   * After calling, check `wasLastPathPartial()` to see if the path
   * reaches the actual destination or just a partial point.
   */
  findPath(
    start: TileCoord,
    end: TileCoord,
    isWalkable: WalkabilityChecker,
  ): TileCoord[] {
    // Reset per-request metadata so callers can trust path status from this call.
    this._lastPathWasPartial = false;
    this._lastRequestedDestination = { x: end.x, z: end.z };

    // Validate inputs
    if (!start || typeof start.x !== "number" || typeof start.z !== "number") {
      throw new Error(
        `[BFSPathfinder] Invalid start tile: ${JSON.stringify(start)}`,
      );
    }
    if (!end || typeof end.x !== "number" || typeof end.z !== "number") {
      throw new Error(
        `[BFSPathfinder] Invalid end tile: ${JSON.stringify(end)}`,
      );
    }
    if (!Number.isFinite(start.x) || !Number.isFinite(start.z)) {
      throw new Error(
        `[BFSPathfinder] Start tile has non-finite coords: (${start.x}, ${start.z})`,
      );
    }
    if (!Number.isFinite(end.x) || !Number.isFinite(end.z)) {
      throw new Error(
        `[BFSPathfinder] End tile has non-finite coords: (${end.x}, ${end.z})`,
      );
    }
    if (typeof isWalkable !== "function") {
      throw new Error(`[BFSPathfinder] isWalkable must be a function`);
    }

    // Already at destination
    if (tilesEqual(start, end)) {
      return [];
    }

    // Check if end is walkable
    const originalEnd = { x: end.x, z: end.z };
    if (!isWalkable(end)) {
      // Find nearest walkable tile to destination
      const nearestWalkable = this.findNearestWalkable(end, isWalkable);
      if (!nearestWalkable) {
        this._lastPathWasPartial = true; // Destination unreachable
        return []; // No path possible
      }
      end = nearestWalkable;
      // Mark as partial if we had to change the destination
      if (!tilesEqual(originalEnd, end)) {
        this._lastPathWasPartial = true;
      }
    }

    // BFS is the primary pathfinder (OSRS "smartpathing")
    // Note: BFS may also set _lastPathWasPartial if iteration limit is reached
    return this.findBFSPath(start, end, isWalkable);
  }

  /**
   * Multi-destination BFS: find shortest path from start to ANY destination tile.
   *
   * OSRS combat pathfinding feeds all valid interaction tiles into the pathfinder
   * and terminates as soon as any is reached. This naturally finds the shortest
   * path to the closest valid combat tile.
   *
   * @param start - Starting tile
   * @param destinations - Array of valid destination tiles (e.g. all tiles in attack range with LoS)
   * @param isWalkable - Walkability checker
   * @returns Shortest path to the nearest reachable destination, or [] if none reachable
   */
  findPathToAny(
    start: TileCoord,
    destinations: TileCoord[],
    isWalkable: WalkabilityChecker,
  ): TileCoord[] {
    if (destinations.length === 0) return [];

    // Check if already at any destination
    for (const dest of destinations) {
      if (tilesEqual(start, dest)) return [];
    }

    // Build destination lookup set for O(1) checks
    const destSet = new Set<number>();
    for (const dest of destinations) {
      destSet.add(tileKeyNumeric(dest));
    }

    // Standard BFS from start, terminate at first destination hit
    const pooledData = bfsPool.acquire();
    const { visited, parent, queue } = pooledData;

    try {
      queue.push(start);
      visited.add(tileKeyNumeric(start));

      const minX = start.x - PATHFIND_RADIUS;
      const maxX = start.x + PATHFIND_RADIUS;
      const minZ = start.z - PATHFIND_RADIUS;
      const maxZ = start.z + PATHFIND_RADIUS;
      let front = 0;

      while (front < queue.length) {
        const current = queue[front++];

        // Check if we reached ANY destination
        if (destSet.has(tileKeyNumeric(current))) {
          return this.reconstructPath(start, current, parent);
        }

        // Expand neighbors in OSRS order
        for (const dir of TILE_DIRECTIONS) {
          const nx = current.x + dir.x;
          const nz = current.z + dir.z;
          if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;

          const neighborKey = tileKeyNumeric({ x: nx, z: nz });
          if (visited.has(neighborKey)) continue;

          const neighbor: TileCoord = { x: nx, z: nz };
          if (!this.canMoveTo(current, neighbor, isWalkable)) continue;

          visited.add(neighborKey);
          parent.set(neighborKey, current);
          queue.push(neighbor);
        }
      }

      // No destination reachable — partial path to closest destination
      return this.findPartialPathToAny(start, destinations, visited, parent);
    } finally {
      bfsPool.release(pooledData);
    }
  }

  /**
   * Naive diagonal pathing — "dumb pathfinding" for NPC chase systems.
   * Moves diagonally toward target first, then cardinally.
   * This is NOT used for player movement (players use BFS).
   *
   * Exposed publicly for ChasePathfinding and NPC follow systems.
   */
  findNaivePath(
    start: TileCoord,
    end: TileCoord,
    isWalkable: WalkabilityChecker,
  ): TileCoord[] {
    const path: TileCoord[] = [];
    let current = { ...start };

    const maxIterations = 500;
    let iterations = 0;

    while (!tilesEqual(current, end) && iterations < maxIterations) {
      iterations++;

      const dx = Math.sign(end.x - current.x);
      const dz = Math.sign(end.z - current.z);

      let nextTile: TileCoord | null = null;

      if (dx !== 0 && dz !== 0) {
        const diagonal: TileCoord = { x: current.x + dx, z: current.z + dz };

        if (this.canMoveTo(current, diagonal, isWalkable)) {
          nextTile = diagonal;
        } else {
          const xDist = Math.abs(end.x - current.x);
          const zDist = Math.abs(end.z - current.z);

          if (xDist >= zDist) {
            const cardinalX: TileCoord = { x: current.x + dx, z: current.z };
            const cardinalZ: TileCoord = { x: current.x, z: current.z + dz };
            if (this.canMoveTo(current, cardinalX, isWalkable)) {
              nextTile = cardinalX;
            } else if (this.canMoveTo(current, cardinalZ, isWalkable)) {
              nextTile = cardinalZ;
            }
          } else {
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
        const cardinalX: TileCoord = { x: current.x + dx, z: current.z };
        if (this.canMoveTo(current, cardinalX, isWalkable)) {
          nextTile = cardinalX;
        }
      } else if (dz !== 0) {
        const cardinalZ: TileCoord = { x: current.x, z: current.z + dz };
        if (this.canMoveTo(current, cardinalZ, isWalkable)) {
          nextTile = cardinalZ;
        }
      }

      if (!nextTile) {
        return [];
      }

      path.push(nextTile);
      current = nextTile;

      if (path.length > 200) {
        return path;
      }
    }

    return path;
  }

  /**
   * BFS pathfinding — primary pathfinder for player movement.
   *
   * Uses object pool to minimize allocations in this hot path.
   *
   * PERFORMANCE: Limited to MAX_BFS_ITERATIONS to prevent main thread blocking.
   * If limit is reached, returns partial path to closest explored tile.
   *
   * OPTIMIZATION: Uses read index instead of queue.shift() for O(1) dequeue.
   */
  // 8000 iterations gives ~44-tile reliable radius in open terrain (4n² ≈ 8000 → n ≈ 44).
  // Raised from 2000 (~22 tiles) to cover the majority of practical click distances
  // without risking main-thread frame drops. Path continuation handles the rest.
  private readonly MAX_BFS_ITERATIONS = 8000;
  private _bfsIterationWarnings = 0;

  private findBFSPath(
    start: TileCoord,
    end: TileCoord,
    isWalkable: WalkabilityChecker,
  ): TileCoord[] {
    // Acquire pooled data structures to avoid per-call allocations
    const pooledData = bfsPool.acquire();
    const { visited, parent, queue } = pooledData;

    try {
      // Start BFS from start tile
      queue.push(start);
      // OPTIMIZATION: Use numeric key instead of string to avoid allocation
      visited.add(tileKeyNumeric(start));

      // Track bounds for 128x128 limit
      const minX = start.x - PATHFIND_RADIUS;
      const maxX = start.x + PATHFIND_RADIUS;
      const minZ = start.z - PATHFIND_RADIUS;
      const maxZ = start.z + PATHFIND_RADIUS;

      // PERFORMANCE: Track iterations to prevent blocking
      let iterations = 0;

      // OPTIMIZATION: Use read index instead of shift() - O(1) vs O(n)
      let queueReadIndex = 0;

      while (queueReadIndex < queue.length) {
        // PERFORMANCE: Check iteration limit to prevent frame drops
        if (iterations >= this.MAX_BFS_ITERATIONS) {
          // Mark path as partial due to iteration limit
          this._lastPathWasPartial = true;
          // Log warning periodically (not every path to avoid spam)
          if (this._bfsIterationWarnings % 100 === 0) {
            console.warn(
              `[BFSPathfinder] Iteration limit (${this.MAX_BFS_ITERATIONS}) reached at tile (${start.x},${start.z}), returning partial path to (${end.x},${end.z})`,
            );
          }
          this._bfsIterationWarnings++;
          // Return partial path to closest explored tile
          return this.findPartialPath(start, end, visited, parent);
        }
        iterations++;

        // O(1) dequeue using read index
        const current = queue[queueReadIndex++];

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

          // OPTIMIZATION: Use numeric key instead of string to avoid allocation
          const neighborKey = tileKeyNumeric(neighbor);

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
      this._lastPathWasPartial = true;
      return this.findPartialPath(start, end, visited, parent);
    } finally {
      // Always release back to pool
      bfsPool.release(pooledData);
    }
  }

  /**
   * Check if movement from one tile to another is valid.
   * Handles diagonal corner clipping prevention.
   */
  canMoveTo(
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
   *
   * OPTIMIZATION: Uses push + reverse instead of unshift for O(n) vs O(n²)
   * Uses numeric keys for Map lookup (no string allocation in hot path)
   */
  private reconstructPath(
    start: TileCoord,
    end: TileCoord,
    parent: Map<number, TileCoord>,
  ): TileCoord[] {
    const fullPath: TileCoord[] = [];
    let current = end;

    // Trace back from end to start (builds path in reverse order)
    while (!tilesEqual(current, start)) {
      fullPath.push(current); // O(1) instead of unshift O(n)
      // OPTIMIZATION: Use numeric key
      const parentTile = parent.get(tileKeyNumeric(current));
      if (!parentTile) break;
      current = parentTile;
    }

    // Reverse to get correct order (single O(n) pass vs O(n²) for unshift)
    fullPath.reverse();

    // Limit to reasonable max to prevent memory issues
    if (fullPath.length > 200) {
      fullPath.length = 200; // Truncate in place instead of slice()
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
   *
   * OPTIMIZATION: Uses numeric keys and parseTileKeyNumeric for fast iteration
   */
  private findPartialPath(
    start: TileCoord,
    end: TileCoord,
    visited: Set<number>,
    parent: Map<number, TileCoord>,
  ): TileCoord[] {
    // Find the visited tile closest to the destination
    let closestTile: TileCoord | null = null;
    let closestDistance = Infinity;

    // OPTIMIZATION: Parse numeric key instead of string split
    for (const key of visited) {
      // Decode numeric key: x in upper bits, z in lower bits
      const offsetZ = key % 2097152;
      const offsetX = ((key - offsetZ) / 2097152) | 0;
      const x = offsetX - 1048576;
      const z = offsetZ - 1048576;

      const distance = Math.abs(x - end.x) + Math.abs(z - end.z);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestTile = { x, z };
      }
    }

    if (!closestTile || tilesEqual(closestTile, start)) {
      return [];
    }

    return this.reconstructPath(start, closestTile, parent);
  }

  /**
   * Find a partial path when no destination is reachable (multi-destination variant).
   * Returns path to the visited tile closest to any destination.
   */
  private findPartialPathToAny(
    start: TileCoord,
    destinations: TileCoord[],
    visited: Set<number>,
    parent: Map<number, TileCoord>,
  ): TileCoord[] {
    let closestTile: TileCoord | null = null;
    let closestDistance = Infinity;

    for (const key of visited) {
      // Decode numeric key: x in upper bits, z in lower bits
      const offsetZ = key % 2097152;
      const offsetX = ((key - offsetZ) / 2097152) | 0;
      const x = offsetX - 1048576;
      const z = offsetZ - 1048576;
      const tile: TileCoord = { x, z };

      // Find minimum Manhattan distance to any destination
      let minDist = Infinity;
      for (const dest of destinations) {
        const distance = Math.abs(tile.x - dest.x) + Math.abs(tile.z - dest.z);
        if (distance < minDist) minDist = distance;
      }

      if (minDist < closestDistance) {
        closestDistance = minDist;
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
