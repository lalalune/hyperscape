/**
 * PathPersistenceManager - rules-accurate NPC path persistence
 *
 * Key classic MMORPG behaviors:
 * - Path persists when blocked by entities (retry next tick)
 * - Path clears only when blocked by terrain (safespotted)
 * - NPCs slide along obstacles when blocked
 *
 * This manager tracks path state per NPC and distinguishes between
 * entity blocking (temporary) and terrain blocking (permanent/safespot).
 *
 */

import type { TileCoord } from "./TileSystem";
import { chaseStep } from "./ChasePathfinding";

/**
 * Path state for a single NPC
 */
export interface PathState {
  /** Current path destination (null = no path) */
  targetTile: TileCoord | null;
  /** True if blocked by another entity (path should persist) */
  blockedByEntity: boolean;
  /** Number of ticks blocked (for timeout) */
  ticksBlocked: number;
  /** Last tile we tried to move to (for sliding behavior) */
  lastAttemptedTile: TileCoord | null;
}

/**
 * Block check result
 */
export interface BlockCheckResult {
  /** True if the tile is blocked */
  blocked: boolean;
  /** True if blocked by an entity (vs terrain) */
  byEntity: boolean;
}

/**
 * Callback to check if a tile is blocked and why
 */
export type BlockChecker = (
  tile: TileCoord,
  excludeNpcId: string,
) => BlockCheckResult;

/**
 * PathPersistenceManager - Manages path state for all NPCs
 *
 * Provides rules-accurate path persistence:
 * - Paths persist when blocked by entities
 * - Paths clear when blocked by terrain (safespotted)
 */
export class PathPersistenceManager {
  // Path state per NPC (keyed by NPC ID)
  private readonly _pathStates = new Map<string, PathState>();

  // Maximum ticks to stay blocked before giving up
  private readonly MAX_BLOCKED_TICKS = 10;

  /**
   * Get or create path state for an NPC
   */
  getOrCreateState(npcId: string): PathState {
    let state = this._pathStates.get(npcId);
    if (!state) {
      state = {
        targetTile: null,
        blockedByEntity: false,
        ticksBlocked: 0,
        lastAttemptedTile: null,
      };
      this._pathStates.set(npcId, state);
    }
    return state;
  }

  /**
   * Set path target for an NPC
   */
  setTarget(npcId: string, targetTile: TileCoord | null): void {
    const state = this.getOrCreateState(npcId);
    state.targetTile = targetTile;
    state.blockedByEntity = false;
    state.ticksBlocked = 0;
    state.lastAttemptedTile = null;
  }

  /**
   * Clear path for an NPC
   */
  clearPath(npcId: string): void {
    const state = this._pathStates.get(npcId);
    if (state) {
      state.targetTile = null;
      state.blockedByEntity = false;
      state.ticksBlocked = 0;
      state.lastAttemptedTile = null;
    }
  }

  /**
   * Check if NPC has an active path
   */
  hasPath(npcId: string): boolean {
    const state = this._pathStates.get(npcId);
    return state?.targetTile !== null;
  }

  /**
   * Check if NPC is currently blocked
   */
  isBlocked(npcId: string): boolean {
    const state = this._pathStates.get(npcId);
    return state?.blockedByEntity === true;
  }

  /**
   * Process movement for an NPC on this tick
   *
   * @param npcId - NPC identifier
   * @param currentTile - NPC's current tile
   * @param targetTile - Destination tile (or null to use stored path)
   * @param isWalkable - Function to check terrain walkability
   * @param checkBlock - Function to check for entity blocking
   * @returns Next tile to move to, or null if blocked/at target
   */
  processMovement(
    npcId: string,
    currentTile: TileCoord,
    targetTile: TileCoord | null,
    isWalkable: (tile: TileCoord) => boolean,
    checkBlock?: BlockChecker,
  ): TileCoord | null {
    const state = this.getOrCreateState(npcId);

    // If new target provided, update path
    if (targetTile) {
      state.targetTile = targetTile;
      state.blockedByEntity = false;
      state.ticksBlocked = 0;
    }

    // No path = no movement
    if (!state.targetTile) {
      return null;
    }

    // Calculate next step using chase pathfinding
    const nextTile = chaseStep(currentTile, state.targetTile, isWalkable);

    if (nextTile) {
      // Path is clear - move to next tile
      state.blockedByEntity = false;
      state.ticksBlocked = 0;
      state.lastAttemptedTile = null;
      return nextTile;
    }

    // Blocked - check WHY we're blocked
    if (checkBlock) {
      // Get the tile we WOULD move to if not blocked
      const desiredTile = this.getDesiredTile(currentTile, state.targetTile);

      if (desiredTile) {
        const blockResult = checkBlock(desiredTile, npcId);

        if (blockResult.blocked && blockResult.byEntity) {
          // Blocked by entity - PERSIST path (classic MMORPG behavior)
          state.blockedByEntity = true;
          state.ticksBlocked++;
          state.lastAttemptedTile = desiredTile;

          // Give up after too many ticks blocked
          if (state.ticksBlocked >= this.MAX_BLOCKED_TICKS) {
            this.clearPath(npcId);
          }

          // Still blocked - no movement
          return null;
        }
      }
    }

    // Blocked by terrain - CLEAR path (safespotted, classic MMORPG behavior)
    state.targetTile = null;
    state.blockedByEntity = false;
    state.ticksBlocked = 0;
    state.lastAttemptedTile = null;

    return null;
  }

  /**
   * Get the tile we would move to if not blocked
   * Used to check what's blocking us
   */
  private getDesiredTile(
    current: TileCoord,
    target: TileCoord,
  ): TileCoord | null {
    const dx = Math.sign(target.x - current.x);
    const dz = Math.sign(target.z - current.z);

    if (dx === 0 && dz === 0) {
      return null; // Already at target
    }

    // Priority: diagonal if moving on both axes, otherwise cardinal
    if (dx !== 0 && dz !== 0) {
      return { x: current.x + dx, z: current.z + dz };
    } else if (dx !== 0) {
      return { x: current.x + dx, z: current.z };
    } else {
      return { x: current.x, z: current.z + dz };
    }
  }

  /**
   * Get path state for debugging
   */
  getState(npcId: string): Readonly<PathState> | null {
    return this._pathStates.get(npcId) ?? null;
  }

  /**
   * Remove path state for an NPC (cleanup on despawn)
   */
  removeState(npcId: string): void {
    this._pathStates.delete(npcId);
  }

  /**
   * Clear all path states (cleanup)
   */
  clear(): void {
    this._pathStates.clear();
  }

  /**
   * Get count of NPCs with active paths (for debugging)
   */
  getActivePathCount(): number {
    let count = 0;
    for (const state of this._pathStates.values()) {
      if (state.targetTile !== null) {
        count++;
      }
    }
    return count;
  }
}

// Singleton instance
let _pathManagerInstance: PathPersistenceManager | null = null;

/**
 * Get the shared PathPersistenceManager instance
 */
export function getPathPersistenceManager(): PathPersistenceManager {
  if (!_pathManagerInstance) {
    _pathManagerInstance = new PathPersistenceManager();
  }
  return _pathManagerInstance;
}
