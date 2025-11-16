/**
 * WildernessDeathHandler
 *
 * Handles player death in wilderness/PvP zones (RuneScape-style):
 * 1. Items → ground items immediately (2 minutes)
 * 2. Ground items despawn
 * No gravestone protection in dangerous areas
 */

import type { World } from "../../../core/World";
import type { InventoryItem } from "../../../types/core/core";
import type { GroundItemManager } from "./GroundItemManager";
import type { DeathStateManager } from "./DeathStateManager";
import { ZoneType } from "../../../types/death";

export class WildernessDeathHandler {
  private readonly GROUND_ITEM_DURATION = 2 * 60 * 1000; // 2 minutes
  private readonly LOOT_PROTECTION_DURATION = 60 * 1000; // 1 minute (only for killer)

  constructor(
    private world: World,
    private groundItemManager: GroundItemManager,
    private deathStateManager: DeathStateManager,
  ) {}

  /**
   * Handle player death in wilderness/PvP zone
   */
  async handleDeath(
    playerId: string,
    position: { x: number; y: number; z: number },
    items: InventoryItem[],
    killedBy: string,
    zoneType: ZoneType,
  ): Promise<void> {
    console.log(
      `[WildernessDeathHandler] Handling ${zoneType} death for ${playerId} at (${position.x}, ${position.y}, ${position.z})`,
    );

    if (items.length === 0) {
      console.log(`[WildernessDeathHandler] No items to drop for ${playerId}`);
      return;
    }

    // Spawn ground items immediately (no gravestone in wilderness)
    const groundItemIds = await this.groundItemManager.spawnGroundItems(
      items,
      position,
      {
        despawnTime: this.GROUND_ITEM_DURATION,
        droppedBy: playerId,
        lootProtection: this.LOOT_PROTECTION_DURATION, // 1 minute protection for killer
        scatter: true,
        scatterRadius: 3.0, // Wider scatter in wilderness
      },
    );

    if (groundItemIds.length === 0) {
      console.error(
        `[WildernessDeathHandler] Failed to spawn ground items for ${playerId}`,
      );
      return;
    }

    // Create death lock in database
    await this.deathStateManager.createDeathLock(playerId, {
      groundItemIds: groundItemIds,
      position: position,
      zoneType: zoneType,
      itemCount: items.length,
    });

    console.log(
      `[WildernessDeathHandler] Spawned ${groundItemIds.length} ground items for ${playerId} in ${zoneType}`,
    );
  }

  /**
   * Handle item looted from ground
   */
  async onItemLooted(playerId: string, itemId: string): Promise<void> {
    await this.deathStateManager.onItemLooted(playerId, itemId);
  }

  /**
   * Clean up (no timers to manage, GroundItemManager handles despawn)
   */
  destroy(): void {
    // No cleanup needed - GroundItemManager handles all timers
  }
}
