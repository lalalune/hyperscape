/**
 * PIE plugin-boot adapter.
 *
 * Asset-forge owns the game → plugin-module mapping for the editor's
 * PIE session. `PIEEditorSession` itself stays plugin-package-agnostic
 * (it just calls the `bootServerPlugins` / `bootClientPlugins` hooks on
 * start), so this module is where we reach into the concrete plugin
 * packages (combat, skills, hyperscape, plugin-shooter-demo) and build
 * contexts against the PIE worlds.
 *
 * Mirrors the patterns in `packages/server/src/startup/plugins.ts` and
 * `packages/client/src/startup/plugins.ts`. The three services
 * (combat, skills) are created ON-DEMAND per session — a fresh pair
 * per Play button press means ability/skill registrations from a
 * prior session don't leak into a new one.
 */

import {
  type LoadedPluginModule,
  type PluginContextBase,
  type PluginContextFactory,
  type PluginSession,
  type WidgetContribution,
  type WidgetContributionRegistry,
  startPluginSessionFromModules,
} from "@hyperforge/gameplay-framework";
import type { World } from "@hyperforge/shared";
import type { WidgetRegistration } from "@hyperforge/ui-framework";
import type { UIWidgetComponent } from "@hyperforge/ui-widgets";

import {
  combatPluginFactory,
  createCombatAbilityService,
  DEFAULT_COMBAT_ABILITIES,
  manifest as combatManifest,
  type CombatAbilityService,
  type CombatContext,
} from "@hyperforge/combat";
import {
  createSkillsService,
  DEFAULT_SKILLS,
  skillsPluginFactory,
  manifest as skillsManifest,
  type SkillsContext,
  type SkillsService,
} from "@hyperforge/skills";
import hyperscapeFactory, {
  type HyperscapeContext,
} from "@hyperforge/hyperscape";
import { manifest as hyperscapeManifest } from "@hyperforge/hyperscape";
import {
  manifest as shooterDemoManifest,
  shooterDemoPluginFactory,
} from "@hyperforge/plugin-shooter-demo";

import type { GamePluginSetId } from "../components/WorldStudio/toolbar/gamePluginResolver";

/**
 * Minimal shape `pluginBoot` needs from a host's UI widget registry.
 * Mirrors `UIWidgetRegistryLike` in `@hyperforge/client/startup/plugins.ts`
 * — the editor's PIE viewport overlay creates a session-scoped
 * `WidgetRegistry<UIWidgetComponent>` and passes it through here so
 * shooter-demo's crosshair (and any other plugin-contributed widget)
 * lands in the registry the overlay's `<ManifestRenderer />` reads from.
 *
 * `unregister?` lets `session.stop()` cleanly tear down plugin-
 * contributed widgets when the user clicks Stop in PIE.
 */
export interface PIEUIWidgetRegistryLike {
  register(
    reg: WidgetRegistration<Record<string, unknown>, UIWidgetComponent>,
  ): void;
  unregister?(id: string): boolean;
}

/**
 * Resolve the set of plugin modules for a given plugin-set id.
 * Exported so a focused test can assert the second-game claim
 * (shooter-demo and hyperscape boot disjoint module sets) without
 * spinning up a full PIEEditorSession.
 */
export function getPluginModules(
  gameId: GamePluginSetId,
): ReadonlyArray<LoadedPluginModule<PluginContextBase>> {
  switch (gameId) {
    case "blank":
      // B0'.C: no plugins. PIE boots an engine-only world; PIE Play
      // renders the project's terrain only. Designer / agent fills
      // it via `PROPOSE_PLUGIN_SET` (B0'.I) and content actions
      // (B0'.G+).
      return [];
    case "hyperscape":
      return [
        {
          manifest: combatManifest,
          factory: combatPluginFactory(DEFAULT_COMBAT_ABILITIES),
        },
        {
          manifest: skillsManifest,
          factory: skillsPluginFactory(DEFAULT_SKILLS),
        },
        {
          manifest: hyperscapeManifest,
          factory: hyperscapeFactory,
        },
      ];
    case "shooter-demo":
      return [
        {
          manifest: combatManifest,
          factory: combatPluginFactory([]),
        },
        {
          manifest: shooterDemoManifest,
          factory: shooterDemoPluginFactory(),
        },
      ];
  }
}

function buildContextFactory(
  world: World,
  combatService: CombatAbilityService,
  skillsService: SkillsService,
  uiWidgetRegistry: PIEUIWidgetRegistryLike | undefined,
): PluginContextFactory<PluginContextBase> {
  return ({ pluginId, scope }) => {
    switch (pluginId) {
      case combatManifest.id: {
        const ctx: CombatContext = {
          pluginId,
          scope,
          registerAbility(ability) {
            combatService.registerAbility(ability);
            scope.register(() => combatService.unregisterAbility(ability.id));
          },
        };
        return ctx as PluginContextBase;
      }
      case shooterDemoManifest.id: {
        // Shooter-demo contributes BOTH combat abilities AND (when the
        // PIE overlay supplied a widget registry) a crosshair widget.
        // The `widgets` field is undefined on test runs / overlay-less
        // sessions; the plugin's onEnable optional-chains over it so
        // that's a no-op.
        const widgets: WidgetContributionRegistry | undefined = uiWidgetRegistry
          ? {
              register(contribution: WidgetContribution) {
                const reg = contribution as unknown as WidgetRegistration<
                  Record<string, unknown>,
                  UIWidgetComponent
                >;
                uiWidgetRegistry.register(reg);
                const widgetId = reg.widget.manifest.id;
                scope.register(() => {
                  uiWidgetRegistry.unregister?.(widgetId);
                });
              },
            }
          : undefined;
        const ctx: CombatContext & PluginContextBase = {
          pluginId,
          scope,
          widgets,
          registerAbility(ability) {
            combatService.registerAbility(ability);
            scope.register(() => combatService.unregisterAbility(ability.id));
          },
        };
        return ctx as PluginContextBase;
      }
      case skillsManifest.id: {
        const ctx: SkillsContext = {
          pluginId,
          scope,
          registerSkill(skill) {
            skillsService.registerSkill(skill);
            scope.register(() => skillsService.unregisterSkill(skill.id));
          },
        };
        return ctx as PluginContextBase;
      }
      case hyperscapeManifest.id: {
        // Mirror the shooter-demo branch: when the PIE overlay supplied
        // a widget registry, expose a `widgets` field so the plugin's
        // onEnable can `ctx.widgets.register(...)` its 50+ widgets into
        // the same registry that PIEHudOverlay reads from. Without this
        // adapter the plugin's widget contributions optional-chain to
        // no-ops and the registry stays empty (only framework builtins
        // bound by `bindAllWidgets()` resolve).
        const widgets: WidgetContributionRegistry | undefined = uiWidgetRegistry
          ? {
              register(contribution: WidgetContribution) {
                const reg = contribution as unknown as WidgetRegistration<
                  Record<string, unknown>,
                  UIWidgetComponent
                >;
                uiWidgetRegistry.register(reg);
                const widgetId = reg.widget.manifest.id;
                scope.register(() => {
                  uiWidgetRegistry.unregister?.(widgetId);
                });
              },
            }
          : undefined;
        const ctx: HyperscapeContext = {
          pluginId,
          scope,
          world,
          widgets,
        };
        return ctx as PluginContextBase;
      }
      default:
        return { pluginId, scope };
    }
  };
}

async function bootPluginsFor(
  world: World,
  gameId: GamePluginSetId,
  label: "server" | "client",
  uiWidgetRegistry: PIEUIWidgetRegistryLike | undefined,
): Promise<PluginSession<PluginContextBase>> {
  const modules = getPluginModules(gameId);
  const combatService = createCombatAbilityService();
  const skillsService = createSkillsService();
  console.log(
    `[pie-plugin-boot:${label}] game=${gameId} — ${modules.length} plugin(s) in set`,
  );
  const session = await startPluginSessionFromModules(modules, {
    contextFactory: buildContextFactory(
      world,
      combatService,
      skillsService,
      // Widget contributions only land via the client-side boot — that's
      // where the PIE viewport's React tree is. Server-side hooks pass
      // undefined so the plugin's onEnable widget call no-ops there.
      label === "client" ? uiWidgetRegistry : undefined,
    ),
  });
  if (session.unresolvable.length > 0) {
    for (const entry of session.unresolvable) {
      console.warn(
        `[pie-plugin-boot:${label}] unresolvable: "${entry.module.manifest.id}" — ${entry.reason}`,
      );
    }
  }
  if (session.records.length > 0) {
    const ids = session.records.map((r) => r.manifest.id).join(", ");
    console.log(
      `[pie-plugin-boot:${label}] started ${session.records.length} plugin(s): ${ids}`,
    );
  }
  return session;
}

/**
 * Build the `plugins` option for `PIEEditorSession.start({ plugins })`.
 * Both hooks share the same contextFactory template — the only
 * difference is which World instance (PIE server vs PIE client) they
 * bind against.
 *
 * Fresh services per `createPIEPluginHooks()` call so starting a new
 * Play session doesn't inherit ability/skill registrations from a
 * previous one.
 *
 * `uiWidgetRegistry` (optional) plumbs through to the client-side
 * boot's contextFactory so plugin widget contributions (e.g.
 * shooter-demo's crosshair) land in the registry the PIE viewport's
 * `<ManifestRenderer />` reads. Caller (typically `usePIESession`)
 * owns the registry's lifecycle — instantiate before start, dispose
 * on stop.
 */
export function createPIEPluginHooks(
  gameId: GamePluginSetId,
  uiWidgetRegistry?: PIEUIWidgetRegistryLike,
): {
  bootServerPlugins: (
    serverWorld: World,
  ) => Promise<PluginSession<PluginContextBase>>;
  bootClientPlugins: (
    clientWorld: World,
  ) => Promise<PluginSession<PluginContextBase>>;
} {
  return {
    bootServerPlugins: (serverWorld) =>
      bootPluginsFor(serverWorld, gameId, "server", uiWidgetRegistry),
    bootClientPlugins: (clientWorld) =>
      bootPluginsFor(clientWorld, gameId, "client", uiWidgetRegistry),
  };
}
