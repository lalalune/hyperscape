/**
 * GroundItemManager (TICK-BASED)
 *
 * Manages lifecycle of ALL ground items (player death + mob loot).
 * Extracted from LootSystem for DRY principle.
 * Handles spawning, tick-based despawn, and cleanup.
 *
 * TICK-BASED TIMING (OSRS-accurate):
 * - Despawn timers tracked in ticks, not milliseconds
 * - processTick() called once per tick by TickSystem
 * - Config accepts ms for backwards compatibility, converts to ticks internally
 *
 * @see https://oldschool.runescape.wiki/w/Dropped_items
 */

import type { World } from "../../../core/World";
import type { EntityManager } from "..";
import type { InventoryItem } from "../../../types/core/core";
import type {
  GroundItemOptions,
  GroundItemData,
  GroundItemPileData,
} from "../../../types/death";
import { EventType } from "../../../types/events";
import {
  EntityType,
  InteractionType,
  ItemRarity,
} from "../../../types/entities";
import type { ItemEntityConfig } from "../../../types/entities";
import { groundToTerrain } from "../../../utils/game/EntityUtils";
import { getItem } from "../../../data/items";
import { msToTicks, ticksToMs } from "../../../utils/game/CombatCalculations";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";
import { worldToTile, tileToWorld } from "../movement/TileSystem";

export class GroundItemManager {
  private groundItems = new Map<string, GroundItemData>();
  private groundItemPiles = new Map<string, GroundItemPileData>();
  private nextItemId = 1;

  constructor(
    private world: World,
    private entityManager: EntityManager,
  ) {}

  /**
   * Get tile key for Map lookup
   */
  private getTileKey(tile: { x: number; z: number }): string {
    return `${tile.x}_${tile.z}`;
  }

  /**
   * Get all items at a specific tile
   */
  getItemsAtTile(tile: { x: number; z: number }): GroundItemData[] {
    const tileKey = this.getTileKey(tile);
    const pile = this.groundItemPiles.get(tileKey);
    return pile ? [...pile.items] : [];
  }

  /**
   * Get pile data at a specific tile
   */
  getPileAtTile(tile: { x: number; z: number }): GroundItemPileData | null {
    return this.groundItemPiles.get(this.getTileKey(tile)) || null;
  }

  /**
   * Update item visibility in pile (server sets property, syncs to client)
   */
  private setItemVisibility(entityId: string, visible: boolean): void {
    const entity = this.world.entities.get(entityId);
    if (entity) {
      entity.setProperty("visibleInPile", visible);
      if (typeof entity.markNetworkDirty === "function") {
        entity.markNetworkDirty();
      }
    }
  }

  /**
   * Spawn a single ground item (TICK-BASED despawn)
   * Options accept ms for backwards compatibility, converted to ticks internally
   * Items are snapped to tile centers and managed in piles (OSRS-style stacking)
   */
  async spawnGroundItem(
    itemId: string,
    quantity: number,
    position: { x: number; y: number; z: number },
    options: GroundItemOptions,
  ): Promise<string> {
    // CRITICAL: Server authority check - prevent client from spawning arbitrary items
    if (!this.world.isServer) {
      console.error(
        `[GroundItemManager] ⚠️  Client attempted server-only ground item spawn - BLOCKED`,
      );
      return "";
    }

    const item = getItem(itemId);
    if (!item) {
      console.warn(`[GroundItemManager] Unknown item: ${itemId}`);
      return "";
    }

    const now = Date.now();
    const currentTick = this.world.currentTick;

    // Convert ms config to ticks
    const despawnTicks = msToTicks(options.despawnTime);
    const lootProtectionTicks = options.lootProtection
      ? msToTicks(options.lootProtection)
      : 0;

    // OSRS-STYLE: Snap position to tile center
    const tile = worldToTile(position.x, position.z);
    const tileKey = this.getTileKey(tile);
    const tileCenter = tileToWorld(tile);

    // Ground the tile center position to terrain
    const groundedPosition = groundToTerrain(
      this.world,
      { x: tileCenter.x, y: position.y, z: tileCenter.z },
      0.2,
      Infinity,
    );

    // Check for existing pile at this tile
    const existingPile = this.groundItemPiles.get(tileKey);

    // OSRS-STYLE: If stackable, try to merge with existing item of same type
    if (item.stackable && existingPile) {
      const existingStackItem = existingPile.items.find(
        (pileItem) =>
          pileItem.itemId === itemId &&
          // Only merge if both have no loot protection or same owner
          (!pileItem.lootProtectionTick ||
            pileItem.droppedBy === options.droppedBy),
      );

      if (existingStackItem) {
        // Merge quantities - update existing entity, don't create new one
        const newQuantity = existingStackItem.quantity + quantity;
        existingStackItem.quantity = newQuantity;

        // Extend despawn timer to the newer drop's timer
        existingStackItem.despawnTick = currentTick + despawnTicks;

        // Update entity properties
        const existingEntity = this.world.entities.get(
          existingStackItem.entityId,
        );
        if (existingEntity) {
          existingEntity.setProperty("quantity", newQuantity);
          existingEntity.name = `${item.name} (${newQuantity})`;
          if (typeof existingEntity.markNetworkDirty === "function") {
            existingEntity.markNetworkDirty();
          }
        }

        console.log(
          `[GroundItemManager] Merged stackable item ${itemId} x${quantity} into existing stack (now x${newQuantity}) at tile (${tile.x}, ${tile.z})`,
        );

        return existingStackItem.entityId;
      }
    }

    // Create new item entity
    const dropId = `ground_item_${this.nextItemId++}`;

    const itemEntity = await this.entityManager.spawnEntity({
      id: dropId,
      name: `${item.name}${quantity > 1 ? ` (${quantity})` : ""}`,
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
        visibleInPile: true, // New item is visible (will be top of pile)
      },
    } as ItemEntityConfig);

    if (!itemEntity) {
      console.error(`[GroundItemManager] Failed to spawn item: ${itemId}`);
      return "";
    }

    // Track ground item (TICK-BASED)
    const groundItemData: GroundItemData = {
      entityId: dropId,
      itemId: itemId,
      quantity: quantity,
      position: groundedPosition,
      despawnTick: currentTick + despawnTicks,
      droppedBy: options.droppedBy,
      lootProtectionTick:
        lootProtectionTicks > 0 ? currentTick + lootProtectionTicks : undefined,
      spawnedAt: now,
    };

    this.groundItems.set(dropId, groundItemData);

    // OSRS-STYLE: Manage pile - hide previous top item, add new item to pile
    if (existingPile) {
      // Hide the current top item
      this.setItemVisibility(existingPile.topItemEntityId, false);

      // Add new item to front of pile (newest first)
      existingPile.items.unshift(groundItemData);
      existingPile.topItemEntityId = dropId;
    } else {
      // Create new pile
      const newPile: GroundItemPileData = {
        tileKey,
        tile,
        items: [groundItemData],
        topItemEntityId: dropId,
      };
      this.groundItemPiles.set(tileKey, newPile);
    }

    console.log(
      `[GroundItemManager] Spawned ground item ${dropId} (${itemId} x${quantity}) at tile (${tile.x}, ${tile.z})`,
      {
        despawnTick: groundItemData.despawnTick,
        despawnIn: `${despawnTicks} ticks (${(ticksToMs(despawnTicks) / 1000).toFixed(1)}s)`,
        lootProtectionTick: groundItemData.lootProtectionTick,
        pileSize: existingPile ? existingPile.items.length : 1,
      },
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
    // CRITICAL: Server authority check - prevent client from mass-spawning items
    if (!this.world.isServer) {
      console.error(
        `[GroundItemManager] ⚠️  Client attempted server-only ground items spawn - BLOCKED`,
      );
      return [];
    }

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
      `[GroundItemManager] Spawned ${entityIds.length} ground items at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`,
    );

    return entityIds;
  }

  /**
   * Process tick - check for expired items (TICK-BASED)
   * Called once per tick by TickSystem
   *
   * @param currentTick - Current server tick number
   */
  processTick(currentTick: number): void {
    const expiredItems: string[] = [];

    for (const [itemId, itemData] of this.groundItems) {
      if (currentTick >= itemData.despawnTick) {
        expiredItems.push(itemId);
      }
    }

    // Despawn expired items
    for (const itemId of expiredItems) {
      this.handleItemExpire(itemId, currentTick);
    }
  }

  /**
   * Handle item expiration (TICK-BASED)
   */
  private handleItemExpire(itemId: string, currentTick: number): void {
    const itemData = this.groundItems.get(itemId);
    if (!itemData) return;

    const ticksExisted =
      currentTick -
      (itemData.despawnTick - COMBAT_CONSTANTS.GROUND_ITEM_DESPAWN_TICKS);

    console.log(
      `[GroundItemManager] Item ${itemId} (${itemData.itemId}) despawning after ${ticksExisted} ticks (${(ticksToMs(ticksExisted) / 1000).toFixed(1)}s)`,
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
   * Also updates pile to show next item if applicable
   */
  removeGroundItem(itemId: string): void {
    const itemData = this.groundItems.get(itemId);
    if (!itemData) return;

    // Find the pile this item belongs to
    const tile = worldToTile(itemData.position.x, itemData.position.z);
    const tileKey = this.getTileKey(tile);
    const pile = this.groundItemPiles.get(tileKey);

    if (pile) {
      // Remove item from pile
      const itemIndex = pile.items.findIndex((i) => i.entityId === itemId);
      if (itemIndex !== -1) {
        pile.items.splice(itemIndex, 1);
      }

      // If this was the top item, show the next item
      if (pile.topItemEntityId === itemId && pile.items.length > 0) {
        const nextItem = pile.items[0];
        pile.topItemEntityId = nextItem.entityId;
        this.setItemVisibility(nextItem.entityId, true);
      }

      // If pile is now empty, remove it
      if (pile.items.length === 0) {
        this.groundItemPiles.delete(tileKey);
      }
    }

    // Destroy entity
    this.entityManager.destroyEntity(itemId);

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
    // Destroy all entities
    for (const itemId of this.groundItems.keys()) {
      this.entityManager.destroyEntity(itemId);
    }
    this.groundItems.clear();
    this.groundItemPiles.clear();
  }

  /**
   * Check if item is still under loot protection (TICK-BASED)
   * @param itemId - Ground item entity ID
   * @param currentTick - Current server tick
   * @returns true if loot protection is still active
   */
  isLootProtected(itemId: string, currentTick: number): boolean {
    const itemData = this.groundItems.get(itemId);
    if (!itemData || !itemData.lootProtectionTick) return false;
    return currentTick < itemData.lootProtectionTick;
  }

  /**
   * Get ticks until despawn (TICK-BASED)
   * @param itemId - Ground item entity ID
   * @param currentTick - Current server tick
   * @returns Ticks until despawn, or -1 if item not found
   */
  getTicksUntilDespawn(itemId: string, currentTick: number): number {
    const itemData = this.groundItems.get(itemId);
    if (!itemData) return -1;
    return Math.max(0, itemData.despawnTick - currentTick);
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
