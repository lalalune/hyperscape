/**
 * `gamePluginResolver` is the single source of truth for which game
 * plugin set asset-forge boots into a PIE session. GameSelector,
 * usePIESession + pluginBoot all consume it — drift in this resolver
 * silently breaks the toolbar dropdown's contract.
 *
 * The lookup order is documented in the resolver's JSDoc:
 *   1. `VITE_HYPERSCAPE_GAME_PLUGIN` env var
 *   2. `localStorage["hyperscape:game-plugin"]`
 *   3. Default `"hyperscape"`
 *
 * import.meta.env in jsdom is empty, so test cases that need the env
 * branch poke values onto it directly. The localStorage branch
 * exercises the real jsdom storage.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom doesn't ship a working window.localStorage in this project's
// test setup (other suites stub it the same way). Hoisted so the
// stub exists before module-level reads in the SUT or its dependents.
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
  GAME_PLUGIN_LOCAL_STORAGE_KEY,
  isKnownGamePluginSetId,
  resolveGamePluginSetId,
} from "../gamePluginResolver";

const ENV_KEY = "VITE_HYPERSCAPE_GAME_PLUGIN";

describe("gamePluginResolver", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete (import.meta.env as Record<string, string | undefined>)[ENV_KEY];
  });

  afterEach(() => {
    window.localStorage.clear();
    delete (import.meta.env as Record<string, string | undefined>)[ENV_KEY];
  });

  describe("isKnownGamePluginSetId", () => {
    it.each(["hyperscape", "shooter-demo"])("accepts %s", (id) => {
      expect(isKnownGamePluginSetId(id)).toBe(true);
    });

    it.each([null, undefined, "", "hyperia", "HYPERSCAPE", 42, {}])(
      "rejects %s",
      (raw) => {
        expect(isKnownGamePluginSetId(raw)).toBe(false);
      },
    );
  });

  describe("resolveGamePluginSetId", () => {
    it("falls back to 'hyperscape' when nothing is set", () => {
      expect(resolveGamePluginSetId()).toBe("hyperscape");
    });

    it("returns the localStorage value when env var is unset", () => {
      window.localStorage.setItem(
        GAME_PLUGIN_LOCAL_STORAGE_KEY,
        "shooter-demo",
      );
      expect(resolveGamePluginSetId()).toBe("shooter-demo");
    });

    it("returns the env var value, even when localStorage disagrees", () => {
      window.localStorage.setItem(
        GAME_PLUGIN_LOCAL_STORAGE_KEY,
        "shooter-demo",
      );
      (import.meta.env as Record<string, string | undefined>)[ENV_KEY] =
        "hyperscape";
      expect(resolveGamePluginSetId()).toBe("hyperscape");
    });

    it("ignores unknown env var values and falls through to localStorage", () => {
      window.localStorage.setItem(
        GAME_PLUGIN_LOCAL_STORAGE_KEY,
        "shooter-demo",
      );
      (import.meta.env as Record<string, string | undefined>)[ENV_KEY] =
        "totally-unknown-id";
      expect(resolveGamePluginSetId()).toBe("shooter-demo");
    });

    it("ignores unknown localStorage values and falls through to default", () => {
      window.localStorage.setItem(
        GAME_PLUGIN_LOCAL_STORAGE_KEY,
        "totally-unknown-id",
      );
      expect(resolveGamePluginSetId()).toBe("hyperscape");
    });
  });
});

// ============================================================
// resolveProjectPluginSet — Phase B0'.C
// ============================================================

import { resolveProjectPluginSet } from "../gamePluginResolver";

describe("resolveProjectPluginSet (B0'.C)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete (import.meta.env as Record<string, string | undefined>)[ENV_KEY];
  });

  it('returns "blank" when project.plugins is empty', () => {
    const set = resolveProjectPluginSet({
      plugins: [],
      templateId: "blank",
      projectLoaded: true,
    });
    expect(set).toBe("blank");
  });

  it('returns "hyperscape" when @hyperforge/hyperscape is in plugins', () => {
    const set = resolveProjectPluginSet({
      plugins: ["@hyperforge/hyperscape"],
      templateId: "hyperia",
      projectLoaded: true,
    });
    expect(set).toBe("hyperscape");
  });

  it('returns "shooter-demo" when @hyperforge/plugin-shooter-demo is in plugins', () => {
    const set = resolveProjectPluginSet({
      plugins: ["@hyperforge/plugin-shooter-demo"],
      templateId: null,
      projectLoaded: true,
    });
    expect(set).toBe("shooter-demo");
  });

  it("prefers shooter-demo over hyperscape when both are declared", () => {
    const set = resolveProjectPluginSet({
      plugins: ["@hyperforge/hyperscape", "@hyperforge/plugin-shooter-demo"],
      templateId: null,
      projectLoaded: true,
    });
    expect(set).toBe("shooter-demo");
  });

  it("falls back to templateId for unknown plugins (hyperia template)", () => {
    const set = resolveProjectPluginSet({
      plugins: ["@hyperforge/unknown"],
      templateId: "hyperia",
      projectLoaded: true,
    });
    expect(set).toBe("hyperscape");
  });

  it("falls back to default for unknown plugins + non-hyperia template", () => {
    const set = resolveProjectPluginSet({
      plugins: ["@hyperforge/unknown"],
      templateId: "custom",
      projectLoaded: true,
    });
    expect(set).toBe("hyperscape");
  });

  it("uses legacy env/localStorage path when project not loaded", () => {
    window.localStorage.setItem(GAME_PLUGIN_LOCAL_STORAGE_KEY, "shooter-demo");
    const set = resolveProjectPluginSet({
      plugins: [],
      templateId: null,
      projectLoaded: false,
    });
    expect(set).toBe("shooter-demo");
  });

  it("legacy fallback returns default when no env/localStorage set", () => {
    const set = resolveProjectPluginSet({
      plugins: [],
      templateId: null,
      projectLoaded: false,
    });
    expect(set).toBe("hyperscape");
  });
});
