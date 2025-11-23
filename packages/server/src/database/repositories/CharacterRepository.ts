/**
 * CharacterRepository - Character management operations
 *
 * Handles character (avatar) creation and retrieval for player accounts.
 * Each account can have multiple characters. Characters represent individual
 * player avatars in the game.
 *
 * Responsibilities:
 * - Get list of characters for an account
 * - Create new characters with default stats
 * - Validate character names and enforce uniqueness
 *
 * Used by: Character selection system, ServerNetwork
 */

import { eq } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";
import * as schema from "../schema";

/**
 * CharacterRepository class
 *
 * Provides all character management operations.
 */
export class CharacterRepository extends BaseRepository {
  /**
   * Get all characters for an account
   *
   * Retrieves a list of all characters (avatars) owned by a specific account.
   * Used to populate the character selection screen.
   *
   * @param accountId - The account/user ID to fetch characters for
   * @returns Array of characters with id and name
   */
  async getCharactersAsync(accountId: string): Promise<
    Array<{
      id: string;
      name: string;
      avatar?: string | null;
      wallet?: string | null;
      isAgent?: boolean;
      combatLevel?: number | null;
      constitutionLevel?: number | null;
    }>
  > {
    this.ensureDatabase();

    console.log(
      "[CharacterRepository] 📋 Loading characters for accountId:",
      accountId,
    );

    const results = await this.db
      .select({
        id: schema.characters.id,
        name: schema.characters.name,
        avatar: schema.characters.avatar,
        wallet: schema.characters.wallet,
        isAgent: schema.characters.isAgent,
        combatLevel: schema.characters.combatLevel,
        constitutionLevel: schema.characters.constitutionLevel,
      })
      .from(schema.characters)
      .where(eq(schema.characters.accountId, accountId));

    console.log(
      "[CharacterRepository] 📋 Found",
      results.length,
      "characters:",
      results,
    );

    // Convert isAgent from number (0/1) to boolean
    return results.map((char) => ({
      ...char,
      isAgent: char.isAgent === 1,
    }));
  }

  /**
   * Create a new character
   *
   * Creates a new character (avatar) for an account with default starting stats.
   * Characters start at level 1 in all skills with initial health and position.
   *
   * @param accountId - The account that owns this character
   * @param id - Unique character ID (usually a UUID)
   * @param name - Display name for the character (validated by caller)
   * @param avatar - Avatar VRM URL
   * @param wallet - Privy HD wallet address
   * @param isAgent - Whether this character is controlled by an AI agent (default: false)
   * @returns true if created successfully, false if character ID already exists
   */
  async createCharacter(
    accountId: string,
    id: string,
    name: string,
    avatar?: string,
    wallet?: string,
    isAgent?: boolean,
  ): Promise<boolean> {
    this.ensureDatabase();

    const now = Date.now();

    console.log("[CharacterRepository] 🎭 Creating character:", {
      id,
      accountId,
      name,
      avatar,
      wallet,
      isAgent: isAgent || false,
      timestamp: now,
    });

    try {
      await this.db.insert(schema.characters).values({
        id,
        accountId,
        name,
        avatar,
        wallet,
        isAgent: isAgent ? 1 : 0, // Convert boolean to integer for SQLite/PostgreSQL
        createdAt: now,
        lastLogin: now,
      });

      console.log(
        "[CharacterRepository] ✅ Character created successfully in DB",
      );

      // Verify it was saved
      const verify = await this.db
        .select()
        .from(schema.characters)
        .where(eq(schema.characters.id, id))
        .limit(1);

      console.log(
        "[CharacterRepository] 🔍 Verification query result:",
        verify,
      );

      return true;
    } catch (error) {
      console.error(
        "[CharacterRepository] ❌ Error creating character:",
        error,
      );
      // Character already exists (PostgreSQL unique constraint violation code)
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        console.log(
          "[CharacterRepository] Character already exists (duplicate key)",
        );
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete a character by ID
   *
   * Permanently removes a character from the database. This is used when
   * users cancel agent creation or explicitly delete unwanted characters.
   *
   * @param characterId - The character ID to delete
   * @returns true if character was deleted, false if not found
   */
  async deleteCharacter(characterId: string): Promise<boolean> {
    this.ensureDatabase();

    console.log("[CharacterRepository] 🗑️  Deleting character:", characterId);

    try {
      const result = await this.db
        .delete(schema.characters)
        .where(eq(schema.characters.id, characterId));

      // Check if any rows were affected
      // Drizzle returns an object with rowCount or similar depending on dialect
      const deleted =
        result && (result as unknown as { rowCount?: number }).rowCount !== 0;

      if (deleted) {
        console.log("[CharacterRepository] ✅ Character deleted successfully");
      } else {
        console.log("[CharacterRepository] ⚠️  Character not found");
      }

      return deleted;
    } catch (error) {
      console.error(
        "[CharacterRepository] ❌ Error deleting character:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get character skills
   *
   * Retrieves skill levels and XP for a character. Used by the dashboard
   * to display agent skill progress in real-time.
   *
   * @param characterId - The character ID to fetch skills for
   * @returns Skills object with level and xp for each skill, or null if not found
   */
  async getCharacterSkills(characterId: string): Promise<{
    attack: { level: number; xp: number };
    strength: { level: number; xp: number };
    defense: { level: number; xp: number };
    constitution: { level: number; xp: number };
    ranged: { level: number; xp: number };
    woodcutting: { level: number; xp: number };
    fishing: { level: number; xp: number };
    firemaking: { level: number; xp: number };
    cooking: { level: number; xp: number };
  } | null> {
    this.ensureDatabase();

    const results = await this.db
      .select({
        attackLevel: schema.characters.attackLevel,
        strengthLevel: schema.characters.strengthLevel,
        defenseLevel: schema.characters.defenseLevel,
        constitutionLevel: schema.characters.constitutionLevel,
        rangedLevel: schema.characters.rangedLevel,
        woodcuttingLevel: schema.characters.woodcuttingLevel,
        fishingLevel: schema.characters.fishingLevel,
        firemakingLevel: schema.characters.firemakingLevel,
        cookingLevel: schema.characters.cookingLevel,
        attackXp: schema.characters.attackXp,
        strengthXp: schema.characters.strengthXp,
        defenseXp: schema.characters.defenseXp,
        constitutionXp: schema.characters.constitutionXp,
        rangedXp: schema.characters.rangedXp,
        woodcuttingXp: schema.characters.woodcuttingXp,
        fishingXp: schema.characters.fishingXp,
        firemakingXp: schema.characters.firemakingXp,
        cookingXp: schema.characters.cookingXp,
      })
      .from(schema.characters)
      .where(eq(schema.characters.id, characterId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];

    return {
      attack: { level: row.attackLevel || 1, xp: row.attackXp || 0 },
      strength: { level: row.strengthLevel || 1, xp: row.strengthXp || 0 },
      defense: { level: row.defenseLevel || 1, xp: row.defenseXp || 0 },
      constitution: {
        level: row.constitutionLevel || 10,
        xp: row.constitutionXp || 1154,
      },
      ranged: { level: row.rangedLevel || 1, xp: row.rangedXp || 0 },
      woodcutting: {
        level: row.woodcuttingLevel || 1,
        xp: row.woodcuttingXp || 0,
      },
      fishing: { level: row.fishingLevel || 1, xp: row.fishingXp || 0 },
      firemaking: {
        level: row.firemakingLevel || 1,
        xp: row.firemakingXp || 0,
      },
      cooking: { level: row.cookingLevel || 1, xp: row.cookingXp || 0 },
    };
  }

  /**
   * Update character's isAgent flag
   *
   * Converts a character between agent and human types. Used when users
   * decide to convert an abandoned agent character to play themselves.
   *
   * @param characterId - The character ID to update
   * @param isAgent - New value for isAgent flag
   * @returns true if character was updated, false if not found
   */
  async updateCharacterIsAgent(
    characterId: string,
    isAgent: boolean,
  ): Promise<boolean> {
    this.ensureDatabase();

    console.log("[CharacterRepository] 🔄 Updating character isAgent:", {
      characterId,
      isAgent,
    });

    try {
      const result = await this.db
        .update(schema.characters)
        .set({ isAgent: isAgent ? 1 : 0 })
        .where(eq(schema.characters.id, characterId));

      // Check if any rows were affected
      const updated =
        result && (result as unknown as { rowCount?: number }).rowCount !== 0;

      if (updated) {
        console.log(
          `[CharacterRepository] ✅ Character updated to ${isAgent ? "agent" : "human"}`,
        );
      } else {
        console.log("[CharacterRepository] ⚠️  Character not found");
      }

      return updated;
    } catch (error) {
      console.error(
        "[CharacterRepository] ❌ Error updating character:",
        error,
      );
      throw error;
    }
  }
}
