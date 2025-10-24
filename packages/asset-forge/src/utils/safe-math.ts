/**
 * Safe Math Utilities
 * Provides division by zero protection for all mathematical operations
 */

import createLogger from './logger.ts'

const logger = createLogger('SafeMath')

/**
 * Epsilon for floating point comparisons
 * Values smaller than this are considered effectively zero
 */
export const EPSILON = 1e-10

/**
 * Safely divide two numbers with division by zero protection
 * @param numerator - The dividend
 * @param denominator - The divisor
 * @param defaultValue - Value to return if denominator is zero (default: 0)
 * @returns The result of division or defaultValue if denominator is zero
 */
export function safeDivide(
  numerator: number,
  denominator: number,
  defaultValue = 0
): number {
  if (Math.abs(denominator) < EPSILON) {
    logger.warn('Division by zero prevented', { numerator, denominator, defaultValue })
    return defaultValue
  }

  const result = numerator / denominator

  if (!Number.isFinite(result)) {
    logger.error('Division resulted in non-finite value', {
      numerator,
      denominator,
      result
    })
    return defaultValue
  }

  return result
}

/**
 * Safely calculate scale factor between two values
 * @param target - Target size/value
 * @param current - Current size/value
 * @param defaultScale - Scale to return if current is zero (default: 1)
 * @returns Scale factor or defaultScale if current is zero
 */
export function safeScale(
  target: number,
  current: number,
  defaultScale = 1
): number {
  if (Math.abs(current) < EPSILON) {
    logger.warn('Scale calculation with zero current value prevented', {
      target,
      current,
      defaultScale
    })
    return defaultScale
  }

  const scale = target / current

  if (!Number.isFinite(scale)) {
    logger.error('Scale calculation resulted in non-finite value', {
      target,
      current,
      scale
    })
    return defaultScale
  }

  return scale
}

/**
 * Safely calculate average of an array of numbers
 * @param values - Array of numbers to average
 * @returns Average value or 0 if array is empty
 */
export function safeAverage(values: number[]): number {
  if (values.length === 0) {
    logger.warn('Average calculation on empty array')
    return 0
  }

  const sum = values.reduce((acc, val) => acc + val, 0)
  return sum / values.length
}

/**
 * Safely calculate percentage
 * @param numerator - Part value
 * @param denominator - Total value
 * @returns Percentage (0-100) or 0 if denominator is zero
 */
export function safePercentage(
  numerator: number,
  denominator: number
): number {
  if (Math.abs(denominator) < EPSILON) {
    logger.warn('Percentage calculation with zero denominator prevented', {
      numerator,
      denominator
    })
    return 0
  }

  const percentage = (numerator / denominator) * 100

  if (!Number.isFinite(percentage)) {
    logger.error('Percentage calculation resulted in non-finite value', {
      numerator,
      denominator,
      percentage
    })
    return 0
  }

  return percentage
}

/**
 * Safely calculate ratio between two values
 * @param value1 - First value
 * @param value2 - Second value
 * @param defaultRatio - Ratio to return if value2 is zero (default: 1)
 * @returns Ratio or defaultRatio if value2 is zero
 */
export function safeRatio(
  value1: number,
  value2: number,
  defaultRatio = 1
): number {
  return safeScale(value1, value2, defaultRatio)
}

/**
 * Safely normalize a value to 0-1 range
 * @param value - Value to normalize
 * @param max - Maximum value in range
 * @returns Normalized value (0-1) or 0 if max is zero
 */
export function safeNormalize(
  value: number,
  max: number
): number {
  if (Math.abs(max) < EPSILON) {
    logger.warn('Normalization with zero max value prevented', { value, max })
    return 0
  }

  const normalized = value / max

  if (!Number.isFinite(normalized)) {
    logger.error('Normalization resulted in non-finite value', {
      value,
      max,
      normalized
    })
    return 0
  }

  return Math.max(0, Math.min(1, normalized))
}

/**
 * Validate that a number is finite and not NaN
 * @param value - Value to validate
 * @param context - Context description for error logging
 * @returns True if value is valid
 */
export function isValidNumber(value: number, context?: string): boolean {
  const valid = Number.isFinite(value) && !Number.isNaN(value)

  if (!valid && context) {
    logger.error('Invalid number detected', { value, context })
  }

  return valid
}

/**
 * Assert that a number is valid, throw error if not
 * @param value - Value to validate
 * @param context - Context description for error
 * @throws Error if value is not finite or is NaN
 */
export function assertValidNumber(value: number, context: string): void {
  if (!isValidNumber(value, context)) {
    throw new Error(`Invalid number in ${context}: ${value}`)
  }
}
