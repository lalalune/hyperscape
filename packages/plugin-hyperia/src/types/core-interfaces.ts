/**
 * core-interfaces.ts - Core ElizaOS Integration Types
 *
 * Type definitions for ElizaOS to Hyperia integration interfaces.
 */

// Core interfaces for Hyperia plugin integration
import type {
  IAgentRuntime,
  Memory,
  State,
  Action,
  Provider,
  Service,
  UUID,
} from "@elizaos/core";

// Import types from local core-types (not @hyperforge/shared)
import type {
  World,
  Entity,
  System,
  Player,
  Vector3,
  Quaternion,
  Component,
  Physics,
  Entities,
  Events,
  WorldOptions,
  Position,
  ContentInstance,
} from "./core-types.js";

// Core agent interfaces for Hyperia integration
export interface AgentContext {
  runtime: IAgentRuntime;
  agentId: UUID;
  worldId?: string;
  position?: Vector3;
  rotation?: Quaternion;
}

// Note: The actual HyperiaService implementation is in services/HyperiaService.ts
// This interface provides a minimal type contract for external use
export interface IHyperiaService extends Service {
  // Connection state
  isConnected(): boolean;
  connect(serverUrl: string): Promise<void>;
  disconnect(): Promise<void>;

  // Game state access
  getPlayerEntity(): Player | null;
  getNearbyEntities(): Entity[];
  getGameState(): unknown;
  getWorldMapSignature(): string | null;

  // Command execution
  executeMove(command: { target: Position; runMode?: boolean }): Promise<void>;
  executeAttack(command: { targetEntityId: string }): Promise<void>;
  executeChatMessage(command: { message: string }): Promise<void>;
}

export interface AgentState {
  agentId: UUID;
  worldId?: string;
  position?: Vector3;
  rotation?: Quaternion;
  isConnected: boolean;
  lastActivity: Date;
  metadata?: Record<string, unknown>;
}

export interface WorldState {
  worldId: string;
  connectedAgents: UUID[];
  entities: Record<string, Entity>;
  lastUpdate: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentMemory extends Memory {
  agentId: UUID;
  worldId?: UUID;
  position?: Vector3;
  rotation?: Quaternion;
  lastAction?: string;
  relationships?: Record<UUID, unknown>;
}

export interface HyperiaAction extends Action {
  // Hyperia-specific action properties
  worldRequired?: boolean;
  entityRequired?: boolean;
  permissions?: string[];
  cooldown?: number;
}

export interface HyperiaProvider extends Provider {
  // Hyperia-specific provider properties
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

// Event interfaces for Hyperia integration
export interface HyperiaEvent {
  type: string;
  data: unknown;
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
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
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
  data: unknown;
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

// Re-export types for convenience
export type {
  World,
  Entity,
  System,
  Player,
  Vector3,
  Quaternion,
  Component,
  Physics,
  Entities,
  Events,
  WorldOptions,
  Position,
  ContentInstance,
};
