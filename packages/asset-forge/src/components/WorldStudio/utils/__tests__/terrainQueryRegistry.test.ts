/**
 * `terrainQueryRegistry` — singleton bridge tests.
 *
 * The agent placement dispatcher enqueues "re-snap once a
 * querier is available" callbacks via this registry. Bug #2's
 * deferred-snap mechanism (callbacks fire exactly once on the
 * first registration after enqueue) is critical for the
 * "agent emits a placement during onboarding before the scene
 * is ready" path. Tests lock the contract:
 *
 *   - `registerTerrainQuerier` swaps the active singleton and
 *     returns a disposer
 *   - `onQuerierReady` fires synchronously when a querier is
 *     already registered, otherwise enqueues for next register
 *   - Pending callbacks fire on register and are drained (each
 *     runs exactly once)
 *   - Disposers only clear active when called for the
 *     currently-active querier (last-registered-wins doesn't
 *     unregister an earlier disposer)
 *   - Reader helpers (`getTerrainHeightAt`, `getWaterLevel`)
 *     return null when no querier is registered
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetTerrainQueryRegistry,
  getTerrainHeightAt,
  getWaterLevel,
  onQuerierReady,
  registerTerrainQuerier,
} from "../terrainQueryRegistry";

function makeQuerier(height = 0, water = 0) {
  return {
    getTerrainHeight: vi.fn((_x: number, _z: number) => height),
    getWaterLevel: vi.fn(() => water),
  };
}

beforeEach(() => {
  _resetTerrainQueryRegistry();
});

afterEach(() => {
  _resetTerrainQueryRegistry();
  vi.restoreAllMocks();
});

describe("registerTerrainQuerier", () => {
  it("returns a disposer function", () => {
    const dispose = registerTerrainQuerier(makeQuerier());
    expect(typeof dispose).toBe("function");
  });

  it("disposer clears the active querier", () => {
    const q = makeQuerier(50);
    const dispose = registerTerrainQuerier(q);
    expect(getTerrainHeightAt(0, 0)).toBe(50);
    dispose();
    expect(getTerrainHeightAt(0, 0)).toBeNull();
  });

  it("last-registered-wins — new registration replaces previous querier", () => {
    const first = makeQuerier(10);
    const second = makeQuerier(20);
    registerTerrainQuerier(first);
    registerTerrainQuerier(second);
    expect(getTerrainHeightAt(0, 0)).toBe(20);
  });

  it("disposer is a no-op when called for a non-active querier (after newer registration)", () => {
    const first = makeQuerier(10);
    const second = makeQuerier(20);
    const disposeFirst = registerTerrainQuerier(first);
    registerTerrainQuerier(second);
    // Now disposing the FIRST querier shouldn't clear the SECOND.
    disposeFirst();
    expect(getTerrainHeightAt(0, 0)).toBe(20); // second still active
  });
});

describe("onQuerierReady", () => {
  it("fires synchronously when a querier is already registered", () => {
    const q = makeQuerier(100);
    registerTerrainQuerier(q);
    const cb = vi.fn();
    onQuerierReady(cb);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(q);
  });

  it("enqueues when no querier is registered, fires on next register", () => {
    const cb = vi.fn();
    onQuerierReady(cb);
    expect(cb).not.toHaveBeenCalled();
    const q = makeQuerier();
    registerTerrainQuerier(q);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(q);
  });

  it("each callback fires exactly once even across multiple registers", () => {
    const cb = vi.fn();
    onQuerierReady(cb);
    const first = makeQuerier();
    registerTerrainQuerier(first);
    expect(cb).toHaveBeenCalledOnce();
    // Re-register — the callback must NOT fire again (already drained).
    registerTerrainQuerier(makeQuerier());
    expect(cb).toHaveBeenCalledOnce();
  });

  it("multiple pending callbacks all drain on first register", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();
    onQuerierReady(cb1);
    onQuerierReady(cb2);
    onQuerierReady(cb3);
    registerTerrainQuerier(makeQuerier());
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
    expect(cb3).toHaveBeenCalledOnce();
  });

  it("a callback that throws does NOT block the rest from running", () => {
    const cb1 = vi.fn(() => {
      throw new Error("boom");
    });
    const cb2 = vi.fn();
    onQuerierReady(cb1);
    onQuerierReady(cb2);
    // Suppress the warn — we expect the registry to log it.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    registerTerrainQuerier(makeQuerier());
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce(); // still fires after cb1 threw
    expect(warnSpy).toHaveBeenCalled();
  });

  it("synchronous fire path also catches throwing callbacks", () => {
    registerTerrainQuerier(makeQuerier());
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => {
      onQuerierReady(() => {
        throw new Error("sync boom");
      });
    }).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("getTerrainHeightAt + getWaterLevel reader helpers", () => {
  it("both return null when no querier is registered", () => {
    expect(getTerrainHeightAt(0, 0)).toBeNull();
    expect(getWaterLevel()).toBeNull();
  });

  it("getTerrainHeightAt forwards (x, z) to the active querier", () => {
    const q = makeQuerier(42);
    registerTerrainQuerier(q);
    const result = getTerrainHeightAt(7, -3);
    expect(result).toBe(42);
    expect(q.getTerrainHeight).toHaveBeenCalledWith(7, -3);
  });

  it("getWaterLevel reads from the active querier", () => {
    const q = makeQuerier(0, 8);
    registerTerrainQuerier(q);
    expect(getWaterLevel()).toBe(8);
    expect(q.getWaterLevel).toHaveBeenCalledOnce();
  });
});
