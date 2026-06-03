/**
 * Debug configuration for server network systems.
 *
 * Uses environment variable to enable/disable debug logging.
 * In production builds, the bundler can tree-shake or dead-code-eliminate
 * blocks guarded by these flags.
 */

/**
 * Enable verbose face direction logging.
 * - In development: controlled by HYPERIA_DEBUG_FACE_DIRECTION env var
 * - In production: always false (dead code elimination)
 */
export const DEBUG_FACE_DIRECTION =
  process.env.NODE_ENV !== "production" &&
  process.env.HYPERIA_DEBUG_FACE_DIRECTION === "true";

/**
 * Enable verbose pending gather logging.
 * - In development: controlled by HYPERIA_DEBUG_PENDING_GATHER env var
 * - In production: always false (dead code elimination)
 */
export const DEBUG_PENDING_GATHER =
  process.env.NODE_ENV !== "production" &&
  process.env.HYPERIA_DEBUG_PENDING_GATHER === "true";
