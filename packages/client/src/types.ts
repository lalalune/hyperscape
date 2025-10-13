/**
 * Client Type Definitions
 * 
 * This module provides TypeScript type definitions for the Hyperscape client application.
 * It defines interfaces for client-side systems, entities, and UI components that are
 * specific to the browser environment.
 * 
 * Key type categories:
 * 
 * **Entity Types**:
 * - EntityData: Extended from shared types with client-specific fields (mover, uploader, pinned state)
 * - PlayerEntity: Client-side player representation with name and roles
 * - Entity: Base entity interface with Three.js root object and modification methods
 * 
 * **System Interfaces**:
 * - GraphicsSystem: Renderer dimensions and display info
 * - ControlsSystem: Input handling, pointer lock, action bindings
 * - ChatSystem: Message sending and subscribing
 * - XRManager: VR/AR session management
 * - NetworkManager: Client-server communication
 * 
 * **UI Types**:
 * - Field: Dynamic form field definitions with validation and conditional rendering
 * - UIState: Interface state (from shared package)
 * - HintContextType: Tooltip and hint management
 * - WorldSettings: World metadata and configuration
 * - WorldPreferences: User preferences (graphics, audio, UI)
 * 
 * **File Types**:
 * - FileInfo: Uploaded file metadata (type, name, url)
 * 
 * These types are used throughout the client package by React components, hooks, and
 * client-side systems to ensure type safety when interacting with the World, entities,
 * and Hyperscape's client APIs.
 * 
 * Referenced by: All client React components, hooks, and UI-related code
 */

import { THREE } from '@hyperscape/shared'
import type { EntityData as CoreEntityData, ControlBinding } from '@hyperscape/shared'
import type { World } from '@hyperscape/shared'

// Export the actual World class instead of defining a separate interface
export type { World }

// Use shared UIState from types/physics.ts where broader UI state exists
export type { UIState } from '@hyperscape/shared'

export interface EntityManager {
  items: Map<string, Entity>
  player: PlayerEntity
  add: (data: EntityData, broadcast?: boolean) => Entity
}

export interface Entity {
  id: string
  data: EntityData
  isApp?: boolean
  isPlayer?: boolean
  root: THREE.Object3D
  modify: (changes: Partial<EntityData>) => void
  destroy: (broadcast?: boolean) => void
}

// Extend core EntityData with client-specific fields
export interface EntityData extends CoreEntityData {
  mover?: string
  uploader?: string | null
  pinned?: boolean
  state?: Record<string, unknown>
}

export interface PlayerEntity extends Entity {
  isPlayer: true
  data: EntityData & {
    name: string
    roles: string[]
  }
  setName: (name: string) => void
}

export interface FileInfo {
  type: string
  name: string
  url: string
}

export interface WorldSettings {
  title: string
  desc: string
  image?: FileInfo
  model?: FileInfo
  avatar?: FileInfo
  playerLimit: number
  public: boolean
  on: (event: 'change', handler: (changes: unknown) => void) => void
  off: (event: 'change', handler: (changes: unknown) => void) => void
  set: (key: string, value: unknown, broadcast?: boolean) => void
}

export interface WorldPreferences {
  dpr: number
  shadows: string
  postprocessing: boolean
  bloom: boolean
  music: number
  sfx: number
  voice: number
  ui: number
  actions: boolean
  stats: boolean
  touchAction?: boolean
  on: (event: string, handler: Function) => void
  off: (event: string, handler: Function) => void
  setDPR: (value: number) => void
  setShadows: (value: string) => void
  setPostprocessing: (value: boolean) => void
  setBloom: (value: boolean) => void
  setMusic: (value: number) => void
  setSFX: (value: number) => void
  setVoice: (value: number) => void
  setUI: (value: number) => void
  setActions: (value: boolean) => void
  setStats: (value: boolean) => void
}

export interface NetworkManager {
  id: string
  send: (event: string, data?: unknown) => void
  upload: (file: File) => Promise<void>
}

export interface LoaderManager {
  get: (type: string, url: string) => unknown
  insert: (type: string, url: string, file: File) => void
  loadFile: (url: string) => Promise<File>
  getFile: (url: string, name?: string) => File | undefined
}

export interface BuilderManager {
  enabled: boolean
  toggle: (enabled?: boolean) => void
  select: (entity: Entity) => void
  getSpawnTransform: () => { position: number[]; quaternion: number[] }
  control: {
    pointer: {
      lock: () => void
    }
  }
}

export interface GraphicsSystem {
  width: number
  height: number
}

export interface ControlsSystem {
  pointer: {
    locked: boolean
  }
  actions: Action[]
  bind: (options: { priority: number }) => ControlBinding
  action: { onPress: () => void }
  jump: { onPress: () => void }
}

export interface Action {
  id: string
  type: string
  label: string
  btn?: string
}

export interface TargetSystem {
  show: (position: THREE.Vector3) => void
  hide: () => void
}

export interface XRManager {
  supportsVR: boolean
  enter: () => void
}

export interface ChatSystem {
  send: (message: string) => void
  command: (command: string) => void
  add: (data: unknown, broadcast?: boolean) => void
  subscribe: (callback: (messages: unknown[]) => void) => () => void
}

// Field types
export interface Field {
  key: string
  type: string
  label: string
  hint?: string
  placeholder?: string
  hidden?: boolean
  when?: Array<{ op: string; key: string; value: unknown }>
  // Type-specific properties
  dp?: number
  min?: number
  max?: number
  step?: number
  bigStep?: number
  kind?: string
  options?: Array<{ label: string; value: unknown }>
  trueLabel?: string
  falseLabel?: string
  instant?: boolean
  x?: string
  y?: string
  xRange?: number
  yMin?: number
  yMax?: number
  onClick?: () => void
  buttons?: Array<{ label: string; onClick: () => void }>
}

// Component prop types
export interface HintContextType {
  hint: string | null
  setHint: (hint: string | null) => void
}

export interface PermissionsInfo {
  isAdmin: boolean
  isBuilder: boolean
}

// Event handler types
export type PointerEventHandler = (event: React.PointerEvent) => void
export type ChangeEventHandler<T> = (value: T) => void

// Option types
export interface SelectOption {
  label: string
  value: unknown
} 