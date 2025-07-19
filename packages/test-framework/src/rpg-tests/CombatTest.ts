import { VisualTestRunner, VisualTestConfig, TEST_COLORS } from '../visual-testing/VisualTestRunner.js'
import { TestScenario } from './TestScenario.js'

export class CombatTest extends TestScenario {
  name = 'RPG Combat System Test'
  description = 'Tests player vs mob combat mechanics with visual verification'

  async createTestWorld(): Promise<void> {
    // Create a minimal world for combat testing
    const worldConfig = {
      worldName: 'rpg-combat-test',
      apps: [
        {
          type: 'RPGPlayer',
          position: { x: 0, y: 0, z: 0 },
          config: {
            playerName: 'TestPlayer',
            startingLevel: 5,
            health: 100,
            visualColor: TEST_COLORS.PLAYER.toLowerCase()
          }
        },
        {
          type: 'RPGGoblin',
          position: { x: 5, y: 0, z: 0 },
          config: {
            goblinName: 'TestGoblin',
            level: 3,
            maxHealth: 40,
            aggressive: true,
            visualColor: TEST_COLORS.GOBLIN.toLowerCase()
          }
        }
      ]
    }

    await this.deployWorld(worldConfig)
  }

  async runTest(): Promise<void> {
    console.log('[CombatTest] Starting combat test...')

    // Create test configuration
    const testConfig: VisualTestConfig = {
      worldName: 'rpg-combat-test',
      testName: 'combat-mechanics',
      timeout: 60000,
      screenshotDir: './test-results/combat',
      expectedEntities: [
        { type: 'PLAYER', count: 1 },
        { type: 'GOBLIN', count: 1 },
      ],
      validationRules: [
        {
          name: 'combat-entities-present',
          validate: (analysis) => {
            const player = analysis.entityClusters.get('PLAYER')
            const goblin = analysis.entityClusters.get('GOBLIN')
            return !!(player && player.length === 1 && goblin && goblin.length === 1)
          },
          errorMessage: 'Player and goblin must both be present for combat test'
        },
        {
          name: 'entities-positioned-correctly',
          validate: (analysis) => {
            const player = analysis.entityClusters.get('PLAYER')
            const goblin = analysis.entityClusters.get('GOBLIN')
            if (!player || !goblin) return false
            
            // Check distance between player and goblin
            const distance = Math.sqrt(
              Math.pow(player[0].x - goblin[0].x, 2) +
              Math.pow(player[0].y - goblin[0].y, 2)
            )
            return distance > 50 && distance < 300 // Reasonable distance for combat
          },
          errorMessage: 'Player and goblin are not positioned correctly for combat'
        }
      ]
    }

    // Run visual test
    const runner = new VisualTestRunner(testConfig)
    await runner.initialize()
    await runner.loadWorld()

    // Take initial screenshot
    console.log('[CombatTest] Taking initial screenshot...')
    const initialResult = await runner.runTest()
    this.results.push({
      phase: 'initial',
      ...initialResult
    })

    // Simulate combat by clicking on the goblin
    console.log('[CombatTest] Initiating combat...')
    await this.simulateCombat(runner)

    // Wait for combat to progress
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Take combat screenshot
    console.log('[CombatTest] Taking combat screenshot...')
    const combatResult = await runner.runTest()
    this.results.push({
      phase: 'combat',
      ...combatResult
    })

    // Wait for combat to complete
    await new Promise(resolve => setTimeout(resolve, 10000))

    // Take final screenshot
    console.log('[CombatTest] Taking final screenshot...')
    const finalResult = await runner.runTest()
    this.results.push({
      phase: 'final',
      ...finalResult
    })

    await runner.cleanup()
    console.log('[CombatTest] Combat test completed')
  }

  private async simulateCombat(runner: VisualTestRunner): Promise<void> {
    if (!runner['page']) return

    // Find the goblin visually and click on it
    const goblinElements = await runner['page'].evaluate(() => {
      // Look for goblin in the scene
      const elements = document.querySelectorAll('[data-testid="goblin"], .goblin-entity')
      return Array.from(elements).map(el => {
        const rect = el.getBoundingClientRect()
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        }
      })
    })

    if (goblinElements.length > 0) {
      await runner['page'].click('canvas', {
        position: goblinElements[0]
      })
    } else {
      // Fallback: click in the approximate goblin area
      await runner['page'].click('canvas', {
        position: { x: 1200, y: 540 } // Approximate position based on world layout
      })
    }

    // Wait for combat to initiate
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  async validateResults(): Promise<boolean> {
    console.log('[CombatTest] Validating combat test results...')

    let allPassed = true
    const errors: string[] = []

    // Check that we have all expected phases
    const phases = this.results.map(r => r.phase)
    if (!phases.includes('initial')) {
      errors.push('Missing initial phase')
      allPassed = false
    }
    if (!phases.includes('combat')) {
      errors.push('Missing combat phase')
      allPassed = false
    }
    if (!phases.includes('final')) {
      errors.push('Missing final phase')
      allPassed = false
    }

    // Validate that combat actually occurred
    const initialResult = this.results.find(r => r.phase === 'initial')
    const combatResult = this.results.find(r => r.phase === 'combat')
    const finalResult = this.results.find(r => r.phase === 'final')

    if (initialResult && combatResult && finalResult) {
      // Check for health bars or damage indicators
      const initialGoblin = initialResult.pixelAnalysis.entityClusters.get('GOBLIN')
      const combatGoblin = combatResult.pixelAnalysis.entityClusters.get('GOBLIN')
      const finalGoblin = finalResult.pixelAnalysis.entityClusters.get('GOBLIN')

      if (initialGoblin && combatGoblin && finalGoblin) {
        // Goblin should still be present during combat
        if (combatGoblin.length === 0) {
          errors.push('Goblin disappeared during combat')
          allPassed = false
        }
      } else {
        errors.push('Unable to track goblin through combat phases')
        allPassed = false
      }

      // Check for combat effects (damage numbers, effects, etc.)
      const combatEffects = combatResult.pixelAnalysis.colors.has('#FF0000') || // Red damage
                           combatResult.pixelAnalysis.colors.has('#FFFF00')    // Yellow effects
      
      if (!combatEffects) {
        errors.push('No visual combat effects detected')
        allPassed = false
      }

      // Check logs for combat messages
      const combatLogs = combatResult.logs.filter(log => 
        log.includes('attack') || log.includes('damage') || log.includes('combat')
      )
      
      if (combatLogs.length === 0) {
        errors.push('No combat-related log messages found')
        allPassed = false
      }
    }

    // Log validation results
    if (errors.length > 0) {
      console.log('[CombatTest] Validation errors:', errors)
    }

    return allPassed
  }

  async cleanup(): Promise<void> {
    console.log('[CombatTest] Cleaning up combat test...')
    await this.destroyWorld('rpg-combat-test')
  }
}