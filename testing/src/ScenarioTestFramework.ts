/**
 * Scenario-Based Testing Framework for 3D RPG Systems
 *
 * Provides conditional testing, cleanup, timeouts, and visual verification
 * for comprehensive RPG system validation.
 */

import { World } from '../../types/index.js'
import { Vector3 } from '../../game/src/types/index.js'
import { RPGTestHelpers } from './RPGTestHelpers'
import { ColorDetector } from './ColorDetector'

export interface TestScenario {
  id: string
  name: string
  description: string
  setup: (framework: ScenarioTestFramework) => Promise<void>
  condition: (framework: ScenarioTestFramework) => Promise<boolean>
  cleanup: (framework: ScenarioTestFramework) => Promise<void>
  maxDuration?: number // Maximum test duration in milliseconds
  expectedVisuals?: Array<{
    entityId: string
    color: string
    position: Vector3
    visible: boolean
  }>
}

export interface TestResult {
  scenarioId: string
  success: boolean
  duration: number
  reason: string
  visualValidation?: {
    expected: number
    found: number
    missing: string[]
  }
  logs: string[]
}

export class ScenarioTestFramework {
  private world: World
  private rpgHelpers: RPGTestHelpers
  private colorDetector: ColorDetector
  private activeScenarios: Map<
    string,
    {
      scenario: TestScenario
      startTime: number
      checkInterval?: NodeJS.Timeout
    }
  > = new Map()
  private testResults: TestResult[] = []
  private logs: string[] = []

  constructor(world: World) {
    this.world = world
    this.rpgHelpers = new RPGTestHelpers(world)
    this.colorDetector = new ColorDetector()
  }

  /**
   * Run a single test scenario
   */
  async runScenario(scenario: TestScenario): Promise<TestResult> {
    const startTime = Date.now()
    const result: TestResult = {
      scenarioId: scenario.id,
      success: false,
      duration: 0,
      reason: '',
      logs: [],
    }

    this.log(`🧪 Starting scenario: ${scenario.name}`)

    try {
      // Setup phase
      this.log(`📋 Setting up scenario: ${scenario.id}`)
      await scenario.setup(this)

      // Visual validation (if specified)
      if (scenario.expectedVisuals) {
        const visualResult = await this.validateVisuals(scenario.expectedVisuals)
        result.visualValidation = visualResult

        if (visualResult.missing.length > 0) {
          result.reason = `Missing visual elements: ${visualResult.missing.join(', ')}`
          return result
        }
      }

      // Start condition monitoring
      this.log(`⏱️ Monitoring condition for scenario: ${scenario.id}`)
      const conditionMet = await this.monitorCondition(scenario)

      if (conditionMet) {
        result.success = true
        result.reason = 'Condition met successfully'
        this.log(`✅ Scenario completed: ${scenario.id}`)
      } else {
        result.reason = 'Condition timeout or failure'
        this.log(`❌ Scenario failed: ${scenario.id}`)
      }
    } catch (error: any) {
      result.reason = `Error: ${error?.message || 'Unknown error'}`
      this.log(`💥 Scenario error: ${scenario.id} - ${error?.message || 'Unknown error'}`)
    } finally {
      // Cleanup phase
      try {
        this.log(`🧹 Cleaning up scenario: ${scenario.id}`)
        await scenario.cleanup(this)
      } catch (cleanupError: any) {
        this.log(`⚠️ Cleanup error: ${cleanupError?.message || 'Unknown cleanup error'}`)
      }

      result.duration = Date.now() - startTime
      result.logs = [...this.logs]
      this.testResults.push(result)
      this.logs = [] // Reset logs for next test
    }

    return result
  }

  /**
   * Monitor condition with timeout
   */
  private async monitorCondition(scenario: TestScenario): Promise<boolean> {
    const maxDuration = scenario.maxDuration || 30000 // Default 30 seconds
    const startTime = Date.now()
    const checkInterval = 500 // Check every 500ms

    return new Promise(resolve => {
      const interval = setInterval(async () => {
        try {
          const elapsed = Date.now() - startTime

          // Check timeout
          if (elapsed >= maxDuration) {
            clearInterval(interval)
            this.log(`⏰ Timeout reached for scenario: ${scenario.id}`)
            resolve(false)
            return
          }

          // Check condition
          const conditionMet = await scenario.condition(this)
          if (conditionMet) {
            clearInterval(interval)
            this.log(`🎯 Condition met for scenario: ${scenario.id}`)
            resolve(true)
          }
        } catch (error: any) {
          clearInterval(interval)
          this.log(`❌ Condition check error: ${error?.message || 'Unknown error'}`)
          resolve(false)
        }
      }, checkInterval)

      // Store interval for cleanup
      this.activeScenarios.set(scenario.id, {
        scenario,
        startTime,
        checkInterval: interval,
      })
    })
  }

  /**
   * Validate visual elements are present and correctly colored
   */
  private async validateVisuals(
    expectedVisuals: Array<{
      entityId: string
      color: string
      position: Vector3
      visible: boolean
    }>
  ): Promise<{
    expected: number
    found: number
    missing: string[]
  }> {
    const result = {
      expected: expectedVisuals.length,
      found: 0,
      missing: [] as string[],
    }

    for (const expected of expectedVisuals) {
      try {
        const detected = await this.colorDetector.detectColorAtPosition(expected.position, expected.color)

        if (detected && expected.visible) {
          result.found++
          this.log(`✅ Visual confirmed: ${expected.entityId} at ${JSON.stringify(expected.position)}`)
        } else if (!detected && !expected.visible) {
          result.found++
          this.log(`✅ Correctly hidden: ${expected.entityId}`)
        } else {
          result.missing.push(expected.entityId)
          this.log(`❌ Visual missing: ${expected.entityId} expected at ${JSON.stringify(expected.position)}`)
        }
      } catch (error: any) {
        result.missing.push(expected.entityId)
        this.log(`💥 Visual check error for ${expected.entityId}: ${error?.message || 'Unknown error'}`)
      }
    }

    return result
  }

  /**
   * Get RPG test helpers
   */
  getRPGHelpers(): RPGTestHelpers {
    return this.rpgHelpers
  }

  /**
   * Get color detector
   */
  getColorDetector(): ColorDetector {
    return this.colorDetector
  }

  /**
   * Get world reference
   */
  getWorld(): World {
    return this.world
  }

  /**
   * Log a test message
   */
  log(message: string): void {
    const timestamp = new Date().toISOString().substring(11, 23)
    const logEntry = `[${timestamp}] ${message}`
    this.logs.push(logEntry)
    console.log(`[ScenarioTest] ${logEntry}`)
  }

  /**
   * Wait for specified duration
   */
  async wait(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration))
  }

  /**
   * Check if an entity exists and has the expected visual properties
   */
  async checkEntityVisual(entityId: string, expectedColor: string, expectedPosition: Vector3): Promise<boolean> {
    try {
      // Check if entity exists in test helpers
      const entity = this.rpgHelpers.getTestEntity(entityId)
      if (!entity) {
        this.log(`❌ Entity not found: ${entityId}`)
        return false
      }

      // Validate position (within tolerance)
      const tolerance = 1.0
      const positionMatch =
        Math.abs(entity.position.x - expectedPosition.x) < tolerance &&
        Math.abs(entity.position.y - expectedPosition.y) < tolerance &&
        Math.abs(entity.position.z - expectedPosition.z) < tolerance

      if (!positionMatch) {
        this.log(
          `❌ Position mismatch for ${entityId}: expected ${JSON.stringify(expectedPosition)}, got ${JSON.stringify(entity.position)}`
        )
        return false
      }

      // Validate color using color detector
      const colorMatch = await this.colorDetector.detectColorAtPosition(entity.position, expectedColor)
      if (!colorMatch) {
        this.log(`❌ Color mismatch for ${entityId}: expected ${expectedColor}`)
        return false
      }

      this.log(`✅ Entity visual confirmed: ${entityId}`)
      return true
    } catch (error: any) {
      this.log(`💥 Error checking entity visual ${entityId}: ${error?.message || 'Unknown error'}`)
      return false
    }
  }

  /**
   * Get all test results
   */
  getResults(): TestResult[] {
    return [...this.testResults]
  }

  /**
   * Clean up all active scenarios
   */
  async cleanup(): Promise<void> {
    this.log('🧹 Cleaning up scenario test framework...')

    // Stop all active monitoring
    for (const [scenarioId, active] of this.activeScenarios) {
      if (active.checkInterval) {
        clearInterval(active.checkInterval)
      }

      try {
        await active.scenario.cleanup(this)
      } catch (error: any) {
        this.log(`⚠️ Cleanup error for ${scenarioId}: ${error?.message || 'Unknown error'}`)
      }
    }

    // Clean up RPG helpers
    this.rpgHelpers.cleanup()

    // Clear tracking
    this.activeScenarios.clear()

    this.log('✅ Scenario test framework cleanup complete')
  }

  /**
   * Generate test report
   */
  generateReport(): {
    summary: {
      total: number
      passed: number
      failed: number
      successRate: number
      totalDuration: number
    }
    details: TestResult[]
  } {
    const total = this.testResults.length
    const passed = this.testResults.filter(r => r.success).length
    const failed = total - passed
    const successRate = total > 0 ? (passed / total) * 100 : 0
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0)

    return {
      summary: {
        total,
        passed,
        failed,
        successRate,
        totalDuration,
      },
      details: [...this.testResults],
    }
  }
}

// Extension to RPGTestHelpers for scenario testing
declare module './RPGTestHelpers' {
  interface RPGTestHelpers {
    getTestEntity(entityId: string): any
  }
}

// Add method to RPGTestHelpers
if (typeof RPGTestHelpers !== 'undefined') {
  ; (RPGTestHelpers.prototype as any).getTestEntity = function (entityId: string) {
    return this.testEntities.get(entityId) || this.testPlayers.get(entityId)
  }
}
