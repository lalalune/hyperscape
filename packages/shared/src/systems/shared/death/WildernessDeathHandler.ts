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
import type { DatabaseTransaction } from "../../../types/network/database";
import type { GroundItemSystem } from "../economy/GroundItemSystem";
import type { DeathStateManager } from "./DeathStateManager";
import { ZoneType } from "../../../types/death";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";
import { ticksToMs } from "../../../utils/game/CombatCalculations";
import { Logger } from "../../../utils/Logger";

export class WildernessDeathHandler {
  // Convert tick constants to ms for GroundItemOptions backwards compatibility
  private readonly GROUND_ITEM_DURATION_MS = ticksToMs(
    COMBAT_CONSTANTS.GROUND_ITEM_DESPAWN_TICKS,
  );
  private readonly LOOT_PROTECTION_DURATION_MS = ticksToMs(
    COMBAT_CONSTANTS.LOOT_PROTECTION_TICKS,
  );

  private readonly groundItemOptionsBuffer: {
    despawnTime: number;
    droppedBy: string;
    lootProtection: number;
    scatter: boolean;
    scatterRadius: number;
  } = {
    despawnTime: 0,
    droppedBy: "",
    lootProtection: 0,
    scatter: true,
    scatterRadius: 3.0,
  };

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
    tx?: DatabaseTransaction,
  ): Promise<void> {
    if (!this.world.isServer) {
      Logger.systemError(
        "WildernessDeathHandler",
        `Client attempted server-only death handling for ${playerId} - BLOCKED`,
        new Error("Client attempted server operation"),
      );
      return;
    }

    Logger.system(
      "WildernessDeathHandler",
      `Handling ${zoneType} death for ${playerId} at (${position.x}, ${position.y}, ${position.z})${tx ? " (in transaction)" : ""}`,
    );

    if (items.length === 0) {
      Logger.system(
        "WildernessDeathHandler",
        `No items to drop for ${playerId}`,
      );
      return;
    }

    this.groundItemOptionsBuffer.despawnTime = this.GROUND_ITEM_DURATION_MS;
    this.groundItemOptionsBuffer.droppedBy = playerId;
    this.groundItemOptionsBuffer.lootProtection =
      this.LOOT_PROTECTION_DURATION_MS;
    this.groundItemOptionsBuffer.scatter = true;
    this.groundItemOptionsBuffer.scatterRadius = 3.0;

    const groundItemIds = await this.groundItemManager.spawnGroundItems(
      items,
      position,
      this.groundItemOptionsBuffer,
    );

    if (groundItemIds.length === 0) {
      const errorMsg = `Failed to spawn ground items for ${playerId}`;
      Logger.systemError(
        "WildernessDeathHandler",
        errorMsg,
        new Error("Ground item spawn failed"),
      );
      if (tx) {
        throw new Error(errorMsg);
      }
      return;
    }

    await this.deathStateManager.createDeathLock(
      playerId,
      {
        groundItemIds: groundItemIds,
        position: position,
        zoneType: zoneType,
        itemCount: items.length,
      },
      tx,
    );

    Logger.system(
      "WildernessDeathHandler",
      `Spawned ${groundItemIds.length} ground items for ${playerId} in ${zoneType}`,
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
