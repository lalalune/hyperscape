/**
 * BankRepository - Player bank storage operations
 *
 * Handles player bank storage with 480 slots (12 tabs × 40 slots).
 * All items stack in bank for MVP simplification.
 *
 * Responsibilities:
 * - Load player bank from database
 * - Save complete bank state (atomic replace)
 * - Deposit items (with stacking)
 * - Withdraw items
 *
 * Used by: Banking system, bank UI interactions
 */

import { eq, and } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";
import * as schema from "../schema";

/**
 * Bank item representation
 */
export interface BankItem {
  itemId: string;
  quantity: number;
  slot: number;
}

/**
 * BankRepository class
 *
 * Provides all bank storage management operations.
 */
export class BankRepository extends BaseRepository {
  private readonly MAX_BANK_SLOTS = 480;

  /**
   * Load player bank from database
   *
   * Retrieves all items in a player's bank, ordered by slot.
   *
   * @param playerId - The player ID to fetch bank for
   * @returns Array of bank items
   */
  async getPlayerBank(playerId: string): Promise<BankItem[]> {
    this.ensureDatabase();

    const results = await this.db
      .select()
      .from(schema.bankStorage)
      .where(eq(schema.bankStorage.playerId, playerId))
      .orderBy(schema.bankStorage.slot);

    return results.map((row) => ({
      itemId: row.itemId,
      quantity: row.quantity ?? 1,
      slot: row.slot ?? 0,
    }));
  }

  /**
   * Save player bank to database
   *
   * Performs an atomic replace of the entire bank using a transaction.
   *
   * @param playerId - The player ID to save bank for
   * @param items - Complete bank state to save
   */
  async savePlayerBank(playerId: string, items: BankItem[]): Promise<void> {
    if (this.isDestroying) {
      return;
    }

    this.ensureDatabase();

    await this.db.transaction(async (tx) => {
      // Delete existing bank items
      await tx
        .delete(schema.bankStorage)
        .where(eq(schema.bankStorage.playerId, playerId));

      // Insert new items
      if (items.length > 0) {
        await tx.insert(schema.bankStorage).values(
          items.map((item) => ({
            playerId,
            itemId: item.itemId,
            quantity: item.quantity,
            slot: item.slot,
          })),
        );
      }
    });
  }

  /**
   * Deposit item to bank
   *
   * If item already exists in bank, stacks with existing.
   * Otherwise finds next available slot.
   * Uses transaction with retry logic for slot conflicts.
   *
   * @param playerId - The player ID
   * @param itemId - Item to deposit
   * @param quantity - Amount to deposit
   * @returns Success status and slot number
   */
  async depositItem(
    playerId: string,
    itemId: string,
    quantity: number,
  ): Promise<{ success: boolean; slot: number }> {
    this.ensureDatabase();

    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.db.transaction(async (tx) => {
          // Check if item already exists in bank (for stacking)
          const existing = await tx
            .select()
            .from(schema.bankStorage)
            .where(
              and(
                eq(schema.bankStorage.playerId, playerId),
                eq(schema.bankStorage.itemId, itemId),
              ),
            );

          if (existing.length > 0) {
            // Stack with existing
            const row = existing[0];
            await tx
              .update(schema.bankStorage)
              .set({ quantity: (row.quantity ?? 0) + quantity })
              .where(eq(schema.bankStorage.id, row.id));
            return { success: true, slot: row.slot ?? 0 };
          }

          // Find next available slot - get all items in transaction
          const allItems = await tx
            .select()
            .from(schema.bankStorage)
            .where(eq(schema.bankStorage.playerId, playerId))
            .orderBy(schema.bankStorage.slot);

          const usedSlots = new Set(allItems.map((i) => i.slot ?? 0));
          let nextSlot = 0;
          while (usedSlots.has(nextSlot) && nextSlot < this.MAX_BANK_SLOTS) {
            nextSlot++;
          }

          if (nextSlot >= this.MAX_BANK_SLOTS) {
            return { success: false, slot: -1 };
          }

          await tx.insert(schema.bankStorage).values({
            playerId,
            itemId,
            quantity,
            slot: nextSlot,
          });

          return { success: true, slot: nextSlot };
        });
      } catch (error) {
        const isConflict =
          error instanceof Error && error.message.includes("unique constraint");

        if (isConflict && attempt < maxRetries - 1) {
          // Retry on conflict
          continue;
        }
        throw error;
      }
    }

    return { success: false, slot: -1 };
  }

  /**
   * Withdraw item from bank
   *
   * Reduces quantity or removes item entirely.
   *
   * @param playerId - The player ID
   * @param itemId - Item to withdraw
   * @param quantity - Amount to withdraw
   * @returns Success status
   */
  async withdrawItem(
    playerId: string,
    itemId: string,
    quantity: number,
  ): Promise<boolean> {
    this.ensureDatabase();

    const existing = await this.db
      .select()
      .from(schema.bankStorage)
      .where(
        and(
          eq(schema.bankStorage.playerId, playerId),
          eq(schema.bankStorage.itemId, itemId),
        ),
      );

    if (existing.length === 0) {
      return false;
    }

    const row = existing[0];
    const currentQty = row.quantity ?? 0;

    if (currentQty < quantity) {
      return false;
    }

    if (currentQty === quantity) {
      // Remove entirely
      await this.db
        .delete(schema.bankStorage)
        .where(eq(schema.bankStorage.id, row.id));
    } else {
      // Reduce quantity
      await this.db
        .update(schema.bankStorage)
        .set({ quantity: currentQty - quantity })
        .where(eq(schema.bankStorage.id, row.id));
    }

    return true;
  }

  /**
   * Get count of items in bank
   *
   * @param playerId - The player ID
   * @returns Number of unique item stacks in bank
   */
  async getBankSlotCount(playerId: string): Promise<number> {
    this.ensureDatabase();

    const items = await this.getPlayerBank(playerId);
    return items.length;
  }

  /**
   * Check if bank has space
   *
   * @param playerId - The player ID
   * @returns True if bank has at least one free slot
   */
  async hasBankSpace(playerId: string): Promise<boolean> {
    const count = await this.getBankSlotCount(playerId);
    return count < this.MAX_BANK_SLOTS;
  }
}
