/**
 * Plugin manifest-id → npm-name lookup.
 *
 * Phase 1.2 third carve from DesignWithAIDialog. The agent
 * server emits manifest-style plugin ids (reverse-DNS:
 * `com.hyperforge.hyperscape`); the project store + asset-pack
 * resolver expect npm-style names (`@hyperforge/hyperscape`).
 * This map bridges the two formats.
 *
 * Adding a new bridge entry is data-only — no client code
 * change. Future packs that ship under their own scope just
 * need a row here.
 */

export const MANIFEST_TO_NPM: Record<string, string> = {
  "com.hyperforge.hyperscape": "@hyperforge/hyperscape",
  "com.hyperforge.plugin-shooter-demo": "@hyperforge/plugin-shooter-demo",
};

/**
 * Resolve a plugin id to its npm-name form. Returns the input
 * unchanged when no manifest→npm mapping exists, so callers can
 * use this as a pass-through for already-npm-formatted ids.
 */
export function toNpmName(pluginId: string): string {
  return MANIFEST_TO_NPM[pluginId] ?? pluginId;
}
