/**
 * RPG World Manager - Manages RPG world lifecycle
 * Coordinates world initialization, system startup, and player connections
 */

import type { World } from '../types'
import { WorldInitializer } from './world/WorldInitializer'

export class RPGWorldManager {
  private world: World
  private initializer: WorldInitializer
  private initialized: boolean = false
  private playerCount: number = 0
  
  constructor(world: World) {
    this.world = world
    this.initializer = new WorldInitializer(world)
  }

  /**
   * Initialize the RPG world
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[RPGWorldManager] Already initialized')
      return
    }

    console.log('[RPGWorldManager] Starting RPG world initialization...')
    
    try {
      // Initialize all systems
      await this.initializeSystems()
      
      // Initialize the game world
      await this.initializer.initialize()
      
      // Set up event listeners
      this.setupEventListeners()
      
      // Start periodic tasks
      this.startPeriodicTasks()
      
      this.initialized = true
      console.log('[RPGWorldManager] RPG world initialized successfully!')
      
      // Emit world ready event
      this.world.events.emit('rpg:world_ready', {
        stats: this.initializer.getWorldStats()
      })
      
    } catch (error) {
      console.error('[RPGWorldManager] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Initialize all RPG systems
   */
  private async initializeSystems(): Promise<void> {
    console.log('[RPGWorldManager] Initializing RPG systems...')
    
    const systems = [
      'stats', 'movement', 'combat', 'inventory', 'quest', 
      'skills', 'banking', 'trading', 'navigation', 'loot',
      'spawning', 'npc', 'deathRespawn', 'pvp', 'shop',
      'grandExchange', 'prayer', 'magic', 'construction',
      'minigame', 'clan', 'visualRepresentation', 'agentPlayer',
      'itemSpawn', 'resourceSpawn', 'ui'
    ]
    
    for (const systemName of systems) {
      const system = (this.world as any).getSystem(systemName)
      if (system && typeof system.initialize === 'function') {
        try {
          await system.initialize()
          console.log(`[RPGWorldManager] Initialized ${systemName} system`)
        } catch (error) {
          console.error(`[RPGWorldManager] Failed to initialize ${systemName}:`, error)
        }
      }
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Player connection
    this.world.events.on('player:connect', this.handlePlayerConnect.bind(this))
    this.world.events.on('player:disconnect', this.handlePlayerDisconnect.bind(this))
    
    // World events
    this.world.events.on('world:save_requested', this.handleSaveRequest.bind(this))
    this.world.events.on('world:shutdown', this.handleShutdown.bind(this))
    
    // Admin commands
    this.world.events.on('admin:spawn_entity', this.handleAdminSpawn.bind(this))
    this.world.events.on('admin:reset_world', this.handleWorldReset.bind(this))
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Auto-save every 5 minutes
    setInterval(() => {
      this.saveWorld()
    }, 300000)
    
    // Stats reporting every minute
    setInterval(() => {
      this.reportStats()
    }, 60000)
    
    // Cleanup tasks every 10 minutes
    setInterval(() => {
      this.performCleanup()
    }, 600000)
  }

  /**
   * Handle player connect
   */
  private async handlePlayerConnect(data: { playerId: string; username: string }): Promise<void> {
    console.log(`[RPGWorldManager] Player connected: ${data.username} (${data.playerId})`)
    
    this.playerCount++
    
    // Spawn player entity
    const spawningSystem = (this.world as any).getSystem('spawning')
    if (spawningSystem) {
      const spawnPosition = this.getPlayerSpawnPosition(data.playerId)
      const player = await spawningSystem.spawnEntity('player', spawnPosition, {
        playerId: data.playerId,
        username: data.username,
        displayName: data.username
      })
      
      if (player) {
        // Initialize player components
        await this.initializePlayer(player)
        
        // Emit player spawned event
        this.world.events.emit('rpg:player_spawned', {
          playerId: data.playerId,
          entityId: player.id,
          position: spawnPosition
        })
      }
    }
  }

  /**
   * Handle player disconnect
   */
  private async handlePlayerDisconnect(data: { playerId: string }): Promise<void> {
    console.log(`[RPGWorldManager] Player disconnected: ${data.playerId}`)
    
    this.playerCount = Math.max(0, this.playerCount - 1)
    
    // Save player data immediately
    const persistence = (this.world as any).getSystem('persistence')
    if (persistence) {
      await persistence.savePlayer(data.playerId)
    }
    
    // Remove player entity
    const player = this.world.entities.get(data.playerId)
    if (player) {
      this.world.entities.delete(data.playerId)
    }
  }

  /**
   * Get player spawn position
   */
  private getPlayerSpawnPosition(playerId: string): any {
    // Check if player has saved position
    const savedPosition = this.getPlayerSavedPosition(playerId)
    if (savedPosition) {
      return savedPosition
    }
    
    // New players spawn in Lumbridge
    return {
      x: 0 + Math.random() * 10 - 5,
      y: 0,
      z: 0 + Math.random() * 10 - 5
    }
  }

  /**
   * Get player saved position
   */
  private getPlayerSavedPosition(playerId: string): any | null {
    // This would check persistence for saved position
    // For now, return null to use default spawn
    return null
  }

  /**
   * Initialize player entity
   */
  private async initializePlayer(player: any): Promise<void> {
    // Add default components if not present
    const components = [
      'stats', 'inventory', 'skills', 'quest', 'bank',
      'combat', 'movement', 'ui', 'clan'
    ]
    
    for (const componentName of components) {
      if (!player.getComponent(componentName)) {
        const system = (this.world as any).getSystem(componentName)
        if (system && typeof system.createDefaultComponent === 'function') {
          const component = system.createDefaultComponent()
          player.addComponent(componentName, component)
        }
      }
    }
    
    // Load saved data
    const persistence = (this.world as any).getSystem('persistence')
    if (persistence) {
      await persistence.loadPlayer(player.id)
    }
  }

  /**
   * Save world
   */
  private async saveWorld(): Promise<void> {
    console.log('[RPGWorldManager] Auto-saving world...')
    
    const startTime = Date.now()
    
    try {
      // Emit save event for all systems
      this.world.events.emit('world:save_state')
      
      const duration = Date.now() - startTime
      console.log(`[RPGWorldManager] World saved in ${duration}ms`)
      
    } catch (error) {
      console.error('[RPGWorldManager] Failed to save world:', error)
    }
  }

  /**
   * Report stats
   */
  private reportStats(): void {
    const stats = {
      players: this.playerCount,
      entities: this.world.entities.size,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      worldStats: this.initializer.getWorldStats()
    }
    
    this.world.events.emit('rpg:stats_report', stats)
    
    // Log key metrics
    console.log(`[RPGWorldManager] Players: ${stats.players}, Entities: ${stats.entities}, Memory: ${Math.round(stats.memory.heapUsed / 1024 / 1024)}MB`)
  }

  /**
   * Perform cleanup
   */
  private async performCleanup(): Promise<void> {
    console.log('[RPGWorldManager] Performing cleanup...')
    
    // Clean up expired ground items
    const itemSpawnSystem = (this.world as any).getSystem('itemSpawn')
    if (itemSpawnSystem && typeof itemSpawnSystem.cleanupExpiredItems === 'function') {
      itemSpawnSystem.cleanupExpiredItems()
    }
    
    // Clean up inactive clans
    const clanSystem = (this.world as any).getSystem('clan')
    if (clanSystem && typeof clanSystem.cleanupInactive === 'function') {
      clanSystem.cleanupInactive()
    }
    
    // Garbage collection hint
    if (global.gc) {
      global.gc()
    }
  }

  /**
   * Handle save request
   */
  private async handleSaveRequest(): Promise<void> {
    await this.saveWorld()
  }

  /**
   * Handle shutdown
   */
  private async handleShutdown(): Promise<void> {
    console.log('[RPGWorldManager] Shutting down RPG world...')
    
    // Save all data
    await this.saveWorld()
    
    // Stop periodic tasks
    // In a real implementation, we'd store interval IDs and clear them
    
    this.initialized = false
  }

  /**
   * Handle admin spawn
   */
  private async handleAdminSpawn(data: {
    type: string
    id: string
    position: any
    metadata?: any
  }): Promise<void> {
    const spawningSystem = (this.world as any).getSystem('spawning')
    if (!spawningSystem) return
    
    try {
      const entity = await spawningSystem.spawnEntity(data.type, data.position, {
        ...data.metadata,
        adminSpawned: true
      })
      
      console.log(`[RPGWorldManager] Admin spawned ${data.type} at`, data.position)
      
      this.world.events.emit('admin:entity_spawned', {
        entityId: entity?.id,
        type: data.type,
        position: data.position
      })
      
    } catch (error) {
      console.error('[RPGWorldManager] Failed to spawn entity:', error)
    }
  }

  /**
   * Handle world reset
   */
  private async handleWorldReset(data: { confirm: boolean }): Promise<void> {
    if (!data.confirm) {
      console.warn('[RPGWorldManager] World reset requested but not confirmed')
      return
    }
    
    console.log('[RPGWorldManager] Resetting world...')
    
    // Clear all entities except players
    for (const [id, entity] of this.world.entities) {
      if ((entity as any).type !== 'player') {
        this.world.entities.delete(id)
      }
    }
    
    // Reinitialize world
    await this.initializer.initialize()
    
    console.log('[RPGWorldManager] World reset complete')
  }

  /**
   * Get world status
   */
  getStatus(): any {
    return {
      initialized: this.initialized,
      playerCount: this.playerCount,
      entityCount: this.world.entities.size,
      worldStats: this.initializer.getWorldStats()
    }
  }

  /**
   * Check if world is ready
   */
  isReady(): boolean {
    return this.initialized
  }
} 