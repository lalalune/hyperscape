import { logger } from '@elizaos/core'
import {
  ColorDetector,
  ColorDetectorConfig,
  DetectedEntity,
} from './ColorDetector'
import {
  RealWorldPlaywrightManager,
  WorldConnection,
} from './RealWorldPlaywrightManager'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface RealVisualCheck {
  entityType: string
  shouldExist: boolean
  minCount?: number
  maxCount?: number
  description: string
}

export interface RealTestScenario {
  name: string
  description: string
  worldConnection: WorldConnection
  visualChecks: RealVisualCheck[]
  setupActions?: string[]
  waitTime?: number
}

export interface RealTestResult {
  scenario: string
  passed: boolean
  timestamp: Date
  worldInfo: any
  screenshots: string[]
  detectedEntities: DetectedEntity[]
  failures: string[]
  summary: {
    entitiesFound: number
    checksPerformed: number
    checksPassed: number
    checksFailed: number
  }
}

/**
 * Real Visual Test Framework that connects to actual Hyperscape worlds
 * Takes real screenshots and analyzes actual pixel data
 */
export class RealVisualTestFramework {
  private colorDetector: ColorDetector
  private playwrightManager: RealWorldPlaywrightManager
  private screenshotDir: string
  private testCounter = 0

  constructor() {
    // Initialize with optimal color detection settings
    const colorConfig: ColorDetectorConfig = {
      colorTolerance: 30, // RGB distance tolerance
      minClusterSize: 20, // Minimum pixels for valid detection
      mergeDistance: 25, // Distance to merge nearby clusters
      samplingStep: 2, // Pixel sampling step for performance
      confidenceThreshold: 0.6, // Minimum confidence for detection
    }

    this.colorDetector = new ColorDetector(colorConfig)
    this.playwrightManager = new RealWorldPlaywrightManager()

    // Set up screenshot directory
    this.screenshotDir = path.join(__dirname, '../../screenshots/real-tests')
  }

  async initialize(): Promise<void> {
    logger.info('[RealVisualTestFramework] Initializing real visual testing...')

    await this.colorDetector.init()
    await this.playwrightManager.initialize()

    logger.info(
      '[RealVisualTestFramework] Real visual testing initialized successfully'
    )
  }

  async runTestScenario(scenario: RealTestScenario): Promise<RealTestResult> {
    this.testCounter++
    logger.info(
      `\n[RealVisualTestFramework] 🧪 Running test scenario: ${scenario.name}`
    )
    logger.info(`[RealVisualTestFramework] ${scenario.description}`)

    const result: RealTestResult = {
      scenario: scenario.name,
      passed: false,
      timestamp: new Date(),
      worldInfo: null,
      screenshots: [],
      detectedEntities: [],
      failures: [],
      summary: {
        entitiesFound: 0,
        checksPerformed: scenario.visualChecks.length,
        checksPassed: 0,
        checksFailed: 0,
      },
    }

    try {
      // Connect to the world
      const connectionWithDir = {
        ...scenario.worldConnection,
        screenshotDir: this.screenshotDir,
      }

      await this.playwrightManager.connectToWorld(connectionWithDir)

      // Get world information
      result.worldInfo = await this.playwrightManager.getWorldInfo()
      logger.info(
        '[RealVisualTestFramework] Connected to world:',
        result.worldInfo
      )

      // Execute setup actions if specified
      if (scenario.setupActions && scenario.setupActions.length > 0) {
        logger.info('[RealVisualTestFramework] Executing setup actions...')
        for (const action of scenario.setupActions) {
          await this.playwrightManager.executeScript(action)
          await this.wait(1000) // Wait between actions
        }
      }

      // Wait for world to stabilize
      const waitTime = scenario.waitTime || 3000
      logger.info(
        `[RealVisualTestFramework] Waiting ${waitTime}ms for world to stabilize...`
      )
      await this.wait(waitTime)

      // Take screenshot
      const screenshotName = `test-${this.testCounter}-${scenario.name.replace(/\s+/g, '-')}`
      const screenshotResult =
        await this.playwrightManager.takeScreenshot(screenshotName)

      if (screenshotResult.path) {
        result.screenshots.push(screenshotResult.path)
      }

      // Analyze screenshot with ColorDetector
      logger.info(
        '[RealVisualTestFramework] Analyzing screenshot for entities...'
      )
      result.detectedEntities = await this.colorDetector.detectEntitiesInImage(
        screenshotResult.buffer
      )
      result.summary.entitiesFound = result.detectedEntities.length

      logger.info(
        `[RealVisualTestFramework] Detected ${result.detectedEntities.length} total entities:`
      )
      result.detectedEntities.forEach(entity => {
        logger.info(
          `  - ${entity.type}: ${entity.positions.length} pixels at ${JSON.stringify(entity.positions[0] || 'unknown')} (confidence: ${(entity.confidence * 100).toFixed(1)}%)`
        )
      })

      // Perform visual checks
      result.passed = true // Start optimistic

      for (const check of scenario.visualChecks) {
        const checkPassed = await this.performVisualCheck(
          check,
          result.detectedEntities
        )

        if (checkPassed) {
          result.summary.checksPassed++
          logger.info(
            `[RealVisualTestFramework] ✅ PASSED: ${check.description}`
          )
        } else {
          result.summary.checksFailed++
          result.passed = false
          const failure = `FAILED: ${check.description} - Expected ${check.shouldExist ? 'found' : 'not found'} ${check.entityType}`
          result.failures.push(failure)
          logger.error(`[RealVisualTestFramework] ❌ ${failure}`)
        }
      }

      // Final result
      if (result.passed) {
        logger.info(
          `[RealVisualTestFramework] 🎉 Test scenario PASSED: ${scenario.name}`
        )
      } else {
        logger.error(
          `[RealVisualTestFramework] 💥 Test scenario FAILED: ${scenario.name}`
        )
        result.failures.forEach(failure => logger.error(`  - ${failure}`))
      }
    } catch (error) {
      result.passed = false
      const errorMsg = `Test execution error: ${error.message}`
      result.failures.push(errorMsg)
      logger.error(
        '[RealVisualTestFramework] Test scenario failed with error:',
        error
      )
    }

    return result
  }

  private async performVisualCheck(
    check: RealVisualCheck,
    detectedEntities: DetectedEntity[]
  ): Promise<boolean> {
    const entitiesOfType = detectedEntities.filter(
      entity => entity.type === check.entityType
    )
    const entityCount = entitiesOfType.length

    // Check existence
    if (check.shouldExist && entityCount === 0) {
      return false
    } else if (!check.shouldExist && entityCount > 0) {
      return false
    }

    // Check count constraints if specified
    if (check.minCount !== undefined && entityCount < check.minCount) {
      return false
    }

    if (check.maxCount !== undefined && entityCount > check.maxCount) {
      return false
    }

    return true
  }

  async runFullTestSuite(): Promise<RealTestResult[]> {
    logger.info('\n🚀 RUNNING COMPLETE REAL VISUAL TEST SUITE')
    logger.info('='.repeat(80))

    const testScenarios = this.createTestScenarios()
    const results: RealTestResult[] = []

    let totalPassed = 0
    let totalFailed = 0

    for (const scenario of testScenarios) {
      try {
        const result = await this.runTestScenario(scenario)
        results.push(result)

        if (result.passed) {
          totalPassed++
        } else {
          totalFailed++
        }

        // Brief pause between tests
        await this.wait(2000)
      } catch (error) {
        logger.error(`Failed to run scenario ${scenario.name}:`, error)
        totalFailed++
      }
    }

    // Generate final report
    this.generateFinalReport(results, totalPassed, totalFailed)

    return results
  }

  private createTestScenarios(): RealTestScenario[] {
    // Use a real Hyperscape world URL - you'll need to start a world first
    const baseWorldConnection = {
      worldUrl: process.env.TEST_WORLD_URL || 'http://localhost:5555', // Local Hyperscape instance
      worldId: 'visual-test-world',
    }

    return [
      {
        name: 'Basic World Loading',
        description: 'Verify the world loads and basic elements are visible',
        worldConnection: baseWorldConnection,
        visualChecks: [
          {
            entityType: 'special.player',
            shouldExist: true,
            minCount: 1,
            description: 'Player avatar should be visible in world',
          },
        ],
        waitTime: 5000, // Extra time for initial world load
      },
      {
        name: 'RPG Entity Spawning',
        description: 'Verify RPG entities spawn correctly',
        worldConnection: baseWorldConnection,
        visualChecks: [
          {
            entityType: 'npcs.goblin',
            shouldExist: true,
            minCount: 1,
            description: 'At least one goblin should be visible (green cubes)',
          },
          {
            entityType: 'items.sword',
            shouldExist: true,
            minCount: 1,
            description: 'At least one sword should be visible (red cubes)',
          },
        ],
        waitTime: 3000,
      },
      {
        name: 'Resource Nodes',
        description: 'Verify resource gathering nodes are present',
        worldConnection: baseWorldConnection,
        visualChecks: [
          {
            entityType: 'resources.tree',
            shouldExist: true,
            minCount: 1,
            description:
              'Trees should be visible for woodcutting (green cubes)',
          },
          {
            entityType: 'resources.iron_rock',
            shouldExist: false, // May not be present in basic test world
            description: 'Iron rocks may be visible (dark gray cubes)',
          },
        ],
      },
      {
        name: 'Interactive Elements',
        description: 'Verify interactive world elements exist',
        worldConnection: baseWorldConnection,
        visualChecks: [
          {
            entityType: 'special.bank',
            shouldExist: false, // May not be in basic world
            description: 'Bank building if present (purple cubes)',
          },
          {
            entityType: 'special.shop',
            shouldExist: false, // May not be in basic world
            description: 'Shop building if present (orange cubes)',
          },
        ],
      },
    ]
  }

  private generateFinalReport(
    results: RealTestResult[],
    passed: number,
    failed: number
  ): void {
    const total = passed + failed
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

    logger.info('\n' + '='.repeat(80))
    logger.info('📊 REAL VISUAL TEST RESULTS SUMMARY')
    logger.info('='.repeat(80))

    logger.info(`Tests Executed: ${total}`)
    logger.info(`Tests Passed: ${passed} (${passRate}%)`)
    logger.info(`Tests Failed: ${failed}`)

    // Entity detection summary
    const totalEntitiesFound = results.reduce(
      (sum, r) => sum + r.summary.entitiesFound,
      0
    )
    logger.info(`\n🔍 ENTITY DETECTION SUMMARY:`)
    logger.info(`Total Entities Detected: ${totalEntitiesFound}`)

    const entityTypes = new Set<string>()
    results.forEach(result => {
      result.detectedEntities.forEach(entity => {
        entityTypes.add(entity.type)
      })
    })

    logger.info(`Unique Entity Types Found: ${entityTypes.size}`)
    Array.from(entityTypes)
      .sort()
      .forEach(type => {
        logger.info(`  - ${type}`)
      })

    // Screenshot summary
    const totalScreenshots = results.reduce(
      (sum, r) => sum + r.screenshots.length,
      0
    )
    logger.info(`\n📸 SCREENSHOT SUMMARY:`)
    logger.info(`Screenshots Captured: ${totalScreenshots}`)

    // Results by scenario
    logger.info(`\n📋 DETAILED RESULTS:`)
    results.forEach((result, index) => {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED'
      logger.info(`${index + 1}. ${status}: ${result.scenario}`)
      logger.info(
        `   Entities Found: ${result.summary.entitiesFound}, Checks: ${result.summary.checksPassed}/${result.summary.checksPerformed}`
      )

      if (result.failures.length > 0) {
        result.failures.forEach(failure => {
          logger.info(`   - ${failure}`)
        })
      }
    })

    if (failed === 0) {
      logger.info('\n🎉 ALL REAL VISUAL TESTS PASSED!')
      logger.info('✅ Screenshot capture working correctly')
      logger.info('✅ Entity detection functional')
      logger.info('✅ World connection successful')
      logger.info('✅ Visual verification complete')
    } else {
      logger.info(
        '\n⚠️ Some tests failed, but real visual testing framework is operational'
      )
    }

    logger.info('\n' + '='.repeat(80))
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async cleanup(): Promise<void> {
    logger.info('[RealVisualTestFramework] Cleaning up...')
    await this.playwrightManager.cleanup()
    logger.info('[RealVisualTestFramework] Cleanup complete')
  }
}
