/**
 * WildernessDeathHandler (TICK-BASED)
 *
 * Handles player death in wilderness/PvP zones (RuneScape-style):
 * 1. Items → ground items immediately (200 ticks = 2 minutes)
 * 2. Ground items despawn via GroundItemSystem tick processing
 * No gravestone protection in dangerous areas
 *
 * TICK-BASED TIMING (OSRS-accurate):
 * - Uses tick constants from COMBAT_CONSTANTS
 * - Ground item despawn handled by GroundItemSystem.processTick()
 * - Loot protection expires after 100 ticks (1 minute)
 *
 * @see https://oldschool.runescape.wiki/w/Wilderness#Death
 */

import type { World } from "../../../core/World";
import type { InventoryItem } from "../../../types/core/core";
import type { GroundItemSystem } from "../economy/GroundItemSystem";
import type { DeathStateManager } from "./DeathStateManager";
import { ZoneType } from "../../../types/death";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";
import { ticksToMs } from "../../../utils/game/CombatCalculations";

export class WildernessDeathHandler {
  // Convert tick constants to ms for GroundItemOptions backwards compatibility
  private readonly GROUND_ITEM_DURATION_MS = ticksToMs(
    COMBAT_CONSTANTS.GROUND_ITEM_DESPAWN_TICKS,
  );
  private readonly LOOT_PROTECTION_DURATION_MS = ticksToMs(
    COMBAT_CONSTANTS.LOOT_PROTECTION_TICKS,
  );

  constructor(
    private world: World,
    private groundItemManager: GroundItemSystem,
    private deathStateManager: DeathStateManager,
  ) {}

  /**
   * Handle player death in wilderness/PvP zone
   *
   * @param playerId - The player who died
   * @param position - Death position
   * @param items - Items to drop as ground items
   * @param killedBy - Who/what killed the player
   * @param zoneType - Zone type (wilderness, pvp, etc.)
   * @param tx - Optional transaction context for atomic operations
   */
  async handleDeath(
    playerId: string,
    position: { x: number; y: number; z: number },
    items: InventoryItem[],
    killedBy: string,
    zoneType: ZoneType,
    tx?: any, // Transaction context for atomic death processing
  ): Promise<void> {
    // CRITICAL: Server authority check - prevent client from spawning fake ground items
    if (!this.world.isServer) {
      console.error(
        `[WildernessDeathHandler] ⚠️  Client attempted server-only death handling for ${playerId} - BLOCKED`,
      );
      return;
    }

    console.log(
      `[WildernessDeathHandler] Handling ${zoneType} death for ${playerId} at (${position.x}, ${position.y}, ${position.z})${tx ? " (in transaction)" : ""}`,
    );

    if (items.length === 0) {
      console.log(`[WildernessDeathHandler] No items to drop for ${playerId}`);
      return;
    }

    // Spawn ground items immediately (no gravestone in wilderness)
    // Uses ms values for GroundItemOptions, internally converted to ticks by GroundItemSystem
    const groundItemIds = await this.groundItemManager.spawnGroundItems(
      items,
      position,
      {
        despawnTime: this.GROUND_ITEM_DURATION_MS, // 200 ticks = 2 minutes
        droppedBy: playerId,
        lootProtection: this.LOOT_PROTECTION_DURATION_MS, // 100 ticks = 1 minute protection for killer
        scatter: true,
        scatterRadius: 3.0, // Wider scatter in wilderness
      },
    );

    if (groundItemIds.length === 0) {
      const errorMsg = `Failed to spawn ground items for ${playerId}`;
      console.error(`[WildernessDeathHandler] ${errorMsg}`);
      // If in transaction, throw to trigger rollback
      if (tx) {
        throw new Error(errorMsg);
      }
      return;
    }

    // Create death lock in database (with transaction if provided)
    await this.deathStateManager.createDeathLock(
      playerId,
      {
        groundItemIds: groundItemIds,
        position: position,
        zoneType: zoneType,
        itemCount: items.length,
      },
      tx, // Pass transaction context
    );

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
   * Clean up (no timers to manage, GroundItemSystem handles despawn)
   */
  destroy(): void {
    // No cleanup needed - GroundItemSystem handles all timers
  }
}
