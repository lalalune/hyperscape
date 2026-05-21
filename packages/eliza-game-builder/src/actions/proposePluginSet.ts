/**
 * `PROPOSE_PLUGIN_SET` — agent declares which plugins the project installs.
 *
 * Phase B0'.I of `PLAN_PROJECT_AS_DATA.md`. The agent emits an
 * array of plugin ids (manifest ids like `com.hyperforge.hyperscape`
 * or npm names like `@hyperforge/hyperscape`) on the `pluginIds`
 * parameter. The handler validates each id against the plugin
 * registry surface (B0'.D's `LIST_PLUGINS`) and surfaces the
 * accepted ids on `data.pluginIds` for the host to:
 *
 *   1. Persist into `Project.plugins[]`
 *   2. Restart the PIE session so the new plugin set installs on
 *      next Play
 *
 * Empty array is valid — that's the "make this a blank canvas"
 * declaration. Empty plugins → PIE Play of this project boots
 * with no game systems → terrain only.
 *
 * Agent flow:
 *   1. Agent calls `LIST_PLUGINS` to discover available plugins
 *   2. Agent picks a subset (or empty) based on the user's goal
 *   3. Agent calls `PROPOSE_PLUGIN_SET` with the chosen ids
 *
 * Today's validation: each id must match the static known-plugins
 * list shipped in `listPlugins.ts` (Hyperia + shooter-demo +
 * arctic-survival).
 * Follow-up wires to `GET /api/plugins/installed` for dynamic
 * discovery once the agent server's deployment story is firm.
 */

import type {
  Action,
  ActionResult,
  HandlerCallback,
  HandlerOptions,
  IAgentRuntime,
  Memory,
  ProviderDataRecord,
  State,
} from "@elizaos/core";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { _BUILTIN_PLUGIN_LIST } from "./listPlugins.js";

/**
 * Resolve a caller-supplied id (manifest id OR npm name) to the
 * canonical manifest id, or return null if unknown.
 */
function resolvePluginId(id: string): string | null {
  const entry = _BUILTIN_PLUGIN_LIST.find(
    (p) => p.id === id || p.npmName === id,
  );
  return entry?.id ?? null;
}

function readArrayField(
  options: HandlerOptions | Record<string, unknown> | undefined,
  name: string,
): unknown[] | undefined {
  const params = (
    options as { parameters?: Record<string, unknown> } | undefined
  )?.parameters;
  const fromParams = params?.[name];
  if (Array.isArray(fromParams)) return fromParams;
  const direct = (options as Record<string, unknown> | undefined)?.[name];
  if (Array.isArray(direct)) return direct;
  return undefined;
}

export const proposePluginSetAction: Action = {
  name: "PROPOSE_PLUGIN_SET",
  similes: [
    "SET_PLUGINS",
    "INSTALL_PLUGINS",
    "DECLARE_PLUGINS",
    "PROJECT_PLUGINS",
  ],
  description:
    "Declare which plugins the active project installs. Pass `pluginIds` — an array of plugin ids (manifest id like 'com.hyperforge.hyperscape' OR npm name like '@hyperforge/hyperscape'). Empty array means 'blank canvas' (no game systems). Each id is validated against the plugin registry; unknown ids are rejected. The validated id list is surfaced on `data.pluginIds` for the host to persist into Project.plugins[] and restart the PIE session.",

  parameters: [
    {
      name: "pluginIds",
      description:
        "Array of plugin ids. May be empty. Each id is the manifest id (com.hyperforge.x) or the npm package name (@hyperforge/x). Use LIST_PLUGINS to discover available ids.",
      required: true,
      schema: { type: "array" },
    },
  ],

  validate: async (runtime: IAgentRuntime) => {
    return (
      runtime.getService<GameBuilderService>(GameBuilderService.serviceType) !==
      null
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: HandlerOptions | Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const service = runtime.getService<GameBuilderService>(
      GameBuilderService.serviceType,
    );
    if (!service) {
      const error = new Error("GameBuilderService not available");
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const ids = readArrayField(options, "pluginIds");
    if (ids === undefined) {
      const error = new Error(
        "PROPOSE_PLUGIN_SET requires a `pluginIds` parameter — an array of plugin ids (may be empty for blank canvas).",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    // Validate every id resolves; collect any unknowns.
    const resolved: string[] = [];
    const unknown: string[] = [];
    for (const raw of ids) {
      if (typeof raw !== "string" || raw.length === 0) {
        unknown.push(String(raw));
        continue;
      }
      const id = resolvePluginId(raw);
      if (id === null) {
        unknown.push(raw);
      } else if (!resolved.includes(id)) {
        resolved.push(id);
      }
    }

    if (unknown.length > 0) {
      const text = `Unknown plugin id${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. Call LIST_PLUGINS to see available ids.`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { unknown } as unknown as ProviderDataRecord,
      };
    }

    // Build a chat-friendly summary.
    const summary: string[] = [];
    if (resolved.length === 0) {
      summary.push("Plugin set: blank (no plugins — pure-procgen project)");
    } else {
      summary.push(
        `Plugin set: ${resolved.length} plugin${resolved.length === 1 ? "" : "s"}`,
      );
      for (const id of resolved) {
        const entry = _BUILTIN_PLUGIN_LIST.find((p) => p.id === id);
        summary.push(`  - ${id}${entry ? ` (${entry.name})` : ""}`);
      }
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_PLUGIN_SET" });

    return {
      success: true,
      text,
      values: { count: resolved.length },
      data: { pluginIds: resolved } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "user",
        content: { text: "Make this a Hyperia-style game." },
      },
      {
        name: "agent",
        content: {
          text: "Plugin set: 1 plugin\n  - com.hyperforge.hyperscape (Hyperia)",
          action: "PROPOSE_PLUGIN_SET",
        },
      },
    ],
    [
      {
        name: "user",
        content: { text: "Strip back to a blank canvas." },
      },
      {
        name: "agent",
        content: {
          text: "Plugin set: blank (no plugins — pure-procgen project)",
          action: "PROPOSE_PLUGIN_SET",
        },
      },
    ],
  ],
};
