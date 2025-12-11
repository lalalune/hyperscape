/**
 * Bank Packet Handlers
 *
 * Handles all bank-related network packets:
 * - bankOpen: Player opens bank interface
 * - bankDeposit: Player deposits item from inventory
 * - bankDepositAll: Player deposits all items from inventory
 * - bankWithdraw: Player withdraws item to inventory
 * - bankDepositCoins: Player deposits coins from money pouch to bank
 * - bankWithdrawCoins: Player withdraws coins from bank to money pouch
 * - bankClose: Player closes bank interface
 *
 * SECURITY MEASURES:
 * - Atomic transactions prevent duplication/loss
 * - Row-level locking (SELECT FOR UPDATE) prevents race conditions
 * - Input validation prevents injection and overflow
 * - Quantity bounds checking prevents integer overflow
 * - DISTANCE VALIDATION using Chebyshev distance (OSRS-style)
 * - Consistent lock order (characters → bank_storage) prevents deadlocks
 * - Audit logging for large coin transactions (≥1M)
 *
 * Bank items STACK by itemId (all logs in one slot).
 * Inventory items do NOT stack (each item gets its own slot).
 * Coins are stored as special stackable item with itemId='coins'.
 */

import {
  type World,
  EventType,
  getItem,
  SessionType,
  INPUT_LIMITS,
  getNotedItem,
  canBeNoted,
  isNotedItemId,
  getBaseItemId,
} from "@hyperscape/shared";
import type { ServerSocket } from "../../../shared/types";
import { BankRepository } from "../../../database/repositories/BankRepository";
import * as schema from "../../../database/schema";
import { eq, sql } from "drizzle-orm";

// Import shared input validation and rate limiting from services
import {
  RateLimitService,
  isValidItemId,
  isValidQuantity,
  isValidBankSlot,
  isValidBankMoveMode,
  isValidBankTabIndex,
  isValidCustomBankTabIndex,
  wouldOverflow,
} from "../services";

// Import common handler utilities (Phase: Extract Common Patterns)
import {
  validateTransactionRequest,
  executeSecureTransaction,
  executeInventoryTransaction,
  emitInventorySyncEvents,
  sendToSocket,
  sendErrorToast,
  getPlayerId,
  getDatabase,
  getSessionManager,
  type DrizzleTransaction,
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
 * Compact bank slots after an item is deleted.
 *
 * OSRS-style behavior: When an item is fully withdrawn, remaining items
 * shift left to fill the gap. No empty slots in the middle of the bank.
 *
 * NOTE: This compacts within the CURRENT tab only (tab 0 by default for backwards compatibility).
 * Uses two-phase approach to avoid unique constraint violations:
 * 1. Add +1000 offset to slots > deletedSlot
 * 2. Subtract 1001 to get final values (shifted down by 1)
 *
 * @param tx - Database transaction
 * @param playerId - Player whose bank to compact
 * @param deletedSlot - The slot that was just deleted
 * @param tabIndex - Tab to compact (default 0 for backwards compatibility)
 */
async function compactBankSlots(
  tx: DrizzleTransaction,
  playerId: string,
  deletedSlot: number,
  tabIndex: number = 0,
): Promise<void> {
  // TWO-PHASE SLOT COMPACTION to avoid unique constraint violations.
  // PostgreSQL doesn't guarantee UPDATE order, so if slot 4 tries to become slot 3
  // before slot 3 becomes slot 2, they collide on the same (playerId, tabIndex, slot) key.
  //
  // Solution: First add +1000 to move them far away, then subtract 1001 to get final values.

  // Phase 1: Add large offset to avoid conflicts during shift
  await tx.execute(
    sql`UPDATE bank_storage
        SET slot = slot + 1000
        WHERE "playerId" = ${playerId}
          AND "tabIndex" = ${tabIndex}
          AND slot > ${deletedSlot}`,
  );

  // Phase 2: Subtract offset + 1 to get final values (shifted down by 1)
  await tx.execute(
    sql`UPDATE bank_storage
        SET slot = slot - 1001
        WHERE "playerId" = ${playerId}
          AND "tabIndex" = ${tabIndex}
          AND slot > 1000`,
  );
}

/**
 * Send full bank state including tabs to client
 * Helper function for all bank handlers to send consistent state
 *
 * RS3-STYLE PLACEHOLDERS:
 * - Placeholders are just bank_storage rows with quantity = 0
 * - No separate placeholders array needed - items with qty=0 ARE placeholders
 * - Client renders qty=0 items with greyed-out style
 */
async function sendBankStateWithTabs(
  socket: ServerSocket,
  playerId: string,
  db: { drizzle: unknown; pool: unknown },
): Promise<void> {
  const bankRepo = new BankRepository(
    db.drizzle as Parameters<typeof BankRepository.prototype.getPlayerBank>[0],
    db.pool as Parameters<typeof BankRepository.prototype.getPlayerBank>[1],
  );
  // RS3-style: getPlayerBank now includes qty=0 items (placeholders)
  const bankItems = await bankRepo.getPlayerBank(playerId);
  const bankTabs = await bankRepo.getPlayerTabs(playerId);
  const alwaysSetPlaceholder = await bankRepo.getAlwaysSetPlaceholder(playerId);

  sendToSocket(socket, "bankState", {
    playerId,
    items: bankItems, // Includes qty=0 items (placeholders)
    tabs: bankTabs,
    alwaysSetPlaceholder,
    maxSlots: MAX_BANK_SLOTS,
  });
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
    // RS3-style: items includes qty=0 rows (placeholders)
    const items = await bankRepo.getPlayerBank(playerId);
    const tabs = await bankRepo.getPlayerTabs(playerId);
    const alwaysSetPlaceholder =
      await bankRepo.getAlwaysSetPlaceholder(playerId);

    // Phase 6: Removed socket.activeBankEntityId assignment
    // InteractionSessionManager now tracks targetEntityId as single source of truth

    // Send bank state to client (include isOpen and bankId for initial open)
    // RS3-style: no separate placeholders array - items with qty=0 ARE placeholders
    sendToSocket(socket, "bankState", {
      playerId,
      bankId: data.bankId,
      items, // Includes qty=0 items (placeholders)
      tabs,
      alwaysSetPlaceholder,
      maxSlots: MAX_BANK_SLOTS,
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
 *
 * BANK NOTE SYSTEM:
 * - Depositing a noted item (e.g., "logs_noted") auto-converts to base item ("logs")
 * - Bank always stores base items, never notes
 */
export async function handleBankDeposit(
  socket: ServerSocket,
  data: {
    itemId: string;
    quantity: number;
    slot?: number;
    targetTabIndex?: number;
  },
  world: World,
): Promise<void> {
  // SPECIAL CASE: Coins should come from money pouch (CoinPouchSystem), not inventory
  // This handles clicking on coins in inventory while bank is open
  if (data.itemId === "coins") {
    return handleBankDepositCoins(socket, { amount: data.quantity }, world);
  }

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

  // BANK NOTE SYSTEM: Auto-unnote deposited notes
  // Inventory uses the actual itemId (could be noted)
  // Bank stores the base item (auto-convert notes)
  const inventoryItemId = data.itemId;
  const bankItemId = isNotedItemId(data.itemId)
    ? getBaseItemId(data.itemId)
    : data.itemId;

  // Step 3: Execute transaction with inventory lock (prevents race conditions)
  const result = await executeInventoryTransaction(ctx, async () => {
    return executeSecureTransaction(ctx, {
      execute: async (tx) => {
        // Lock inventory rows for this item (use inventory item ID - could be noted)
        const inventoryItems = await tx.execute(
          sql`SELECT * FROM inventory
              WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${inventoryItemId}
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

        // Check bank item and verify no overflow (use bank item ID - always base item)
        const bankItems = await tx.execute(
          sql`SELECT * FROM bank_storage
              WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${bankItemId}
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
              itemId: inventoryItemId,
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
              itemId: inventoryItemId,
            });
            remaining = 0;
          }
        }

        // Add to bank (stacking)
        // RS3-STYLE: If item exists (even with qty=0 placeholder), add to that slot
        if (bankRows.length > 0) {
          // Works for both normal items and qty=0 placeholders
          // qty=0 + newQty = newQty (placeholder becomes real item)
          await tx.execute(
            sql`UPDATE bank_storage
                SET quantity = quantity + ${data.quantity}
                WHERE id = ${bankRows[0].id}`,
          );
        } else {
          // No existing item - find next available bank slot IN TARGET TAB
          // RS3-style: New items go to the currently viewed tab
          const targetTab = data.targetTabIndex ?? 0;

          // Get items in the target tab to find next available slot
          const tabItems = await tx.execute(
            sql`SELECT slot FROM bank_storage
                WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${targetTab}
                FOR UPDATE`,
          );

          const usedSlots = new Set(
            (tabItems.rows as Array<{ slot: number }>).map((i) => i.slot),
          );
          let nextSlot = 0;
          while (usedSlots.has(nextSlot) && nextSlot < MAX_BANK_SLOTS) {
            nextSlot++;
          }

          if (nextSlot >= MAX_BANK_SLOTS) {
            throw new Error("BANK_FULL");
          }

          // BANK NOTE SYSTEM: Always store base item (bankItemId), never notes
          await tx.insert(schema.bankStorage).values({
            playerId: ctx.playerId,
            itemId: bankItemId,
            quantity: data.quantity,
            slot: nextSlot,
            tabIndex: targetTab,
          });
        }

        return { removedSlots };
      },
    });
  });

  if (!result) return; // Error already handled

  // Step 4: Send updated bank state to client (with tabs for consistency)
  // NOTE: Inventory update is handled by reloadFromDatabase() which emits INVENTORY_UPDATED
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);

  // NOTE: emitInventorySyncEvents removed - reloadFromDatabase() handles in-memory sync
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
 * WITHDRAW FLOW:
 * - asNote=false (default): Each item gets its own inventory slot (qty=1)
 * - asNote=true: All items stack in one slot as noted variant
 *
 * BANK NOTE SYSTEM:
 * - When asNote=true and item is noteable, gives "{itemId}_noted" variant
 * - Noted items are stackable, so 1000 logs_noted = 1 inventory slot
 * - Only tradeable, non-stackable items can be noted
 */
export async function handleBankWithdraw(
  socket: ServerSocket,
  data: { itemId: string; quantity: number; asNote?: boolean },
  world: World,
): Promise<void> {
  // SPECIAL CASE: Coins should go to money pouch (CoinPouchSystem), not inventory
  // This handles clicking on coins in the bank grid
  if (data.itemId === "coins") {
    return handleBankWithdrawCoins(socket, { amount: data.quantity }, world);
  }

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

  // BANK NOTE SYSTEM: Determine if withdrawing as note
  const wantAsNote = data.asNote === true;
  const itemIsNoteable = canBeNoted(data.itemId);
  const withdrawAsNote = wantAsNote && itemIsNoteable;

  // If user requested note but item can't be noted, warn but continue with base item
  if (wantAsNote && !itemIsNoteable) {
    console.log(
      `[BankHandler] Note requested for non-noteable item ${data.itemId}, withdrawing as base item`,
    );
  }

  // Limit single withdrawal to max inventory size (unless withdrawing as note - all fit in 1 slot)
  const withdrawQty = withdrawAsNote
    ? data.quantity // Notes stack, so no slot limit
    : Math.min(data.quantity, MAX_INVENTORY_SLOTS);

  // Step 3: Execute transaction with inventory lock (prevents race conditions)
  // The executeInventoryTransaction wrapper handles:
  // - Lock acquisition (blocks pickups, auto-save)
  // - Flush pending in-memory changes to DB
  // - Execute the transaction
  // - Reload from DB (in-memory now matches DB exactly)
  // - Unlock (in finally block)
  const result = await executeInventoryTransaction(ctx, async () => {
    return executeSecureTransaction(ctx, {
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

        // BANK NOTE SYSTEM: Notes only need 1 slot (stackable)
        // Base items need 1 slot per item
        const slotsNeeded = withdrawAsNote ? 1 : withdrawQty;

        if (freeSlots.length === 0) {
          throw new Error("INVENTORY_FULL");
        }

        if (freeSlots.length < slotsNeeded && !withdrawAsNote) {
          // For base items, limit to available slots
        }

        const actualWithdrawQty = withdrawAsNote
          ? withdrawQty // Notes can withdraw any amount (1 slot)
          : Math.min(withdrawQty, freeSlots.length);

        // Lock and find bank item
        const bankResult = await tx.execute(
          sql`SELECT * FROM bank_storage
              WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${data.itemId}
              FOR UPDATE`,
        );

        const bankRows = bankResult.rows as Array<{
          id: number;
          quantity: number | null;
          slot: number;
          tabIndex: number;
        }>;

        if (bankRows.length === 0) {
          throw new Error("ITEM_NOT_IN_BANK");
        }

        const bankRow = bankRows[0];
        const availableQty = bankRow.quantity ?? 0;
        const deletedSlot = bankRow.slot;
        const tabIndex = bankRow.tabIndex ?? 0;

        if (availableQty === 0) {
          throw new Error("ITEM_NOT_IN_BANK");
        }

        const finalWithdrawQty = Math.min(actualWithdrawQty, availableQty);

        if (finalWithdrawQty === 0) {
          throw new Error("INSUFFICIENT_QUANTITY");
        }

        // Check if alwaysSetPlaceholder is enabled
        const settingResult = await tx.execute(
          sql`SELECT "alwaysSetPlaceholder" FROM characters WHERE id = ${ctx.playerId}`,
        );
        const alwaysSetPlaceholder =
          (
            settingResult.rows[0] as
              | { alwaysSetPlaceholder: number }
              | undefined
          )?.alwaysSetPlaceholder === 1;

        // Remove from bank
        const newBankQty = availableQty - finalWithdrawQty;
        if (newBankQty <= 0) {
          // RS3-STYLE PLACEHOLDER BEHAVIOR:
          // If alwaysSetPlaceholder is ON, set qty=0 (item stays as placeholder)
          // If alwaysSetPlaceholder is OFF, delete row and compact slots
          if (alwaysSetPlaceholder) {
            // RS3-style: Keep row with qty=0 as placeholder
            await tx.execute(
              sql`UPDATE bank_storage SET quantity = 0 WHERE id = ${bankRow.id}`,
            );
            // Don't compact - placeholder holds the slot
          } else {
            // Delete row and compact slots to fill the gap
            await tx.execute(
              sql`DELETE FROM bank_storage WHERE id = ${bankRow.id}`,
            );
            await compactBankSlots(tx, ctx.playerId, deletedSlot, tabIndex);
          }
        } else {
          await tx.execute(
            sql`UPDATE bank_storage
                SET quantity = quantity - ${finalWithdrawQty}
                WHERE id = ${bankRow.id}
                AND quantity >= ${finalWithdrawQty}`,
          );
        }

        // BANK NOTE SYSTEM: Different inventory handling for notes vs base items
        // - Notes: Single stackable item (qty=finalWithdrawQty) in one slot
        // - Base items: One item per slot (qty=1 each)
        const addedSlots: Array<{
          slot: number;
          quantity: number;
          itemId: string;
        }> = [];

        if (withdrawAsNote) {
          // NOTED WITHDRAWAL: Single stackable item
          const notedItem = getNotedItem(data.itemId);
          if (!notedItem) {
            // Should never happen if canBeNoted() returned true, but safety check
            throw new Error("ITEM_NOT_NOTEABLE");
          }

          const targetSlot = freeSlots[0];

          // Check if player already has this noted item in inventory (stack with it)
          const existingNoted = await tx.execute(
            sql`SELECT id, quantity, "slotIndex" FROM inventory
                WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${notedItem.id}
                FOR UPDATE`,
          );

          if (existingNoted.rows.length > 0) {
            // Stack with existing noted item
            const existingRow = existingNoted.rows[0] as {
              id: number;
              quantity: number;
              slotIndex: number;
            };
            await tx.execute(
              sql`UPDATE inventory SET quantity = quantity + ${finalWithdrawQty}
                  WHERE id = ${existingRow.id}`,
            );
            addedSlots.push({
              slot: existingRow.slotIndex,
              quantity: finalWithdrawQty,
              itemId: notedItem.id,
            });
          } else {
            // Create new noted item stack
            await tx.insert(schema.inventory).values({
              playerId: ctx.playerId,
              itemId: notedItem.id,
              quantity: finalWithdrawQty,
              slotIndex: targetSlot,
              metadata: null,
            });
            addedSlots.push({
              slot: targetSlot,
              quantity: finalWithdrawQty,
              itemId: notedItem.id,
            });
          }
        } else {
          // BASE ITEM WITHDRAWAL: One item per slot (qty=1 each)
          for (let i = 0; i < finalWithdrawQty; i++) {
            const targetSlot = freeSlots[i];

            await tx.insert(schema.inventory).values({
              playerId: ctx.playerId,
              itemId: data.itemId,
              quantity: 1,
              slotIndex: targetSlot,
              metadata: null,
            });

            addedSlots.push({
              slot: targetSlot,
              quantity: 1,
              itemId: data.itemId,
            });
          }
        }

        return { addedSlots };
      },
    });
  });

  if (!result) return; // Error already handled

  // Step 4: Send updated bank state to client (with tabs for consistency)
  // NOTE: Inventory update is handled by reloadFromDatabase() which emits INVENTORY_UPDATED
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);

  // NOTE: emitInventorySyncEvents removed - reloadFromDatabase() handles in-memory sync
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
  data: { targetTabIndex?: number },
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

  // Step 2: Execute transaction with inventory lock (prevents race conditions)
  const result = await executeInventoryTransaction(ctx, async () => {
    return executeSecureTransaction(ctx, {
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

        // BANK NOTE SYSTEM: Group items by BASE itemId (auto-unnote)
        // This ensures noted items get converted to their base form in bank
        const itemGroups = new Map<
          string,
          { total: number; rows: typeof invRows }
        >();
        for (const row of invRows) {
          // Convert noted items to base item ID for bank storage
          const bankItemId = isNotedItemId(row.itemId)
            ? getBaseItemId(row.itemId)
            : row.itemId;
          const existing = itemGroups.get(bankItemId) || { total: 0, rows: [] };
          existing.total += row.quantity ?? 1;
          existing.rows.push(row);
          itemGroups.set(bankItemId, existing);
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
          if (
            existingBank &&
            wouldOverflow(existingBank.quantity, group.total)
          ) {
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
        // RS3-style: New items go to the currently viewed tab
        const targetTab = data.targetTabIndex ?? 0;

        // Get slots used in target tab for new item placement
        const targetTabItems = await tx.execute(
          sql`SELECT slot FROM bank_storage
              WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${targetTab}`,
        );
        const usedTargetTabSlots = new Set(
          (targetTabItems.rows as Array<{ slot: number }>).map((r) => r.slot),
        );
        let nextFreeSlotInTab = 0;

        for (const [itemId, group] of itemGroups) {
          const existingBank = bankByItemId.get(itemId);

          if (existingBank) {
            // Existing item: add to it where it already is (any tab)
            await tx.execute(
              sql`UPDATE bank_storage
                  SET quantity = quantity + ${group.total}
                  WHERE id = ${existingBank.id}`,
            );
          } else {
            // New item: insert into target tab
            while (usedTargetTabSlots.has(nextFreeSlotInTab)) {
              nextFreeSlotInTab++;
            }

            await tx.insert(schema.bankStorage).values({
              playerId: ctx.playerId,
              itemId,
              quantity: group.total,
              slot: nextFreeSlotInTab,
              tabIndex: targetTab,
            });

            usedTargetTabSlots.add(nextFreeSlotInTab);
            nextFreeSlotInTab++;
          }
        }

        return { removedSlots };
      },
    });
  });

  if (!result) return; // Error already handled

  // Step 3: Send updated bank state to client (with tabs for consistency)
  // NOTE: Inventory update is handled by reloadFromDatabase() which emits INVENTORY_UPDATED
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);

  // NOTE: emitInventorySyncEvents removed - reloadFromDatabase() handles in-memory sync
}

// ============================================================================
// COIN DEPOSIT/WITHDRAW HANDLERS
// ============================================================================

/**
 * Handle bank deposit coins request
 *
 * Deposits coins from the player's money pouch (CoinPouchSystem) into bank storage.
 * Coins are stored in bank_storage as a stackable item with itemId='coins'.
 *
 * SECURITY MEASURES:
 * - validateTransactionRequest: player, rate limit, distance, db
 * - Input validation (amount must be positive integer within bounds)
 * - Lock order: characters → bank_storage (prevents deadlocks)
 * - Atomic transaction with row-level locking and retry
 * - Audit logging for large transactions (≥1M coins)
 *
 * @param socket - Client socket connection
 * @param data - Contains amount to deposit
 * @param world - Game world instance
 */
export async function handleBankDepositCoins(
  socket: ServerSocket,
  data: { amount: number },
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

  // Step 2: Input validation - BEFORE transaction to fail fast
  if (!isValidQuantity(data.amount)) {
    sendErrorToast(socket, "Invalid amount");
    return;
  }

  // Step 3: Execute atomic transaction
  const result = await executeSecureTransaction(ctx, {
    errorMessages: {
      INSUFFICIENT_POUCH_COINS: "Not enough coins in money pouch",
      BANK_FULL: "Bank is full",
      QUANTITY_OVERFLOW: "Bank cannot hold that many coins",
    },
    execute: async (tx) => {
      // Lock character row FIRST (consistent lock order prevents deadlocks)
      const characterResult = await tx.execute(
        sql`SELECT coins FROM characters WHERE id = ${ctx.playerId} FOR UPDATE`,
      );

      const characterRow = characterResult.rows[0] as
        | { coins: number }
        | undefined;
      if (!characterRow) {
        throw new Error("PLAYER_NOT_FOUND");
      }

      const currentPouchCoins = characterRow.coins ?? 0;

      // Verify sufficient coins in money pouch
      if (currentPouchCoins < data.amount) {
        throw new Error("INSUFFICIENT_POUCH_COINS");
      }

      // Lock bank coins row (if exists)
      const bankCoinsResult = await tx.execute(
        sql`SELECT * FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND "itemId" = 'coins'
            FOR UPDATE`,
      );

      const bankCoinsRow = bankCoinsResult.rows[0] as
        | { id: number; quantity: number; slot: number }
        | undefined;

      // Check for overflow if adding to existing bank coins
      if (bankCoinsRow) {
        const currentBankCoins = bankCoinsRow.quantity ?? 0;
        if (wouldOverflow(currentBankCoins, data.amount)) {
          throw new Error("QUANTITY_OVERFLOW");
        }
      }

      // Deduct from money pouch
      await tx.execute(
        sql`UPDATE characters SET coins = coins - ${data.amount} WHERE id = ${ctx.playerId}`,
      );

      // Add to bank (upsert pattern)
      if (bankCoinsRow) {
        // Increment existing coins
        await tx.execute(
          sql`UPDATE bank_storage SET quantity = quantity + ${data.amount}
              WHERE id = ${bankCoinsRow.id}`,
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

        // Insert new coins row
        await tx.insert(schema.bankStorage).values({
          playerId: ctx.playerId,
          itemId: "coins",
          quantity: data.amount,
          slot: nextSlot,
        });
      }

      return {
        newPouchBalance: currentPouchCoins - data.amount,
      };
    },
  });

  if (!result) return; // Error already handled by executeSecureTransaction

  // Step 4: Send updated bank state to client (with tabs for consistency)
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);

  // Step 5: Sync CoinPouchSystem in-memory cache
  emitInventorySyncEvents(ctx, {
    newCoinBalance: result.newPouchBalance,
  });

  // Step 6: Audit logging for large transactions
  if (data.amount >= 1_000_000) {
    console.log(
      `[BankCoins] AUDIT: ${ctx.playerId} deposited ${data.amount.toLocaleString()} coins`,
    );
  }

  // Step 7: Success feedback
  sendToSocket(socket, "showToast", {
    message: `Deposited ${data.amount.toLocaleString()} coins`,
    type: "success",
  });
}

/**
 * Handle bank withdraw coins request
 *
 * Withdraws coins from bank storage into the player's money pouch (CoinPouchSystem).
 *
 * SECURITY MEASURES:
 * - validateTransactionRequest: player, rate limit, distance, db
 * - Input validation (amount must be positive integer within bounds)
 * - Lock order: characters → bank_storage (same as deposit, prevents deadlocks)
 * - Overflow check for money pouch (max 2,147,483,647 coins)
 * - Atomic transaction with row-level locking and retry
 * - Audit logging for large transactions (≥1M coins)
 *
 * @param socket - Client socket connection
 * @param data - Contains amount to withdraw
 * @param world - Game world instance
 */
export async function handleBankWithdrawCoins(
  socket: ServerSocket,
  data: { amount: number },
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

  // Step 2: Input validation - BEFORE transaction to fail fast
  if (!isValidQuantity(data.amount)) {
    sendErrorToast(socket, "Invalid amount");
    return;
  }

  // Step 3: Execute atomic transaction
  const result = await executeSecureTransaction(ctx, {
    errorMessages: {
      INSUFFICIENT_BANK_COINS: "Not enough coins in bank",
      COIN_OVERFLOW: "Cannot carry that many coins",
      NO_COINS_IN_BANK: "No coins in bank",
    },
    execute: async (tx) => {
      // Lock character row FIRST (consistent lock order prevents deadlocks)
      const characterResult = await tx.execute(
        sql`SELECT coins FROM characters WHERE id = ${ctx.playerId} FOR UPDATE`,
      );

      const characterRow = characterResult.rows[0] as
        | { coins: number }
        | undefined;
      if (!characterRow) {
        throw new Error("PLAYER_NOT_FOUND");
      }

      const currentPouchCoins = characterRow.coins ?? 0;

      // Check for overflow in money pouch
      if (wouldOverflow(currentPouchCoins, data.amount)) {
        throw new Error("COIN_OVERFLOW");
      }

      // Lock bank coins row
      const bankCoinsResult = await tx.execute(
        sql`SELECT * FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND "itemId" = 'coins'
            FOR UPDATE`,
      );

      const bankCoinsRow = bankCoinsResult.rows[0] as
        | { id: number; quantity: number; slot: number }
        | undefined;

      if (!bankCoinsRow) {
        throw new Error("NO_COINS_IN_BANK");
      }

      const currentBankCoins = bankCoinsRow.quantity ?? 0;

      // Verify sufficient coins in bank
      if (currentBankCoins < data.amount) {
        throw new Error("INSUFFICIENT_BANK_COINS");
      }

      // Deduct from bank
      const newBankBalance = currentBankCoins - data.amount;

      if (newBankBalance === 0) {
        // Delete the bank row if no coins left
        await tx
          .delete(schema.bankStorage)
          .where(eq(schema.bankStorage.id, bankCoinsRow.id));
        // OSRS-style: compact slots to fill the gap
        await compactBankSlots(tx, ctx.playerId, bankCoinsRow.slot);
      } else {
        // Decrement quantity
        await tx.execute(
          sql`UPDATE bank_storage SET quantity = ${newBankBalance}
              WHERE id = ${bankCoinsRow.id}`,
        );
      }

      // Add to money pouch
      await tx.execute(
        sql`UPDATE characters SET coins = coins + ${data.amount} WHERE id = ${ctx.playerId}`,
      );

      return {
        newPouchBalance: currentPouchCoins + data.amount,
      };
    },
  });

  if (!result) return; // Error already handled by executeSecureTransaction

  // Step 4: Send updated bank state to client (with tabs for consistency)
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);

  // Step 5: Sync CoinPouchSystem in-memory cache
  emitInventorySyncEvents(ctx, {
    newCoinBalance: result.newPouchBalance,
  });

  // Step 6: Audit logging for large transactions
  if (data.amount >= 1_000_000) {
    console.log(
      `[BankCoins] AUDIT: ${ctx.playerId} withdrew ${data.amount.toLocaleString()} coins`,
    );
  }

  // Step 7: Success feedback
  sendToSocket(socket, "showToast", {
    message: `Withdrew ${data.amount.toLocaleString()} coins`,
    type: "success",
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

/**
 * Handle bank move/rearrange request
 *
 * OSRS-style bank organization:
 * - Swap mode: Drop on item center → exchange positions
 * - Insert mode: Drop on item edge → insert at position, shift others
 *
 * SECURITY MEASURES:
 * - validateTransactionRequest: player, rate limit, distance, db
 * - isValidBankSlot: slot bounds checking
 * - isValidBankMoveMode: mode validation
 * - executeSecureTransaction: atomic with row-level locking
 */
export async function handleBankMove(
  socket: ServerSocket,
  data: {
    fromSlot: number;
    toSlot: number;
    mode: "swap" | "insert";
    tabIndex: number;
  },
  world: World,
): Promise<void> {
  // Step 1: Common validation (player, rate limit, distance, db)
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.BANK,
    rateLimiter,
  );
  if (!baseResult.success) return;

  const ctx = baseResult.context;

  // Step 2: Input validation
  if (!isValidBankSlot(data.fromSlot)) {
    sendErrorToast(socket, "Invalid source slot");
    return;
  }

  if (!isValidBankSlot(data.toSlot)) {
    sendErrorToast(socket, "Invalid destination slot");
    return;
  }

  if (!isValidBankMoveMode(data.mode)) {
    sendErrorToast(socket, "Invalid move mode");
    return;
  }

  if (!isValidBankTabIndex(data.tabIndex)) {
    sendErrorToast(socket, "Invalid tab");
    return;
  }

  // No-op if same slot
  if (data.fromSlot === data.toSlot) {
    return;
  }

  // Step 3: Execute move transaction
  const result = await executeSecureTransaction(ctx, {
    errorMessages: {
      SLOT_EMPTY: "No item in that slot",
    },
    execute: async (tx) => {
      // Lock ALL bank items for this player IN THIS TAB to prevent race conditions during shift
      // CRITICAL: Must filter by tabIndex to avoid unique constraint violations
      const allItemsResult = await tx.execute(
        sql`SELECT * FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.tabIndex}
            ORDER BY slot
            FOR UPDATE`,
      );

      const allItems = allItemsResult.rows as Array<{
        id: number;
        slot: number;
        itemId: string;
        quantity: number;
        tabIndex: number;
      }>;

      // Find source item
      const fromItem = allItems.find((i) => i.slot === data.fromSlot);
      if (!fromItem) {
        throw new Error("SLOT_EMPTY");
      }

      // Find destination item (may not exist for insert into empty slot)
      const toItem = allItems.find((i) => i.slot === data.toSlot);

      // Use a temporary slot far outside normal range to avoid unique constraint conflicts
      const TEMP_SLOT = -1000;

      if (data.mode === "swap") {
        // SWAP MODE: Exchange positions using temp slot to avoid constraint violation
        if (toItem) {
          // Both slots have items - swap them via temp slot
          await tx.execute(
            sql`UPDATE bank_storage SET slot = ${TEMP_SLOT} WHERE id = ${fromItem.id}`,
          );
          await tx.execute(
            sql`UPDATE bank_storage SET slot = ${data.fromSlot} WHERE id = ${toItem.id}`,
          );
          await tx.execute(
            sql`UPDATE bank_storage SET slot = ${data.toSlot} WHERE id = ${fromItem.id}`,
          );
        } else {
          // Destination empty - just move
          await tx.execute(
            sql`UPDATE bank_storage SET slot = ${data.toSlot} WHERE id = ${fromItem.id}`,
          );
        }
      } else {
        // INSERT MODE: Insert at position, shift others
        // First move source to temp slot to free up its position
        await tx.execute(
          sql`UPDATE bank_storage SET slot = ${TEMP_SLOT} WHERE id = ${fromItem.id}`,
        );

        if (data.fromSlot < data.toSlot) {
          // Moving right: shift items in range left by 1 (filling the gap)
          // Must shift from LOWEST to HIGHEST to avoid constraint violations
          // CRITICAL: Filter by tabIndex to only shift items in this tab
          for (let s = data.fromSlot + 1; s <= data.toSlot; s++) {
            await tx.execute(
              sql`UPDATE bank_storage
                  SET slot = slot - 1
                  WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.tabIndex} AND slot = ${s}`,
            );
          }
        } else {
          // Moving left: shift items in range right by 1 (making room)
          // Must shift from HIGHEST to LOWEST to avoid constraint violations
          // CRITICAL: Filter by tabIndex to only shift items in this tab
          for (let s = data.fromSlot - 1; s >= data.toSlot; s--) {
            await tx.execute(
              sql`UPDATE bank_storage
                  SET slot = slot + 1
                  WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.tabIndex} AND slot = ${s}`,
            );
          }
        }

        // Place the dragged item at destination
        await tx.execute(
          sql`UPDATE bank_storage SET slot = ${data.toSlot} WHERE id = ${fromItem.id}`,
        );
      }

      return { success: true };
    },
  });

  if (!result) return; // Error already handled

  // Step 4: Send updated bank state to client (with tabs for consistency)
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);
}

// ============================================================================
// BANK TAB HANDLERS (Phase 2)
// ============================================================================

/**
 * Handle create bank tab request
 *
 * Creates a new custom tab (1-9) with an item from main tab (or another tab).
 * The item becomes the first item in the new tab and its icon.
 *
 * OSRS Behavior:
 * - Drag item to "+" button or empty tab slot to create
 * - First item becomes the tab icon
 * - Max 9 custom tabs (1-9)
 *
 * SECURITY: Uses existing validation patterns from bank handlers
 */
export async function handleBankCreateTab(
  socket: ServerSocket,
  data: { fromSlot: number; fromTabIndex: number; newTabIndex: number },
  world: World,
): Promise<void> {
  // Step 1: Common validation
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.BANK,
    rateLimiter,
  );
  if (!baseResult.success) return;

  const ctx = baseResult.context;

  // Step 2: Input validation
  if (!isValidBankSlot(data.fromSlot)) {
    sendErrorToast(socket, "Invalid slot");
    return;
  }

  if (!isValidBankTabIndex(data.fromTabIndex)) {
    sendErrorToast(socket, "Invalid source tab");
    return;
  }

  if (!isValidCustomBankTabIndex(data.newTabIndex)) {
    sendErrorToast(socket, "Invalid new tab index");
    return;
  }

  // Step 3: Execute create tab transaction
  const result = await executeSecureTransaction(ctx, {
    errorMessages: {
      SLOT_EMPTY: "No item in that slot",
      TAB_EXISTS: "Tab already exists",
      MAX_TABS_REACHED: "Maximum tabs reached",
    },
    execute: async (tx) => {
      // Check tab doesn't already exist
      const existingTab = await tx.execute(
        sql`SELECT id FROM bank_tabs
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.newTabIndex}
            FOR UPDATE`,
      );

      if (existingTab.rows.length > 0) {
        throw new Error("TAB_EXISTS");
      }

      // Check total tabs count (max 9)
      const tabCount = await tx.execute(
        sql`SELECT COUNT(*) as count FROM bank_tabs WHERE "playerId" = ${ctx.playerId}`,
      );
      const count = Number(
        (tabCount.rows[0] as { count: string | number }).count,
      );
      if (count >= 9) {
        throw new Error("MAX_TABS_REACHED");
      }

      // Find the item to move
      const itemResult = await tx.execute(
        sql`SELECT * FROM bank_storage
            WHERE "playerId" = ${ctx.playerId}
              AND "tabIndex" = ${data.fromTabIndex}
              AND slot = ${data.fromSlot}
            FOR UPDATE`,
      );

      if (itemResult.rows.length === 0) {
        throw new Error("SLOT_EMPTY");
      }

      const item = itemResult.rows[0] as {
        id: number;
        itemId: string;
        quantity: number;
      };

      // Create the new tab with item as icon
      await tx.execute(
        sql`INSERT INTO bank_tabs ("playerId", "tabIndex", "iconItemId")
            VALUES (${ctx.playerId}, ${data.newTabIndex}, ${item.itemId})`,
      );

      // Find next available slot in the new tab (in case of orphaned data)
      const destMax = await tx.execute(
        sql`SELECT COALESCE(MAX(slot), -1) as "maxSlot"
            FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.newTabIndex}`,
      );
      const rawMaxSlot = (
        destMax.rows[0] as { maxSlot: string | number | null }
      ).maxSlot;
      const maxSlot = rawMaxSlot === null ? -1 : Number(rawMaxSlot);
      const nextSlot = maxSlot + 1;

      // Move item to new tab
      await tx.execute(
        sql`UPDATE bank_storage
            SET "tabIndex" = ${data.newTabIndex}, slot = ${nextSlot}
            WHERE id = ${item.id}`,
      );

      // Compact the source tab to fill the gap
      await compactBankSlots(
        tx,
        ctx.playerId,
        data.fromSlot,
        data.fromTabIndex,
      );

      return { success: true };
    },
  });

  if (!result) return;

  // Audit log: Tab creation
  console.log(
    `[Bank:TabCreate] playerId=${ctx.playerId} newTabIndex=${data.newTabIndex} fromSlot=${data.fromSlot}`,
  );

  // Step 4: Send updated state
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);
}

/**
 * Handle delete bank tab request
 *
 * Deletes a custom tab and moves all items to main tab (index 0).
 * Tab 0 (main) cannot be deleted.
 *
 * OSRS Behavior:
 * - Items from deleted tab are appended to main tab
 * - Tab numbers above the deleted tab shift down
 *
 * SECURITY: Uses existing validation patterns from bank handlers
 */
export async function handleBankDeleteTab(
  socket: ServerSocket,
  data: { tabIndex: number },
  world: World,
): Promise<void> {
  // Step 1: Common validation
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.BANK,
    rateLimiter,
  );
  if (!baseResult.success) return;

  const ctx = baseResult.context;

  // Step 2: Input validation - must be custom tab (1-9), not main (0)
  if (!isValidCustomBankTabIndex(data.tabIndex)) {
    sendErrorToast(socket, "Cannot delete main tab");
    return;
  }

  // Step 3: Execute delete tab transaction
  const result = await executeSecureTransaction(ctx, {
    errorMessages: {
      TAB_NOT_FOUND: "Tab not found",
    },
    execute: async (tx) => {
      // Check tab exists
      const tabResult = await tx.execute(
        sql`SELECT id FROM bank_tabs
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.tabIndex}
            FOR UPDATE`,
      );

      if (tabResult.rows.length === 0) {
        throw new Error("TAB_NOT_FOUND");
      }

      // Get all items in the tab being deleted
      const itemsInTab = await tx.execute(
        sql`SELECT id, slot FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.tabIndex}
            ORDER BY slot
            FOR UPDATE`,
      );

      // Get max slot in main tab to append items
      const mainTabMax = await tx.execute(
        sql`SELECT COALESCE(MAX(slot), -1) as "maxSlot"
            FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = 0`,
      );
      const rawMaxSlot = (
        mainTabMax.rows[0] as { maxSlot: string | number | null }
      ).maxSlot;
      const maxSlot = rawMaxSlot === null ? -1 : Number(rawMaxSlot);
      let nextSlot = maxSlot + 1;

      // Move all items to main tab
      for (const row of itemsInTab.rows as Array<{
        id: number;
        slot: number;
      }>) {
        await tx.execute(
          sql`UPDATE bank_storage
              SET "tabIndex" = 0, slot = ${nextSlot}
              WHERE id = ${row.id}`,
        );
        nextSlot++;
      }

      // Delete the tab
      await tx.execute(
        sql`DELETE FROM bank_tabs
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.tabIndex}`,
      );

      // RS3-STYLE: Shift all higher tabs down by 1 to fill the gap
      // This ensures tabs are always sequential (1, 2, 3...) with no gaps
      //
      // NOTE: Cannot use single batched UPDATE due to unique constraint on (playerId, tabIndex, slot).
      // PostgreSQL doesn't guarantee update order, so concurrent updates can cause conflicts.
      // Using two-phase approach: first offset by +1000, then subtract 1001.

      // Phase 1: Add large offset to avoid conflicts during shift
      await tx.execute(
        sql`UPDATE bank_tabs
            SET "tabIndex" = "tabIndex" + 1000
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" > ${data.tabIndex}`,
      );
      await tx.execute(
        sql`UPDATE bank_storage
            SET "tabIndex" = "tabIndex" + 1000
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" > ${data.tabIndex}`,
      );

      // Phase 2: Subtract offset + 1 to get final values (shifted down by 1)
      await tx.execute(
        sql`UPDATE bank_tabs
            SET "tabIndex" = "tabIndex" - 1001
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" > 1000`,
      );
      await tx.execute(
        sql`UPDATE bank_storage
            SET "tabIndex" = "tabIndex" - 1001
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" > 1000`,
      );

      return { success: true };
    },
  });

  if (!result) return;

  // Audit log: Tab deletion
  console.log(
    `[Bank:TabDelete] playerId=${ctx.playerId} tabIndex=${data.tabIndex}`,
  );

  // Step 4: Send updated state
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);
}

/**
 * Handle move item to different tab
 *
 * Moves an item from one tab to another (including main tab 0).
 * If toSlot is provided, inserts at that position (shifting others right).
 * If toSlot is -1 or omitted, appends to the end of the destination tab.
 *
 * SECURITY: Uses existing validation patterns from bank handlers
 */
export async function handleBankMoveToTab(
  socket: ServerSocket,
  data: {
    fromSlot: number;
    fromTabIndex: number;
    toTabIndex: number;
    toSlot?: number;
  },
  world: World,
): Promise<void> {
  // Step 1: Common validation
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.BANK,
    rateLimiter,
  );
  if (!baseResult.success) return;

  const ctx = baseResult.context;

  // Step 2: Input validation
  if (!isValidBankSlot(data.fromSlot)) {
    sendErrorToast(socket, "Invalid slot");
    return;
  }

  if (!isValidBankTabIndex(data.fromTabIndex)) {
    sendErrorToast(socket, "Invalid source tab");
    return;
  }

  if (!isValidBankTabIndex(data.toTabIndex)) {
    sendErrorToast(socket, "Invalid destination tab");
    return;
  }

  // Validate toSlot if provided (allow -1 for "append to end")
  const insertAtSlot = data.toSlot ?? -1;
  if (insertAtSlot !== -1 && !isValidBankSlot(insertAtSlot)) {
    sendErrorToast(socket, "Invalid destination slot");
    return;
  }

  // No-op if same tab
  if (data.fromTabIndex === data.toTabIndex) {
    return;
  }

  // Step 3: Execute move transaction
  const result = await executeSecureTransaction(ctx, {
    errorMessages: {
      SLOT_EMPTY: "No item in that slot",
      TAB_NOT_FOUND: "Destination tab not found",
    },
    execute: async (tx) => {
      // Check destination tab exists (unless it's main tab 0)
      if (data.toTabIndex !== 0) {
        const tabResult = await tx.execute(
          sql`SELECT id FROM bank_tabs
              WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.toTabIndex}
              FOR UPDATE`,
        );

        if (tabResult.rows.length === 0) {
          throw new Error("TAB_NOT_FOUND");
        }
      }

      // Find the item to move
      const itemResult = await tx.execute(
        sql`SELECT * FROM bank_storage
            WHERE "playerId" = ${ctx.playerId}
              AND "tabIndex" = ${data.fromTabIndex}
              AND slot = ${data.fromSlot}
            FOR UPDATE`,
      );

      if (itemResult.rows.length === 0) {
        throw new Error("SLOT_EMPTY");
      }

      const item = itemResult.rows[0] as { id: number; itemId: string };

      // Get max slot in destination tab
      const destMax = await tx.execute(
        sql`SELECT COALESCE(MAX(slot), -1) as "maxSlot"
            FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.toTabIndex}`,
      );
      const rawMaxSlot = (
        destMax.rows[0] as { maxSlot: string | number | null }
      ).maxSlot;
      const maxSlot = rawMaxSlot === null ? -1 : Number(rawMaxSlot);

      // Determine target slot
      let targetSlot: number;
      if (insertAtSlot === -1) {
        // Append to end
        targetSlot = maxSlot + 1;
      } else {
        // Insert at specific position - need to shift items to make room
        targetSlot = insertAtSlot;

        // Lock all items in destination tab
        await tx.execute(
          sql`SELECT id FROM bank_storage
              WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.toTabIndex}
              FOR UPDATE`,
        );

        // Shift items at targetSlot and above to the right by 1
        // Must shift from HIGHEST to LOWEST to avoid unique constraint violations
        for (let s = maxSlot; s >= targetSlot; s--) {
          await tx.execute(
            sql`UPDATE bank_storage
                SET slot = slot + 1
                WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.toTabIndex} AND slot = ${s}`,
          );
        }
      }

      // Move item to destination tab at target slot
      await tx.execute(
        sql`UPDATE bank_storage
            SET "tabIndex" = ${data.toTabIndex}, slot = ${targetSlot}
            WHERE id = ${item.id}`,
      );

      // Compact source tab to fill the gap
      await compactBankSlots(
        tx,
        ctx.playerId,
        data.fromSlot,
        data.fromTabIndex,
      );

      // If source tab is now empty (custom tab), delete it
      if (data.fromTabIndex !== 0) {
        const remainingItems = await tx.execute(
          sql`SELECT COUNT(*) as count FROM bank_storage
              WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.fromTabIndex}`,
        );
        const count = (remainingItems.rows[0] as { count: number }).count;

        if (count === 0) {
          await tx.execute(
            sql`DELETE FROM bank_tabs
                WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.fromTabIndex}`,
          );
        }
      }

      // Update tab icon if first item moved to a custom tab (slot 0)
      if (data.toTabIndex !== 0 && targetSlot === 0) {
        await tx.execute(
          sql`UPDATE bank_tabs
              SET "iconItemId" = ${item.itemId}
              WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${data.toTabIndex}`,
        );
      }

      return { success: true };
    },
  });

  if (!result) return;

  // Step 4: Send updated state
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);
}

// ============================================================================
// BANK PLACEHOLDER HANDLERS (Phase 3 - RS3 Style)
// RS3-style: Placeholders are bank_storage rows with qty=0
// ============================================================================

/**
 * Handle withdraw-placeholder request (RS3-style)
 *
 * Withdraws ALL of an item to inventory and leaves a qty=0 placeholder.
 * This is the RS3 "Withdraw-Placeholder" context menu option.
 *
 * RS3 Behavior:
 * - Right-click item in bank → "Withdraw-Placeholder"
 * - ALL of that item withdrawn to inventory
 * - Bank row stays with qty=0 (placeholder)
 * - Works regardless of "Always set placeholder" toggle
 */
export async function handleBankWithdrawPlaceholder(
  socket: ServerSocket,
  data: { itemId: string },
  world: World,
): Promise<void> {
  // Step 1: Common validation
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.BANK,
    rateLimiter,
  );
  if (!baseResult.success) return;

  const ctx = baseResult.context;

  // Step 2: Input validation
  if (!isValidItemId(data.itemId)) {
    sendErrorToast(socket, "Invalid item");
    return;
  }

  // Validate item exists in game database
  if (!isValidGameItem(data.itemId)) {
    sendErrorToast(socket, "This item no longer exists");
    return;
  }

  // Step 3: Execute transaction with inventory lock
  const result = await executeInventoryTransaction(ctx, async () => {
    return executeSecureTransaction(ctx, {
      errorMessages: {
        ITEM_NOT_IN_BANK: "Item not found in bank",
        ALREADY_PLACEHOLDER: "Already a placeholder",
        INVENTORY_FULL: "Inventory is full",
      },
      execute: async (tx) => {
        // Lock and find bank item
        const bankResult = await tx.execute(
          sql`SELECT * FROM bank_storage
              WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${data.itemId}
              FOR UPDATE`,
        );

        const bankRows = bankResult.rows as Array<{
          id: number;
          quantity: number | null;
          slot: number;
          tabIndex: number;
        }>;

        if (bankRows.length === 0) {
          throw new Error("ITEM_NOT_IN_BANK");
        }

        const bankRow = bankRows[0];
        const availableQty = bankRow.quantity ?? 0;

        // RS3-style: Can't withdraw-placeholder if already qty=0
        if (availableQty === 0) {
          throw new Error("ALREADY_PLACEHOLDER");
        }

        // Lock and get current inventory to find free slots
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

        // Withdraw as many as we can fit (up to all)
        const withdrawQty = Math.min(availableQty, freeSlots.length);

        // RS3-STYLE: Set qty=0 (leave placeholder) - ALWAYS for this action
        await tx.execute(
          sql`UPDATE bank_storage SET quantity = 0 WHERE id = ${bankRow.id}`,
        );

        // Create inventory items (one per withdrawn item, qty=1)
        for (let i = 0; i < withdrawQty; i++) {
          const targetSlot = freeSlots[i];
          await tx.insert(schema.inventory).values({
            playerId: ctx.playerId,
            itemId: data.itemId,
            quantity: 1,
            slotIndex: targetSlot,
            metadata: null,
          });
        }

        return { withdrawnQty: withdrawQty };
      },
    });
  });

  if (!result) return;

  // Step 4: Send updated bank state
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);
}

/**
 * Handle release single placeholder (RS3-style)
 *
 * Deletes a bank_storage row with qty=0 at the specified slot.
 * Then compacts slots to fill the gap.
 */
export async function handleBankReleasePlaceholder(
  socket: ServerSocket,
  data: { tabIndex: number; slot: number },
  world: World,
): Promise<void> {
  // Step 1: Common validation
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.BANK,
    rateLimiter,
  );
  if (!baseResult.success) return;

  const ctx = baseResult.context;

  // Step 2: Input validation
  if (!isValidBankTabIndex(data.tabIndex)) {
    sendErrorToast(socket, "Invalid tab");
    return;
  }

  if (!isValidBankSlot(data.slot)) {
    sendErrorToast(socket, "Invalid slot");
    return;
  }

  // Step 3: Execute transaction
  const result = await executeSecureTransaction(ctx, {
    errorMessages: {
      NOT_A_PLACEHOLDER: "Not a placeholder (has items)",
      SLOT_EMPTY: "No item at that slot",
    },
    execute: async (tx) => {
      // RS3-style: Find bank_storage row with qty=0 at this slot
      const placeholderResult = await tx.execute(
        sql`SELECT id, quantity FROM bank_storage
            WHERE "playerId" = ${ctx.playerId}
              AND "tabIndex" = ${data.tabIndex}
              AND slot = ${data.slot}
            FOR UPDATE`,
      );

      if (placeholderResult.rows.length === 0) {
        throw new Error("SLOT_EMPTY");
      }

      const row = placeholderResult.rows[0] as {
        id: number;
        quantity: number | null;
      };

      // RS3-style: Can only release if qty=0 (is a placeholder)
      if ((row.quantity ?? 0) > 0) {
        throw new Error("NOT_A_PLACEHOLDER");
      }

      // Delete the placeholder (qty=0 row)
      await tx.execute(sql`DELETE FROM bank_storage WHERE id = ${row.id}`);

      // Compact slots to fill the gap
      await compactBankSlots(tx, ctx.playerId, data.slot, data.tabIndex);

      return { success: true };
    },
  });

  if (!result) return;

  // Step 4: Send updated state
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);
}

/**
 * Handle release all placeholders (RS3-style)
 *
 * Deletes all bank_storage rows with qty=0 for the player.
 * Then compacts slots in each tab.
 */
export async function handleBankReleaseAllPlaceholders(
  socket: ServerSocket,
  _data: unknown,
  world: World,
): Promise<void> {
  // Step 1: Common validation
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.BANK,
    rateLimiter,
  );
  if (!baseResult.success) return;

  const ctx = baseResult.context;

  // Step 2: Execute transaction
  const result = await executeSecureTransaction(ctx, {
    execute: async (tx) => {
      // RS3-style: Find all qty=0 placeholders grouped by tab
      const placeholders = await tx.execute(
        sql`SELECT id, slot, "tabIndex" FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND quantity = 0
            ORDER BY "tabIndex", slot DESC
            FOR UPDATE`,
      );

      const rows = placeholders.rows as Array<{
        id: number;
        slot: number;
        tabIndex: number;
      }>;

      if (rows.length === 0) {
        return { success: true, count: 0 };
      }

      // Group by tab for compaction
      const byTab = new Map<number, number[]>();
      for (const row of rows) {
        const slots = byTab.get(row.tabIndex) || [];
        slots.push(row.slot);
        byTab.set(row.tabIndex, slots);
      }

      // Delete all qty=0 rows
      await tx.execute(
        sql`DELETE FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND quantity = 0`,
      );

      // Compact each tab (process highest slot first to avoid conflicts)
      for (const [tabIndex, slots] of byTab) {
        // Slots are already sorted DESC, so compact from highest to lowest
        for (const slot of slots) {
          await compactBankSlots(tx, ctx.playerId, slot, tabIndex);
        }
      }

      return { success: true, count: rows.length };
    },
  });

  if (!result) return;

  // Step 3: Send updated state
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);

  sendToSocket(socket, "showToast", {
    message: "All placeholders released",
    type: "success",
  });
}

/**
 * Handle toggle always set placeholder setting
 *
 * Toggles whether placeholders are automatically created when
 * withdrawing all of an item.
 */
export async function handleBankToggleAlwaysPlaceholder(
  socket: ServerSocket,
  _data: unknown,
  world: World,
): Promise<void> {
  // This is a player preference toggle - doesn't require full bank session validation
  // Just need player ID and database access
  const playerId = getPlayerId(socket);
  if (!playerId) {
    console.warn("[BankToggle] No player on socket");
    return;
  }

  const db = getDatabase(world);
  if (!db) {
    console.error("[BankToggle] Database not available");
    sendErrorToast(socket, "Server error - please try again");
    return;
  }

  try {
    // Use drizzle ORM for database operations
    const drizzle = db.drizzle;

    // Get current setting
    const currentResult = await drizzle
      .select({ alwaysSetPlaceholder: schema.characters.alwaysSetPlaceholder })
      .from(schema.characters)
      .where(eq(schema.characters.id, playerId));

    if (currentResult.length === 0) {
      console.error(`[Bank:TogglePlaceholder] Player ${playerId} not found`);
      sendErrorToast(socket, "Player not found");
      return;
    }

    const current = currentResult[0].alwaysSetPlaceholder;
    const newValue = current === 1 ? 0 : 1;

    // Toggle setting
    await drizzle
      .update(schema.characters)
      .set({ alwaysSetPlaceholder: newValue })
      .where(eq(schema.characters.id, playerId));

    // Audit log: Placeholder toggle
    console.log(
      `[Bank:TogglePlaceholder] playerId=${playerId} newValue=${newValue === 1 ? "enabled" : "disabled"}`,
    );

    // Send updated state
    await sendBankStateWithTabs(socket, playerId, db);

    sendToSocket(socket, "showToast", {
      message:
        newValue === 1
          ? "Always set placeholders: ON"
          : "Always set placeholders: OFF",
      type: "info",
    });

    console.log(`[BankToggle] Completed for player ${playerId}`);
  } catch (error) {
    console.error(`[BankToggle] Error:`, error);
    sendErrorToast(socket, "Failed to toggle placeholder setting");
  }
}
