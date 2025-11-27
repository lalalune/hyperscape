/**
 * Bank Packet Handlers
 *
 * Handles all bank-related network packets:
 * - bankOpen: Player opens bank interface
 * - bankDeposit: Player deposits item from inventory
 * - bankWithdraw: Player withdraws item to inventory
 * - bankClose: Player closes bank interface
 *
 * SECURITY MEASURES:
 * - Atomic transactions prevent duplication/loss
 * - Row-level locking (SELECT FOR UPDATE) prevents race conditions
 * - Input validation prevents injection and overflow
 * - Quantity bounds checking prevents integer overflow
 *
 * Bank items STACK by itemId (all logs in one slot).
 * Inventory items do NOT stack (each item gets its own slot).
 */

import { type World, EventType } from "@hyperscape/shared";
import type { ServerSocket } from "../../../shared/types";
import { BankRepository } from "../../../database/repositories/BankRepository";
import { InventoryRepository } from "../../../database/repositories/InventoryRepository";
import type pg from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../database/schema";
import { eq, and, sql } from "drizzle-orm";

// Constants for safety limits
const MAX_INVENTORY_SLOTS = 28;
const MAX_BANK_SLOTS = 480;
const MAX_ITEM_QUANTITY = 2147483647; // PostgreSQL integer max
const MAX_ITEM_ID_LENGTH = 100;

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
 * Check if adding quantities would overflow
 */
function wouldOverflow(current: number, add: number): boolean {
  return current > MAX_ITEM_QUANTITY - add;
}

/**
 * Handle bank open request
 *
 * Loads player's bank from database and sends state to client.
 */
export async function handleBankOpen(
  socket: ServerSocket,
  data: { bankId: string },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[BankHandler] No player on socket for bankOpen");
    return;
  }

  const db = getDatabase(world);
  if (!db) {
    console.error("[BankHandler] No database available");
    return;
  }

  try {
    const bankRepo = new BankRepository(db.drizzle, db.pool);
    const items = await bankRepo.getPlayerBank(playerId);

    sendToSocket(socket, "bankState", {
      playerId,
      bankId: data.bankId,
      items,
      maxSlots: 480,
    });

    console.log(
      `[BankHandler] Opened bank for ${playerId} with ${items.length} items`,
    );
  } catch (error) {
    console.error("[BankHandler] Error opening bank:", error);
    sendToSocket(socket, "showToast", {
      message: "Failed to open bank",
      type: "error",
    });
  }
}

/**
 * Handle bank deposit request
 *
 * SECURITY:
 * - Validates itemId and quantity before processing
 * - Uses row-level locking to prevent race conditions
 * - Checks for integer overflow before adding quantities
 * - Atomic transaction prevents partial operations
 *
 * INVENTORY MODEL (Non-stacking):
 * - Each inventory row represents ONE item (quantity = 1 typically)
 * - Multiple rows can have same itemId (e.g., 3 swords = 3 rows)
 * - Each row occupies a unique slot (0-27)
 *
 * BANK MODEL (Stacking):
 * - One row per itemId (all swords in one slot)
 * - quantity field tracks total count
 *
 * IN-MEMORY SYNC:
 * - Tracks which slots were removed from during transaction
 * - Emits INVENTORY_ITEM_REMOVED for EACH slot to sync in-memory cache
 * - Prevents auto-save from overwriting database with stale data
 */
export async function handleBankDeposit(
  socket: ServerSocket,
  data: { itemId: string; quantity: number; slot?: number },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[BankHandler] No player on socket for bankDeposit");
    return;
  }

  const db = getDatabase(world);
  if (!db) {
    console.error("[BankHandler] No database available");
    return;
  }

  // SECURITY: Validate itemId
  if (!isValidItemId(data.itemId)) {
    sendToSocket(socket, "showToast", {
      message: "Invalid item",
      type: "error",
    });
    return;
  }

  // SECURITY: Validate quantity
  if (!isValidQuantity(data.quantity)) {
    sendToSocket(socket, "showToast", {
      message: "Invalid quantity",
      type: "error",
    });
    return;
  }

  const maxRetries = 3;
  // Track removed slots for in-memory sync (populated during transaction)
  let removedSlots: Array<{ slot: number; quantity: number }> = [];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    removedSlots = []; // Reset on each attempt

    try {
      await db.drizzle.transaction(async (tx) => {
        // Step 1: Find ALL inventory items matching this itemId with row lock
        // Using FOR UPDATE to prevent concurrent modifications
        const inventoryItems = await tx.execute(
          sql`SELECT * FROM inventory
              WHERE "playerId" = ${playerId} AND "itemId" = ${data.itemId}
              ORDER BY "slotIndex"
              FOR UPDATE`,
        );

        const invRows = inventoryItems.rows as Array<{
          id: number;
          playerId: string;
          itemId: string;
          quantity: number | null;
          slotIndex: number | null;
        }>;

        if (invRows.length === 0) {
          throw new Error("ITEM_NOT_FOUND");
        }

        // Step 2: Calculate total available quantity across ALL matching rows
        let totalAvailable = 0;
        for (const item of invRows) {
          totalAvailable += item.quantity ?? 1;
        }

        if (totalAvailable < data.quantity) {
          throw new Error("INSUFFICIENT_QUANTITY");
        }

        // Step 3: Check bank item and verify no overflow would occur
        const bankItems = await tx.execute(
          sql`SELECT * FROM bank_storage
              WHERE "playerId" = ${playerId} AND "itemId" = ${data.itemId}
              FOR UPDATE`,
        );

        const bankRows = bankItems.rows as Array<{
          id: number;
          quantity: number | null;
          slot: number | null;
        }>;

        if (bankRows.length > 0) {
          const currentBankQty = bankRows[0].quantity ?? 0;
          // SECURITY: Check for overflow before adding
          if (wouldOverflow(currentBankQty, data.quantity)) {
            throw new Error("QUANTITY_OVERFLOW");
          }
        }

        // Step 4: Remove items from inventory (delete rows until we've removed enough)
        // CRITICAL: Track which slots we're removing from for in-memory sync
        let remaining = data.quantity;
        for (const item of invRows) {
          if (remaining <= 0) break;

          const itemQty = item.quantity ?? 1;
          const itemSlot = item.slotIndex ?? -1;

          if (itemQty <= remaining) {
            // Delete entire row - track this slot for sync
            await tx
              .delete(schema.inventory)
              .where(eq(schema.inventory.id, item.id));
            removedSlots.push({ slot: itemSlot, quantity: itemQty });
            remaining -= itemQty;
          } else {
            // Reduce quantity on this row - track partial removal
            await tx
              .update(schema.inventory)
              .set({ quantity: itemQty - remaining })
              .where(eq(schema.inventory.id, item.id));
            removedSlots.push({ slot: itemSlot, quantity: remaining });
            remaining = 0;
          }
        }

        // Step 5: Add to bank (stacking)
        if (bankRows.length > 0) {
          // Stack with existing - use atomic increment
          await tx.execute(
            sql`UPDATE bank_storage
                SET quantity = quantity + ${data.quantity}
                WHERE id = ${bankRows[0].id}`,
          );
        } else {
          // Find next available bank slot
          const allBankItems = await tx
            .select()
            .from(schema.bankStorage)
            .where(eq(schema.bankStorage.playerId, playerId));

          const usedSlots = new Set(allBankItems.map((i) => i.slot ?? 0));
          let nextSlot = 0;
          while (usedSlots.has(nextSlot) && nextSlot < MAX_BANK_SLOTS) {
            nextSlot++;
          }

          if (nextSlot >= MAX_BANK_SLOTS) {
            throw new Error("BANK_FULL");
          }

          await tx.insert(schema.bankStorage).values({
            playerId,
            itemId: data.itemId,
            quantity: data.quantity,
            slot: nextSlot,
          });
        }
      });

      // Transaction succeeded - send updated states
      const bankRepo = new BankRepository(db.drizzle, db.pool);
      const inventoryRepo = new InventoryRepository(db.drizzle, db.pool);

      const bankItems = await bankRepo.getPlayerBank(playerId);
      sendToSocket(socket, "bankState", {
        playerId,
        items: bankItems,
        maxSlots: MAX_BANK_SLOTS,
      });

      const updatedInventory =
        await inventoryRepo.getPlayerInventoryAsync(playerId);
      sendToSocket(socket, "inventoryUpdated", {
        playerId,
        items: updatedInventory.map((i) => ({
          slot: i.slotIndex ?? -1,
          itemId: i.itemId,
          quantity: i.quantity ?? 1,
        })),
        coins: 0,
      });

      // CRITICAL: Sync in-memory InventorySystem to prevent duplication
      // Emit INVENTORY_ITEM_REMOVED for EACH slot we removed from
      // This ensures the in-memory cache matches the database
      for (const removed of removedSlots) {
        world.emit(EventType.INVENTORY_ITEM_REMOVED, {
          playerId,
          itemId: data.itemId,
          quantity: removed.quantity,
          slot: removed.slot >= 0 ? removed.slot : undefined,
        });
      }

      console.log(
        `[BankHandler] Deposited ${data.quantity}x ${data.itemId} for ${playerId} (removed from ${removedSlots.length} slots)`,
      );
      return;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg === "ITEM_NOT_FOUND") {
        sendToSocket(socket, "showToast", {
          message: "Item not in inventory",
          type: "error",
        });
        return;
      }
      if (errorMsg === "INSUFFICIENT_QUANTITY") {
        sendToSocket(socket, "showToast", {
          message: "Not enough items",
          type: "error",
        });
        return;
      }
      if (errorMsg === "BANK_FULL") {
        sendToSocket(socket, "showToast", {
          message: "Bank is full",
          type: "error",
        });
        return;
      }
      if (errorMsg === "QUANTITY_OVERFLOW") {
        sendToSocket(socket, "showToast", {
          message: "Bank stack limit reached",
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

      console.error("[BankHandler] Error depositing to bank:", error);
      sendToSocket(socket, "showToast", {
        message: "Failed to deposit item",
        type: "error",
      });
      return;
    }
  }

  // If we get here, all retries failed
  console.error("[BankHandler] Deposit failed after max retries");
  sendToSocket(socket, "showToast", {
    message: "Failed to deposit item - please try again",
    type: "error",
  });
}

/**
 * Handle bank withdraw request
 *
 * SECURITY:
 * - Validates itemId and quantity before processing
 * - Uses row-level locking to prevent race conditions
 * - Limits withdrawal to available inventory slots
 * - Atomic transaction prevents partial operations
 *
 * WITHDRAW FLOW (Non-stacking inventory):
 * 1. Lock inventory rows to get accurate slot count
 * 2. Lock bank row to prevent concurrent modifications
 * 3. Verify bank has enough items
 * 4. Check inventory has enough FREE slots (need N slots for N items)
 * 5. Remove N from bank quantity
 * 6. Create N separate inventory rows, each with quantity=1, each in unique slot
 *
 * IN-MEMORY SYNC:
 * - Tracks which slots were added to during transaction
 * - Emits INVENTORY_ITEM_ADDED for ONLY the newly added slots
 * - Prevents auto-save from overwriting database with stale data
 */
export async function handleBankWithdraw(
  socket: ServerSocket,
  data: { itemId: string; quantity: number },
  world: World,
): Promise<void> {
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[BankHandler] No player on socket for bankWithdraw");
    return;
  }

  const db = getDatabase(world);
  if (!db) {
    console.error("[BankHandler] No database available");
    return;
  }

  // SECURITY: Validate itemId
  if (!isValidItemId(data.itemId)) {
    sendToSocket(socket, "showToast", {
      message: "Invalid item",
      type: "error",
    });
    return;
  }

  // SECURITY: Validate quantity
  if (!isValidQuantity(data.quantity)) {
    sendToSocket(socket, "showToast", {
      message: "Invalid quantity",
      type: "error",
    });
    return;
  }

  // SECURITY: Limit single withdrawal to max inventory size
  const withdrawQty = Math.min(data.quantity, MAX_INVENTORY_SLOTS);

  const maxRetries = 3;
  // Track added slots for in-memory sync (populated during transaction)
  let addedSlots: number[] = [];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    addedSlots = []; // Reset on each attempt

    try {
      await db.drizzle.transaction(async (tx) => {
        // Step 1: Lock and get current inventory to find used slots
        const inventoryResult = await tx.execute(
          sql`SELECT * FROM inventory
              WHERE "playerId" = ${playerId}
              FOR UPDATE`,
        );

        const inventoryItems = inventoryResult.rows as Array<{
          id: number;
          slotIndex: number | null;
        }>;

        // Step 2: Calculate free slots (need N free slots for N items)
        const usedSlots = new Set<number>();
        for (const item of inventoryItems) {
          if (item.slotIndex !== null && item.slotIndex >= 0) {
            usedSlots.add(item.slotIndex);
          }
        }

        // Find all free slots
        const freeSlots: number[] = [];
        for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
          if (!usedSlots.has(i)) {
            freeSlots.push(i);
          }
        }

        if (freeSlots.length === 0) {
          throw new Error("INVENTORY_FULL");
        }

        // SECURITY: Limit withdrawal to available slots
        const actualWithdrawQty = Math.min(withdrawQty, freeSlots.length);

        // Step 3: Lock and find bank item, verify quantity
        const bankResult = await tx.execute(
          sql`SELECT * FROM bank_storage
              WHERE "playerId" = ${playerId} AND "itemId" = ${data.itemId}
              FOR UPDATE`,
        );

        const bankRows = bankResult.rows as Array<{
          id: number;
          quantity: number | null;
        }>;

        if (bankRows.length === 0) {
          throw new Error("ITEM_NOT_IN_BANK");
        }

        const bankRow = bankRows[0];
        const availableQty = bankRow.quantity ?? 0;

        if (availableQty === 0) {
          throw new Error("ITEM_NOT_IN_BANK");
        }

        // SECURITY: Can only withdraw what's available
        const finalWithdrawQty = Math.min(actualWithdrawQty, availableQty);

        if (finalWithdrawQty === 0) {
          throw new Error("INSUFFICIENT_QUANTITY");
        }

        // Step 4: Remove from bank using atomic decrement
        const newBankQty = availableQty - finalWithdrawQty;
        if (newBankQty <= 0) {
          await tx.execute(
            sql`DELETE FROM bank_storage WHERE id = ${bankRow.id}`,
          );
        } else {
          await tx.execute(
            sql`UPDATE bank_storage
                SET quantity = quantity - ${finalWithdrawQty}
                WHERE id = ${bankRow.id}
                AND quantity >= ${finalWithdrawQty}`,
          );
        }

        // Step 5: Create N inventory items (one per withdrawn item, each qty=1)
        // Each item goes into its own unique slot
        // CRITICAL: Track which slots we're adding to for in-memory sync
        const insertValues = [];
        for (let i = 0; i < finalWithdrawQty; i++) {
          const targetSlot = freeSlots[i];
          insertValues.push({
            playerId,
            itemId: data.itemId,
            quantity: 1, // Always 1 - items don't stack in inventory
            slotIndex: targetSlot,
            metadata: null,
          });
          addedSlots.push(targetSlot); // Track for sync
        }

        // Batch insert for efficiency
        if (insertValues.length > 0) {
          await tx.insert(schema.inventory).values(insertValues);
        }
      });

      // Transaction succeeded - send updated states
      const bankRepo = new BankRepository(db.drizzle, db.pool);
      const inventoryRepo = new InventoryRepository(db.drizzle, db.pool);

      const bankItems = await bankRepo.getPlayerBank(playerId);
      sendToSocket(socket, "bankState", {
        playerId,
        items: bankItems,
        maxSlots: MAX_BANK_SLOTS,
      });

      const updatedInventory =
        await inventoryRepo.getPlayerInventoryAsync(playerId);
      sendToSocket(socket, "inventoryUpdated", {
        playerId,
        items: updatedInventory.map((i) => ({
          slot: i.slotIndex ?? -1,
          itemId: i.itemId,
          quantity: i.quantity ?? 1,
        })),
        coins: 0,
      });

      // CRITICAL: Sync in-memory InventorySystem to prevent duplication
      // Emit INVENTORY_ITEM_ADDED ONLY for the newly added slots
      // DO NOT emit for existing items - that would cause duplication!
      for (const slot of addedSlots) {
        world.emit(EventType.INVENTORY_ITEM_ADDED, {
          playerId,
          item: {
            id: 0, // ID not needed for in-memory add
            itemId: data.itemId,
            quantity: 1,
            slot: slot,
            metadata: null,
          },
        });
      }

      console.log(
        `[BankHandler] Withdrew ${addedSlots.length}x ${data.itemId} for ${playerId} (added to slots: ${addedSlots.join(", ")})`,
      );
      return;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg === "INVENTORY_FULL") {
        sendToSocket(socket, "showToast", {
          message: "Inventory is full",
          type: "error",
        });
        return;
      }
      if (errorMsg === "ITEM_NOT_IN_BANK") {
        sendToSocket(socket, "showToast", {
          message: "Item not in bank",
          type: "error",
        });
        return;
      }
      if (errorMsg === "INSUFFICIENT_QUANTITY") {
        sendToSocket(socket, "showToast", {
          message: "Not enough items in bank",
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
        await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
        continue;
      }

      console.error("[BankHandler] Error withdrawing from bank:", error);
      sendToSocket(socket, "showToast", {
        message: "Failed to withdraw item",
        type: "error",
      });
      return;
    }
  }

  // If we get here, all retries failed
  console.error("[BankHandler] Withdraw failed after max retries");
  sendToSocket(socket, "showToast", {
    message: "Failed to withdraw item - please try again",
    type: "error",
  });
}

/**
 * Handle bank close request
 *
 * No server action needed - just client UI closing.
 */
export function handleBankClose(
  socket: ServerSocket,
  _data: unknown,
  _world: World,
): void {
  const playerId = getPlayerId(socket);
  console.log(`[BankHandler] Bank closed by ${playerId}`);
}
