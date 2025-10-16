// Core types for plugin-hyperscape - imports from @hyperscape/shared and @elizaos/core
import { Action, IAgentRuntime, Provider, Service, UUID } from "@elizaos/core";

// Import classes and types from hyperscape package
import { System, World } from "@hyperscape/shared";

import type {
  Component,
  Events as BaseEvents,
  Quaternion,
  Vector3,
  WorldOptions,
  Player as HyperscapePlayer,
  Entity as HyperscapeEntity,
  Entities as HyperscapeEntities,
  ChatMessage as HyperscapeChatMessage,
  PlayerInput,
  PlayerStats,
  Physics as HyperscapePhysics,
  RigidBody as HyperscapeRigidBody,
  Collider,
  PhysicsMaterial,
} from "@hyperscape/shared";

// Re-export RigidBody from shared - it has the interface we need
export type RigidBody = HyperscapeRigidBody;

export interface Avatar {
  id: string;
  name: string;
  url?: string;
}

// Re-export ChatMessage from shared with plugin-specific extensions
export type ChatMessage = HyperscapeChatMessage & {
  // Plugin-specific extensions if needed
  message?: string; // For backward compatibility
};

export interface ChatListener {
  (messages: ChatMessage[]): void;
}

// Re-export hyperscape classes and types for plugin use
export { System, World };
export type {
  Component,
  BaseEvents as Events,
  Quaternion,
  Vector3,
  WorldOptions,
  PlayerInput,
  PlayerStats,
};

// Re-export the aliased Entity type
export type Entity = HyperscapeEntity & {
  base?: {
    position: Vector3;
    visible?: boolean;
    children?: Entity[];
    parent?: Entity | null;
  };
};

// Re-export the aliased Entities type
export type Entities = HyperscapeEntities;

// Plugin-specific Physics interface extends shared Physics
// Note: We extend HyperscapePhysics with controller management for AI agent use
export interface Physics extends HyperscapePhysics {
  // Additional plugin-specific properties
  controllers?: Map<string, CharacterController>;
  rigidBodies?: Map<string, RigidBody>;

  // Additional plugin-specific methods
  step?: (deltaTime: number) => void;
  createCharacterController?: (options: CharacterControllerOptions) => CharacterController;
}

// Extended Player type with movement methods for plugin use
export type Player = HyperscapePlayer & {
  // Movement methods for AI agent control
  walkToward?: (
    targetPosition: { x: number; y?: number; z: number },
    speed?: number,
  ) => Position;
  walk?: (direction: { x: number; z: number }, speed?: number) => Position;
  teleport?: (options: { position?: Position; rotationY?: number }) => void;
  modify?: (data: { name?: string; avatar?: string; color?: string }) => void;
  setSessionAvatar?: (url: string) => void;
};

// Export plugin-specific interfaces from core-interfaces
export type { HyperscapeAction, HyperscapeProvider } from "./core-interfaces";

// Character controller options (defined here to avoid circular dependencies)
export interface CharacterControllerOptions {
  height?: number;
  radius?: number;
  stepHeight?: number;
  slopeLimit?: number;
  skinWidth?: number;
  minMoveDistance?: number;
  center?: { x: number; y: number; z: number };
  mass?: number;
  drag?: number;
  angularDrag?: number;
  useGravity?: boolean;
  isKinematic?: boolean;
}

// Position type (alias for Vector3 for backwards compatibility)
export type Position = Vector3;

// Transform type
export interface Transform {
  position?: Position;
  rotation?: Quaternion;
  scale?: Position;
}

// Network data type
export type NetworkData = Record<string, string | number | boolean | string[]>;

// Network connection class
export class NetworkConnection {
  public id: string;
  public socket?: WebSocket;
  public lastPing: number;
  public metadata: Record<string, string | number>;

  constructor(id: string, socket?: WebSocket) {
    this.id = id;
    this.socket = socket;
    this.lastPing = Date.now();
    this.metadata = {};
  }

  updatePing(): void {
    this.lastPing = Date.now();
  }

  getTimeSinceLastPing(): number {
    return Date.now() - this.lastPing;
  }

  isAlive(timeout: number = 30000): boolean {
    return this.getTimeSinceLastPing() < timeout;
  }
}

// Network system class - manages network connections and messaging
export class NetworkSystem {
  public id: string | null;
  public connections: Map<string, NetworkConnection>;
  public maxUploadSize: number;

  constructor(id: string | null = null) {
    this.id = id;
    this.connections = new Map();
    this.maxUploadSize = 10 * 1024 * 1024; // 10MB default
  }

  broadcast(event: string, data?: NetworkData): void {
    this.connections.forEach(connection => {
      if (connection.socket?.readyState === WebSocket.OPEN) {
        connection.socket.send(JSON.stringify({ event, data }));
      }
    });
  }

  send(event: string, data?: NetworkData): void {
    // Override in implementation
    console.log(`NetworkSystem: send ${event}`, data);
  }

  async upload(file: File): Promise<string> {
    if (file.size > this.maxUploadSize) {
      throw new ServiceError(
        `File size ${file.size} exceeds max upload size ${this.maxUploadSize}`,
        'FILE_TOO_LARGE'
      );
    }
    // Override in implementation
    throw new ServiceError('Upload not implemented', 'NOT_IMPLEMENTED');
  }

  async disconnect(): Promise<void> {
    this.connections.forEach(connection => {
      connection.socket?.close();
    });
    this.connections.clear();
  }

  addConnection(connection: NetworkConnection): void {
    this.connections.set(connection.id, connection);
  }

  removeConnection(id: string): void {
    this.connections.delete(id);
  }

  getActiveConnections(): NetworkConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.isAlive());
  }
}

// Chat system class - manages chat messages and listeners
export class ChatSystem {
  public msgs: ChatMessage[];
  public listeners: ((msgs: ChatMessage[]) => void)[];

  constructor() {
    this.msgs = [];
    this.listeners = [];
  }

  add(message: ChatMessage, broadcast: boolean = true): void {
    this.msgs.push(message);
    if (broadcast) {
      this.notifyListeners();
    }
  }

  subscribe(callback: (msgs: ChatMessage[]) => void): () => void {
    this.listeners.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  clear(): void {
    this.msgs = [];
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.msgs]));
  }
}

// EventData is imported from event-types.ts (re-exported via index)
// Event system types - plugin-specific class with event management
export class EventSystem {
  public listeners: Map<string, ((data: Record<string, string | number | boolean>) => void)[]>;

  constructor() {
    this.listeners = new Map();
  }

  emit(eventName: string, data?: Record<string, string | number | boolean>): void {
    const callbacks = this.listeners.get(eventName);
    if (callbacks) {
      callbacks.forEach(callback => callback(data || {}));
    }
  }

  on(eventName: string, callback: (data: Record<string, string | number | boolean>) => void): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)!.push(callback);
  }

  off(eventName: string, callback?: (data: Record<string, string | number | boolean>) => void): void {
    if (!callback) {
      this.listeners.delete(eventName);
      return;
    }

    const callbacks = this.listeners.get(eventName);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

// World configuration - plugin-specific configuration that extends WorldOptions
export interface WorldConfig extends WorldOptions {
  viewport?: HTMLElement | MockElement;
  ui?: HTMLElement | MockElement;
  initialAuthToken?: string;
  loadPhysX?: () => Promise<unknown>;
  name?: string;
  avatar?: string;
  // Explicitly include properties from WorldOptions for TypeScript resolution
  wsUrl?: string;
  physics?: boolean;
  assetsUrl?: string;
  networkRate?: number;
}

export interface MockElement {
  appendChild: (child: HTMLElement | MockElement) => void;
  removeChild: (child: HTMLElement | MockElement) => void;
  offsetWidth: number;
  offsetHeight: number;
  addEventListener: (event: string, handler: EventListener | ((event: Event) => void)) => void;
  removeEventListener: (event: string, handler: EventListener | ((event: Event) => void)) => void;
  style: Record<string, string | number>;
}

// Content bundle configuration type
export type ContentBundleConfig = Record<string, string | number | boolean | Record<string, string | number | boolean>>;

// Event handler function type
export type NetworkEventHandler = (data: NetworkData) => void;

// Content bundle types
export interface ContentBundle {
  id: string;
  name: string;
  description?: string;
  version?: string;
  actions?: Action[];
  providers?: Provider[];
  handlers?: NetworkEventHandler[];
  dynamicActions?: HyperscapeActionDescriptor[];
  config?: ContentBundleConfig;
  install?: (world: World, runtime: IAgentRuntime) => Promise<ContentInstance>;
}

export interface ContentInstance {
  actions?: Action[];
  providers?: Provider[];
  dynamicActions?: string[];
  metadata?: Record<string, string | number>;
  uninstall?: () => Promise<void>;
}

// Action descriptor type
export interface HyperscapeActionDescriptor {
  name: string;
  description: string;
  parameters: ActionParameter[];
  examples: string[];
  category:
    | "combat"
    | "inventory"
    | "skills"
    | "quest"
    | "social"
    | "movement"
    | "other";
  handler?: string;
}

export interface ActionParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  description: string;
  default?: string | number | boolean;
}

// Action handler options type
export type ActionHandlerOptions = Record<string, string | number | boolean>;

// Manager types
export interface ManagerInterface {
  runtime: IAgentRuntime;
  start?(): void;
  stop?(): void;
  isActive?(): boolean;
}

// Response types
export class ResponseContent {
  public text?: string;
  public action?: string;
  public emote?: string;
  public thought?: string;
  public data?: Record<string, string | number | boolean>;

  constructor(text?: string, action?: string) {
    this.text = text;
    this.action = action;
  }

  setEmote(emote: string): void {
    this.emote = emote;
  }

  setThought(thought: string): void {
    this.thought = thought;
  }

  setData(key: string, value: string | number | boolean): void {
    if (!this.data) {
      this.data = {};
    }
    this.data[key] = value;
  }

  toJSON(): Record<string, string | number | boolean | Record<string, string | number | boolean> | undefined> {
    return {
      text: this.text,
      action: this.action,
      emote: this.emote,
      thought: this.thought,
      ...(this.data || {})
    };
  }
}

export interface BehaviorResponse {
  content: ResponseContent;
  context: string;
}

// Multi-agent types
export class AgentInstance {
  public id: UUID;
  public runtime: IAgentRuntime;
  public service: Service;
  public name: string;
  public position?: Position;
  public status: "connecting" | "connected" | "disconnected" | "error";
  public lastUpdate: number;

  constructor(
    id: UUID,
    runtime: IAgentRuntime,
    service: Service,
    name: string
  ) {
    this.id = id;
    this.runtime = runtime;
    this.service = service;
    this.name = name;
    this.status = "connecting";
    this.lastUpdate = Date.now();
  }

  updateStatus(status: "connecting" | "connected" | "disconnected" | "error"): void {
    this.status = status;
    this.lastUpdate = Date.now();
  }

  updatePosition(position: Position): void {
    this.position = position;
    this.lastUpdate = Date.now();
  }

  isConnected(): boolean {
    return this.status === "connected";
  }

  getTimeSinceUpdate(): number {
    return Date.now() - this.lastUpdate;
  }
}

export interface MultiAgentConfig {
  worldUrl: string;
  maxAgents: number;
  agentSpacing: number;
  enableAutonomy?: boolean;
}

// File upload types
export interface FileUploadResult {
  url: string;
  hash: string;
  size: number;
}

// Service configuration
export interface ServiceConfig {
  wsUrl: string;
  authToken?: string;
  worldId: UUID;
}

// Service error class - custom error with code and details
export class ServiceError extends Error {
  public code?: string;
  public details?: Record<string, string | number | boolean>;

  constructor(
    message: string,
    code?: string,
    details?: Record<string, string | number | boolean>
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceError);
    }
  }
}

// Model type enum (from core-interfaces.ts)
export enum ModelType {
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
  SMART = "smart",
}

export class CharacterController {
  public id: string;
  public position: Position;
  public velocity: Position;
  public isGrounded: boolean;
  public radius: number;
  public height: number;
  public maxSpeed: number;

  constructor(
    id: string,
    options: CharacterControllerOptions = {}
  ) {
    this.id = id;
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.isGrounded = false;
    this.radius = options.radius || 0.5;
    this.height = options.height || 1.8;
    this.maxSpeed = 5.0;
  }

  move(displacement: Position): void {
    this.position.x += displacement.x;
    this.position.y += displacement.y;
    this.position.z += displacement.z;
  }

  jump(): void {
    if (this.isGrounded) {
      this.velocity.y = 5.0;
      this.isGrounded = false;
    }
  }

  walkToward(
    targetPosition: { x: number; y?: number; z: number },
    speed: number = this.maxSpeed
  ): Position {
    const dx = targetPosition.x - this.position.x;
    const dz = targetPosition.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > 0.1) {
      const normalizedX = dx / distance;
      const normalizedZ = dz / distance;

      this.position.x += normalizedX * speed * 0.016; // Assuming 60fps
      this.position.z += normalizedZ * speed * 0.016;
    }

    return this.position;
  }

  walk(direction: { x: number; z: number }, speed: number = this.maxSpeed): Position {
    this.position.x += direction.x * speed * 0.016;
    this.position.z += direction.z * speed * 0.016;
    return this.position;
  }

  setPosition(position: Position): void {
    this.position = { ...position };
  }

  getPosition(): Position {
    return { ...this.position };
  }

  getVelocity(): Position {
    return { ...this.velocity };
  }
}

// CharacterControllerOptions is defined in content-types.ts

// Control and InputState types for plugin compatibility
export interface Control {
  id: string;
  playerId: string;
  enabled: boolean;
  keys?: Record<string, InputState>;
  mouse?: { x: number; y: number; buttons: Record<number, boolean> };
  touch?: { x: number; y: number; active: boolean };
}

export interface InputState {
  down: boolean;
  pressed: boolean;
  released: boolean;
}

export interface BaseObject {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

export interface AppearanceComponent extends Component {
  type: "appearance";
}
