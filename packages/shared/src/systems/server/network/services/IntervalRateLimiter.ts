/**
 * Interval Rate Limiter
 *
 * Enforces a minimum time interval between operations.
 * Use for transaction-like operations (bank, store) where you want
 * to prevent rapid consecutive actions.
 *
 * Algorithm: Each operation resets a timer. Next operation must wait
 * until timer expires (default 50ms = ~20 ops/sec max).
 *
 * For burst-tolerant rate limiting (N ops/sec), use SlidingWindowRateLimiter.
 *
 * SRP: Only handles rate limiting logic.
 * DIP: Implements IRateLimiter interface from shared.
 */

import { getTransactionRateLimitMs } from "../../../../data/live/interaction-live";
import type { IRateLimiter } from "../../../../types/interaction";

/** @deprecated Use IntervalRateLimiter - kept for backwards compatibility */
export { IntervalRateLimiter as RateLimitService };

export class IntervalRateLimiter implements IRateLimiter {
  private lastOperation = new Map<string, number>();

  /**
   * Optional explicit override. When `undefined`, the limiter reads the
   * live `interaction.transactionRateLimitMs` through the provider on every
   * `isAllowed()` check so PIE manifest edits apply without restart.
   */
  constructor(private readonly limitMsOverride?: number) {}

  private get limitMs(): number {
    return this.limitMsOverride ?? getTransactionRateLimitMs();
  }

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

  /**
   * Phase 4.1 — snapshot the limiter's per-player last-operation
   * map for persistence across server restarts. Returns a plain
   * serializable object so the caller can JSON-stringify it to
   * disk / Redis / wherever.
   *
   * The shape pins each playerId to the millisecond timestamp of
   * its last operation. Stale entries (older than 60s) are
   * filtered at snapshot time so the persisted set stays small.
   */
  snapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    const cutoff = Date.now() - 60000;
    for (const [id, time] of this.lastOperation.entries()) {
      if (time >= cutoff) {
        out[id] = time;
      }
    }
    return out;
  }

  /**
   * Phase 4.1 — restore a previously-snapshotted state. Replaces
   * the current in-memory map. Call once on server boot AFTER
   * the limiter is constructed but BEFORE any handler attaches.
   *
   * Stale entries (older than 60s) are dropped on restore so a
   * long-paused server doesn't resurrect ancient rate-limit
   * windows.
   */
  restore(snapshot: Record<string, number>): void {
    const cutoff = Date.now() - 60000;
    this.lastOperation.clear();
    for (const [id, time] of Object.entries(snapshot)) {
      if (typeof time === "number" && Number.isFinite(time) && time >= cutoff) {
        this.lastOperation.set(id, time);
      }
    }
  }

  /**
   * Phase 4.1 — test-visible size accessor. Used by persistence
   * tests to verify snapshot/restore round-trips without
   * exposing the private Map.
   */
  size(): number {
    return this.lastOperation.size;
  }
}
