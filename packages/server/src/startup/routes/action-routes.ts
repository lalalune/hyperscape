/**
 * Action Routes Module - Action registry REST API
 *
 * Provides HTTP endpoints for discovering and executing game actions
 * via the action registry system. Actions are dynamically registered
 * by game systems and can be invoked via REST API.
 *
 * Endpoints:
 * - GET /api/actions - List all available actions
 * - GET /api/actions/available - Get actions available in specific context
 * - POST /api/actions/:name - Execute a specific action
 *
 * Usage:
 * ```typescript
 * import { registerActionRoutes } from './routes/action-routes';
 * registerActionRoutes(fastify, world);
 * ```
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { World } from "@hyperscape/shared";

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
 * Register action registry endpoints
 *
 * Sets up REST API endpoints for the action registry system.
 * Allows clients to discover available actions and execute them
 * with context-based filtering.
 *
 * @param fastify - Fastify server instance
 * @param world - Game world instance with action registry
 */
export function registerActionRoutes(
  fastify: FastifyInstance,
  world: World,
): void {
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
