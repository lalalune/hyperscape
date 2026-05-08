/**
 * `LIST_ASSET_PACKS` — surface installable asset packs to the agent.
 *
 * Phase AP5 of `PLAN_ASSET_PACKS.md`. Agent calls this to discover
 * which packs exist that it could recommend the active project
 * install. Returns one entry per pack with id, name, description,
 * version, asset count, tags, and source ("builtin"/"team").
 *
 * Use this BEFORE `PROPOSE_ASSET_PACK_INSTALL` so the proposal
 * can reference real pack ids — proposing a manifestId that
 * doesn't exist in the catalog is rejected.
 *
 * Distinction from `GET_PROJECT_STATE.availableAssets`:
 *   - `GET_PROJECT_STATE.availableAssets` = catalog of every
 *     asset across packs ALREADY INSTALLED on the project.
 *   - `LIST_ASSET_PACKS` = catalog of every pack the project
 *     COULD install (may overlap with installed; the host filters
 *     it however it wants).
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
import {
  ASSET_PACK_CATALOG_SERVICE_TYPE,
  type IAssetPackCatalogService,
} from "../services/AssetPackCatalogService.js";

export const listAssetPacksAction: Action = {
  name: "LIST_ASSET_PACKS",
  similes: [
    "AVAILABLE_ASSET_PACKS",
    "LIST_INSTALLABLE_PACKS",
    "ASSET_PACK_CATALOG",
  ],
  description:
    'List the asset packs the active project could install. Returns one entry per pack with `manifestId`, `name`, `description`, `packVersion`, `assetCount`, `tags`, `source` ("builtin" / "team" / "marketplace"), plus section counts (`biomeCount`, `terrainShaderCount`, `terrainHeightmapPresetCount`, `terrainNoiseFunctionCount`, `waterShaderCount`, `waterAnimationCount`, `vegetationSpeciesCount`, `vegetationDensityRuleCount`) so you can answer "how many biomes / vegetation species does pack X ship?" without re-fetching the full manifest. Use this BEFORE PROPOSE_ASSET_PACK_INSTALL so the install proposal references real pack ids.',

  parameters: [],

  validate: async (runtime: IAgentRuntime) => {
    return runtime !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const catalog = runtime.getService(
      ASSET_PACK_CATALOG_SERVICE_TYPE,
    ) as unknown as IAssetPackCatalogService | null;

    const packs = catalog?.listInstallable() ?? [];

    const summary: string[] = [];
    if (packs.length === 0) {
      summary.push("No asset packs available to install.");
    } else {
      summary.push(
        `${packs.length} asset pack${packs.length === 1 ? "" : "s"} available:`,
      );
      for (const p of packs) {
        const tagPart = p.tags.length > 0 ? ` [${p.tags.join(", ")}]` : "";
        const sectionParts: string[] = [];
        if ((p.biomeCount ?? 0) > 0)
          sectionParts.push(
            `${p.biomeCount} biome${p.biomeCount === 1 ? "" : "s"}`,
          );
        if ((p.terrainShaderCount ?? 0) > 0)
          sectionParts.push(
            `${p.terrainShaderCount} terrain shader${p.terrainShaderCount === 1 ? "" : "s"}`,
          );
        if ((p.terrainHeightmapPresetCount ?? 0) > 0)
          sectionParts.push(
            `${p.terrainHeightmapPresetCount} heightmap preset${p.terrainHeightmapPresetCount === 1 ? "" : "s"}`,
          );
        if ((p.terrainNoiseFunctionCount ?? 0) > 0)
          sectionParts.push(
            `${p.terrainNoiseFunctionCount} noise fn${p.terrainNoiseFunctionCount === 1 ? "" : "s"}`,
          );
        if ((p.waterShaderCount ?? 0) > 0)
          sectionParts.push(
            `${p.waterShaderCount} water shader${p.waterShaderCount === 1 ? "" : "s"}`,
          );
        if ((p.waterAnimationCount ?? 0) > 0)
          sectionParts.push(
            `${p.waterAnimationCount} water anim${p.waterAnimationCount === 1 ? "" : "s"}`,
          );
        if ((p.vegetationSpeciesCount ?? 0) > 0)
          sectionParts.push(`${p.vegetationSpeciesCount} vegetation species`);
        if ((p.vegetationDensityRuleCount ?? 0) > 0)
          sectionParts.push(
            `${p.vegetationDensityRuleCount} vegetation rule${p.vegetationDensityRuleCount === 1 ? "" : "s"}`,
          );
        const sectionPart =
          sectionParts.length > 0 ? ` {${sectionParts.join(", ")}}` : "";
        summary.push(
          `  - ${p.manifestId} v${p.packVersion} (${p.name}, ${p.assetCount} asset${p.assetCount === 1 ? "" : "s"}, ${p.source})${tagPart}${sectionPart} — ${p.description}`,
        );
      }
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "LIST_ASSET_PACKS" });

    return {
      success: true,
      text,
      values: { count: packs.length },
      data: {
        packs: packs.map((p) => ({
          manifestId: p.manifestId,
          name: p.name,
          description: p.description,
          packVersion: p.packVersion,
          assetCount: p.assetCount,
          tags: [...p.tags],
          source: p.source,
          biomeCount: p.biomeCount,
          terrainShaderCount: p.terrainShaderCount,
          terrainHeightmapPresetCount: p.terrainHeightmapPresetCount,
          terrainNoiseFunctionCount: p.terrainNoiseFunctionCount,
          waterShaderCount: p.waterShaderCount,
          waterAnimationCount: p.waterAnimationCount,
          vegetationSpeciesCount: p.vegetationSpeciesCount,
          vegetationDensityRuleCount: p.vegetationDensityRuleCount,
        })),
      } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "What asset packs are available?" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "1 asset pack available:\n  - @hyperforge/asset-pack-hyperia-v1 v1.0.0 (Hyperia Asset Pack v1, 56 assets, builtin) — Trees, rocks, fish for the Hyperia game.",
          actions: ["LIST_ASSET_PACKS"],
        },
      },
    ],
  ],
};
