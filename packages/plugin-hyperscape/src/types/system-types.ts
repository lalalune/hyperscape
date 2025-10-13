/**
 * Specific system types for Hyperscape plugin
 */

import { THREE } from "@hyperscape/shared";
import { System } from "./core-types";
import type { ClientInput } from "@hyperscape/shared";

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
  system: System,
): system is ClientInputSystem {
  return system.constructor.name === "ClientInput" && "goto" in system;
}

// Backward compatibility alias (deprecated, use ClientInputSystem)
export type AgentControlsSystem = ClientInputSystem;
export const isAgentControlsSystem = isClientInputSystem;
