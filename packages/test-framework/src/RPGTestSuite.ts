import { promises as fs } from 'fs'
import { join } from 'path'
import { CombatTest } from './rpg-tests/CombatTest.js'
import { MobSpawningTest } from './rpg-tests/MobSpawningTest.js'
import { DeathRespawnTest } from './rpg-tests/DeathRespawnTest.js'
import { PersistenceTest } from './rpg-tests/PersistenceTest.js'
import { TestScenario } from './rpg-tests/TestScenario.js'

export interface TestSuiteConfig {
  hyperfyUrl: string
  outputDir: string
  screenshotDir: string
  parallel: boolean
  timeout: number
  skipOnError: boolean
  tests: string[]
}

export interface TestSuiteResult {
  totalTests: number
  passedTests: number
  failedTests: number
  duration: number
  results: Array<{
    name: string
    passed: boolean
    duration: number
    errors: string[]
    summary: string
  }>
}

export class RPGTestSuite {
  private config: TestSuiteConfig
  private availableTests: Map<string, any>

  constructor(config: Partial<TestSuiteConfig> = {}) {
    this.config = {
      hyperfyUrl: config.hyperfyUrl || 'http://localhost:3000',
      outputDir: config.outputDir || './test-results',
      screenshotDir: config.screenshotDir || './test-results/screenshots',
      parallel: config.parallel || false,
      timeout: config.timeout || 300000, // 5 minutes
      skipOnError: config.skipOnError || false,
      tests: config.tests || ['combat', 'spawning', 'death', 'persistence']
    }

    this.availableTests = new Map()
    this.availableTests.set('combat', CombatTest)
    this.availableTests.set('spawning', MobSpawningTest)
    this.availableTests.set('death', DeathRespawnTest)
    this.availableTests.set('persistence', PersistenceTest)
  }

  async runAll(): Promise<TestSuiteResult> {
    console.log('[RPGTestSuite] Starting RPG test suite...')
    console.log(`[RPGTestSuite] Configuration:`, this.config)

    const startTime = Date.now()
    const results: TestSuiteResult['results'] = []

    // Ensure output directories exist
    await this.setupOutputDirectories()

    // Create test report header
    await this.createTestReport('RPG Test Suite Started', 'Starting comprehensive RPG system tests')

    try {
      if (this.config.parallel) {
        await this.runTestsParallel(results)
      } else {
        await this.runTestsSequential(results)
      }
    } catch (error) {
      console.error('[RPGTestSuite] Test suite execution failed:', error)
      results.push({
        name: 'Test Suite Execution',
        passed: false,
        duration: 0,
        errors: [`Test suite execution failed: ${error}`],
        summary: 'Critical test suite failure'
      })
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    const testSuiteResult: TestSuiteResult = {
      totalTests: results.length,
      passedTests: results.filter(r => r.passed).length,
      failedTests: results.filter(r => !r.passed).length,
      duration,
      results
    }

    // Generate final report
    await this.generateFinalReport(testSuiteResult)

    console.log('[RPGTestSuite] Test suite completed')
    console.log(`[RPGTestSuite] Total: ${testSuiteResult.totalTests}, Passed: ${testSuiteResult.passedTests}, Failed: ${testSuiteResult.failedTests}`)
    console.log(`[RPGTestSuite] Duration: ${duration}ms`)

    return testSuiteResult
  }

  private async runTestsSequential(results: TestSuiteResult['results']): Promise<void> {
    console.log('[RPGTestSuite] Running tests sequentially...')

    for (const testName of this.config.tests) {
      const TestClass = this.availableTests.get(testName)
      if (!TestClass) {
        console.warn(`[RPGTestSuite] Unknown test: ${testName}`)
        results.push({
          name: testName,
          passed: false,
          duration: 0,
          errors: [`Unknown test: ${testName}`],
          summary: 'Test not found'
        })
        continue
      }

      console.log(`[RPGTestSuite] Running test: ${testName}`)
      
      try {
        const testInstance = new TestClass(this.config.hyperfyUrl, this.config.outputDir)
        const testResult = await this.runSingleTest(testInstance, testName)
        results.push(testResult)

        // Stop on error if configured
        if (!testResult.passed && this.config.skipOnError) {
          console.log(`[RPGTestSuite] Stopping test suite due to failure in: ${testName}`)
          break
        }

        // Wait between tests to avoid conflicts
        await new Promise(resolve => setTimeout(resolve, 5000))

      } catch (error) {
        console.error(`[RPGTestSuite] Test ${testName} threw exception:`, error)
        results.push({
          name: testName,
          passed: false,
          duration: 0,
          errors: [`Test execution failed: ${error}`],
          summary: 'Test execution exception'
        })

        if (this.config.skipOnError) {
          break
        }
      }
    }
  }

  private async runTestsParallel(results: TestSuiteResult['results']): Promise<void> {
    console.log('[RPGTestSuite] Running tests in parallel...')

    const testPromises = this.config.tests.map(async (testName) => {
      const TestClass = this.availableTests.get(testName)
      if (!TestClass) {
        return {
          name: testName,
          passed: false,
          duration: 0,
          errors: [`Unknown test: ${testName}`],
          summary: 'Test not found'
        }
      }

      try {
        const testInstance = new TestClass(this.config.hyperfyUrl, this.config.outputDir)
        return await this.runSingleTest(testInstance, testName)
      } catch (error) {
        return {
          name: testName,
          passed: false,
          duration: 0,
          errors: [`Test execution failed: ${error}`],
          summary: 'Test execution exception'
        }
      }
    })

    const testResults = await Promise.allSettled(testPromises)
    
    for (const result of testResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        results.push({
          name: 'Unknown',
          passed: false,
          duration: 0,
          errors: [`Promise rejected: ${result.reason}`],
          summary: 'Promise rejection'
        })
      }
    }
  }

  private async runSingleTest(testInstance: TestScenario, testName: string): Promise<TestSuiteResult['results'][0]> {
    console.log(`[RPGTestSuite] Executing test: ${testName}`)

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout')), this.config.timeout)
    })

    try {
      const result = await Promise.race([
        testInstance.execute(),
        timeout
      ])

      return {
        name: testInstance.name,
        passed: result.passed,
        duration: result.duration,
        errors: result.results.flatMap(r => r.errors),
        summary: result.summary
      }
    } catch (error) {
      return {
        name: testInstance.name,
        passed: false,
        duration: 0,
        errors: [`Test execution failed: ${error}`],
        summary: 'Test execution failure'
      }
    }
  }

  private async setupOutputDirectories(): Promise<void> {
    const dirs = [
      this.config.outputDir,
      this.config.screenshotDir,
      join(this.config.outputDir, 'results'),
      join(this.config.outputDir, 'reports'),
      join(this.config.outputDir, 'worlds'),
      join(this.config.outputDir, 'logs')
    ]

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true })
    }
  }

  private async createTestReport(title: string, description: string): Promise<void> {
    const timestamp = new Date().toISOString()
    const reportPath = join(this.config.outputDir, 'reports', `test-report-${timestamp.replace(/[:.]/g, '-')}.md`)

    const report = `# ${title}

**Date:** ${timestamp}
**Description:** ${description}

## Configuration

- **Hyperfy URL:** ${this.config.hyperfyUrl}
- **Output Directory:** ${this.config.outputDir}
- **Parallel Execution:** ${this.config.parallel}
- **Timeout:** ${this.config.timeout}ms
- **Skip on Error:** ${this.config.skipOnError}
- **Tests:** ${this.config.tests.join(', ')}

## Test Results

*This report will be updated as tests complete...*
`

    await fs.writeFile(reportPath, report)
  }

  private async generateFinalReport(result: TestSuiteResult): Promise<void> {
    const timestamp = new Date().toISOString()
    const reportPath = join(this.config.outputDir, 'reports', `final-report-${timestamp.replace(/[:.]/g, '-')}.md`)

    let report = `# RPG Test Suite Final Report

**Date:** ${timestamp}
**Total Tests:** ${result.totalTests}
**Passed:** ${result.passedTests}
**Failed:** ${result.failedTests}
**Duration:** ${result.duration}ms
**Success Rate:** ${((result.passedTests / result.totalTests) * 100).toFixed(2)}%

## Test Results Summary

| Test | Status | Duration | Errors |
|------|--------|----------|---------|
`

    for (const testResult of result.results) {
      const status = testResult.passed ? '✅ PASSED' : '❌ FAILED'
      const duration = `${testResult.duration}ms`
      const errorCount = testResult.errors.length
      
      report += `| ${testResult.name} | ${status} | ${duration} | ${errorCount} |\n`
    }

    report += `\n## Detailed Results\n\n`

    for (const testResult of result.results) {
      report += `### ${testResult.name}\n\n`
      report += `**Status:** ${testResult.passed ? 'PASSED' : 'FAILED'}\n`
      report += `**Duration:** ${testResult.duration}ms\n\n`
      
      if (testResult.errors.length > 0) {
        report += `**Errors:**\n`
        for (const error of testResult.errors) {
          report += `- ${error}\n`
        }
        report += '\n'
      }
      
      report += `**Summary:**\n\`\`\`\n${testResult.summary}\n\`\`\`\n\n`
    }

    // Add overall assessment
    report += `\n## Overall Assessment\n\n`
    
    if (result.passedTests === result.totalTests) {
      report += `🎉 **All tests passed!** The RPG system is functioning correctly.\n\n`
    } else if (result.passedTests > result.failedTests) {
      report += `⚠️ **Most tests passed** but there are some issues that need attention.\n\n`
    } else {
      report += `🚨 **Critical issues detected** in the RPG system. Immediate attention required.\n\n`
    }

    // Add recommendations
    report += `## Recommendations\n\n`
    
    const failedTests = result.results.filter(r => !r.passed)
    if (failedTests.length > 0) {
      report += `The following tests failed and should be investigated:\n\n`
      for (const failed of failedTests) {
        report += `- **${failed.name}**: ${failed.errors.join(', ')}\n`
      }
    } else {
      report += `All tests passed successfully. The RPG system is ready for production use.\n`
    }

    await fs.writeFile(reportPath, report)
    console.log(`[RPGTestSuite] Final report generated: ${reportPath}`)
  }

  // Utility methods for external use
  static async runSingleTest(testName: string, config: Partial<TestSuiteConfig> = {}): Promise<TestSuiteResult> {
    const suite = new RPGTestSuite({ ...config, tests: [testName] })
    return await suite.runAll()
  }

  static async runCombatTest(config: Partial<TestSuiteConfig> = {}): Promise<TestSuiteResult> {
    return await RPGTestSuite.runSingleTest('combat', config)
  }

  static async runSpawningTest(config: Partial<TestSuiteConfig> = {}): Promise<TestSuiteResult> {
    return await RPGTestSuite.runSingleTest('spawning', config)
  }

  static async runDeathTest(config: Partial<TestSuiteConfig> = {}): Promise<TestSuiteResult> {
    return await RPGTestSuite.runSingleTest('death', config)
  }

  static async runPersistenceTest(config: Partial<TestSuiteConfig> = {}): Promise<TestSuiteResult> {
    return await RPGTestSuite.runSingleTest('persistence', config)
  }

  getAvailableTests(): string[] {
    return Array.from(this.availableTests.keys())
  }
}