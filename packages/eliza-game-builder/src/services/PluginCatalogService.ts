/**
 * `PluginCatalogService` — request-scoped read of the plugins
 * the agent is allowed to recommend installing.
 *
 * R1.P15 of `PLAN_HYPERIA_DECOUPLING.md`. The studio fetches
 * `GET /api/plugins/installed` (backed by
 * `PluginRegistryService` — which discovers plugins from the
 * monorepo workspace + `node_modules/@hyperforge/`) and plugs
 * the result into the runtime as a service per-request. The
 * agent's `LIST_PLUGINS` action reads through here so it sees
 * the actual installed/discoverable plugins instead of the
 * hardcoded `KNOWN_PLUGINS` 2-element fallback that lived in
 * the action file.
 *
 * Request-scoped (not singleton): each `/design` invocation
 * gets its own snapshot, so concurrent requests don't see
 * each other's teams' plugins (when team-scoped registries
 * land — today the registry is global to the asset-forge
 * server).
 */

export const PLUGIN_CATALOG_SERVICE_TYPE = "pluginCatalogService" as const;

/**
 * One installable plugin as the agent sees it. Mirrors a subset
 * of the `plugin.json` manifest — agent only needs id + name +
 * description + tags to pick which to recommend; full
 * contribution arrays are not surfaced here (the agent doesn't
 * pre-validate contributions).
 */
/**
 * One entity-type contribution from a plugin's
 * `plugin.json` `contributions.entityTypes[]`. R2.P10 of
 * `PLAN_HYPERIA_DECOUPLING.md` plumbs these from the live
 * registry to the agent so `LIST_ENTITY_TYPES` reflects the
 * actual `plugin.json` contents instead of a static mirror in
 * eliza-game-builder.
 */
export interface InstallablePluginEntityType {
  readonly kind: "npc" | "mobSpawn" | "resource" | "station";
  readonly type: string;
  readonly description: string;
  readonly requiredFields: ReadonlyArray<string>;
  readonly acceptedAssetTypes: ReadonlyArray<string>;
}

export interface InstallablePlugin {
  /** Manifest id, e.g. `com.hyperforge.hyperscape`. */
  readonly id: string;
  /** npm-style name, e.g. `@hyperforge/hyperscape`. May be null
   * for unpublished workspace-only plugins. */
  readonly npmName: string | null;
  /** Human-friendly name from the manifest. */
  readonly name: string;
  /** One-line description for chat surfaces. */
  readonly description: string;
  /** Free-form tags applied to the plugin. */
  readonly tags: ReadonlyArray<string>;
  /**
   * R2.P10 — entity-type contributions from the plugin's live
   * `plugin.json`. When populated by the studio (which reads
   * `PluginRegistryService` output), `LIST_ENTITY_TYPES`
   * surfaces these to the agent instead of falling back to the
   * static `_PLUGIN_ENTITY_TYPES` mirror in eliza-game-builder.
   * Empty array (default) preserves legacy behavior — the
   * action's static fallback fires.
   */
  readonly entityTypeContributions?: ReadonlyArray<InstallablePluginEntityType>;
  /**
   * R2.P10 broader (Phase 3.1 of PLAN_AAA_MASTER_AUDIT) —
   * command id contributions from the plugin's live
   * `plugin.json`. Each entry is a namespaced command id (e.g.
   * `com.hyperforge.combat.commands.swap-ability`). The
   * `LIST_COMMANDS` (and generic `LIST_CONTRIBUTIONS`) action
   * surfaces these to the agent so it can reference real
   * plugin-declared commands when scaffolding gameplay (key
   * bindings, palette entries, action targets) instead of
   * inventing names.
   *
   * Empty / undefined preserves legacy behavior (no commands
   * known) — the action returns an empty list.
   */
  readonly commandContributions?: ReadonlyArray<string>;
  /**
   * R2.P10 broader — system contribution names from the
   * plugin's `plugin.json`. Each entry is the registered
   * system name the plugin wires into the host world via
   * `world.register("name", System)`.
   */
  readonly systemContributions?: ReadonlyArray<string>;
  /**
   * R2.P10 broader — entity-class contribution names. Each
   * entry is a registered entity-type id consumed by
   * `EntityManager.spawn`. Distinct from `entityType
   * Contributions` (typed agent-facing placement entries) —
   * this list is the raw class-name catalog.
   */
  readonly entityContributions?: ReadonlyArray<string>;
  /**
   * R2.P10 broader — UI widget contribution ids. Each entry
   * is a widget registration id consumed by `bindAllWidgets`
   * via the host's widget registry.
   */
  readonly widgetContributions?: ReadonlyArray<string>;
  /**
   * R2.P10 broader — manifest schema contribution ids
   * (Zod-validated authoring schemas the plugin extends with
   * its own data shapes — quests, dialogues, etc.).
   */
  readonly manifestSchemaContributions?: ReadonlyArray<string>;
  /**
   * R2.P10 broader — palette category contribution ids
   * (drives the studio's `ContentBrowser` left-panel
   * categories when the editor reads from this registry —
   * Phase 3.1 follow-up will wire the consumer side).
   */
  readonly paletteCategoryContributions?: ReadonlyArray<string>;
  /**
   * R2.P10 broader — toolbar tool contribution ids (drives
   * the studio's `MainToolbar` mode palette).
   */
  readonly toolbarToolContributions?: ReadonlyArray<string>;
}

/**
 * The 6 plugin-contribution fields that share a uniform
 * `string[]` shape (commands + 5 we wire together in Phase
 * 3.1). Used as the `kind` parameter for the generic
 * `LIST_CONTRIBUTIONS` action.
 */
export type PluginContributionKind =
  | "commands"
  | "systems"
  | "entities"
  | "widgets"
  | "manifestSchemas"
  | "paletteCategories"
  | "toolbarTools";

export interface IPluginCatalogService {
  /**
   * Every plugin the active project could install / declare.
   * Already filtered by the host. May be empty if no plugins
   * are discoverable.
   */
  listInstallable(): ReadonlyArray<InstallablePlugin>;
}

/**
 * Trivial in-memory implementation. The agent server uses this
 * inside `handleDesignRequest` to plug request-scoped catalog
 * data into `getService(PLUGIN_CATALOG_SERVICE_TYPE)`.
 */
export function makePluginCatalogService(
  plugins: ReadonlyArray<InstallablePlugin>,
): IPluginCatalogService {
  const snapshot: ReadonlyArray<InstallablePlugin> = plugins.map((p) => ({
    id: p.id,
    npmName: p.npmName,
    name: p.name,
    description: p.description,
    tags: [...p.tags],
    entityTypeContributions: p.entityTypeContributions
      ? p.entityTypeContributions.map((c) => ({
          kind: c.kind,
          type: c.type,
          description: c.description,
          requiredFields: [...c.requiredFields],
          acceptedAssetTypes: [...c.acceptedAssetTypes],
        }))
      : undefined,
    commandContributions: p.commandContributions
      ? [...p.commandContributions]
      : undefined,
    systemContributions: p.systemContributions
      ? [...p.systemContributions]
      : undefined,
    entityContributions: p.entityContributions
      ? [...p.entityContributions]
      : undefined,
    widgetContributions: p.widgetContributions
      ? [...p.widgetContributions]
      : undefined,
    manifestSchemaContributions: p.manifestSchemaContributions
      ? [...p.manifestSchemaContributions]
      : undefined,
    paletteCategoryContributions: p.paletteCategoryContributions
      ? [...p.paletteCategoryContributions]
      : undefined,
    toolbarToolContributions: p.toolbarToolContributions
      ? [...p.toolbarToolContributions]
      : undefined,
  }));
  return {
    listInstallable() {
      return snapshot;
    },
  };
}
