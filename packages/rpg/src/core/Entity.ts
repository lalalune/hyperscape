/**
 * Base Entity class
 */
export class Entity {
  id: string
  type: string
  world: any
  data: any
  components: Map<string, any>
  
  constructor(world: any, type: string, data: any) {
    this.world = world
    this.id = data.id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.type = type
    this.data = data
    this.components = new Map()
  }
  
  addComponent(type: string, data?: any): any {
    const component = { type, entityId: this.id, ...data }
    this.components.set(type, component)
    return component
  }
  
  getComponent<T = any>(type: string): T | null {
    return this.components.get(type) || null
  }
  
  removeComponent(type: string): void {
    this.components.delete(type)
  }
  
  hasComponent(type: string): boolean {
    return this.components.has(type)
  }
  
  getAllComponents(): any[] {
    return Array.from(this.components.values())
  }
  
  update(_delta: number): void {
    // Override in subclasses
  }
  
  fixedUpdate(_delta: number): void {
    // Override in subclasses
  }
  
  lateUpdate(_delta: number): void {
    // Override in subclasses
  }
  
  serialize(): any {
    return {
      id: this.id,
      type: this.type,
      data: this.data,
      components: Array.from(this.components.entries()).map(([type, component]) => ({
        type,
        ...component
      }))
    }
  }
  
  destroy(local?: boolean): void {
    this.components.clear()
    if (!local && this.world?.entities?.delete) {
      this.world.entities.delete(this.id)
    }
  }
} 