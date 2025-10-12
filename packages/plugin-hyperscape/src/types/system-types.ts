/**
 * Specific system types for Hyperscape plugin
 */

import { THREE } from '@hyperscape/shared'
import { System } from './core-types'

// Agent Controls system interface
export interface AgentControlsSystem extends System {
  goto?(x: number, z: number): Promise<void>
  move?(direction: { x: number; z: number }, speed?: number): void
  jump?(): void
  stop?(): void
  setVelocity?(velocity: THREE.Vector3): void
}

// Helpers for type guards
export function isAgentControlsSystem(
  system: System
): system is AgentControlsSystem {
  return system.constructor.name === 'AgentControls' && 'goto' in system
}
