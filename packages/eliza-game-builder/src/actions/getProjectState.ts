/**
 * `GET_PROJECT_STATE` — agent-side read of the active project.
 *
 * Phase A3 of the AAA gap audit. Until this action existed every
 * agent call was amnesiac: the agent could neither reference
 * existing entities ("the smithy next to the tavern you just
 * placed") nor avoid re-proposing slots the user already
 * accepted. The action returns the active project's typed-layer
 * state — config, plugins, worldContent — verbatim.
 *
 * The host is responsible for plugging a `ProjectContextService`
 * into the runtime so this action has a read path. When no
 * service is registered (e.g. /design called without a project
 * loaded), the action returns `{ projectContext: null }` so the
 * LLM can branch.
 *
 * Optional `select` parameter narrows the response. Useful when
 * the project's `worldContent` is huge and the LLM only needs to
 * see a specific slice. Currently supports:
 *   - `"summary"` (default) — projectId, templateId, plugin list,
 *     entity counts. Compact view good for first introspection.
 *   - `"full"` — every field, raw. Expensive but exhaustive.
 *   - `"plugins"` — just the plugin id list.
 *   - `"worldContent"` — just worldContent.
 *   - `"config"` — just config.
 *   - `"availableAssets"` — flattened catalog of every asset across
 *     installed packs (Phase AP4 — PLAN_ASSET_PACKS.md). Each entry
 *     includes the global `ref` (`<packId>/<entryId>`) which is the
 *     EXACT value to copy into the `assetRef` field of
 *     `PROPOSE_NPC_PLACEMENT` / `PROPOSE_MOB_SPAWN` /
 *     `PROPOSE_RESOURCE` so the engine renders the actual model
 *     instead of a placeholder. Returns `{ packs: [], assets: [] }`
 *     when no packs are installed — call `LIST_ASSET_PACKS` +
 *     `PROPOSE_ASSET_PACK_INSTALL` first to remedy.
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
  type ProjectContext,
} from "../services/ProjectContextService.js";
import { readStringField } from "./shared.js";

type SelectMode =
  | "summary"
  | "full"
  | "plugins"
  | "worldContent"
  | "config"
  | "availableAssets";

const VALID_SELECTS: ReadonlyArray<SelectMode> = [
  "summary",
  "full",
  "plugins",
  "worldContent",
  "config",
  "availableAssets",
];

export const getProjectStateAction: Action = {
  name: "GET_PROJECT_STATE",
  similes: [
    "READ_PROJECT",
    "INSPECT_PROJECT",
    "DESCRIBE_PROJECT",
    "WHAT_IS_THE_PROJECT",
  ],
  description:
    "Read the active project's state. Returns `projectId`, `templateId`, `plugins`, `config`, `worldContent`, and the installed `assetPacks` catalog. Use this BEFORE making placement proposals so you can (a) reference existing entities (\"add a smithy next to the tavern at (12,0,8)\"), (b) avoid re-proposing slots the user already accepted, and (c) **discover the asset refs to use** — call with select='availableAssets' to get the catalog of every model installed on this project, then copy any `ref` value directly into the `assetRef` field of PROPOSE_NPC_PLACEMENT / PROPOSE_MOB_SPAWN / PROPOSE_RESOURCE so the engine renders an actual model instead of a placeholder. Pass optional `select` to narrow: 'summary' (default), 'full', 'plugins', 'worldContent', 'config', or 'availableAssets'.",

  parameters: [
    {
      name: "select",
      description:
        "Optional view selector. 'summary' (default) returns counts + ids; 'full' returns every field; 'plugins' / 'worldContent' / 'config' return a single slice; 'availableAssets' returns the flattened asset catalog from installed packs (each entry's `ref` is the EXACT value to use as `assetRef` when placing entities — that's how the engine knows which 3D model to load).",
      required: false,
      schema: { type: "string" },
    },
  ],

  validate: async (runtime: IAgentRuntime) => {
    // Always available — returns null when no project context is
    // wired so the agent can branch.
    return runtime !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: HandlerOptions | Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    // Cast through `unknown` — `IProjectContextService` is a plain
    // interface, not an ElizaOS `Service` subclass. Eliza's
    // `getService<T extends Service>` is too strict for our
    // request-scoped lookup.
    const ctxService = runtime.getService(
      PROJECT_CONTEXT_SERVICE_TYPE,
    ) as unknown as IProjectContextService | null;
    const ctx = ctxService?.getProjectContext() ?? null;

    const rawSelect = readStringField(options, "select");
    const select: SelectMode =
      typeof rawSelect === "string" &&
      (VALID_SELECTS as ReadonlyArray<string>).includes(rawSelect)
        ? (rawSelect as SelectMode)
        : "summary";

    if (!ctx) {
      const text = "No project is loaded.";
      await callback?.({ text, action: "GET_PROJECT_STATE" });
      return {
        success: true,
        text,
        data: { projectContext: null, select } as ProviderDataRecord,
      };
    }

    const view = projectViewFor(ctx, select);
    const summaryText = formatProjectSummary(ctx, select);

    await callback?.({ text: summaryText, action: "GET_PROJECT_STATE" });

    return {
      success: true,
      text: summaryText,
      data: {
        projectContext: view,
        select,
      } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "What's already in this project?" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Project: foo (template: hyperia)\nPlugins: @hyperforge/hyperscape\nWorld content: 3 NPCs, 12 mob spawns",
          actions: ["GET_PROJECT_STATE"],
        },
      },
    ],
  ],
};

function projectViewFor(
  ctx: ProjectContext,
  select: SelectMode,
): Record<string, unknown> {
  switch (select) {
    case "full":
      return { ...ctx };
    case "plugins":
      return { plugins: ctx.plugins ?? [] };
    case "worldContent":
      return { worldContent: ctx.worldContent ?? null };
    case "config":
      return { config: ctx.config ?? null };
    case "availableAssets":
      return flattenAvailableAssets(ctx.assetPacks ?? []);
    case "summary":
    default: {
      const wc = ctx.worldContent as
        | {
            npcs?: unknown[];
            spawns?: unknown[];
            zones?: unknown[];
            quests?: unknown[];
            uiPack?: unknown;
          }
        | undefined;
      const packs = ctx.assetPacks ?? [];
      let assetTotal = 0;
      for (const p of packs) assetTotal += p.assets.length;
      return {
        projectId: ctx.projectId,
        templateId: ctx.templateId,
        plugins: ctx.plugins ?? [],
        counts: {
          npcs: Array.isArray(wc?.npcs) ? wc!.npcs!.length : 0,
          mobSpawns: Array.isArray(wc?.spawns) ? wc!.spawns!.length : 0,
          zones: Array.isArray(wc?.zones) ? wc!.zones!.length : 0,
          quests: Array.isArray(wc?.quests) ? wc!.quests!.length : 0,
          hasUiPack: wc?.uiPack !== undefined && wc?.uiPack !== null,
          assetPacks: packs.length,
          availableAssets: assetTotal,
        },
      };
    }
  }
}

function flattenAvailableAssets(
  packs: ReadonlyArray<NonNullable<ProjectContext["assetPacks"]>[number]>,
): Record<string, unknown> {
  const packSummaries = packs.map((p) => ({
    manifestId: p.manifestId,
    name: p.name,
    packVersion: p.packVersion,
    assetCount: p.assets.length,
  }));
  const assets: Array<Record<string, unknown>> = [];
  for (const p of packs) {
    for (const a of p.assets) {
      assets.push({
        ref: `${p.manifestId}/${a.id}`,
        packId: p.manifestId,
        id: a.id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        ...(a.tags && a.tags.length > 0 ? { tags: [...a.tags] } : {}),
      });
    }
  }
  return { packs: packSummaries, assets };
}

function formatProjectSummary(ctx: ProjectContext, select: SelectMode): string {
  const lines: string[] = [];
  if (ctx.projectId) lines.push(`Project: ${ctx.projectId}`);
  if (ctx.templateId !== undefined && ctx.templateId !== null) {
    lines.push(`Template: ${ctx.templateId}`);
  }
  const plugins = ctx.plugins ?? [];
  lines.push(
    plugins.length > 0
      ? `Plugins: ${plugins.join(", ")}`
      : "Plugins: (none — blank canvas)",
  );

  if (select === "summary") {
    const wc = ctx.worldContent as
      | {
          npcs?: unknown[];
          spawns?: unknown[];
          zones?: unknown[];
          quests?: unknown[];
          uiPack?: unknown;
        }
      | undefined;
    const npcs = Array.isArray(wc?.npcs) ? wc!.npcs!.length : 0;
    const spawns = Array.isArray(wc?.spawns) ? wc!.spawns!.length : 0;
    const zones = Array.isArray(wc?.zones) ? wc!.zones!.length : 0;
    const quests = Array.isArray(wc?.quests) ? wc!.quests!.length : 0;
    const hasUiPack = wc?.uiPack !== undefined && wc?.uiPack !== null;
    const parts = [
      `${npcs} NPC${npcs === 1 ? "" : "s"}`,
      `${spawns} mob spawn${spawns === 1 ? "" : "s"}`,
      `${zones} zone${zones === 1 ? "" : "s"}`,
      `${quests} quest${quests === 1 ? "" : "s"}`,
    ];
    if (hasUiPack) parts.push("custom HUD");
    lines.push(`World content: ${parts.join(", ")}`);

    const packs = ctx.assetPacks ?? [];
    if (packs.length > 0) {
      let assetTotal = 0;
      for (const p of packs) assetTotal += p.assets.length;
      lines.push(
        `Asset packs: ${packs.length} installed (${assetTotal} asset${assetTotal === 1 ? "" : "s"} available)`,
      );
    } else {
      lines.push("Asset packs: (none installed)");
    }
  }
  return lines.join("\n");
}
