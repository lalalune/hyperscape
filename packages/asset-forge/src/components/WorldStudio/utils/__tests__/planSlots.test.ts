/**
 * planSlots — slot registry + state-helper tests.
 *
 * Phase 1.2 sixth carve. Pins the slot registry order, tier
 * tagging, and per-slot "filled" detection — the two surfaces
 * the dialog renders (progress strip + Plan panel) both branch
 * off these helpers, so a drift here is visible immediately.
 */

import { describe, it, expect } from "vitest";

import {
  PLAN_SLOTS,
  countSetSlots,
  isSlotSet,
  type PlanSlotKey,
  type PlanSlotShape,
} from "../planSlots";

function emptyPlan(): PlanSlotShape {
  return {
    assetPackIds: null,
    pluginIds: null,
    terrainConfig: null,
    npcs: [],
    mobSpawns: [],
    quests: [],
    uiPack: null,
    zones: [],
    resources: [],
    stations: [],
    teleports: [],
    roads: [],
    pois: [],
    dangerSources: [],
    waterBodies: [],
    musicZones: [],
    ambientZones: [],
    sfxTriggers: [],
    mines: [],
    wildernessBoundary: null,
    assets: [],
  };
}

describe("PLAN_SLOTS — registry shape", () => {
  it("ships exactly 21 slots (7 primary + 14 secondary)", () => {
    expect(PLAN_SLOTS).toHaveLength(21);
    const primary = PLAN_SLOTS.filter((s) => s.tier === "primary");
    const secondary = PLAN_SLOTS.filter((s) => s.tier === "secondary");
    expect(primary).toHaveLength(7);
    expect(secondary).toHaveLength(14);
  });

  it("primary slots come before secondary slots in order", () => {
    let sawSecondary = false;
    for (const slot of PLAN_SLOTS) {
      if (slot.tier === "secondary") sawSecondary = true;
      if (slot.tier === "primary" && sawSecondary) {
        throw new Error(`primary slot ${slot.key} after a secondary slot`);
      }
    }
  });

  it("every slot has a non-empty short label + emptyPrompt + Icon", () => {
    for (const slot of PLAN_SLOTS) {
      expect(slot.short.length).toBeGreaterThan(0);
      expect(slot.emptyPrompt.length).toBeGreaterThan(0);
      expect(slot.Icon).toBeDefined();
    }
  });

  it("slot keys are unique", () => {
    const keys = PLAN_SLOTS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("primary tier covers the gameplay essentials in expected order", () => {
    const primaryKeys = PLAN_SLOTS.filter((s) => s.tier === "primary").map(
      (s) => s.key,
    );
    expect(primaryKeys).toEqual([
      "theme",
      "pluginIds",
      "terrainConfig",
      "npcs",
      "mobSpawns",
      "quests",
      "uiPack",
    ]);
  });
});

describe("isSlotSet — primary slots", () => {
  it("theme = false on empty plan", () => {
    expect(isSlotSet(emptyPlan(), "theme")).toBe(false);
  });

  it("theme = true when assetPackIds contains a content-pack-* id", () => {
    const plan = {
      ...emptyPlan(),
      assetPackIds: ["@hyperforge/content-pack-arctic"],
    };
    expect(isSlotSet(plan, "theme")).toBe(true);
  });

  it("theme = false when assetPackIds has only non-themed packs", () => {
    const plan = {
      ...emptyPlan(),
      assetPackIds: ["@hyperforge/asset-pack-hyperia-trees-v1"],
    };
    expect(isSlotSet(plan, "theme")).toBe(false);
  });

  it("pluginIds = false on empty + false on empty-array, true on populated", () => {
    expect(isSlotSet(emptyPlan(), "pluginIds")).toBe(false);
    expect(isSlotSet({ ...emptyPlan(), pluginIds: [] }, "pluginIds")).toBe(
      false,
    );
    expect(
      isSlotSet({ ...emptyPlan(), pluginIds: ["combat"] }, "pluginIds"),
    ).toBe(true);
  });

  it("terrainConfig flips on non-null", () => {
    expect(isSlotSet(emptyPlan(), "terrainConfig")).toBe(false);
    expect(
      isSlotSet(
        { ...emptyPlan(), terrainConfig: { maxHeight: 50 } },
        "terrainConfig",
      ),
    ).toBe(true);
  });

  it("npcs/mobSpawns/quests flip on non-empty array", () => {
    const plan = {
      ...emptyPlan(),
      npcs: [{ id: "shop" }],
      mobSpawns: [{ id: "spawn1" }],
      quests: [{ id: "intro" }],
    };
    expect(isSlotSet(plan, "npcs")).toBe(true);
    expect(isSlotSet(plan, "mobSpawns")).toBe(true);
    expect(isSlotSet(plan, "quests")).toBe(true);
  });

  it("uiPack flips on non-null", () => {
    expect(isSlotSet(emptyPlan(), "uiPack")).toBe(false);
    expect(
      isSlotSet({ ...emptyPlan(), uiPack: { id: "default" } }, "uiPack"),
    ).toBe(true);
  });
});

describe("isSlotSet — secondary slots", () => {
  it("each list-shaped secondary slot flips on non-empty array", () => {
    const arrayKeys: PlanSlotKey[] = [
      "zones",
      "resources",
      "stations",
      "teleports",
      "roads",
      "pois",
      "dangerSources",
      "waterBodies",
      "musicZones",
      "ambientZones",
      "sfxTriggers",
      "mines",
      "assets",
    ];
    for (const key of arrayKeys) {
      expect(isSlotSet(emptyPlan(), key)).toBe(false);
      const plan = { ...emptyPlan(), [key]: [{ id: "x" }] } as PlanSlotShape;
      expect(isSlotSet(plan, key)).toBe(true);
    }
  });

  it("wildernessBoundary flips on non-null (singleton, not list)", () => {
    expect(isSlotSet(emptyPlan(), "wildernessBoundary")).toBe(false);
    const plan = {
      ...emptyPlan(),
      wildernessBoundary: { points: [] },
    };
    expect(isSlotSet(plan, "wildernessBoundary")).toBe(true);
  });
});

describe("countSetSlots", () => {
  it("returns 0 for an empty plan in any tier", () => {
    expect(countSetSlots(emptyPlan(), "all")).toBe(0);
    expect(countSetSlots(emptyPlan(), "primary")).toBe(0);
    expect(countSetSlots(emptyPlan(), "secondary")).toBe(0);
  });

  it("counts only primary slots in primary tier", () => {
    const plan = {
      ...emptyPlan(),
      pluginIds: ["combat"], // primary
      zones: [{ id: "town" }], // secondary
    };
    expect(countSetSlots(plan, "primary")).toBe(1);
    expect(countSetSlots(plan, "secondary")).toBe(1);
    expect(countSetSlots(plan, "all")).toBe(2);
  });

  it("returns 21 when every slot is set", () => {
    const fullPlan: PlanSlotShape = {
      assetPackIds: ["@hyperforge/content-pack-tropical"],
      pluginIds: ["combat"],
      terrainConfig: { maxHeight: 50 },
      npcs: [{}],
      mobSpawns: [{}],
      quests: [{}],
      uiPack: { id: "default" },
      zones: [{}],
      resources: [{}],
      stations: [{}],
      teleports: [{}],
      roads: [{}],
      pois: [{}],
      dangerSources: [{}],
      waterBodies: [{}],
      musicZones: [{}],
      ambientZones: [{}],
      sfxTriggers: [{}],
      mines: [{}],
      wildernessBoundary: { points: [] },
      assets: [{}],
    };
    expect(countSetSlots(fullPlan, "all")).toBe(21);
    expect(countSetSlots(fullPlan, "primary")).toBe(7);
    expect(countSetSlots(fullPlan, "secondary")).toBe(14);
  });

  it("defaults to 'all' when tier arg is omitted", () => {
    const plan = { ...emptyPlan(), pluginIds: ["combat"], zones: [{}] };
    expect(countSetSlots(plan)).toBe(2);
  });
});
