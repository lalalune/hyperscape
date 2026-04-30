/**
 * PROPOSE_PLUGIN_SET — agent action tests.
 *
 * Phase B0'.I of `PLAN_PROJECT_AS_DATA.md`. Validation tests cover:
 *   - validate gate
 *   - missing pluginIds rejection
 *   - empty pluginIds → blank canvas (success)
 *   - manifest-id resolution
 *   - npm-name resolution
 *   - unknown id rejection
 *   - de-duplication
 *   - chat summary text shape
 */

import { describe, expect, it } from "vitest";
import { proposePluginSetAction } from "../actions/proposePluginSet.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

describe("PROPOSE_PLUGIN_SET action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(
      await proposePluginSetAction.validate(runtime, makeMessage("")),
    ).toBe(true);
  });

  it("rejects when `pluginIds` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposePluginSetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
    expect(r?.error).toBeInstanceOf(Error);
  });

  it("accepts an empty pluginIds array (blank canvas)", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposePluginSetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { pluginIds: [] },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.count).toBe(0);
    const data = r?.data as { pluginIds: string[] } | undefined;
    expect(data?.pluginIds).toEqual([]);
    expect(calls[0]?.text).toContain("blank");
  });

  it("resolves manifest ids", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposePluginSetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { pluginIds: ["com.hyperforge.hyperscape"] },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { pluginIds: string[] } | undefined;
    expect(data?.pluginIds).toEqual(["com.hyperforge.hyperscape"]);
  });

  it("resolves npm names to manifest ids", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposePluginSetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { pluginIds: ["@hyperforge/hyperscape"] },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { pluginIds: string[] } | undefined;
    expect(data?.pluginIds).toEqual(["com.hyperforge.hyperscape"]);
  });

  it("rejects unknown plugin id", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposePluginSetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { pluginIds: ["com.example.does-not-exist"] },
      callback,
    );
    expect(r?.success).toBe(false);
    expect(r?.text).toContain("Unknown plugin");
    const data = r?.data as { unknown: string[] } | undefined;
    expect(data?.unknown).toContain("com.example.does-not-exist");
  });

  it("de-duplicates ids that resolve to the same manifest id", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposePluginSetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        pluginIds: ["com.hyperforge.hyperscape", "@hyperforge/hyperscape"],
      },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { pluginIds: string[] } | undefined;
    expect(data?.pluginIds).toEqual(["com.hyperforge.hyperscape"]);
  });

  it("accepts a multi-plugin set", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposePluginSetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        pluginIds: [
          "com.hyperforge.hyperscape",
          "com.hyperforge.plugin-shooter-demo",
        ],
      },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.count).toBe(2);
    const data = r?.data as { pluginIds: string[] } | undefined;
    expect(data?.pluginIds).toContain("com.hyperforge.hyperscape");
    expect(data?.pluginIds).toContain("com.hyperforge.plugin-shooter-demo");
  });

  it("surfaces resolved ids + names in chat summary text", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    await proposePluginSetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { pluginIds: ["com.hyperforge.hyperscape"] },
      callback,
    );
    const text = calls[0]?.text ?? "";
    expect(text).toContain("com.hyperforge.hyperscape");
    expect(text).toContain("Hyperia"); // friendly name from registry
  });
});
