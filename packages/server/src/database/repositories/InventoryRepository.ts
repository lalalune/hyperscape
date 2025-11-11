/**
 * InventoryRepository - Player inventory management operations
 *
 * Handles player inventory storage with 28 slots (like RuneScape classic).
 * Each item has an ID, quantity, slot index, and optional metadata.
 *
 * Responsibilities:
 * - Load player inventory from database
 * - Save complete inventory state (atomic replace)
 * - Handle item metadata (JSON serialization)
 *
 * Used by: Inventory system, item pickup/drop, trading
 */

import { eq } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";
import * as schema from "../schema";
import type { InventoryRow, InventorySaveItem } from "../../types";

/**
 * InventoryRepository class
 *
 * Provides all inventory management operations.
 */
export class InventoryRepository extends BaseRepository {
  /**
   * Load player inventory from database
   *
   * Retrieves all items in a player's inventory, ordered by slot index.
   * Metadata is automatically parsed from JSON string to object.
   *
   * @param playerId - The player ID to fetch inventory for
   * @returns Array of inventory items
   */
  async getPlayerInventoryAsync(playerId: string): Promise<InventoryRow[]> {
    this.ensureDatabase();

    const results = await this.db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.playerId, playerId))
      .orderBy(schema.inventory.slotIndex);

    return results.map((row) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    })) as InventoryRow[];
  }

  /**
   * Save player inventory to database
   *
   * Performs an atomic replace of the entire inventory using a transaction.
   * This prevents data loss on hot reload/crash.
   *
   * @param playerId - The player ID to save inventory for
   * @param items - Complete inventory state to save
   */
  async savePlayerInventoryAsync(
    playerId: string,
    items: InventorySaveItem[],
  ): Promise<void> {
    if (this.isDestroying) {
      // Gracefully skip during shutdown
      return;
    }

    this.ensureDatabase();

    // Perform atomic replace using a transaction to avoid data loss on hot reload/crash
    await this.db.transaction(async (tx) => {
      // Delete existing inventory
      await tx
        .delete(schema.inventory)
        .where(eq(schema.inventory.playerId, playerId));
      // Insert new items
      if (items.length > 0) {
        await tx.insert(schema.inventory).values(
          items.map((item) => ({
            playerId,
            itemId: item.itemId,
            quantity: item.quantity,
            slotIndex: item.slotIndex ?? -1,
            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
          })),
        );
      }
    });
  }
}
