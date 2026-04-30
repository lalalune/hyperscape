/**
 * Game-plugin resolver for the asset-forge editor.
 *
 * `GameSelector.tsx` (the toolbar dropdown), `usePIESession.ts` (the
 * Play-In-Editor hook), and `pluginBoot.ts` (the PIE plugin adapter)
 * all need to agree on the same enumerated game ids and the same
 * localStorage key the editor writes the user's pick to.
 *
 * This module is intentionally small and dependency-free. It mirrors
 * (but does not import) `GamePluginSetId` + `GAME_PLUGIN_LOCAL_STORAGE_KEY`
 * + `resolveGamePluginSetIdFromEnv()` from `@hyperforge/client` — the
 * runtime behavior is identical; we just can't cross the package
 * boundary since asset-forge doesn't depend on client.
 */

/**
 * Plugin sets PIE knows how to boot.
 *
 *   - `"blank"` (B0'.C): no plugins. Engine boots, terrain renders,
 *     viewport is empty. Used for `templateId === "blank"` projects.
 *   - `"hyperscape"`: full Hyperia plugin chain (combat + skills +
 *     hyperscape meta-plugin).
 *   - `"shooter-demo"`: lightweight shooter demo plugin.
 *
 * Phase B0'.D will replace this finite enum with a discoverable
 * registry walked from `node_modules/@hyperforge/*` so any project
 * can declare any plugin in `project.plugins`. Until then, blank +
 * the two reference plugin sets cover the relevant cases.
 */
export type GamePluginSetId = "blank" | "hyperscape" | "shooter-demo";

export const GAME_PLUGIN_LOCAL_STORAGE_KEY = "hyperscape:game-plugin";

const DEFAULT_GAME: GamePluginSetId = "hyperscape";

export function isKnownGamePluginSetId(raw: unknown): raw is GamePluginSetId {
  return raw === "blank" || raw === "hyperscape" || raw === "shooter-demo";
}

/**
 * Resolve the active plugin set from a project's typed-layer
 * surface (B0'.B).
 *
 * Resolution order:
 *
 *   1. `project.plugins` is empty → `"blank"`
 *      (no plugins declared = blank canvas; engine boots without
 *       any game-specific systems).
 *   2. `project.plugins` includes `"@hyperforge/plugin-shooter-demo"`
 *      → `"shooter-demo"`.
 *   3. `project.plugins` includes `"@hyperforge/hyperscape"`
 *      → `"hyperscape"`.
 *   4. Otherwise → fall back to `templateId` (`"hyperia"` →
 *      hyperscape; anything else → default).
 *   5. No project context (e.g. PIE booted before project loaded)
 *      → `resolveGamePluginSetId()` legacy env/localStorage path.
 *
 * Phase B0'.C transition. Once B0'.D ships, the project's plugin
 * id list goes through the registry directly and this enum-based
 * resolver collapses.
 */
export function resolveProjectPluginSet(args: {
  plugins: ReadonlyArray<string>;
  templateId: string | null;
  projectLoaded: boolean;
}): GamePluginSetId {
  if (!args.projectLoaded) {
    // PIE was started before any project context exists. Fall back
    // to the legacy env/localStorage path so dev / test harnesses
    // that don't load a project keep working.
    return resolveGamePluginSetId();
  }
  if (args.plugins.length === 0) {
    return "blank";
  }
  if (args.plugins.includes("@hyperforge/plugin-shooter-demo")) {
    return "shooter-demo";
  }
  if (args.plugins.includes("@hyperforge/hyperscape")) {
    return "hyperscape";
  }
  // Unknown plugin id — fall through to templateId.
  if (args.templateId === "hyperia") return "hyperscape";
  return DEFAULT_GAME;
}

/**
 * Resolve the active game plugin set for the editor. Lookup order:
 *
 *   1. `VITE_HYPERSCAPE_GAME_PLUGIN` env var (build-time flag — CI,
 *      preview deploys).
 *   2. `localStorage["hyperscape:game-plugin"]` (runtime — the
 *      GameSelector toolbar dropdown's backing store).
 *   3. Default: `"hyperscape"`.
 *
 * Unknown values fall through silently. A bad env var can't brick
 * the editor — worst case you get the default game.
 */
export function resolveGamePluginSetId(): GamePluginSetId {
  const envRaw =
    typeof import.meta.env === "object"
      ? (import.meta.env as Record<string, string | undefined>)[
          "VITE_HYPERSCAPE_GAME_PLUGIN"
        ]
      : undefined;
  if (isKnownGamePluginSetId(envRaw)) return envRaw;

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const lsRaw = window.localStorage.getItem(GAME_PLUGIN_LOCAL_STORAGE_KEY);
      if (isKnownGamePluginSetId(lsRaw)) return lsRaw;
    }
  } catch {
    // localStorage may be blocked; fall through to default.
  }

  return DEFAULT_GAME;
}
