/**
 * Agent Routes - ElizaOS Agent Credential Management
 *
 * REST API endpoints for generating permanent authentication credentials for AI agents.
 * Agents need long-lived tokens to connect autonomously without user intervention.
 *
 * Security Model:
 * - Only Privy-authenticated users can create agent credentials
 * - Credentials are tied to specific characterId + userId pairs
 * - JWTs are server-signed and cryptographically secure
 * - Agents are clearly marked with isAgent flag
 */

import type { FastifyInstance } from "fastify";
import type { World } from "@hyperscape/shared";
import { createJWT } from "../../shared/utils.js";

/**
 * Register agent credential routes
 *
 * Endpoints:
 * - POST /api/agents/credentials - Generate permanent JWT for agent character
 *
 * @param fastify - Fastify server instance
 * @param world - Game world instance (for database access)
 */
export function registerAgentRoutes(
  fastify: FastifyInstance,
  world: World,
): void {
  console.log("[AgentRoutes] Registering agent credential routes...");

  /**
   * POST /api/agents/credentials
   *
   * Generate permanent authentication credentials for an AI agent character.
   * This endpoint creates a long-lived Hyperscape JWT that never expires,
   * allowing the agent to connect autonomously.
   *
   * Request body:
   * {
   *   characterId: "character-uuid",
   *   accountId: "privy-user-id"
   * }
   *
   * Response:
   * {
   *   success: true,
   *   authToken: "permanent-jwt-token",
   *   characterId: "character-uuid",
   *   serverUrl: "ws://localhost:5555/ws"
   * }
   */
  fastify.post("/api/agents/credentials", async (request, reply) => {
    try {
      const body = request.body as {
        characterId: string;
        accountId: string;
      };

      if (!body.characterId || !body.accountId) {
        return reply.status(400).send({
          success: false,
          error: "Missing required fields: characterId, accountId",
        });
      }

      const { characterId, accountId } = body;

      console.log("[AgentRoutes] Generating credentials for:", {
        characterId,
        accountId,
      });

      // Verify character exists and belongs to this account
      const databaseSystem = world.getSystem("database") as
        | {
            getCharactersAsync: (
              accountId: string,
            ) => Promise<Array<{ id: string; name: string }>>;
          }
        | undefined;

      if (!databaseSystem) {
        console.error("[AgentRoutes] DatabaseSystem not available");
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      const characters = await databaseSystem.getCharactersAsync(accountId);
      const character = characters.find((c) => c.id === characterId);

      if (!character) {
        console.warn(
          `[AgentRoutes] Character ${characterId} not found or not owned by ${accountId}`,
        );
        return reply.status(403).send({
          success: false,
          error: "Character not found or access denied",
        });
      }

      console.log("[AgentRoutes] Character verified:", character.name);

      // Generate permanent Hyperscape JWT (no expiration)
      const authToken = await createJWT({
        userId: accountId,
        characterId: characterId,
        isAgent: true,
      });

      console.log(
        `[AgentRoutes] ✅ Generated permanent JWT for agent: ${character.name}`,
      );

      // Get server URL from environment or use default
      const serverUrl =
        process.env.HYPERSCAPE_SERVER_URL ||
        process.env.PUBLIC_WS_URL ||
        "ws://localhost:5555/ws";

      return reply.send({
        success: true,
        authToken,
        characterId,
        serverUrl,
        message: `Permanent credentials generated for ${character.name}`,
      });
    } catch (error) {
      console.error("[AgentRoutes] ❌ Failed to generate credentials:", error);

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate credentials",
      });
    }
  });

  console.log("[AgentRoutes] ✅ Agent credential routes registered");
}
