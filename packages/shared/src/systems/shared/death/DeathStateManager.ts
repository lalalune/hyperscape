/**
 * DeathStateManager
 *
 * Simple in-memory tracker for active player deaths.
 * Tracks which players have gravestones/ground items for cleanup purposes.
 *
 * NOTE: This is just for tracking - gravestone/ground items are regular
 * world entities that persist via the entity system (like RuneScape).
 */

import type { World } from "../../../core/World";
import type { DeathLock, ZoneType } from "../../../types/death";
import type { EntityManager } from "..";

export class DeathStateManager {
  private entityManager: EntityManager | null = null;

  // Simple in-memory tracking (only for cleanup on logout)
  private activeDeaths = new Map<string, DeathLock>();

  constructor(private world: World) {}

  /**
   * Initialize - get entity manager reference
   */
  async init(): Promise<void> {
    this.entityManager = this.world.getSystem(
      "entity-manager",
    ) as EntityManager | null;
    console.log("[DeathStateManager] ✓ Initialized (in-memory tracking only)");
  }

  /**
   * Track a player death (for cleanup purposes)
   * Just stores in memory - gravestone/items are regular world entities
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
  ): Promise<void> {
    const deathData: DeathLock = {
      playerId,
      gravestoneId: options.gravestoneId,
      groundItemIds: options.groundItemIds,
      position: options.position,
      timestamp: Date.now(),
      zoneType: options.zoneType,
      itemCount: options.itemCount,
    };

    this.activeDeaths.set(playerId, deathData);

    console.log(
      `[DeathStateManager] ✓ Tracking death for ${playerId}: ${options.itemCount} items, zone: ${options.zoneType}`,
    );
  }

  /**
   * Clear death tracking (items have been looted or despawned)
   */
  async clearDeathLock(playerId: string): Promise<void> {
    this.activeDeaths.delete(playerId);
    console.log(`[DeathStateManager] ✓ Cleared death tracking for ${playerId}`);
  }

  /**
   * Get active death data
   */
  async getDeathLock(playerId: string): Promise<DeathLock | null> {
    return this.activeDeaths.get(playerId) || null;
  }

  /**
   * Check if player has active death
   */
  async hasActiveDeathLock(playerId: string): Promise<boolean> {
    return this.activeDeaths.has(playerId);
  }

  /**
   * Handle item looted from gravestone/ground
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
    }
  }

  /**
   * Handle gravestone expired (transitioned to ground items)
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

    console.log(
      `[DeathStateManager] ✓ Gravestone expired for ${playerId}, transitioned to ${groundItemIds.length} ground items`,
    );
  }
}
