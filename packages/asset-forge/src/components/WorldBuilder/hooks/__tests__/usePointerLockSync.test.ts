/**
 * `usePointerLockSync` — pointer-lock event subscription tests.
 *
 * Phase 1.1 fourteenth carve. Pins:
 *   - Subscribes to `pointerlockchange` on mount, unsubscribes
 *     on unmount.
 *   - Reports `true` when `document.pointerLockElement` matches
 *     `containerRef.current`.
 *   - Reports `false` when it does not.
 *   - Re-subscribes when callers swap the `onChange` callback
 *     (effect dep), avoiding stale closure leaks.
 *   - Does not throw when containerRef.current is null.
 *
 * jsdom doesn't implement Pointer Lock API but accepts manual
 * dispatch of `pointerlockchange` events. We poke
 * `document.pointerLockElement` via `Object.defineProperty` for
 * the duration of each test.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";

import { usePointerLockSync } from "../usePointerLockSync";

// jsdom default: `pointerLockElement` is `null` and not
// writable. Stub it as a configurable getter so tests can
// control it.
function stubPointerLockElement(el: Element | null): () => void {
  const original = Object.getOwnPropertyDescriptor(
    Document.prototype,
    "pointerLockElement",
  );
  Object.defineProperty(document, "pointerLockElement", {
    configurable: true,
    get: () => el,
  });
  return () => {
    if (original) {
      Object.defineProperty(Document.prototype, "pointerLockElement", original);
    } else {
      delete (document as unknown as Record<string, unknown>)
        .pointerLockElement;
    }
  };
}

afterEach(() => {
  // Reset any lingering pointerLockElement stub.
  Object.defineProperty(document, "pointerLockElement", {
    configurable: true,
    get: () => null,
  });
});

describe("usePointerLockSync — subscribe/unsubscribe", () => {
  it("adds a `pointerlockchange` listener on mount", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const containerRef = { current: document.createElement("div") };
    renderHook(() => usePointerLockSync({ containerRef, onChange: () => {} }));
    expect(
      addSpy.mock.calls.some(([type]) => type === "pointerlockchange"),
    ).toBe(true);
    addSpy.mockRestore();
  });

  it("removes the listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const containerRef = { current: document.createElement("div") };
    const { unmount } = renderHook(() =>
      usePointerLockSync({ containerRef, onChange: () => {} }),
    );
    expect(
      removeSpy.mock.calls.some(([type]) => type === "pointerlockchange"),
    ).toBe(false);
    unmount();
    expect(
      removeSpy.mock.calls.some(([type]) => type === "pointerlockchange"),
    ).toBe(true);
    removeSpy.mockRestore();
  });
});

describe("usePointerLockSync — active-state reporting", () => {
  it("reports true when pointerLockElement matches container", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const restore = stubPointerLockElement(container);

    const calls: boolean[] = [];
    renderHook(() =>
      usePointerLockSync({
        containerRef: { current: container },
        onChange: (b) => calls.push(b),
      }),
    );

    document.dispatchEvent(new Event("pointerlockchange"));
    expect(calls).toEqual([true]);

    restore();
    document.body.removeChild(container);
  });

  it("reports false when pointerLockElement is null", () => {
    const container = document.createElement("div");
    const restore = stubPointerLockElement(null);

    const calls: boolean[] = [];
    renderHook(() =>
      usePointerLockSync({
        containerRef: { current: container },
        onChange: (b) => calls.push(b),
      }),
    );

    document.dispatchEvent(new Event("pointerlockchange"));
    expect(calls).toEqual([false]);

    restore();
  });

  it("reports false when pointerLockElement is a different element", () => {
    const container = document.createElement("div");
    const other = document.createElement("div");
    const restore = stubPointerLockElement(other);

    const calls: boolean[] = [];
    renderHook(() =>
      usePointerLockSync({
        containerRef: { current: container },
        onChange: (b) => calls.push(b),
      }),
    );

    document.dispatchEvent(new Event("pointerlockchange"));
    expect(calls).toEqual([false]);

    restore();
  });

  it("re-fires on each subsequent pointerlockchange event", () => {
    const container = document.createElement("div");
    let activeEl: Element | null = container;
    Object.defineProperty(document, "pointerLockElement", {
      configurable: true,
      get: () => activeEl,
    });

    const calls: boolean[] = [];
    renderHook(() =>
      usePointerLockSync({
        containerRef: { current: container },
        onChange: (b) => calls.push(b),
      }),
    );

    document.dispatchEvent(new Event("pointerlockchange"));
    activeEl = null;
    document.dispatchEvent(new Event("pointerlockchange"));
    activeEl = container;
    document.dispatchEvent(new Event("pointerlockchange"));
    expect(calls).toEqual([true, false, true]);
  });
});

describe("usePointerLockSync — callback identity", () => {
  it("re-subscribes when the onChange callback changes (effect dep)", () => {
    const container = document.createElement("div");
    const containerRef = { current: container };
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const cbA = () => {};
    const cbB = () => {};

    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) =>
        usePointerLockSync({ containerRef, onChange: cb }),
      { initialProps: { cb: cbA } },
    );

    const initialAdds = addSpy.mock.calls.filter(
      ([type]) => type === "pointerlockchange",
    ).length;

    rerender({ cb: cbB });

    const afterRerenderAdds = addSpy.mock.calls.filter(
      ([type]) => type === "pointerlockchange",
    ).length;
    const afterRerenderRemoves = removeSpy.mock.calls.filter(
      ([type]) => type === "pointerlockchange",
    ).length;

    // One extra add (new subscription) and one remove (old
    // subscription torn down) — proving stale closure can't
    // leak.
    expect(afterRerenderAdds - initialAdds).toBe(1);
    expect(afterRerenderRemoves).toBeGreaterThanOrEqual(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe("usePointerLockSync — null container", () => {
  it("does not throw when containerRef.current is null", () => {
    const restore = stubPointerLockElement(null);
    expect(() =>
      renderHook(() =>
        usePointerLockSync({
          containerRef: { current: null },
          onChange: () => {},
        }),
      ),
    ).not.toThrow();
    restore();
  });

  it("reports false when containerRef.current is null and pointerLockElement exists", () => {
    const someOther = document.createElement("div");
    const restore = stubPointerLockElement(someOther);

    const calls: boolean[] = [];
    renderHook(() =>
      usePointerLockSync({
        containerRef: { current: null },
        onChange: (b) => calls.push(b),
      }),
    );

    document.dispatchEvent(new Event("pointerlockchange"));
    expect(calls).toEqual([false]);

    restore();
  });
});
