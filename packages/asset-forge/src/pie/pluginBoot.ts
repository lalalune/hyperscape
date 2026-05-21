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
import {
  manifest as arcticSurvivalManifest,
  arcticSurvivalPluginFactory,
} from "@hyperforge/plugin-arctic-survival";

/**
 * R2.P2 of `PLAN_HYPERIA_DECOUPLING.md`. Static plugin map keyed
 * by manifest id. The browser bundle requires every loadable
 * plugin be statically imported so Vite can bundle it; the map
 * is the editor's "what's installable" — the agent / studio /
 * usePIESession can ask for any id, and if it's in the map, it
 * boots. Adding a new plugin means: (1) static-import its
 * manifest + factory at the top of this file, (2) add an entry
 * here keyed by `manifest.id`. No more enum surgery, no more
 * switch(gameId) anywhere.
 *
 * Future federation work (separate phase) replaces the static
 * imports with dynamic module loading; the registry surface this
 * file exposes stays the same.
 */
type LoadablePlugin = LoadedPluginModule<PluginContextBase>;

const STATIC_PLUGIN_MAP: ReadonlyMap<string, () => LoadablePlugin> = new Map<
  string,
  () => LoadablePlugin
>([
  [
    combatManifest.id,
    () => ({
      manifest: combatManifest,
      factory: combatPluginFactory(DEFAULT_COMBAT_ABILITIES),
    }),
  ],
  [
    skillsManifest.id,
    () => ({
      manifest: skillsManifest,
      factory: skillsPluginFactory(DEFAULT_SKILLS),
    }),
  ],
  [
    hyperscapeManifest.id,
    () => ({ manifest: hyperscapeManifest, factory: hyperscapeFactory }),
  ],
  [
    shooterDemoManifest.id,
    () => ({
      manifest: shooterDemoManifest,
      factory: shooterDemoPluginFactory(),
    }),
  ],
  [
    arcticSurvivalManifest.id,
    () => ({
      manifest: arcticSurvivalManifest,
      factory: arcticSurvivalPluginFactory(),
    }),
  ],
]);

/**
 * Translation from npm package name (`@hyperforge/hyperscape`) to
 * the manifest id (`com.hyperforge.hyperscape`) the static map
 * keys on. Project storage uses npm names because that's what
 * users type in plugin lists; the framework keys on manifest id
 * because that's the stable identifier in `plugin.json`. Adding
 * a new entry to the static map should also add its npm-name
 * alias here so projects can declare it either way.
 */
const NPM_TO_MANIFEST_ID: ReadonlyMap<string, string> = new Map([
  ["@hyperforge/combat", combatManifest.id],
  ["@hyperforge/skills", skillsManifest.id],
  ["@hyperforge/hyperscape", hyperscapeManifest.id],
  ["@hyperforge/plugin-shooter-demo", shooterDemoManifest.id],
  ["@hyperforge/plugin-arctic-survival", arcticSurvivalManifest.id],
]);

/** Hyperia plugin auto-pulls combat + skills as transitive deps. */
const HYPERSCAPE_TRANSITIVE_PLUGINS: ReadonlyArray<string> = [
  combatManifest.id,
  skillsManifest.id,
  hyperscapeManifest.id,
];

/** Shooter-demo auto-pulls combat. */
const SHOOTER_TRANSITIVE_PLUGINS: ReadonlyArray<string> = [
  combatManifest.id,
  shooterDemoManifest.id,
];

/** Arctic-survival auto-pulls combat. */
const ARCTIC_SURVIVAL_TRANSITIVE_PLUGINS: ReadonlyArray<string> = [
  combatManifest.id,
  arcticSurvivalManifest.id,
];

function expandTransitivePlugins(ids: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const raw of ids) {
    const manifestId = NPM_TO_MANIFEST_ID.get(raw) ?? raw;
    if (manifestId === hyperscapeManifest.id) {
      for (const dep of HYPERSCAPE_TRANSITIVE_PLUGINS) push(dep);
    } else if (manifestId === shooterDemoManifest.id) {
      for (const dep of SHOOTER_TRANSITIVE_PLUGINS) push(dep);
    } else if (manifestId === arcticSurvivalManifest.id) {
      for (const dep of ARCTIC_SURVIVAL_TRANSITIVE_PLUGINS) push(dep);
    } else {
      push(manifestId);
    }
  }
  return out;
}

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
 * Resolve the set of plugin modules for a list of plugin ids
 * (manifest id or npm name — see `NPM_TO_MANIFEST_ID`).
 *
 * Empty input → empty result (B0'.C blank-canvas behavior).
 * Unknown ids are silently skipped with a console warning so a
 * typo / unbundled plugin doesn't block the rest of the set.
 *
 * Transitive dependencies are expanded automatically: declaring
 * `@hyperforge/hyperscape` pulls in combat + skills.
 *
 * Exported so a focused test can assert composition behavior
 * without spinning up a full PIEEditorSession.
 */
export function resolvePluginModules(
  pluginIds: ReadonlyArray<string>,
): ReadonlyArray<LoadedPluginModule<PluginContextBase>> {
  if (pluginIds.length === 0) return [];
  const expanded = expandTransitivePlugins(pluginIds);
  const out: LoadablePlugin[] = [];
  for (const id of expanded) {
    const factory = STATIC_PLUGIN_MAP.get(id);
    if (!factory) {
      // eslint-disable-next-line no-console
      console.warn(
        `[pie-plugin-boot] Plugin id "${id}" is not in the static map — skipping. Add it to STATIC_PLUGIN_MAP in pluginBoot.ts (and NPM_TO_MANIFEST_ID if applicable) to make it bootable from PIE.`,
      );
      continue;
    }
    out.push(factory());
  }
  return out;
}

/**
 * @deprecated Use `resolvePluginModules(pluginIds)` instead.
 * Kept as a thin shim during the R2.P2 transition; will be
 * removed once all callers migrate.
 */
export function getPluginModules(
  gameId: "blank" | "hyperscape" | "shooter-demo",
): ReadonlyArray<LoadedPluginModule<PluginContextBase>> {
  if (gameId === "blank") return resolvePluginModules([]);
  if (gameId === "hyperscape")
    return resolvePluginModules([hyperscapeManifest.id]);
  return resolvePluginModules([shooterDemoManifest.id]);
}

function buildContextFactory(
  world: World,
  combatService: CombatAbilityService,
  skillsService: SkillsService,
  uiWidgetRegistry: PIEUIWidgetRegistryLike | undefined,
  projectContentPackIds: ReadonlyArray<string>,
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
          // Strict-catalog gate (Hyperia leak #2 fix). The plugin's
          // onEnable checks this list for
          // `@hyperforge/content-pack-hyperia-v1` before registering
          // Hyperia content-emitting systems (towns, POIs, NPC
          // populations, quests, banks). Plumbed from the host's
          // `state.project.assetPacks` through `createPIEPluginHooks`.
          projectContentPackIds,
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
  pluginIds: ReadonlyArray<string>,
  label: "server" | "client",
  uiWidgetRegistry: PIEUIWidgetRegistryLike | undefined,
  projectContentPackIds: ReadonlyArray<string>,
): Promise<PluginSession<PluginContextBase>> {
  const modules = resolvePluginModules(pluginIds);
  const combatService = createCombatAbilityService();
  const skillsService = createSkillsService();
  // eslint-disable-next-line no-console
  console.log(
    `[pie-plugin-boot:${label}] requested=[${pluginIds.join(", ") || "<empty>"}] resolved=${modules.length} plugin(s)`,
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
      projectContentPackIds,
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
  pluginIds: ReadonlyArray<string>,
  uiWidgetRegistry?: PIEUIWidgetRegistryLike,
  projectContentPackIds: ReadonlyArray<string> = [],
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
      bootPluginsFor(
        serverWorld,
        pluginIds,
        "server",
        uiWidgetRegistry,
        projectContentPackIds,
      ),
    bootClientPlugins: (clientWorld) =>
      bootPluginsFor(
        clientWorld,
        pluginIds,
        "client",
        uiWidgetRegistry,
        projectContentPackIds,
      ),
  };
}
