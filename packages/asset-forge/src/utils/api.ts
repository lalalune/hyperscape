import { createLogger } from './logger.ts'
import { requestDeduplicator } from './request-deduplication.ts'

import { privyAuthManager } from '../auth/PrivyAuthManager.ts'
import { API_URL } from '../config/api.ts'
import { DEFAULT_API_TIMEOUT, BASE_RETRY_DELAY } from '../constants/timeouts.ts'
import { MAX_RETRY_ATTEMPTS } from '../constants/limits.ts'

const logger = createLogger('API')

export interface RequestOptions extends RequestInit {
  timeoutMs?: number
  /**
   * Enable request deduplication (default: true for GET requests, false for others)
   * When enabled, concurrent identical requests will share the same promise
   */
  deduplicate?: boolean
}

export async function apiFetch(input: string, init: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_API_TIMEOUT, signal, deduplicate, ...rest } = init

  // Create absolute URL
  const url = input.startsWith('http') ? input : `${API_URL}${input}`

  // Determine if deduplication should be enabled
  // Default: true for GET requests, false for others
  const method = (rest.method || 'GET').toUpperCase()
  const shouldDeduplicate = deduplicate !== undefined
    ? deduplicate
    : method === 'GET'

  // Core fetch logic
  const executeFetch = async (): Promise<Response> => {
    // Setup timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(new DOMException('Request timeout', 'AbortError')),
      timeoutMs
    )

    try {
      // Log request in development
      if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
        logger.debug(`${method} ${url}`)
      }

      // Get authentication token and add to headers
      const token = privyAuthManager.getToken()
      const headers = new Headers(rest.headers || {})

      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }

      // Make request
      const response = await fetch(url, {
        ...rest,
        headers,
        signal: signal ?? controller.signal
      })

      // Log response
      if (!response.ok) {
        const errorContext = {
          url,
          method,
          status: response.status
        }
        logger.error(`API request failed: ${response.status} ${response.statusText}`, errorContext)

        // Try to parse error message from response
        try {
          const errorData = await response.clone().json()
          if (errorData.error || errorData.message) {
            logger.error('API error details:', errorData)
          }
        } catch {
          // Response not JSON, ignore
        }
      } else if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
        logger.debug(`✓ ${response.status} ${method} ${url}`)
      }

      return response

    } catch (error) {
      // Handle different error types
      if (error instanceof DOMException && error.name === 'AbortError') {
        const timeoutContext = {
          url,
          method,
          timeout: timeoutMs
        }
        logger.error('API request timed out', timeoutContext)
        throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`)
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkContext = {
          url,
          method,
          error: error.message
        }
        logger.error('Network error - fetch failed', networkContext)
        throw new Error(`Network error: Unable to connect to ${url}`)
      }

      // Log and re-throw other errors
      logger.error('API request error', error instanceof Error ? error : new Error(String(error)))
      throw error

    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Apply deduplication if enabled
  if (shouldDeduplicate) {
    const cacheKey = requestDeduplicator.generateKey(url, method, rest.body)
    return requestDeduplicator.deduplicate(cacheKey, executeFetch)
  }

  return executeFetch()
}

// Helper to extract error messages from API responses
export async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json()
    return data?.error ?? data?.message ?? `Request failed with status ${response.status}`
  } catch {
    return `Request failed with status ${response.status}`
  }
}

export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  shouldRetry?: (error: Error) => boolean
}

export async function apiFetchWithRetry(
  input: string,
  init: RequestOptions = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxAttempts = MAX_RETRY_ATTEMPTS,
    baseDelayMs = BASE_RETRY_DELAY,
    shouldRetry = (error) =>
      error.message.includes('Network error') ||
      error.message.includes('timed out')
  } = retryOptions

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await apiFetch(input, init)
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1)
      const retryContext = {
        url: input,
        error: lastError.message
      }
      logger.warn(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`, retryContext)

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Get request deduplication statistics.
 * Useful for debugging and monitoring deduplication effectiveness.
 *
 * @example
 * ```typescript
 * const stats = getDeduplicationStats()
 * console.log(`Hit rate: ${stats.hitRate}%`)
 * console.log(`Total requests: ${stats.totalRequests}`)
 * console.log(`Deduplicated: ${stats.deduplicated}`)
 * ```
 */
export function getDeduplicationStats() {
  return requestDeduplicator.getStats()
}

/**
 * Reset deduplication statistics counters.
 * Useful for testing or monitoring specific time periods.
 */
export function resetDeduplicationStats() {
  requestDeduplicator.resetStats()
}

/**
 * Get count of currently pending requests.
 * Useful for monitoring concurrent request load.
 */
export function getPendingRequestCount() {
  return requestDeduplicator.getPendingCount()
}

// Export for console debugging in development
if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  (window as { deduplicationStats?: typeof getDeduplicationStats }).deduplicationStats = getDeduplicationStats;
  (window as { resetDeduplicationStats?: typeof resetDeduplicationStats }).resetDeduplicationStats = resetDeduplicationStats;
  (window as { pendingRequestCount?: typeof getPendingRequestCount }).pendingRequestCount = getPendingRequestCount
} 