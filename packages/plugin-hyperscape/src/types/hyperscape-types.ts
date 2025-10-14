// Hyperscape-specific types and interfaces
import { World, Entity, System } from "./core-types";
import type {
  Player,
  Vector3,
  Quaternion,
  Component,
  WorldOptions,
} from "@hyperscape/shared";

import type { UUID } from "@elizaos/core";

// Lighting configuration
export interface LightingConfig {
  ambientLight?: {
    color: number;
    intensity: number;
  };
  directionalLight?: {
    color: number;
    intensity: number;
    position: Vector3;
    target: Vector3;
  };
  shadows?: {
    enabled: boolean;
    type: "basic" | "pcf" | "vsm";
    mapSize: number;
  };
}

// Environment configuration
export interface EnvironmentConfig {
  skybox?: string;
  fog?: {
    enabled: boolean;
    color: number;
    near: number;
    far: number;
  };
  terrain?: {
    enabled: boolean;
    heightmap?: string;
    texture?: string;
    size: { width: number; height: number };
  };
  water?: {
    enabled: boolean;
    level: number;
    color: number;
    transparency: number;
  };
}

// Mock world configuration for testing
export interface MockWorldConfig {
  worldId: string;
  name: string;
  description?: string;
  maxPlayers?: number;
  physics?: boolean;
  persistence?: boolean;
  assets?: string[];
  environment?: {
    lighting?: LightingConfig;
    skybox?: string;
    terrain?: EnvironmentConfig['terrain'];
  };
}

// Hyperscape world manager interface
export interface WorldManager {
  createWorld(config: MockWorldConfig): Promise<World>;
  destroyWorld(worldId: string): Promise<void>;
  getWorld(worldId: string): World | null;
  listWorlds(): MockWorldConfig[];

  // World state management
  saveWorldState(worldId: string): Promise<void>;
  loadWorldState(worldId: string): Promise<void>;
  resetWorld(worldId: string): Promise<void>;
}

// Agent spawn configuration
export interface AgentSpawnConfig {
  agentId: UUID;
  worldId: string;
  position?: Vector3;
  rotation?: Quaternion;
  avatar?: string;
  permissions?: string[];
  metadata?: Record<string, string | number | boolean>;
}

// World event types
export interface WorldEvent {
  type:
    | "entity_spawn"
    | "entity_despawn"
    | "entity_update"
    | "player_join"
    | "player_leave"
    | "world_update";
  worldId: string;
  entityId?: string;
  playerId?: UUID;
  data?: Record<string, string | number | boolean>;
  timestamp: number;
}

// Hyperscape asset types
export interface AssetReference {
  type: "model" | "texture" | "audio" | "script" | "data";
  url: string;
  name: string;
  version?: string;
  checksum?: string;
}

// World persistence configuration
export interface PersistenceConfig {
  enabled: boolean;
  saveInterval?: number;
  backupCount?: number;
  compressionEnabled?: boolean;
  encryptionEnabled?: boolean;
}

// Physics configuration for worlds
export interface PhysicsConfig {
  enabled: boolean;
  gravity?: Vector3;
  timestep?: number;
  maxSubsteps?: number;
  collisionLayers?: Record<string, number>;
}

// Complete world configuration
export interface CompleteWorldConfig {
  worldId: string;
  name: string;
  description?: string;
  maxPlayers?: number;
  physics?: PhysicsConfig | boolean;
  lighting?: LightingConfig;
  environment?: EnvironmentConfig;
  persistence?: PersistenceConfig | boolean;
  assets?: string[];
  networking?: {
    maxPlayers: number;
    tickRate: number;
    compression: boolean;
  };
}

// Entity template for spawning
export interface EntityTemplate {
  type: string;
  name: string;
  components: ComponentTemplate[];
  position?: Vector3;
  rotation?: Quaternion;
  scale?: Vector3;
  metadata?: Record<string, string | number | boolean>;
}

// Component template
export interface ComponentTemplate {
  type: string;
  data: Record<string, string | number | boolean>;
}

// Agent behavior configuration
export interface AgentBehaviorConfig {
  agentId: UUID;
  behaviors: BehaviorTemplate[];
  priorities: Record<string, number>;
  conditions: Record<string, string | number | boolean>;
}

// Behavior template
export interface BehaviorTemplate {
  name: string;
  type: "movement" | "interaction" | "communication" | "combat" | "idle";
  config: Record<string, string | number | boolean>;
  triggers: string[];
  cooldown?: number;
}

// Performance monitoring
export interface PerformanceMetrics {
  fps: number;
  entityCount: number;
  systemCount: number;
  memoryUsage: number;
  networkBandwidth: number;
  latency: number;
  timestamp: number;
}

// Debug configuration
export interface DebugConfig {
  enabled: boolean;
  showBoundingBoxes?: boolean;
  showWireframes?: boolean;
  showStats?: boolean;
  logLevel?: "error" | "warn" | "info" | "debug";
  profiling?: boolean;
}

// Export types avoiding conflicts
export type {
  WorldManager as HyperscapeWorldManager,
  AgentSpawnConfig as HyperscapeAgentSpawnConfig,
  WorldEvent as HyperscapeWorldEvent,
  AssetReference as HyperscapeAssetReference,
  PersistenceConfig as HyperscapePersistenceConfig,
  PhysicsConfig as HyperscapePhysicsConfig,
  LightingConfig as HyperscapeLightingConfig,
  EnvironmentConfig as HyperscapeEnvironmentConfig,
  EntityTemplate as HyperscapeEntityTemplate,
  ComponentTemplate as HyperscapeComponentTemplate,
  AgentBehaviorConfig as HyperscapeAgentBehaviorConfig,
  BehaviorTemplate as HyperscapeBehaviorTemplate,
  PerformanceMetrics as HyperscapePerformanceMetrics,
  DebugConfig as HyperscapeDebugConfig,
};
