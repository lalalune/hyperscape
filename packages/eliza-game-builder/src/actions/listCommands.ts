/**
 * `LIST_COMMANDS` — surface the catalog of command ids that
 * installed plugins declare.
 *
 * Phase 3.1 of PLAN_AAA_MASTER_AUDIT (R2.P10 broader). Mirrors
 * the `LIST_ENTITY_TYPES` pattern: reads the live `Plugin
 * CatalogService` populated by the studio from
 * `PluginRegistryService`, returns only commands from plugins
 * the active project has installed.
 *
 * Today's source-of-truth: `manifest.contributions.commands`
 * arrays in each plugin's `plugin.json`. Each entry is a
 * namespaced command id (e.g.
 * `com.hyperforge.combat.commands.swap-ability`). The agent
 * uses these when scaffolding gameplay (key bindings, palette
 * entries, action targets) so it references real plugin-
 * declared commands instead of inventing names.
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
import {
  PROJECT_CONTEXT_SERVICE_TYPE,
  type IProjectContextService,
} from "../services/ProjectContextService.js";
import {
  PLUGIN_CATALOG_SERVICE_TYPE,
  type IPluginCatalogService,
} from "../services/PluginCatalogService.js";

/**
 * Per-plugin grouping of contributed commands. The action's
 * `data` payload uses this shape so callers (CLI tools, tests,
 * UI surfaces) can render which plugin owns which command
 * without re-correlating against the project's plugin list.
 */
export interface PluginCommandsGroup {
  /** Manifest id of the plugin (`com.hyperforge.combat`). */
  readonly pluginId: string;
  /** npm name when known (`@hyperforge/combat`). May be null. */
  readonly npmName: string | null;
  /** Plugin display name from the manifest. */
  readonly pluginName: string;
  /** Namespaced command ids the plugin contributes. */
  readonly commands: ReadonlyArray<string>;
}

export const listCommandsAction: Action = {
  name: "LIST_COMMANDS",
  similes: [
    "AVAILABLE_COMMANDS",
    "PLUGIN_COMMANDS",
    "LIST_PLUGIN_COMMANDS",
    "COMMAND_CATALOG",
  ],
  description:
    "List the namespaced command ids contributed by installed plugins. Each command id is real and runtime-dispatchable — agents should reference these (not invented names) when scaffolding key bindings, palette entries, or action targets. Returns one group per installed plugin with its command list. Empty result means either no plugins installed or installed plugins declare no commands.",

  parameters: [],

  validate: async (_runtime: IAgentRuntime) => true,

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: HandlerOptions | Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    // Read the project's installed plugins from project context.
    // No project loaded → no plugins → empty catalog.
    const ctxService = runtime.getService(
      PROJECT_CONTEXT_SERVICE_TYPE,
    ) as unknown as IProjectContextService | null;
    const ctx = ctxService?.getProjectContext() ?? null;
    const installedPluginIds = ctx?.plugins ?? [];
    // Distinguish "no host context plumbed" (ctx === null —
    // backwards compat for MCP / CLI / unit-test scenarios that
    // don't register a ProjectContextService) from "host says
    // project has zero plugins" (ctx is set, plugins is empty).
    // Without this distinction the chat text says "no plugins
    // installed" while data returns the entire catalog.
    const filterByInstalled = ctx !== null;

    // Read live contributions from the studio-supplied catalog.
    // Falls back to empty when no catalog is plumbed (MCP / CLI
    // / unit tests) — same pattern as LIST_ENTITY_TYPES.
    const pluginCatalog = runtime.getService(
      PLUGIN_CATALOG_SERVICE_TYPE,
    ) as unknown as IPluginCatalogService | null;
    const groups: PluginCommandsGroup[] = pluginCatalog
      ? pluginCatalog.listInstallable().flatMap((p) => {
          const eligible =
            !filterByInstalled ||
            installedPluginIds.includes(p.id) ||
            (p.npmName !== null && installedPluginIds.includes(p.npmName));
          if (!eligible) return [];
          const commands = p.commandContributions ?? [];
          if (commands.length === 0) return [];
          return [
            {
              pluginId: p.id,
              npmName: p.npmName,
              pluginName: p.name,
              commands: [...commands],
            } satisfies PluginCommandsGroup,
          ];
        })
      : [];

    const totalCommands = groups.reduce((sum, g) => sum + g.commands.length, 0);

    const summaryLines: string[] = [];
    if (installedPluginIds.length === 0) {
      summaryLines.push(
        "No plugins installed — call PROPOSE_PLUGIN_SET to install one first.",
      );
    } else if (groups.length === 0) {
      summaryLines.push("Installed plugins declare no commands.");
    } else {
      summaryLines.push(
        `${totalCommands} command${totalCommands === 1 ? "" : "s"} from ${groups.length} plugin${groups.length === 1 ? "" : "s"}:`,
      );
      for (const g of groups) {
        summaryLines.push(`  ${g.pluginName} (${g.pluginId}):`);
        for (const cmd of g.commands) {
          summaryLines.push(`    - ${cmd}`);
        }
      }
    }
    const text = summaryLines.join("\n");

    await callback?.({ text, action: "LIST_COMMANDS" });

    return {
      success: true,
      text,
      values: { count: totalCommands },
      data: {
        commandsByPlugin: groups,
        totalCount: totalCommands,
      } as unknown as ProviderDataRecord,
    };
  },

  examples: [],
};
