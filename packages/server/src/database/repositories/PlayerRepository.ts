/**
 * PlayerRepository - Player data persistence operations
 *
 * Handles all player-related database operations including stats, levels, XP,
 * health, coins, and position. This is the core persistence for character progression.
 *
 * Responsibilities:
 * - Load player data from database
 * - Save/update player data (partial updates supported)
 * - Handle skill levels and XP
 * - Persist player position and health
 *
 * Used by: ServerNetwork, game systems that modify player state
 */

import { eq, sql } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";
import * as schema from "../schema";
import type { PlayerPersistenceUpdate, PlayerRow } from "../../shared/types";
import { assertGenericPlayerUpdateExcludesPrayerAuthority } from "../prayer-custody-policy";

/**
 * PlayerRepository class
 *
 * Provides all player data persistence operations.
 */
export class PlayerRepository extends BaseRepository {
  /**
   * Load player data from database
   *
   * Retrieves all persistent data for a player including stats, levels, position,
   * and currency. Returns null if the player doesn't exist in the database yet.
   * Includes automatic retry for transient connection failures.
   *
   * @param playerId - The character/player ID to load
   * @returns Player data or null if not found
   */
  async getPlayerAsync(playerId: string): Promise<PlayerRow | null> {
    this.ensureDatabase();

    return this.withRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.characters)
        .where(eq(schema.characters.id, playerId))
        .limit(1);

      if (results.length === 0) return null;

      const row = results[0];
      return {
        ...row,
        playerId: row.id,
        createdAt: row.createdAt || Date.now(),
        lastLogin: row.lastLogin || Date.now(),
      } as PlayerRow;
    }, `getPlayer(${playerId})`);
  }

  /**
   * Save player data to database
   *
   * Updates existing player data ONLY. Does NOT create new characters.
   * Characters must be created explicitly via CharacterRepository.createCharacter().
   * Only the fields provided in the data parameter are updated; others remain unchanged.
   * This allows for partial updates (e.g., just updating health without touching XP).
   *
   * @param playerId - The character/player ID to save
   * @param data - Partial player data to save (only provided fields are updated)
   */
  /**
   * Build the Drizzle update object from a partial PlayerRow.
   * Maps only the fields that were actually provided in the data param.
   * Shared by savePlayerAsync and batchSavePlayersAsync.
   */
  private buildUpdateData(
    data: PlayerPersistenceUpdate,
  ): Partial<Omit<typeof schema.characters.$inferInsert, "id" | "accountId">> {
    assertGenericPlayerUpdateExcludesPrayerAuthority(
      data,
      "PlayerRepository.buildUpdateData",
    );
    type CharacterUpdate = Partial<
      Omit<typeof schema.characters.$inferInsert, "id" | "accountId">
    >;

    const u: CharacterUpdate = {};

    // Name — only update if explicitly provided and non-empty
    if (data.name && data.name.trim().length > 0) u.name = data.name;
    // Levels
    if (data.combatLevel !== undefined) u.combatLevel = data.combatLevel;
    if (data.attackLevel !== undefined) u.attackLevel = data.attackLevel;
    if (data.strengthLevel !== undefined) u.strengthLevel = data.strengthLevel;
    if (data.defenseLevel !== undefined) u.defenseLevel = data.defenseLevel;
    if (data.constitutionLevel !== undefined)
      u.constitutionLevel = data.constitutionLevel;
    if (data.rangedLevel !== undefined) u.rangedLevel = data.rangedLevel;
    if (data.magicLevel !== undefined) u.magicLevel = data.magicLevel;
    if (data.woodcuttingLevel !== undefined)
      u.woodcuttingLevel = data.woodcuttingLevel;
    if (data.miningLevel !== undefined) u.miningLevel = data.miningLevel;
    if (data.fishingLevel !== undefined) u.fishingLevel = data.fishingLevel;
    if (data.firemakingLevel !== undefined)
      u.firemakingLevel = data.firemakingLevel;
    if (data.cookingLevel !== undefined) u.cookingLevel = data.cookingLevel;
    if (data.smithingLevel !== undefined) u.smithingLevel = data.smithingLevel;
    if (data.agilityLevel !== undefined) u.agilityLevel = data.agilityLevel;
    if (data.craftingLevel !== undefined) u.craftingLevel = data.craftingLevel;
    if (data.fletchingLevel !== undefined)
      u.fletchingLevel = data.fletchingLevel;
    if (data.runecraftingLevel !== undefined)
      u.runecraftingLevel = data.runecraftingLevel;
    // XP
    if (data.attackXp !== undefined) u.attackXp = data.attackXp;
    if (data.strengthXp !== undefined) u.strengthXp = data.strengthXp;
    if (data.defenseXp !== undefined) u.defenseXp = data.defenseXp;
    if (data.constitutionXp !== undefined)
      u.constitutionXp = data.constitutionXp;
    if (data.rangedXp !== undefined) u.rangedXp = data.rangedXp;
    if (data.magicXp !== undefined) u.magicXp = data.magicXp;
    if (data.woodcuttingXp !== undefined) u.woodcuttingXp = data.woodcuttingXp;
    if (data.miningXp !== undefined) u.miningXp = data.miningXp;
    if (data.fishingXp !== undefined) u.fishingXp = data.fishingXp;
    if (data.firemakingXp !== undefined) u.firemakingXp = data.firemakingXp;
    if (data.cookingXp !== undefined) u.cookingXp = data.cookingXp;
    if (data.smithingXp !== undefined) u.smithingXp = data.smithingXp;
    if (data.agilityXp !== undefined) u.agilityXp = data.agilityXp;
    if (data.craftingXp !== undefined) u.craftingXp = data.craftingXp;
    if (data.fletchingXp !== undefined) u.fletchingXp = data.fletchingXp;
    if (data.runecraftingXp !== undefined)
      u.runecraftingXp = data.runecraftingXp;
    // Core
    if (data.health !== undefined) u.health = data.health;
    if (data.maxHealth !== undefined) u.maxHealth = data.maxHealth;
    if (data.coins !== undefined) u.coins = data.coins;
    if (data.positionX !== undefined) u.positionX = data.positionX;
    if (data.positionY !== undefined) u.positionY = data.positionY;
    if (data.positionZ !== undefined) u.positionZ = data.positionZ;
    // Combat preferences
    if (data.autoRetaliate !== undefined) u.autoRetaliate = data.autoRetaliate;
    if (data.attackStyle !== undefined) u.attackStyle = data.attackStyle;
    if (data.selectedSpell !== undefined) u.selectedSpell = data.selectedSpell;
    return u;
  }

  async savePlayerAsync(
    playerId: string,
    data: PlayerPersistenceUpdate,
  ): Promise<void> {
    if (this.isDestroying) {
      return;
    }

    this.ensureDatabase();

    const updateData = this.buildUpdateData(data);

    if (Object.keys(updateData).length === 0) {
      return;
    }

    // UPDATE ONLY - does NOT create characters
    // Includes automatic retry for transient connection failures
    await this.withRetry(async () => {
      await this.db
        .update(schema.characters)
        .set(updateData)
        .where(eq(schema.characters.id, playerId));
    }, `savePlayer(${playerId})`);
  }

  /**
   * Batch save multiple players in a single database transaction.
   *
   * Instead of acquiring N separate pool connections (one per player),
   * this runs all UPDATEs sequentially within one transaction on a single
   * connection. This prevents connection pool exhaustion when many players
   * are being saved concurrently (e.g., from the debounce flush).
   *
   * @param players - Map of playerId → partial data to save
   */
  async batchSavePlayersAsync(
    players: Map<string, PlayerPersistenceUpdate>,
  ): Promise<void> {
    if (this.isDestroying || players.size === 0) {
      return;
    }

    this.ensureDatabase();

    // Build all update objects up front, filter out empty updates
    const updates: Array<{
      playerId: string;
      data: Partial<
        Omit<typeof schema.characters.$inferInsert, "id" | "accountId">
      >;
    }> = [];

    for (const [playerId, playerData] of players) {
      const updateData = this.buildUpdateData(playerData);
      if (Object.keys(updateData).length > 0) {
        updates.push({ playerId, data: updateData });
      }
    }

    if (updates.length === 0) {
      return;
    }

    // Run all updates in a single transaction (1 connection, N sequential writes)
    await this.withRetry(async () => {
      await this.withTransaction(async (tx) => {
        for (const { playerId, data } of updates) {
          await tx
            .update(schema.characters)
            .set(data)
            .where(eq(schema.characters.id, playerId));
        }
      }, `batchSavePlayers(${updates.length})`);
    }, `batchSavePlayers(${updates.length})`);
  }

  /**
   * Get count of all players
   *
   * Returns the total number of characters in the database.
   * Includes automatic retry for transient connection failures.
   *
   * @returns Total number of players
   */
  async getPlayerCountAsync(): Promise<number> {
    this.ensureDatabase();

    return this.withRetry(async () => {
      const result = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.characters);

      return result[0]?.count ?? 0;
    }, "getPlayerCount");
  }
}
