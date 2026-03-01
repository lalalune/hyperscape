/**
 * Interaction System Type Definitions
 *
 * Follows Interface Segregation Principle:
 * - ISessionReader: Read-only access (for validators)
 * - ISessionWriter: Mutation access (for session manager)
 * - ISessionManager: Full access (combines both)
 */

import type { SessionType } from "../constants/interaction";

// ============================================================================
// SESSION DATA
// ============================================================================

/**
 * Immutable session data structure
 */
export interface InteractionSession {
  readonly playerId: string;
  readonly sessionType: SessionType;
  readonly targetEntityId: string;
  readonly targetStoreId?: string;
  readonly openedAtTick: number;
}

// ============================================================================
// INTERFACE SEGREGATION: Reader vs Writer
// ============================================================================

/**
 * Read-only session access (ISP)
 * Used by validators that only need to CHECK session state.
 */
export interface ISessionReader {
  hasSession(playerId: string): boolean;
  getSession(playerId: string): InteractionSession | undefined;
}

/**
 * Session mutation access (ISP)
 * Used by components that need to CHANGE session state.
 */
export interface ISessionWriter {
  createSession(session: InteractionSession & { socketId: string }): void;
  destroySession(playerId: string, reason: SessionCloseReason): void;
}

/**
 * Full session manager interface
 */
export interface ISessionManager extends ISessionReader, ISessionWriter {
  handlePlayerDisconnect(playerId: string): void;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Result of transaction validation
 */
export interface ValidationResult {
  readonly allowed: boolean;
  readonly error?: string;
}

/**
 * Transaction validator interface (DIP)
 * Handlers depend on this abstraction, not concrete implementation.
 */
export interface ITransactionValidator {
  validate(playerId: string, requiredType: SessionType): ValidationResult;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limiter interface (DIP)
 */
export interface IRateLimiter {
  isAllowed(playerId: string): boolean;
  recordOperation(playerId: string): void;
  reset(playerId: string): void;
}

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

/**
 * Reason for closing an interaction session.
 * Used by server-authoritative session management.
 */
export type SessionCloseReason =
  | "user_action" // Player explicitly closed UI
  | "distance" // Player moved too far from target
  | "disconnect" // Player disconnected
  | "new_session" // Replaced by new session (opening another UI)
  | "target_gone" // Target entity no longer exists
  | "combat" // Player was attacked (OSRS-style: interrupts banking)
  | "timeout"; // Session exceeded maximum duration (zombie cleanup)
