/**
 * onboardingPlan — interface shape + debug-plan fixture tests.
 *
 * Phase 1.2 seventh carve. Pins the debug fixture's coverage —
 * if a future plan-slot is added but buildDebugPlan forgets to
 * cover it, the test catches it before debug mode silently
 * stops exercising the downstream pipeline.
 */

import { describe, it, expect } from "vitest";

import { buildDebugPlan, type OnboardingPlan } from "../onboardingPlan";

describe("buildDebugPlan — slot coverage", () => {
  it("populates every primary slot the dialog cares about", () => {
    const plan = buildDebugPlan();
    expect(plan.terrainConfig).not.toBeNull();
    expect(plan.pluginIds).not.toBeNull();
    expect(plan.pluginIds!.length).toBeGreaterThan(0);
    expect(plan.npcs.length).toBeGreaterThan(0);
    expect(plan.mobSpawns.length).toBeGreaterThan(0);
    expect(plan.quests.length).toBeGreaterThan(0);
  });

  it("uiPack is null — debug plan exercises default HUD path", () => {
    expect(buildDebugPlan().uiPack).toBeNull();
  });

  it("has 3 NPCs (shopkeeper + questgiver + guard)", () => {
    expect(buildDebugPlan().npcs).toHaveLength(3);
  });

  it("has 5 mob spawns spread across the map", () => {
    expect(buildDebugPlan().mobSpawns).toHaveLength(5);
  });

  it("has 1 quest", () => {
    expect(buildDebugPlan().quests).toHaveLength(1);
  });

  it("has 1 zone (starter village)", () => {
    expect(buildDebugPlan().zones).toHaveLength(1);
  });

  it("has 2 resources (oak tree + iron rock)", () => {
    expect(buildDebugPlan().resources).toHaveLength(2);
  });

  it("has 2 crafting stations (anvil + furnace)", () => {
    expect(buildDebugPlan().stations).toHaveLength(2);
  });

  it("has 1 teleport (village lodestone)", () => {
    expect(buildDebugPlan().teleports).toHaveLength(1);
  });

  it("installs 4 asset packs as part of the debug plan", () => {
    expect(buildDebugPlan().assetPackIds).toHaveLength(4);
  });
});

describe("buildDebugPlan — terrainConfig shape", () => {
  it("seeds determinism with seed=42", () => {
    const tc = buildDebugPlan().terrainConfig as Record<string, unknown>;
    expect(tc.seed).toBe(42);
  });

  it("includes terrain + biomes + island sub-configs", () => {
    const tc = buildDebugPlan().terrainConfig as Record<string, unknown>;
    expect(tc.terrain).toBeDefined();
    expect(tc.biomes).toBeDefined();
    expect(tc.island).toBeDefined();
  });

  it("island gen is enabled", () => {
    const tc = buildDebugPlan().terrainConfig as Record<string, unknown>;
    const island = tc.island as Record<string, unknown>;
    expect(island.enabled).toBe(true);
  });
});

describe("buildDebugPlan — secondary slots", () => {
  it("leaves R4.P8 audio + boundary slots empty (uses dialog defaults)", () => {
    const plan = buildDebugPlan();
    expect(plan.roads).toEqual([]);
    expect(plan.pois).toEqual([]);
    expect(plan.dangerSources).toEqual([]);
    expect(plan.waterBodies).toEqual([]);
    expect(plan.musicZones).toEqual([]);
    expect(plan.ambientZones).toEqual([]);
    expect(plan.sfxTriggers).toEqual([]);
    expect(plan.mines).toEqual([]);
    expect(plan.wildernessBoundary).toBeNull();
  });

  it("leaves assets empty — bakes happen post-creation, not in debug", () => {
    expect(buildDebugPlan().assets).toEqual([]);
  });
});

describe("buildDebugPlan — idempotency", () => {
  it("returns fresh objects every call (no shared mutable state)", () => {
    const a = buildDebugPlan();
    const b = buildDebugPlan();
    expect(a).not.toBe(b);
    expect(a.npcs).not.toBe(b.npcs);
    expect(a.terrainConfig).not.toBe(b.terrainConfig);
  });

  it("does not mutate when callers push into list slots", () => {
    const plan = buildDebugPlan();
    plan.assets.push({ id: "test" });
    expect(buildDebugPlan().assets).toEqual([]);
  });
});

describe("OnboardingPlan — type smoke test", () => {
  it("typechecks an empty literal — minimum surface", () => {
    const _empty: OnboardingPlan = {
      terrainConfig: null,
      pluginIds: null,
      assetPackIds: null,
      npcs: [],
      mobSpawns: [],
      quests: [],
      assets: [],
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
      uiPack: null,
    };
    expect(_empty.npcs).toEqual([]);
  });
});
