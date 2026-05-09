/**
 * PROPOSE_POI — agent action tests.
 *
 * Phase B1.2 follow-up. POI categories are a fixed enum (no
 * plugin contribution model) so this is Zod schema validation
 * + happy-path summary only. Locks in the contract that
 * downstream procgen / road-connectivity / studio rendering
 * relies on.
 */

import { describe, expect, it } from "vitest";
import { proposePOIAction } from "../actions/proposePOI.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

const VALID_POI = {
  id: "ancient-shrine",
  name: "Ancient Forest Shrine",
  category: "shrine",
  position: { x: 50, y: 0, z: -30 },
  importance: 0.7,
  radius: 12,
};

describe("PROPOSE_POI action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await proposePOIAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("validates false when service missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(await proposePOIAction.validate(runtime, makeMessage(""))).toBe(
      false,
    );
  });

  it("rejects when `poi` parameter is missing", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposePOIAction.handler(
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
    const r = await proposePOIAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      // missing required category, position, importance, radius
      { poi: { id: "broken-poi", name: "Broken" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues).toBeDefined();
    expect(data?.issues.length).toBeGreaterThan(0);
  });

  it("rejects an invalid category enum value", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposePOIAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { poi: { ...VALID_POI, category: "spaceport" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    const catIssue = data?.issues.find((i) => i.path === "category");
    expect(catIssue).toBeDefined();
  });

  it("accepts a well-formed POI and surfaces summary", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposePOIAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { poi: VALID_POI },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("ancient-shrine");
    expect(r?.values?.category).toBe("shrine");
    const data = r?.data as { poi: typeof VALID_POI } | undefined;
    expect(data?.poi).toMatchObject(VALID_POI);
    expect(calls[0]?.action).toBe("PROPOSE_POI");
    expect(calls[0]?.text).toContain("ancient-shrine");
    expect(calls[0]?.text).toContain("shrine");
    expect(calls[0]?.text).toContain("12m");
    expect(calls[0]?.text).toContain("0.7");
  });

  it("accepts each of the supported categories", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const categories = [
      "dungeon",
      "shrine",
      "landmark",
      "resource_area",
      "ruin",
      "camp",
      "crossing",
      "waystation",
      "fishing_spot",
    ] as const;
    for (const category of categories) {
      const r = await proposePOIAction.handler(
        runtime,
        makeMessage(""),
        undefined,
        { poi: { ...VALID_POI, id: `p_${category}`, category } },
        undefined,
      );
      expect(r?.success).toBe(true);
      expect(r?.values?.category).toBe(category);
    }
  });

  it("surfaces connectedRoads when present", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposePOIAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        poi: {
          ...VALID_POI,
          connectedRoads: ["north-road", "east-road"],
        },
      },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(calls[0]?.text).toContain("north-road");
    expect(calls[0]?.text).toContain("east-road");
  });

  it("preserves passthrough fields on the validated POI", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const poiWithExtras = {
      ...VALID_POI,
      lore: "An ancient shrine to the moon goddess.",
      mood: "peaceful",
    };
    const r = await proposePOIAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { poi: poiWithExtras },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { poi: Record<string, unknown> } | undefined;
    expect(data?.poi.lore).toBe("An ancient shrine to the moon goddess.");
    expect(data?.poi.mood).toBe("peaceful");
  });
});
