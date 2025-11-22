/**
 * User Routes
 *
 * API endpoints for user management operations
 */

import type { FastifyInstance } from "fastify";
import type { World } from "@hyperscape/shared";
import type { DatabaseSystem } from "../../systems/DatabaseSystem/index.js";

/**
 * Register user-related API routes
 */
export function registerUserRoutes(
  fastify: FastifyInstance,
  world: World,
): void {
  const databaseSystem = world.getSystem("database") as DatabaseSystem;

  if (!databaseSystem) {
    console.error("[UserRoutes] DatabaseSystem not found");
    return;
  }

  /**
   * GET /api/users/check
   *
   * Check if a user account exists.
   *
   * Query:
   *   - accountId: string - The user's Privy account ID
   *
   * Returns:
   *   - exists: boolean
   */
  fastify.get<{
    Querystring: { accountId?: string };
  }>("/api/users/check", async (request, reply) => {
    const { accountId } = request.query;

    if (!accountId) {
      return reply.status(400).send({
        exists: false,
        error: "Missing accountId parameter",
      });
    }

    try {
      const db = databaseSystem.getDb();
      if (!db) {
        return reply.status(500).send({
          exists: false,
          error: "Database not available",
        });
      }

      const user = await db
        .select()
        .from(require("../../database/schema").users)
        .where(
          require("drizzle-orm").eq(
            require("../../database/schema").users.id,
            accountId,
          ),
        )
        .limit(1);

      return reply.send({
        exists: user.length > 0,
      });
    } catch (error) {
      console.error(`[UserRoutes] ❌ Error checking if user exists:`, error);
      return reply.status(500).send({
        exists: false,
        error: "Database error",
      });
    }
  });

  /**
   * POST /api/users/create
   *
   * Create a new user account with username and main wallet.
   * This is called during signup after Privy authentication.
   *
   * Body:
   *   - accountId: string - The user's Privy account ID
   *   - username: string - The chosen username (3-16 chars, alphanumeric + underscore)
   *   - wallet: string - The main HD wallet address (index 0)
   *
   * Returns:
   *   - success: boolean
   *   - username: string
   *   - message: string
   */
  fastify.post<{
    Body: {
      accountId?: string;
      username?: string;
      wallet?: string;
    };
  }>("/api/users/create", async (request, reply) => {
    const { accountId, username, wallet } = request.body;

    // Validate input
    if (!accountId || !username || !wallet) {
      return reply.status(400).send({
        success: false,
        error: "Missing required fields: accountId, username, and wallet",
      });
    }

    // Validate username format
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 16) {
      return reply.status(400).send({
        success: false,
        error: "Username must be 3-16 characters",
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return reply.status(400).send({
        success: false,
        error: "Username can only contain letters, numbers, and underscores",
      });
    }

    console.log(
      `[UserRoutes] 🎮 Creating user account: ${trimmedUsername} (${accountId})`,
    );

    try {
      // Check if user already exists
      const db = databaseSystem.getDb();
      if (!db) {
        return reply.status(500).send({
          success: false,
          error: "Database not available",
        });
      }

      const existingUser = await db
        .select()
        .from(require("../../database/schema").users)
        .where(
          require("drizzle-orm").eq(
            require("../../database/schema").users.id,
            accountId,
          ),
        )
        .limit(1);

      if (existingUser.length > 0) {
        return reply.status(409).send({
          success: false,
          error: "Account already exists",
        });
      }

      // Check if username is taken
      const existingUsername = await db
        .select()
        .from(require("../../database/schema").users)
        .where(
          require("drizzle-orm").eq(
            require("../../database/schema").users.name,
            trimmedUsername,
          ),
        )
        .limit(1);

      if (existingUsername.length > 0) {
        return reply.status(409).send({
          success: false,
          error: "Username is already taken. Please choose another.",
        });
      }

      // Create user account
      const timestamp = new Date().toISOString();
      await db.insert(require("../../database/schema").users).values({
        id: accountId,
        name: trimmedUsername,
        wallet,
        roles: "",
        createdAt: timestamp,
        avatar: null,
        privyUserId: accountId,
        farcasterFid: null,
      });

      console.log(
        `[UserRoutes] ✅ User account created: ${trimmedUsername} with wallet ${wallet}`,
      );

      return reply.send({
        success: true,
        username: trimmedUsername,
        message: "Account created successfully",
      });
    } catch (error) {
      console.error(
        "[UserRoutes] ❌ Failed to create user account for %s:",
        accountId,
        error,
      );

      return reply.status(500).send({
        success: false,
        error: "Failed to create account",
      });
    }
  });

  /**
   * POST /api/users/wallet
   *
   * Assign a wallet address to a user's account.
   * This is idempotent - calling multiple times with the same wallet is safe.
   *
   * Body:
   *   - accountId: string - The user's Privy account ID
   *   - wallet: string - The wallet address to assign (HD index 0)
   *
   * Returns:
   *   - success: boolean
   *   - message: string
   */
  fastify.post<{
    Body: {
      accountId?: string;
      wallet?: string;
    };
  }>("/api/users/wallet", async (request, reply) => {
    const { accountId, wallet } = request.body;

    // Validate input
    if (!accountId || !wallet) {
      return reply.status(400).send({
        success: false,
        error: "Missing required fields: accountId and wallet",
      });
    }

    console.log(
      `[UserRoutes] 💼 Assigning wallet ${wallet} to user ${accountId}`,
    );

    try {
      // Update user's wallet in database
      await databaseSystem.updateUserWallet(accountId, wallet);

      console.log(
        `[UserRoutes] ✅ Wallet assigned successfully to user ${accountId}`,
      );

      return reply.send({
        success: true,
        message: "Wallet assigned to user account",
      });
    } catch (error) {
      console.error(
        `[UserRoutes] ❌ Failed to assign wallet to user ${accountId}:`,
        error,
      );

      return reply.status(500).send({
        success: false,
        error: "Failed to assign wallet to user account",
      });
    }
  });
}
