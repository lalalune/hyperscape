/**
 * Plugin boot integration test — boots a REAL server world (not the
 * stub the other tests use) and proves `bootServerPlugins()`
 * cooperates with it.
 *
 * What this closes that the stub-based tests (plugins.test.ts) don't:
 *   - Stubs record `.register` calls but never verify the registered
 *     system is actually retrievable via `world.getSystem(name)` and
 *     is a real instance.
 *   - A real `createServerWorld()` exercises the SystemLoader pipeline
 *     + every system's constructor, matching production.
 *   - Both game-id paths are checked against the same real-world
 *     infrastructure: under "hyperscape" the meta-plugin's migrated
 *     systems are retrievable; under "shooter-demo" they are not.
 *
 * This test does NOT call `world.init()` — that requires a database,
 * storage, and asset URLs, which this suite is not in the business
 * of providing. Registration (what `bootServerPlugins` controls) and
 * init (what `world.init` controls) are separable concerns; this
 * test proves registration works against a real world.
 */

import { afterEach, describe, expect, it } from "vitest";

import { createServerWorld, type World } from "@hyperforge/shared";

import {
  _resetServerPluginServicesForTests,
  bootServerPlugins,
} from "../plugins.js";

describe("bootServerPlugins — integration against real createServerWorld()", () => {
  let world: World | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any = null;

  afterEach(async () => {
    if (session) {
      await session.stop();
      session = null;
    }
    world = null;
    _resetServerPluginServicesForTests();
  });

  it(
    "hyperscape game id registers migrated systems on the real world",
    { timeout: 30_000 },
    async () => {
      world = await createServerWorld();
      session = await bootServerPlugins(world, "hyperscape");

      expect(session.failedPackages).toEqual([]);
      expect(session.unresolvable).toEqual([]);
      expect(session.records).toHaveLength(3);

      // The meta-plugin's onEnable ran world.register(name, Ctor) for
      // each migrated system. Assert the RESULT — that each name
      // resolves back to a real instance.
      const migrated = [
        "mob-death",
        "gravestone-loot",
        "tanning",
        "smithing",
        "smelting",
        "crafting",
        "fletching",
        "runecrafting",
      ];
      for (const name of migrated) {
        expect(
          world.getSystem(name),
          `expected world.getSystem("${name}") to return a system under hyperscape`,
        ).toBeTruthy();
      }
    },
  );

  it(
    "shooter-demo game id produces a real world WITHOUT hyperscape-meta systems",
    { timeout: 30_000 },
    async () => {
      world = await createServerWorld();
      session = await bootServerPlugins(world, "shooter-demo");

      expect(session.failedPackages).toEqual([]);
      expect(session.unresolvable).toEqual([]);
      // Shooter-demo set is just combat + shooter-demo, no skills,
      // no hyperscape meta-plugin.
      expect(session.records).toHaveLength(2);

      const startedIds = session.records
        .map((r: { manifest: { id: string } }) => r.manifest.id)
        .sort();
      expect(startedIds).toEqual(
        ["com.hyperforge.combat", "com.hyperforge.plugin-shooter-demo"].sort(),
      );

      // The systems the hyperscape meta-plugin would have registered
      // via its onEnable are NOT on the world under shooter-demo.
      // Direct proof: flipping the env var changes what the real
      // world contains, not just what a stub records.
      expect(world.getSystem("mob-death")).toBeFalsy();
      expect(world.getSystem("gravestone-loot")).toBeFalsy();
      expect(world.getSystem("tanning")).toBeFalsy();
      expect(world.getSystem("smithing")).toBeFalsy();
      expect(world.getSystem("runecrafting")).toBeFalsy();

      // Note: other Hyperscape-specific systems still live in shared/
      // and register via SystemLoader regardless of game id. Those
      // will remain on the world until migration finishes. That's a
      // known gap, not a bug — this test only asserts the behavior
      // the plugin boot layer controls.
    },
  );

  it(
    "session.stop() unregisters migrated systems from the real world",
    { timeout: 30_000 },
    async () => {
      world = await createServerWorld();
      session = await bootServerPlugins(world, "hyperscape");

      expect(world.getSystem("mob-death")).toBeTruthy();
      expect(world.getSystem("tanning")).toBeTruthy();
      expect(world.getSystem("smithing")).toBeTruthy();

      await session.stop();
      session = null;

      // The meta-plugin's scope disposers call `world.unregister(name)`,
      // which now exists on the World class (added in the same commit
      // this test upgrades for). Post-stop, plugin-registered systems
      // must no longer resolve through getSystem.
      expect(world.getSystem("mob-death")).toBeFalsy();
      expect(world.getSystem("tanning")).toBeFalsy();
      expect(world.getSystem("smithing")).toBeFalsy();
    },
  );

  it(
    "World.unregister is idempotent and safe against unknown keys",
    { timeout: 30_000 },
    async () => {
      world = await createServerWorld();

      // Unknown key — no-op, no throw.
      expect(() =>
        (world as unknown as { unregister: (k: string) => void }).unregister(
          "never-registered-key",
        ),
      ).not.toThrow();

      // Register via plugin, unregister twice in a row (first by
      // session.stop's scope disposer, second by a direct call).
      session = await bootServerPlugins(world, "hyperscape");
      expect(world.getSystem("mob-death")).toBeTruthy();

      await session.stop();
      session = null;

      expect(world.getSystem("mob-death")).toBeFalsy();
      // Second unregister of the same key — still a no-op.
      expect(() =>
        (world as unknown as { unregister: (k: string) => void }).unregister(
          "mob-death",
        ),
      ).not.toThrow();
      expect(world.getSystem("mob-death")).toBeFalsy();
    },
  );

  it(
    "manifest-shaped plugin id array boots a custom subset (Phase 0.2b)",
    { timeout: 30_000 },
    async () => {
      // Mirrors what `initializeWorld` will pass when launched with
      // `--projectManifest <path>` — the manifest's `boot.plugins`
      // array drives the plugin set instead of the env-var gameId.
      // Use the combat+skills subset (without hyperscape) to prove the
      // manifest path drops into the existing plugin-id-array overload
      // and obeys an arbitrary boot.plugins value — not pinned to the
      // canonical hyperscape set.
      world = await createServerWorld();
      session = await bootServerPlugins(world, [
        "@hyperforge/combat",
        "@hyperforge/skills",
      ]);

      expect(session.failedPackages).toEqual([]);
      expect(session.unresolvable).toEqual([]);
      expect(session.records).toHaveLength(2);

      // Hyperscape-only migrated systems are absent — proves the array
      // is honored, not silently replaced with "hyperscape" defaults.
      expect(world.getSystem("mob-death")).toBeFalsy();
      expect(world.getSystem("tanning")).toBeFalsy();
    },
  );

  it(
    "manifest plugin id array boots an empty server when the list is empty (Phase 0.2b)",
    { timeout: 30_000 },
    async () => {
      // Decoupling rule (PLAN_AAA_UE5_PARITY): an empty `boot.plugins`
      // array MUST boot an empty-shell world — no Hyperia by default.
      // Proves the runtime obeys a blank-canvas project manifest.
      world = await createServerWorld();
      session = await bootServerPlugins(world, []);

      expect(session.failedPackages).toEqual([]);
      expect(session.unresolvable).toEqual([]);
      expect(session.records).toHaveLength(0);

      // No hyperscape systems registered.
      expect(world.getSystem("mob-death")).toBeFalsy();
      expect(world.getSystem("tanning")).toBeFalsy();
    },
  );
});
