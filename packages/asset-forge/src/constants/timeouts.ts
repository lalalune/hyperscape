/**
 * Timeout values for various operations (in milliseconds)
 */

/**
 * Default timeout for API requests (30 seconds)
 */
export const DEFAULT_API_TIMEOUT = 30000

/**
 * Timeout for long-running API operations like asset generation (5 minutes)
 */
export const LONG_API_TIMEOUT = 300000

/**
 * Base delay for retry attempts (1 second)
 * Actual delay will be exponentially increased: baseDelay * 2^(attempt-1)
 */
export const BASE_RETRY_DELAY = 1000

/**
 * Timeout for WebSocket connections (10 seconds)
 */
export const WEBSOCKET_TIMEOUT = 10000

/**
 * Debounce delay for search input (300ms)
 */
export const SEARCH_DEBOUNCE_DELAY = 300

/**
 * Debounce delay for auto-save (1 second)
 */
export const AUTOSAVE_DEBOUNCE_DELAY = 1000

/**
 * Rate limit window (15 minutes)
 */
export const RATE_LIMIT_WINDOW = 900000

/**
 * Graceful shutdown timeout (5 seconds)
 */
export const SHUTDOWN_TIMEOUT = 5000
