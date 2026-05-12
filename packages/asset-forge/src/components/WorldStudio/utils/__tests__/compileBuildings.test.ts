/**
 * `compileBuildings` — buildings.json compilation tests.
 *
 * Bridges WorldFoundation towns + buildings → the manifest
 * shape TownSystem / BuildingRenderingSystem expect. Three
 * non-trivial transforms:
 *
 * 1. Building positions are stored as absolute world coords in
 *    the foundation but emitted RELATIVE to town center —
 *    TownSystem's convertManifestTown re-adds town.position +
 *    building.position. Drift in subtraction direction would
 *    silently shift every building by 2× its offset.
 *
 * 2. Default building generation: a town with zero buildings
 *    gets a default { bank, store } pair so TownSystem's
 *    "at least one building" contract is met.
 *
 * 3. Town size string remap (hamlet → "sm", village → "md",
 *    town → "lg") with "md" fallback for unknown sizes.
 *
 * Plus a static buildingTypes catalog at the tail with
 * per-type widthRange/depthRange/floors fields the renderer
 * reads.
 */

import { describe, expect, it } from "vitest";
import { compileBuildings } from "../manifestCompiler";
import type { WorldData } from "../../WorldBuilder/types";

function makeWorld(
  towns: Array<Record<string, unknown>> = [],
  buildings: Array<Record<string, unknown>> = [],
): WorldData {
  return {
    foundation: {
      config: {} as never,
      biomes: [],
      towns,
      buildings,
    },
    layers: {} as never,
    metadata: {} as never,
  } as unknown as WorldData;
}

describe("compileBuildings — top-level shape", () => {
  it("emits version 1", () => {
    const result = compileBuildings(makeWorld());
    expect(result.version).toBe(1);
  });

  it("emits the canonical top-level keys", () => {
    const result = compileBuildings(makeWorld());
    expect(Object.keys(result).sort()).toEqual([
      "buildingTypes",
      "sizeDefinitions",
      "towns",
      "version",
    ]);
  });

  it("returns empty towns array when no towns are present", () => {
    const result = compileBuildings(makeWorld());
    expect(result.towns).toEqual([]);
  });
});

describe("compileBuildings — town size remap", () => {
  const cases = [
    ["hamlet", "sm"],
    ["village", "md"],
    ["town", "lg"],
  ] as const;

  it.each(cases)("'%s' size → '%s'", (input, expected) => {
    const result = compileBuildings(
      makeWorld([
        {
          id: "t1",
          name: "T1",
          position: { x: 0, y: 0, z: 0 },
          size: input,
          safeZoneRadius: 50,
        },
      ]),
    );
    const towns = result.towns as Array<{ size: string }>;
    expect(towns[0].size).toBe(expected);
  });

  it("falls back to 'md' for unknown sizes", () => {
    const result = compileBuildings(
      makeWorld([
        {
          id: "t1",
          name: "T1",
          position: { x: 0, y: 0, z: 0 },
          size: "metropolis",
          safeZoneRadius: 50,
        },
      ]),
    );
    expect((result.towns as Array<{ size: string }>)[0].size).toBe("md");
  });
});

describe("compileBuildings — relative building positions", () => {
  it("subtracts town position from building position (absolute → relative)", () => {
    const town = {
      id: "t1",
      name: "T1",
      position: { x: 100, y: 0, z: 200 },
      size: "village",
      safeZoneRadius: 50,
    };
    const building = {
      id: "b1",
      type: "bank",
      townId: "t1",
      position: { x: 110, y: 0, z: 210 }, // 10 east, 10 south of town center
      rotation: 0,
      dimensions: { width: 4, depth: 4 },
    };
    const result = compileBuildings(makeWorld([town], [building]));
    const compiled = result.towns as Array<{
      buildings: Array<{ position: { x: number; y: number; z: number } }>;
    }>;
    expect(compiled[0].buildings[0].position).toEqual({ x: 10, y: 0, z: 10 });
  });

  it("filters buildings by townId (cross-town buildings excluded)", () => {
    const towns = [
      {
        id: "t1",
        name: "T1",
        position: { x: 0, y: 0, z: 0 },
        size: "town",
        safeZoneRadius: 80,
      },
      {
        id: "t2",
        name: "T2",
        position: { x: 200, y: 0, z: 0 },
        size: "village",
        safeZoneRadius: 50,
      },
    ];
    const buildings = [
      {
        id: "b1",
        type: "bank",
        townId: "t1",
        position: { x: 10, y: 0, z: 0 },
        rotation: 0,
        dimensions: { width: 4, depth: 4 },
      },
      {
        id: "b2",
        type: "store",
        townId: "t2",
        position: { x: 210, y: 0, z: 0 },
        rotation: 0,
        dimensions: { width: 4, depth: 4 },
      },
    ];
    const result = compileBuildings(makeWorld(towns, buildings));
    const compiled = result.towns as Array<{
      id: string;
      buildings: Array<{ id: string }>;
    }>;
    expect(compiled[0].buildings.map((b) => b.id)).toEqual(["b1"]);
    expect(compiled[1].buildings.map((b) => b.id)).toEqual(["b2"]);
  });

  it("emits building size from dimensions (width + depth)", () => {
    const town = {
      id: "t1",
      name: "T1",
      position: { x: 0, y: 0, z: 0 },
      size: "village",
      safeZoneRadius: 50,
    };
    const building = {
      id: "b1",
      type: "inn",
      townId: "t1",
      position: { x: 0, y: 0, z: 0 },
      rotation: 1.57,
      dimensions: { width: 5, depth: 6 },
    };
    const result = compileBuildings(makeWorld([town], [building]));
    const b = (
      result.towns as Array<{
        buildings: Array<{
          rotation: number;
          size: { width: number; depth: number };
        }>;
      }>
    )[0].buildings[0];
    expect(b.size).toEqual({ width: 5, depth: 6 });
    expect(b.rotation).toBe(1.57);
  });
});

describe("compileBuildings — default building generation", () => {
  it("emits default {bank, store} pair when a town has no buildings", () => {
    const town = {
      id: "lonely",
      name: "Lonely",
      position: { x: 0, y: 0, z: 0 },
      size: "hamlet",
      safeZoneRadius: 30,
    };
    const result = compileBuildings(makeWorld([town]));
    const buildings = (
      result.towns as Array<{
        buildings: Array<{ id: string; type: string }>;
      }>
    )[0].buildings;
    expect(buildings).toHaveLength(2);
    expect(buildings.map((b) => b.type).sort()).toEqual(["bank", "store"]);
  });

  it("default buildings carry the town id prefix", () => {
    const town = {
      id: "village_a",
      name: "Village A",
      position: { x: 0, y: 0, z: 0 },
      size: "village",
      safeZoneRadius: 50,
    };
    const result = compileBuildings(makeWorld([town]));
    const buildings = (
      result.towns as Array<{ buildings: Array<{ id: string }> }>
    )[0].buildings;
    expect(buildings.find((b) => b.id === "village_a_bank")).toBeDefined();
    expect(buildings.find((b) => b.id === "village_a_store")).toBeDefined();
  });

  it("does NOT add defaults when the town has at least one building", () => {
    const town = {
      id: "t1",
      name: "T1",
      position: { x: 0, y: 0, z: 0 },
      size: "village",
      safeZoneRadius: 50,
    };
    const building = {
      id: "b1",
      type: "anvil",
      townId: "t1",
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      dimensions: { width: 3, depth: 3 },
    };
    const result = compileBuildings(makeWorld([town], [building]));
    const buildings = (
      result.towns as Array<{ buildings: Array<{ id: string }> }>
    )[0].buildings;
    expect(buildings.map((b) => b.id)).toEqual(["b1"]);
  });
});

describe("compileBuildings — town preserved fields", () => {
  it("emits keep=true on every town (TownSystem reserves render slot)", () => {
    const result = compileBuildings(
      makeWorld([
        {
          id: "t1",
          name: "T1",
          position: { x: 0, y: 0, z: 0 },
          size: "village",
          safeZoneRadius: 50,
        },
      ]),
    );
    const town = (result.towns as Array<{ keep: boolean }>)[0];
    expect(town.keep).toBe(true);
  });

  it("flows safeZoneRadius from foundation town", () => {
    const result = compileBuildings(
      makeWorld([
        {
          id: "t1",
          name: "T1",
          position: { x: 0, y: 0, z: 0 },
          size: "village",
          safeZoneRadius: 75,
        },
      ]),
    );
    const town = (result.towns as Array<{ safeZoneRadius: number }>)[0];
    expect(town.safeZoneRadius).toBe(75);
  });

  it("falls back to getTownSafeRadius when safeZoneRadius is undefined", () => {
    const result = compileBuildings(
      makeWorld([
        {
          id: "t1",
          name: "T1",
          position: { x: 0, y: 0, z: 0 },
          size: "village", // village → 50 from getTownSafeRadius
        },
      ]),
    );
    const town = (result.towns as Array<{ safeZoneRadius: number }>)[0];
    expect(town.safeZoneRadius).toBe(50);
  });
});

describe("compileBuildings — buildingTypes static catalog", () => {
  it("includes the canonical building type set", () => {
    const result = compileBuildings(makeWorld());
    const types = result.buildingTypes as Record<string, unknown>;
    expect(Object.keys(types).sort()).toEqual([
      "anvil",
      "bank",
      "chapel",
      "church",
      "house",
      "inn",
      "keep",
      "long-house",
      "simple-house",
      "smithy",
      "store",
      "well",
    ]);
  });

  it("each buildingType has label / widthRange / depthRange / floors / hasBasement", () => {
    const types = compileBuildings(makeWorld()).buildingTypes as Record<
      string,
      Record<string, unknown>
    >;
    for (const [_id, def] of Object.entries(types)) {
      expect(typeof def.label).toBe("string");
      expect(Array.isArray(def.widthRange)).toBe(true);
      expect((def.widthRange as number[]).length).toBe(2);
      expect(Array.isArray(def.depthRange)).toBe(true);
      expect((def.depthRange as number[]).length).toBe(2);
      expect(typeof def.floors).toBe("number");
      expect(typeof def.hasBasement).toBe("boolean");
    }
  });

  it("inn is the only building type with floors > 1", () => {
    const types = compileBuildings(makeWorld()).buildingTypes as Record<
      string,
      { floors: number }
    >;
    expect(types.inn.floors).toBe(2);
    expect(types.bank.floors).toBe(1);
    expect(types.store.floors).toBe(1);
  });
});
