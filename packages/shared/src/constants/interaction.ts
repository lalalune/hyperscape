/**
 * Interaction System Constants
 *
 * SINGLE SOURCE OF TRUTH for all interaction-related configuration.
 * Import from @hyperscape/shared in both client and server.
 */

import { BANKING_CONSTANTS } from "./BankingConstants";

// ============================================================================
// SESSION TYPES
// ============================================================================

export const SessionType = {
  STORE: "store",
  BANK: "bank",
  DIALOGUE: "dialogue",
} as const;

// eslint-disable-next-line no-redeclare
export type SessionType = (typeof SessionType)[keyof typeof SessionType];

// ============================================================================
// DISTANCE CONFIGURATION (OSRS-style Chebyshev)
// ============================================================================

/**
 * Maximum interaction distances per session type.
 * Uses Chebyshev distance (max of |dx|, |dz|) - OSRS standard.
 *
 * OSRS uses ~1-2 tiles to open, closes at ~2-3 tiles away.
 * We use 2 tiles for stores/banks (authentic) and 2 for dialogue.
 */
export const INTERACTION_DISTANCE: Readonly<Record<SessionType, number>> = {
  [SessionType.STORE]: 2,
  [SessionType.BANK]: 2,
  [SessionType.DIALOGUE]: 2,
};

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Milliseconds between allowed transactions.
 * 50ms = ~20 ops/sec. Sufficient for gameplay, blocks automation.
 */
export const TRANSACTION_RATE_LIMIT_MS = 50;

// ============================================================================
// SESSION VALIDATION TIMING
// ============================================================================

export const SESSION_CONFIG = {
  /** Ticks between distance validations (600ms ticks x 1 = 0.6s for responsive UI closing) */
  VALIDATION_INTERVAL_TICKS: 1,
  /** Grace period after opening before validation starts */
  GRACE_PERIOD_TICKS: 2,
} as const;

// ============================================================================
// INPUT VALIDATION LIMITS
// ============================================================================

export const INPUT_LIMITS = {
  MAX_ITEM_ID_LENGTH: 64,
  MAX_STORE_ID_LENGTH: 64,
  MAX_QUANTITY: 2_147_483_647, // Max signed 32-bit int
  MAX_INVENTORY_SLOTS: 28,
  /** Single source of truth: BankingConstants.ts */
  MAX_BANK_SLOTS: BANKING_CONSTANTS.MAX_BANK_SLOTS,
  /** Max age for request timestamps (5 seconds) - prevents replay attacks */
  MAX_REQUEST_AGE_MS: 5000,
  /** Max clock skew tolerance (1 second into future) */
  MAX_CLOCK_SKEW_MS: 1000,
} as const;
