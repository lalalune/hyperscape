/**
 * Store Packet Handlers
 *
 * Handles all store-related network packets:
 * - storeOpen: Player opens store interface
 * - storeBuy: Player buys item from store
 * - storeSell: Player sells item to store
 * - storeClose: Player closes store interface
 *
 * SECURITY MEASURES:
 * - Atomic transactions prevent duplication/loss
 * - Row-level locking (SELECT FOR UPDATE) prevents race conditions
 * - Input validation prevents injection and overflow
 * - Quantity bounds checking prevents integer overflow
 * - Coin balance verification before purchase
 * - Inventory space verification before adding items
 * - Distance validation using Chebyshev distance (OSRS-style)
 *
 * This follows the same security patterns as bank.ts.
 * Common patterns are extracted to ./common/ for reuse.
 */

import {
  type World,
  EventType,
  getItem,
  StoreSystem,
  SessionType,
  INPUT_LIMITS,
} from "@hyperscape/shared";
import type { ServerSocket } from "../../../shared/types";
import { InventoryRepository } from "../../../database/repositories/InventoryRepository";
import * as schema from "../../../database/schema";
import { eq, sql } from "drizzle-orm";

// Import shared input validation and rate limiting from services
import {
  RateLimitService,
  isValidItemId,
  isValidStoreId,
  isValidQuantity,
} from "../services";

// Import common handler utilities (Phase: Extract Common Patterns)
import {
  validateTransactionRequest,
  executeSecureTransaction,
  emitInventorySyncEvents,
  sendToSocket,
  sendErrorToast,
  sendSuccessToast,
  getPlayerId,
} from "./common";

// Single rate limiter instance for store operations
const rateLimiter = new RateLimitService();

// Local alias for shared constant
const MAX_INVENTORY_SLOTS = INPUT_LIMITS.MAX_INVENTORY_SLOTS;

/**
 * Check if multiplication would overflow safe integer bounds
 */
function wouldPriceOverflow(price: number, quantity: number): boolean {
  return price > INPUT_LIMITS.MAX_QUANTITY / quantity;
}

/**
 * Get store from StoreSystem (the authoritative source)
 * Returns null if store not found
 */
function getStoreFromSystem(
  storeId: string,
  world: World,
): ReturnType<StoreSystem["getStore"]> {
  const storeSystem = world.getSystem("store") as StoreSystem | undefined;
  if (!storeSystem) {
    console.warn("[StoreHandler] StoreSystem not available");
    return undefined;
  }
  return storeSystem.getStore(storeId);
}

/**
 * Handle store open request (from Trade button)
 *
 * Emits STORE_OPEN_REQUEST which is handled by EventBridge
 * to look up the store and send storeState packet.
 * InteractionSessionManager automatically tracks the session with targetEntityId.
 * (Phase 6: session manager is single source of truth for entity IDs)
 */
export function handleStoreOpen(
  socket: ServerSocket,
  data: { npcId: string; storeId?: string; npcEntityId?: string },
  world: World,
): void {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[StoreHandler] No player on socket for storeOpen");
    return;
  }

  // Emit STORE_OPEN_REQUEST - EventBridge handles store lookup and state sending
  // InteractionSessionManager listens to this event and creates session with targetEntityId
  world.emit(EventType.STORE_OPEN_REQUEST, {
    playerId,
    npcId: data.npcId,
    inventory: [], // Inventory required by event type (not used for store open)
  });
}

/**
 * Handle store buy request
 *
 * SECURITY MEASURES (using common utilities):
 * - validateTransactionRequest: player, rate limit, distance, db
 * - Input validation (itemId, quantity, storeId)
 * - Coin balance verification BEFORE deduction
 * - Inventory space verification
 * - executeSecureTransaction: atomic transaction with row-level locking and retry
 * - emitInventorySyncEvents: in-memory cache sync
 */
export async function handleStoreBuy(
  socket: ServerSocket,
  data: { storeId: string; itemId: string; quantity: number },
  world: World,
): Promise<void> {
  // Step 1: Common validation (player, rate limit, distance, db)
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.STORE,
    rateLimiter,
  );

  if (!baseResult.success) {
    return; // Error already sent to client
  }

  const ctx = baseResult.context;

  // Step 2: Store-specific input validation
  if (!isValidStoreId(data.storeId)) {
    sendErrorToast(socket, "Invalid store");
    return;
  }

  if (!isValidItemId(data.itemId)) {
    sendErrorToast(socket, "Invalid item");
    return;
  }

  if (!isValidQuantity(data.quantity)) {
    sendErrorToast(socket, "Invalid quantity");
    return;
  }

  // Step 3: Validate store exists
  const store = getStoreFromSystem(data.storeId, world);
  if (!store) {
    sendErrorToast(socket, "Store not found");
    return;
  }

  // Step 4: Validate item exists in store
  const storeItem = store.items.find(
    (item) => item.itemId === data.itemId || item.id === data.itemId,
  );
  if (!storeItem) {
    sendErrorToast(socket, "Item not available in this store");
    return;
  }

  // Step 5: Validate item exists in game database
  const itemData = getItem(data.itemId);
  if (!itemData) {
    sendErrorToast(socket, "Item data not found");
    return;
  }

  // Step 6: Check stock (if not unlimited)
  if (
    storeItem.stockQuantity !== undefined &&
    storeItem.stockQuantity !== -1 &&
    storeItem.stockQuantity < data.quantity
  ) {
    sendErrorToast(socket, "Not enough stock available");
    return;
  }

  // Step 7: Check for price overflow
  if (wouldPriceOverflow(storeItem.price, data.quantity)) {
    sendErrorToast(socket, "Transaction too large");
    return;
  }

  const totalCost = storeItem.price * data.quantity;

  // Step 8: Execute transaction with automatic retry
  const result = await executeSecureTransaction(ctx, {
    execute: async (tx) => {
      // Lock player row and check coin balance
      const playerResult = await tx.execute(
        sql`SELECT coins FROM characters WHERE id = ${ctx.playerId} FOR UPDATE`,
      );

      const playerRow = playerResult.rows[0] as { coins: number } | undefined;
      if (!playerRow) {
        throw new Error("PLAYER_NOT_FOUND");
      }

      if (playerRow.coins < totalCost) {
        throw new Error("INSUFFICIENT_COINS");
      }

      // Lock inventory and check space
      const inventoryResult = await tx.execute(
        sql`SELECT * FROM inventory WHERE "playerId" = ${ctx.playerId} FOR UPDATE`,
      );

      const inventoryRows = inventoryResult.rows as Array<{
        id: number;
        playerId: string;
        itemId: string;
        quantity: number | null;
        slotIndex: number | null;
      }>;

      const usedSlots = new Set(
        inventoryRows
          .filter((r) => r.slotIndex !== null && r.slotIndex >= 0)
          .map((r) => r.slotIndex),
      );

      // Calculate slots needed
      const isStackable = itemData.stackable === true;
      const existingStack = isStackable
        ? inventoryRows.find((r) => r.itemId === data.itemId)
        : null;

      const slotsNeeded = isStackable ? (existingStack ? 0 : 1) : data.quantity;

      // Find free slots
      const freeSlots: number[] = [];
      for (
        let i = 0;
        i < MAX_INVENTORY_SLOTS && freeSlots.length < slotsNeeded;
        i++
      ) {
        if (!usedSlots.has(i)) {
          freeSlots.push(i);
        }
      }

      if (freeSlots.length < slotsNeeded) {
        throw new Error("INVENTORY_FULL");
      }

      // Deduct coins
      await tx.execute(
        sql`UPDATE characters SET coins = coins - ${totalCost} WHERE id = ${ctx.playerId}`,
      );

      // Add items to inventory
      const addedSlots: Array<{
        slot: number;
        quantity: number;
        itemId: string;
      }> = [];

      if (isStackable) {
        if (existingStack) {
          await tx.execute(
            sql`UPDATE inventory SET quantity = quantity + ${data.quantity}
                WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${data.itemId}`,
          );
          addedSlots.push({
            slot: existingStack.slotIndex ?? -1,
            quantity: data.quantity,
            itemId: data.itemId,
          });
        } else {
          await tx.insert(schema.inventory).values({
            playerId: ctx.playerId,
            itemId: data.itemId,
            quantity: data.quantity,
            slotIndex: freeSlots[0],
            metadata: null,
          });
          addedSlots.push({
            slot: freeSlots[0],
            quantity: data.quantity,
            itemId: data.itemId,
          });
        }
      } else {
        for (let i = 0; i < data.quantity; i++) {
          await tx.insert(schema.inventory).values({
            playerId: ctx.playerId,
            itemId: data.itemId,
            quantity: 1,
            slotIndex: freeSlots[i],
            metadata: null,
          });
          addedSlots.push({
            slot: freeSlots[i],
            quantity: 1,
            itemId: data.itemId,
          });
        }
      }

      // Update store stock (in-memory only)
      if (
        storeItem.stockQuantity !== undefined &&
        storeItem.stockQuantity !== -1
      ) {
        storeItem.stockQuantity -= data.quantity;
      }

      return {
        addedSlots,
        newCoinBalance: playerRow.coins - totalCost,
      };
    },
  });

  if (!result) return; // Error already handled by executeSecureTransaction

  // Step 9: Send updated inventory to client
  const inventoryRepo = new InventoryRepository(ctx.db.drizzle, ctx.db.pool);
  const updatedInventory = await inventoryRepo.getPlayerInventoryAsync(
    ctx.playerId,
  );

  sendToSocket(socket, "inventoryUpdated", {
    playerId: ctx.playerId,
    items: updatedInventory.map((i) => ({
      slot: i.slotIndex ?? -1,
      itemId: i.itemId,
      quantity: i.quantity ?? 1,
    })),
    coins: result.newCoinBalance,
  });

  // Step 10: Sync in-memory cache (using common utility)
  emitInventorySyncEvents(ctx, {
    addedSlots: result.addedSlots,
    newCoinBalance: result.newCoinBalance,
  });

  sendSuccessToast(
    socket,
    `Purchased ${data.quantity}x ${itemData.name} for ${totalCost} coins`,
  );
}

/**
 * Handle store sell request
 *
 * SECURITY MEASURES (using common utilities):
 * - validateTransactionRequest: player, rate limit, distance, db
 * - Input validation (itemId, quantity, storeId)
 * - Inventory verification BEFORE removal
 * - executeSecureTransaction: atomic transaction with row-level locking and retry
 * - emitInventorySyncEvents: in-memory cache sync
 */
export async function handleStoreSell(
  socket: ServerSocket,
  data: { storeId: string; itemId: string; quantity: number },
  world: World,
): Promise<void> {
  // Step 1: Common validation (player, rate limit, distance, db)
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.STORE,
    rateLimiter,
  );

  if (!baseResult.success) {
    return; // Error already sent to client
  }

  const ctx = baseResult.context;

  // Step 2: Store-specific input validation
  if (!isValidStoreId(data.storeId)) {
    sendErrorToast(socket, "Invalid store");
    return;
  }

  if (!isValidItemId(data.itemId)) {
    sendErrorToast(socket, "Invalid item");
    return;
  }

  if (!isValidQuantity(data.quantity)) {
    sendErrorToast(socket, "Invalid quantity");
    return;
  }

  // Step 3: Validate store exists and accepts buyback
  const store = getStoreFromSystem(data.storeId, world);
  if (!store) {
    sendErrorToast(socket, "Store not found");
    return;
  }

  if (!store.buyback) {
    sendErrorToast(socket, "This store doesn't buy items");
    return;
  }

  // Step 4: Validate item exists in game database
  const itemData = getItem(data.itemId);
  if (!itemData) {
    sendErrorToast(socket, "Item data not found");
    return;
  }

  // Step 5: Calculate sell price
  const baseValue = itemData.value ?? 0;
  if (baseValue <= 0) {
    sendErrorToast(socket, "This item cannot be sold");
    return;
  }

  const buybackRate = store.buybackRate ?? 0.5;
  const sellPrice = Math.floor(baseValue * buybackRate);

  // Step 6: Check for price overflow
  if (wouldPriceOverflow(sellPrice, data.quantity)) {
    sendErrorToast(socket, "Transaction too large");
    return;
  }

  const totalValue = sellPrice * data.quantity;

  // Step 7: Execute transaction with automatic retry
  const result = await executeSecureTransaction(ctx, {
    execute: async (tx) => {
      // Lock inventory rows for this item
      const inventoryResult = await tx.execute(
        sql`SELECT * FROM inventory
            WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${data.itemId}
            ORDER BY "slotIndex"
            FOR UPDATE`,
      );

      const invRows = inventoryResult.rows as Array<{
        id: number;
        playerId: string;
        itemId: string;
        quantity: number | null;
        slotIndex: number | null;
      }>;

      if (invRows.length === 0) {
        throw new Error("ITEM_NOT_FOUND");
      }

      // Calculate total available quantity across all rows
      let totalAvailable = 0;
      for (const item of invRows) {
        totalAvailable += item.quantity ?? 1;
      }

      if (totalAvailable < data.quantity) {
        throw new Error("INSUFFICIENT_QUANTITY");
      }

      // Lock player row for coin update
      const playerResult = await tx.execute(
        sql`SELECT coins FROM characters WHERE id = ${ctx.playerId} FOR UPDATE`,
      );

      const playerRow = playerResult.rows[0] as { coins: number } | undefined;
      if (!playerRow) {
        throw new Error("PLAYER_NOT_FOUND");
      }

      // Remove items from inventory (delete/update rows)
      const removedSlots: Array<{
        slot: number;
        quantity: number;
        itemId: string;
      }> = [];
      let remaining = data.quantity;

      for (const item of invRows) {
        if (remaining <= 0) break;

        const itemQty = item.quantity ?? 1;
        const itemSlot = item.slotIndex ?? -1;

        if (itemQty <= remaining) {
          // Delete entire row
          await tx
            .delete(schema.inventory)
            .where(eq(schema.inventory.id, item.id));
          removedSlots.push({
            slot: itemSlot,
            quantity: itemQty,
            itemId: data.itemId,
          });
          remaining -= itemQty;
        } else {
          // Reduce quantity on this row
          await tx
            .update(schema.inventory)
            .set({ quantity: itemQty - remaining })
            .where(eq(schema.inventory.id, item.id));
          removedSlots.push({
            slot: itemSlot,
            quantity: remaining,
            itemId: data.itemId,
          });
          remaining = 0;
        }
      }

      // Add coins to player
      await tx.execute(
        sql`UPDATE characters SET coins = coins + ${totalValue} WHERE id = ${ctx.playerId}`,
      );

      return {
        removedSlots,
        newCoinBalance: playerRow.coins + totalValue,
      };
    },
  });

  if (!result) return; // Error already handled by executeSecureTransaction

  // Step 8: Send updated inventory to client
  const inventoryRepo = new InventoryRepository(ctx.db.drizzle, ctx.db.pool);
  const updatedInventory = await inventoryRepo.getPlayerInventoryAsync(
    ctx.playerId,
  );

  sendToSocket(socket, "inventoryUpdated", {
    playerId: ctx.playerId,
    items: updatedInventory.map((i) => ({
      slot: i.slotIndex ?? -1,
      itemId: i.itemId,
      quantity: i.quantity ?? 1,
    })),
    coins: result.newCoinBalance,
  });

  // Step 9: Sync in-memory cache (using common utility)
  emitInventorySyncEvents(ctx, {
    removedSlots: result.removedSlots,
    newCoinBalance: result.newCoinBalance,
  });

  sendSuccessToast(
    socket,
    `Sold ${data.quantity}x ${itemData.name} for ${totalValue} coins`,
  );
}

/**
 * Handle store close request
 * (Phase 6: InteractionSessionManager handles session cleanup via STORE_CLOSE event)
 */
export function handleStoreClose(
  socket: ServerSocket,
  data: { storeId: string },
  world: World,
): void {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[StoreHandler] No player on socket for storeClose");
    return;
  }

  // Phase 6: Removed socket.activeStoreNpcEntityId = undefined
  // InteractionSessionManager handles session cleanup automatically

  world.emit(EventType.STORE_CLOSE, {
    playerId,
    storeId: data.storeId,
  });
}
