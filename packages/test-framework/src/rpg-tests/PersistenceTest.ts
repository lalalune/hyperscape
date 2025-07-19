import { VisualTestRunner, VisualTestConfig, TEST_COLORS } from '../visual-testing/VisualTestRunner.js'
import { TestScenario } from './TestScenario.js'

export class PersistenceTest extends TestScenario {
  name = 'RPG Persistence System Test'
  description = 'Tests saving and loading of player data, inventory, skills, and world state'

  private playerDataBefore: any = null
  private playerDataAfter: any = null

  async createTestWorld(): Promise<void> {
    const worldConfig = {
      worldName: 'rpg-persistence-test',
      apps: [
        // Player with specific stats for testing
        {
          type: 'RPGPlayer',
          position: { x: 0, y: 0, z: 0 },
          config: {
            playerName: 'PersistenceTestPlayer',
            startingLevel: 1,
            health: 100,
            visualColor: TEST_COLORS.PLAYER.toLowerCase()
          }
        },
        // Goblins to gain XP and items
        {
          type: 'RPGGoblin',
          position: { x: 5, y: 0, z: 0 },
          config: {
            goblinName: 'XPGoblin1',
            level: 1,
            maxHealth: 15,
            aggressive: false,
            respawnTime: 5,
            visualColor: TEST_COLORS.GOBLIN.toLowerCase()
          }
        },
        {
          type: 'RPGGoblin',
          position: { x: 10, y: 0, z: 0 },
          config: {
            goblinName: 'XPGoblin2',
            level: 2,
            maxHealth: 20,
            aggressive: false,
            respawnTime: 5,
            visualColor: TEST_COLORS.GOBLIN.toLowerCase()
          }
        },
        // Trees for woodcutting skill
        {
          type: 'RPGTree',
          position: { x: -5, y: 0, z: 0 },
          config: {
            treeType: 'normal',
            health: 10,
            visualColor: TEST_COLORS.TREE.toLowerCase()
          }
        },
        {
          type: 'RPGTree',
          position: { x: -10, y: 0, z: 0 },
          config: {
            treeType: 'normal',
            health: 10,
            visualColor: TEST_COLORS.TREE.toLowerCase()
          }
        },
        // Fishing spot
        {
          type: 'RPGFishingSpot',
          position: { x: 0, y: 0, z: 15 },
          config: {
            fishType: 'normal',
            visualColor: TEST_COLORS.FISHING_SPOT.toLowerCase()
          }
        }
      ]
    }

    await this.deployWorld(worldConfig)
  }

  async runTest(): Promise<void> {
    console.log('[PersistenceTest] Starting persistence test...')

    const testConfig: VisualTestConfig = {
      worldName: 'rpg-persistence-test',
      testName: 'persistence',
      timeout: 180000,
      screenshotDir: './test-results/persistence',
      expectedEntities: [
        { type: 'PLAYER', count: 1 },
        { type: 'GOBLIN', count: 2 },
        { type: 'TREE', count: 2 },
        { type: 'FISHING_SPOT', count: 1 }
      ],
      validationRules: [
        {
          name: 'world-entities-present',
          validate: (analysis) => {
            const player = analysis.entityClusters.get('PLAYER')
            const goblins = analysis.entityClusters.get('GOBLIN')
            const trees = analysis.entityClusters.get('TREE')
            const fishingSpots = analysis.entityClusters.get('FISHING_SPOT')
            
            return !!(player && player.length === 1 && 
                     goblins && goblins.length === 2 &&
                     trees && trees.length === 2 &&
                     fishingSpots && fishingSpots.length === 1)
          },
          errorMessage: 'Not all world entities are present'
        }
      ]
    }

    const runner = new VisualTestRunner(testConfig)
    await runner.initialize()
    await runner.loadWorld()

    // Phase 1: Initial state
    console.log('[PersistenceTest] Phase 1: Recording initial state')
    const initialResult = await runner.runTest()
    this.results.push({
      phase: 'initial',
      ...initialResult
    })

    // Capture initial player data
    this.playerDataBefore = await this.capturePlayerData(runner)

    // Phase 2: Gain XP and items
    console.log('[PersistenceTest] Phase 2: Gaining XP and items')
    await this.gainXPAndItems(runner)

    const xpGainResult = await runner.runTest()
    this.results.push({
      phase: 'xp-gain',
      ...xpGainResult
    })

    // Phase 3: Modify inventory
    console.log('[PersistenceTest] Phase 3: Modifying inventory')
    await this.modifyInventory(runner)

    const inventoryResult = await runner.runTest()
    this.results.push({
      phase: 'inventory-modification',
      ...inventoryResult
    })

    // Phase 4: Save state
    console.log('[PersistenceTest] Phase 4: Saving state')
    await this.saveGameState(runner)

    const saveResult = await runner.runTest()
    this.results.push({
      phase: 'save-state',
      ...saveResult
    })

    // Phase 5: Simulate disconnect/reconnect
    console.log('[PersistenceTest] Phase 5: Simulating disconnect/reconnect')
    await this.simulateDisconnectReconnect(runner)

    const reconnectResult = await runner.runTest()
    this.results.push({
      phase: 'reconnect',
      ...reconnectResult
    })

    // Phase 6: Load state
    console.log('[PersistenceTest] Phase 6: Loading state')
    await this.loadGameState(runner)

    const loadResult = await runner.runTest()
    this.results.push({
      phase: 'load-state',
      ...loadResult
    })

    // Capture final player data
    this.playerDataAfter = await this.capturePlayerData(runner)

    // Phase 7: Verify persistence
    console.log('[PersistenceTest] Phase 7: Verifying persistence')
    const verifyResult = await runner.runTest()
    this.results.push({
      phase: 'verify-persistence',
      ...verifyResult
    })

    await runner.cleanup()
    console.log('[PersistenceTest] Persistence test completed')
  }

  private async capturePlayerData(runner: VisualTestRunner): Promise<any> {
    if (!runner['page']) return null

    return await runner['page'].evaluate(() => {
      // Access player data from the global game state
      const world = (window as any).world
      if (!world) return null

      const rpgApps = world.apps.getAll().filter((app: any) => app.getRPGStats)
      if (rpgApps.length === 0) return null

      const playerApp = rpgApps[0]
      const stats = playerApp.getRPGStats()

      return {
        name: stats.name,
        position: stats.position,
        hitpoints: stats.hitpoints,
        attack: stats.attack,
        strength: stats.strength,
        defense: stats.defense,
        woodcutting: stats.woodcutting,
        fishing: stats.fishing,
        cooking: stats.cooking,
        firemaking: stats.firemaking,
        inventory: stats.inventory,
        equipment: stats.equipment,
        timestamp: Date.now()
      }
    })
  }

  private async gainXPAndItems(runner: VisualTestRunner): Promise<void> {
    if (!runner['page']) return

    // Kill goblins for combat XP
    console.log('[PersistenceTest] Killing goblins for XP...')
    await runner['page'].click('canvas', {
      position: { x: 800, y: 540 } // First goblin
    })
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Keep attacking until goblin dies
    for (let i = 0; i < 10; i++) {
      await runner['page'].click('canvas', {
        position: { x: 800, y: 540 }
      })
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Attack second goblin
    await runner['page'].click('canvas', {
      position: { x: 900, y: 540 } // Second goblin
    })
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    for (let i = 0; i < 10; i++) {
      await runner['page'].click('canvas', {
        position: { x: 900, y: 540 }
      })
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Gather resources
    console.log('[PersistenceTest] Gathering resources...')
    
    // Woodcutting
    await runner['page'].click('canvas', {
      position: { x: 600, y: 540 } // First tree
    })
    await new Promise(resolve => setTimeout(resolve, 5000))

    await runner['page'].click('canvas', {
      position: { x: 500, y: 540 } // Second tree
    })
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Fishing
    await runner['page'].click('canvas', {
      position: { x: 960, y: 700 } // Fishing spot
    })
    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  private async modifyInventory(runner: VisualTestRunner): Promise<void> {
    if (!runner['page']) return

    // Open inventory (assuming there's a UI for this)
    await runner['page'].keyboard.press('KeyI')
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Use items, cook fish, etc.
    await runner['page'].evaluate(() => {
      // Cook fish using tinderbox
      const world = (window as any).world
      if (!world) return

      const rpgApps = world.apps.getAll().filter((app: any) => app.getRPGStats)
      if (rpgApps.length === 0) return

      const playerApp = rpgApps[0]
      
      // Simulate cooking actions
      console.log('[PersistenceTest] Simulating cooking actions...')
      
      // This would trigger cooking mechanics
      world.chat.send('Cooking fish for persistence test')
    })

    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  private async saveGameState(runner: VisualTestRunner): Promise<void> {
    if (!runner['page']) return

    // Trigger save through game mechanics
    await runner['page'].evaluate(() => {
      // Force save game state
      const world = (window as any).world
      if (world && world.save) {
        world.save()
      }
      
      // Also trigger persistence through database
      if (world && world.persistence) {
        world.persistence.saveAll()
      }
      
      console.log('[PersistenceTest] Game state saved')
    })

    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  private async simulateDisconnectReconnect(runner: VisualTestRunner): Promise<void> {
    if (!runner['page']) return

    console.log('[PersistenceTest] Simulating disconnect...')
    
    // Simulate network disconnect
    await runner['page'].evaluate(() => {
      // Simulate disconnect by pausing the game
      const world = (window as any).world
      if (world && world.network) {
        world.network.disconnect()
      }
    })

    await new Promise(resolve => setTimeout(resolve, 3000))

    // Reconnect
    console.log('[PersistenceTest] Simulating reconnect...')
    await runner['page'].evaluate(() => {
      const world = (window as any).world
      if (world && world.network) {
        world.network.connect()
      }
    })

    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  private async loadGameState(runner: VisualTestRunner): Promise<void> {
    if (!runner['page']) return

    // Trigger load through game mechanics
    await runner['page'].evaluate(() => {
      // Force load game state
      const world = (window as any).world
      if (world && world.load) {
        world.load()
      }
      
      // Also trigger persistence through database
      if (world && world.persistence) {
        world.persistence.loadAll()
      }
      
      console.log('[PersistenceTest] Game state loaded')
    })

    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  async validateResults(): Promise<boolean> {
    console.log('[PersistenceTest] Validating persistence test results...')

    let allPassed = true
    const errors: string[] = []

    // Check that we have all expected phases
    const phases = this.results.map(r => r.phase)
    const expectedPhases = [
      'initial', 'xp-gain', 'inventory-modification', 
      'save-state', 'reconnect', 'load-state', 'verify-persistence'
    ]
    
    for (const phase of expectedPhases) {
      if (!phases.includes(phase)) {
        errors.push(`Missing phase: ${phase}`)
        allPassed = false
      }
    }

    // Validate data persistence
    if (this.playerDataBefore && this.playerDataAfter) {
      console.log('[PersistenceTest] Comparing player data...')
      
      // Name should persist
      if (this.playerDataBefore.name !== this.playerDataAfter.name) {
        errors.push('Player name did not persist')
        allPassed = false
      }

      // XP should have increased
      const beforeAttackXP = this.playerDataBefore.attack?.xp || 0
      const afterAttackXP = this.playerDataAfter.attack?.xp || 0
      
      if (afterAttackXP <= beforeAttackXP) {
        errors.push('Attack XP did not increase or persist')
        allPassed = false
      }

      // Inventory should have changed
      const beforeInventory = JSON.stringify(this.playerDataBefore.inventory || [])
      const afterInventory = JSON.stringify(this.playerDataAfter.inventory || [])
      
      if (beforeInventory === afterInventory) {
        errors.push('Inventory did not change during test')
        allPassed = false
      }

      // Position should be tracked
      if (!this.playerDataAfter.position || 
          (this.playerDataAfter.position.x === 0 && 
           this.playerDataAfter.position.y === 0 && 
           this.playerDataAfter.position.z === 0)) {
        errors.push('Player position not properly tracked')
        allPassed = false
      }

      console.log('[PersistenceTest] Player data comparison:')
      console.log('Before:', this.playerDataBefore)
      console.log('After:', this.playerDataAfter)
    } else {
      errors.push('Unable to capture player data for comparison')
      allPassed = false
    }

    // Check for persistence messages in logs
    const persistenceLogs = this.results.flatMap(r => r.logs).filter(log => 
      log.includes('save') || log.includes('load') || log.includes('persist')
    )
    
    if (persistenceLogs.length === 0) {
      errors.push('No persistence messages found in logs')
      allPassed = false
    }

    // Check for database activity
    const dbLogs = this.results.flatMap(r => r.logs).filter(log => 
      log.includes('database') || log.includes('sql') || log.includes('sqlite')
    )
    
    if (dbLogs.length === 0) {
      errors.push('No database activity found in logs')
      allPassed = false
    }

    // Validate entity persistence
    const initialResult = this.results.find(r => r.phase === 'initial')
    const finalResult = this.results.find(r => r.phase === 'verify-persistence')
    
    if (initialResult && finalResult) {
      const initialEntities = initialResult.pixelAnalysis.entityClusters
      const finalEntities = finalResult.pixelAnalysis.entityClusters
      
      // Player should still exist
      if (!finalEntities.get('PLAYER') || finalEntities.get('PLAYER')!.length === 0) {
        errors.push('Player entity was not restored after persistence test')
        allPassed = false
      }

      // World entities should still exist
      if (!finalEntities.get('TREE') || finalEntities.get('TREE')!.length === 0) {
        errors.push('World entities were not restored after persistence test')
        allPassed = false
      }
    }

    if (errors.length > 0) {
      console.log('[PersistenceTest] Validation errors:', errors)
    }

    return allPassed
  }

  async cleanup(): Promise<void> {
    console.log('[PersistenceTest] Cleaning up persistence test...')
    await this.destroyWorld('rpg-persistence-test')
  }
}