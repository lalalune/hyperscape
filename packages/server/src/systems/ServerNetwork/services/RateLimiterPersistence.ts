/**
 * Phase 4.1 — Rate limiter snapshot/restore coordinator.
 *
 * The IntervalRateLimiter is per-process in-memory state; a
 * server restart historically reset every per-player cooldown
 * window, opening an anti-cheat bypass: an operator-mitigated
 * DoS (forced restart) handed back full transaction velocity to
 * anyone who was throttled.
 *
 * This module:
 *
 *  1. Periodically snapshots every REGISTERED limiter to disk.
 *  2. Snapshots one final time on graceful shutdown.
 *  3. Restores from disk on server boot.
 *
 * Storage is JSON on the local filesystem (`world/<world>/rate-
 * limiter-state.json`). Per the master plan the proper backend
 * is Postgres or Redis — this is the smaller-blast-radius first
 * cut that closes the restart-bypass window without a schema
 * migration or new service dependency.
 *
 * The 60s stale-entry filter inside IntervalRateLimiter means
 * restored windows are accurate to within the limiter's own
 * cleanup epoch — a player whose last op was >60s ago doesn't
 * have an active window to protect anyway.
 */

import fs from "fs";
import path from "path";
import type { IntervalRateLimiter } from "@hyperforge/shared";

/** Default snapshot interval — every 30 seconds. */
const DEFAULT_SNAPSHOT_INTERVAL_MS = 30_000;

interface RegisteredLimiter {
  name: string;
  limiter: IntervalRateLimiter;
}

interface PersistedSnapshot {
  version: 1;
  capturedAt: number;
  limiters: Record<string, Record<string, number>>;
}

/**
 * Coordinator instance. Hosts (server startup) construct one,
 * register limiters via `register()`, and either let the
 * periodic snapshotter run (`start()`) or trigger snapshots
 * manually (`flush()`).
 */
export class RateLimiterPersistence {
  private readonly limiters = new Map<string, IntervalRateLimiter>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly snapshotPath: string,
    private readonly intervalMs: number = DEFAULT_SNAPSHOT_INTERVAL_MS,
  ) {}

  /**
   * Register a limiter under a stable name. The name is the
   * snapshot key; using a different name on restore loses the
   * prior state for that limiter (no harm, just a clean slate).
   */
  register(name: string, limiter: IntervalRateLimiter): void {
    this.limiters.set(name, limiter);
  }

  /**
   * Restore all registered limiters from the snapshot file (if
   * one exists). Should be called once at boot AFTER every
   * limiter has been `register()`'d but BEFORE any handler
   * attaches. Missing file is normal on first boot — silently
   * skipped.
   */
  restore(): void {
    if (!fs.existsSync(this.snapshotPath)) {
      return;
    }
    let parsed: PersistedSnapshot;
    try {
      const raw = fs.readFileSync(this.snapshotPath, "utf-8");
      parsed = JSON.parse(raw) as PersistedSnapshot;
    } catch (err) {
      console.warn(
        `[RateLimiterPersistence] Failed to parse ${this.snapshotPath}; starting fresh:`,
        (err as Error).message,
      );
      return;
    }
    if (parsed.version !== 1 || !parsed.limiters) {
      console.warn(
        `[RateLimiterPersistence] Unrecognized snapshot format at ${this.snapshotPath}; starting fresh`,
      );
      return;
    }
    let restoredLimiters = 0;
    let restoredEntries = 0;
    for (const [name, limiter] of this.limiters) {
      const data = parsed.limiters[name];
      if (data) {
        limiter.restore(data);
        restoredLimiters += 1;
        restoredEntries += Object.keys(data).length;
      }
    }
    console.log(
      `[RateLimiterPersistence] ✓ Restored ${restoredEntries} rate-limit entries across ${restoredLimiters} limiters`,
    );
  }

  /**
   * Start the periodic snapshot timer. Idempotent — calling
   * twice doesn't double up timers.
   */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      this.flush();
    }, this.intervalMs);
    // Don't keep the event loop alive solely for snapshots.
    if (this.timer.unref) this.timer.unref();
  }

  /**
   * Stop the periodic snapshot timer.
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Write a fresh snapshot to disk synchronously. Call from the
   * graceful-shutdown handler to capture state right before
   * process exit.
   *
   * Errors are logged but never thrown — the cost of a missed
   * snapshot is a window of fresh cooldowns for affected
   * players, not a corruption / data-loss outcome.
   */
  flush(): void {
    const limiters: Record<string, Record<string, number>> = {};
    for (const [name, limiter] of this.limiters) {
      limiters[name] = limiter.snapshot();
    }
    const snapshot: PersistedSnapshot = {
      version: 1,
      capturedAt: Date.now(),
      limiters,
    };
    try {
      const dir = path.dirname(this.snapshotPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.snapshotPath, JSON.stringify(snapshot));
    } catch (err) {
      console.warn(
        `[RateLimiterPersistence] Snapshot write failed (${this.snapshotPath}):`,
        (err as Error).message,
      );
    }
  }

  /**
   * Aggregate entry count across all registered limiters — for
   * tests + monitoring.
   */
  totalEntries(): number {
    let total = 0;
    for (const limiter of this.limiters.values()) {
      total += limiter.size();
    }
    return total;
  }
}

/**
 * Helper: construct the default snapshot path inside a world
 * directory. Hosts pass their resolved world dir.
 */
export function defaultSnapshotPath(worldDir: string): string {
  return path.join(worldDir, "rate-limiter-state.json");
}
