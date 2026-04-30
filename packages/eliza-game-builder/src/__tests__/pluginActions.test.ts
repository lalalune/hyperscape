/**
 * LIST_PLUGINS / GET_PLUGIN — agent action tests.
 *
 * Phase B0'.D of `PLAN_PROJECT_AS_DATA.md`. Mirrors the
 * actions.test.ts pattern: thin runtime stub, assert action
 * contract.
 */

import { describe, expect, it } from "vitest";
import { listPluginsAction } from "../actions/listPlugins.js";
import { getPluginAction } from "../actions/getPlugin.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

describe("LIST_PLUGINS action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await listPluginsAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("validates false when service is missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(await listPluginsAction.validate(runtime, makeMessage(""))).toBe(
      false,
    );
  });

  it("returns the known plugins", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await listPluginsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as
      | { plugins: Array<{ id: string; name: string }> }
      | undefined;
    expect(data?.plugins.length).toBeGreaterThan(0);
    const ids = data?.plugins.map((p) => p.id) ?? [];
    expect(ids).toContain("com.hyperforge.hyperscape");
    expect(ids).toContain("com.hyperforge.plugin-shooter-demo");
    expect(calls[0]?.action).toBe("LIST_PLUGINS");
    expect(r?.values?.count).toBe(data?.plugins.length);
  });

  it("each entry exposes id, npmName, name, description, tags", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await listPluginsAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    const data = r?.data as
      | {
          plugins: Array<{
            id: string;
            npmName: string | null;
            name: string;
            description: string;
            tags: string[];
          }>;
        }
      | undefined;
    expect(data?.plugins.every((p) => typeof p.id === "string")).toBe(true);
    expect(
      data?.plugins.every(
        (p) => typeof p.name === "string" && p.name.length > 0,
      ),
    ).toBe(true);
    expect(
      data?.plugins.every(
        (p) => typeof p.description === "string" && p.description.length > 0,
      ),
    ).toBe(true);
    expect(data?.plugins.every((p) => Array.isArray(p.tags))).toBe(true);
  });
});

describe("GET_PLUGIN action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await getPluginAction.validate(runtime, makeMessage(""))).toBe(true);
  });

  it("rejects when `id` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await getPluginAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
    expect(r?.error).toBeInstanceOf(Error);
  });

  it("returns plugin info when looked up by manifest id", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await getPluginAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { id: "com.hyperforge.hyperscape" },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as
      | { plugin: { id: string; name: string; npmName: string | null } }
      | undefined;
    expect(data?.plugin.id).toBe("com.hyperforge.hyperscape");
    expect(data?.plugin.name).toBe("Hyperia");
  });

  it("returns plugin info when looked up by npm name", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await getPluginAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { id: "@hyperforge/plugin-shooter-demo" },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as
      | { plugin: { id: string; name: string } }
      | undefined;
    expect(data?.plugin.id).toBe("com.hyperforge.plugin-shooter-demo");
    expect(data?.plugin.name).toBe("Shooter Demo");
  });

  it("returns success: false for unknown plugin id", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await getPluginAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { id: "com.example.does-not-exist" },
      callback,
    );
    expect(r?.success).toBe(false);
    expect(r?.text).toContain("Unknown plugin");
  });
});
