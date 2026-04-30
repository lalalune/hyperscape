/**
 * LIST_ENTITY_TYPES — Layer B catalog action tests.
 *
 * Coverage:
 *   - validate true unconditionally
 *   - empty installed plugins → empty catalog with helpful copy
 *   - Hyperia plugin installed → its 15 entity types surface
 *   - kind filter narrows correctly (e.g. kind=npc)
 *   - unknown plugin ids drop silently (forward-compat)
 *   - no project context registered → empty result, no crash
 */

import { describe, expect, it } from "vitest";
import { listEntityTypesAction } from "../actions/listEntityTypes.js";
import {
  PROJECT_CONTEXT_SERVICE_TYPE,
  makeProjectContextService,
  type ProjectContext,
} from "../services/ProjectContextService.js";
import type { IAgentRuntime } from "@elizaos/core";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeRuntimeWithCtx(ctx: ProjectContext | null): IAgentRuntime {
  const stub = makeStubRuntime();
  const original = stub.runtime;
  return {
    ...original,
    getService: <T>(name: string): T | null => {
      if (name === PROJECT_CONTEXT_SERVICE_TYPE) {
        return makeProjectContextService(ctx) as unknown as T;
      }
      return original.getService<T>(name);
    },
  } as unknown as IAgentRuntime;
}

describe("LIST_ENTITY_TYPES action", () => {
  it("validate returns true unconditionally", async () => {
    const { runtime } = makeStubRuntime();
    expect(await listEntityTypesAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("empty installed plugins → empty catalog", async () => {
    const runtime = makeRuntimeWithCtx({ plugins: [] });
    const r = await listEntityTypesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      installedPlugins: string[];
      entityTypes: unknown[];
    };
    expect(data.installedPlugins).toEqual([]);
    expect(data.entityTypes).toEqual([]);
    expect(r?.text).toContain("No plugins installed");
  });

  it("Hyperia installed → its full catalog surfaces", async () => {
    const runtime = makeRuntimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
    });
    const r = await listEntityTypesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      installedPlugins: string[];
      entityTypes: Array<{
        pluginId: string;
        kind: string;
        type: string;
        requiredFields: string[];
        acceptedAssetTypes: string[];
      }>;
    };
    expect(data.installedPlugins).toEqual(["com.hyperforge.hyperscape"]);
    // 15 contributions total today (5 npc + 3 mobSpawn + 3 resource + 4 station)
    expect(data.entityTypes).toHaveLength(15);
    // Spot-check a few key types.
    const shopkeeper = data.entityTypes.find(
      (e) => e.kind === "npc" && e.type === "shopkeeper",
    );
    expect(shopkeeper).toBeDefined();
    expect(shopkeeper?.requiredFields).toEqual(["storeId"]);
    expect(shopkeeper?.acceptedAssetTypes).toEqual(["character"]);
    const tree = data.entityTypes.find(
      (e) => e.kind === "resource" && e.type === "tree",
    );
    expect(tree).toBeDefined();
    expect(tree?.acceptedAssetTypes).toEqual(["prop"]);
    const anvil = data.entityTypes.find(
      (e) => e.kind === "station" && e.type === "anvil",
    );
    expect(anvil).toBeDefined();
  });

  it("kind filter narrows to a single placement category", async () => {
    const runtime = makeRuntimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
    });
    const r = await listEntityTypesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { kind: "resource" },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      entityTypes: Array<{ kind: string; type: string }>;
    };
    expect(data.entityTypes.length).toBeGreaterThan(0);
    for (const e of data.entityTypes) {
      expect(e.kind).toBe("resource");
    }
    const types = data.entityTypes.map((e) => e.type);
    expect(types).toContain("tree");
    expect(types).toContain("rock");
    expect(types).toContain("fishing_spot");
  });

  it("falls back to all when kind value is invalid", async () => {
    const runtime = makeRuntimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
    });
    const r = await listEntityTypesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { kind: "garbage" },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { entityTypes: unknown[] };
    expect(data.entityTypes).toHaveLength(15);
  });

  it("unknown plugin ids drop silently (forward-compat)", async () => {
    const runtime = makeRuntimeWithCtx({
      plugins: ["com.hyperforge.hyperscape", "com.unknown.future-plugin"],
    });
    const r = await listEntityTypesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { entityTypes: unknown[] };
    // Only Hyperia's 15 — the unknown plugin is silently skipped.
    expect(data.entityTypes).toHaveLength(15);
  });

  it("no project context registered → empty catalog, no crash", async () => {
    const { runtime } = makeStubRuntime();
    const r = await listEntityTypesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      installedPlugins: string[];
      entityTypes: unknown[];
    };
    expect(data.installedPlugins).toEqual([]);
    expect(data.entityTypes).toEqual([]);
  });
});
