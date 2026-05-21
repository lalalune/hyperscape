/**
 * collectAssetPackRefs — assetRef → pack-id walker tests.
 *
 * Pins the three sources the dialog unions when computing
 * which packs the project needs installed: explicit installs +
 * entity refs + caller-provided extras.
 */

import { describe, it, expect } from "vitest";

import {
  collectEntityPackRefs,
  extractAssetPackId,
  resolvePlanPackIds,
} from "../collectAssetPackRefs";
import {
  createEmptyOnboardingPlan,
  type OnboardingPlan,
} from "../onboardingPlan";

describe("extractAssetPackId", () => {
  it("returns null when entry has no assetRef field", () => {
    expect(extractAssetPackId({})).toBeNull();
    expect(extractAssetPackId({ id: "x" })).toBeNull();
  });

  it("returns null when assetRef is not a string", () => {
    expect(extractAssetPackId({ assetRef: 42 })).toBeNull();
    expect(extractAssetPackId({ assetRef: null })).toBeNull();
  });

  it("returns null when ref has no `/`", () => {
    expect(extractAssetPackId({ assetRef: "noslash" })).toBeNull();
  });

  it("returns null when `/` is at index 0 (no pack prefix)", () => {
    expect(extractAssetPackId({ assetRef: "/leading-slash" })).toBeNull();
  });

  it("extracts prefix before the LAST slash", () => {
    expect(
      extractAssetPackId({
        assetRef: "@hyperforge/asset-pack-hyperia-npcs-v1/shopkeeper",
      }),
    ).toBe("@hyperforge/asset-pack-hyperia-npcs-v1");
  });

  it("handles refs with nested slashes (uses the last)", () => {
    expect(extractAssetPackId({ assetRef: "@scope/pack/subdir/asset" })).toBe(
      "@scope/pack/subdir",
    );
  });

  it("handles null entries gracefully", () => {
    expect(extractAssetPackId(null)).toBeNull();
    expect(extractAssetPackId(undefined)).toBeNull();
  });
});

describe("collectEntityPackRefs", () => {
  it("returns empty array on an empty plan", () => {
    expect(collectEntityPackRefs(createEmptyOnboardingPlan())).toEqual([]);
  });

  it("collects refs across all 9 entity-bearing slots", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      npcs: [{ assetRef: "@scope/npcs/shop" }],
      mobSpawns: [{ assetRef: "@scope/mobs/goblin" }],
      resources: [{ assetRef: "@scope/trees/oak" }],
      stations: [{ assetRef: "@scope/stations/anvil" }],
      teleports: [{ assetRef: "@scope/teleports/lodestone" }],
      pois: [{ assetRef: "@scope/pois/shrine" }],
      dangerSources: [{ assetRef: "@scope/danger/lair" }],
      waterBodies: [{ assetRef: "@scope/water/river" }],
      mines: [{ assetRef: "@scope/mines/copper" }],
    };
    const refs = collectEntityPackRefs(plan);
    expect(refs).toEqual([
      "@scope/npcs",
      "@scope/mobs",
      "@scope/trees",
      "@scope/stations",
      "@scope/teleports",
      "@scope/pois",
      "@scope/danger",
      "@scope/water",
      "@scope/mines",
    ]);
  });

  it("skips entries without an assetRef", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      npcs: [{ assetRef: "@scope/npcs/shop" }, { id: "no-ref" }],
    };
    expect(collectEntityPackRefs(plan)).toEqual(["@scope/npcs"]);
  });

  it("does not include zones / quests / roads (no assetRef expected)", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      zones: [{ id: "z" }],
      quests: [{ id: "q" }],
      roads: [{ id: "r" }],
    };
    // These slots aren't walked since they don't carry assetRef.
    expect(collectEntityPackRefs(plan)).toEqual([]);
  });

  it("emits duplicates when multiple entries reference the same pack", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      npcs: [
        { assetRef: "@scope/npcs/shop" },
        { assetRef: "@scope/npcs/guard" },
      ],
    };
    expect(collectEntityPackRefs(plan)).toEqual(["@scope/npcs", "@scope/npcs"]);
  });
});

describe("resolvePlanPackIds", () => {
  it("returns empty Set on an empty plan with no extras", () => {
    const out = resolvePlanPackIds(createEmptyOnboardingPlan());
    expect(out.size).toBe(0);
  });

  it("includes plan.assetPackIds (explicit installs)", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      assetPackIds: ["@hyperforge/content-pack-tropical-v1"],
    };
    const out = resolvePlanPackIds(plan);
    expect(out.has("@hyperforge/content-pack-tropical-v1")).toBe(true);
  });

  it("includes entity ref prefixes", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      npcs: [{ assetRef: "@scope/npcs/shop" }],
    };
    expect(resolvePlanPackIds(plan).has("@scope/npcs")).toBe(true);
  });

  it("merges in caller-provided extras", () => {
    const plan = createEmptyOnboardingPlan();
    const out = resolvePlanPackIds(plan, [
      "@hyperforge/asset-pack-hyperia-trees-v1",
    ]);
    expect(out.has("@hyperforge/asset-pack-hyperia-trees-v1")).toBe(true);
  });

  it("dedups across all three sources", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      assetPackIds: ["@scope/shared"],
      npcs: [{ assetRef: "@scope/shared/npc" }],
    };
    const out = resolvePlanPackIds(plan, ["@scope/shared"]);
    expect(out.size).toBe(1);
    expect(out.has("@scope/shared")).toBe(true);
  });

  it("returns a Set the caller can union with further", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      assetPackIds: ["@scope/a"],
    };
    const out = resolvePlanPackIds(plan);
    out.add("@scope/b");
    expect(out.has("@scope/b")).toBe(true);
  });
});
