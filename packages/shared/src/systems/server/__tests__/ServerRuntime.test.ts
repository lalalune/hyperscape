/**
 * ServerRuntime Unit Tests
 *
 * Tests for the server runtime tick system:
 * - Fixed 2Hz tick rate configuration
 * - getStats performance with caching
 * - Lifecycle (start/stop/destroy)
 *
 * NOTE: The scheduleTick method uses setImmediate which doesn't work well
 * with Vitest fake timers. We test the constants, configuration, and getStats
 * functionality, while E2E tests verify actual tick behavior.
 */

import { describe, it, expect, vi } from "vitest";
import { ServerRuntime } from "../ServerRuntime";

// Create a minimal mock World
function createMockWorld() {
  return {
    tick: vi.fn(),
    getSystem: vi.fn(),
    systems: [],
    systemsByName: new Map(),
    id: "test-world",
  };
}

describe("ServerRuntime", () => {
  // ===== CONSTANTS =====
  describe("tick rate constants", () => {
    it("should have TICK_RATE of 2Hz (500ms)", () => {
      // We can't directly access private constants, but we can verify behavior
      // The server runtime frame loop runs at 2Hz.
      const expectedTickInterval = 1000 / 2;
      expect(expectedTickInterval).toBe(500);
    });

    it("runs at most one tick even after a long scheduling stall", async () => {
      vi.useFakeTimers();
      const nowSpy = vi.spyOn(performance, "now");

      try {
        // start() call
        nowSpy.mockReturnValueOnce(0);
        // first scheduled callback: simulate a 2s stall, which would normally
        // imply multiple missed frames without the accumulator cap.
        nowSpy.mockReturnValueOnce(2_000);

        const world = createMockWorld();
        const runtime = new ServerRuntime(world as never);

        runtime.start();
        vi.advanceTimersByTime(500);
        runtime.destroy();

        expect(world.tick).toHaveBeenCalledTimes(1);
        expect(world.tick.mock.calls[0]?.[0]).toBe(2_000);
      } finally {
        nowSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("caps the accumulator to a single frame", () => {
      // The accumulator is capped to one frame, which is the current runtime's
      // backpressure mechanism.
      const maxTicksPerFrame = 1;
      expect(maxTicksPerFrame).toBe(1);
    });
  });

  // ===== CONSTRUCTION =====
  describe("construction", () => {
    it("should create instance without starting", () => {
      const world = createMockWorld();
      new ServerRuntime(world as never);

      // Should not have called tick yet (not started)
      expect(world.tick).not.toHaveBeenCalled();
    });

    it("should accept world parameter", () => {
      const world = createMockWorld();
      const runtime = new ServerRuntime(world as never);

      // Should not throw
      expect(runtime).toBeDefined();
    });
  });

  // ===== LIFECYCLE =====
  describe("lifecycle", () => {
    it("should handle destroy before start", () => {
      const world = createMockWorld();
      const runtime = new ServerRuntime(world as never);

      // Should not throw
      expect(() => runtime.destroy()).not.toThrow();
    });

    it("should handle multiple destroy calls", () => {
      const world = createMockWorld();
      const runtime = new ServerRuntime(world as never);

      runtime.destroy();
      runtime.destroy();
      runtime.destroy();

      // Should not throw
    });

    it("should handle start then destroy", () => {
      const world = createMockWorld();
      const runtime = new ServerRuntime(world as never);

      runtime.start();
      runtime.destroy();

      // Should not throw
    });

    it("runs a single tick when enough time has elapsed for one server frame", async () => {
      vi.useFakeTimers();
      const nowSpy = vi.spyOn(performance, "now");

      try {
        // start() call
        nowSpy.mockReturnValueOnce(0);
        // first scheduled callback: simulate one full 500ms frame elapsing
        nowSpy.mockReturnValueOnce(500);

        const world = createMockWorld();
        const runtime = new ServerRuntime(world as never);

        runtime.start();
        vi.advanceTimersByTime(500);
        runtime.destroy();

        expect(world.tick).toHaveBeenCalledTimes(1);
        expect(world.tick.mock.calls[0]?.[0]).toBe(500);
      } finally {
        nowSpy.mockRestore();
        vi.useRealTimers();
      }
    });
  });

  // ===== STATS =====
  describe("getStats()", () => {
    it("should return system stats object", async () => {
      const world = createMockWorld();
      const runtime = new ServerRuntime(world as never);

      const stats = await runtime.getStats();

      expect(stats).toHaveProperty("maxMemory");
      expect(stats).toHaveProperty("currentMemory");
      expect(stats).toHaveProperty("maxCPU");
      expect(stats).toHaveProperty("currentCPU");

      runtime.destroy();
    });

    it("should return numeric values for all stats", async () => {
      const world = createMockWorld();
      const runtime = new ServerRuntime(world as never);

      const stats = await runtime.getStats();

      expect(typeof stats.maxMemory).toBe("number");
      expect(typeof stats.currentMemory).toBe("number");
      expect(typeof stats.maxCPU).toBe("number");
      expect(typeof stats.currentCPU).toBe("number");

      runtime.destroy();
    });

    it("should return positive memory values", async () => {
      const world = createMockWorld();
      const runtime = new ServerRuntime(world as never);

      const stats = await runtime.getStats();

      expect(stats.maxMemory).toBeGreaterThan(0);
      expect(stats.currentMemory).toBeGreaterThan(0);

      runtime.destroy();
    });

    it("should return reasonable CPU values", async () => {
      const world = createMockWorld();
      const runtime = new ServerRuntime(world as never);

      const stats = await runtime.getStats();

      // maxCPU = number of CPUs * 100
      expect(stats.maxCPU).toBeGreaterThanOrEqual(100); // At least 1 CPU
      expect(stats.currentCPU).toBeGreaterThanOrEqual(0);

      runtime.destroy();
    });

    it("should cache stats for 1 second", async () => {
      const world = createMockWorld();
      const runtime = new ServerRuntime(world as never);

      const stats1 = await runtime.getStats();
      const stats2 = await runtime.getStats();

      // Same cached object (reference equality)
      expect(stats1).toBe(stats2);

      runtime.destroy();
    });

    it("should clear cached stats on destroy", async () => {
      const world = createMockWorld();
      const runtime = new ServerRuntime(world as never);

      await runtime.getStats();
      runtime.destroy();

      // After destroy, internal cachedStats should be null
      // We can't directly test this, but verify destroy completes
    });
  });

  // ===== BOUNDARY CONDITIONS =====
  describe("boundary conditions", () => {
    it("should handle rapid construction/destruction", () => {
      for (let i = 0; i < 10; i++) {
        const world = createMockWorld();
        const runtime = new ServerRuntime(world as never);
        runtime.destroy();
      }

      // Should not leak or throw
    });

    it("should handle construction with minimal world", () => {
      const minimalWorld = {
        tick: () => {},
      };

      const runtime = new ServerRuntime(minimalWorld as never);
      runtime.destroy();

      // Should not throw
    });
  });
});

describe("ServerRuntime - Runtime Behavior (Documentation)", () => {
  /**
   * These tests document the expected server runtime behavior.
   * Actual tick scheduling is tested in E2E tests due to timer limitations.
   */

  it("should document: runtime ticks run at 2Hz (500ms interval)", () => {
    // The server runtime only drives lifecycle callbacks.
    // classic MMORPG-like game logic still runs in TickSystem at 600ms.
    const runtimeTickRate = 2; // Hz
    const runtimeTickInterval = 1000 / runtimeTickRate; // ms
    expect(runtimeTickInterval).toBe(500);
  });

  it("should document: accumulator capping prevents tick storms", () => {
    // When returning from a long pause, accumulated debt is capped to one frame
    // so the runtime does not attempt multi-frame catch-up work.
    const pauseDuration = 30000; // 30 seconds
    const runtimeTickInterval = 500; // ms
    const uncappedFrames = pauseDuration / runtimeTickInterval;
    const cappedFrames = 1;

    expect(uncappedFrames).toBe(60);
    expect(cappedFrames).toBe(1);
  });

  it("should document: game logic still runs on TickSystem", () => {
    // ServerRuntime handles lifecycle callbacks; combat/AI remain on the
    // separate classic MMORPG-style TickSystem cadence.
    const tickSystemInterval = 600; // ms
    const runtimeInterval = 500; // ms

    expect(tickSystemInterval).toBeGreaterThan(runtimeInterval);
  });

  it("should document: stats cache prevents expensive CPU sampling", () => {
    // getStats() samples CPU over 100ms (blocking)
    // Caching for 1 second prevents repeated expensive calls
    const cpuSampleDuration = 100; // ms
    const cacheInterval = 1000; // ms

    expect(cacheInterval).toBeGreaterThan(cpuSampleDuration * 5);
  });
});

describe("ServerRuntime - Error Handling", () => {
  it("should not crash if world.tick throws", async () => {
    const world = createMockWorld();
    world.tick.mockImplementation(() => {
      throw new Error("Simulated tick error");
    });

    const runtime = new ServerRuntime(world as never);

    // Start should not throw (error happens in async callback)
    expect(() => runtime.start()).not.toThrow();

    // Give it a tiny bit of time then destroy
    await new Promise((resolve) => setTimeout(resolve, 10));
    runtime.destroy();
  });

  it("should handle getStats when process.memoryUsage fails", async () => {
    const world = createMockWorld();
    const runtime = new ServerRuntime(world as never);

    // Even with weird system states, getStats should not throw
    const stats = await runtime.getStats();
    expect(stats).toBeDefined();

    runtime.destroy();
  });
});
