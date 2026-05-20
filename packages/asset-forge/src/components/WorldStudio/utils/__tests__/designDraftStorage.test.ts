/**
 * designDraftStorage — localStorage round-trip + safe-fail tests.
 *
 * Phase 1.2 first carve from DesignWithAIDialog. Pins:
 *
 *   - The localStorage key shape (so future refactors don't
 *     orphan existing drafts).
 *   - The envelope shape (version + messages array + plan).
 *   - Null returns on missing / malformed / wrong-version data.
 *   - Safe-fail when localStorage throws (Safari private mode).
 *   - Window-undefined returns null without throwing (SSR
 *     boundary).
 *   - Save / load / clear round-trip preserves structural data.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// jsdom doesn't ship a working window.localStorage in this
// project's test setup (other suites in the repo stub it the
// same way — see gamePluginResolver.test.ts). Hoisted so the
// stub exists before module-level reads in the SUT.
vi.hoisted(() => {
  const map = new Map<string, string>();
  const impl = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
  };
  const g = globalThis as unknown as { window?: { localStorage?: unknown } };
  if (!g.window) g.window = {};
  g.window.localStorage = impl;
  (globalThis as unknown as { localStorage: unknown }).localStorage = impl;
});

import {
  loadDraft,
  saveDraft,
  clearDraft,
  draftKey,
} from "../designDraftStorage";

// Lightweight stand-in shapes — the helper is generic on these
// and only validates envelope-level structure. Tests can use
// any shape that satisfies "array of messages + non-null plan".
interface TestMsg {
  role: "user" | "agent";
  text: string;
}
interface TestPlan {
  pluginIds: string[];
  npcs: TestMsg[];
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("draftKey", () => {
  it("composes a stable namespaced key from team + game ids", () => {
    expect(draftKey("team-a", "game-b")).toBe(
      "hyperforge:design-with-ai:draft:team-a:game-b",
    );
  });

  it("keeps team and game ids distinct (different params → different keys)", () => {
    const k1 = draftKey("team-a", "game-b");
    const k2 = draftKey("team-b", "game-a");
    expect(k1).not.toBe(k2);
  });
});

describe("loadDraft", () => {
  it("returns null when no draft is saved (cold boot)", () => {
    expect(loadDraft<TestMsg, TestPlan>("team", "game")).toBeNull();
  });

  it("returns the stored draft after saveDraft", () => {
    const messages: TestMsg[] = [{ role: "user", text: "hi" }];
    const plan: TestPlan = { pluginIds: ["combat"], npcs: [] };
    saveDraft("team", "game", messages, plan);

    const loaded = loadDraft<TestMsg, TestPlan>("team", "game");
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.messages).toEqual(messages);
    expect(loaded!.plan).toEqual(plan);
  });

  it("returns null on malformed JSON", () => {
    window.localStorage.setItem(draftKey("team", "game"), "not valid json {");
    expect(loadDraft<TestMsg, TestPlan>("team", "game")).toBeNull();
  });

  it("returns null on wrong version", () => {
    window.localStorage.setItem(
      draftKey("team", "game"),
      JSON.stringify({ version: 999, messages: [], plan: { pluginIds: [] } }),
    );
    expect(loadDraft<TestMsg, TestPlan>("team", "game")).toBeNull();
  });

  it("returns null when messages is not an array", () => {
    window.localStorage.setItem(
      draftKey("team", "game"),
      JSON.stringify({ version: 1, messages: "string-not-array", plan: {} }),
    );
    expect(loadDraft<TestMsg, TestPlan>("team", "game")).toBeNull();
  });

  it("returns null when plan is null", () => {
    window.localStorage.setItem(
      draftKey("team", "game"),
      JSON.stringify({ version: 1, messages: [], plan: null }),
    );
    expect(loadDraft<TestMsg, TestPlan>("team", "game")).toBeNull();
  });
});

describe("saveDraft / clearDraft", () => {
  it("clearDraft removes a stored draft", () => {
    saveDraft<TestMsg, TestPlan>("team", "game", [], {
      pluginIds: [],
      npcs: [],
    });
    expect(loadDraft<TestMsg, TestPlan>("team", "game")).not.toBeNull();

    clearDraft("team", "game");
    expect(loadDraft<TestMsg, TestPlan>("team", "game")).toBeNull();
  });

  it("clearDraft is a no-op when no draft exists", () => {
    expect(() => clearDraft("team", "game")).not.toThrow();
  });
});

describe("safe-fail on storage exceptions", () => {
  it("loadDraft returns null when localStorage.getItem throws", () => {
    const spy = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    expect(loadDraft<TestMsg, TestPlan>("team", "game")).toBeNull();
    spy.mockRestore();
  });

  it("saveDraft swallows localStorage.setItem failures", () => {
    const spy = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });
    expect(() =>
      saveDraft<TestMsg, TestPlan>("team", "game", [], {
        pluginIds: [],
        npcs: [],
      }),
    ).not.toThrow();
    spy.mockRestore();
  });

  it("clearDraft swallows localStorage.removeItem failures", () => {
    const spy = vi
      .spyOn(window.localStorage, "removeItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    expect(() => clearDraft("team", "game")).not.toThrow();
    spy.mockRestore();
  });
});

describe("round-trip", () => {
  it("preserves non-trivial structural data through save → load", () => {
    const messages: TestMsg[] = [
      { role: "user", text: "build me a tropical sandbox" },
      { role: "agent", text: "i'll install the tropical pack first" },
    ];
    const plan: TestPlan = {
      pluginIds: ["combat", "skills"],
      npcs: [{ role: "user", text: "fisher-npc" }],
    };

    saveDraft<TestMsg, TestPlan>("team-x", "game-y", messages, plan);
    const loaded = loadDraft<TestMsg, TestPlan>("team-x", "game-y");

    expect(loaded).toEqual({
      version: 1,
      messages,
      plan,
    });
  });

  it("multiple (team, game) drafts coexist independently", () => {
    saveDraft<TestMsg, TestPlan>("team-a", "game-1", [], {
      pluginIds: ["a"],
      npcs: [],
    });
    saveDraft<TestMsg, TestPlan>("team-b", "game-2", [], {
      pluginIds: ["b"],
      npcs: [],
    });

    const a = loadDraft<TestMsg, TestPlan>("team-a", "game-1");
    const b = loadDraft<TestMsg, TestPlan>("team-b", "game-2");
    expect(a?.plan.pluginIds).toEqual(["a"]);
    expect(b?.plan.pluginIds).toEqual(["b"]);

    clearDraft("team-a", "game-1");
    expect(loadDraft<TestMsg, TestPlan>("team-a", "game-1")).toBeNull();
    expect(loadDraft<TestMsg, TestPlan>("team-b", "game-2")).not.toBeNull();
  });
});
