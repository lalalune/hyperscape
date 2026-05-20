/**
 * buildWorldContentPatch — plan → patch translation tests.
 *
 * Pins the empty-slot-omission rule (partial dialog session
 * doesn't erase editor-authored content) and the per-slot
 * key mapping (notably `mobSpawns` → `spawns`).
 */

import { describe, it, expect } from "vitest";

import { buildWorldContentPatch } from "../buildWorldContentPatch";
import type { OnboardingPlan } from "../onboardingPlan";

function emptyPlan(): OnboardingPlan {
  return {
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
}

describe("buildWorldContentPatch — empty plan", () => {
  it("returns {} on an empty plan", () => {
    expect(buildWorldContentPatch(emptyPlan())).toEqual({});
  });
});

describe("buildWorldContentPatch — list slots", () => {
  it("copies non-empty npcs into patch.npcs", () => {
    const plan = { ...emptyPlan(), npcs: [{ id: "shopkeeper" }] };
    const out = buildWorldContentPatch(plan);
    expect(out).toEqual({ npcs: [{ id: "shopkeeper" }] });
  });

  it("renames mobSpawns to patch.spawns (engine compat)", () => {
    const plan = {
      ...emptyPlan(),
      mobSpawns: [{ id: "spawn1", mobId: "goblin" }],
    };
    const out = buildWorldContentPatch(plan);
    expect(out).toEqual({ spawns: [{ id: "spawn1", mobId: "goblin" }] });
    expect(out.mobSpawns).toBeUndefined();
  });

  it("copies every non-empty list slot in one pass", () => {
    const plan: OnboardingPlan = {
      ...emptyPlan(),
      npcs: [{ id: "a" }],
      mobSpawns: [{ id: "b" }],
      quests: [{ id: "c" }],
      zones: [{ id: "d" }],
      resources: [{ id: "e" }],
      stations: [{ id: "f" }],
      teleports: [{ id: "g" }],
      roads: [{ id: "h" }],
      pois: [{ id: "i" }],
      dangerSources: [{ id: "j" }],
      waterBodies: [{ id: "k" }],
      musicZones: [{ id: "l" }],
      ambientZones: [{ id: "m" }],
      sfxTriggers: [{ id: "n" }],
      mines: [{ id: "o" }],
    };
    const out = buildWorldContentPatch(plan);
    expect(Object.keys(out).sort()).toEqual(
      [
        "ambientZones",
        "dangerSources",
        "mines",
        "musicZones",
        "npcs",
        "pois",
        "quests",
        "resources",
        "roads",
        "sfxTriggers",
        "spawns", // mobSpawns rename
        "stations",
        "teleports",
        "waterBodies",
        "zones",
      ].sort(),
    );
  });
});

describe("buildWorldContentPatch — singleton slots", () => {
  it("includes wildernessBoundary when set", () => {
    const plan = {
      ...emptyPlan(),
      wildernessBoundary: { id: "wb", points: [] },
    };
    const out = buildWorldContentPatch(plan);
    expect(out.wildernessBoundary).toEqual({ id: "wb", points: [] });
  });

  it("includes uiPack when set", () => {
    const plan = { ...emptyPlan(), uiPack: { id: "hud-1" } };
    const out = buildWorldContentPatch(plan);
    expect(out.uiPack).toEqual({ id: "hud-1" });
  });

  it("omits wildernessBoundary when null", () => {
    const out = buildWorldContentPatch(emptyPlan());
    expect("wildernessBoundary" in out).toBe(false);
  });

  it("omits uiPack when null/falsy", () => {
    const out = buildWorldContentPatch(emptyPlan());
    expect("uiPack" in out).toBe(false);
  });
});

describe("buildWorldContentPatch — excluded slots", () => {
  it("does NOT include terrainConfig (applied via procgen, not patch)", () => {
    const plan = { ...emptyPlan(), terrainConfig: { seed: 42 } };
    expect("terrainConfig" in buildWorldContentPatch(plan)).toBe(false);
  });

  it("does NOT include pluginIds (dedicated endpoint)", () => {
    const plan = { ...emptyPlan(), pluginIds: ["combat"] };
    expect("pluginIds" in buildWorldContentPatch(plan)).toBe(false);
  });

  it("does NOT include assetPackIds (dedicated endpoint)", () => {
    const plan = {
      ...emptyPlan(),
      assetPackIds: ["@hyperforge/content-pack-tropical"],
    };
    expect("assetPackIds" in buildWorldContentPatch(plan)).toBe(false);
  });

  it("does NOT include assets (baked post-creation)", () => {
    const plan = {
      ...emptyPlan(),
      assets: [{ name: "asset1", type: "mob" }],
    };
    expect("assets" in buildWorldContentPatch(plan)).toBe(false);
  });
});

describe("buildWorldContentPatch — empty-omission semantics", () => {
  it("empty arrays are omitted entirely (not written as [])", () => {
    const out = buildWorldContentPatch(emptyPlan());
    // Explicit `[]` would cause server to clear that slot —
    // empty slot must be ABSENT, not present-but-empty.
    expect("npcs" in out).toBe(false);
    expect("quests" in out).toBe(false);
    expect("mines" in out).toBe(false);
    expect("spawns" in out).toBe(false);
  });
});
