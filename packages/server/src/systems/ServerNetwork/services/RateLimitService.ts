/**
 * Rate Limit Service
 *
 * SRP: Only handles rate limiting logic.
 * DIP: Implements IRateLimiter interface from shared.
 *
 * Prevents rapid-fire exploit attempts while allowing normal gameplay.
 * Uses 50ms rate limit (~20 ops/sec) which is sufficient for human clicking.
 */

import {
  TRANSACTION_RATE_LIMIT_MS,
  type IRateLimiter,
} from "@hyperscape/shared";

export class RateLimitService implements IRateLimiter {
  private lastOperation = new Map<string, number>();

  constructor(private readonly limitMs = TRANSACTION_RATE_LIMIT_MS) {}

  isAllowed(playerId: string): boolean {
    const now = Date.now();
    const last = this.lastOperation.get(playerId) ?? 0;
    return now - last >= this.limitMs;
  }

  recordOperation(playerId: string): void {
    this.lastOperation.set(playerId, Date.now());

    // Cleanup old entries periodically (every 1000 entries)
    if (this.lastOperation.size > 1000) {
      const cutoff = Date.now() - 60000; // Remove entries older than 1 minute
      for (const [id, time] of this.lastOperation.entries()) {
        if (time < cutoff) {
          this.lastOperation.delete(id);
        }
      }
    }
  }

  reset(playerId: string): void {
    this.lastOperation.delete(playerId);
  }

  /**
   * Check and record in one call (convenience method)
   * Returns true if operation is allowed, false if rate limited
   */
  tryOperation(playerId: string): boolean {
    if (!this.isAllowed(playerId)) {
      return false;
    }
    this.recordOperation(playerId);
    return true;
  }
}
