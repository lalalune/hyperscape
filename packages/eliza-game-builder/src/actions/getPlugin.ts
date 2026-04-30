/**
 * `GET_PLUGIN` — full info for one plugin by id or npm name.
 *
 * Phase B0'.D of `PLAN_PROJECT_AS_DATA.md`. Companion to
 * `LIST_PLUGINS` — once the agent has identified a plugin worth
 * recommending, `GET_PLUGIN` returns its full metadata so the
 * agent can summarize the plugin's contributions to the user
 * before proposing it.
 *
 * Resolution accepts either the reverse-DNS manifest id
 * (`com.hyperforge.hyperscape`) or the npm package name
 * (`@hyperforge/hyperscape`) — both refer to the same plugin.
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
import { readStringField } from "./shared.js";

export const getPluginAction: Action = {
  name: "GET_PLUGIN",
  similes: ["DESCRIBE_PLUGIN", "PLUGIN_INFO", "INSPECT_PLUGIN"],
  description:
    "Get full info for one plugin by id or npm name. Pass `id` — either the manifest id (e.g. 'com.hyperforge.hyperscape') or the npm name (e.g. '@hyperforge/hyperscape'). Returns the plugin's full metadata: name, description, tags. Use after LIST_PLUGINS narrows candidates.",

  parameters: [
    {
      name: "id",
      description:
        "The plugin's manifest id (com.hyperforge.x) or npm name (@hyperforge/x).",
      required: true,
      schema: { type: "string" },
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

    const id = readStringField(options, "id");
    if (!id) {
      const error = new Error(
        "GET_PLUGIN requires `id` — a manifest id or npm name string.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const entry = _BUILTIN_PLUGIN_LIST.find(
      (p) => p.id === id || p.npmName === id,
    );
    if (!entry) {
      const text = `Unknown plugin: ${id}. Call LIST_PLUGINS to see available ids.`;
      await callback?.({ text, error: true });
      return { success: false, text };
    }

    const summaryLines = [
      `Plugin: ${entry.name}`,
      `  id:           ${entry.id}`,
      `  npm:          ${entry.npmName ?? "(none)"}`,
      `  description:  ${entry.description}`,
      `  tags:         ${entry.tags.join(", ") || "(none)"}`,
    ];
    const text = summaryLines.join("\n");

    await callback?.({ text, action: "GET_PLUGIN" });

    return {
      success: true,
      text,
      values: { id: entry.id, name: entry.name },
      data: {
        plugin: { ...entry, tags: [...entry.tags] },
      } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "user",
        content: { text: "Tell me more about the Hyperia plugin." },
      },
      {
        name: "agent",
        content: {
          text: "Plugin: Hyperia\n  id: com.hyperforge.hyperscape\n  npm: @hyperforge/hyperscape\n  description: Meta-plugin for the Hyperia game...",
          action: "GET_PLUGIN",
        },
      },
    ],
  ],
};
