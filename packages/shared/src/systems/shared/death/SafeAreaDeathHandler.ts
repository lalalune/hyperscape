/**
 * SafeAreaDeathHandler
 *
 * Handles player death in safe zones (RuneScape-style):
 * 1. Items → gravestone (5 minutes)
 * 2. Gravestone expires → ground items (2 minutes)
 * 3. Ground items despawn
 */

import type { World } from "../../../core/World";
import type { InventoryItem } from "../../../types/core/core";
import type { GroundItemManager } from "./GroundItemManager";
import type { DeathStateManager } from "./DeathStateManager";
import type { LootSystem } from "../economy/LootSystem";
import type { EntityManager } from "..";
import { ZoneType } from "../../../types/death";
import { EntityType, InteractionType } from "../../../types/entities";
import type { HeadstoneEntityConfig } from "../../../types/entities";

export class SafeAreaDeathHandler {
  private gravestoneTimers = new Map<string, NodeJS.Timeout>();
  private readonly GRAVESTONE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly GROUND_ITEM_DURATION = 2 * 60 * 1000; // 2 minutes

  constructor(
    private world: World,
    private groundItemManager: GroundItemManager,
    private deathStateManager: DeathStateManager,
  ) {}

  /**
   * Handle player death in safe area
   *
   * @param playerId - The player who died
   * @param position - Death position
   * @param items - Items to drop in gravestone
   * @param killedBy - Who/what killed the player
   * @param tx - Optional transaction context for atomic operations
   */
  async handleDeath(
    playerId: string,
    position: { x: number; y: number; z: number },
    items: InventoryItem[],
    killedBy: string,
    tx?: any, // Transaction context for atomic death processing
  ): Promise<void> {
    // CRITICAL: Server authority check - prevent client from spawning fake gravestones
    if (!this.world.isServer) {
      console.error(
        `[SafeAreaDeathHandler] ⚠️  Client attempted server-only death handling for ${playerId} - BLOCKED`,
      );
      return;
    }

    console.log(
      `[SafeAreaDeathHandler] Handling safe area death for ${playerId} at (${position.x}, ${position.y}, ${position.z})${tx ? " (in transaction)" : ""}`,
    );
    console.log(
      `[SafeAreaDeathHandler] Received ${items.length} items to put in gravestone:`,
      items.map((item) => `${item.itemId} x${item.quantity}`).join(", ") ||
        "(none)",
    );

    if (items.length === 0) {
      console.log(
        `[SafeAreaDeathHandler] No items to drop for ${playerId}, skipping gravestone`,
      );
      return;
    }

    // Spawn gravestone with items
    const gravestoneId = await this.spawnGravestone(
      playerId,
      position,
      items,
      killedBy,
    );

    if (!gravestoneId) {
      const errorMsg = `Failed to spawn gravestone for ${playerId}`;
      console.error(`[SafeAreaDeathHandler] ${errorMsg}`);
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
        gravestoneId: gravestoneId,
        position: position,
        zoneType: ZoneType.SAFE_AREA,
        itemCount: items.length,
      },
      tx, // Pass transaction context
    );

    // Schedule gravestone expiration (5 minutes)
    this.scheduleGravestoneExpiration(playerId, gravestoneId, position, items);
  }

  /**
   * Spawn gravestone entity with items
   */
  private async spawnGravestone(
    playerId: string,
    position: { x: number; y: number; z: number },
    items: InventoryItem[],
    killedBy: string,
  ): Promise<string> {
    const entityManager = this.world.getSystem(
      "entity-manager",
    ) as EntityManager | null;
    if (!entityManager) {
      console.error("[SafeAreaDeathHandler] EntityManager not available");
      return "";
    }

    const gravestoneId = `gravestone_${playerId}_${Date.now()}`;
    const despawnTime = Date.now() + this.GRAVESTONE_DURATION;

    // Create gravestone entity
    const gravestoneConfig: HeadstoneEntityConfig = {
      id: gravestoneId,
      name: `${playerId}'s Gravestone`,
      type: EntityType.HEADSTONE,
      position: position,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.LOOT,
      interactionDistance: 2,
      description: `Gravestone of ${playerId} (killed by ${killedBy})`,
      model: "models/environment/gravestone.glb",
      headstoneData: {
        playerId: playerId,
        playerName: playerId, // TODO: Get actual player name
        deathTime: Date.now(),
        deathMessage: `Slain by ${killedBy}`,
        position: position,
        items: items,
        itemCount: items.length,
        despawnTime: despawnTime,
        // Safe area - no loot protection (anyone can loot immediately)
        lootProtectionUntil: 0,
        protectedFor: undefined,
      },
      properties: {
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        health: { current: 1, max: 1 },
        level: 1,
      },
    };

    const gravestoneEntity = await entityManager.spawnEntity(gravestoneConfig);

    if (!gravestoneEntity) {
      console.error(
        `[SafeAreaDeathHandler] Failed to spawn gravestone entity: ${gravestoneId}`,
      );
      return "";
    }

    console.log(
      `[SafeAreaDeathHandler] Spawned gravestone ${gravestoneId} with ${items.length} items`,
    );

    return gravestoneId;
  }

  /**
   * Schedule gravestone expiration timer
   */
  private scheduleGravestoneExpiration(
    playerId: string,
    gravestoneId: string,
    position: { x: number; y: number; z: number },
    items: InventoryItem[],
  ): void {
    const timer = setTimeout(() => {
      this.handleGravestoneExpire(playerId, gravestoneId, position, items);
    }, this.GRAVESTONE_DURATION);

    this.gravestoneTimers.set(gravestoneId, timer);

    console.log(
      `[SafeAreaDeathHandler] Scheduled gravestone expiration for ${gravestoneId} in ${this.GRAVESTONE_DURATION / 1000}s`,
    );
  }

  /**
   * Handle gravestone expiration (transition to ground items)
   */
  private async handleGravestoneExpire(
    playerId: string,
    gravestoneId: string,
    position: { x: number; y: number; z: number },
    items: InventoryItem[],
  ): Promise<void> {
    console.log(
      `[SafeAreaDeathHandler] Gravestone ${gravestoneId} expired, transitioning to ground items`,
    );

    // Destroy gravestone entity
    const entityManager = this.world.getSystem(
      "entity-manager",
    ) as EntityManager | null;
    if (entityManager) {
      entityManager.destroyEntity(gravestoneId);
    }

    // Spawn ground items
    const groundItemIds = await this.groundItemManager.spawnGroundItems(
      items,
      position,
      {
        despawnTime: this.GROUND_ITEM_DURATION,
        droppedBy: playerId,
        lootProtection: 0, // No loot protection after gravestone expires
        scatter: true,
        scatterRadius: 2.0,
      },
    );

    // Update death lock
    await this.deathStateManager.onGravestoneExpired(playerId, groundItemIds);

    // Clear timer
    this.gravestoneTimers.delete(gravestoneId);

    console.log(
      `[SafeAreaDeathHandler] Transitioned gravestone ${gravestoneId} to ${groundItemIds.length} ground items`,
    );
  }

  /**
   * Handle item looted from gravestone
   * Called when player interacts with gravestone and takes an item
   */
  async onItemLooted(playerId: string, itemId: string): Promise<void> {
    await this.deathStateManager.onItemLooted(playerId, itemId);
  }

  /**
   * Cancel gravestone timer (e.g., all items looted)
   */
  cancelGravestoneTimer(gravestoneId: string): void {
    const timer = this.gravestoneTimers.get(gravestoneId);
    if (timer) {
      clearTimeout(timer);
      this.gravestoneTimers.delete(gravestoneId);
      console.log(
        `[SafeAreaDeathHandler] Cancelled gravestone timer for ${gravestoneId}`,
      );
    }
  }

  /**
   * Clean up all gravestone timers
   */
  destroy(): void {
    for (const timer of this.gravestoneTimers.values()) {
      clearTimeout(timer);
    }
    this.gravestoneTimers.clear();
  }
}
