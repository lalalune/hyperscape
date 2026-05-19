/**
 * `useLatestRef` — latest-value-in-stable-ref utility tests.
 *
 * Phase 1.1 sixteenth carve. Pins the two-line contract:
 *   1. The returned ref is stable across renders (same identity).
 *   2. `.current` always equals the most-recent value passed.
 *
 * These two properties together let long-lived DOM event
 * listeners and the animation loop read the freshest callback
 * without re-binding subscriptions on every parent re-render.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLatestRef } from "../useLatestRef";

describe("useLatestRef — ref identity stability", () => {
  it("returns the SAME RefObject across rerenders", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useLatestRef(value),
      { initialProps: { value: 1 } },
    );
    const initialRef = result.current;

    rerender({ value: 2 });
    expect(result.current).toBe(initialRef);

    rerender({ value: 99 });
    expect(result.current).toBe(initialRef);
  });
});

describe("useLatestRef — .current tracks the latest value", () => {
  it("initial render — .current equals the first value", () => {
    const { result } = renderHook(() => useLatestRef("hello"));
    expect(result.current.current).toBe("hello");
  });

  it("after rerender — .current equals the latest value", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useLatestRef(value),
      { initialProps: { value: "a" } },
    );
    expect(result.current.current).toBe("a");

    rerender({ value: "b" });
    expect(result.current.current).toBe("b");

    rerender({ value: "c" });
    expect(result.current.current).toBe("c");
  });

  it("works with function values (the common case)", () => {
    const cbA = () => "A";
    const cbB = () => "B";
    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => string }) => useLatestRef(cb),
      { initialProps: { cb: cbA } },
    );
    expect(result.current.current).toBe(cbA);
    expect(result.current.current()).toBe("A");

    rerender({ cb: cbB });
    expect(result.current.current).toBe(cbB);
    expect(result.current.current()).toBe("B");
  });

  it("works with undefined / null transitions", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number | null | undefined }) => useLatestRef(value),
      { initialProps: { value: 1 as number | null | undefined } },
    );
    rerender({ value: null });
    expect(result.current.current).toBeNull();

    rerender({ value: undefined });
    expect(result.current.current).toBeUndefined();

    rerender({ value: 42 });
    expect(result.current.current).toBe(42);
  });

  it("works with object reference changes (each rerender = new identity)", () => {
    const objA = { id: "a" };
    const objB = { id: "b" };
    const { result, rerender } = renderHook(
      ({ obj }: { obj: { id: string } }) => useLatestRef(obj),
      { initialProps: { obj: objA } },
    );
    expect(result.current.current).toBe(objA);

    rerender({ obj: objB });
    expect(result.current.current).toBe(objB);
  });
});

describe("useLatestRef — DOM-listener pattern", () => {
  it("a closure captured at first render reads the LATEST value via .current", () => {
    // Simulates the addEventListener pattern: a listener
    // installed in a useEffect captures `ref` (not `ref.current`)
    // and reads .current at fire time.
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useLatestRef(value),
      { initialProps: { value: 1 } },
    );
    const refCapturedAtFirstRender = result.current;
    expect(refCapturedAtFirstRender.current).toBe(1);

    rerender({ value: 100 });

    // The first render's captured ref still sees the latest
    // value because `.current` is updated in place on every
    // render. This is the entire point of the hook.
    expect(refCapturedAtFirstRender.current).toBe(100);
  });
});
