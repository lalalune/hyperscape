/**
 * REMOVE_FROM_PROJECT — agent action tests.
 *
 * Phase A4 of the AAA gap audit. Coverage:
 *   - validate gates on service availability
 *   - missing-param rejection
 *   - rejects unknown kind
 *   - rejects missing required field per kind
 *   - accepts each kind variant
 *   - returns the validated removal on data.removal
 */

import { describe, expect, it } from "vitest";
import { removeFromProjectAction } from "../actions/removeFromProject.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

describe("REMOVE_FROM_PROJECT action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(
      await removeFromProjectAction.validate(runtime, makeMessage("")),
    ).toBe(true);
  });

  it("rejects when `removal` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await removeFromProjectAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects unknown kind", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await removeFromProjectAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { removal: { kind: "vehicle", id: "x" } },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects npc removal without id", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await removeFromProjectAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { removal: { kind: "npc" } },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects mobSpawn removal without position", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await removeFromProjectAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { removal: { kind: "mobSpawn", mobId: "goblin" } },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts npc removal by id", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await removeFromProjectAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { removal: { kind: "npc", id: "eldric_shopkeeper" } },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as
      | { removal: { kind: string; id: string } }
      | undefined;
    expect(data?.removal.kind).toBe("npc");
    expect(data?.removal.id).toBe("eldric_shopkeeper");
    expect(calls[0]?.action).toBe("REMOVE_FROM_PROJECT");
  });

  it("accepts quest removal by id", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await removeFromProjectAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { removal: { kind: "quest", id: "tutorial-cook" } },
      callback,
    );
    expect(r?.success).toBe(true);
  });

  it("accepts mobSpawn removal by composite key", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await removeFromProjectAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        removal: {
          kind: "mobSpawn",
          mobId: "goblin",
          position: { x: 12, y: 0, z: 8 },
        },
      },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as
      | {
          removal: {
            kind: string;
            mobId: string;
            position: { x: number; y: number; z: number };
          };
        }
      | undefined;
    expect(data?.removal.kind).toBe("mobSpawn");
    expect(data?.removal.position).toEqual({ x: 12, y: 0, z: 8 });
    expect(calls[0]?.text).toContain("(12, 0, 8)");
  });

  it("accepts asset removal by id", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await removeFromProjectAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { removal: { kind: "asset", id: "goblin-shaman-abc123" } },
      callback,
    );
    expect(r?.success).toBe(true);
  });

  it("accepts zone removal by id", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await removeFromProjectAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { removal: { kind: "zone", id: "wilderness" } },
      callback,
    );
    expect(r?.success).toBe(true);
  });
});
