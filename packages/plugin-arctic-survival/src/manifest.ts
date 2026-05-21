/**
 * Typed manifest export for the arctic-survival plugin.
 *
 * Mirrors `@hyperforge/plugin-shooter-demo/src/manifest.ts` —
 * load `plugin.json` at module init, parse through
 * `PluginManifestSchema`, re-export the frozen typed value.
 * Parsing at module load means manifest regressions fail at
 * `bun build` / `bun test`, not at host boot.
 */

import {
  PluginManifestSchema,
  type PluginManifest,
} from "@hyperforge/gameplay-framework";

import pluginJson from "../plugin.json" with { type: "json" };

export const manifest: PluginManifest = PluginManifestSchema.parse(pluginJson);
