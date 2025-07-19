import { RPGWorld } from '../RPGWorld.js'
import { RPGPlayer, RPGPosition } from '../types/index.js'
import { EventEmitter } from 'events'

/**
 * Test world for RPG system testing
 * Provides a controlled environment for testing RPG mechanics
 */
export class RPGTestWorld extends EventEmitter {
  private rpgWorld: RPGWorld
  private testDatabase: any
  private testPlayers: Map<string, RPGPlayer> = new Map()
  private testResults: any[] = []
  private isRunning: boolean = false

  constructor() {
    super()
    
    // Create in-memory test database
    this.testDatabase = this.createTestDatabase()
    
    // Create RPG world for testing
    this.rpgWorld = new RPGWorld({
      world: {
        tickRate: 10, // Fast ticks for testing
        saveInterval: 1000,
        maxPlayers: 10,
        startingTowns: ['test_town']
      },
      combat: {
        autoAttackInterval: 100, // Fast combat for testing
        combatTimeout: 5000,
        maxDamage: 99,
        criticalChance: 0.05
      }
    }, this.testDatabase, this)
  }

  async initialize(): Promise<void> {
    console.log('[RPGTestWorld] Initializing test world...')
    
    try {
      await this.rpgWorld.start()
      this.isRunning = true
      
      // Set up test event listeners
      this.setupTestEventListeners()
      
      console.log('[RPGTestWorld] Test world initialized successfully')
      
    } catch (error) {
      console.error('[RPGTestWorld] Failed to initialize test world:', error)
      throw error
    }
  }

  async cleanup(): Promise<void> {
    console.log('[RPGTestWorld] Cleaning up test world...')
    
    try {
      if (this.isRunning) {
        await this.rpgWorld.stop()
        this.isRunning = false
      }
      
      this.testPlayers.clear()
      this.testResults = []
      
      console.log('[RPGTestWorld] Test world cleaned up successfully')
      
    } catch (error) {
      console.error('[RPGTestWorld] Error during cleanup:', error)
      throw error
    }
  }

  private createTestDatabase(): any {
    // Mock database for testing
    const tables: any = {
      players: new Map(),
      inventories: new Map(),
      equipment: new Map(),
      banks: new Map()
    }

    return {
      run: async (query: string, params?: any[]): Promise<any> => {
        // Mock database operations
        if (query.includes('CREATE TABLE')) {
          return { changes: 0 }
        }
        
        if (query.includes('INSERT OR REPLACE INTO players')) {
          const playerId = params?.[0]
          if (playerId) {
            tables.players.set(playerId, params)
          }
          return { changes: 1 }
        }
        
        if (query.includes('DELETE FROM')) {
          return { changes: 1 }
        }
        
        return { changes: 0 }
      },
      
      get: async (query: string, params?: any[]): Promise<any> => {
        if (query.includes('SELECT') && query.includes('players')) {
          const playerId = params?.[0]
          if (playerId && tables.players.has(playerId)) {
            const playerData = tables.players.get(playerId)
            return {
              id: playerData[0],
              name: playerData[1],
              position_x: playerData[2],
              position_y: playerData[3],
              position_z: playerData[4],
              // ... other fields
            }
          }
        }
        
        if (query.includes('COUNT(*)')) {
          return { count: tables.players.size }
        }
        
        return null
      },
      
      all: async (query: string, params?: any[]): Promise<any[]> => {
        if (query.includes('SELECT') && query.includes('players')) {
          return Array.from(tables.players.values()).map(playerData => ({
            id: playerData[0],
            name: playerData[1],
            position_x: playerData[2],
            position_y: playerData[3],
            position_z: playerData[4],
            // ... other fields
          }))
        }
        
        return []
      }
    }
  }

  private setupTestEventListeners(): void {
    // Listen for RPG events for testing
    this.rpgWorld.on('player_join', (data) => {
      this.recordTestResult('player_join', data)
    })

    this.rpgWorld.on('combat_start', (data) => {
      this.recordTestResult('combat_start', data)
    })

    this.rpgWorld.on('combat_update', (data) => {
      this.recordTestResult('combat_update', data)
    })

    this.rpgWorld.on('level_up', (data) => {
      this.recordTestResult('level_up', data)
    })

    this.rpgWorld.on('item_drop', (data) => {
      this.recordTestResult('item_drop', data)
    })

    this.rpgWorld.on('mob_spawn', (data) => {
      this.recordTestResult('mob_spawn', data)
    })

    this.rpgWorld.on('mob_death', (data) => {
      this.recordTestResult('mob_death', data)
    })
  }

  private recordTestResult(eventType: string, data: any): void {
    this.testResults.push({
      eventType,
      data,
      timestamp: new Date()
    })
  }

  // Test helper methods

  async createTestPlayer(name: string, position?: RPGPosition): Promise<RPGPlayer> {
    const playerId = `test_player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const player = await this.rpgWorld.addPlayer(playerId, name)
    
    if (position) {
      player.position = position
    }
    
    this.testPlayers.set(playerId, player)
    
    return player
  }

  async removeTestPlayer(playerId: string): Promise<void> {
    await this.rpgWorld.removePlayer(playerId)
    this.testPlayers.delete(playerId)
  }

  getTestPlayer(playerId: string): RPGPlayer | undefined {
    return this.testPlayers.get(playerId)
  }

  getAllTestPlayers(): RPGPlayer[] {
    return Array.from(this.testPlayers.values())
  }

  // Test simulation methods

  async simulatePlayerMove(playerId: string, newPosition: RPGPosition): Promise<void> {
    const player = this.getTestPlayer(playerId)
    if (!player) return

    await this.rpgWorld.handleNetworkMessage({
      type: 'player_move',
      playerId,
      data: {
        position: newPosition,
        isRunning: false
      },
      timestamp: new Date()
    })
  }

  async simulatePlayerAttack(attackerId: string, targetId: string): Promise<void> {
    await this.rpgWorld.handleNetworkMessage({
      type: 'player_attack',
      playerId: attackerId,
      data: { targetId },
      timestamp: new Date()
    })
  }

  async simulatePlayerUseItem(playerId: string, slotIndex: number): Promise<void> {
    await this.rpgWorld.handleNetworkMessage({
      type: 'player_use_item',
      playerId,
      data: { slotIndex },
      timestamp: new Date()
    })
  }

  async simulatePlayerEquipItem(playerId: string, itemId: string): Promise<void> {
    await this.rpgWorld.handleNetworkMessage({
      type: 'player_equip_item',
      playerId,
      data: { itemId },
      timestamp: new Date()
    })
  }

  async simulatePlayerGatherResource(playerId: string, resourceId: string, resourceType: string): Promise<void> {
    await this.rpgWorld.handleNetworkMessage({
      type: 'player_gather_resource',
      playerId,
      data: { resourceId, resourceType },
      timestamp: new Date()
    })
  }

  async simulatePlayerChatMessage(playerId: string, message: string): Promise<void> {
    await this.rpgWorld.handleNetworkMessage({
      type: 'chat_message',
      playerId,
      data: { message, channel: 'public' },
      timestamp: new Date()
    })
  }

  // Test verification methods

  getTestResults(): any[] {
    return [...this.testResults]
  }

  clearTestResults(): void {
    this.testResults = []
  }

  getTestResultsByType(eventType: string): any[] {
    return this.testResults.filter(result => result.eventType === eventType)
  }

  getLastTestResult(): any | null {
    return this.testResults.length > 0 ? this.testResults[this.testResults.length - 1] : null
  }

  waitForEvent(eventType: string, timeout: number = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${eventType}`))
      }, timeout)

      const checkForEvent = () => {
        const result = this.getTestResultsByType(eventType)
        if (result.length > 0) {
          clearTimeout(timer)
          resolve(result[result.length - 1])
        } else {
          setTimeout(checkForEvent, 100)
        }
      }

      checkForEvent()
    })
  }

  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // System access methods

  getRPGWorld(): RPGWorld {
    return this.rpgWorld
  }

  getSystem(systemName: string): any {
    return this.rpgWorld.getSystem(systemName)
  }

  getCombatSystem(): any {
    return this.getSystem('CombatSystem')
  }

  getSkillsSystem(): any {
    return this.getSystem('SkillsSystem')
  }

  getInventorySystem(): any {
    return this.getSystem('InventorySystem')
  }

  getEquipmentSystem(): any {
    return this.getSystem('EquipmentSystem')
  }

  getWorldSystem(): any {
    return this.getSystem('WorldSystem')
  }

  getMobSystem(): any {
    return this.getSystem('MobSystem')
  }

  getPersistenceSystem(): any {
    return this.getSystem('PersistenceSystem')
  }

  // Test validation methods

  validatePlayerPosition(playerId: string, expectedPosition: RPGPosition, tolerance: number = 0.1): boolean {
    const player = this.getTestPlayer(playerId)
    if (!player) return false

    const dx = Math.abs(player.position.x - expectedPosition.x)
    const dy = Math.abs(player.position.y - expectedPosition.y)
    const dz = Math.abs(player.position.z - expectedPosition.z)

    return dx <= tolerance && dy <= tolerance && dz <= tolerance
  }

  validatePlayerHealth(playerId: string, expectedHealth: number): boolean {
    const player = this.getTestPlayer(playerId)
    return player ? player.health === expectedHealth : false
  }

  validatePlayerLevel(playerId: string, skill: string, expectedLevel: number): boolean {
    const player = this.getTestPlayer(playerId)
    return player ? player.stats[skill as keyof typeof player.stats] === expectedLevel : false
  }

  validatePlayerInventory(playerId: string, itemId: string, expectedQuantity: number): boolean {
    const player = this.getTestPlayer(playerId)
    if (!player) return false

    const inventorySystem = this.getInventorySystem()
    const actualQuantity = inventorySystem.getItemCount(playerId, itemId)
    
    return actualQuantity === expectedQuantity
  }

  validatePlayerEquipment(playerId: string, slot: string, expectedItemId: string | null): boolean {
    const player = this.getTestPlayer(playerId)
    if (!player) return false

    const actualItemId = player.equipment[slot as keyof typeof player.equipment]
    return actualItemId === expectedItemId
  }

  validateCombatInProgress(playerId: string): boolean {
    const player = this.getTestPlayer(playerId)
    return player ? player.inCombat : false
  }

  validateEventOccurred(eventType: string, withinMs: number = 5000): boolean {
    const results = this.getTestResultsByType(eventType)
    if (results.length === 0) return false

    const lastResult = results[results.length - 1]
    const timeDiff = Date.now() - lastResult.timestamp.getTime()
    
    return timeDiff <= withinMs
  }

  // Performance testing methods

  async measurePerformance(testName: string, testFunction: () => Promise<void>): Promise<{ duration: number; memoryUsage: any }> {
    const startTime = Date.now()
    const startMemory = process.memoryUsage()
    
    await testFunction()
    
    const endTime = Date.now()
    const endMemory = process.memoryUsage()
    
    const duration = endTime - startTime
    const memoryUsage = {
      rss: endMemory.rss - startMemory.rss,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external
    }
    
    console.log(`[RPGTestWorld] Performance test "${testName}": ${duration}ms, Memory delta: ${JSON.stringify(memoryUsage)}`)
    
    return { duration, memoryUsage }
  }

  // Test status methods

  isTestWorldRunning(): boolean {
    return this.isRunning
  }

  getTestWorldStats(): any {
    return {
      isRunning: this.isRunning,
      testPlayerCount: this.testPlayers.size,
      testResultCount: this.testResults.length,
      rpgWorldStats: this.rpgWorld.getWorldStats()
    }
  }
}