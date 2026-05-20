/**
 * companionDraftStorage — localStorage round-trip + safe-fail tests.
 *
 * Sibling to `designDraftStorage.test.ts`. Pins:
 *
 *   - The localStorage key shape (so future refactors don't
 *     orphan existing drafts).
 *   - The envelope shape (version + messages array, no plan).
 *   - Null returns on missing / malformed / wrong-version / too-few-messages.
 *   - Safe-fail when localStorage throws (Safari private mode).
 *   - Empty / greeting-only writes auto-clear instead of persisting.
 *   - Save / load / clear round-trip preserves structural data.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// jsdom doesn't ship a working window.localStorage in this
// project's test setup. Hoisted so the stub exists before
// module-level reads in the SUT.
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
  companionDraftKey,
  clearCompanionDraft,
  loadCompanionDraft,
  saveCompanionDraft,
} from "../companionDraftStorage";

interface TestMsg {
  role: "user" | "agent";
  text: string;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("companionDraftKey", () => {
  it("composes a stable namespaced key from project id", () => {
    expect(companionDraftKey("proj-123")).toBe(
      "hyperforge:companion:draft:proj-123",
    );
  });

  it("distinct projects produce distinct keys", () => {
    expect(companionDraftKey("proj-a")).not.toBe(companionDraftKey("proj-b"));
  });
});

describe("loadCompanionDraft", () => {
  it("returns null when no draft is saved (cold boot)", () => {
    expect(loadCompanionDraft<TestMsg>("proj")).toBeNull();
  });

  it("returns the stored draft after saveCompanionDraft", () => {
    const messages: TestMsg[] = [
      { role: "agent", text: "Hi!" },
      { role: "user", text: "drop a quest giver" },
    ];
    saveCompanionDraft("proj", messages);

    const loaded = loadCompanionDraft<TestMsg>("proj");
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.messages).toEqual(messages);
  });

  it("returns null on malformed JSON", () => {
    window.localStorage.setItem(companionDraftKey("proj"), "not valid json {");
    expect(loadCompanionDraft<TestMsg>("proj")).toBeNull();
  });

  it("returns null on wrong version", () => {
    window.localStorage.setItem(
      companionDraftKey("proj"),
      JSON.stringify({ version: 999, messages: [] }),
    );
    expect(loadCompanionDraft<TestMsg>("proj")).toBeNull();
  });

  it("returns null when messages is not an array", () => {
    window.localStorage.setItem(
      companionDraftKey("proj"),
      JSON.stringify({ version: 1, messages: "not-an-array" }),
    );
    expect(loadCompanionDraft<TestMsg>("proj")).toBeNull();
  });

  it("returns null when only the greeting message is stored (length <= 1)", () => {
    window.localStorage.setItem(
      companionDraftKey("proj"),
      JSON.stringify({
        version: 1,
        messages: [{ role: "agent", text: "Hi!" }],
      }),
    );
    expect(loadCompanionDraft<TestMsg>("proj")).toBeNull();
  });

  it("returns null on empty messages array", () => {
    window.localStorage.setItem(
      companionDraftKey("proj"),
      JSON.stringify({ version: 1, messages: [] }),
    );
    expect(loadCompanionDraft<TestMsg>("proj")).toBeNull();
  });
});

describe("saveCompanionDraft / clearCompanionDraft", () => {
  it("clearCompanionDraft removes a stored draft", () => {
    saveCompanionDraft<TestMsg>("proj", [
      { role: "agent", text: "Hi!" },
      { role: "user", text: "drop a quest giver" },
    ]);
    expect(loadCompanionDraft<TestMsg>("proj")).not.toBeNull();

    clearCompanionDraft("proj");
    expect(loadCompanionDraft<TestMsg>("proj")).toBeNull();
  });

  it("clearCompanionDraft is a no-op when no draft exists", () => {
    expect(() => clearCompanionDraft("proj")).not.toThrow();
  });

  it("saveCompanionDraft auto-clears when messages.length <= 1", () => {
    // First seed with a real draft
    saveCompanionDraft<TestMsg>("proj", [
      { role: "agent", text: "Hi!" },
      { role: "user", text: "trash" },
    ]);
    expect(loadCompanionDraft<TestMsg>("proj")).not.toBeNull();

    // Save just the greeting → should auto-clear
    saveCompanionDraft<TestMsg>("proj", [{ role: "agent", text: "Hi!" }]);
    expect(loadCompanionDraft<TestMsg>("proj")).toBeNull();
  });

  it("saveCompanionDraft auto-clears on empty array", () => {
    saveCompanionDraft<TestMsg>("proj", [
      { role: "agent", text: "Hi!" },
      { role: "user", text: "trash" },
    ]);
    saveCompanionDraft<TestMsg>("proj", []);
    expect(loadCompanionDraft<TestMsg>("proj")).toBeNull();
  });
});

describe("safe-fail on storage exceptions", () => {
  it("loadCompanionDraft returns null when getItem throws", () => {
    const spy = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    expect(loadCompanionDraft<TestMsg>("proj")).toBeNull();
    spy.mockRestore();
  });

  it("saveCompanionDraft swallows setItem failures", () => {
    const spy = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });
    expect(() =>
      saveCompanionDraft<TestMsg>("proj", [
        { role: "agent", text: "Hi!" },
        { role: "user", text: "anything" },
      ]),
    ).not.toThrow();
    spy.mockRestore();
  });

  it("clearCompanionDraft swallows removeItem failures", () => {
    const spy = vi
      .spyOn(window.localStorage, "removeItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    expect(() => clearCompanionDraft("proj")).not.toThrow();
    spy.mockRestore();
  });
});

describe("round-trip", () => {
  it("preserves multi-turn message thread through save → load", () => {
    const messages: TestMsg[] = [
      { role: "agent", text: "Hi!" },
      { role: "user", text: "swap the HUD to combat-focused" },
      { role: "agent", text: "Picked the combat HUD pack." },
      { role: "user", text: "now add a quest giver" },
    ];
    saveCompanionDraft<TestMsg>("proj-x", messages);
    const loaded = loadCompanionDraft<TestMsg>("proj-x");
    expect(loaded).toEqual({ version: 1, messages });
  });

  it("multiple project drafts coexist independently", () => {
    saveCompanionDraft<TestMsg>("proj-a", [
      { role: "agent", text: "Hi!" },
      { role: "user", text: "for proj-a" },
    ]);
    saveCompanionDraft<TestMsg>("proj-b", [
      { role: "agent", text: "Hi!" },
      { role: "user", text: "for proj-b" },
    ]);

    expect(loadCompanionDraft<TestMsg>("proj-a")?.messages[1].text).toBe(
      "for proj-a",
    );
    expect(loadCompanionDraft<TestMsg>("proj-b")?.messages[1].text).toBe(
      "for proj-b",
    );

    clearCompanionDraft("proj-a");
    expect(loadCompanionDraft<TestMsg>("proj-a")).toBeNull();
    expect(loadCompanionDraft<TestMsg>("proj-b")).not.toBeNull();
  });
});
