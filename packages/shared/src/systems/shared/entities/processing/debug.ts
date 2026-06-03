/**
 * Debug configuration for the processing system.
 *
 * Uses environment variable to enable/disable debug logging.
 * In production builds, the bundler can tree-shake or dead-code-eliminate
 * blocks guarded by `if (DEBUG_PROCESSING)`.
 *
 * Usage:
 * ```typescript
 * import { DEBUG_PROCESSING } from './processing/debug';
 *
 * if (DEBUG_PROCESSING) {
 *   console.log('[Processing DEBUG] ...');
 * }
 * ```
 */

/**
 * Enable verbose processing system logging.
 * - In development: controlled by HYPERIA_DEBUG_PROCESSING env var
 * - In production: always false (dead code elimination)
 */
function getDebugProcessing(): boolean {
  try {
    // Check if we're in a Node.js environment with process defined
    if (typeof process !== "undefined" && process?.env) {
      return (
        process.env.NODE_ENV !== "production" &&
        process.env.HYPERIA_DEBUG_PROCESSING === "true"
      );
    }
  } catch {
    // process not available (browser environment)
  }
  return false;
}

export const DEBUG_PROCESSING = getDebugProcessing();
