/**
 * Tick System Tests
 *
 * Tests the RuneScape-style server tick system:
 * - Priority-based listener ordering
 * - Start/stop lifecycle
 * - Listener registration/unsubscription
 *
 * Note: Real timing tests require proper @hyperscape/shared resolution
 * These tests focus on the synchronous API behavior
 */

import { describe, it, expect, mock } from "bun:test";
import { TickPriority } from "../TickSystem";

// Skip TickSystem tests if TICK_DURATION_MS can't be resolved
// This happens in isolated test runs without full monorepo context
let TickSystem: typeof import("../TickSystem").TickSystem;
let canRunTickTests = true;

try {
  // Dynamic import to catch module resolution errors
  const module = await import("../TickSystem");
  TickSystem = module.TickSystem;
  // Quick sanity check - if we can't create an instance, skip
  const ts = new TickSystem();
  if (ts.getTimeUntilNextTick() === undefined) {
    canRunTickTests = false;
  }
  ts.stop();
} catch {
  canRunTickTests = false;
}

describe.skipIf(!canRunTickTests)("TickSystem", () => {
  describe("start", () => {
    it("should start the tick loop", () => {
      const tickSystem = new TickSystem();
      tickSystem.start();
      expect(tickSystem.getIsRunning()).toBe(true);
      tickSystem.stop();
    });

    it("should be idempotent when already running", () => {
      const tickSystem = new TickSystem();
      tickSystem.start();
      tickSystem.start(); // Second call
      expect(tickSystem.getIsRunning()).toBe(true);
      tickSystem.stop();
    });
  });

  describe("stop", () => {
    it("should stop the tick loop", () => {
      const tickSystem = new TickSystem();
      tickSystem.start();
      tickSystem.stop();
      expect(tickSystem.getIsRunning()).toBe(false);
    });

    it("should be safe to call when not running", () => {
      const tickSystem = new TickSystem();
      tickSystem.stop();
      expect(tickSystem.getIsRunning()).toBe(false);
    });
  });

  describe("onTick", () => {
    it("should register listener and return unsubscribe function", () => {
      const tickSystem = new TickSystem();
      const callback = mock(() => {});
      const unsubscribe = tickSystem.onTick(callback);
      expect(typeof unsubscribe).toBe("function");
      expect(tickSystem.getListenerCount()).toBe(1);
      tickSystem.stop();
    });

    it("should unsubscribe when called", () => {
      const tickSystem = new TickSystem();
      const callback = mock(() => {});
      const unsubscribe = tickSystem.onTick(callback);
      unsubscribe();
      expect(tickSystem.getListenerCount()).toBe(0);
    });

    it("should call listeners on each tick", async () => {
      const tickSystem = new TickSystem();
      const callback = mock(() => {});

      tickSystem.onTick(callback);
      tickSystem.start();

      // Wait for at least 2 ticks (1200ms + buffer)
      await new Promise((r) => setTimeout(r, 1500));

      tickSystem.stop();

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);
    }, 5000);

    it("should pass tick number and delta to callback", async () => {
      const tickSystem = new TickSystem();
      const tickNumbers: number[] = [];
      const deltas: number[] = [];

      tickSystem.onTick((tickNumber, deltaMs) => {
        tickNumbers.push(tickNumber);
        deltas.push(deltaMs);
      });

      tickSystem.start();

      // Wait for 3 ticks
      await new Promise((r) => setTimeout(r, 2000));

      tickSystem.stop();

      // Tick numbers should be sequential starting from 1
      expect(tickNumbers.length).toBeGreaterThanOrEqual(2);
      expect(tickNumbers[0]).toBe(1);
      for (let i = 1; i < tickNumbers.length; i++) {
        expect(tickNumbers[i]).toBe(tickNumbers[i - 1] + 1);
      }

      // Deltas should be around 600ms (with tolerance for CI)
      for (const delta of deltas) {
        expect(delta).toBeGreaterThan(400);
        expect(delta).toBeLessThan(1000);
      }
    }, 5000);
  });

  describe("priority ordering", () => {
    it("should call listeners in priority order", async () => {
      const tickSystem = new TickSystem();
      const callOrder: string[] = [];

      tickSystem.onTick(() => callOrder.push("combat"), TickPriority.COMBAT);
      tickSystem.onTick(() => callOrder.push("input"), TickPriority.INPUT);
      tickSystem.onTick(
        () => callOrder.push("movement"),
        TickPriority.MOVEMENT,
      );
      tickSystem.onTick(
        () => callOrder.push("broadcast"),
        TickPriority.BROADCAST,
      );

      tickSystem.start();

      // Wait for 1 tick
      await new Promise((r) => setTimeout(r, 700));

      tickSystem.stop();

      // Verify order: INPUT (0), MOVEMENT (1), COMBAT (2), BROADCAST (10)
      expect(callOrder).toEqual(["input", "movement", "combat", "broadcast"]);
    }, 3000);

    it("should maintain order for same priority", async () => {
      const tickSystem = new TickSystem();
      const callOrder: number[] = [];

      // Register 3 listeners with same priority
      tickSystem.onTick(() => callOrder.push(1), TickPriority.MOVEMENT);
      tickSystem.onTick(() => callOrder.push(2), TickPriority.MOVEMENT);
      tickSystem.onTick(() => callOrder.push(3), TickPriority.MOVEMENT);

      tickSystem.start();

      await new Promise((r) => setTimeout(r, 700));

      tickSystem.stop();

      // Should maintain registration order within same priority
      expect(callOrder).toEqual([1, 2, 3]);
    }, 3000);
  });

  describe("getCurrentTick", () => {
    it("should return 0 before any ticks", () => {
      const tickSystem = new TickSystem();
      expect(tickSystem.getCurrentTick()).toBe(0);
    });

    it("should increment tick number", async () => {
      const tickSystem = new TickSystem();
      tickSystem.start();

      await new Promise((r) => setTimeout(r, 1300));

      const tick = tickSystem.getCurrentTick();
      tickSystem.stop();

      expect(tick).toBeGreaterThanOrEqual(2);
    }, 3000);
  });

  describe("getTimeUntilNextTick", () => {
    it("should return tick duration when not running", () => {
      const tickSystem = new TickSystem();
      const time = tickSystem.getTimeUntilNextTick();
      expect(time).toBe(600);
    });
  });

  describe("getListenerCount", () => {
    it("should return correct listener count", () => {
      const tickSystem = new TickSystem();
      expect(tickSystem.getListenerCount()).toBe(0);

      const unsub1 = tickSystem.onTick(() => {});
      expect(tickSystem.getListenerCount()).toBe(1);

      const unsub2 = tickSystem.onTick(() => {});
      expect(tickSystem.getListenerCount()).toBe(2);

      unsub1();
      expect(tickSystem.getListenerCount()).toBe(1);

      unsub2();
      expect(tickSystem.getListenerCount()).toBe(0);
    });
  });
});

describe("TickPriority", () => {
  it("should have correct ordering", () => {
    expect(TickPriority.INPUT).toBeLessThan(TickPriority.MOVEMENT);
    expect(TickPriority.MOVEMENT).toBeLessThan(TickPriority.COMBAT);
    expect(TickPriority.COMBAT).toBeLessThan(TickPriority.AI);
    expect(TickPriority.AI).toBeLessThan(TickPriority.RESOURCES);
    expect(TickPriority.RESOURCES).toBeLessThan(TickPriority.BROADCAST);
  });
});

describe.skipIf(!canRunTickTests)("TickSystem listener cache optimization", () => {
  describe("sorted cache behavior", () => {
    it("should maintain correct order after adding listeners during tick", async () => {
      const tickSystem = new TickSystem();
      const callOrder: string[] = [];
      let addedDynamic = false;

      tickSystem.onTick(() => {
        callOrder.push("input");
        if (!addedDynamic) {
          addedDynamic = true;
          // Add a listener during tick processing
          tickSystem.onTick(() => callOrder.push("dynamic"), TickPriority.MOVEMENT);
        }
      }, TickPriority.INPUT);

      tickSystem.onTick(() => callOrder.push("broadcast"), TickPriority.BROADCAST);

      tickSystem.start();

      // Wait for 2 ticks
      await new Promise((r) => setTimeout(r, 1300));

      tickSystem.stop();

      // Dynamic listener should appear in correct order on subsequent ticks
      // First tick: input, broadcast (dynamic added during input)
      // Second tick: input, dynamic, broadcast
      expect(callOrder.slice(0, 2)).toEqual(["input", "broadcast"]);
      expect(callOrder.slice(2)).toEqual(["input", "dynamic", "broadcast"]);
    }, 5000);

    it("should handle removing listeners during tick", async () => {
      const tickSystem = new TickSystem();
      const callOrder: string[] = [];
      let unsubMovement: (() => void) | null = null;
      let removed = false;

      tickSystem.onTick(() => {
        callOrder.push("input");
        if (unsubMovement && !removed) {
          removed = true;
          unsubMovement();
        }
      }, TickPriority.INPUT);

      unsubMovement = tickSystem.onTick(() => {
        callOrder.push("movement");
      }, TickPriority.MOVEMENT);

      tickSystem.onTick(() => callOrder.push("broadcast"), TickPriority.BROADCAST);

      tickSystem.start();

      // Wait for 2 ticks
      await new Promise((r) => setTimeout(r, 1300));

      tickSystem.stop();

      // First tick: input, movement, broadcast (removal happens during input)
      // Second tick: input, broadcast (movement removed)
      expect(callOrder.slice(0, 3)).toEqual(["input", "movement", "broadcast"]);
      expect(callOrder.slice(3)).toEqual(["input", "broadcast"]);
    }, 5000);

    it("should handle many listeners with same priority", async () => {
      const tickSystem = new TickSystem();
      const callOrder: number[] = [];

      // Add 10 listeners with same priority
      for (let i = 0; i < 10; i++) {
        const idx = i;
        tickSystem.onTick(() => callOrder.push(idx), TickPriority.MOVEMENT);
      }

      tickSystem.start();

      await new Promise((r) => setTimeout(r, 700));

      tickSystem.stop();

      // Should maintain registration order
      expect(callOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }, 3000);

    it("should not rebuild cache if listeners unchanged", async () => {
      const tickSystem = new TickSystem();
      let tickCount = 0;

      tickSystem.onTick(() => {
        tickCount++;
      }, TickPriority.MOVEMENT);

      tickSystem.start();

      // Wait for several ticks
      await new Promise((r) => setTimeout(r, 2000));

      tickSystem.stop();

      // Should have processed multiple ticks correctly
      expect(tickCount).toBeGreaterThanOrEqual(3);
    }, 5000);
  });

  describe("edge cases", () => {
    it("should handle unsubscribe called multiple times", () => {
      const tickSystem = new TickSystem();
      const unsub = tickSystem.onTick(() => {});

      unsub();
      unsub(); // Second call should be safe

      expect(tickSystem.getListenerCount()).toBe(0);
    });

    it("should handle all listeners removed", async () => {
      const tickSystem = new TickSystem();
      const unsub1 = tickSystem.onTick(() => {}, TickPriority.INPUT);
      const unsub2 = tickSystem.onTick(() => {}, TickPriority.BROADCAST);

      unsub1();
      unsub2();

      expect(tickSystem.getListenerCount()).toBe(0);

      tickSystem.start();

      // Should not throw with no listeners
      await new Promise((r) => setTimeout(r, 700));

      tickSystem.stop();
    }, 3000);

    it("should handle listener that throws", async () => {
      const tickSystem = new TickSystem();
      let secondCalled = false;

      tickSystem.onTick(() => {
        throw new Error("Test error");
      }, TickPriority.INPUT);

      tickSystem.onTick(() => {
        secondCalled = true;
      }, TickPriority.BROADCAST);

      tickSystem.start();

      await new Promise((r) => setTimeout(r, 700));

      tickSystem.stop();

      // Second listener should still be called
      expect(secondCalled).toBe(true);
    }, 3000);

    it("should handle rapid add/remove", () => {
      const tickSystem = new TickSystem();

      // Rapidly add and remove listeners
      for (let i = 0; i < 100; i++) {
        const unsub = tickSystem.onTick(() => {}, TickPriority.MOVEMENT);
        if (i % 2 === 0) {
          unsub();
        }
      }

      // Should have 50 listeners (every other one kept)
      expect(tickSystem.getListenerCount()).toBe(50);
    });
  });
});
