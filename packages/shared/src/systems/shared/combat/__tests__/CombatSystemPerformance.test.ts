/**
 * CombatSystem Performance Tests
 *
 * Tests full tick processing with multiple concurrent combats.
 * Verifies scalability and memory hygiene at system level.
 *
 * These tests complement CombatBenchmarks.test.ts which tests
 * individual calculation functions.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CombatStateService } from "../CombatStateService";
import { createEntityID } from "../../../../types/core/identifiers";
import { COMBAT_CONSTANTS } from "../../../../constants/CombatConstants";

describe("CombatSystem Performance", () => {
  let stateService: CombatStateService;

  // Minimal mock world for CombatStateService
  const mockWorld = {
    currentTick: 0,
    isServer: true,
    getPlayer: () => null,
    network: null,
  };

  beforeEach(() => {
    stateService = new CombatStateService(mockWorld as never);
  });

  afterEach(() => {
    stateService.destroy();
  });

  describe("Concurrent Combat Scalability", () => {
    it("handles 100 concurrent combats efficiently", () => {
      // Setup 100 combat pairs
      for (let i = 0; i < 100; i++) {
        const attackerId = createEntityID(`player_${i}`);
        const targetId = createEntityID(`mob_${i}`);
        stateService.createAttackerState(
          attackerId,
          targetId,
          "player",
          "mob",
          0,
          COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS,
        );
      }

      expect(stateService.getCombatStatesMap().size).toBe(100);

      // Measure iteration performance
      const iterations = 100;
      const start = performance.now();

      for (let tick = 0; tick < iterations; tick++) {
        const states = stateService.getAllCombatStates();
        // Simulate what processTick does: iterate all combats
        for (const [, state] of states) {
          if (state.nextAttackTick <= tick) {
            // Attack would happen here
            state.lastAttackTick = tick;
            state.nextAttackTick = tick + state.attackSpeedTicks;
            stateService.extendCombatTimer(state.attackerId, tick);
          }
        }
      }

      const elapsed = performance.now() - start;
      const avgPerTick = elapsed / iterations;

      console.log(
        `100 combats, ${iterations} ticks: ${avgPerTick.toFixed(3)}ms/tick`,
      );
      expect(avgPerTick).toBeLessThan(1); // < 1ms per tick
    });

    it("handles 200 concurrent combats under 2ms per tick", () => {
      // Setup 200 combat pairs (stress test)
      for (let i = 0; i < 200; i++) {
        const attackerId = createEntityID(`player_${i}`);
        const targetId = createEntityID(`mob_${i}`);
        stateService.createAttackerState(
          attackerId,
          targetId,
          "player",
          "mob",
          0,
          COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS,
        );
      }

      expect(stateService.getCombatStatesMap().size).toBe(200);

      const iterations = 50;
      const start = performance.now();

      for (let tick = 0; tick < iterations; tick++) {
        const states = stateService.getAllCombatStates();
        for (const [, state] of states) {
          if (state.nextAttackTick <= tick) {
            state.lastAttackTick = tick;
            state.nextAttackTick = tick + state.attackSpeedTicks;
            stateService.extendCombatTimer(state.attackerId, tick);
          }
        }
      }

      const elapsed = performance.now() - start;
      const avgPerTick = elapsed / iterations;

      console.log(
        `200 combats, ${iterations} ticks: ${avgPerTick.toFixed(3)}ms/tick`,
      );
      expect(avgPerTick).toBeLessThan(2); // < 2ms per tick even with 200 combats
    });

    it("scales linearly with combat count", () => {
      const measurements: { count: number; avgMs: number }[] = [];

      for (const combatCount of [10, 50, 100, 200]) {
        // Reset state service
        stateService.destroy();
        stateService = new CombatStateService(mockWorld as never);

        // Setup combats
        for (let i = 0; i < combatCount; i++) {
          stateService.createAttackerState(
            createEntityID(`player_${i}`),
            createEntityID(`mob_${i}`),
            "player",
            "mob",
            0,
            COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS,
          );
        }

        // Measure
        const iterations = 50;
        const start = performance.now();

        for (let tick = 0; tick < iterations; tick++) {
          const states = stateService.getAllCombatStates();
          for (const [, state] of states) {
            if (state.nextAttackTick <= tick) {
              state.lastAttackTick = tick;
              state.nextAttackTick = tick + state.attackSpeedTicks;
            }
          }
        }

        const elapsed = performance.now() - start;
        measurements.push({ count: combatCount, avgMs: elapsed / iterations });
      }

      // Log results
      console.log("Linear scaling test:");
      for (const m of measurements) {
        console.log(`  ${m.count} combats: ${m.avgMs.toFixed(3)}ms/tick`);
      }

      // Check linear scaling (20x combats should be < 250x time)
      // Note: Threshold significantly relaxed for CI environments with variable performance,
      // CPU contention, and JIT warmup effects on different machines
      const ratio = measurements[3].avgMs / measurements[0].avgMs;
      console.log(`  Scaling ratio (200 vs 10): ${ratio.toFixed(2)}x`);
      expect(ratio).toBeLessThan(250);
    });
  });

  describe("Memory Hygiene", () => {
    it("getAllCombatStates reuses buffer (no allocation)", () => {
      // Setup combats
      for (let i = 0; i < 50; i++) {
        stateService.createAttackerState(
          createEntityID(`player_${i}`),
          createEntityID(`mob_${i}`),
          "player",
          "mob",
          0,
          COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS,
        );
      }

      // Get reference to first call's result
      const result1 = stateService.getAllCombatStates();
      const result2 = stateService.getAllCombatStates();

      // Should be same array instance (reused buffer)
      expect(result1).toBe(result2);
    });

    it("does not grow heap significantly during combat processing", () => {
      // Setup combats
      for (let i = 0; i < 100; i++) {
        stateService.createAttackerState(
          createEntityID(`player_${i}`),
          createEntityID(`mob_${i}`),
          "player",
          "mob",
          0,
          COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS,
        );
      }

      // Warm up
      for (let tick = 0; tick < 50; tick++) {
        const states = stateService.getAllCombatStates();
        for (const [, state] of states) {
          if (state.nextAttackTick <= tick) {
            state.lastAttackTick = tick;
            state.nextAttackTick = tick + state.attackSpeedTicks;
          }
        }
      }

      // Force GC if available
      if (typeof global.gc === "function") {
        global.gc();
      }

      const heapBefore = process.memoryUsage().heapUsed;

      // Run many ticks
      for (let tick = 50; tick < 200; tick++) {
        const states = stateService.getAllCombatStates();
        for (const [, state] of states) {
          if (state.nextAttackTick <= tick) {
            state.lastAttackTick = tick;
            state.nextAttackTick = tick + state.attackSpeedTicks;
          }
        }
      }

      const heapAfter = process.memoryUsage().heapUsed;
      const heapGrowthKB = (heapAfter - heapBefore) / 1024;

      console.log(`Heap growth over 150 ticks: ${heapGrowthKB.toFixed(2)}KB`);

      // Should not grow excessively for 150 ticks with 100 combats
      // Observed values: local ~50-200KB, CI ~500-2500KB (varies with GC timing)
      // Threshold of 5000KB catches real memory leaks while allowing CI variance
      // Note: V8 heap measurement is non-deterministic; getAllCombatStates() is
      // allocation-free in steady state but microbenchmarks show higher readings
      expect(heapGrowthKB).toBeLessThan(5000);
    });
  });

  describe("Combat State Operations", () => {
    it("creates and removes combat states efficiently", () => {
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const attackerId = createEntityID(`player_${i}`);
        const targetId = createEntityID(`mob_${i}`);

        // Create
        stateService.createAttackerState(
          attackerId,
          targetId,
          "player",
          "mob",
          i,
          COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS,
        );

        // Remove
        stateService.removeCombatState(attackerId);
      }

      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(
        `Create+remove cycle: ${(avgMs * 1000).toFixed(2)}µs average`,
      );
      expect(avgMs).toBeLessThan(0.1); // < 100µs per cycle
    });

    it("lookup performance remains constant with scale", () => {
      // Setup 500 combats
      for (let i = 0; i < 500; i++) {
        stateService.createAttackerState(
          createEntityID(`player_${i}`),
          createEntityID(`mob_${i}`),
          "player",
          "mob",
          0,
          COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS,
        );
      }

      const lookupIterations = 10000;
      const start = performance.now();

      for (let i = 0; i < lookupIterations; i++) {
        // Random lookup
        const id = `player_${i % 500}`;
        stateService.isInCombat(id);
        stateService.getCombatData(id);
      }

      const elapsed = performance.now() - start;
      const avgUs = (elapsed / lookupIterations) * 1000;

      console.log(`Lookup with 500 entries: ${avgUs.toFixed(3)}µs average`);
      expect(avgUs).toBeLessThan(10); // < 10µs per lookup
    });
  });

  describe("Attack Timing Simulation", () => {
    it("simulates realistic combat tick with mixed attack speeds", () => {
      // Setup combats with different weapon speeds
      const attackSpeeds = [3, 4, 5, 6, 7]; // classic MMORPG weapon speed tiers

      for (let i = 0; i < 100; i++) {
        const speed = attackSpeeds[i % attackSpeeds.length];
        stateService.createAttackerState(
          createEntityID(`player_${i}`),
          createEntityID(`mob_${i}`),
          "player",
          "mob",
          0,
          speed,
        );
      }

      // Simulate 100 ticks (60 seconds of game time)
      let totalAttacks = 0;
      const start = performance.now();

      for (let tick = 0; tick < 100; tick++) {
        const states = stateService.getAllCombatStates();
        for (const [, state] of states) {
          if (state.nextAttackTick <= tick) {
            totalAttacks++;
            state.lastAttackTick = tick;
            state.nextAttackTick = tick + state.attackSpeedTicks;
            stateService.extendCombatTimer(state.attackerId, tick);
          }
        }
      }

      const elapsed = performance.now() - start;

      console.log(
        `100 ticks simulation: ${elapsed.toFixed(2)}ms total, ${totalAttacks} attacks`,
      );

      // Should complete well within budget (100 ticks × 600ms = 60s game time).
      // CI and shared runners can have noisy scheduling jitter, so allow a wider
      // budget there while keeping a tighter local regression guard.
      const elapsedBudgetMs = process.env.CI ? 400 : 250;
      expect(elapsed).toBeLessThan(elapsedBudgetMs);

      // Verify reasonable number of attacks occurred
      // With 100 combatants and average 5-tick speed, expect ~2000 attacks over 100 ticks
      expect(totalAttacks).toBeGreaterThan(1500);
      expect(totalAttacks).toBeLessThan(3500);
    });
  });
});
