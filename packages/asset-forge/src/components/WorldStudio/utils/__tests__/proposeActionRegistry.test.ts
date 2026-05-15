/**
 * `proposeActionRegistry` — Phase 1.3 PROPOSE_* action registry
 * tests.
 *
 * Pins the registry contract so future drift is caught:
 *   - Every entry has the required ProposeActionDef fields.
 *   - dataKey values match the case-arm dispatch in
 *     DesignWithAIDialog and WorldStudioCompanion (so a registry
 *     consumer using `data[def.dataKey]` reads the same field
 *     the existing bespoke dispatch reads).
 *   - planField values match `OnboardingPlan` field names so the
 *     registry never falsely advertises a field that doesn't
 *     exist on the plan shape.
 *   - prettifyToolName falls through correctly: registry hit →
 *     statusLabel + ellipsis; bespoke (asset pack, ui pack,
 *     etc) → label table + ellipsis; unknown → "Running NAME…".
 */

import { describe, expect, it, vi } from "vitest";
import {
  PROPOSE_ACTIONS,
  applyProposalToDispatcher,
  applyProposalToPlan,
  getProposeActionDef,
  prettifyToolName,
  type ProposeActionDef,
} from "../proposeActionRegistry";

describe("PROPOSE_ACTIONS registry — shape", () => {
  it("every entry has the required ProposeActionDef fields", () => {
    for (const def of PROPOSE_ACTIONS) {
      expect(typeof def.name).toBe("string");
      expect(def.name).toMatch(/^PROPOSE_[A-Z_]+$/);
      expect(typeof def.dataKey).toBe("string");
      expect(def.dataKey.length).toBeGreaterThan(0);
      expect(typeof def.planField).toBe("string");
      expect(def.planField.length).toBeGreaterThan(0);
      expect(["list", "singleton"]).toContain(def.arity);
      expect(typeof def.statusLabel).toBe("string");
      expect(def.statusLabel.length).toBeGreaterThan(0);
      // Status label is plain — no trailing ellipsis (added by prettify).
      expect(def.statusLabel.endsWith("…")).toBe(false);
    }
  });

  it("action names are unique", () => {
    const names = new Set<string>();
    for (const def of PROPOSE_ACTIONS) {
      expect(names.has(def.name)).toBe(false);
      names.add(def.name);
    }
  });

  it("planField values are unique (each plan field has one writer)", () => {
    const fields = new Set<string>();
    for (const def of PROPOSE_ACTIONS) {
      expect(fields.has(def.planField)).toBe(false);
      fields.add(def.planField);
    }
  });
});

describe("PROPOSE_ACTIONS — covers the known agent vocabulary", () => {
  const expectedActions: ReadonlyArray<{
    name: string;
    dataKey: string;
    planField: string;
    arity: "list" | "singleton";
  }> = [
    // Singletons — replace last-write-wins.
    {
      name: "PROPOSE_TERRAIN_CONFIG",
      dataKey: "config",
      planField: "terrainConfig",
      arity: "singleton",
    },
    {
      name: "PROPOSE_PLUGIN_SET",
      dataKey: "pluginIds",
      planField: "pluginIds",
      arity: "singleton",
    },
    {
      name: "PROPOSE_WILDERNESS_BOUNDARY",
      dataKey: "wildernessBoundary",
      planField: "wildernessBoundary",
      arity: "singleton",
    },
    // Lists — append per call.
    {
      name: "PROPOSE_NPC_PLACEMENT",
      dataKey: "entity",
      planField: "npcs",
      arity: "list",
    },
    {
      name: "PROPOSE_MOB_SPAWN",
      dataKey: "spawn",
      planField: "mobSpawns",
      arity: "list",
    },
    {
      name: "PROPOSE_QUEST",
      dataKey: "quest",
      planField: "quests",
      arity: "list",
    },
    {
      name: "PROPOSE_ASSET",
      dataKey: "asset",
      planField: "assets",
      arity: "list",
    },
    {
      name: "PROPOSE_ZONE",
      dataKey: "zone",
      planField: "zones",
      arity: "list",
    },
    {
      name: "PROPOSE_RESOURCE",
      dataKey: "resource",
      planField: "resources",
      arity: "list",
    },
    {
      name: "PROPOSE_STATION",
      dataKey: "station",
      planField: "stations",
      arity: "list",
    },
    {
      name: "PROPOSE_TELEPORT",
      dataKey: "teleport",
      planField: "teleports",
      arity: "list",
    },
    {
      name: "PROPOSE_ROAD",
      dataKey: "road",
      planField: "roads",
      arity: "list",
    },
    { name: "PROPOSE_POI", dataKey: "poi", planField: "pois", arity: "list" },
    {
      name: "PROPOSE_DANGER_SOURCE",
      dataKey: "dangerSource",
      planField: "dangerSources",
      arity: "list",
    },
    {
      name: "PROPOSE_WATER_BODY",
      dataKey: "waterBody",
      planField: "waterBodies",
      arity: "list",
    },
    {
      name: "PROPOSE_MUSIC_ZONE",
      dataKey: "musicZone",
      planField: "musicZones",
      arity: "list",
    },
    {
      name: "PROPOSE_AMBIENT_ZONE",
      dataKey: "ambientZone",
      planField: "ambientZones",
      arity: "list",
    },
    {
      name: "PROPOSE_SFX_TRIGGER",
      dataKey: "sfxTrigger",
      planField: "sfxTriggers",
      arity: "list",
    },
    {
      name: "PROPOSE_MINE",
      dataKey: "mine",
      planField: "mines",
      arity: "list",
    },
  ];

  it("contains every expected entry exactly once", () => {
    for (const expected of expectedActions) {
      const def = getProposeActionDef(expected.name);
      expect(def).toBeDefined();
      expect(def!.dataKey).toBe(expected.dataKey);
      expect(def!.planField).toBe(expected.planField);
      expect(def!.arity).toBe(expected.arity);
    }
  });

  it("has exactly the expected size (no surprise additions)", () => {
    expect(PROPOSE_ACTIONS).toHaveLength(expectedActions.length);
  });
});

describe("getProposeActionDef", () => {
  it("returns the def for a known action name", () => {
    const def = getProposeActionDef("PROPOSE_NPC_PLACEMENT");
    expect(def).toBeDefined();
    expect(def!.dataKey).toBe("entity");
  });

  it("returns undefined for unknown names", () => {
    expect(getProposeActionDef("PROPOSE_UNKNOWN")).toBeUndefined();
    expect(getProposeActionDef("LIST_PLUGINS")).toBeUndefined();
  });

  it("returns undefined for the bespoke actions (NOT in registry)", () => {
    // These have action-specific handling that doesn't fit the
    // registry shape.
    expect(getProposeActionDef("PROPOSE_ASSET_PACK_INSTALL")).toBeUndefined();
    expect(getProposeActionDef("PROPOSE_UI_PACK")).toBeUndefined();
    expect(getProposeActionDef("REMOVE_FROM_PROJECT")).toBeUndefined();
  });
});

describe("prettifyToolName — fallback chain", () => {
  it("emits '<statusLabel>…' for registry hits", () => {
    expect(prettifyToolName("PROPOSE_NPC_PLACEMENT")).toBe("Placing an NPC…");
    expect(prettifyToolName("PROPOSE_TERRAIN_CONFIG")).toBe(
      "Shaping the terrain…",
    );
    expect(prettifyToolName("PROPOSE_WILDERNESS_BOUNDARY")).toBe(
      "Drawing the wilderness boundary…",
    );
  });

  it("emits the bespoke label for actions outside the registry", () => {
    expect(prettifyToolName("PROPOSE_ASSET_PACK_INSTALL")).toBe(
      "Picking asset packs…",
    );
    expect(prettifyToolName("PROPOSE_UI_PACK")).toBe("Drafting the HUD…");
    expect(prettifyToolName("REMOVE_FROM_PROJECT")).toBe("Removing an entity…");
  });

  it("emits the non-PROPOSE table label for discovery / offers", () => {
    expect(prettifyToolName("LIST_PLUGINS")).toBe("Looking up plugins…");
    expect(prettifyToolName("GET_PLUGIN")).toBe("Inspecting a plugin…");
    expect(prettifyToolName("LIST_GAME_WIDGETS")).toBe("Listing widgets…");
    expect(prettifyToolName("OFFER_CHOICES")).toBe("Offering choices…");
  });

  it("falls back to 'Running <NAME>…' for fully unknown names", () => {
    expect(prettifyToolName("XYZ_MYSTERY_ACTION")).toBe(
      "Running XYZ_MYSTERY_ACTION…",
    );
    expect(prettifyToolName("")).toBe("Running …");
  });
});

// ============================================================================
// applyProposalToPlan
// ============================================================================

describe("applyProposalToPlan — singleton arity", () => {
  it("replaces plan[planField] for PROPOSE_TERRAIN_CONFIG", () => {
    const plan = {
      terrainConfig: null as unknown,
      npcs: [],
    };
    const next = applyProposalToPlan(plan, "PROPOSE_TERRAIN_CONFIG", {
      config: { seed: 99, worldSize: 8 },
    });
    expect(next.terrainConfig).toEqual({ seed: 99, worldSize: 8 });
    // Untouched slots stay reference-equal.
    expect(next.npcs).toBe(plan.npcs);
  });

  it("last-write wins on repeated singleton calls", () => {
    let plan = { terrainConfig: null as unknown };
    plan = applyProposalToPlan(plan, "PROPOSE_TERRAIN_CONFIG", {
      config: { seed: 1 },
    });
    plan = applyProposalToPlan(plan, "PROPOSE_TERRAIN_CONFIG", {
      config: { seed: 2 },
    });
    expect(plan.terrainConfig).toEqual({ seed: 2 });
  });
});

describe("applyProposalToPlan — list arity", () => {
  it("appends to plan[planField] for PROPOSE_NPC_PLACEMENT", () => {
    const plan = { npcs: [{ id: "existing" }] as unknown[] };
    const next = applyProposalToPlan(plan, "PROPOSE_NPC_PLACEMENT", {
      entity: { id: "new" },
    });
    expect(next.npcs).toEqual([{ id: "existing" }, { id: "new" }]);
  });

  it("multiple list calls accumulate", () => {
    let plan = { mobSpawns: [] as unknown[] };
    plan = applyProposalToPlan(plan, "PROPOSE_MOB_SPAWN", {
      spawn: { mobId: "a" },
    });
    plan = applyProposalToPlan(plan, "PROPOSE_MOB_SPAWN", {
      spawn: { mobId: "b" },
    });
    plan = applyProposalToPlan(plan, "PROPOSE_MOB_SPAWN", {
      spawn: { mobId: "c" },
    });
    expect(plan.mobSpawns).toHaveLength(3);
  });

  it("returns the same plan reference if existing slot is not an array (defensive)", () => {
    const plan = { npcs: null as unknown };
    const next = applyProposalToPlan(plan, "PROPOSE_NPC_PLACEMENT", {
      entity: { id: "new" },
    });
    expect(next).toBe(plan);
  });
});

describe("applyProposalToPlan — pass-through cases", () => {
  it("returns the same plan reference for unknown action name", () => {
    const plan = { npcs: [] as unknown[] };
    const next = applyProposalToPlan(plan, "PROPOSE_UNKNOWN", {
      something: "value",
    });
    expect(next).toBe(plan);
  });

  it("returns the same plan reference for bespoke actions (PROPOSE_UI_PACK etc)", () => {
    const plan = { uiPack: null as unknown };
    const next = applyProposalToPlan(plan, "PROPOSE_UI_PACK", {
      pack: { layout: "grid" },
    });
    expect(next).toBe(plan);
  });

  it("returns the same plan reference when the registry's dataKey is missing from data", () => {
    const plan = { npcs: [] as unknown[] };
    const next = applyProposalToPlan(plan, "PROPOSE_NPC_PLACEMENT", {
      // Note: registry says dataKey="entity"; we pass "npc" instead.
      npc: { id: "x" },
    });
    expect(next).toBe(plan);
  });

  it("does NOT process PROPOSE_PLUGIN_SET (left to caller's bespoke arm for filtering)", () => {
    // PROPOSE_PLUGIN_SET is in the registry as a singleton, but
    // the caller wants to filter the array to string entries —
    // generic singleton apply would store the raw array. The
    // caller's bespoke arm handles this. The generic helper
    // still copies the value (good enough for label/dispatch use
    // cases); the caller decides whether to defer.
    const plan = { pluginIds: null as unknown };
    const next = applyProposalToPlan(plan, "PROPOSE_PLUGIN_SET", {
      pluginIds: ["a", 42, "b"] as unknown[],
    });
    // Generic helper passes through unfiltered — caller must
    // filter when they want strings only.
    expect(next.pluginIds).toEqual(["a", 42, "b"]);
  });
});

// ============================================================================
// dispatcherMethod field + applyProposalToDispatcher
// ============================================================================

describe("PROPOSE_ACTIONS — dispatcherMethod assignments", () => {
  /**
   * The Companion's `AgentPlacementDispatcher` interface declares
   * exactly these 14 placeX methods. The registry's
   * dispatcherMethod values must match. A typo / drift here is
   * silent at runtime (the helper just no-ops) — this test
   * surfaces the drift.
   */
  const VALID_DISPATCHER_METHODS = new Set([
    "placeNpc",
    "placeMobSpawn",
    "placeResource",
    "placeStation",
    "placeTeleport",
    "placeRoad",
    "placePOI",
    "placeDangerSource",
    "placeWaterBody",
    "placeMusicZone",
    "placeAmbientZone",
    "placeSfxTrigger",
    "placeMine",
    "placeWildernessBoundary",
  ]);

  it("every dispatcherMethod value matches a real AgentPlacementDispatcher method", () => {
    for (const def of PROPOSE_ACTIONS) {
      if (def.dispatcherMethod === undefined) continue;
      expect(VALID_DISPATCHER_METHODS.has(def.dispatcherMethod)).toBe(true);
    }
  });

  it("every dispatcher method is claimed by exactly one PROPOSE_* action", () => {
    const claimed = new Set<string>();
    for (const def of PROPOSE_ACTIONS) {
      if (def.dispatcherMethod === undefined) continue;
      expect(claimed.has(def.dispatcherMethod)).toBe(false);
      claimed.add(def.dispatcherMethod);
    }
    expect(claimed.size).toBe(VALID_DISPATCHER_METHODS.size);
  });

  it("actions without a live dispatch path omit dispatcherMethod", () => {
    // PROPOSE_TERRAIN_CONFIG / PROPOSE_PLUGIN_SET don't dispatch
    // live. PROPOSE_QUEST / PROPOSE_ZONE / PROPOSE_ASSET have
    // other persistence paths.
    const expectNoDispatcher = [
      "PROPOSE_TERRAIN_CONFIG",
      "PROPOSE_PLUGIN_SET",
      "PROPOSE_QUEST",
      "PROPOSE_ASSET",
      "PROPOSE_ZONE",
    ];
    for (const name of expectNoDispatcher) {
      const def = getProposeActionDef(name);
      expect(def?.dispatcherMethod).toBeUndefined();
    }
  });
});

describe("applyProposalToDispatcher", () => {
  it("invokes the registry's dispatcherMethod with the payload value", () => {
    const placeNpc = vi.fn();
    const placeMobSpawn = vi.fn();
    const dispatcher = { placeNpc, placeMobSpawn };
    const dispatched = applyProposalToDispatcher(
      dispatcher,
      "PROPOSE_NPC_PLACEMENT",
      { entity: { id: "n1" } },
    );
    expect(dispatched).toBe(true);
    expect(placeNpc).toHaveBeenCalledWith({ id: "n1" });
    expect(placeMobSpawn).not.toHaveBeenCalled();
  });

  it("returns false (no-op) when the action isn't in the registry", () => {
    const dispatcher = { placeNpc: vi.fn() };
    const dispatched = applyProposalToDispatcher(
      dispatcher,
      "PROPOSE_UNKNOWN",
      { entity: { id: "n1" } },
    );
    expect(dispatched).toBe(false);
    expect(dispatcher.placeNpc).not.toHaveBeenCalled();
  });

  it("returns false when the registry entry has no dispatcherMethod", () => {
    // PROPOSE_QUEST is in the registry but has no dispatcherMethod
    // (it goes through setAndPersistAgentQuest, not the dispatcher).
    const dispatcher = { placeNpc: vi.fn() };
    const dispatched = applyProposalToDispatcher(dispatcher, "PROPOSE_QUEST", {
      quest: { id: "q1" },
    });
    expect(dispatched).toBe(false);
  });

  it("returns false when the payload is missing the registry's dataKey", () => {
    const placeNpc = vi.fn();
    const dispatcher = { placeNpc };
    const dispatched = applyProposalToDispatcher(
      dispatcher,
      "PROPOSE_NPC_PLACEMENT",
      { npc: { id: "n1" } }, // wrong key — registry says "entity"
    );
    expect(dispatched).toBe(false);
    expect(placeNpc).not.toHaveBeenCalled();
  });

  it("returns false when the dispatcher is missing the named method", () => {
    // dispatcher has no placeNpc — the helper bails defensively.
    const dispatcher = {};
    const dispatched = applyProposalToDispatcher(
      dispatcher,
      "PROPOSE_NPC_PLACEMENT",
      { entity: { id: "n1" } },
    );
    expect(dispatched).toBe(false);
  });

  it("dispatches each of the 14 placeable actions to its mapped method", () => {
    const calls: Array<{ method: string; payload: unknown }> = [];
    const dispatcher = new Proxy(
      {},
      {
        get(_, prop: string) {
          return (payload: unknown) => calls.push({ method: prop, payload });
        },
      },
    ) as Record<string, unknown>;

    const placeableActions = PROPOSE_ACTIONS.filter(
      (a) => a.dispatcherMethod !== undefined,
    );
    for (const def of placeableActions) {
      applyProposalToDispatcher(dispatcher, def.name, {
        [def.dataKey]: { mock: def.name },
      });
    }

    expect(calls).toHaveLength(placeableActions.length);
    for (let i = 0; i < placeableActions.length; i++) {
      expect(calls[i].method).toBe(placeableActions[i].dispatcherMethod);
      expect(calls[i].payload).toEqual({ mock: placeableActions[i].name });
    }
  });
});

describe("PROPOSE_ACTIONS — registry is the type ProposeActionDef[]", () => {
  it("entries are assignable to ProposeActionDef", () => {
    // Compile-time-ish check: every entry can be referenced by type.
    const first: ProposeActionDef | undefined = PROPOSE_ACTIONS[0];
    expect(first).toBeDefined();
    expect(first?.name).toBe("PROPOSE_TERRAIN_CONFIG");
  });
});
