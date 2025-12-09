/**
 * Environment Routes Module - Public environment variable exposure
 *
 * Exposes PUBLIC_* environment variables to the client via a JavaScript
 * endpoint that sets global variables in the browser.
 *
 * Endpoints:
 * - GET /env.js - Returns JavaScript that sets globalThis.env with public variables
 *
 * Usage:
 * ```typescript
 * import { registerEnvRoutes } from './routes/env-routes';
 * registerEnvRoutes(fastify, config);
 * ```
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ServerConfig } from "../config.js";
import { getPublicEnvs } from "../config.js";

/**
 * Register environment variables endpoint
 *
 * Creates a /env.js endpoint that exposes PUBLIC_* environment variables
 * to the client by generating JavaScript code that sets globalThis.env.
 *
 * @param fastify - Fastify server instance
 * @param config - Server configuration
 */
export function registerEnvRoutes(
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
