/**
 * Common Handler Utilities
 *
 * Shared infrastructure for store, bank, and transaction handlers.
 * Eliminates code duplication and ensures consistent security patterns.
 *
 * Usage:
 * ```typescript
 * import {
 *   validateTransactionRequest,
 *   executeSecureTransaction,
 *   emitInventorySyncEvents,
 *   sendErrorToast,
 *   type BaseHandlerContext,
 * } from "./common";
 * ```
 *
 * Architecture:
 * 1. validateTransactionRequest() - Pre-transaction validation chain
 * 2. executeSecureTransaction() - Transaction with retry/error handling
 * 3. emitInventorySyncEvents() - Post-transaction in-memory sync
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  DatabaseConnection,
  BaseHandlerContext,
  ValidationResult,
  TransactionSyncData,
} from "./types";

export { isValidationSuccess } from "./types";

// ============================================================================
// HELPERS
// ============================================================================

export type { EntityPosition } from "./helpers";

export {
  getPlayerId,
  sendToSocket,
  sendErrorToast,
  sendSuccessToast,
  getDatabase,
  getSessionManager,
  getEntityPosition,
} from "./helpers";

// ============================================================================
// VALIDATION
// ============================================================================

export { validateTransactionRequest } from "./validation";

// ============================================================================
// TRANSACTION
// ============================================================================

export type { TransactionConfig, DrizzleTransaction } from "./transaction";

export {
  executeSecureTransaction,
  emitInventorySyncEvents,
  executeInventoryTransaction,
} from "./transaction";
