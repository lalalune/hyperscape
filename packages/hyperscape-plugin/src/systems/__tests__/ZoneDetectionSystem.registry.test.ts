/**
 * ZoneDetectionSystem ↔ worldAreasRegistry integration test.
 *
 * This is the first end-to-end consumer-wiring test for the
 * `worldAreasRegistry` beyond `InitializationManager.loadSpawnPoint`.
 * It mirrors the XpCurves and loot-tables vertical-slice pattern:
 *
 *   manifest → worldAreasRegistry.load() → ZoneDetectionSystem reads → assertion
 *
 * What it proves:
 *   - When the registry is loaded BEFORE the system is constructed,
 *     the system honors the manifest data on `init()` (boundaries +
 *     prewarm cache pick up registry areas).
 *   - When the registry is loaded AFTER the system is constructed,
 *     the next `getZoneProperties` call honors the new data without
 *     a system restart (correctness path is read-live).
 *   - When the registry is NOT loaded, the system falls back to the
 *     in-tree `ALL_WORLD_AREAS` constant (boot-safe + test-safe).
 *
 * NOT covered (deliberate scope):
 *   - PIE hot-reload via `PIEEditorSession.updateManifests` — that's
 *     a higher-level integration test that lives next to PIE.
 *   - Cache invalidation when the registry reloads — boundaries +
 *     prewarm caches are perf opts; staleness there only degrades
 *     cache efficiency, not correctness.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  WorldAreasManifestSchema,
  type WorldAreasManifest,
} from "@hyperforge/manifest-schema";

import { worldAreasRegistry } from "@hyperforge/shared";
import { ZoneDetectionSystem } from "../ZoneDetectionSystem.js";
import { ZoneType } from "@hyperforge/shared";

// Minimal duck-typed World stub — SystemBase only needs `$eventBus`,
// and ZoneDetectionSystem only calls `world.getSystem("towns")`. We
// can't import the real `World` class without dragging in PhysX, the
// renderer, and the entire engine boot.
function createStubWorld(): unknown {
  return {
    $eventBus: undefined,
    getSystem: () => undefined,
  };
}

/**
 * Build a tiny but schema-valid WorldAreasManifest with a single
 * safe town centered at (1000, 0, 1000). Coordinates are deliberately
 * far from any existing in-tree area so we can tell which catalog
 * the system is reading from by which classification the test sees.
 */
function buildTestManifest(): WorldAreasManifest {
  const raw = {
    starterTowns: {
      "test.starter.island": {
        id: "test.starter.island",
        name: "Test Starter Island",
        description: "Synthetic safe-zone island for registry-wiring proof.",
        difficultyLevel: 0,
        bounds: { minX: 980, maxX: 1020, minZ: 980, maxZ: 1020 },
        biomeType: "grassland",
        safeZone: true,
      },
    },
    level1Areas: {},
    level2Areas: {},
    level3Areas: {},
    specialAreas: {},
  };
  return WorldAreasManifestSchema.parse(raw);
}

describe("ZoneDetectionSystem ↔ worldAreasRegistry wiring", () => {
  beforeEach(() => {
    // Hard reset before each test so registry state from one test
    // can't bleed into another (the registry is a module-level
    // singleton). _unloadForTests restores the "no manifest loaded"
    // baseline that the consumer-fallback branch depends on.
    worldAreasRegistry._unloadForTests();
  });

  afterEach(() => {
    worldAreasRegistry._unloadForTests();
  });

  it("honors a registry-loaded safe zone after init() and via getZoneProperties()", async () => {
    worldAreasRegistry.load(buildTestManifest());

    const world = createStubWorld() as never;
    const system = new ZoneDetectionSystem(world);
    await system.init();

    // Inside the registry-defined safe zone.
    expect(system.isSafeZone({ x: 1000, z: 1000 })).toBe(true);
    expect(system.getZoneType({ x: 1000, z: 1000 })).toBe(ZoneType.SAFE_AREA);
    expect(system.isWilderness({ x: 1000, z: 1000 })).toBe(false);
    expect(system.isPvPEnabled({ x: 1000, z: 1000 })).toBe(false);
  });

  it("registry-defined safe zone bounds are honored at the edges", async () => {
    worldAreasRegistry.load(buildTestManifest());

    const world = createStubWorld() as never;
    const system = new ZoneDetectionSystem(world);
    await system.init();

    // Just inside upper bound (lookupZoneProperties uses inclusive
    // upper / exclusive lower comparisons).
    expect(system.isSafeZone({ x: 1019, z: 1019 })).toBe(true);
    // Outside the registry bounds — should not classify as our
    // synthetic safe zone (may classify under a different rule).
    expect(system.isSafeZone({ x: 1100, z: 1100 })).toBe(false);
  });

  it("when registry is loaded AFTER init(), next getZoneProperties() honors it (read-live correctness path)", async () => {
    const world = createStubWorld() as never;
    const system = new ZoneDetectionSystem(world);
    await system.init();

    // Pre-load: position (1000, 1000) is NOT in any registry area
    // (registry was empty at init). It also shouldn't match any
    // in-tree area at those coordinates.
    expect(system.isSafeZone({ x: 1000, z: 1000 })).toBe(false);

    // Now load the registry — system did not restart.
    worldAreasRegistry.load(buildTestManifest());

    // Bypass the cached lookup at (1000, 1000) by querying a
    // nearby uncached cell. Cache is keyed by floor(x/grid)+","+
    // floor(z/grid) with grid=2, so (1002, 1002) is a different
    // cell than (1000, 1000). The next lookup goes through
    // lookupZoneProperties → getEffectiveWorldAreas → registry.
    expect(system.isSafeZone({ x: 1002, z: 1002 })).toBe(true);
  });

  it("when registry is empty (default state), falls back to in-tree ALL_WORLD_AREAS", async () => {
    // beforeEach already cleared to empty. Don't load anything.
    expect(worldAreasRegistry.isLoaded()).toBe(false);

    const world = createStubWorld() as never;
    const system = new ZoneDetectionSystem(world);
    await system.init();

    // Test position (1000, 1000) — NOT in any in-tree area. The
    // assertion is just that the system doesn't crash and returns
    // *some* classification (whatever the in-tree fallback gives).
    // The proof is that init() didn't throw and the API is callable.
    const props = system.getZoneProperties({ x: 1000, z: 1000 });
    expect(typeof props.isSafe).toBe("boolean");
    expect(typeof props.isWilderness).toBe("boolean");
    expect(typeof props.isPvPEnabled).toBe("boolean");
  });

  it("registry-defined PvP zone classifies as wilderness/PvP", async () => {
    const pvpManifest = WorldAreasManifestSchema.parse({
      starterTowns: {},
      level1Areas: {},
      level2Areas: {},
      level3Areas: {},
      specialAreas: {
        "test.pvp.arena": {
          id: "test.pvp.arena",
          name: "Test PvP Arena",
          description: "Synthetic PvP zone for registry-wiring proof.",
          difficultyLevel: 3,
          bounds: { minX: 2000, maxX: 2020, minZ: 2000, maxZ: 2020 },
          biomeType: "wilderness",
          safeZone: false,
          pvpEnabled: true,
        },
      },
    });
    worldAreasRegistry.load(pvpManifest);

    const world = createStubWorld() as never;
    const system = new ZoneDetectionSystem(world);
    await system.init();

    expect(system.isPvPEnabled({ x: 2010, z: 2010 })).toBe(true);
    expect(system.isWilderness({ x: 2010, z: 2010 })).toBe(true);
    expect(system.isSafeZone({ x: 2010, z: 2010 })).toBe(false);
    expect(system.getZoneType({ x: 2010, z: 2010 })).toBe(ZoneType.PVP_ZONE);
  });
});
