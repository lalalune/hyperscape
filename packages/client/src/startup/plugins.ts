/**
 * Plugin boot — runs the @hyperforge/gameplay-framework plugin
 * pipeline against the in-binary plugin set at client startup.
 *
 * Mirrors `packages/server/src/startup/plugins.ts`. Same plugin
 * set (combat + skills + hyperscape meta-plugin), same per-plugin
 * context dispatch, same scope-disposer semantics. The difference
 * is the host: this version runs inside the browser ClientWorld
 * and `world.isServer === false`, so `HealthRegenSystem` (server-
 * gated in the meta-plugin's onEnable) is not registered here.
 *
 * The bilateral systems (mob-death, gravestone-loot, all six tile-based MMORPG
 * skill processing systems) DO register on the client world. They
 * self-gate their `init()` on `world.isServer` so the no-op happens
 * at init-time rather than register-time.
 *
 * Why this matters now: client-only systems
 * (EquipmentVisualSystem, ZoneVisualsSystem, WaterfallVisualsSystem)
 * still live in `packages/shared/src/systems/client/` and are
 * registered by `createClientWorld.ts`. Once we have plugin boot on
 * the client side, those visual systems can migrate too — the
 * plugin's onEnable can register them when `world.isServer === false`.
 */

import {
  type LoadedPluginModule,
  type PluginContextBase,
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

let _combatService: CombatAbilityService | null = null;
let _skillsService: SkillsService | null = null;

function getCombatService(): CombatAbilityService {
  if (!_combatService) _combatService = createCombatAbilityService();
  return _combatService;
}

function getSkillsService(): SkillsService {
  if (!_skillsService) _skillsService = createSkillsService();
  return _skillsService;
}

/**
 * Identifiers for the different game plugin sets the client knows
 * how to boot. Mirrors `packages/server/src/startup/plugins.ts` —
 * same set of values, same semantics. Today's entries:
 *   - "hyperscape"   — production Hyperscape meta-plugin stack.
 *   - "shooter-demo" — acceptance-test alternate game stack.
 */
export type GamePluginSetId = "hyperscape" | "shooter-demo";

/** localStorage key the editor's game selector writes to. */
export const GAME_PLUGIN_LOCAL_STORAGE_KEY = "hyperscape:game-plugin";

function isKnownGamePluginSetId(raw: unknown): raw is GamePluginSetId {
  return raw === "hyperscape" || raw === "shooter-demo";
}

/**
 * Resolve which game plugin set the client should boot. Lookup
 * order (first match wins):
 *
 *   1. `VITE_HYPERSCAPE_GAME_PLUGIN` env var (build-time flag,
 *      good for CI / preview deploys).
 *   2. `localStorage["hyperscape:game-plugin"]` (runtime preference
 *      — what the editor's in-toolbar GameSelector writes to).
 *   3. Default: `"hyperscape"`.
 *
 * Unknown / malformed values at any level fall through to the
 * next check so a bad env var can't brick the client boot.
 */
export function resolveGamePluginSetIdFromEnv(): GamePluginSetId {
  // 1. Env var (build-time — Vite exposes VITE_* in the bundle).
  const envRaw =
    typeof import.meta.env === "object"
      ? (import.meta.env as Record<string, string | undefined>)[
          "VITE_HYPERSCAPE_GAME_PLUGIN"
        ]
      : undefined;
  if (isKnownGamePluginSetId(envRaw)) return envRaw;

  // 2. localStorage (runtime, editor-set). Guarded for SSR / non-
  //    browser contexts where `window` might not exist.
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const lsRaw = window.localStorage.getItem(GAME_PLUGIN_LOCAL_STORAGE_KEY);
      if (isKnownGamePluginSetId(lsRaw)) return lsRaw;
    }
  } catch {
    // localStorage access can throw when cookies/storage are
    // disabled. Fall through to default silently.
  }

  return "hyperscape";
}

function getClientPluginModules(
  gameId: GamePluginSetId = "hyperscape",
): ReadonlyArray<LoadedPluginModule<PluginContextBase>> {
  switch (gameId) {
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

/**
 * Boot the in-binary plugin set on the client. Called from the
 * `GameClient` mount path after `world.systemsLoadedPromise` and
 * before `world.init(config)` so the plugin's `world.register(...)`
 * calls land in the same window the rest of the systems do.
 *
 * Returns the session so callers can `session.stop()` on unmount
 * for clean disposer teardown.
 */
/**
 * Minimal shape `bootClientPlugins` needs from the host's UI widget
 * registry. `GameClient` passes the concrete `@hyperforge/ui-widgets`
 * `uiRegistry` here; tests + the server pass `undefined` and the
 * plugin's widget-contribution code no-ops.
 */
export interface UIWidgetRegistryLike {
  register(
    reg: WidgetRegistration<Record<string, unknown>, UIWidgetComponent>,
  ): void;
  /**
   * Optional — present on `WidgetRegistry` (ui-framework) but may be
   * absent on older/custom registries. When present, `bootClientPlugins`
   * wires it into the plugin's scope disposer so `session.stop()`
   * removes plugin-contributed widgets.
   */
  unregister?(id: string): boolean;
}

export async function bootClientPlugins(
  world: World,
  gameId: GamePluginSetId = resolveGamePluginSetIdFromEnv(),
  uiWidgetRegistry?: UIWidgetRegistryLike,
): Promise<PluginSession<PluginContextBase>> {
  const modules = getClientPluginModules(gameId);
  console.log(
    `[client-plugin-boot] game=${gameId} — ${modules.length} plugin(s) in set`,
  );
  const session = await startPluginSessionFromModules(modules, {
    contextFactory: ({ pluginId, scope }) => {
      switch (pluginId) {
        case combatManifest.id: {
          const service = getCombatService();
          const ctx: CombatContext = {
            pluginId,
            scope,
            registerAbility(ability) {
              service.registerAbility(ability);
              scope.register(() => service.unregisterAbility(ability.id));
            },
          };
          return ctx as PluginContextBase;
        }
        case skillsManifest.id: {
          const service = getSkillsService();
          const ctx: SkillsContext = {
            pluginId,
            scope,
            registerSkill(skill) {
              service.registerSkill(skill);
              scope.register(() => service.unregisterSkill(skill.id));
            },
          };
          return ctx as PluginContextBase;
        }
        case hyperscapeManifest.id: {
          // Hyperscape meta-plugin contributes its own widget set
          // (XP orb is the first; D6.c per-widget migration adds
          // the rest). Same wiring pattern as shooter-demo: when
          // the host supplies a UI registry, expose `ctx.widgets`
          // so onEnable can `register(...)` widgets and the
          // disposer drops them on `session.stop()`.
          const widgets: WidgetContributionRegistry | undefined =
            uiWidgetRegistry
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
        case shooterDemoManifest.id: {
          // Shooter demo contributes combat abilities AND (if the
          // host supplied a UI widget registry) a crosshair widget.
          // Server-side callers pass `undefined` for the registry —
          // the plugin's onEnable optional-chain on `ctx.widgets`
          // turns the widget call into a no-op. Browser callers via
          // GameClient pass the real `uiRegistry`.
          const service = getCombatService();
          const widgets: WidgetContributionRegistry | undefined =
            uiWidgetRegistry
              ? {
                  register(contribution: WidgetContribution) {
                    const reg = contribution as unknown as WidgetRegistration<
                      Record<string, unknown>,
                      UIWidgetComponent
                    >;
                    uiWidgetRegistry.register(reg);
                    const widgetId = reg.widget.manifest.id;
                    scope.register(() => {
                      // WidgetRegistry.unregister shipped alongside
                      // this — drop the plugin-contributed widget
                      // from the host registry so session.stop()
                      // actually tears down everything onEnable
                      // added. Idempotent; safe on absent-id.
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
              service.registerAbility(ability);
              scope.register(() => service.unregisterAbility(ability.id));
            },
          };
          return ctx as PluginContextBase;
        }
        default:
          return { pluginId, scope };
      }
    },
  });

  if (session.unresolvable.length > 0) {
    for (const entry of session.unresolvable) {
      console.warn(
        `[client-plugin-boot] unresolvable: "${entry.module.manifest.id}" — ${entry.reason}`,
      );
    }
  }

  if (session.records.length > 0) {
    const ids = session.records.map((r) => r.manifest.id).join(", ");
    console.log(
      `[client-plugin-boot] started ${session.records.length} plugin(s): ${ids}`,
    );
  }

  return session;
}
