/**
 * World-content authoring actions — schema-validation tests.
 *
 * Phase B1.2 of `PLAN_AAA_QUALITY.md`. Each action validates an
 * agent-supplied JSON payload against the canonical schema in
 * `@hyperforge/manifest-schema`. The tests cover three paths:
 *
 *   1. validate() returns true when the service is registered
 *   2. handler returns success: false with a Zod issue list when
 *      the payload is malformed (missing required field)
 *   3. handler returns success: true with the validated entity on
 *      `data.entity` when the payload is well-formed
 *
 * Tests use the same `makeStubRuntime` helper the existing
 * actions.test.ts uses — no real ElizaOS runtime, just the thin
 * shim that exposes `getService`.
 */

import { describe, expect, it } from "vitest";
import { proposeMobSpawnAction } from "../actions/proposeMobSpawn.js";
import { proposeNpcPlacementAction } from "../actions/proposeNpcPlacement.js";
import { proposeQuestAction } from "../actions/proposeQuest.js";
import { proposeResourceAction } from "../actions/proposeResource.js";
import { proposeZoneAction } from "../actions/proposeZone.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

const VALID_ZONE = {
  id: "north_wilderness",
  name: "Northern Wilderness",
  description: "A dense forest with wandering wolves and goblins.",
  difficultyLevel: 1,
  bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
  biomeType: "forest",
  safeZone: false,
};

const VALID_QUEST = {
  id: "tutorial-cook",
  name: "Burnt Offerings",
  description: "Cook 5 fish for the chef.",
  difficulty: "novice",
  questPoints: 1,
  replayable: false,
  startNpc: "chef_eldred",
  requirements: { quests: [], skills: {}, items: [] },
  stages: [
    {
      type: "dialogue",
      id: "meet-eldred",
      description: "Talk to Eldred",
      npcId: "chef_eldred",
    },
    {
      type: "gather",
      id: "cook-fish",
      description: "Cook 5 fish",
      target: "cooked_fish",
      count: 5,
    },
  ],
  onStart: {},
  rewards: { questPoints: 1, items: [], xp: { cooking: 100 } },
};

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

describe("PROPOSE_NPC_PLACEMENT action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(
      await proposeNpcPlacementAction.validate(runtime, makeMessage("")),
    ).toBe(true);
  });

  it("validates false when service missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(
      await proposeNpcPlacementAction.validate(runtime, makeMessage("")),
    ).toBe(false);
  });

  it("rejects when `entity` parameter is missing", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeNpcPlacementAction.handler(
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
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      // missing required `position` and `type`
      { entity: { id: "broken-npc" } },
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

  it("accepts a well-formed NPC and returns it on data.entity", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const entity = {
      id: "eldric_shopkeeper",
      type: "shopkeeper",
      name: "Eldric",
      position: { x: 12, y: 0, z: -8 },
    };
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { entity },
      callback,
    );
    expect(r?.success).toBe(true);
    expect(r?.values?.id).toBe("eldric_shopkeeper");
    expect(r?.values?.type).toBe("shopkeeper");
    const data = r?.data as { entity: typeof entity } | undefined;
    expect(data?.entity).toMatchObject(entity);
    expect(calls[0]?.action).toBe("PROPOSE_NPC_PLACEMENT");
    expect(calls[0]?.text).toContain("eldric_shopkeeper");
    expect(calls[0]?.text).toContain("shopkeeper");
  });

  it("preserves passthrough fields on the validated entity", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const entity = {
      id: "guard_01",
      type: "guard",
      position: { x: 0, y: 0, z: 0 },
      // schema is .passthrough() so engine-specific extras must survive
      rotationY: 1.5,
      scale: 1.2,
    };
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { entity },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as
      | { entity: { rotationY?: number; scale?: number } }
      | undefined;
    expect(data?.entity.rotationY).toBe(1.5);
    expect(data?.entity.scale).toBe(1.2);
  });
});

describe("PROPOSE_MOB_SPAWN action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await proposeMobSpawnAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("validates false when service missing", async () => {
    const { runtime } = makeStubRuntime();
    expect(await proposeMobSpawnAction.validate(runtime, makeMessage(""))).toBe(
      false,
    );
  });

  it("rejects when `spawn` parameter is missing", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeMobSpawnAction.handler(
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
    const r = await proposeMobSpawnAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      // missing required maxCount + spawnRadius + position
      { spawn: { mobId: "goblin" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues).toBeDefined();
    expect(data?.issues.length).toBeGreaterThan(0);
    const paths = data?.issues.map((i) => i.path) ?? [];
    expect(paths).toContain("position");
    expect(paths).toContain("maxCount");
    expect(paths).toContain("spawnRadius");
  });

  it("rejects negative spawnRadius", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeMobSpawnAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        spawn: {
          mobId: "goblin",
          position: { x: 0, y: 0, z: 0 },
          maxCount: 3,
          spawnRadius: -1,
        },
      },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts a well-formed mob spawn and surfaces it on data.spawn", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const spawn = {
      mobId: "goblin",
      position: { x: 12, y: 0, z: 8 },
      maxCount: 3,
      spawnRadius: 5,
    };
    const r = await proposeMobSpawnAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { spawn },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { spawn: typeof spawn } | undefined;
    expect(data?.spawn).toMatchObject(spawn);
    expect(calls[0]?.action).toBe("PROPOSE_MOB_SPAWN");
    expect(calls[0]?.text).toContain("goblin");
  });

  it("accepts a point spawn (spawnRadius=0)", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeMobSpawnAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        spawn: {
          mobId: "skeleton",
          position: { x: -3, y: 1, z: 7 },
          maxCount: 1,
          spawnRadius: 0,
        },
      },
      callback,
    );
    expect(r?.success).toBe(true);
  });
});

describe("PROPOSE_QUEST action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await proposeQuestAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("rejects when `quest` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeQuestAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects empty stages array", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeQuestAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { quest: { ...VALID_QUEST, stages: [] } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues).toBeDefined();
    expect(data?.issues.some((i) => i.path.startsWith("stages"))).toBe(true);
  });

  it("rejects unknown stage type", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeQuestAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        quest: {
          ...VALID_QUEST,
          stages: [
            {
              type: "fish",
              id: "x",
              description: "y",
              target: "z",
              count: 1,
            },
          ],
        },
      },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts a well-formed quest with mixed stage types", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeQuestAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { quest: VALID_QUEST },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { quest: typeof VALID_QUEST } | undefined;
    expect(data?.quest.id).toBe("tutorial-cook");
    expect(data?.quest.stages.length).toBe(2);
    expect(calls[0]?.action).toBe("PROPOSE_QUEST");
    expect(calls[0]?.text).toContain("dialogue");
    expect(calls[0]?.text).toContain("gather");
  });

  it("accepts a kill-only quest", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeQuestAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        quest: {
          ...VALID_QUEST,
          id: "rats-in-the-cellar",
          name: "Rats in the Cellar",
          stages: [
            {
              type: "kill",
              id: "kill-rats",
              description: "Slay 10 rats",
              target: "rat",
              count: 10,
            },
          ],
        },
      },
      callback,
    );
    expect(r?.success).toBe(true);
  });
});

describe("PROPOSE_ZONE action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await proposeZoneAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("rejects when `zone` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects malformed bounds", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { zone: { ...VALID_ZONE, bounds: { minX: 0, maxX: 100 } } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues.some((i) => i.path.startsWith("bounds"))).toBe(true);
  });

  it("rejects negative difficulty", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { zone: { ...VALID_ZONE, difficultyLevel: -1 } },
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("accepts a well-formed zone and returns it on data.zone", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await proposeZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { zone: VALID_ZONE },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { zone: typeof VALID_ZONE } | undefined;
    expect(data?.zone.id).toBe("north_wilderness");
    expect(calls[0]?.action).toBe("PROPOSE_ZONE");
    expect(calls[0]?.text).toContain("Northern Wilderness");
  });

  it("accepts a PvP zone with inline mob spawns", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeZoneAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        zone: {
          ...VALID_ZONE,
          id: "duel_arena",
          name: "Duel Arena",
          description: "Open-PvP combat arena.",
          safeZone: false,
          pvpEnabled: true,
          mobSpawns: [
            {
              mobId: "training_dummy",
              position: { x: 50, y: 0, z: 50 },
              maxCount: 1,
              spawnRadius: 0,
            },
          ],
        },
      },
      callback,
    );
    expect(r?.success).toBe(true);
  });
});

describe("PROPOSE_RESOURCE action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await proposeResourceAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("rejects when `resource` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeResourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects malformed payload (missing position)", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeResourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { resource: { resourceId: "tree_oak", type: "tree" } },
      callback,
    );
    expect(r?.success).toBe(false);
    const data = r?.data as
      | { issues: Array<{ path: string; message: string }> }
      | undefined;
    expect(data?.issues.some((i) => i.path === "position")).toBe(true);
  });

  it("accepts a well-formed tree", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const resource = {
      resourceId: "tree_oak",
      type: "tree",
      position: { x: 24, y: 0, z: -8 },
    };
    const r = await proposeResourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { resource },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { resource: typeof resource } | undefined;
    expect(data?.resource).toMatchObject(resource);
    expect(calls[0]?.action).toBe("PROPOSE_RESOURCE");
  });

  it("accepts a fishing spot", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await proposeResourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        resource: {
          resourceId: "fish_shrimp",
          type: "fishing-spot",
          position: { x: 0, y: 0, z: 30 },
        },
      },
      callback,
    );
    expect(r?.success).toBe(true);
  });
});
