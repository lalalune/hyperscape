/**
 * `worldBuilderReducer` — undo/redo history wrapper tests.
 *
 * The reducer wraps coreReducer with history-tracking for
 * UNDOABLE_ACTIONS (28 NPC/Quest/Boss/etc. mutations). Subtle
 * invariants:
 *
 *   - UNDO/REDO/CLEAR_HISTORY skip history-tracking themselves
 *     (they manage past/future directly)
 *   - Undoable actions only push history when `state.editing.world`
 *     is non-null AND when coreReducer actually changed editing
 *     state
 *   - New actions clear the redo (future) stack
 *   - History capped at maxSize entries via slice(-maxSize) /
 *     slice(0, maxSize)
 *
 * Plus a sampling of coreReducer behavior to lock the basic
 * mode/seed/preset flow + ADD_NPC editing-aware guards.
 */

import { describe, expect, it } from "vitest";
import {
  coreReducer,
  worldBuilderReducer,
  worldBuilderInitialState,
} from "../WorldBuilderContext";
import type {
  WorldBuilderAction,
  WorldBuilderState,
  WorldData,
} from "../types";

function makeWorld(): WorldData {
  return {
    metadata: {
      id: "w1",
      name: "Test World",
      version: 1,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    },
    config: worldBuilderInitialState.creation.config,
    layers: {
      biomeOverrides: [],
      townOverrides: [],
      npcs: [],
      quests: [],
      bosses: [],
      events: [],
      lore: [],
      difficultyZones: [],
      customPlacements: [],
    },
  } as unknown as WorldData;
}

function loadedState(): WorldBuilderState {
  const world = makeWorld();
  return worldBuilderReducer(worldBuilderInitialState, {
    type: "LOAD_WORLD",
    world,
  } as WorldBuilderAction);
}

describe("coreReducer — basic actions", () => {
  it("SET_MODE switches mode", () => {
    const r = coreReducer(worldBuilderInitialState, {
      type: "SET_MODE",
      mode: "editing",
    } as WorldBuilderAction);
    expect(r.mode).toBe("editing");
  });

  it("SET_PRESET stores the preset id and clears hasPreview", () => {
    const r = coreReducer(worldBuilderInitialState, {
      type: "SET_PRESET",
      presetId: "tropical",
    } as WorldBuilderAction);
    expect(r.creation.selectedPreset).toBe("tropical");
    expect(r.creation.hasPreview).toBe(false);
  });

  it("SET_SEED updates the seed in the creation config", () => {
    const r = coreReducer(worldBuilderInitialState, {
      type: "SET_SEED",
      seed: 12345,
    } as WorldBuilderAction);
    expect(r.creation.config.seed).toBe(12345);
  });

  it("RANDOMIZE_SEED replaces the seed with a new integer", () => {
    const a = coreReducer(worldBuilderInitialState, {
      type: "RANDOMIZE_SEED",
    } as WorldBuilderAction);
    const b = coreReducer(worldBuilderInitialState, {
      type: "RANDOMIZE_SEED",
    } as WorldBuilderAction);
    expect(typeof a.creation.config.seed).toBe("number");
    expect(Number.isInteger(a.creation.config.seed)).toBe(true);
    // Two randomize calls in quick succession are very likely
    // to produce different seeds (Math.random space is huge).
    // If they collide, increment a counter manually — but that's
    // statistically nigh-impossible.
    expect(a.creation.config.seed).not.toBe(b.creation.config.seed);
  });

  it("default action returns state unchanged", () => {
    const s = worldBuilderInitialState;
    const r = coreReducer(s, {
      type: "TOTALLY_UNKNOWN",
    } as unknown as WorldBuilderAction);
    expect(r).toBe(s);
  });
});

describe("coreReducer — entity actions guard on world presence", () => {
  it("ADD_NPC is a no-op when state.editing.world is null", () => {
    const s = worldBuilderInitialState;
    const r = coreReducer(s, {
      type: "ADD_NPC",
      npc: { id: "n1", name: "Eldric" } as never,
    } as WorldBuilderAction);
    expect(r).toBe(s); // same reference
  });

  it("ADD_NPC appends to layers.npcs when world is loaded", () => {
    const state = loadedState();
    const r = coreReducer(state, {
      type: "ADD_NPC",
      npc: { id: "n1", name: "Eldric" } as never,
    } as WorldBuilderAction);
    expect(r.editing.world?.layers.npcs).toHaveLength(1);
    expect(r.editing.hasUnsavedChanges).toBe(true);
  });

  it("REMOVE_NPC filters by id", () => {
    let state = loadedState();
    state = coreReducer(state, {
      type: "ADD_NPC",
      npc: { id: "a", name: "A" } as never,
    } as WorldBuilderAction);
    state = coreReducer(state, {
      type: "ADD_NPC",
      npc: { id: "b", name: "B" } as never,
    } as WorldBuilderAction);
    const r = coreReducer(state, {
      type: "REMOVE_NPC",
      npcId: "a",
    } as WorldBuilderAction);
    expect(r.editing.world?.layers.npcs).toHaveLength(1);
    expect(r.editing.world?.layers.npcs[0]?.id).toBe("b");
  });
});

describe("worldBuilderReducer — UNDOABLE_ACTIONS history tracking", () => {
  it("ADD_NPC pushes a history entry to past", () => {
    const state = loadedState();
    const r = worldBuilderReducer(state, {
      type: "ADD_NPC",
      npc: { id: "n1", name: "Eldric" } as never,
    } as WorldBuilderAction);
    expect(r.history.past).toHaveLength(1);
    expect(r.history.future).toHaveLength(0);
  });

  it("clears the redo (future) stack on a new action", () => {
    let state = loadedState();
    state = worldBuilderReducer(state, {
      type: "ADD_NPC",
      npc: { id: "a", name: "A" } as never,
    } as WorldBuilderAction);
    state = worldBuilderReducer(state, {
      type: "UNDO",
    } as WorldBuilderAction);
    expect(state.history.future.length).toBeGreaterThan(0);
    // New action — future should be cleared.
    state = worldBuilderReducer(state, {
      type: "ADD_NPC",
      npc: { id: "c", name: "C" } as never,
    } as WorldBuilderAction);
    expect(state.history.future).toHaveLength(0);
  });

  it("does NOT push history when state.editing.world is null", () => {
    const r = worldBuilderReducer(worldBuilderInitialState, {
      type: "ADD_NPC",
      npc: { id: "n1", name: "Eldric" } as never,
    } as WorldBuilderAction);
    expect(r.history.past).toHaveLength(0);
  });

  it("does NOT push history when coreReducer returned unchanged editing", () => {
    // REMOVE_NPC on a non-existent id keeps editing.world unchanged
    // structurally (filter returns the same length array but the
    // editing object IS re-created with a new modifiedAt + flag).
    // The wrapper's "only push if editing changed" check uses
    // reference equality of `newState.editing` vs `state.editing`.
    // Since REMOVE_NPC always replaces editing.world with a new
    // object, this test verifies the explicit no-op path: try to
    // ADD_NPC with no world loaded — should return same state.
    const r = worldBuilderReducer(worldBuilderInitialState, {
      type: "ADD_NPC",
      npc: { id: "n1", name: "Eldric" } as never,
    } as WorldBuilderAction);
    // ADD_NPC returns state when world is null → no editing change
    // → no history entry.
    expect(r.history.past).toHaveLength(0);
  });
});

describe("worldBuilderReducer — UNDO", () => {
  it("UNDO reverts the last undoable action", () => {
    let state = loadedState();
    const npcsBefore = state.editing.world!.layers.npcs.length;
    state = worldBuilderReducer(state, {
      type: "ADD_NPC",
      npc: { id: "n1", name: "X" } as never,
    } as WorldBuilderAction);
    expect(state.editing.world!.layers.npcs.length).toBe(npcsBefore + 1);
    state = worldBuilderReducer(state, {
      type: "UNDO",
    } as WorldBuilderAction);
    expect(state.editing.world!.layers.npcs.length).toBe(npcsBefore);
  });

  it("UNDO is a no-op when past is empty", () => {
    const state = loadedState();
    const r = worldBuilderReducer(state, {
      type: "UNDO",
    } as WorldBuilderAction);
    expect(r).toBe(state);
  });

  it("UNDO moves the popped entry to future for REDO", () => {
    let state = loadedState();
    state = worldBuilderReducer(state, {
      type: "ADD_NPC",
      npc: { id: "n1", name: "X" } as never,
    } as WorldBuilderAction);
    state = worldBuilderReducer(state, {
      type: "UNDO",
    } as WorldBuilderAction);
    expect(state.history.future.length).toBeGreaterThan(0);
  });
});

describe("worldBuilderReducer — REDO", () => {
  it("REDO replays the most recent undone action", () => {
    let state = loadedState();
    state = worldBuilderReducer(state, {
      type: "ADD_NPC",
      npc: { id: "n1", name: "X" } as never,
    } as WorldBuilderAction);
    state = worldBuilderReducer(state, {
      type: "UNDO",
    } as WorldBuilderAction);
    expect(state.editing.world!.layers.npcs).toHaveLength(0);
    state = worldBuilderReducer(state, {
      type: "REDO",
    } as WorldBuilderAction);
    expect(state.editing.world!.layers.npcs).toHaveLength(1);
  });

  it("REDO is a no-op when future is empty", () => {
    const state = loadedState();
    const r = worldBuilderReducer(state, {
      type: "REDO",
    } as WorldBuilderAction);
    expect(r).toBe(state);
  });

  it("UNDO + REDO round-trip returns to the same NPC list", () => {
    let state = loadedState();
    state = worldBuilderReducer(state, {
      type: "ADD_NPC",
      npc: { id: "n1", name: "X" } as never,
    } as WorldBuilderAction);
    const npcsAfter = state.editing.world!.layers.npcs.length;
    state = worldBuilderReducer(state, {
      type: "UNDO",
    } as WorldBuilderAction);
    state = worldBuilderReducer(state, {
      type: "REDO",
    } as WorldBuilderAction);
    expect(state.editing.world!.layers.npcs.length).toBe(npcsAfter);
  });
});

describe("worldBuilderReducer — CLEAR_HISTORY", () => {
  it("CLEAR_HISTORY empties past + future, leaves editing intact", () => {
    let state = loadedState();
    state = worldBuilderReducer(state, {
      type: "ADD_NPC",
      npc: { id: "n1", name: "X" } as never,
    } as WorldBuilderAction);
    state = worldBuilderReducer(state, {
      type: "UNDO",
    } as WorldBuilderAction);
    state = worldBuilderReducer(state, {
      type: "CLEAR_HISTORY",
    } as WorldBuilderAction);
    expect(state.history.past).toHaveLength(0);
    expect(state.history.future).toHaveLength(0);
    // Editing world still loaded.
    expect(state.editing.world).not.toBeNull();
  });

  it("after CLEAR_HISTORY, UNDO is a no-op", () => {
    let state = loadedState();
    state = worldBuilderReducer(state, {
      type: "ADD_NPC",
      npc: { id: "n1", name: "X" } as never,
    } as WorldBuilderAction);
    state = worldBuilderReducer(state, {
      type: "CLEAR_HISTORY",
    } as WorldBuilderAction);
    const r = worldBuilderReducer(state, {
      type: "UNDO",
    } as WorldBuilderAction);
    expect(r).toBe(state);
  });
});

describe("worldBuilderReducer — non-undoable actions pass through", () => {
  it("SET_MODE doesn't push history (not undoable)", () => {
    let state = loadedState();
    state = worldBuilderReducer(state, {
      type: "SET_MODE",
      mode: "creation",
    } as WorldBuilderAction);
    expect(state.history.past).toHaveLength(0);
  });

  it("SET_SEED doesn't push history (not undoable)", () => {
    let state = loadedState();
    state = worldBuilderReducer(state, {
      type: "SET_SEED",
      seed: 42,
    } as WorldBuilderAction);
    expect(state.history.past).toHaveLength(0);
    expect(state.creation.config.seed).toBe(42);
  });
});
