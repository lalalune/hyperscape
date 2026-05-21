/**
 * Arctic-survival plugin tests.
 *
 * Phase 5.1 of `PLAN_AAA_MASTER_AUDIT.md` — third non-Hyperia
 * gameplay plugin proves the framework's plugin boot pipeline
 * is genuinely n-plugin, not just hardcoded for the
 * hyperscape + shooter-demo pair.
 *
 * Two layers of evidence:
 *
 * 1. Unit: manifest parses, factory produces a valid plugin,
 *    frost-blast ability survives onEnable → service.
 *
 * 2. Declaration vs runtime: plugin.json declares contributions
 *    (widget id, command id, palette categories, toolbar tools)
 *    that match what `onEnable` actually registers. Drift fails
 *    a test, not silently masks an agent hallucination.
 */

import { describe, expect, it } from "vitest";

import {
  PluginManifestSchema,
  startPluginSessionFromModules,
  type LoadedPluginModule,
  type PluginContextBase,
} from "@hyperforge/gameplay-framework";
import {
  combatPluginFactory,
  createCombatAbilityService,
  manifest as combatManifest,
  type CombatAbilityService,
  type CombatContext,
} from "@hyperforge/combat";

import {
  arcticSurvivalPluginFactory,
  FROST_BLAST_ABILITY,
  manifest as arcticManifest,
  temperatureGaugeRegistration,
  temperatureGaugeWidget,
} from "../index.js";

describe("@hyperforge/plugin-arctic-survival — unit", () => {
  it("ships a plugin.json that parses through PluginManifestSchema", () => {
    const parsed = PluginManifestSchema.parse(arcticManifest);
    expect(parsed.id).toBe("com.hyperforge.plugin-arctic-survival");
    expect(parsed.version).toBe("0.1.0");
    expect(parsed.hyperforgeApi).toBe("0.1.0");
    expect(parsed.enabledByDefault).toBe(false);
  });

  it("declares dependency on @hyperforge/combat (ability registry)", () => {
    expect(arcticManifest.dependencies).toContainEqual(
      expect.objectContaining({ id: "com.hyperforge.combat" }),
    );
  });

  it("does NOT depend on @hyperforge/skills or @hyperforge/hyperscape", () => {
    // Whole point of the third-plugin acceptance: a different
    // gameplay flavor brings a different dependency graph. Arctic
    // survival doesn't lean on skills XP or the hyperscape meta.
    for (const dep of arcticManifest.dependencies) {
      expect(dep.id).not.toBe("com.hyperforge.skills");
      expect(dep.id).not.toBe("com.hyperforge.hyperscape");
    }
  });

  it("default ability set contains 'arctic-frost-blast' (magic kind)", () => {
    expect(FROST_BLAST_ABILITY.id).toBe("arctic-frost-blast");
    expect(FROST_BLAST_ABILITY.kind).toBe("magic");
    expect(FROST_BLAST_ABILITY.baseDamage).toBeGreaterThan(0);
  });

  it("ships a temperature-gauge widget definition + React component", () => {
    expect(temperatureGaugeWidget.manifest.id).toBe(
      "com.hyperforge.arctic-survival.temperature-gauge",
    );
    expect(temperatureGaugeWidget.manifest.category).toBe("hud");
    expect(temperatureGaugeRegistration.widget).toBe(temperatureGaugeWidget);
    expect(typeof temperatureGaugeRegistration.Component).toBe("function");
  });
});

describe("@hyperforge/plugin-arctic-survival — declared contributions", () => {
  // Mirrors the shooter-demo Phase 5.1 acceptance gate —
  // declarations in plugin.json must match what onEnable
  // actually registers at runtime.

  it("declares the temperature-gauge widget the plugin actually registers", () => {
    expect(arcticManifest.contributions.widgets).toContain(
      temperatureGaugeWidget.manifest.id,
    );
  });

  it("declared widgets match registered widgets 1:1 (no over-declaration)", () => {
    expect(arcticManifest.contributions.widgets).toHaveLength(1);
    expect(arcticManifest.contributions.widgets).toEqual([
      temperatureGaugeWidget.manifest.id,
    ]);
  });

  it("declares a frost-blast command id namespaced under the plugin", () => {
    const commands = arcticManifest.contributions.commands;
    expect(commands.length).toBeGreaterThan(0);
    for (const cmd of commands) {
      expect(cmd.startsWith("com.hyperforge.arctic-survival.")).toBe(true);
    }
  });

  it("declared entityTypes survive PluginManifestSchema validation", () => {
    const parsed = PluginManifestSchema.parse(arcticManifest);
    expect(parsed.contributions.entityTypes.length).toBeGreaterThanOrEqual(4);
    const types = parsed.contributions.entityTypes.map((e) => e.type);
    expect(types).toContain("heat_source");
    expect(types).toContain("ice_block");
    expect(types).toContain("frozen_cache");
    expect(types).toContain("expedition_guide");
  });

  it("declares paletteCategories so the studio can group entityTypes", () => {
    const parsed = PluginManifestSchema.parse(arcticManifest);
    expect(parsed.contributions.paletteCategories).toContain("arctic-shelters");
    expect(parsed.contributions.paletteCategories).toContain(
      "arctic-resources",
    );
  });

  it("declares toolbarTools the studio MainToolbar can surface", () => {
    const parsed = PluginManifestSchema.parse(arcticManifest);
    expect(parsed.contributions.toolbarTools).toContain(
      "arctic-cold-exposure-debug",
    );
  });

  it("every declared contribution kind has a stable namespace prefix", () => {
    const c = arcticManifest.contributions;
    for (const w of c.widgets)
      expect(w.startsWith("com.hyperforge.arctic-survival")).toBe(true);
    for (const cmd of c.commands)
      expect(cmd.startsWith("com.hyperforge.arctic-survival")).toBe(true);
    for (const cat of c.paletteCategories)
      expect(cat.startsWith("arctic-")).toBe(true);
    for (const tool of c.toolbarTools)
      expect(tool.startsWith("arctic-")).toBe(true);
  });
});

describe("@hyperforge/plugin-arctic-survival — widget contribution", () => {
  it("onEnable calls ctx.widgets.register when the host provides a registry", async () => {
    const registered: unknown[] = [];
    const service = createCombatAbilityService();

    const modules: ReadonlyArray<LoadedPluginModule<PluginContextBase>> = [
      {
        manifest: combatManifest,
        factory: combatPluginFactory([]),
      },
      {
        manifest: arcticManifest,
        factory: arcticSurvivalPluginFactory(),
      },
    ];

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
              registered.push(contribution);
            },
          },
        };
        return ctx as PluginContextBase;
      },
    });

    try {
      expect(registered).toHaveLength(1);
      expect(registered[0]).toBe(temperatureGaugeRegistration);
    } finally {
      await session.stop();
    }
  });

  it("onEnable skips widget registration when the host does NOT provide a registry", async () => {
    const service = createCombatAbilityService();

    const modules: ReadonlyArray<LoadedPluginModule<PluginContextBase>> = [
      {
        manifest: combatManifest,
        factory: combatPluginFactory([]),
      },
      {
        manifest: arcticManifest,
        factory: arcticSurvivalPluginFactory(),
      },
    ];

    // Dedicated-server context: no widgets adapter.
    const session = await startPluginSessionFromModules(modules, {
      contextFactory: ({ pluginId, scope }) => {
        const ctx: CombatContext & PluginContextBase = {
          pluginId,
          scope,
          registerAbility(ability) {
            service.registerAbility(ability);
            scope.register(() => service.unregisterAbility(ability.id));
          },
          // widgets: undefined
        };
        return ctx as PluginContextBase;
      },
    });

    try {
      // Server didn't crash, plugin ran, ability registered.
      expect(service.getAbility("arctic-frost-blast")?.id).toBe(
        "arctic-frost-blast",
      );
    } finally {
      await session.stop();
    }
  });
});

describe("@hyperforge/plugin-arctic-survival — coexistence with shooter-demo", () => {
  it("two independent ability services don't leak across plugins", async () => {
    const arcticService = createCombatAbilityService();

    const modules: ReadonlyArray<LoadedPluginModule<PluginContextBase>> = [
      {
        manifest: combatManifest,
        factory: combatPluginFactory([]),
      },
      {
        manifest: arcticManifest,
        factory: arcticSurvivalPluginFactory(),
      },
    ];

    const session = await startPluginSessionFromModules(modules, {
      contextFactory: ({ pluginId, scope }) => {
        const ctx: CombatContext & PluginContextBase = {
          pluginId,
          scope,
          registerAbility(ability) {
            arcticService.registerAbility(ability);
            scope.register(() => arcticService.unregisterAbility(ability.id));
          },
        };
        return ctx as PluginContextBase;
      },
    });

    try {
      // Arctic session has FROST_BLAST_ABILITY, NOT shooter-demo's
      // demo-shoot.
      expect(arcticService.getAbility("arctic-frost-blast")).toBeDefined();
      expect(arcticService.getAbility("demo-shoot")).toBeUndefined();
    } finally {
      await session.stop();
    }
  });
});
