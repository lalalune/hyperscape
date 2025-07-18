/**
 * Load Test Runner - Simulates many concurrent players
 * Tests server performance, persistence, and game mechanics under load
 */

import type { World } from '../../types'

interface LoadTestConfig {
  numPlayers: number
  numAgents: number
  testDuration: number // seconds
  spawnDelay: number // ms between spawns
  actionInterval: number // ms between actions
  enableCombat: boolean
  enableTrading: boolean
  enableQuests: boolean
  enableSkilling: boolean
  targetFPS: number
}

interface TestPlayer {
  id: string
  type: 'human' | 'agent'
  entity: any
  position: { x: number; y: number; z: number }
  stats: {
    actions: number
    kills: number
    deaths: number
    trades: number
    questsCompleted: number
    skillsGained: number
  }
  lastAction: number
  isActive: boolean
}

interface LoadTestResults {
  totalPlayers: number
  peakConcurrent: number
  totalActions: number
  averageFPS: number
  minFPS: number
  maxLatency: number
  averageLatency: number
  errors: number
  memoryUsage: {
    start: number
    peak: number
    end: number
  }
  duration: number
  successRate: number
}

export class LoadTestRunner {
  private world: World
  private config: LoadTestConfig
  private players: Map<string, TestPlayer> = new Map()
  private startTime: number = 0
  private frameCount: number = 0
  private fpsHistory: number[] = []
  private latencyHistory: number[] = []
  private errorCount: number = 0
  private running: boolean = false
  private spawnInterval?: NodeJS.Timeout
  private updateInterval?: NodeJS.Timeout
  private peakConcurrent: number = 0
  private memoryStart: number = 0
  private memoryPeak: number = 0

  constructor(world: World, config: Partial<LoadTestConfig> = {}) {
    this.world = world
    this.config = {
      numPlayers: 50,
      numAgents: 50,
      testDuration: 300, // 5 minutes
      spawnDelay: 100,
      actionInterval: 1000,
      enableCombat: true,
      enableTrading: true,
      enableQuests: true,
      enableSkilling: true,
      targetFPS: 60,
      ...config
    }
  }

  async run(): Promise<LoadTestResults> {
    console.log('==========================================')
    console.log('🏃 STARTING HYPERFY RPG LOAD TEST')
    console.log('==========================================')
    console.log(`Players: ${this.config.numPlayers}`)
    console.log(`Agents: ${this.config.numAgents}`)
    console.log(`Duration: ${this.config.testDuration}s`)
    console.log(`Features: Combat=${this.config.enableCombat}, Trading=${this.config.enableTrading}, Quests=${this.config.enableQuests}, Skilling=${this.config.enableSkilling}`)
    console.log('==========================================')

    this.running = true
    this.startTime = Date.now()
    this.memoryStart = process.memoryUsage().heapUsed

    // Start spawning players
    await this.startSpawning()

    // Start update loop
    this.startUpdateLoop()

    // Monitor performance
    this.startPerformanceMonitoring()

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, this.config.testDuration * 1000))

    // Stop test
    this.running = false
    this.stopSpawning()
    this.stopUpdateLoop()

    // Clean up
    await this.cleanup()

    // Generate results
    return this.generateResults()
  }

  private async startSpawning(): Promise<void> {
    let spawnedCount = 0
    const totalToSpawn = this.config.numPlayers + this.config.numAgents

    this.spawnInterval = setInterval(async () => {
      if (spawnedCount >= totalToSpawn) {
        this.stopSpawning()
        return
      }

      const isAgent = spawnedCount >= this.config.numPlayers
      const player = await this.spawnPlayer(isAgent ? 'agent' : 'human')
      
      if (player) {
        spawnedCount++
        console.log(`[LoadTest] Spawned ${player.type} ${player.id} (${spawnedCount}/${totalToSpawn})`)
      }
    }, this.config.spawnDelay)
  }

  private stopSpawning(): void {
    if (this.spawnInterval) {
      clearInterval(this.spawnInterval)
      this.spawnInterval = undefined
    }
  }

  private async spawnPlayer(type: 'human' | 'agent'): Promise<TestPlayer | null> {
    try {
      const id = `test_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Random spawn position
      const spawnAreas = [
        { x: 0, z: 0 }, // Lumbridge
        { x: 200, z: 0 }, // Varrock
        { x: -200, z: 0 }, // Falador
        { x: 0, z: 200 }, // Wilderness
        { x: 0, z: -200 } // Tutorial Island
      ]
      
      const spawnArea = spawnAreas[Math.floor(Math.random() * spawnAreas.length)]
      const position = {
        x: spawnArea.x + Math.random() * 50 - 25,
        y: 0,
        z: spawnArea.z + Math.random() * 50 - 25
      }

      // Spawn entity
      const spawningSystem = (this.world as any).getSystem('spawning')
      const entity = await spawningSystem.spawnEntity('player', position, {
        playerId: id,
        username: `${type}_${id.substr(0, 8)}`,
        displayName: `Test ${type}`,
        isTestPlayer: true
      })

      if (entity) {
        const player: TestPlayer = {
          id,
          type,
          entity,
          position,
          stats: {
            actions: 0,
            kills: 0,
            deaths: 0,
            trades: 0,
            questsCompleted: 0,
            skillsGained: 0
          },
          lastAction: Date.now(),
          isActive: true
        }

        this.players.set(id, player)
        
        // Update peak concurrent
        const concurrent = this.getActivePlayers().length
        if (concurrent > this.peakConcurrent) {
          this.peakConcurrent = concurrent
        }

        return player
      }
    } catch (error) {
      console.error('[LoadTest] Failed to spawn player:', error)
      this.errorCount++
    }

    return null
  }

  private startUpdateLoop(): void {
    this.updateInterval = setInterval(async () => {
      const activePlayers = this.getActivePlayers()
      
      // Perform actions for a subset of players each tick
      const playersToUpdate = this.selectPlayersForUpdate(activePlayers, 0.3) // 30% per tick
      
      for (const player of playersToUpdate) {
        await this.performPlayerAction(player)
      }
    }, 100) // 10 Hz update rate
  }

  private stopUpdateLoop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = undefined
    }
  }

  private async performPlayerAction(player: TestPlayer): Promise<void> {
    const now = Date.now()
    
    // Check action cooldown
    if (now - player.lastAction < this.config.actionInterval) {
      return
    }

    player.lastAction = now
    const actionStart = Date.now()

    try {
      // Random action selection
      const actions = []
      
      if (this.config.enableCombat) actions.push('combat')
      if (this.config.enableTrading) actions.push('trading')
      if (this.config.enableQuests) actions.push('quest')
      if (this.config.enableSkilling) actions.push('skilling')
      actions.push('movement') // Always include movement

      const action = actions[Math.floor(Math.random() * actions.length)]

      switch (action) {
        case 'movement':
          await this.performMovement(player)
          break
        case 'combat':
          await this.performCombat(player)
          break
        case 'trading':
          await this.performTrading(player)
          break
        case 'quest':
          await this.performQuest(player)
          break
        case 'skilling':
          await this.performSkilling(player)
          break
      }

      player.stats.actions++
      
      // Track latency
      const latency = Date.now() - actionStart
      this.latencyHistory.push(latency)

    } catch (error) {
      console.error(`[LoadTest] Action failed for ${player.id}:`, error)
      this.errorCount++
    }
  }

  private async performMovement(player: TestPlayer): Promise<void> {
    const movement = (this.world as any).getSystem('movement')
    if (!movement) return

    // Random nearby position
    const newPosition = {
      x: player.position.x + (Math.random() * 20 - 10),
      y: player.position.y,
      z: player.position.z + (Math.random() * 20 - 10)
    }

    movement.moveEntity(player.entity, newPosition)
    player.position = newPosition
  }

  private async performCombat(player: TestPlayer): Promise<void> {
    const combat = (this.world as any).getSystem('combat')
    if (!combat) return

    // Find nearby target
    const nearbyEntities = this.getNearbyEntities(player.position, 20)
    const targets = nearbyEntities.filter((e: any) => 
      e.id !== player.id && 
      (e.type === 'npc' || e.type === 'player')
    )

    if (targets.length > 0) {
      const target = targets[Math.floor(Math.random() * targets.length)]
      combat.attack(player.entity, target)
    }
  }

  private async performTrading(player: TestPlayer): Promise<void> {
    const trading = (this.world as any).getSystem('trading')
    if (!trading) return

    // Find nearby player
    const nearbyPlayers = this.getNearbyPlayers(player.position, 10)
    
    if (nearbyPlayers.length > 0) {
      const partner = nearbyPlayers[Math.floor(Math.random() * nearbyPlayers.length)]
      
      // Simulate trade
      trading.initiateTrade(player.entity, partner.entity)
      player.stats.trades++
    }
  }

  private async performQuest(player: TestPlayer): Promise<void> {
    const questSystem = (this.world as any).getSystem('quest')
    if (!questSystem) return

    // Random quest action
    const actions = ['accept', 'progress', 'complete']
    const action = actions[Math.floor(Math.random() * actions.length)]

    switch (action) {
      case 'accept':
        // Accept random quest
        const availableQuests = ['tutorial_quest', 'goblin_menace', 'cooks_assistant']
        const questId = availableQuests[Math.floor(Math.random() * availableQuests.length)]
        questSystem.acceptQuest(player.entity, questId)
        break
        
      case 'complete':
        // Try to complete active quest
        const activeQuests = questSystem.getActiveQuests(player.entity)
        if (activeQuests.length > 0) {
          player.stats.questsCompleted++
        }
        break
    }
  }

  private async performSkilling(player: TestPlayer): Promise<void> {
    const skills = (this.world as any).getSystem('skills')
    if (!skills) return

    // Random skill
    const skillTypes = ['mining', 'woodcutting', 'fishing', 'combat']
    const skill = skillTypes[Math.floor(Math.random() * skillTypes.length)]

    // Gain XP
    skills.addExperience(player.entity, skill, Math.floor(Math.random() * 100))
    player.stats.skillsGained++
  }

  private getNearbyEntities(position: any, range: number): any[] {
    const entities: any[] = []
    
    for (const [id, entity] of this.world.entities) {
      const pos = (entity as any).position
      if (pos) {
        const distance = Math.sqrt(
          Math.pow(pos.x - position.x, 2) +
          Math.pow(pos.z - position.z, 2)
        )
        
        if (distance <= range) {
          entities.push(entity)
        }
      }
    }
    
    return entities
  }

  private getNearbyPlayers(position: any, range: number): TestPlayer[] {
    const nearbyPlayers: TestPlayer[] = []
    
    for (const player of this.players.values()) {
      if (!player.isActive) continue
      
      const distance = Math.sqrt(
        Math.pow(player.position.x - position.x, 2) +
        Math.pow(player.position.z - position.z, 2)
      )
      
      if (distance <= range && distance > 0) {
        nearbyPlayers.push(player)
      }
    }
    
    return nearbyPlayers
  }

  private selectPlayersForUpdate(players: TestPlayer[], percentage: number): TestPlayer[] {
    const count = Math.floor(players.length * percentage)
    const shuffled = [...players].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  private getActivePlayers(): TestPlayer[] {
    return Array.from(this.players.values()).filter(p => p.isActive)
  }

  private startPerformanceMonitoring(): void {
    let lastFrameTime = Date.now()
    
    const monitor = () => {
      if (!this.running) return
      
      const now = Date.now()
      const deltaTime = now - lastFrameTime
      
      if (deltaTime > 0) {
        const fps = 1000 / deltaTime
        this.fpsHistory.push(fps)
        this.frameCount++
      }
      
      // Update memory usage
      const memUsage = process.memoryUsage().heapUsed
      if (memUsage > this.memoryPeak) {
        this.memoryPeak = memUsage
      }
      
      lastFrameTime = now
      
      if (this.running) {
        setImmediate(monitor)
      }
    }
    
    monitor()
  }

  private async cleanup(): Promise<void> {
    console.log('[LoadTest] Cleaning up...')
    
    // Remove all test entities
    for (const player of this.players.values()) {
      if (player.entity) {
        this.world.entities.delete(player.entity.id)
      }
    }
    
    this.players.clear()
  }

  private generateResults(): LoadTestResults {
    const duration = (Date.now() - this.startTime) / 1000
    const totalActions = Array.from(this.players.values())
      .reduce((sum, p) => sum + p.stats.actions, 0)
    
    const avgFPS = this.fpsHistory.length > 0
      ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
      : 0
    
    const minFPS = this.fpsHistory.length > 0
      ? Math.min(...this.fpsHistory)
      : 0
    
    const avgLatency = this.latencyHistory.length > 0
      ? this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
      : 0
    
    const maxLatency = this.latencyHistory.length > 0
      ? Math.max(...this.latencyHistory)
      : 0

    const results: LoadTestResults = {
      totalPlayers: this.players.size,
      peakConcurrent: this.peakConcurrent,
      totalActions,
      averageFPS: Math.round(avgFPS),
      minFPS: Math.round(minFPS),
      maxLatency: Math.round(maxLatency),
      averageLatency: Math.round(avgLatency),
      errors: this.errorCount,
      memoryUsage: {
        start: Math.round(this.memoryStart / 1024 / 1024),
        peak: Math.round(this.memoryPeak / 1024 / 1024),
        end: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      },
      duration,
      successRate: totalActions > 0 ? ((totalActions - this.errorCount) / totalActions) * 100 : 0
    }

    // Print results
    console.log('==========================================')
    console.log('📊 LOAD TEST RESULTS')
    console.log('==========================================')
    console.log(`Duration: ${results.duration.toFixed(1)}s`)
    console.log(`Total Players: ${results.totalPlayers} (Peak: ${results.peakConcurrent})`)
    console.log(`Total Actions: ${results.totalActions}`)
    console.log(`Success Rate: ${results.successRate.toFixed(1)}%`)
    console.log(`Errors: ${results.errors}`)
    console.log('------------------------------------------')
    console.log('PERFORMANCE:')
    console.log(`Average FPS: ${results.averageFPS} (Min: ${results.minFPS})`)
    console.log(`Average Latency: ${results.averageLatency}ms (Max: ${results.maxLatency}ms)`)
    console.log(`Memory: ${results.memoryUsage.start}MB → ${results.memoryUsage.peak}MB (Peak) → ${results.memoryUsage.end}MB`)
    console.log('------------------------------------------')
    
    // Performance rating
    const rating = this.calculatePerformanceRating(results)
    console.log(`OVERALL RATING: ${rating}`)
    console.log('==========================================')

    return results
  }

  private calculatePerformanceRating(results: LoadTestResults): string {
    let score = 100

    // FPS penalty
    if (results.averageFPS < this.config.targetFPS) {
      score -= (this.config.targetFPS - results.averageFPS) * 0.5
    }
    if (results.minFPS < 30) {
      score -= 10
    }

    // Latency penalty
    if (results.averageLatency > 50) {
      score -= (results.averageLatency - 50) * 0.2
    }
    if (results.maxLatency > 200) {
      score -= 10
    }

    // Error penalty
    if (results.errors > 0) {
      score -= Math.min(20, results.errors * 0.1)
    }

    // Memory penalty
    const memoryGrowth = results.memoryUsage.peak - results.memoryUsage.start
    if (memoryGrowth > 500) { // 500MB growth
      score -= 10
    }

    // Success rate
    if (results.successRate < 99) {
      score -= (100 - results.successRate) * 2
    }

    // Rating
    if (score >= 90) return '⭐⭐⭐⭐⭐ EXCELLENT'
    if (score >= 80) return '⭐⭐⭐⭐ VERY GOOD'
    if (score >= 70) return '⭐⭐⭐ GOOD'
    if (score >= 60) return '⭐⭐ ACCEPTABLE'
    return '⭐ NEEDS IMPROVEMENT'
  }
}
