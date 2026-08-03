/**
 * EntityOccupancyMap - Tracks entity tile occupancy for collision
 *
 * rules-accurate entity collision:
 * - Each tile can be occupied by at most one NPC (for collision purposes)
 * - Players also set occupancy flags (optional - classic MMORPG does this)
 * - Bosses/special NPCs can ignore collision (configurable)
 *
 * Memory Hygiene:
 * - Uses string keys ("x,z") for O(1) lookup
 * - Pre-allocated query buffers to avoid hot path allocations
 * - No closures created during isBlocked/isOccupied checks
 *
 * - Flags set when entity spawns/moves TO a tile
 * - Flags removed when entity despawns/moves OFF a tile
 * - Pathfinder IGNORES entity collision (checked at movement time)
 * - If blocked, movement fails but path is RETAINED
 *
 * @see NPC_ENTITY_COLLISION_PLAN.md
 */

import type { EntityID } from "../../../types/core/identifiers";
import { isValidEntityID } from "../../../types/core/identifiers";
import type { TileCoord } from "./TileSystem";
import { CollisionFlag } from "./CollisionFlags";
import type { ICollisionMatrix } from "./CollisionMatrix";

// ============================================================================
// TYPES
// ============================================================================

/** Entity types that can occupy tiles */
export type OccupantType = "player" | "mob";

/**
 * Occupancy entry stored in the map
 * Kept minimal to reduce memory footprint
 */
export interface OccupancyEntry {
  readonly entityId: EntityID;
  readonly entityType: OccupantType;
  readonly ignoresCollision: boolean;
}

/**
 * Statistics for monitoring and debugging
 */
export interface OccupancyStats {
  /** Total tiles currently occupied */
  occupiedTileCount: number;
  /** Total entities being tracked */
  trackedEntityCount: number;
  /** Tiles occupied by mobs */
  mobTileCount: number;
  /** Tiles occupied by players */
  playerTileCount: number;
  /** Entities that ignore collision (bosses) */
  collisionIgnoringEntities: number;
}

/**
 * Interface for dependency injection and testing
 * Allows systems to depend on abstraction, not concrete implementation
 */
export interface IEntityOccupancy {
  /** Check if tile is blocked by another entity (respects ignoresCollision) */
  isBlocked(tile: TileCoord, excludeEntityId?: EntityID): boolean;

  /** Check if tile has any occupant (ignores collision flags) */
  isOccupied(tile: TileCoord, excludeEntityId?: EntityID): boolean;

  /** Register entity on tiles */
  occupy(
    entityId: EntityID,
    tiles: readonly TileCoord[],
    tileCount: number,
    entityType: OccupantType,
    ignoresCollision: boolean,
  ): void;

  /** Remove entity from all tiles */
  vacate(entityId: EntityID): void;

  /** Move entity to new tiles (atomic) */
  move(
    entityId: EntityID,
    newTiles: readonly TileCoord[],
    tileCount: number,
  ): void;

  /** Get occupant of a tile (for debugging) */
  getOccupant(tile: TileCoord): OccupancyEntry | null;

  /** Find first unoccupied tile from buffer */
  findUnoccupiedTileIndex(
    tiles: readonly TileCoord[],
    tileCount: number,
    excludeEntityId?: EntityID,
  ): number;

  /** Get statistics for monitoring */
  getStats(): OccupancyStats;

  /** Clear all occupancy data */
  clear(): void;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Production implementation of entity occupancy tracking
 *
 * Provides rules-accurate entity collision for NPCs and players.
 * Uses Map-based storage with O(1) lookups.
 */
export class EntityOccupancyMap implements IEntityOccupancy {
  // ============================================================================
  // STORAGE
  // ============================================================================

  /** Tile key -> OccupancyEntry (one entity per tile for blocking) */
  private readonly _occupiedTiles = new Map<string, OccupancyEntry>();

  /** EntityID -> Set of tile keys (for vacate/move operations) */
  private readonly _entityTiles = new Map<EntityID, Set<string>>();

  /** Cache entity metadata for move operations (avoids re-lookup) */
  private readonly _entityMetadata = new Map<
    EntityID,
    {
      entityType: OccupantType;
      ignoresCollision: boolean;
    }
  >();

  /**
   * Reference to CollisionMatrix for unified collision storage.
   * When set, occupy/vacate/move operations also update CollisionMatrix flags.
   */
  private _collisionMatrix: ICollisionMatrix | null = null;

  // ============================================================================
  // PRE-ALLOCATED BUFFERS (Zero-allocation hot path support)
  // ============================================================================

  /** Reusable key buffer to avoid string concatenation in hot paths */
  private _keyBuffer = "";

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /** Maximum entities to track (prevents unbounded growth) */
  private readonly MAX_ENTITIES = 10000;

  /** Maximum tiles per entity (5x5 boss = 25 tiles max) */
  private readonly MAX_TILES_PER_ENTITY = 25;

  // ============================================================================
  // COLLISION MATRIX INTEGRATION
  // ============================================================================

  /**
   * Set the CollisionMatrix reference for unified collision storage.
   * When set, occupy/vacate/move operations will also update CollisionMatrix.
   *
   * @param matrix - CollisionMatrix instance to delegate to
   */
  setCollisionMatrix(matrix: ICollisionMatrix): void {
    this._collisionMatrix = matrix;
  }

  /**
   * Get the collision flag for an entity type
   */
  private getCollisionFlag(entityType: OccupantType): number {
    return entityType === "player"
      ? CollisionFlag.OCCUPIED_PLAYER
      : CollisionFlag.OCCUPIED_NPC;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Check if tile is blocked by another entity
   *
   * Respects `ignoresCollision` flag - entities that ignore collision
   * (bosses) don't block other entities.
   *
   * Zero allocations - uses pre-allocated key buffer.
   *
   * @param tile - Tile to check
   * @param excludeEntityId - Entity to exclude from check (self)
   * @returns true if tile is blocked by another entity
   */
  isBlocked(tile: TileCoord, excludeEntityId?: EntityID): boolean {
    this._keyBuffer = `${tile.x},${tile.z}`;
    const entry = this._occupiedTiles.get(this._keyBuffer);

    if (!entry) return false;
    if (excludeEntityId && entry.entityId === excludeEntityId) return false;
    if (entry.ignoresCollision) return false;

    return true;
  }

  /**
   * Check if tile has any occupant (ignores collision flags)
   *
   * Use this for spawn validation - we don't want to spawn
   * entities on top of each other even if one ignores collision.
   *
   * Zero allocations - uses pre-allocated key buffer.
   *
   * @param tile - Tile to check
   * @param excludeEntityId - Entity to exclude from check
   * @returns true if tile is occupied by any entity
   */
  isOccupied(tile: TileCoord, excludeEntityId?: EntityID): boolean {
    this._keyBuffer = `${tile.x},${tile.z}`;
    const entry = this._occupiedTiles.get(this._keyBuffer);

    if (!entry) return false;
    if (excludeEntityId && entry.entityId === excludeEntityId) return false;

    return true;
  }

  /**
   * Register entity on tiles
   *
   * Sets collision flags for all tiles the entity occupies.
   * For multi-tile NPCs (2x2, 3x3), pass all tiles in the buffer.
   *
   * @param entityId - Entity ID (must be valid EntityID)
   * @param tiles - Pre-allocated tile buffer
   * @param tileCount - Number of valid tiles in buffer
   * @param entityType - "player" or "mob"
   * @param ignoresCollision - If true, this entity doesn't block others (bosses)
   */
  occupy(
    entityId: EntityID,
    tiles: readonly TileCoord[],
    tileCount: number,
    entityType: OccupantType,
    ignoresCollision: boolean,
  ): void {
    // Validation
    if (!isValidEntityID(entityId)) {
      console.warn("[EntityOccupancyMap] Invalid entityId in occupy()");
      return;
    }

    if (tileCount <= 0 || tileCount > this.MAX_TILES_PER_ENTITY) {
      console.warn(`[EntityOccupancyMap] Invalid tileCount: ${tileCount}`);
      return;
    }

    if (this._entityTiles.size >= this.MAX_ENTITIES) {
      console.error("[EntityOccupancyMap] Max entity limit reached");
      return;
    }

    // Clean up any existing occupancy for this entity
    this.vacate(entityId);

    // Create entry (single allocation, reused for all tiles)
    const entry: OccupancyEntry = {
      entityId,
      entityType,
      ignoresCollision,
    };

    // Cache metadata for move operations
    this._entityMetadata.set(entityId, { entityType, ignoresCollision });

    // Track tiles for this entity
    const tileKeys = new Set<string>();

    // Get collision flag for this entity type (only used if not ignoring collision)
    const collisionFlag = ignoresCollision
      ? 0
      : this.getCollisionFlag(entityType);

    for (let i = 0; i < tileCount; i++) {
      const tile = tiles[i];
      if (!this.isValidTile(tile)) continue;

      const key = `${tile.x},${tile.z}`;
      this._occupiedTiles.set(key, entry);
      tileKeys.add(key);

      // Add to CollisionMatrix if entity blocks movement
      if (this._collisionMatrix && collisionFlag) {
        this._collisionMatrix.addFlags(tile.x, tile.z, collisionFlag);
      }
    }

    this._entityTiles.set(entityId, tileKeys);
  }

  /**
   * Remove entity from all occupied tiles
   *
   * Clears collision flags for all tiles this entity occupies.
   * Called when entity dies, despawns, or disconnects.
   *
   * @param entityId - Entity to remove
   */
  vacate(entityId: EntityID): void {
    if (!isValidEntityID(entityId)) return;

    const tileKeys = this._entityTiles.get(entityId);
    if (!tileKeys) return;

    // Get metadata before cleanup (needed for collision flag removal)
    const metadata = this._entityMetadata.get(entityId);
    const collisionFlag =
      metadata && !metadata.ignoresCollision
        ? this.getCollisionFlag(metadata.entityType)
        : 0;

    // Remove all tile entries
    for (const key of tileKeys) {
      this._occupiedTiles.delete(key);

      // Remove from CollisionMatrix if entity was blocking
      if (this._collisionMatrix && collisionFlag) {
        const [x, z] = key.split(",").map(Number);
        this._collisionMatrix.removeFlags(x, z, collisionFlag);
      }
    }

    // Cleanup tracking
    this._entityTiles.delete(entityId);
    this._entityMetadata.delete(entityId);
  }

  /**
   * Move entity to new tiles (atomic operation with delta-based CollisionMatrix updates)
   *
   * Follows classic MMORPG flag update order:
   * 1. Remove flags from old tiles not in new position
   * 2. Add flags on new tiles not in old position
   * 3. Update internal tracking
   *
   * Delta optimization: Only modify tiles that actually changed.
   * For a 3x3 boss moving 1 tile: 6 unchanged, 3 removed, 3 added.
   *
   * Uses cached metadata to avoid re-specifying entityType/ignoresCollision.
   *
   * @param entityId - Entity to move
   * @param newTiles - Pre-allocated tile buffer with new positions
   * @param tileCount - Number of valid tiles in buffer
   */
  move(
    entityId: EntityID,
    newTiles: readonly TileCoord[],
    tileCount: number,
  ): void {
    const metadata = this._entityMetadata.get(entityId);
    if (!metadata) {
      console.warn(
        `[EntityOccupancyMap] Cannot move unknown entity: ${entityId}`,
      );
      return;
    }

    const oldTileKeys = this._entityTiles.get(entityId);
    if (!oldTileKeys) {
      // Entity not tracked, treat as occupy()
      this.occupy(
        entityId,
        newTiles,
        tileCount,
        metadata.entityType,
        metadata.ignoresCollision,
      );
      return;
    }

    // Build set of new tile keys for delta calculation
    const newTileKeySet = new Set<string>();
    for (let i = 0; i < tileCount; i++) {
      const tile = newTiles[i];
      if (!this.isValidTile(tile)) continue;
      newTileKeySet.add(`${tile.x},${tile.z}`);
    }

    // Get collision flag (0 if entity ignores collision)
    const collisionFlag = metadata.ignoresCollision
      ? 0
      : this.getCollisionFlag(metadata.entityType);

    // Create entry for new tiles
    const entry: OccupancyEntry = {
      entityId,
      entityType: metadata.entityType,
      ignoresCollision: metadata.ignoresCollision,
    };

    // Step 1: Remove from tiles we're leaving (in old but not in new)
    for (const oldKey of oldTileKeys) {
      if (!newTileKeySet.has(oldKey)) {
        this._occupiedTiles.delete(oldKey);

        // Remove from CollisionMatrix
        if (this._collisionMatrix && collisionFlag) {
          const [x, z] = oldKey.split(",").map(Number);
          this._collisionMatrix.removeFlags(x, z, collisionFlag);
        }
      }
    }

    // Step 2: Add to tiles we're entering (in new but not in old)
    for (let i = 0; i < tileCount; i++) {
      const tile = newTiles[i];
      if (!this.isValidTile(tile)) continue;

      const key = `${tile.x},${tile.z}`;
      this._occupiedTiles.set(key, entry);

      // Add to CollisionMatrix only if tile is new
      if (this._collisionMatrix && collisionFlag && !oldTileKeys.has(key)) {
        this._collisionMatrix.addFlags(tile.x, tile.z, collisionFlag);
      }
    }

    // Step 3: Update tracking to new tile set
    this._entityTiles.set(entityId, newTileKeySet);
  }

  /**
   * Get occupant of a tile (for debugging/admin tools)
   *
   * @param tile - Tile to check
   * @returns Occupancy entry or null if unoccupied
   */
  getOccupant(tile: TileCoord): OccupancyEntry | null {
    this._keyBuffer = `${tile.x},${tile.z}`;
    return this._occupiedTiles.get(this._keyBuffer) ?? null;
  }

  /**
   * Find first unoccupied tile from buffer (zero-allocation)
   *
   * Useful for finding valid combat tiles when some are blocked.
   *
   * @param tiles - Pre-allocated tile buffer to search
   * @param tileCount - Number of valid tiles in buffer
   * @param excludeEntityId - Entity to exclude from blocking check
   * @returns Index of first unoccupied tile, or -1 if all blocked
   */
  findUnoccupiedTileIndex(
    tiles: readonly TileCoord[],
    tileCount: number,
    excludeEntityId?: EntityID,
  ): number {
    for (let i = 0; i < tileCount; i++) {
      if (!this.isBlocked(tiles[i], excludeEntityId)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Get statistics for monitoring dashboard
   *
   * Provides insight into occupancy state for debugging and performance monitoring.
   */
  getStats(): OccupancyStats {
    let mobTileCount = 0;
    let playerTileCount = 0;
    let collisionIgnoringEntities = 0;

    const countedEntities = new Set<EntityID>();

    for (const entry of this._occupiedTiles.values()) {
      if (entry.entityType === "mob") mobTileCount++;
      else playerTileCount++;

      if (!countedEntities.has(entry.entityId)) {
        countedEntities.add(entry.entityId);
        if (entry.ignoresCollision) collisionIgnoringEntities++;
      }
    }

    return {
      occupiedTileCount: this._occupiedTiles.size,
      trackedEntityCount: this._entityTiles.size,
      mobTileCount,
      playerTileCount,
      collisionIgnoringEntities,
    };
  }

  /**
   * Clear all occupancy data (for world reset/testing)
   */
  clear(): void {
    this._occupiedTiles.clear();
    this._entityTiles.clear();
    this._entityMetadata.clear();
  }

  /**
   * Cleanup stale entries for entities that no longer exist
   *
   * Call periodically (e.g., every 100 ticks) to prevent memory leaks
   * from entities that crashed without proper cleanup.
   *
   * @param isEntityAlive - Function to check if entity still exists
   * @returns Number of stale entities removed
   */
  cleanupStaleEntries(isEntityAlive: (id: EntityID) => boolean): number {
    let removed = 0;

    for (const entityId of this._entityTiles.keys()) {
      if (!isEntityAlive(entityId)) {
        this.vacate(entityId);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[EntityOccupancyMap] Cleaned up ${removed} stale entries`);
    }

    return removed;
  }

  /**
   * Check if entity is currently tracked
   *
   * @param entityId - Entity to check
   * @returns true if entity has registered occupancy
   */
  hasEntity(entityId: EntityID): boolean {
    return this._entityTiles.has(entityId);
  }

  /**
   * Get tile count for an entity
   *
   * @param entityId - Entity to check
   * @returns Number of tiles occupied, or 0 if not tracked
   */
  getEntityTileCount(entityId: EntityID): number {
    return this._entityTiles.get(entityId)?.size ?? 0;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Validate tile coordinates (prevent NaN/Infinity)
   */
  private isValidTile(tile: TileCoord): boolean {
    return (
      Number.isFinite(tile.x) &&
      Number.isFinite(tile.z) &&
      Number.isInteger(tile.x) &&
      Number.isInteger(tile.z)
    );
  }
}

/**
 * Singleton instance for common use cases
 * (World will create its own instance for isolation)
 */
export const entityOccupancyMap = new EntityOccupancyMap();
