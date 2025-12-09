/**
 * Rate Limiter Utility
 *
 * Provides configurable rate limiting for network handlers.
 * Uses a sliding window approach with automatic cleanup.
 *
 * Features:
 * - Per-player rate limiting
 * - Configurable max requests per second
 * - Automatic stale entry cleanup
 * - Memory-efficient with periodic pruning
 *
 * @example
 * const limiter = createRateLimiter({ maxPerSecond: 10, name: 'inventory-move' });
 * if (!limiter.check(playerId)) {
 *   return { error: 'RATE_LIMITED' };
 * }
 */

export interface RateLimiterConfig {
  /** Maximum requests allowed per second */
  maxPerSecond: number;
  /** Name for logging purposes */
  name: string;
  /** Cleanup interval in ms (default: 60000) */
  cleanupInterval?: number;
  /** How long to keep stale entries in ms (default: 60000) */
  staleThreshold?: number;
}

export interface RateLimiterEntry {
  count: number;
  resetTime: number;
}

export interface RateLimiter {
  /**
   * Check if request is allowed and update counter
   * @param playerId - Player making the request
   * @returns true if allowed, false if rate limited
   */
  check(playerId: string): boolean;

  /**
   * Get current count for a player (for debugging/monitoring)
   * @param playerId - Player to check
   * @returns Current request count in window, or 0 if no entry
   */
  getCount(playerId: string): number;

  /**
   * Reset rate limit for a player (e.g., on disconnect)
   * @param playerId - Player to reset
   */
  reset(playerId: string): void;

  /**
   * Clean up all entries and stop cleanup interval
   * Call this when shutting down the server
   */
  destroy(): void;

  /** Number of tracked players (for monitoring) */
  readonly size: number;

  /** Rate limiter name */
  readonly name: string;
}

/**
 * Create a new rate limiter instance
 *
 * @param config - Rate limiter configuration
 * @returns RateLimiter instance
 *
 * @example
 * // Create limiter for inventory moves (10/sec)
 * const moveLimiter = createRateLimiter({
 *   maxPerSecond: 10,
 *   name: 'inventory-move'
 * });
 *
 * // In handler:
 * if (!moveLimiter.check(playerId)) {
 *   return; // Rate limited
 * }
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const {
    maxPerSecond,
    name,
    cleanupInterval = 60000,
    staleThreshold = 60000,
  } = config;

  const entries = new Map<string, RateLimiterEntry>();

  // Periodic cleanup of stale entries to prevent memory leaks
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    const cutoff = now - staleThreshold;

    for (const [playerId, entry] of entries.entries()) {
      if (entry.resetTime < cutoff) {
        entries.delete(playerId);
      }
    }
  }, cleanupInterval);

  // Prevent cleanup timer from keeping process alive
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return {
    check(playerId: string): boolean {
      const now = Date.now();
      const entry = entries.get(playerId);

      if (entry) {
        if (now < entry.resetTime) {
          // Within current window
          if (entry.count >= maxPerSecond) {
            return false; // Rate limited
          }
          entry.count++;
        } else {
          // Window expired, reset
          entry.count = 1;
          entry.resetTime = now + 1000;
        }
      } else {
        // New entry
        entries.set(playerId, {
          count: 1,
          resetTime: now + 1000,
        });
      }

      return true;
    },

    getCount(playerId: string): number {
      const entry = entries.get(playerId);
      if (!entry) return 0;

      const now = Date.now();
      if (now >= entry.resetTime) return 0; // Window expired

      return entry.count;
    },

    reset(playerId: string): void {
      entries.delete(playerId);
    },

    destroy(): void {
      clearInterval(cleanupTimer);
      entries.clear();
    },

    get size(): number {
      return entries.size;
    },

    get name(): string {
      return name;
    },
  };
}

// Pre-configured rate limiters for common operations
// These are singletons to share state across handler calls

let pickupLimiter: RateLimiter | null = null;
let moveLimiter: RateLimiter | null = null;
let dropLimiter: RateLimiter | null = null;
let equipLimiter: RateLimiter | null = null;

/**
 * Get the pickup rate limiter (5/sec)
 * Limits item pickup requests to prevent spam-clicking ground items
 */
export function getPickupRateLimiter(): RateLimiter {
  if (!pickupLimiter) {
    pickupLimiter = createRateLimiter({
      maxPerSecond: 5,
      name: "inventory-pickup",
    });
  }
  return pickupLimiter;
}

/**
 * Get the move rate limiter (10/sec)
 * Limits inventory slot swap requests
 */
export function getMoveRateLimiter(): RateLimiter {
  if (!moveLimiter) {
    moveLimiter = createRateLimiter({
      maxPerSecond: 10,
      name: "inventory-move",
    });
  }
  return moveLimiter;
}

/**
 * Get the drop rate limiter (5/sec)
 * Limits item drop requests
 */
export function getDropRateLimiter(): RateLimiter {
  if (!dropLimiter) {
    dropLimiter = createRateLimiter({
      maxPerSecond: 5,
      name: "inventory-drop",
    });
  }
  return dropLimiter;
}

/**
 * Get the equip rate limiter (5/sec)
 * Limits equip/unequip requests
 */
export function getEquipRateLimiter(): RateLimiter {
  if (!equipLimiter) {
    equipLimiter = createRateLimiter({
      maxPerSecond: 5,
      name: "inventory-equip",
    });
  }
  return equipLimiter;
}

/**
 * Destroy all singleton rate limiters
 * Call this during server shutdown
 */
export function destroyAllRateLimiters(): void {
  pickupLimiter?.destroy();
  moveLimiter?.destroy();
  dropLimiter?.destroy();
  equipLimiter?.destroy();

  pickupLimiter = null;
  moveLimiter = null;
  dropLimiter = null;
  equipLimiter = null;
}
