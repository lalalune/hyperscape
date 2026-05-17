/**
 * CombatRateLimiter Unit Tests
 *
 * Tests for combat request rate limiting:
 * - Per-tick rate limiting
 * - Per-second burst protection
 * - Cooldown after violations
 * - Player state cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CombatRateLimiter } from "../CombatRateLimiter";

describe("CombatRateLimiter", () => {
  let limiter: CombatRateLimiter;

  beforeEach(() => {
    // Create with specific config for predictable testing
    limiter = new CombatRateLimiter({
      maxRequestsPerTick: 3,
      maxRequestsPerSecond: 5,
      cooldownTicks: 2,
      logViolations: false, // Disable console.warn in tests
    });
  });

  afterEach(() => {
    limiter.destroy();
  });

  describe("checkLimit", () => {
    describe("per-tick limiting", () => {
      it("allows requests up to maxRequestsPerTick", () => {
        const tick = 100;

        expect(limiter.checkLimit("player1", tick).allowed).toBe(true);
        expect(limiter.checkLimit("player1", tick).allowed).toBe(true);
        expect(limiter.checkLimit("player1", tick).allowed).toBe(true);
      });

      it("blocks requests exceeding maxRequestsPerTick", () => {
        const tick = 100;

        limiter.checkLimit("player1", tick); // 1
        limiter.checkLimit("player1", tick); // 2
        limiter.checkLimit("player1", tick); // 3

        const result = limiter.checkLimit("player1", tick); // 4 - blocked
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe("tick_limit");
      });

      it("resets tick counter on new tick", () => {
        limiter.checkLimit("player1", 100);
        limiter.checkLimit("player1", 100);
        limiter.checkLimit("player1", 100);

        // New tick - counter should reset
        const result = limiter.checkLimit("player1", 101);
        expect(result.allowed).toBe(true);
      });

      it("tracks remaining requests in result", () => {
        const tick = 100;

        const result1 = limiter.checkLimit("player1", tick);
        expect(result1.remainingThisTick).toBe(2);

        const result2 = limiter.checkLimit("player1", tick);
        expect(result2.remainingThisTick).toBe(1);

        const result3 = limiter.checkLimit("player1", tick);
        expect(result3.remainingThisTick).toBe(0);
      });
    });

    describe("per-second limiting", () => {
      it("blocks requests exceeding maxRequestsPerSecond within tick window", () => {
        // Use a config where per-second limit triggers before per-tick limit
        const secondLimiter = new CombatRateLimiter({
          maxRequestsPerTick: 10,
          maxRequestsPerSecond: 3,
          cooldownTicks: 2,
          logViolations: false,
        });

        // All requests within the same 2-tick window (ticks 100-101)
        secondLimiter.checkLimit("player1", 100);
        secondLimiter.checkLimit("player1", 100);
        secondLimiter.checkLimit("player1", 100);

        const result = secondLimiter.checkLimit("player1", 100);
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe("second_limit");
      });

      it("resets per-second counter on new tick window", () => {
        const secondLimiter = new CombatRateLimiter({
          maxRequestsPerTick: 10,
          maxRequestsPerSecond: 2,
          cooldownTicks: 0,
          logViolations: false,
        });

        // Fill window 50 (ticks 100-101)
        secondLimiter.checkLimit("player1", 100);
        secondLimiter.checkLimit("player1", 101);
        const blocked = secondLimiter.checkLimit("player1", 101);
        expect(blocked.allowed).toBe(false);

        // New window 51 (ticks 102-103) — counter resets
        const allowed = secondLimiter.checkLimit("player1", 102);
        expect(allowed.allowed).toBe(true);
      });
    });

    describe("cooldown after violation", () => {
      it("enforces cooldown after tick limit exceeded", () => {
        const tick = 100;

        // Exceed tick limit
        limiter.checkLimit("player1", tick);
        limiter.checkLimit("player1", tick);
        limiter.checkLimit("player1", tick);
        limiter.checkLimit("player1", tick); // Violation - triggers cooldown until tick 102

        // Should be in cooldown at tick 101 (cooldownUntilTick=102 > 101)
        const result1 = limiter.checkLimit("player1", 101);
        expect(result1.allowed).toBe(false);
        expect(result1.reason).toBe("cooldown");

        // Cooldown ends at tick 102 (cooldownUntilTick=102 > 102 is false)
        const result2 = limiter.checkLimit("player1", 102);
        expect(result2.allowed).toBe(true);
      });

      it("includes cooldownUntil tick in result", () => {
        const tick = 100;

        // Exceed limit
        limiter.checkLimit("player1", tick);
        limiter.checkLimit("player1", tick);
        limiter.checkLimit("player1", tick);
        const violation = limiter.checkLimit("player1", tick);

        expect(violation.cooldownUntil).toBe(102); // tick + cooldownTicks
      });
    });

    describe("independent player tracking", () => {
      it("tracks each player independently", () => {
        const tick = 100;

        // Player1 uses all requests
        limiter.checkLimit("player1", tick);
        limiter.checkLimit("player1", tick);
        limiter.checkLimit("player1", tick);
        expect(limiter.checkLimit("player1", tick).allowed).toBe(false);

        // Player2 should still have full quota
        expect(limiter.checkLimit("player2", tick).allowed).toBe(true);
        expect(limiter.checkLimit("player2", tick).allowed).toBe(true);
      });
    });
  });

  describe("isAllowed", () => {
    it("provides simple boolean check", () => {
      const tick = 100;

      expect(limiter.isAllowed("player1", tick)).toBe(true);
      limiter.checkLimit("player1", tick);
      limiter.checkLimit("player1", tick);
      limiter.checkLimit("player1", tick);
      expect(limiter.isAllowed("player1", tick)).toBe(false);
    });
  });

  describe("getPlayerStats", () => {
    it("returns null for untracked players", () => {
      expect(limiter.getPlayerStats("unknown")).toBeNull();
    });

    it("returns stats for tracked players", () => {
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);

      const stats = limiter.getPlayerStats("player1");
      expect(stats).not.toBeNull();
      expect(stats?.tickRequests).toBe(2);
      expect(stats?.totalViolations).toBe(0);
      expect(stats?.inCooldown).toBe(false);
    });

    it("tracks violations correctly", () => {
      // Exceed limit to trigger violation
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100); // Violation

      const stats = limiter.getPlayerStats("player1", 100);
      expect(stats?.totalViolations).toBe(1);
      expect(stats?.inCooldown).toBe(true);
    });
  });

  describe("getStats", () => {
    it("returns overall statistics", () => {
      // Player1 in cooldown
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100); // Violation

      // Player2 normal
      limiter.checkLimit("player2", 100);

      const stats = limiter.getStats(100);
      expect(stats.trackedPlayers).toBe(2);
      expect(stats.playersInCooldown).toBe(1);
      expect(stats.totalViolationsAllTime).toBe(1);
    });
  });

  describe("cleanup", () => {
    it("removes player state on cleanup", () => {
      limiter.checkLimit("player1", 100);
      expect(limiter.getPlayerStats("player1")).not.toBeNull();

      limiter.cleanup("player1");
      expect(limiter.getPlayerStats("player1")).toBeNull();
    });
  });

  describe("resetPlayer", () => {
    it("resets player state including cooldown", () => {
      // Put player in cooldown
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);
      expect(limiter.getPlayerStats("player1", 100)?.inCooldown).toBe(true);

      // Reset
      limiter.resetPlayer("player1");
      expect(limiter.getPlayerStats("player1", 100)).toBeNull();

      // Should be able to use requests again
      expect(limiter.checkLimit("player1", 101).allowed).toBe(true);
    });
  });

  describe("destroy", () => {
    it("clears all player state", () => {
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player2", 100);
      expect(limiter.getStats().trackedPlayers).toBe(2);

      limiter.destroy();
      expect(limiter.getStats().trackedPlayers).toBe(0);
    });
  });

  describe("getConfig", () => {
    it("returns readonly configuration", () => {
      const config = limiter.getConfig();
      expect(config.maxRequestsPerTick).toBe(3);
      expect(config.maxRequestsPerSecond).toBe(5);
      expect(config.cooldownTicks).toBe(2);
    });
  });

  describe("custom configuration", () => {
    it("respects stricter configuration", () => {
      const strictLimiter = new CombatRateLimiter({
        maxRequestsPerTick: 1,
        cooldownTicks: 5,
        logViolations: false,
      });

      expect(strictLimiter.checkLimit("player1", 100).allowed).toBe(true);
      expect(strictLimiter.checkLimit("player1", 100).allowed).toBe(false);

      // Longer cooldown
      const stats = strictLimiter.getPlayerStats("player1");
      expect(stats?.cooldownUntil).toBe(105);

      strictLimiter.destroy();
    });
  });

  describe("cooldown expiration", () => {
    it("reports not in cooldown after cooldown ticks expire", () => {
      // Trigger violation to enter cooldown (cooldownTicks = 2)
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100); // Violation, cooldown until tick 102

      // Still in cooldown at tick 101
      expect(limiter.getPlayerStats("player1", 101)?.inCooldown).toBe(true);

      // Cooldown expired at tick 102
      expect(limiter.getPlayerStats("player1", 102)?.inCooldown).toBe(false);

      // Requests allowed again at tick 103
      expect(limiter.checkLimit("player1", 103).allowed).toBe(true);
    });
  });

  describe("stats accuracy with currentTick", () => {
    it("getStats counts only actively cooled-down players", () => {
      // Player1 in cooldown until tick 102
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100);
      limiter.checkLimit("player1", 100); // Violation

      // Player2 in cooldown until tick 102
      limiter.checkLimit("player2", 100);
      limiter.checkLimit("player2", 100);
      limiter.checkLimit("player2", 100);
      limiter.checkLimit("player2", 100); // Violation

      // At tick 100, both in cooldown
      expect(limiter.getStats(100).playersInCooldown).toBe(2);

      // At tick 103, neither in cooldown (expired)
      expect(limiter.getStats(103).playersInCooldown).toBe(0);

      // Without currentTick, defaults to 0 (both cooldowns > 0)
      expect(limiter.getStats().playersInCooldown).toBe(2);
    });

    it("getPlayerStats reflects accurate cooldown state", () => {
      limiter.checkLimit("player1", 50);
      limiter.checkLimit("player1", 50);
      limiter.checkLimit("player1", 50);
      limiter.checkLimit("player1", 50); // cooldown until 52

      // Before expiry
      expect(limiter.getPlayerStats("player1", 51)?.inCooldown).toBe(true);
      // At expiry boundary
      expect(limiter.getPlayerStats("player1", 52)?.inCooldown).toBe(false);
      // After expiry
      expect(limiter.getPlayerStats("player1", 100)?.inCooldown).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles exactly at maxRequestsPerTick boundary", () => {
      const tick = 100;
      // 3 requests = exactly at limit (all allowed)
      expect(limiter.checkLimit("player1", tick).allowed).toBe(true);
      expect(limiter.checkLimit("player1", tick).allowed).toBe(true);
      expect(limiter.checkLimit("player1", tick).allowed).toBe(true);
      // Remaining should be 0 after 3rd request
      expect(limiter.checkLimit("player1", tick).allowed).toBe(false);
    });

    it("tracks violations across multiple ticks", () => {
      // Violate on tick 100
      for (let i = 0; i < 4; i++) limiter.checkLimit("player1", 100);

      // Wait for cooldown to expire (cooldownTicks = 2), violate again
      for (let i = 0; i < 4; i++) limiter.checkLimit("player1", 103);

      const stats = limiter.getPlayerStats("player1", 103);
      expect(stats?.totalViolations).toBe(2);
    });
  });
});
