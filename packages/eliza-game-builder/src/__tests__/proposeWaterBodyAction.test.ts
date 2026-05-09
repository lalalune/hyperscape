/**
 * PROPOSE_WATER_BODY — agent action tests.
 *
 * Phase B1.2 follow-up. Water bodies have a discriminated-union
 * shape (river → waypoints, lake / pond → polygon) enforced via
 * a Zod refinement, so the schema-validation contract is
 * worth locking in beyond the basic missing-field path.
 */

import { describe, expect, it } from "vitest";
import { proposeWaterBodyAction } from "../actions/proposeWaterBody.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

const VALID_RIVER = {
  id: "misty-river",
  name: "Misty River",
  bodyType: "river",
  waypoints: [
    { x: -200, z: 50, halfWidth: 4, depth: 2 },
    { x: 0, z: 30, halfWidth: 5, depth: 2.5 },
    { x: 100, z: 30, halfWidth: 6, depth: 3 },
  ],
  surfaceY: 0,
};

const VALID_LAKE = {
  id: "deep-lake",
  name: "Deep Lake",
  bodyType: "lake",
  polygon: [
    { x: 100, z: 100 },
    { x: 200, z: 100 },
    { x: 200, z: 200 },
    { x: 100, z: 200 },
  ],
  surfaceY: 5,
};

describe("PROPOSE_WATER_BODY action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(
      await proposeWaterBodyAction.validate(runtime, makeMessage("")),
    ).toBe(true);
  });

  it("validates false when service missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(
      await proposeWaterBodyAction.validate(runtime, makeMessage("")),
    ).toBe(false);
  });

  it("rejects when `waterBody` parameter is missing", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeWaterBodyAction.handler(
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
    const r = await proposeWaterBodyAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { waterBody: { id: "broken", name: "Broken" } }, // missing bodyType
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues).toBeDefined();
    expect(data?.issues.length).toBeGreaterThan(0);
  });

  it("rejects an invalid bodyType enum value", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeWaterBodyAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { waterBody: { ...VALID_RIVER, bodyType: "ocean" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    const typeIssue = data?.issues.find((i) => i.path === "bodyType");
    expect(typeIssue).toBeDefined();
  });

  it("rejects a river with fewer than 2 waypoints", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeWaterBodyAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        waterBody: {
          ...VALID_RIVER,
          waypoints: [{ x: 0, z: 0, halfWidth: 4, depth: 2 }],
        },
      },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects a lake with no polygon", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeWaterBodyAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      // bodyType=lake but no polygon — refinement should fire
      { waterBody: { id: "no-shape", name: "Empty", bodyType: "lake" } },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts a well-formed river with waypoints", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeWaterBodyAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { waterBody: VALID_RIVER },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("misty-river");
    expect(r?.values?.bodyType).toBe("river");
    const data = r?.data as { waterBody: typeof VALID_RIVER } | undefined;
    expect(data?.waterBody).toMatchObject(VALID_RIVER);
    expect(calls[0]?.action).toBe("PROPOSE_WATER_BODY");
    expect(calls[0]?.text).toContain("waypoints: 3");
  });

  it("accepts a well-formed lake with polygon", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeWaterBodyAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { waterBody: VALID_LAKE },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.bodyType).toBe("lake");
    const data = r?.data as { waterBody: typeof VALID_LAKE } | undefined;
    expect(data?.waterBody).toMatchObject(VALID_LAKE);
    expect(calls[0]?.text).toContain("polygon points: 4");
  });

  it("preserves passthrough fields on the validated water body", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const riverWithExtras = {
      ...VALID_RIVER,
      currentSpeed: 1.2,
      sediment: "muddy",
    };
    const r = await proposeWaterBodyAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { waterBody: riverWithExtras },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { waterBody: Record<string, unknown> } | undefined;
    expect(data?.waterBody.currentSpeed).toBe(1.2);
    expect(data?.waterBody.sediment).toBe("muddy");
  });
});
