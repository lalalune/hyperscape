import { TestScenario as ITestScenario, TestContext, TestValidation } from '../types'

/**
 * Base class for test scenarios
 * Can be extended for more complex scenarios
 */
export abstract class TestScenario implements ITestScenario {
  abstract id: string
  abstract name: string
  abstract description: string
  category?: string
  tags?: string[]
  timeout?: number
  
  /**
   * Setup phase - prepare test environment
   */
  abstract setup(context: TestContext): Promise<void>
  
  /**
   * Execute phase - perform test actions
   */
  abstract execute(context: TestContext): Promise<void>
  
  /**
   * Validate phase - check test results
   */
  abstract validate(context: TestContext): Promise<TestValidation>
  
  /**
   * Cleanup phase - restore original state
   */
  abstract cleanup(context: TestContext): Promise<void>
  
  /**
   * Helper to create a passing validation
   */
  protected pass(metrics?: any): TestValidation {
    return {
      passed: true,
      failures: [],
      warnings: [],
      metrics
    }
  }
  
  /**
   * Helper to create a failing validation
   */
  protected fail(message: string, details?: any): TestValidation {
    return {
      passed: false,
      failures: [{
        type: 'assertion',
        message,
        expected: details?.expected,
        actual: details?.actual
      }],
      warnings: []
    }
  }
  
  /**
   * Helper to create validation with warnings
   */
  protected warn(warnings: string[], metrics?: any): TestValidation {
    return {
      passed: true,
      failures: [],
      warnings,
      metrics
    }
  }
} 