/**
 * Strict type definitions for action handlers
 * These bridge the gap between @elizaos/core Handler type and our strict types
 */

import type {
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionResult as CoreActionResult,
} from '@elizaos/core'

/**
 * Strict action result type
 */
export interface ActionResult extends CoreActionResult {
  text: string
  success: boolean
  data?: Record<string, unknown>
  values?: Record<string, unknown>
}

/**
 * Strict handler options with proper typing
 */
export type StrictHandlerOptions = Record<string, unknown>

/**
 * Strict handler function signature that matches core Handler type
 * This uses optional state and unknown options to match @elizaos/core expectations
 */
export type StrictHandler = (
  runtime: IAgentRuntime,
  message: Memory,
  state?: State,
  options?: StrictHandlerOptions,
  callback?: HandlerCallback,
  responses?: Memory[]
) => Promise<ActionResult>

/**
 * Type guard to check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Type guard to check if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

/**
 * Type guard to check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/**
 * Safely extract string from unknown value
 */
export function asString(value: unknown, fallback = ''): string {
  return isString(value) ? value : fallback
}

/**
 * Safely extract number from unknown value
 */
export function asNumber(value: unknown, fallback = 0): number {
  return isNumber(value) ? value : fallback
}

/**
 * Safely extract boolean from unknown value
 */
export function asBoolean(value: unknown, fallback = false): boolean {
  return isBoolean(value) ? value : fallback
}

/**
 * Safely extract object from unknown value
 */
export function asObject<T extends Record<string, unknown>>(
  value: unknown
): T | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as T)
    : null
}
