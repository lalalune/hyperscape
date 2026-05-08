/**
 * LIST_CONTRIBUTIONS — generic contribution catalog action tests.
 *
 * Phase 3.1 of PLAN_AAA_MASTER_AUDIT. Locks in the broader R2.P10
 * pattern: a single generic action that walks 6 string[] plugin
 * contribution fields (`systems`, `entities`, `widgets`,
 * `manifestSchemas`, `paletteCategories`, `toolbarTools`, plus
 * `commands` for completeness). Coverage:
 *   - validate true unconditionally
 *   - rejects missing / unknown `kind`
 *   - empty result when no plugins installed
 *   - empty result when plugins installed but none contribute the kind
 *   - returns one group per contributing plugin, filtered to installed
 *   - chat text mirrors data shape (totals + per-plugin entries)
 *   - smoke-test every supported kind to prevent kind→field drift
 */

import { describe, expect, it } from "vitest";
import { listContributionsAction } from "../actions/listContributions.js";
import {
  PLUGIN_CATALOG_SERVICE_TYPE,
  makePluginCatalogService,
  type InstallablePlugin,
  type PluginContributionKind,
} from "../services/PluginCatalogService.js";
import {
  PROJECT_CONTEXT_SERVICE_TYPE,
  makeProjectContextService,
  type ProjectContext,
} from "../services/ProjectContextService.js";
import type { IAgentRuntime } from "@elizaos/core";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeRuntime(
  plugins: ReadonlyArray<InstallablePlugin>,
  context: ProjectContext | null,
): IAgentRuntime {
  const stub = makeStubRuntime();
  const original = stub.runtime;
  return {
    ...original,
    getService: <T>(name: string): T | null => {
      if (name === PLUGIN_CATALOG_SERVICE_TYPE) {
        return makePluginCatalogService(plugins) as unknown as T;
      }
      if (name === PROJECT_CONTEXT_SERVICE_TYPE) {
        return makeProjectContextService(context) as unknown as T;
      }
      return original.getService<T>(name);
    },
  } as unknown as IAgentRuntime;
}

const COMBAT_PLUGIN: InstallablePlugin = {
  id: "com.hyperforge.combat",
  npmName: "@hyperforge/combat",
  name: "Combat",
  description: "Tick-based combat plugin.",
  tags: [],
  commandContributions: [
    "com.hyperforge.combat.commands.swap-ability",
    "com.hyperforge.combat.commands.toggle-prayer",
  ],
  systemContributions: ["combat", "prayer"],
  entityContributions: ["mob"],
  widgetContributions: ["combatHud"],
  manifestSchemaContributions: ["combatStyle"],
  paletteCategoryContributions: ["combat"],
  toolbarToolContributions: ["spawnMob"],
};

const QUEST_PLUGIN: InstallablePlugin = {
  id: "com.hyperforge.quest",
  npmName: "@hyperforge/quest",
  name: "Quest",
  description: "Quest plugin.",
  tags: [],
  commandContributions: ["com.hyperforge.quest.commands.accept"],
  systemContributions: ["questLog"],
  // No entityContributions — quest has none.
  widgetContributions: ["questTracker"],
};

const NOOP_PLUGIN: InstallablePlugin = {
  id: "com.hyperforge.noop",
  npmName: null,
  name: "Noop",
  description: "Plugin with no declared contributions.",
  tags: [],
};

describe("LIST_CONTRIBUTIONS action", () => {
  it("validate returns true unconditionally", async () => {
    const { runtime } = makeStubRuntime();
    expect(
      await listContributionsAction.validate(runtime, makeMessage("")),
    ).toBe(true);
  });

  it("rejects missing kind", async () => {
    const { runtime, callback } = makeStubRuntime();
    const r = await listContributionsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
    expect(r?.text).toMatch(/requires `kind`/);
  });

  it("rejects unknown kind", async () => {
    const { runtime, callback } = makeStubRuntime();
    const r = await listContributionsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { kind: "bogus" },
      callback,
    );
    expect(r?.success).toBe(false);
    expect(r?.text).toMatch(/requires `kind`/);
  });

  it("returns 'no plugins installed' when project context has none", async () => {
    const runtime = makeRuntime([COMBAT_PLUGIN], { plugins: [] });
    const r = await listContributionsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { kind: "systems" },
      undefined,
    );
    expect(r?.success).toBe(true);
    expect(r?.text).toMatch(/No plugins installed/);
    const data = r?.data as { groups: unknown[]; totalCount: number };
    expect(data.groups).toEqual([]);
    expect(data.totalCount).toBe(0);
  });

  it("returns 'declare no kind' when installed plugins don't contribute the requested kind", async () => {
    const runtime = makeRuntime([NOOP_PLUGIN], {
      plugins: ["com.hyperforge.noop"],
    });
    const r = await listContributionsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { kind: "widgets" },
      undefined,
    );
    expect(r?.success).toBe(true);
    expect(r?.text).toMatch(/declare no 'widgets'/);
    const data = r?.data as { groups: unknown[] };
    expect(data.groups).toEqual([]);
  });

  it("returns one group per installed plugin that contributes the kind", async () => {
    const runtime = makeRuntime([COMBAT_PLUGIN, QUEST_PLUGIN, NOOP_PLUGIN], {
      plugins: [
        "com.hyperforge.combat",
        "com.hyperforge.quest",
        "com.hyperforge.noop",
      ],
    });
    const r = await listContributionsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { kind: "commands" },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      kind: PluginContributionKind;
      groups: Array<{
        pluginId: string;
        kind: string;
        entries: string[];
      }>;
      totalCount: number;
    };
    expect(data.kind).toBe("commands");
    expect(data.groups).toHaveLength(2); // combat + quest contribute, noop does not
    expect(data.groups[0]?.pluginId).toBe("com.hyperforge.combat");
    expect(data.groups[0]?.entries).toEqual([
      "com.hyperforge.combat.commands.swap-ability",
      "com.hyperforge.combat.commands.toggle-prayer",
    ]);
    expect(data.groups[1]?.pluginId).toBe("com.hyperforge.quest");
    expect(data.groups[1]?.entries).toEqual([
      "com.hyperforge.quest.commands.accept",
    ]);
    expect(data.totalCount).toBe(3);
    expect(r?.text).toMatch(/3 commands from 2 plugins/);
    expect(r?.text).toContain("com.hyperforge.combat.commands.swap-ability");
    expect(r?.text).toContain("com.hyperforge.quest.commands.accept");
  });

  it("filters to installed plugins — uninstalled plugins are not surfaced", async () => {
    const runtime = makeRuntime([COMBAT_PLUGIN, QUEST_PLUGIN], {
      plugins: ["com.hyperforge.combat"], // quest NOT installed
    });
    const r = await listContributionsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { kind: "systems" },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { groups: Array<{ pluginId: string }> };
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]?.pluginId).toBe("com.hyperforge.combat");
  });

  it("matches installed plugins by npmName as well as id", async () => {
    const runtime = makeRuntime([COMBAT_PLUGIN], {
      plugins: ["@hyperforge/combat"], // npm name, not id
    });
    const r = await listContributionsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { kind: "systems" },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { groups: Array<{ pluginId: string }> };
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]?.pluginId).toBe("com.hyperforge.combat");
  });

  it.each<{ kind: PluginContributionKind; expected: string[] }>([
    {
      kind: "commands",
      expected: [
        "com.hyperforge.combat.commands.swap-ability",
        "com.hyperforge.combat.commands.toggle-prayer",
      ],
    },
    { kind: "systems", expected: ["combat", "prayer"] },
    { kind: "entities", expected: ["mob"] },
    { kind: "widgets", expected: ["combatHud"] },
    { kind: "manifestSchemas", expected: ["combatStyle"] },
    { kind: "paletteCategories", expected: ["combat"] },
    { kind: "toolbarTools", expected: ["spawnMob"] },
  ])(
    "kind=$kind walks the correct field on InstallablePlugin",
    async ({ kind, expected }) => {
      const runtime = makeRuntime([COMBAT_PLUGIN], {
        plugins: ["com.hyperforge.combat"],
      });
      const r = await listContributionsAction.handler(
        runtime,
        makeMessage(""),
        undefined,
        { kind },
        undefined,
      );
      expect(r?.success).toBe(true);
      const data = r?.data as {
        groups: Array<{ entries: string[] }>;
        kind: PluginContributionKind;
      };
      expect(data.kind).toBe(kind);
      expect(data.groups[0]?.entries).toEqual(expected);
    },
  );
});
