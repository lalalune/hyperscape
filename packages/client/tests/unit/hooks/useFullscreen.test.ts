/**
 * useFullscreen Hook Tests
 *
 * Tests for the fullscreen hook functionality.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFullscreen } from "@/hooks/useFullscreen";

describe("useFullscreen", () => {
  let requestFullscreenSpy: ReturnType<typeof vi.fn>;
  let exitFullscreenSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestFullscreenSpy = vi.fn().mockResolvedValue(undefined);
    exitFullscreenSpy = vi.fn().mockResolvedValue(undefined);

    // Mock document.fullscreenElement
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => null,
    });

    // Mock document.exitFullscreen
    document.exitFullscreen = exitFullscreenSpy;

    // Mock element.requestFullscreen
    Element.prototype.requestFullscreen = requestFullscreenSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return isFullscreen state and toggle function", () => {
    const { result } = renderHook(() => useFullscreen());

    expect(result.current).toHaveProperty("isFullscreen");
    expect(result.current).toHaveProperty("toggleFullscreen");
    expect(typeof result.current.isFullscreen).toBe("boolean");
    expect(typeof result.current.toggleFullscreen).toBe("function");
  });

  it("should start with isFullscreen false", () => {
    const { result } = renderHook(() => useFullscreen());
    expect(result.current.isFullscreen).toBe(false);
  });

  it("should call requestFullscreen when not in fullscreen", async () => {
    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      result.current.toggleFullscreen();
    });

    expect(requestFullscreenSpy).toHaveBeenCalled();
  });

  it("should call exitFullscreen when in fullscreen", async () => {
    // Mock being in fullscreen
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => document.body,
    });

    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      result.current.toggleFullscreen();
    });

    expect(exitFullscreenSpy).toHaveBeenCalled();
  });

  it("should update isFullscreen on fullscreenchange event", async () => {
    const { result } = renderHook(() => useFullscreen());

    // Simulate entering fullscreen
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => document.body,
    });

    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(result.current.isFullscreen).toBe(true);
  });

  it("should handle fullscreen errors gracefully", async () => {
    const error = new Error("Fullscreen not allowed");
    requestFullscreenSpy.mockRejectedValueOnce(error);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      result.current.toggleFullscreen();
    });

    // Should not throw
    expect(result.current.isFullscreen).toBe(false);
    consoleSpy.mockRestore();
  });

  it("should clean up event listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useFullscreen());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "fullscreenchange",
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });

  it("should handle webkit prefixed fullscreen", async () => {
    // Remove standard fullscreen
    const originalFullscreenElement = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "fullscreenElement",
    );
    delete (Document.prototype as unknown as Record<string, unknown>)
      .fullscreenElement;

    // Add webkit prefix
    Object.defineProperty(document, "webkitFullscreenElement", {
      configurable: true,
      get: () => null,
    });

    const { result } = renderHook(() => useFullscreen());
    expect(result.current.isFullscreen).toBe(false);

    // Restore
    if (originalFullscreenElement) {
      Object.defineProperty(
        Document.prototype,
        "fullscreenElement",
        originalFullscreenElement,
      );
    }
  });
});
