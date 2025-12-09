/**
 * SafeAreaDeathHandler (TICK-BASED)
 *
 * Handles player death in safe zones (RuneScape-style):
 * 1. Items → gravestone (500 ticks = 5 minutes)
 * 2. Gravestone expires → ground items (200 ticks = 2 minutes)
 * 3. Ground items despawn via GroundItemSystem tick processing
 *
 * TICK-BASED TIMING (OSRS-accurate):
 * - Gravestone expiration tracked in ticks
 * - processTick() called once per tick by TickSystem
 * - Uses constants from COMBAT_CONSTANTS
 *
 * @see https://oldschool.runescape.wiki/w/Gravestone
 */

import type { World } from "../../../core/World";
import type { InventoryItem } from "../../../types/core/core";
import type { DatabaseTransaction } from "../../../types/network/database";
import type { GroundItemSystem } from "../economy/GroundItemSystem";
import type { DeathStateManager } from "./DeathStateManager";
import type { EntityManager } from "..";
import { ZoneType } from "../../../types/death";
import { EntityType, InteractionType } from "../../../types/entities";
import type { HeadstoneEntityConfig } from "../../../types/entities";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";
import { ticksToMs } from "../../../utils/game/CombatCalculations";
import { Logger } from "../../../utils/Logger";

/** Gravestone data tracked for tick-based expiration */
interface GravestoneData {
  gravestoneId: string;
  playerId: string;
  position: { x: number; y: number; z: number };
  items: InventoryItem[];
  expirationTick: number;
}

export class SafeAreaDeathHandler {
  // TICK-BASED gravestone tracking (no more setTimeout)
  private gravestones = new Map<string, GravestoneData>();

  private readonly GROUND_ITEM_DURATION_MS = ticksToMs(
    COMBAT_CONSTANTS.GROUND_ITEM_DESPAWN_TICKS,
  );

  private readonly expiredGravestonesBuffer: GravestoneData[] = [];
  private readonly itemLogBuffer: string[] = [];
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
    scatterRadius: 2.0,
  };

  constructor(
    private world: World,
    private groundItemManager: GroundItemSystem,
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
    tx?: DatabaseTransaction,
  ): Promise<void> {
    // Server authority check - prevent client from spawning fake gravestones
    if (!this.world.isServer) {
      Logger.systemError(
        "SafeAreaDeathHandler",
        `Client attempted server-only death handling for ${playerId} - BLOCKED`,
        new Error("Client attempted server operation"),
      );
      return;
    }

    Logger.system(
      "SafeAreaDeathHandler",
      `Handling safe area death for ${playerId} at (${position.x}, ${position.y}, ${position.z})${tx ? " (in transaction)" : ""}`,
    );

    this.itemLogBuffer.length = 0;
    for (const item of items) {
      this.itemLogBuffer.push(`${item.itemId} x${item.quantity}`);
    }
    Logger.system(
      "SafeAreaDeathHandler",
      `Received ${items.length} items to put in gravestone: ${this.itemLogBuffer.join(", ") || "(none)"}`,
    );

    if (items.length === 0) {
      Logger.system(
        "SafeAreaDeathHandler",
        `No items to drop for ${playerId}, skipping gravestone`,
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
      Logger.systemError(
        "SafeAreaDeathHandler",
        errorMsg,
        new Error("Gravestone spawn failed"),
      );
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

    // Track gravestone for tick-based expiration (500 ticks = 5 minutes)
    const currentTick = this.world.currentTick;
    const expirationTick = currentTick + COMBAT_CONSTANTS.GRAVESTONE_TICKS;

    this.gravestones.set(gravestoneId, {
      gravestoneId,
      playerId,
      position,
      items,
      expirationTick,
    });

    Logger.system(
      "SafeAreaDeathHandler",
      `Gravestone ${gravestoneId} will expire at tick ${expirationTick} (${COMBAT_CONSTANTS.GRAVESTONE_TICKS} ticks = ${(ticksToMs(COMBAT_CONSTANTS.GRAVESTONE_TICKS) / 1000).toFixed(1)}s)`,
    );
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
      Logger.systemError(
        "SafeAreaDeathHandler",
        "EntityManager not available",
        new Error("EntityManager missing"),
      );
      return "";
    }

    const gravestoneId = `gravestone_${playerId}_${Date.now()}`;
    // Calculate despawnTime in ms for entity config (backwards compatible)
    const despawnTime =
      Date.now() + ticksToMs(COMBAT_CONSTANTS.GRAVESTONE_TICKS);

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
        playerName: playerId, // Note: Using playerId as name - can be enhanced with PlayerSystem lookup if needed
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
      Logger.systemError(
        "SafeAreaDeathHandler",
        `Failed to spawn gravestone entity: ${gravestoneId}`,
        new Error("Gravestone spawn failed"),
      );
      return "";
    }

    Logger.system(
      "SafeAreaDeathHandler",
      `Spawned gravestone ${gravestoneId} with ${items.length} items`,
    );

    return gravestoneId;
  }

  /**
   * Process tick - check for expired gravestones (TICK-BASED)
   * Called once per tick by TickSystem
   *
   * @param currentTick - Current server tick number
   */
  processTick(currentTick: number): void {
    this.expiredGravestonesBuffer.length = 0;

    for (const gravestoneData of this.gravestones.values()) {
      if (currentTick >= gravestoneData.expirationTick) {
        this.expiredGravestonesBuffer.push(gravestoneData);
      }
    }

    for (const gravestoneData of this.expiredGravestonesBuffer) {
      this.handleGravestoneExpire(gravestoneData, currentTick);
    }
  }

  /**
   * Handle gravestone expiration (transition to ground items) - TICK-BASED
   */
  private async handleGravestoneExpire(
    gravestoneData: GravestoneData,
    currentTick: number,
  ): Promise<void> {
    const { gravestoneId, playerId, position, items } = gravestoneData;

    const ticksExisted =
      currentTick -
      (gravestoneData.expirationTick - COMBAT_CONSTANTS.GRAVESTONE_TICKS);
    Logger.system(
      "SafeAreaDeathHandler",
      `Gravestone ${gravestoneId} expired after ${ticksExisted} ticks (${(ticksToMs(ticksExisted) / 1000).toFixed(1)}s), transitioning to ground items`,
    );

    // Remove from tracking
    this.gravestones.delete(gravestoneId);

    // Destroy gravestone entity
    const entityManager = this.world.getSystem(
      "entity-manager",
    ) as EntityManager | null;
    if (entityManager) {
      entityManager.destroyEntity(gravestoneId);
    }

    this.groundItemOptionsBuffer.despawnTime = this.GROUND_ITEM_DURATION_MS;
    this.groundItemOptionsBuffer.droppedBy = playerId;
    this.groundItemOptionsBuffer.lootProtection = 0;
    this.groundItemOptionsBuffer.scatter = true;
    this.groundItemOptionsBuffer.scatterRadius = 2.0;

    const groundItemIds = await this.groundItemManager.spawnGroundItems(
      items,
      position,
      this.groundItemOptionsBuffer,
    );

    await this.deathStateManager.onGravestoneExpired(playerId, groundItemIds);

    Logger.system(
      "SafeAreaDeathHandler",
      `Transitioned gravestone ${gravestoneId} to ${groundItemIds.length} ground items`,
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
   * Cancel gravestone tracking (e.g., all items looted)
   */
  cancelGravestoneTimer(gravestoneId: string): void {
    const deleted = this.gravestones.delete(gravestoneId);
    if (deleted) {
      Logger.system(
        "SafeAreaDeathHandler",
        `Cancelled gravestone tracking for ${gravestoneId}`,
      );
    }
  }

  /**
   * Get ticks until gravestone expires (TICK-BASED)
   * @param gravestoneId - Gravestone entity ID
   * @param currentTick - Current server tick
   * @returns Ticks until expiration, or -1 if not found
   */
  getTicksUntilExpiration(gravestoneId: string, currentTick: number): number {
    const gravestoneData = this.gravestones.get(gravestoneId);
    if (!gravestoneData) return -1;
    return Math.max(0, gravestoneData.expirationTick - currentTick);
  }

  /**
   * Clean up all gravestone tracking
   */
  destroy(): void {
    this.gravestones.clear();
  }
}
