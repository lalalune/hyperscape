/**
 * Stub type definitions for Hyperfy SDK
 * These should be replaced with actual @hyperfy/sdk types when available
 */

declare module '@hyperfy/sdk' {
  export interface World {
    entities: {
      items: Map<string, any>
      create(type: string, data?: any): any
      destroy(id: string): void
    }
    events: {
      on(event: string, handler: Function): void
      off(event: string, handler: Function): void
      emit(event: string, data?: any): void
    }
    systems: any[]
    data: any
  }

  export interface Entity {
    id: string
    type: string
    position: { x: number; y: number; z: number }
    rotation?: { x: number; y: number; z: number }
    data: any
    world: World
    
    addComponent(type: string, data?: any): Component
    getComponent<T extends Component>(type: string): T | null
    removeComponent(type: string): void
    hasComponent(type: string): boolean
    
    update(delta: number): void
    fixedUpdate(delta: number): void
    lateUpdate(delta: number): void
    serialize(): any
    destroy(local?: boolean): void
  }

  export interface Component {
    type: string
    entityId?: string
    entity?: any
    data?: any
  }

  export interface System {
    world: World
    update(delta: number): void
    fixedUpdate?(delta: number): void
    lateUpdate?(delta: number): void
    serialize?(): any
    deserialize?(data: any): void
    initialize?(): Promise<void> | void
  }

  export interface Plugin {
    init(world: World): Promise<void>
    update?(delta: number): void
    destroy?(): void
  }

  export class System {
    constructor(world: World)
    world: World
    update(delta: number): void
    fixedUpdate?(delta: number): void
    lateUpdate?(delta: number): void
    serialize?(): any
    deserialize?(data: any): void
    initialize?(): Promise<void> | void
  }

  export class Entity implements Entity {
    constructor(world: World, type: string, data?: any)
  }
} 