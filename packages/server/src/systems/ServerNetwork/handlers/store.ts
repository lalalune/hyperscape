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
 *
 * This follows the same security patterns as bank.ts.
 */

import {
  type World,
  EventType,
  getItem,
  getStoreById,
} from "@hyperscape/shared";
import type { ServerSocket } from "../../../shared/types";
import { InventoryRepository } from "../../../database/repositories/InventoryRepository";
import type pg from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../database/schema";
import { eq, sql } from "drizzle-orm";

// Constants for safety limits
const MAX_INVENTORY_SLOTS = 28;
const MAX_ITEM_QUANTITY = 2147483647; // PostgreSQL integer max
const MAX_ITEM_ID_LENGTH = 100;
const MAX_STORE_ID_LENGTH = 100;

// Rate limiting: Prevents rapid-fire exploit attempts
const lastOperationTime = new Map<string, number>();
const RATE_LIMIT_MS = 50; // 50ms = allows ~20 ops/sec

/**
 * Get player ID from socket
 */
function getPlayerId(socket: ServerSocket): string | null {
  return socket.player?.id || null;
}

/**
 * Send packet to socket
 */
function sendToSocket(
  socket: ServerSocket,
  packet: string,
  data: unknown,
): void {
  if (socket.send) {
    socket.send(packet, data);
  }
}

/**
 * Get database from world
 */
function getDatabase(world: World): {
  drizzle: NodePgDatabase<typeof schema>;
  pool: pg.Pool;
} | null {
  const serverWorld = world as {
    pgPool?: pg.Pool;
    drizzleDb?: NodePgDatabase<typeof schema>;
  };

  if (serverWorld.drizzleDb && serverWorld.pgPool) {
    return {
      drizzle: serverWorld.drizzleDb,
      pool: serverWorld.pgPool,
    };
  }
  return null;
}

/**
 * Validate itemId - must be non-empty string within length limits
 */
function isValidItemId(itemId: unknown): itemId is string {
  return (
    typeof itemId === "string" &&
    itemId.length > 0 &&
    itemId.length <= MAX_ITEM_ID_LENGTH &&
    // Prevent null bytes and control characters
    !/[\x00-\x1f]/.test(itemId)
  );
}

/**
 * Validate storeId - must be non-empty string within length limits
 */
function isValidStoreId(storeId: unknown): storeId is string {
  return (
    typeof storeId === "string" &&
    storeId.length > 0 &&
    storeId.length <= MAX_STORE_ID_LENGTH &&
    !/[\x00-\x1f]/.test(storeId)
  );
}

/**
 * Validate quantity - must be positive integer within safe bounds
 */
function isValidQuantity(quantity: unknown): quantity is number {
  return (
    typeof quantity === "number" &&
    Number.isInteger(quantity) &&
    quantity > 0 &&
    quantity <= MAX_ITEM_QUANTITY
  );
}

/**
 * Rate limiting check - prevents rapid-fire exploit attempts
 * Returns true if operation should be allowed
 */
function checkRateLimit(playerId: string): boolean {
  const now = Date.now();
  const lastOp = lastOperationTime.get(playerId) ?? 0;

  if (now - lastOp < RATE_LIMIT_MS) {
    return false; // Rate limited
  }

  lastOperationTime.set(playerId, now);

  // Cleanup old entries periodically (every 1000 operations)
  if (lastOperationTime.size > 1000) {
    const cutoff = now - 60000; // Remove entries older than 1 minute
    for (const [id, time] of lastOperationTime.entries()) {
      if (time < cutoff) {
        lastOperationTime.delete(id);
      }
    }
  }

  return true;
}

/**
 * Validate item exists in game database
 */
function isValidGameItem(itemId: string): boolean {
  const item = getItem(itemId);
  return item !== null;
}

/**
 * Handle store open request (from Trade button)
 *
 * Emits STORE_OPEN_REQUEST which is handled by EventBridge
 * to look up the store and send storeState packet.
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

  console.log(
    `[StoreHandler] Opening store for ${playerId}, npcId: ${data.npcId}, storeId: ${data.storeId || "auto-lookup"}`,
  );

  // Emit STORE_OPEN_REQUEST - EventBridge handles store lookup and state sending
  world.emit(EventType.STORE_OPEN_REQUEST, {
    playerId,
    npcId: data.npcId,
    storeId: data.storeId,
    npcEntityId: data.npcEntityId,
  });
}

/**
 * Handle store buy request
 *
 * SECURITY MEASURES:
 * - Input validation (itemId, quantity, storeId)
 * - Rate limiting
 * - Coin balance verification BEFORE deduction
 * - Inventory space verification
 * - Atomic transaction with row-level locking
 */
export async function handleStoreBuy(
  socket: ServerSocket,
  data: { storeId: string; itemId: string; quantity: number },
  world: World,
): Promise<void> {
  // Step 1: Get and validate player
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[StoreHandler] No player on socket for storeBuy");
    return;
  }

  // Step 2: Rate limiting
  if (!checkRateLimit(playerId)) {
    sendToSocket(socket, "showToast", {
      message: "Please wait before buying again",
      type: "error",
    });
    return;
  }

  // Step 3: Input validation
  if (!isValidStoreId(data.storeId)) {
    sendToSocket(socket, "showToast", {
      message: "Invalid store",
      type: "error",
    });
    return;
  }

  if (!isValidItemId(data.itemId)) {
    sendToSocket(socket, "showToast", {
      message: "Invalid item",
      type: "error",
    });
    return;
  }

  if (!isValidQuantity(data.quantity)) {
    sendToSocket(socket, "showToast", {
      message: "Invalid quantity",
      type: "error",
    });
    return;
  }

  // Step 4: Validate store exists
  const store = getStoreById(data.storeId);
  if (!store) {
    sendToSocket(socket, "showToast", {
      message: "Store not found",
      type: "error",
    });
    return;
  }

  // Step 5: Validate item exists in store
  const storeItem = store.items.find(
    (item) => item.itemId === data.itemId || item.id === data.itemId,
  );
  if (!storeItem) {
    sendToSocket(socket, "showToast", {
      message: "Item not available in this store",
      type: "error",
    });
    return;
  }

  // Step 6: Validate item exists in game database
  const itemData = getItem(data.itemId);
  if (!itemData) {
    sendToSocket(socket, "showToast", {
      message: "Item data not found",
      type: "error",
    });
    return;
  }

  // Step 7: Check stock (if not unlimited)
  if (
    storeItem.stockQuantity !== undefined &&
    storeItem.stockQuantity !== -1 &&
    storeItem.stockQuantity < data.quantity
  ) {
    sendToSocket(socket, "showToast", {
      message: "Not enough stock available",
      type: "error",
    });
    return;
  }

  // Step 8: Calculate total cost
  const totalCost = storeItem.price * data.quantity;

  // Step 9: Get database
  const db = getDatabase(world);
  if (!db) {
    console.error("[StoreHandler] Database not available for storeBuy");
    sendToSocket(socket, "showToast", {
      message: "Server error - please try again",
      type: "error",
    });
    return;
  }

  // Track added slots for in-memory sync
  const addedSlots: Array<{ slot: number; quantity: number }> = [];
  let newCoinBalance = 0;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    addedSlots.length = 0; // Reset on each attempt

    try {
      await db.drizzle.transaction(async (tx) => {
        // Step 10a: Lock player row and check coin balance
        const playerResult = await tx.execute(
          sql`SELECT coins FROM characters WHERE id = ${playerId} FOR UPDATE`,
        );

        const playerRow = playerResult.rows[0] as { coins: number } | undefined;
        if (!playerRow) {
          throw new Error("PLAYER_NOT_FOUND");
        }

        if (playerRow.coins < totalCost) {
          throw new Error("INSUFFICIENT_COINS");
        }

        // Step 10b: Lock inventory and check space
        const inventoryResult = await tx.execute(
          sql`SELECT * FROM inventory WHERE "playerId" = ${playerId} FOR UPDATE`,
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
        // Stackable items: 1 slot (or stack with existing)
        // Non-stackable items: N slots (one per item)
        const isStackable = itemData.stackable === true;
        const existingStack = isStackable
          ? inventoryRows.find((r) => r.itemId === data.itemId)
          : null;

        let slotsNeeded = 0;
        if (isStackable) {
          slotsNeeded = existingStack ? 0 : 1; // Need 1 new slot if no existing stack
        } else {
          slotsNeeded = data.quantity; // Need N slots for non-stackable
        }

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

        // Step 10c: Deduct coins
        await tx.execute(
          sql`UPDATE characters SET coins = coins - ${totalCost} WHERE id = ${playerId}`,
        );
        newCoinBalance = playerRow.coins - totalCost;

        // Step 10d: Add items to inventory
        if (isStackable) {
          if (existingStack) {
            // Stack with existing
            await tx.execute(
              sql`UPDATE inventory SET quantity = quantity + ${data.quantity}
                  WHERE "playerId" = ${playerId} AND "itemId" = ${data.itemId}`,
            );
            addedSlots.push({
              slot: existingStack.slotIndex ?? -1,
              quantity: data.quantity,
            });
          } else {
            // Create new stack
            await tx.insert(schema.inventory).values({
              playerId,
              itemId: data.itemId,
              quantity: data.quantity,
              slotIndex: freeSlots[0],
              metadata: null,
            });
            addedSlots.push({ slot: freeSlots[0], quantity: data.quantity });
          }
        } else {
          // Non-stackable: create N separate rows
          for (let i = 0; i < data.quantity; i++) {
            await tx.insert(schema.inventory).values({
              playerId,
              itemId: data.itemId,
              quantity: 1,
              slotIndex: freeSlots[i],
              metadata: null,
            });
            addedSlots.push({ slot: freeSlots[i], quantity: 1 });
          }
        }

        // Step 10e: Update store stock (if not unlimited) - in-memory only
        if (
          storeItem.stockQuantity !== undefined &&
          storeItem.stockQuantity !== -1
        ) {
          storeItem.stockQuantity -= data.quantity;
        }
      });

      // Transaction succeeded - send updated states
      const inventoryRepo = new InventoryRepository(db.drizzle, db.pool);
      const updatedInventory =
        await inventoryRepo.getPlayerInventoryAsync(playerId);

      sendToSocket(socket, "inventoryUpdated", {
        playerId,
        items: updatedInventory.map((i) => ({
          slot: i.slotIndex ?? -1,
          itemId: i.itemId,
          quantity: i.quantity ?? 1,
        })),
        coins: newCoinBalance,
      });

      // Sync in-memory InventorySystem
      // Emit INVENTORY_ITEM_ADDED for each slot we added to
      for (const added of addedSlots) {
        world.emit(EventType.INVENTORY_ITEM_ADDED, {
          playerId,
          item: {
            id: 0,
            itemId: data.itemId,
            quantity: added.quantity,
            slot: added.slot,
            metadata: null,
          },
        });
      }

      // Emit coin update for in-memory sync
      world.emit(EventType.INVENTORY_COINS_UPDATED, {
        playerId,
        coins: newCoinBalance,
      });

      sendToSocket(socket, "showToast", {
        message: `Purchased ${data.quantity}x ${itemData.name} for ${totalCost} coins`,
        type: "success",
      });

      return;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg === "PLAYER_NOT_FOUND") {
        sendToSocket(socket, "showToast", {
          message: "Character not found",
          type: "error",
        });
        return;
      }
      if (errorMsg === "INSUFFICIENT_COINS") {
        sendToSocket(socket, "showToast", {
          message: "Not enough coins",
          type: "error",
        });
        return;
      }
      if (errorMsg === "INVENTORY_FULL") {
        sendToSocket(socket, "showToast", {
          message: "Inventory is full",
          type: "error",
        });
        return;
      }

      // Retry on serialization/constraint conflicts
      const isConflict =
        errorMsg.includes("unique constraint") ||
        errorMsg.includes("could not serialize") ||
        errorMsg.includes("deadlock");

      if (isConflict && attempt < maxRetries - 1) {
        // Small delay before retry to reduce contention
        await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
        continue;
      }

      console.error("[StoreHandler] Buy transaction failed:", error);
      sendToSocket(socket, "showToast", {
        message: "Purchase failed - please try again",
        type: "error",
      });
      return;
    }
  }
}

/**
 * Handle store sell request
 *
 * SECURITY MEASURES:
 * - Input validation (itemId, quantity, storeId)
 * - Rate limiting
 * - Inventory verification BEFORE removal
 * - Atomic transaction with row-level locking
 */
export async function handleStoreSell(
  socket: ServerSocket,
  data: { storeId: string; itemId: string; quantity: number },
  world: World,
): Promise<void> {
  // Step 1: Get and validate player
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[StoreHandler] No player on socket for storeSell");
    return;
  }

  // Step 2: Rate limiting
  if (!checkRateLimit(playerId)) {
    sendToSocket(socket, "showToast", {
      message: "Please wait before selling again",
      type: "error",
    });
    return;
  }

  // Step 3: Input validation
  if (!isValidStoreId(data.storeId)) {
    sendToSocket(socket, "showToast", {
      message: "Invalid store",
      type: "error",
    });
    return;
  }

  if (!isValidItemId(data.itemId)) {
    sendToSocket(socket, "showToast", {
      message: "Invalid item",
      type: "error",
    });
    return;
  }

  if (!isValidQuantity(data.quantity)) {
    sendToSocket(socket, "showToast", {
      message: "Invalid quantity",
      type: "error",
    });
    return;
  }

  // Step 4: Validate store exists and accepts buyback
  const store = getStoreById(data.storeId);
  if (!store) {
    sendToSocket(socket, "showToast", {
      message: "Store not found",
      type: "error",
    });
    return;
  }

  if (!store.buyback) {
    sendToSocket(socket, "showToast", {
      message: "This store doesn't buy items",
      type: "error",
    });
    return;
  }

  // Step 5: Validate item exists in game database
  const itemData = getItem(data.itemId);
  if (!itemData) {
    sendToSocket(socket, "showToast", {
      message: "Item data not found",
      type: "error",
    });
    return;
  }

  // Step 6: Calculate sell price
  const baseValue = itemData.value ?? 0;
  if (baseValue <= 0) {
    sendToSocket(socket, "showToast", {
      message: "This item cannot be sold",
      type: "error",
    });
    return;
  }

  const buybackRate = store.buybackRate ?? 0.5;
  const sellPrice = Math.floor(baseValue * buybackRate);
  const totalValue = sellPrice * data.quantity;

  // Step 7: Get database
  const db = getDatabase(world);
  if (!db) {
    console.error("[StoreHandler] Database not available for storeSell");
    sendToSocket(socket, "showToast", {
      message: "Server error - please try again",
      type: "error",
    });
    return;
  }

  // Track removed slots for in-memory sync
  const removedSlots: Array<{ slot: number; quantity: number }> = [];
  let newCoinBalance = 0;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    removedSlots.length = 0; // Reset on each attempt

    try {
      await db.drizzle.transaction(async (tx) => {
        // Step 8a: Lock inventory rows for this item
        const inventoryResult = await tx.execute(
          sql`SELECT * FROM inventory
              WHERE "playerId" = ${playerId} AND "itemId" = ${data.itemId}
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

        // Step 8b: Calculate total available quantity across all rows
        let totalAvailable = 0;
        for (const item of invRows) {
          totalAvailable += item.quantity ?? 1;
        }

        if (totalAvailable < data.quantity) {
          throw new Error("INSUFFICIENT_QUANTITY");
        }

        // Step 8c: Lock player row for coin update
        const playerResult = await tx.execute(
          sql`SELECT coins FROM characters WHERE id = ${playerId} FOR UPDATE`,
        );

        const playerRow = playerResult.rows[0] as { coins: number } | undefined;
        if (!playerRow) {
          throw new Error("PLAYER_NOT_FOUND");
        }

        // Step 8d: Remove items from inventory (delete/update rows)
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
            removedSlots.push({ slot: itemSlot, quantity: itemQty });
            remaining -= itemQty;
          } else {
            // Reduce quantity on this row
            await tx
              .update(schema.inventory)
              .set({ quantity: itemQty - remaining })
              .where(eq(schema.inventory.id, item.id));
            removedSlots.push({ slot: itemSlot, quantity: remaining });
            remaining = 0;
          }
        }

        // Step 8e: Add coins to player
        await tx.execute(
          sql`UPDATE characters SET coins = coins + ${totalValue} WHERE id = ${playerId}`,
        );
        newCoinBalance = playerRow.coins + totalValue;
      });

      // Transaction succeeded - send updated states
      const inventoryRepo = new InventoryRepository(db.drizzle, db.pool);
      const updatedInventory =
        await inventoryRepo.getPlayerInventoryAsync(playerId);

      sendToSocket(socket, "inventoryUpdated", {
        playerId,
        items: updatedInventory.map((i) => ({
          slot: i.slotIndex ?? -1,
          itemId: i.itemId,
          quantity: i.quantity ?? 1,
        })),
        coins: newCoinBalance,
      });

      // Sync in-memory InventorySystem
      // Emit INVENTORY_ITEM_REMOVED for each slot we removed from
      for (const removed of removedSlots) {
        world.emit(EventType.INVENTORY_ITEM_REMOVED, {
          playerId,
          itemId: data.itemId,
          quantity: removed.quantity,
          slot: removed.slot >= 0 ? removed.slot : undefined,
        });
      }

      // Emit coin update for in-memory sync
      world.emit(EventType.INVENTORY_COINS_UPDATED, {
        playerId,
        coins: newCoinBalance,
      });

      sendToSocket(socket, "showToast", {
        message: `Sold ${data.quantity}x ${itemData.name} for ${totalValue} coins`,
        type: "success",
      });

      return;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg === "PLAYER_NOT_FOUND") {
        sendToSocket(socket, "showToast", {
          message: "Character not found",
          type: "error",
        });
        return;
      }
      if (errorMsg === "ITEM_NOT_FOUND") {
        sendToSocket(socket, "showToast", {
          message: "Item not in inventory",
          type: "error",
        });
        return;
      }
      if (errorMsg === "INSUFFICIENT_QUANTITY") {
        sendToSocket(socket, "showToast", {
          message: "Not enough items to sell",
          type: "error",
        });
        return;
      }

      // Retry on serialization/constraint conflicts
      const isConflict =
        errorMsg.includes("unique constraint") ||
        errorMsg.includes("could not serialize") ||
        errorMsg.includes("deadlock");

      if (isConflict && attempt < maxRetries - 1) {
        // Small delay before retry to reduce contention
        await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
        continue;
      }

      console.error("[StoreHandler] Sell transaction failed:", error);
      sendToSocket(socket, "showToast", {
        message: "Sale failed - please try again",
        type: "error",
      });
      return;
    }
  }
}

/**
 * Handle store close request
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

  world.emit(EventType.STORE_CLOSE, {
    playerId,
    storeId: data.storeId,
  });
}
