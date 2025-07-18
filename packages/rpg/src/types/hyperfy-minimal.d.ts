// Minimal Hyperfy types for RPG package
// This file contains only the essential types needed for the RPG to compile

// Core Math Types
export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

// Core System Types
export abstract class System {
  world: World
  name?: string
  enabled?: boolean
  
  constructor(world: World) {
    this.world = world
  }
  
  // Lifecycle
  init?(options?: any): Promise<void>
  start?(): void
  destroy?(): void
  
  // Update cycle
  fixedUpdate?(delta: number): void
  update?(delta: number): void
  lateUpdate?(delta: number): void
}

// Core World Types
export class World {
  id: string
  systems: System[]
  entities: {
    items: Map<string, Entity>
    players: Map<string, Player>
    player?: Player
    get(id: string): Entity | null
    has(id: string): boolean
    create(name: string, options?: any): Entity
  }
  
  // Additional methods that are used in the RPG
  getEntityById(id: string): Entity | null
  getSystem(systemName: string): any
  events: {
    emit(event: string, data?: any): void
    on(event: string, handler: (data: any) => void): void
    off(event: string, handler?: (data: any) => void): void
  }
  physics?: {
    world: any
    raycast(origin: Vector3, direction: Vector3, maxDistance?: number): any
  }
  time: number
  frame: number
  network?: {
    isServer: boolean
    isClient: boolean
    send(type: string, data: any): void
  }
  
  constructor(options?: any) {
    this.id = options?.id || `world_${Date.now()}`
    this.systems = []
    this.entities = {
      items: new Map(),
      players: new Map(),
      player: undefined,
      get: (id: string) => this.entities.items.get(id) || null,
      has: (id: string) => this.entities.items.has(id),
      create: (name: string, options?: any) => new Entity(this, { name, ...options })
    }
    this.events = {
      emit: (event: string, data?: any) => { console.log(`Event: ${event}`, data) },
      on: (event: string, handler: (data: any) => void) => { console.log(`Listening to: ${event}`) },
      off: (event: string, handler?: (data: any) => void) => { console.log(`Unlistening to: ${event}`) }
    }
    this.time = 0
    this.frame = 0
    this.getEntityById = (id: string) => this.entities.get(id)
    this.getSystem = (systemName: string) => this.systems.find((s: any) => s.name === systemName)
  }
}

// Entity Types
export class Entity {
  id: string
  type: string
  world: World
  position?: Vector3
  rotation?: Quaternion
  scale?: Vector3
  node?: any // Three.js Object3D
  data?: any
  isPlayer?: boolean
  
  constructor(world: World, data: any) {
    this.world = world
    this.id = data.id || `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.type = data.type || 'entity'
    this.data = data
    this.position = data.position
    this.rotation = data.rotation
    this.scale = data.scale
    this.isPlayer = data.isPlayer || false
  }
  
  // Component management
  getComponent<T = any>(type: string): T | null { return null }
  addComponent(type: string, data?: any): any { 
    const component = { type, entityId: this.id, ...data }
    return component
  }
  removeComponent(type: string): void { }
  hasComponent(type: string): boolean { return false }
  
  // Lifecycle
  destroy?(): void
}

export interface Player extends Entity {
  connection?: any
  input?: any
  stats?: any
  avatar?: any
}

export interface Component {
  type: string
  entity?: Entity
  data?: any
  entityId?: string
  
  init?(): void
  update?(delta: number): void
  destroy?(): void
}

// Plugin interface
export interface Plugin {
  init(world: World): Promise<void>
  update?(delta: number): void
  destroy?(): void
}

// World creation functions - these are declared but not implemented
export declare function createServerWorld(options?: any): Promise<World>
export declare function createClientWorld(options?: any): Promise<World>
export declare function createNodeClientWorld(options?: any): Promise<World>