/**
 * RateLimiterPersistence — coordinator tests.
 *
 * Phase 4.1 — pins the snapshot/restore coordinator that wires
 * one or more IntervalRateLimiter instances to disk persistence.
 * Uses a real temp dir so the JSON round-trip is exercised
 * end-to-end (not just the in-memory primitives, which have
 * their own dedicated tests in shared).
 */

import fs from "fs";
import os from "os";
import path from "path";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { IntervalRateLimiter } from "@hyperforge/shared";

import {
  RateLimiterPersistence,
  defaultSnapshotPath,
} from "../RateLimiterPersistence";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rl-persist-"));
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function snapshotPath() {
  return defaultSnapshotPath(tmpDir);
}

describe("RateLimiterPersistence — restore semantics", () => {
  it("silently skips when no snapshot file exists (first boot)", () => {
    const coordinator = new RateLimiterPersistence(snapshotPath());
    const limiter = new IntervalRateLimiter(100);
    coordinator.register("test", limiter);

    expect(() => coordinator.restore()).not.toThrow();
    expect(limiter.size()).toBe(0);
  });

  it("restores prior state from disk on boot", () => {
    // Pre-seed the disk file as if a prior process had snapshotted.
    // Last-op timestamps inside the cooldown window — current
    // time 10_000, last ops at 9_500 / 9_750 → both < 1000ms ago.
    vi.setSystemTime(new Date(10_000));
    fs.writeFileSync(
      snapshotPath(),
      JSON.stringify({
        version: 1,
        capturedAt: 10_000,
        limiters: {
          bank: { alice: 9_500, bob: 9_750 },
        },
      }),
    );

    const coordinator = new RateLimiterPersistence(snapshotPath());
    const bank = new IntervalRateLimiter(1000);
    coordinator.register("bank", bank);

    coordinator.restore();

    expect(bank.size()).toBe(2);
    // Players that just operated should still be rate-limited
    // — the whole point of Phase 4.1.
    expect(bank.isAllowed("alice")).toBe(false);
    expect(bank.isAllowed("bob")).toBe(false);
  });

  it("ignores limiter sections not registered with the coordinator", () => {
    vi.setSystemTime(new Date(10_000));
    fs.writeFileSync(
      snapshotPath(),
      JSON.stringify({
        version: 1,
        capturedAt: 10_000,
        limiters: {
          bank: { alice: 9_000 },
          unknown: { someone: 9_000 },
        },
      }),
    );

    const coordinator = new RateLimiterPersistence(snapshotPath());
    const bank = new IntervalRateLimiter(1000);
    coordinator.register("bank", bank);
    coordinator.restore();

    expect(bank.size()).toBe(1);
    // "unknown" data is harmlessly ignored — it has no matching
    // registered limiter.
  });

  it("tolerates malformed JSON without throwing", () => {
    fs.writeFileSync(snapshotPath(), "not valid json {");
    const coordinator = new RateLimiterPersistence(snapshotPath());
    const limiter = new IntervalRateLimiter(100);
    coordinator.register("test", limiter);

    expect(() => coordinator.restore()).not.toThrow();
    expect(limiter.size()).toBe(0);
  });

  it("tolerates unrecognized version field", () => {
    fs.writeFileSync(
      snapshotPath(),
      JSON.stringify({ version: 999, limiters: {} }),
    );
    const coordinator = new RateLimiterPersistence(snapshotPath());
    const limiter = new IntervalRateLimiter(100);
    coordinator.register("test", limiter);

    expect(() => coordinator.restore()).not.toThrow();
    expect(limiter.size()).toBe(0);
  });
});

describe("RateLimiterPersistence — flush semantics", () => {
  it("writes a JSON snapshot for every registered limiter", () => {
    vi.setSystemTime(new Date(10_000));
    const coordinator = new RateLimiterPersistence(snapshotPath());
    const bank = new IntervalRateLimiter(1000);
    const store = new IntervalRateLimiter(2000);
    coordinator.register("bank", bank);
    coordinator.register("store", store);

    bank.recordOperation("alice");
    store.recordOperation("bob");
    coordinator.flush();

    const raw = fs.readFileSync(snapshotPath(), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.limiters.bank.alice).toBe(10_000);
    expect(parsed.limiters.store.bob).toBe(10_000);
  });

  it("creates the snapshot directory if it doesn't exist", () => {
    vi.setSystemTime(new Date(10_000));
    const nested = path.join(tmpDir, "deep/nested/dir/snapshot.json");
    const coordinator = new RateLimiterPersistence(nested);
    const limiter = new IntervalRateLimiter(100);
    coordinator.register("test", limiter);
    limiter.recordOperation("alice");

    coordinator.flush();
    expect(fs.existsSync(nested)).toBe(true);
  });
});

describe("RateLimiterPersistence — round-trip", () => {
  it("survives a simulated restart (snapshot → restore preserves state)", () => {
    vi.setSystemTime(new Date(10_000));
    // "Before": serve some operations, snapshot to disk.
    const before = new RateLimiterPersistence(snapshotPath());
    const bankBefore = new IntervalRateLimiter(1000);
    before.register("bank", bankBefore);
    bankBefore.recordOperation("attacker");
    before.flush();

    // "After": fresh coordinator + limiter, restore from disk.
    vi.setSystemTime(new Date(10_500));
    const after = new RateLimiterPersistence(snapshotPath());
    const bankAfter = new IntervalRateLimiter(1000);
    after.register("bank", bankAfter);
    after.restore();

    // Without persistence, the bypass: bankAfter would be empty
    // and `isAllowed("attacker")` would return true.
    expect(bankAfter.isAllowed("attacker")).toBe(false);
  });

  it("totalEntries() reports the aggregate across limiters", () => {
    const coordinator = new RateLimiterPersistence(snapshotPath());
    const bank = new IntervalRateLimiter(1000);
    const store = new IntervalRateLimiter(2000);
    coordinator.register("bank", bank);
    coordinator.register("store", store);

    bank.recordOperation("alice");
    bank.recordOperation("bob");
    store.recordOperation("charlie");

    expect(coordinator.totalEntries()).toBe(3);
  });
});

describe("RateLimiterPersistence — periodic timer", () => {
  it("start() is idempotent and stop() halts snapshotting", () => {
    const coordinator = new RateLimiterPersistence(snapshotPath(), 1000);
    const limiter = new IntervalRateLimiter(100);
    coordinator.register("test", limiter);

    coordinator.start();
    coordinator.start(); // no-op
    coordinator.stop();

    // After stop, advancing time should NOT produce a snapshot
    // file (no writes after stop).
    vi.advanceTimersByTime(5000);
    expect(fs.existsSync(snapshotPath())).toBe(false);
  });
});
