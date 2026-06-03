/**
 * Data Routes Module - Static game data endpoints
 *
 * Serves static game data that the client needs but shouldn't be bundled
 * (server-authoritative data).
 *
 * Endpoints:
 * - GET /api/data/skill-unlocks - Get skill unlock definitions
 *
 * Usage:
 * ```typescript
 * import { registerDataRoutes } from './routes/data-routes';
 * registerDataRoutes(fastify);
 * ```
 */

import type { FastifyInstance } from "fastify";
import { getAllSkillUnlocks } from "@hyperforge/shared";

/**
 * Register data endpoints
 *
 * Sets up endpoints for serving static game data.
 *
 * @param fastify - Fastify server instance
 */
export function registerDataRoutes(fastify: FastifyInstance): void {
  // Get skill unlock definitions
  fastify.get("/api/data/skill-unlocks", async (_req, reply) => {
    const unlocks = getAllSkillUnlocks();
    return reply.send(unlocks);
  });
}
