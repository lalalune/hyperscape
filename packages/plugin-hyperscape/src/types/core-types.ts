// Core types for plugin-hyperscape - consolidated and importing from hyperscape package
import {
  UUID,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  Action,
  Provider,
  Service,
} from '@elizaos/core'

// Import classes and types from hyperscape package
import { World, Entity, System } from '@hyperscape/hyperscape'

import type {
  WorldOptions,
  Vector3,
  Quaternion,
  Component,
  Physics,
  Entities,
  Events,
} from '@hyperscape/hyperscape'

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
export { World, Entity, System }
export type {
  WorldOptions,
  Vector3,
  Quaternion,
  Component,
  Physics,
  Entities,
  Events,
}

// Extended Player type with movement methods for plugin use
export type Player = import('@hyperscape/hyperscape').Player & {
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
  disconnect?: () => Promise<void>
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

// Event system types
export interface EventSystem {
  listeners: Map<string, ((data: unknown) => void)[]>
  emit: (eventName: string, data?: unknown) => void
  on: (eventName: string, callback: (data: unknown) => void) => void
  off: (eventName: string, callback?: (data: unknown) => void) => void
}

// World configuration
export interface WorldConfig {
  wsUrl: string
  viewport: HTMLElement | MockElement
  ui: HTMLElement | MockElement
  initialAuthToken?: string
  loadPhysX?: () => Promise<unknown>
  assetsUrl?: string
  physics?: boolean
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
