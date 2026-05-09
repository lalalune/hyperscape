/**
 * Remaining world-content authoring actions — schema-validation tests.
 *
 * Phase B1.2 follow-up. Three actions left without dedicated
 * coverage: PROPOSE_DANGER_SOURCE, PROPOSE_WILDERNESS_BOUNDARY,
 * PROPOSE_UI_PACK. All three are pure schema-validation actions
 * (no Layer B placement-type or assetRef checks); bundled into
 * one test file because they have no shared structure with the
 * larger groups.
 */

import { describe, expect, it } from "vitest";
import { proposeDangerSourceAction } from "../actions/proposeDangerSource.js";
import { proposeWildernessBoundaryAction } from "../actions/proposeWildernessBoundary.js";
import { proposeUIPackAction } from "../actions/proposeUIPack.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

const VALID_DANGER = {
  id: "cursed-grove",
  name: "Cursed Grove",
  position: { x: 60, y: 0, z: 80 },
  radius: 40,
  intensity: 2,
  falloffCurve: 1.5,
};

const VALID_BOUNDARY = {
  points: [
    { x: -200, z: 0 },
    { x: 200, z: 0 },
  ],
  levelScale: 50,
  maxLevel: 55,
};

const VALID_UI_PACK = {
  version: 1,
  id: "minimal-hud",
  name: "Minimal HUD",
  widgets: [],
  layouts: {
    default: {
      id: "default",
      name: "Default",
      instances: [],
    },
  },
};

describe("PROPOSE_DANGER_SOURCE action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(
      await proposeDangerSourceAction.validate(runtime, makeMessage("")),
    ).toBe(true);
  });

  it("rejects when `dangerSource` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeDangerSourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects malformed payload with Zod issue list", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeDangerSourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { dangerSource: { id: "broken", name: "Broken" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues.length).toBeGreaterThan(0);
  });

  it("rejects intensity outside [0, 3]", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const high = await proposeDangerSourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { dangerSource: { ...VALID_DANGER, intensity: 4 } },
      undefined,
    );
    expect(high?.success).toBe(false);
    const low = await proposeDangerSourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { dangerSource: { ...VALID_DANGER, intensity: -0.1 } },
      undefined,
    );
    expect(low?.success).toBe(false);
  });

  it("rejects non-positive radius", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const r = await proposeDangerSourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { dangerSource: { ...VALID_DANGER, radius: 0 } },
      undefined,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects non-positive falloffCurve", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const r = await proposeDangerSourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { dangerSource: { ...VALID_DANGER, falloffCurve: 0 } },
      undefined,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts a well-formed danger source", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeDangerSourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { dangerSource: VALID_DANGER },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { dangerSource: typeof VALID_DANGER } | undefined;
    expect(data?.dangerSource).toMatchObject(VALID_DANGER);
    expect(calls[0]?.action).toBe("PROPOSE_DANGER_SOURCE");
    expect(calls[0]?.text).toContain("cursed-grove");
    expect(calls[0]?.text).toContain("intensity:    2");
  });

  it("surfaces description in the chat summary when present", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeDangerSourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        dangerSource: {
          ...VALID_DANGER,
          description: "A blight has taken root.",
        },
      },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(calls[0]?.text).toContain("A blight has taken root");
  });
});

describe("PROPOSE_WILDERNESS_BOUNDARY action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(
      await proposeWildernessBoundaryAction.validate(runtime, makeMessage("")),
    ).toBe(true);
  });

  it("rejects when `wildernessBoundary` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeWildernessBoundaryAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects fewer than 2 points", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const r = await proposeWildernessBoundaryAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        wildernessBoundary: { ...VALID_BOUNDARY, points: [{ x: 0, z: 0 }] },
      },
      undefined,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects non-positive levelScale", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const r = await proposeWildernessBoundaryAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { wildernessBoundary: { ...VALID_BOUNDARY, levelScale: 0 } },
      undefined,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects non-positive maxLevel", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const r = await proposeWildernessBoundaryAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { wildernessBoundary: { ...VALID_BOUNDARY, maxLevel: 0 } },
      undefined,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts a well-formed boundary, defaulting id to 'wilderness'", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeWildernessBoundaryAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { wildernessBoundary: VALID_BOUNDARY },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("wilderness"); // default id
    expect(r?.values?.maxLevel).toBe(55);
    expect(calls[0]?.action).toBe("PROPOSE_WILDERNESS_BOUNDARY");
    expect(calls[0]?.text).toContain("levelScale: 50m");
  });

  it("preserves a custom id when provided", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const r = await proposeWildernessBoundaryAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { wildernessBoundary: { ...VALID_BOUNDARY, id: "north-pvp-zone" } },
      undefined,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("north-pvp-zone");
  });
});

describe("PROPOSE_UI_PACK action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await proposeUIPackAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("rejects when `pack` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeUIPackAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects malformed UIPack with Zod issue list", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeUIPackAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { pack: { id: "broken" } }, // missing version, name, layouts
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues.length).toBeGreaterThan(0);
  });

  it("rejects layouts without a 'default' entry", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const r = await proposeUIPackAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        pack: {
          ...VALID_UI_PACK,
          layouts: {
            mobile: { id: "mobile", name: "Mobile", instances: [] },
          },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects an invalid version literal", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const r = await proposeUIPackAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { pack: { ...VALID_UI_PACK, version: 2 } },
      undefined,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts a minimal well-formed UIPack", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeUIPackAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { pack: VALID_UI_PACK },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("minimal-hud");
    expect(r?.values?.widgetCount).toBe(0);
    expect(calls[0]?.action).toBe("PROPOSE_UI_PACK");
    expect(calls[0]?.text).toContain("minimal-hud");
    expect(calls[0]?.text).toContain("Minimal HUD");
  });

  it("surfaces author + layout names in summary when present", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeUIPackAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        pack: {
          ...VALID_UI_PACK,
          author: "test-plugin",
          layouts: {
            default: { id: "d", name: "Default", instances: [] },
            mobile: { id: "m", name: "Mobile", instances: [] },
          },
        },
      },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(calls[0]?.text).toContain("test-plugin");
    expect(calls[0]?.text).toContain("default");
    expect(calls[0]?.text).toContain("mobile");
  });
});
