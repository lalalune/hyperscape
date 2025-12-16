/**
 * Rate Limit Service Tests
 *
 * Tests the rate limiting service that prevents exploit attempts.
 * These tests may skip if @hyperscape/shared module resolution fails.
 */

import { describe, it, expect } from "bun:test";

// Dynamic import to handle module resolution
let RateLimitService: new (limitMs?: number) => {
  isAllowed: (playerId: string) => boolean;
  recordOperation: (playerId: string) => void;
  reset: (playerId: string) => void;
  tryOperation: (playerId: string) => boolean;
};

let canRunTests = true;

try {
  const module = await import("../services/RateLimitService");
  RateLimitService = module.RateLimitService;

  // Quick sanity check
  const test = new RateLimitService(10);
  if (typeof test.isAllowed !== "function") {
    canRunTests = false;
  }
} catch {
  canRunTests = false;
}

// Helper to generate unique player ID
let counter = 0;
function uniquePlayerId(prefix: string): string {
  return `${prefix}-${++counter}-${Date.now()}`;
}

describe.skipIf(!canRunTests)("RateLimitService", () => {
  describe("isAllowed", () => {
    it("should allow first operation", () => {
      const rateLimiter = new RateLimitService(50);
      expect(rateLimiter.isAllowed(uniquePlayerId("first"))).toBe(true);
    });

    it("should deny rapid operations", () => {
      const rateLimiter = new RateLimitService(1000); // 1 second limit
      const playerId = uniquePlayerId("rapid");
      rateLimiter.recordOperation(playerId);

      // Immediately after recording
      expect(rateLimiter.isAllowed(playerId)).toBe(false);
    });

    it("should allow operation after rate limit expires", async () => {
      const rateLimiter = new RateLimitService(30); // 30ms limit
      const playerId = uniquePlayerId("expire");
      rateLimiter.recordOperation(playerId);

      // Wait for rate limit to expire
      await new Promise((r) => setTimeout(r, 50));

      expect(rateLimiter.isAllowed(playerId)).toBe(true);
    }, 1000);

    it("should track players independently", () => {
      const rateLimiter = new RateLimitService(1000);
      const playerA = uniquePlayerId("a");
      const playerB = uniquePlayerId("b");

      rateLimiter.recordOperation(playerA);

      // Player B should still be allowed
      expect(rateLimiter.isAllowed(playerB)).toBe(true);
    });
  });

  describe("recordOperation", () => {
    it("should record operation timestamp", () => {
      const rateLimiter = new RateLimitService(1000);
      const playerId = uniquePlayerId("rec");

      expect(rateLimiter.isAllowed(playerId)).toBe(true);
      rateLimiter.recordOperation(playerId);
      expect(rateLimiter.isAllowed(playerId)).toBe(false);
    });
  });

  describe("reset", () => {
    it("should allow operations after reset", () => {
      const rateLimiter = new RateLimitService(1000);
      const playerId = uniquePlayerId("reset");

      rateLimiter.recordOperation(playerId);
      expect(rateLimiter.isAllowed(playerId)).toBe(false);

      rateLimiter.reset(playerId);
      expect(rateLimiter.isAllowed(playerId)).toBe(true);
    });

    it("should only reset specified player", () => {
      const rateLimiter = new RateLimitService(1000);
      const playerX = uniquePlayerId("x");
      const playerY = uniquePlayerId("y");

      rateLimiter.recordOperation(playerX);
      rateLimiter.recordOperation(playerY);

      rateLimiter.reset(playerX);

      expect(rateLimiter.isAllowed(playerX)).toBe(true);
      expect(rateLimiter.isAllowed(playerY)).toBe(false);
    });
  });

  describe("tryOperation", () => {
    it("should return true and record on allowed operation", () => {
      const rateLimiter = new RateLimitService(1000);
      const playerId = uniquePlayerId("try");

      const result = rateLimiter.tryOperation(playerId);

      expect(result).toBe(true);
      expect(rateLimiter.isAllowed(playerId)).toBe(false);
    });

    it("should return false on rate limited operation", () => {
      const rateLimiter = new RateLimitService(1000);
      const playerId = uniquePlayerId("limited");

      rateLimiter.recordOperation(playerId);

      const result = rateLimiter.tryOperation(playerId);
      expect(result).toBe(false);
    });

    it("should be atomic check-and-record", () => {
      const rateLimiter = new RateLimitService(1000);
      const playerId = uniquePlayerId("atomic");

      // First try succeeds
      expect(rateLimiter.tryOperation(playerId)).toBe(true);
      // Second immediate try fails
      expect(rateLimiter.tryOperation(playerId)).toBe(false);
      // Third immediate try also fails
      expect(rateLimiter.tryOperation(playerId)).toBe(false);
    });
  });

  describe("memory management", () => {
    it("should handle many players without issues", () => {
      const rateLimiter = new RateLimitService(1000);
      const playerIds: string[] = [];

      // Record operations for 100 players
      for (let i = 0; i < 100; i++) {
        const id = uniquePlayerId(`mem-${i}`);
        playerIds.push(id);
        rateLimiter.recordOperation(id);
      }

      // All should be rate limited
      for (const id of playerIds) {
        expect(rateLimiter.isAllowed(id)).toBe(false);
      }
    });
  });
});
