/**
 * Bank Placeholder Handlers (RS3-style)
 *
 * RS3-style: Placeholders are bank_storage rows with qty=0.
 * Provides withdraw-placeholder, release, and toggle functionality.
 */

import { type World, SessionType } from "@hyperscape/shared";
import type { ServerSocket } from "../../../../shared/types";
import * as schema from "../../../../database/schema";
import { eq, sql } from "drizzle-orm";

import {
  isValidItemId,
  isValidBankTabIndex,
  isValidBankSlot,
} from "../../services";

import {
  validateTransactionRequest,
  executeSecureTransaction,
  executeInventoryTransaction,
  sendToSocket,
  sendErrorToast,
  getPlayerId,
  getDatabase,
} from "../common";

import {
  rateLimiter,
  isValidGameItem,
  compactBankSlots,
  sendBankStateWithTabs,
  MAX_INVENTORY_SLOTS,
} from "./utils";

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
        // BULK INSERT: Batch all items into single query for performance
        const newItems: Array<{
          playerId: string;
          itemId: string;
          quantity: number;
          slotIndex: number;
          metadata: null;
        }> = [];
        for (let i = 0; i < withdrawQty; i++) {
          newItems.push({
            playerId: ctx.playerId,
            itemId: data.itemId,
            quantity: 1,
            slotIndex: freeSlots[i],
            metadata: null,
          });
        }

        if (newItems.length > 0) {
          await tx.insert(schema.inventory).values(newItems);
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

      // Collect affected tabs for batch compaction
      const affectedTabs = new Set<number>();
      for (const row of rows) {
        affectedTabs.add(row.tabIndex);
      }

      // Delete all qty=0 rows
      await tx.execute(
        sql`DELETE FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND quantity = 0`,
      );

      // Batch compact each affected tab - renumber all slots sequentially
      // Uses window function to assign new slot numbers in one query per tab
      for (const tabIndex of affectedTabs) {
        await tx.execute(
          sql`UPDATE bank_storage
              SET slot = subq.new_slot
              FROM (
                SELECT id, ROW_NUMBER() OVER (ORDER BY slot) - 1 as new_slot
                FROM bank_storage
                WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = ${tabIndex}
              ) as subq
              WHERE bank_storage.id = subq.id`,
        );
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

    // Send updated state
    await sendBankStateWithTabs(socket, playerId, db);

    sendToSocket(socket, "showToast", {
      message:
        newValue === 1
          ? "Always set placeholders: ON"
          : "Always set placeholders: OFF",
      type: "info",
    });
  } catch (error) {
    console.error(`[BankToggle] Error:`, error);
    sendErrorToast(socket, "Failed to toggle placeholder setting");
  }
}
