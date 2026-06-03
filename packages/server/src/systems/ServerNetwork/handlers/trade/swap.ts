/**
 * Trade Swap Logic
 *
 * Handles the atomic item swap when a trade completes:
 * - executeTradeSwap: Main swap function with database transaction
 * - sendTradeErrorToBoth: Error notification to both participants
 * - countFreeSlots: Calculate free inventory slots
 * - findFreeSlotFromSet: Find next available slot
 */

import { type World, EventType, getItem } from "@hyperforge/shared";
import { sql } from "drizzle-orm";
import type { ServerSocket } from "../../../../shared/types";
import { executeSecureTransaction, sendToSocket } from "../common";
import type { TradingSystem } from "../../../TradingSystem";
import type {
  DatabaseConnection,
  InventoryDBRow,
  TradeSwapResult,
} from "./types";
import { getSocketByPlayerId, sendTradeError } from "./helpers";

// ============================================================================
// Error Notification
// ============================================================================

/**
 * Send trade error to both participants
 */
export function sendTradeErrorToBoth(
  world: World,
  session: ReturnType<TradingSystem["getTradeSession"]>,
  message: string,
): void {
  if (!session) return;

  const initiatorSocket = getSocketByPlayerId(
    world,
    session.initiator.playerId,
  );
  const recipientSocket = getSocketByPlayerId(
    world,
    session.recipient.playerId,
  );

  if (initiatorSocket) {
    sendTradeError(initiatorSocket, message, "TRADE_FAILED");
  }
  if (recipientSocket) {
    sendTradeError(recipientSocket, message, "TRADE_FAILED");
  }
}

// ============================================================================
// Slot Calculation Helpers
// ============================================================================

/**
 * Count free slots in inventory, accounting for slots being freed
 */
export function countFreeSlots(
  usedSlots: Set<number>,
  beingFreed: Set<number>,
): number {
  let freeCount = 0;
  for (let i = 0; i < 28; i++) {
    if (!usedSlots.has(i) || beingFreed.has(i)) {
      freeCount++;
    }
  }
  return freeCount;
}

/**
 * Find the next free slot in inventory
 */
export function findFreeSlotFromSet(
  usedSlots: Set<number>,
  beingFreed: Set<number>,
): number {
  for (let i = 0; i < 28; i++) {
    if (!usedSlots.has(i) || beingFreed.has(i)) {
      beingFreed.delete(i); // Mark as used now
      return i;
    }
  }
  throw new Error("No free slot found");
}

// ============================================================================
// Trade Swap Execution
// ============================================================================

/**
 * Execute the atomic item swap for a completed trade
 *
 * This is the critical section where items are swapped between players.
 * Uses database transactions and inventory locks to prevent duplication.
 */
export async function executeTradeSwap(
  tradingSystem: TradingSystem,
  tradeId: string,
  world: World,
  db: DatabaseConnection,
): Promise<void> {
  const session = tradingSystem.getTradeSession(tradeId);
  if (!session) {
    console.error("[TradeHandler] Session not found for swap:", tradeId);
    return;
  }

  // Validate session is still in correct state
  if (session.status !== "active" && session.status !== "confirming") {
    console.error(
      "[TradeHandler] Session not in valid state for swap:",
      tradeId,
      session.status,
    );
    sendTradeErrorToBoth(world, session, "Trade was cancelled");
    return;
  }

  // Get inventory system
  const inventorySystem = world.getSystem("inventory") as
    | {
        lockForTransaction: (id: string) => boolean;
        unlockTransaction: (id: string) => void;
        reloadFromDatabase: (id: string) => Promise<void>;
        persistInventoryImmediate: (id: string) => Promise<void>;
      }
    | undefined;

  if (!inventorySystem) {
    console.error("[TradeHandler] InventorySystem not available");
    sendTradeErrorToBoth(world, session, "Trade failed - system error");
    tradingSystem.cancelTrade(tradeId, "server_error");
    return;
  }

  const initiatorId = session.initiator.playerId;
  const recipientId = session.recipient.playerId;

  // Lock both inventories
  const initiatorLocked = inventorySystem.lockForTransaction(initiatorId);
  if (!initiatorLocked) {
    sendTradeErrorToBoth(world, session, "Trade failed - try again");
    tradingSystem.cancelTrade(tradeId, "server_error");
    return;
  }

  const recipientLocked = inventorySystem.lockForTransaction(recipientId);
  if (!recipientLocked) {
    inventorySystem.unlockTransaction(initiatorId);
    sendTradeErrorToBoth(world, session, "Trade failed - try again");
    tradingSystem.cancelTrade(tradeId, "server_error");
    return;
  }

  try {
    // Flush both inventories to DB
    await inventorySystem.persistInventoryImmediate(initiatorId);
    await inventorySystem.persistInventoryImmediate(recipientId);

    // Execute the atomic swap in a transaction
    const swapResult = await executeSecureTransaction(
      {
        playerId: initiatorId,
        socket: { id: "trade-swap" } as ServerSocket,
        world,
        db,
        sessionType: "trade" as import("@hyperforge/shared").SessionType,
      },
      {
        execute: async (tx): Promise<TradeSwapResult> => {
          // Get and lock current inventories using raw SQL
          const initiatorResult = await tx.execute(
            sql`SELECT * FROM inventory
                WHERE "playerId" = ${initiatorId}
                ORDER BY "slotIndex"
                FOR UPDATE`,
          );
          const recipientResult = await tx.execute(
            sql`SELECT * FROM inventory
                WHERE "playerId" = ${recipientId}
                ORDER BY "slotIndex"
                FOR UPDATE`,
          );

          const initiatorInventory =
            initiatorResult.rows as unknown as InventoryDBRow[];
          const recipientInventory =
            recipientResult.rows as unknown as InventoryDBRow[];

          // Validate all offered items still exist with correct quantities and are tradeable
          for (const offer of session.initiator.offeredItems) {
            const item = initiatorInventory.find(
              (i) => i.slotIndex === offer.inventorySlot,
            );
            if (
              !item ||
              item.itemId !== offer.itemId ||
              item.quantity < offer.quantity
            ) {
              throw new Error("ITEM_CHANGED");
            }

            const itemDef = getItem(offer.itemId);
            if (!itemDef || itemDef.tradeable === false) {
              throw new Error("UNTRADEABLE_ITEM");
            }
          }

          for (const offer of session.recipient.offeredItems) {
            const item = recipientInventory.find(
              (i) => i.slotIndex === offer.inventorySlot,
            );
            if (
              !item ||
              item.itemId !== offer.itemId ||
              item.quantity < offer.quantity
            ) {
              throw new Error("ITEM_CHANGED");
            }

            const itemDef = getItem(offer.itemId);
            if (!itemDef || itemDef.tradeable === false) {
              throw new Error("UNTRADEABLE_ITEM");
            }
          }

          // Calculate free slots for each player
          const initiatorUsedSlots = new Set<number>();
          for (const item of initiatorInventory) {
            initiatorUsedSlots.add(item.slotIndex);
          }
          const recipientUsedSlots = new Set<number>();
          for (const item of recipientInventory) {
            recipientUsedSlots.add(item.slotIndex);
          }

          // Slots being freed by offered items
          const initiatorOfferSlots = new Set<number>();
          for (const offer of session.initiator.offeredItems) {
            initiatorOfferSlots.add(offer.inventorySlot);
          }
          const recipientOfferSlots = new Set<number>();
          for (const offer of session.recipient.offeredItems) {
            recipientOfferSlots.add(offer.inventorySlot);
          }

          // Check space for incoming items
          const initiatorFreeSlots = countFreeSlots(
            initiatorUsedSlots,
            initiatorOfferSlots,
          );
          const recipientFreeSlots = countFreeSlots(
            recipientUsedSlots,
            recipientOfferSlots,
          );

          const recipientOfferCount = session.recipient.offeredItems.length;
          if (
            initiatorFreeSlots + initiatorOfferSlots.size <
            recipientOfferCount
          ) {
            throw new Error("INVENTORY_FULL_INITIATOR");
          }

          const initiatorOfferCount = session.initiator.offeredItems.length;
          if (
            recipientFreeSlots + recipientOfferSlots.size <
            initiatorOfferCount
          ) {
            throw new Error("INVENTORY_FULL_RECIPIENT");
          }

          // ===== EXECUTE THE SWAP =====

          // Track used slots for finding free slots during the swap
          const recipientTrackingSlots = new Set<number>();
          for (const slot of recipientUsedSlots) {
            recipientTrackingSlots.add(slot);
          }
          const initiatorTrackingSlots = new Set<number>();
          for (const slot of initiatorUsedSlots) {
            initiatorTrackingSlots.add(slot);
          }

          // ===== PHASE 1: Remove/reduce ALL offered items from BOTH players first =====

          // Remove initiator's offered items
          for (const offer of session.initiator.offeredItems) {
            const item = initiatorInventory.find(
              (i) => i.slotIndex === offer.inventorySlot,
            )!;
            if (item.quantity === offer.quantity) {
              await tx.execute(
                sql`DELETE FROM inventory
                    WHERE "playerId" = ${initiatorId}
                    AND "slotIndex" = ${offer.inventorySlot}`,
              );
              initiatorTrackingSlots.delete(offer.inventorySlot);
            } else {
              await tx.execute(
                sql`UPDATE inventory
                    SET quantity = ${item.quantity - offer.quantity}
                    WHERE "playerId" = ${initiatorId}
                    AND "slotIndex" = ${offer.inventorySlot}`,
              );
            }
          }

          // Remove recipient's offered items
          for (const offer of session.recipient.offeredItems) {
            const item = recipientInventory.find(
              (i) => i.slotIndex === offer.inventorySlot,
            )!;
            if (item.quantity === offer.quantity) {
              await tx.execute(
                sql`DELETE FROM inventory
                    WHERE "playerId" = ${recipientId}
                    AND "slotIndex" = ${offer.inventorySlot}`,
              );
              recipientTrackingSlots.delete(offer.inventorySlot);
            } else {
              await tx.execute(
                sql`UPDATE inventory
                    SET quantity = ${item.quantity - offer.quantity}
                    WHERE "playerId" = ${recipientId}
                    AND "slotIndex" = ${offer.inventorySlot}`,
              );
            }
          }

          // ===== PHASE 2: Add traded items to both players =====

          // Add initiator's items to recipient
          for (const offer of session.initiator.offeredItems) {
            const recipientSlot = findFreeSlotFromSet(
              recipientTrackingSlots,
              recipientOfferSlots,
            );
            await tx.execute(
              sql`INSERT INTO inventory ("playerId", "itemId", quantity, "slotIndex", metadata)
                  VALUES (${recipientId}, ${offer.itemId}, ${offer.quantity}, ${recipientSlot}, NULL)`,
            );
            recipientTrackingSlots.add(recipientSlot);
          }

          // Add recipient's items to initiator
          for (const offer of session.recipient.offeredItems) {
            const initiatorSlot = findFreeSlotFromSet(
              initiatorTrackingSlots,
              initiatorOfferSlots,
            );
            await tx.execute(
              sql`INSERT INTO inventory ("playerId", "itemId", quantity, "slotIndex", metadata)
                  VALUES (${initiatorId}, ${offer.itemId}, ${offer.quantity}, ${initiatorSlot}, NULL)`,
            );
            initiatorTrackingSlots.add(initiatorSlot);
          }

          return {
            initiatorReceived: session.recipient.offeredItems.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
            })),
            recipientReceived: session.initiator.offeredItems.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
            })),
          };
        },
        errorMessages: {
          ITEM_CHANGED: "Items changed during trade",
          INVENTORY_FULL_INITIATOR: "Your inventory is full",
          INVENTORY_FULL_RECIPIENT: "Partner's inventory is full",
          UNTRADEABLE_ITEM: "Trade contains untradeable items",
        },
      },
    );

    if (!swapResult) {
      tradingSystem.cancelTrade(tradeId, "invalid_items");
      return;
    }

    // Reload both inventories from DB
    await inventorySystem.reloadFromDatabase(initiatorId);
    await inventorySystem.reloadFromDatabase(recipientId);

    // Complete the trade in trading system
    tradingSystem.completeTrade(tradeId);

    // Send completion packets
    const initiatorSocket = getSocketByPlayerId(world, initiatorId);
    const recipientSocket = getSocketByPlayerId(world, recipientId);

    if (initiatorSocket) {
      sendToSocket(initiatorSocket, "tradeCompleted", {
        tradeId,
        receivedItems: swapResult.initiatorReceived,
      });
    }

    if (recipientSocket) {
      sendToSocket(recipientSocket, "tradeCompleted", {
        tradeId,
        receivedItems: swapResult.recipientReceived,
      });
    }

    // Send inventory updates directly to each player
    world.emit(EventType.INVENTORY_REQUEST, { playerId: initiatorId });
    world.emit(EventType.INVENTORY_REQUEST, { playerId: recipientId });
  } catch (error) {
    console.error("[TradeHandler] Unexpected error during trade swap:", error);
    sendTradeErrorToBoth(world, session, "Trade failed - please try again");
    tradingSystem.cancelTrade(tradeId, "server_error");
  } finally {
    inventorySystem.unlockTransaction(initiatorId);
    inventorySystem.unlockTransaction(recipientId);
  }
}
