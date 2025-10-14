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

// Import and re-export Zod-validated types for strict type safety (CLAUDE.md compliance)
import type { EntityCreationData, EntityUpdateData, Metadata } from "./validation-schemas";
export type { EntityCreationData, EntityUpdateData, Metadata };

// Core agent classes for Hyperscape integration (CLAUDE.md: prefer classes over interfaces)
export class AgentContext {
  constructor(
    public runtime: IAgentRuntime,
    public agentId: UUID,
    public worldId?: string,
    public position?: Vector3,
    public rotation?: Quaternion,
  ) {}

  isInWorld(): boolean {
    return !!this.worldId;
  }

  hasPosition(): boolean {
    return !!this.position;
  }

  toJSON(): Record<string, string | number | boolean> {
    return {
      agentId: this.agentId,
      worldId: this.worldId || '',
      hasPosition: this.hasPosition(),
    };
  }
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
  getWorldState(): WorldState;
  updateWorldState(state: Partial<WorldState>): Promise<void>;
}

export interface BuildManager {
  // Build system methods
  createEntity(type: string, position: Vector3, data?: EntityCreationData): Entity | null;
  destroyEntity(entityId: string): boolean;
  updateEntity(entityId: string, data: EntityUpdateData): boolean;

  // Build validation
  canBuild(position: Vector3, type: string): boolean;
  getBuildPermissions(agentId: UUID): string[];
}

export class AgentState {
  constructor(
    public agentId: UUID,
    public isConnected: boolean,
    public lastActivity: Date,
    public worldId?: string,
    public position?: Vector3,
    public rotation?: Quaternion,
    public metadata?: Record<string, string | number | boolean>,
  ) {}

  updateActivity(): void {
    this.lastActivity = new Date();
  }

  connect(worldId: string): void {
    this.isConnected = true;
    this.worldId = worldId;
    this.updateActivity();
  }

  disconnect(): void {
    this.isConnected = false;
    this.updateActivity();
  }

  isActive(timeoutMs: number = 60000): boolean {
    const now = Date.now();
    return now - this.lastActivity.getTime() < timeoutMs;
  }
}

export class WorldState {
  constructor(
    public worldId: string,
    public connectedAgents: UUID[],
    public entities: Record<string, Entity>,
    public lastUpdate: Date,
    public metadata?: Record<string, string | number | boolean>,
  ) {}

  addAgent(agentId: UUID): void {
    if (!this.connectedAgents.includes(agentId)) {
      this.connectedAgents.push(agentId);
      this.lastUpdate = new Date();
    }
  }

  removeAgent(agentId: UUID): void {
    const index = this.connectedAgents.indexOf(agentId);
    if (index > -1) {
      this.connectedAgents.splice(index, 1);
      this.lastUpdate = new Date();
    }
  }

  getAgentCount(): number {
    return this.connectedAgents.length;
  }

  getEntityCount(): number {
    return Object.keys(this.entities).length;
  }
}

export interface AgentMemory extends Memory {
  agentId: UUID;
  worldId?: UUID;
  position?: Vector3;
  rotation?: Quaternion;
  lastAction?: string;
  relationships?: Record<UUID, RelationshipData>;
}

export class RelationshipData {
  constructor(
    public agentId: UUID,
    public relationship: "friend" | "neutral" | "enemy",
    public trust: number,
    public lastInteraction: Date,
  ) {}

  updateTrust(delta: number): void {
    this.trust = Math.max(-100, Math.min(100, this.trust + delta));
    this.lastInteraction = new Date();
    this.updateRelationship();
  }

  private updateRelationship(): void {
    if (this.trust > 50) {
      this.relationship = "friend";
    } else if (this.trust < -50) {
      this.relationship = "enemy";
    } else {
      this.relationship = "neutral";
    }
  }

  interact(): void {
    this.lastInteraction = new Date();
  }

  isFriend(): boolean {
    return this.relationship === "friend";
  }

  isEnemy(): boolean {
    return this.relationship === "enemy";
  }
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

export class MessageContext {
  constructor(
    public runtime: IAgentRuntime,
    public message: Memory,
    public state: State,
    public agentId: UUID,
    public worldId?: string,
    public entityId?: string,
    public position?: Vector3,
  ) {}

  hasWorld(): boolean {
    return !!this.worldId;
  }

  hasEntity(): boolean {
    return !!this.entityId;
  }

  getMessageText(): string {
    return this.message.content.text || '';
  }
}

// Event classes for Hyperscape integration (CLAUDE.md: prefer classes over interfaces)
export class HyperscapeEvent {
  constructor(
    public type: string,
    public data: Record<string, string | number | boolean>,
    public timestamp: number,
    public agentId?: UUID,
    public worldId?: string,
    public entityId?: string,
  ) {}

  static create(
    type: string,
    data: Record<string, string | number | boolean>,
    agentId?: UUID,
    worldId?: string,
  ): HyperscapeEvent {
    return new HyperscapeEvent(type, data, Date.now(), agentId, worldId);
  }

  hasAgent(): boolean {
    return !!this.agentId;
  }

  hasWorld(): boolean {
    return !!this.worldId;
  }
}

export class AgentConnection {
  constructor(
    public agentId: UUID,
    public worldId: string,
    public connectedAt: Date,
    public lastPing: Date,
    public isActive: boolean,
  ) {}

  ping(): void {
    this.lastPing = new Date();
    this.isActive = true;
  }

  disconnect(): void {
    this.isActive = false;
  }

  getConnectionDuration(): number {
    return Date.now() - this.connectedAt.getTime();
  }

  isStale(timeoutMs: number = 30000): boolean {
    return Date.now() - this.lastPing.getTime() > timeoutMs;
  }
}

// Utility classes (CLAUDE.md: prefer classes over interfaces)
export class ProviderResult {
  constructor(
    public success: boolean,
    public data?: Record<string, string | number | boolean>,
    public error?: string,
    public metadata?: Record<string, string | number | boolean>,
  ) {}

  static createSuccess(
    data?: Record<string, string | number | boolean>,
    metadata?: Record<string, string | number | boolean>,
  ): ProviderResult {
    return new ProviderResult(true, data, undefined, metadata);
  }

  static createError(error: string): ProviderResult {
    return new ProviderResult(false, undefined, error);
  }
}

export class ActionResult {
  constructor(
    public success: boolean,
    public message?: string,
    public data?: Record<string, string | number | boolean>,
    public error?: string,
  ) {}

  static createSuccess(
    message?: string,
    data?: Record<string, string | number | boolean>,
  ): ActionResult {
    return new ActionResult(true, message, data);
  }

  static createError(error: string): ActionResult {
    return new ActionResult(false, undefined, undefined, error);
  }
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

// Network classes for multiplayer functionality (CLAUDE.md: prefer classes over interfaces)
export class NetworkMessage {
  constructor(
    public type: string,
    public data: Record<string, string | number | boolean>,
    public timestamp: number,
    public sender?: UUID,
    public recipients?: UUID[],
    public reliable?: boolean,
  ) {}

  static create(
    type: string,
    data: Record<string, string | number | boolean>,
    sender?: UUID,
    recipients?: UUID[],
    reliable: boolean = true,
  ): NetworkMessage {
    return new NetworkMessage(type, data, Date.now(), sender, recipients, reliable);
  }

  isBroadcast(): boolean {
    return !this.recipients || this.recipients.length === 0;
  }

  isDirectMessage(): boolean {
    return !!this.recipients && this.recipients.length === 1;
  }
}

export interface NetworkHandler {
  handleMessage(message: NetworkMessage): Promise<void>;
  sendMessage(message: NetworkMessage): Promise<void>;
  broadcast(message: NetworkMessage): Promise<void>;
}

// Re-export ChatMessage for use in plugin
// export type { ChatMessage } from '@hyperscape/shared'
