import { TestFramework } from './TestFramework'
import { TestScenario, TestResult, TestRunnerConfig, TestReport } from '../types'
import { ScenarioRunner } from '../runners/ScenarioRunner'

/**
 * Main test runner that orchestrates test execution
 */
export class TestRunner {
  private framework: TestFramework
  private scenarioRunner: ScenarioRunner
  
  constructor(framework: TestFramework) {
    this.framework = framework
    this.scenarioRunner = new ScenarioRunner(framework)
  }
  
  /**
   * Run tests based on configuration
   */
  async run(config: TestRunnerConfig = {}): Promise<TestReport> {
    console.log('[TestRunner] Starting test run...')
    const startTime = Date.now()
    
    // Determine which scenarios to run
    const scenarios = this.selectScenarios(config)
    
    if (scenarios.length === 0) {
      console.warn('[TestRunner] No scenarios selected')
      return this.createEmptyReport(config)
    }
    
    console.log(`[TestRunner] Running ${scenarios.length} scenarios...`)
    
    // Run scenarios
    const results = config.parallel
      ? await this.runParallel(scenarios, config)
      : await this.runSequential(scenarios, config)
    
    // Create report
    const report = this.createReport(config, results, startTime)
    
    // Save report if requested
    if (config.generateReport) {
      await this.saveReport(report, config.outputDir)
    }
    
    console.log('[TestRunner] Test run complete')
    console.log(`[TestRunner] ${report.summary.passed}/${report.summary.total} passed`)
    
    return report
  }
  
  /**
   * Select scenarios based on config
   */
  private selectScenarios(config: TestRunnerConfig): TestScenario[] {
    let scenarios: TestScenario[] = []
    
    if (config.scenarios) {
      // Specific scenarios provided
      scenarios = config.scenarios.map(s => 
        typeof s === 'string' ? this.framework.getScenario(s) : s
      ).filter(Boolean) as TestScenario[]
    } else if (config.categories) {
      // Filter by categories
      config.categories.forEach(cat => {
        scenarios.push(...this.framework.getScenariosByCategory(cat))
      })
    } else if (config.tags) {
      // Filter by tags
      scenarios = this.framework.getScenariosByTags(config.tags)
    } else {
      // Run all scenarios
      scenarios = this.framework.getAllScenarios()
    }
    
    return scenarios
  }
  
  /**
   * Run scenarios sequentially
   */
  private async runSequential(
    scenarios: TestScenario[], 
    config: TestRunnerConfig
  ): Promise<TestResult[]> {
    const results: TestResult[] = []
    
    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario, config)
      results.push(result)
      
      if (config.verbose) {
        this.printResult(result)
      }
    }
    
    return results
  }
  
  /**
   * Run scenarios in parallel
   */
  private async runParallel(
    scenarios: TestScenario[], 
    config: TestRunnerConfig
  ): Promise<TestResult[]> {
    const maxConcurrent = config.maxConcurrent || 5
    const results: TestResult[] = []
    
    // Process in batches
    for (let i = 0; i < scenarios.length; i += maxConcurrent) {
      const batch = scenarios.slice(i, i + maxConcurrent)
      const batchResults = await Promise.all(
        batch.map(scenario => this.runScenario(scenario, config))
      )
      results.push(...batchResults)
      
      if (config.verbose) {
        batchResults.forEach(result => this.printResult(result))
      }
    }
    
    return results
  }
  
  /**
   * Run a single scenario
   */
  private async runScenario(
    scenario: TestScenario,
    config: TestRunnerConfig
  ): Promise<TestResult> {
    const timeout = scenario.timeout || config.timeout || 60000
    const retries = config.retries || 0
    
    let lastResult: TestResult | undefined
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        console.log(`[TestRunner] Retrying ${scenario.name} (attempt ${attempt + 1})`)
      }
      
      lastResult = await this.scenarioRunner.runScenario(scenario, {
        timeout,
        captureScreenshots: config.captureScreenshots,
        outputDir: config.outputDir
      })
      
      if (lastResult.status === 'passed') {
        break
      }
    }
    
    return lastResult || this.createErrorResult(scenario, 'No result after retries')
  }
  
  /**
   * Create error result
   */
  private createErrorResult(scenario: TestScenario, message: string): TestResult {
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: 'error',
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      error: new Error(message),
      logs: [],
      screenshots: []
    }
  }
  
  /**
   * Create test report
   */
  private createReport(
    config: TestRunnerConfig,
    results: TestResult[],
    startTime: number
  ): TestReport {
    const endTime = Date.now()
    
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errorRate: 0
    }
    
    summary.errorRate = summary.total > 0 
      ? (summary.failed / summary.total) * 100 
      : 0
    
    const metrics = this.calculateAggregateMetrics(results)
    
    return {
      timestamp: startTime,
      duration: endTime - startTime,
      config,
      summary,
      results,
      metrics
    }
  }
  
  /**
   * Calculate aggregate metrics
   */
  private calculateAggregateMetrics(results: TestResult[]): any {
    const durations = results.map(r => r.duration)
    const validResults = results.filter(r => r.validation?.metrics)
    
    if (validResults.length === 0) return undefined
    
    const entityCounts = validResults.map(r => r.validation!.metrics!.entityCount)
    const memoryUsages = validResults.map(r => r.validation!.metrics!.memoryUsage)
    
    return {
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      avgEntityCount: entityCounts.reduce((a, b) => a + b, 0) / entityCounts.length,
      maxEntityCount: Math.max(...entityCounts),
      avgMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      maxMemoryUsage: Math.max(...memoryUsages)
    }
  }
  
  /**
   * Create empty report
   */
  private createEmptyReport(config: TestRunnerConfig): TestReport {
    return {
      timestamp: Date.now(),
      duration: 0,
      config,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        errorRate: 0
      },
      results: []
    }
  }
  
  /**
   * Save report to file
   */
  private async saveReport(report: TestReport, outputDir?: string): Promise<void> {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const dir = outputDir || './test-results'
    await fs.mkdir(dir, { recursive: true })
    
    const filename = `test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    const filepath = path.join(dir, filename)
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2))
    console.log(`[TestRunner] Report saved to: ${filepath}`)
  }
  
  /**
   * Print test result
   */
  private printResult(result: TestResult): void {
    const status = result.status === 'passed' ? '✅' : '❌'
    console.log(`${status} ${result.scenarioName} (${result.duration}ms)`)
    
    if (result.validation?.failures.length) {
      result.validation.failures.forEach(f => {
        console.log(`   - ${f.message}`)
      })
    }
    
    if (result.error) {
      console.log(`   - Error: ${result.error.message}`)
    }
  }
} 