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

import { eq } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";
import * as schema from "../schema";
import type { PlayerRow } from "../../types";

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
   *
   * @param playerId - The character/player ID to load
   * @returns Player data or null if not found
   */
  async getPlayerAsync(playerId: string): Promise<PlayerRow | null> {
    this.ensureDatabase();

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
  async savePlayerAsync(
    playerId: string,
    data: Partial<PlayerRow>,
  ): Promise<void> {
    if (this.isDestroying) {
      // Gracefully skip during shutdown
      return;
    }

    this.ensureDatabase();

    type CharacterUpdate = Partial<
      Omit<typeof schema.characters.$inferInsert, "id" | "accountId">
    >;

    // Build the update data (ONLY fields that were actually provided in data param)
    const updateData: CharacterUpdate = {};

    // Map PlayerRow fields to schema fields
    // NOTE: Don't overwrite character name once it's set - names come from createCharacter()
    // Only update name if explicitly provided and non-empty
    if (data.name && data.name.trim().length > 0) {
      updateData.name = data.name;
    }
    if (data.combatLevel !== undefined) {
      updateData.combatLevel = data.combatLevel;
    }
    if (data.attackLevel !== undefined) {
      updateData.attackLevel = data.attackLevel;
    }
    if (data.strengthLevel !== undefined) {
      updateData.strengthLevel = data.strengthLevel;
    }
    if (data.defenseLevel !== undefined) {
      updateData.defenseLevel = data.defenseLevel;
    }
    if (data.constitutionLevel !== undefined) {
      updateData.constitutionLevel = data.constitutionLevel;
    }
    if (data.rangedLevel !== undefined) {
      updateData.rangedLevel = data.rangedLevel;
    }
    if (data.woodcuttingLevel !== undefined) {
      updateData.woodcuttingLevel = data.woodcuttingLevel;
    }
    if (data.fishingLevel !== undefined) {
      updateData.fishingLevel = data.fishingLevel;
    }
    if (data.firemakingLevel !== undefined) {
      updateData.firemakingLevel = data.firemakingLevel;
    }
    if (data.cookingLevel !== undefined) {
      updateData.cookingLevel = data.cookingLevel;
    }
    // XP fields
    if (data.attackXp !== undefined) {
      updateData.attackXp = data.attackXp;
    }
    if (data.strengthXp !== undefined) {
      updateData.strengthXp = data.strengthXp;
    }
    if (data.defenseXp !== undefined) {
      updateData.defenseXp = data.defenseXp;
    }
    if (data.constitutionXp !== undefined) {
      updateData.constitutionXp = data.constitutionXp;
    }
    if (data.rangedXp !== undefined) {
      updateData.rangedXp = data.rangedXp;
    }
    if (data.woodcuttingXp !== undefined) {
      updateData.woodcuttingXp = data.woodcuttingXp;
    }
    if (data.fishingXp !== undefined) {
      updateData.fishingXp = data.fishingXp;
    }
    if (data.firemakingXp !== undefined) {
      updateData.firemakingXp = data.firemakingXp;
    }
    if (data.cookingXp !== undefined) {
      updateData.cookingXp = data.cookingXp;
    }
    if (data.health !== undefined) {
      updateData.health = data.health;
    }
    if (data.maxHealth !== undefined) {
      updateData.maxHealth = data.maxHealth;
    }
    if (data.coins !== undefined) {
      updateData.coins = data.coins;
    }
    if (data.positionX !== undefined) {
      updateData.positionX = data.positionX;
    }
    if (data.positionY !== undefined) {
      updateData.positionY = data.positionY;
    }
    if (data.positionZ !== undefined) {
      updateData.positionZ = data.positionZ;
    }

    // If no update data provided, skip silently (character doesn't need updating)
    if (Object.keys(updateData).length === 0) {
      return;
    }

    // UPDATE ONLY - does NOT create characters
    // Characters must be explicitly created via CharacterRepository.createCharacter() first
    try {
      await this.db
        .update(schema.characters)
        .set(updateData)
        .where(eq(schema.characters.id, playerId));
    } catch (err) {
      console.error("[PlayerRepository] UPDATE FAILED:", err);
      throw err;
    }
  }
}
