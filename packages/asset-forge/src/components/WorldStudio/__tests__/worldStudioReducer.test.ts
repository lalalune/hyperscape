/**
 * Top-level `worldStudioReducer` orchestrator tests.
 *
 * The reducer composes 5 sub-reducers in this order:
 *   1. entityReducer   (returns null for non-entity actions)
 *   2. zoneReducer     (returns null for non-zone actions)
 *   3. uiReducer       (returns null for non-ui actions)
 *   4. studioReducer   (project / save / load / town / road / manifest)
 *   5. worldBuilderReducer (delegated for any action it understands)
 *
 * Each step short-circuits on the first non-null result. The
 * dispatch order is the architectural invariant — coverage
 * here makes sure (a) entity/zone/ui actions are routed
 * correctly to their sub-reducers, (b) project/persistence
 * actions land in the studio branch, and (c) unknown actions
 * fall through to the worldBuilder reducer (which is a no-op
 * for non-WB actions).
 *
 * Tests cover the orchestrator + a sampling of the most
 * critical studio-specific persistence actions
 * (SET_PROJECT / CLEAR_PROJECT / SAVE_* / LOAD_* / SET_AUTO_SAVE).
 * The 800+ lines of town/road/manifest mutations in studioReducer
 * are out of scope here — they'd need their own focused test file.
 */

import { describe, expect, it } from "vitest";
import { worldStudioReducer } from "../worldStudioReducer";
import {
  initialPersistenceState,
  initialProjectState,
  initialToolState,
  EMPTY_PIE_STATE,
  DEFAULT_VIEWPORT_OVERLAYS,
} from "../worldStudioTypes";
import type { WorldStudioAction, WorldStudioState } from "../worldStudioTypes";
import { EMPTY_BRUSH_OVERLAYS } from "../types";
import { worldBuilderInitialState } from "../../WorldBuilder/WorldBuilderContext";

function makeState(): WorldStudioState {
  return {
    project: initialProjectState,
    persistence: initialPersistenceState,
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
    },
    tools: initialToolState,
    builder: worldBuilderInitialState,
    brushOverlays: EMPTY_BRUSH_OVERLAYS,
    overlays: DEFAULT_VIEWPORT_OVERLAYS,
    wizardPreview: null,
    pie: EMPTY_PIE_STATE,
  } as unknown as WorldStudioState;
}

describe("worldStudioReducer — dispatch order", () => {
  it("entity actions are routed to entityReducer (NPC ADD)", () => {
    const npc = {
      id: "guard1",
      npcTypeId: "guard",
      name: "Guard",
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      parentContext: { type: "world" },
      dialogueKey: "",
      properties: {},
    };
    const r = worldStudioReducer(makeState(), {
      type: "ADD_NPC",
      npc,
    } as unknown as WorldStudioAction);
    expect(r.extendedLayers.npcs).toHaveLength(1);
    expect(r.extendedLayers.npcs[0]?.id).toBe("guard1");
  });

  it("zone actions are routed to zoneReducer (ADD_REGION)", () => {
    const region = {
      id: "north",
      name: "North",
      tileKeys: [],
      color: 0xff0000,
      difficultyLevel: 1,
    };
    const r = worldStudioReducer(makeState(), {
      type: "ADD_REGION",
      region,
    } as unknown as WorldStudioAction);
    expect(r.extendedLayers.regions).toHaveLength(1);
  });

  it("ui actions are routed to uiReducer (SET_TOOL)", () => {
    const r = worldStudioReducer(makeState(), {
      type: "SET_TOOL",
      tool: "select",
    } as unknown as WorldStudioAction);
    expect(r.tools.activeTool).toBe("select");
  });

  it("unknown action types return state unchanged (worldBuilder no-op)", () => {
    const state = makeState();
    const r = worldStudioReducer(state, {
      type: "TOTALLY_UNKNOWN_ACTION",
    } as unknown as WorldStudioAction);
    // Returns the same reference when nothing matched.
    expect(r).toBe(state);
  });
});

describe("worldStudioReducer — studio project actions", () => {
  it("SET_PROJECT writes ids/name/version + clears prior auto state", () => {
    const r = worldStudioReducer(makeState(), {
      type: "SET_PROJECT",
      teamId: "team-1",
      gameId: "game-1",
      projectId: "proj-1",
      name: "My Project",
      version: 7,
      gameMode: "hyperia",
      templateId: "blank",
      plugins: ["@hyperforge/hyperscape"],
      assetPacks: ["@hyperforge/asset-pack-hyperia-v1"],
    } as unknown as WorldStudioAction);
    expect(r.project.currentTeamId).toBe("team-1");
    expect(r.project.currentGameId).toBe("game-1");
    expect(r.project.currentProjectId).toBe("proj-1");
    expect(r.project.projectName).toBe("My Project");
    expect(r.project.projectVersion).toBe(7);
    expect(r.project.plugins).toEqual(["@hyperforge/hyperscape"]);
    expect(r.project.assetPacks).toEqual(["@hyperforge/asset-pack-hyperia-v1"]);
  });

  it("CLEAR_PROJECT resets project AND persistence to initial states", () => {
    const state = makeState();
    // Mutate to verify reset
    state.project = {
      ...initialProjectState,
      currentProjectId: "proj-1",
      projectName: "X",
    };
    state.persistence = {
      ...initialPersistenceState,
      lastSavedAt: Date.now(),
      saveError: "stale",
    };
    const r = worldStudioReducer(state, {
      type: "CLEAR_PROJECT",
    } as unknown as WorldStudioAction);
    expect(r.project).toEqual(initialProjectState);
    expect(r.persistence).toEqual(initialPersistenceState);
  });

  it("SET_PROJECT_LOCK writes lockedBy", () => {
    const r = worldStudioReducer(makeState(), {
      type: "SET_PROJECT_LOCK",
      lockedBy: "alice",
    } as unknown as WorldStudioAction);
    expect(r.project.lockedBy).toBe("alice");
  });

  it("UPDATE_PROJECT_VERSION writes version", () => {
    const r = worldStudioReducer(makeState(), {
      type: "UPDATE_PROJECT_VERSION",
      version: 99,
    } as unknown as WorldStudioAction);
    expect(r.project.projectVersion).toBe(99);
  });

  it("SET_GAME_MODE writes gameMode", () => {
    const r = worldStudioReducer(makeState(), {
      type: "SET_GAME_MODE",
      gameMode: "blank",
    } as unknown as WorldStudioAction);
    expect(r.project.gameMode).toBe("blank");
  });
});

describe("worldStudioReducer — persistence (save) flow", () => {
  it("SAVE_START flips isSaving=true and clears prior saveError", () => {
    const state = makeState();
    state.persistence = { ...state.persistence, saveError: "stale" };
    const r = worldStudioReducer(state, {
      type: "SAVE_START",
    } as unknown as WorldStudioAction);
    expect(r.persistence.isSaving).toBe(true);
    expect(r.persistence.saveError).toBeNull();
  });

  it("SAVE_SUCCESS writes version + lastSavedAt + clears unsaved-changes flag", () => {
    const savedAt = 1234567890;
    const r = worldStudioReducer(makeState(), {
      type: "SAVE_SUCCESS",
      version: 5,
      savedAt,
    } as unknown as WorldStudioAction);
    expect(r.persistence.isSaving).toBe(false);
    expect(r.persistence.lastSavedAt).toBe(savedAt);
    expect(r.persistence.saveError).toBeNull();
    expect(r.project.projectVersion).toBe(5);
    expect(r.builder.editing.hasUnsavedChanges).toBe(false);
  });

  it("SAVE_ERROR sets saveError + clears isSaving", () => {
    const state = makeState();
    state.persistence = { ...state.persistence, isSaving: true };
    const r = worldStudioReducer(state, {
      type: "SAVE_ERROR",
      error: "out of disk",
    } as unknown as WorldStudioAction);
    expect(r.persistence.isSaving).toBe(false);
    expect(r.persistence.saveError).toBe("out of disk");
  });
});

describe("worldStudioReducer — persistence (load) flow", () => {
  it("LOAD_START flips isLoading=true + clears loadError", () => {
    const state = makeState();
    state.persistence = { ...state.persistence, loadError: "stale" };
    const r = worldStudioReducer(state, {
      type: "LOAD_START",
    } as unknown as WorldStudioAction);
    expect(r.persistence.isLoading).toBe(true);
    expect(r.persistence.loadError).toBeNull();
  });

  it("LOAD_SUCCESS clears isLoading + loadError", () => {
    const state = makeState();
    state.persistence = {
      ...state.persistence,
      isLoading: true,
      loadError: "x",
    };
    const r = worldStudioReducer(state, {
      type: "LOAD_SUCCESS",
    } as unknown as WorldStudioAction);
    expect(r.persistence.isLoading).toBe(false);
    expect(r.persistence.loadError).toBeNull();
  });

  it("LOAD_ERROR sets loadError + clears isLoading", () => {
    const state = makeState();
    state.persistence = { ...state.persistence, isLoading: true };
    const r = worldStudioReducer(state, {
      type: "LOAD_ERROR",
      error: "404",
    } as unknown as WorldStudioAction);
    expect(r.persistence.isLoading).toBe(false);
    expect(r.persistence.loadError).toBe("404");
  });
});

describe("worldStudioReducer — auto-save toggle", () => {
  it("SET_AUTO_SAVE writes the flag", () => {
    const r = worldStudioReducer(makeState(), {
      type: "SET_AUTO_SAVE",
      enabled: false,
    } as unknown as WorldStudioAction);
    expect(r.persistence.autoSaveEnabled).toBe(false);
  });

  it("SET_AUTO_SAVE flips back to true", () => {
    const state = makeState();
    state.persistence = { ...state.persistence, autoSaveEnabled: false };
    const r = worldStudioReducer(state, {
      type: "SET_AUTO_SAVE",
      enabled: true,
    } as unknown as WorldStudioAction);
    expect(r.persistence.autoSaveEnabled).toBe(true);
  });
});
