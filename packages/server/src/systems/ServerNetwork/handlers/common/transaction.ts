/**
 * Transaction Wrapper
 *
 * Standardized transaction execution with:
 * - Retry logic for database conflicts (serialization, deadlock)
 * - Consistent error handling and user-friendly messages
 * - In-memory sync event emission
 *
 * This consolidates ~40-50 lines of retry/error handling that was
 * duplicated across every transaction handler.
 *
 * SECURITY: All database operations MUST go through this wrapper
 * to ensure consistent retry and error handling.
 */

import { EventType } from "@hyperscape/shared";
import type { BaseHandlerContext, TransactionSyncData } from "./types";
import { sendErrorToast } from "./helpers";

// ============================================================================
// ERROR MESSAGES
// ============================================================================

/**
 * Default business error to user message mapping.
 * Handlers can extend with operation-specific messages.
 *
 * Key format: Error message thrown in transaction
 * Value: User-friendly message to display
 */
const DEFAULT_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  // Player errors
  PLAYER_NOT_FOUND: "Character not found",

  // Inventory errors
  ITEM_NOT_FOUND: "Item not in inventory",
  INSUFFICIENT_QUANTITY: "Not enough items",
  INVENTORY_FULL: "Inventory is full",

  // Bank errors
  ITEM_NOT_IN_BANK: "Item not in bank",
  BANK_FULL: "Bank is full",

  // Store errors
  INSUFFICIENT_COINS: "Not enough coins",
  STORE_NOT_FOUND: "Store not found",
  ITEM_NOT_IN_STORE: "Item not available in this store",
  NOT_ENOUGH_STOCK: "Not enough stock available",

  // Overflow errors
  QUANTITY_OVERFLOW: "Stack limit reached",
  PRICE_OVERFLOW: "Transaction too large",
};

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Check if error is a retryable database conflict.
 * These are transient errors that may succeed on retry.
 */
function isRetryableConflict(errorMsg: string): boolean {
  return (
    errorMsg.includes("unique constraint") ||
    errorMsg.includes("could not serialize") ||
    errorMsg.includes("deadlock")
  );
}

/**
 * Calculate backoff delay for retry attempt.
 * Uses linear backoff: 10ms, 20ms, 30ms, etc.
 */
function getRetryDelay(attempt: number): number {
  return 10 * (attempt + 1);
}

// ============================================================================
// TRANSACTION CONFIG
// ============================================================================

/**
 * Drizzle transaction type (extracted for readability).
 * This is the type of `tx` passed to transaction callbacks.
 */
type DrizzleTransaction = Parameters<
  Parameters<BaseHandlerContext["db"]["drizzle"]["transaction"]>[0]
>[0];

/**
 * Configuration for secure transaction execution.
 */
export interface TransactionConfig<
  TContext extends BaseHandlerContext,
  TResult,
> {
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;

  /**
   * The transaction logic to execute.
   * Runs within a database transaction with row-level locking.
   *
   * Throw Error with message matching errorMessages key for user-friendly handling:
   * - throw new Error("INSUFFICIENT_COINS") -> "Not enough coins"
   * - throw new Error("INVENTORY_FULL") -> "Inventory is full"
   */
  execute: (tx: DrizzleTransaction, context: TContext) => Promise<TResult>;

  /** Additional error message mappings (merged with defaults) */
  errorMessages?: Record<string, string>;
}

// ============================================================================
// MAIN TRANSACTION FUNCTION
// ============================================================================

/**
 * Execute a database transaction with retry logic and error handling.
 *
 * Features:
 * - Automatic retry (up to 3x) for serialization/deadlock conflicts
 * - Linear backoff between retries (10ms, 20ms, 30ms)
 * - Maps business errors to user-friendly toast messages
 * - Logs unexpected errors for debugging
 *
 * Usage:
 * ```typescript
 * const result = await executeSecureTransaction(context, {
 *   execute: async (tx, ctx) => {
 *     // Lock rows with FOR UPDATE
 *     const player = await tx.execute(sql`SELECT ... FOR UPDATE`);
 *
 *     // Validate and throw known errors
 *     if (player.coins < cost) throw new Error("INSUFFICIENT_COINS");
 *
 *     // Perform operations
 *     await tx.execute(sql`UPDATE ...`);
 *
 *     return { addedSlots: [...], newCoinBalance: 100 };
 *   }
 * });
 *
 * if (!result) return; // Error already sent to client
 * // Use result...
 * ```
 *
 * @param context - Handler context with db connection
 * @param config - Transaction configuration
 * @returns Transaction result on success, null on failure
 */
export async function executeSecureTransaction<
  TContext extends BaseHandlerContext,
  TResult,
>(
  context: TContext,
  config: TransactionConfig<TContext, TResult>,
): Promise<TResult | null> {
  const maxRetries = config.maxRetries ?? 3;
  const errorMessages = { ...DEFAULT_ERROR_MESSAGES, ...config.errorMessages };
  const handlerTag = `[TransactionWrapper:${context.sessionType}]`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Execute transaction
      const result = await context.db.drizzle.transaction(async (tx) => {
        return config.execute(tx, context);
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check if this is a known business error
      const userMessage = errorMessages[errorMsg];
      if (userMessage) {
        sendErrorToast(context.socket, userMessage);
        return null;
      }

      // Check if this is a retryable database conflict
      if (isRetryableConflict(errorMsg) && attempt < maxRetries - 1) {
        const delay = getRetryDelay(attempt);
        console.log(
          `${handlerTag} Retryable conflict on attempt ${attempt + 1}, waiting ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Unexpected error - log and notify user
      console.error(
        `${handlerTag} Transaction failed (attempt ${attempt + 1}/${maxRetries}):`,
        error,
      );
      sendErrorToast(context.socket, "Operation failed - please try again");
      return null;
    }
  }

  // All retries exhausted
  console.error(`${handlerTag} All ${maxRetries} retries failed`);
  sendErrorToast(context.socket, "Operation failed - please try again");
  return null;
}

// ============================================================================
// IN-MEMORY SYNC
// ============================================================================

/**
 * Emit inventory sync events after successful transaction.
 * Keeps in-memory InventorySystem consistent with database.
 *
 * CRITICAL: Must be called after every transaction that modifies inventory.
 * Failure to sync causes duplication bugs where in-memory cache diverges
 * from database state.
 *
 * @param context - Handler context with world for event emission
 * @param syncData - Data about what changed in the transaction
 */
export function emitInventorySyncEvents(
  context: BaseHandlerContext,
  syncData: TransactionSyncData,
): void {
  const { world, playerId } = context;

  // Emit added items
  if (syncData.addedSlots) {
    for (const added of syncData.addedSlots) {
      world.emit(EventType.INVENTORY_ITEM_ADDED, {
        playerId,
        item: {
          id: 0, // Database ID not needed for sync
          itemId: added.itemId,
          quantity: added.quantity,
          slot: added.slot,
          metadata: null,
        },
      });
    }
  }

  // Emit removed items
  if (syncData.removedSlots) {
    for (const removed of syncData.removedSlots) {
      world.emit(EventType.INVENTORY_ITEM_REMOVED, {
        playerId,
        itemId: removed.itemId,
        quantity: removed.quantity,
        slot: removed.slot >= 0 ? removed.slot : undefined,
      });
    }
  }

  // Emit coin balance update - use INVENTORY_UPDATE_COINS (command) not INVENTORY_COINS_UPDATED (notification)
  // CoinPouchSystem listens to UPDATE_COINS and will emit COINS_UPDATED to notify client
  if (syncData.newCoinBalance !== undefined) {
    world.emit(EventType.INVENTORY_UPDATE_COINS, {
      playerId,
      coins: syncData.newCoinBalance,
    });
  }
}
