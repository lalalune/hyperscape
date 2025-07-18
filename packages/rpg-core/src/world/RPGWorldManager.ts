import { World } from '@hyperfy/sdk'
import { RPGPluginConfig } from '../index'
import { WorldInitializer } from './WorldInitializer'
import { Vector3 } from '../types'

/**
 * Manages the RPG world state and initialization
 */
export class RPGWorldManager {
  private world: World
  private systems: Map<string, any>
  private config: RPGPluginConfig
  private initializer: WorldInitializer
  private initialized: boolean = false
  private playerCount: number = 0
  private worldTime: number = 0
  private lastSaveTime: number = 0

  constructor(world: World, systems: Map<string, any>, config: RPGPluginConfig) {
    this.world = world
    this.systems = systems
    this.config = config
    this.initializer = new WorldInitializer(world)
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[RPGWorldManager] Already initialized')
      return
    }

    console.log('[RPGWorldManager] Initializing RPG world...')

    try {
      // Setup event listeners
      this.setupEventListeners()

      // Initialize world if needed
      if (this.config.worldGen?.generateDefault) {
        await this.initializer.initialize()
      }

      // Start periodic tasks
      this.startPeriodicTasks()

      this.initialized = true
      console.log('[RPGWorldManager] RPG world initialized successfully')
    } catch (error) {
      console.error('[RPGWorldManager] Failed to initialize:', error)
      throw error
    }
  }

  private setupEventListeners(): void {
    // Player connection handling
    this.world.events.on('player:connect', (data: any) => this.handlePlayerConnect(data))
    this.world.events.on('player:disconnect', (data: any) => this.handlePlayerDisconnect(data))

    // Admin commands
    this.world.events.on('admin:save', () => this.saveWorld())
    this.world.events.on('admin:spawn', (data: any) => this.handleAdminSpawn(data))
  }

  private startPeriodicTasks(): void {
    // Auto-save every 5 minutes
    setInterval(() => this.saveWorld(), 5 * 60 * 1000)

    // Update world time
    setInterval(() => {
      this.worldTime += 1
      this.world.events.emit('world:time', { time: this.worldTime })
    }, 1000)

    // Cleanup tasks every minute
    setInterval(() => this.performCleanup(), 60 * 1000)
  }

  private async handlePlayerConnect(data: { playerId: string; username?: string }): Promise<void> {
    console.log(`[RPGWorldManager] Player connecting: ${data.playerId}`)
    
    this.playerCount++
    
    // Emit event for other systems
    this.world.events.emit('player:connected', {
      playerId: data.playerId,
      username: data.username || data.playerId,
      position: this.getPlayerSpawnPosition(data.playerId),
      timestamp: Date.now()
    })
  }

  private async handlePlayerDisconnect(data: { playerId: string }): Promise<void> {
    console.log(`[RPGWorldManager] Player disconnecting: ${data.playerId}`)
    
    this.playerCount--
    
    // Emit event for other systems
    this.world.events.emit('player:disconnected', {
      playerId: data.playerId,
      timestamp: Date.now()
    })
  }

  private getPlayerSpawnPosition(playerId: string): Vector3 {
    // Check for saved position
    const savedPos = this.getPlayerSavedPosition(playerId)
    if (savedPos) return savedPos

    // Return default spawn
    return { x: 3232, y: 1, z: 3232 } // Lumbridge spawn
  }

  private getPlayerSavedPosition(playerId: string): Vector3 | null {
    // TODO: Load from persistence
    return null
  }

  private async handleAdminSpawn(data: {
    type: string
    id: string
    position: Vector3
    metadata?: any
  }): Promise<void> {
    const spawningSystem = this.systems.get('spawning')
    if (!spawningSystem) return

    switch (data.type) {
      case 'npc':
        await spawningSystem.spawnNPC(data.id, {
          position: data.position,
          ...data.metadata
        })
        break
      case 'item':
        await spawningSystem.spawnItem(data.id, {
          position: data.position,
          quantity: data.metadata?.quantity || 1
        })
        break
    }
  }

  private async saveWorld(): Promise<void> {
    const now = Date.now()
    if (now - this.lastSaveTime < 30000) return // Minimum 30s between saves

    console.log('[RPGWorldManager] Saving world state...')
    
    this.lastSaveTime = now
    
    // Emit save event
    this.world.events.emit('world:save', {
      timestamp: now,
      entityCount: this.world.entities.items.size,
      playerCount: this.playerCount
    })
  }

  private async performCleanup(): Promise<void> {
    // Clean up expired items
    const lootSystem = this.systems.get('loot')
    if (lootSystem && lootSystem.cleanup) {
      lootSystem.cleanup()
    }

    // Clean up disconnected players
    // TODO: Implement player cleanup
  }

  /**
   * Public API methods
   */

  getWorldTime(): number {
    return this.worldTime
  }

  isInSafeZone(position: Vector3): boolean {
    // Lumbridge safe zone
    if (
      position.x >= 3200 && position.x <= 3260 &&
      position.z >= 3200 && position.z <= 3260
    ) {
      return true
    }

    // Varrock safe zone
    if (
      position.x >= 3180 && position.x <= 3250 &&
      position.z >= 3420 && position.z <= 3500
    ) {
      return true
    }

    return false
  }

  getRegionAt(position: Vector3): string | null {
    // Simple region detection based on coordinates
    if (
      position.x >= 3200 && position.x <= 3260 &&
      position.z >= 3200 && position.z <= 3260
    ) {
      return 'lumbridge'
    }

    if (
      position.x >= 3180 && position.x <= 3250 &&
      position.z >= 3420 && position.z <= 3500
    ) {
      return 'varrock'
    }

    if (position.y < 0) {
      return 'underground'
    }

    return 'wilderness'
  }

  getStatus(): any {
    return {
      initialized: this.initialized,
      playerCount: this.playerCount,
      entityCount: this.world.entities.items.size,
      worldTime: this.worldTime,
      uptime: Date.now() - (this.worldTime * 1000)
    }
  }

  isReady(): boolean {
    return this.initialized
  }
} 