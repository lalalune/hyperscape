/**
 * Plugin boot — runs the @hyperforge/gameplay-framework plugin
 * pipeline against the in-binary plugin set at server startup.
 *
 * Today the set is the @hyperforge/hyperscape meta-plugin and its
 * two declared dependencies (@hyperforge/combat, @hyperforge/skills).
 * All three currently ship no-op `onLoad` / `onEnable` hooks, so this
 * call is a *behavior no-op* — its purpose is to prove the plugin
 * runtime actually executes inside the production server boot path
 * (not just in unit tests) and to give every future
 * `Hyperscape → meta-plugin` migration a real attachment point.
 *
 * Per-plugin contributions (systems, widgets, manifests, commands)
 * are not consumed yet — that's the next slice. This is the
 * smallest possible PR that takes Phase I from "framework exists in
 * isolation" to "framework runs in production".
 *
 * Order matters: the resolver does its own toposort by manifest
 * `dependencies`, so we just hand the modules in any order. We use
 * `startPluginSessionFromModules` (not the catalog-based variant)
 * because the modules are compiled into the server binary — there
 * is no on-disk catalog to walk.
 */

import {
  type LoadedPluginModule,
  type PluginContextBase,
  type PluginSession,
  startPluginSessionFromModules,
} from "@hyperforge/gameplay-framework";
import type { World } from "@hyperforge/shared";

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
 * Per-plugin services live for the lifetime of the server. They get
 * captured into per-plugin contexts so plugin `onEnable` hooks can
 * register against them. Currently no other code reads from these
 * services — Hyperscape→meta-plugin migrations are how they wire
 * into actual gameplay (e.g. combat resolution reads through the
 * `CombatAbilityService` to look up registered abilities).
 */
let _combatService: CombatAbilityService | null = null;
let _skillsService: SkillsService | null = null;

/** Test-only reset so each test starts from clean services. */
export function _resetServerPluginServicesForTests(): void {
  _combatService = null;
  _skillsService = null;
}

function getCombatService(): CombatAbilityService {
  if (!_combatService) _combatService = createCombatAbilityService();
  return _combatService;
}

function getSkillsService(): SkillsService {
  if (!_skillsService) _skillsService = createSkillsService();
  return _skillsService;
}

/** Test-only readers so the smoke test can verify registrations. */
export function _peekCombatService(): CombatAbilityService | null {
  return _combatService;
}
export function _peekSkillsService(): SkillsService | null {
  return _skillsService;
}

/**
 * Test fallback when `bootServerPlugins()` is called without a real
 * world (the smoke test does this). Records every `register`/
 * `unregister` call so tests can assert the plugin actually attempted
 * to attach the system, without depending on the full world ECS.
 */
interface WorldStub {
  readonly registered: string[];
  readonly unregistered: string[];
}
function createNoopWorldStub(): World {
  const registered: string[] = [];
  const unregistered: string[] = [];
  const stub = {
    registered,
    unregistered,
    register(name: string, _ctor: unknown) {
      registered.push(name);
    },
    unregister(name: string) {
      unregistered.push(name);
    },
  };
  // World is a large interface — only the bits the plugin's onEnable
  // touches matter. Cast through unknown to keep the stub minimal.
  return stub as unknown as World;
}

/** Test-only accessor for the noop world stub created on stub-mode boot. */
export function _peekStubWorld(world: unknown): WorldStub | null {
  if (
    world &&
    typeof world === "object" &&
    "registered" in world &&
    "unregistered" in world
  ) {
    return world as WorldStub;
  }
  return null;
}

/**
 * Identifiers for the different game plugin sets the server knows
 * how to boot.
 *
 * @deprecated R3.P11 of `PLAN_HYPERIA_DECOUPLING.md` — replaced by
 * `resolveServerPluginModules(pluginIds: ReadonlyArray<string>)`
 * which keys on plugin manifest id (or npm name) directly. The
 * 2-element enum stays as a transitional shim for callers that
 * read `HYPERSCAPE_GAME_PLUGIN` env at boot.
 */
export type GamePluginSetId = "hyperscape" | "shooter-demo";

/**
 * R3.P11 — server-side static plugin map keyed by manifest id.
 * Mirrors `STATIC_PLUGIN_MAP` in `asset-forge/src/pie/pluginBoot.ts`
 * (R2.P2). Adding a plugin = static-import its manifest+factory
 * and add an entry here. Bundle-time constraint: in-binary plugins
 * only — federation / dynamic imports are a separate phase.
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
 * npm package name → manifest id alias. Projects declare plugins
 * by either npm name (`@hyperforge/hyperscape`) or manifest id
 * (`com.hyperforge.hyperscape`); this maps the former to the
 * latter so the static map's lookup is uniform.
 */
const NPM_TO_MANIFEST_ID: ReadonlyMap<string, string> = new Map([
  ["@hyperforge/combat", combatManifest.id],
  ["@hyperforge/skills", skillsManifest.id],
  ["@hyperforge/hyperscape", hyperscapeManifest.id],
  ["@hyperforge/plugin-shooter-demo", shooterDemoManifest.id],
  ["@hyperforge/plugin-arctic-survival", arcticSurvivalManifest.id],
]);

/** Hyperscape pulls combat + skills + itself. */
const HYPERSCAPE_TRANSITIVE_PLUGINS: ReadonlyArray<string> = [
  combatManifest.id,
  skillsManifest.id,
  hyperscapeManifest.id,
];

/** Shooter-demo pulls combat + itself. Combat loads empty so the
 * shooter contributes its own abilities. */
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
 * R3.P11 — resolve plugin modules from a list of plugin ids.
 * Empty input → empty result. Unknown ids skip with a console.warn
 * instead of forcing the project into a 3-element preset.
 *
 * Note: shooter-demo's "combat loads empty" semantic — when the
 * input contains shooter-demo BUT NOT a combat-needs-default
 * marker, combat is loaded via the static map's default factory
 * (which uses DEFAULT_COMBAT_ABILITIES). For projects that want
 * an empty combat starter pack alongside shooter-demo, the
 * static factory would need a parametric form. Today's behavior
 * matches the prior `getServerPluginModules("shooter-demo")`
 * exactly: combat with empty abilities + shooter. Achieved by
 * the shooter-demo branch in `getServerPluginModules`. Migration
 * cleanup follow-up.
 */
export function resolveServerPluginModules(
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
        `[plugin-boot] Plugin id "${id}" is not in the server's static map — skipping. Add it to STATIC_PLUGIN_MAP in plugins.ts (and NPM_TO_MANIFEST_ID if applicable) to make it bootable on the server.`,
      );
      continue;
    }
    out.push(factory());
  }
  return out;
}

/**
 * Resolve which game plugin set the server should boot from the
 * `HYPERSCAPE_GAME_PLUGIN` env var. Defaults to "hyperscape" when
 * unset or invalid, preserving every existing boot path's behavior.
 */
export function resolveGamePluginSetIdFromEnv(): GamePluginSetId {
  const raw = process.env.HYPERSCAPE_GAME_PLUGIN;
  if (raw === "shooter-demo") return "shooter-demo";
  return "hyperscape";
}

/**
 * Build the in-binary plugin set for the requested game. Exported
 * separately so tests can feed a specific game id to
 * `startPluginSessionFromModules` without going through env-var
 * resolution or the full server bootstrap.
 */
export function getServerPluginModules(
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
          // Combat is the ability-registry primitive. The shooter
          // demo owns its own ability set, so combat loads with an
          // empty starter pack here — mirrors the shooter-demo
          // acceptance test in packages/plugin-shooter-demo/.
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
 * Boot the in-binary plugin set. Called from `initializeWorld` after
 * world systems are registered but before `world.init()`. Returns the
 * session so callers can `session.stop()` on shutdown for clean
 * disposer teardown.
 *
 * The framework manages each plugin's scope internally — the
 * context factory just returns the base shape. Richer contexts
 * (world reference, system registry, etc.) get layered on when the
 * first plugin actually needs them.
 */
export async function bootServerPlugins(
  world?: World,
  gameIdOrPlugins:
    | GamePluginSetId
    | ReadonlyArray<string> = resolveGamePluginSetIdFromEnv(),
  projectContentPackIds?: ReadonlyArray<string>,
): Promise<PluginSession<PluginContextBase>> {
  // R3.P11 — accept either the legacy gameId string OR a plugin
  // id list (manifest id or npm name). The latter goes through
  // resolveServerPluginModules which does the static-map lookup
  // + transitive-dep expansion. The former preserves the legacy
  // env / smoke-test boot path.
  const isLegacyGameId = typeof gameIdOrPlugins === "string";
  const modules = isLegacyGameId
    ? getServerPluginModules(gameIdOrPlugins as GamePluginSetId)
    : resolveServerPluginModules(gameIdOrPlugins);
  const label = isLegacyGameId
    ? `game=${gameIdOrPlugins}`
    : `plugins=[${(gameIdOrPlugins as ReadonlyArray<string>).join(", ") || "<empty>"}]`;
  console.log(`[plugin-boot] ${label} — ${modules.length} plugin(s) in set`);
  // Hyperia content gate (commit 5226d8ae1 added the gate to
  // hyperscape-plugin's onEnable; this commit closes the loop on
  // the server side). The hyperscape plugin's `onEnable` checks
  // `ctx.projectContentPackIds` for `@hyperforge/content-pack-hyperia-v1`
  // before registering 7 content-emitting systems (towns, POIs,
  // bankers, NPC populations, item spawners, quests, station
  // spawners). Without this list passed through, the gate
  // silently fails closed on production Hyperia deploys.
  //
  // Default behavior:
  //   - Legacy gameId "hyperscape": pass the Hyperia content pack
  //     id automatically (preserves legacy production boot — the
  //     env says "hyperscape", so we ARE the Hyperia game).
  //   - Legacy gameId "shooter-demo" / "blank": empty list (no
  //     Hyperia content).
  //   - Explicit `projectContentPackIds` arg: caller-supplied
  //     list wins (used by per-project hosts like asset-forge PIE
  //     and any future project-aware production server).
  const resolvedContentPackIds: ReadonlyArray<string> =
    projectContentPackIds ??
    (isLegacyGameId && gameIdOrPlugins === "hyperscape"
      ? ["@hyperforge/content-pack-hyperia-v1"]
      : []);
  const session = await startPluginSessionFromModules(modules, {
    // Context factory dispatches by manifest id. Each plugin receives
    // its declared context shape (CombatContext / SkillsContext /
    // HyperscapeContext) wired to a real per-server service or to the
    // host's world. Disposers attached to the scope inside the
    // factory's helper methods unregister on stop.
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
          // Meta-plugin's onEnable calls `ctx.world.register(...)` to
          // attach migrated systems (first cut: MobDeathSystem).
          // Tests that don't supply a world fall back to a tiny stub
          // — `register` is a no-op there so the plugin's registration
          // call doesn't blow up.
          //
          // `projectContentPackIds` is resolved above. It tells the
          // hyperscape plugin's onEnable whether to register the 7
          // Hyperia content-emitting systems (towns, POIs, bankers,
          // etc.) or skip them (mechanics-only mode for non-Hyperia
          // projects that pick the plugin for combat / skills only).
          const ctx: HyperscapeContext = {
            pluginId,
            scope,
            world: world ?? createNoopWorldStub(),
            projectContentPackIds: resolvedContentPackIds,
          };
          return ctx as PluginContextBase;
        }
        case shooterDemoManifest.id: {
          // Shooter demo contributes combat abilities through the same
          // CombatContext shape the combat plugin does — shares the
          // per-server `CombatAbilityService` so both plugins write to
          // the same registry. When the active gameId is
          // "shooter-demo", combat itself loaded with an empty starter
          // pack (see getServerPluginModules), so only shooter's
          // abilities end up registered.
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
        default:
          return { pluginId, scope };
      }
    },
  });

  if (session.unresolvable.length > 0) {
    for (const entry of session.unresolvable) {
      console.warn(
        `[plugin-boot] unresolvable: "${entry.module.manifest.id}" — ${entry.reason}`,
      );
    }
  }

  if (session.records.length > 0) {
    const ids = session.records.map((r) => r.manifest.id).join(", ");
    console.log(
      `[plugin-boot] started ${session.records.length} plugin(s): ${ids}`,
    );
  }

  return session;
}
