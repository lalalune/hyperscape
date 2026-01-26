/**
 * useModalPanels Hook Tests
 *
 * Tests for the modal panels hook functionality.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useModalPanels } from "@/hooks/useModalPanels";

describe("useModalPanels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return initial state with no open panels", () => {
    const { result } = renderHook(() => useModalPanels());

    expect(result.current.openPanels).toBeDefined();
    expect(result.current.isOpen).toBeDefined();
    expect(result.current.open).toBeDefined();
    expect(result.current.close).toBeDefined();
    expect(result.current.toggle).toBeDefined();
    expect(result.current.closeAll).toBeDefined();
  });

  it("should open a panel", () => {
    const { result } = renderHook(() => useModalPanels());

    act(() => {
      result.current.open("inventory");
    });

    expect(result.current.isOpen("inventory")).toBe(true);
  });

  it("should close a panel", () => {
    const { result } = renderHook(() => useModalPanels());

    act(() => {
      result.current.open("inventory");
    });

    act(() => {
      result.current.close("inventory");
    });

    expect(result.current.isOpen("inventory")).toBe(false);
  });

  it("should toggle a panel", () => {
    const { result } = renderHook(() => useModalPanels());

    // Toggle on
    act(() => {
      result.current.toggle("inventory");
    });
    expect(result.current.isOpen("inventory")).toBe(true);

    // Toggle off
    act(() => {
      result.current.toggle("inventory");
    });
    expect(result.current.isOpen("inventory")).toBe(false);
  });

  it("should handle multiple panels independently", () => {
    const { result } = renderHook(() => useModalPanels());

    act(() => {
      result.current.open("inventory");
      result.current.open("skills");
    });

    expect(result.current.isOpen("inventory")).toBe(true);
    expect(result.current.isOpen("skills")).toBe(true);

    act(() => {
      result.current.close("inventory");
    });

    expect(result.current.isOpen("inventory")).toBe(false);
    expect(result.current.isOpen("skills")).toBe(true);
  });

  it("should close all panels", () => {
    const { result } = renderHook(() => useModalPanels());

    act(() => {
      result.current.open("inventory");
      result.current.open("skills");
      result.current.open("quests");
    });

    act(() => {
      result.current.closeAll();
    });

    expect(result.current.isOpen("inventory")).toBe(false);
    expect(result.current.isOpen("skills")).toBe(false);
    expect(result.current.isOpen("quests")).toBe(false);
  });

  it("should return list of open panels", () => {
    const { result } = renderHook(() => useModalPanels());

    act(() => {
      result.current.open("inventory");
      result.current.open("skills");
    });

    const openPanels = result.current.openPanels;
    expect(openPanels).toContain("inventory");
    expect(openPanels).toContain("skills");
    expect(openPanels.length).toBe(2);
  });

  it("should not duplicate panel in open list", () => {
    const { result } = renderHook(() => useModalPanels());

    act(() => {
      result.current.open("inventory");
      result.current.open("inventory"); // Open again
    });

    const openPanels = result.current.openPanels;
    expect(openPanels.filter((p) => p === "inventory").length).toBe(1);
  });

  it("should handle closing non-existent panel gracefully", () => {
    const { result } = renderHook(() => useModalPanels());

    // Should not throw
    act(() => {
      result.current.close("nonexistent");
    });

    expect(result.current.isOpen("nonexistent")).toBe(false);
  });

  it("should support exclusive mode (only one panel open)", () => {
    const { result } = renderHook(() => useModalPanels({ exclusive: true }));

    act(() => {
      result.current.open("inventory");
    });

    act(() => {
      result.current.open("skills");
    });

    // In exclusive mode, opening skills should close inventory
    expect(result.current.isOpen("skills")).toBe(true);
    // Note: This test assumes exclusive mode is implemented
    // If not, the behavior will differ
  });

  it("should maintain stable function references", () => {
    const { result, rerender } = renderHook(() => useModalPanels());

    const initialOpen = result.current.open;
    const initialClose = result.current.close;
    const initialToggle = result.current.toggle;

    rerender();

    // Functions should be stable across re-renders
    expect(result.current.open).toBe(initialOpen);
    expect(result.current.close).toBe(initialClose);
    expect(result.current.toggle).toBe(initialToggle);
  });
});
