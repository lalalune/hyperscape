import { World, createServerWorld } from '../hyperfy'

// Plugin interface - since we don't have this defined in our exports yet
interface Plugin {
  name: string
  version?: string
  [key: string]: any
}

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
    const world = await this.createTestWorld()
    
    // Initialize plugin if it has an init method
    if (plugin.init) {
      await plugin.init(world)
    }
    
    console.log('[PluginLoader] Plugin loaded successfully')
    
    return { world, plugin }
  }
  
  /**
   * Create a test world instance
   */
  private async createTestWorld(): Promise<World> {
    // Use the real Hyperfy world creation function
    const world = await createServerWorld()
    return world
  }
} 