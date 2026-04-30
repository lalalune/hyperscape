/**
 * GET_PROJECT_STATE — agent action tests.
 *
 * Phase A3 of the AAA gap audit. Coverage:
 *   - validate true regardless of project context (returns null when missing)
 *   - returns `{ projectContext: null }` when no service registered
 *   - returns summary view by default
 *   - returns full / plugins / worldContent / config slices on demand
 *   - bad `select` value falls back to summary
 */

import { describe, expect, it } from "vitest";
import { getProjectStateAction } from "../actions/getProjectState.js";
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

describe("GET_PROJECT_STATE action", () => {
  it("validate returns true unconditionally", async () => {
    const { runtime } = makeStubRuntime();
    expect(await getProjectStateAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("returns { projectContext: null } when no service registered", async () => {
    const { runtime, callback } = makeStubRuntime();
    const r = await getProjectStateAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { projectContext: unknown } | undefined;
    expect(data?.projectContext).toBeNull();
  });

  it("returns summary view by default", async () => {
    const ctx: ProjectContext = {
      projectId: "proj-abc",
      templateId: "hyperia",
      plugins: ["@hyperforge/hyperscape"],
      worldContent: {
        npcs: [{ id: "n1" }, { id: "n2" }],
        spawns: [{ mobId: "goblin" }],
        zones: [],
        uiPack: { id: "default-hud" },
      },
    };
    const runtime = makeRuntimeWithCtx(ctx);
    const r = await getProjectStateAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      projectContext: {
        projectId?: string;
        templateId?: string | null;
        plugins?: string[];
        counts?: {
          npcs: number;
          mobSpawns: number;
          zones: number;
          quests: number;
          hasUiPack: boolean;
          assetPacks: number;
          availableAssets: number;
        };
      };
      select: string;
    };
    expect(data.select).toBe("summary");
    expect(data.projectContext.projectId).toBe("proj-abc");
    expect(data.projectContext.templateId).toBe("hyperia");
    expect(data.projectContext.plugins).toEqual(["@hyperforge/hyperscape"]);
    expect(data.projectContext.counts).toEqual({
      npcs: 2,
      mobSpawns: 1,
      zones: 0,
      quests: 0,
      hasUiPack: true,
      assetPacks: 0,
      availableAssets: 0,
    });
    // Should NOT include the raw worldContent in summary view
    expect(
      (data.projectContext as Record<string, unknown>).worldContent,
    ).toBeUndefined();
  });

  it("returns full slice when select=full", async () => {
    const ctx: ProjectContext = {
      projectId: "p",
      templateId: "blank",
      config: { seed: 42 },
      plugins: [],
      worldContent: { npcs: [] },
    };
    const runtime = makeRuntimeWithCtx(ctx);
    const r = await getProjectStateAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { select: "full" },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      projectContext: {
        projectId?: string;
        config?: { seed: number };
        worldContent?: { npcs: unknown[] };
      };
      select: string;
    };
    expect(data.select).toBe("full");
    expect(data.projectContext.config).toEqual({ seed: 42 });
    expect(data.projectContext.worldContent).toEqual({ npcs: [] });
  });

  it("returns just plugins when select=plugins", async () => {
    const ctx: ProjectContext = {
      plugins: ["@hyperforge/hyperscape", "@hyperforge/plugin-shooter-demo"],
    };
    const runtime = makeRuntimeWithCtx(ctx);
    const r = await getProjectStateAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { select: "plugins" },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { projectContext: { plugins: string[] } };
    expect(data.projectContext.plugins).toEqual([
      "@hyperforge/hyperscape",
      "@hyperforge/plugin-shooter-demo",
    ]);
  });

  it("falls back to summary when select is invalid", async () => {
    const ctx: ProjectContext = { projectId: "x" };
    const runtime = makeRuntimeWithCtx(ctx);
    const r = await getProjectStateAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { select: "garbage-mode" },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { select: string };
    expect(data.select).toBe("summary");
  });

  it("returns flattened catalog when select=availableAssets", async () => {
    const ctx: ProjectContext = {
      projectId: "p",
      assetPacks: [
        {
          manifestId: "@hyperforge/asset-pack-hyperia-v1",
          name: "Hyperia v1",
          packVersion: "1.0.0",
          assets: [
            {
              id: "tree-oak-01",
              name: "Oak Tree",
              type: "prop",
              subtype: "tree",
              tags: ["woodcutting"],
            },
            {
              id: "rock-iron-01",
              name: "Iron Rock",
              type: "prop",
              subtype: "rock",
            },
          ],
        },
        {
          manifestId: "@studio/test-pack",
          name: "Test Pack",
          packVersion: "0.1.0",
          assets: [
            {
              id: "sword-basic",
              name: "Basic Sword",
              type: "weapon",
              subtype: "sword",
            },
          ],
        },
      ],
    };
    const runtime = makeRuntimeWithCtx(ctx);
    const r = await getProjectStateAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { select: "availableAssets" },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      projectContext: {
        packs: Array<{ manifestId: string; assetCount: number }>;
        assets: Array<{
          ref: string;
          packId: string;
          id: string;
          name: string;
          type: string;
          subtype: string;
          tags?: string[];
        }>;
      };
      select: string;
    };
    expect(data.select).toBe("availableAssets");
    expect(data.projectContext.packs).toEqual([
      {
        manifestId: "@hyperforge/asset-pack-hyperia-v1",
        name: "Hyperia v1",
        packVersion: "1.0.0",
        assetCount: 2,
      },
      {
        manifestId: "@studio/test-pack",
        name: "Test Pack",
        packVersion: "0.1.0",
        assetCount: 1,
      },
    ]);
    expect(data.projectContext.assets).toHaveLength(3);
    expect(data.projectContext.assets[0]).toEqual({
      ref: "@hyperforge/asset-pack-hyperia-v1/tree-oak-01",
      packId: "@hyperforge/asset-pack-hyperia-v1",
      id: "tree-oak-01",
      name: "Oak Tree",
      type: "prop",
      subtype: "tree",
      tags: ["woodcutting"],
    });
    // Asset without tags should not include the empty `tags` field.
    expect(data.projectContext.assets[1]).toEqual({
      ref: "@hyperforge/asset-pack-hyperia-v1/rock-iron-01",
      packId: "@hyperforge/asset-pack-hyperia-v1",
      id: "rock-iron-01",
      name: "Iron Rock",
      type: "prop",
      subtype: "rock",
    });
    expect(data.projectContext.assets[2].ref).toBe(
      "@studio/test-pack/sword-basic",
    );
  });

  it("availableAssets returns empty when no packs installed", async () => {
    const ctx: ProjectContext = { projectId: "p" };
    const runtime = makeRuntimeWithCtx(ctx);
    const r = await getProjectStateAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { select: "availableAssets" },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      projectContext: { packs: unknown[]; assets: unknown[] };
    };
    expect(data.projectContext.packs).toEqual([]);
    expect(data.projectContext.assets).toEqual([]);
  });

  it("summary view surfaces pack counts", async () => {
    const ctx: ProjectContext = {
      projectId: "p",
      assetPacks: [
        {
          manifestId: "@hyperforge/asset-pack-hyperia-v1",
          name: "Hyperia v1",
          packVersion: "1.0.0",
          assets: [
            { id: "a", name: "A", type: "prop", subtype: "tree" },
            { id: "b", name: "B", type: "prop", subtype: "rock" },
            { id: "c", name: "C", type: "creature", subtype: "humanoid" },
          ],
        },
      ],
    };
    const runtime = makeRuntimeWithCtx(ctx);
    const r = await getProjectStateAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      projectContext: {
        counts: { assetPacks: number; availableAssets: number };
      };
      text: string;
    };
    expect(data.projectContext.counts.assetPacks).toBe(1);
    expect(data.projectContext.counts.availableAssets).toBe(3);
    expect(r?.text).toMatch(/Asset packs: 1 installed/);
  });
});
