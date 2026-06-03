import { describe, expect, it } from "vitest";
import { mapProvider } from "../providers/mapProvider";
import type { WorldMapData } from "../types";

function createWorldMap(): WorldMapData {
  return {
    towns: [
      {
        id: "town-1",
        name: "Harbor",
        position: { x: 20, y: 0, z: 20 },
        size: "small",
        biome: "coast",
        buildings: [{ type: "bank" }],
      },
    ],
    pois: [],
    resources: [],
    stations: [],
    npcs: [],
  };
}

describe("mapProvider cache scoping", () => {
  it("recomputes when the player moves within the same rounded tile", async () => {
    const player = {
      position: [10.1, 0, 20] as [number, number, number],
    };
    const service = {
      isConnected: () => true,
      getWorldMap: () => createWorldMap(),
      getPlayerEntity: () => player,
    };
    const runtime = {
      agentId: "map-cache-agent",
      getService: () => service,
    };

    const firstResult = await mapProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    player.position = [10.4, 0, 20];

    const secondResult = await mapProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    expect(firstResult.values?.nearestTownDistance).toBeCloseTo(9.9);
    expect(secondResult.values?.nearestTownDistance).toBeCloseTo(9.6);
  });
});
