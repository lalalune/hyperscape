/**
 * `PROPOSE_ASSET_PACK_INSTALL` — agent recommends installing one
 * or more asset packs on the active project.
 *
 * Phase AP5 of `PLAN_ASSET_PACKS.md`. The agent emits an array
 * of pack manifestIds on the `assetPackIds` parameter. The handler
 * validates each id against `IAssetPackCatalogService` (the same
 * surface `LIST_ASSET_PACKS` reads) — unknown ids are rejected.
 * The validated id list is surfaced on `data.assetPackIds` for
 * the host to:
 *
 *   1. Merge with the project's existing `assetPacks`.
 *   2. Persist via `POST /api/world/projects/:id/asset-packs`.
 *   3. Refresh the studio's Asset Library so the new entries
 *      appear in the palette.
 *
 * Empty array is rejected — proposing zero packs is not a
 * meaningful action (use the studio UI to remove packs).
 *
 * Agent flow:
 *   1. Call `LIST_ASSET_PACKS` to discover available packs.
 *   2. Call `GET_PROJECT_STATE` to check what's already installed.
 *   3. Call `PROPOSE_ASSET_PACK_INSTALL` with the *new* ids only.
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
  ASSET_PACK_CATALOG_SERVICE_TYPE,
  type IAssetPackCatalogService,
} from "../services/AssetPackCatalogService.js";

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

export const proposeAssetPackInstallAction: Action = {
  name: "PROPOSE_ASSET_PACK_INSTALL",
  similes: ["INSTALL_ASSET_PACK", "ADD_ASSET_PACK", "PROPOSE_ASSET_PACKS"],
  description:
    "Recommend installing one or more asset packs on the active project. Pass `assetPackIds` — an array of pack manifest ids (e.g. ['@hyperforge/asset-pack-hyperia-v1']). Each id is validated against the installable catalog (LIST_ASSET_PACKS); unknown ids are rejected. Empty array is rejected. The validated id list is surfaced on `data.assetPackIds` for the host to merge with the project's existing assetPacks and persist via POST /api/world/projects/:id/asset-packs.",

  parameters: [
    {
      name: "assetPackIds",
      description:
        "Array of pack manifest ids the project should install (additive — host merges with the existing assetPacks). Use LIST_ASSET_PACKS first to discover real ids.",
      required: true,
      schema: { type: "array" },
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
    const catalog = runtime.getService(
      ASSET_PACK_CATALOG_SERVICE_TYPE,
    ) as unknown as IAssetPackCatalogService | null;

    const ids = readArrayField(options, "assetPackIds");
    if (ids === undefined) {
      const error = new Error(
        "PROPOSE_ASSET_PACK_INSTALL requires an `assetPackIds` parameter — an array of pack manifest ids.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    if (ids.length === 0) {
      const error = new Error(
        "PROPOSE_ASSET_PACK_INSTALL rejects an empty array. To remove packs, use the studio UI.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const installable = catalog?.listInstallable() ?? [];
    const knownIds = new Set(installable.map((p) => p.manifestId));

    const resolved: string[] = [];
    const unknown: string[] = [];
    for (const raw of ids) {
      if (typeof raw !== "string" || raw.length === 0) {
        unknown.push(String(raw));
        continue;
      }
      if (!knownIds.has(raw)) {
        unknown.push(raw);
      } else if (!resolved.includes(raw)) {
        resolved.push(raw);
      }
    }

    if (unknown.length > 0) {
      const text = `Unknown asset pack id${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. Call LIST_ASSET_PACKS to see available pack ids.`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { unknown } as unknown as ProviderDataRecord,
      };
    }

    const summaryLines: string[] = [];
    summaryLines.push(
      `Asset pack install proposal: ${resolved.length} pack${resolved.length === 1 ? "" : "s"}`,
    );
    for (const id of resolved) {
      const entry = installable.find((p) => p.manifestId === id);
      summaryLines.push(
        `  - ${id}${entry ? ` (${entry.name}, ${entry.assetCount} asset${entry.assetCount === 1 ? "" : "s"})` : ""}`,
      );
    }
    const text = summaryLines.join("\n");

    await callback?.({ text, action: "PROPOSE_ASSET_PACK_INSTALL" });

    return {
      success: true,
      text,
      values: { count: resolved.length },
      data: { assetPackIds: resolved } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Add the Hyperia asset pack so I have trees and rocks.",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Asset pack install proposal: 1 pack\n  - @hyperforge/asset-pack-hyperia-v1 (Hyperia Asset Pack v1, 56 assets)",
          actions: ["PROPOSE_ASSET_PACK_INSTALL"],
        },
      },
    ],
  ],
};
