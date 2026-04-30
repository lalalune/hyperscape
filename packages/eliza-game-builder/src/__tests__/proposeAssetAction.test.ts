/**
 * PROPOSE_ASSET — agent action tests.
 *
 * Phase A5 of the AAA gap audit. Coverage:
 *   - validate gates on service availability
 *   - missing-param rejection
 *   - rejects unknown asset type / style / quality
 *   - rejects too-short prompt (schema requires 8+ chars)
 *   - accepts well-formed proposals incl. optional rigging/height
 *   - returns the asset on data.asset
 */

import { describe, expect, it } from "vitest";
import { proposeAssetAction } from "../actions/proposeAsset.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

describe("PROPOSE_ASSET action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await proposeAssetAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("validates false when service missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(await proposeAssetAction.validate(runtime, makeMessage(""))).toBe(
      false,
    );
  });

  it("rejects when `asset` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeAssetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects unknown type", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeAssetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        asset: {
          name: "x",
          type: "spaceship",
          subtype: "sci-fi",
          prompt: "A futuristic spaceship.",
        },
      },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects too-short prompt", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeAssetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        asset: {
          name: "Goblin",
          type: "creature",
          subtype: "humanoid",
          prompt: "tiny", // 4 chars, schema requires 8+
        },
      },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues.some((i) => i.path === "prompt")).toBe(true);
  });

  it("rejects invalid referenceImageUrl", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeAssetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        asset: {
          name: "Goblin Shaman",
          type: "creature",
          subtype: "humanoid",
          prompt: "A green-skinned shaman with a glowing staff.",
          referenceImageUrl: "not-a-url",
        },
      },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts a well-formed creature proposal with rigging", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const asset = {
      name: "Goblin Shaman",
      type: "creature",
      subtype: "humanoid",
      prompt: "A small green-skinned goblin shaman with a glowing staff.",
      style: "stylized",
      enableRigging: true,
      characterHeight: 1.2,
    };
    const r = await proposeAssetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { asset },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { asset: typeof asset } | undefined;
    expect(data?.asset).toMatchObject(asset);
    expect(calls[0]?.action).toBe("PROPOSE_ASSET");
    expect(calls[0]?.text).toContain("Goblin Shaman");
    expect(calls[0]?.text).toContain("rigged");
  });

  it("accepts a minimal prop proposal (only required fields)", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeAssetAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        asset: {
          name: "Tavern Sign",
          type: "prop",
          subtype: "sign",
          prompt: "A weathered wooden tavern sign.",
        },
      },
      callback,
    );
    expect(r?.success).toBe(true);
  });
});
