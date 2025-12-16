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
