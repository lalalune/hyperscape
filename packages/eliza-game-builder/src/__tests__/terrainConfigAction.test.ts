/**
 * PROPOSE_TERRAIN_CONFIG — agent action tests.
 *
 * Phase B0'.H of `PLAN_PROJECT_AS_DATA.md`. Mirrors the
 * proposeNpcPlacement test pattern: validate gate, missing-param
 * rejection, schema enforcement, and successful payload shape.
 */

import { describe, expect, it } from "vitest";
import { proposeTerrainConfigAction } from "../actions/proposeTerrainConfig.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

describe("PROPOSE_TERRAIN_CONFIG action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(
      await proposeTerrainConfigAction.validate(runtime, makeMessage("")),
    ).toBe(true);
  });

  it("validates false when service is missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(
      await proposeTerrainConfigAction.validate(runtime, makeMessage("")),
    ).toBe(false);
  });

  it("rejects when `config` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeTerrainConfigAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
    expect(r?.error).toBeInstanceOf(Error);
  });

  it("rejects config without seed (required field)", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeTerrainConfigAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { config: { preset: "small-island" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues.length).toBeGreaterThan(0);
    const paths = data?.issues.map((i) => i.path) ?? [];
    expect(paths).toContain("seed");
  });

  it("accepts a minimal config (just seed) and returns it on data.config", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeTerrainConfigAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { config: { seed: 42 } },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.seed).toBe(42);
    const data = r?.data as { config: { seed: number } } | undefined;
    expect(data?.config.seed).toBe(42);
    expect(calls[0]?.action).toBe("PROPOSE_TERRAIN_CONFIG");
  });

  it("accepts full WorldCreationConfig shape with passthrough knobs", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const config = {
      seed: 12345,
      preset: "large-island",
      useGamePipeline: true,
      terrain: {
        tileSize: 100,
        worldSize: 100,
        tileResolution: 32,
        maxHeight: 50,
        waterThreshold: 16,
      },
      biomes: { distribution: "uniform" },
      vegetation: { trees: { density: 0.5 } },
    };
    const r = await proposeTerrainConfigAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { config },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as
      | {
          config: {
            seed: number;
            preset?: string;
            terrain?: { tileSize?: number };
            biomes?: { distribution?: string };
            vegetation?: { trees?: { density?: number } };
          };
        }
      | undefined;
    expect(data?.config.seed).toBe(12345);
    expect(data?.config.preset).toBe("large-island");
    expect(data?.config.terrain?.tileSize).toBe(100);
    expect(data?.config.biomes?.distribution).toBe("uniform");
    expect(data?.config.vegetation?.trees?.density).toBe(0.5);
  });

  it("surfaces seed + key knobs in the chat summary text", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    await proposeTerrainConfigAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        config: {
          seed: 7,
          preset: "atoll",
          terrain: { tileSize: 100, worldSize: 50 },
        },
      },
      callback,
    );
    const text = calls[0]?.text ?? "";
    expect(text).toContain("seed: 7");
    expect(text).toContain("atoll");
    expect(text).toContain("50×50 tiles @ 100m");
  });
});
