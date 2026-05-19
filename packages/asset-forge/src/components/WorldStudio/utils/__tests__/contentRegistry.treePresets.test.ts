/**
 * contentRegistry — tree preset bridge to shared.
 *
 * Phase 3.5 follow-up pins the wire from
 * `setContentPackContent({ treePresets })` to shared's
 * `setActiveTreePresets()`. The bridge keeps the live-game
 * prewarm in lockstep with installed content packs: any change
 * to the content pack's preset list propagates to the engine's
 * post-PhysX tree cache prewarm without further callers.
 *
 * Test isolates the registry side-effect by reading back
 * through `getActiveContentPackTreePresets()` (asset-forge
 * side) and `getActiveTreePresets()` (shared side) — proving
 * the two stores stay in sync.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  setContentPackContent,
  getActiveContentPackTreePresets,
  _clearContentPackContent,
} from "../contentRegistry";
import {
  getActiveTreePresets,
  setActiveTreePresets,
  TREE_PRESETS,
} from "@hyperforge/shared";

beforeEach(() => {
  _clearContentPackContent();
  setActiveTreePresets(TREE_PRESETS);
});

afterEach(() => {
  _clearContentPackContent();
  setActiveTreePresets(TREE_PRESETS);
});

describe("contentRegistry — treePresets bridge to shared", () => {
  it("storing treePresets via setContentPackContent forwards to shared", () => {
    setContentPackContent({ treePresets: ["quakingAspen", "blackOak"] });
    expect(getActiveTreePresets()).toEqual(["quakingAspen", "blackOak"]);
  });

  it("getActiveContentPackTreePresets returns the same union the shared side sees", () => {
    setContentPackContent({
      treePresets: ["quakingAspen", "blackOak", "weepingWillow"],
    });
    const local = getActiveContentPackTreePresets();
    const shared = getActiveTreePresets();
    expect(local).toEqual(shared);
  });

  it("replacing the list overwrites both sides (no merge)", () => {
    setContentPackContent({ treePresets: ["quakingAspen"] });
    setContentPackContent({ treePresets: ["arcticPine"] });
    expect(getActiveContentPackTreePresets()).toEqual(["arcticPine"]);
    expect(getActiveTreePresets()).toEqual(["arcticPine"]);
  });

  it("empty array clears both sides", () => {
    setContentPackContent({ treePresets: ["quakingAspen"] });
    setContentPackContent({ treePresets: [] });
    expect(getActiveContentPackTreePresets()).toEqual([]);
    expect(getActiveTreePresets()).toEqual([]);
  });

  it("dedups duplicates inside a single setContentPackContent call (Set-backed store)", () => {
    setContentPackContent({
      treePresets: ["quakingAspen", "blackOak", "quakingAspen"],
    });
    expect(getActiveContentPackTreePresets()).toHaveLength(2);
    expect(new Set(getActiveContentPackTreePresets())).toEqual(
      new Set(["quakingAspen", "blackOak"]),
    );
  });

  it("omitting treePresets leaves both sides untouched", () => {
    setContentPackContent({ treePresets: ["quakingAspen"] });
    // Update an unrelated field. Tree presets should NOT change.
    setContentPackContent({ biomes: [] });
    expect(getActiveTreePresets()).toEqual(["quakingAspen"]);
    expect(getActiveContentPackTreePresets()).toEqual(["quakingAspen"]);
  });

  it("_clearContentPackContent clears the local set (shared side keeps prior value until next set)", () => {
    setContentPackContent({ treePresets: ["quakingAspen"] });
    _clearContentPackContent();
    expect(getActiveContentPackTreePresets()).toEqual([]);
    // Shared side intentionally NOT cleared by _clear — callers
    // use _clear for test reset only; production resets via
    // setContentPackContent({ treePresets: [] }).
  });
});
