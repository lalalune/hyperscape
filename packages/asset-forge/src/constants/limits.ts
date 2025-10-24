/**
 * Application-wide limits and thresholds
 */

/**
 * Maximum number of retry attempts for failed API requests
 */
export const MAX_RETRY_ATTEMPTS = 3

/**
 * Maximum file upload size in bytes (100MB)
 */
export const MAX_FILE_SIZE = 100 * 1024 * 1024

/**
 * Maximum number of concurrent API requests
 */
export const MAX_CONCURRENT_REQUESTS = 6

/**
 * Maximum number of items to display per page
 */
export const MAX_ITEMS_PER_PAGE = 50

/**
 * Maximum number of requests per rate limit window
 */
export const RATE_LIMIT_MAX_REQUESTS = 100

/**
 * Maximum tokens for medium-length responses
 */
export const MAX_TOKENS_MEDIUM = 2000

/**
 * Maximum tokens for short responses
 */
export const MAX_TOKENS_SHORT = 500
