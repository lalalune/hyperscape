/**
 * Handler Common Types
 *
 * Type-safe context objects for the handler pipeline.
 * Follows immutability pattern - contexts are readonly.
 *
 * Architecture:
 * 1. BaseHandlerContext - Created after common validation passes
 * 2. Extended contexts (StoreBuyContext, etc.) - Add operation-specific data
 * 3. ValidationResult - Discriminated union for type-safe validation handling
 */

import type { ServerSocket } from "../../../../shared/types";
import type { World, SessionType } from "@hyperscape/shared";
import type pg from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../../../database/schema";

// ============================================================================
// DATABASE
// ============================================================================

/**
 * Database connection tuple used throughout handlers.
 * Both drizzle (ORM) and pool (raw queries) are available.
 */
export interface DatabaseConnection {
  readonly drizzle: NodePgDatabase<typeof schema>;
  readonly pool: pg.Pool;
}

// ============================================================================
// HANDLER CONTEXT
// ============================================================================

/**
 * Base context created after common validation passes.
 * All transaction handlers receive this minimum context.
 *
 * Handlers extend this with operation-specific data:
 * - StoreBuyContext adds: store, storeItem, itemData, quantity, totalCost
 * - BankDepositContext adds: itemId, quantity
 */
export interface BaseHandlerContext {
  readonly playerId: string;
  readonly socket: ServerSocket;
  readonly world: World;
  readonly db: DatabaseConnection;
  readonly sessionType: SessionType;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Result of a validation step.
 * Discriminated union ensures type-safe handling.
 *
 * Usage:
 * ```typescript
 * const result = validateSomething();
 * if (!result.success) {
 *   sendError(result.error);
 *   return;
 * }
 * // TypeScript knows result.context exists here
 * useContext(result.context);
 * ```
 */
export type ValidationResult<T> =
  | { readonly success: true; readonly context: T }
  | { readonly success: false; readonly error: string };

/**
 * Type guard for successful validation.
 * Useful when you need an explicit check.
 */
export function isValidationSuccess<T>(
  result: ValidationResult<T>,
): result is { success: true; context: T } {
  return result.success === true;
}

// ============================================================================
// TRANSACTION SYNC
// ============================================================================

/**
 * Data needed to sync in-memory InventorySystem after transaction.
 * Populated during transaction execution, consumed by sync emitter.
 *
 * CRITICAL: All inventory-modifying transactions must populate this
 * to prevent cache/database desync bugs.
 */
export interface TransactionSyncData {
  readonly addedSlots?: ReadonlyArray<{
    readonly slot: number;
    readonly quantity: number;
    readonly itemId: string;
  }>;
  readonly removedSlots?: ReadonlyArray<{
    readonly slot: number;
    readonly quantity: number;
    readonly itemId: string;
  }>;
  readonly newCoinBalance?: number;
}
