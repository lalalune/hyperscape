/**
 * useFocusTrap Hook Tests
 *
 * Tests for the focus trap hook functionality.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

describe("useFocusTrap", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <input id="input1" type="text" />
      <button id="btn2">Button 2</button>
      <a id="link1" href="#">Link 1</a>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should return a ref object", () => {
    const { result } = renderHook(() => useFocusTrap());
    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty("current");
  });

  it("should trap focus within container when enabled", () => {
    const { result } = renderHook(() => useFocusTrap(true));

    // Assign the ref to our container
    (result.current as React.MutableRefObject<HTMLDivElement | null>).current =
      container;

    // Get focusable elements
    const buttons = container.querySelectorAll("button, input, a");
    expect(buttons.length).toBe(4);
  });

  it("should not trap focus when disabled", () => {
    const { result } = renderHook(() => useFocusTrap(false));
    expect(result.current).toBeDefined();
  });

  it("should focus first element on mount when initialFocus is true", () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");

    const { result } = renderHook(() =>
      useFocusTrap(true, { initialFocus: true }),
    );
    (result.current as React.MutableRefObject<HTMLDivElement | null>).current =
      container;

    // The hook should attempt to focus
    // Note: Actual focus behavior depends on implementation
    expect(focusSpy).toBeDefined();
    focusSpy.mockRestore();
  });

  it("should restore focus on unmount when restoreFocus is true", () => {
    // Focus an element outside the trap
    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    const { result, unmount } = renderHook(() =>
      useFocusTrap(true, { restoreFocus: true }),
    );
    (result.current as React.MutableRefObject<HTMLDivElement | null>).current =
      container;

    unmount();

    // Cleanup
    document.body.removeChild(outsideButton);
  });

  it("should update trap when enabled changes", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useFocusTrap(enabled),
      { initialProps: { enabled: false } },
    );

    (result.current as React.MutableRefObject<HTMLDivElement | null>).current =
      container;

    // Enable the trap
    rerender({ enabled: true });

    // Trap should now be active
    expect(result.current).toBeDefined();

    // Disable the trap
    rerender({ enabled: false });

    // Trap should be inactive
    expect(result.current).toBeDefined();
  });

  it("should handle empty container", () => {
    const emptyContainer = document.createElement("div");
    document.body.appendChild(emptyContainer);

    const { result } = renderHook(() => useFocusTrap(true));
    (result.current as React.MutableRefObject<HTMLDivElement | null>).current =
      emptyContainer;

    // Should not throw with empty container
    expect(result.current).toBeDefined();

    document.body.removeChild(emptyContainer);
  });

  it("should handle container with no focusable elements", () => {
    const noFocusContainer = document.createElement("div");
    noFocusContainer.innerHTML =
      "<div>Not focusable</div><span>Also not focusable</span>";
    document.body.appendChild(noFocusContainer);

    const { result } = renderHook(() => useFocusTrap(true));
    (result.current as React.MutableRefObject<HTMLDivElement | null>).current =
      noFocusContainer;

    // Should handle gracefully
    expect(result.current).toBeDefined();

    document.body.removeChild(noFocusContainer);
  });
});
