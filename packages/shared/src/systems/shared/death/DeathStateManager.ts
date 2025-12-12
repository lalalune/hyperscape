/**
 * DeathStateManager
 *
 * Tracks active player deaths with dual persistence:
 * - In-memory cache for fast access (client & server)
 * - Database persistence for durability (server only)
 *
 * Security note:
 * Database persistence prevents item duplication on server restart/crash.
 * If server restarts mid-death, the death lock in DB prevents re-spawning items.
 *
 * NOTE: This is just for tracking - gravestone/ground items are regular
 * world entities that persist via the entity system (like RuneScape).
 */

import type { World } from "../../../core/World";
import type { DeathLock, ZoneType } from "../../../types/death";
import type { DatabaseTransaction } from "../../../types/network/database";
import type { EntityManager } from "..";
import { Logger } from "../../../utils/Logger";

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
    tx?: DatabaseTransaction,
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
  // SECURITY: Added for pre-loading death locks on startup
  getAllDeathLocksAsync?: () => Promise<
    Array<{
      playerId: string;
      gravestoneId: string | null;
      groundItemIds: string[];
      position: { x: number; y: number; z: number };
      timestamp: number;
      zoneType: string;
      itemCount: number;
    }>
  >;
};

export class DeathStateManager {
  private entityManager: EntityManager | null = null;
  private databaseSystem: DatabaseSystem | null = null;

  // In-memory cache for fast access (both client and server)
  private activeDeaths = new Map<string, DeathLock>();

  // Reusable buffer objects for database operations (avoid allocation per call)
  private readonly dbSaveBuffer: {
    playerId: string;
    gravestoneId: string | null;
    groundItemIds: string[];
    position: { x: number; y: number; z: number };
    timestamp: number;
    zoneType: string;
    itemCount: number;
  } = {
    playerId: "",
    gravestoneId: null,
    groundItemIds: [],
    position: { x: 0, y: 0, z: 0 },
    timestamp: 0,
    zoneType: "",
    itemCount: 0,
  };

  // Reusable buffer for DeathLock reconstruction from database
  private readonly deathLockBuffer: DeathLock = {
    playerId: "",
    gravestoneId: undefined,
    groundItemIds: [],
    position: { x: 0, y: 0, z: 0 },
    timestamp: 0,
    zoneType: "" as ZoneType,
    itemCount: 0,
  };

  constructor(private world: World) {}

  /**
   * Initialize - get entity manager and database system references
   *
   * SECURITY: Pre-loads all death locks from database on server startup.
   * This prevents item duplication exploits where a player could:
   * 1. Die and have items dropped
   * 2. Server restarts before death lock is checked
   * 3. Player reconnects and items are re-dropped (duplication!)
   *
   * By pre-loading death locks, we ensure the server knows about all
   * active deaths immediately after restart.
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
        Logger.system(
          "DeathStateManager",
          "✓ Initialized with database persistence (server)",
        );

        // SECURITY: Pre-load all death locks from database
        // This prevents item duplication on server restart
        await this.preloadDeathLocks();
      } else {
        Logger.systemWarn(
          "DeathStateManager",
          "⚠️ DatabaseSystem not available - running without persistence!",
        );
      }
    } else {
      Logger.system(
        "DeathStateManager",
        "✓ Initialized (client, in-memory only)",
      );
    }
  }

  /**
   * Pre-load all death locks from database on server startup
   *
   * SECURITY: Critical for preventing item duplication after server restart.
   * Must be called during init() before any player connections are accepted.
   */
  private async preloadDeathLocks(): Promise<void> {
    if (!this.databaseSystem) return;

    // Check if the database system supports bulk loading
    if (!this.databaseSystem.getAllDeathLocksAsync) {
      Logger.systemWarn(
        "DeathStateManager",
        "⚠️ Database doesn't support bulk death lock loading - individual lookups will be used",
      );
      return;
    }

    try {
      const startTime = Date.now();
      const deathLocks = await this.databaseSystem.getAllDeathLocksAsync();

      for (const dbData of deathLocks) {
        const deathLock = this.reconstructDeathLock(dbData);
        this.activeDeaths.set(dbData.playerId, deathLock);
      }

      const duration = Date.now() - startTime;
      Logger.system(
        "DeathStateManager",
        `✓ Pre-loaded ${deathLocks.length} death locks from database (${duration}ms)`,
      );
    } catch (error) {
      Logger.systemError(
        "DeathStateManager",
        "Failed to pre-load death locks from database - using on-demand loading",
        error instanceof Error ? error : new Error(String(error)),
      );
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
    tx?: DatabaseTransaction,
  ): Promise<void> {
    if (!this.world.isServer) {
      Logger.systemError(
        "DeathStateManager",
        `Client attempted server-only death lock creation for ${playerId} - BLOCKED`,
        new Error("Client attempted server operation"),
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

    // Persist to database (server only) - prevents item duplication
    if (this.databaseSystem) {
      try {
        this.dbSaveBuffer.playerId = playerId;
        this.dbSaveBuffer.gravestoneId = options.gravestoneId ?? null;
        if (options.groundItemIds) {
          this.dbSaveBuffer.groundItemIds.length = 0;
          for (const id of options.groundItemIds) {
            this.dbSaveBuffer.groundItemIds.push(id);
          }
        } else {
          this.dbSaveBuffer.groundItemIds.length = 0;
        }
        this.dbSaveBuffer.position = options.position;
        this.dbSaveBuffer.timestamp = deathData.timestamp;
        this.dbSaveBuffer.zoneType = options.zoneType;
        this.dbSaveBuffer.itemCount = options.itemCount;

        await this.databaseSystem.saveDeathLockAsync(this.dbSaveBuffer, tx);
        Logger.system(
          "DeathStateManager",
          `✓ Persisted death lock to database for ${playerId}${tx ? " (in transaction)" : ""}`,
        );
      } catch (error) {
        Logger.systemError(
          "DeathStateManager",
          `Failed to persist death lock for ${playerId}`,
          error instanceof Error ? error : new Error(String(error)),
        );
        // If in transaction, re-throw to trigger rollback
        if (tx) {
          throw error;
        }
        // If not in transaction, continue anyway - in-memory tracking still works
      }
    }

    Logger.system(
      "DeathStateManager",
      `✓ Tracking death for ${playerId}: ${options.itemCount} items, zone: ${options.zoneType}`,
    );
  }

  /**
   * Clear death tracking (items have been looted or despawned)
   * Removes from memory AND database (server only)
   */
  async clearDeathLock(playerId: string): Promise<void> {
    // Remove from in-memory cache
    this.activeDeaths.delete(playerId);

    if (this.databaseSystem) {
      try {
        await this.databaseSystem.deleteDeathLockAsync(playerId);
        Logger.system(
          "DeathStateManager",
          `✓ Deleted death lock from database for ${playerId}`,
        );
      } catch (error) {
        Logger.systemError(
          "DeathStateManager",
          `Failed to delete death lock for ${playerId}`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    Logger.system(
      "DeathStateManager",
      `✓ Cleared death tracking for ${playerId}`,
    );
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
          const deathLock = this.reconstructDeathLock(dbData);

          this.activeDeaths.set(playerId, deathLock);
          Logger.system(
            "DeathStateManager",
            `✓ Restored death lock from database for ${playerId}`,
          );
          return deathLock;
        }
      } catch (error) {
        Logger.systemError(
          "DeathStateManager",
          `Failed to fetch death lock from database for ${playerId}`,
          error instanceof Error ? error : new Error(String(error)),
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

    // Fallback to database (server only) - used for reconnect validation
    // Prevents duplicate deaths when player reconnects after server restart
    if (this.world.isServer && this.databaseSystem) {
      try {
        const dbData = await this.databaseSystem.getDeathLockAsync(playerId);
        if (dbData) {
          // Death lock exists in database - restore to memory
          const deathLock = this.reconstructDeathLock(dbData);
          this.activeDeaths.set(playerId, deathLock);
          Logger.system(
            "DeathStateManager",
            `✓ Restored death lock from database for ${playerId} (hasActiveDeathLock check)`,
          );
          return true;
        }
      } catch (error) {
        Logger.systemError(
          "DeathStateManager",
          `Failed to check death lock in database for ${playerId}`,
          error instanceof Error ? error : new Error(String(error)),
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
    const index = deathData.groundItemIds.indexOf(itemId);
    if (index !== -1) {
      deathData.groundItemIds.splice(index, 1);
    }

    // Decrement item count
    deathData.itemCount--;

    if (deathData.itemCount === 0) {
      await this.clearDeathLock(playerId);
      Logger.system(
        "DeathStateManager",
        `✓ All items looted for ${playerId}, cleared tracking`,
      );
    } else {
      this.activeDeaths.set(playerId, deathData);

      if (this.databaseSystem) {
        try {
          this.dbSaveBuffer.playerId = playerId;
          this.dbSaveBuffer.gravestoneId = deathData.gravestoneId ?? null;
          this.dbSaveBuffer.groundItemIds.length = 0;
          for (const id of deathData.groundItemIds) {
            this.dbSaveBuffer.groundItemIds.push(id);
          }
          this.dbSaveBuffer.position = deathData.position;
          this.dbSaveBuffer.timestamp = deathData.timestamp;
          this.dbSaveBuffer.zoneType = deathData.zoneType;
          this.dbSaveBuffer.itemCount = deathData.itemCount;

          await this.databaseSystem.saveDeathLockAsync(this.dbSaveBuffer);
        } catch (error) {
          Logger.systemError(
            "DeathStateManager",
            "Failed to update death lock after item looted",
            error instanceof Error ? error : new Error(String(error)),
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

    if (this.databaseSystem) {
      try {
        await this.databaseSystem.updateGroundItemsAsync(
          playerId,
          groundItemIds,
        );
        Logger.system(
          "DeathStateManager",
          `✓ Updated database: gravestone → ground items for ${playerId}`,
        );
      } catch (error) {
        Logger.systemError(
          "DeathStateManager",
          "Failed to update database after gravestone expired",
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    Logger.system(
      "DeathStateManager",
      `✓ Gravestone expired for ${playerId}, transitioned to ${groundItemIds.length} ground items`,
    );
  }

  /**
   * Reconstruct DeathLock from database data (helper to avoid duplication)
   */
  private reconstructDeathLock(dbData: {
    playerId: string;
    gravestoneId: string | null;
    groundItemIds: string[];
    position: { x: number; y: number; z: number };
    timestamp: number;
    zoneType: string;
    itemCount: number;
  }): DeathLock {
    this.deathLockBuffer.playerId = dbData.playerId;
    this.deathLockBuffer.gravestoneId =
      dbData.gravestoneId === null ? undefined : dbData.gravestoneId;
    this.deathLockBuffer.groundItemIds = dbData.groundItemIds;
    this.deathLockBuffer.position = dbData.position;
    this.deathLockBuffer.timestamp = dbData.timestamp;
    this.deathLockBuffer.zoneType = dbData.zoneType as ZoneType;
    this.deathLockBuffer.itemCount = dbData.itemCount;

    // Create new object for storage (Map stores reference, so we need a copy)
    return { ...this.deathLockBuffer };
  }
}
