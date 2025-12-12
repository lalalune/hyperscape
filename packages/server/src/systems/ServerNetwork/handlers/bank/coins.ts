/**
 * Bank Coin Handlers
 *
 * Handles deposit/withdraw of coins between money pouch and bank.
 * Coins are stored as bank_storage rows with itemId='coins'.
 */

import { type World, SessionType } from "@hyperscape/shared";
import type { ServerSocket } from "../../../../shared/types";
import * as schema from "../../../../database/schema";
import { eq, sql } from "drizzle-orm";

import { isValidQuantity, wouldOverflow } from "../../services";

import {
  validateTransactionRequest,
  executeSecureTransaction,
  emitInventorySyncEvents,
  sendToSocket,
  sendErrorToast,
} from "../common";

import {
  rateLimiter,
  compactBankSlots,
  sendBankStateWithTabs,
  MAX_BANK_SLOTS,
  AUDIT_COIN_THRESHOLD,
} from "./utils";

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

        // Insert new coins row in main tab (tabIndex 0)
        await tx.insert(schema.bankStorage).values({
          playerId: ctx.playerId,
          itemId: "coins",
          quantity: data.amount,
          slot: nextSlot,
          tabIndex: 0,
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
  if (data.amount >= AUDIT_COIN_THRESHOLD) {
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
  if (data.amount >= AUDIT_COIN_THRESHOLD) {
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
