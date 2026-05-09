/**
 * PROPOSE_TELEPORT — agent action tests.
 *
 * Phase B1.2 follow-up. proposeTeleport was missing dedicated test
 * coverage. The action's `type` field is a fixed enum
 * ("lodestone" | "portal" | "shortcut") — Hyperia core handles
 * all three so there's no plugin-contribution check, just Zod
 * enum validation. These tests lock the schema-validation
 * contract in.
 */

import { describe, expect, it } from "vitest";
import { proposeTeleportAction } from "../actions/proposeTeleport.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

const VALID_TELEPORT = {
  id: "town_lodestone",
  name: "Town Lodestone",
  type: "lodestone",
  position: { x: 0, y: 0, z: 0 },
};

describe("PROPOSE_TELEPORT action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await proposeTeleportAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("validates false when service missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(await proposeTeleportAction.validate(runtime, makeMessage(""))).toBe(
      false,
    );
  });

  it("rejects when `teleport` parameter is missing", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeTeleportAction.handler(
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
    const r = await proposeTeleportAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { teleport: { id: "broken" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues).toBeDefined();
    expect(data?.issues.length).toBeGreaterThan(0);
  });

  it("rejects an invalid `type` value (not in enum)", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeTeleportAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { teleport: { ...VALID_TELEPORT, type: "wormhole" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    const typeIssue = data?.issues.find((i) => i.path === "type");
    expect(typeIssue).toBeDefined();
  });

  it("accepts a well-formed lodestone", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeTeleportAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { teleport: VALID_TELEPORT },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("town_lodestone");
    expect(r?.values?.type).toBe("lodestone");
    const data = r?.data as { teleport: typeof VALID_TELEPORT } | undefined;
    expect(data?.teleport).toMatchObject(VALID_TELEPORT);
    expect(calls[0]?.action).toBe("PROPOSE_TELEPORT");
  });

  it("accepts each of the three valid type values", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    for (const type of ["lodestone", "portal", "shortcut"] as const) {
      const r = await proposeTeleportAction.handler(
        runtime,
        makeMessage(""),
        undefined,
        { teleport: { ...VALID_TELEPORT, id: `t_${type}`, type } },
        undefined,
      );
      expect(r?.success).toBe(true);
      expect(r?.values?.type).toBe(type);
    }
  });

  it("preserves passthrough fields on the validated teleport", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const teleportWithExtras = {
      ...VALID_TELEPORT,
      cost: 50,
      requirements: { level: 10 },
      rotation: 1.5,
    };
    const r = await proposeTeleportAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { teleport: teleportWithExtras },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { teleport: Record<string, unknown> } | undefined;
    expect(data?.teleport.cost).toBe(50);
    expect(data?.teleport.rotation).toBe(1.5);
  });
});
