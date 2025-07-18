import { World } from '@hyperfy/sdk'
import { TestHelpers as ITestHelpers, TestMetrics } from '../types'

/**
 * Implementation of test helpers
 */
export class TestHelpers implements ITestHelpers {
  private world: World
  private plugin: any
  
  constructor(world: World, plugin: any) {
    this.world = world
    this.plugin = plugin
  }
  
  /**
   * Get an entity by ID
   */
  getEntity(id: string): any {
    return this.world.entities.items.get(id)
  }
  
  /**
   * Get all entities
   */
  getAllEntities(): Map<string, any> {
    return this.world.entities.items
  }
  
  /**
   * Wait for an entity to exist
   */
  async waitForEntity(id: string, timeout: number = 5000): Promise<any> {
    const start = Date.now()
    
    while (Date.now() - start < timeout) {
      const entity = this.getEntity(id)
      if (entity) return entity
      
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    throw new Error(`Entity ${id} not found within ${timeout}ms`)
  }
  
  /**
   * Invoke a method on the plugin's public API
   */
  invokeAPI(method: string, ...args: any[]): any {
    // Check if plugin has a getAPI method
    const api = this.plugin.getAPI ? this.plugin.getAPI() : this.plugin
    
    if (!api || typeof api[method] !== 'function') {
      throw new Error(`API method '${method}' not found`)
    }
    
    return api[method](...args)
  }
  
  /**
   * Emit an event
   */
  emitEvent(event: string, data: any): void {
    this.world.events.emit(event, data)
  }
  
  /**
   * Listen for an event with timeout
   */
  listenForEvent(event: string, timeout: number = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.world.events.off(event, handler)
        reject(new Error(`Event '${event}' not received within ${timeout}ms`))
      }, timeout)
      
      const handler = (data: any) => {
        clearTimeout(timer)
        this.world.events.off(event, handler)
        resolve(data)
      }
      
      this.world.events.on(event, handler)
    })
  }
  
  /**
   * Take a screenshot (placeholder)
   */
  async takeScreenshot(name: string): Promise<void> {
    // In a real implementation, this would capture the game view
    console.log(`[TestHelpers] Screenshot requested: ${name}`)
  }
  
  /**
   * Capture performance metrics
   */
  captureMetrics(): TestMetrics {
    const entityCount = this.world.entities.items.size
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024 // MB
    
    return {
      duration: 0, // Will be set by runner
      entityCount,
      memoryUsage,
      customMetrics: {
        systems: this.world.systems.length
      }
    }
  }
} 