/**
 * Unit tests for the UI/tool/viewport sub-reducer.
 *
 * Mirrors entityReducer + zoneReducer test patterns. uiReducer
 * is the largest of the three sub-reducers — it handles tool
 * switching with subtle auto-start/auto-stop zone-paint logic,
 * placement workflow, brush stroke management with per-type
 * undo/clear, viewport overlays, wizard preview, and the PIE
 * state machine. Worth direct tests because:
 *
 *   - SET_TOOL has implicit side effects (auto-stop zonePaint
 *     when leaving, auto-start when entering with a region)
 *   - SET_TILE_COLLISION upserts by (tileX, tileZ) — bug-prone
 *   - UNDO_LAST_BRUSH_STROKE / CLEAR_BRUSH_OVERLAYS branch on
 *     brushType — silent regressions on the per-kind path
 *     would only show up to the user mid-stroke
 *   - PIE_SET_MODE blocks while PIE is active/loading — that
 *     guard is a mid-session-safety invariant
 */

import { describe, expect, it } from "vitest";
import { uiReducer } from "../uiReducer";
import {
  DEFAULT_VIEWPORT_OVERLAYS,
  EMPTY_PIE_STATE,
  initialToolState,
} from "../../worldStudioTypes";
import type {
  WorldStudioAction,
  WorldStudioState,
} from "../../worldStudioTypes";
import { EMPTY_BRUSH_OVERLAYS } from "../../types";
import type { BrushOverlays, PlacedRegion } from "../../types";

function makeState(
  overrides?: Partial<{
    tools: Partial<typeof initialToolState>;
    regions: PlacedRegion[];
    selection: { type: string; id: string };
    brushOverlays: Partial<BrushOverlays>;
    pie: { active: boolean; loading: boolean; mode?: string };
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
      regions: overrides?.regions ?? [],
      dangerSources: [],
      wildernessBoundary: null,
      mines: [],
      customAssets: [],
    },
    tools: { ...initialToolState, ...overrides?.tools },
    builder: {
      editing: {
        selection: overrides?.selection ?? {
          type: "none",
          id: null,
          path: [],
        },
      },
    },
    brushOverlays: { ...EMPTY_BRUSH_OVERLAYS, ...overrides?.brushOverlays },
    overlays: DEFAULT_VIEWPORT_OVERLAYS,
    wizardPreview: null,
    pie: { ...EMPTY_PIE_STATE, ...overrides?.pie },
  } as unknown as WorldStudioState;
}

const sampleStroke = { id: "s1", points: [], strength: 1 };
const sampleRegion = (id: string): PlacedRegion =>
  ({
    id,
    name: id,
    tileKeys: [],
    color: 0xff0000,
    difficultyLevel: 1,
  }) as unknown as PlacedRegion;

describe("uiReducer — default fall-through", () => {
  it("returns null for unhandled action types", () => {
    expect(
      uiReducer(makeState(), {
        type: "UNRELATED",
      } as unknown as WorldStudioAction),
    ).toBeNull();
  });
});

describe("uiReducer — SET_TOOL with auto zone-paint logic", () => {
  it("switches active tool", () => {
    const r = uiReducer(makeState(), {
      type: "SET_TOOL",
      tool: "select",
    } as WorldStudioAction);
    expect(r?.tools.activeTool).toBe("select");
  });

  it("clears activePlacement when switching away from 'place'", () => {
    const state = makeState({
      tools: {
        activeTool: "place",
        activePlacement: {
          category: "npc",
          templateId: "shopkeeper",
          templateName: "Eldric",
          entityTypeId: "shopkeeper",
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,
          confirmed: false,
        } as never,
      },
    });
    const r = uiReducer(state, {
      type: "SET_TOOL",
      tool: "select",
    } as WorldStudioAction);
    expect(r?.tools.activePlacement).toBeNull();
  });

  it("preserves activePlacement when switching TO 'place'", () => {
    const placement = {
      category: "npc",
      templateId: "shopkeeper",
      templateName: "Eldric",
      entityTypeId: "shopkeeper",
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      confirmed: false,
    } as never;
    const state = makeState({
      tools: { activeTool: "select", activePlacement: placement },
    });
    const r = uiReducer(state, {
      type: "SET_TOOL",
      tool: "place",
    } as WorldStudioAction);
    expect(r?.tools.activePlacement).toBe(placement);
  });

  it("auto-stops zonePaint when switching AWAY from zonePaint tool", () => {
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
    const r = uiReducer(state, {
      type: "SET_TOOL",
      tool: "select",
    } as WorldStudioAction);
    expect(r?.tools.zonePaint).toBeNull();
  });

  it("auto-starts zonePaint with the SELECTED region when switching TO zonePaint", () => {
    const state = makeState({
      regions: [sampleRegion("a"), sampleRegion("b")],
      selection: { type: "region", id: "b" },
    });
    const r = uiReducer(state, {
      type: "SET_TOOL",
      tool: "zonePaint",
    } as WorldStudioAction);
    expect(r?.tools.zonePaint?.regionId).toBe("b");
    expect(r?.tools.zonePaint?.brushSize).toBe(1);
    expect(r?.tools.zonePaint?.mode).toBe("paint");
  });

  it("auto-starts zonePaint with the FIRST region when no region is selected", () => {
    const state = makeState({
      regions: [sampleRegion("first"), sampleRegion("second")],
    });
    const r = uiReducer(state, {
      type: "SET_TOOL",
      tool: "zonePaint",
    } as WorldStudioAction);
    expect(r?.tools.zonePaint?.regionId).toBe("first");
  });

  it("does NOT start zonePaint when no regions exist", () => {
    const r = uiReducer(makeState(), {
      type: "SET_TOOL",
      tool: "zonePaint",
    } as WorldStudioAction);
    expect(r?.tools.zonePaint).toBeNull();
  });
});

describe("uiReducer — small tool fields", () => {
  it("SET_TRANSFORM_MODE updates the mode", () => {
    const r = uiReducer(makeState(), {
      type: "SET_TRANSFORM_MODE",
      mode: "rotate",
    } as WorldStudioAction);
    expect(r?.tools.transformMode).toBe("rotate");
  });

  it("SET_TRANSFORM_SPACE updates the space", () => {
    const r = uiReducer(makeState(), {
      type: "SET_TRANSFORM_SPACE",
      space: "local",
    } as WorldStudioAction);
    expect(r?.tools.transformSpace).toBe("local");
  });

  it("SET_GRID_SIZE updates grid", () => {
    const r = uiReducer(makeState(), {
      type: "SET_GRID_SIZE",
      size: 0.5,
    } as WorldStudioAction);
    expect(r?.tools.gridSize).toBe(0.5);
  });

  it("SET_ADDING_WATER_VERTICES toggles the flag", () => {
    const r = uiReducer(makeState(), {
      type: "SET_ADDING_WATER_VERTICES",
      enabled: true,
    } as WorldStudioAction);
    expect(r?.tools.isAddingWaterVertices).toBe(true);
  });

  it("CAMERA_TELEPORT sets the teleport target", () => {
    const target = { x: 1, y: 2, z: 3 };
    const r = uiReducer(makeState(), {
      type: "CAMERA_TELEPORT",
      target,
    } as WorldStudioAction);
    expect(r?.tools.cameraTeleportTarget).toEqual(target);
  });

  it("CAMERA_TELEPORT_CONSUMED clears the target", () => {
    const state = makeState({
      tools: { cameraTeleportTarget: { x: 1, y: 2, z: 3 } },
    });
    const r = uiReducer(state, {
      type: "CAMERA_TELEPORT_CONSUMED",
    } as WorldStudioAction);
    expect(r?.tools.cameraTeleportTarget).toBeNull();
  });
});

describe("uiReducer — placement workflow", () => {
  it("START_PLACEMENT sets activeTool=place and activePlacement", () => {
    const r = uiReducer(makeState(), {
      type: "START_PLACEMENT",
      category: "npc",
      templateId: "shopkeeper",
      templateName: "Eldric",
      entityTypeId: "shopkeeper",
    } as WorldStudioAction);
    expect(r?.tools.activeTool).toBe("place");
    expect(r?.tools.activePlacement?.templateId).toBe("shopkeeper");
    expect(r?.tools.activePlacement?.confirmed).toBe(false);
    expect(r?.tools.activePlacement?.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("UPDATE_PLACEMENT_POSITION is a no-op when no placement is active", () => {
    const state = makeState();
    const r = uiReducer(state, {
      type: "UPDATE_PLACEMENT_POSITION",
      position: { x: 5, y: 0, z: 5 },
    } as WorldStudioAction);
    expect(r).toBe(state);
  });

  it("UPDATE_PLACEMENT_POSITION moves the placement and preserves rotation", () => {
    const state = makeState({
      tools: {
        activePlacement: {
          category: "npc",
          templateId: "x",
          templateName: "x",
          entityTypeId: "x",
          position: { x: 0, y: 0, z: 0 },
          rotation: 1.57,
          confirmed: false,
        } as never,
      },
    });
    const r = uiReducer(state, {
      type: "UPDATE_PLACEMENT_POSITION",
      position: { x: 5, y: 0, z: 5 },
    } as WorldStudioAction);
    expect(r?.tools.activePlacement?.position).toEqual({ x: 5, y: 0, z: 5 });
    expect(r?.tools.activePlacement?.rotation).toBe(1.57);
  });

  it("UPDATE_PLACEMENT_POSITION accepts an explicit rotation", () => {
    const state = makeState({
      tools: {
        activePlacement: {
          category: "npc",
          templateId: "x",
          templateName: "x",
          entityTypeId: "x",
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,
          confirmed: false,
        } as never,
      },
    });
    const r = uiReducer(state, {
      type: "UPDATE_PLACEMENT_POSITION",
      position: { x: 1, y: 0, z: 1 },
      rotation: 3.14,
    } as WorldStudioAction);
    expect(r?.tools.activePlacement?.rotation).toBe(3.14);
  });

  it("CONFIRM_PLACEMENT marks the active placement confirmed", () => {
    const state = makeState({
      tools: {
        activePlacement: {
          category: "npc",
          templateId: "x",
          templateName: "x",
          entityTypeId: "x",
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,
          confirmed: false,
        } as never,
      },
    });
    const r = uiReducer(state, {
      type: "CONFIRM_PLACEMENT",
    } as WorldStudioAction);
    expect(r?.tools.activePlacement?.confirmed).toBe(true);
  });

  it("CANCEL_PLACEMENT clears placement and switches to select", () => {
    const state = makeState({
      tools: {
        activeTool: "place",
        activePlacement: {
          category: "npc",
          templateId: "x",
          templateName: "x",
          entityTypeId: "x",
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,
          confirmed: false,
        } as never,
      },
    });
    const r = uiReducer(state, {
      type: "CANCEL_PLACEMENT",
    } as WorldStudioAction);
    expect(r?.tools.activePlacement).toBeNull();
    expect(r?.tools.activeTool).toBe("select");
  });
});

describe("uiReducer — brush strokes (per-kind ADD)", () => {
  it.each([
    {
      action: "ADD_TERRAIN_SCULPT",
      field: "terrainSculpts" as keyof BrushOverlays,
    },
    { action: "ADD_BIOME_PAINT", field: "biomePaints" as keyof BrushOverlays },
    {
      action: "ADD_VEGETATION_PAINT",
      field: "vegetationPaints" as keyof BrushOverlays,
    },
    {
      action: "ADD_MATERIAL_PAINT",
      field: "materialPaints" as keyof BrushOverlays,
    },
    {
      action: "ADD_FOLIAGE_PAINT",
      field: "foliagePaints" as keyof BrushOverlays,
    },
  ])("$action appends to brushOverlays.$field", ({ action, field }) => {
    const state = makeState();
    const r = uiReducer(state, {
      type: action,
      stroke: sampleStroke,
    } as unknown as WorldStudioAction);
    const arr = r?.brushOverlays[field] as ReadonlyArray<unknown>;
    expect(arr).toHaveLength(1);
  });
});

describe("uiReducer — SET_TILE_COLLISION upsert", () => {
  it("inserts new tiles", () => {
    const r = uiReducer(makeState(), {
      type: "SET_TILE_COLLISION",
      tiles: [{ tileX: 0, tileZ: 0, blocked: true }],
    } as WorldStudioAction);
    expect(r?.brushOverlays.tileCollisions).toHaveLength(1);
    expect(r?.brushOverlays.tileCollisions[0]).toMatchObject({
      tileX: 0,
      tileZ: 0,
      blocked: true,
    });
  });

  it("updates an existing tile when (tileX, tileZ) already present", () => {
    const state = makeState({
      brushOverlays: {
        tileCollisions: [{ tileX: 0, tileZ: 0, blocked: true } as never],
      },
    });
    const r = uiReducer(state, {
      type: "SET_TILE_COLLISION",
      tiles: [{ tileX: 0, tileZ: 0, blocked: false }],
    } as WorldStudioAction);
    expect(r?.brushOverlays.tileCollisions).toHaveLength(1);
    expect(r?.brushOverlays.tileCollisions[0]?.blocked).toBe(false);
  });

  it("inserts and updates in a single batch", () => {
    const state = makeState({
      brushOverlays: {
        tileCollisions: [{ tileX: 0, tileZ: 0, blocked: true } as never],
      },
    });
    const r = uiReducer(state, {
      type: "SET_TILE_COLLISION",
      tiles: [
        { tileX: 0, tileZ: 0, blocked: false }, // update
        { tileX: 1, tileZ: 1, blocked: true }, // insert
      ],
    } as WorldStudioAction);
    expect(r?.brushOverlays.tileCollisions).toHaveLength(2);
  });
});

describe("uiReducer — UNDO_LAST_BRUSH_STROKE", () => {
  it.each([
    { brushType: "terrain", field: "terrainSculpts" },
    { brushType: "biome", field: "biomePaints" },
    { brushType: "vegetation", field: "vegetationPaints" },
    { brushType: "material", field: "materialPaints" },
    { brushType: "foliage", field: "foliagePaints" },
    { brushType: "collision", field: "tileCollisions" },
  ] as const)(
    "drops the last entry for $brushType (slice -1)",
    ({ brushType, field }) => {
      const state = makeState({
        brushOverlays: {
          [field]: [{ id: "first" } as never, { id: "second" } as never],
        } as Partial<BrushOverlays>,
      });
      const r = uiReducer(state, {
        type: "UNDO_LAST_BRUSH_STROKE",
        brushType,
      } as WorldStudioAction);
      const arr = r?.brushOverlays[
        field as keyof BrushOverlays
      ] as ReadonlyArray<{ id: string }>;
      expect(arr).toHaveLength(1);
      expect(arr[0]?.id).toBe("first");
    },
  );
});

describe("uiReducer — CLEAR_BRUSH_OVERLAYS", () => {
  it("with brushType clears only that brush kind", () => {
    const state = makeState({
      brushOverlays: {
        terrainSculpts: [{ id: "t" } as never],
        biomePaints: [{ id: "b" } as never],
      },
    });
    const r = uiReducer(state, {
      type: "CLEAR_BRUSH_OVERLAYS",
      brushType: "terrain",
    } as WorldStudioAction);
    expect(r?.brushOverlays.terrainSculpts).toEqual([]);
    expect(r?.brushOverlays.biomePaints).toHaveLength(1); // untouched
  });

  it("without brushType resets ALL brush overlays to EMPTY", () => {
    const state = makeState({
      brushOverlays: {
        terrainSculpts: [{ id: "t" } as never],
        biomePaints: [{ id: "b" } as never],
        foliagePaints: [{ id: "f" } as never],
      },
    });
    const r = uiReducer(state, {
      type: "CLEAR_BRUSH_OVERLAYS",
    } as WorldStudioAction);
    expect(r?.brushOverlays).toEqual(EMPTY_BRUSH_OVERLAYS);
  });
});

describe("uiReducer — viewport overlays + wizard preview", () => {
  it("SET_OVERLAY merges into existing overlays", () => {
    const r = uiReducer(makeState(), {
      type: "SET_OVERLAY",
      overlay: { biomeOverlay: true },
    } as WorldStudioAction);
    expect(r?.overlays.biomeOverlay).toBe(true);
  });

  it("SET_WIZARD_PREVIEW sets the preview", () => {
    const preview = { kind: "test" } as never;
    const r = uiReducer(makeState(), {
      type: "SET_WIZARD_PREVIEW",
      preview,
    } as WorldStudioAction);
    expect(r?.wizardPreview).toBe(preview);
  });

  it("CLEAR_WIZARD_PREVIEW nulls it", () => {
    const state = makeState();
    state.wizardPreview = { kind: "x" } as never;
    const r = uiReducer(state, {
      type: "CLEAR_WIZARD_PREVIEW",
    } as WorldStudioAction);
    expect(r?.wizardPreview).toBeNull();
  });
});

describe("uiReducer — PIE state machine", () => {
  it("PIE_START sets loading=true, active=false, error=null", () => {
    const r = uiReducer(makeState(), {
      type: "PIE_START",
    } as WorldStudioAction);
    expect(r?.pie.loading).toBe(true);
    expect(r?.pie.active).toBe(false);
    expect(r?.pie.error).toBeNull();
  });

  it("PIE_STARTED transitions to active=true, loading=false", () => {
    const r = uiReducer(makeState(), {
      type: "PIE_STARTED",
    } as WorldStudioAction);
    expect(r?.pie.active).toBe(true);
    expect(r?.pie.loading).toBe(false);
  });

  it("PIE_STOP transitions back to active=false, loading=false", () => {
    const r = uiReducer(makeState({ pie: { active: true, loading: false } }), {
      type: "PIE_STOP",
    } as WorldStudioAction);
    expect(r?.pie.active).toBe(false);
  });

  it("PIE_ERROR captures the error and clears loading/active", () => {
    const r = uiReducer(makeState(), {
      type: "PIE_ERROR",
      error: "boom",
    } as WorldStudioAction);
    expect(r?.pie.error).toBe("boom");
    expect(r?.pie.active).toBe(false);
    expect(r?.pie.loading).toBe(false);
  });

  it("PIE_SET_MODE allowed while idle", () => {
    const r = uiReducer(makeState(), {
      type: "PIE_SET_MODE",
      mode: "play",
    } as WorldStudioAction);
    expect(r?.pie.mode).toBe("play");
  });

  it("PIE_SET_MODE BLOCKED while active (mid-session-safety)", () => {
    const state = makeState({ pie: { active: true, loading: false } });
    const r = uiReducer(state, {
      type: "PIE_SET_MODE",
      mode: "play",
    } as WorldStudioAction);
    expect(r).toBe(state); // unchanged
  });

  it("PIE_SET_MODE BLOCKED while loading", () => {
    const state = makeState({ pie: { active: false, loading: true } });
    const r = uiReducer(state, {
      type: "PIE_SET_MODE",
      mode: "play",
    } as WorldStudioAction);
    expect(r).toBe(state);
  });
});
