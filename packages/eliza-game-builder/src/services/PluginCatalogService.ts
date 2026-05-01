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
}

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
  }));
  return {
    listInstallable() {
      return snapshot;
    },
  };
}
