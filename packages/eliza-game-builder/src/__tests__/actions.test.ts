import { describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { catalogStatsAction } from "../actions/catalogStats.js";
import { listWidgetsAction } from "../actions/listWidgets.js";
import { getWidgetAction } from "../actions/getWidget.js";
import { searchWidgetsAction } from "../actions/searchWidgets.js";
import { scaffoldWidgetAction } from "../actions/scaffoldWidget.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(workspaceRoot?: string): GameBuilderService {
  return GameBuilderService.create({
    catalog: fixtureCatalog,
    workspaceRoot,
  });
}

describe("GET_CATALOG_STATS action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await catalogStatsAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("validates false when service missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(await catalogStatsAction.validate(runtime, makeMessage(""))).toBe(
      false,
    );
  });

  it("returns total + byCategory in data", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await catalogStatsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.total).toBe(2);
    expect(calls[0]!.action).toBe("GET_CATALOG_STATS");
    expect(calls[0]!.text).toContain("2 widgets");
  });
});

describe("LIST_GAME_WIDGETS action", () => {
  it("returns every widget with no filter", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await listWidgetsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.count).toBe(2);
  });

  it("filters by category from parameters", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await listWidgetsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { parameters: { category: "panel" } },
      callback,
    );
    expect(r?.values?.count).toBe(1);
  });

  it("returns empty when category has no widgets", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await listWidgetsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { parameters: { category: "ghost" } },
      callback,
    );
    expect(r?.values?.count).toBe(0);
  });

  it("returns failure when service missing", async () => {
    const { runtime, callback } = makeStubRuntime();
    const r = await listWidgetsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });
});

describe("GET_GAME_WIDGET action", () => {
  it("returns the widget for a known id", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await getWidgetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { parameters: { id: "com.test.demo.alpha" } },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("com.test.demo.alpha");
    expect(calls[0]!.text).toContain("Label text");
  });

  it("returns failure for unknown id", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await getWidgetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { parameters: { id: "com.does.not.exist" } },
      callback,
    );
    expect(r?.success).toBe(false);
    expect(r?.text).toContain("not found");
  });

  it("returns failure when id parameter missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await getWidgetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
    expect((r?.error as Error).message).toContain("requires `id`");
  });
});

describe("SEARCH_GAME_WIDGETS action", () => {
  it("matches across fields", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const byName = await searchWidgetsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { parameters: { query: "alpha" } },
      callback,
    );
    expect(byName?.values?.count).toBe(1);

    const bySummary = await searchWidgetsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { parameters: { query: "alpha things" } },
      callback,
    );
    expect(bySummary?.values?.count).toBe(1);
  });

  it("returns failure when query missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await searchWidgetsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });
});

describe("SCAFFOLD_WIDGET action", () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), "eliza-scaffold-"));
  });

  it("writes files for a valid spec", async () => {
    const { runtime, callback } = makeStubRuntime({
      service: makeService(workspaceRoot),
    });
    const r = await scaffoldWidgetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        parameters: {
          spec: {
            name: "DemoWidget",
            manifestId: "com.test.demo.demo",
            category: "panel",
            defaultSize: { width: 4, height: 3 },
            props: [],
          },
          widgetsDir: "src/widgets",
          testsDir: "src/widgets/__tests__",
          indexFile: "src/index.ts",
        },
      },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.written).toBe(2);
    expect(
      existsSync(join(workspaceRoot, "src/widgets/DemoWidgetWidget.tsx")),
    ).toBe(true);
  });

  it("dryRun=true writes nothing but reports the plan", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(workspaceRoot),
    });
    const r = await scaffoldWidgetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        parameters: {
          spec: {
            name: "DryWidget",
            manifestId: "com.test.demo.dry",
            category: "panel",
            defaultSize: { width: 4, height: 3 },
            props: [],
          },
          dryRun: true,
          widgetsDir: "src/widgets",
          testsDir: "src/widgets/__tests__",
          indexFile: "src/index.ts",
        },
      },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.dryRun).toBe(true);
    expect(calls[0]!.text).toContain("Dry run");
    expect(
      existsSync(join(workspaceRoot, "src/widgets/DryWidgetWidget.tsx")),
    ).toBe(false);
  });

  it("rejects invalid spec with structured issues", async () => {
    const { runtime, callback } = makeStubRuntime({
      service: makeService(workspaceRoot),
    });
    const r = await scaffoldWidgetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        parameters: {
          spec: {
            name: "lowercase",
            manifestId: "BadId",
            category: "panel",
            defaultSize: { width: 4, height: 3 },
            props: [],
          },
        },
      },
      callback,
    );
    expect(r?.success).toBe(false);
    expect(r?.text).toContain("Spec invalid");
  });

  it("returns failure when spec missing", async () => {
    const { runtime, callback } = makeStubRuntime({
      service: makeService(workspaceRoot),
    });
    const r = await scaffoldWidgetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("scaffolds spec with props end-to-end (round-trip)", async () => {
    const { runtime, callback } = makeStubRuntime({
      service: makeService(workspaceRoot),
    });
    await scaffoldWidgetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        parameters: {
          spec: {
            name: "FishingProgressBar",
            manifestId: "com.test.demo.fishing-progress",
            category: "hud",
            defaultSize: { width: 4, height: 1 },
            props: [
              { name: "percent", type: "number", defaultValue: 0 },
              {
                name: "label",
                type: "string",
                defaultValue: "Fishing",
                description: "Visible activity label",
              },
            ],
          },
          widgetsDir: "src/widgets",
          testsDir: "src/widgets/__tests__",
          indexFile: "src/index.ts",
        },
      },
      callback,
    );
    const sourcePath = join(
      workspaceRoot,
      "src/widgets/FishingProgressBarWidget.tsx",
    );
    expect(existsSync(sourcePath)).toBe(true);
    const source = readFileSync(sourcePath, "utf8");
    expect(source).toContain("z.number().default(0)");
    expect(source).toContain('z.string().default("Fishing")');
    expect(source).toContain('.describe("Visible activity label")');
  });
});

describe("gameBuilderPlugin", () => {
  it("exports plugin with all actions and the service", async () => {
    const mod = await import("../index.js");
    const plugin = mod.gameBuilderPlugin;
    expect(plugin.name).toBe("@hyperforge/eliza-game-builder");
    expect(plugin.actions?.length).toBe(19);
    expect(plugin.services?.length).toBe(1);
    expect(plugin.actions?.map((a) => a.name).sort()).toEqual([
      "GET_CATALOG_STATS",
      "GET_GAME_WIDGET",
      "GET_PLUGIN",
      "GET_PROJECT_STATE",
      "LIST_GAME_WIDGETS",
      "LIST_PLUGINS",
      "OFFER_CHOICES",
      "PROPOSE_ASSET",
      "PROPOSE_MOB_SPAWN",
      "PROPOSE_NPC_PLACEMENT",
      "PROPOSE_PLUGIN_SET",
      "PROPOSE_QUEST",
      "PROPOSE_RESOURCE",
      "PROPOSE_TERRAIN_CONFIG",
      "PROPOSE_UI_PACK",
      "PROPOSE_ZONE",
      "REMOVE_FROM_PROJECT",
      "SCAFFOLD_WIDGET",
      "SEARCH_GAME_WIDGETS",
    ]);
  });
});
