/**
 * API Routes Module - REST endpoint handlers
 *
 * Registers all HTTP API endpoints for the game server including health checks,
 * player management, action execution, file uploads, and error reporting.
 *
 * Responsibilities:
 * - /health - Health check endpoint
 * - /status - Server status with connected players
 * - /env.js - Public environment variables for client
 * - /api/upload - File upload handling
 * - /api/upload-check - Check if file exists
 * - /api/player/disconnect - Player disconnect beacon
 * - /api/actions/* - Action registry endpoints
 * - /api/errors/frontend - Frontend error reporting
 *
 * Usage:
 * ```typescript
 * registerApiRoutes(fastify, world, config);
 * ```
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { World } from "@hyperscape/shared";
import fs from "fs-extra";
import path from "path";
import { hashFile } from "../utils.js";
import type { ServerConfig } from "./config.js";
import { getPublicEnvs } from "./config.js";

// JSON value type for proper typing
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

// Route schema interfaces
interface ActionRouteParams {
  name: string;
}

interface ActionRouteBody {
  context?: JSONValue;
  params?: JSONValue;
}

/**
 * Register all API routes
 *
 * Adds all HTTP API endpoints to the Fastify server. Routes are organized
 * by functionality (health, uploads, actions, errors).
 *
 * @param fastify - Fastify server instance
 * @param world - Game world instance
 * @param config - Server configuration
 */
export function registerApiRoutes(
  fastify: FastifyInstance,
  world: World,
  config: ServerConfig,
): void {
  console.log("[API] Registering API routes...");

  // Health and status endpoints
  registerHealthRoutes(fastify, world, config);

  // Environment variables endpoint
  registerEnvRoute(fastify, config);

  // Upload endpoints
  registerUploadRoutes(fastify, config);

  // Player management
  registerPlayerRoutes(fastify, world);

  // Action registry endpoints
  registerActionRoutes(fastify, world);

  // Error reporting
  registerErrorRoutes(fastify);

  console.log("[API] ✅ API routes registered");
}

/**
 * Register health and status endpoints
 *
 * @param fastify - Fastify instance
 * @param world - World instance
 * @param config - Server configuration
 * @private
 */
function registerHealthRoutes(
  fastify: FastifyInstance,
  world: World,
  config: ServerConfig,
): void {
  // Basic health check
  fastify.get(
    "/health",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const health = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };

      return reply.code(200).send(health);
    },
  );

  // Detailed status with connected players
  fastify.get(
    "/status",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const status = {
        uptime: Math.round(world.time),
        protected: config.adminCode !== undefined,
        connectedUsers: [] as Array<{
          id: string;
          position: number[];
          name: string;
        }>,
        commitHash: config.commitHash,
      };

      // Import type from our local types
      const network =
        world.network as unknown as import("../types.js").ServerNetworkWithSockets;

      for (const socket of network.sockets.values()) {
        if (socket.player?.node?.position) {
          const pos = socket.player.node.position;
          status.connectedUsers.push({
            id: socket.player.data.userId as string,
            position: [pos.x, pos.y, pos.z],
            name: socket.player.data.name as string,
          });
        }
      }

      return reply.code(200).send(status);
    },
  );
}

/**
 * Register environment variables endpoint
 *
 * Exposes PUBLIC_* environment variables to the client via /env.js
 *
 * @param fastify - Fastify instance
 * @param config - Server configuration
 * @private
 */
function registerEnvRoute(
  fastify: FastifyInstance,
  config: ServerConfig,
): void {
  const publicEnvs = getPublicEnvs();

  // Expose plugin paths to client for systems loading
  if (config.systemsPath) {
    publicEnvs["PLUGIN_PATH"] = config.systemsPath;
  }

  const envsCode = `
  if (!globalThis.env) globalThis.env = {}
  globalThis.env = ${JSON.stringify(publicEnvs)}
`;

  fastify.get("/env.js", async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.type("application/javascript").send(envsCode);
  });
}

/**
 * Register upload endpoints
 *
 * Handles file uploads and existence checks
 *
 * @param fastify - Fastify instance
 * @param config - Server configuration
 * @private
 */
function registerUploadRoutes(
  fastify: FastifyInstance,
  config: ServerConfig,
): void {
  // File upload endpoint
  fastify.post("/api/upload", async (req, _reply) => {
    const file = await req.file();
    if (!file) {
      throw new Error("No file uploaded");
    }

    const ext = file.filename.split(".").pop()?.toLowerCase();
    if (!ext) {
      throw new Error("Invalid filename");
    }

    // Create temp buffer to store contents
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Hash from buffer
    const hash = await hashFile(buffer);
    const filename = `${hash}.${ext}`;

    // Save to fs
    const filePath = path.join(config.assetsDir, filename);
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      await fs.writeFile(filePath, buffer);
    }

    return { filename, exists };
  });

  // Check if file exists
  fastify.get("/api/upload-check", async (req: FastifyRequest, _reply) => {
    const filename = (req.query as { filename: string }).filename;
    const filePath = path.join(config.assetsDir, filename);
    const exists = await fs.pathExists(filePath);
    return { exists };
  });
}

/**
 * Register player management endpoints
 *
 * @param fastify - Fastify instance
 * @param world - World instance
 * @private
 */
function registerPlayerRoutes(fastify: FastifyInstance, world: World): void {
  // Minimal player disconnect endpoint for client beacons
  fastify.post("/api/player/disconnect", async (req, reply) => {
    const body = req.body as {
      playerId: string;
      sessionId?: string;
      reason?: string;
    };

    fastify.log.info({ body }, "[API] player/disconnect");

    const network =
      world.network as unknown as import("../types.js").ServerNetworkWithSockets;
    const socket = network.sockets.get(body.playerId);

    if (socket) {
      socket.close?.();
    }

    return reply.send({ ok: true });
  });
}

/**
 * Register action registry endpoints
 *
 * Provides API for discovering and executing game actions
 *
 * @param fastify - Fastify instance
 * @param world - World instance
 * @private
 */
function registerActionRoutes(fastify: FastifyInstance, world: World): void {
  // Get all available actions
  fastify.get(
    "/api/actions",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const actions = world.actionRegistry!.getAll();
      return reply.send({
        success: true,
        actions: actions.map((action: Record<string, unknown>) => ({
          name: action.name as string,
          description: action.description as string,
          parameters: action.parameters,
        })),
      });
    },
  );

  // Get available actions for context
  fastify.get(
    "/api/actions/available",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, unknown>;
      const context = {
        world,
        playerId: query?.playerId,
        ...query,
      };

      const actions = world.actionRegistry!.getAvailable(context);
      return reply.send({
        success: true,
        actions: actions.map((action: { name: string }) => action.name),
      });
    },
  );

  // Execute action
  fastify.post<{ Params: ActionRouteParams; Body: ActionRouteBody }>(
    "/api/actions/:name",
    async (request, reply) => {
      const actionName = request.params.name;
      const body = request.body as { params: Record<string, unknown> };
      const params = body.params;
      const query = request.query as Record<string, JSONValue>;
      const context = {
        world,
        playerId: query?.playerId,
        ...query,
      };

      const result = await world.actionRegistry!.execute(
        actionName,
        context,
        params,
      );

      return reply.send({
        success: true,
        result,
      });
    },
  );
}

/**
 * Register error reporting endpoints
 *
 * @param fastify - Fastify instance
 * @private
 */
function registerErrorRoutes(fastify: FastifyInstance): void {
  // Frontend error reporting endpoint
  fastify.post("/api/errors/frontend", async (request, reply) => {
    const errorData = request.body as Record<string, unknown>;

    const timestamp = new Date().toISOString();
    console.error(`[Frontend Error] ${timestamp}`);
    console.error("Error:", errorData.message);
    console.error("Stack:", errorData.stack);
    console.error("URL:", errorData.url);
    console.error("User Agent:", errorData.userAgent);
    if (errorData.context) {
      console.error("Additional Context:", errorData.context);
    }

    return reply.send({ success: true, logged: true });
  });
}
