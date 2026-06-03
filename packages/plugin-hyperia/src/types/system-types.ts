/**
 * Specific system types for Hyperia plugin
 */

import type { System } from "./core-types";

// ClientInput interface defined locally
interface ClientInput {
  // Standard input properties
  enabled: boolean;
}

// Client Input system interface with agent control methods
// ClientInput now provides both hardware input and programmatic agent control
export interface ClientInputSystem extends System {
  goto?(x: number, z: number): Promise<boolean>;
  followEntity?(entityId: string): Promise<boolean>;
  stopNavigation?(): void;
  stopAllActions?(): void;
  startRandomWalk?(): void;
  stopRandomWalk?(): void;
  getIsWalkingRandomly?(): boolean;
  getIsNavigating?(): boolean;
}

// Type guard for ClientInput with agent methods
export function isClientInputSystem(
  system: unknown,
): system is ClientInputSystem {
  return (
    system !== null &&
    typeof system === "object" &&
    system.constructor.name === "ClientInput" &&
    "goto" in system
  );
}

// Backward compatibility alias (deprecated, use ClientInputSystem)
export type AgentControlsSystem = ClientInputSystem;
export const isAgentControlsSystem = isClientInputSystem;
