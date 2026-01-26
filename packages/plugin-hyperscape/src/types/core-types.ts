// Core types for plugin-hyperscape - imports from @hyperscape/shared and @elizaos/core
import { Action, IAgentRuntime, Provider, Service, UUID } from "@elizaos/core";
import type {
  Vector3 as THREEVector3,
  Quaternion as THREEQuaternion,
  Object3D as THREEObject3D,
} from "three";

// Import classes from hyperscape (these are values)
import {
  SystemClass,
  World as WorldClass,
  Entity as EntityClass,
  Entities as EntitiesClass,
  EventBus,
  THREE,
} from "@hyperscape/shared";

// Import canonical types from hyperscape shared package
import type {
  Player,
  PlayerInput,
  PlayerStats,
  ChatMessage,
} from "@hyperscape/shared";

// Define local type aliases for THREE types
export type Vector3 = THREEVector3;
export type Quaternion = THREEQuaternion;
export type Object3D = THREEObject3D;

// Define World type as instance type of WorldClass
export type World = InstanceType<typeof WorldClass>;

// Define System type based on SystemClass
export type System = InstanceType<typeof SystemClass>;

// Define Entity interface locally
export interface Entity {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  node: {
    position: Vector3;
    quaternion: Quaternion;
    visible?: boolean;
    children?: unknown[];
    parent?: unknown | null;
  };
  base?: {
    position: Vector3;
    visible?: boolean;
    children?: unknown[];
    parent?: unknown | null;
  };
  velocity?: Vector3;
  speed?: number;
  isMoving?: boolean;
  targetPosition?: Vector3;
  movementPath?: Vector3[];
}

// Define Entities interface
export interface Entities {
  player?: Entity;
  players?: Map<string, Entity>;
  items?: Map<string, Entity>;
  get(id: string): Entity | null;
  add(data: EntityData, local?: boolean): Entity;
  remove(id: string): boolean;
  getAll(): Entity[];
  getAllPlayers(): Entity[];
}

// Define EntityData interface
export interface EntityData {
  id?: string;
  type: string;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  [key: string]: unknown;
}

// Define Component interface
export interface Component {
  type: string;
  data?: Record<string, unknown>;
}

// Define Events type
export type Events = typeof EventBus;

// Define WorldOptions interface locally
export interface WorldOptions {
  storage?: unknown;
  assetsDir?: string;
  assetsUrl?: string;
  physics?: boolean;
  renderer?: "webgpu" | "headless";
  networkRate?: number;
  maxDeltaTime?: number;
  fixedDeltaTime?: number;
  db?: unknown;
  wsUrl?: string;
  name?: string;
  avatar?: string;
}

// Re-export for convenience
export type { Player, PlayerInput, PlayerStats, ChatMessage };

// Define RigidBody interface
export interface RigidBody {
  type: "static" | "dynamic" | "kinematic";
  mass: number;
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;
  angularVelocity: Vector3;
  applyForce(force: Vector3, point?: Vector3): void;
  applyImpulse(impulse: Vector3, point?: Vector3): void;
  setLinearVelocity(velocity: Vector3): void;
  setAngularVelocity(velocity: Vector3): void;
}

export interface Avatar {
  id: string;
  name: string;
  url?: string;
}

export interface ChatListener {
  (messages: ChatMessage[]): void;
}

// ChatMessage is imported and re-exported from @hyperscape/shared above

// Plugin-specific Physics interface
export interface Physics {
  enabled: boolean;
  gravity: Vector3;
  timeStep: number;
  substeps?: number;
  world?: unknown | null;
  controllers: Map<string, CharacterController>;
  rigidBodies: Map<string, unknown>;
  createRigidBody: (
    type: "static" | "dynamic" | "kinematic",
    position?: Vector3,
    rotation?: Quaternion,
  ) => RigidBody;
  createCollider: (
    geometry: unknown,
    material?: unknown,
    isTrigger?: boolean,
  ) => unknown;
  createMaterial: (
    staticFriction?: number,
    dynamicFriction?: number,
    restitution?: number,
  ) => unknown;
  createLayerMask: (...layers: string[]) => number;
  sphereCast: (
    origin: Vector3,
    radius: number,
    direction: Vector3,
    maxDistance?: number,
    layerMask?: number,
  ) => unknown | null;
  raycast: (
    origin: Vector3,
    direction: Vector3,
    maxDistance?: number,
    layerMask?: number,
  ) => unknown | null;
  sweep: (
    geometry: unknown,
    origin: Vector3,
    direction: Vector3,
    maxDistance?: number,
    layerMask?: number,
  ) => unknown | null;
  simulate: (deltaTime: number) => void;
  step?: (deltaTime: number) => void;
}

// Position type (alias for Vector3 for backwards compatibility)
export type Position = Vector3;

// Transform type
export interface Transform {
  position?: Position;
  rotation?: Quaternion;
  scale?: Position;
}

// Network types (plugin-specific)
export interface NetworkSystem {
  id: string | null;
  connections?: Map<string, NetworkConnection>;
  broadcast?: (event: string, data: unknown) => void;
  send: (event: string, data?: unknown) => void;
  upload?: (file: File) => Promise<string>;
  disconnect: () => Promise<void>;
  maxUploadSize?: number;
}

export interface NetworkConnection {
  id: string;
  socket?: WebSocket;
  lastPing?: number;
  [key: string]: unknown;
}

// Chat system types
export interface ChatSystem {
  msgs: ChatMessage[];
  listeners?: ((msgs: ChatMessage[]) => void)[];
  add: (message: ChatMessage, broadcast?: boolean) => void;
  subscribe?: (callback: (msgs: ChatMessage[]) => void) => () => void;
  clear?: () => void;
}

// Event system types - plugin-specific interface that supports array operations
export interface EventSystem {
  listeners: Map<string, ((data: unknown) => void)[]>;
  emit: (eventName: string, data?: unknown) => void;
  on: (eventName: string, callback: (data: unknown) => void) => void;
  off: (eventName: string, callback?: (data: unknown) => void) => void;
  push?: (callback: (data: unknown) => void) => void;
  indexOf?: (callback: (data: unknown) => void) => number;
  splice?: (index: number, count: number) => void;
  clear?: () => void;
}

// World configuration - plugin-specific configuration that extends WorldOptions
export interface WorldConfig extends WorldOptions {
  viewport?: HTMLElement | MockElement;
  ui?: HTMLElement | MockElement;
  initialAuthToken?: string;
  loadPhysX?: () => Promise<unknown>;
}

export interface MockElement {
  appendChild: (child: unknown) => void;
  removeChild: (child: unknown) => void;
  offsetWidth: number;
  offsetHeight: number;
  addEventListener: (event: string, handler: unknown) => void;
  removeEventListener: (event: string, handler: unknown) => void;
  style: Record<string, unknown>;
}

// Content bundle types
export interface ContentBundle {
  id: string;
  name: string;
  description?: string;
  version?: string;
  actions?: Action[];
  providers?: Provider[];
  handlers?: unknown[];
  dynamicActions?: HyperscapeActionDescriptor[];
  config?: {
    features?: Record<string, unknown>;
    [key: string]: unknown;
  };
  install?: (world: World, runtime: IAgentRuntime) => Promise<ContentInstance>;
}

export interface ContentInstance {
  actions?: Action[];
  providers?: Provider[];
  dynamicActions?: string[];
  uninstall?: () => Promise<void>;
  [key: string]: unknown;
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
  default?: unknown;
}

// Manager types
export interface ManagerInterface {
  runtime: IAgentRuntime;
  start?(): void;
  stop?(): void;
  isActive?(): boolean;
}

// Response types
export interface ResponseContent {
  text?: string;
  action?: string;
  emote?: string;
  [key: string]: unknown;
}

export interface BehaviorResponse {
  content: ResponseContent;
  context: string;
}

// Multi-agent types
export interface AgentInstance {
  id: UUID;
  runtime: IAgentRuntime;
  service: Service;
  name: string;
  position?: Position;
  status: "connecting" | "connected" | "disconnected" | "error";
  lastUpdate: number;
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

// Error types
export interface ServiceError extends Error {
  code?: string;
  details?: unknown;
}

// Model type enum
export enum ModelType {
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
  SMART = "smart",
}

export interface CharacterController {
  id: string;
  position: Position;
  velocity: Position;
  isGrounded: boolean;
  radius: number;
  height: number;
  maxSpeed: number;
  move: (displacement: Position) => void;
  jump: () => void;
  walkToward: (
    targetPosition: { x: number; y?: number; z: number },
    speed?: number,
  ) => Position;
  walk?: (direction: { x: number; z: number }, speed?: number) => Position;
  setPosition: (position: Position) => void;
  getPosition: () => Position;
  getVelocity: () => Position;
}

// Control and InputState types for plugin compatibility
export interface Control {
  id: string;
  playerId: string;
  enabled: boolean;
  [key: string]: unknown;
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

// Re-export the THREE namespace and classes for convenience
export { THREE, WorldClass, EntityClass, EntitiesClass, SystemClass, EventBus };
