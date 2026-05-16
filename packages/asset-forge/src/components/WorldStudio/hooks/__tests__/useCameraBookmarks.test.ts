/**
 * `useCameraBookmarks` — localStorage-backed bookmark store tests.
 *
 * Pins the CRUD contract, the MAX_BOOKMARKS=10 sliding-window
 * behavior, the per-project key separation, and the localStorage
 * persistence/load round-trip.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useCameraBookmarks } from "../useCameraBookmarks";

const STORAGE_PREFIX = "worldstudio-bookmarks-";

/**
 * Some test environments (notably bun's runtime) ship a
 * localStorage that requires a `--localstorage-file` arg and
 * doesn't expose `setItem` by default. Install a plain in-memory
 * stub so tests work regardless of the runtime.
 */
beforeAll(() => {
  const store = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: stub,
    configurable: true,
    writable: true,
  });
});

function pos(
  x: number,
  y: number,
  z: number,
): { x: number; y: number; z: number } {
  return { x, y, z };
}

/**
 * Clear every bookmark-prefixed key. Some test envs don't supply
 * `localStorage.clear` (only the per-key get/set/removeItem
 * surface), so this iterates explicitly.
 */
function clearProjectBookmarks(): void {
  for (const projectId of ["proj-a", "proj-b"]) {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${projectId}`);
    } catch {
      /* ignore */
    }
  }
}

beforeEach(() => {
  clearProjectBookmarks();
});

afterEach(() => {
  clearProjectBookmarks();
});

describe("useCameraBookmarks — initial state", () => {
  it("starts empty when localStorage has nothing for the project", () => {
    const { result } = renderHook(() => useCameraBookmarks("proj-a"));
    expect(result.current.bookmarks).toEqual([]);
  });

  it("loads existing bookmarks from localStorage on mount", () => {
    const existing = [
      {
        name: "preset",
        position: pos(1, 2, 3),
        target: pos(4, 5, 6),
        timestamp: 100,
      },
    ];
    localStorage.setItem(`${STORAGE_PREFIX}proj-a`, JSON.stringify(existing));
    const { result } = renderHook(() => useCameraBookmarks("proj-a"));
    expect(result.current.bookmarks).toHaveLength(1);
    expect(result.current.bookmarks[0].name).toBe("preset");
    expect(result.current.bookmarks[0].position).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("returns empty if stored JSON is malformed", () => {
    localStorage.setItem(`${STORAGE_PREFIX}proj-a`, "{not json");
    const { result } = renderHook(() => useCameraBookmarks("proj-a"));
    expect(result.current.bookmarks).toEqual([]);
  });
});

describe("useCameraBookmarks — addBookmark", () => {
  it("appends and persists to localStorage", () => {
    const { result } = renderHook(() => useCameraBookmarks("proj-a"));
    act(() => {
      result.current.addBookmark("test", pos(1, 2, 3), pos(4, 5, 6));
    });
    expect(result.current.bookmarks).toHaveLength(1);
    expect(result.current.bookmarks[0].name).toBe("test");
    const raw = localStorage.getItem(`${STORAGE_PREFIX}proj-a`)!;
    const stored = JSON.parse(raw);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("test");
  });

  it("stamps each bookmark with Date.now()", () => {
    const before = Date.now();
    const { result } = renderHook(() => useCameraBookmarks("proj-a"));
    act(() => {
      result.current.addBookmark("test", pos(0, 0, 0), pos(0, 0, 0));
    });
    expect(result.current.bookmarks[0].timestamp).toBeGreaterThanOrEqual(
      before,
    );
  });

  it("MAX_BOOKMARKS=10 — drops oldest when adding the 11th", () => {
    const { result } = renderHook(() => useCameraBookmarks("proj-a"));
    act(() => {
      for (let i = 0; i < 11; i++) {
        result.current.addBookmark(`b${i}`, pos(i, 0, 0), pos(0, 0, 0));
      }
    });
    expect(result.current.bookmarks).toHaveLength(10);
    // First entry (b0) should have been dropped; b1 is now oldest.
    expect(result.current.bookmarks[0].name).toBe("b1");
    expect(result.current.bookmarks[9].name).toBe("b10");
  });

  it("clones position + target objects (caller mutation doesn't bleed in)", () => {
    const { result } = renderHook(() => useCameraBookmarks("proj-a"));
    const p = pos(1, 2, 3);
    const t = pos(4, 5, 6);
    act(() => {
      result.current.addBookmark("test", p, t);
    });
    p.x = 999;
    t.x = 999;
    expect(result.current.bookmarks[0].position.x).toBe(1);
    expect(result.current.bookmarks[0].target.x).toBe(4);
  });
});

describe("useCameraBookmarks — removeBookmark", () => {
  it("removes by index and persists", () => {
    const { result } = renderHook(() => useCameraBookmarks("proj-a"));
    act(() => {
      result.current.addBookmark("a", pos(0, 0, 0), pos(0, 0, 0));
      result.current.addBookmark("b", pos(0, 0, 0), pos(0, 0, 0));
      result.current.addBookmark("c", pos(0, 0, 0), pos(0, 0, 0));
    });
    act(() => {
      result.current.removeBookmark(1);
    });
    expect(result.current.bookmarks.map((b) => b.name)).toEqual(["a", "c"]);
  });
});

describe("useCameraBookmarks — renameBookmark", () => {
  it("renames in place and preserves position/target/timestamp", () => {
    const { result } = renderHook(() => useCameraBookmarks("proj-a"));
    act(() => {
      result.current.addBookmark("old", pos(1, 2, 3), pos(4, 5, 6));
    });
    const original = result.current.bookmarks[0];
    act(() => {
      result.current.renameBookmark(0, "new");
    });
    expect(result.current.bookmarks[0].name).toBe("new");
    expect(result.current.bookmarks[0].position).toEqual(original.position);
    expect(result.current.bookmarks[0].target).toEqual(original.target);
    expect(result.current.bookmarks[0].timestamp).toBe(original.timestamp);
  });
});

describe("useCameraBookmarks — clearBookmarks", () => {
  it("empties the list and persists the empty array", () => {
    const { result } = renderHook(() => useCameraBookmarks("proj-a"));
    act(() => {
      result.current.addBookmark("a", pos(0, 0, 0), pos(0, 0, 0));
      result.current.addBookmark("b", pos(0, 0, 0), pos(0, 0, 0));
    });
    act(() => {
      result.current.clearBookmarks();
    });
    expect(result.current.bookmarks).toEqual([]);
    expect(localStorage.getItem(`${STORAGE_PREFIX}proj-a`)).toBe("[]");
  });
});

describe("useCameraBookmarks — per-project key separation", () => {
  it("bookmarks for proj-a don't leak into proj-b", () => {
    const a = renderHook(() => useCameraBookmarks("proj-a"));
    act(() => {
      a.result.current.addBookmark("a", pos(1, 0, 0), pos(0, 0, 0));
    });

    const b = renderHook(() => useCameraBookmarks("proj-b"));
    expect(b.result.current.bookmarks).toEqual([]);
  });

  it("project switch reloads bookmarks for the new id", () => {
    localStorage.setItem(
      `${STORAGE_PREFIX}proj-a`,
      JSON.stringify([
        {
          name: "a-only",
          position: pos(0, 0, 0),
          target: pos(0, 0, 0),
          timestamp: 0,
        },
      ]),
    );
    localStorage.setItem(
      `${STORAGE_PREFIX}proj-b`,
      JSON.stringify([
        {
          name: "b-only",
          position: pos(0, 0, 0),
          target: pos(0, 0, 0),
          timestamp: 0,
        },
      ]),
    );

    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: string }) => useCameraBookmarks(projectId),
      { initialProps: { projectId: "proj-a" } },
    );
    expect(result.current.bookmarks[0].name).toBe("a-only");

    rerender({ projectId: "proj-b" });
    expect(result.current.bookmarks[0].name).toBe("b-only");
  });
});
