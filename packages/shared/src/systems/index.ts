/**
 * ECS Systems
 * Organized by platform (client/server/shared) for optimal tree-shaking
 */

// Export shared systems (work on both client and server)
export * from "./shared";

// Export client-only systems
export * from "./client";

// Server-only systems are not included in main barrel export
// Import directly: import { ServerRuntime } from './systems/server'
// This ensures client bundles don't include server code
