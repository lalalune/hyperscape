/**
 * Client-side Rate Limiter
 *
 * Provides rate limiting for client-side actions to prevent spam and abuse.
 * Used for chat messages, action requests, and other user-triggered events.
 *
 * @packageDocumentation
 */

/**
 * Rate limiter configuration
 */
interface RateLimiterConfig {
  /** Maximum number of requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional: Maximum burst size (defaults to maxRequests) */
  maxBurst?: number;
}

/**
 * Rate limit check result
 */
interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Time until the window resets (ms) */
  resetIn: number;
  /** Time until next request is allowed (ms) if rate limited */
  retryAfter: number;
}

/**
 * Client-side rate limiter using sliding window algorithm
 *
 * @example
 * ```typescript
 * const chatLimiter = new RateLimiter({ maxRequests: 5, windowMs: 10000 });
 *
 * function sendChatMessage(message: string) {
 *   const result = chatLimiter.check();
 *   if (!result.allowed) {
 *     console.log(`Rate limited. Try again in ${result.retryAfter}ms`);
 *     return;
 *   }
 *   chatLimiter.record();
 *   // Send message...
 * }
 * ```
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxBurst: number;

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.maxBurst = config.maxBurst ?? config.maxRequests;
  }

  /**
   * Cleans up old timestamps outside the current window
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > windowStart);
  }

  /**
   * Checks if a request is allowed without recording it
   */
  check(): RateLimitResult {
    this.cleanup();
    const now = Date.now();

    const allowed = this.timestamps.length < this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - this.timestamps.length);

    // Calculate reset time (when oldest timestamp expires)
    const oldestTimestamp = this.timestamps[0];
    const resetIn = oldestTimestamp
      ? Math.max(0, oldestTimestamp + this.windowMs - now)
      : 0;

    // Calculate retry after (when the oldest request will be outside the window)
    const retryAfter = allowed ? 0 : resetIn;

    return {
      allowed,
      remaining,
      resetIn,
      retryAfter,
    };
  }

  /**
   * Checks if a request can proceed (for simple yes/no checks)
   */
  canProceed(): boolean {
    return this.check().allowed;
  }

  /**
   * Records a request timestamp
   */
  record(): void {
    this.cleanup();
    this.timestamps.push(Date.now());
  }

  /**
   * Attempts to proceed with a request, returning true if allowed
   * This is a convenience method that combines check() and record()
   */
  tryProceed(): boolean {
    if (this.canProceed()) {
      this.record();
      return true;
    }
    return false;
  }

  /**
   * Resets the rate limiter
   */
  reset(): void {
    this.timestamps = [];
  }

  /**
   * Gets the number of requests made in the current window
   */
  getRequestCount(): number {
    this.cleanup();
    return this.timestamps.length;
  }

  /**
   * Gets the remaining requests allowed in the current window
   */
  getRemainingRequests(): number {
    this.cleanup();
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }

  /**
   * Waits until a request can proceed
   * Useful for queuing requests
   */
  async waitForSlot(): Promise<void> {
    const result = this.check();
    if (result.allowed) return;

    await new Promise<void>((resolve) => {
      setTimeout(resolve, result.retryAfter);
    });

    // Recursively check again in case of race conditions
    await this.waitForSlot();
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  /** Chat message rate limiter: 5 messages per 10 seconds */
  chat: new RateLimiter({ maxRequests: 5, windowMs: 10000 }),

  /** Action request rate limiter: 30 actions per second */
  actions: new RateLimiter({ maxRequests: 30, windowMs: 1000 }),

  /** API request rate limiter: 60 requests per minute */
  api: new RateLimiter({ maxRequests: 60, windowMs: 60000 }),

  /** Trade request rate limiter: 10 trades per minute */
  trade: new RateLimiter({ maxRequests: 10, windowMs: 60000 }),

  /** Login attempt rate limiter: 5 attempts per 5 minutes */
  login: new RateLimiter({ maxRequests: 5, windowMs: 300000 }),
};

/**
 * Decorator for rate-limited functions
 *
 * @example
 * ```typescript
 * const limitedFetch = withRateLimit(
 *   fetchData,
 *   new RateLimiter({ maxRequests: 10, windowMs: 1000 })
 * );
 * ```
 */
export function withRateLimit<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limiter: RateLimiter,
  options: {
    onRateLimited?: (result: RateLimitResult) => void;
    throwOnLimit?: boolean;
  } = {},
): T {
  return ((...args: unknown[]) => {
    const result = limiter.check();

    if (!result.allowed) {
      options.onRateLimited?.(result);

      if (options.throwOnLimit) {
        throw new RateLimitError(result);
      }

      return undefined;
    }

    limiter.record();
    return fn(...args);
  }) as T;
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends Error {
  readonly retryAfter: number;
  readonly remaining: number;

  constructor(result: RateLimitResult) {
    super(`Rate limit exceeded. Retry after ${result.retryAfter}ms`);
    this.name = "RateLimitError";
    this.retryAfter = result.retryAfter;
    this.remaining = result.remaining;
  }
}
