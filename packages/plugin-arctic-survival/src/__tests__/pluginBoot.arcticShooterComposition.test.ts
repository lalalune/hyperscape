/**
 * Phase 3.4 of PLAN_AAA_UE5_PARITY — AAA acceptance test for
 * arctic + shooter plugin coexistence.
 *
 * The existing "coexistence with shooter-demo" test in
 * `plugin.test.ts` only proves the negative direction (arctic
 * alone doesn't accidentally carry shooter content). This file
 * proves the positive direction: booting both plugins together
 * in one shared session produces a clean composed environment —
 *
 *   - Both ability IDs (`arctic-frost-blast`, `demo-shoot`) are
 *     registered on the shared ability service. The two plugins
 *     coexist without overwriting each other.
 *   - Manifest IDs are distinct so plugin-registry lookup never
 *     ambiguous-matches.
 *   - Widget IDs are namespace-prefixed (`com.hyperforge.<plugin>`)
 *     so widget-registry conflicts can't occur even if both
 *     plugins ship a widget called "the main HUD".
 *   - Session start + stop is idempotent — repeated boots of the
 *     composed set leak nothing.
 *
 * If a fourth plugin ever lands and accidentally claims one of
 * these IDs, this test surfaces the collision before runtime.
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
  manifest as combatManifest,
  type CombatAbility,
  type CombatContext,
} from "@hyperforge/combat";

import {
  arcticSurvivalPluginFactory,
  FROST_BLAST_ABILITY,
  manifest as arcticManifest,
  temperatureGaugeWidget,
} from "../index.js";

import {
  shooterDemoPluginFactory,
  SHOOT_ABILITY,
  manifest as shooterManifest,
  crosshairWidget,
} from "@hyperforge/plugin-shooter-demo";

/** Boot combat + arctic + shooter in a shared session, return the ability service. */
async function bootComposed(): Promise<{
  abilityService: ReturnType<typeof createCombatAbilityService>;
  session: Awaited<ReturnType<typeof startPluginSessionFromModules>>;
}> {
  const abilityService = createCombatAbilityService();

  const modules: ReadonlyArray<LoadedPluginModule<PluginContextBase>> = [
    {
      manifest: combatManifest,
      factory: combatPluginFactory([]),
    },
    {
      manifest: arcticManifest,
      factory: arcticSurvivalPluginFactory(),
    },
    {
      manifest: shooterManifest,
      factory: shooterDemoPluginFactory(),
    },
  ];

  const session = await startPluginSessionFromModules(modules, {
    contextFactory: ({ pluginId, scope }) => {
      const ctx: CombatContext & PluginContextBase = {
        pluginId,
        scope,
        registerAbility(ability: CombatAbility) {
          abilityService.registerAbility(ability);
          scope.register(() => abilityService.unregisterAbility(ability.id));
        },
      };
      return ctx as PluginContextBase;
    },
  });

  return { abilityService, session };
}

describe("plugin coexistence — arctic + shooter composition", () => {
  it("both ability IDs are registered on the shared ability service", async () => {
    const { abilityService, session } = await bootComposed();
    try {
      expect(abilityService.getAbility("arctic-frost-blast")).toBeDefined();
      expect(abilityService.getAbility("demo-shoot")).toBeDefined();
    } finally {
      await session.stop();
    }
  });

  it("ability registration preserves each plugin's metadata (no last-write-wins clobber)", async () => {
    const { abilityService, session } = await bootComposed();
    try {
      const arctic = abilityService.getAbility("arctic-frost-blast");
      const shooter = abilityService.getAbility("demo-shoot");
      expect(arctic?.id).toBe(FROST_BLAST_ABILITY.id);
      expect(shooter?.id).toBe(SHOOT_ABILITY.id);
      // Sanity: the registered objects are the exact frozen exports,
      // not a hybrid produced by merging two plugins' contributions.
      expect(arctic).toBe(FROST_BLAST_ABILITY);
      expect(shooter).toBe(SHOOT_ABILITY);
    } finally {
      await session.stop();
    }
  });

  it("plugin manifest IDs are unique across the composed set", () => {
    const ids = new Set([
      arcticManifest.id,
      shooterManifest.id,
      combatManifest.id,
    ]);
    expect(ids.size).toBe(3);
  });

  it("widget IDs are namespace-prefixed so no collision is possible", () => {
    // Both plugins ship a HUD widget. The id sits on the widget's
    // manifest. If either ever drops the `com.hyperforge.<plugin>`
    // prefix this test catches it.
    expect(temperatureGaugeWidget.manifest.id).toBe(
      "com.hyperforge.arctic-survival.temperature-gauge",
    );
    expect(crosshairWidget.manifest.id).toBe(
      "com.hyperforge.shooter-demo.crosshair",
    );
    expect(temperatureGaugeWidget.manifest.id).not.toBe(
      crosshairWidget.manifest.id,
    );
  });

  it("a fresh session after teardown re-registers both plugins cleanly", async () => {
    // First boot — establish baseline.
    {
      const { abilityService, session } = await bootComposed();
      expect(abilityService.getAbility("arctic-frost-blast")).toBeDefined();
      expect(abilityService.getAbility("demo-shoot")).toBeDefined();
      await session.stop();
      // After stop, the scope.register teardown should have
      // unregistered both abilities from this service.
      expect(abilityService.getAbility("arctic-frost-blast")).toBeUndefined();
      expect(abilityService.getAbility("demo-shoot")).toBeUndefined();
    }

    // Second boot — clean re-register, no carryover from the first.
    {
      const { abilityService, session } = await bootComposed();
      try {
        expect(abilityService.getAbility("arctic-frost-blast")).toBeDefined();
        expect(abilityService.getAbility("demo-shoot")).toBeDefined();
      } finally {
        await session.stop();
      }
    }
  });
});
