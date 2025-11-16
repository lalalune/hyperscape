/**
 * GroundItemManager
 *
 * Manages lifecycle of ALL ground items (player death + mob loot).
 * Extracted from LootSystem for DRY principle.
 * Handles spawning, despawn timers, and cleanup.
 */

import type { World } from "../../../core/World";
import type { EntityManager } from "..";
import type { InventoryItem } from "../../../types/core/core";
import type { GroundItemOptions, GroundItemData } from "../../../types/death";
import { EventType } from "../../../types/events";
import {
  EntityType,
  InteractionType,
  ItemRarity,
} from "../../../types/entities";
import type { ItemEntityConfig } from "../../../types/entities";
import { groundToTerrain } from "../../../utils/game/EntityUtils";
import { getItem } from "../../../data/items";

export class GroundItemManager {
  private groundItems = new Map<string, GroundItemData>();
  private despawnTimers = new Map<string, NodeJS.Timeout>();
  private nextItemId = 1;

  constructor(
    private world: World,
    private entityManager: EntityManager,
  ) {}

  /**
   * Spawn a single ground item
   */
  async spawnGroundItem(
    itemId: string,
    quantity: number,
    position: { x: number; y: number; z: number },
    options: GroundItemOptions,
  ): Promise<string> {
    const item = getItem(itemId);
    if (!item) {
      console.warn(`[GroundItemManager] Unknown item: ${itemId}`);
      return "";
    }

    const dropId = `ground_item_${this.nextItemId++}`;
    const now = Date.now();

    // Ground item to terrain
    const groundedPosition = groundToTerrain(
      this.world,
      position,
      0.2,
      Infinity,
    );

    // Create item entity
    const itemEntity = await this.entityManager.spawnEntity({
      id: dropId,
      name: `${item.name} (${quantity})`,
      type: EntityType.ITEM,
      position: groundedPosition,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.PICKUP,
      interactionDistance: 2,
      description: item.description || "",
      model: item.modelPath || null,
      itemId: item.id,
      itemType: this.getItemTypeString(item.type),
      quantity: quantity,
      stackable: item.stackable ?? false,
      value: item.value ?? 0,
      weight: item.weight || 1.0,
      rarity: item.rarity || ItemRarity.COMMON,
      stats: {},
      requirements: { level: 1 },
      effects: [],
      armorSlot: null,
      examine: item.examine || "",
      modelPath: item.modelPath || "",
      iconPath: item.iconPath || "",
      healAmount: item.healAmount || 0,
      properties: {
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        health: { current: 1, max: 1 },
        level: 1,
        itemId: item.id,
        harvestable: false,
        dialogue: [],
        quantity: quantity,
        stackable: item.stackable ?? false,
        value: item.value ?? 0,
        weight: item.weight || 1.0,
        rarity: item.rarity,
      },
    } as ItemEntityConfig);

    if (!itemEntity) {
      console.error(`[GroundItemManager] Failed to spawn item: ${itemId}`);
      return "";
    }

    // Track ground item
    const groundItemData: GroundItemData = {
      entityId: dropId,
      itemId: itemId,
      quantity: quantity,
      position: groundedPosition,
      despawnTime: now + options.despawnTime,
      droppedBy: options.droppedBy,
      lootProtectionUntil: options.lootProtection
        ? now + options.lootProtection
        : undefined,
      spawnedAt: now,
    };

    this.groundItems.set(dropId, groundItemData);

    // Schedule despawn
    this.scheduleItemDespawn(dropId, options.despawnTime);

    console.log(
      `[GroundItemManager] Spawned ground item ${dropId} (${itemId} x${quantity}) at (${groundedPosition.x}, ${groundedPosition.y}, ${groundedPosition.z})`,
    );

    return dropId;
  }

  /**
   * Spawn multiple ground items (from player death or mob loot)
   */
  async spawnGroundItems(
    items: InventoryItem[],
    position: { x: number; y: number; z: number },
    options: GroundItemOptions,
  ): Promise<string[]> {
    const entityIds: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Calculate scatter position
      let itemPosition = { ...position };
      if (options.scatter) {
        const radius = options.scatterRadius || 2.0;
        const offsetX = (Math.random() - 0.5) * radius;
        const offsetZ = (Math.random() - 0.5) * radius;
        itemPosition = {
          x: position.x + offsetX,
          y: position.y,
          z: position.z + offsetZ,
        };
      }

      const entityId = await this.spawnGroundItem(
        item.itemId,
        item.quantity,
        itemPosition,
        options,
      );

      if (entityId) {
        entityIds.push(entityId);
      }
    }

    console.log(
      `[GroundItemManager] Spawned ${entityIds.length} ground items at (${position.x}, ${position.y}, ${position.z})`,
    );

    return entityIds;
  }

  /**
   * Schedule item despawn
   */
  private scheduleItemDespawn(itemId: string, delay: number): void {
    const timer = setTimeout(() => {
      this.handleItemExpire(itemId);
    }, delay);

    this.despawnTimers.set(itemId, timer);
  }

  /**
   * Handle item expiration
   */
  private handleItemExpire(itemId: string): void {
    const itemData = this.groundItems.get(itemId);
    if (!itemData) return;

    console.log(
      `[GroundItemManager] Item ${itemId} (${itemData.itemId}) despawning after timeout`,
    );

    // Remove from world
    this.removeGroundItem(itemId);

    // Emit event
    this.world.emit(EventType.ITEM_DESPAWNED, {
      itemId: itemId,
      itemType: itemData.itemId,
    });
  }

  /**
   * Remove ground item immediately
   */
  removeGroundItem(itemId: string): void {
    const itemData = this.groundItems.get(itemId);
    if (!itemData) return;

    // Destroy entity
    this.entityManager.destroyEntity(itemId);

    // Clear timer
    const timer = this.despawnTimers.get(itemId);
    if (timer) {
      clearTimeout(timer);
      this.despawnTimers.delete(itemId);
    }

    // Remove from tracking
    this.groundItems.delete(itemId);
  }

  /**
   * Get ground item data
   */
  getGroundItem(itemId: string): GroundItemData | null {
    return this.groundItems.get(itemId) || null;
  }

  /**
   * Get all ground items near a position
   */
  getItemsNearPosition(
    position: { x: number; y: number; z: number },
    radius: number,
  ): GroundItemData[] {
    const nearbyItems: GroundItemData[] = [];

    for (const itemData of this.groundItems.values()) {
      const dx = itemData.position.x - position.x;
      const dz = itemData.position.z - position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance <= radius) {
        nearbyItems.push(itemData);
      }
    }

    return nearbyItems;
  }

  /**
   * Get count of tracked ground items
   */
  getItemCount(): number {
    return this.groundItems.size;
  }

  /**
   * Clean up all ground items
   */
  destroy(): void {
    // Clear all timers
    for (const timer of this.despawnTimers.values()) {
      clearTimeout(timer);
    }
    this.despawnTimers.clear();

    // Destroy all entities
    for (const itemId of this.groundItems.keys()) {
      this.entityManager.destroyEntity(itemId);
    }
    this.groundItems.clear();
  }

  /**
   * Helper: Get item type string
   */
  private getItemTypeString(itemType: any): string {
    // Convert ItemType enum to string
    if (typeof itemType === "string") return itemType;
    return "misc";
  }
}
