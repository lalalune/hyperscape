/**
 * LIST_COMMANDS — agent action tests.
 *
 * Phase 3.1 of PLAN_AAA_MASTER_AUDIT (R2.P10 broader pattern × 1).
 * Mirrors LIST_ASSET_PACKS / LIST_CONTRIBUTIONS coverage:
 *   - validate true unconditionally
 *   - empty when no project context plumbed
 *   - empty when project explicitly has no plugins installed
 *   - chat text + data shape match — no "no plugins installed" + non-empty data
 *   - filters to installed plugins only (matches by id or npm name)
 *   - omits plugins with no command contributions
 */

import { describe, expect, it } from "vitest";
import { listCommandsAction } from "../actions/listCommands.js";
import {
  PLUGIN_CATALOG_SERVICE_TYPE,
  makePluginCatalogService,
  type InstallablePlugin,
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
};

const QUEST_PLUGIN: InstallablePlugin = {
  id: "com.hyperforge.quest",
  npmName: "@hyperforge/quest",
  name: "Quest",
  description: "Quest plugin.",
  tags: [],
  commandContributions: ["com.hyperforge.quest.commands.accept"],
};

const NOOP_PLUGIN: InstallablePlugin = {
  id: "com.hyperforge.noop",
  npmName: null,
  name: "Noop",
  description: "Plugin with no command contributions.",
  tags: [],
};

describe("LIST_COMMANDS action", () => {
  it("validate returns true unconditionally", async () => {
    const { runtime } = makeStubRuntime();
    expect(await listCommandsAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("returns 'no plugins installed' when project context says zero plugins", async () => {
    const runtime = makeRuntime([COMBAT_PLUGIN], { plugins: [] });
    const r = await listCommandsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    expect(r?.text).toMatch(/No plugins installed/);
    const data = r?.data as {
      commandsByPlugin: unknown[];
      totalCount: number;
    };
    expect(data.commandsByPlugin).toEqual([]);
    expect(data.totalCount).toBe(0);
  });

  it("returns 'declare no commands' when installed plugins contribute none", async () => {
    const runtime = makeRuntime([NOOP_PLUGIN], {
      plugins: ["com.hyperforge.noop"],
    });
    const r = await listCommandsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    expect(r?.text).toMatch(/declare no commands/);
    const data = r?.data as { commandsByPlugin: unknown[] };
    expect(data.commandsByPlugin).toEqual([]);
  });

  it("returns one group per installed plugin that contributes commands", async () => {
    const runtime = makeRuntime([COMBAT_PLUGIN, QUEST_PLUGIN, NOOP_PLUGIN], {
      plugins: [
        "com.hyperforge.combat",
        "com.hyperforge.quest",
        "com.hyperforge.noop",
      ],
    });
    const r = await listCommandsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      commandsByPlugin: Array<{
        pluginId: string;
        commands: string[];
      }>;
      totalCount: number;
    };
    expect(data.commandsByPlugin).toHaveLength(2); // noop omitted
    expect(data.commandsByPlugin[0]?.pluginId).toBe("com.hyperforge.combat");
    expect(data.commandsByPlugin[0]?.commands).toEqual([
      "com.hyperforge.combat.commands.swap-ability",
      "com.hyperforge.combat.commands.toggle-prayer",
    ]);
    expect(data.commandsByPlugin[1]?.pluginId).toBe("com.hyperforge.quest");
    expect(data.totalCount).toBe(3);
    expect(r?.text).toMatch(/3 commands from 2 plugins/);
  });

  it("filters to installed plugins — uninstalled plugins are not surfaced", async () => {
    const runtime = makeRuntime([COMBAT_PLUGIN, QUEST_PLUGIN], {
      plugins: ["com.hyperforge.combat"],
    });
    const r = await listCommandsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      commandsByPlugin: Array<{ pluginId: string }>;
    };
    expect(data.commandsByPlugin).toHaveLength(1);
    expect(data.commandsByPlugin[0]?.pluginId).toBe("com.hyperforge.combat");
  });

  it("matches installed plugins by npm name as well as id", async () => {
    const runtime = makeRuntime([COMBAT_PLUGIN], {
      plugins: ["@hyperforge/combat"],
    });
    const r = await listCommandsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      commandsByPlugin: Array<{ pluginId: string }>;
    };
    expect(data.commandsByPlugin).toHaveLength(1);
    expect(data.commandsByPlugin[0]?.pluginId).toBe("com.hyperforge.combat");
  });
});
