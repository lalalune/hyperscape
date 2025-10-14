/**
 * Handler-specific types for action handlers and callbacks
 */

import type { ActionResult } from '@elizaos/core'

/**
 * Action context with result tracking
 */
export interface ActionContext {
  getPreviousResult?: (actionName: string) => ActionResult | undefined
  playerId?: string
  worldId?: string
  entityId?: string
  timestamp?: number
  metadata?: Record<string, string | number | boolean>
}

/**
 * Options passed to action handlers
 */
export interface ActionHandlerOptions {
  [key: string]: string | number | boolean | ActionContext | undefined
  context?: ActionContext
}

/**
 * Extended callback context for actions
 */
export interface ActionCallbackContext {
  playerId?: string
  worldId?: string
  timestamp?: number
  metadata?: Record<string, string | number | boolean>
}
