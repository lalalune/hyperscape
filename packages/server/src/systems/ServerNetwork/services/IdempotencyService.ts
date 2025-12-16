/**
 * Idempotency Service
 *
 * Prevents duplicate request processing within a sliding time window.
 * Complements rate limiting by ensuring the same exact request
 * is not processed twice.
 *
 * Features:
 * - Hash-based request deduplication
 * - Configurable TTL window (default: 5 seconds)
 * - Automatic stale entry cleanup
 * - Memory-efficient with periodic pruning
 *
 * @example
 * const key = idempotencyService.generateKey(playerId, 'pickup', { entityId });
 * if (!idempotencyService.checkAndMark(key)) {
 *   return; // Duplicate request, skip
 * }
 * // Process request...
 */

export interface IdempotencyConfig {
  /** Time-to-live in ms for processed request records (default: 5000) */
  ttlMs?: number;
  /** Cleanup interval in ms (default: 10000) */
  cleanupInterval?: number;
}

/**
 * Idempotency Service for preventing duplicate request processing.
 * Uses a sliding window approach to track recently processed requests.
 */
export class IdempotencyService {
  private processedRequests = new Map<string, number>(); // hash -> timestamp
  private readonly ttlMs: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: IdempotencyConfig = {}) {
    const { ttlMs = 5000, cleanupInterval = 10000 } = config;
    this.ttlMs = ttlMs;

    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanup(Date.now());
    }, cleanupInterval);

    // Prevent cleanup timer from keeping process alive
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Generate an idempotency key from request data.
   * Uses a simple hash of the combined request parameters.
   *
   * @param playerId - Player making the request
   * @param action - Action type (e.g., 'pickup', 'drop', 'equip')
   * @param data - Action-specific data to include in key
   * @returns Hash string suitable for deduplication
   *
   * @example
   * const key = service.generateKey('player-1', 'pickup', { entityId: 'item-123' });
   */
  generateKey(playerId: string, action: string, data: unknown): string {
    // Optimized: avoid JSON.stringify for simple objects
    // Most calls pass { entityId } or { itemId, slot } - simple flat objects
    const dataStr = this.serializeData(data);
    return this.hashString(`${playerId}|${action}|${dataStr}`);
  }

  /**
   * Efficiently serialize data for key generation.
   * Avoids JSON.stringify overhead for simple objects.
   */
  private serializeData(data: unknown): string {
    if (data === null || data === undefined) {
      return "";
    }
    if (typeof data === "string") {
      return data;
    }
    if (typeof data === "number" || typeof data === "boolean") {
      return String(data);
    }
    if (typeof data === "object") {
      // For simple objects, concatenate key=value pairs sorted by key
      // This is faster than JSON.stringify for typical 1-2 property objects
      const obj = data as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const parts: string[] = [];
      for (const key of keys) {
        const value = obj[key];
        // Handle nested values - only stringify if truly complex
        if (value !== null && typeof value === "object") {
          parts.push(`${key}=${JSON.stringify(value)}`);
        } else {
          parts.push(`${key}=${String(value)}`);
        }
      }
      return parts.join("&");
    }
    // Fallback for other types
    return String(data);
  }

  /**
   * Check if a request was already processed, and mark it if new.
   *
   * @param key - Idempotency key from generateKey()
   * @returns true if this is a NEW request (should process)
   * @returns false if this is a DUPLICATE (should skip)
   *
   * @example
   * if (!service.checkAndMark(key)) {
   *   return; // Duplicate, skip processing
   * }
   * // Process the new request...
   */
  checkAndMark(key: string): boolean {
    const now = Date.now();

    // Check if already processed (and not expired)
    const existingTimestamp = this.processedRequests.get(key);
    if (existingTimestamp !== undefined) {
      if (now - existingTimestamp < this.ttlMs) {
        return false; // Duplicate request within TTL window
      }
      // Entry expired, will be replaced below
    }

    // Mark as processed
    this.processedRequests.set(key, now);
    return true; // New request
  }

  /**
   * Check if a request was already processed (without marking).
   * Useful for read-only checks.
   *
   * @param key - Idempotency key from generateKey()
   * @returns true if request was already processed within TTL
   */
  wasProcessed(key: string): boolean {
    const now = Date.now();
    const existingTimestamp = this.processedRequests.get(key);
    if (existingTimestamp === undefined) {
      return false;
    }
    return now - existingTimestamp < this.ttlMs;
  }

  /**
   * Placeholder for player-specific cleanup.
   * Currently a no-op since keys are hashed and can't be traced back to players.
   * TTL-based cleanup handles stale entries automatically (every 10s).
   */
  clearPlayer(_playerId: string): void {
    // No-op: TTL handles cleanup
  }

  /**
   * Clean up expired entries
   */
  private cleanup(now: number): void {
    for (const [key, timestamp] of this.processedRequests) {
      if (now - timestamp > this.ttlMs) {
        this.processedRequests.delete(key);
      }
    }
  }

  /**
   * Simple string hash for idempotency keys.
   * Not cryptographically secure, but sufficient for deduplication.
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get number of tracked requests (for monitoring)
   */
  get size(): number {
    return this.processedRequests.size;
  }

  /**
   * Clean up resources. Call on server shutdown.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.processedRequests.clear();
  }
}

// Singleton instance for shared use across handlers
let instance: IdempotencyService | null = null;

/**
 * Get the shared IdempotencyService instance.
 * Creates one if it doesn't exist.
 */
export function getIdempotencyService(): IdempotencyService {
  if (!instance) {
    instance = new IdempotencyService();
  }
  return instance;
}

/**
 * Destroy the shared IdempotencyService instance.
 * Call this during server shutdown.
 */
export function destroyIdempotencyService(): void {
  instance?.destroy();
  instance = null;
}
