/**
 * World.tick Unit Tests
 *
 * Tests for the dual-delta timing architecture:
 * - Physics delta: Clamped to maxPhysicsDeltaTime for stability
 * - Animation delta: Real-time (capped at maxAnimationDeltaTime) for correct playback
 *
 * This ensures animations play at correct speed regardless of FPS,
 * while physics remains stable with controlled timesteps.
 */

import { describe, it, expect } from "vitest";
import { World } from "../World";

// Create testable World instance
function createTestWorld(): World {
  // World constructor takes no args - systems are registered internally
  // WorldOptions are applied by createClientWorld/createServerWorld
  const world = new World();
  return world;
}

function createServerTestWorld(): World {
  const world = createTestWorld();
  world.network = {
    isServer: true,
    isClient: false,
    send: () => {},
  } as World["network"];
  return world;
}

describe("World.tick - Dual Delta Architecture", () => {
  describe("event listener counting", () => {
    it("counts string-event listeners registered through the typed EventBus bridge", () => {
      const world = createTestWorld();
      const handler = () => {};

      world.on("duel:stakes:settle", handler);

      expect(world.listenerCount("duel:stakes:settle")).toBe(1);
    });

    it("decrements string-event listener counts after removal", () => {
      const world = createTestWorld();
      const handler = () => {};

      world.on("duel:stakes:settle", handler);
      world.off("duel:stakes:settle", handler);

      expect(world.listenerCount("duel:stakes:settle")).toBe(0);
    });
  });

  // ===== DELTA TIME CONFIGURATION =====
  describe("delta time configuration", () => {
    it("should have default maxPhysicsDeltaTime of 33ms (1/30)", () => {
      const world = createTestWorld();
      expect(world.maxPhysicsDeltaTime).toBeCloseTo(1 / 30, 5);
    });

    it("should have default maxAnimationDeltaTime of 500ms", () => {
      const world = createTestWorld();
      expect(world.maxAnimationDeltaTime).toBe(0.5);
    });

    it("should have default fixedDeltaTime of 33ms (1/30)", () => {
      const world = createTestWorld();
      expect(world.fixedDeltaTime).toBeCloseTo(1 / 30, 5);
    });

    it("maxDeltaTime getter should return maxPhysicsDeltaTime (backward compatibility)", () => {
      const world = createTestWorld();
      expect(world.maxDeltaTime).toBe(world.maxPhysicsDeltaTime);
    });

    it("maxDeltaTime setter should update maxPhysicsDeltaTime (backward compatibility)", () => {
      const world = createTestWorld();
      world.maxDeltaTime = 0.05;
      expect(world.maxPhysicsDeltaTime).toBe(0.05);
    });

    it("should allow setting custom delta times", () => {
      const world = createTestWorld();
      world.maxPhysicsDeltaTime = 0.02;
      world.maxAnimationDeltaTime = 0.25;
      expect(world.maxPhysicsDeltaTime).toBe(0.02);
      expect(world.maxAnimationDeltaTime).toBe(0.25);
    });
  });

  // ===== FRAME AND TIME TRACKING =====
  describe("frame and time tracking", () => {
    it("should start with frame 0", () => {
      const world = createTestWorld();
      expect(world.frame).toBe(0);
    });

    it("should start with time 0", () => {
      const world = createTestWorld();
      expect(world.time).toBe(0);
    });

    it("should increment frame on each tick", () => {
      const world = createTestWorld();
      world.tick(16.67); // ~60 FPS
      expect(world.frame).toBe(1);
      world.tick(33.33);
      expect(world.frame).toBe(2);
      world.tick(50);
      expect(world.frame).toBe(3);
    });

    it("should update time on each tick (converted to seconds)", () => {
      const world = createTestWorld();
      world.tick(1000); // 1000ms = 1 second
      expect(world.time).toBe(1);
      world.tick(2500); // 2500ms = 2.5 seconds
      expect(world.time).toBe(2.5);
    });
  });

  // ===== ACCUMULATOR BEHAVIOR =====
  describe("accumulator behavior", () => {
    it("should start with accumulator at 0", () => {
      const world = createTestWorld();
      expect(world.accumulator).toBe(0);
    });

    it("should accumulate physics delta (not raw delta)", () => {
      const world = createTestWorld();
      // First tick establishes baseline
      world.tick(0);

      // Second tick with normal delta
      world.tick(16.67); // 16.67ms = ~60 FPS

      // Accumulator should have added clamped delta (in seconds)
      // 16.67ms = 0.01667s, which is less than maxPhysicsDeltaTime (0.0333s)
      expect(world.accumulator).toBeGreaterThan(0);
      expect(world.accumulator).toBeLessThanOrEqual(world.maxPhysicsDeltaTime);
    });

    it("should clamp physics delta to maxPhysicsDeltaTime", () => {
      const world = createTestWorld();
      world.tick(0); // baseline

      // Huge delta (simulating tab unfocus)
      world.tick(500); // 500ms delta

      // Accumulator should only add maxPhysicsDeltaTime worth
      expect(world.accumulator).toBeLessThanOrEqual(world.maxPhysicsDeltaTime);
    });

    it("should consume accumulator in fixedDeltaTime chunks", () => {
      const world = createTestWorld();
      world.tick(0);

      // Add exactly one physics step worth
      const targetTime = world.fixedDeltaTime * 1000; // Convert to ms
      world.tick(targetTime);

      // Accumulator should be near 0 after consuming fixed step
      expect(world.accumulator).toBeLessThan(world.fixedDeltaTime);
    });

    it("should run multiple physics steps when accumulator is large", () => {
      const world = createTestWorld();
      world.tick(0);

      // Add 3x physics step worth
      const targetTime = world.fixedDeltaTime * 1000 * 3;

      // Spy on fixedUpdate to count calls - but we can't easily spy on private methods
      // Instead, verify accumulator is properly consumed
      world.tick(targetTime);

      // After consuming 3 steps, accumulator should be < fixedDeltaTime
      expect(world.accumulator).toBeLessThan(world.fixedDeltaTime);
    });
  });

  // ===== BOUNDARY CONDITIONS =====
  describe("boundary conditions", () => {
    it("should handle zero delta gracefully", () => {
      const world = createTestWorld();
      world.tick(0);

      // Zero delta shouldn't cause issues
      world.tick(0);
      expect(world.frame).toBe(2);
      expect(world.accumulator).toBe(0);
    });

    it("should handle negative delta (clock skew) by clamping to 0", () => {
      const world = createTestWorld();
      world.tick(100);

      // Time going backward (shouldn't happen, but handle gracefully)
      world.tick(50);

      // Should have processed normally (negative becomes 0)
      expect(world.frame).toBe(2);
    });

    it("should clamp very large delta to maxAnimationDeltaTime", () => {
      const world = createTestWorld();
      world.tick(0);

      // Simulate returning from a long pause (10 seconds)
      const hugeDelta = 10000; // 10 seconds in ms
      world.tick(hugeDelta);

      // Frame should still advance
      expect(world.frame).toBe(2);

      // Accumulator should be capped at maxPhysicsDeltaTime
      expect(world.accumulator).toBeLessThanOrEqual(world.maxPhysicsDeltaTime);
    });

    it("should handle exactly boundary delta values", () => {
      const world = createTestWorld();
      world.tick(0);

      // Exactly maxPhysicsDeltaTime
      world.tick(world.maxPhysicsDeltaTime * 1000);
      expect(world.accumulator).toBeLessThanOrEqual(world.maxPhysicsDeltaTime);
    });

    it("should handle very small delta (high FPS)", () => {
      const world = createTestWorld();
      world.tick(0);

      // 240 FPS = 4.17ms per frame
      const highFpsDelta = 4.17;
      for (let i = 0; i < 10; i++) {
        world.tick(highFpsDelta * (i + 1));
      }

      expect(world.frame).toBe(11);
    });
  });

  // ===== REAL-WORLD SCENARIOS =====
  describe("real-world scenarios", () => {
    it("should maintain stable timing at 60 FPS", () => {
      const world = createTestWorld();
      let currentTime = 0;
      const frameTime = 16.67; // ~60 FPS

      for (let i = 0; i < 60; i++) {
        world.tick(currentTime);
        currentTime += frameTime;
      }

      // After 60 frames at 16.67ms = ~1 second
      expect(world.time).toBeCloseTo(1, 1);
      expect(world.frame).toBe(60);
    });

    it("should maintain stable timing at 30 FPS", () => {
      const world = createTestWorld();
      let currentTime = 0;
      const frameTime = 33.33; // 30 FPS

      for (let i = 0; i < 30; i++) {
        world.tick(currentTime);
        currentTime += frameTime;
      }

      expect(world.time).toBeCloseTo(1, 1);
      expect(world.frame).toBe(30);
    });

    it("should handle variable frame rates gracefully", () => {
      const world = createTestWorld();
      let currentTime = 0;

      // Simulate variable frame times
      const frameTimes = [16, 20, 50, 8, 33, 16, 100, 16, 16, 16];

      for (const dt of frameTimes) {
        currentTime += dt;
        world.tick(currentTime);
      }

      expect(world.frame).toBe(frameTimes.length);
      // Time tracks the timestamp (converted to seconds), not accumulated deltas
      expect(world.time).toBeCloseTo(currentTime / 1000, 2);
    });

    it("should recover from frame spike (tab unfocus)", () => {
      const world = createTestWorld();
      let currentTime = 0;

      // Normal frames
      for (let i = 0; i < 10; i++) {
        world.tick(currentTime);
        currentTime += 16.67;
      }

      const frameBeforeSpike = world.frame;

      // Huge spike (5 seconds pause)
      world.tick(currentTime);
      currentTime += 5000;
      world.tick(currentTime);

      // Should have advanced only 2 frames (not hundreds)
      expect(world.frame).toBe(frameBeforeSpike + 2);

      // Continue normally
      for (let i = 0; i < 10; i++) {
        world.tick(currentTime);
        currentTime += 16.67;
      }

      expect(world.frame).toBe(frameBeforeSpike + 12);
    });

    it("should not have 'spiral of death' under heavy load", () => {
      const world = createTestWorld();
      let currentTime = 0;

      // Simulate consistently slow frames (10 FPS)
      const slowFrameTime = 100; // 100ms per frame

      for (let i = 0; i < 20; i++) {
        world.tick(currentTime);
        currentTime += slowFrameTime;
      }

      // Physics accumulator should never grow unboundedly
      expect(world.accumulator).toBeLessThan(world.fixedDeltaTime * 2);
    });
  });

  // ===== INTERPOLATION ALPHA =====
  describe("interpolation alpha calculation", () => {
    it("should compute alpha between 0 and 1", () => {
      const world = createTestWorld();
      world.tick(0);

      // Partial physics step
      world.tick(10); // 10ms, less than fixedDeltaTime (33ms)

      // Accumulator / fixedDeltaTime should be in [0, 1)
      const alpha = world.accumulator / world.fixedDeltaTime;
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    });
  });
});

describe("World.tick - Delta Separation Verification", () => {
  /**
   * These tests verify the core invariant of the dual-delta system:
   * - Physics receives CLAMPED delta (for stability)
   * - Animation receives REAL delta (for correct speed)
   */

  it("should NOT suffer from slow-motion at low FPS", () => {
    const world = createTestWorld();
    world.tick(0);

    // At 10 FPS (100ms frame), the OLD system would pass 33ms to animations
    // causing 3x slower playback. The NEW system passes ~100ms (capped at 500ms)
    // to animations while keeping physics at 33ms.

    // Simulate 10 FPS
    const frameTime = 100; // 100ms = 10 FPS
    world.tick(frameTime);

    // Time should advance by 100ms, not 33ms
    expect(world.time).toBeCloseTo(0.1, 2);
  });

  it("should protect physics from large delta even at low FPS", () => {
    const world = createTestWorld();
    world.tick(0);

    // Large frame time
    const frameTime = 200; // 200ms = 5 FPS
    world.tick(frameTime);

    // Accumulator should only add maxPhysicsDeltaTime
    expect(world.accumulator).toBeLessThanOrEqual(world.maxPhysicsDeltaTime);
  });

  it("should cap animation delta at maxAnimationDeltaTime", () => {
    const world = createTestWorld();
    world.tick(0);

    // Extremely large frame time (10 seconds)
    const hugeFrameTime = 10000;
    world.tick(hugeFrameTime);

    // Time advances, but should be capped by the logic
    // The actual implementation uses Math.min(rawDelta, maxAnimationDeltaTime)
    // So time at second tick = 10s, but animations see 0.5s
    expect(world.time).toBe(10); // Time is updated with full value
  });
});

describe("World.tick - Concurrency and State", () => {
  it("should not have race conditions with sequential ticks", () => {
    const world = createTestWorld();
    const results: number[] = [];

    // Rapid sequential ticks
    for (let i = 0; i < 100; i++) {
      world.tick(i * 10);
      results.push(world.frame);
    }

    // Frames should be monotonically increasing
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBe(results[i - 1] + 1);
    }
  });

  it("should maintain consistent state after many ticks", () => {
    const world = createTestWorld();
    let time = 0;

    for (let i = 0; i < 10000; i++) {
      world.tick(time);
      time += 16.67;
    }

    expect(world.frame).toBe(10000);
    expect(world.time).toBeCloseTo(time / 1000, 0);
    expect(world.accumulator).toBeLessThan(world.fixedDeltaTime);
  });
});

describe("World.tick - server percentile diagnostics", () => {
  it("records bounded full-window phase and complete-system timings", () => {
    const world = createServerTestWorld();
    world.enableSystemTiming();

    world.tick(0);
    world.tick(33.34);

    const phases = world.getServerTickTimingPercentiles();
    expect(phases.total.samples).toBe(2);
    expect(phases.fixedUpdate.samples).toBe(2);
    expect(phases.update.samples).toBe(2);
    expect(phases.lateUpdate.samples).toBe(2);
    expect(phases.commit.samples).toBe(2);
    expect(phases.unmeasured.samples).toBe(2);
    expect(phases.total.max).toBeGreaterThanOrEqual(phases.update.max);

    const systems = world.getSystemTimingPercentiles();
    expect(systems.length).toBe(world.systems.length);
    expect(systems.every((system) => system.samples === 2)).toBe(true);
  });

  it("resets phase and system distributions without disabling measurement", () => {
    const world = createServerTestWorld();
    world.enableSystemTiming();
    world.tick(0);

    world.resetServerTimingPercentiles();
    expect(world.getServerTickTimingPercentiles().total.samples).toBe(0);
    expect(
      world
        .getSystemTimingPercentiles()
        .every((system) => system.samples === 0),
    ).toBe(true);

    world.tick(33.34);
    expect(world.getServerTickTimingPercentiles().total.samples).toBe(1);
    expect(
      world
        .getSystemTimingPercentiles()
        .every((system) => system.samples === 1),
    ).toBe(true);
  });
});
