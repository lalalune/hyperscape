/**
 * `LIST_ENTITY_TYPES` — surface the catalog of placement types
 * that installed plugins actually back with behavior.
 *
 * Layer B of the AI ↔ assets ↔ plugins integration. The agent
 * was previously guessing strings for `type` on placements
 * (`shopkeeper`, `goblin`, `tree`) without knowing whether any
 * plugin would handle them. This action returns the truth:
 *
 *   - For each installed plugin, the entity types it contributes
 *   - For each entity type: kind (npc/mobSpawn/resource/station),
 *     description, required extra fields, and the asset-pack
 *     `type` values it pairs with naturally
 *
 * The agent is told (via system prompt + this action's description)
 * to call `LIST_ENTITY_TYPES` BEFORE emitting `PROPOSE_NPC_PLACEMENT`
 * etc. so its `type` strings have gameplay backing.
 *
 * Today's source-of-truth: `_PLUGIN_ENTITY_TYPES` static map in
 * `entityTypeContributions.ts`. When a runtime plugin registry
 * exists this swaps to a real fetch.
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
import { getEntityTypesForPlugins } from "./entityTypeContributions.js";
import { readStringField } from "./shared.js";

type KindFilter = "all" | "npc" | "mobSpawn" | "resource" | "station";
const VALID_KINDS: ReadonlyArray<KindFilter> = [
  "all",
  "npc",
  "mobSpawn",
  "resource",
  "station",
];

export const listEntityTypesAction: Action = {
  name: "LIST_ENTITY_TYPES",
  similes: [
    "LIST_PLACEMENT_TYPES",
    "ENTITY_TYPE_CATALOG",
    "AVAILABLE_ENTITY_TYPES",
  ],
  description:
    "Return the catalog of placement `type` values that installed plugins actually back with behavior. CALL THIS BEFORE PROPOSE_NPC_PLACEMENT / PROPOSE_MOB_SPAWN / PROPOSE_RESOURCE / PROPOSE_STATION so your `type` field maps to a real plugin system instead of a guessed string. Each entry includes: pluginId, kind (npc/mobSpawn/resource/station), type, description, requiredFields (additional placement fields like `storeId`), acceptedAssetTypes (which asset-pack types pair naturally — use to filter `availableAssets`). Optional `kind` parameter narrows to one placement category.",

  parameters: [
    {
      name: "kind",
      description:
        "Optional filter — 'all' (default), 'npc', 'mobSpawn', 'resource', or 'station'.",
      required: false,
      schema: { type: "string" },
    },
  ],

  validate: async (runtime: IAgentRuntime) => {
    return runtime !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: HandlerOptions | Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    // Read the project's installed plugins from project context.
    // No project loaded → no plugins → empty catalog.
    const ctxService = runtime.getService(
      PROJECT_CONTEXT_SERVICE_TYPE,
    ) as unknown as IProjectContextService | null;
    const ctx = ctxService?.getProjectContext() ?? null;
    const installedPluginIds = ctx?.plugins ?? [];

    const rawKind = readStringField(options, "kind");
    const kindFilter: KindFilter =
      typeof rawKind === "string" &&
      (VALID_KINDS as ReadonlyArray<string>).includes(rawKind)
        ? (rawKind as KindFilter)
        : "all";

    const all = getEntityTypesForPlugins(installedPluginIds);
    const filtered =
      kindFilter === "all"
        ? all
        : all.filter((e) => e.contribution.kind === kindFilter);

    const summaryLines: string[] = [];
    if (installedPluginIds.length === 0) {
      summaryLines.push(
        "No plugins installed — call PROPOSE_PLUGIN_SET to install one first.",
      );
    } else if (filtered.length === 0) {
      summaryLines.push(
        kindFilter === "all"
          ? "Installed plugins contribute no entity types yet."
          : `No '${kindFilter}' entity types from installed plugins.`,
      );
    } else {
      summaryLines.push(
        `${filtered.length} entity type${filtered.length === 1 ? "" : "s"} from ${installedPluginIds.length} plugin${installedPluginIds.length === 1 ? "" : "s"}:`,
      );
      // Group by kind for readability in chat surfaces.
      type Entry = (typeof filtered)[number];
      const byKind: Record<string, Entry[]> = {};
      for (const e of filtered) {
        const k = e.contribution.kind;
        (byKind[k] = byKind[k] ?? []).push(e);
      }
      for (const k of ["npc", "mobSpawn", "resource", "station"] as const) {
        const group = byKind[k];
        if (!group || group.length === 0) continue;
        summaryLines.push(`  ${k}:`);
        for (const e of group) {
          const reqs =
            e.contribution.requiredFields.length > 0
              ? ` (requires: ${e.contribution.requiredFields.join(", ")})`
              : "";
          summaryLines.push(
            `    - ${e.contribution.type}${reqs} — ${e.contribution.description}`,
          );
        }
      }
    }
    const text = summaryLines.join("\n");

    await callback?.({ text, action: "LIST_ENTITY_TYPES" });

    return {
      success: true,
      text,
      values: { count: filtered.length },
      data: {
        installedPlugins: [...installedPluginIds],
        entityTypes: filtered.map((e) => ({
          pluginId: e.pluginId,
          kind: e.contribution.kind,
          type: e.contribution.type,
          description: e.contribution.description,
          requiredFields: [...e.contribution.requiredFields],
          acceptedAssetTypes: [...e.contribution.acceptedAssetTypes],
        })),
      } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "What kinds of NPCs can I place?" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "5 entity types from 1 plugin:\n  npc:\n    - shopkeeper (requires: storeId) — Opens a store UI on click. ...",
          actions: ["LIST_ENTITY_TYPES"],
        },
      },
    ],
  ],
};
