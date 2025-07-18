import { TestResult as ITestResult, TestValidation } from '../types'

/**
 * Utility class for creating and managing test results
 */
export class TestResult {
  /**
   * Create a passing test result
   */
  static pass(
    scenarioId: string,
    scenarioName: string,
    startTime: number,
    endTime: number,
    validation: TestValidation,
    logs: string[] = [],
    screenshots: string[] = []
  ): ITestResult {
    return {
      scenarioId,
      scenarioName,
      status: 'passed',
      startTime,
      endTime,
      duration: endTime - startTime,
      validation,
      logs,
      screenshots
    }
  }
  
  /**
   * Create a failing test result
   */
  static fail(
    scenarioId: string,
    scenarioName: string,
    startTime: number,
    endTime: number,
    validation: TestValidation,
    logs: string[] = [],
    screenshots: string[] = []
  ): ITestResult {
    return {
      scenarioId,
      scenarioName,
      status: 'failed',
      startTime,
      endTime,
      duration: endTime - startTime,
      validation,
      logs,
      screenshots
    }
  }
  
  /**
   * Create an error test result
   */
  static error(
    scenarioId: string,
    scenarioName: string,
    startTime: number,
    endTime: number,
    error: Error,
    logs: string[] = [],
    screenshots: string[] = []
  ): ITestResult {
    return {
      scenarioId,
      scenarioName,
      status: 'error',
      startTime,
      endTime,
      duration: endTime - startTime,
      error,
      logs,
      screenshots
    }
  }
  
  /**
   * Create a skipped test result
   */
  static skip(
    scenarioId: string,
    scenarioName: string,
    reason?: string
  ): ITestResult {
    const now = Date.now()
    return {
      scenarioId,
      scenarioName,
      status: 'skipped',
      startTime: now,
      endTime: now,
      duration: 0,
      logs: reason ? [`Skipped: ${reason}`] : [],
      screenshots: []
    }
  }
  
  /**
   * Format result for display
   */
  static format(result: ITestResult): string {
    const status = {
      passed: '✅',
      failed: '❌',
      skipped: '⏭️',
      error: '💥'
    }[result.status]
    
    let output = `${status} ${result.scenarioName} (${result.duration}ms)`
    
    if (result.validation?.failures.length) {
      output += '\n  Failures:'
      result.validation.failures.forEach(f => {
        output += `\n    - ${f.message}`
        if (f.expected !== undefined) {
          output += `\n      Expected: ${JSON.stringify(f.expected)}`
        }
        if (f.actual !== undefined) {
          output += `\n      Actual: ${JSON.stringify(f.actual)}`
        }
      })
    }
    
    if (result.validation?.warnings.length) {
      output += '\n  Warnings:'
      result.validation.warnings.forEach(w => {
        output += `\n    - ${w}`
      })
    }
    
    if (result.error) {
      output += `\n  Error: ${result.error.message}`
      if (result.error.stack) {
        output += `\n  Stack: ${result.error.stack.split('\n').slice(1, 3).join('\n  ')}`
      }
    }
    
    return output
  }
} 