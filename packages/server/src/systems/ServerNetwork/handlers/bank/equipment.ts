/**
 * Bank Equipment Handlers (RS3-style equipment tab)
 *
 * Handles withdraw-to-equipment, deposit-from-equipment operations.
 * These allow equipping/unequipping directly from bank without using inventory.
 */

import {
  type World,
  type EquipmentSystem,
  SessionType,
} from "@hyperscape/shared";
import type { ServerSocket } from "../../../../shared/types";
import * as schema from "../../../../database/schema";
import { sql } from "drizzle-orm";

import {
  isValidItemId,
  isValidBankTabIndex,
  isValidBankSlot,
} from "../../services";

import {
  validateTransactionRequest,
  executeSecureTransaction,
  sendToSocket,
  sendErrorToast,
} from "../common";

import {
  rateLimiter,
  isValidGameItem,
  compactBankSlots,
  sendBankStateWithTabs,
  MAX_BANK_SLOTS,
} from "./utils";

/**
 * Handle withdraw item directly to equipment
 *
 * RS3-style bank equipment tab feature:
 * - When "equipment" view is active, withdrawing equipable items goes directly to equipment slot
 * - Handles 2h weapon/shield conflicts
 * - Displaced items go to bank (not inventory)
 *
 * SECURITY MEASURES:
 * - validateTransactionRequest: player, rate limit, distance, db
 * - Input validation (itemId, tabIndex, slot)
 * - Equipment requirements validation via EquipmentSystem
 * - Atomic transaction with row-level locking
 */
export async function handleBankWithdrawToEquipment(
  socket: ServerSocket,
  data: { itemId: string; tabIndex: number; slot: number },
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

  // Step 2: Input validation
  if (!isValidItemId(data.itemId)) {
    sendErrorToast(socket, "Invalid item");
    return;
  }

  if (!isValidGameItem(data.itemId)) {
    sendErrorToast(socket, "This item no longer exists");
    return;
  }

  if (!isValidBankTabIndex(data.tabIndex)) {
    sendErrorToast(socket, "Invalid tab");
    return;
  }

  if (!isValidBankSlot(data.slot)) {
    sendErrorToast(socket, "Invalid slot");
    return;
  }

  // Step 3: Get EquipmentSystem and validate
  const equipmentSystem = world.getSystem("equipment");
  if (!equipmentSystem) {
    console.error("[BankEquipment] EquipmentSystem not found");
    sendErrorToast(socket, "Equipment system unavailable");
    return;
  }

  const equip = equipmentSystem as EquipmentSystem;

  // Check if item is equipable
  const targetSlot = equip.getEquipmentSlotForItem(data.itemId);
  if (!targetSlot) {
    sendErrorToast(socket, "This item cannot be equipped");
    return;
  }

  // Check level requirements
  if (!equip.canPlayerEquipItem(ctx.playerId, data.itemId)) {
    sendErrorToast(socket, "You don't meet the requirements for this item");
    return;
  }

  // Step 4: Execute transaction
  const result = await executeSecureTransaction(ctx, {
    errorMessages: {
      ITEM_NOT_IN_BANK: "Item not found in bank",
      INSUFFICIENT_QUANTITY: "Not enough items in bank",
      BANK_FULL: "Bank is full",
    },
    execute: async (tx) => {
      // Lock and find bank item
      const bankResult = await tx.execute(
        sql`SELECT * FROM bank_storage
            WHERE "playerId" = ${ctx.playerId}
              AND "itemId" = ${data.itemId}
              AND "tabIndex" = ${data.tabIndex}
              AND slot = ${data.slot}
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

      if (availableQty < 1) {
        throw new Error("INSUFFICIENT_QUANTITY");
      }

      // Equip the item (this will return any displaced items)
      const equipResult = await equip.equipItemDirect(
        ctx.playerId,
        data.itemId,
      );

      if (!equipResult.success) {
        throw new Error(equipResult.error || "EQUIP_FAILED");
      }

      // Remove one from bank
      const newBankQty = availableQty - 1;

      // Check if alwaysSetPlaceholder is enabled
      const settingResult = await tx.execute(
        sql`SELECT "alwaysSetPlaceholder" FROM characters WHERE id = ${ctx.playerId}`,
      );
      const alwaysSetPlaceholder =
        (settingResult.rows[0] as { alwaysSetPlaceholder: number } | undefined)
          ?.alwaysSetPlaceholder === 1;

      if (newBankQty <= 0) {
        if (alwaysSetPlaceholder) {
          // Keep as placeholder
          await tx.execute(
            sql`UPDATE bank_storage SET quantity = 0 WHERE id = ${bankRow.id}`,
          );
        } else {
          // Delete and compact
          await tx.execute(
            sql`DELETE FROM bank_storage WHERE id = ${bankRow.id}`,
          );
          await compactBankSlots(
            tx,
            ctx.playerId,
            bankRow.slot,
            bankRow.tabIndex,
          );
        }
      } else {
        await tx.execute(
          sql`UPDATE bank_storage SET quantity = ${newBankQty} WHERE id = ${bankRow.id}`,
        );
      }

      // Add displaced items back to bank
      for (const displaced of equipResult.displacedItems) {
        // Check if item already exists in bank
        const existingResult = await tx.execute(
          sql`SELECT id, quantity FROM bank_storage
              WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${displaced.itemId}
              FOR UPDATE`,
        );

        if (existingResult.rows.length > 0) {
          // Add to existing stack
          const existing = existingResult.rows[0] as {
            id: number;
            quantity: number;
          };
          await tx.execute(
            sql`UPDATE bank_storage
                SET quantity = quantity + ${displaced.quantity}
                WHERE id = ${existing.id}`,
          );
        } else {
          // Find next available slot in tab 0 (main tab)
          const slotsResult = await tx.execute(
            sql`SELECT slot FROM bank_storage
                WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = 0`,
          );
          const usedSlots = new Set(
            (slotsResult.rows as Array<{ slot: number }>).map((r) => r.slot),
          );
          let nextSlot = 0;
          while (usedSlots.has(nextSlot) && nextSlot < MAX_BANK_SLOTS) {
            nextSlot++;
          }

          if (nextSlot >= MAX_BANK_SLOTS) {
            throw new Error("BANK_FULL");
          }

          await tx.insert(schema.bankStorage).values({
            playerId: ctx.playerId,
            itemId: displaced.itemId,
            quantity: displaced.quantity,
            slot: nextSlot,
            tabIndex: 0,
          });
        }
      }

      return { equippedSlot: equipResult.equippedSlot };
    },
  });

  if (!result) return;

  // Step 5: Send updated bank state
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);

  // Step 6: Explicitly send equipment update to this socket
  // The equipItemDirect broadcasts to all, but we need to ensure THIS socket
  // receives the update for immediate UI refresh in bank equipment view
  const getEquipFn = (
    equipmentSystem as { getPlayerEquipment?: (id: string) => unknown }
  ).getPlayerEquipment;
  if (getEquipFn) {
    const equipmentData = getEquipFn.call(equipmentSystem, ctx.playerId);
    if (equipmentData) {
      sendToSocket(socket, "equipmentUpdated", {
        playerId: ctx.playerId,
        equipment: equipmentData,
      });
    }
  }

  sendToSocket(socket, "showToast", {
    message: `Equipped from bank`,
    type: "success",
  });
}

/**
 * Handle deposit single equipment slot to bank
 *
 * RS3-style bank equipment tab feature:
 * - Click on equipment slot in bank to deposit directly to bank
 * - Does not go through inventory
 *
 * SECURITY MEASURES:
 * - validateTransactionRequest: player, rate limit, distance, db
 * - Valid equipment slot validation
 * - Atomic transaction with row-level locking
 */
export async function handleBankDepositEquipment(
  socket: ServerSocket,
  data: { slot: string },
  world: World,
): Promise<void> {
  // Step 1: Common validation
  const baseResult = validateTransactionRequest(
    socket,
    world,
    SessionType.BANK,
    rateLimiter,
  );

  if (!baseResult.success) {
    return;
  }

  const ctx = baseResult.context;

  // Step 2: Input validation
  const validSlots = new Set([
    "weapon",
    "shield",
    "helmet",
    "body",
    "legs",
    "arrows",
  ]);
  if (!validSlots.has(data.slot)) {
    sendErrorToast(socket, "Invalid equipment slot");
    return;
  }

  // Step 3: Get EquipmentSystem
  const equipmentSystem = world.getSystem("equipment");
  if (!equipmentSystem) {
    console.error("[BankEquipment] EquipmentSystem not found");
    sendErrorToast(socket, "Equipment system unavailable");
    return;
  }

  const equip = equipmentSystem as EquipmentSystem;

  // Step 4: Execute transaction
  const result = await executeSecureTransaction(ctx, {
    errorMessages: {
      SLOT_EMPTY: "Nothing equipped in that slot",
      BANK_FULL: "Bank is full",
    },
    execute: async (tx) => {
      // Unequip the item (this returns the item ID)
      const unequipResult = await equip.unequipItemDirect(
        ctx.playerId,
        data.slot,
      );

      if (!unequipResult.success) {
        throw new Error(unequipResult.error || "SLOT_EMPTY");
      }

      const itemId = unequipResult.itemId;
      if (!itemId) {
        throw new Error("SLOT_EMPTY");
      }

      // Add to bank
      const existingResult = await tx.execute(
        sql`SELECT id, quantity FROM bank_storage
            WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${itemId}
            FOR UPDATE`,
      );

      if (existingResult.rows.length > 0) {
        // Add to existing stack
        const existing = existingResult.rows[0] as {
          id: number;
          quantity: number;
        };
        await tx.execute(
          sql`UPDATE bank_storage
              SET quantity = quantity + ${unequipResult.quantity}
              WHERE id = ${existing.id}`,
        );
      } else {
        // Find next available slot in tab 0
        const slotsResult = await tx.execute(
          sql`SELECT slot FROM bank_storage
              WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = 0`,
        );
        const usedSlots = new Set(
          (slotsResult.rows as Array<{ slot: number }>).map((r) => r.slot),
        );
        let nextSlot = 0;
        while (usedSlots.has(nextSlot) && nextSlot < MAX_BANK_SLOTS) {
          nextSlot++;
        }

        if (nextSlot >= MAX_BANK_SLOTS) {
          throw new Error("BANK_FULL");
        }

        await tx.insert(schema.bankStorage).values({
          playerId: ctx.playerId,
          itemId: itemId,
          quantity: unequipResult.quantity,
          slot: nextSlot,
          tabIndex: 0,
        });
      }

      return { depositedItemId: itemId };
    },
  });

  if (!result) return;

  // Step 5: Send updated bank state
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);

  // Step 6: Send equipment update to refresh bank equipment view
  const getEquipFn = (
    equipmentSystem as { getPlayerEquipment?: (id: string) => unknown }
  ).getPlayerEquipment;
  if (getEquipFn) {
    const equipmentData = getEquipFn.call(equipmentSystem, ctx.playerId);
    if (equipmentData) {
      sendToSocket(socket, "equipmentUpdated", {
        playerId: ctx.playerId,
        equipment: equipmentData,
      });
    }
  }

  sendToSocket(socket, "showToast", {
    message: `Deposited equipment to bank`,
    type: "success",
  });
}

/**
 * Handle deposit all worn equipment to bank
 *
 * RS3-style "Deposit Worn Items" button:
 * - One-click deposit all equipped items to bank
 * - Does not go through inventory
 *
 * SECURITY MEASURES:
 * - validateTransactionRequest: player, rate limit, distance, db
 * - Atomic transaction with row-level locking
 */
export async function handleBankDepositAllEquipment(
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

  if (!baseResult.success) {
    return;
  }

  const ctx = baseResult.context;

  // Step 2: Get EquipmentSystem
  const equipmentSystem = world.getSystem("equipment");
  if (!equipmentSystem) {
    console.error("[BankEquipment] EquipmentSystem not found");
    sendErrorToast(socket, "Equipment system unavailable");
    return;
  }

  const equip = equipmentSystem as EquipmentSystem;

  // Get all equipped items first
  const equippedItems = equip.getAllEquippedItems(ctx.playerId);

  if (equippedItems.length === 0) {
    sendToSocket(socket, "showToast", {
      message: "Nothing equipped to deposit",
      type: "info",
    });
    return;
  }

  // Step 3: Execute transaction
  const result = await executeSecureTransaction(ctx, {
    errorMessages: {
      BANK_FULL: "Bank is full",
    },
    execute: async (tx) => {
      const depositedItems: Array<{ slot: string; itemId: string }> = [];

      for (const item of equippedItems) {
        // Unequip the item
        const unequipResult = await equip.unequipItemDirect(
          ctx.playerId,
          item.slot,
        );

        if (!unequipResult.success || !unequipResult.itemId) {
          continue; // Skip failed unequips
        }

        const itemId = unequipResult.itemId;

        // Add to bank
        const existingResult = await tx.execute(
          sql`SELECT id, quantity FROM bank_storage
              WHERE "playerId" = ${ctx.playerId} AND "itemId" = ${itemId}
              FOR UPDATE`,
        );

        if (existingResult.rows.length > 0) {
          // Add to existing stack
          const existing = existingResult.rows[0] as {
            id: number;
            quantity: number;
          };
          await tx.execute(
            sql`UPDATE bank_storage
                SET quantity = quantity + ${unequipResult.quantity}
                WHERE id = ${existing.id}`,
          );
        } else {
          // Find next available slot in tab 0
          const slotsResult = await tx.execute(
            sql`SELECT slot FROM bank_storage
                WHERE "playerId" = ${ctx.playerId} AND "tabIndex" = 0`,
          );
          const usedSlots = new Set(
            (slotsResult.rows as Array<{ slot: number }>).map((r) => r.slot),
          );
          let nextSlot = 0;
          while (usedSlots.has(nextSlot) && nextSlot < MAX_BANK_SLOTS) {
            nextSlot++;
          }

          if (nextSlot >= MAX_BANK_SLOTS) {
            throw new Error("BANK_FULL");
          }

          await tx.insert(schema.bankStorage).values({
            playerId: ctx.playerId,
            itemId: itemId,
            quantity: unequipResult.quantity,
            slot: nextSlot,
            tabIndex: 0,
          });
        }

        depositedItems.push({ slot: item.slot, itemId });
      }

      return { depositedCount: depositedItems.length };
    },
  });

  if (!result) return;

  // Step 4: Send updated bank state
  await sendBankStateWithTabs(socket, ctx.playerId, ctx.db);

  // Step 5: Send equipment update to refresh bank equipment view
  const getEquipFn = (
    equipmentSystem as { getPlayerEquipment?: (id: string) => unknown }
  ).getPlayerEquipment;
  if (getEquipFn) {
    const equipmentData = getEquipFn.call(equipmentSystem, ctx.playerId);
    if (equipmentData) {
      sendToSocket(socket, "equipmentUpdated", {
        playerId: ctx.playerId,
        equipment: equipmentData,
      });
    }
  }

  sendToSocket(socket, "showToast", {
    message: `Deposited ${result.depositedCount} equipped item${result.depositedCount !== 1 ? "s" : ""} to bank`,
    type: "success",
  });
}
