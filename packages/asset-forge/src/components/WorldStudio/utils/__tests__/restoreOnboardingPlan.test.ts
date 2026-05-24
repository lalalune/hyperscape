/**
 * Tests for `restoreOnboardingPlan` — the helper that hydrates an
 * `OnboardingPlan` from a partially-persisted draft. Pins the
 * normalization contract for the three field-shape patterns the
 * dialog persists (required arrays default to [], nullable arrays
 * default to null, nullable scalars default to null) so a future
 * cut can't silently drop a field while preserving the surface
 * shape.
 */

import { describe, expect, it } from "vitest";
import { restoreOnboardingPlan } from "../restoreOnboardingPlan";
import {
  createEmptyOnboardingPlan,
  type OnboardingPlan,
} from "../onboardingPlan";

describe("restoreOnboardingPlan", () => {
  it("returns a fresh empty plan when input is null", () => {
    expect(restoreOnboardingPlan(null)).toEqual(createEmptyOnboardingPlan());
  });

  it("returns a fresh empty plan when input is undefined", () => {
    expect(restoreOnboardingPlan(undefined)).toEqual(
      createEmptyOnboardingPlan(),
    );
  });

  it("returns a distinct object each call (no shared mutable state)", () => {
    const a = restoreOnboardingPlan(null);
    const b = restoreOnboardingPlan(null);
    expect(a).not.toBe(b);
    expect(a.npcs).not.toBe(b.npcs);
  });

  it("fills missing required-array fields with []", () => {
    const restored = restoreOnboardingPlan({});
    expect(restored.npcs).toEqual([]);
    expect(restored.mobSpawns).toEqual([]);
    expect(restored.quests).toEqual([]);
    expect(restored.zones).toEqual([]);
    expect(restored.resources).toEqual([]);
    expect(restored.roads).toEqual([]);
    expect(restored.pois).toEqual([]);
    expect(restored.dangerSources).toEqual([]);
    expect(restored.waterBodies).toEqual([]);
    expect(restored.musicZones).toEqual([]);
    expect(restored.ambientZones).toEqual([]);
    expect(restored.sfxTriggers).toEqual([]);
    expect(restored.mines).toEqual([]);
  });

  it("fills missing nullable-array fields with null (not [])", () => {
    const restored = restoreOnboardingPlan({});
    expect(restored.pluginIds).toBeNull();
    expect(restored.assetPackIds).toBeNull();
  });

  it("fills missing nullable-scalar fields with null", () => {
    const restored = restoreOnboardingPlan({});
    expect(restored.terrainConfig).toBeNull();
    expect(restored.wildernessBoundary).toBeNull();
    expect(restored.uiPack).toBeNull();
  });

  it("shallow-clones present arrays so mutations don't tamper with the input", () => {
    const npcs = [{ id: "a" }, { id: "b" }];
    const restored = restoreOnboardingPlan({ npcs });
    expect(restored.npcs).toEqual(npcs);
    expect(restored.npcs).not.toBe(npcs);

    // Mutating the restored array must not affect the source.
    restored.npcs.push({ id: "c" });
    expect(npcs).toHaveLength(2);
  });

  it("preserves nullable arrays when present", () => {
    const restored = restoreOnboardingPlan({
      pluginIds: ["@hyperforge/hyperscape"],
      assetPackIds: ["@hyperforge/asset-pack-hyperia-trees-v1"],
    });
    expect(restored.pluginIds).toEqual(["@hyperforge/hyperscape"]);
    expect(restored.assetPackIds).toEqual([
      "@hyperforge/asset-pack-hyperia-trees-v1",
    ]);
  });

  it("treats non-array values for array fields as missing", () => {
    // A malformed draft could persist a primitive where an array
    // is expected (devtools edit, schema drift). Don't crash —
    // fall back to the default for the field's shape.
    const restored = restoreOnboardingPlan({
      npcs: "not an array" as unknown as never,
      pluginIds: 42 as unknown as never,
    });
    expect(restored.npcs).toEqual([]);
    expect(restored.pluginIds).toBeNull();
  });

  it("preserves scalar payloads when present", () => {
    const terrainConfig = { seed: 1234, size: 50 };
    const wildernessBoundary = { tiles: [[0, 0]] };
    const uiPack = { id: "ui-hyperia-v1" };
    const restored = restoreOnboardingPlan({
      terrainConfig,
      wildernessBoundary,
      uiPack,
    });
    expect(restored.terrainConfig).toBe(terrainConfig);
    expect(restored.wildernessBoundary).toBe(wildernessBoundary);
    expect(restored.uiPack).toBe(uiPack);
  });

  it("round-trips a fully-populated plan unchanged in field values", () => {
    const populated: OnboardingPlan = {
      terrainConfig: { seed: 9999 },
      pluginIds: ["@hyperforge/hyperscape"],
      assetPackIds: ["pack-a", "pack-b"],
      npcs: [{ id: "n1" }],
      mobSpawns: [{ id: "m1" }],
      quests: [{ id: "q1" }],
      assets: [{ id: "a1" }],
      zones: [{ id: "z1" }],
      resources: [{ id: "r1" }],
      stations: [{ id: "s1" }],
      teleports: [{ id: "t1" }],
      roads: [{ id: "ro1" }],
      pois: [{ id: "p1" }],
      dangerSources: [{ id: "d1" }],
      waterBodies: [{ id: "w1" }],
      musicZones: [{ id: "mz1" }],
      ambientZones: [{ id: "az1" }],
      sfxTriggers: [{ id: "sf1" }],
      mines: [{ id: "mi1" }],
      wildernessBoundary: { tiles: [[1, 1]] },
      uiPack: { id: "ui1" },
    };
    expect(restoreOnboardingPlan(populated)).toEqual(populated);
  });
});
