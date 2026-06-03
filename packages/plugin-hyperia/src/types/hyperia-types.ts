// Hyperia-specific types and interfaces
import type {
  World,
  Entity,
  System,
  Player,
  Vector3,
  Quaternion,
  Component,
  WorldOptions,
} from "./core-types";

import type { UUID } from "@elizaos/core";

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
    lighting?: unknown;
    skybox?: string;
    terrain?: unknown;
  };
}

// Hyperia world manager interface
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
  metadata?: Record<string, unknown>;
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
  data?: unknown;
  timestamp: number;
}

// Hyperia asset types
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
  metadata?: Record<string, unknown>;
}

// Component template
export interface ComponentTemplate {
  type: string;
  data: Record<string, unknown>;
}

// Agent behavior configuration
export interface AgentBehaviorConfig {
  agentId: UUID;
  behaviors: BehaviorTemplate[];
  priorities: Record<string, number>;
  conditions: Record<string, unknown>;
}

// Behavior template
export interface BehaviorTemplate {
  name: string;
  type: "movement" | "interaction" | "communication" | "combat" | "idle";
  config: Record<string, unknown>;
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
  WorldManager as HyperiaWorldManager,
  AgentSpawnConfig as HyperiaAgentSpawnConfig,
  WorldEvent as HyperiaWorldEvent,
  AssetReference as HyperiaAssetReference,
  PersistenceConfig as HyperiaPersistenceConfig,
  PhysicsConfig as HyperiaPhysicsConfig,
  LightingConfig as HyperiaLightingConfig,
  EnvironmentConfig as HyperiaEnvironmentConfig,
  EntityTemplate as HyperiaEntityTemplate,
  ComponentTemplate as HyperiaComponentTemplate,
  AgentBehaviorConfig as HyperiaAgentBehaviorConfig,
  BehaviorTemplate as HyperiaBehaviorTemplate,
  PerformanceMetrics as HyperiaPerformanceMetrics,
  DebugConfig as HyperiaDebugConfig,
};
