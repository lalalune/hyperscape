/**
 * useEventListener Hook Tests
 *
 * Tests for the event listener hook functionality.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEventListener } from "@/hooks/useEventListener";

describe("useEventListener", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it("should attach event listener to window by default", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener("click", handler));

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "click",
      expect.any(Function),
      undefined,
    );
  });

  it("should attach event listener to provided element", () => {
    const element = document.createElement("div");
    const addSpy = vi.spyOn(element, "addEventListener");
    const handler = vi.fn();

    renderHook(() => useEventListener("click", handler, element));

    expect(addSpy).toHaveBeenCalledWith(
      "click",
      expect.any(Function),
      undefined,
    );
    addSpy.mockRestore();
  });

  it("should remove event listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useEventListener("click", handler));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "click",
      expect.any(Function),
      undefined,
    );
  });

  it("should call handler when event fires", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener("click", handler));

    // Simulate click
    const event = new MouseEvent("click");
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it("should use latest handler on each call", () => {
    let callCount = 0;
    const { rerender } = renderHook(
      ({ handler }) => useEventListener("click", handler),
      {
        initialProps: {
          handler: () => {
            callCount = 1;
          },
        },
      },
    );

    // Update handler
    rerender({
      handler: () => {
        callCount = 2;
      },
    });

    // Simulate click
    window.dispatchEvent(new MouseEvent("click"));

    expect(callCount).toBe(2);
  });

  it("should support keyboard events", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener("keydown", handler));

    const event = new KeyboardEvent("keydown", { key: "Enter" });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it("should support custom events", () => {
    const handler = vi.fn();
    renderHook(() =>
      useEventListener("custom-event" as keyof WindowEventMap, handler),
    );

    const event = new CustomEvent("custom-event", { detail: { data: "test" } });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
  });

  it("should not attach listener if element is null", () => {
    const handler = vi.fn();
    const addCount = addEventListenerSpy.mock.calls.length;

    renderHook(() => useEventListener("click", handler, null));

    // Should not have added any new listeners
    expect(addEventListenerSpy.mock.calls.length).toBe(addCount);
  });

  it("should pass options to addEventListener", () => {
    const handler = vi.fn();
    const element = document.createElement("div");
    const addSpy = vi.spyOn(element, "addEventListener");
    const options = { passive: true, capture: true };

    renderHook(() => useEventListener("scroll", handler, element, options));

    expect(addSpy).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      options,
    );
    addSpy.mockRestore();
  });
});
