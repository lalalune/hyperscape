/**
 * Bank Tab Handlers
 *
 * Manages custom bank tabs (RS3-style tab organization).
 * Tab 0 is the main tab, tabs 1-9 are custom user tabs.
 */

import { type World, SessionType } from "@hyperscape/shared";
import type { ServerSocket } from "../../../../shared/types";
import { sql } from "drizzle-orm";

import {
  isValidBankSlot,
  isValidBankTabIndex,
  isValidCustomBankTabIndex,
} from "../../services";

import {
  validateTransactionRequest,
  executeSecureTransaction,
  sendErrorToast,
} from "../common";

import { rateLimiter, compactBankSlots, sendBankStateWithTabs } from "./utils";

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
