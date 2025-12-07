/**
 * InventorySystem - Manages player inventories
 */

import { getSystem } from "../../../utils/SystemUtils";
import type { World } from "../../../types";
import type { InventoryItemAddedPayload } from "../../../types/events";
import { EventType } from "../../../types/events";
import { getItem, ITEMS } from "../../../data/items";
import { dataManager } from "../../../data/DataManager";
import type { PlayerInventory } from "../../../types/core/core";
import type {
  InventoryCanAddEvent,
  InventoryRemoveCoinsEvent,
  InventoryCheckEvent,
  InventoryItemInfo,
} from "../../../types/events";
import { PlayerID } from "../../../types/core/identifiers";
import type { InventoryData } from "../../../types/systems/system-interfaces";
import {
  createItemID,
  createPlayerID,
  isValidItemID,
  isValidPlayerID,
  toPlayerID,
} from "../../../utils/IdentifierUtils";
import { EntityManager } from "..";
import { SystemBase } from "..";
import { Logger } from "../../../utils/Logger";
import type { DatabaseSystem } from "../../../types/systems/system-interfaces";
import type { GroundItemSystem } from "../economy/GroundItemSystem";

export class InventorySystem extends SystemBase {
  protected playerInventories = new Map<PlayerID, PlayerInventory>();
  private readonly MAX_INVENTORY_SLOTS = 28;
  private persistTimers = new Map<string, NodeJS.Timeout>();
  private saveInterval?: NodeJS.Timeout;
  private readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds

  // Pickup locks to prevent race conditions when multiple players try to pickup same item
  private pickupLocks = new Set<string>();

  constructor(world: World) {
    super(world, {
      name: "inventory",
      dependencies: {
        required: [],
        optional: ["ui", "equipment", "player", "database"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    const isServer = this.world.network?.isServer || false;
    const isClient = this.world.network?.isClient || false;
    if (typeof process !== "undefined" && process.env.DEBUG_RPG === "1") {
    }

    // Subscribe to inventory events
    this.subscribe(
      EventType.PLAYER_REGISTERED,
      async (data: { playerId: string }) => {
        if (process.env.DEBUG_RPG === "1") {
        }
        // Use async method to properly load from database
        const loaded = await this.loadPersistedInventoryAsync(data.playerId);
        if (!loaded) {
          if (process.env.DEBUG_RPG === "1") {
          }
          this.initializeInventory({ id: data.playerId });
        }
      },
    );
    this.subscribe(EventType.PLAYER_CLEANUP, (data) => {
      this.cleanupInventory({ id: data.playerId });
    });
    this.subscribe(EventType.INVENTORY_ITEM_REMOVED, (data) => {
      this.removeItem(data);
    });
    // Handle remove item requests (e.g., from store sell)
    this.subscribe<{ playerId: string; itemId: string; quantity: number }>(
      EventType.INVENTORY_REMOVE_ITEM,
      (data) => {
        this.removeItem(data);
      },
    );
    this.subscribe(EventType.ITEM_DROP, (data) => {
      this.dropItem(data);
    });
    this.subscribe(EventType.INVENTORY_USE, (data) => {
      this.useItem(data);
    });
    this.subscribe(EventType.ITEM_PICKUP, (data) => {
      this.pickupItem({
        playerId: data.playerId,
        entityId: data.entityId,
        itemId: data.itemId,
      });
    });
    this.subscribe(EventType.INVENTORY_UPDATE_COINS, (data) => {
      this.updateCoins({ playerId: data.playerId, amount: data.coins });
    });
    this.subscribe(EventType.INVENTORY_MOVE, (data) => {
      this.moveItem(data);
    });
    this.subscribe(EventType.INVENTORY_DROP_ALL, (data) => {
      this.dropAllItems({ playerId: data.playerId, position: data.position });
    });

    // Subscribe to store system events
    this.subscribe(EventType.INVENTORY_CAN_ADD, (data) => {
      this.handleCanAdd(data);
    });
    this.subscribe(EventType.INVENTORY_REMOVE_COINS, (data) => {
      this.handleRemoveCoins(data);
    });
    // Handle add coins requests (e.g., from store sell)
    this.subscribe<{ playerId: string; amount: number }>(
      EventType.INVENTORY_ADD_COINS,
      (data) => {
        this.updateCoins({ playerId: data.playerId, amount: data.amount });
      },
    );
    this.subscribe(EventType.INVENTORY_ITEM_ADDED, (data) => {
      this.handleInventoryAdd(data);
    });

    // Subscribe to inventory check events
    this.subscribe(EventType.INVENTORY_CHECK, (data: InventoryCheckEvent) => {
      this.handleInventoryCheck(data);
    });
  }

  start(): void {
    // Start periodic auto-save on server only
    if (this.world.isServer) {
      this.startAutoSave();
    }
  }

  private startAutoSave(): void {
    this.saveInterval = this.createInterval(() => {
      this.performAutoSave();
    }, this.AUTO_SAVE_INTERVAL)!;
  }

  private async performAutoSave(): Promise<void> {
    const db = this.getDatabase();
    if (!db) return;

    let savedCount = 0;
    let totalItems = 0;

    for (const playerId of this.playerInventories.keys()) {
      // Only persist inventories for real characters that exist in DB
      try {
        const playerRow = await db.getPlayerAsync(playerId);
        if (!playerRow) {
          continue;
        }
        const inv = this.getOrCreateInventory(playerId);
        const saveItems = inv.items.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
          slotIndex: i.slot,
          metadata: null as null,
        }));
        db.savePlayerInventory(playerId, saveItems);
        db.savePlayer(playerId, { coins: inv.coins });
        savedCount++;
        totalItems += saveItems.length;
      } catch {
        // Skip on DB errors during autosave
      }
    }
  }

  private initializeInventory(playerData: { id: string }): void {
    // Validate and create PlayerID
    if (!isValidPlayerID(playerData.id)) {
      Logger.systemError(
        "InventorySystem",
        `Invalid player ID: "${playerData.id}"`,
        new Error(`Invalid player ID: "${playerData.id}"`),
      );
      return;
    }

    const playerId = createPlayerID(playerData.id);

    const inventory: PlayerInventory = {
      playerId: playerId,
      items: [],
      coins: 100, // Starting coins per GDD
    };

    this.playerInventories.set(playerId, inventory);

    // Starter equipment optional via env flag
    const enableStarter =
      typeof process !== "undefined" &&
      process.env &&
      process.env.PUBLIC_STARTER_ITEMS === "1";
    if (enableStarter) this.addStarterEquipment(playerId);

    const inventoryData = this.getInventoryData(playerData.id);
    this.emitTypedEvent(EventType.INVENTORY_INITIALIZED, {
      playerId: playerData.id, // Keep original for compatibility
      inventory: {
        items: inventoryData.items.map((item) => ({
          slot: item.slot,
          itemId: item.itemId,
          quantity: item.quantity,
          item: {
            id: item.item.id,
            name: item.item.name,
            type: item.item.type,
            stackable: item.item.stackable,
            weight: item.item.weight,
          },
        })),
        coins: inventoryData.coins,
        maxSlots: inventoryData.maxSlots,
      },
    });
  }

  private addStarterEquipment(playerId: PlayerID): void {
    const starterItems = [
      { itemId: "bronze_sword", quantity: 1 },
      { itemId: "bronze_shield", quantity: 1 },
      { itemId: "bronze_helmet", quantity: 1 },
      { itemId: "bronze_body", quantity: 1 },
      { itemId: "bronze_legs", quantity: 1 },
      { itemId: "wood_bow", quantity: 1 },
      { itemId: "arrows", quantity: 100 },
      { itemId: "tinderbox", quantity: 1 },
      { itemId: "bronze_hatchet", quantity: 1 },
      { itemId: "fishing_rod", quantity: 1 },
    ];

    starterItems.forEach(({ itemId, quantity }) => {
      this.addItem({ playerId, itemId: createItemID(itemId), quantity });
    });
  }

  private cleanupInventory(data: { id: string }): void {
    const playerId = toPlayerID(data.id);
    if (!playerId) {
      Logger.systemError(
        "InventorySystem",
        `Cannot cleanup inventory: invalid player ID "${data.id}"`,
        new Error(`Cannot cleanup inventory: invalid player ID "${data.id}"`),
      );
      return;
    }
    // Flush this player's inventory to DB before cleanup if character exists
    if (this.world.isServer) {
      const db = this.getDatabase();
      if (db) {
        const inv = this.playerInventories.get(playerId);
        if (inv) {
          db.getPlayerAsync(playerId)
            .then((row) => {
              if (row) {
                const saveItems = inv.items.map((i) => ({
                  itemId: i.itemId,
                  quantity: i.quantity,
                  slotIndex: i.slot,
                  metadata: null as null,
                }));
                db.savePlayerInventory(playerId, saveItems);
                db.savePlayer(playerId, { coins: inv.coins });
              }
            })
            .catch(() => {});
        }
      }
    }
    this.playerInventories.delete(playerId);
  }

  protected addItem(data: {
    playerId: string;
    itemId: string;
    quantity: number;
    slot?: number;
  }): boolean {
    if (!data.playerId) {
      Logger.systemError(
        "InventorySystem",
        "Cannot add item: playerId is undefined",
        new Error("Cannot add item: playerId is undefined"),
      );
      return false;
    }

    if (!data.itemId) {
      Logger.systemError(
        "InventorySystem",
        "Cannot add item: itemId is undefined",
        new Error("Cannot add item: itemId is undefined"),
      );
      return false;
    }

    // Validate IDs
    if (!isValidPlayerID(data.playerId) || !isValidItemID(data.itemId)) {
      Logger.systemError(
        "InventorySystem",
        "Cannot add item: invalid ID format",
        new Error("Cannot add item: invalid ID format"),
      );
      return false;
    }

    const playerId = data.playerId;
    const itemId = data.itemId;

    const inventory = this.getOrCreateInventory(playerId);

    const itemData = getItem(itemId);
    if (!itemData) {
      Logger.systemError(
        "InventorySystem",
        `Item not found: ${itemId}`,
        new Error(`Item not found: ${itemId}`),
      );
      return false;
    }

    if (process.env.DEBUG_RPG === "1") {
    }

    // Special handling for coins
    if (itemId === "coins") {
      inventory.coins += data.quantity;
      this.emitTypedEvent(EventType.INVENTORY_COINS_UPDATED, {
        playerId: playerId,
        coins: inventory.coins,
      });

      // Sync inventory to client (updates UI immediately)
      const playerIdKey = toPlayerID(playerId);
      if (playerIdKey) {
        this.emitInventoryUpdate(playerIdKey);
      }

      this.scheduleInventoryPersist(playerId);
      return true;
    }

    // Check if item is stackable
    if (itemData.stackable) {
      // Find existing stack
      const existingItem = inventory.items.find(
        (item) => item.itemId === itemId,
      );
      if (existingItem) {
        existingItem.quantity += data.quantity;
        const playerIdKey = toPlayerID(playerId);
        if (playerIdKey) {
          this.emitInventoryUpdate(playerIdKey);
          this.scheduleInventoryPersist(playerId);
        }
        return true;
      }
    }

    // For non-stackable items with quantity > 1, create multiple separate items
    // Each non-stackable item occupies its own slot with quantity=1
    // (e.g., buying 5 logs creates 5 separate inventory slots)
    if (!itemData.stackable && data.quantity > 1) {
      let added = 0;
      for (let i = 0; i < data.quantity; i++) {
        const slot = this.findEmptySlot(inventory);
        if (slot === -1) {
          // Inventory full
          if (added === 0) {
            this.emitTypedEvent(EventType.INVENTORY_FULL, {
              playerId: playerId,
            });
          }
          break;
        }

        inventory.items.push({
          slot: slot,
          itemId: itemId,
          quantity: 1, // Each non-stackable item has quantity 1
          item: itemData,
        });
        added++;
      }

      if (added > 0) {
        const playerIdKey = toPlayerID(playerId);
        if (playerIdKey) {
          this.emitInventoryUpdate(playerIdKey);
          this.scheduleInventoryPersist(playerId);
        }
      }

      return added > 0;
    }

    // Determine slot to use:
    // - If slot is provided AND it's free, use it (for bank sync)
    // - Otherwise find an empty slot
    let targetSlot: number;
    if (
      data.slot !== undefined &&
      data.slot >= 0 &&
      data.slot < this.MAX_INVENTORY_SLOTS
    ) {
      // Check if the provided slot is already occupied
      const slotOccupied = inventory.items.some(
        (item) => item.slot === data.slot,
      );
      if (!slotOccupied) {
        targetSlot = data.slot;
      } else {
        // Slot is occupied, find a free one
        targetSlot = this.findEmptySlot(inventory);
      }
    } else {
      // No slot provided, find empty one
      targetSlot = this.findEmptySlot(inventory);
    }

    if (targetSlot === -1) {
      this.emitTypedEvent(EventType.INVENTORY_FULL, { playerId: playerId });
      return false;
    }

    // Add new item to the target slot
    inventory.items.push({
      slot: targetSlot,
      itemId: itemId,
      quantity: data.quantity,
      item: itemData,
    });

    const playerIdKey = toPlayerID(playerId);
    if (playerIdKey) {
      this.emitInventoryUpdate(playerIdKey);
      this.scheduleInventoryPersist(playerId);
    }
    return true;
  }

  /**
   * Check if an item can be added to inventory without modifying state
   * Used for pre-validation before pickup to prevent wasted operations
   *
   * @param playerId - Player to check
   * @param itemId - Item to check
   * @param quantity - Quantity to check
   * @returns true if item can be added
   */
  private canAddItem(
    playerId: string,
    itemId: string,
    quantity: number,
  ): boolean {
    const inventory = this.playerInventories.get(playerId as PlayerID);
    if (!inventory) return true; // New inventory will be created

    const itemData = getItem(itemId);
    if (!itemData) return false;

    // Coins always fit (no slot limit)
    if (itemId === "coins") return true;

    // Stackable: check if we have existing stack or empty slot
    if (itemData.stackable) {
      const existingStack = inventory.items.find((i) => i.itemId === itemId);
      if (existingStack) return true; // Can add to existing stack
    }

    // Need empty slots
    const slotsNeeded = itemData.stackable ? 1 : quantity;
    const emptySlots = this.MAX_INVENTORY_SLOTS - inventory.items.length;
    return emptySlots >= slotsNeeded;
  }

  private removeItem(data: {
    playerId: string;
    itemId: string | number;
    quantity: number;
    slot?: number;
  }): boolean {
    if (!data.playerId) {
      Logger.systemError(
        "InventorySystem",
        "Cannot remove item: playerId is undefined",
        new Error("Cannot remove item: playerId is undefined"),
      );
      return false;
    }

    if (!data.itemId && data.itemId !== 0) {
      Logger.systemError(
        "InventorySystem",
        "Cannot remove item: itemId is undefined",
        new Error("Cannot remove item: itemId is undefined"),
      );
      return false;
    }

    // Validate IDs
    if (
      !isValidPlayerID(data.playerId) ||
      !isValidItemID(String(data.itemId))
    ) {
      Logger.systemError(
        "InventorySystem",
        "Cannot remove item: invalid ID format",
        new Error("Cannot remove item: invalid ID format"),
      );
      return false;
    }

    const playerId = data.playerId;
    const itemId = String(data.itemId);

    const inventory = this.getOrCreateInventory(playerId);

    // Handle coins
    if (itemId === "coins") {
      if (inventory.coins >= data.quantity) {
        inventory.coins -= data.quantity;
        this.emitTypedEvent(EventType.INVENTORY_COINS_UPDATED, {
          playerId: data.playerId,
          coins: inventory.coins,
        });
        this.scheduleInventoryPersist(data.playerId);
        return true;
      }
      return false;
    }

    // Loop through all matching items until quantity is fulfilled
    // This handles non-stackable items spread across multiple slots
    // (e.g., 5 bronze swords in 5 separate slots with qty=1 each)
    let remainingQuantity = data.quantity;
    let itemsRemoved = false;

    while (remainingQuantity > 0) {
      // Find next matching item
      const itemIndex =
        data.slot !== undefined
          ? inventory.items.findIndex((item) => item.slot === data.slot)
          : inventory.items.findIndex((item) => item.itemId === itemId);

      if (itemIndex === -1) {
        // No more matching items
        break;
      }

      const item = inventory.items[itemIndex];
      itemsRemoved = true;

      if (item.quantity > remainingQuantity) {
        // This stack has enough - subtract and we're done
        item.quantity -= remainingQuantity;
        remainingQuantity = 0;
      } else {
        // This stack doesn't have enough - remove entire slot, continue
        remainingQuantity -= item.quantity;
        inventory.items.splice(itemIndex, 1);
      }

      // If a specific slot was requested, only remove from that slot
      if (data.slot !== undefined) {
        break;
      }
    }

    // Emit update and persist (only if we removed something)
    if (itemsRemoved) {
      const playerIdKey = toPlayerID(playerId);
      if (playerIdKey) {
        this.emitInventoryUpdate(playerIdKey);
        this.scheduleInventoryPersist(data.playerId);
      }
    }

    return itemsRemoved;
  }

  private async dropItem(data: {
    playerId: string;
    itemId: string;
    quantity: number;
    slot?: number;
  }): Promise<void> {
    // Server-authoritative only
    if (!this.world.isServer) {
      return;
    }

    // Ensure valid identifiers
    if (
      !isValidPlayerID(data.playerId) ||
      !isValidItemID(String(data.itemId))
    ) {
      Logger.systemError(
        "InventorySystem",
        "dropItem: invalid playerId or itemId",
        new Error("dropItem invalid IDs"),
      );
      return;
    }
    const qty = Math.max(1, Number(data.quantity) || 1);
    const removed = this.removeItem({
      playerId: data.playerId,
      itemId: data.itemId,
      quantity: qty,
      slot: data.slot,
    });

    if (removed) {
      const player = this.world.getPlayer(data.playerId);
      if (!player) {
        Logger.systemError(
          "InventorySystem",
          `Player not found: ${data.playerId}`,
          new Error(`Player not found: ${data.playerId}`),
        );
        return;
      }
      const position = player.node.position;

      // Use GroundItemSystem for proper pile management (OSRS-style)
      const groundItems =
        this.world.getSystem<GroundItemSystem>("ground-items");
      if (groundItems) {
        // Spawn through GroundItemSystem for tile-based pile management
        await groundItems.spawnGroundItem(
          data.itemId,
          qty,
          {
            x: position.x,
            y: position.y,
            z: position.z,
          },
          {
            despawnTime: 120000, // 2 minutes default despawn
            droppedBy: data.playerId,
          },
        );
      } else {
        // Fallback to old method if GroundItemSystem not available
        Logger.system(
          "InventorySystem",
          "GroundItemSystem not available, using legacy spawn",
        );
        this.emitTypedEvent(EventType.ITEM_SPAWN_REQUEST, {
          itemId: data.itemId,
          quantity: qty,
          position: {
            x: position.x,
            y: position.y,
            z: position.z,
          },
        });
      }
    }
  }

  /**
   * Drop all items on death - ONLY clears inventory, does NOT spawn items
   * PlayerDeathSystem handles spawning headstone with items
   */
  private dropAllItems(data: {
    playerId: string;
    position: { x: number; y: number; z: number };
  }): void {
    if (!data.playerId) {
      Logger.systemError(
        "InventorySystem",
        "Cannot drop all items: playerId is undefined",
        new Error("Cannot drop all items: playerId is undefined"),
      );
      return;
    }

    const playerID = createPlayerID(data.playerId);
    const inventory = this.getOrCreateInventory(playerID);

    // Get all items that will be dropped (for logging)
    const droppedItemCount = inventory.items.length;

    // Clear the inventory (RuneScape-style: all items go to gravestone)
    inventory.items = [];
    // NOTE: Coins are protected and remain in coin pouch (RuneScape-style)

    // CRITICAL: Update UI by emitting inventory update event
    this.emitInventoryUpdate(playerID);

    // CRITICAL: Persist to database immediately
    this.scheduleInventoryPersist(data.playerId);

    Logger.system(
      "InventorySystem",
      `Cleared inventory on death: ${droppedItemCount} items for player ${data.playerId}`,
    );
  }

  private useItem(data: {
    playerId: string;
    itemId: string;
    slot: number;
  }): void {
    const playerID = data.playerId;
    const inventory = this.getOrCreateInventory(playerID);

    const item = inventory.items.find((i) => i.slot === data.slot);
    if (!item) {
      Logger.systemError(
        "InventorySystem",
        `No item found in slot ${data.slot}`,
        new Error(`No item found in slot ${data.slot}`),
      );
      return;
    }

    // Emit item used event for other systems to react to (different from INVENTORY_USE to avoid recursion)
    this.emitTypedEvent(EventType.ITEM_USED, {
      playerId: data.playerId,
      itemId: data.itemId,
      slot: data.slot,
      itemData: {
        id: item.item.id,
        name: item.item.name,
        type: item.item.type,
        stackable: item.item.stackable,
        weight: item.item.weight,
      },
    });

    // Remove consumables after use
    if (item.item?.type === "consumable") {
      this.removeItem({
        playerId: data.playerId,
        itemId: data.itemId,
        quantity: 1,
        slot: data.slot,
      });
    }
  }

  private pickupItem(data: {
    playerId: string;
    entityId: string;
    itemId?: string;
  }): void {
    // SERVER-SIDE ONLY: Prevent duplication by ensuring only server processes pickups
    if (!this.world.isServer) {
      // Client just sent the request, don't process locally
      return;
    }

    // Validate input parameters
    if (!data.playerId) {
      Logger.systemError(
        "InventorySystem",
        "Cannot pickup item: playerId is undefined",
        new Error("Cannot pickup item: playerId is undefined"),
      );
      return;
    }

    if (!data.entityId) {
      Logger.systemError(
        "InventorySystem",
        "Cannot pickup item: entityId is undefined",
        new Error("Cannot pickup item: entityId is undefined"),
      );
      return;
    }

    // ATOMIC OPERATION: Acquire lock to prevent race conditions
    // Two players clicking same item simultaneously should only result in one pickup
    const lockKey = `pickup:${data.entityId}`;
    if (this.pickupLocks.has(lockKey)) {
      // Another pickup in progress for this item - silently ignore
      return;
    }

    this.pickupLocks.add(lockKey);

    try {
      // Get item entity data from entity manager
      const entityManager = getSystem(
        this.world,
        "entity-manager",
      ) as EntityManager;
      if (!entityManager) {
        Logger.systemError(
          "InventorySystem",
          "EntityManager system not found",
          new Error("EntityManager system not found"),
        );
        return;
      }

      // Re-check entity exists AFTER acquiring lock
      // Between validation and lock, the item may have been picked up
      const entity = entityManager.getEntity(data.entityId);
      if (!entity) {
        // Item may have already been picked up - this is expected during:
        // - Spam clicking item piles (player races themselves)
        // - Multiple players grabbing same item (race condition)
        // - Client sync delay (item removed server-side but client still shows it)
        // Silently ignore - not an error condition
        return;
      }

      // Get itemId from event data or from entity properties
      const itemId = data.itemId || (entity.getProperty("itemId") as string);
      const quantity = (entity.getProperty("quantity") as number) || 1;

      if (!itemId) {
        Logger.systemError(
          "InventorySystem",
          `No itemId found for entity ${data.entityId}`,
          new Error(`No itemId found for entity ${data.entityId}`),
        );
        return;
      }

      // Validate that the item exists in the item database
      const itemData = getItem(itemId);
      if (!itemData) {
        Logger.systemError(
          "InventorySystem",
          `Item not found in database: ${itemId}`,
          new Error(`Item not found in database: ${itemId}`),
        );
        return;
      }

      // PRE-CHECK: Verify inventory capacity BEFORE modifying anything
      // This prevents wasted operations and provides better UX
      if (!this.canAddItem(data.playerId, itemData.id, quantity)) {
        this.emitTypedEvent(EventType.UI_TOAST, {
          playerId: data.playerId,
          message: "Your inventory is full.",
          type: "warning",
        });
        return;
      }

      // ATOMIC: Add to inventory first
      const added = this.addItem({
        playerId: data.playerId,
        itemId: itemData.id,
        quantity,
      });

      if (added) {
        // Use GroundItemSystem if available - it handles entity destruction AND pile updates
        const groundItems =
          this.world.getSystem<GroundItemSystem>("ground-items");
        if (groundItems) {
          // removeGroundItem handles:
          // 1. Removing from pile tracking
          // 2. Showing next item in pile (setting visibleInPile)
          // 3. Destroying the entity
          groundItems.removeGroundItem(data.entityId);
        } else {
          // Fallback: destroy entity directly if GroundItemSystem not available
          const destroyed = entityManager.destroyEntity(data.entityId);
          if (!destroyed) {
            Logger.systemError(
              "InventorySystem",
              `Failed to destroy item entity ${data.entityId}`,
              new Error(`Failed to destroy item entity ${data.entityId}`),
            );
          }
        }
      } else {
        // Could not add (should not happen after canAddItem check, but handle defensively)
        Logger.system(
          "InventorySystem",
          `Failed to add item ${itemId} to inventory for player ${data.playerId}`,
        );
      }
    } finally {
      // Always release lock
      this.pickupLocks.delete(lockKey);
    }
  }

  private updateCoins(data: { playerId: string; amount: number }): void {
    if (!data.playerId) {
      Logger.systemError(
        "InventorySystem",
        "Cannot update coins: playerId is undefined",
        new Error("Cannot update coins: playerId is undefined"),
      );
      return;
    }

    const inventory = this.getOrCreateInventory(data.playerId);

    if (data.amount > 0) {
      inventory.coins += data.amount;
    } else {
      inventory.coins = Math.max(0, inventory.coins + data.amount);
    }

    this.emitTypedEvent(EventType.INVENTORY_COINS_UPDATED, {
      playerId: data.playerId,
      coins: inventory.coins,
    });
    this.scheduleInventoryPersist(data.playerId);
  }

  private moveItem(data: {
    playerId: string;
    fromSlot?: number;
    toSlot?: number;
    sourceSlot?: number;
    targetSlot?: number;
  }): void {
    if (!data.playerId) {
      Logger.systemError(
        "InventorySystem",
        "Cannot move item: playerId is undefined",
        new Error("Cannot move item: playerId is undefined"),
      );
      return;
    }

    // Handle parameter name variations
    const fromSlot = data.fromSlot ?? data.sourceSlot;
    const toSlot = data.toSlot ?? data.targetSlot;

    if (fromSlot === undefined || toSlot === undefined) {
      Logger.systemError(
        "InventorySystem",
        "Cannot move item: slot numbers are undefined",
        new Error("Cannot move item: slot numbers are undefined"),
        { data },
      );
      return;
    }

    const inventory = this.getOrCreateInventory(data.playerId);

    const fromItem = inventory.items.find((item) => item.slot === fromSlot);
    const toItem = inventory.items.find((item) => item.slot === toSlot);

    // Simple swap
    if (fromItem && toItem) {
      fromItem.slot = toSlot;
      toItem.slot = fromSlot;
    } else if (fromItem) {
      fromItem.slot = toSlot;
    }

    const playerIdKey = toPlayerID(data.playerId);
    if (playerIdKey) {
      this.emitInventoryUpdate(playerIdKey);
      this.scheduleInventoryPersist(data.playerId);
    }
  }

  private findEmptySlot(inventory: PlayerInventory): number {
    const usedSlots = new Set(inventory.items.map((item) => item.slot));

    for (let i = 0; i < this.MAX_INVENTORY_SLOTS; i++) {
      if (!usedSlots.has(i)) {
        return i;
      }
    }

    return -1;
  }

  private emitInventoryUpdate(playerId: PlayerID): void {
    const inventoryData = this.getInventoryData(playerId);
    const inventoryUpdateData = {
      playerId,
      items: inventoryData.items.map((item) => ({
        slot: item.slot,
        itemId: item.itemId,
        quantity: item.quantity,
        item: {
          id: item.item.id,
          name: item.item.name,
          type: item.item.type,
          stackable: item.item.stackable,
          weight: item.item.weight,
        },
      })),
      coins: inventoryData.coins,
      maxSlots: inventoryData.maxSlots,
    };

    // Emit local event for server-side systems
    this.emitTypedEvent(EventType.INVENTORY_UPDATED, inventoryUpdateData);

    // Broadcast to all clients if on server
    if (this.world.isServer) {
      const network = this.world.network as
        | { send?: (method: string, data: unknown) => void }
        | undefined;
      if (network && network.send) {
        network.send("inventoryUpdated", {
          playerId,
          items: inventoryUpdateData.items,
          coins: inventoryData.coins,
        });
      }
    }
  }

  // Public API
  getInventory(playerId: string): PlayerInventory | undefined {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) {
      Logger.systemError(
        "InventorySystem",
        `Invalid player ID in getInventory: "${playerId}"`,
        new Error(`Invalid player ID in getInventory: "${playerId}"`),
      );
      return undefined;
    }
    return this.playerInventories.get(playerIdKey);
  }

  getInventoryData(playerId: string): InventoryData {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) {
      Logger.systemError(
        "InventorySystem",
        `Invalid player ID in getInventoryData: "${playerId}"`,
        new Error(`Invalid player ID in getInventoryData: "${playerId}"`),
      );
      return { items: [], coins: 0, maxSlots: this.MAX_INVENTORY_SLOTS };
    }

    const inventory = this.playerInventories.get(playerIdKey);
    if (!inventory) {
      return { items: [], coins: 0, maxSlots: this.MAX_INVENTORY_SLOTS };
    }

    return {
      items: inventory.items.map((item) => ({
        slot: item.slot,
        itemId: item.itemId,
        quantity: item.quantity,
        item: {
          id: item.item.id,
          name: item.item.name,
          type: item.item.type,
          stackable: item.item.stackable ?? false,
          weight: item.item.weight ?? 0.1,
        },
      })),
      coins: inventory.coins,
      maxSlots: this.MAX_INVENTORY_SLOTS,
    };
  }

  hasItem(playerId: string, itemId: string, quantity: number = 1): boolean {
    // Validate IDs
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey || !isValidItemID(itemId)) {
      return false;
    }

    const inventory = this.playerInventories.get(playerIdKey);
    if (!inventory) return false;

    // Check coins
    if (itemId === "coins") {
      return inventory.coins >= quantity;
    }

    const totalQuantity = inventory.items
      .filter((item) => item.itemId === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);

    return totalQuantity >= quantity;
  }

  getItemQuantity(playerId: string, itemId: string): number {
    // Validate IDs
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey || !isValidItemID(itemId)) {
      return 0;
    }

    const inventory = this.playerInventories.get(playerIdKey);
    if (!inventory) return 0;

    if (itemId === "coins") {
      return inventory.coins;
    }

    return inventory.items
      .filter((item) => item.itemId === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  getCoins(playerId: string): number {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return 0;
    const inventory = this.playerInventories.get(playerIdKey);
    return inventory?.coins || 0;
  }

  getTotalWeight(playerId: string): number {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return 0;
    const inventory = this.playerInventories.get(playerIdKey);
    if (!inventory) return 0;

    return inventory.items.reduce((total, item) => {
      const itemData = getItem(item.itemId);
      return total + (itemData?.weight || 0) * item.quantity;
    }, 0);
  }

  isFull(playerId: string): boolean {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return false;
    const inventory = this.playerInventories.get(playerIdKey);
    if (!inventory) return false;

    return inventory.items.length >= this.MAX_INVENTORY_SLOTS;
  }

  // Store system event handlers
  protected getOrCreateInventory(playerId: string): PlayerInventory {
    if (!playerId) {
      Logger.systemError(
        "InventorySystem",
        "Cannot create inventory for undefined playerId",
        new Error("Cannot create inventory for undefined playerId"),
      );
      return {
        playerId: "",
        items: [],
        coins: 0,
      };
    }

    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) {
      Logger.systemError(
        "InventorySystem",
        `Invalid player ID: ${playerId}`,
        new Error(`Invalid player ID: ${playerId}`),
      );
      return {
        playerId: "",
        items: [],
        coins: 0,
      };
    }

    let inventory = this.playerInventories.get(playerIdKey);
    if (!inventory) {
      Logger.system(
        "InventorySystem",
        `Auto-initializing inventory for player ${playerId}`,
      );
      // Auto-initialize inventory if it doesn't exist
      inventory = {
        playerId,
        items: [],
        coins: 100, // Starting coins per GDD
      };
      this.playerInventories.set(playerIdKey, inventory);

      // Add starter equipment for auto-initialized players if enabled
      const enableStarter =
        typeof process !== "undefined" &&
        process.env &&
        process.env.PUBLIC_STARTER_ITEMS === "1";
      if (enableStarter) this.addStarterEquipment(playerIdKey);
    }
    return inventory;
  }

  // === Persistence helpers ===
  private getDatabase(): DatabaseSystem | null {
    return this.world.getSystem<DatabaseSystem>("database") || null;
  }

  private async loadPersistedInventoryAsync(
    playerId: string,
  ): Promise<boolean> {
    const db = this.getDatabase();
    if (!db) return false;

    const rows = await db.getPlayerInventoryAsync(playerId);
    const playerRow = await db.getPlayerAsync(playerId);

    const hasState = (rows && rows.length > 0) || !!playerRow;
    if (!hasState) {
      return false;
    }

    const pid = createPlayerID(playerId);
    const inv: PlayerInventory = {
      playerId: pid,
      items: [],
      coins: playerRow?.coins ?? 0,
    };
    this.playerInventories.set(pid, inv);

    for (const row of rows) {
      // Strong type assumption - row.slotIndex is number from database schema
      const slot = row.slotIndex ?? undefined;
      this.addItem({
        playerId,
        itemId: createItemID(String(row.itemId)),
        quantity: row.quantity || 1,
        slot,
      });
    }

    const data = this.getInventoryData(playerId);
    this.emitTypedEvent(EventType.INVENTORY_INITIALIZED, {
      playerId,
      inventory: {
        items: data.items.map((item) => ({
          slot: item.slot,
          itemId: item.itemId,
          quantity: item.quantity,
          item: {
            id: item.item.id,
            name: item.item.name,
            type: item.item.type,
            stackable: item.item.stackable,
            weight: item.item.weight,
          },
        })),
        coins: data.coins,
        maxSlots: data.maxSlots,
      },
    });
    return true;
  }

  private loadPersistedInventory(playerId: string): boolean {
    // This is now a sync wrapper that always returns false to trigger async load
    // The actual loading happens in the async init flow
    return false;
  }

  private scheduleInventoryPersist(playerId: string): void {
    const db = this.getDatabase();
    if (!db) return;
    const existing = this.persistTimers.get(playerId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      // Only persist if player is a real character in DB
      db.getPlayerAsync(playerId)
        .then((row) => {
          if (!row) return;
          const inv = this.getOrCreateInventory(playerId);
          const saveItems = inv.items.map((i) => ({
            itemId: i.itemId,
            quantity: i.quantity,
            slotIndex: i.slot,
            metadata: null as null,
          }));
          db.savePlayerInventory(playerId, saveItems);
          db.savePlayer(playerId, { coins: inv.coins });
        })
        .catch(() => {});
    }, 300);
    this.persistTimers.set(playerId, timer);
  }

  /**
   * Persist inventory immediately without debounce
   * CRITICAL for death system to prevent duplication exploits
   */
  async persistInventoryImmediate(playerId: string): Promise<void> {
    const db = this.getDatabase();
    if (!db) {
      console.warn(
        `[InventorySystem] Cannot persist inventory for ${playerId}: no database`,
      );
      return;
    }

    // Clear any pending debounced persist
    const existing = this.persistTimers.get(playerId);
    if (existing) {
      clearTimeout(existing);
      this.persistTimers.delete(playerId);
    }

    // Check if player exists in database
    const playerRow = await db.getPlayerAsync(playerId);
    if (!playerRow) {
      console.warn(
        `[InventorySystem] Cannot persist inventory for ${playerId}: player not in database`,
      );
      return;
    }

    const inv = this.getOrCreateInventory(playerId);
    const saveItems = inv.items.map((i) => ({
      itemId: i.itemId,
      quantity: i.quantity,
      slotIndex: i.slot,
      metadata: null as null,
    }));

    // Save immediately (synchronous/atomic)
    db.savePlayerInventory(playerId, saveItems);
    db.savePlayer(playerId, { coins: inv.coins });
  }

  /**
   * Clear inventory immediately with instant DB persist
   * CRITICAL for death system to prevent duplication
   */
  async clearInventoryImmediate(playerId: string): Promise<number> {
    const playerID = createPlayerID(playerId);
    const inventory = this.getOrCreateInventory(playerID);

    const droppedItemCount = inventory.items.length;

    // Clear the inventory (RuneScape-style: all items go to gravestone)
    inventory.items = [];
    // NOTE: Coins are protected and remain in coin pouch (RuneScape-style)

    // CRITICAL: Update UI by emitting inventory update event
    this.emitInventoryUpdate(playerID);

    // CRITICAL: Persist to database IMMEDIATELY (no debounce)
    await this.persistInventoryImmediate(playerId);

    return droppedItemCount;
  }

  private handleCanAdd(data: InventoryCanAddEvent): void {
    Logger.system(
      "InventorySystem",
      `Checking if player ${data.playerId} can add item`,
      { item: data.item },
    );
    const inventory = this.getOrCreateInventory(data.playerId);

    // Check if inventory has space
    const hasSpace = inventory.items.length < this.MAX_INVENTORY_SLOTS;

    // If stackable, check if we can stack with existing item
    if (data.item.stackable) {
      const existingItem = inventory.items.find(
        (item) => item.itemId === data.item.id,
      );
      if (existingItem) {
        Logger.system(
          "InventorySystem",
          "Can stack with existing item, space available: true",
        );
        data.callback(true);
        return;
      }
    }

    Logger.system(
      "InventorySystem",
      `Has space: ${hasSpace}, slots used: ${inventory.items.length}/${this.MAX_INVENTORY_SLOTS}`,
    );
    data.callback(hasSpace);
  }

  private handleRemoveCoins(data: InventoryRemoveCoinsEvent): void {
    Logger.system(
      "InventorySystem",
      `Removing ${data.amount} coins from player ${data.playerId}`,
    );
    const inventory = this.getOrCreateInventory(data.playerId);

    inventory.coins = Math.max(0, inventory.coins - data.amount);
    Logger.system(
      "InventorySystem",
      `Player ${data.playerId} now has ${inventory.coins} coins`,
    );

    this.emitTypedEvent(EventType.INVENTORY_COINS_UPDATED, {
      playerId: data.playerId,
      coins: inventory.coins,
    });
  }

  private handleInventoryCheck(data: InventoryCheckEvent): void {
    Logger.system(
      "InventorySystem",
      `Checking inventory for player ${data.playerId}, item ${data.itemId}, quantity ${data.quantity}`,
    );

    const itemId = String(data.itemId);
    const item = getItem(itemId);

    if (!item) {
      Logger.system(
        "InventorySystem",
        `Item ${itemId} not found in item database`,
      );
      data.callback(false, null);
      return;
    }

    const hasItem = this.hasItem(data.playerId, itemId, data.quantity);
    Logger.system("InventorySystem", `Player has item: ${hasItem}`);

    if (!hasItem) {
      data.callback(false, null);
      return;
    }

    // Find the inventory item
    const inventory = this.getOrCreateInventory(data.playerId);
    const inventoryItem = inventory.items.find((i) => i.itemId === itemId);

    const inventorySlot: InventoryItemInfo | null = inventoryItem
      ? {
          id: inventoryItem.itemId,
          quantity: inventoryItem.quantity,
          name: item.name,
          stackable: item.stackable ?? false,
          slot: inventoryItem.slot.toString(),
        }
      : null;

    data.callback(hasItem, inventorySlot);
  }

  private handleInventoryAdd(data: InventoryItemAddedPayload): void {
    // Validate the event data exists
    if (!data) {
      Logger.systemError(
        "InventorySystem",
        "handleInventoryAdd: data is undefined",
        new Error("handleInventoryAdd: data is undefined"),
      );
      return;
    }

    if (!data.item) {
      Logger.systemError(
        "InventorySystem",
        "handleInventoryAdd: data.item is undefined",
        new Error("handleInventoryAdd: data.item is undefined"),
      );
      return;
    }

    const playerId = data.playerId;
    const itemId = data.item.itemId;
    const quantity = data.item.quantity;
    // Extract slot if provided (used by bank sync to maintain slot consistency)
    const slot =
      typeof data.item.slot === "number" ? data.item.slot : undefined;

    // Validate the event data before processing
    if (!playerId) {
      Logger.systemError(
        "InventorySystem",
        "handleInventoryAdd: playerId is missing",
        new Error("handleInventoryAdd: playerId is missing"),
      );
      return;
    }

    if (!itemId) {
      Logger.systemError(
        "InventorySystem",
        "handleInventoryAdd: itemId is missing",
        new Error("handleInventoryAdd: itemId is missing"),
      );
      return;
    }

    // Strong type assumption - quantity is number from typed event payload
    if (!quantity || quantity <= 0) {
      Logger.systemError(
        "InventorySystem",
        "handleInventoryAdd: invalid quantity",
        new Error("handleInventoryAdd: invalid quantity"),
      );
      return;
    }

    // Pass slot to addItem for proper sync (e.g., from bank withdrawal)
    const result = this.addItem({ playerId, itemId, quantity, slot });
  }

  /**
   * Get skill data for a specific skill
   * Returns null if the skill doesn't exist or player has no data
   */
  getSkillData(
    _playerId: string,
    _skillName: string,
  ): { xp: number; level: number } | null {
    // For now, return default skill data
    // This would normally be stored with player data
    const defaultSkillData = {
      xp: 0,
      level: 1,
    };
    return defaultSkillData;
  }

  /**
   * Spawn an item in the world (for tests)
   * This is a test helper method
   */
  async spawnItem(
    itemId: string,
    position: { x: number; y: number; z: number },
    quantity: number,
  ): Promise<void> {
    // Emit event to spawn the item in the world
    this.emitTypedEvent(EventType.ITEM_SPAWN, {
      itemId,
      position,
      quantity,
    });
  }

  destroy(): void {
    // Stop auto-save interval
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = undefined;
    }

    // Clear all pending persist timers
    for (const timer of this.persistTimers.values()) {
      clearTimeout(timer);
    }
    this.persistTimers.clear();

    // Final save before shutdown
    if (this.world.isServer) {
      const db = this.getDatabase();
      if (db) {
        for (const playerId of this.playerInventories.keys()) {
          // Only save characters that exist in DB
          db.getPlayerAsync(playerId)
            .then((row) => {
              if (!row) return;
              const inv = this.getOrCreateInventory(playerId);
              const saveItems = inv.items.map((i) => ({
                itemId: i.itemId,
                quantity: i.quantity,
                slotIndex: i.slot,
                metadata: null as null,
              }));
              db.savePlayerInventory(playerId, saveItems);
              db.savePlayer(playerId, { coins: inv.coins });
            })
            .catch(() => {});
        }
      }
    }

    // Clear all player inventories on system shutdown
    this.playerInventories.clear();
    // Call parent cleanup (handles event listeners, timers, etc.)
    super.destroy();
  }
}
