/**
 * Unit tests for the zone/region sub-reducer.
 *
 * Mirrors entityReducer.test.ts: each action type handled by
 * zoneReducer is exercised with minimal but complete assertions
 * against a partial mock state cast as `WorldStudioState`.
 *
 * Coverage:
 *   - Zone tile painting flow (START / UPDATE_CURSOR / PAINT /
 *     SET_BRUSH_SIZE / SET_PAINT_MODE / STOP / SWITCH_REGION)
 *   - Region CRUD (ADD / UPDATE / REMOVE)
 *   - Danger source CRUD (ADD / UPDATE / REMOVE)
 *   - Batch region add (auto-generation)
 *   - Default fall-through (returns null for unhandled actions)
 */

import { describe, expect, it } from "vitest";
import { zoneReducer } from "../zoneReducer";
import { initialToolState } from "../../worldStudioTypes";
import type {
  WorldStudioAction,
  WorldStudioState,
} from "../../worldStudioTypes";
import type {
  ExtendedWorldLayers,
  PlacedRegion,
  WorldStudioDangerSource,
} from "../../types";

function makeState(
  overrides?: Partial<{
    extendedLayers: Partial<ExtendedWorldLayers>;
    tools: Partial<typeof initialToolState>;
  }>,
): WorldStudioState {
  return {
    extendedLayers: {
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
      ...overrides?.extendedLayers,
    },
    tools: { ...initialToolState, ...overrides?.tools },
    builder: {
      editing: {
        selection: { type: "none" as never, id: null, path: [] },
      },
    },
  } as unknown as WorldStudioState;
}

function makeRegion(id: string, tileKeys: string[] = []): PlacedRegion {
  return {
    id,
    name: `Region ${id}`,
    tileKeys,
    color: 0xff0000,
    difficultyLevel: 1,
  } as unknown as PlacedRegion;
}

function makeDanger(id: string): WorldStudioDangerSource {
  return {
    id,
    name: `Danger ${id}`,
    position: { x: 0, y: 0, z: 0 },
    radius: 50,
    intensity: 1,
    falloffCurve: 1,
  } as unknown as WorldStudioDangerSource;
}

describe("zoneReducer — default fall-through", () => {
  it("returns null for actions it doesn't handle", () => {
    const state = makeState();
    const r = zoneReducer(state, {
      type: "UNRELATED_ACTION",
    } as unknown as WorldStudioAction);
    expect(r).toBeNull();
  });
});

describe("zoneReducer — zone painting flow", () => {
  it("START_ZONE_PAINT activates the zonePaint tool with given region", () => {
    const state = makeState();
    const r = zoneReducer(state, {
      type: "START_ZONE_PAINT",
      regionId: "north",
    } as WorldStudioAction);
    expect(r).not.toBeNull();
    expect(r?.tools.activeTool).toBe("zonePaint");
    expect(r?.tools.zonePaint?.regionId).toBe("north");
    expect(r?.tools.zonePaint?.brushSize).toBe(1);
    expect(r?.tools.zonePaint?.mode).toBe("paint");
    expect(r?.tools.zonePaint?.cursorTile).toBeNull();
  });

  it("START_ZONE_PAINT preserves existing brushSize and mode if zonePaint is already active", () => {
    const state = makeState({
      tools: {
        zonePaint: {
          regionId: "old",
          brushSize: 3,
          cursorTile: { x: 1, z: 1 },
          mode: "erase",
        },
      },
    });
    const r = zoneReducer(state, {
      type: "START_ZONE_PAINT",
      regionId: "new",
    } as WorldStudioAction);
    expect(r?.tools.zonePaint?.regionId).toBe("new");
    expect(r?.tools.zonePaint?.brushSize).toBe(3); // preserved
    expect(r?.tools.zonePaint?.mode).toBe("erase"); // preserved
    expect(r?.tools.zonePaint?.cursorTile).toBeNull(); // reset
  });

  it("UPDATE_ZONE_CURSOR is a no-op when zonePaint is not active", () => {
    const state = makeState();
    const r = zoneReducer(state, {
      type: "UPDATE_ZONE_CURSOR",
      tile: { x: 5, z: 5 },
    } as WorldStudioAction);
    // Returns the same state object reference since zonePaint is null.
    expect(r).toBe(state);
  });

  it("UPDATE_ZONE_CURSOR sets the cursor when zonePaint is active", () => {
    const state = makeState({
      tools: {
        zonePaint: {
          regionId: "r",
          brushSize: 1,
          cursorTile: null,
          mode: "paint",
        },
      },
    });
    const r = zoneReducer(state, {
      type: "UPDATE_ZONE_CURSOR",
      tile: { x: 5, z: 5 },
    } as WorldStudioAction);
    expect(r?.tools.zonePaint?.cursorTile).toEqual({ x: 5, z: 5 });
  });

  it("PAINT_ZONE_TILES adds tile keys to the region", () => {
    const region = makeRegion("r1", ["0,0"]);
    const state = makeState({ extendedLayers: { regions: [region] } });
    const r = zoneReducer(state, {
      type: "PAINT_ZONE_TILES",
      regionId: "r1",
      tileKeys: ["1,1", "2,2"],
      erase: false,
    } as WorldStudioAction);
    const updated = r?.extendedLayers.regions[0];
    expect(updated?.tileKeys.sort()).toEqual(["0,0", "1,1", "2,2"]);
  });

  it("PAINT_ZONE_TILES with erase=true removes tile keys from the region", () => {
    const region = makeRegion("r1", ["0,0", "1,1", "2,2"]);
    const state = makeState({ extendedLayers: { regions: [region] } });
    const r = zoneReducer(state, {
      type: "PAINT_ZONE_TILES",
      regionId: "r1",
      tileKeys: ["1,1"],
      erase: true,
    } as WorldStudioAction);
    const updated = r?.extendedLayers.regions[0];
    expect(updated?.tileKeys.sort()).toEqual(["0,0", "2,2"]);
  });

  it("PAINT_ZONE_TILES dedupes when adding tiles already in the region", () => {
    const region = makeRegion("r1", ["0,0"]);
    const state = makeState({ extendedLayers: { regions: [region] } });
    const r = zoneReducer(state, {
      type: "PAINT_ZONE_TILES",
      regionId: "r1",
      tileKeys: ["0,0", "1,1"],
      erase: false,
    } as WorldStudioAction);
    const updated = r?.extendedLayers.regions[0];
    expect(updated?.tileKeys.sort()).toEqual(["0,0", "1,1"]);
  });

  it("PAINT_ZONE_TILES is a no-op when region id doesn't exist", () => {
    const state = makeState();
    const r = zoneReducer(state, {
      type: "PAINT_ZONE_TILES",
      regionId: "missing",
      tileKeys: ["0,0"],
      erase: false,
    } as WorldStudioAction);
    expect(r).toBe(state);
  });

  it("SET_ZONE_BRUSH_SIZE updates the brush size", () => {
    const state = makeState({
      tools: {
        zonePaint: {
          regionId: "r",
          brushSize: 1,
          cursorTile: null,
          mode: "paint",
        },
      },
    });
    const r = zoneReducer(state, {
      type: "SET_ZONE_BRUSH_SIZE",
      size: 5,
    } as WorldStudioAction);
    expect(r?.tools.zonePaint?.brushSize).toBe(5);
  });

  it("SET_ZONE_PAINT_MODE switches between paint and erase", () => {
    const state = makeState({
      tools: {
        zonePaint: {
          regionId: "r",
          brushSize: 1,
          cursorTile: null,
          mode: "paint",
        },
      },
    });
    const r = zoneReducer(state, {
      type: "SET_ZONE_PAINT_MODE",
      mode: "erase",
    } as WorldStudioAction);
    expect(r?.tools.zonePaint?.mode).toBe("erase");
  });

  it("STOP_ZONE_PAINT clears the zonePaint tool and switches to select", () => {
    const state = makeState({
      tools: {
        activeTool: "zonePaint",
        zonePaint: {
          regionId: "r",
          brushSize: 1,
          cursorTile: null,
          mode: "paint",
        },
      },
    });
    const r = zoneReducer(state, {
      type: "STOP_ZONE_PAINT",
    } as WorldStudioAction);
    expect(r?.tools.zonePaint).toBeNull();
    expect(r?.tools.activeTool).toBe("select");
  });

  it("SWITCH_ZONE_PAINT_REGION changes which region is being painted", () => {
    const state = makeState({
      tools: {
        zonePaint: {
          regionId: "old",
          brushSize: 3,
          cursorTile: { x: 1, z: 1 },
          mode: "erase",
        },
      },
    });
    const r = zoneReducer(state, {
      type: "SWITCH_ZONE_PAINT_REGION",
      regionId: "new",
    } as WorldStudioAction);
    expect(r?.tools.zonePaint?.regionId).toBe("new");
    // brushSize + mode preserved across the switch
    expect(r?.tools.zonePaint?.brushSize).toBe(3);
    expect(r?.tools.zonePaint?.mode).toBe("erase");
  });
});

describe("zoneReducer — region CRUD", () => {
  it("ADD_REGION appends a new region", () => {
    const state = makeState();
    const region = makeRegion("r1");
    const r = zoneReducer(state, {
      type: "ADD_REGION",
      region,
    } as WorldStudioAction);
    expect(r?.extendedLayers.regions).toHaveLength(1);
    expect(r?.extendedLayers.regions[0]?.id).toBe("r1");
  });

  it("UPDATE_REGION merges updates into the matching region", () => {
    const region = makeRegion("r1");
    const state = makeState({ extendedLayers: { regions: [region] } });
    const r = zoneReducer(state, {
      type: "UPDATE_REGION",
      id: "r1",
      updates: { name: "New Name" },
    } as WorldStudioAction);
    expect(r?.extendedLayers.regions[0]?.name).toBe("New Name");
    expect(r?.extendedLayers.regions[0]?.id).toBe("r1");
  });

  it("UPDATE_REGION leaves non-matching regions untouched", () => {
    const a = makeRegion("a");
    const b = makeRegion("b");
    const state = makeState({ extendedLayers: { regions: [a, b] } });
    const r = zoneReducer(state, {
      type: "UPDATE_REGION",
      id: "a",
      updates: { name: "Updated A" },
    } as WorldStudioAction);
    expect(r?.extendedLayers.regions[1]?.name).toBe("Region b");
  });

  it("REMOVE_REGION drops the matching region", () => {
    const a = makeRegion("a");
    const b = makeRegion("b");
    const state = makeState({ extendedLayers: { regions: [a, b] } });
    const r = zoneReducer(state, {
      type: "REMOVE_REGION",
      id: "a",
    } as WorldStudioAction);
    expect(r?.extendedLayers.regions).toHaveLength(1);
    expect(r?.extendedLayers.regions[0]?.id).toBe("b");
  });
});

describe("zoneReducer — danger source CRUD", () => {
  it("ADD_DANGER_SOURCE appends a new source", () => {
    const state = makeState();
    const r = zoneReducer(state, {
      type: "ADD_DANGER_SOURCE",
      dangerSource: makeDanger("d1"),
    } as WorldStudioAction);
    expect(r?.extendedLayers.dangerSources).toHaveLength(1);
    expect(r?.extendedLayers.dangerSources[0]?.id).toBe("d1");
  });

  it("UPDATE_DANGER_SOURCE merges updates", () => {
    const danger = makeDanger("d1");
    const state = makeState({
      extendedLayers: { dangerSources: [danger] },
    });
    const r = zoneReducer(state, {
      type: "UPDATE_DANGER_SOURCE",
      id: "d1",
      updates: { intensity: 3 },
    } as WorldStudioAction);
    expect(r?.extendedLayers.dangerSources[0]?.intensity).toBe(3);
    expect(r?.extendedLayers.dangerSources[0]?.id).toBe("d1");
  });

  it("REMOVE_DANGER_SOURCE drops the matching source", () => {
    const a = makeDanger("a");
    const b = makeDanger("b");
    const state = makeState({
      extendedLayers: { dangerSources: [a, b] },
    });
    const r = zoneReducer(state, {
      type: "REMOVE_DANGER_SOURCE",
      id: "a",
    } as WorldStudioAction);
    expect(r?.extendedLayers.dangerSources).toHaveLength(1);
    expect(r?.extendedLayers.dangerSources[0]?.id).toBe("b");
  });
});

describe("zoneReducer — batch operations", () => {
  it("BATCH_ADD_REGIONS appends multiple regions in one action", () => {
    const state = makeState({
      extendedLayers: { regions: [makeRegion("existing")] },
    });
    const r = zoneReducer(state, {
      type: "BATCH_ADD_REGIONS",
      regions: [makeRegion("a"), makeRegion("b"), makeRegion("c")],
    } as WorldStudioAction);
    expect(r?.extendedLayers.regions).toHaveLength(4);
    expect(r?.extendedLayers.regions.map((rg) => rg.id)).toEqual([
      "existing",
      "a",
      "b",
      "c",
    ]);
  });

  it("BATCH_ADD_REGIONS with empty array is a no-op (preserves existing regions)", () => {
    const state = makeState({
      extendedLayers: { regions: [makeRegion("existing")] },
    });
    const r = zoneReducer(state, {
      type: "BATCH_ADD_REGIONS",
      regions: [],
    } as WorldStudioAction);
    expect(r?.extendedLayers.regions).toHaveLength(1);
  });
});
