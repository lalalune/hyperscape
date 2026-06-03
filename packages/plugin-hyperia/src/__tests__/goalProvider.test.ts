import { afterEach, describe, expect, it } from "vitest";
import {
  KNOWN_LOCATIONS,
  getWorldMapSignature,
  populateKnownLocationsFromWorldMap,
} from "../providers/goalProvider";
import type { WorldMapData } from "../types";

function createWorldMap(overrides: Partial<WorldMapData> = {}): WorldMapData {
  return {
    towns: [],
    pois: [],
    resources: [],
    stations: [],
    npcs: [],
    ...overrides,
  };
}

function cloneKnownLocation(
  location:
    | {
        position?: [number, number, number];
        description: string;
        entities?: string[];
      }
    | undefined,
) {
  if (!location) {
    return undefined;
  }

  return {
    ...location,
    position: location.position ? [...location.position] : undefined,
    entities: location.entities ? [...location.entities] : undefined,
  };
}

const originalSpawnLocation = cloneKnownLocation(KNOWN_LOCATIONS.spawn);

afterEach(() => {
  if (originalSpawnLocation) {
    KNOWN_LOCATIONS.spawn = cloneKnownLocation(originalSpawnLocation)!;
  }
  delete KNOWN_LOCATIONS.cache_test_town;
});

describe("goalProvider world map refresh", () => {
  it("updates existing town entries when world map data changes", () => {
    populateKnownLocationsFromWorldMap(
      createWorldMap({
        towns: [
          {
            id: "town-1",
            name: "Cache Test Town",
            position: { x: 10, y: 0, z: 20 },
            size: "small",
            biome: "plains",
            buildings: [{ type: "bank" }],
          },
        ],
      }),
    );

    expect(KNOWN_LOCATIONS.cache_test_town).toMatchObject({
      position: [10, 0, 20],
    });
    expect(KNOWN_LOCATIONS.cache_test_town?.description).toContain("bank");

    populateKnownLocationsFromWorldMap(
      createWorldMap({
        towns: [
          {
            id: "town-1",
            name: "Cache Test Town",
            position: { x: 45, y: 0, z: 65 },
            size: "large",
            biome: "forest",
            buildings: [{ type: "inn" }],
          },
        ],
      }),
    );

    expect(KNOWN_LOCATIONS.cache_test_town).toMatchObject({
      position: [45, 0, 65],
    });
    expect(KNOWN_LOCATIONS.cache_test_town?.description).toContain("large");
    expect(KNOWN_LOCATIONS.cache_test_town?.description).toContain("inn");
  });

  it("recomputes signatures and refreshes canonical anchors when the same world map object changes", () => {
    const worldMap = createWorldMap({
      towns: [
        {
          id: "spawn-town",
          name: "Spawn Plaza",
          position: { x: 12, y: 0, z: 18 },
          size: "small",
          biome: "plains",
          buildings: [{ type: "bank" }],
        },
      ],
    });

    const initialSignature = getWorldMapSignature(worldMap);
    populateKnownLocationsFromWorldMap(worldMap);
    expect(KNOWN_LOCATIONS.spawn?.position).toEqual([12, 0, 18]);

    worldMap.towns[0].position.x = 30;
    worldMap.towns[0].position.z = 44;

    const updatedSignature = getWorldMapSignature(worldMap);
    expect(updatedSignature).not.toBe(initialSignature);

    populateKnownLocationsFromWorldMap(worldMap);
    expect(KNOWN_LOCATIONS.spawn?.position).toEqual([30, 0, 44]);
  });
});
