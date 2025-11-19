/**
 * Frontend exports for @hyperscape/plugin-hyperscape
 *
 * This module exports Hyperscape-specific React components, hooks, and types
 * for use in ElizaOS frontend applications.
 *
 * @example
 * ```typescript
 * import {
 *   HyperscapeDashboard,
 *   useHyperscapeAgent,
 *   useHyperscapePlugin,
 *   useHyperscapeWebSocket,
 *   type HyperscapeAgentStatus
 * } from '@hyperscape/plugin-hyperscape/frontend';
 * ```
 */

// Components
export * from "./components/hyperscape/index.js";

// Hooks
export * from "./hooks/hyperscape/useHyperscapeAgent.js";
export { useHyperscapePlugin } from "./hooks/use-hyperscape-plugin.js";
export type {
  HyperscapePluginConfig,
  UseAgentHook,
} from "./hooks/use-hyperscape-plugin.js";
export { useHyperscapeWebSocket } from "./hooks/use-hyperscape-websocket.js";

// Types
export * from "./types/hyperscape/index.js";
