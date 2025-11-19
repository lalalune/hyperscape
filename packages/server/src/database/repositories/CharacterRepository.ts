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
  async getCharactersAsync(
    accountId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      avatar?: string | null;
      wallet?: string | null;
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
      })
      .from(schema.characters)
      .where(eq(schema.characters.accountId, accountId));

    console.log(
      "[CharacterRepository] 📋 Found",
      results.length,
      "characters:",
      results,
    );

    return results;
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
   * @returns true if created successfully, false if character ID already exists
   */
  async createCharacter(
    accountId: string,
    id: string,
    name: string,
    avatar?: string,
    wallet?: string,
  ): Promise<boolean> {
    this.ensureDatabase();

    const now = Date.now();

    console.log("[CharacterRepository] 🎭 Creating character:", {
      id,
      accountId,
      name,
      avatar,
      wallet,
      timestamp: now,
    });

    try {
      await this.db.insert(schema.characters).values({
        id,
        accountId,
        name,
        avatar,
        wallet,
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
}
