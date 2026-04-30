/**
 * PROPOSE_ASSET_PACK_INSTALL — agent action tests.
 *
 * Phase AP5 of `PLAN_ASSET_PACKS.md`. Coverage:
 *   - rejects when assetPackIds parameter missing
 *   - rejects empty array (use UI to remove packs)
 *   - rejects unknown ids (not in catalog)
 *   - returns resolved list when all ids known
 *   - de-dupes when same id given twice
 *   - works without a registered catalog service (everything unknown)
 */

import { describe, expect, it } from "vitest";
import { proposeAssetPackInstallAction } from "../actions/proposeAssetPackInstall.js";
import {
  ASSET_PACK_CATALOG_SERVICE_TYPE,
  makeAssetPackCatalogService,
  type InstallableAssetPack,
} from "../services/AssetPackCatalogService.js";
import type { IAgentRuntime } from "@elizaos/core";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

const HYPERIA: InstallableAssetPack = {
  manifestId: "@hyperforge/asset-pack-hyperia-v1",
  name: "Hyperia Asset Pack v1",
  description: "Trees, rocks, fish.",
  packVersion: "1.0.0",
  assetCount: 56,
  tags: [],
  source: "builtin",
};

const TEAM_PACK: InstallableAssetPack = {
  manifestId: "@team/custom",
  name: "Custom Pack",
  description: "Team's pack.",
  packVersion: "0.1.0",
  assetCount: 4,
  tags: [],
  source: "team",
};

function makeRuntimeWithCatalog(
  packs: ReadonlyArray<InstallableAssetPack>,
): IAgentRuntime {
  const stub = makeStubRuntime();
  const original = stub.runtime;
  return {
    ...original,
    getService: <T>(name: string): T | null => {
      if (name === ASSET_PACK_CATALOG_SERVICE_TYPE) {
        return makeAssetPackCatalogService(packs) as unknown as T;
      }
      return original.getService<T>(name);
    },
  } as unknown as IAgentRuntime;
}

describe("PROPOSE_ASSET_PACK_INSTALL action", () => {
  it("rejects when assetPackIds parameter missing", async () => {
    const runtime = makeRuntimeWithCatalog([HYPERIA]);
    const r = await proposeAssetPackInstallAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {},
      undefined,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects empty array", async () => {
    const runtime = makeRuntimeWithCatalog([HYPERIA]);
    const r = await proposeAssetPackInstallAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { assetPackIds: [] },
      undefined,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects unknown ids", async () => {
    const runtime = makeRuntimeWithCatalog([HYPERIA]);
    const r = await proposeAssetPackInstallAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { assetPackIds: ["@bogus/not-a-pack"] },
      undefined,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as { unknown?: string[] };
    expect(data?.unknown).toEqual(["@bogus/not-a-pack"]);
  });

  it("returns resolved list when all ids known", async () => {
    const runtime = makeRuntimeWithCatalog([HYPERIA, TEAM_PACK]);
    const r = await proposeAssetPackInstallAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { assetPackIds: [HYPERIA.manifestId, TEAM_PACK.manifestId] },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { assetPackIds: string[] };
    expect(data.assetPackIds).toEqual([
      HYPERIA.manifestId,
      TEAM_PACK.manifestId,
    ]);
    expect(r?.text).toMatch(/2 packs/);
  });

  it("de-dupes when same id given twice", async () => {
    const runtime = makeRuntimeWithCatalog([HYPERIA]);
    const r = await proposeAssetPackInstallAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        assetPackIds: [HYPERIA.manifestId, HYPERIA.manifestId],
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { assetPackIds: string[] };
    expect(data.assetPackIds).toEqual([HYPERIA.manifestId]);
  });

  it("treats every id as unknown when no catalog service registered", async () => {
    const { runtime } = makeStubRuntime();
    const r = await proposeAssetPackInstallAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { assetPackIds: [HYPERIA.manifestId] },
      undefined,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as { unknown?: string[] };
    expect(data?.unknown).toEqual([HYPERIA.manifestId]);
  });
});
