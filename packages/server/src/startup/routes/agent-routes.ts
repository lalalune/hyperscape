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
 *
 * Note: Dashboard on port 3333 calls ElizaOS API (port 3000) directly.
 * No proxying is needed for localhost development.
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

  /**
   * GET /api/agents/mappings/:accountId
   *
   * Get all agent mappings for a user.
   * Returns the list of agent IDs owned by this user.
   *
   * Response:
   * {
   *   success: true,
   *   agentIds: ["agent-id-1", "agent-id-2", ...]
   * }
   */
  fastify.get("/api/agents/mappings/:accountId", async (request, reply) => {
    try {
      const params = request.params as { accountId: string };
      const { accountId } = params;

      if (!accountId) {
        return reply.status(400).send({
          success: false,
          error: "Missing required parameter: accountId",
        });
      }

      console.log("[AgentRoutes] Fetching agent mappings for:", accountId);

      // Get database system
      const databaseSystem = world.getSystem("database") as
        | {
            db: {
              select: (fields?: unknown) => {
                from: (table: unknown) => {
                  where: (condition: unknown) => Promise<unknown[]>;
                };
              };
            };
          }
        | undefined;

      if (!databaseSystem || !databaseSystem.db) {
        console.error("[AgentRoutes] DatabaseSystem not available");
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      // Import schema and eq operator
      const { agentMappings } = await import("../../database/schema.js");
      const { eq } = await import("drizzle-orm");

      // Query agent mappings for this user
      const mappings = (await databaseSystem.db
        .select()
        .from(agentMappings)
        .where(eq(agentMappings.accountId, accountId))) as Array<{
        agentId: string;
        agentName: string;
        characterId: string;
      }>;

      const agentIds = mappings.map((m) => m.agentId);

      console.log(
        `[AgentRoutes] Found ${agentIds.length} agent(s) for ${accountId}`,
      );

      return reply.send({
        success: true,
        agentIds,
        count: agentIds.length,
      });
    } catch (error) {
      console.error("[AgentRoutes] ❌ Failed to fetch agent mappings:", error);

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch agent mappings",
      });
    }
  });

  /**
   * POST /api/agents/mappings
   *
   * Save agent-to-user mapping for dashboard filtering.
   * This allows the dashboard to show only agents owned by the current user.
   *
   * Request body:
   * {
   *   agentId: "eliza-agent-uuid",
   *   accountId: "privy-user-id",
   *   characterId: "character-uuid",
   *   agentName: "Agent Name"
   * }
   *
   * Response:
   * {
   *   success: true
   * }
   */
  fastify.post("/api/agents/mappings", async (request, reply) => {
    try {
      const body = request.body as {
        agentId: string;
        accountId: string;
        characterId: string;
        agentName: string;
      };

      if (
        !body.agentId ||
        !body.accountId ||
        !body.characterId ||
        !body.agentName
      ) {
        return reply.status(400).send({
          success: false,
          error:
            "Missing required fields: agentId, accountId, characterId, agentName",
        });
      }

      const { agentId, accountId, characterId, agentName } = body;

      console.log("[AgentRoutes] Saving agent mapping:", {
        agentId,
        accountId,
        characterId,
        agentName,
      });

      // Get database system
      const databaseSystem = world.getSystem("database") as
        | {
            db: {
              insert: (table: unknown) => {
                values: (values: unknown) => {
                  onConflictDoUpdate: (config: {
                    target: unknown;
                    set: unknown;
                  }) => Promise<unknown>;
                };
              };
            };
          }
        | undefined;

      if (!databaseSystem || !databaseSystem.db) {
        console.error("[AgentRoutes] DatabaseSystem not available");
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      // Import schema
      const { agentMappings } = await import("../../database/schema.js");

      // Insert or update mapping
      await databaseSystem.db
        .insert(agentMappings)
        .values({
          agentId,
          accountId,
          characterId,
          agentName,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: agentMappings.agentId,
          set: {
            agentName,
            updatedAt: new Date(),
          },
        });

      console.log(`[AgentRoutes] ✅ Agent mapping saved for: ${agentName}`);

      return reply.send({
        success: true,
        message: `Agent mapping saved for ${agentName}`,
      });
    } catch (error) {
      console.error("[AgentRoutes] ❌ Failed to save agent mapping:", error);

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save agent mapping",
      });
    }
  });

  /**
   * GET /api/agents/mapping/:agentId
   *
   * Get a single agent mapping by agent ID.
   * Returns the character ID and other details for this agent.
   * Used by dashboard viewport to get character ID for iframe embedding.
   *
   * Response:
   * {
   *   success: true,
   *   agentId: "agent-uuid",
   *   characterId: "character-uuid",
   *   accountId: "privy-user-id",
   *   agentName: "Agent Name"
   * }
   */
  fastify.get("/api/agents/mapping/:agentId", async (request, reply) => {
    try {
      const params = request.params as { agentId: string };
      const { agentId } = params;

      if (!agentId) {
        return reply.status(400).send({
          success: false,
          error: "Missing required parameter: agentId",
        });
      }

      console.log("[AgentRoutes] Fetching mapping for agent:", agentId);

      // Get database system
      const databaseSystem = world.getSystem("database") as
        | {
            db: {
              select: (fields?: unknown) => {
                from: (table: unknown) => {
                  where: (condition: unknown) => Promise<unknown[]>;
                };
              };
            };
          }
        | undefined;

      if (!databaseSystem || !databaseSystem.db) {
        console.error("[AgentRoutes] DatabaseSystem not available");
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      // Import schema and eq operator
      const { agentMappings } = await import("../../database/schema.js");
      const { eq } = await import("drizzle-orm");

      // Query agent mapping by agent ID
      const mappings = (await databaseSystem.db
        .select()
        .from(agentMappings)
        .where(eq(agentMappings.agentId, agentId))) as Array<{
        agentId: string;
        accountId: string;
        characterId: string;
        agentName: string;
      }>;

      if (mappings.length === 0) {
        console.log(`[AgentRoutes] No mapping found for agent: ${agentId}`);
        return reply.status(404).send({
          success: false,
          error: "Agent mapping not found",
        });
      }

      const mapping = mappings[0];

      console.log(
        `[AgentRoutes] ✅ Found mapping for agent ${agentId}: characterId=${mapping.characterId}`,
      );

      return reply.send({
        success: true,
        agentId: mapping.agentId,
        characterId: mapping.characterId,
        accountId: mapping.accountId,
        agentName: mapping.agentName,
      });
    } catch (error) {
      console.error("[AgentRoutes] ❌ Failed to fetch agent mapping:", error);

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch agent mapping",
      });
    }
  });

  /**
   * DELETE /api/agents/mappings/:agentId
   *
   * Delete agent mapping from Hyperscape database.
   * This removes the link between an ElizaOS agent and the user's account.
   *
   * Response:
   * {
   *   success: true,
   *   message: "Agent mapping deleted"
   * }
   */
  fastify.delete("/api/agents/mappings/:agentId", async (request, reply) => {
    try {
      const params = request.params as { agentId: string };
      const { agentId } = params;

      if (!agentId) {
        return reply.status(400).send({
          success: false,
          error: "Missing required parameter: agentId",
        });
      }

      console.log("[AgentRoutes] Deleting agent mapping for:", agentId);

      // Get database system
      const databaseSystem = world.getSystem("database") as
        | {
            db: {
              delete: (table: unknown) => {
                where: (condition: unknown) => Promise<unknown>;
              };
            };
          }
        | undefined;

      if (!databaseSystem || !databaseSystem.db) {
        console.error("[AgentRoutes] DatabaseSystem not available");
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      // Import schema and eq operator
      const { agentMappings } = await import("../../database/schema.js");
      const { eq } = await import("drizzle-orm");

      // Delete agent mapping
      await databaseSystem.db
        .delete(agentMappings)
        .where(eq(agentMappings.agentId, agentId));

      console.log(`[AgentRoutes] ✅ Agent mapping deleted for: ${agentId}`);

      return reply.send({
        success: true,
        message: "Agent mapping deleted",
      });
    } catch (error) {
      console.error("[AgentRoutes] ❌ Failed to delete agent mapping:", error);

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete agent mapping",
      });
    }
  });

  /**
   * POST /api/agents/:agentId/message
   *
   * Send a message to an agent via ElizaOS messaging system.
   * This properly integrates with ElizaOS's runtime, allowing the agent to
   * process messages through its personality, providers, and actions.
   *
   * Request body:
   * {
   *   content: "Move to coordinates [10, 0, 5]",
   *   userId: "user-id" (optional)
   * }
   *
   * Response:
   * {
   *   success: true,
   *   message: "Message sent to agent"
   * }
   */
  fastify.post("/api/agents/:agentId/message", async (request, reply) => {
    try {
      const params = request.params as { agentId: string };
      const body = request.body as {
        content: string;
        userId?: string;
      };

      const { agentId } = params;
      const { content, userId = "dashboard-user" } = body;

      if (!agentId) {
        return reply.status(400).send({
          success: false,
          error: "Missing required parameter: agentId",
        });
      }

      if (!content) {
        return reply.status(400).send({
          success: false,
          error: "Missing required field: content",
        });
      }

      console.log(
        `[AgentRoutes] Sending message to agent ${agentId}:`,
        content,
      );

      // Get the agent's character ID from mappings
      const databaseSystem = world.getSystem("database") as
        | {
            db: {
              select: (fields?: unknown) => {
                from: (table: unknown) => {
                  where: (condition: unknown) => Promise<unknown[]>;
                };
              };
            };
          }
        | undefined;

      if (!databaseSystem || !databaseSystem.db) {
        console.error("[AgentRoutes] DatabaseSystem not available");
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      // Import schema and eq operator
      const { agentMappings } = await import("../../database/schema.js");
      const { eq } = await import("drizzle-orm");

      // Get agent's mapping to verify it exists
      const mappings = (await databaseSystem.db
        .select()
        .from(agentMappings)
        .where(eq(agentMappings.agentId, agentId))) as Array<{
        agentId: string;
        characterId: string;
        agentName: string;
      }>;

      if (mappings.length === 0) {
        console.warn(`[AgentRoutes] Agent ${agentId} not found in mappings`);
        return reply.status(404).send({
          success: false,
          error: "Agent not found",
        });
      }

      const mapping = mappings[0];
      const characterId = mapping.characterId;
      console.log(
        `[AgentRoutes] Found agent ${mapping.agentName} (character: ${characterId})`,
      );

      // Send message via in-game chat system
      // The agent receives this through the game's WebSocket and processes it via ElizaOS
      const chatSystem = world.getSystem("chat") as
        | {
            add: (
              message: {
                id: string;
                from: string;
                fromId: string;
                body: string;
                text: string;
                timestamp: number;
                createdAt: string;
              },
              broadcast?: boolean,
            ) => void;
          }
        | undefined;

      if (!chatSystem) {
        console.error("[AgentRoutes] ChatSystem not available");
        return reply.status(500).send({
          success: false,
          error: "Chat system not available",
        });
      }

      // Create chat message
      const chatMessage = {
        id: crypto.randomUUID(),
        from: "Dashboard",
        fromId: userId,
        body: content,
        text: content,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
      };

      // Broadcast through game chat - agent will receive via chatAdded packet
      chatSystem.add(chatMessage, true);

      console.log(
        `[AgentRoutes] ✅ Message sent to agent ${agentId} via game chat`,
      );

      return reply.send({
        success: true,
        message: "Message sent to agent",
      });
    } catch (error) {
      console.error("[AgentRoutes] ❌ Failed to send message to agent:", error);

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send message to agent",
      });
    }
  });

  console.log("[AgentRoutes] ✅ Agent credential routes registered");
}
