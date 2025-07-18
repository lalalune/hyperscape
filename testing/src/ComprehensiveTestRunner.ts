/**
 * Comprehensive Test Runner
 *
 * Main orchestrator for running all RPG system tests with
 * 3D visual validation, conditional completion, and detailed reporting.
 */

import { World } from '../../types/index.js'
import { ScenarioTestFramework, TestResult } from './ScenarioTestFramework'
import { BuildingProxySystem } from './BuildingProxySystem'
import { AllTestScenarios, TestScenariosByCategory } from '../scenarios/index.js'
import { ColorDetector } from './ColorDetector'

export interface TestRunnerConfig {
  runMode: 'all' | 'category' | 'individual'
  category?: string
  scenarioIds?: string[]
  parallel?: boolean
  maxConcurrent?: number
  visualValidation?: boolean
  detailedLogging?: boolean
  generateReport?: boolean
  outputPath?: string
}

export interface ComprehensiveTestReport {
  timestamp: string
  config: TestRunnerConfig
  summary: {
    totalScenarios: number
    passed: number
    failed: number
    skipped: number
    successRate: number
    totalDuration: number
  }
  categoryResults: Record<
    string,
    {
      total: number
      passed: number
      failed: number
      successRate: number
    }
  >
  scenarioResults: TestResult[]
  systemValidation: {
    buildingProxySystem: boolean
    visualRepresentationSystem: boolean
    colorDetectionSystem: boolean
    rpgCoreSystemsCount: number
  }
  visualValidationResults?: {
    totalChecks: number
    passed: number
    failed: number
    colorAccuracy: number
  }
}

export class ComprehensiveTestRunner {
  private world: World
  private framework: ScenarioTestFramework
  private buildingSystem: BuildingProxySystem
  private colorDetector: ColorDetector
  private config: TestRunnerConfig
  private results: TestResult[] = []
  private startTime: number = 0

  constructor(world: World, config: TestRunnerConfig = { runMode: 'all' }) {
    this.world = world
    this.config = {
      parallel: false,
      maxConcurrent: 3,
      visualValidation: true,
      detailedLogging: true,
      generateReport: true,
      ...config,
    }

    this.framework = new ScenarioTestFramework(world)
    this.buildingSystem = new BuildingProxySystem(world)
    this.colorDetector = new ColorDetector()
  }

  /**
   * Run comprehensive RPG system tests
   */
  async runTests(): Promise<ComprehensiveTestReport> {
    this.log('🚀 Starting Comprehensive RPG System Tests')
    this.startTime = Date.now()

    try {
      // Initialize systems
      await this.initializeSystems()

      // Validate core systems
      const systemValidation = await this.validateCoreSystems()

      // Get scenarios to run
      const scenarios = this.getScenarios()
      this.log(`📋 Running ${scenarios.length} test scenarios`)

      // Run scenarios
      if (this.config.parallel) {
        this.results = await this.runScenariosParallel(scenarios)
      } else {
        this.results = await this.runScenariosSequential(scenarios)
      }

      // Generate comprehensive report
      const report = this.generateComprehensiveReport(systemValidation)

      // Save report if requested
      if (this.config.generateReport) {
        await this.saveReport(report)
      }

      this.log('✅ Comprehensive testing completed')
      return report
    } catch (error: any) {
      this.log(`❌ Test runner failed: ${error?.message || 'Unknown error'}`)
      throw error
    } finally {
      // Always cleanup
      await this.cleanup()
    }
  }

  /**
   * Initialize all required systems
   */
  private async initializeSystems(): Promise<void> {
    this.log('🔧 Initializing test systems...')

    // Initialize building proxy system
    await this.buildingSystem.init()

    // Register building system with world if not already registered
    if (!this.world.getSystem('buildingProxy')) {
      ;(this.world as any).systems = (this.world as any).systems || new Map()
      ;(this.world as any).systems.set('buildingProxy', this.buildingSystem)
    }

    // Initialize color detector
    await this.colorDetector.init()

    this.log('✅ Test systems initialized')
  }

  /**
   * Validate core RPG systems are available
   */
  private async validateCoreSystems(): Promise<{
    buildingProxySystem: boolean
    visualRepresentationSystem: boolean
    colorDetectionSystem: boolean
    rpgCoreSystemsCount: number
  }> {
    this.log('🔍 Validating core systems...')

    const visualSystem = this.world.getSystem('visualRepresentation')
    const buildingSystem = this.world.getSystem('buildingProxy')

    // Count RPG core systems
    const expectedSystems = [
      'combat',
      'inventory',
      'skills',
      'banking',
      'trading',
      'npc',
      'spawning',
      'loot',
      'movement',
      'construction',
      'grandExchange',
    ]

    let coreSystemsCount = 0
    for (const systemName of expectedSystems) {
      if (this.world.getSystem(systemName)) {
        coreSystemsCount++
      }
    }

    const validation = {
      buildingProxySystem: !!buildingSystem,
      visualRepresentationSystem: !!visualSystem,
      colorDetectionSystem: true, // We control this
      rpgCoreSystemsCount: coreSystemsCount,
    }

    this.log(`📊 System validation: ${JSON.stringify(validation)}`)
    return validation
  }

  /**
   * Get scenarios to run based on config
   */
  private getScenarios() {
    switch (this.config.runMode) {
      case 'category':
        if (!this.config.category) {
          throw new Error('Category must be specified for category run mode')
        }
        return TestScenariosByCategory[this.config.category] || []

      case 'individual':
        if (!this.config.scenarioIds || this.config.scenarioIds.length === 0) {
          throw new Error('Scenario IDs must be specified for individual run mode')
        }
        return AllTestScenarios.filter(s => this.config.scenarioIds!.includes(s.id))

      case 'all':
      default:
        return AllTestScenarios
    }
  }

  /**
   * Run scenarios sequentially
   */
  private async runScenariosSequential(scenarios: any[]): Promise<TestResult[]> {
    const results: TestResult[] = []

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i]
      this.log(`🧪 Running scenario ${i + 1}/${scenarios.length}: ${scenario.name}`)

      try {
        const result = await this.framework.runScenario(scenario)
        results.push(result)

        const status = result.success ? '✅' : '❌'
        this.log(`${status} Scenario ${scenario.id}: ${result.reason} (${result.duration}ms)`)

        // Brief pause between scenarios
        await this.wait(1000)
      } catch (error: any) {
        this.log(`💥 Scenario ${scenario.id} threw error: ${error?.message || 'Unknown error'}`)
        results.push({
          scenarioId: scenario.id,
          success: false,
          duration: 0,
          reason: `Error: ${error?.message || 'Unknown error'}`,
          logs: [],
        })
      }
    }

    return results
  }

  /**
   * Run scenarios in parallel (limited concurrency)
   */
  private async runScenariosParallel(scenarios: any[]): Promise<TestResult[]> {
    const maxConcurrent = this.config.maxConcurrent || 3
    const results: TestResult[] = []

    // Process scenarios in batches
    for (let i = 0; i < scenarios.length; i += maxConcurrent) {
      const batch = scenarios.slice(i, i + maxConcurrent)
      this.log(`🔄 Running batch ${Math.floor(i / maxConcurrent) + 1}: ${batch.map(s => s.id).join(', ')}`)

      const batchPromises = batch.map(async scenario => {
        try {
          return await this.framework.runScenario(scenario)
        } catch (error: any) {
          return {
            scenarioId: scenario.id,
            success: false,
            duration: 0,
            reason: `Error: ${error?.message || 'Unknown error'}`,
            logs: [],
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Brief pause between batches
      if (i + maxConcurrent < scenarios.length) {
        await this.wait(2000)
      }
    }

    return results
  }

  /**
   * Generate comprehensive test report
   */
  private generateComprehensiveReport(systemValidation: any): ComprehensiveTestReport {
    const totalDuration = Date.now() - this.startTime
    const passed = this.results.filter(r => r.success).length
    const failed = this.results.filter(r => !r.success).length
    const total = this.results.length
    const successRate = total > 0 ? (passed / total) * 100 : 0

    // Calculate category results
    const categoryResults: Record<string, any> = {}
    for (const [categoryName, scenarios] of Object.entries(TestScenariosByCategory)) {
      const categoryScenarioIds = scenarios.map(s => s.id)
      const categoryTestResults = this.results.filter(r => categoryScenarioIds.includes(r.scenarioId))

      if (categoryTestResults.length > 0) {
        const categoryPassed = categoryTestResults.filter(r => r.success).length
        categoryResults[categoryName] = {
          total: categoryTestResults.length,
          passed: categoryPassed,
          failed: categoryTestResults.length - categoryPassed,
          successRate: (categoryPassed / categoryTestResults.length) * 100,
        }
      }
    }

    // Calculate visual validation results
    let visualValidationResults
    if (this.config.visualValidation) {
      const allVisualChecks = this.results.map(r => r.visualValidation).filter(v => v !== undefined)

      if (allVisualChecks.length > 0) {
        const totalChecks = allVisualChecks.reduce((sum, v) => sum + v!.expected, 0)
        const totalFound = allVisualChecks.reduce((sum, v) => sum + v!.found, 0)

        visualValidationResults = {
          totalChecks,
          passed: totalFound,
          failed: totalChecks - totalFound,
          colorAccuracy: totalChecks > 0 ? (totalFound / totalChecks) * 100 : 0,
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      summary: {
        totalScenarios: total,
        passed,
        failed,
        skipped: 0,
        successRate,
        totalDuration,
      },
      categoryResults,
      scenarioResults: this.results,
      systemValidation,
      visualValidationResults,
    }
  }

  /**
   * Save report to file
   */
  private async saveReport(report: ComprehensiveTestReport): Promise<void> {
    try {
      const outputPath = this.config.outputPath || `/tmp/rpg-test-report-${Date.now()}.json`

      // In a real implementation, this would save to the filesystem
      this.log(`💾 Report would be saved to: ${outputPath}`)
      this.log(
        `📊 Report Summary: ${report.summary.passed}/${report.summary.totalScenarios} passed (${report.summary.successRate.toFixed(1)}%)`
      )
    } catch (error: any) {
      this.log(`⚠️ Failed to save report: ${error?.message || 'Unknown error'}`)
    }
  }

  /**
   * Clean up test runner resources
   */
  private async cleanup(): Promise<void> {
    this.log('🧹 Cleaning up test runner...')

    try {
      await this.framework.cleanup()
      this.buildingSystem.cleanup()
    } catch (error: any) {
      this.log(`⚠️ Cleanup error: ${error?.message || 'Unknown error'}`)
    }

    this.log('✅ Test runner cleanup complete')
  }

  /**
   * Log message with timestamp
   */
  private log(message: string): void {
    if (this.config.detailedLogging) {
      const timestamp = new Date().toISOString().substring(11, 23)
      console.log(`[${timestamp}] [TestRunner] ${message}`)
    }
  }

  /**
   * Wait for specified duration
   */
  private async wait(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration))
  }

  /**
   * Get current test results
   */
  getResults(): TestResult[] {
    return [...this.results]
  }

  /**
   * Get test framework for manual scenario running
   */
  getFramework(): ScenarioTestFramework {
    return this.framework
  }

  /**
   * Get building system for manual building creation
   */
  getBuildingSystem(): BuildingProxySystem {
    return this.buildingSystem
  }
}

/**
 * Convenience function to run all tests
 */
export async function runComprehensiveRPGTests(
  world: World,
  config?: Partial<TestRunnerConfig>
): Promise<ComprehensiveTestReport> {
  const runner = new ComprehensiveTestRunner(world, config as TestRunnerConfig)
  return await runner.runTests()
}

/**
 * Quick test functions for different scenarios
 */
export const QuickTests = {
  async banking(world: World) {
    return runComprehensiveRPGTests(world, {
      runMode: 'category',
      category: 'banking',
    })
  },

  async combat(world: World) {
    return runComprehensiveRPGTests(world, {
      runMode: 'category',
      category: 'combat',
    })
  },

  async movement(world: World) {
    return runComprehensiveRPGTests(world, {
      runMode: 'category',
      category: 'movement',
    })
  },

  async all(world: World) {
    return runComprehensiveRPGTests(world, {
      runMode: 'all',
      parallel: false,
      detailedLogging: true,
    })
  },
}
