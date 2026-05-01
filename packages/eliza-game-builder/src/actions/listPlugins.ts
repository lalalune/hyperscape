/**
 * `LIST_PLUGINS` — surface the plugin contribution registry to the agent.
 *
 * Phase B0'.D of `PLAN_PROJECT_AS_DATA.md`. The agent calls this
 * action when reasoning about which plugin set to recommend
 * (`PROPOSE_PLUGIN_SET` — B0'.I) or to summarize available game
 * surfaces for the user.
 *
 * Today's implementation surfaces a static list of known
 * first-party plugins (Hyperia + shooter-demo). The
 * `asset-forge` server already exposes a discovery endpoint
 * (`GET /api/plugins/installed`) backed by `PluginRegistryService`
 * that walks workspace + node_modules. A follow-up cut wires
 * this action to that endpoint once the agent-server's deployment
 * story (which asset-forge URL to call) is stable.
 *
 * The shape returned matches what `GET /api/plugins/installed`
 * returns so callers can switch transports without changing
 * downstream code.
 */

import type {
  Action,
  ActionResult,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ProviderDataRecord,
  State,
} from "@elizaos/core";
import { GameBuilderService } from "../services/GameBuilderService.js";
import {
  PLUGIN_CATALOG_SERVICE_TYPE,
  type IPluginCatalogService,
  type InstallablePlugin,
} from "../services/PluginCatalogService.js";

/**
 * Static built-in plugin list. Used as the fallback when no
 * `PluginCatalogService` is plugged into the runtime — typically
 * MCP / CLI / unit-test paths that don't go through the asset-forge
 * studio's discovery endpoint. Production paths (the studio's
 * Design with AI dialog) plumb the live registry through
 * `PluginCatalogService` per request, and this fallback is unused.
 */
const KNOWN_PLUGINS: ReadonlyArray<InstallablePlugin> = [
  {
    id: "com.hyperforge.hyperscape",
    npmName: "@hyperforge/hyperscape",
    name: "Hyperia",
    description:
      "Meta-plugin for the Hyperia game. Composes the constituent gameplay plugins (combat, skills, gathering, prayer, banking) into a single 'all of Hyperia' loadable. Project that declares this plugin gets a full RPG with mobs, NPCs, stations, and authored world content.",
    tags: ["meta", "hyperia", "game"],
  },
  {
    id: "com.hyperforge.plugin-shooter-demo",
    npmName: "@hyperforge/plugin-shooter-demo",
    name: "Shooter Demo",
    description:
      "Minimal non-Hyperscape game plugin. Proves the engine can compose a different game than Hyperia. Contributes one ranged ability ('shoot') and a crosshair widget.",
    tags: ["demo", "acceptance-test", "shooter"],
  },
];

export const listPluginsAction: Action = {
  name: "LIST_PLUGINS",
  similes: ["LIST_GAME_PLUGINS", "AVAILABLE_PLUGINS", "PLUGIN_CATALOG"],
  description:
    "List the available HyperForge plugins the agent can recommend a project install. Returns one entry per plugin with id, npm name, display name, description, and tags. Use this before calling PROPOSE_PLUGIN_SET to know what's available.",

  parameters: [],

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
    _options?: unknown,
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

    // R1.P15 — request-scoped catalog injected by the host
    // (asset-forge studio fetches GET /api/plugins/installed and
    // plugs the result through `PluginCatalogService`). Falls back
    // to KNOWN_PLUGINS for paths that don't plumb a catalog (MCP /
    // CLI / unit tests).
    const catalog = runtime.getService(
      PLUGIN_CATALOG_SERVICE_TYPE,
    ) as unknown as IPluginCatalogService | null;
    const live = catalog?.listInstallable() ?? null;
    const source: ReadonlyArray<InstallablePlugin> =
      live && live.length > 0 ? live : KNOWN_PLUGINS;
    const plugins = source.map((p) => ({ ...p, tags: [...p.tags] }));
    const summaryLines = [
      `${plugins.length} plugin${plugins.length === 1 ? "" : "s"} available:`,
      ...plugins.map((p) => `  - ${p.id} (${p.name}) — ${p.description}`),
    ];
    const text = summaryLines.join("\n");

    await callback?.({ text, action: "LIST_PLUGINS" });

    return {
      success: true,
      text,
      values: { count: plugins.length },
      data: { plugins } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "user",
        content: { text: "What plugins can I add to this project?" },
      },
      {
        name: "agent",
        content: {
          text: "2 plugins available:\n  - com.hyperforge.hyperscape (Hyperia) — full RPG.\n  - com.hyperforge.plugin-shooter-demo (Shooter Demo) — minimal shooter.",
          action: "LIST_PLUGINS",
        },
      },
    ],
  ],
};

/** Exported for use in `getPlugin.ts` and tests. */
export const _BUILTIN_PLUGIN_LIST = KNOWN_PLUGINS;
