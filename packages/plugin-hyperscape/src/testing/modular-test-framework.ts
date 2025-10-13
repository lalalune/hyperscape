import { IAgentRuntime, logger } from '@elizaos/core'
import { HyperscapeService } from '../service'
import { ContentPackLoader } from '../managers/content-pack-loader'
import { IContentPack } from '../types/content-pack'
import {
  VisualTestFramework,
  TestVerification,
  TestResult,
} from './visual-test-framework'

/**
 * Test framework for modular content packs
 * Supports testing any content pack with visual and state verification
 */
export class ModularTestFramework {
  private runtime: IAgentRuntime
  private service: HyperscapeService
  private contentLoader: ContentPackLoader
  private visualTest: VisualTestFramework

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime
    this.service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName
    )!
    this.contentLoader = new ContentPackLoader(runtime)
    this.visualTest = new VisualTestFramework(runtime)
  }

  /**
   * Initialize test framework
   */
  async initialize(): Promise<void> {
    await this.visualTest.initialize()
    logger.info('[ModularTestFramework] Initialized')
  }

  /**
   * Test a content pack
   */
  async testContentPack(
    pack: IContentPack,
    testSuites: IContentPackTestSuite[]
  ): Promise<IContentPackTestResult> {
    logger.info(`[ModularTestFramework] Testing content pack: ${pack.name}`)

    const result: IContentPackTestResult = {
      packId: pack.id,
      packName: pack.name,
      testResults: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
      },
    }

    // Load the content pack
    await this.contentLoader.loadPack(pack)
    logger.info(`[ModularTestFramework] Loaded pack: ${pack.id}`)

    // Run each test suite
    for (const suite of testSuites) {
      const suiteResult = await this.runTestSuite(pack, suite)
      result.testResults.push(...suiteResult.tests)

      // Update summary
      result.summary.total += suiteResult.tests.length
      result.summary.passed += suiteResult.tests.filter(t => t.passed).length
      result.summary.failed += suiteResult.tests.filter(
        t => !t.passed && !t.skipped
      ).length
      result.summary.skipped += suiteResult.tests.filter(t => t.skipped).length
    }

    // Unload the pack after testing
    await this.contentLoader.unloadPack(pack.id)

    // Generate report
    this.generateTestReport(result)

    return result
  }

  /**
   * Run a test suite
   */
  private async runTestSuite(
    pack: IContentPack,
    suite: IContentPackTestSuite
  ): Promise<{ suite: string; tests: ITestCaseResult[] }> {
    logger.info(`[ModularTestFramework] Running test suite: ${suite.name}`)

    const results: ITestCaseResult[] = []

    // Setup suite
    if (suite.setup) {
      await suite.setup(this.runtime, this.service)
    }

    // Run each test case
    for (const testCase of suite.tests) {
      // Check if test should be skipped
      if (testCase.skip) {
        results.push({
          passed: false,
          failures: [],
          screenshots: [],
          stateSnapshot: null,
          timestamp: new Date(),
          skipped: true,
        })
        continue
      }

      // Setup test
      if (testCase.setup) {
        await testCase.setup(this.runtime, this.service)
      }

      // Execute test actions
      await testCase.execute(this.runtime, this.service)

      // Perform verification
      const testResult = await this.visualTest.runTest(
        testCase.name,
        testCase.verification
      )

      results.push({
        ...testResult,
        skipped: false,
      })

      // Teardown test
      if (testCase.teardown) {
        await testCase.teardown(this.runtime, this.service)
      }
    }

    // Teardown suite
    if (suite.teardown) {
      await suite.teardown(this.runtime, this.service)
    }

    return { suite: suite.name, tests: results }
  }

  /**
   * Generate test report
   */
  private generateTestReport(result: IContentPackTestResult): void {
    const passRate =
      result.summary.total > 0
        ? ((result.summary.passed / result.summary.total) * 100).toFixed(2)
        : '0'

    console.log('\n' + '='.repeat(60))
    console.log(`Content Pack Test Report: ${result.packName}`)
    console.log('='.repeat(60))
    console.log(`Total Tests: ${result.summary.total}`)
    console.log(`Passed: ${result.summary.passed} ✅`)
    console.log(`Failed: ${result.summary.failed} ❌`)
    console.log(`Skipped: ${result.summary.skipped} ⏭️`)
    console.log(`Pass Rate: ${passRate}%`)
    console.log('='.repeat(60))

    // List failed tests
    if (result.summary.failed > 0) {
      console.log('\nFailed Tests:')
      result.testResults
        .filter(t => !t.passed && !t.skipped)
        .forEach((test, index) => {
          console.log(`\n❌ Test ${index + 1}`)
          test.failures.forEach(f => console.log(`   - ${f}`))
        })
    }

    console.log('\n' + '='.repeat(60) + '\n')
  }

  /**
   * Test multiple content packs
   */
  async testMultiplePacks(
    packs: Array<{ pack: IContentPack; suites: IContentPackTestSuite[] }>
  ): Promise<IContentPackTestResult[]> {
    const results: IContentPackTestResult[] = []

    for (const { pack, suites } of packs) {
      const result = await this.testContentPack(pack, suites)
      results.push(result)
    }

    // Generate summary report
    this.generateSummaryReport(results)

    return results
  }

  /**
   * Generate summary report for multiple packs
   */
  private generateSummaryReport(results: IContentPackTestResult[]): void {
    console.log('\n' + '='.repeat(60))
    console.log('Content Pack Test Summary')
    console.log('='.repeat(60))

    let totalTests = 0
    let totalPassed = 0
    let totalFailed = 0

    results.forEach(result => {
      totalTests += result.summary.total
      totalPassed += result.summary.passed
      totalFailed += result.summary.failed

      const passRate =
        result.summary.total > 0
          ? ((result.summary.passed / result.summary.total) * 100).toFixed(2)
          : '0'

      console.log(`\n${result.packName}:`)
      console.log(
        `  Tests: ${result.summary.total} | Passed: ${result.summary.passed} | Failed: ${result.summary.failed} | Pass Rate: ${passRate}%`
      )
    })

    const overallPassRate =
      totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : '0'

    console.log('\n' + '-'.repeat(60))
    console.log(
      `Overall: ${totalTests} tests | ${totalPassed} passed | ${totalFailed} failed | ${overallPassRate}% pass rate`
    )
    console.log('='.repeat(60) + '\n')
  }
}

/**
 * Interfaces for content pack testing
 */
export interface IContentPackTestSuite {
  name: string
  description: string
  tests: ITestCase[]
  setup?: (runtime: IAgentRuntime, service: HyperscapeService) => Promise<void>
  teardown?: (
    runtime: IAgentRuntime,
    service: HyperscapeService
  ) => Promise<void>
}

export interface ITestCase {
  name: string
  description: string
  skip?: boolean
  setup?: (runtime: IAgentRuntime, service: HyperscapeService) => Promise<void>
  execute: (runtime: IAgentRuntime, service: HyperscapeService) => Promise<void>
  verification: TestVerification
  teardown?: (
    runtime: IAgentRuntime,
    service: HyperscapeService
  ) => Promise<void>
}

export interface ITestCaseResult extends TestResult {
  skipped: boolean
}

export interface IContentPackTestResult {
  packId: string
  packName: string
  testResults: ITestCaseResult[]
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
  }
}

/**
 * Helper to create test suites for common RPG mechanics
 */
export class RPGTestSuiteBuilder {
  /**
   * Create combat system test suite
   */
  static createCombatTestSuite(): IContentPackTestSuite {
    return {
      name: 'Combat System',
      description:
        'Tests combat mechanics including damage, healing, and death',
      tests: [
        {
          name: 'Basic Attack Damage',
          description: 'Verify attacking deals damage',
          execute: async (runtime, service) => {
            const world = service.getWorld()
            await world?.actions?.execute('ATTACK_TARGET', { target: 'goblin' })
            await new Promise(resolve => setTimeout(resolve, 2000))
          },
          verification: {
            type: 'both',
            visualChecks: [
              {
                entityType: 'npcs.goblin',
                expectedColor: 2263842,
                shouldExist: true,
              },
              {
                entityType: 'effects.damage',
                expectedColor: 16711680,
                shouldExist: true,
              },
            ],
            stateChecks: [
              {
                property: 'combat.inCombat',
                expectedValue: true,
                operator: 'equals',
              },
              {
                property: 'combat.target',
                expectedValue: 'goblin',
                operator: 'contains',
              },
            ],
            screenshot: true,
          },
        },
        {
          name: 'Healing Effect',
          description: 'Verify healing restores health',
          execute: async (runtime, service) => {
            const world = service.getWorld()
            await world?.actions?.execute('USE_ITEM', { item: 'health_potion' })
            await new Promise(resolve => setTimeout(resolve, 1000))
          },
          verification: {
            type: 'both',
            visualChecks: [
              {
                entityType: 'effects.heal',
                expectedColor: 65280,
                shouldExist: true,
              },
            ],
            stateChecks: [
              {
                property: 'health.current',
                expectedValue: 50,
                operator: 'greater',
              },
            ],
          },
        },
      ],
    }
  }

  /**
   * Create inventory system test suite
   */
  static createInventoryTestSuite(): IContentPackTestSuite {
    return {
      name: 'Inventory System',
      description: 'Tests item management and equipment',
      tests: [
        {
          name: 'Item Pickup',
          description: 'Verify items can be picked up',
          execute: async (runtime, service) => {
            const world = service.getWorld()
            await world?.actions?.execute('PICKUP_ITEM', {
              itemId: 'sword_001',
            })
            await new Promise(resolve => setTimeout(resolve, 1000))
          },
          verification: {
            type: 'state',
            stateChecks: [
              {
                property: 'inventory.items',
                expectedValue: 'sword',
                operator: 'contains',
              },
            ],
          },
        },
      ],
    }
  }
}
