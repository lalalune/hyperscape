/**
 * Audio-zone authoring actions — schema-validation tests.
 *
 * Phase B1.2 follow-up. Three audio actions (AmbientZone,
 * MusicZone, SfxTrigger) share the same shape: agent submits
 * JSON, action validates against Zod schema, returns success
 * + summary or Zod issue list. Bundled into one test file
 * because they have no Layer B placement-type or assetRef
 * checks — pure schema validation.
 */

import { describe, expect, it } from "vitest";
import { proposeAmbientZoneAction } from "../actions/proposeAmbientZone.js";
import { proposeMusicZoneAction } from "../actions/proposeMusicZone.js";
import { proposeSfxTriggerAction } from "../actions/proposeSfxTrigger.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

const VALID_AMBIENT = {
  id: "forest-ambient",
  name: "Forest Ambient",
  ambientType: "forest",
  tracks: ["sounds/wind.ogg", "sounds/birds.ogg"],
  polygon: [
    { x: 0, z: 0 },
    { x: 100, z: 0 },
    { x: 100, z: 100 },
    { x: 0, z: 100 },
  ],
};

const VALID_MUSIC = {
  id: "village-theme",
  name: "Village Theme",
  trackId: "town_lute",
  polygon: [
    { x: 0, z: 0 },
    { x: 50, z: 0 },
    { x: 50, z: 50 },
    { x: 0, z: 50 },
  ],
};

const VALID_SFX = {
  id: "tavern-sign",
  name: "Tavern Creak",
  soundPath: "sounds/wood-creak.ogg",
  position: { x: 12, y: 0, z: -8 },
  radius: 6,
};

describe("PROPOSE_AMBIENT_ZONE action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(
      await proposeAmbientZoneAction.validate(runtime, makeMessage("")),
    ).toBe(true);
  });

  it("rejects when `ambientZone` parameter is missing", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeAmbientZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
    expect(calls[0]?.error).toBe(true);
  });

  it("rejects an invalid ambientType enum value", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeAmbientZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { ambientZone: { ...VALID_AMBIENT, ambientType: "spaceport" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    const typeIssue = data?.issues.find((i) => i.path === "ambientType");
    expect(typeIssue).toBeDefined();
  });

  it("rejects empty tracks array", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeAmbientZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { ambientZone: { ...VALID_AMBIENT, tracks: [] } },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects polygon with fewer than 3 points", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeAmbientZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        ambientZone: {
          ...VALID_AMBIENT,
          polygon: [
            { x: 0, z: 0 },
            { x: 1, z: 1 },
          ],
        },
      },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects volume outside [0, 1]", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeAmbientZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { ambientZone: { ...VALID_AMBIENT, volume: 1.5 } },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts a well-formed ambient zone with default volume", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeAmbientZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { ambientZone: VALID_AMBIENT },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("forest-ambient");
    expect(r?.values?.ambientType).toBe("forest");
    const data = r?.data as
      | { ambientZone: { volume: number; tracks: string[] } }
      | undefined;
    expect(data?.ambientZone.volume).toBe(0.5); // default
    expect(data?.ambientZone.tracks).toHaveLength(2);
    expect(calls[0]?.action).toBe("PROPOSE_AMBIENT_ZONE");
    expect(calls[0]?.text).toContain("forest-ambient");
    expect(calls[0]?.text).toContain("tracks:         2");
  });

  it("accepts every supported ambientType enum value", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const types = [
      "forest",
      "cave",
      "ocean",
      "town",
      "desert",
      "mountain",
      "swamp",
      "custom",
    ] as const;
    for (const ambientType of types) {
      const r = await proposeAmbientZoneAction.handler(
        runtime,
        makeMessage(""),
        undefined,
        {
          ambientZone: {
            ...VALID_AMBIENT,
            id: `a_${ambientType}`,
            ambientType,
          },
        },
        undefined,
      );
      expect(r?.success).toBe(true);
      expect(r?.values?.ambientType).toBe(ambientType);
    }
  });
});

describe("PROPOSE_MUSIC_ZONE action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(
      await proposeMusicZoneAction.validate(runtime, makeMessage("")),
    ).toBe(true);
  });

  it("rejects when `musicZone` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeMusicZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects malformed payload", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeMusicZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { musicZone: { id: "broken", name: "Broken" } }, // missing trackId, polygon
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts a well-formed music zone, defaults priority+blendDistance", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeMusicZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { musicZone: VALID_MUSIC },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.trackId).toBe("town_lute");
    const data = r?.data as
      | { musicZone: { priority: number; blendDistance: number } }
      | undefined;
    expect(data?.musicZone.priority).toBe(0); // default
    expect(data?.musicZone.blendDistance).toBe(8); // default
    expect(calls[0]?.action).toBe("PROPOSE_MUSIC_ZONE");
    expect(calls[0]?.text).toContain("town_lute");
  });

  it("surfaces combatTrackId when present", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeMusicZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        musicZone: { ...VALID_MUSIC, combatTrackId: "village_combat" },
      },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(calls[0]?.text).toContain("village_combat");
  });
});

describe("PROPOSE_SFX_TRIGGER action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(
      await proposeSfxTriggerAction.validate(runtime, makeMessage("")),
    ).toBe(true);
  });

  it("rejects when `sfxTrigger` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeSfxTriggerAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects non-positive radius", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeSfxTriggerAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { sfxTrigger: { ...VALID_SFX, radius: 0 } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    const radiusIssue = data?.issues.find((i) => i.path === "radius");
    expect(radiusIssue).toBeDefined();
  });

  it("rejects volume outside [0, 1]", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeSfxTriggerAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { sfxTrigger: { ...VALID_SFX, volume: 2 } },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts a well-formed sfx trigger with default looping/volume", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeSfxTriggerAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { sfxTrigger: VALID_SFX },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("tavern-sign");
    expect(r?.values?.soundPath).toBe("sounds/wood-creak.ogg");
    const data = r?.data as
      | { sfxTrigger: { volume: number; looping: boolean } }
      | undefined;
    expect(data?.sfxTrigger.volume).toBe(0.7); // default
    expect(data?.sfxTrigger.looping).toBe(true); // default
    expect(calls[0]?.action).toBe("PROPOSE_SFX_TRIGGER");
    expect(calls[0]?.text).toContain("tavern-sign");
    expect(calls[0]?.text).toContain("looping:   true");
  });

  it("accepts looping=false for one-shot triggers", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    const r = await proposeSfxTriggerAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { sfxTrigger: { ...VALID_SFX, looping: false } },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { sfxTrigger: { looping: boolean } } | undefined;
    expect(data?.sfxTrigger.looping).toBe(false);
  });
});
