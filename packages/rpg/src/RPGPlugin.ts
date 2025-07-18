import { Plugin, World } from './types/hyperfy'
import { RPGPluginConfig } from './index'
import { RPGWorldManager } from './world/RPGWorldManager'
// import { RPGPublicAPI } from './api/RPGPublicAPI'

// Import all systems
import { CombatSystem } from './systems/CombatSystem'
import { InventorySystem } from './systems/InventorySystem'
import { MovementSystem } from './systems/MovementSystem'
import { BankingSystem } from './systems/BankingSystem'
import { SkillsSystem } from './systems/SkillsSystem'
import { NPCSystem } from './systems/NPCSystem'
import { LootSystem } from './systems/LootSystem'
import { SpawningSystem } from './systems/SpawningSystem'
import { VisualRepresentationSystem } from './systems/VisualRepresentationSystem'
import { UISystem } from './ui/UISystem'
import { StatsSystem } from './systems/StatsSystem'
import { DeathRespawnSystem } from './systems/DeathRespawnSystem'

/**
 * Main RPG Plugin implementation
 */
export class RPGPlugin implements Plugin {
  private config: RPGPluginConfig
  private worldManager?: RPGWorldManager
  // private publicAPI?: RPGPublicAPI
  private systems: Map<string, any> = new Map()
  
  constructor(config?: RPGPluginConfig) {
    this.config = {
      debug: false,
      worldGen: {
        generateDefault: true,
        customSpawns: []
      },
      systems: {
        combat: true,
        banking: true,
        skills: true
      },
      visuals: {
        enableShadows: true,
        maxViewDistance: 100
      },
      ...config
    }
  }
  
  /**
   * Initialize the plugin
   */
  async init(world: World): Promise<void> {
    console.log('[RPGPlugin] Initializing RPG systems...')
    
    try {
      // Initialize core systems
      await this.initializeSystems(world)
      
      // Initialize world manager
      this.worldManager = new RPGWorldManager(world, this.systems, this.config)
      await this.worldManager.initialize()
      
      // Create public API
      // this.publicAPI = new RPGPublicAPI(world, this.systems, this.worldManager)
      
      // Register the API with the world for external access
      // (world as any).rpg = this.publicAPI
      
      console.log('[RPGPlugin] RPG systems initialized successfully')
    } catch (error) {
      console.error('[RPGPlugin] Failed to initialize:', error)
      throw error
    }
  }
  
  /**
   * Initialize all game systems
   */
  private async initializeSystems(world: World): Promise<void> {
    // Core systems (always enabled)
    const coreSystems = [
      { name: 'stats', system: new StatsSystem(world) },
      { name: 'movement', system: new MovementSystem(world) },
      { name: 'inventory', system: new InventorySystem(world) },
      { name: 'visual', system: new VisualRepresentationSystem(world) },
      { name: 'ui', system: new UISystem(world) },
      { name: 'spawning', system: new SpawningSystem(world) },
      { name: 'npc', system: new NPCSystem(world) },
      { name: 'loot', system: new LootSystem(world) },
      { name: 'deathRespawn', system: new DeathRespawnSystem(world) }
    ]
    
    // Optional systems
    const optionalSystems = [
      { name: 'combat', system: new CombatSystem(world), configKey: 'combat' },
      { name: 'banking', system: new BankingSystem(world), configKey: 'banking' },
      { name: 'skills', system: new SkillsSystem(world), configKey: 'skills' }
    ]
    
    // Initialize core systems
    for (const { name, system } of coreSystems) {
      await this.initializeSystem(world, name, system)
    }
    
    // Initialize optional systems based on config
    for (const { name, system, configKey } of optionalSystems) {
      if (this.config.systems?.[configKey as keyof typeof this.config.systems]) {
        await this.initializeSystem(world, name, system)
      }
    }
  }
  
  /**
   * Initialize a single system
   */
  private async initializeSystem(world: World, name: string, system: any): Promise<void> {
    if (this.config.debug) {
      console.log(`[RPGPlugin] Initializing ${name} system...`)
    }
    
    this.systems.set(name, system)
    world.systems.push(system)
    
    if (system.initialize) {
      await system.initialize()
    }
  }
  
  /**
   * Update loop
   */
  update(delta: number): void {
    // Plugin update logic if needed
  }
  
  /**
   * Cleanup on plugin removal
   */
  destroy(): void {
    if (this.worldManager) {
      // Cleanup world manager
    }
    
    this.systems.clear()
    
    console.log('[RPGPlugin] RPG plugin destroyed')
  }
  
  /**
   * Get the public API
   */
  // getAPI(): RPGPublicAPI | undefined {
  //   return this.publicAPI
  // }
} 