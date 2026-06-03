/**
 * Debug configuration for the gathering system.
 *
 * Uses environment variable to enable/disable debug logging.
 * In production builds, the bundler can tree-shake or dead-code-eliminate
 * blocks guarded by `if (DEBUG_GATHERING)`.
 *
 * Usage:
 * ```typescript
 * import { DEBUG_GATHERING } from './gathering/debug';
 *
 * if (DEBUG_GATHERING) {
 *   console.log('[Gathering DEBUG] ...');
 * }
 * ```
 */

/**
 * Enable verbose gathering system logging.
 * - In development: controlled by HYPERIA_DEBUG_GATHERING env var
 * - In production: always false (dead code elimination)
 */
function getDebugGathering(): boolean {
  try {
    // Check if we're in a Node.js environment with process defined
    if (typeof process !== "undefined" && process?.env) {
      return (
        process.env.NODE_ENV !== "production" &&
        process.env.HYPERIA_DEBUG_GATHERING === "true"
      );
    }
  } catch {
    // process not available (browser environment)
  }
  return false;
}

export const DEBUG_GATHERING = getDebugGathering();
