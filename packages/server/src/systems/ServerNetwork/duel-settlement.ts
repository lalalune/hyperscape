/**
 * Duel Stake Settlement
 *
 * Atomic, crash-safe transfer of staked items from loser to winner after a duel.
 * Uses a PostgreSQL transaction so either all items move or none do.
 *
 * Extracted from ServerNetwork to keep the main orchestrator lean.
 */

import { getItem, World, MAX_COINS } from "@hyperscape/shared";
import { InventoryRepository } from "../../database/repositories/InventoryRepository";
import type { ServerSocket } from "../../shared/types";

/** Minimal stake description used throughout the settlement flow */
export interface StakeItem {
  inventorySlot: number;
  itemId: string;
  quantity: number;
  value: number;
}

/** Accessor interface so settlement code can reach server state without depending on ServerNetwork */
export interface SettlementDeps {
  world: World;
  getSocketByPlayerId: (id: string) => ServerSocket | undefined;
}

// ============================================================================
// addStakedItemsToInventory  (legacy — single-player add; kept for fallback)
// ============================================================================

/**
 * Add staked items to a player's inventory.
 * Uses database directly to ensure items are properly persisted.
 */
export async function addStakedItemsToInventory(
  deps: SettlementDeps,
  playerId: string,
  stakes: StakeItem[],
  reason: "return" | "award",
): Promise<void> {
  const serverWorld = deps.world as {
    pgPool?: import("pg").Pool;
    drizzleDb?: import("drizzle-orm/node-postgres").NodePgDatabase<
      typeof import("../../database/schema")
    >;
  };

  if (!serverWorld.drizzleDb || !serverWorld.pgPool) {
    console.error("[Duel] Database not available for stake transfer");
    return;
  }

  const db = {
    drizzle: serverWorld.drizzleDb,
    pool: serverWorld.pgPool,
  };

  try {
    const inventorySystem = deps.world.getSystem("inventory") as
      | {
          lockForTransaction: (id: string) => boolean;
          unlockTransaction: (id: string) => void;
          reloadFromDatabase: (id: string) => Promise<void>;
        }
      | undefined;

    const locked = inventorySystem?.lockForTransaction?.(playerId) ?? true;
    if (!locked) {
      console.warn(
        `[Duel] Could not lock inventory for ${playerId}, retrying...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    try {
      const inventoryRepo = new InventoryRepository(db.drizzle, db.pool);
      const currentInventory =
        await inventoryRepo.getPlayerInventoryAsync(playerId);
      const usedSlots = new Set(currentInventory.map((item) => item.slotIndex));

      const findFreeSlot = (): number => {
        for (let i = 0; i < 28; i++) {
          if (!usedSlots.has(i)) {
            usedSlots.add(i);
            return i;
          }
        }
        return -1;
      };

      for (const stake of stakes) {
        const freeSlot = findFreeSlot();
        if (freeSlot === -1) {
          console.warn(
            `[Duel] No free slot for stake item ${stake.itemId} x${stake.quantity} for ${playerId}`,
          );
          continue;
        }

        const existingItem = currentInventory.find(
          (item) => item.itemId === stake.itemId,
        );
        const itemData = getItem(stake.itemId);
        const isStackable = itemData?.stackable ?? false;

        if (isStackable && existingItem) {
          await db.pool.query(
            `UPDATE inventory
             SET quantity = quantity + $1
             WHERE "playerId" = $2 AND "slotIndex" = $3`,
            [stake.quantity, playerId, existingItem.slotIndex],
          );
          console.log(
            `[Duel] Added ${stake.quantity} ${stake.itemId} to existing stack for ${playerId} (${reason})`,
          );
        } else {
          await db.pool.query(
            `INSERT INTO inventory ("playerId", "itemId", quantity, "slotIndex", metadata)
             VALUES ($1, $2, $3, $4, NULL)`,
            [playerId, stake.itemId, stake.quantity, freeSlot],
          );
          console.log(
            `[Duel] Added ${stake.itemId} x${stake.quantity} to slot ${freeSlot} for ${playerId} (${reason})`,
          );
        }
      }

      if (inventorySystem?.reloadFromDatabase) {
        await inventorySystem.reloadFromDatabase(playerId);
      }
    } finally {
      inventorySystem?.unlockTransaction?.(playerId);
    }
  } catch (error) {
    console.error(
      `[Duel] Error adding staked items to inventory for ${playerId}:`,
      error,
    );
  }
}

// ============================================================================
// executeDuelStakeTransferWithRetry
// ============================================================================

/**
 * Retry wrapper for executeDuelStakeTransfer.
 * Retries up to 3 times with exponential backoff [0, 1000, 3000]ms.
 */
export async function executeDuelStakeTransferWithRetry(
  deps: SettlementDeps,
  winnerId: string,
  loserId: string,
  stakes: StakeItem[],
  duelId?: string,
): Promise<void> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [0, 1000, 3000];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(
          `[Duel] Settlement retry attempt ${attempt + 1}/${MAX_RETRIES} for ${winnerId} <- ${loserId}`,
        );
      }
      await executeDuelStakeTransfer(deps, winnerId, loserId, stakes, duelId);
      console.log(
        `[Duel] Settlement successful: duel=${duelId} winner=${winnerId} loser=${loserId} stakes=${stakes.length}`,
      );
      return;
    } catch (err) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (isLastAttempt) {
        console.error(
          `[Duel] CRITICAL: Settlement failed after ${MAX_RETRIES} attempts. ` +
            `Items remain with loser (crash-safe). winnerId=${winnerId}, loserId=${loserId}`,
          err,
        );
        const winnerSocket = deps.getSocketByPlayerId(winnerId);
        const loserSocket = deps.getSocketByPlayerId(loserId);
        if (winnerSocket) {
          winnerSocket.send("chatAdded", {
            id: `duel-settle-fail-${Date.now()}`,
            from: "",
            body: "Duel stake transfer failed. Please contact support if items are missing.",
            createdAt: new Date().toISOString(),
            type: "system",
          });
        }
        if (loserSocket) {
          loserSocket.send("chatAdded", {
            id: `duel-settle-fail-${Date.now()}`,
            from: "",
            body: "Duel stake transfer failed. Your items were not taken.",
            createdAt: new Date().toISOString(),
            type: "system",
          });
        }
        throw err;
      }

      console.warn(
        `[Duel] Settlement attempt ${attempt + 1} failed, retrying in ${RETRY_DELAYS[attempt + 1]}ms:`,
        err instanceof Error ? err.message : err,
      );

      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS[attempt + 1]),
      );
    }
  }
}

// ============================================================================
// executeDuelStakeTransfer (core transactional logic)
// ============================================================================

/**
 * Execute atomic duel stake transfer from loser to winner.
 *
 * CRASH-SAFE: Items remain in loser's inventory until this atomic transaction.
 *
 * Transaction:
 * 1. Validate items still exist in loser's inventory
 * 2. Remove items from loser's inventory
 * 3. Add items to winner's inventory
 * 4. Reload both inventories from DB
 */
async function executeDuelStakeTransfer(
  deps: SettlementDeps,
  winnerId: string,
  loserId: string,
  stakes: StakeItem[],
  duelId?: string,
): Promise<void> {
  const serverWorld = deps.world as {
    pgPool?: import("pg").Pool;
    drizzleDb?: import("drizzle-orm/node-postgres").NodePgDatabase<
      typeof import("../../database/schema")
    >;
  };

  if (!serverWorld.drizzleDb || !serverWorld.pgPool) {
    console.error("[Duel] Database not available for stake transfer");
    return;
  }

  const pool = serverWorld.pgPool;

  const inventorySystem = deps.world.getSystem("inventory") as
    | {
        lockForTransaction: (id: string) => boolean;
        unlockTransaction: (id: string) => void;
        reloadFromDatabase: (id: string) => Promise<void>;
      }
    | undefined;

  const winnerLocked = inventorySystem?.lockForTransaction?.(winnerId) ?? true;
  const loserLocked = inventorySystem?.lockForTransaction?.(loserId) ?? true;

  if (!winnerLocked || !loserLocked) {
    console.warn(
      `[Duel] Could not lock inventories for transfer (winner: ${winnerLocked}, loser: ${loserLocked})`,
    );
    if (winnerLocked) inventorySystem?.unlockTransaction?.(winnerId);
    if (loserLocked) inventorySystem?.unlockTransaction?.(loserId);
    return;
  }

  try {
    const DEADLOCK_MAX_RETRIES = 3;
    const DEADLOCK_DELAYS = [50, 100, 200];

    for (
      let deadlockAttempt = 0;
      deadlockAttempt < DEADLOCK_MAX_RETRIES;
      deadlockAttempt++
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // DB-persisted idempotency guard — duelId is required
        if (!duelId) {
          console.error(
            `[Duel] SECURITY: settlement called without duelId for winner=${winnerId} loser=${loserId} — aborting to prevent duplicate transfers`,
          );
          await client.query("ROLLBACK");
          return;
        }
        const existingSettlement = await client.query(
          `SELECT 1 FROM duel_settlements WHERE "duelId" = $1`,
          [duelId],
        );
        if (existingSettlement.rows.length > 0) {
          console.warn(
            `[Duel] SECURITY: DB idempotency guard blocked duplicate settlement for ${duelId}`,
          );
          await client.query("ROLLBACK");
          return;
        }
        await client.query(
          `INSERT INTO duel_settlements ("duelId", "winnerId", "loserId", "settledAt", "stakesTransferred")
           VALUES ($1, $2, $3, $4, $5)`,
          [duelId, winnerId, loserId, Date.now(), stakes.length],
        );

        // Get winner's current inventory to find free slots
        const winnerInvResult = await client.query(
          `SELECT "slotIndex" FROM inventory WHERE "playerId" = $1`,
          [winnerId],
        );
        const usedSlots = new Set(
          winnerInvResult.rows.map((r: { slotIndex: number }) => r.slotIndex),
        );

        const findFreeSlot = (): number => {
          for (let i = 0; i < 28; i++) {
            if (!usedSlots.has(i)) {
              usedSlots.add(i);
              return i;
            }
          }
          return -1;
        };

        for (const stake of stakes) {
          // 1. Validate item exists in loser's inventory at exact slot
          const validateResult = await client.query(
            `SELECT "itemId", quantity FROM inventory
           WHERE "playerId" = $1 AND "slotIndex" = $2
           FOR UPDATE`,
            [loserId, stake.inventorySlot],
          );

          if (validateResult.rows.length === 0) {
            console.error(
              `[Duel] SECURITY: Staked item not found in loser inventory! ` +
                `loserId=${loserId}, slot=${stake.inventorySlot}, itemId=${stake.itemId}`,
            );
            continue;
          }

          const dbItem = validateResult.rows[0] as {
            itemId: string;
            quantity: number;
          };

          if (dbItem.itemId !== stake.itemId) {
            console.error(
              `[Duel] SECURITY: Item ID mismatch! ` +
                `Expected ${stake.itemId}, found ${dbItem.itemId} at slot ${stake.inventorySlot}`,
            );
            continue;
          }

          const transferQuantity = Math.min(stake.quantity, dbItem.quantity);
          if (transferQuantity <= 0) {
            console.warn(
              `[Duel] SECURITY: Staked item quantity is 0 — skipping. ` +
                `loserId=${loserId}, slot=${stake.inventorySlot}, itemId=${stake.itemId}`,
            );
            continue;
          }

          // 2. Remove from loser's inventory
          if (dbItem.quantity <= transferQuantity) {
            await client.query(
              `DELETE FROM inventory WHERE "playerId" = $1 AND "slotIndex" = $2`,
              [loserId, stake.inventorySlot],
            );
          } else {
            await client.query(
              `UPDATE inventory SET quantity = quantity - $1
             WHERE "playerId" = $2 AND "slotIndex" = $3`,
              [transferQuantity, loserId, stake.inventorySlot],
            );
          }

          // 3. Add to winner's inventory
          const itemData = getItem(stake.itemId);
          const isStackable = itemData?.stackable ?? false;

          if (isStackable) {
            const existingResult = await client.query(
              `SELECT "slotIndex", quantity FROM inventory
             WHERE "playerId" = $1 AND "itemId" = $2
             FOR UPDATE`,
              [winnerId, stake.itemId],
            );

            if (existingResult.rows.length > 0) {
              const existingRow = existingResult.rows[0] as {
                slotIndex: number;
                quantity: number;
              };
              const existingSlot = existingRow.slotIndex;
              const existingQty = existingRow.quantity;
              if (existingQty > MAX_COINS - transferQuantity) {
                console.error(
                  `[Duel] SECURITY: Stack merge would overflow! ` +
                    `winnerId=${winnerId}, itemId=${stake.itemId}, ` +
                    `existing=${existingQty}, adding=${transferQuantity}`,
                );
                continue;
              }
              await client.query(
                `UPDATE inventory SET quantity = quantity + $1
               WHERE "playerId" = $2 AND "slotIndex" = $3`,
                [transferQuantity, winnerId, existingSlot],
              );
              console.log(
                `[Duel] Transferred ${transferQuantity} ${stake.itemId} from ${loserId} to ${winnerId} (stacked)`,
              );
              continue;
            }
          }

          const freeSlot = findFreeSlot();
          if (freeSlot === -1) {
            // Inventory full - send to bank
            console.log(
              `[Duel] Winner inventory full, sending ${stake.itemId} x${transferQuantity} to bank`,
            );

            const bankResult = await client.query(
              `SELECT id, quantity FROM bank_storage
             WHERE "playerId" = $1 AND "itemId" = $2
             FOR UPDATE`,
              [winnerId, stake.itemId],
            );

            if (bankResult.rows.length > 0) {
              const bankRow = bankResult.rows[0] as {
                id: string;
                quantity: number;
              };
              if (bankRow.quantity > MAX_COINS - transferQuantity) {
                console.error(
                  `[Duel] SECURITY: Bank stack merge would overflow! ` +
                    `winnerId=${winnerId}, itemId=${stake.itemId}, ` +
                    `existing=${bankRow.quantity}, adding=${transferQuantity}`,
                );
                continue;
              }
              await client.query(
                `UPDATE bank_storage SET quantity = quantity + $1 WHERE id = $2`,
                [transferQuantity, bankRow.id],
              );
            } else {
              const maxSlotResult = await client.query(
                `SELECT COALESCE(MAX(slot), -1) + 1 as next_slot FROM bank_storage
               WHERE "playerId" = $1 AND "tabIndex" = 0`,
                [winnerId],
              );
              const nextSlot = (maxSlotResult.rows[0] as { next_slot: number })
                .next_slot;

              await client.query(
                `INSERT INTO bank_storage ("playerId", "itemId", quantity, slot, "tabIndex")
               VALUES ($1, $2, $3, $4, 0)`,
                [winnerId, stake.itemId, transferQuantity, nextSlot],
              );
            }
            console.log(
              `[Duel] Sent ${stake.itemId} x${transferQuantity} to ${winnerId}'s bank`,
            );
            continue;
          }

          await client.query(
            `INSERT INTO inventory ("playerId", "itemId", quantity, "slotIndex", metadata)
           VALUES ($1, $2, $3, $4, NULL)`,
            [winnerId, stake.itemId, transferQuantity, freeSlot],
          );
          console.log(
            `[Duel] Transferred ${stake.itemId} x${transferQuantity} from ${loserId} to ${winnerId} slot ${freeSlot}`,
          );
        }

        // Commit
        await client.query("COMMIT");
        console.log(
          `[Duel] Stake transfer complete: ${stakes.length} items from ${loserId} to ${winnerId}`,
        );

        // Reload both inventories
        if (inventorySystem?.reloadFromDatabase) {
          await inventorySystem.reloadFromDatabase(winnerId);
          await inventorySystem.reloadFromDatabase(loserId);
        }

        // Notify both players
        const winnerSocket = deps.getSocketByPlayerId(winnerId);
        const loserSocket = deps.getSocketByPlayerId(loserId);
        if (winnerSocket) {
          winnerSocket.send("chatAdded", {
            id: `duel-win-${Date.now()}`,
            from: "",
            body: `You received your opponent's stakes (${stakes.length} item${stakes.length !== 1 ? "s" : ""}).`,
            createdAt: new Date().toISOString(),
            type: "system",
          });
        }
        if (loserSocket) {
          loserSocket.send("chatAdded", {
            id: `duel-loss-${Date.now()}`,
            from: "",
            body: "Your staked items have been transferred to the winner.",
            createdAt: new Date().toISOString(),
            type: "system",
          });
        }
        return; // Success
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (_rollbackErr) {
          // Rollback failed — connection may be broken
        }

        const errorMsg = error instanceof Error ? error.message : String(error);
        const isDeadlock =
          errorMsg.includes("deadlock") ||
          errorMsg.includes("40P01") ||
          errorMsg.includes("could not serialize") ||
          errorMsg.includes("40001");

        if (isDeadlock && deadlockAttempt < DEADLOCK_MAX_RETRIES - 1) {
          const delay = DEADLOCK_DELAYS[deadlockAttempt];
          console.warn(
            `[Duel] Deadlock detected in stake transfer, retrying in ${delay}ms ` +
              `(attempt ${deadlockAttempt + 1}/${DEADLOCK_MAX_RETRIES})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error("[Duel] Stake transfer transaction failed:", error);

    const winnerSocket = deps.getSocketByPlayerId(winnerId);
    const loserSocket = deps.getSocketByPlayerId(loserId);

    if (winnerSocket) {
      winnerSocket.send("chatAdded", {
        id: `duel-error-${Date.now()}`,
        from: "",
        body: "Failed to transfer duel stakes. Items remain with original owners.",
        createdAt: new Date().toISOString(),
        type: "system",
      });
    }
    if (loserSocket) {
      loserSocket.send("chatAdded", {
        id: `duel-error-${Date.now()}`,
        from: "",
        body: "Failed to transfer duel stakes. Your items were not taken.",
        createdAt: new Date().toISOString(),
        type: "system",
      });
    }
  } finally {
    inventorySystem?.unlockTransaction?.(winnerId);
    inventorySystem?.unlockTransaction?.(loserId);
  }
}
