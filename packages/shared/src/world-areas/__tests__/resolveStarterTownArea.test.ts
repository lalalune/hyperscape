/**
 * resolveStarterTownArea — shared registry-prefer-fallback helper.
 *
 * Pure unit test against the helper. Consumer wiring (PlayerDeathSystem,
 * InitializationManager) inherits these semantics by construction —
 * no need to drive the full system stack to assert the registry-prefer
 * branch behaves correctly.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WorldAreasManifestSchema } from "@hyperforge/manifest-schema";

import { resolveStarterTownArea, worldAreasRegistry } from "../index.js";
// DataManager runtime-populates STARTER_TOWNS via Object.assign at
// init (lines 1126 / 1549). Earlier tests in the same vitest run
// can leave the map populated, which breaks the "in-tree empty"
// baseline this file pins. Import the mutable Record and clear it
// in beforeEach to isolate.
import { STARTER_TOWNS } from "../../data/world-areas.js";

function emptyManifest() {
  return WorldAreasManifestSchema.parse({
    starterTowns: {},
    level1Areas: {},
    level2Areas: {},
    level3Areas: {},
    specialAreas: {},
  });
}

function manifestWithCentralHaven() {
  return WorldAreasManifestSchema.parse({
    starterTowns: {
      central_haven: {
        id: "central_haven",
        name: "Central Haven (registry override)",
        description: "Authored override of the starter town.",
        difficultyLevel: 0,
        bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
        biomeType: "grassland",
        safeZone: true,
      },
    },
    level1Areas: {},
    level2Areas: {},
    level3Areas: {},
    specialAreas: {},
  });
}

describe("resolveStarterTownArea", () => {
  beforeEach(() => {
    worldAreasRegistry._unloadForTests();
    // Wipe STARTER_TOWNS so the "in-tree empty" baseline holds
    // regardless of whether a sibling test in this run populated
    // it via DataManager.
    for (const key of Object.keys(STARTER_TOWNS)) {
      delete STARTER_TOWNS[key];
    }
  });

  afterEach(() => {
    worldAreasRegistry._unloadForTests();
    for (const key of Object.keys(STARTER_TOWNS)) {
      delete STARTER_TOWNS[key];
    }
  });

  it("returns undefined when registry is unloaded AND in-tree STARTER_TOWNS is empty (current baseline)", () => {
    expect(worldAreasRegistry.isLoaded()).toBe(false);
    // STARTER_TOWNS is currently `{}` in the in-tree data module, so
    // every key resolves to undefined when nothing is loaded. This
    // assertion pins the baseline so a future repopulation of
    // STARTER_TOWNS is caught here rather than in production.
    expect(resolveStarterTownArea("central_haven")).toBeUndefined();
    expect(resolveStarterTownArea("any_id")).toBeUndefined();
  });

  it("returns the registry's town when the registry is loaded and the id is known", () => {
    worldAreasRegistry.load(manifestWithCentralHaven());
    const town = resolveStarterTownArea("central_haven");
    expect(town).toBeDefined();
    expect(town!.id).toBe("central_haven");
    expect(town!.name).toBe("Central Haven (registry override)");
    expect(town!.bounds).toEqual({
      minX: -10,
      maxX: 10,
      minZ: -10,
      maxZ: 10,
    });
  });

  it("returns undefined (NOT a fallback) when the registry is loaded but the id is missing", () => {
    // Critical contract: a loaded-but-missing registry is an authored
    // choice — the manifest doesn't define this town. We must not
    // silently fall back to STARTER_TOWNS, even if STARTER_TOWNS has
    // an entry, because that would let the in-tree constant override
    // an explicit authored deletion.
    worldAreasRegistry.load(emptyManifest());
    expect(worldAreasRegistry.isLoaded()).toBe(true);
    expect(resolveStarterTownArea("central_haven")).toBeUndefined();
    expect(resolveStarterTownArea("anything_else")).toBeUndefined();
  });

  it("hot-reload semantics: town resolution flips when the registry is reloaded", () => {
    // Pre-load: nothing.
    expect(resolveStarterTownArea("central_haven")).toBeUndefined();

    // Author "publishes" central_haven via the registry.
    worldAreasRegistry.load(manifestWithCentralHaven());
    const before = resolveStarterTownArea("central_haven");
    expect(before).toBeDefined();
    expect(before!.bounds.maxX).toBe(10);

    // Author "moves the town" by loading a new manifest with different bounds.
    worldAreasRegistry.load(
      WorldAreasManifestSchema.parse({
        starterTowns: {
          central_haven: {
            id: "central_haven",
            name: "Central Haven (moved)",
            description: "Same id, new bounds.",
            difficultyLevel: 0,
            bounds: { minX: 100, maxX: 200, minZ: 100, maxZ: 200 },
            biomeType: "grassland",
            safeZone: true,
          },
        },
        level1Areas: {},
        level2Areas: {},
        level3Areas: {},
        specialAreas: {},
      }),
    );
    const after = resolveStarterTownArea("central_haven");
    expect(after).toBeDefined();
    expect(after!.bounds.maxX).toBe(200);
    expect(after!.name).toBe("Central Haven (moved)");
  });

  it("returns undefined for unknown ids regardless of which town the registry has", () => {
    worldAreasRegistry.load(manifestWithCentralHaven());
    expect(resolveStarterTownArea("nonexistent_town")).toBeUndefined();
  });
});
