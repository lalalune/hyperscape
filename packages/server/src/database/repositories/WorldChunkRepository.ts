/**
 * WorldChunkRepository - World chunk persistence operations
 *
 * Stores persistent modifications to terrain and entities in the world.
 * Each chunk is identified by its X,Z coordinates and contains serialized data.
 *
 * Responsibilities:
 * - Load/save chunk data (terrain modifications, resources, buildings)
 * - Track chunk activity and player counts
 * - Handle chunk resets
 * - Query inactive chunks for cleanup
 *
 * Used by: World system, terrain generation, entity spawning
 */

import { eq, and, sql } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";
import * as schema from "../schema";
import type { WorldChunkRow, ItemRow } from "../../shared/types";

/**
 * WorldChunkRepository class
 *
 * Provides all world chunk persistence operations.
 */
export class WorldChunkRepository extends BaseRepository {
  /**
   * Load world chunk data from database
   *
   * Retrieves persistent modifications for a specific chunk (resources, buildings, etc.).
   * Returns null if chunk has no persistent data (meaning it uses default generation).
   *
   * @param chunkX - Chunk X coordinate
   * @param chunkZ - Chunk Z coordinate
   * @returns Chunk data or null if not found
   */
  async getWorldChunkAsync(
    chunkX: number,
    chunkZ: number,
  ): Promise<WorldChunkRow | null> {
    this.ensureDatabase();

    const results = await this.db
      .select()
      .from(schema.worldChunks)
      .where(
        and(
          eq(schema.worldChunks.chunkX, chunkX),
          eq(schema.worldChunks.chunkZ, chunkZ),
        ),
      )
      .limit(1);

    if (results.length === 0) return null;

    return results[0] as WorldChunkRow;
  }

  /**
   * Save world chunk data to database
   *
   * Saves or updates persistent chunk data. Uses upsert (INSERT ... ON CONFLICT UPDATE)
   * to handle both new and existing chunks.
   *
   * @param chunkData - Chunk data to save (coordinates, serialized data, last active time)
   */
  async saveWorldChunkAsync(chunkData: {
    chunkX: number;
    chunkZ: number;
    data: string;
  }): Promise<void> {
    if (this.isDestroying) {
      // Gracefully skip during shutdown
      return;
    }

    this.ensureDatabase();

    await this.db
      .insert(schema.worldChunks)
      .values({
        chunkX: chunkData.chunkX,
        chunkZ: chunkData.chunkZ,
        data: chunkData.data,
        lastActive: Date.now(),
      })
      .onConflictDoUpdate({
        target: [schema.worldChunks.chunkX, schema.worldChunks.chunkZ],
        set: {
          data: chunkData.data,
          lastActive: Date.now(),
        },
      });
  }

  /**
   * Get world items for a chunk
   *
   * NOTE: Not yet implemented - placeholder for future item persistence.
   *
   * @param _chunkX - Chunk X coordinate
   * @param _chunkZ - Chunk Z coordinate
   * @returns Empty array (not yet implemented)
   */
  async getWorldItemsAsync(
    _chunkX: number,
    _chunkZ: number,
  ): Promise<ItemRow[]> {
    console.warn(
      "[WorldChunkRepository] getWorldItemsAsync not yet implemented",
    );
    return [];
  }

  /**
   * Save world items for a chunk
   *
   * NOTE: Not yet implemented - placeholder for future item persistence.
   *
   * @param _chunkX - Chunk X coordinate
   * @param _chunkZ - Chunk Z coordinate
   * @param _items - Items to save
   */
  async saveWorldItemsAsync(
    _chunkX: number,
    _chunkZ: number,
    _items: ItemRow[],
  ): Promise<void> {
    console.warn(
      "[WorldChunkRepository] saveWorldItemsAsync not yet implemented",
    );
  }

  /**
   * Get inactive chunks
   *
   * Retrieves chunks that haven't been accessed in the specified time period.
   * Used for chunk cleanup and unloading.
   *
   * @param minutes - Number of minutes of inactivity
   * @returns Array of inactive chunk records
   */
  async getInactiveChunksAsync(minutes: number): Promise<WorldChunkRow[]> {
    this.ensureDatabase();

    const cutoffTime = Date.now() - minutes * 60 * 1000;

    const results = await this.db
      .select()
      .from(schema.worldChunks)
      .where(sql`${schema.worldChunks.lastActive} < ${cutoffTime}`);

    return results as WorldChunkRow[];
  }

  /**
   * Update chunk player count
   *
   * Updates the number of players currently in a chunk.
   * Used for chunk activity tracking and resource management.
   *
   * @param chunkX - Chunk X coordinate
   * @param chunkZ - Chunk Z coordinate
   * @param playerCount - Number of players in chunk
   */
  async updateChunkPlayerCountAsync(
    chunkX: number,
    chunkZ: number,
    playerCount: number,
  ): Promise<void> {
    if (this.isDestroying) {
      // Gracefully skip during shutdown
      return;
    }

    this.ensureDatabase();

    await this.db
      .update(schema.worldChunks)
      .set({ playerCount })
      .where(
        and(
          eq(schema.worldChunks.chunkX, chunkX),
          eq(schema.worldChunks.chunkZ, chunkZ),
        ),
      );
  }

  /**
   * Mark chunk for reset
   *
   * Flags a chunk to be reset to default generation.
   * The chunk will be regenerated next time it's loaded.
   *
   * @param chunkX - Chunk X coordinate
   * @param chunkZ - Chunk Z coordinate
   */
  async markChunkForResetAsync(chunkX: number, chunkZ: number): Promise<void> {
    this.ensureDatabase();

    await this.db
      .update(schema.worldChunks)
      .set({ needsReset: 1 })
      .where(
        and(
          eq(schema.worldChunks.chunkX, chunkX),
          eq(schema.worldChunks.chunkZ, chunkZ),
        ),
      );
  }

  /**
   * Reset chunk
   *
   * Deletes chunk data to allow it to regenerate with default generation.
   * Called after a chunk is marked for reset.
   *
   * @param chunkX - Chunk X coordinate
   * @param chunkZ - Chunk Z coordinate
   */
  async resetChunkAsync(chunkX: number, chunkZ: number): Promise<void> {
    this.ensureDatabase();

    // Delete the chunk to allow it to regenerate
    await this.db
      .delete(schema.worldChunks)
      .where(
        and(
          eq(schema.worldChunks.chunkX, chunkX),
          eq(schema.worldChunks.chunkZ, chunkZ),
        ),
      );
  }
}
