import { describe, expect, it, vi } from "vitest";
import { getWorldMapSignature } from "../providers/goalProvider";
import { HyperiaService } from "../services/HyperiaService";
import type { Entity, WorldMapData } from "../types";

vi.mock("../systems/liveKit.js", () => ({
  AgentLiveKit: class {
    async stop(): Promise<void> {}
  },
}));

function createRuntime() {
  return {
    agentId: "agent-cache-test",
    getSetting: vi.fn().mockReturnValue(null),
  };
}

function createEntity(id: string): Entity {
  return {
    id,
    name: `Entity ${id}`,
    position: [10, 0, 20],
    type: "npc",
  };
}

function createWorldMap(): WorldMapData {
  return {
    towns: [
      {
        id: "town-1",
        name: "Cache Town",
        position: { x: 10, y: 0, z: 20 },
        size: "small",
        biome: "plains",
        buildings: [{ type: "bank" }],
      },
    ],
    pois: [],
    resources: [],
    stations: [],
    npcs: [],
  };
}

describe("HyperiaService cache behavior", () => {
  it("reuses nearby entity snapshots until the entity set changes", () => {
    const service = new HyperiaService(createRuntime() as never);
    const serviceInternals = service as unknown as {
      removeNearbyEntity: (entityId: string) => Entity | undefined;
      upsertNearbyEntity: (entityId: string, entity: Entity) => void;
    };

    serviceInternals.upsertNearbyEntity("entity-1", createEntity("entity-1"));

    const firstSnapshot = service.getNearbyEntities();
    const secondSnapshot = service.getNearbyEntities();

    expect(secondSnapshot).toBe(firstSnapshot);
    expect(secondSnapshot).toHaveLength(1);

    serviceInternals.upsertNearbyEntity("entity-2", createEntity("entity-2"));

    const thirdSnapshot = service.getNearbyEntities();
    expect(thirdSnapshot).not.toBe(firstSnapshot);
    expect(thirdSnapshot).toHaveLength(2);

    const fourthSnapshot = service.getNearbyEntities();
    expect(fourthSnapshot).toBe(thirdSnapshot);

    serviceInternals.removeNearbyEntity("entity-1");

    const fifthSnapshot = service.getNearbyEntities();
    expect(fifthSnapshot).not.toBe(thirdSnapshot);
    expect(fifthSnapshot).toHaveLength(1);
  });

  it("stores a precomputed world-map signature when the cached map changes", () => {
    const service = new HyperiaService(createRuntime() as never);
    const serviceInternals = service as unknown as {
      updateWorldMapCache: (worldMap?: WorldMapData) => void;
    };
    const worldMap = createWorldMap();

    serviceInternals.updateWorldMapCache(worldMap);

    expect(service.getWorldMap()).toBe(worldMap);
    expect(service.getWorldMapSignature()).toBe(getWorldMapSignature(worldMap));

    serviceInternals.updateWorldMapCache(undefined);

    expect(service.getWorldMap()).toBeUndefined();
    expect(service.getWorldMapSignature()).toBeNull();
  });
});
