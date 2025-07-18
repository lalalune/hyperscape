import { TestValidation, ValidationFailure } from '../types'

/**
 * Helper functions for test validations
 */
export class ValidationHelpers {
  /**
   * Assert that a condition is true
   */
  static assertTrue(condition: boolean, message: string): ValidationFailure | null {
    if (!condition) {
      return {
        type: 'assertion',
        message,
        expected: true,
        actual: false
      }
    }
    return null
  }
  
  /**
   * Assert that two values are equal
   */
  static assertEqual<T>(actual: T, expected: T, message?: string): ValidationFailure | null {
    if (actual !== expected) {
      return {
        type: 'assertion',
        message: message || `Expected ${expected} but got ${actual}`,
        expected,
        actual
      }
    }
    return null
  }
  
  /**
   * Assert that a value is within a range
   */
  static assertInRange(
    value: number, 
    min: number, 
    max: number, 
    message?: string
  ): ValidationFailure | null {
    if (value < min || value > max) {
      return {
        type: 'assertion',
        message: message || `Expected value between ${min} and ${max}, got ${value}`,
        expected: `${min}-${max}`,
        actual: value
      }
    }
    return null
  }
  
  /**
   * Assert that an array contains a value
   */
  static assertContains<T>(
    array: T[], 
    value: T, 
    message?: string
  ): ValidationFailure | null {
    if (!array.includes(value)) {
      return {
        type: 'assertion',
        message: message || `Expected array to contain ${value}`,
        expected: value,
        actual: array
      }
    }
    return null
  }
  
  /**
   * Assert that an object has a property
   */
  static assertHasProperty(
    obj: any, 
    property: string, 
    message?: string
  ): ValidationFailure | null {
    if (!(property in obj)) {
      return {
        type: 'assertion',
        message: message || `Expected object to have property '${property}'`,
        expected: property,
        actual: Object.keys(obj)
      }
    }
    return null
  }
  
  /**
   * Create a validation result from multiple checks
   */
  static createValidation(
    checks: (ValidationFailure | null)[],
    warnings?: string[],
    metrics?: any
  ): TestValidation {
    const failures = checks.filter(Boolean) as ValidationFailure[]
    
    return {
      passed: failures.length === 0,
      failures,
      warnings: warnings || [],
      metrics
    }
  }
  
  /**
   * Combine multiple validations
   */
  static combineValidations(...validations: TestValidation[]): TestValidation {
    const failures: ValidationFailure[] = []
    const warnings: string[] = []
    
    for (const validation of validations) {
      failures.push(...validation.failures)
      warnings.push(...validation.warnings)
    }
    
    return {
      passed: failures.length === 0,
      failures,
      warnings
    }
  }
  
  /**
   * Assert entity state
   */
  static assertEntityState(
    entity: any,
    expectedState: Record<string, any>
  ): ValidationFailure[] {
    const failures: ValidationFailure[] = []
    
    for (const [key, expectedValue] of Object.entries(expectedState)) {
      const actualValue = entity[key]
      
      if (actualValue !== expectedValue) {
        failures.push({
          type: 'assertion',
          message: `Entity property '${key}' mismatch`,
          expected: expectedValue,
          actual: actualValue
        })
      }
    }
    
    return failures
  }
} 