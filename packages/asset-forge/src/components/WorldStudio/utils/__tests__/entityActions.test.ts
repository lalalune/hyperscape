/**
 * `entityActions` — duplicate / delete / create-prefab execution tests.
 *
 * Three execution helpers wrap the editor command-history system to
 * provide uniform entity actions across shortcuts, context menus,
 * outliner, and viewport. `findEntityData` is covered separately
 * (findEntityData.test.ts); this file covers the three executors.
 *
 * Test surface:
 *   - executeDuplicate / executeDelete: built-in path (ENTITY_ACTIONS
 *     name lookup) vs registry-fallback path (dynamic entity types
 *     dispatched through ENTITY_ADD / ENTITY_REMOVE actions).
 *   - executeDuplicate: position is offset (+1, +0, +1) by the
 *     command itself, id is regenerated.
 *   - executeDelete: clears selection via actions.setSelection(null).
 *   - executeCreatePrefab: PREFAB_ENTITY_TYPES whitelist, centroid-
 *     relative offsets, structuredClone of entity data, returns null
 *     on empty input or no-valid-collected case.
 *
 * commandHistory is a module-scoped singleton; tests clear it in
 * beforeEach so prior runs don't leak state.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeCreatePrefab,
  executeDelete,
  executeDuplicate,
} from "../entityActions";
import { commandHistory } from "../../../../editor/commands";

beforeEach(() => {
  commandHistory.clear();
  // Silence console.warn calls executeCreatePrefab makes on validation failure.
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

// ----- fixtures -------------------------------------------------------------

function makeState(overrides: {
  extendedLayers?: Record<string, unknown[]>;
  audioLayers?: Record<string, unknown[]>;
  prefabs?: unknown[];
}) {
  return {
    extendedLayers: {
      spawnPoints: [],
      teleports: [],
      mobSpawns: [],
      resources: [],
      stations: [],
      pois: [],
      waterBodies: [],
      regions: [],
      dangerSources: [],
      customAssets: [],
      ...(overrides.extendedLayers ?? {}),
    },
    audioLayers: {
      musicZones: [],
      ambientZones: [],
      sfxTriggers: [],
      ...(overrides.audioLayers ?? {}),
    },
    prefabs: overrides.prefabs ?? [],
    builder: { editing: { world: null } },
  } as never;
}

function makeActions() {
  return {
    addSpawnPoint: vi.fn(),
    removeSpawnPoint: vi.fn(),
    addTeleport: vi.fn(),
    removeTeleport: vi.fn(),
    addMobSpawn: vi.fn(),
    removeMobSpawn: vi.fn(),
    addPrefab: vi.fn(),
    setSelection: vi.fn(),
  } as never;
}

function makeRegistry(
  selectionType: string,
  stateKey: string,
  stateRoot: "extendedLayers" | "audioLayers" = "extendedLayers",
) {
  return {
    getBySelectionType: (sel: string) =>
      sel === selectionType ? { storage: { stateKey, stateRoot } } : undefined,
  } as never;
}

// ============================================================================
// executeDuplicate
// ============================================================================

describe("executeDuplicate — built-in entity path", () => {
  it("invokes the entity's `add` action with cloned data (id replaced, position offset +1,+0,+1)", () => {
    const state = makeState({
      extendedLayers: {
        spawnPoints: [{ id: "sp1", position: { x: 10, y: 0, z: 20 } }],
      },
    });
    const actions = makeActions();

    const ok = executeDuplicate(state, actions, "spawnPoint", "sp1");

    expect(ok).toBe(true);
    expect(actions.addSpawnPoint).toHaveBeenCalledOnce();
    const placed = (actions.addSpawnPoint as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as {
      id: string;
      position: { x: number; y: number; z: number };
    };
    expect(placed.id).not.toBe("sp1");
    expect(placed.position).toEqual({ x: 11, y: 0, z: 21 });
  });

  it("returns false when the entity id is not found", () => {
    const state = makeState({
      extendedLayers: { spawnPoints: [{ id: "exists" }] },
    });
    const actions = makeActions();
    expect(executeDuplicate(state, actions, "spawnPoint", "missing")).toBe(
      false,
    );
    expect(actions.addSpawnPoint).not.toHaveBeenCalled();
  });

  it("returns false when the matching add/remove action is missing from the actions map", () => {
    const state = makeState({
      extendedLayers: {
        spawnPoints: [{ id: "sp1", position: { x: 0, y: 0, z: 0 } }],
      },
    });
    const actions = { setSelection: vi.fn() } as never; // no addSpawnPoint
    expect(executeDuplicate(state, actions, "spawnPoint", "sp1")).toBe(false);
  });

  it("pushes the command into commandHistory so it can be undone", () => {
    const state = makeState({
      extendedLayers: {
        spawnPoints: [{ id: "sp1", position: { x: 10, y: 0, z: 20 } }],
      },
    });
    const actions = makeActions();
    executeDuplicate(state, actions, "spawnPoint", "sp1");
    expect(commandHistory.canUndo()).toBe(true);

    commandHistory.undo();
    expect(actions.removeSpawnPoint).toHaveBeenCalledOnce();
  });
});

describe("executeDuplicate — registry-fallback path", () => {
  it("dispatches ENTITY_ADD when entity type is unknown but registry + dispatch are supplied", () => {
    const state = makeState({
      extendedLayers: {
        customDynamic: [{ id: "d1", position: { x: 5, y: 0, z: 5 } }],
      },
    });
    const actions = makeActions();
    const registry = makeRegistry("dynamic", "customDynamic");
    const dispatch = vi.fn();

    const ok = executeDuplicate(
      state,
      actions,
      "dynamic",
      "d1",
      registry,
      dispatch,
    );

    expect(ok).toBe(true);
    expect(dispatch).toHaveBeenCalledOnce();
    const action = dispatch.mock.calls[0][0];
    expect(action).toMatchObject({
      type: "ENTITY_ADD",
      stateKey: "customDynamic",
      stateRoot: "extendedLayers",
    });
    expect(action.entity.position).toEqual({ x: 6, y: 0, z: 6 });
  });

  it("returns false when registry has no schema for the selection type", () => {
    const state = makeState({});
    const registry = makeRegistry("known", "knownKey");
    const dispatch = vi.fn();
    const ok = executeDuplicate(
      state,
      makeActions(),
      "unknown",
      "x",
      registry,
      dispatch,
    );
    expect(ok).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("returns false when entity type is unknown AND no registry is supplied", () => {
    const state = makeState({});
    expect(executeDuplicate(state, makeActions(), "anything", "x")).toBe(false);
  });
});

// ============================================================================
// executeDelete
// ============================================================================

describe("executeDelete — built-in entity path", () => {
  it("calls the entity's `remove` action and clears selection on success", () => {
    const state = makeState({
      extendedLayers: { spawnPoints: [{ id: "sp1" }] },
    });
    const actions = makeActions();

    const ok = executeDelete(state, actions, "spawnPoint", "sp1");

    expect(ok).toBe(true);
    expect(actions.removeSpawnPoint).toHaveBeenCalledWith("sp1");
    expect(actions.setSelection).toHaveBeenCalledWith(null);
  });

  it("returns false (and does NOT clear selection) when entity is missing", () => {
    const state = makeState({
      extendedLayers: { spawnPoints: [] },
    });
    const actions = makeActions();
    expect(executeDelete(state, actions, "spawnPoint", "missing")).toBe(false);
    expect(actions.setSelection).not.toHaveBeenCalled();
  });

  it("restores via the entity's `add` action on undo", () => {
    const state = makeState({
      extendedLayers: { spawnPoints: [{ id: "sp1", custom: "data" }] },
    });
    const actions = makeActions();

    executeDelete(state, actions, "spawnPoint", "sp1");
    expect(actions.removeSpawnPoint).toHaveBeenCalledOnce();

    commandHistory.undo();
    expect(actions.addSpawnPoint).toHaveBeenCalledWith({
      id: "sp1",
      custom: "data",
    });
  });
});

describe("executeDelete — registry-fallback path", () => {
  it("dispatches ENTITY_REMOVE and clears selection for dynamic entities", () => {
    const state = makeState({
      extendedLayers: { customDynamic: [{ id: "d1" }] },
    });
    const actions = makeActions();
    const registry = makeRegistry("dynamic", "customDynamic");
    const dispatch = vi.fn();

    const ok = executeDelete(
      state,
      actions,
      "dynamic",
      "d1",
      registry,
      dispatch,
    );

    expect(ok).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({
      type: "ENTITY_REMOVE",
      stateKey: "customDynamic",
      stateRoot: "extendedLayers",
      id: "d1",
    });
    expect(actions.setSelection).toHaveBeenCalledWith(null);
  });

  it("returns false when registry/dispatch are missing for unknown type", () => {
    expect(executeDelete(makeState({}), makeActions(), "unknown", "x")).toBe(
      false,
    );
  });

  it("undo dispatches ENTITY_ADD with the original entity data", () => {
    const state = makeState({
      extendedLayers: {
        customDynamic: [{ id: "d1", payload: "abc" }],
      },
    });
    const dispatch = vi.fn();
    const registry = makeRegistry("dynamic", "customDynamic");

    executeDelete(state, makeActions(), "dynamic", "d1", registry, dispatch);

    commandHistory.undo();
    const restoreCall = dispatch.mock.calls[1][0]; // second dispatch is the undo
    expect(restoreCall).toMatchObject({
      type: "ENTITY_ADD",
      stateKey: "customDynamic",
    });
    expect(restoreCall.entity).toMatchObject({ id: "d1", payload: "abc" });
  });
});

// ============================================================================
// executeCreatePrefab
// ============================================================================

describe("executeCreatePrefab — input guards", () => {
  it("returns null on empty selection", () => {
    expect(executeCreatePrefab(makeState({}), makeActions(), [])).toBeNull();
  });

  it("returns null when no selection resolves to a valid entity", () => {
    const state = makeState({
      extendedLayers: { spawnPoints: [{ id: "exists" }] },
    });
    const result = executeCreatePrefab(state, makeActions(), [
      { type: "spawnPoint", id: "missing" },
    ]);
    expect(result).toBeNull();
  });

  it("skips entities of unsupported types (warns + continues)", () => {
    const warnSpy = vi.spyOn(console, "warn");
    const state = makeState({
      extendedLayers: { spawnPoints: [{ id: "sp1" }] },
    });
    const actions = makeActions();
    const result = executeCreatePrefab(state, actions, [
      { type: "prefab", id: "p1" }, // in ENTITY_ACTIONS but not in PREFAB whitelist
      { type: "spawnPoint", id: "sp1" },
    ]);
    expect(result).not.toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("returns null when all entities are unsupported types", () => {
    const state = makeState({ prefabs: [{ id: "p1" }] });
    expect(
      executeCreatePrefab(state, makeActions(), [{ type: "prefab", id: "p1" }]),
    ).toBeNull();
  });
});

describe("executeCreatePrefab — positions become centroid-relative", () => {
  it("centroid is the mean of valid positions; offsets are relative", () => {
    const state = makeState({
      extendedLayers: {
        spawnPoints: [
          { id: "a", position: { x: 0, y: 1, z: 0 } },
          { id: "b", position: { x: 10, y: 2, z: 0 } },
          { id: "c", position: { x: 5, y: 3, z: 10 } },
        ],
      },
    });
    const actions = makeActions();
    executeCreatePrefab(state, actions, [
      { type: "spawnPoint", id: "a" },
      { type: "spawnPoint", id: "b" },
      { type: "spawnPoint", id: "c" },
    ]);
    const prefab = (actions.addPrefab as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as {
      entries: Array<{ offset: { x: number; y: number; z: number } }>;
    };
    // Centroid: ((0+10+5)/3, _, (0+0+10)/3) = (5, _, 3.333…)
    expect(prefab.entries).toHaveLength(3);
    expect(prefab.entries[0].offset.x).toBeCloseTo(-5);
    expect(prefab.entries[1].offset.x).toBeCloseTo(5);
    expect(prefab.entries[2].offset.x).toBeCloseTo(0);
    expect(prefab.entries[0].offset.z).toBeCloseTo(-3.333, 2);
    // y is preserved as absolute (not centroid-adjusted)
    expect(prefab.entries[0].offset.y).toBe(1);
    expect(prefab.entries[1].offset.y).toBe(2);
    expect(prefab.entries[2].offset.y).toBe(3);
  });

  it("entities with invalid / missing positions get offset (0, 0, 0)", () => {
    const state = makeState({
      extendedLayers: {
        spawnPoints: [
          { id: "noPos" },
          { id: "infPos", position: { x: Infinity, y: 0, z: 0 } },
          { id: "badShape", position: { x: "wrong", z: 0 } },
        ],
      },
    });
    const actions = makeActions();
    executeCreatePrefab(state, actions, [
      { type: "spawnPoint", id: "noPos" },
      { type: "spawnPoint", id: "infPos" },
      { type: "spawnPoint", id: "badShape" },
    ]);
    const prefab = (actions.addPrefab as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as {
      entries: Array<{ offset: { x: number; y: number; z: number } }>;
    };
    for (const e of prefab.entries) {
      expect(e.offset.x).toBe(0);
      expect(e.offset.z).toBe(0);
    }
  });
});

describe("executeCreatePrefab — entry shape + return value", () => {
  it("returns the new prefab name and registers via actions.addPrefab", () => {
    const state = makeState({
      extendedLayers: {
        spawnPoints: [{ id: "sp1", position: { x: 0, y: 0, z: 0 } }],
      },
    });
    const actions = makeActions();
    const name = executeCreatePrefab(state, actions, [
      { type: "spawnPoint", id: "sp1" },
    ]);
    expect(name).toBe("Prefab (1 entities)");
    expect(actions.addPrefab).toHaveBeenCalledOnce();
  });

  it("entries inherit templateId/name from source data with fallback to id/type", () => {
    const state = makeState({
      extendedLayers: {
        spawnPoints: [
          {
            id: "sp1",
            position: { x: 0, y: 0, z: 0 },
            templateId: "tmpl_hero",
            name: "Hero Spawn",
          },
          { id: "sp2", position: { x: 1, y: 0, z: 1 } }, // no templateId/name
        ],
      },
    });
    const actions = makeActions();
    executeCreatePrefab(state, actions, [
      { type: "spawnPoint", id: "sp1" },
      { type: "spawnPoint", id: "sp2" },
    ]);
    const prefab = (actions.addPrefab as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as {
      entries: Array<{ templateId: string; name: string }>;
    };
    expect(prefab.entries[0].templateId).toBe("tmpl_hero");
    expect(prefab.entries[0].name).toBe("Hero Spawn");
    expect(prefab.entries[1].templateId).toBe("sp2");
    expect(prefab.entries[1].name).toBe("spawnPoint");
  });

  it("entry.data is a deep clone (mutating entry.data must not affect source state)", () => {
    const source = {
      id: "sp1",
      position: { x: 0, y: 0, z: 0 },
      nested: { count: 42 },
    };
    const state = makeState({ extendedLayers: { spawnPoints: [source] } });
    const actions = makeActions();
    executeCreatePrefab(state, actions, [{ type: "spawnPoint", id: "sp1" }]);
    const prefab = (actions.addPrefab as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as {
      entries: Array<{ data: { nested: { count: number } } }>;
    };
    prefab.entries[0].data.nested.count = 999;
    expect(source.nested.count).toBe(42);
  });

  it("emits a prefab with description listing entry names + a timestamp id", () => {
    const state = makeState({
      extendedLayers: {
        spawnPoints: [
          { id: "a", name: "Alpha", position: { x: 0, y: 0, z: 0 } },
          { id: "b", name: "Beta", position: { x: 1, y: 0, z: 1 } },
        ],
      },
    });
    const actions = makeActions();
    executeCreatePrefab(state, actions, [
      { type: "spawnPoint", id: "a" },
      { type: "spawnPoint", id: "b" },
    ]);
    const prefab = (actions.addPrefab as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as {
      id: string;
      description: string;
      createdAt: number;
    };
    expect(prefab.description).toBe("Alpha, Beta");
    expect(prefab.id).toMatch(/^prefab_\d+_[a-z0-9]+$/);
    expect(typeof prefab.createdAt).toBe("number");
  });
});
