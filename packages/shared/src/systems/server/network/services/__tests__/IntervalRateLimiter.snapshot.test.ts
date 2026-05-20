/**
 * IntervalRateLimiter — snapshot / restore contract tests.
 *
 * Phase 4.1 of PLAN_AAA_MASTER_AUDIT pins the in-memory limiter's
 * persistence helpers. The server-side coordinator wraps these
 * primitives to write JSON to disk; this test isolates the
 * primitives so future serializers (Redis, Postgres) can rely on
 * the same shape.
 *
 * Contract:
 *   - `snapshot()` returns a plain object suitable for JSON.
 *   - Entries older than 60s are filtered out on snapshot.
 *   - Entries older than 60s are filtered out on restore (a long-
 *     paused server doesn't resurrect ancient cooldowns).
 *   - Round-trip preserves the active set exactly.
 *   - Restore replaces (doesn't merge) the in-memory state.
 *   - Invalid timestamps in restore data are dropped silently.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { IntervalRateLimiter } from "../IntervalRateLimiter";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("IntervalRateLimiter.snapshot()", () => {
  it("returns an empty object when no players have operated", () => {
    const limiter = new IntervalRateLimiter(100);
    expect(limiter.snapshot()).toEqual({});
  });

  it("captures the last-operation timestamp for every active player", () => {
    const limiter = new IntervalRateLimiter(100);
    vi.setSystemTime(new Date(1000));
    limiter.recordOperation("alice");
    vi.setSystemTime(new Date(2000));
    limiter.recordOperation("bob");

    const snap = limiter.snapshot();
    expect(snap).toEqual({ alice: 1000, bob: 2000 });
  });

  it("filters out entries older than 60s", () => {
    const limiter = new IntervalRateLimiter(100);
    vi.setSystemTime(new Date(0));
    limiter.recordOperation("ancient"); // t=0
    vi.setSystemTime(new Date(100_000));
    limiter.recordOperation("fresh"); // t=100s, cutoff=40s

    const snap = limiter.snapshot();
    expect(snap).toEqual({ fresh: 100_000 });
    expect(snap).not.toHaveProperty("ancient");
  });
});

describe("IntervalRateLimiter.restore()", () => {
  it("populates an empty limiter from a snapshot", () => {
    const limiter = new IntervalRateLimiter(100);
    vi.setSystemTime(new Date(5000));
    limiter.restore({ alice: 4000, bob: 4500 });

    expect(limiter.size()).toBe(2);
    expect(limiter.snapshot()).toEqual({ alice: 4000, bob: 4500 });
  });

  it("replaces existing state (no merge)", () => {
    const limiter = new IntervalRateLimiter(100);
    vi.setSystemTime(new Date(5000));
    limiter.recordOperation("preexisting");
    limiter.restore({ alice: 4500 });

    const snap = limiter.snapshot();
    expect(snap).toEqual({ alice: 4500 });
    expect(snap).not.toHaveProperty("preexisting");
  });

  it("drops entries older than 60s during restore", () => {
    const limiter = new IntervalRateLimiter(100);
    vi.setSystemTime(new Date(100_000));
    limiter.restore({
      ancient: 0, // 100s old, cutoff=40s
      fresh: 80_000, // 20s old
    });

    expect(limiter.snapshot()).toEqual({ fresh: 80_000 });
  });

  it("silently drops non-numeric / non-finite timestamps", () => {
    const limiter = new IntervalRateLimiter(100);
    vi.setSystemTime(new Date(5000));
    limiter.restore({
      good: 4000,
      bad_string: "not a number" as unknown as number,
      bad_nan: Number.NaN,
      bad_infinity: Number.POSITIVE_INFINITY,
    });

    expect(limiter.snapshot()).toEqual({ good: 4000 });
  });

  it("clears completely when given an empty snapshot", () => {
    const limiter = new IntervalRateLimiter(100);
    vi.setSystemTime(new Date(5000));
    limiter.recordOperation("alice");
    expect(limiter.size()).toBe(1);

    limiter.restore({});
    expect(limiter.size()).toBe(0);
    expect(limiter.snapshot()).toEqual({});
  });
});

describe("IntervalRateLimiter — snapshot/restore round-trip", () => {
  it("preserves rate-limit windows across a simulated restart", () => {
    // Simulate: server boots, accepts ops, snapshots, restarts,
    // restores. A player who just operated should STILL be
    // rate-limited after the "restart" — that's the anti-cheat
    // protection Phase 4.1 closes.
    const before = new IntervalRateLimiter(1000); // 1s cooldown
    vi.setSystemTime(new Date(10_000));
    before.recordOperation("attacker");
    // Same tick: attacker is rate-limited
    expect(before.isAllowed("attacker")).toBe(false);

    const persisted = before.snapshot();

    // "Restart" — fresh instance, restore from snapshot
    const after = new IntervalRateLimiter(1000);
    after.restore(persisted);

    // Without persistence, the new limiter would have an empty
    // map and `isAllowed("attacker")` would return true (cooldown
    // bypassed). With restore, the player is still locked.
    vi.setSystemTime(new Date(10_500));
    expect(after.isAllowed("attacker")).toBe(false);

    // After cooldown elapses, the player can operate again.
    vi.setSystemTime(new Date(11_500));
    expect(after.isAllowed("attacker")).toBe(true);
  });
});
