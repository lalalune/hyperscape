// Core types for plugin-hyperscape - consolidated and importing from hyperscape package
import { Action, IAgentRuntime, Provider, Service, UUID } from '@elizaos/core'

// Import classes and types from hyperscape package
import { System, World } from '@hyperscape/shared'

import type {
  Component,
  Events as BaseEvents,
  Physics as BasePhysics,
  Quaternion,
  Vector3,
  WorldOptions,
} from '@hyperscape/shared'

// Import Entity and Entities from the main package but alias them to avoid conflicts
import type {
  Entity as HyperscapeEntity,
  Entities as HyperscapeEntities,
} from '@hyperscape/shared'

// Import additional types that may not be in the built package
import type { PlayerInput, PlayerStats } from '@hyperscape/shared'

// Define missing types locally
export interface RigidBody {
  type: 'static' | 'dynamic' | 'kinematic'
  mass: number
  position: Vector3
  rotation: Quaternion
  velocity: Vector3
  angularVelocity: Vector3
  applyForce(force: Vector3, point?: Vector3): void
  applyImpulse(impulse: Vector3, point?: Vector3): void
  setLinearVelocity(velocity: Vector3): void
  setAngularVelocity(velocity: Vector3): void
}

export interface Avatar {
  id: string
  name: string
  url?: string
}

export interface ChatListener {
  (messages: ChatMessage[]): void
}

// Remove duplicate definitions - these are defined in other type files

// Define ChatMessage interface locally since it's not exported from the built package
export interface ChatMessage {
  id: string
  from: string
  fromId?: string
  userId?: string
  userName?: string
  username?: string
  body: string
  text: string
  message?: string // For backward compatibility
  timestamp: number
  createdAt: string
  avatar?: string
  entityId?: string
  playerId?: string
  playerName?: string
}

// Re-export hyperscape classes and types for plugin use
export { System, World }
export type {
  Component,
  BaseEvents as Events,
  Quaternion,
  Vector3,
  WorldOptions,
  PlayerInput,
  PlayerStats,
}

// Re-export the aliased Entity type
export type Entity = HyperscapeEntity & {
  base?: {
    position: Vector3
    visible?: boolean
    children?: unknown[]
    parent?: unknown | null
  }
}

// Re-export the aliased Entities type
export type Entities = HyperscapeEntities

// Plugin-specific Physics interface - don't extend BasePhysics to avoid conflicts
export interface ExtendedPhysics {
  enabled: boolean
  gravity: Vector3
  timeStep: number
  substeps?: number
  world?: unknown | null
  controllers: Map<string, CharacterController>
  rigidBodies: Map<string, any>

  // Physics methods from BasePhysics
  createRigidBody: (
    type: 'static' | 'dynamic' | 'kinematic',
    position?: Vector3,
    rotation?: Quaternion
  ) => RigidBody
  createCollider: (
    geometry: unknown,
    material?: unknown,
    isTrigger?: boolean
  ) => unknown
  createMaterial: (
    staticFriction?: number,
    dynamicFriction?: number,
    restitution?: number
  ) => unknown
  createLayerMask: (...layers: string[]) => number
  sphereCast: (
    origin: Vector3,
    radius: number,
    direction: Vector3,
    maxDistance?: number,
    layerMask?: number
  ) => unknown | null
  raycast: (
    origin: Vector3,
    direction: Vector3,
    maxDistance?: number,
    layerMask?: number
  ) => unknown | null
  sweep: (
    geometry: unknown,
    origin: Vector3,
    direction: Vector3,
    maxDistance?: number,
    layerMask?: number
  ) => unknown | null
  simulate: (deltaTime: number) => void

  // Additional methods
  step?: (deltaTime: number) => void
}

// Use the extended physics type
export type Physics = ExtendedPhysics

// Extended Player type with movement methods for plugin use
export type Player = import('@hyperscape/shared').Player & {
  // Movement methods for AI agent control
  walkToward?: (
    targetPosition: { x: number; y?: number; z: number },
    speed?: number
  ) => Position
  walk?: (direction: { x: number; z: number }, speed?: number) => Position
  teleport?: (options: { position?: Position; rotationY?: number }) => void
  modify?: (data: { name?: string; [key: string]: unknown }) => void
}

// Export plugin-specific interfaces from core-interfaces
export type { HyperscapeAction, HyperscapeProvider } from './core-interfaces'

// Position type (alias for Vector3 for backwards compatibility)
export type Position = Vector3

// Transform type
export interface Transform {
  position?: Position
  rotation?: Quaternion
  scale?: Position
}

// Network types (plugin-specific)
export interface NetworkSystem {
  id: string | null
  connections?: Map<string, NetworkConnection>
  broadcast?: (event: string, data: unknown) => void
  send: (event: string, data?: unknown) => void
  upload?: (file: File) => Promise<string>
  disconnect: () => Promise<void>
  maxUploadSize?: number
}

export interface NetworkConnection {
  id: string
  socket?: WebSocket
  lastPing?: number
  [key: string]: unknown
}

// Chat system types
export interface ChatSystem {
  msgs: ChatMessage[]
  listeners?: ((msgs: ChatMessage[]) => void)[]
  add: (message: ChatMessage, broadcast?: boolean) => void
  subscribe?: (callback: (msgs: ChatMessage[]) => void) => () => void
  clear?: () => void
}

// Event system types - plugin-specific interface that supports array operations
export interface EventSystem {
  listeners: Map<string, ((data: unknown) => void)[]>
  emit: (eventName: string, data?: unknown) => void
  on: (eventName: string, callback: (data: unknown) => void) => void
  off: (eventName: string, callback?: (data: unknown) => void) => void
  // Additional array-like methods used in the service
  push?: (callback: (data: unknown) => void) => void
  indexOf?: (callback: (data: unknown) => void) => number
  splice?: (index: number, count: number) => void
  clear?: () => void
}

// World configuration - plugin-specific configuration that extends WorldOptions
export interface WorldConfig extends WorldOptions {
  viewport?: HTMLElement | MockElement
  ui?: HTMLElement | MockElement
  initialAuthToken?: string
  loadPhysX?: () => Promise<unknown>
  name?: string
  avatar?: string
  // Explicitly include properties from WorldOptions for TypeScript resolution
  wsUrl?: string
  physics?: boolean
  assetsUrl?: string
  networkRate?: number
}

export interface MockElement {
  appendChild: (child: unknown) => void
  removeChild: (child: unknown) => void
  offsetWidth: number
  offsetHeight: number
  addEventListener: (event: string, handler: unknown) => void
  removeEventListener: (event: string, handler: unknown) => void
  style: Record<string, unknown>
}

// Content bundle types
export interface ContentBundle {
  id: string
  name: string
  description?: string
  version?: string
  actions?: Action[]
  providers?: Provider[]
  handlers?: unknown[]
  dynamicActions?: HyperscapeActionDescriptor[]
  config?: {
    features?: Record<string, unknown>
    [key: string]: unknown
  }
  install?: (world: World, runtime: IAgentRuntime) => Promise<ContentInstance>
}

export interface ContentInstance {
  actions?: Action[]
  providers?: Provider[]
  dynamicActions?: string[]
  uninstall?: () => Promise<void>
  [key: string]: unknown
}

// Action descriptor type
export interface HyperscapeActionDescriptor {
  name: string
  description: string
  parameters: ActionParameter[]
  examples: string[]
  category:
    | 'combat'
    | 'inventory'
    | 'skills'
    | 'quest'
    | 'social'
    | 'movement'
    | 'other'
  handler?: string
}

export interface ActionParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description: string
  default?: unknown
}

// Manager types
export interface ManagerInterface {
  runtime: IAgentRuntime
  start?(): void
  stop?(): void
  isActive?(): boolean
}

// Response types
export interface ResponseContent {
  text?: string
  action?: string
  emote?: string
  [key: string]: unknown
}

export interface BehaviorResponse {
  content: ResponseContent
  context: string
}

// Multi-agent types
export interface AgentInstance {
  id: UUID
  runtime: IAgentRuntime
  service: Service
  name: string
  position?: Position
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastUpdate: number
}

export interface MultiAgentConfig {
  worldUrl: string
  maxAgents: number
  agentSpacing: number
  enableAutonomy?: boolean
}

// File upload types
export interface FileUploadResult {
  url: string
  hash: string
  size: number
}

// Service configuration
export interface ServiceConfig {
  wsUrl: string
  authToken?: string
  worldId: UUID
}

// Error types
export interface ServiceError extends Error {
  code?: string
  details?: unknown
}

// Model type enum (from core-interfaces.ts)
export enum ModelType {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  SMART = 'smart',
}

export interface CharacterController {
  id: string
  position: Position
  velocity: Position
  isGrounded: boolean
  radius: number
  height: number
  maxSpeed: number
  move: (displacement: Position) => void
  jump: () => void
  walkToward: (
    targetPosition: { x: number; y?: number; z: number },
    speed?: number
  ) => Position
  walk?: (direction: { x: number; z: number }, speed?: number) => Position
  setPosition: (position: Position) => void
  getPosition: () => Position
  getVelocity: () => Position
}

// CharacterControllerOptions is defined in content-types.ts

// Control and InputState types for plugin compatibility
export interface Control {
  id: string
  playerId: string
  enabled: boolean
  [key: string]: any
}

export interface InputState {
  down: boolean
  pressed: boolean
  released: boolean
}

export interface BaseObject {
  position: Vector3
  quaternion: Quaternion
  scale: Vector3
}

export interface AppearanceComponent extends Component {
  type: 'appearance'
}
