/**
 * InventorySystem - Manages player inventories
 */

import { getSystem } from "../../../utils/SystemUtils";
import type { World } from "../../../types";
import type { InventoryItemAddedPayload } from "../../../types/events";
import { EventType } from "../../../types/events";
import { getItem } from "../../../data/items";
import type { PlayerInventory } from "../../../types/core/core";
import type {
  InventoryCanAddEvent,
  InventoryCheckEvent,
  InventoryItemInfo,
  InventorySyncData,
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
import { SystemBase } from "../infrastructure/SystemBase";
import { Logger } from "../../../utils/Logger";
import type { DatabaseSystem } from "../../../types/systems/system-interfaces";
import { MAX_COINS } from "./CoinPouchSystem";
import type { GroundItemSystem } from "../economy/GroundItemSystem";
import type { CoinPouchSystem } from "./CoinPouchSystem";
import { DeathState } from "../../../types/entities";

export class InventorySystem extends SystemBase {
  protected playerInventories = new Map<PlayerID, PlayerInventory>();
  private readonly MAX_INVENTORY_SLOTS = 28;
  /** Max stackable quantity — uses shared MAX_COINS (PostgreSQL integer max) */
  private readonly MAX_QUANTITY = MAX_COINS;
  // Pickup locks to prevent race conditions when multiple players try to pickup same item
  private pickupLocks = new Set<string>();

  // Track players whose inventories are being loaded from DB (prevents race conditions)
  private loadingInventories = new Set<string>();
  // Track players whose inventories have been fully initialized from DB
  private initializedInventories = new Set<string>();

  /**
   * Transaction locks for critical operations (bank, store, trade).
   * While locked:
   * - addItem() rejects new items (pickups blocked)
   * - Only the lock holder can modify inventory
   *
   * This prevents race conditions between in-memory InventorySystem and
   * direct database operations in transaction handlers.
   */
  private transactionLocks = new Set<string>();

  /**
   * Async operation queue for serialized execution.
   * Each player has their own queue - operations execute in order.
   * This allows optimistic UI on client while server processes sequentially.
   */
  private operationQueues = new Map<
    string,
    Array<{
      execute: () => Promise<void>;
      resolve: (value: boolean) => void;
    }>
  >();
  private processingQueues = new Set<string>();

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
    // Subscribe to inventory events
    // PLAYER_REGISTERED: Just initialize empty inventory structure
    // Actual data loading happens in PLAYER_JOINED with payload from character-selection
    this.subscribe(
      EventType.PLAYER_REGISTERED,
      (data: { playerId: string }) => {
        // Initialize empty inventory structure - data will be populated by PLAYER_JOINED
        this.initializeInventory({ id: data.playerId });
      },
    );

    // CRITICAL: Inventory is now passed via event payload from character-selection
    // This eliminates the race condition where two systems query DB independently
    this.subscribe(
      EventType.PLAYER_JOINED,
      async (data: { playerId: string; inventory?: InventorySyncData[] }) => {
        // Use inventory from payload (single source of truth from character-selection)
        if (data.inventory && data.inventory.length > 0) {
          await this.loadInventoryFromPayload(data.playerId, data.inventory);
        } else if (data.inventory) {
          // Empty array = new player or no items, inventory already initialized
          // Mark as initialized so requests work immediately
          this.initializedInventories.add(data.playerId);
        } else {
          // Backwards compatibility: no inventory in payload, fall back to DB query
          const loaded = await this.loadPersistedInventoryAsync(data.playerId);
          if (!loaded) {
            // Mark as initialized even if DB had nothing (new player)
            this.initializedInventories.add(data.playerId);
          }
        }
      },
    );

    this.subscribe(EventType.PLAYER_CLEANUP, (data) => {
      this.cleanupInventory({ id: data.playerId });
    });
    this.subscribe(EventType.INVENTORY_ITEM_REMOVED, async (data) => {
      await this.removeItem(data);
    });
    // Handle remove item requests (e.g., from store sell)
    this.subscribe<{ playerId: string; itemId: string; quantity: number }>(
      EventType.INVENTORY_REMOVE_ITEM,
      async (data) => {
        await this.removeItem(data);
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
    // NOTE: Coin events now handled by CoinPouchSystem
    this.subscribe(EventType.INVENTORY_MOVE, async (data) => {
      await this.moveItem(data);
    });
    this.subscribe(EventType.INVENTORY_DROP_ALL, async (data) => {
      await this.dropAllItems({
        playerId: data.playerId,
        position: data.position,
      });
    });

    // Subscribe to store system events
    this.subscribe(EventType.INVENTORY_CAN_ADD, (data) => {
      this.handleCanAdd(data);
    });
    // NOTE: INVENTORY_REMOVE_COINS and INVENTORY_ADD_COINS now handled by CoinPouchSystem
    this.subscribe(EventType.INVENTORY_ITEM_ADDED, async (data) => {
      await this.handleInventoryAdd(data);
    });

    // Subscribe to inventory check events
    this.subscribe(EventType.INVENTORY_CHECK, (data: InventoryCheckEvent) => {
      this.handleInventoryCheck(data);
    });

    // Subscribe to starter chest looted event
    this.subscribe(
      EventType.STARTER_CHEST_LOOTED,
      async (data: {
        playerId: string;
        items: Array<{ itemId: string; quantity: number }>;
      }) => {
        await this.handleStarterChestLooted(data);
      },
    );
  }

  /**
   * Handle starter chest looted event - add starter items to player inventory
   */
  private async handleStarterChestLooted(data: {
    playerId: string;
    items: Array<{ itemId: string; quantity: number }>;
  }): Promise<void> {
    console.log(
      `[InventorySystem] STARTER_CHEST_LOOTED event received: playerId=${data.playerId}, items=${data.items?.length}`,
    );

    const { playerId, items } = data;

    if (!playerId || !items || items.length === 0) {
      Logger.systemError(
        "InventorySystem",
        "handleStarterChestLooted: invalid data",
        new Error("handleStarterChestLooted: invalid data"),
      );
      return;
    }

    console.log(
      `[InventorySystem] Adding ${items.length} starter items to player ${playerId}`,
    );

    // Add each starter item to the player's inventory
    for (const item of items) {
      const itemData = getItem(item.itemId);
      if (!itemData) {
        console.warn(
          `[InventorySystem] Starter item not found: ${item.itemId}`,
        );
        continue;
      }

      await this.addItem({
        playerId,
        itemId: createItemID(item.itemId),
        quantity: item.quantity,
      });
    }

    console.log(
      `[InventorySystem] Starter items added successfully for player ${playerId}`,
    );
  }

  start(): void {
    // Write-through persistence: no auto-save needed, all mutations persist immediately
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

    // Mark as initialized before emitting event
    this.initializedInventories.add(playerData.id);

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

    // Emit initial weight for stamina drain calculations
    const totalWeight = this.getTotalWeight(playerData.id);
    this.emitTypedEvent(EventType.PLAYER_WEIGHT_CHANGED, {
      playerId: playerData.id,
      weight: totalWeight,
    });
  }

  private async addStarterEquipment(playerId: PlayerID): Promise<void> {
    const starterItems = [
      { itemId: "bronze_shortsword", quantity: 1 },
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

    for (const { itemId, quantity } of starterItems) {
      await this.addItem({ playerId, itemId: createItemID(itemId), quantity });
    }
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
                // NOTE: Coins are now persisted by CoinPouchSystem
              }
            })
            .catch(() => {});
        }
      }
    }
    this.playerInventories.delete(playerId);
    // Clean up tracking sets
    this.loadingInventories.delete(data.id);
    this.initializedInventories.delete(data.id);
  }

  protected async addItem(data: {
    playerId: string;
    itemId: string;
    quantity: number;
    slot?: number;
    silent?: boolean; // When true, skip emitInventoryUpdate and persistInventoryImmediate
  }): Promise<boolean> {
    if (!data.playerId) {
      Logger.systemError(
        "InventorySystem",
        "Cannot add item: playerId is undefined",
        new Error("Cannot add item: playerId is undefined"),
      );
      return false;
    }

    // CRITICAL: Reject adds during transaction lock (prevents race conditions)
    // This blocks pickups while bank/store/trade operations are in progress
    if (this.transactionLocks.has(data.playerId)) {
      Logger.system(
        "InventorySystem",
        `Cannot add item during transaction lock: ${data.playerId}`,
      );
      // Emit toast so player understands why pickup failed
      this.emitTypedEvent(EventType.UI_TOAST, {
        playerId: data.playerId,
        message: "Close bank/store first to pick up items",
        type: "warning",
      });
      return false;
    }

    // Block item adds during death state (prevents race condition)
    // When a player dies, items picked up between inventory snapshot and clear
    // would persist after respawn. Block all adds while player is dying/dead.
    if (this.isPlayerInDeathState(data.playerId)) {
      Logger.system(
        "InventorySystem",
        `Cannot add item during death state: ${data.playerId}`,
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

    // Special handling for coins - delegate to CoinPouchSystem
    if (itemId === "coins") {
      const coinPouchSystem = this.getCoinPouchSystem();
      if (coinPouchSystem) {
        await coinPouchSystem.addCoins(playerId, data.quantity, data.silent);
      } else {
        // Fallback: emit event for CoinPouchSystem to handle
        this.emitTypedEvent(EventType.INVENTORY_ADD_COINS, {
          playerId,
          amount: data.quantity,
        });
      }

      // Sync inventory to client (updates UI immediately)
      if (!data.silent) {
        const playerIdKey = toPlayerID(playerId);
        if (playerIdKey) {
          this.emitInventoryUpdate(playerIdKey);
        }
      }
      return true;
    }

    // Check if item is stackable
    if (itemData.stackable) {
      // Find existing stack
      const existingItem = inventory.items.find(
        (item) => item.itemId === itemId,
      );
      if (existingItem) {
        existingItem.quantity = Math.min(
          existingItem.quantity + data.quantity,
          this.MAX_QUANTITY,
        );
        // Skip updates in silent mode
        if (!data.silent) {
          const playerIdKey = toPlayerID(playerId);
          if (playerIdKey) {
            this.emitInventoryUpdate(playerIdKey);
            await this.persistInventoryImmediate(playerId);
          }
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
          if (added === 0 && !data.silent) {
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

      // Skip updates in silent mode
      if (added > 0 && !data.silent) {
        const playerIdKey = toPlayerID(playerId);
        if (playerIdKey) {
          this.emitInventoryUpdate(playerIdKey);
          await this.persistInventoryImmediate(playerId);
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
      if (!data.silent) {
        this.emitTypedEvent(EventType.INVENTORY_FULL, { playerId: playerId });
      }
      return false;
    }

    // Add new item to the target slot
    inventory.items.push({
      slot: targetSlot,
      itemId: itemId,
      quantity: data.quantity,
      item: itemData,
    });

    // Skip updates in silent mode
    if (!data.silent) {
      const playerIdKey = toPlayerID(playerId);
      if (playerIdKey) {
        this.emitInventoryUpdate(playerIdKey);
        await this.persistInventoryImmediate(playerId);
      }
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

  private async removeItem(data: {
    playerId: string;
    itemId: string | number;
    quantity: number;
    slot?: number;
  }): Promise<boolean> {
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

    // Handle coins - delegate to CoinPouchSystem
    if (itemId === "coins") {
      const coinPouchSystem = this.getCoinPouchSystem();
      if (coinPouchSystem) {
        const newBalance = await coinPouchSystem.removeCoins(
          playerId,
          data.quantity,
        );
        return newBalance >= 0; // -1 means insufficient funds
      } else {
        // Fallback: emit event for CoinPouchSystem to handle
        this.emitTypedEvent(EventType.INVENTORY_REMOVE_COINS, {
          playerId,
          amount: data.quantity,
        });
        return true;
      }
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
        await this.persistInventoryImmediate(data.playerId);
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
    const removed = await this.removeItem({
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
      const groundItems = this.world.getSystem("ground-items");
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
  private async dropAllItems(data: {
    playerId: string;
    position: { x: number; y: number; z: number };
  }): Promise<void> {
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

    // CRITICAL: Must await to prevent duplication exploits on death
    await this.persistEmptyInventory(data.playerId);

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
    // SERVER-SIDE ONLY: Prevent duplication by ensuring only server processes item use
    // Client sends the request via event, server validates and processes
    if (!this.world.isServer) {
      return;
    }

    // === SECURITY: Bounds validation (OWASP) ===
    if (data.slot < 0 || data.slot >= this.MAX_INVENTORY_SLOTS) {
      Logger.systemError(
        "InventorySystem",
        `Invalid slot ${data.slot} (must be 0-${this.MAX_INVENTORY_SLOTS - 1})`,
        new Error("Invalid slot index"),
      );
      return;
    }

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

    // === SECURITY: Validate claimed itemId matches actual item at slot (OWASP) ===
    // Prevents client from claiming a different item than what's in the slot
    if (item.item.id !== data.itemId) {
      Logger.systemError(
        "InventorySystem",
        `Item mismatch: claimed ${data.itemId} but slot ${data.slot} has ${item.item.id}`,
        new Error("Item ID mismatch - potential exploit attempt"),
      );
      return;
    }

    // Emit item used event for other systems to react to (different from INVENTORY_USE to avoid recursion)
    // NOTE: Consumable removal is handled by the consuming system (e.g., PlayerSystem for food)
    // after it validates the action can proceed (e.g., eat delay check).
    // This prevents items being consumed when the action is rejected.
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
  }

  private async pickupItem(data: {
    playerId: string;
    entityId: string;
    itemId?: string;
  }): Promise<void> {
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

      // Check loot protection (OSRS: killer has 1 minute exclusivity on mob loot)
      const groundItems = this.world.getSystem("ground-items");
      if (groundItems) {
        const currentTick = this.world.currentTick ?? 0;
        if (!groundItems.canPickup(data.entityId, data.playerId, currentTick)) {
          this.emitTypedEvent(EventType.UI_TOAST, {
            playerId: data.playerId,
            message: "This item belongs to another player.",
            type: "warning",
          });
          return;
        }
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

      // RESPONSIVE PICKUP: Add to memory first (silent = skip DB persist + emit),
      // remove ground entity and emit inventory update immediately so the player
      // sees instant feedback, THEN await the DB persist (still guaranteed, just
      // doesn't block the visible actions). Pickup lock is held throughout.
      const added = await this.addItem({
        playerId: data.playerId,
        itemId: itemData.id,
        quantity,
        silent: true, // We'll emit update + persist ourselves after world removal
      });

      if (added) {
        let worldRemovalSuccess = false;

        // Use GroundItemSystem if available - it handles entity destruction AND pile updates
        const groundItemsSystem = this.world.getSystem("ground-items");
        if (groundItemsSystem) {
          // removeGroundItem returns boolean indicating success
          worldRemovalSuccess = groundItemsSystem.removeGroundItem(
            data.entityId,
          );
        } else {
          // Fallback: destroy entity directly if GroundItemSystem not available
          worldRemovalSuccess = entityManager.destroyEntity(data.entityId);
        }

        // ROLLBACK: If world removal failed, remove item from inventory to prevent dupe
        if (!worldRemovalSuccess) {
          Logger.systemError(
            "InventorySystem",
            `Failed to remove item ${data.entityId} from world, rolling back inventory add`,
            new Error(`Pickup rollback for entity ${data.entityId}`),
          );

          // Remove the item we just added
          await this.removeItem({
            playerId: data.playerId,
            itemId: itemData.id,
            quantity,
          });

          // Notify player
          this.emitTypedEvent(EventType.UI_TOAST, {
            playerId: data.playerId,
            message: "Failed to pick up item. Please try again.",
            type: "warning",
          });
        } else {
          // Success: emit inventory update to client IMMEDIATELY (no DB wait)
          const playerIdKey = toPlayerID(data.playerId);
          if (playerIdKey) {
            this.emitInventoryUpdate(playerIdKey);
          }

          // Await DB persist — item is already visible to client and ground entity
          // is destroyed, but we still guarantee persistence before releasing the
          // pickup lock to prevent any race conditions.
          if (itemId === "coins") {
            const coinSystem = this.getCoinPouchSystem();
            if (coinSystem) {
              await coinSystem.persistCoinsImmediate(data.playerId);
            }
          } else {
            await this.persistInventoryImmediate(data.playerId);
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

  // NOTE: updateCoins() removed - now handled by CoinPouchSystem

  /**
   * Move/swap items between inventory slots (OSRS-style)
   *
   * Implements OSRS-style SWAP behavior:
   * - If both slots have items: swap them
   * - If only source has item: move to destination
   * - If source is empty: no-op
   *
   * Security:
   * - Validates slot indices are within bounds [0, MAX_INVENTORY_SLOTS)
   * - Validates playerId is present
   * - Logs errors for invalid operations
   *
   * @param data - Move request with playerId and slot indices
   */
  private async moveItem(data: {
    playerId: string;
    fromSlot?: number;
    toSlot?: number;
    sourceSlot?: number;
    targetSlot?: number;
  }): Promise<void> {
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

    // Validate slot indices are within bounds (defense in depth - handler also validates)
    if (
      !Number.isInteger(fromSlot) ||
      fromSlot < 0 ||
      fromSlot >= this.MAX_INVENTORY_SLOTS
    ) {
      Logger.systemError(
        "InventorySystem",
        `Cannot move item: fromSlot ${fromSlot} out of bounds [0, ${this.MAX_INVENTORY_SLOTS})`,
        new Error("Invalid fromSlot"),
        { data },
      );
      return;
    }

    if (
      !Number.isInteger(toSlot) ||
      toSlot < 0 ||
      toSlot >= this.MAX_INVENTORY_SLOTS
    ) {
      Logger.systemError(
        "InventorySystem",
        `Cannot move item: toSlot ${toSlot} out of bounds [0, ${this.MAX_INVENTORY_SLOTS})`,
        new Error("Invalid toSlot"),
        { data },
      );
      return;
    }

    // Same slot - no-op (shouldn't reach here, but handle gracefully)
    if (fromSlot === toSlot) {
      return;
    }

    const inventory = this.getOrCreateInventory(data.playerId);

    const fromItem = inventory.items.find((item) => item.slot === fromSlot);
    const toItem = inventory.items.find((item) => item.slot === toSlot);

    // Can't move from empty slot
    if (!fromItem) {
      Logger.system(
        "InventorySystem",
        `moveItem: source slot ${fromSlot} is empty for player ${data.playerId}`,
      );
      return;
    }

    // OSRS-style swap
    if (toItem) {
      // Both slots occupied - swap
      fromItem.slot = toSlot;
      toItem.slot = fromSlot;
    } else {
      // Only source occupied - move to empty destination
      fromItem.slot = toSlot;
    }

    const playerIdKey = toPlayerID(data.playerId);
    if (playerIdKey) {
      this.emitInventoryUpdate(playerIdKey);
      await this.persistInventoryImmediate(data.playerId);
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

    // Calculate and emit weight change (for stamina drain calculations)
    const totalWeight = this.getTotalWeight(playerId);
    this.emitTypedEvent(EventType.PLAYER_WEIGHT_CHANGED, {
      playerId,
      weight: totalWeight,
    });

    // NOTE: Network broadcasting is handled by EventBridge which listens for
    // INVENTORY_UPDATED and PLAYER_WEIGHT_CHANGED events and routes them
    // to the specific player only (not broadcast to all clients).
  }

  // ========== Transaction Lock API ==========

  /**
   * Acquire a transaction lock for critical inventory operations.
   *
   * While locked:
   * - addItem() will reject new items (pickups blocked)
   * - Only the lock holder can modify inventory
   *
   * CRITICAL: Always release with unlockTransaction() in a finally block!
   *
   * @param playerId - Player to lock
   * @returns true if lock acquired, false if already locked
   */
  public lockForTransaction(playerId: string): boolean {
    if (this.transactionLocks.has(playerId)) {
      Logger.system(
        "InventorySystem",
        `Transaction lock already held for player: ${playerId}`,
      );
      return false;
    }

    this.transactionLocks.add(playerId);

    return true;
  }

  /**
   * Release a transaction lock.
   * Always call this in a finally block after lockForTransaction().
   *
   * @param playerId - Player to unlock
   */
  public unlockTransaction(playerId: string): void {
    this.transactionLocks.delete(playerId);
  }

  /**
   * Check if a player is locked for a transaction.
   *
   * @param playerId - Player to check
   * @returns true if locked
   */
  public isLockedForTransaction(playerId: string): boolean {
    return this.transactionLocks.has(playerId);
  }

  // ============================================================================
  // ASYNC OPERATION QUEUE
  // ============================================================================

  /**
   * Queue an operation for serialized execution.
   *
   * Unlike lockForTransaction() which REJECTS if busy, this method WAITS.
   * Operations are queued per-player and executed in order.
   *
   * This enables optimistic UI on client:
   * - Client sends all 5 clicks immediately (shows optimistic state)
   * - Server queues and processes all 5 in order
   * - No requests rejected, no data lost
   *
   * @param playerId - Player ID
   * @param operation - Async operation to execute (should acquire lock internally)
   * @returns Promise that resolves when operation completes (true=success, false=failed)
   */
  public async queueOperation(
    playerId: string,
    operation: () => Promise<boolean>,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // Get or create queue for this player
      if (!this.operationQueues.has(playerId)) {
        this.operationQueues.set(playerId, []);
      }

      const queue = this.operationQueues.get(playerId)!;

      // Add operation to queue
      queue.push({
        execute: async () => {
          try {
            const success = await operation();
            resolve(success);
          } catch (error) {
            console.error(
              `[InventorySystem] Queued operation failed for ${playerId}:`,
              error,
            );
            resolve(false);
          }
        },
        resolve,
      });

      // Start processing if not already processing
      this.processQueue(playerId);
    });
  }

  /**
   * Process the operation queue for a player.
   * Executes operations one at a time in order.
   */
  private async processQueue(playerId: string): Promise<void> {
    // Already processing this player's queue
    if (this.processingQueues.has(playerId)) {
      return;
    }

    this.processingQueues.add(playerId);

    const queue = this.operationQueues.get(playerId);
    if (!queue) {
      this.processingQueues.delete(playerId);
      return;
    }

    // Process operations one at a time
    while (queue.length > 0) {
      const op = queue.shift()!;
      await op.execute();
    }

    // Cleanup
    this.processingQueues.delete(playerId);
    if (queue.length === 0) {
      this.operationQueues.delete(playerId);
    }
  }

  /**
   * Reload inventory from database, REPLACING in-memory state.
   *
   * CRITICAL: Only call while holding transaction lock!
   * This makes DB authoritative - in-memory becomes exact mirror.
   *
   * Used after bank/store/trade transactions to ensure in-memory
   * state matches what the transaction wrote to the database.
   *
   * @param playerId - Player whose inventory to reload
   */
  public async reloadFromDatabase(playerId: string): Promise<void> {
    const db = this.getDatabase();
    if (!db) {
      Logger.system(
        "InventorySystem",
        `Cannot reload inventory for ${playerId}: no database`,
      );
      return;
    }

    const rows = await db.getPlayerInventoryAsync(playerId);
    const playerIdKey = createPlayerID(playerId);

    // REPLACE entire in-memory inventory with DB state
    const inventory: PlayerInventory = {
      playerId: playerIdKey,
      items: [],
      coins: 0, // Coins managed by CoinPouchSystem, not stored here
    };

    for (const row of rows) {
      const itemData = getItem(row.itemId);
      if (itemData) {
        inventory.items.push({
          slot: row.slotIndex ?? 0,
          itemId: row.itemId,
          quantity: row.quantity ?? 1,
          item: itemData,
        });
      }
    }

    this.playerInventories.set(playerIdKey, inventory);
    this.initializedInventories.add(playerId);

    // Emit update to refresh client UI
    this.emitInventoryUpdate(playerIdKey);
  }

  // ========== Public API ==========

  /**
   * Get the full inventory state for a player.
   *
   * Returns the raw PlayerInventory object containing items and metadata.
   * Use {@link getInventoryData} for a cleaned data object suitable for UI.
   *
   * @param playerId - The player ID to look up
   * @returns PlayerInventory object, or undefined if not found
   *
   * @example
   * const inventory = inventorySystem.getInventory(playerId);
   * if (inventory) {
   *   console.log(`Player has ${inventory.items.length} items`);
   * }
   */
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

  /**
   * Check if a player's inventory is fully initialized and ready to use.
   * Returns false if the inventory is currently being loaded from the database.
   * Use this before responding to INVENTORY_REQUEST to avoid race conditions.
   */
  isInventoryReady(playerId: string): boolean {
    // If currently loading, not ready
    if (this.loadingInventories.has(playerId)) {
      return false;
    }
    // If explicitly initialized, it's ready
    if (this.initializedInventories.has(playerId)) {
      return true;
    }
    // If inventory exists in memory (auto-created or loaded), consider it ready
    const playerIdKey = toPlayerID(playerId);
    if (playerIdKey && this.playerInventories.has(playerIdKey)) {
      return true;
    }
    // Not loaded and not loading - needs initialization
    return false;
  }

  /**
   * Get CoinPouchSystem reference (lazy loaded)
   */
  private getCoinPouchSystem(): CoinPouchSystem | null {
    return this.world.getSystem<CoinPouchSystem>("coin-pouch") || null;
  }

  /**
   * Get inventory data formatted for UI display and network sync.
   *
   * Returns a cleaned InventoryData object with:
   * - Mapped item data (slot, itemId, quantity, item details)
   * - Current coin balance (from CoinPouchSystem)
   * - Maximum slot count
   *
   * @param playerId - The player ID to look up
   * @returns InventoryData object suitable for UI rendering
   *
   * @example
   * const data = inventorySystem.getInventoryData(playerId);
   * renderInventoryUI(data.items, data.coins, data.maxSlots);
   */
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

    // Get coins from CoinPouchSystem (source of truth)
    // If CoinPouchSystem hasn't initialized this player yet, fall back to inventory.coins
    const coinPouchSystem = this.getCoinPouchSystem();
    let coins: number;
    if (coinPouchSystem?.isPlayerInitialized(playerId)) {
      coins = coinPouchSystem.getCoins(playerId);
    } else {
      // Fallback: CoinPouchSystem not ready, use local inventory coins
      coins = inventory.coins ?? 0;
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
      coins,
      maxSlots: this.MAX_INVENTORY_SLOTS,
    };
  }

  /**
   * Check if a player has at least a certain quantity of an item.
   *
   * For stackable items, checks the total quantity across all slots.
   * For non-stackable items, counts individual instances.
   * For coins, delegates to CoinPouchSystem.
   *
   * @param playerId - The player ID to check
   * @param itemId - The item ID to search for
   * @param quantity - Minimum quantity required (default: 1)
   * @returns true if player has at least the specified quantity
   *
   * @example
   * if (inventorySystem.hasItem(playerId, "logs", 5)) {
   *   // Player can craft a fire
   * }
   */
  hasItem(playerId: string, itemId: string, quantity: number = 1): boolean {
    // Validate IDs
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey || !isValidItemID(itemId)) {
      return false;
    }

    const inventory = this.playerInventories.get(playerIdKey);
    if (!inventory) return false;

    // Delegate coin checks to CoinPouchSystem
    if (itemId === "coins") {
      const coinPouchSystem = this.getCoinPouchSystem();
      return coinPouchSystem?.hasCoins(playerId, quantity) ?? false;
    }

    const totalQuantity = inventory.items
      .filter((item) => item.itemId === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);

    return totalQuantity >= quantity;
  }

  /**
   * Get the total quantity of a specific item in a player's inventory.
   *
   * Sums quantities across all slots for stackable items.
   * For non-stackable items, counts individual instances.
   * For coins, delegates to CoinPouchSystem.
   *
   * @param playerId - The player ID to check
   * @param itemId - The item ID to count
   * @returns Total quantity of the item (0 if none found)
   *
   * @example
   * const logCount = inventorySystem.getItemQuantity(playerId, "logs");
   * showMessage(`You have ${logCount} logs.`);
   */
  getItemQuantity(playerId: string, itemId: string): number {
    // Validate IDs
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey || !isValidItemID(itemId)) {
      return 0;
    }

    const inventory = this.playerInventories.get(playerIdKey);
    if (!inventory) return 0;

    // Delegate coin queries to CoinPouchSystem
    if (itemId === "coins") {
      return this.getCoins(playerId);
    }

    return inventory.items
      .filter((item) => item.itemId === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Get player's coin balance.
   *
   * Delegates to CoinPouchSystem which is the source of truth
   * for all coin-related operations.
   *
   * @param playerId - The player ID to check
   * @returns Current coin balance (0 if not found)
   *
   * @see {@link CoinPouchSystem.getCoins}
   */
  getCoins(playerId: string): number {
    const coinPouchSystem = this.getCoinPouchSystem();
    if (coinPouchSystem?.isPlayerInitialized(playerId)) {
      return coinPouchSystem.getCoins(playerId);
    }
    // Fallback: check local inventory if CoinPouchSystem not ready
    const playerIdKey = toPlayerID(playerId);
    if (playerIdKey) {
      const inventory = this.playerInventories.get(playerIdKey);
      return inventory?.coins ?? 0;
    }
    return 0;
  }

  /**
   * Calculate the total weight of all items in a player's inventory.
   *
   * Multiplies each item's base weight by its quantity.
   * Used for encumbrance mechanics and carry capacity limits.
   *
   * @param playerId - The player ID to check
   * @returns Total weight in arbitrary units (0 if no inventory)
   *
   * @example
   * const weight = inventorySystem.getTotalWeight(playerId);
   * if (weight > MAX_CARRY_WEIGHT) {
   *   showMessage("You are overburdened!");
   * }
   */
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

  /**
   * Check if a player's inventory has no empty slots.
   *
   * Note: This only checks slot count. Stackable items may still
   * be added to existing stacks even when inventory is "full".
   * Use {@link canAddItem} for complete space validation.
   *
   * @param playerId - The player ID to check
   * @returns true if all 28 inventory slots are occupied
   *
   * @example
   * if (inventorySystem.isFull(playerId)) {
   *   showMessage("Your inventory is full!");
   * }
   */
  isFull(playerId: string): boolean {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return false;
    const inventory = this.playerInventories.get(playerIdKey);
    if (!inventory) return false;

    return inventory.items.length >= this.MAX_INVENTORY_SLOTS;
  }

  /**
   * Check if inventory has space for a given number of slots.
   * Used by EquipmentSystem to verify space before unequipping.
   *
   * @param playerId - The player ID to check
   * @param slotsNeeded - Number of slots needed (default 1)
   * @returns true if inventory has enough empty slots
   */
  hasSpace(playerId: string, slotsNeeded: number = 1): boolean {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return false;
    const inventory = this.playerInventories.get(playerIdKey);
    if (!inventory) return true; // New inventory has space

    const usedSlots = inventory.items.length;
    const emptySlots = this.MAX_INVENTORY_SLOTS - usedSlots;
    return emptySlots >= slotsNeeded;
  }

  /**
   * Check if a specific item exists at a specific inventory slot.
   * Used by EquipmentSystem to verify item before equipping.
   *
   * @param playerId - The player ID
   * @param itemId - The item ID to check for
   * @param slot - The inventory slot to check
   * @returns true if the item exists at the specified slot
   */
  hasItemAtSlot(playerId: string, itemId: string, slot: number): boolean {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey || !isValidItemID(itemId)) return false;

    const inventory = this.playerInventories.get(playerIdKey);
    if (!inventory) return false;

    const item = inventory.items.find((i) => i.slot === slot);
    return item !== undefined && item.itemId === itemId;
  }

  /**
   * Directly remove an item from inventory (synchronous, returns success).
   * Used by EquipmentSystem to ensure atomic equip operations.
   *
   * @param playerId - The player ID
   * @param params - Removal parameters (itemId, quantity, optional slot)
   * @returns true if removal succeeded, false otherwise
   */
  async removeItemDirect(
    playerId: string,
    params: { itemId: string; quantity: number; slot?: number },
  ): Promise<boolean> {
    return this.removeItem({
      playerId,
      itemId: params.itemId,
      quantity: params.quantity,
      slot: params.slot,
    });
  }

  /**
   * Directly add an item to inventory (synchronous, returns success).
   * Used by EquipmentSystem to ensure atomic unequip operations.
   *
   * @param playerId - The player ID
   * @param params - Add parameters (itemId, quantity)
   * @returns true if add succeeded, false otherwise
   */
  async addItemDirect(
    playerId: string,
    params: { itemId: string; quantity: number },
  ): Promise<boolean> {
    // Check if we can add
    if (!this.canAddItem(playerId, params.itemId, params.quantity)) {
      return false;
    }

    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey || !isValidItemID(params.itemId)) {
      return false;
    }

    const inventory = this.getOrCreateInventory(playerId);
    const itemData = getItem(params.itemId);
    if (!itemData) {
      return false;
    }

    // Find existing stack or empty slot
    if (itemData.stackable) {
      const existing = inventory.items.find((i) => i.itemId === params.itemId);
      if (existing) {
        existing.quantity = Math.min(
          existing.quantity + params.quantity,
          this.MAX_QUANTITY,
        );
        this.emitInventoryUpdate(playerIdKey);
        await this.persistInventoryImmediate(playerId);
        return true;
      }
    }

    // Find empty slot
    const usedSlots = new Set(inventory.items.map((i) => i.slot));
    let emptySlot = -1;
    for (let i = 0; i < this.MAX_INVENTORY_SLOTS; i++) {
      if (!usedSlots.has(i)) {
        emptySlot = i;
        break;
      }
    }

    if (emptySlot === -1) {
      return false; // No space
    }

    // Add item - use same format as other inventory add operations
    inventory.items.push({
      slot: emptySlot,
      itemId: params.itemId,
      quantity: params.quantity,
      item: itemData,
    });

    this.emitInventoryUpdate(playerIdKey);
    await this.persistInventoryImmediate(playerId);
    return true;
  }

  /**
   * Check if player is in death state (DYING or DEAD).
   *
   * Used to block item additions during death processing, which prevents
   * a race condition where items picked up between inventory snapshot
   * and inventory clear would persist after respawn.
   *
   * @param playerId - The player ID to check
   * @returns true if player is currently dying or dead
   */
  private isPlayerInDeathState(playerId: string): boolean {
    // Check player entity's death state (single source of truth)
    const playerEntity = this.world.entities?.get?.(playerId);
    if (playerEntity && "data" in playerEntity) {
      const data = playerEntity.data as { deathState?: DeathState };
      if (data?.deathState) {
        return (
          data.deathState === DeathState.DYING ||
          data.deathState === DeathState.DEAD
        );
      }
    }
    return false;
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
      // CRITICAL: Don't auto-create if inventory is currently being loaded from DB
      // This prevents race conditions where an empty inventory is created during async load
      if (this.loadingInventories.has(playerId)) {
        // Return empty placeholder - the real inventory is being loaded
        // Systems should not modify inventory during this brief window
        return {
          playerId,
          items: [],
          coins: 0,
        };
      }

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
      this.initializedInventories.add(playerId);

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

  /**
   * Load inventory from event payload data (single source of truth pattern)
   *
   * Called when PLAYER_JOINED event includes inventory data from character-selection.
   * This eliminates the race condition where InventorySystem and character-selection
   * both query the database independently, potentially causing stale data.
   *
   * @param playerId - The player ID
   * @param inventoryData - Inventory data from event payload
   */
  private async loadInventoryFromPayload(
    playerId: string,
    inventoryData: InventorySyncData[],
  ): Promise<void> {
    // Mark as loading to prevent race conditions
    this.loadingInventories.add(playerId);

    try {
      const pid = createPlayerID(playerId);
      let inv = this.playerInventories.get(pid);

      if (!inv) {
        inv = {
          playerId: pid,
          items: [],
          coins: 0,
        };
        this.playerInventories.set(pid, inv);
      } else {
        // Clear existing items before loading from payload
        inv.items = [];
      }

      // Use silent mode to batch load without emitting updates for each item
      for (const row of inventoryData) {
        await this.addItem({
          playerId,
          itemId: createItemID(String(row.itemId)),
          quantity: row.quantity || 1,
          slot: row.slotIndex,
          silent: true, // Don't emit updates during batch load
        });
      }

      // Mark as fully initialized before emitting event
      this.initializedInventories.add(playerId);
      this.loadingInventories.delete(playerId);

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

      // Emit initial weight for stamina drain calculations
      const totalWeight = this.getTotalWeight(playerId);
      this.emitTypedEvent(EventType.PLAYER_WEIGHT_CHANGED, {
        playerId,
        weight: totalWeight,
      });
    } catch (error) {
      this.loadingInventories.delete(playerId);
      throw error;
    }
  }

  private async loadPersistedInventoryAsync(
    playerId: string,
  ): Promise<boolean> {
    // Mark inventory as loading to prevent race conditions with INVENTORY_REQUEST
    this.loadingInventories.add(playerId);

    try {
      const db = this.getDatabase();
      if (!db) {
        this.loadingInventories.delete(playerId);
        return false;
      }

      const rows = await db.getPlayerInventoryAsync(playerId);
      const playerRow = await db.getPlayerAsync(playerId);

      const hasState = (rows && rows.length > 0) || !!playerRow;
      if (!hasState) {
        this.loadingInventories.delete(playerId);
        return false;
      }

      const pid = createPlayerID(playerId);
      const inv: PlayerInventory = {
        playerId: pid,
        items: [],
        coins: playerRow?.coins ?? 0,
      };
      this.playerInventories.set(pid, inv);

      // Use silent mode to batch load without emitting updates for each item
      // A single INVENTORY_INITIALIZED event is emitted at the end
      for (const row of rows) {
        // Strong type assumption - row.slotIndex is number from database schema
        const slot = row.slotIndex ?? undefined;
        await this.addItem({
          playerId,
          itemId: createItemID(String(row.itemId)),
          quantity: row.quantity || 1,
          slot,
          silent: true, // Don't emit updates during batch load
        });
      }

      // Mark as fully initialized before emitting event
      this.initializedInventories.add(playerId);
      this.loadingInventories.delete(playerId);

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

      // Emit initial weight for stamina drain calculations
      const totalWeight = this.getTotalWeight(playerId);
      this.emitTypedEvent(EventType.PLAYER_WEIGHT_CHANGED, {
        playerId,
        weight: totalWeight,
      });

      return true;
    } catch (error) {
      this.loadingInventories.delete(playerId);
      throw error;
    }
  }

  private loadPersistedInventory(_playerId: string): boolean {
    // This is now a sync wrapper that always returns false to trigger async load
    // The actual loading happens in the async init flow
    return false;
  }

  /**
   * Persist inventory immediately without debounce.
   * Concurrent calls for the same player are serialized by DatabaseSystem's
   * per-player write lock, preventing PostgreSQL deadlocks.
   */
  async persistInventoryImmediate(playerId: string): Promise<void> {
    const db = this.getDatabase();
    if (!db) {
      console.warn(
        `[InventorySystem] Cannot persist inventory for ${playerId}: no database`,
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

    // Await ensures DB is updated before callers proceed (e.g., bank transactions).
    // Per-player write lock in DatabaseSystem prevents concurrent transaction deadlocks.
    // No player-exists check needed — the repository upsert is harmless for missing players.
    await db.savePlayerInventoryAsync(playerId, saveItems);
    // NOTE: Coins are now persisted by CoinPouchSystem
  }

  /**
   * Persist an empty inventory directly to the database, bypassing
   * persistInventoryImmediate. Used by death handlers where we must
   * await the DB write to prevent item duplication exploits — the
   * inventory is already cleared in memory so we send an empty array
   * rather than re-reading the (now empty) in-memory state.
   */
  private async persistEmptyInventory(playerId: string): Promise<void> {
    const db = this.getDatabase();
    if (!db) return;

    // No player-exists check needed — deleting inventory for a missing player is a no-op.
    await db.savePlayerInventoryAsync(playerId, []);
  }

  /**
   * Clear inventory immediately with instant DB persist
   * CRITICAL for death system to prevent duplication
   */
  async clearInventoryImmediate(
    playerId: string,
    skipPersist?: boolean,
  ): Promise<number> {
    const playerID = createPlayerID(playerId);
    const inventory = this.getOrCreateInventory(playerID);

    const droppedItemCount = inventory.items.length;

    // Clear the inventory (RuneScape-style: all items go to gravestone)
    inventory.items = [];
    // NOTE: Coins are protected and remain in coin pouch (RuneScape-style)

    // CRITICAL: Update UI by emitting inventory update event
    this.emitInventoryUpdate(playerID);

    // When called inside a DB transaction, skip independent persist to maintain
    // atomicity — caller is responsible for persisting after transaction commits
    if (!skipPersist) {
      // CRITICAL: Must await to prevent duplication exploits on death
      await this.persistEmptyInventory(playerId);
    }

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

  // NOTE: handleRemoveCoins() removed - now handled by CoinPouchSystem

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

  private async handleInventoryAdd(
    data: InventoryItemAddedPayload,
  ): Promise<void> {
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
    await this.addItem({ playerId, itemId, quantity, slot });
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

  /**
   * Async destroy - properly awaits all database saves before cleanup.
   * Call this for graceful shutdown to prevent data loss.
   */
  async destroyAsync(): Promise<void> {
    // Final save pass for all connected players before shutdown
    if (this.world.isServer) {
      const db = this.getDatabase();
      if (db) {
        const savePromises: Promise<void>[] = [];

        for (const playerId of this.playerInventories.keys()) {
          // Create save promise for each player
          const savePromise = (async () => {
            const row = await db.getPlayerAsync(playerId);
            if (!row) return;

            const inv = this.getOrCreateInventory(playerId);
            const saveItems = inv.items.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
              slotIndex: i.slot,
              metadata: null as null,
            }));
            await db.savePlayerInventoryAsync(playerId, saveItems);
            // NOTE: Coins are now persisted by CoinPouchSystem
          })();

          savePromises.push(savePromise);
        }

        // Wait for all saves to complete (with error handling)
        const results = await Promise.allSettled(savePromises);
        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          Logger.systemError(
            "InventorySystem",
            `${failures.length} inventory saves failed during shutdown`,
            new Error("Partial save failure on shutdown"),
          );
        }
      }
    }

    // Clear all player inventories on system shutdown
    this.playerInventories.clear();
    // Call parent cleanup (handles event listeners, timers, etc.)
    super.destroy();
  }

  destroy(): void {
    // Fire-and-forget async cleanup (best effort for non-async callers)
    this.destroyAsync().catch((err) => {
      Logger.systemError(
        "InventorySystem",
        "Error during async destroy",
        err instanceof Error ? err : new Error(String(err)),
      );
    });
  }
}
