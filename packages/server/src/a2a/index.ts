/**
 * A2A Module Exports
 * Centralized exports for A2A integration
 */

export { generateAgentCard } from "./agentCard.js";
export { A2AServer } from "./server.js";
export { ERC8004RegistryClient, autoRegisterToRegistry } from "./registry.js";
export type { A2AAgentCard, A2ASkill } from "./agentCard.js";
export type { JSONRPCRequest, JSONRPCResponse, A2AMessage } from "./server.js";
export type { RegistrationResult } from "./registry.js";
