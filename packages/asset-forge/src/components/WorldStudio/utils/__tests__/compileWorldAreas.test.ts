/**
 * `compileWorldAreas` — categorized WorldArea catalog tests.
 *
 * Maps studio towns + regions → 4 difficulty-bucketed Records
 * (starterTowns / level1Areas / level2Areas / level3Areas) the
 * runtime DataManager reads. Critical invariants:
 *
 *   - Towns ALWAYS land in starterTowns (safeZone=true,
 *     difficultyLevel=0)
 *   - Regions categorize by difficultyRange[0] scalar thresholds:
 *     >=0.5 → level3, >=0.3 → level2, >=0.05 → level1, else 0
 *   - safeZone=true OR difficultyLevel=0 → starterTowns (both
 *     conditions route through the same bucket)
 *   - Town NPCs filtered by parentContext.townId
 *   - Town stations filtered by Euclidean distance < TOWN_STATION_SEARCH_RADIUS
 *   - Region mobs/resources/stations filtered by sourceRegionId
 *   - Fishing block emitted only when fishing-type resources exist
 *   - Resource type remap: woodcutting→tree, fishing→fishing_spot,
 *     mining→mine, other→herb_patch
 */

import { describe, expect, it } from "vitest";
import { compileWorldAreas } from "../manifestCompiler";
import type { WorldData } from "../../WorldBuilder/types";

const EMPTY_EXTENDED = {
  npcs: [],
  spawnPoints: [],
  teleports: [],
  mobSpawns: [],
  resources: [],
  stations: [],
  pois: [],
  waterBodies: [],
  regions: [],
  dangerSources: [],
  wildernessBoundary: null,
  mines: [],
  customAssets: [],
} as never;

function makeWorld(
  overrides: {
    towns?: Array<Record<string, unknown>>;
    npcs?: Array<Record<string, unknown>>;
  } = {},
): WorldData {
  return {
    foundation: {
      config: {} as never,
      biomes: [],
      towns: overrides.towns ?? [],
      buildings: [],
    },
    layers: {
      npcs: overrides.npcs ?? [],
    },
    metadata: {} as never,
  } as unknown as WorldData;
}

describe("compileWorldAreas — empty inputs", () => {
  it("returns 4 empty buckets for empty world + empty extended", () => {
    const result = compileWorldAreas(makeWorld(), EMPTY_EXTENDED);
    expect(result.starterTowns).toEqual({});
    expect(result.level1Areas).toEqual({});
    expect(result.level2Areas).toEqual({});
    expect(result.level3Areas).toEqual({});
  });

  it("emits the canonical 4 top-level keys", () => {
    const result = compileWorldAreas(makeWorld(), EMPTY_EXTENDED);
    expect(Object.keys(result).sort()).toEqual([
      "level1Areas",
      "level2Areas",
      "level3Areas",
      "starterTowns",
    ]);
  });
});

describe("compileWorldAreas — towns always land in starterTowns", () => {
  it("a town lands in starterTowns with safeZone=true and difficultyLevel=0", () => {
    const town = {
      id: "t1",
      name: "Test Town",
      position: { x: 0, y: 0, z: 0 },
      size: "village",
      safeZoneRadius: 50,
    };
    const result = compileWorldAreas(
      makeWorld({ towns: [town] }),
      EMPTY_EXTENDED,
    );
    expect(Object.keys(result.starterTowns)).toEqual(["t1"]);
    const area = result.starterTowns["t1"];
    expect(area.safeZone).toBe(true);
    expect(area.difficultyLevel).toBe(0);
    expect(area.biomeType).toBe("town");
  });

  it("town bounds = position ± safeZoneRadius (square AABB)", () => {
    const town = {
      id: "t1",
      name: "T1",
      position: { x: 100, y: 0, z: 200 },
      size: "village",
      safeZoneRadius: 40,
    };
    const result = compileWorldAreas(
      makeWorld({ towns: [town] }),
      EMPTY_EXTENDED,
    );
    expect(result.starterTowns["t1"].bounds).toEqual({
      minX: 60,
      maxX: 140,
      minZ: 160,
      maxZ: 240,
    });
  });

  it("town description titlecases the size prefix", () => {
    const town = {
      id: "t1",
      name: "Eldridge",
      position: { x: 0, y: 0, z: 0 },
      size: "village",
      safeZoneRadius: 50,
    };
    const result = compileWorldAreas(
      makeWorld({ towns: [town] }),
      EMPTY_EXTENDED,
    );
    expect(result.starterTowns["t1"].description).toBe("Village of Eldridge");
  });
});

describe("compileWorldAreas — town NPC filter by parentContext", () => {
  const town = {
    id: "t1",
    name: "T1",
    position: { x: 0, y: 0, z: 0 },
    size: "village",
    safeZoneRadius: 50,
  };

  it("includes NPCs whose parentContext.townId matches", () => {
    const result = compileWorldAreas(
      makeWorld({
        towns: [town],
        npcs: [
          {
            id: "npc1",
            name: "Eldric",
            position: { x: 0, y: 0, z: 0 },
            parentContext: { type: "town", townId: "t1" },
            storeId: "general",
          },
        ],
      }),
      EMPTY_EXTENDED,
    );
    expect(result.starterTowns["t1"].npcs).toHaveLength(1);
    expect(result.starterTowns["t1"].npcs[0]?.id).toBe("npc1");
    expect(result.starterTowns["t1"].npcs[0]?.name).toBe("Eldric");
    expect(result.starterTowns["t1"].npcs[0]?.storeId).toBe("general");
  });

  it("excludes NPCs whose parentContext.townId is different", () => {
    const result = compileWorldAreas(
      makeWorld({
        towns: [town],
        npcs: [
          {
            id: "npc1",
            name: "Outsider",
            position: { x: 0, y: 0, z: 0 },
            parentContext: { type: "town", townId: "t2" },
          },
        ],
      }),
      EMPTY_EXTENDED,
    );
    expect(result.starterTowns["t1"].npcs).toEqual([]);
  });

  it("excludes NPCs whose parentContext.type is NOT 'town'", () => {
    const result = compileWorldAreas(
      makeWorld({
        towns: [town],
        npcs: [
          {
            id: "npc1",
            name: "Wanderer",
            position: { x: 0, y: 0, z: 0 },
            parentContext: { type: "world" },
          },
        ],
      }),
      EMPTY_EXTENDED,
    );
    expect(result.starterTowns["t1"].npcs).toEqual([]);
  });
});

describe("compileWorldAreas — region difficulty bucketing", () => {
  it.each([
    [0, "starterTowns"], // scalar 0
    [0.04, "starterTowns"], // < 0.05 → level 0 → starterTowns (via safeZone)
    [0.1, "level1Areas"], // [0.05, 0.3) → level 1
    [0.29, "level1Areas"],
    [0.3, "level2Areas"], // [0.3, 0.5) → level 2
    [0.49, "level2Areas"],
    [0.5, "level3Areas"], // >= 0.5 → level 3
    [0.9, "level3Areas"],
  ] as const)("scalar=%s → %s bucket", (scalar, bucket) => {
    const region = {
      id: "r1",
      name: "Region",
      tileKeys: [],
      autoGenBounds: {
        difficultyRange: [scalar, scalar],
        boundingBox: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
      },
    } as never;
    const result = compileWorldAreas(makeWorld(), {
      ...EMPTY_EXTENDED,
      regions: [region],
    });
    expect(result[bucket]["r1"]).toBeDefined();
  });

  it("region without autoGenBounds lands in starterTowns (difficultyLevel=0 default)", () => {
    const region = {
      id: "r1",
      name: "Region",
      tileKeys: [],
    } as never;
    const result = compileWorldAreas(makeWorld(), {
      ...EMPTY_EXTENDED,
      regions: [region],
    });
    expect(result.starterTowns["r1"]).toBeDefined();
  });
});

describe("compileWorldAreas — region content filters by sourceRegionId", () => {
  const region = {
    id: "r1",
    name: "North",
    tileKeys: [],
    autoGenBounds: {
      difficultyRange: [0.3, 0.5],
      boundingBox: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
    },
  } as never;

  it("includes mobs whose sourceRegionId matches", () => {
    const result = compileWorldAreas(makeWorld(), {
      ...EMPTY_EXTENDED,
      regions: [region],
      mobSpawns: [
        {
          id: "ms1",
          mobId: "goblin",
          position: { x: 5, y: 0, z: 5 },
          spawnRadius: 10,
          maxCount: 5,
          respawnTicks: 100,
          sourceRegionId: "r1",
        },
        {
          id: "ms2",
          mobId: "wolf",
          position: { x: 0, y: 0, z: 0 },
          spawnRadius: 5,
          maxCount: 3,
          respawnTicks: 200,
          sourceRegionId: "other-region",
        },
      ],
    });
    const mobs = result.level2Areas["r1"].mobSpawns;
    expect(mobs).toHaveLength(1);
    expect(mobs[0]?.mobId).toBe("goblin");
    expect(mobs[0]?.respawnTime).toBe(100); // respawnTicks → respawnTime
  });

  it("resource type remap: woodcutting→tree, fishing→fishing_spot, mining→mine, other→herb_patch", () => {
    const result = compileWorldAreas(makeWorld(), {
      ...EMPTY_EXTENDED,
      regions: [region],
      resources: [
        {
          id: "r1-wood",
          resourceId: "oak",
          resourceType: "woodcutting",
          position: { x: 0, y: 0, z: 0 },
          sourceRegionId: "r1",
        },
        {
          id: "r1-fish",
          resourceId: "trout-spot",
          resourceType: "fishing",
          position: { x: 1, y: 0, z: 1 },
          sourceRegionId: "r1",
        },
        {
          id: "r1-mine",
          resourceId: "copper",
          resourceType: "mining",
          position: { x: 2, y: 0, z: 2 },
          sourceRegionId: "r1",
        },
        {
          id: "r1-other",
          resourceId: "mystery",
          resourceType: "alchemy",
          position: { x: 3, y: 0, z: 3 },
          sourceRegionId: "r1",
        },
      ],
    });
    const types = result.level2Areas["r1"].resources.map((r) => r.type).sort();
    expect(types).toEqual(["fishing_spot", "herb_patch", "mine", "tree"]);
  });

  it("fishing block emitted ONLY when fishing-type resources present", () => {
    const woodOnly = compileWorldAreas(makeWorld(), {
      ...EMPTY_EXTENDED,
      regions: [region],
      resources: [
        {
          id: "r1-wood",
          resourceId: "oak",
          resourceType: "woodcutting",
          position: { x: 0, y: 0, z: 0 },
          sourceRegionId: "r1",
        },
      ],
    });
    expect(woodOnly.level2Areas["r1"].fishing).toBeUndefined();

    const withFishing = compileWorldAreas(makeWorld(), {
      ...EMPTY_EXTENDED,
      regions: [region],
      resources: [
        {
          id: "f1",
          resourceId: "trout-spot",
          resourceType: "fishing",
          position: { x: 0, y: 0, z: 0 },
          sourceRegionId: "r1",
        },
        {
          id: "f2",
          resourceId: "salmon-spot",
          resourceType: "fishing",
          position: { x: 1, y: 0, z: 1 },
          sourceRegionId: "r1",
        },
      ],
    });
    expect(withFishing.level2Areas["r1"].fishing).toBeDefined();
    expect(withFishing.level2Areas["r1"].fishing?.enabled).toBe(true);
    expect(withFishing.level2Areas["r1"].fishing?.spotCount).toBe(2);
    expect(withFishing.level2Areas["r1"].fishing?.spotTypes.sort()).toEqual([
      "salmon-spot",
      "trout-spot",
    ]);
  });
});

describe("compileWorldAreas — town stations filter by Euclidean distance", () => {
  const town = {
    id: "t1",
    name: "T1",
    position: { x: 0, y: 0, z: 0 },
    size: "village",
    safeZoneRadius: 50,
  };

  it("includes stations within TOWN_STATION_SEARCH_RADIUS (80m)", () => {
    const result = compileWorldAreas(makeWorld({ towns: [town] }), {
      ...EMPTY_EXTENDED,
      stations: [
        {
          id: "s1",
          stationType: "anvil",
          position: { x: 10, y: 0, z: 0 },
          rotation: 0,
        },
      ],
    });
    expect(result.starterTowns["t1"].stations).toHaveLength(1);
    expect(result.starterTowns["t1"].stations[0]?.id).toBe("s1");
    expect(result.starterTowns["t1"].stations[0]?.type).toBe("anvil");
  });

  it("excludes stations beyond TOWN_STATION_SEARCH_RADIUS", () => {
    const result = compileWorldAreas(makeWorld({ towns: [town] }), {
      ...EMPTY_EXTENDED,
      stations: [
        {
          id: "s-far",
          stationType: "anvil",
          position: { x: 200, y: 0, z: 0 }, // beyond 80m
          rotation: 0,
        },
      ],
    });
    expect(result.starterTowns["t1"].stations).toEqual([]);
  });
});
