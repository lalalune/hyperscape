import { 
  RPGWorldState, 
  RPGPlayer, 
  RPGPosition, 
  RPGNetworkMessage,
  RPGConfig,
  DEFAULT_RPG_CONFIG,
  createRPGSystems
} from './index.js'
import { RPG_ITEMS } from './data/items.js'

export class RPGWorld {
  private worldState: RPGWorldState
  private systems: Map<string, any> = new Map()
  private config: RPGConfig
  private isRunning: boolean = false
  private lastTickTime: number = 0
  private tickInterval: NodeJS.Timer | null = null
  private saveInterval: NodeJS.Timer | null = null
  private eventEmitter: any // EventEmitter for multiplayer communication
  private db: any // Database connection

  constructor(config: Partial<RPGConfig> = {}, db?: any, eventEmitter?: any) {
    this.config = { ...DEFAULT_RPG_CONFIG, ...config }
    this.db = db
    this.eventEmitter = eventEmitter
    
    // Initialize world state
    this.worldState = {
      players: new Map(),
      mobs: new Map(),
      items: RPG_ITEMS,
      zones: new Map(),
      activeCombat: new Map(),
      worldTime: new Date(),
      tickCount: 0,
      lastSave: new Date(),
      systems: this.systems, // Inject systems reference
      events: eventEmitter    // Inject event emitter
    }

    // Initialize systems
    this.initializeSystems()
  }

  private initializeSystems(): void {
    // Create RPG systems with world state injection
    const rpgSystems = createRPGSystems(this.worldState, this.db)
    
    // Register systems
    for (const [name, system] of Object.entries(rpgSystems)) {
      this.systems.set(name, system)
    }

    console.log('[RPGWorld] Initialized with', this.systems.size, 'systems')
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[RPGWorld] Already running')
      return
    }

    console.log('[RPGWorld] Starting...')

    try {
      // Initialize all systems
      const initPromises = Array.from(this.systems.values()).map(system => system.init())
      await Promise.all(initPromises)

      // Load world state from persistence
      const persistenceSystem = this.systems.get('PersistenceSystem')
      if (persistenceSystem) {
        const savedState = await persistenceSystem.loadWorldState()
        
        // Merge saved players into current world state
        for (const [playerId, player] of savedState.players) {
          this.worldState.players.set(playerId, player)
        }
        
        console.log('[RPGWorld] Loaded', savedState.players.size, 'players from persistence')
      }

      // Start world tick loop
      this.startWorldLoop()
      
      // Start auto-save
      this.startAutoSave()

      this.isRunning = true
      console.log('[RPGWorld] Started successfully')

    } catch (error) {
      console.error('[RPGWorld] Failed to start:', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[RPGWorld] Not running')
      return
    }

    console.log('[RPGWorld] Stopping...')

    try {
      // Stop loops
      if (this.tickInterval) {
        clearInterval(this.tickInterval)
        this.tickInterval = null
      }

      if (this.saveInterval) {
        clearInterval(this.saveInterval)
        this.saveInterval = null
      }

      // Save world state
      const persistenceSystem = this.systems.get('PersistenceSystem')
      if (persistenceSystem) {
        await persistenceSystem.saveWorldState()
      }

      // Clean up all systems
      const cleanupPromises = Array.from(this.systems.values()).map(system => system.cleanup())
      await Promise.all(cleanupPromises)

      this.isRunning = false
      console.log('[RPGWorld] Stopped successfully')

    } catch (error) {
      console.error('[RPGWorld] Error during stop:', error)
      throw error
    }
  }

  private startWorldLoop(): void {
    const targetFPS = this.config.world.tickRate
    const targetFrameTime = 1000 / targetFPS
    
    this.lastTickTime = Date.now()
    
    this.tickInterval = setInterval(() => {
      const now = Date.now()
      const deltaTime = now - this.lastTickTime
      
      this.worldTick(deltaTime)
      
      this.lastTickTime = now
      this.worldState.tickCount++
      
    }, targetFrameTime)
    
    console.log(`[RPGWorld] Started world loop at ${targetFPS} FPS`)
  }

  private worldTick(deltaTime: number): void {
    try {
      // Update world time
      this.worldState.worldTime = new Date()
      
      // Update all systems
      for (const system of this.systems.values()) {
        system.update(deltaTime)
      }
      
      // Process pending events
      this.processEvents()
      
      // Broadcast world updates to clients
      this.broadcastWorldUpdates()
      
    } catch (error) {
      console.error('[RPGWorld] Error in world tick:', error)
    }
  }

  private startAutoSave(): void {
    const saveInterval = this.config.world.saveInterval
    
    this.saveInterval = setInterval(async () => {
      try {
        const persistenceSystem = this.systems.get('PersistenceSystem')
        if (persistenceSystem) {
          await persistenceSystem.saveWorldState()
          console.log('[RPGWorld] Auto-saved world state')
        }
      } catch (error) {
        console.error('[RPGWorld] Auto-save failed:', error)
      }
    }, saveInterval)
    
    console.log(`[RPGWorld] Started auto-save every ${saveInterval}ms`)
  }

  private processEvents(): void {
    // Events are handled by the EventEmitter
    // This is where we could add event queue processing if needed
  }

  private broadcastWorldUpdates(): void {
    if (!this.eventEmitter) return

    // Broadcast player updates
    for (const player of this.worldState.players.values()) {
      this.eventEmitter.emit('player_update', {
        type: 'player_update',
        playerId: player.id,
        data: {
          position: player.position,
          health: player.health,
          stamina: player.stamina,
          equipment: player.equipment,
          inCombat: player.inCombat
        },
        timestamp: new Date()
      })
    }

    // Broadcast mob updates
    for (const mob of this.worldState.mobs.values()) {
      this.eventEmitter.emit('mob_update', {
        type: 'mob_update',
        mobId: mob.id,
        data: {
          position: mob.position,
          health: mob.health,
          state: mob.state,
          currentTarget: mob.currentTarget
        },
        timestamp: new Date()
      })
    }
  }

  // Player management methods

  async addPlayer(playerId: string, playerName: string): Promise<RPGPlayer> {
    // Check if player already exists
    if (this.worldState.players.has(playerId)) {
      return this.worldState.players.get(playerId)!
    }

    const persistenceSystem = this.systems.get('PersistenceSystem')
    let player: RPGPlayer

    if (persistenceSystem) {
      // Try to load existing player
      player = await persistenceSystem.loadPlayer(playerId)
      
      if (!player) {
        // Create new player
        player = await persistenceSystem.createPlayer(playerName)
        
        // Set random starting position
        const worldSystem = this.systems.get('WorldSystem')
        if (worldSystem) {
          const startTown = worldSystem.getRandomStarterTown()
          if (startTown) {
            player.position = { ...startTown.position }
          }
        }
      }
    } else {
      // Create temporary player without persistence
      player = {
        id: playerId,
        name: playerName,
        position: { x: 0, y: 0, z: 0 },
        stats: { attack: 1, strength: 1, defense: 1, constitution: 10, range: 1, woodcutting: 1, fishing: 1, firemaking: 1, cooking: 1 },
        experience: { attack: 0, strength: 0, defense: 0, constitution: 1154, range: 0, woodcutting: 0, fishing: 0, firemaking: 0, cooking: 0 },
        health: 19,
        maxHealth: 19,
        inventory: { slots: Array(28).fill(null).map(() => ({ quantity: 0 })), maxSlots: 28 },
        equipment: { weapon: 'bronze_sword' },
        coins: 0,
        combatStyle: 'accurate' as any,
        isRunning: false,
        stamina: 100,
        maxStamina: 100,
        lastLogin: new Date(),
        totalPlayTime: 0,
        deathCount: 0,
        killCount: 0,
        inCombat: false,
        lastAttackTime: 0
      }
    }

    // Add to world state
    this.worldState.players.set(playerId, player)

    // Initialize player systems
    const inventorySystem = this.systems.get('InventorySystem')
    if (inventorySystem) {
      inventorySystem.initializePlayerInventory(playerId)
    }

    const equipmentSystem = this.systems.get('EquipmentSystem')
    if (equipmentSystem) {
      equipmentSystem.initializePlayerEquipment(playerId)
    }

    // Emit player join event
    this.eventEmitter?.emit('player_join', {
      type: 'player_join',
      playerId: player.id,
      data: { name: player.name, position: player.position },
      timestamp: new Date()
    })

    console.log(`[RPGWorld] Added player: ${player.name} (${playerId})`)
    return player
  }

  async removePlayer(playerId: string): Promise<void> {
    const player = this.worldState.players.get(playerId)
    if (!player) return

    // Save player before removal
    const persistenceSystem = this.systems.get('PersistenceSystem')
    if (persistenceSystem) {
      await persistenceSystem.savePlayer(player)
    }

    // End any active combat
    const combatSystem = this.systems.get('CombatSystem')
    if (combatSystem && player.inCombat) {
      // End combat sessions involving this player
      for (const [sessionId, session] of this.worldState.activeCombat.entries()) {
        if (session.attackerId === playerId || session.targetId === playerId) {
          combatSystem.endCombat(sessionId)
        }
      }
    }

    // Remove from world state
    this.worldState.players.delete(playerId)

    // Emit player leave event
    this.eventEmitter?.emit('player_leave', {
      type: 'player_leave',
      playerId,
      data: { name: player.name },
      timestamp: new Date()
    })

    console.log(`[RPGWorld] Removed player: ${player.name} (${playerId})`)
  }

  // Network message handling

  async handleNetworkMessage(message: RPGNetworkMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'player_move':
          await this.handlePlayerMove(message)
          break
        case 'player_attack':
          await this.handlePlayerAttack(message)
          break
        case 'player_use_item':
          await this.handlePlayerUseItem(message)
          break
        case 'player_equip_item':
          await this.handlePlayerEquipItem(message)
          break
        case 'player_gather_resource':
          await this.handlePlayerGatherResource(message)
          break
        case 'chat_message':
          await this.handleChatMessage(message)
          break
        default:
          console.warn(`[RPGWorld] Unknown message type: ${message.type}`)
      }
    } catch (error) {
      console.error('[RPGWorld] Error handling network message:', error)
    }
  }

  private async handlePlayerMove(message: RPGNetworkMessage): Promise<void> {
    const player = this.worldState.players.get(message.playerId!)
    if (!player) return

    const { position, isRunning } = message.data
    
    // Update player position and running state
    player.position = position
    player.isRunning = isRunning
    
    // Handle stamina
    if (isRunning && player.stamina > 0) {
      player.stamina = Math.max(0, player.stamina - (this.config.world.tickRate / 1000))
    } else if (!isRunning && player.stamina < player.maxStamina) {
      player.stamina = Math.min(player.maxStamina, player.stamina + (this.config.world.tickRate / 1000 * 2))
    }
  }

  private async handlePlayerAttack(message: RPGNetworkMessage): Promise<void> {
    const combatSystem = this.systems.get('CombatSystem')
    if (!combatSystem) return

    const { targetId } = message.data
    combatSystem.startCombat(message.playerId!, targetId)
  }

  private async handlePlayerUseItem(message: RPGNetworkMessage): Promise<void> {
    const inventorySystem = this.systems.get('InventorySystem')
    if (!inventorySystem) return

    const { slotIndex } = message.data
    inventorySystem.useItem(message.playerId!, slotIndex)
  }

  private async handlePlayerEquipItem(message: RPGNetworkMessage): Promise<void> {
    const equipmentSystem = this.systems.get('EquipmentSystem')
    if (!equipmentSystem) return

    const { itemId } = message.data
    equipmentSystem.equipItem(message.playerId!, itemId)
  }

  private async handlePlayerGatherResource(message: RPGNetworkMessage): Promise<void> {
    const skillsSystem = this.systems.get('SkillsSystem')
    const inventorySystem = this.systems.get('InventorySystem')
    
    if (!skillsSystem || !inventorySystem) return

    const { resourceId, resourceType } = message.data
    const player = this.worldState.players.get(message.playerId!)
    
    if (!player) return

    // Simple resource gathering logic
    if (resourceType === 'tree') {
      // Woodcutting
      if (skillsSystem.rollSuccess(player.id, 'woodcutting', 1)) {
        inventorySystem.addItem(player.id, 'logs', 1)
        skillsSystem.gainExperience(player.id, 'woodcutting', skillsSystem.getWoodcuttingExperience('logs'))
      }
    } else if (resourceType === 'fishing_spot') {
      // Fishing
      if (skillsSystem.rollSuccess(player.id, 'fishing', 1)) {
        inventorySystem.addItem(player.id, 'raw_shrimps', 1)
        skillsSystem.gainExperience(player.id, 'fishing', skillsSystem.getFishingExperience('raw_shrimps'))
      }
    }
  }

  private async handleChatMessage(message: RPGNetworkMessage): Promise<void> {
    // Broadcast chat message to all players
    this.eventEmitter?.emit('chat_message', {
      type: 'chat_message',
      playerId: message.playerId,
      data: message.data,
      timestamp: new Date()
    })
  }

  // Getters for world state

  getPlayer(playerId: string): RPGPlayer | undefined {
    return this.worldState.players.get(playerId)
  }

  getPlayers(): RPGPlayer[] {
    return Array.from(this.worldState.players.values())
  }

  getPlayerCount(): number {
    return this.worldState.players.size
  }

  getMobs(): any[] {
    return Array.from(this.worldState.mobs.values())
  }

  getWorldState(): RPGWorldState {
    return this.worldState
  }

  getSystem(systemName: string): any {
    return this.systems.get(systemName)
  }

  getSystems(): Map<string, any> {
    return this.systems
  }

  getConfig(): RPGConfig {
    return this.config
  }

  isWorldRunning(): boolean {
    return this.isRunning
  }

  // Utility methods

  async saveWorld(): Promise<void> {
    const persistenceSystem = this.systems.get('PersistenceSystem')
    if (persistenceSystem) {
      await persistenceSystem.saveWorldState()
    }
  }

  async getWorldStats(): Promise<any> {
    const persistenceSystem = this.systems.get('PersistenceSystem')
    
    return {
      isRunning: this.isRunning,
      tickCount: this.worldState.tickCount,
      playerCount: this.worldState.players.size,
      mobCount: this.worldState.mobs.size,
      worldTime: this.worldState.worldTime,
      lastSave: this.worldState.lastSave,
      totalPlayersEver: persistenceSystem ? await persistenceSystem.getPlayerCount() : 0,
      uptime: this.isRunning ? Date.now() - this.lastTickTime : 0
    }
  }
}