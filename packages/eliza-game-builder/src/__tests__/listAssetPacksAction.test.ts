/**
 * LIST_ASSET_PACKS — agent action tests.
 *
 * Phase AP5 of `PLAN_ASSET_PACKS.md`. Coverage:
 *   - validate true unconditionally
 *   - returns empty list when no catalog service registered
 *   - returns catalog summaries when service registered
 *   - chat-facing text mentions count + each entry
 */

import { describe, expect, it } from "vitest";
import { listAssetPacksAction } from "../actions/listAssetPacks.js";
import {
  ASSET_PACK_CATALOG_SERVICE_TYPE,
  makeAssetPackCatalogService,
  type InstallableAssetPack,
} from "../services/AssetPackCatalogService.js";
import type { IAgentRuntime } from "@elizaos/core";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

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

describe("LIST_ASSET_PACKS action", () => {
  it("validate returns true unconditionally", async () => {
    const { runtime } = makeStubRuntime();
    expect(await listAssetPacksAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("returns empty packs list when no catalog service registered", async () => {
    const { runtime, callback } = makeStubRuntime();
    const r = await listAssetPacksAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { packs: unknown[] };
    expect(data.packs).toEqual([]);
    expect(r?.text).toMatch(/No asset packs available to install/);
  });

  it("returns catalog summaries when service registered", async () => {
    const packs: InstallableAssetPack[] = [
      {
        manifestId: "@hyperforge/asset-pack-hyperia-v1",
        name: "Hyperia Asset Pack v1",
        description: "Trees, rocks, fish for the Hyperia game.",
        packVersion: "1.0.0",
        assetCount: 56,
        tags: ["hyperia", "rpg"],
        source: "builtin",
      },
      {
        manifestId: "@studio/test-pack",
        name: "Test Pack",
        description: "Internal test pack.",
        packVersion: "0.1.0",
        assetCount: 3,
        tags: [],
        source: "team",
      },
    ];
    const runtime = makeRuntimeWithCatalog(packs);
    const r = await listAssetPacksAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      packs: Array<{
        manifestId: string;
        name: string;
        description: string;
        packVersion: string;
        assetCount: number;
        tags: string[];
        source: string;
      }>;
    };
    expect(data.packs).toHaveLength(2);
    expect(data.packs[0]).toEqual({
      manifestId: "@hyperforge/asset-pack-hyperia-v1",
      name: "Hyperia Asset Pack v1",
      description: "Trees, rocks, fish for the Hyperia game.",
      packVersion: "1.0.0",
      assetCount: 56,
      tags: ["hyperia", "rpg"],
      source: "builtin",
    });
    expect(r?.text).toMatch(/2 asset packs available/);
    expect(r?.text).toContain("@hyperforge/asset-pack-hyperia-v1");
    expect(r?.text).toContain("@studio/test-pack");
  });

  it("uses singular form when exactly one pack", async () => {
    const runtime = makeRuntimeWithCatalog([
      {
        manifestId: "@x/single",
        name: "Single",
        description: "One pack.",
        packVersion: "1.0.0",
        assetCount: 1,
        tags: [],
        source: "builtin",
      },
    ]);
    const r = await listAssetPacksAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.text).toMatch(/1 asset pack available/);
    expect(r?.text).toContain("1 asset"); // singular form
  });
});
