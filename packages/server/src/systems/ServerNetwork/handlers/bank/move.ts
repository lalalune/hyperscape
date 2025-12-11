/**
 * Bank Move/Rearrange Handler
 *
 * OSRS-style bank organization: swap mode and insert mode.
 */

import { type World, SessionType } from "@hyperscape/shared";
import type { ServerSocket } from "../../../../shared/types";
import { sql } from "drizzle-orm";

import {
  isValidBankSlot,
  isValidBankMoveMode,
  isValidBankTabIndex,
} from "../../services";

import {
  validateTransactionRequest,
  executeSecureTransaction,
  sendErrorToast,
} from "../common";

import { rateLimiter, sendBankStateWithTabs } from "./utils";

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
