/**
 * NPCKillRepository - NPC kill tracking operations
 *
 * Tracks player kill statistics for achievements, quests, and analytics.
 * Each row stores the number of times a player has killed a specific NPC type.
 *
 * Responsibilities:
 * - Increment kill counts atomically
 * - Query player kill statistics
 * - Get kill counts for specific NPC types
 *
 * Used by: KillTrackerSystem, quest systems, achievement systems
 */

import { eq, and, sql } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";
import * as schema from "../schema";

/**
 * NPCKillRepository class
 *
 * Provides all NPC kill tracking operations.
 */
export class NPCKillRepository extends BaseRepository {
  /**
   * Increment NPC kill count for a player
   *
   * Increments the kill count for a specific NPC type. If this is the player's
   * first kill of this NPC type, creates a new row with killCount=1.
   * Uses PostgreSQL's ON CONFLICT to atomically increment or insert.
   *
   * @param playerId - The player ID who killed the NPC
   * @param npcId - The NPC type identifier (e.g., "goblin", "dragon")
   */
  async incrementNPCKillAsync(playerId: string, npcId: string): Promise<void> {
    if (this.isDestroying) {
      return;
    }

    this.ensureDatabase();

    await this.db
      .insert(schema.npcKills)
      .values({
        playerId,
        npcId,
        killCount: 1,
      })
      .onConflictDoUpdate({
        target: [schema.npcKills.playerId, schema.npcKills.npcId],
        set: {
          killCount: sql`${schema.npcKills.killCount} + 1`,
        },
      });
  }

  /**
   * Get all NPC kill statistics for a player
   *
   * Retrieves the complete kill count for all NPC types this player has killed.
   * Returns empty array if player has no kills recorded.
   *
   * @param playerId - The player ID to fetch kill stats for
   * @returns Array of NPC kill records
   */
  async getPlayerNPCKillsAsync(
    playerId: string,
  ): Promise<Array<{ npcId: string; killCount: number }>> {
    this.ensureDatabase();

    const results = await this.db
      .select({
        npcId: schema.npcKills.npcId,
        killCount: schema.npcKills.killCount,
      })
      .from(schema.npcKills)
      .where(eq(schema.npcKills.playerId, playerId));

    return results;
  }

  /**
   * Get kill count for a specific NPC type
   *
   * Returns how many times the player has killed this specific NPC type.
   * Returns 0 if the player has never killed this NPC type.
   *
   * @param playerId - The player ID to check
   * @param npcId - The NPC type identifier
   * @returns Number of times this player has killed this NPC type
   */
  async getNPCKillCountAsync(playerId: string, npcId: string): Promise<number> {
    this.ensureDatabase();

    const results = await this.db
      .select({ killCount: schema.npcKills.killCount })
      .from(schema.npcKills)
      .where(
        and(
          eq(schema.npcKills.playerId, playerId),
          eq(schema.npcKills.npcId, npcId),
        ),
      )
      .limit(1);

    return results.length > 0 ? results[0].killCount : 0;
  }
}
