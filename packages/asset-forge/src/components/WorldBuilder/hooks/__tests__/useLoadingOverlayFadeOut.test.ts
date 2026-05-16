/**
 * `useLoadingOverlayFadeOut` — initial-load overlay fade timer.
 *
 * Phase 1.1 fifteenth carve. Pins:
 *   - Schedules onHide() after the configured delay when both
 *     flags are true.
 *   - Does NOT schedule when either flag is false.
 *   - Cancels the timer when either flag flips back to false
 *     before the delay elapses.
 *   - Cancels on unmount (no firing after unmount).
 *   - Reschedules when the delay or onHide changes (effect deps).
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { useLoadingOverlayFadeOut } from "../useLoadingOverlayFadeOut";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLoadingOverlayFadeOut — scheduling", () => {
  it("schedules onHide after the configured delay", () => {
    const onHide = vi.fn();
    renderHook(() =>
      useLoadingOverlayFadeOut({
        initialLoadComplete: true,
        loadingOverlayVisible: true,
        fadeOutDelayMs: 500,
        onHide,
      }),
    );
    expect(onHide).not.toHaveBeenCalled();

    vi.advanceTimersByTime(499);
    expect(onHide).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("does NOT schedule when initialLoadComplete is false", () => {
    const onHide = vi.fn();
    renderHook(() =>
      useLoadingOverlayFadeOut({
        initialLoadComplete: false,
        loadingOverlayVisible: true,
        fadeOutDelayMs: 500,
        onHide,
      }),
    );
    vi.advanceTimersByTime(10000);
    expect(onHide).not.toHaveBeenCalled();
  });

  it("does NOT schedule when loadingOverlayVisible is false", () => {
    const onHide = vi.fn();
    renderHook(() =>
      useLoadingOverlayFadeOut({
        initialLoadComplete: true,
        loadingOverlayVisible: false,
        fadeOutDelayMs: 500,
        onHide,
      }),
    );
    vi.advanceTimersByTime(10000);
    expect(onHide).not.toHaveBeenCalled();
  });
});

describe("useLoadingOverlayFadeOut — cancellation", () => {
  it("cancels the timer if either flag flips false before delay elapses", () => {
    const onHide = vi.fn();
    const { rerender } = renderHook(
      ({ visible }: { visible: boolean }) =>
        useLoadingOverlayFadeOut({
          initialLoadComplete: true,
          loadingOverlayVisible: visible,
          fadeOutDelayMs: 500,
          onHide,
        }),
      { initialProps: { visible: true } },
    );

    vi.advanceTimersByTime(200);
    rerender({ visible: false });
    vi.advanceTimersByTime(10000);

    expect(onHide).not.toHaveBeenCalled();
  });

  it("cancels on unmount", () => {
    const onHide = vi.fn();
    const { unmount } = renderHook(() =>
      useLoadingOverlayFadeOut({
        initialLoadComplete: true,
        loadingOverlayVisible: true,
        fadeOutDelayMs: 500,
        onHide,
      }),
    );

    vi.advanceTimersByTime(200);
    unmount();
    vi.advanceTimersByTime(10000);

    expect(onHide).not.toHaveBeenCalled();
  });
});

describe("useLoadingOverlayFadeOut — re-schedule on deps change", () => {
  it("restarts the timer if delay changes mid-fade", () => {
    const onHide = vi.fn();
    const { rerender } = renderHook(
      ({ delay }: { delay: number }) =>
        useLoadingOverlayFadeOut({
          initialLoadComplete: true,
          loadingOverlayVisible: true,
          fadeOutDelayMs: delay,
          onHide,
        }),
      { initialProps: { delay: 500 } },
    );

    vi.advanceTimersByTime(200);
    rerender({ delay: 1000 });

    // Original timer should be canceled, new one starts fresh.
    vi.advanceTimersByTime(800);
    expect(onHide).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("restarts the timer if onHide identity changes", () => {
    const a = vi.fn();
    const b = vi.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) =>
        useLoadingOverlayFadeOut({
          initialLoadComplete: true,
          loadingOverlayVisible: true,
          fadeOutDelayMs: 500,
          onHide: cb,
        }),
      { initialProps: { cb: a } },
    );

    vi.advanceTimersByTime(200);
    rerender({ cb: b });

    vi.advanceTimersByTime(500);
    // The active callback at fire-time is `b`; `a` should never
    // be called (its timer was canceled by the dep change).
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
