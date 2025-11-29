/**
 * InventoryRepository - Player inventory management operations
 *
 * Handles player inventory storage with 28 slots (like RuneScape classic).
 * Each item has an ID, quantity, slot index, and optional metadata.
 *
 * Responsibilities:
 * - Load player inventory from database
 * - Save complete inventory state (atomic upsert)
 * - Handle item metadata (JSON serialization)
 *
 * Used by: Inventory system, item pickup/drop, trading
 */

import { eq, sql } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";
import * as schema from "../schema";
import type { InventoryRow, InventorySaveItem } from "../../shared/types";

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
   * Uses a two-phase approach to handle race conditions:
   * 1. Delete slots that are no longer occupied
   * 2. Upsert current items using raw SQL with ON CONFLICT
   *
   * This prevents duplicate key errors when concurrent saves occur.
   * Uses raw SQL for upsert because the unique index is a partial index
   * (inventory_player_slot_unique WHERE slotIndex >= 0).
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

    // Get the slots currently occupied (valid slots only)
    const validItems = items.filter((item) => (item.slotIndex ?? -1) >= 0);
    const occupiedSlots = validItems.map((item) => item.slotIndex!);

    await this.db.transaction(async (tx) => {
      // Step 1: Delete items in slots that are no longer occupied
      if (occupiedSlots.length > 0) {
        // Delete slots NOT in the current occupied list
        await tx.execute(
          sql`DELETE FROM inventory
              WHERE "playerId" = ${playerId}
              AND "slotIndex" >= 0
              AND "slotIndex" NOT IN (${sql.join(
                occupiedSlots.map((s) => sql`${s}`),
                sql`, `,
              )})`,
        );
      } else {
        // No items - delete all inventory for this player
        await tx
          .delete(schema.inventory)
          .where(eq(schema.inventory.playerId, playerId));
      }

      // Step 2: Upsert each item using raw SQL with ON CONFLICT
      // This handles both new items and quantity/metadata changes
      // Note: The unique index is a partial index (WHERE slotIndex >= 0),
      // so we specify the columns directly and let PostgreSQL match the index
      for (const item of validItems) {
        const slotIndex = item.slotIndex!;
        const metadata = item.metadata ? JSON.stringify(item.metadata) : null;

        await tx.execute(
          sql`INSERT INTO inventory ("playerId", "itemId", "quantity", "slotIndex", "metadata")
              VALUES (${playerId}, ${item.itemId}, ${item.quantity}, ${slotIndex}, ${metadata})
              ON CONFLICT ("playerId", "slotIndex") WHERE "slotIndex" >= 0
              DO UPDATE SET
                "itemId" = EXCLUDED."itemId",
                "quantity" = EXCLUDED."quantity",
                "metadata" = EXCLUDED."metadata"`,
        );
      }
    });
  }
}
