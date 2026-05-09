/**
 * PROPOSE_ROAD — agent action tests.
 *
 * Phase B1.2 follow-up. Roads are polylines (not single-point
 * placements) and have NO Layer B plugin-type validation —
 * Zod schema only. These tests lock the schema-validation
 * + happy-path summary contract in.
 */

import { describe, expect, it } from "vitest";
import { proposeRoadAction } from "../actions/proposeRoad.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

const VALID_ROAD = {
  id: "north-trade-road",
  name: "Northern Trade Road",
  path: [
    { x: 0, y: 0, z: 0 },
    { x: 50, y: 0, z: 30 },
    { x: 120, y: 0, z: 80 },
  ],
  width: 8,
};

describe("PROPOSE_ROAD action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await proposeRoadAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("validates false when service missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(await proposeRoadAction.validate(runtime, makeMessage(""))).toBe(
      false,
    );
  });

  it("rejects when `road` parameter is missing", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeRoadAction.handler(
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
    const r = await proposeRoadAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      // missing required path + width
      { road: { id: "broken-road", name: "Broken" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues).toBeDefined();
    expect(data?.issues.length).toBeGreaterThan(0);
  });

  it("rejects a path with fewer than 2 waypoints", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeRoadAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { road: { ...VALID_ROAD, path: [{ x: 0, y: 0, z: 0 }] } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues).toBeDefined();
    const pathIssue = data?.issues.find((i) => i.path.startsWith("path"));
    expect(pathIssue).toBeDefined();
  });

  it("rejects non-positive width", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeRoadAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { road: { ...VALID_ROAD, width: 0 } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    const widthIssue = data?.issues.find((i) => i.path === "width");
    expect(widthIssue).toBeDefined();
  });

  it("accepts a well-formed road and surfaces start/end summary", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeRoadAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { road: VALID_ROAD },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("north-trade-road");
    expect(r?.values?.waypoints).toBe(3);
    const data = r?.data as { road: typeof VALID_ROAD } | undefined;
    expect(data?.road).toMatchObject(VALID_ROAD);
    expect(calls[0]?.action).toBe("PROPOSE_ROAD");
    // The chat-facing summary surfaces start, end, width, waypoint count.
    expect(calls[0]?.text).toContain("8m");
    expect(calls[0]?.text).toContain("waypoints: 3");
    expect(calls[0]?.text).toContain("start:");
    expect(calls[0]?.text).toContain("end:");
  });

  it("preserves passthrough fields on the validated road", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const roadWithExtras = {
      ...VALID_ROAD,
      style: "cobblestone",
      lighting: "lanterns",
    };
    const r = await proposeRoadAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { road: roadWithExtras },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { road: Record<string, unknown> } | undefined;
    expect(data?.road.style).toBe("cobblestone");
    expect(data?.road.lighting).toBe("lanterns");
  });
});
