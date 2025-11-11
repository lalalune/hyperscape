/**
 * Error Routes Module - Error reporting endpoints
 *
 * Handles error reporting from clients including frontend JavaScript errors,
 * unhandled promise rejections, and other client-side exceptions.
 *
 * Endpoints:
 * - POST /api/errors/frontend - Report frontend errors to server logs
 *
 * Features:
 * - Structured error logging
 * - Stack trace capture
 * - Context information
 * - User agent tracking
 *
 * Usage:
 * ```typescript
 * import { registerErrorRoutes } from './routes/error-routes';
 * registerErrorRoutes(fastify);
 * ```
 */

import type { FastifyInstance } from "fastify";

/**
 * Register error reporting endpoints
 *
 * Sets up endpoints for clients to report errors to the server.
 * Errors are logged to console for monitoring and debugging.
 *
 * @param fastify - Fastify server instance
 */
export function registerErrorRoutes(fastify: FastifyInstance): void {
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
