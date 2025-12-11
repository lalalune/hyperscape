/**
 * GroundItemSystem - Shared Ground Item Manager
 *
 * SystemBase wrapper around ground item functionality.
 * Registered as a world system so all systems share the same instance.
 *
 * This replaces multiple GroundItemManager instances (LootSystem, PlayerDeathSystem)
 * with a single shared system, eliminating the need for ID prefixes.
 *
 * Features:
 * - OSRS-style tile-based piling
 * - Stackable item merging
 * - Tick-based despawn timers
 * - Loot protection
 * - O(1) tile lookups via spatial indexing
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
import { ItemType } from "../../../types/game/item-types";
import type { ItemEntityConfig } from "../../../types/entities";
import { groundToTerrain } from "../../../utils/game/EntityUtils";
import { getItem } from "../../../data/items";
import { msToTicks, ticksToMs } from "../../../utils/game/CombatCalculations";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";
import { worldToTile, tileToWorld } from "../movement/TileSystem";
import { SystemBase } from "..";

export class GroundItemSystem extends SystemBase {
  private groundItems = new Map<string, GroundItemData>();
  private groundItemPiles = new Map<string, GroundItemPileData>();
  private nextItemId = 1;
  private entityManager: EntityManager | null = null;

  /** Pre-allocated buffer for tick processing (zero-allocation hot path) */
  private readonly _expiredItemsBuffer: string[] = [];

  /** OSRS: Maximum items per tile */
  private readonly MAX_PILE_SIZE = 128;

  /** Server-wide ground item limit to prevent memory exhaustion */
  private readonly MAX_GLOBAL_ITEMS = 65536;

  constructor(world: World) {
    super(world, {
      name: "ground-items",
      dependencies: {
        required: ["entity-manager"],
        optional: [],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    this.entityManager =
      this.world.getSystem<EntityManager>("entity-manager") ?? null;
    if (!this.entityManager) {
      console.error(
        "[GroundItemSystem] EntityManager not found - ground items disabled",
      );
    }
  }

  /**
   * Get tile key for Map lookup
   */
  private getTileKey(tile: { x: number; z: number }): string {
    return `${tile.x}_${tile.z}`;
  }

  /**
   * Get all items at a specific tile (O(1) lookup)
   * @param tile - Tile coordinates
   * @param outArray - Optional pre-allocated array to populate (avoids allocation)
   * @returns Array of ground items at tile
   */
  getItemsAtTile(
    tile: { x: number; z: number },
    outArray?: GroundItemData[],
  ): GroundItemData[] {
    const tileKey = this.getTileKey(tile);
    const pile = this.groundItemPiles.get(tileKey);

    if (outArray) {
      // Zero-allocation path: populate provided array
      outArray.length = 0;
      if (pile) {
        for (let i = 0; i < pile.items.length; i++) {
          outArray.push(pile.items[i]);
        }
      }
      return outArray;
    }

    // Allocation path: create new array (backwards compatible)
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
        `[GroundItemSystem] ⚠️  Client attempted server-only ground item spawn - BLOCKED`,
      );
      return "";
    }

    if (!this.entityManager) {
      console.error("[GroundItemSystem] EntityManager not available");
      return "";
    }

    // Global ground item limit - prevent memory exhaustion attacks
    if (this.groundItems.size >= this.MAX_GLOBAL_ITEMS) {
      console.warn(
        `[GroundItemSystem] Global item limit reached (${this.MAX_GLOBAL_ITEMS}), rejecting spawn`,
      );
      return "";
    }

    const item = getItem(itemId);
    if (!item) {
      console.warn(`[GroundItemSystem] Unknown item: ${itemId}`);
      return "";
    }

    const currentTick = this.world.currentTick;

    // OSRS: Untradeable items ALWAYS despawn in 3 min, tradeable uses caller's time
    // This overrides caller's despawnTime for untradeable items (OSRS-accurate behavior)
    const despawnTicks =
      item.tradeable === false
        ? COMBAT_CONSTANTS.UNTRADEABLE_DESPAWN_TICKS // 300 ticks = 3 min (forced)
        : msToTicks(options.despawnTime); // Use caller's value

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

    // OSRS-STYLE: Check pile size limit (max 128 items per tile)
    // If full, remove oldest item (bottom of pile) to make room
    if (existingPile && existingPile.items.length >= this.MAX_PILE_SIZE) {
      const oldestItem = existingPile.items.pop(); // Remove from end (oldest)
      if (oldestItem) {
        this.groundItems.delete(oldestItem.entityId);
        if (this.entityManager) {
          this.entityManager.destroyEntity(oldestItem.entityId);
        }
        console.log(
          `[GroundItemSystem] Pile full at (${tile.x}, ${tile.z}), removed oldest item ${oldestItem.entityId}`,
        );
      }
    }

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
          existingEntity.name = item.name; // Quantity tracked as property
          if (typeof existingEntity.markNetworkDirty === "function") {
            existingEntity.markNetworkDirty();
          }
        }

        console.log(
          `[GroundItemSystem] Merged stackable item ${itemId} x${quantity} into existing stack (now x${newQuantity}) at tile (${tile.x}, ${tile.z})`,
        );

        return existingStackItem.entityId;
      }
    }

    // Create new item entity (single instance, no prefix needed)
    const dropId = `ground_item_${this.nextItemId++}`;

    const itemEntity = await this.entityManager.spawnEntity({
      id: dropId,
      name: item.name, // Quantity tracked as property, not in name
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
      console.error(`[GroundItemSystem] Failed to spawn item: ${itemId}`);
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
      spawnedAt: Date.now(),
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
      `[GroundItemSystem] Spawned ground item ${dropId} (${itemId} x${quantity}) at tile (${tile.x}, ${tile.z})`,
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
        `[GroundItemSystem] ⚠️  Client attempted server-only ground items spawn - BLOCKED`,
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
      `[GroundItemSystem] Spawned ${entityIds.length} ground items at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`,
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
    // ZERO-ALLOCATION: Reuse buffer, clear via length instead of new array
    this._expiredItemsBuffer.length = 0;

    for (const [itemId, itemData] of this.groundItems) {
      if (currentTick >= itemData.despawnTick) {
        this._expiredItemsBuffer.push(itemId);
      }
    }

    // Process from buffer (use indexed loop for performance)
    for (let i = 0; i < this._expiredItemsBuffer.length; i++) {
      this.handleItemExpire(this._expiredItemsBuffer[i], currentTick);
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
      `[GroundItemSystem] Item ${itemId} (${itemData.itemId}) despawning after ${ticksExisted} ticks (${(ticksToMs(ticksExisted) / 1000).toFixed(1)}s)`,
    );

    // Remove from world
    this.removeGroundItem(itemId);

    // Emit event
    this.emitTypedEvent(EventType.ITEM_DESPAWNED, {
      itemId: itemId,
      itemType: itemData.itemId,
    });
  }

  /**
   * Remove ground item immediately
   * Also updates pile to show next item if applicable
   * Handles both tracked items (spawned via GroundItemSystem) and untracked items
   */
  removeGroundItem(itemId: string): boolean {
    const itemData = this.groundItems.get(itemId);

    if (itemData) {
      // Item was tracked - handle pile management
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

      // Remove from tracking
      this.groundItems.delete(itemId);
    }

    // Always destroy entity (handles both tracked and untracked items)
    if (this.entityManager) {
      return this.entityManager.destroyEntity(itemId);
    }

    return false;
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
   * Check if an item is visible to a specific player (OSRS visibility phases)
   * - Private phase (0-100 ticks): Only dropper/killer sees item
   * - Public phase (100-200 ticks): Everyone sees item
   *
   * NOTE: Currently used for validation. Full visual filtering requires
   * network layer changes (see GROUND_ITEM_IMPLEMENTATION_PLAN.md Phase 5).
   */
  isVisibleTo(itemId: string, playerId: string, currentTick: number): boolean {
    const itemData = this.groundItems.get(itemId);

    // Untracked items (world spawns) are always visible
    if (!itemData) return true;

    // If no loot protection, everyone can see
    if (!itemData.lootProtectionTick) return true;

    // If public phase reached, everyone can see
    if (currentTick >= itemData.lootProtectionTick) return true;

    // Private phase: only dropper can see
    return itemData.droppedBy === playerId;
  }

  /**
   * Check if a player can pick up an item (considering loot protection)
   *
   * Returns true for untracked items (world spawns from ItemSpawnerSystem)
   * since they have no loot protection to enforce.
   */
  canPickup(itemId: string, playerId: string, currentTick: number): boolean {
    const itemData = this.groundItems.get(itemId);

    // Untracked items (world spawns, resource drops) have no protection
    // If we can't find tracking data, allow pickup
    if (!itemData) return true;

    // If no loot protection, anyone can pick up
    if (!itemData.lootProtectionTick) return true;

    // If protection expired, anyone can pick up
    if (currentTick >= itemData.lootProtectionTick) return true;

    // Only the dropper/killer can pick up during protection
    return itemData.droppedBy === playerId;
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
  private getItemTypeString(itemType: ItemType | string | undefined): string {
    if (typeof itemType === "string") return itemType;
    return "misc";
  }

  /**
   * Clean up all ground items
   */
  destroy(): void {
    // Destroy all entities
    if (this.entityManager) {
      for (const itemId of this.groundItems.keys()) {
        this.entityManager.destroyEntity(itemId);
      }
    }
    this.groundItems.clear();
    this.groundItemPiles.clear();

    super.destroy();
  }
}
