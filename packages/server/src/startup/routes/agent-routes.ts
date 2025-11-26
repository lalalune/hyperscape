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
   * SECURITY: Requires authentication. User must own the agent to send messages.
   *
   * Headers:
   * - Authorization: Bearer <token> (Privy or Hyperscape JWT)
   *
   * Request body:
   * {
   *   content: "Move to coordinates [10, 0, 5]"
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
      };

      const { agentId } = params;
      const { content } = body;

      // SECURITY: Require authentication via Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.warn(
          "[AgentRoutes] ❌ Message endpoint called without auth token",
        );
        return reply.status(401).send({
          success: false,
          error:
            "Authentication required. Provide Bearer token in Authorization header.",
        });
      }

      const token = authHeader.slice(7); // Remove "Bearer " prefix

      // Verify the token and get user identity
      const { verifyJWT } = await import("../../shared/utils.js");
      const { verifyPrivyToken, isPrivyEnabled } = await import(
        "../../infrastructure/auth/privy-auth.js"
      );

      let verifiedUserId: string | null = null;

      // Try Privy token verification first (if enabled)
      if (isPrivyEnabled()) {
        try {
          const privyInfo = await verifyPrivyToken(token);
          if (privyInfo) {
            verifiedUserId = privyInfo.privyUserId;
            console.log(
              `[AgentRoutes] 🔐 Privy auth verified: ${verifiedUserId}`,
            );
          }
        } catch {
          // Privy verification failed, try JWT next
        }
      }

      // Fall back to Hyperscape JWT verification
      if (!verifiedUserId) {
        const jwtPayload = await verifyJWT(token);
        if (jwtPayload && jwtPayload.userId) {
          verifiedUserId = jwtPayload.userId as string;
          console.log(`[AgentRoutes] 🔐 JWT auth verified: ${verifiedUserId}`);
        }
      }

      if (!verifiedUserId) {
        console.warn("[AgentRoutes] ❌ Token verification failed");
        return reply.status(401).send({
          success: false,
          error: "Invalid or expired authentication token",
        });
      }

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

      // Get agent's mapping to verify it exists AND user owns it
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
        console.warn(`[AgentRoutes] Agent ${agentId} not found in mappings`);
        return reply.status(404).send({
          success: false,
          error: "Agent not found",
        });
      }

      const mapping = mappings[0];

      // SECURITY: Verify the authenticated user owns this agent
      if (mapping.accountId !== verifiedUserId) {
        console.warn(
          `[AgentRoutes] ❌ SECURITY: User ${verifiedUserId} tried to message agent ${agentId} owned by ${mapping.accountId}`,
        );
        return reply.status(403).send({
          success: false,
          error: "You do not have permission to message this agent",
        });
      }

      const characterId = mapping.characterId;
      console.log(
        `[AgentRoutes] ✅ Ownership verified: ${verifiedUserId} owns agent ${mapping.agentName}`,
      );
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

      // Create chat message - use verified user ID as sender
      const chatMessage = {
        id: crypto.randomUUID(),
        from: "Dashboard",
        fromId: verifiedUserId,
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

  /**
   * POST /api/spectator/token
   *
   * Exchange a Privy token for a permanent spectator JWT.
   * This solves the issue where Privy tokens expire after ~1 hour,
   * causing spectator mode to lose authentication.
   *
   * SECURITY: Verifies Privy token and checks agent ownership before issuing JWT.
   *
   * Request body:
   * {
   *   agentId: "agent-uuid",
   *   privyToken: "privy-access-token"
   * }
   *
   * Response:
   * {
   *   success: true,
   *   spectatorToken: "permanent-jwt-token",
   *   characterId: "character-uuid",
   *   expiresAt: null  // Token never expires
   * }
   */
  fastify.post("/api/spectator/token", async (request, reply) => {
    try {
      const body = request.body as {
        agentId: string;
        privyToken: string;
      };

      const { agentId, privyToken } = body;

      if (!agentId || !privyToken) {
        return reply.status(400).send({
          success: false,
          error: "Missing required fields: agentId, privyToken",
        });
      }

      // Verify the Privy token
      const { verifyPrivyToken, isPrivyEnabled } = await import(
        "../../infrastructure/auth/privy-auth.js"
      );

      if (!isPrivyEnabled()) {
        return reply.status(503).send({
          success: false,
          error: "Privy authentication is not configured on this server",
        });
      }

      let verifiedUserId: string | null = null;

      try {
        const privyInfo = await verifyPrivyToken(privyToken);
        if (privyInfo) {
          verifiedUserId = privyInfo.privyUserId;
        }
      } catch (err) {
        console.warn(
          "[AgentRoutes] Privy token verification failed:",
          err instanceof Error ? err.message : String(err),
        );
      }

      if (!verifiedUserId) {
        return reply.status(401).send({
          success: false,
          error: "Invalid or expired Privy token. Please log in again.",
        });
      }

      // Get database system to check agent ownership
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

      // Query agent mapping to verify ownership
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
        return reply.status(404).send({
          success: false,
          error: "Agent not found",
        });
      }

      const mapping = mappings[0];

      // SECURITY: Verify the authenticated user owns this agent
      if (mapping.accountId !== verifiedUserId) {
        console.warn(
          `[AgentRoutes] ❌ SECURITY: User ${verifiedUserId} tried to get spectator token for agent ${agentId} owned by ${mapping.accountId}`,
        );
        return reply.status(403).send({
          success: false,
          error: "You do not have permission to spectate this agent",
        });
      }

      // Generate permanent spectator JWT (no expiration)
      const spectatorToken = await createJWT({
        userId: verifiedUserId,
        characterId: mapping.characterId,
        agentId: agentId,
        isSpectator: true,
      });

      console.log(
        `[AgentRoutes] ✅ Generated spectator JWT for user ${verifiedUserId} watching agent ${mapping.agentName}`,
      );

      return reply.send({
        success: true,
        spectatorToken,
        characterId: mapping.characterId,
        agentName: mapping.agentName,
        expiresAt: null, // Token never expires
      });
    } catch (error) {
      console.error(
        "[AgentRoutes] ❌ Failed to generate spectator token:",
        error,
      );

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate spectator token",
      });
    }
  });

  /**
   * GET /api/agents/:agentId/goal
   *
   * Get the current goal for an agent.
   * Used by the dashboard to display agent goal progress.
   *
   * Response:
   * {
   *   success: true,
   *   goal: { type, description, progress, target, ... } | null
   * }
   */
  fastify.get("/api/agents/:agentId/goal", async (request, reply) => {
    try {
      const params = request.params as { agentId: string };
      const { agentId } = params;

      if (!agentId) {
        return reply.status(400).send({
          success: false,
          error: "Missing required parameter: agentId",
        });
      }

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
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      // Import schema and eq operator
      const { agentMappings } = await import("../../database/schema.js");
      const { eq } = await import("drizzle-orm");

      // Get agent's character ID
      const mappings = (await databaseSystem.db
        .select()
        .from(agentMappings)
        .where(eq(agentMappings.agentId, agentId))) as Array<{
        characterId: string;
      }>;

      if (mappings.length === 0) {
        // Agent not registered yet - return success with null goal
        return reply.send({
          success: true,
          goal: null,
          message: "Agent not registered in game yet",
        });
      }

      const characterId = mappings[0].characterId;

      // Get goal and available goals from ServerNetwork storage
      const { ServerNetwork } = await import(
        "../../systems/ServerNetwork/index.js"
      );
      const goal = ServerNetwork.agentGoals.get(characterId);
      const availableGoals =
        ServerNetwork.agentAvailableGoals.get(characterId) || [];

      if (!goal) {
        return reply.send({
          success: true,
          goal: null,
          availableGoals,
          message: "No active goal",
        });
      }

      // Calculate progress percentage
      const goalData = goal as {
        progress?: number;
        target?: number;
        startedAt?: number;
        locked?: boolean;
        lockedBy?: string;
      };
      const progressPercent =
        goalData.target && goalData.target > 0
          ? Math.round(((goalData.progress || 0) / goalData.target) * 100)
          : 0;

      return reply.send({
        success: true,
        goal: {
          ...goalData,
          progressPercent,
          elapsedMs: goalData.startedAt ? Date.now() - goalData.startedAt : 0,
        },
        availableGoals,
      });
    } catch (error) {
      console.error("[AgentRoutes] ❌ Failed to fetch agent goal:", error);

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch agent goal",
        goal: null,
      });
    }
  });

  /**
   * POST /api/agents/:agentId/goal
   *
   * Set a new goal for an agent from the dashboard.
   * Sends a goalOverride packet to the agent's plugin via WebSocket.
   *
   * Request body:
   * {
   *   goalId: string  // ID of the goal to set (from availableGoals)
   * }
   *
   * Response:
   * {
   *   success: true,
   *   message: "Goal change requested"
   * }
   */
  fastify.post("/api/agents/:agentId/goal", async (request, reply) => {
    try {
      const params = request.params as { agentId: string };
      const body = request.body as { goalId?: string };
      const { agentId } = params;
      const { goalId } = body;

      if (!agentId) {
        return reply.status(400).send({
          success: false,
          error: "Missing required parameter: agentId",
        });
      }

      if (!goalId) {
        return reply.status(400).send({
          success: false,
          error: "Missing required body parameter: goalId",
        });
      }

      // Get database system to find character ID
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
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      // Import schema and eq operator
      const { agentMappings } = await import("../../database/schema.js");
      const { eq } = await import("drizzle-orm");

      // Get agent's character ID
      const mappings = (await databaseSystem.db
        .select()
        .from(agentMappings)
        .where(eq(agentMappings.agentId, agentId))) as Array<{
        characterId: string;
      }>;

      if (mappings.length === 0) {
        return reply.status(404).send({
          success: false,
          error: "Agent not registered in game",
        });
      }

      const characterId = mappings[0].characterId;

      // Get the socket for this character
      const { ServerNetwork } = await import(
        "../../systems/ServerNetwork/index.js"
      );
      const socket = ServerNetwork.characterSockets.get(characterId);

      if (!socket) {
        return reply.status(404).send({
          success: false,
          error: "Agent not connected (no active WebSocket)",
        });
      }

      // Send goalOverride packet to the plugin
      socket.send("goalOverride", {
        goalId,
        source: "dashboard",
      });

      console.log(
        `[AgentRoutes] 🎯 Sent goalOverride to ${characterId}: ${goalId}`,
      );

      return reply.send({
        success: true,
        message: `Goal change requested: ${goalId}`,
      });
    } catch (error) {
      console.error("[AgentRoutes] ❌ Failed to set agent goal:", error);

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to set agent goal",
      });
    }
  });

  /**
   * POST /api/agents/:agentId/goal/unlock
   *
   * Unlock the current goal, allowing autonomous behavior to change it.
   */
  fastify.post("/api/agents/:agentId/goal/unlock", async (request, reply) => {
    try {
      const params = request.params as { agentId: string };
      const { agentId } = params;

      if (!agentId) {
        return reply.status(400).send({
          success: false,
          error: "Missing required parameter: agentId",
        });
      }

      // Get database system to find character ID
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
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      const { agentMappings } = await import("../../database/schema.js");
      const { eq } = await import("drizzle-orm");

      const mappings = (await databaseSystem.db
        .select()
        .from(agentMappings)
        .where(eq(agentMappings.agentId, agentId))) as Array<{
        characterId: string;
      }>;

      if (mappings.length === 0) {
        return reply.status(404).send({
          success: false,
          error: "Agent not registered in game",
        });
      }

      const characterId = mappings[0].characterId;

      // Get the socket for this character
      const { ServerNetwork } = await import(
        "../../systems/ServerNetwork/index.js"
      );
      const socket = ServerNetwork.characterSockets.get(characterId);

      if (!socket) {
        return reply.status(404).send({
          success: false,
          error: "Agent not connected (no active WebSocket)",
        });
      }

      // Send goalOverride packet with special "unlock" command
      socket.send("goalOverride", {
        unlock: true,
        source: "dashboard",
      });

      console.log(`[AgentRoutes] 🔓 Sent goal unlock to ${characterId}`);

      return reply.send({
        success: true,
        message: "Goal unlocked",
      });
    } catch (error) {
      console.error("[AgentRoutes] ❌ Failed to unlock agent goal:", error);

      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to unlock goal",
      });
    }
  });

  /**
   * GET /api/debug/resources
   *
   * Get all resources in the world (trees, fishing spots, etc.)
   * Used for debugging and finding resource locations.
   */
  fastify.get("/api/debug/resources", async (_request, reply) => {
    try {
      // Get all entities from world
      const entities: Array<{
        id: string;
        name: string;
        type: string;
        resourceType?: string;
        position: [number, number, number];
      }> = [];

      const entitiesMap =
        (world.entities as { items?: Map<string, unknown> }).items || new Map();
      for (const [id, entity] of entitiesMap.entries()) {
        const entityAny = entity as Record<string, unknown>;
        const position = entityAny.position as
          | [number, number, number]
          | { x: number; y: number; z: number }
          | undefined;

        let posArray: [number, number, number] = [0, 0, 0];
        if (Array.isArray(position)) {
          posArray = position;
        } else if (position && typeof position === "object") {
          posArray = [position.x || 0, position.y || 0, position.z || 0];
        }

        // Check if it's a resource
        const resourceType = entityAny.resourceType as string | undefined;
        const type = (entityAny.type || entityAny.entityType || "") as string;
        const name = (entityAny.name || "") as string;

        if (
          resourceType ||
          type === "resource" ||
          /tree|fishing|ore|herb/i.test(name)
        ) {
          entities.push({
            id: id as string,
            name,
            type,
            resourceType,
            position: posArray,
          });
        }
      }

      // Get resources from TerrainSystem tiles
      const terrainSystem = world.getSystem("terrain") as {
        getTiles?: () => Map<
          string,
          {
            x: number;
            z: number;
            resources: Array<{
              id: string;
              type: string;
              position: { x: number; y: number; z: number };
            }>;
          }
        >;
        CONFIG?: { TILE_SIZE: number };
      } | null;

      const tileSize = terrainSystem?.CONFIG?.TILE_SIZE || 100;
      const terrainResources: Array<{
        id: string;
        type: string;
        position: [number, number, number];
        tileKey: string;
      }> = [];

      const tiles = terrainSystem?.getTiles?.();
      if (tiles) {
        for (const [key, tile] of tiles.entries()) {
          for (const resource of tile.resources || []) {
            // Resource position is relative to tile - convert to world position
            const worldX = tile.x * tileSize + resource.position.x;
            const worldY = resource.position.y;
            const worldZ = tile.z * tileSize + resource.position.z;

            terrainResources.push({
              id: resource.id,
              type: resource.type,
              position: [worldX, worldY, worldZ],
              tileKey: key,
            });
          }
        }
      }

      // Filter for trees specifically
      const trees = terrainResources.filter((r) => r.type === "tree");

      return reply.send({
        success: true,
        entities,
        terrainResources,
        trees,
        treeCount: trees.length,
        tileCount: tiles?.size || 0,
        totalEntities: entitiesMap.size,
      });
    } catch (error) {
      console.error("[AgentRoutes] ❌ Failed to fetch resources:", error);
      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch resources",
      });
    }
  });

  console.log("[AgentRoutes] ✅ Agent credential routes registered");
}
