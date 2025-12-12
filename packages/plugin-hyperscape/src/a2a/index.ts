/**
 * A2A Integration for Hyperscape Plugin
 *
 * Exports A2A client and utilities for enabling
 * Agent-to-Agent communication with Hyperscape.
 */

export { HyperscapeA2AClient, createA2AClient } from "./client.js";
export type {
  A2AAgentCard,
  A2ASkill,
  A2AMessage,
  A2ATaskResult,
} from "./client.js";
