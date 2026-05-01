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
 * @deprecated R2.P2 of `PLAN_HYPERIA_DECOUPLING.md` replaced
 * this enum-based resolver with `resolveProjectPluginIds()`,
 * which returns the npm-style id list directly so PIE's static
 * plugin map can boot any registered plugin without an enum
 * mapping. Kept here only for legacy callers (HUD layout
 * picker — see PIEHudOverlay) that haven't migrated yet.
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
 * R2.P2 — resolve the plugin id list PIE should boot, directly
 * from the project's typed-layer surface. No enum collapse — the
 * agent / studio can declare any plugin id and PIE looks it up
 * in `pluginBoot.STATIC_PLUGIN_MAP`. Unknown ids skip with a
 * warning instead of forcing the whole project into a 3-element
 * preset.
 *
 * Resolution:
 *   1. Project loaded with explicit plugins → return them
 *      verbatim (PIE expands transitive deps internally).
 *   2. Project loaded but plugins is empty → `[]` (blank canvas).
 *   3. Project loaded with empty plugins but `templateId === "hyperia"`
 *      → `["@hyperforge/hyperscape"]` (legacy template fallback;
 *      can be removed once template seeding always populates
 *      plugins[]).
 *   4. No project context (PIE booted standalone for tests) →
 *      legacy env/localStorage resolver translated to a single id.
 */
export function resolveProjectPluginIds(args: {
  plugins: ReadonlyArray<string>;
  templateId: string | null;
  projectLoaded: boolean;
}): ReadonlyArray<string> {
  if (!args.projectLoaded) {
    const legacy = resolveGamePluginSetId();
    if (legacy === "blank") return [];
    if (legacy === "shooter-demo") return ["@hyperforge/plugin-shooter-demo"];
    return ["@hyperforge/hyperscape"];
  }
  if (args.plugins.length > 0) {
    return [...args.plugins];
  }
  if (args.templateId === "hyperia") {
    return ["@hyperforge/hyperscape"];
  }
  return [];
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
