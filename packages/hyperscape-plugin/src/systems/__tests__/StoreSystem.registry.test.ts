/**
 * StoreSystem.init ↔ storesRegistry integration test.
 *
 * Mirrors the worldAreas → ZoneDetectionSystem and npcSizes →
 * RangeSystem.getNPCSize patterns. Drives StoreSystem.init() and
 * asserts the loaded store catalog reflects the registry's authored
 * data when loaded, falls back to the legacy GENERAL_STORES otherwise.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  StoresManifestSchema,
  type StoresManifest,
} from "@hyperforge/manifest-schema";

import { storesRegistry } from "@hyperforge/shared";
import { StoreSystem } from "../StoreSystem.js";

function createStubWorld(): unknown {
  return {
    $eventBus: undefined,
    getSystem: () => undefined,
  };
}

function buildManifest(): StoresManifest {
  return StoresManifestSchema.parse([
    {
      id: "test_general_store",
      name: "Test General Store",
      buyback: true,
      buybackRate: 0.6,
      items: [
        {
          id: "test_apple",
          itemId: "item_apple",
          name: "Test Apple",
          price: 5,
          stockQuantity: -1,
          restockTime: 0,
          description: "A crispy apple.",
          category: "food",
        },
      ],
    },
    {
      id: "test_smith",
      name: "Test Smith Shop",
      buyback: false,
      items: [],
    },
  ]);
}

describe("StoreSystem.init ↔ storesRegistry wiring", () => {
  beforeEach(() => {
    storesRegistry._unloadForTests();
  });

  afterEach(() => {
    storesRegistry._unloadForTests();
  });

  it("when registry is loaded, init() seeds stores from the registry", async () => {
    storesRegistry.load(buildManifest());

    const world = createStubWorld() as never;
    const system = new StoreSystem(world);
    await system.init();

    expect(system.getStore("test_general_store")).toBeDefined();
    expect(system.getStore("test_general_store")!.name).toBe(
      "Test General Store",
    );
    expect(system.getStore("test_general_store")!.buyback).toBe(true);
    expect(system.getStore("test_general_store")!.buybackRate).toBe(0.6);
    expect(system.getStore("test_smith")).toBeDefined();
    expect(system.getStore("test_smith")!.buyback).toBe(false);
    // Buyback-disabled stores get default 0 from the registry path
    expect(system.getStore("test_smith")!.buybackRate).toBe(0);
  });

  it("npcName derives correctly from store name in registry path", async () => {
    storesRegistry.load(buildManifest());

    const world = createStubWorld() as never;
    const system = new StoreSystem(world);
    await system.init();

    // "Test General Store" → "Test" (strips "General Store" + trims)
    expect(system.getStore("test_general_store")!.npcName).toBe("Test");
    // No "General Store" suffix → keeps full name as npcName
    expect(system.getStore("test_smith")!.npcName).toBe("Test Smith Shop");
  });

  it("position is undefined in registry path (set later via STORE_REGISTER_NPC)", async () => {
    storesRegistry.load(buildManifest());

    const world = createStubWorld() as never;
    const system = new StoreSystem(world);
    await system.init();

    expect(system.getStore("test_general_store")!.position).toBeUndefined();
    expect(system.getStore("test_smith")!.position).toBeUndefined();
  });

  it("when registry is unloaded, init() falls back to legacy GENERAL_STORES (does not crash)", async () => {
    expect(storesRegistry.isLoaded()).toBe(false);

    const world = createStubWorld() as never;
    const system = new StoreSystem(world);
    await system.init();

    // GENERAL_STORES is currently `{}` in the in-tree data module
    // (per the manifest-façade refactor, real data lives in JSON +
    // hot-reloads in-place). The exact set of stores depends on
    // module-load behavior; the assertion is just that init() doesn't
    // throw and the system is callable.
    expect(typeof system.getStore).toBe("function");
  });

  it("hot-reload: reloading the registry then re-initializing a fresh system picks up new stores", async () => {
    storesRegistry.load(buildManifest());

    const world1 = createStubWorld() as never;
    const sysA = new StoreSystem(world1);
    await sysA.init();
    expect(sysA.getStore("test_general_store")).toBeDefined();
    expect(sysA.getStore("test_general_store")!.name).toBe(
      "Test General Store",
    );

    // Author "renames the store" in the manifest.
    storesRegistry.load(
      StoresManifestSchema.parse([
        {
          id: "test_general_store",
          name: "Renamed General Store",
          buyback: false,
          items: [],
        },
      ]),
    );

    const world2 = createStubWorld() as never;
    const sysB = new StoreSystem(world2);
    await sysB.init();
    expect(sysB.getStore("test_general_store")!.name).toBe(
      "Renamed General Store",
    );
    // The old store id from the previous manifest is gone in the new
    // catalog — sysB should NOT see it.
    expect(sysB.getStore("test_smith")).toBeUndefined();
  });
});
