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

import { describe, expect, it } from "vitest";
import {
  PROPOSE_ACTIONS,
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

describe("PROPOSE_ACTIONS — registry is the type ProposeActionDef[]", () => {
  it("entries are assignable to ProposeActionDef", () => {
    // Compile-time-ish check: every entry can be referenced by type.
    const first: ProposeActionDef | undefined = PROPOSE_ACTIONS[0];
    expect(first).toBeDefined();
    expect(first?.name).toBe("PROPOSE_TERRAIN_CONFIG");
  });
});
