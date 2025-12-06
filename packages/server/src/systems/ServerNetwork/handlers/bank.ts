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
 * - DISTANCE VALIDATION using Chebyshev distance (OSRS-style)
 *
 * Bank items STACK by itemId (all logs in one slot).
 * Inventory items do NOT stack (each item gets its own slot).
 */

import {
  type World,
  EventType,
  getItem,
  SessionType,
  INPUT_LIMITS,
} from "@hyperscape/shared";
import type { ServerSocket } from "../../../shared/types";
import { BankRepository } from "../../../database/repositories/BankRepository";
import { InventoryRepository } from "../../../database/repositories/InventoryRepository";
import * as schema from "../../../database/schema";
import { eq, sql } from "drizzle-orm";

// Import shared input validation and rate limiting from services
import {
  RateLimitService,
  isValidItemId,
  isValidQuantity,
  wouldOverflow,
} from "../services";

// Import common handler utilities (Phase: Extract Common Patterns)
import {
  validateTransactionRequest,
  executeSecureTransaction,
  emitInventorySyncEvents,
  sendToSocket,
  sendErrorToast,
  getPlayerId,
  getDatabase,
  getSessionManager,
} from "./common";

// Single rate limiter instance for bank operations
const rateLimiter = new RateLimitService();

// Local aliases for shared constants (for cleaner code)
const MAX_INVENTORY_SLOTS = INPUT_LIMITS.MAX_INVENTORY_SLOTS;
const MAX_BANK_SLOTS = INPUT_LIMITS.MAX_BANK_SLOTS;

/**
 * Validate item exists in game database
 * Prevents issues with items removed from game after being deposited
 */
function isValidGameItem(itemId: string): boolean {
  const item = getItem(itemId);
  return item !== null;
}

/**
 * Handle bank open request
 *
 * Loads player's bank from database and sends state to client.
 * InteractionSessionManager automatically tracks the session with targetEntityId.
 * (Phase 6: session manager is single source of truth for entity IDs)
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

    // Phase 6: Removed socket.activeBankEntityId assignment
    // InteractionSessionManager now tracks targetEntityId as single source of truth

    // Send bank state to client (include isOpen for consistency with store)
    sendToSocket(socket, "bankState", {
      playerId,
      bankId: data.bankId,
      items,
      maxSlots: 480,
      isOpen: true,
    });

    // Emit event for InteractionSessionManager to track the session
    // InteractionSessionManager listens to this and creates session with targetEntityId = bankEntityId
    world.emit(EventType.BANK_OPEN, {
      playerId,
      bankId: data.bankId,
      bankEntityId: data.bankId, // For banks, bankId IS the entity ID
    });
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
 * SECURITY MEASURES (using common utilities):
 * - validateTransactionRequest: player, rate limit, distance, db
 * - Input validation (itemId, quantity)
 * - executeSecureTransaction: atomic transaction with row-level locking and retry
 * - emitInventorySyncEvents: in-memory cache sync
 *
 * INVENTORY MODEL (Non-stacking):
 * - Each inventory row represents ONE item (quantity = 1 typically)
 * - Multiple rows can have same itemId (e.g., 3 swords = 3 rows)
 *
 * BANK MODEL (Stacking):
 * - One row per itemId (all swords in one slot)
 * - quantity field tracks total count
 */
export async function handleBankDeposit(
  socket: ServerSocket,
  data: { itemId: string; quantity: number; slot?: number },
  world: World,
): Promise<void> {
  // Step 1: Common validation (player, rate limit, distance, db)
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.BANK,
    rateLimiter,
  );

  if (!baseResult.success) {
    return; // Error already sent to client
  }

  const ctx = baseResult.context;

  // Step 2: Bank-specific input validation
  if (!isValidItemId(data.itemId)) {
    sendErrorToast(socket, "Invalid item");
    return;
  }

  if (!isValidQuantity(data.quantity)) {
    sendErrorToast(socket, "Invalid quantity");
    return;
  }

  // Step 3: Execute transaction with automatic retry
  const result = await executeSecureTransaction(ctx, {
    execute: async (tx) => {
      // Lock inventory rows for this item
      const inventoryItems = await tx.execute(
        sql`SELECT * FROM inventory
            WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${data.itemId}
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

      // Calculate total available quantity
      let totalAvailable = 0;
      for (const item of invRows) {
        totalAvailable += item.quantity ?? 1;
      }

      if (totalAvailable < data.quantity) {
        throw new Error("INSUFFICIENT_QUANTITY");
      }

      // Check bank item and verify no overflow
      const bankItems = await tx.execute(
        sql`SELECT * FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${data.itemId}
            FOR UPDATE`,
      );

      const bankRows = bankItems.rows as Array<{
        id: number;
        quantity: number | null;
        slot: number | null;
      }>;

      if (bankRows.length > 0) {
        const currentBankQty = bankRows[0].quantity ?? 0;
        if (wouldOverflow(currentBankQty, data.quantity)) {
          throw new Error("QUANTITY_OVERFLOW");
        }
      }

      // Remove items from inventory
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

      // Add to bank (stacking)
      if (bankRows.length > 0) {
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
          .where(eq(schema.bankStorage.playerId, ctx.playerId));

        const usedSlots = new Set(allBankItems.map((i) => i.slot ?? 0));
        let nextSlot = 0;
        while (usedSlots.has(nextSlot) && nextSlot < MAX_BANK_SLOTS) {
          nextSlot++;
        }

        if (nextSlot >= MAX_BANK_SLOTS) {
          throw new Error("BANK_FULL");
        }

        await tx.insert(schema.bankStorage).values({
          playerId: ctx.playerId,
          itemId: data.itemId,
          quantity: data.quantity,
          slot: nextSlot,
        });
      }

      return { removedSlots };
    },
  });

  if (!result) return; // Error already handled by executeSecureTransaction

  // Step 4: Send updated states to client
  const bankRepo = new BankRepository(ctx.db.drizzle, ctx.db.pool);
  const inventoryRepo = new InventoryRepository(ctx.db.drizzle, ctx.db.pool);

  const bankItems = await bankRepo.getPlayerBank(ctx.playerId);
  sendToSocket(socket, "bankState", {
    playerId: ctx.playerId,
    items: bankItems,
    maxSlots: MAX_BANK_SLOTS,
  });

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
    coins: 0,
  });

  // Step 5: Sync in-memory cache (using common utility)
  emitInventorySyncEvents(ctx, {
    removedSlots: result.removedSlots,
  });
}

/**
 * Handle bank withdraw request
 *
 * SECURITY MEASURES (using common utilities):
 * - validateTransactionRequest: player, rate limit, distance, db
 * - Input validation (itemId, quantity)
 * - executeSecureTransaction: atomic transaction with row-level locking and retry
 * - emitInventorySyncEvents: in-memory cache sync
 *
 * WITHDRAW FLOW (Non-stacking inventory):
 * - Each withdrawn item gets its own inventory slot (qty=1)
 * - Limits withdrawal to available free slots
 */
export async function handleBankWithdraw(
  socket: ServerSocket,
  data: { itemId: string; quantity: number },
  world: World,
): Promise<void> {
  // Step 1: Common validation (player, rate limit, distance, db)
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.BANK,
    rateLimiter,
  );

  if (!baseResult.success) {
    return; // Error already sent to client
  }

  const ctx = baseResult.context;

  // Step 2: Bank-specific input validation
  if (!isValidItemId(data.itemId)) {
    sendErrorToast(socket, "Invalid item");
    return;
  }

  // Validate item exists in game database
  if (!isValidGameItem(data.itemId)) {
    console.warn(
      `[BankHandler] SECURITY: Player ${ctx.playerId} attempted to withdraw unknown item: ${data.itemId}`,
    );
    sendErrorToast(socket, "This item no longer exists");
    return;
  }

  if (!isValidQuantity(data.quantity)) {
    sendErrorToast(socket, "Invalid quantity");
    return;
  }

  // Limit single withdrawal to max inventory size
  const withdrawQty = Math.min(data.quantity, MAX_INVENTORY_SLOTS);

  // Step 3: Execute transaction with automatic retry
  const result = await executeSecureTransaction(ctx, {
    execute: async (tx) => {
      // Lock and get current inventory to find used slots
      const inventoryResult = await tx.execute(
        sql`SELECT * FROM inventory
            WHERE "playerId" = ${ctx.playerId}
            FOR UPDATE`,
      );

      const inventoryItems = inventoryResult.rows as Array<{
        id: number;
        slotIndex: number | null;
      }>;

      // Calculate free slots
      const usedSlots = new Set<number>();
      for (const item of inventoryItems) {
        if (item.slotIndex !== null && item.slotIndex >= 0) {
          usedSlots.add(item.slotIndex);
        }
      }

      const freeSlots: number[] = [];
      for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
        if (!usedSlots.has(i)) {
          freeSlots.push(i);
        }
      }

      if (freeSlots.length === 0) {
        throw new Error("INVENTORY_FULL");
      }

      const actualWithdrawQty = Math.min(withdrawQty, freeSlots.length);

      // Lock and find bank item
      const bankResult = await tx.execute(
        sql`SELECT * FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${data.itemId}
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

      const finalWithdrawQty = Math.min(actualWithdrawQty, availableQty);

      if (finalWithdrawQty === 0) {
        throw new Error("INSUFFICIENT_QUANTITY");
      }

      // Remove from bank
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

      // Create inventory items (one per withdrawn item, qty=1)
      const addedSlots: Array<{
        slot: number;
        quantity: number;
        itemId: string;
      }> = [];
      const insertValues: Array<{
        playerId: string;
        itemId: string;
        quantity: number;
        slotIndex: number;
        metadata: null;
      }> = [];

      for (let i = 0; i < finalWithdrawQty; i++) {
        const targetSlot = freeSlots[i];
        insertValues.push({
          playerId: ctx.playerId,
          itemId: data.itemId,
          quantity: 1,
          slotIndex: targetSlot,
          metadata: null,
        });
        addedSlots.push({ slot: targetSlot, quantity: 1, itemId: data.itemId });
      }

      if (insertValues.length > 0) {
        await tx.insert(schema.inventory).values(insertValues);
      }

      return { addedSlots };
    },
  });

  if (!result) return; // Error already handled by executeSecureTransaction

  // Step 4: Send updated states to client
  const bankRepo = new BankRepository(ctx.db.drizzle, ctx.db.pool);
  const inventoryRepo = new InventoryRepository(ctx.db.drizzle, ctx.db.pool);

  const bankItems = await bankRepo.getPlayerBank(ctx.playerId);
  sendToSocket(socket, "bankState", {
    playerId: ctx.playerId,
    items: bankItems,
    maxSlots: MAX_BANK_SLOTS,
  });

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
    coins: 0,
  });

  // Step 5: Sync in-memory cache (using common utility)
  emitInventorySyncEvents(ctx, {
    addedSlots: result.addedSlots,
  });
}

/**
 * Handle bank deposit all request
 *
 * SECURITY MEASURES (using common utilities):
 * - validateTransactionRequest: player, rate limit, distance, db
 * - executeSecureTransaction: atomic transaction with row-level locking and retry
 * - emitInventorySyncEvents: in-memory cache sync
 *
 * Deposits ALL items from inventory to bank in a single atomic transaction.
 */
export async function handleBankDepositAll(
  socket: ServerSocket,
  _data: unknown,
  world: World,
): Promise<void> {
  // Step 1: Common validation (player, rate limit, distance, db)
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.BANK,
    rateLimiter,
  );

  if (!baseResult.success) {
    return; // Error already sent to client
  }

  const ctx = baseResult.context;

  // Step 2: Execute transaction with automatic retry
  const result = await executeSecureTransaction(ctx, {
    errorMessages: {
      INVENTORY_EMPTY: "Inventory is empty",
    },
    execute: async (tx) => {
      // Get ALL inventory items with row lock
      const inventoryResult = await tx.execute(
        sql`SELECT * FROM inventory
            WHERE "playerId" = ${ctx.playerId}
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
        throw new Error("INVENTORY_EMPTY");
      }

      // Group items by itemId and calculate totals
      const itemGroups = new Map<
        string,
        { total: number; rows: typeof invRows }
      >();
      for (const row of invRows) {
        const existing = itemGroups.get(row.itemId) || { total: 0, rows: [] };
        existing.total += row.quantity ?? 1;
        existing.rows.push(row);
        itemGroups.set(row.itemId, existing);
      }

      // Lock ALL bank items for this player
      const bankResult = await tx.execute(
        sql`SELECT * FROM bank_storage
            WHERE "playerId" = ${ctx.playerId}
            FOR UPDATE`,
      );

      const bankRows = bankResult.rows as Array<{
        id: number;
        itemId: string;
        quantity: number | null;
        slot: number | null;
      }>;

      // Create lookup map for existing bank items
      const bankByItemId = new Map<
        string,
        { id: number; quantity: number; slot: number }
      >();
      const usedBankSlots = new Set<number>();
      for (const row of bankRows) {
        bankByItemId.set(row.itemId, {
          id: row.id,
          quantity: row.quantity ?? 0,
          slot: row.slot ?? 0,
        });
        usedBankSlots.add(row.slot ?? 0);
      }

      // Check for overflow on any item type
      for (const [itemId, group] of itemGroups) {
        const existingBank = bankByItemId.get(itemId);
        if (existingBank && wouldOverflow(existingBank.quantity, group.total)) {
          throw new Error("QUANTITY_OVERFLOW");
        }
      }

      // Check bank has enough slots for new item types
      let newItemTypes = 0;
      for (const itemId of itemGroups.keys()) {
        if (!bankByItemId.has(itemId)) {
          newItemTypes++;
        }
      }
      const freeSlots = MAX_BANK_SLOTS - usedBankSlots.size;
      if (newItemTypes > freeSlots) {
        throw new Error("BANK_FULL");
      }

      // Delete ALL inventory items
      await tx
        .delete(schema.inventory)
        .where(eq(schema.inventory.playerId, ctx.playerId));

      // Track removed slots for sync
      const removedSlots: Array<{
        slot: number;
        quantity: number;
        itemId: string;
      }> = [];
      for (const row of invRows) {
        removedSlots.push({
          itemId: row.itemId,
          slot: row.slotIndex ?? -1,
          quantity: row.quantity ?? 1,
        });
      }

      // Update/insert bank items
      let nextFreeSlot = 0;
      for (const [itemId, group] of itemGroups) {
        const existingBank = bankByItemId.get(itemId);

        if (existingBank) {
          await tx.execute(
            sql`UPDATE bank_storage
                SET quantity = quantity + ${group.total}
                WHERE id = ${existingBank.id}`,
          );
        } else {
          while (usedBankSlots.has(nextFreeSlot)) {
            nextFreeSlot++;
          }

          await tx.insert(schema.bankStorage).values({
            playerId: ctx.playerId,
            itemId,
            quantity: group.total,
            slot: nextFreeSlot,
          });

          usedBankSlots.add(nextFreeSlot);
          nextFreeSlot++;
        }
      }

      return { removedSlots };
    },
  });

  if (!result) return; // Error already handled by executeSecureTransaction

  // Step 3: Send updated states to client
  const bankRepo = new BankRepository(ctx.db.drizzle, ctx.db.pool);
  const inventoryRepo = new InventoryRepository(ctx.db.drizzle, ctx.db.pool);

  const bankItems = await bankRepo.getPlayerBank(ctx.playerId);
  sendToSocket(socket, "bankState", {
    playerId: ctx.playerId,
    items: bankItems,
    maxSlots: MAX_BANK_SLOTS,
  });

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
    coins: 0,
  });

  // Step 4: Sync in-memory cache (using common utility)
  emitInventorySyncEvents(ctx, {
    removedSlots: result.removedSlots,
  });
}

/**
 * Handle bank close request
 * (Phase 6: InteractionSessionManager handles session cleanup via BANK_CLOSE event)
 */
export function handleBankClose(
  socket: ServerSocket,
  _data: unknown,
  world: World,
): void {
  const playerId = getPlayerId(socket);
  if (!playerId) return;

  // Phase 6: Removed socket.activeBankEntityId assignments
  // InteractionSessionManager handles session cleanup automatically
  // Get bankEntityId from session for the event (if needed for logging)
  const sessionManager = getSessionManager(world);
  const session = sessionManager?.getSession(playerId);
  const bankEntityId = session?.targetEntityId;

  // Emit event for InteractionSessionManager to close the session
  world.emit(EventType.BANK_CLOSE, {
    playerId,
    bankId: bankEntityId,
  });
}
