import { RPGWorld } from './RPGWorld.js'
import { RPGPlayer, RPGPosition } from './types/index.js'
import { EventEmitter } from 'events'

/**
 * Integration layer between Hyperfy and the RPG system
 * Handles the connection between Hyperfy's world system and RPG mechanics
 */
export class HyperfyRPGIntegration extends EventEmitter {
  private rpgWorld: RPGWorld
  private hyperfyWorld: any // Hyperfy world instance
  private playerEntityMap: Map<string, any> = new Map() // playerId -> hyperfy entity
  private entityPlayerMap: Map<string, string> = new Map() // entityId -> playerId
  private isInitialized: boolean = false

  constructor(hyperfyWorld: any, config: any = {}, db?: any) {
    super()
    
    this.hyperfyWorld = hyperfyWorld
    this.rpgWorld = new RPGWorld(config, db, this)
    
    // Set up event forwarding
    this.setupEventForwarding()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    console.log('[HyperfyRPGIntegration] Initializing...')

    try {
      // Start the RPG world
      await this.rpgWorld.start()
      
      // Set up Hyperfy event listeners
      this.setupHyperfyEventListeners()
      
      this.isInitialized = true
      console.log('[HyperfyRPGIntegration] Initialized successfully')
      
    } catch (error) {
      console.error('[HyperfyRPGIntegration] Failed to initialize:', error)
      throw error
    }
  }

  async cleanup(): Promise<void> {
    if (!this.isInitialized) return

    console.log('[HyperfyRPGIntegration] Cleaning up...')

    try {
      // Stop the RPG world
      await this.rpgWorld.stop()
      
      // Clear maps
      this.playerEntityMap.clear()
      this.entityPlayerMap.clear()
      
      this.isInitialized = false
      console.log('[HyperfyRPGIntegration] Cleaned up successfully')
      
    } catch (error) {
      console.error('[HyperfyRPGIntegration] Error during cleanup:', error)
      throw error
    }
  }

  private setupEventForwarding(): void {
    // Forward RPG events to Hyperfy
    this.on('player_update', (data) => {
      this.sendToHyperfy('rpg_player_update', data)
    })

    this.on('mob_update', (data) => {
      this.sendToHyperfy('rpg_mob_update', data)
    })

    this.on('combat_start', (data) => {
      this.sendToHyperfy('rpg_combat_start', data)
    })

    this.on('combat_update', (data) => {
      this.sendToHyperfy('rpg_combat_update', data)
    })

    this.on('level_up', (data) => {
      this.sendToHyperfy('rpg_level_up', data)
    })

    this.on('item_drop', (data) => {
      this.sendToHyperfy('rpg_item_drop', data)
    })

    this.on('chat_message', (data) => {
      this.sendToHyperfy('rpg_chat_message', data)
    })
  }

  private setupHyperfyEventListeners(): void {
    // Listen for Hyperfy player events
    this.hyperfyWorld.on('player_join', (player: any) => {
      this.handlePlayerJoin(player)
    })

    this.hyperfyWorld.on('player_leave', (player: any) => {
      this.handlePlayerLeave(player)
    })

    this.hyperfyWorld.on('player_move', (player: any, position: any) => {
      this.handlePlayerMove(player, position)
    })

    // Listen for custom RPG events from Hyperfy
    this.hyperfyWorld.on('rpg_player_attack', (player: any, data: any) => {
      this.handlePlayerAttack(player, data)
    })

    this.hyperfyWorld.on('rpg_player_use_item', (player: any, data: any) => {
      this.handlePlayerUseItem(player, data)
    })

    this.hyperfyWorld.on('rpg_player_equip_item', (player: any, data: any) => {
      this.handlePlayerEquipItem(player, data)
    })

    this.hyperfyWorld.on('rpg_player_gather_resource', (player: any, data: any) => {
      this.handlePlayerGatherResource(player, data)
    })

    this.hyperfyWorld.on('rpg_chat_message', (player: any, data: any) => {
      this.handleChatMessage(player, data)
    })
  }

  private async handlePlayerJoin(hyperfyPlayer: any): Promise<void> {
    try {
      const playerId = hyperfyPlayer.id
      const playerName = hyperfyPlayer.name || `Player_${playerId}`
      
      // Add player to RPG world
      const rpgPlayer = await this.rpgWorld.addPlayer(playerId, playerName)
      
      // Store mapping
      this.playerEntityMap.set(playerId, hyperfyPlayer)
      this.entityPlayerMap.set(hyperfyPlayer.id, playerId)
      
      // Sync player position between systems
      this.syncPlayerPosition(rpgPlayer, hyperfyPlayer)
      
      // Send initial RPG data to player
      this.sendPlayerRPGData(playerId, rpgPlayer)
      
      console.log(`[HyperfyRPGIntegration] Player joined: ${playerName}`)
      
    } catch (error) {
      console.error('[HyperfyRPGIntegration] Error handling player join:', error)
    }
  }

  private async handlePlayerLeave(hyperfyPlayer: any): Promise<void> {
    try {
      const playerId = hyperfyPlayer.id
      
      // Remove player from RPG world
      await this.rpgWorld.removePlayer(playerId)
      
      // Clean up mappings
      this.playerEntityMap.delete(playerId)
      this.entityPlayerMap.delete(hyperfyPlayer.id)
      
      console.log(`[HyperfyRPGIntegration] Player left: ${playerId}`)
      
    } catch (error) {
      console.error('[HyperfyRPGIntegration] Error handling player leave:', error)
    }
  }

  private async handlePlayerMove(hyperfyPlayer: any, position: any): Promise<void> {
    try {
      const playerId = hyperfyPlayer.id
      const rpgPlayer = this.rpgWorld.getPlayer(playerId)
      
      if (!rpgPlayer) return
      
      // Update RPG player position
      rpgPlayer.position = this.hyperfyToRPGPosition(position)
      
      // Handle network message
      await this.rpgWorld.handleNetworkMessage({
        type: 'player_move',
        playerId,
        data: {
          position: rpgPlayer.position,
          isRunning: hyperfyPlayer.isRunning || false
        },
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('[HyperfyRPGIntegration] Error handling player move:', error)
    }
  }

  private async handlePlayerAttack(hyperfyPlayer: any, data: any): Promise<void> {
    try {
      const playerId = hyperfyPlayer.id
      
      await this.rpgWorld.handleNetworkMessage({
        type: 'player_attack',
        playerId,
        data,
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('[HyperfyRPGIntegration] Error handling player attack:', error)
    }
  }

  private async handlePlayerUseItem(hyperfyPlayer: any, data: any): Promise<void> {
    try {
      const playerId = hyperfyPlayer.id
      
      await this.rpgWorld.handleNetworkMessage({
        type: 'player_use_item',
        playerId,
        data,
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('[HyperfyRPGIntegration] Error handling player use item:', error)
    }
  }

  private async handlePlayerEquipItem(hyperfyPlayer: any, data: any): Promise<void> {
    try {
      const playerId = hyperfyPlayer.id
      
      await this.rpgWorld.handleNetworkMessage({
        type: 'player_equip_item',
        playerId,
        data,
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('[HyperfyRPGIntegration] Error handling player equip item:', error)
    }
  }

  private async handlePlayerGatherResource(hyperfyPlayer: any, data: any): Promise<void> {
    try {
      const playerId = hyperfyPlayer.id
      
      await this.rpgWorld.handleNetworkMessage({
        type: 'player_gather_resource',
        playerId,
        data,
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('[HyperfyRPGIntegration] Error handling player gather resource:', error)
    }
  }

  private async handleChatMessage(hyperfyPlayer: any, data: any): Promise<void> {
    try {
      const playerId = hyperfyPlayer.id
      
      await this.rpgWorld.handleNetworkMessage({
        type: 'chat_message',
        playerId,
        data,
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('[HyperfyRPGIntegration] Error handling chat message:', error)
    }
  }

  private syncPlayerPosition(rpgPlayer: RPGPlayer, hyperfyPlayer: any): void {
    // Sync position from RPG to Hyperfy
    const hyperfyPosition = this.rpgToHyperfyPosition(rpgPlayer.position)
    
    if (hyperfyPlayer.setPosition) {
      hyperfyPlayer.setPosition(hyperfyPosition)
    }
  }

  private sendPlayerRPGData(playerId: string, rpgPlayer: RPGPlayer): void {
    // Send complete RPG player data to client
    this.sendToHyperfy('rpg_player_data', {
      playerId,
      data: {
        stats: rpgPlayer.stats,
        experience: rpgPlayer.experience,
        health: rpgPlayer.health,
        maxHealth: rpgPlayer.maxHealth,
        inventory: rpgPlayer.inventory,
        equipment: rpgPlayer.equipment,
        coins: rpgPlayer.coins,
        combatStyle: rpgPlayer.combatStyle,
        stamina: rpgPlayer.stamina,
        maxStamina: rpgPlayer.maxStamina
      }
    })
  }

  private sendToHyperfy(eventType: string, data: any): void {
    try {
      if (this.hyperfyWorld.broadcast) {
        this.hyperfyWorld.broadcast(eventType, data)
      } else if (this.hyperfyWorld.emit) {
        this.hyperfyWorld.emit(eventType, data)
      }
    } catch (error) {
      console.error('[HyperfyRPGIntegration] Error sending to Hyperfy:', error)
    }
  }

  private hyperfyToRPGPosition(hyperfyPosition: any): RPGPosition {
    return {
      x: hyperfyPosition.x || 0,
      y: hyperfyPosition.y || 0,
      z: hyperfyPosition.z || 0,
      rotation: hyperfyPosition.rotation ? {
        x: hyperfyPosition.rotation.x || 0,
        y: hyperfyPosition.rotation.y || 0,
        z: hyperfyPosition.rotation.z || 0,
        w: hyperfyPosition.rotation.w || 1
      } : undefined
    }
  }

  private rpgToHyperfyPosition(rpgPosition: RPGPosition): any {
    return {
      x: rpgPosition.x,
      y: rpgPosition.y,
      z: rpgPosition.z,
      rotation: rpgPosition.rotation ? {
        x: rpgPosition.rotation.x,
        y: rpgPosition.rotation.y,
        z: rpgPosition.rotation.z,
        w: rpgPosition.rotation.w
      } : undefined
    }
  }

  // Public API methods

  getRPGWorld(): RPGWorld {
    return this.rpgWorld
  }

  getHyperfyWorld(): any {
    return this.hyperfyWorld
  }

  getPlayerByHyperfyId(hyperfyId: string): RPGPlayer | undefined {
    const playerId = this.entityPlayerMap.get(hyperfyId)
    return playerId ? this.rpgWorld.getPlayer(playerId) : undefined
  }

  getHyperfyPlayerByRPGId(rpgPlayerId: string): any {
    return this.playerEntityMap.get(rpgPlayerId)
  }

  async sendCommandToPlayer(playerId: string, command: string, data?: any): Promise<void> {
    const hyperfyPlayer = this.playerEntityMap.get(playerId)
    if (hyperfyPlayer && hyperfyPlayer.send) {
      hyperfyPlayer.send(command, data)
    }
  }

  async broadcastCommand(command: string, data?: any): Promise<void> {
    this.sendToHyperfy(command, data)
  }

  getIntegrationStats(): any {
    return {
      isInitialized: this.isInitialized,
      playerCount: this.playerEntityMap.size,
      rpgWorldStats: this.rpgWorld.isWorldRunning() ? this.rpgWorld.getWorldStats() : null
    }
  }

  // Helper methods for Hyperfy Apps

  async createRPGEntity(entityType: string, position: RPGPosition, data?: any): Promise<any> {
    // Create entity in Hyperfy world
    if (this.hyperfyWorld.createEntity) {
      return await this.hyperfyWorld.createEntity(entityType, {
        position: this.rpgToHyperfyPosition(position),
        ...data
      })
    }
    return null
  }

  async removeRPGEntity(entityId: string): Promise<void> {
    if (this.hyperfyWorld.removeEntity) {
      await this.hyperfyWorld.removeEntity(entityId)
    }
  }

  async updateRPGEntity(entityId: string, updates: any): Promise<void> {
    if (this.hyperfyWorld.updateEntity) {
      await this.hyperfyWorld.updateEntity(entityId, updates)
    }
  }

  // RPG-specific helper methods

  async spawnMobInHyperfy(mobData: any): Promise<any> {
    return await this.createRPGEntity('rpg_mob', mobData.position, {
      mobType: mobData.type,
      mobId: mobData.id,
      health: mobData.health,
      maxHealth: mobData.maxHealth,
      level: mobData.level
    })
  }

  async spawnItemDropInHyperfy(itemData: any): Promise<any> {
    return await this.createRPGEntity('rpg_item_drop', itemData.position, {
      itemId: itemData.itemId,
      quantity: itemData.quantity,
      droppedBy: itemData.droppedBy
    })
  }

  async createRPGShopInHyperfy(shopData: any): Promise<any> {
    return await this.createRPGEntity('rpg_shop', shopData.position, {
      shopId: shopData.id,
      shopName: shopData.name,
      items: shopData.items
    })
  }

  async createRPGBankInHyperfy(bankData: any): Promise<any> {
    return await this.createRPGEntity('rpg_bank', bankData.position, {
      bankId: bankData.id,
      bankName: bankData.name || 'Bank'
    })
  }
}