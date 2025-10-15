/**
 * ElizaOS Core Re-exports
 *
 * This module provides a central import point for ElizaOS core types and utilities.
 * By re-exporting from one location, we ensure consistent type imports across the
 * plugin and simplify dependency management.
 *
 * **Re-exported from @elizaos/core**:
 * - Type definitions for agents, runtime, services, actions, providers
 * - Core utilities for logging, UUID generation, memory management
 * - Event types and handlers for the agent lifecycle
 * - Plugin interfaces and base classes
 *
 * **Usage**:
 * ```typescript
 * import { IAgentRuntime, logger, Service } from './core';
 * // Instead of:
 * // import { IAgentRuntime, logger, Service } from '@elizaos/core';
 * ```
 *
 * **Benefits**:
 * - Single source of truth for ElizaOS imports
 * - Easier to mock for testing
 * - Clearer separation between ElizaOS and Hyperscape types
 *
 * **Referenced by**: All plugin files that need ElizaOS core functionality
 */

// Re-export all types from @elizaos/core as a central import point
export * from "@elizaos/core";
