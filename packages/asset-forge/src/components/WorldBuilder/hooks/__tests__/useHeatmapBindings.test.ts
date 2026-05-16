/**
 * `useHeatmapBindings` — difficulty-heatmap fan-out tests.
 *
 * Phase 1.1 thirteenth carve. Pins:
 *   - Visibility flag fans into `setVisible` on every change.
 *   - Danger sources fan into `setDangerSources` on every change.
 *   - Null manager is tolerated (parent constructs the manager
 *     in a separate effect; this hook may race ahead).
 *   - Undefined dangerSources is tolerated (parent may not have
 *     received any yet).
 *   - Hook does NOT clobber the manager with stale values when
 *     unrelated parent state changes (dep arrays scoped tight).
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useHeatmapBindings } from "../useHeatmapBindings";
import type {
  DifficultyHeatmapManager,
  DangerSourceInfo,
} from "../../DifficultyHeatmap";

function makeFakeManager() {
  const visibleCalls: boolean[] = [];
  const dangerCalls: ReadonlyArray<DangerSourceInfo>[] = [];
  return {
    instance: {
      setVisible(v: boolean) {
        visibleCalls.push(v);
      },
      setDangerSources(s: ReadonlyArray<DangerSourceInfo>) {
        dangerCalls.push(s);
      },
    } as unknown as DifficultyHeatmapManager,
    visibleCalls,
    dangerCalls,
  };
}

function makeDanger(id: string): DangerSourceInfo {
  return { id } as unknown as DangerSourceInfo;
}

describe("useHeatmapBindings — visibility", () => {
  it("fans true into setVisible on first mount when manager exists", () => {
    const fm = makeFakeManager();
    const ref = { current: fm.instance };
    renderHook(() =>
      useHeatmapBindings({
        showDifficultyHeatmap: true,
        dangerSources: undefined,
        heatmapManagerRef: ref,
      }),
    );
    expect(fm.visibleCalls).toEqual([true]);
  });

  it("fans false into setVisible on first mount when off", () => {
    const fm = makeFakeManager();
    const ref = { current: fm.instance };
    renderHook(() =>
      useHeatmapBindings({
        showDifficultyHeatmap: false,
        dangerSources: undefined,
        heatmapManagerRef: ref,
      }),
    );
    expect(fm.visibleCalls).toEqual([false]);
  });

  it("re-fans setVisible when the flag flips", () => {
    const fm = makeFakeManager();
    const ref = { current: fm.instance };
    const { rerender } = renderHook(
      ({ show }: { show: boolean }) =>
        useHeatmapBindings({
          showDifficultyHeatmap: show,
          dangerSources: undefined,
          heatmapManagerRef: ref,
        }),
      { initialProps: { show: false } },
    );
    expect(fm.visibleCalls).toEqual([false]);

    rerender({ show: true });
    expect(fm.visibleCalls).toEqual([false, true]);

    rerender({ show: false });
    expect(fm.visibleCalls).toEqual([false, true, false]);
  });

  it("does NOT call setVisible when only dangerSources change", () => {
    const fm = makeFakeManager();
    const ref = { current: fm.instance };
    const { rerender } = renderHook(
      ({ sources }: { sources: DangerSourceInfo[] | undefined }) =>
        useHeatmapBindings({
          showDifficultyHeatmap: true,
          dangerSources: sources,
          heatmapManagerRef: ref,
        }),
      {
        initialProps: { sources: undefined as DangerSourceInfo[] | undefined },
      },
    );
    // Only initial fire of setVisible.
    expect(fm.visibleCalls).toEqual([true]);

    rerender({ sources: [makeDanger("a")] });
    rerender({ sources: [makeDanger("a"), makeDanger("b")] });
    // setVisible still only called once.
    expect(fm.visibleCalls).toEqual([true]);
  });
});

describe("useHeatmapBindings — danger sources", () => {
  it("pushes danger sources into setDangerSources when both are present", () => {
    const fm = makeFakeManager();
    const ref = { current: fm.instance };
    const sources = [makeDanger("a"), makeDanger("b")];
    renderHook(() =>
      useHeatmapBindings({
        showDifficultyHeatmap: true,
        dangerSources: sources,
        heatmapManagerRef: ref,
      }),
    );
    expect(fm.dangerCalls).toHaveLength(1);
    expect(fm.dangerCalls[0]).toHaveLength(2);
  });

  it("skips setDangerSources when sources are undefined", () => {
    const fm = makeFakeManager();
    const ref = { current: fm.instance };
    renderHook(() =>
      useHeatmapBindings({
        showDifficultyHeatmap: true,
        dangerSources: undefined,
        heatmapManagerRef: ref,
      }),
    );
    expect(fm.dangerCalls).toEqual([]);
  });

  it("re-fans on each new sources array", () => {
    const fm = makeFakeManager();
    const ref = { current: fm.instance };
    const { rerender } = renderHook(
      ({ sources }: { sources: DangerSourceInfo[] }) =>
        useHeatmapBindings({
          showDifficultyHeatmap: true,
          dangerSources: sources,
          heatmapManagerRef: ref,
        }),
      { initialProps: { sources: [makeDanger("a")] } },
    );
    expect(fm.dangerCalls).toHaveLength(1);

    rerender({ sources: [makeDanger("a"), makeDanger("b")] });
    expect(fm.dangerCalls).toHaveLength(2);

    rerender({ sources: [] });
    expect(fm.dangerCalls).toHaveLength(3);
  });

  it("copies the input array (manager receives a fresh ReadonlyArray)", () => {
    const fm = makeFakeManager();
    const ref = { current: fm.instance };
    const sources = [makeDanger("a")];
    renderHook(() =>
      useHeatmapBindings({
        showDifficultyHeatmap: true,
        dangerSources: sources,
        heatmapManagerRef: ref,
      }),
    );
    // Manager received a different array instance — the parent
    // can mutate its own copy without affecting heatmap state.
    expect(fm.dangerCalls[0]).not.toBe(sources);
    expect(fm.dangerCalls[0]).toHaveLength(1);
  });
});

describe("useHeatmapBindings — null manager tolerance", () => {
  it("does nothing when heatmapManagerRef.current is null", () => {
    const ref = { current: null as DifficultyHeatmapManager | null };
    expect(() =>
      renderHook(() =>
        useHeatmapBindings({
          showDifficultyHeatmap: true,
          dangerSources: [makeDanger("a")],
          heatmapManagerRef: ref,
        }),
      ),
    ).not.toThrow();
  });
});
