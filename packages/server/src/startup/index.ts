/**
 * Startup Module - Barrel export for all startup modules
 *
 * Provides convenient access to all startup modules from a single import.
 *
 * Usage:
 * ```typescript
 * import { loadConfig, initializeDatabase, initializeWorld } from './startup';
 * ```
 */

export { loadConfig, getPublicEnvs, type ServerConfig } from "./config.js";
export {
  initializeDatabase,
  closeDatabase,
  type DatabaseContext,
} from "./database.js";
export { initializeWorld } from "./world.js";
export { createHttpServer } from "./http-server.js";
export { registerApiRoutes } from "./api-routes.js";
export { registerWebSocket } from "./websocket.js";
export { registerShutdownHandlers } from "./shutdown.js";
export { spawnDefaultAgents, getDefaultAgentCount, getSpawnedAgents } from "./default-agents.js";
