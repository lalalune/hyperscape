/**
 * PROPOSE_MINE — agent action tests.
 *
 * Phase B1.2 follow-up. Mines are concentrated gathering areas
 * with clustered ore rocks; the studio's autoGen pipeline
 * already produces them, so the agent's authoring path needs
 * the same schema-validation contract locked in.
 */

import { describe, expect, it } from "vitest";
import { proposeMineAction } from "../actions/proposeMine.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

const VALID_MINE = {
  id: "canyon-iron-mine",
  name: "Iron Outcrop",
  position: { x: 240, y: 0, z: -120 },
  radius: 20,
  biome: "canyon",
  oreRocks: [
    { resourceId: "iron_rock", count: 12 },
    { resourceId: "coal_rock", count: 6 },
  ],
};

describe("PROPOSE_MINE action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await proposeMineAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("validates false when service missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(await proposeMineAction.validate(runtime, makeMessage(""))).toBe(
      false,
    );
  });

  it("rejects when `mine` parameter is missing", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeMineAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
    expect(r?.error).toBeInstanceOf(Error);
    expect(calls[0]?.error).toBe(true);
  });

  it("rejects malformed payload with Zod issue list", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeMineAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      // missing required position, radius, biome, oreRocks
      { mine: { id: "broken-mine", name: "Broken" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues).toBeDefined();
    expect(data?.issues.length).toBeGreaterThan(0);
  });

  it("rejects non-positive radius", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeMineAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { mine: { ...VALID_MINE, radius: 0 } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    const radiusIssue = data?.issues.find((i) => i.path === "radius");
    expect(radiusIssue).toBeDefined();
  });

  it("rejects negative tierIndex", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeMineAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { mine: { ...VALID_MINE, tierIndex: -1 } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    const tierIssue = data?.issues.find((i) => i.path === "tierIndex");
    expect(tierIssue).toBeDefined();
  });

  it("accepts a well-formed mine and surfaces summary with ore total", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeMineAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { mine: VALID_MINE },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("canyon-iron-mine");
    expect(r?.values?.oreCount).toBe(2);
    const data = r?.data as { mine: typeof VALID_MINE } | undefined;
    expect(data?.mine).toMatchObject(VALID_MINE);
    expect(calls[0]?.action).toBe("PROPOSE_MINE");
    expect(calls[0]?.text).toContain("canyon-iron-mine");
    expect(calls[0]?.text).toContain("20m");
    expect(calls[0]?.text).toContain("canyon");
    // Ore total = 12 + 6 = 18.
    expect(calls[0]?.text).toContain("18 rock");
  });

  it("defaults tierIndex to 0 when omitted", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeMineAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { mine: VALID_MINE }, // no tierIndex
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { mine: { tierIndex: number } } | undefined;
    expect(data?.mine.tierIndex).toBe(0);
  });

  it("preserves passthrough fields on the validated mine", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const mineWithExtras = {
      ...VALID_MINE,
      lore: "Once a thriving dwarven outpost.",
      eliteBoss: "iron_giant",
    };
    const r = await proposeMineAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { mine: mineWithExtras },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { mine: Record<string, unknown> } | undefined;
    expect(data?.mine.lore).toBe("Once a thriving dwarven outpost.");
    expect(data?.mine.eliteBoss).toBe("iron_giant");
  });
});
