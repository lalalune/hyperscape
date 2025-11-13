/**
 * Platform-specific code
 * Organized by client/server/shared
 */

// Re-export shared (cross-platform) code
export * from "./shared";

// Client-specific exports
export * from "./client";

// Server-specific exports are not included in main barrel
// Import directly: import { NodeStorage } from './platform/server'
