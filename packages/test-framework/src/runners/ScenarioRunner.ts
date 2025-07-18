import { TestFramework } from '../core/TestFramework'
import { TestScenario, TestResult, TestContext } from '../types'
import { TestResult as TestResultHelper } from '../core/TestResult'

/**
 * Runner for individual test scenarios
 */
export class ScenarioRunner {
  private framework: TestFramework
  
  constructor(framework: TestFramework) {
    this.framework = framework
  }
  
  /**
   * Run a single scenario
   */
  async runScenario(
    scenario: TestScenario,
    options: {
      timeout?: number
      captureScreenshots?: boolean
      outputDir?: string
    } = {}
  ): Promise<TestResult> {
    const startTime = Date.now()
    const context = this.framework.createTestContext()
    const logs: string[] = []
    const screenshots: string[] = []
    
    // Capture logs
    const originalLog = context.log
    context.log = (message: string) => {
      logs.push(message)
      originalLog(message)
    }
    
    try {
      // Run with timeout
      const result = await this.runWithTimeout(
        () => this.executeScenario(scenario, context, options),
        options.timeout || scenario.timeout || 60000
      )
      
      // Add captured logs and screenshots
      result.logs.push(...logs)
      result.screenshots.push(...screenshots)
      
      return result
    } catch (error: any) {
      // Handle timeout or other errors
      return TestResultHelper.error(
        scenario.id,
        scenario.name,
        startTime,
        Date.now(),
        error,
        logs,
        screenshots
      )
    }
  }
  
  /**
   * Execute scenario phases
   */
  private async executeScenario(
    scenario: TestScenario,
    context: TestContext,
    options: any
  ): Promise<TestResult> {
    const startTime = Date.now()
    let setupComplete = false
    
    try {
      // Setup phase
      context.log(`[Setup] Starting setup for ${scenario.name}`)
      await scenario.setup(context)
      setupComplete = true
      context.log('[Setup] Setup complete')
      
      // Execute phase
      context.log('[Execute] Starting test execution')
      await scenario.execute(context)
      context.log('[Execute] Execution complete')
      
      // Validate phase
      context.log('[Validate] Starting validation')
      const validation = await scenario.validate(context)
      context.log(`[Validate] Validation ${validation.passed ? 'passed' : 'failed'}`)
      
      // Capture metrics
      validation.metrics = {
        ...context.helpers.captureMetrics(),
        ...validation.metrics,
        duration: Date.now() - startTime
      }
      
      // Create result
      const endTime = Date.now()
      return validation.passed
        ? TestResultHelper.pass(
            scenario.id,
            scenario.name,
            startTime,
            endTime,
            validation,
            [],
            []
          )
        : TestResultHelper.fail(
            scenario.id,
            scenario.name,
            startTime,
            endTime,
            validation,
            [],
            []
          )
    } catch (error: any) {
      // Test failed with exception
      context.error(`Test failed with error: ${error.message}`)
      
      return TestResultHelper.error(
        scenario.id,
        scenario.name,
        startTime,
        Date.now(),
        error,
        [],
        []
      )
    } finally {
      // Always run cleanup
      if (setupComplete) {
        try {
          context.log('[Cleanup] Starting cleanup')
          await scenario.cleanup(context)
          context.log('[Cleanup] Cleanup complete')
        } catch (cleanupError: any) {
          context.error(`Cleanup failed: ${cleanupError.message}`)
        }
      }
    }
  }
  
  /**
   * Run function with timeout
   */
  private runWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Test timed out after ${timeout}ms`))
      }, timeout)
      
      fn().then(
        result => {
          clearTimeout(timer)
          resolve(result)
        },
        error => {
          clearTimeout(timer)
          reject(error)
        }
      )
    })
  }
} 