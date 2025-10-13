/**
 * core-interfaces.ts - Core ElizaOS Integration Types
 *
 * Type definitions for ElizaOS to Hyperscape integration interfaces.
 */

// Core interfaces for Hyperscape plugin integration
import type {
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  Action,
  Provider,
  Service,
  UUID,
} from "@elizaos/core";

import { World, Entity, System } from "./core-types";
import type {
  Player,
  Vector3,
  Quaternion,
  Component,
} from "@hyperscape/shared";

// Core agent interfaces for Hyperscape integration
export interface AgentContext {
  runtime: IAgentRuntime;
  agentId: UUID;
  worldId?: string;
  position?: Vector3;
  rotation?: Quaternion;
}

export interface HyperscapeService extends Service {
  // Core service methods
  initialize(runtime: IAgentRuntime): Promise<void>;
  getWorld(): World | null;
  connect(worldId: string): Promise<void>;
  disconnect(): Promise<void>;

  // Entity management
  spawnAgent(agentId: UUID, position?: Vector3): Promise<Entity | null>;
  despawnAgent(agentId: UUID): Promise<void>;
  getAgentEntity(agentId: UUID): Entity | null;

  // Movement and positioning
  moveAgent(agentId: UUID, position: Vector3): Promise<void>;
  rotateAgent(agentId: UUID, rotation: Quaternion): Promise<void>;

  // Communication
  sendMessage(message: string, targetId?: UUID): Promise<void>;
  broadcast(message: string): Promise<void>;

  // Build system integration
  getBuildManager(): BuildManager | null;

  // World state
  getWorldState(): any;
  updateWorldState(state: any): Promise<void>;
}

export interface BuildManager {
  // Build system methods
  createEntity(type: string, position: Vector3, data?: any): Entity | null;
  destroyEntity(entityId: string): boolean;
  updateEntity(entityId: string, data: any): boolean;

  // Build validation
  canBuild(position: Vector3, type: string): boolean;
  getBuildPermissions(agentId: UUID): string[];
}

export interface AgentState {
  agentId: UUID;
  worldId?: string;
  position?: Vector3;
  rotation?: Quaternion;
  isConnected: boolean;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

export interface WorldState {
  worldId: string;
  connectedAgents: UUID[];
  entities: Record<string, any>;
  lastUpdate: Date;
  metadata?: Record<string, any>;
}

export interface AgentMemory extends Memory {
  agentId: UUID;
  worldId?: UUID;
  position?: Vector3;
  rotation?: Quaternion;
  lastAction?: string;
  relationships?: Record<UUID, any>;
}

export interface HyperscapeAction extends Action {
  // Hyperscape-specific action properties
  worldRequired?: boolean;
  entityRequired?: boolean;
  permissions?: string[];
  cooldown?: number;
}

export interface HyperscapeProvider extends Provider {
  // Hyperscape-specific provider properties
  worldAccess?: boolean;
  entityAccess?: boolean;
  realtime?: boolean;
}

export interface MessageContext {
  runtime: IAgentRuntime;
  message: Memory;
  state: State;
  agentId: UUID;
  worldId?: string;
  entityId?: string;
  position?: Vector3;
}

// Event interfaces for Hyperscape integration
export interface HyperscapeEvent {
  type: string;
  data: any;
  timestamp: number;
  agentId?: UUID;
  worldId?: string;
  entityId?: string;
}

export interface AgentConnection {
  agentId: UUID;
  worldId: string;
  connectedAt: Date;
  lastPing: Date;
  isActive: boolean;
}

// Utility interfaces
export interface ProviderResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

// System integration interfaces
export interface IGameSystem {
  id?: string;
  name: string;
  description?: string;
  dependencies?: string[];
  initialize(world: World): Promise<void>;
  update?(deltaTime: number): void;
  destroy?(): void;
  shutdown?(): Promise<void>;

  // Optional properties for system configuration
  enabled?: boolean;
  priority?: number;
}

// Character controller interface for movement systems
export interface ICharacterController {
  entity: Entity;
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;

  move(direction: Vector3): void;
  rotate(rotation: Quaternion): void;
  teleport(position: Vector3): void;

  isGrounded(): boolean;
  canMove(): boolean;
}

// Network interfaces for multiplayer functionality
export interface NetworkMessage {
  type: string;
  data: any;
  sender?: UUID;
  recipients?: UUID[];
  timestamp: number;
  reliable?: boolean;
}

export interface NetworkHandler {
  handleMessage(message: NetworkMessage): Promise<void>;
  sendMessage(message: NetworkMessage): Promise<void>;
  broadcast(message: NetworkMessage): Promise<void>;
}

// Re-export ChatMessage for use in plugin
// export type { ChatMessage } from '@hyperscape/shared'
