import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_NPCS } from "../../../../data/npcs";
import { ALL_WORLD_AREAS } from "../../../../data/world-areas";
import { EventType } from "../../../../types/events";
import { EventBus } from "../../infrastructure/EventBus";
import { MobNPCSpawnerSystem } from "../MobNPCSpawnerSystem";

describe("MobNPCSpawnerSystem store identity", () => {
  const originalAreas = new Map(Object.entries(ALL_WORLD_AREAS));
  const originalNPCs = new Map(ALL_NPCS);

  beforeEach(() => {
    for (const key of Object.keys(ALL_WORLD_AREAS)) {
      delete ALL_WORLD_AREAS[key];
    }
    ALL_NPCS.clear();
  });

  afterEach(() => {
    for (const key of Object.keys(ALL_WORLD_AREAS)) {
      delete ALL_WORLD_AREAS[key];
    }
    for (const [key, area] of originalAreas) {
      ALL_WORLD_AREAS[key] = area;
    }
    ALL_NPCS.clear();
    for (const [key, npc] of originalNPCs) {
      ALL_NPCS.set(key, npc);
    }
    vi.restoreAllMocks();
  });

  it("carries the manifest store ID through the production spawner and registers that exact entity", async () => {
    ALL_WORLD_AREAS.central_haven = {
      id: "central_haven",
      name: "Central Haven",
      description: "test",
      difficultyLevel: 0,
      bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
      biomeType: "starter_town",
      safeZone: true,
      npcs: [
        {
          id: "torvin",
          type: "quest_giver",
          storeId: "sword_store",
          position: { x: 2, y: 0, z: 3 },
        },
      ],
      resources: [],
      mobSpawns: [],
    };
    ALL_NPCS.set("torvin", {
      id: "torvin",
      name: "Torvin",
      description: "Weapon merchant",
      appearance: { modelPath: "asset://models/npcs/torvin.vrm" },
      services: { enabled: true, types: ["shop"], questIds: [] },
    } as never);

    const eventBus = new EventBus();
    const spawnEntity = vi.fn(async (config: Record<string, unknown>) => ({
      id: "npc_runtime_torvin",
      config,
    }));
    const terrain = { getHeightAt: () => 7 };
    const world = {
      isServer: true,
      $eventBus: eventBus,
      getSystem: (name: string) => {
        if (name === "entity-manager") return { spawnEntity };
        if (name === "terrain") return terrain;
        return null;
      },
    };
    const registrations: unknown[] = [];
    eventBus.subscribe(EventType.STORE_REGISTER_NPC, (event) => {
      registrations.push(event.data);
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const spawner = new MobNPCSpawnerSystem(world as never);
    await spawner.init();
    await (
      spawner as unknown as {
        spawnAllNPCsFromManifest(): Promise<void>;
      }
    ).spawnAllNPCsFromManifest();

    expect(spawnEntity).toHaveBeenCalledTimes(1);
    expect(spawnEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        npcId: "torvin",
        storeId: "sword_store",
        position: { x: 2, y: 7, z: 3 },
      }),
    );
    expect(registrations).toEqual([
      {
        npcId: "npc_runtime_torvin",
        storeId: "sword_store",
        position: { x: 2, y: 0, z: 3 },
        name: "Torvin",
        area: "central_haven",
      },
    ]);
  });
});
