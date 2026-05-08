/**
 * `LIST_CONTRIBUTIONS` — generic catalog read for any of the
 * uniform `string[]` plugin contribution fields.
 *
 * Phase 3.1 of PLAN_AAA_MASTER_AUDIT — closes the remaining 5
 * R2.P10 broader gaps (`systems`, `entities`, `widgets`,
 * `manifestSchemas`, `paletteCategories`, `toolbarTools`) in a
 * single generic action. `commands` already has a dedicated
 * `LIST_COMMANDS` action; this one handles the rest plus
 * provides a uniform fallback that callers can use for
 * `commands` too.
 *
 * Why generic instead of 6 separate actions: each underlying
 * field is `string[]` with no field-specific semantics — the
 * action's behavior is entirely "filter to installed plugins,
 * group by plugin, return the list." Six near-identical action
 * files would be boilerplate. A `kind` parameter parameterizes
 * the lookup at the cost of one extra agent-side string in the
 * call.
 *
 * The agent's system prompt gets per-kind hints so it knows
 * which `kind` to pass for which task (e.g. "to list available
 * UI widgets call LIST_CONTRIBUTIONS with kind=widgets").
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
  type InstallablePlugin,
  type PluginContributionKind,
} from "../services/PluginCatalogService.js";
import { readStringField } from "./shared.js";

/** Kinds the generic action accepts as the `kind` parameter. */
const VALID_KINDS: ReadonlyArray<PluginContributionKind> = [
  "commands",
  "systems",
  "entities",
  "widgets",
  "manifestSchemas",
  "paletteCategories",
  "toolbarTools",
];

/**
 * Per-plugin grouping returned in the action's `data` payload.
 * Same shape as `LIST_COMMANDS`'s `PluginCommandsGroup` for
 * consistency — UI / CLI consumers can render either action's
 * result with the same code path.
 */
export interface PluginContributionGroup {
  readonly pluginId: string;
  readonly npmName: string | null;
  readonly pluginName: string;
  /** The kind of contribution echoed back for clarity. */
  readonly kind: PluginContributionKind;
  /** The contributed entries. Always `string[]`. */
  readonly entries: ReadonlyArray<string>;
}

/**
 * Map a contribution kind to the corresponding field name on
 * `InstallablePlugin`. Centralizes the kind→field mapping so
 * future field additions only need a one-line update here.
 */
function pluginField(kind: PluginContributionKind): keyof InstallablePlugin {
  switch (kind) {
    case "commands":
      return "commandContributions";
    case "systems":
      return "systemContributions";
    case "entities":
      return "entityContributions";
    case "widgets":
      return "widgetContributions";
    case "manifestSchemas":
      return "manifestSchemaContributions";
    case "paletteCategories":
      return "paletteCategoryContributions";
    case "toolbarTools":
      return "toolbarToolContributions";
  }
}

export const listContributionsAction: Action = {
  name: "LIST_CONTRIBUTIONS",
  similes: [
    "LIST_PLUGIN_CONTRIBUTIONS",
    "AVAILABLE_CONTRIBUTIONS",
    "PLUGIN_CONTRIBUTIONS",
  ],
  description:
    "List the contributions installed plugins declare for a given kind. Pass `kind` as one of: commands, systems, entities, widgets, manifestSchemas, paletteCategories, toolbarTools. " +
    "Each entry is a real plugin-declared identifier the agent can reference: " +
    "  systems = world-tick system names (e.g. `combat`, `inventory`); " +
    "  entities = ECS entity-class names (e.g. `mob`, `playerLocal`); " +
    "  widgets = UI widget registration ids; " +
    "  manifestSchemas = Zod-validated authoring schema ids the plugin extends; " +
    "  paletteCategories = studio ContentBrowser category ids; " +
    "  toolbarTools = studio MainToolbar tool ids; " +
    "  commands = namespaced command ids the plugin's runtime can dispatch (also surfaced via the dedicated `LIST_COMMANDS` action). " +
    "Returns one group per installed plugin that contributes at least one entry of the given kind.",

  parameters: [
    {
      name: "kind",
      description:
        "Which contribution kind to list. Must be one of: commands, systems, entities, widgets, manifestSchemas, paletteCategories, toolbarTools.",
      required: true,
      schema: {
        type: "string",
        enum: [...VALID_KINDS],
      },
    },
  ],

  validate: async (_runtime: IAgentRuntime) => true,

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: HandlerOptions | Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const rawKind = readStringField(options, "kind");
    if (
      typeof rawKind !== "string" ||
      !(VALID_KINDS as ReadonlyArray<string>).includes(rawKind)
    ) {
      const text = `LIST_CONTRIBUTIONS requires \`kind\` to be one of: ${VALID_KINDS.join(", ")}.`;
      await callback?.({ text, error: true });
      return { success: false, text };
    }
    const kind = rawKind as PluginContributionKind;

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

    const pluginCatalog = runtime.getService(
      PLUGIN_CATALOG_SERVICE_TYPE,
    ) as unknown as IPluginCatalogService | null;
    const fieldName = pluginField(kind);
    const groups: PluginContributionGroup[] = pluginCatalog
      ? pluginCatalog.listInstallable().flatMap((p) => {
          const eligible =
            !filterByInstalled ||
            installedPluginIds.includes(p.id) ||
            (p.npmName !== null && installedPluginIds.includes(p.npmName));
          if (!eligible) return [];
          const list = p[fieldName] as ReadonlyArray<string> | undefined;
          if (!list || list.length === 0) return [];
          return [
            {
              pluginId: p.id,
              npmName: p.npmName,
              pluginName: p.name,
              kind,
              entries: [...list],
            } satisfies PluginContributionGroup,
          ];
        })
      : [];

    const totalEntries = groups.reduce((sum, g) => sum + g.entries.length, 0);

    const summaryLines: string[] = [];
    if (installedPluginIds.length === 0) {
      summaryLines.push(
        "No plugins installed — call PROPOSE_PLUGIN_SET to install one first.",
      );
    } else if (groups.length === 0) {
      summaryLines.push(`Installed plugins declare no '${kind}'.`);
    } else {
      summaryLines.push(
        `${totalEntries} ${kind} from ${groups.length} plugin${groups.length === 1 ? "" : "s"}:`,
      );
      for (const g of groups) {
        summaryLines.push(`  ${g.pluginName} (${g.pluginId}):`);
        for (const entry of g.entries) {
          summaryLines.push(`    - ${entry}`);
        }
      }
    }
    const text = summaryLines.join("\n");

    await callback?.({ text, action: "LIST_CONTRIBUTIONS" });

    return {
      success: true,
      text,
      values: { count: totalEntries, kind },
      data: {
        kind,
        groups,
        totalCount: totalEntries,
      } as unknown as ProviderDataRecord,
    };
  },

  examples: [],
};
