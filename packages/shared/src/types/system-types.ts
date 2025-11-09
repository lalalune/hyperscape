/**
 * System Types
 * All ECS system configuration and system-specific interface definitions
 */

import type { SystemDependencies } from "../systems/System";
import type { HeadstoneData } from "./entities";

// ============== SYSTEM CONFIGURATION ==============

/**
 * SystemConfig - base configuration for all systems
 */
export interface SystemConfig {
  name: string;
  dependencies: SystemDependencies;
  autoCleanup: boolean;
}

// ============== SYSTEM-SPECIFIC INTERFACES ==============

/**
 * IPlayerSystemForPersistence - interface for PlayerSystem used by PersistenceSystem
 */
export interface IPlayerSystemForPersistence {
  saveAllPlayers(): Promise<number>;
  getPlayerCount(): number;
  getOnlinePlayerIds(): string[];
}

/**
 * HeadstoneApp - interface for headstone/gravestone application
 */
export interface HeadstoneApp {
  init(): Promise<void>;
  destroy(): void;
  update(dt: number): void;
  getHeadstoneData(): HeadstoneData;
}

/**
 * EntitySpawnRequest - request to spawn an entity
 */
export interface EntitySpawnRequest {
  type: "item" | "mob" | "npc" | "resource" | "static";
  config: unknown; // EntityConfig - will need proper import
}
