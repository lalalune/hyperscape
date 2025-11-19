/**
 * DeathStateManager
 *
 * Tracks active player deaths with dual persistence:
 * - In-memory cache for fast access (client & server)
 * - Database persistence for durability (server only)
 *
 * CRITICAL FOR SECURITY:
 * Database persistence prevents item duplication on server restart/crash.
 * If server restarts mid-death, the death lock in DB prevents re-spawning items.
 *
 * NOTE: This is just for tracking - gravestone/ground items are regular
 * world entities that persist via the entity system (like RuneScape).
 */

import type { World } from "../../../core/World";
import type { DeathLock, ZoneType } from "../../../types/death";
import type { EntityManager } from "..";

// Type for DatabaseSystem (only available on server)
type DatabaseSystem = {
  saveDeathLockAsync: (
    data: {
      playerId: string;
      gravestoneId: string | null;
      groundItemIds: string[];
      position: { x: number; y: number; z: number };
      timestamp: number;
      zoneType: string;
      itemCount: number;
    },
    tx?: any, // Optional transaction context
  ) => Promise<void>;
  getDeathLockAsync: (playerId: string) => Promise<{
    playerId: string;
    gravestoneId: string | null;
    groundItemIds: string[];
    position: { x: number; y: number; z: number };
    timestamp: number;
    zoneType: string;
    itemCount: number;
  } | null>;
  deleteDeathLockAsync: (playerId: string) => Promise<void>;
  updateGroundItemsAsync: (
    playerId: string,
    groundItemIds: string[],
  ) => Promise<void>;
};

export class DeathStateManager {
  private entityManager: EntityManager | null = null;
  private databaseSystem: DatabaseSystem | null = null;

  // In-memory cache for fast access (both client and server)
  private activeDeaths = new Map<string, DeathLock>();

  constructor(private world: World) {}

  /**
   * Initialize - get entity manager and database system references
   */
  async init(): Promise<void> {
    this.entityManager = this.world.getSystem(
      "entity-manager",
    ) as EntityManager | null;

    // Get database system (server only)
    if (this.world.isServer) {
      this.databaseSystem = this.world.getSystem(
        "database",
      ) as unknown as DatabaseSystem | null;
      if (this.databaseSystem) {
        console.log(
          "[DeathStateManager] ✓ Initialized with database persistence (server)",
        );
      } else {
        console.warn(
          "[DeathStateManager] ⚠️ DatabaseSystem not available - running without persistence!",
        );
      }
    } else {
      console.log("[DeathStateManager] ✓ Initialized (client, in-memory only)");
    }
  }

  /**
   * Track a player death (for cleanup purposes)
   * Stores in memory AND database (server only) for crash recovery
   *
   * @param playerId - The player who died
   * @param options - Death lock options (gravestone ID, ground items, position, etc.)
   * @param tx - Optional transaction context for atomic operations (server only)
   */
  async createDeathLock(
    playerId: string,
    options: {
      gravestoneId?: string;
      groundItemIds?: string[];
      position: { x: number; y: number; z: number };
      zoneType: ZoneType;
      itemCount: number;
    },
    tx?: any, // Transaction context (server only, passed through to DatabaseSystem)
  ): Promise<void> {
    // CRITICAL: Server authority check - prevent client from creating fake death locks
    if (!this.world.isServer) {
      console.error(
        `[DeathStateManager] ⚠️  Client attempted server-only death lock creation for ${playerId} - BLOCKED`,
      );
      return;
    }

    const deathData: DeathLock = {
      playerId,
      gravestoneId: options.gravestoneId,
      groundItemIds: options.groundItemIds,
      position: options.position,
      timestamp: Date.now(),
      zoneType: options.zoneType,
      itemCount: options.itemCount,
    };

    // Always store in-memory cache
    this.activeDeaths.set(playerId, deathData);

    // Persist to database (server only) - CRITICAL for preventing item duplication!
    if (this.world.isServer && this.databaseSystem) {
      try {
        await this.databaseSystem.saveDeathLockAsync(
          {
            playerId,
            gravestoneId: options.gravestoneId || null,
            groundItemIds: options.groundItemIds || [],
            position: options.position,
            timestamp: deathData.timestamp,
            zoneType: options.zoneType,
            itemCount: options.itemCount,
          },
          tx, // Pass transaction context if provided
        );
        console.log(
          `[DeathStateManager] ✓ Persisted death lock to database for ${playerId}${tx ? " (in transaction)" : ""}`,
        );
      } catch (error) {
        console.error(
          `[DeathStateManager] ❌ Failed to persist death lock for ${playerId}:`,
          error,
        );
        // If in transaction, re-throw to trigger rollback
        if (tx) {
          throw error;
        }
        // If not in transaction, continue anyway - in-memory tracking still works
      }
    }

    console.log(
      `[DeathStateManager] ✓ Tracking death for ${playerId}: ${options.itemCount} items, zone: ${options.zoneType}`,
    );
  }

  /**
   * Clear death tracking (items have been looted or despawned)
   * Removes from memory AND database (server only)
   */
  async clearDeathLock(playerId: string): Promise<void> {
    // Remove from in-memory cache
    this.activeDeaths.delete(playerId);

    // Remove from database (server only)
    if (this.world.isServer && this.databaseSystem) {
      try {
        await this.databaseSystem.deleteDeathLockAsync(playerId);
        console.log(
          `[DeathStateManager] ✓ Deleted death lock from database for ${playerId}`,
        );
      } catch (error) {
        console.error(
          `[DeathStateManager] ❌ Failed to delete death lock for ${playerId}:`,
          error,
        );
        // Continue anyway - in-memory tracking cleared
      }
    }

    console.log(`[DeathStateManager] ✓ Cleared death tracking for ${playerId}`);
  }

  /**
   * Get active death data
   * Checks in-memory cache first, then database (server only) as fallback
   */
  async getDeathLock(playerId: string): Promise<DeathLock | null> {
    // Check in-memory cache first (fast path)
    const cached = this.activeDeaths.get(playerId);
    if (cached) {
      return cached;
    }

    // Fallback to database (server only) - critical for reconnect validation
    if (this.world.isServer && this.databaseSystem) {
      try {
        const dbData = await this.databaseSystem.getDeathLockAsync(playerId);
        if (dbData) {
          // Reconstruct DeathLock from database data
          const deathLock: DeathLock = {
            playerId: dbData.playerId,
            gravestoneId: dbData.gravestoneId || undefined,
            groundItemIds: dbData.groundItemIds,
            position: dbData.position,
            timestamp: dbData.timestamp,
            zoneType: dbData.zoneType as ZoneType,
            itemCount: dbData.itemCount,
          };

          // Restore to in-memory cache
          this.activeDeaths.set(playerId, deathLock);
          console.log(
            `[DeathStateManager] ✓ Restored death lock from database for ${playerId}`,
          );
          return deathLock;
        }
      } catch (error) {
        console.error(
          `[DeathStateManager] ❌ Failed to fetch death lock from database for ${playerId}:`,
          error,
        );
        // Fall through to return null
      }
    }

    return null;
  }

  /**
   * Check if player has active death
   * Checks in-memory cache first, then database (server only) for reconnect validation
   */
  async hasActiveDeathLock(playerId: string): Promise<boolean> {
    // Check in-memory cache first (fast path)
    if (this.activeDeaths.has(playerId)) {
      return true;
    }

    // Fallback to database (server only) - CRITICAL for reconnect validation
    // Prevents duplicate deaths when player reconnects after server restart
    if (this.world.isServer && this.databaseSystem) {
      try {
        const dbData = await this.databaseSystem.getDeathLockAsync(playerId);
        if (dbData) {
          // Death lock exists in database - restore to memory
          const deathLock: DeathLock = {
            playerId: dbData.playerId,
            gravestoneId: dbData.gravestoneId || undefined,
            groundItemIds: dbData.groundItemIds,
            position: dbData.position,
            timestamp: dbData.timestamp,
            zoneType: dbData.zoneType as ZoneType,
            itemCount: dbData.itemCount,
          };
          this.activeDeaths.set(playerId, deathLock);
          console.log(
            `[DeathStateManager] ✓ Restored death lock from database for ${playerId} (hasActiveDeathLock check)`,
          );
          return true;
        }
      } catch (error) {
        console.error(
          `[DeathStateManager] ❌ Failed to check death lock in database for ${playerId}:`,
          error,
        );
        // Fall through to return false
      }
    }

    return false;
  }

  /**
   * Handle item looted from gravestone/ground
   * Updates in-memory AND database (server only)
   */
  async onItemLooted(playerId: string, itemId: string): Promise<void> {
    const deathData = this.activeDeaths.get(playerId);
    if (!deathData) return;

    // Remove item from ground item list
    if (deathData.groundItemIds) {
      const index = deathData.groundItemIds.indexOf(itemId);
      if (index !== -1) {
        deathData.groundItemIds.splice(index, 1);
      }
    }

    // Decrement item count
    deathData.itemCount = Math.max(0, deathData.itemCount - 1);

    // If all items looted, clear death tracking
    if (deathData.itemCount === 0) {
      await this.clearDeathLock(playerId);
      console.log(
        `[DeathStateManager] ✓ All items looted for ${playerId}, cleared tracking`,
      );
    } else {
      // Update in-memory record
      this.activeDeaths.set(playerId, deathData);

      // Update database (server only)
      if (this.world.isServer && this.databaseSystem) {
        try {
          await this.databaseSystem.saveDeathLockAsync({
            playerId,
            gravestoneId: deathData.gravestoneId || null,
            groundItemIds: deathData.groundItemIds || [],
            position: deathData.position,
            timestamp: deathData.timestamp,
            zoneType: deathData.zoneType,
            itemCount: deathData.itemCount,
          });
        } catch (error) {
          console.error(
            `[DeathStateManager] ❌ Failed to update death lock after item looted:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Handle gravestone expired (transitioned to ground items)
   * Updates in-memory AND database (server only)
   */
  async onGravestoneExpired(
    playerId: string,
    groundItemIds: string[],
  ): Promise<void> {
    const deathData = this.activeDeaths.get(playerId);
    if (!deathData) return;

    // Update tracking: gravestone → ground items
    deathData.gravestoneId = undefined;
    deathData.groundItemIds = groundItemIds;
    this.activeDeaths.set(playerId, deathData);

    // Update database (server only)
    if (this.world.isServer && this.databaseSystem) {
      try {
        await this.databaseSystem.updateGroundItemsAsync(
          playerId,
          groundItemIds,
        );
        console.log(
          `[DeathStateManager] ✓ Updated database: gravestone → ground items for ${playerId}`,
        );
      } catch (error) {
        console.error(
          `[DeathStateManager] ❌ Failed to update database after gravestone expired:`,
          error,
        );
      }
    }

    console.log(
      `[DeathStateManager] ✓ Gravestone expired for ${playerId}, transitioned to ${groundItemIds.length} ground items`,
    );
  }
}
