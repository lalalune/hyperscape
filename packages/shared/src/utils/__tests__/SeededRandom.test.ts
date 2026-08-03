/**
 * SeededRandom Tests
 *
 * Verifies:
 * - Determinism: same seed produces same sequence
 * - Distribution: uniform across range
 * - State serialization: save/restore produces identical sequence
 * - Edge cases: zero, negative, large values
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SeededRandom,
  initializeGameRng,
  getGameRng,
  getGameSeed,
  getGameRngState,
} from "../SeededRandom";

describe("SeededRandom", () => {
  describe("determinism", () => {
    it("same seed produces identical sequence", () => {
      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);

      // Generate 1000 numbers and verify they match
      for (let i = 0; i < 1000; i++) {
        expect(rng1.random()).toBe(rng2.random());
      }
    });

    it("different seeds produce different sequences", () => {
      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(54321);

      // First number should be different
      expect(rng1.random()).not.toBe(rng2.random());
    });

    it("sequence is reproducible after many iterations", () => {
      const seed = 999999;
      const rng1 = new SeededRandom(seed);

      // Generate 10000 numbers
      const sequence: number[] = [];
      for (let i = 0; i < 10000; i++) {
        sequence.push(rng1.random());
      }

      // Create new RNG with same seed and verify sequence
      const rng2 = new SeededRandom(seed);
      for (let i = 0; i < 10000; i++) {
        expect(rng2.random()).toBe(sequence[i]);
      }
    });
  });

  describe("distribution", () => {
    it("random() produces values in [0, 1)", () => {
      const rng = new SeededRandom(42);

      for (let i = 0; i < 10000; i++) {
        const value = rng.random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it("nextInt() produces values in [0, max)", () => {
      const rng = new SeededRandom(42);
      const max = 100;

      for (let i = 0; i < 10000; i++) {
        const value = rng.nextInt(max);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(max);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it("nextIntRange() produces values in [min, max]", () => {
      const rng = new SeededRandom(42);
      const min = 50;
      const max = 100;

      for (let i = 0; i < 10000; i++) {
        const value = rng.nextIntRange(min, max);
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThanOrEqual(max);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it("distribution is approximately uniform across 10 buckets", () => {
      const rng = new SeededRandom(42);
      const buckets = new Array(10).fill(0);
      const iterations = 100000;

      for (let i = 0; i < iterations; i++) {
        const bucket = Math.floor(rng.random() * 10);
        buckets[bucket]++;
      }

      // Each bucket should have ~10% of values (10000)
      // Allow 15% deviation (8500-11500)
      const expected = iterations / 10;
      const tolerance = expected * 0.15;

      for (let i = 0; i < 10; i++) {
        expect(buckets[i]).toBeGreaterThan(expected - tolerance);
        expect(buckets[i]).toBeLessThan(expected + tolerance);
      }
    });
  });

  describe("classic MMORPG combat methods", () => {
    it("damageRoll() produces values in [0, maxHit]", () => {
      const rng = new SeededRandom(42);
      const maxHit = 25;

      const damages = new Set<number>();
      for (let i = 0; i < 10000; i++) {
        const damage = rng.damageRoll(maxHit);
        expect(damage).toBeGreaterThanOrEqual(0);
        expect(damage).toBeLessThanOrEqual(maxHit);
        damages.add(damage);
      }

      // Should have hit all possible values
      expect(damages.size).toBe(maxHit + 1);
    });

    it("accuracyRoll() returns boolean", () => {
      const rng = new SeededRandom(42);

      let hits = 0;
      let misses = 0;

      for (let i = 0; i < 10000; i++) {
        const result = rng.accuracyRoll(100, 100);
        expect(typeof result).toBe("boolean");
        if (result) hits++;
        else misses++;
      }

      // With equal rolls, should be roughly 50/50
      expect(hits).toBeGreaterThan(4000);
      expect(misses).toBeGreaterThan(4000);
    });

    it("higher attack roll increases hit chance", () => {
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(42);

      let hitsHigh = 0;
      let hitsLow = 0;

      // High attack vs medium defense
      for (let i = 0; i < 10000; i++) {
        if (rng1.accuracyRoll(200, 100)) hitsHigh++;
      }

      // Low attack vs medium defense
      for (let i = 0; i < 10000; i++) {
        if (rng2.accuracyRoll(50, 100)) hitsLow++;
      }

      expect(hitsHigh).toBeGreaterThan(hitsLow);
    });
  });

  describe("state serialization", () => {
    it("getState() returns serializable state", () => {
      const rng = new SeededRandom(42);
      rng.random(); // Advance state

      const state = rng.getState();

      expect(typeof state.state0).toBe("string");
      expect(typeof state.state1).toBe("string");
      expect(state.state0.length).toBe(16); // 64-bit hex
      expect(state.state1.length).toBe(16);
    });

    it("setState() restores exact sequence", () => {
      const rng = new SeededRandom(42);

      // Advance some steps
      for (let i = 0; i < 100; i++) {
        rng.random();
      }

      // Save state
      const state = rng.getState();

      // Generate 100 more numbers
      const sequence: number[] = [];
      for (let i = 0; i < 100; i++) {
        sequence.push(rng.random());
      }

      // Restore state
      rng.setState(state);

      // Verify same sequence
      for (let i = 0; i < 100; i++) {
        expect(rng.random()).toBe(sequence[i]);
      }
    });

    it("fromState() creates RNG with restored state", () => {
      const rng1 = new SeededRandom(42);

      // Advance and save
      for (let i = 0; i < 100; i++) {
        rng1.random();
      }
      const state = rng1.getState();

      // Generate sequence from original
      const sequence: number[] = [];
      for (let i = 0; i < 100; i++) {
        sequence.push(rng1.random());
      }

      // Create new RNG from state
      const rng2 = SeededRandom.fromState(state);

      // Verify same sequence
      for (let i = 0; i < 100; i++) {
        expect(rng2.random()).toBe(sequence[i]);
      }
    });

    it("clone() creates independent copy", () => {
      const rng1 = new SeededRandom(42);
      const rng2 = rng1.clone();

      // Both should produce same sequence
      expect(rng1.random()).toBe(rng2.random());

      // But advancing one doesn't affect the other
      rng1.random();
      rng1.random();

      // rng2 is still at position 1, rng1 is at position 3
      const rng3 = new SeededRandom(42);
      rng3.random(); // Position 1
      expect(rng2.random()).toBe(rng3.random()); // Both at position 2
    });
  });

  describe("edge cases", () => {
    it("handles zero seed", () => {
      const rng = new SeededRandom(0);
      expect(rng.random()).toBeGreaterThanOrEqual(0);
      expect(rng.random()).toBeLessThan(1);
    });

    it("handles negative seed", () => {
      const rng = new SeededRandom(-12345);
      expect(rng.random()).toBeGreaterThanOrEqual(0);
      expect(rng.random()).toBeLessThan(1);
    });

    it("handles large seed", () => {
      const rng = new SeededRandom(Number.MAX_SAFE_INTEGER);
      expect(rng.random()).toBeGreaterThanOrEqual(0);
      expect(rng.random()).toBeLessThan(1);
    });

    it("nextInt(0) returns 0", () => {
      const rng = new SeededRandom(42);
      expect(rng.nextInt(0)).toBe(0);
    });

    it("nextInt(1) always returns 0", () => {
      const rng = new SeededRandom(42);
      for (let i = 0; i < 100; i++) {
        expect(rng.nextInt(1)).toBe(0);
      }
    });

    it("damageRoll(0) returns 0", () => {
      const rng = new SeededRandom(42);
      expect(rng.damageRoll(0)).toBe(0);
    });

    it("nextIntRange handles reversed min/max", () => {
      const rng = new SeededRandom(42);
      const value = rng.nextIntRange(100, 50); // Reversed
      expect(value).toBeGreaterThanOrEqual(50);
      expect(value).toBeLessThanOrEqual(100);
    });
  });

  describe("global game RNG", () => {
    beforeEach(() => {
      // Reset global state before each test
      initializeGameRng(99999);
    });

    it("initializeGameRng() returns seed", () => {
      const seed = initializeGameRng(12345);
      expect(seed).toBe(12345);
    });

    it("getGameRng() returns initialized RNG", () => {
      const rng = getGameRng();
      expect(rng).toBeInstanceOf(SeededRandom);
    });

    it("getGameSeed() returns the seed used", () => {
      initializeGameRng(54321);
      expect(getGameSeed()).toBe(54321);
    });

    it("getGameRngState() returns current state", () => {
      const state = getGameRngState();
      expect(state).not.toBeNull();
      expect(state?.state0).toBeDefined();
      expect(state?.state1).toBeDefined();
    });

    it("global RNG is deterministic", () => {
      initializeGameRng(11111);
      const rng1 = getGameRng();
      const values1 = [rng1.random(), rng1.random(), rng1.random()];

      initializeGameRng(11111);
      const rng2 = getGameRng();
      const values2 = [rng2.random(), rng2.random(), rng2.random()];

      expect(values1).toEqual(values2);
    });
  });
});
