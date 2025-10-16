/**
 * Content and state management types for Hyperscape plugin
 *
 * CLAUDE.md Compliance: State management classes moved to ../classes/state-classes.ts
 * Prefer classes over interfaces for types with behavior
 */

import { Action, Provider } from "@elizaos/core";
import { World, Vector3 } from "./core-types";
import { Position, ContentInstance } from "./core-types";

// Re-export state management classes (CLAUDE.md: prefer classes over interfaces)
export {
  RPGStateManager,
  PlayerState,
  RPGPlayerStats,
  SkillInfo,
  InventoryState,
  InventoryItem,
  CombatState,
  CombatStats,
} from "../classes/state-classes";

// Note: All state management types converted to classes per CLAUDE.md
// Classes provide better encapsulation and behavior management
// See ../classes/state-classes.ts for implementations

// World state (keeping as interface - no behavior)
export interface WorldState {
  id: string;
  name: string;
  time: number;
  weather: WeatherState;
  entities: Map<string, EntityState>;
  resources: Map<string, ResourceState>;
}

// Weather state
export interface WeatherState {
  type: "clear" | "rain" | "snow" | "fog" | "storm";
  intensity: number;
  windDirection: number;
  windSpeed: number;
}

// Entity state
export interface EntityState {
  id: string;
  type: string;
  position: Position;
  health?: number;
  maxHealth?: number;
  behavior?: string;
  metadata?: Record<string, string | number | boolean>;
}

// Resource state
export interface ResourceState {
  id: string;
  type: string;
  position: Position;
  quantity: number;
  maxQuantity: number;
  respawnTime?: number;
  lastHarvestTime?: number;
}

// Content instance - using the one from core-types
// (removed duplicate definition)

// Entity modification data
export interface EntityModificationData {
  position?: Position;
  rotation?: { x: number; y: number; z: number; w: number };
  scale?: { x: number; y: number; z: number };
  velocity?: Position;
  health?: number;
  state?: string;
  metadata?: Record<string, string | number | boolean>;
}

// Teleport options
export interface TeleportOptions {
  position: Position;
  rotationY?: number;
  instant?: boolean;
}

// Physics options
export interface PhysicsBodyOptions {
  id?: string;
  position?: Position;
  mass?: number;
  friction?: number;
  restitution?: number;
  shape?: "box" | "sphere" | "capsule";
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
  };
}

// CharacterControllerOptions is now exported from core-types.ts to avoid circular dependencies

// Physics body options
export interface PhysicsBodyOptions {
  type?: "static" | "dynamic" | "kinematic";
  mass?: number;
  friction?: number;
  restitution?: number;
  linearDamping?: number;
  angularDamping?: number;
  isTrigger?: boolean;
  lockRotation?: boolean;
}

// Teleport options
export interface TeleportOptions {
  position: Vector3;
  rotation?: { x: number; y: number; z: number; w: number };
  validatePosition?: boolean;
  fadeTransition?: boolean;
  fadeDuration?: number;
  checkCollisions?: boolean;
}

// Entity modification data
export interface EntityModificationData {
  position?: Vector3;
  rotation?: { x: number; y: number; z: number; w: number };
  scale?: { x: number; y: number; z: number };
  components?: Record<string, string | number | boolean>;
  metadata?: Record<string, string | number | boolean>;
  visible?: boolean;
  active?: boolean;
}
