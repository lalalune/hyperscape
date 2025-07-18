import { World, Plugin } from '@hyperfy/sdk'

/**
 * Helper class for loading Hyperfy plugins
 */
export class PluginLoader {
  /**
   * Load a plugin and create a world instance
   */
  async loadPlugin(config: {
    pluginPath?: string
    pluginModule?: any
    pluginConfig?: any
  }): Promise<{ world: World; plugin: any }> {
    console.log('[PluginLoader] Loading plugin...')
    
    // Get plugin module
    let pluginModule = config.pluginModule
    if (!pluginModule && config.pluginPath) {
      pluginModule = await import(config.pluginPath)
    }
    
    if (!pluginModule) {
      throw new Error('No plugin module or path provided')
    }
    
    // Create plugin instance
    let plugin: Plugin
    if (typeof pluginModule === 'function') {
      plugin = pluginModule(config.pluginConfig)
    } else if (pluginModule.default) {
      plugin = typeof pluginModule.default === 'function' 
        ? pluginModule.default(config.pluginConfig)
        : pluginModule.default
    } else if (pluginModule.createPlugin) {
      plugin = pluginModule.createPlugin(config.pluginConfig)
    } else {
      throw new Error('Invalid plugin module format')
    }
    
    // Create world
    const world = this.createTestWorld()
    
    // Initialize plugin
    await plugin.init(world)
    
    console.log('[PluginLoader] Plugin loaded successfully')
    
    return { world, plugin }
  }
  
  /**
   * Create a test world instance
   */
  private createTestWorld(): World {
    const entities = new Map<string, any>()
    const events = new EventEmitter()
    const systems: any[] = []
    
    return {
      entities: {
        items: entities,
        create: (type: string, data?: any) => {
          const id = `${type}_${Date.now()}_${Math.random()}`
          const entity = { id, type, ...data }
          entities.set(id, entity)
          return entity
        },
        destroy: (id: string) => {
          entities.delete(id)
        }
      },
      events,
      systems,
      data: {}
    }
  }
}

/**
 * Simple event emitter for test world
 */
class EventEmitter {
  private listeners = new Map<string, Set<Function>>()
  
  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }
  
  off(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler)
  }
  
  emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error)
      }
    })
  }
} 