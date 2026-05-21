/**
 * Phase 5.1 — triple-plugin coexistence acceptance proof.
 *
 * The AAA framework promise: an n-plugin gameplay system where
 * each plugin contributes its own abilities + widgets +
 * entityTypes in independent sessions WITHOUT mutual
 * contamination.
 *
 * This test boots THREE separate gameplay sessions using the
 * PIE plugin resolver — combat + shooter-demo, combat +
 * arctic-survival, and combat + both — and verifies:
 *
 *   1. Each single-plugin session sees only its own abilities.
 *   2. The two-plugin session sees both abilities, with no
 *      duplicates or transitive-dependency double-counting
 *      (combat appears exactly once even though it's a dep of
 *      both plugins).
 *   3. Stopping one session never touches the others — proves
 *      no shared module-scope state on the registry.
 *
 * Companion to `pluginBoot.secondGame.test.ts` (which proves
 * the resolver returns the right module *list*) — this file
 * proves the modules actually *run* without leaking when
 * composed.
 */

import { describe, expect, it } from "vitest";

import {
  startPluginSessionFromModules,
  type LoadedPluginModule,
  type PluginContextBase,
} from "@hyperforge/gameplay-framework";
import {
  combatPluginFactory,
  createCombatAbilityService,
  type CombatAbilityService,
  type CombatContext,
} from "@hyperforge/combat";

import { resolvePluginModules } from "../pluginBoot";

const SHOOTER_DEMO_ID = "com.hyperforge.plugin-shooter-demo";
const ARCTIC_SURVIVAL_ID = "com.hyperforge.plugin-arctic-survival";
const SHOOT_ABILITY_ID = "demo-shoot";
const FROST_BLAST_ABILITY_ID = "arctic-frost-blast";

/**
 * Helper — boot a PIE session for a given plugin id list, with
 * an isolated CombatAbilityService and a registry for widget
 * registrations. Returns the session handle + service + widget
 * registrations so the caller can assert + stop().
 */
async function bootStack(pluginIds: ReadonlyArray<string>) {
  const service = createCombatAbilityService();
  const widgets: unknown[] = [];
  const modules = resolvePluginModules(pluginIds) as ReadonlyArray<
    LoadedPluginModule<PluginContextBase>
  >;
  const session = await startPluginSessionFromModules(modules, {
    contextFactory: ({ pluginId, scope }) => {
      const ctx: CombatContext & PluginContextBase = {
        pluginId,
        scope,
        registerAbility(ability) {
          service.registerAbility(ability);
          scope.register(() => service.unregisterAbility(ability.id));
        },
        widgets: {
          register(contribution) {
            widgets.push(contribution);
          },
        },
      };
      return ctx as PluginContextBase;
    },
  });
  return { session, service, widgets, modules };
}

describe("Phase 5.1 — triple-plugin coexistence (combat + shooter + arctic)", () => {
  it("shooter-demo stack contains demo-shoot, NOT arctic-frost-blast", async () => {
    const { session, service, widgets } = await bootStack([SHOOTER_DEMO_ID]);
    try {
      expect(service.getAbility(SHOOT_ABILITY_ID)).toBeDefined();
      expect(service.getAbility(FROST_BLAST_ABILITY_ID)).toBeUndefined();
      // One widget — the crosshair.
      expect(widgets).toHaveLength(1);
    } finally {
      await session.stop();
    }
  });

  it("arctic-survival stack contains arctic-frost-blast, NOT demo-shoot", async () => {
    const { session, service, widgets } = await bootStack([ARCTIC_SURVIVAL_ID]);
    try {
      expect(service.getAbility(FROST_BLAST_ABILITY_ID)).toBeDefined();
      expect(service.getAbility(SHOOT_ABILITY_ID)).toBeUndefined();
      // One widget — the temperature gauge.
      expect(widgets).toHaveLength(1);
    } finally {
      await session.stop();
    }
  });

  it("dual-plugin stack registers BOTH abilities + BOTH widgets", async () => {
    const { session, service, widgets } = await bootStack([
      SHOOTER_DEMO_ID,
      ARCTIC_SURVIVAL_ID,
    ]);
    try {
      expect(service.getAbility(SHOOT_ABILITY_ID)).toBeDefined();
      expect(service.getAbility(FROST_BLAST_ABILITY_ID)).toBeDefined();
      // Crosshair + temperature gauge.
      expect(widgets).toHaveLength(2);
      // 2 plugin abilities (combat-itself ships none in this test
      // because combatPluginFactory(DEFAULT_COMBAT_ABILITIES) bakes
      // them into the default factory — the resolver baked default
      // combat abilities count toward `service.list()`.
      expect(service.list().size).toBeGreaterThanOrEqual(2);
    } finally {
      await session.stop();
    }
  });

  it("combat appears exactly once when both plugins are requested (no double-load)", async () => {
    const { session, modules } = await bootStack([
      SHOOTER_DEMO_ID,
      ARCTIC_SURVIVAL_ID,
    ]);
    try {
      const combatCount = modules.filter(
        (m) => m.manifest.id === "com.hyperforge.combat",
      ).length;
      expect(combatCount).toBe(1);
    } finally {
      await session.stop();
    }
  });

  it("stopping shooter-demo session leaves arctic-survival session intact", async () => {
    // Two INDEPENDENT sessions — each owns its own combat
    // service. Stopping one must not touch the other's state.
    const shooter = await bootStack([SHOOTER_DEMO_ID]);
    const arctic = await bootStack([ARCTIC_SURVIVAL_ID]);

    try {
      // Both started populated.
      expect(shooter.service.getAbility(SHOOT_ABILITY_ID)).toBeDefined();
      expect(arctic.service.getAbility(FROST_BLAST_ABILITY_ID)).toBeDefined();

      // Stop shooter — arctic must survive unchanged.
      await shooter.session.stop();
      expect(shooter.service.getAbility(SHOOT_ABILITY_ID)).toBeUndefined();
      expect(arctic.service.getAbility(FROST_BLAST_ABILITY_ID)).toBeDefined();
    } finally {
      await arctic.session.stop();
    }
  });

  it("three sequential boot/stop cycles don't leak abilities into a fresh service", async () => {
    // Catches the "shared module-scope ability registry" bug —
    // each session boot must allocate its own service.
    for (let i = 0; i < 3; i += 1) {
      const stack = await bootStack([ARCTIC_SURVIVAL_ID]);
      expect(stack.service.getAbility(FROST_BLAST_ABILITY_ID)).toBeDefined();
      // Cycle-start: only arctic's ability + combat defaults present.
      expect(stack.service.getAbility(SHOOT_ABILITY_ID)).toBeUndefined();
      await stack.session.stop();
      expect(stack.service.getAbility(FROST_BLAST_ABILITY_ID)).toBeUndefined();
    }
  });
});

describe("Phase 5.1 — widget composition across plugins", () => {
  it("dual stack registers exactly one widget per plugin (no duplicates)", async () => {
    const { session, widgets } = await bootStack([
      SHOOTER_DEMO_ID,
      ARCTIC_SURVIVAL_ID,
    ]);
    try {
      expect(widgets).toHaveLength(2);
      // Each widget registration has a distinct id.
      const ids = widgets.map(
        (w) =>
          (w as { widget?: { manifest?: { id?: string } } }).widget?.manifest
            ?.id ?? null,
      );
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(2);
    } finally {
      await session.stop();
    }
  });
});
