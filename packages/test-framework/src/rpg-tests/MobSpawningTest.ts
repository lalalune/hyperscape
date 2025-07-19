import { VisualTestRunner, VisualTestConfig, TEST_COLORS } from '../visual-testing/VisualTestRunner.js'
import { TestScenario } from './TestScenario.js'

export class MobSpawningTest extends TestScenario {
  name = 'RPG Mob Spawning System Test'
  description = 'Tests mob spawning, respawning, and AI behavior with multiple mob types'

  async createTestWorld(): Promise<void> {
    // Create a world with multiple spawn points for different mob types
    const worldConfig = {
      worldName: 'rpg-spawning-test',
      apps: [
        // Player for reference
        {
          type: 'RPGPlayer',
          position: { x: 0, y: 0, z: 0 },
          config: {
            playerName: 'TestPlayer',
            startingLevel: 10,
            health: 150,
            visualColor: TEST_COLORS.PLAYER.toLowerCase()
          }
        },
        // Level 1 mobs
        {
          type: 'RPGGoblin',
          position: { x: 10, y: 0, z: 0 },
          config: {
            goblinName: 'Goblin1',
            level: 2,
            maxHealth: 25,
            aggressive: true,
            respawnTime: 5, // Fast respawn for testing
            visualColor: TEST_COLORS.GOBLIN.toLowerCase()
          }
        },
        {
          type: 'RPGGoblin',
          position: { x: 15, y: 0, z: 5 },
          config: {
            goblinName: 'Goblin2',
            level: 3,
            maxHealth: 30,
            aggressive: true,
            respawnTime: 5,
            visualColor: TEST_COLORS.GOBLIN.toLowerCase()
          }
        },
        {
          type: 'RPGGoblin',
          position: { x: 20, y: 0, z: 10 },
          config: {
            goblinName: 'Goblin3',
            level: 4,
            maxHealth: 35,
            aggressive: false, // Passive for behavior testing
            respawnTime: 5,
            visualColor: TEST_COLORS.GOBLIN.toLowerCase()
          }
        },
        // Level 2 mobs
        {
          type: 'RPGBandit',
          position: { x: -10, y: 0, z: 0 },
          config: {
            banditName: 'Bandit1',
            level: 5,
            maxHealth: 50,
            aggressive: true,
            respawnTime: 10,
            visualColor: TEST_COLORS.BANDIT.toLowerCase()
          }
        },
        {
          type: 'RPGBandit',
          position: { x: -15, y: 0, z: 5 },
          config: {
            banditName: 'Bandit2',
            level: 6,
            maxHealth: 60,
            aggressive: true,
            respawnTime: 10,
            visualColor: TEST_COLORS.BANDIT.toLowerCase()
          }
        },
        // Level 3 mob
        {
          type: 'RPGBarbarian',
          position: { x: 0, y: 0, z: 20 },
          config: {
            barbarianName: 'Barbarian1',
            level: 8,
            maxHealth: 80,
            aggressive: true,
            respawnTime: 15,
            visualColor: TEST_COLORS.BARBARIAN.toLowerCase()
          }
        }
      ]
    }

    await this.deployWorld(worldConfig)
  }

  async runTest(): Promise<void> {
    console.log('[MobSpawningTest] Starting mob spawning test...')

    const testConfig: VisualTestConfig = {
      worldName: 'rpg-spawning-test',
      testName: 'mob-spawning',
      timeout: 90000,
      screenshotDir: './test-results/spawning',
      expectedEntities: [
        { type: 'PLAYER', count: 1 },
        { type: 'GOBLIN', count: 3 },
        { type: 'BANDIT', count: 2 },
        { type: 'BARBARIAN', count: 1 }
      ],
      validationRules: [
        {
          name: 'all-mobs-spawned',
          validate: (analysis) => {
            const goblins = analysis.entityClusters.get('GOBLIN')?.length || 0
            const bandits = analysis.entityClusters.get('BANDIT')?.length || 0
            const barbarians = analysis.entityClusters.get('BARBARIAN')?.length || 0
            return goblins >= 3 && bandits >= 2 && barbarians >= 1
          },
          errorMessage: 'Not all mobs spawned correctly'
        },
        {
          name: 'mob-distribution',
          validate: (analysis) => {
            const goblins = analysis.entityClusters.get('GOBLIN') || []
            const bandits = analysis.entityClusters.get('BANDIT') || []
            
            // Check that mobs are distributed across the world
            const allMobs = [...goblins, ...bandits]
            if (allMobs.length < 3) return false
            
            // Calculate spread
            const xPositions = allMobs.map(m => m.x)
            const zPositions = allMobs.map(m => m.y)
            const xSpread = Math.max(...xPositions) - Math.min(...xPositions)
            const zSpread = Math.max(...zPositions) - Math.min(...zPositions)
            
            return xSpread > 100 && zSpread > 100 // Reasonable spread
          },
          errorMessage: 'Mobs are not distributed properly across the world'
        }
      ]
    }

    const runner = new VisualTestRunner(testConfig)
    await runner.initialize()
    await runner.loadWorld()

    // Test 1: Initial spawn verification
    console.log('[MobSpawningTest] Phase 1: Initial spawn verification')
    const initialResult = await runner.runTest()
    this.results.push({
      phase: 'initial-spawn',
      ...initialResult
    })

    // Test 2: Kill some mobs to test respawning
    console.log('[MobSpawningTest] Phase 2: Testing mob death and respawn')
    await this.killMobs(runner, 2) // Kill 2 mobs

    // Take screenshot after kills
    const postKillResult = await runner.runTest()
    this.results.push({
      phase: 'post-kill',
      ...postKillResult
    })

    // Test 3: Wait for respawn
    console.log('[MobSpawningTest] Phase 3: Waiting for respawn...')
    await new Promise(resolve => setTimeout(resolve, 20000)) // Wait 20 seconds

    const respawnResult = await runner.runTest()
    this.results.push({
      phase: 'post-respawn',
      ...respawnResult
    })

    // Test 4: Mob AI behavior
    console.log('[MobSpawningTest] Phase 4: Testing mob AI behavior')
    await this.testMobAI(runner)

    const aiResult = await runner.runTest()
    this.results.push({
      phase: 'ai-behavior',
      ...aiResult
    })

    await runner.cleanup()
    console.log('[MobSpawningTest] Mob spawning test completed')
  }

  private async killMobs(runner: VisualTestRunner, count: number): Promise<void> {
    if (!runner['page']) return

    // Find mobs visually and attack them
    for (let i = 0; i < count; i++) {
      // Click on a mob to attack
      await runner['page'].click('canvas', {
        position: { x: 800 + i * 100, y: 400 } // Approximate mob positions
      })

      // Wait for combat
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Continue attacking until mob dies
      for (let j = 0; j < 5; j++) {
        await runner['page'].click('canvas', {
          position: { x: 800 + i * 100, y: 400 }
        })
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  private async testMobAI(runner: VisualTestRunner): Promise<void> {
    if (!runner['page']) return

    // Move player near mobs to test aggro
    await runner['page'].keyboard.press('KeyW')
    await new Promise(resolve => setTimeout(resolve, 2000))
    await runner['page'].keyboard.up('KeyW')

    // Move around to test mob following
    await runner['page'].keyboard.press('KeyA')
    await new Promise(resolve => setTimeout(resolve, 1000))
    await runner['page'].keyboard.up('KeyA')

    await runner['page'].keyboard.press('KeyD')
    await new Promise(resolve => setTimeout(resolve, 1000))
    await runner['page'].keyboard.up('KeyD')

    // Move away to test return behavior
    await runner['page'].keyboard.press('KeyS')
    await new Promise(resolve => setTimeout(resolve, 3000))
    await runner['page'].keyboard.up('KeyS')
  }

  async validateResults(): Promise<boolean> {
    console.log('[MobSpawningTest] Validating spawning test results...')

    let allPassed = true
    const errors: string[] = []

    // Check that we have all expected phases
    const phases = this.results.map(r => r.phase)
    const expectedPhases = ['initial-spawn', 'post-kill', 'post-respawn', 'ai-behavior']
    
    for (const phase of expectedPhases) {
      if (!phases.includes(phase)) {
        errors.push(`Missing phase: ${phase}`)
        allPassed = false
      }
    }

    // Validate spawning
    const initialResult = this.results.find(r => r.phase === 'initial-spawn')
    if (initialResult) {
      const goblins = initialResult.pixelAnalysis.entityClusters.get('GOBLIN')?.length || 0
      const bandits = initialResult.pixelAnalysis.entityClusters.get('BANDIT')?.length || 0
      const barbarians = initialResult.pixelAnalysis.entityClusters.get('BARBARIAN')?.length || 0
      
      if (goblins < 3) {
        errors.push(`Expected 3 goblins, found ${goblins}`)
        allPassed = false
      }
      if (bandits < 2) {
        errors.push(`Expected 2 bandits, found ${bandits}`)
        allPassed = false
      }
      if (barbarians < 1) {
        errors.push(`Expected 1 barbarian, found ${barbarians}`)
        allPassed = false
      }
    }

    // Validate death/respawn cycle
    const postKillResult = this.results.find(r => r.phase === 'post-kill')
    const respawnResult = this.results.find(r => r.phase === 'post-respawn')
    
    if (postKillResult && respawnResult) {
      const postKillMobs = (postKillResult.pixelAnalysis.entityClusters.get('GOBLIN')?.length || 0) +
                          (postKillResult.pixelAnalysis.entityClusters.get('BANDIT')?.length || 0) +
                          (postKillResult.pixelAnalysis.entityClusters.get('BARBARIAN')?.length || 0)
      
      const respawnMobs = (respawnResult.pixelAnalysis.entityClusters.get('GOBLIN')?.length || 0) +
                         (respawnResult.pixelAnalysis.entityClusters.get('BANDIT')?.length || 0) +
                         (respawnResult.pixelAnalysis.entityClusters.get('BARBARIAN')?.length || 0)
      
      if (respawnMobs <= postKillMobs) {
        errors.push(`Respawn failed: ${respawnMobs} mobs after respawn vs ${postKillMobs} after kill`)
        allPassed = false
      }
    }

    // Check for respawn messages in logs
    const respawnLogs = this.results.flatMap(r => r.logs).filter(log => 
      log.includes('respawn') || log.includes('spawn')
    )
    
    if (respawnLogs.length === 0) {
      errors.push('No respawn messages found in logs')
      allPassed = false
    }

    // Validate AI behavior
    const aiResult = this.results.find(r => r.phase === 'ai-behavior')
    if (aiResult) {
      const aiLogs = aiResult.logs.filter(log => 
        log.includes('aggro') || log.includes('aggressive') || log.includes('attack')
      )
      
      if (aiLogs.length === 0) {
        errors.push('No AI behavior messages found in logs')
        allPassed = false
      }
    }

    if (errors.length > 0) {
      console.log('[MobSpawningTest] Validation errors:', errors)
    }

    return allPassed
  }

  async cleanup(): Promise<void> {
    console.log('[MobSpawningTest] Cleaning up spawning test...')
    await this.destroyWorld('rpg-spawning-test')
  }
}