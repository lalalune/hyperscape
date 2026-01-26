/**
 * useDebouncedValue Hook Tests
 *
 * Tests for the debounce hook functionality.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "@/hooks/useDebounce";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("initial", 500));
    expect(result.current).toBe("initial");
  });

  it("should not update value before delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 500),
      { initialProps: { value: "initial" } },
    );

    // Update the value
    rerender({ value: "updated" });

    // Before delay, should still be initial
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("initial");
  });

  it("should update value after delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 500),
      { initialProps: { value: "initial" } },
    );

    // Update the value
    rerender({ value: "updated" });

    // After delay, should be updated
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe("updated");
  });

  it("should reset timer on rapid updates", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 500),
      { initialProps: { value: "initial" } },
    );

    // First update
    rerender({ value: "first" });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Second update before timer completes
    rerender({ value: "second" });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should still be initial because timer was reset
    expect(result.current).toBe("initial");

    // Complete the delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should be the latest value
    expect(result.current).toBe("second");
  });

  it("should work with different data types", () => {
    // Number
    const { result: numberResult } = renderHook(() =>
      useDebouncedValue(42, 500),
    );
    expect(numberResult.current).toBe(42);

    // Object
    const obj = { key: "value" };
    const { result: objectResult } = renderHook(() =>
      useDebouncedValue(obj, 500),
    );
    expect(objectResult.current).toEqual(obj);

    // Array
    const arr = [1, 2, 3];
    const { result: arrayResult } = renderHook(() =>
      useDebouncedValue(arr, 500),
    );
    expect(arrayResult.current).toEqual(arr);
  });

  it("should handle delay of 0", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 0),
      { initialProps: { value: "initial" } },
    );

    rerender({ value: "updated" });

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe("updated");
  });

  it("should cleanup timeout on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const { unmount, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 500),
      { initialProps: { value: "initial" } },
    );

    rerender({ value: "updated" });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
