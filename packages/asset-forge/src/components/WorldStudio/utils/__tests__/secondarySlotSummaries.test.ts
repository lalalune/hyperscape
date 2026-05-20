/**
 * secondarySlotSummaries — slot count / summary / entry-extraction tests.
 *
 * Phase 1.2 eighth carve. Pins the secondary slot Plan-panel
 * surface: counts, one-line summaries, and per-slot-key entry
 * extraction. These are the helpers that turn raw OnboardingPlan
 * data into displayable strings.
 */

import { describe, it, expect } from "vitest";

import type { OnboardingPlan } from "../onboardingPlan";
import {
  collectSecondarySlotEntries,
  extractEntrySummary,
  getEmptyPrompt,
  secondarySlotCount,
  secondarySlotSummary,
} from "../secondarySlotSummaries";

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

describe("secondarySlotCount", () => {
  it("returns 0 for empty plan across every secondary slot", () => {
    const p = emptyPlan();
    expect(secondarySlotCount(p, "zones")).toBe(0);
    expect(secondarySlotCount(p, "resources")).toBe(0);
    expect(secondarySlotCount(p, "mines")).toBe(0);
    expect(secondarySlotCount(p, "wildernessBoundary")).toBe(0);
  });

  it("wildernessBoundary counts as 1 when set", () => {
    const p = { ...emptyPlan(), wildernessBoundary: { points: [] } };
    expect(secondarySlotCount(p, "wildernessBoundary")).toBe(1);
  });

  it("array slots return their length", () => {
    const p = {
      ...emptyPlan(),
      roads: [{ id: "r1" }, { id: "r2" }, { id: "r3" }],
    };
    expect(secondarySlotCount(p, "roads")).toBe(3);
  });
});

describe("secondarySlotSummary", () => {
  it("empty slot returns 'Not yet placed'", () => {
    expect(secondarySlotSummary(emptyPlan(), "roads")).toBe("Not yet placed");
  });

  it("one-entry slot shows just the first entry's name", () => {
    const p = { ...emptyPlan(), roads: [{ name: "Main Road" }] };
    expect(secondarySlotSummary(p, "roads")).toBe("Main Road");
  });

  it("multi-entry slot shows count + first label", () => {
    const p = {
      ...emptyPlan(),
      roads: [{ name: "Main Road" }, { name: "Side Path" }, { id: "r3" }],
    };
    expect(secondarySlotSummary(p, "roads")).toBe("3 placed · Main Road, …");
  });

  it("wildernessBoundary summary shows point count", () => {
    const p = {
      ...emptyPlan(),
      wildernessBoundary: {
        id: "wild1",
        points: [
          { x: 0, z: 0 },
          { x: 10, z: 0 },
          { x: 0, z: 10 },
        ],
      },
    };
    expect(secondarySlotSummary(p, "wildernessBoundary")).toBe(
      "3-point boundary",
    );
  });

  it("falls back to id when name is missing", () => {
    const p = { ...emptyPlan(), roads: [{ id: "r1" }] };
    expect(secondarySlotSummary(p, "roads")).toBe("r1");
  });

  it("falls back to '(unnamed)' when both name + id are missing", () => {
    const p = { ...emptyPlan(), roads: [{}] };
    expect(secondarySlotSummary(p, "roads")).toBe("(unnamed)");
  });
});

describe("getEmptyPrompt", () => {
  it("returns the registry's emptyPrompt for the requested slot", () => {
    const out = getEmptyPrompt("roads");
    expect(out.length).toBeGreaterThan(0);
    expect(out.toLowerCase()).toContain("road");
  });

  it("returns a different prompt for each slot type", () => {
    expect(getEmptyPrompt("mines")).not.toBe(getEmptyPrompt("roads"));
  });
});

describe("extractEntrySummary — per-slot detail extraction", () => {
  it("zones — biome + safe/hostile", () => {
    const out = extractEntrySummary(
      { name: "Town", biomeType: "plains", safeZone: true },
      "zones",
    );
    expect(out.primary).toBe("Town");
    expect(out.detail).toContain("plains");
    expect(out.detail).toContain("safe");
  });

  it("zones — hostile when safeZone=false", () => {
    const out = extractEntrySummary(
      { name: "Wilds", biomeType: "tundra", safeZone: false },
      "zones",
    );
    expect(out.detail).toContain("hostile");
  });

  it("resources — type + position", () => {
    const out = extractEntrySummary(
      { resourceId: "oak", type: "tree", position: { x: 1, y: 0, z: 2 } },
      "resources",
    );
    expect(out.primary).toBe("oak");
    expect(out.detail).toContain("tree");
    expect(out.detail).toContain("(1, 0, 2)");
  });

  it("roads — path point count + width", () => {
    const out = extractEntrySummary(
      { name: "Main Road", path: [{}, {}, {}], width: 4 },
      "roads",
    );
    expect(out.detail).toContain("3-pt path");
    expect(out.detail).toContain("4m wide");
  });

  it("pois — category + importance + position", () => {
    const out = extractEntrySummary(
      {
        name: "Ancient Shrine",
        category: "shrine",
        importance: 0.8,
        position: { x: 5, y: 0, z: 5 },
      },
      "pois",
    );
    expect(out.detail).toContain("shrine");
    expect(out.detail).toContain("importance 0.8");
  });

  it("waterBodies — polygon vertex count", () => {
    const out = extractEntrySummary(
      {
        name: "Lake",
        bodyType: "lake",
        polygon: [{}, {}, {}, {}, {}],
      },
      "waterBodies",
    );
    expect(out.detail).toContain("lake");
    expect(out.detail).toContain("5-vertex polygon");
  });

  it("waterBodies — waypoint path when polygon is absent", () => {
    const out = extractEntrySummary(
      { name: "River", bodyType: "river", waypoints: [{}, {}, {}] },
      "waterBodies",
    );
    expect(out.detail).toContain("3-pt path");
  });

  it("mines — pluralization on ore-type count", () => {
    const single = extractEntrySummary(
      { id: "m1", oreRocks: [{ id: "iron" }] },
      "mines",
    );
    expect(single.detail).toContain("1 ore type");
    expect(single.detail).not.toContain("ore types");

    const multi = extractEntrySummary(
      { id: "m2", oreRocks: [{ id: "iron" }, { id: "copper" }] },
      "mines",
    );
    expect(multi.detail).toContain("2 ore types");
  });

  it("falls back to '(unnamed)' when no identifier present", () => {
    const out = extractEntrySummary({}, "roads");
    expect(out.primary).toBe("(unnamed)");
  });

  it("name takes precedence over id/resourceId", () => {
    const out = extractEntrySummary(
      { name: "Display", id: "Internal", resourceId: "Raw" },
      "zones",
    );
    expect(out.primary).toBe("Display");
  });
});

describe("collectSecondarySlotEntries", () => {
  it("maps an array slot to SlotEntrySummary[]", () => {
    const p = {
      ...emptyPlan(),
      roads: [
        { name: "Road A", path: [{}, {}], width: 3 },
        { name: "Road B", path: [{}], width: 5 },
      ],
    };
    const out = collectSecondarySlotEntries(p, "roads");
    expect(out).toHaveLength(2);
    expect(out[0].primary).toBe("Road A");
    expect(out[1].primary).toBe("Road B");
  });

  it("wildernessBoundary returns a synthetic single-entry array", () => {
    const p = {
      ...emptyPlan(),
      wildernessBoundary: {
        id: "wild1",
        points: [{}, {}, {}],
        maxLevel: 50,
      },
    };
    const out = collectSecondarySlotEntries(p, "wildernessBoundary");
    expect(out).toHaveLength(1);
    expect(out[0].primary).toBe("wild1");
    expect(out[0].detail).toContain("3-point boundary");
    expect(out[0].detail).toContain("max lvl 50");
  });

  it("wildernessBoundary returns [] when boundary is null", () => {
    expect(
      collectSecondarySlotEntries(emptyPlan(), "wildernessBoundary"),
    ).toEqual([]);
  });

  it("returns empty for unknown slot key", () => {
    const out = collectSecondarySlotEntries(
      emptyPlan(),
      "uiPack" as never, // not a secondary slot
    );
    expect(out).toEqual([]);
  });
});
