/**
 * loadHyperiaManifestsSync — tests.
 *
 * Phase B0'.E. Verifies the plugin-side loader walks the workspace
 * for `world-areas.json` and populates `worldAreasRegistry`. We
 * don't fixture a fake manifests dir here — the real one in
 * `packages/server/world/assets/manifests/` is the canonical path
 * the loader resolves to in this monorepo's dev environment, and
 * the file is checked in.
 *
 * Negative path coverage (registry empty when manifests dir
 * missing) lives in the unit-test for `findManifestsDir` once it's
 * extracted; today we cover the happy path against the real file.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  biomesRegistry,
  npcDefinitionsRegistry,
  worldAreasRegistry,
} from "@hyperforge/shared";
import { loadHyperiaManifestsSync } from "../loadHyperiaManifests.js";

describe("loadHyperiaManifestsSync", () => {
  beforeEach(() => {
    // Tests share the global registries; clear so each test sees
    // a known-empty starting state.
    worldAreasRegistry._unloadForTests();
    (
      biomesRegistry as unknown as { _unloadForTests?: () => void }
    )._unloadForTests?.();
    (
      npcDefinitionsRegistry as unknown as { _unloadForTests?: () => void }
    )._unloadForTests?.();
  });

  afterEach(() => {
    worldAreasRegistry._unloadForTests();
    (
      biomesRegistry as unknown as { _unloadForTests?: () => void }
    )._unloadForTests?.();
    (
      npcDefinitionsRegistry as unknown as { _unloadForTests?: () => void }
    )._unloadForTests?.();
  });

  it("populates worldAreasRegistry from the workspace world-areas.json", () => {
    expect(worldAreasRegistry.isLoaded()).toBe(false);

    loadHyperiaManifestsSync();

    // Real fixture (the checked-in `packages/server/world/assets/manifests/world-areas.json`)
    // declares multiple world areas. After the load the registry
    // is loaded and contains at least one area.
    expect(worldAreasRegistry.isLoaded()).toBe(true);
    expect(worldAreasRegistry.all().length).toBeGreaterThan(0);
  });

  it("populates biomesRegistry from biomes.json (B2)", () => {
    loadHyperiaManifestsSync();
    expect(biomesRegistry.all().length).toBeGreaterThan(0);
  });

  it("populates npcDefinitionsRegistry from npcs.json (B2)", () => {
    loadHyperiaManifestsSync();
    expect(npcDefinitionsRegistry.all().length).toBeGreaterThan(0);
  });

  it("is idempotent — second call replaces the registries without errors", () => {
    loadHyperiaManifestsSync();
    const firstWorldAreas = worldAreasRegistry.all().length;
    const firstBiomes = biomesRegistry.all().length;
    const firstNpcs = npcDefinitionsRegistry.all().length;
    loadHyperiaManifestsSync();
    expect(worldAreasRegistry.all().length).toBe(firstWorldAreas);
    expect(biomesRegistry.all().length).toBe(firstBiomes);
    expect(npcDefinitionsRegistry.all().length).toBe(firstNpcs);
  });
});
