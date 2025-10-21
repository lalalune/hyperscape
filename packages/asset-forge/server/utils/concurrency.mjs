/**
 * Concurrency Control Utilities
 *
 * Provides promise-based concurrency control for parallel operations.
 * Used to limit concurrent API requests and prevent rate limiting.
 *
 * Based on async-pool pattern: https://github.com/rxaviers/async-pool
 */

/**
 * Execute promises with concurrency limit
 *
 * @param {number} poolLimit - Maximum number of concurrent operations
 * @param {Array} array - Array of items to process
 * @param {Function} iteratorFn - Async function to execute for each item (item, index) => Promise
 * @returns {Promise<Array>} Array of results (fulfilled and rejected)
 *
 * @example
 * const results = await asyncPool(5, items, async (item, index) => {
 *   return await processItem(item)
 * })
 *
 * results.forEach((result, i) => {
 *   if (result.status === 'fulfilled') {
 *     console.log('Success:', result.value)
 *   } else {
 *     console.error('Failed:', result.reason)
 *   }
 * })
 */
export async function asyncPool(poolLimit, array, iteratorFn) {
  if (!Number.isInteger(poolLimit) || poolLimit < 1) {
    throw new Error('poolLimit must be a positive integer')
  }

  if (!Array.isArray(array)) {
    throw new Error('array must be an Array')
  }

  if (typeof iteratorFn !== 'function') {
    throw new Error('iteratorFn must be a function')
  }

  const results = []
  const executing = []

  for (const [index, item] of array.entries()) {
    // Create promise for this item
    const promise = Promise.resolve().then(() => iteratorFn(item, index))

    // Store promise in results array (maintains order)
    results.push(promise)

    // If we're at the concurrency limit, wait for one to finish
    if (poolLimit <= array.length) {
      // Add to executing pool
      const executingPromise = promise.then(() => {
        // Remove from executing pool when done
        executing.splice(executing.indexOf(executingPromise), 1)
      })
      executing.push(executingPromise)

      // If we've hit the limit, wait for at least one to complete
      if (executing.length >= poolLimit) {
        await Promise.race(executing)
      }
    }
  }

  // Wait for all promises to settle (don't throw on individual failures)
  return Promise.allSettled(results)
}

/**
 * Execute promises in batches with delay between batches
 * Useful for APIs with rate limits that reset periodically
 *
 * @param {number} batchSize - Number of operations per batch
 * @param {number} delayMs - Delay between batches in milliseconds
 * @param {Array} array - Array of items to process
 * @param {Function} iteratorFn - Async function to execute for each item
 * @returns {Promise<Array>} Array of results (fulfilled and rejected)
 *
 * @example
 * // Process 10 items at a time with 1 second delay between batches
 * const results = await asyncBatch(10, 1000, items, async (item) => {
 *   return await processItem(item)
 * })
 */
export async function asyncBatch(batchSize, delayMs, array, iteratorFn) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('batchSize must be a positive integer')
  }

  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error('delayMs must be a non-negative integer')
  }

  const results = []

  // Process in batches
  for (let i = 0; i < array.length; i += batchSize) {
    const batch = array.slice(i, i + batchSize)

    // Process batch in parallel
    const batchResults = await asyncPool(batchSize, batch, async (item, localIndex) => {
      const globalIndex = i + localIndex
      return iteratorFn(item, globalIndex)
    })

    results.push(...batchResults)

    // Delay before next batch (unless this was the last batch)
    if (i + batchSize < array.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return results
}

/**
 * Execute promises with timeout
 *
 * @param {Promise} promise - Promise to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} [errorMessage] - Custom error message for timeout
 * @returns {Promise} Promise that rejects if timeout is exceeded
 *
 * @example
 * try {
 *   const result = await withTimeout(fetchData(), 5000, 'Fetch timed out')
 * } catch (error) {
 *   console.error('Timeout or error:', error.message)
 * }
 */
export async function withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
  let timeoutHandle

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMessage))
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    clearTimeout(timeoutHandle)
    return result
  } catch (error) {
    clearTimeout(timeoutHandle)
    throw error
  }
}

/**
 * Retry a function with exponential backoff
 *
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} [options.maxAttempts=3] - Maximum number of attempts
 * @param {number} [options.baseDelayMs=1000] - Base delay in milliseconds
 * @param {number} [options.maxDelayMs=10000] - Maximum delay in milliseconds
 * @param {Function} [options.shouldRetry] - Function to determine if error is retryable
 * @param {Function} [options.onRetry] - Callback called before each retry (attempt, delay, error)
 * @returns {Promise} Result of the function
 *
 * @example
 * const result = await retryWithBackoff(
 *   async () => await apiCall(),
 *   {
 *     maxAttempts: 3,
 *     baseDelayMs: 1000,
 *     shouldRetry: (error) => error.code === 429,
 *     onRetry: (attempt, delay, error) => console.log(`Retrying after ${delay}ms`)
 *   }
 * )
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    shouldRetry = () => true,
    onRetry = null
  } = options

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer')
  }

  if (!Number.isInteger(baseDelayMs) || baseDelayMs < 0) {
    throw new Error('baseDelayMs must be a non-negative integer')
  }

  if (!Number.isInteger(maxDelayMs) || maxDelayMs < baseDelayMs) {
    throw new Error('maxDelayMs must be >= baseDelayMs')
  }

  let lastError = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const isLastAttempt = attempt === maxAttempts - 1
      const shouldRetryError = shouldRetry(error)

      if (isLastAttempt || !shouldRetryError) {
        throw error
      }

      // Exponential backoff: 1s, 2s, 4s, 8s (capped at maxDelayMs)
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)

      // Notify caller about retry (use callback instead of console.log)
      if (onRetry) {
        onRetry(attempt + 1, delay, error)
      }

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // Should never reach here, but handle gracefully
  throw lastError || new Error('Retry failed with unknown error')
}
