import { VisualTestRunner, VisualTestConfig, TEST_COLORS } from '../visual-testing/VisualTestRunner.js'
import { TestScenario } from './TestScenario.js'

export class DeathRespawnTest extends TestScenario {
  name = 'RPG Death and Respawn System Test'
  description = 'Tests player death, item dropping, corpse mechanics, and respawn system'

  async createTestWorld(): Promise<void> {
    const worldConfig = {
      worldName: 'rpg-death-test',
      apps: [
        // Player with low health for easy death testing
        {
          type: 'RPGPlayer',
          position: { x: 0, y: 0, z: 0 },
          config: {
            playerName: 'TestVictim',
            startingLevel: 1,
            health: 10, // Very low health for easy death
            visualColor: TEST_COLORS.PLAYER.toLowerCase()
          }
        },
        // Strong goblin to kill the player
        {
          type: 'RPGGoblin',
          position: { x: 3, y: 0, z: 0 },
          config: {
            goblinName: 'DeathGoblin',
            level: 10,
            maxHealth: 100,
            aggressive: true,
            respawnTime: 30,
            visualColor: TEST_COLORS.GOBLIN.toLowerCase()
          }
        },
        // Spawn point marker
        {
          type: 'SpawnPoint',
          position: { x: -20, y: 0, z: 0 },
          config: {
            spawnName: 'TestSpawn',
            visualColor: '#00FFFF' // Cyan
          }
        },
        // Item drop area marker
        {
          type: 'ItemDropArea',
          position: { x: 0, y: 0, z: 0 },
          config: {
            areaName: 'DeathArea',
            visualColor: TEST_COLORS.ITEM_DROP.toLowerCase()
          }
        }
      ]
    }

    await this.deployWorld(worldConfig)
  }

  async runTest(): Promise<void> {
    console.log('[DeathRespawnTest] Starting death and respawn test...')

    const testConfig: VisualTestConfig = {
      worldName: 'rpg-death-test',
      testName: 'death-respawn',
      timeout: 120000,
      screenshotDir: './test-results/death',
      expectedEntities: [
        { type: 'PLAYER', count: 1 },
        { type: 'GOBLIN', count: 1 }
      ],
      validationRules: [
        {
          name: 'player-and-goblin-present',
          validate: (analysis) => {
            const player = analysis.entityClusters.get('PLAYER')
            const goblin = analysis.entityClusters.get('GOBLIN')
            return !!(player && player.length === 1 && goblin && goblin.length === 1)
          },
          errorMessage: 'Player and goblin must be present for death test'
        }
      ]
    }

    const runner = new VisualTestRunner(testConfig)
    await runner.initialize()
    await runner.loadWorld()

    // Phase 1: Pre-death state
    console.log('[DeathRespawnTest] Phase 1: Pre-death state')
    const preDeathResult = await runner.runTest()
    this.results.push({
      phase: 'pre-death',
      ...preDeathResult
    })

    // Phase 2: Initiate combat to cause death
    console.log('[DeathRespawnTest] Phase 2: Initiating combat to cause death')
    await this.initiateCombat(runner)

    // Wait for combat to progress
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Phase 3: Check for death
    console.log('[DeathRespawnTest] Phase 3: Checking for death')
    const deathResult = await runner.runTest()
    this.results.push({
      phase: 'death',
      ...deathResult
    })

    // Phase 4: Verify item drops and corpse
    console.log('[DeathRespawnTest] Phase 4: Verifying item drops and corpse')
    await new Promise(resolve => setTimeout(resolve, 2000))

    const itemDropResult = await runner.runTest()
    this.results.push({
      phase: 'item-drops',
      ...itemDropResult
    })

    // Phase 5: Wait for respawn
    console.log('[DeathRespawnTest] Phase 5: Waiting for respawn...')
    await new Promise(resolve => setTimeout(resolve, 10000)) // Wait for respawn

    const respawnResult = await runner.runTest()
    this.results.push({
      phase: 'respawn',
      ...respawnResult
    })

    // Phase 6: Test item retrieval
    console.log('[DeathRespawnTest] Phase 6: Testing item retrieval')
    await this.testItemRetrieval(runner)

    const retrievalResult = await runner.runTest()
    this.results.push({
      phase: 'item-retrieval',
      ...retrievalResult
    })

    await runner.cleanup()
    console.log('[DeathRespawnTest] Death and respawn test completed')
  }

  private async initiateCombat(runner: VisualTestRunner): Promise<void> {
    if (!runner['page']) return

    // Click on the goblin to start combat
    await runner['page'].click('canvas', {
      position: { x: 1000, y: 540 } // Approximate goblin position
    })

    // Wait for combat to start
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Keep clicking to ensure combat continues
    for (let i = 0; i < 10; i++) {
      await runner['page'].click('canvas', {
        position: { x: 1000, y: 540 }
      })
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  private async testItemRetrieval(runner: VisualTestRunner): Promise<void> {
    if (!runner['page']) return

    // Move player to death location to retrieve items
    await runner['page'].keyboard.press('KeyW')
    await new Promise(resolve => setTimeout(resolve, 2000))
    await runner['page'].keyboard.up('KeyW')

    await runner['page'].keyboard.press('KeyD')
    await new Promise(resolve => setTimeout(resolve, 2000))
    await runner['page'].keyboard.up('KeyD')

    // Click on item drops to pick them up
    await runner['page'].click('canvas', {
      position: { x: 960, y: 540 } // Death location
    })

    await new Promise(resolve => setTimeout(resolve, 1000))

    // Click multiple times to pick up all items
    for (let i = 0; i < 5; i++) {
      await runner['page'].click('canvas', {
        position: { x: 960 + i * 10, y: 540 + i * 10 }
      })
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  async validateResults(): Promise<boolean> {
    console.log('[DeathRespawnTest] Validating death and respawn test results...')

    let allPassed = true
    const errors: string[] = []

    // Check that we have all expected phases
    const phases = this.results.map(r => r.phase)
    const expectedPhases = ['pre-death', 'death', 'item-drops', 'respawn', 'item-retrieval']
    
    for (const phase of expectedPhases) {
      if (!phases.includes(phase)) {
        errors.push(`Missing phase: ${phase}`)
        allPassed = false
      }
    }

    // Validate death occurred
    const preDeathResult = this.results.find(r => r.phase === 'pre-death')
    const deathResult = this.results.find(r => r.phase === 'death')
    const respawnResult = this.results.find(r => r.phase === 'respawn')

    if (preDeathResult && deathResult && respawnResult) {
      // Check for death messages in logs
      const deathLogs = deathResult.logs.filter(log => 
        log.includes('died') || log.includes('death') || log.includes('killed')
      )
      
      if (deathLogs.length === 0) {
        errors.push('No death messages found in logs')
        allPassed = false
      }

      // Check for respawn messages
      const respawnLogs = respawnResult.logs.filter(log => 
        log.includes('respawn') || log.includes('revive')
      )
      
      if (respawnLogs.length === 0) {
        errors.push('No respawn messages found in logs')
        allPassed = false
      }

      // Validate player position changed after respawn
      const preDeathPlayer = preDeathResult.pixelAnalysis.entityClusters.get('PLAYER')
      const respawnPlayer = respawnResult.pixelAnalysis.entityClusters.get('PLAYER')
      
      if (preDeathPlayer && respawnPlayer && preDeathPlayer.length > 0 && respawnPlayer.length > 0) {
        const prePos = preDeathPlayer[0]
        const respawnPos = respawnPlayer[0]
        const distance = Math.sqrt(
          Math.pow(prePos.x - respawnPos.x, 2) + Math.pow(prePos.y - respawnPos.y, 2)
        )
        
        if (distance < 50) {
          errors.push('Player did not move to respawn location')
          allPassed = false
        }
      }
    }

    // Validate item drops
    const itemDropResult = this.results.find(r => r.phase === 'item-drops')
    if (itemDropResult) {
      const itemDrops = itemDropResult.pixelAnalysis.entityClusters.get('ITEM_DROP')
      const corpse = itemDropResult.pixelAnalysis.entityClusters.get('CORPSE')
      
      if (!itemDrops || itemDrops.length === 0) {
        errors.push('No item drops found after death')
        allPassed = false
      }

      // Check for item drop messages
      const dropLogs = itemDropResult.logs.filter(log => 
        log.includes('drop') || log.includes('loot') || log.includes('item')
      )
      
      if (dropLogs.length === 0) {
        errors.push('No item drop messages found in logs')
        allPassed = false
      }
    }

    // Validate item retrieval
    const retrievalResult = this.results.find(r => r.phase === 'item-retrieval')
    if (retrievalResult) {
      const retrievalLogs = retrievalResult.logs.filter(log => 
        log.includes('picked up') || log.includes('retrieved') || log.includes('collect')
      )
      
      if (retrievalLogs.length === 0) {
        errors.push('No item retrieval messages found in logs')
        allPassed = false
      }
    }

    // Check for proper game state management
    const allLogs = this.results.flatMap(r => r.logs)
    const errorLogs = allLogs.filter(log => 
      log.includes('[ERROR]') || log.includes('error') || log.includes('Error')
    )
    
    if (errorLogs.length > 0) {
      errors.push(`Found ${errorLogs.length} error messages in logs`)
      allPassed = false
    }

    if (errors.length > 0) {
      console.log('[DeathRespawnTest] Validation errors:', errors)
    }

    return allPassed
  }

  async cleanup(): Promise<void> {
    console.log('[DeathRespawnTest] Cleaning up death and respawn test...')
    await this.destroyWorld('rpg-death-test')
  }
}