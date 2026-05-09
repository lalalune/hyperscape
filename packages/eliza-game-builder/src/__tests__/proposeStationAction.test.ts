/**
 * PROPOSE_STATION — agent action tests.
 *
 * Phase B1.2 follow-up. proposeStation was missing dedicated test
 * coverage; the prompt advertises it as a first-class action so
 * locking in its schema-validation + happy-path contract here
 * prevents drift. Mirrors the worldContentActions.test.ts
 * pattern (schema validation only — Layer B placement-type and
 * assetRef checks are tested separately in placementValidation.test.ts).
 */

import { describe, expect, it } from "vitest";
import { proposeStationAction } from "../actions/proposeStation.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

const VALID_STATION = {
  id: "village_anvil",
  type: "anvil",
  position: { x: 12, y: 0, z: -8 },
};

describe("PROPOSE_STATION action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await proposeStationAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("validates false when service missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(await proposeStationAction.validate(runtime, makeMessage(""))).toBe(
      false,
    );
  });

  it("rejects when `station` parameter is missing", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeStationAction.handler(
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
    const r = await proposeStationAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      // missing required position + type
      { station: { id: "broken-station" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues).toBeDefined();
    expect(data?.issues.length).toBeGreaterThan(0);
    const paths = data?.issues.map((i) => i.path) ?? [];
    expect(paths).toContain("type");
    expect(paths).toContain("position");
  });

  it("accepts a well-formed station and returns it on data.station", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeStationAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { station: VALID_STATION },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("village_anvil");
    expect(r?.values?.type).toBe("anvil");
    const data = r?.data as { station: typeof VALID_STATION } | undefined;
    expect(data?.station).toMatchObject(VALID_STATION);
    expect(calls[0]?.action).toBe("PROPOSE_STATION");
    expect(calls[0]?.text).toContain("village_anvil");
    expect(calls[0]?.text).toContain("anvil");
  });

  it("preserves passthrough fields on the validated station", async () => {
    const { runtime, callback } = makeStubRuntime({
      service: makeService(),
    });
    const stationWithExtras = {
      ...VALID_STATION,
      rotation: 1.57,
      scale: 0.9,
    };
    const r = await proposeStationAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { station: stationWithExtras },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { station: Record<string, unknown> } | undefined;
    expect(data?.station.rotation).toBe(1.57);
    expect(data?.station.scale).toBe(0.9);
  });

  it("returns service-unavailable error when no service is registered", async () => {
    const { runtime, callback } = makeStubRuntime();
    const r = await proposeStationAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { station: VALID_STATION },
      callback,
    );
    expect(r?.success).toBe(false);
    expect(r?.error).toBeInstanceOf(Error);
  });
});
