/**
 * `ProjectContextService` — request-scoped read-only handle on
 * the active project's typed-layer state.
 *
 * Phase A3 of the AAA gap audit. Without this surface every agent
 * call is amnesiac: the agent re-asks "what kind of game are you
 * building?" because it has no read path on prior decisions or
 * the existing world content. The host plugs the active project's
 * `{ config, plugins, worldContent }` into a service-shaped
 * closure that lives for the duration of one design request, and
 * the `GET_PROJECT_STATE` action exposes it to the LLM.
 *
 * Why a service (not just a plain runtime field):
 *
 *   ElizaOS's `getService(name)` is the canonical lookup for any
 *   per-runtime state. Following the convention keeps action
 *   handlers consistent (`runtime.getService(...)` everywhere).
 *
 * Why request-scoped (not singleton):
 *
 *   The agent server's runtime is constructed per `/design` call
 *   already. Concurrent requests get isolated closures, so there's
 *   no cross-request leak of one user's project into another's
 *   chat.
 */

export const PROJECT_CONTEXT_SERVICE_TYPE = "projectContextService" as const;

/**
 * One installed asset pack as the agent sees it. Mirrors a
 * subset of `AssetPackManifest` from `@hyperforge/manifest-schema`
 * — agent only needs the catalog (id, name, type, subtype) to pick
 * assets, not URLs / thumbnails.
 */
export interface ProjectContextAssetPack {
  readonly manifestId: string;
  readonly name: string;
  readonly packVersion: string;
  readonly assets: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly type: string;
    readonly subtype: string;
    readonly tags?: ReadonlyArray<string>;
  }>;
}

/**
 * What the agent sees about the active project. Mirrors the
 * Project-as-Data typed columns. Every field is optional — a
 * project may have any subset populated.
 */
export interface ProjectContext {
  /** UUID of the project record in the studio's DB, when known. */
  readonly projectId?: string;
  /** `"blank" | "hyperia" | ...` — the template the project was forked from. */
  readonly templateId?: string | null;
  /** WorldCreationConfig — terrain knobs, biomes, vegetation. */
  readonly config?: unknown;
  /** npm-style plugin ids the project loads. */
  readonly plugins?: ReadonlyArray<string>;
  /** Validated `ProjectWorldContent` — npcs, zones, spawns, uiPack, etc. */
  readonly worldContent?: unknown;
  /**
   * Asset packs installed on this project (resolved manifests).
   * Phase AP4 of `PLAN_ASSET_PACKS.md`. Empty / omitted = no
   * packs installed; agent may only place engine-default
   * placeholders. The host (studio) is responsible for fetching
   * each pack's manifest and packing them into this field before
   * issuing the design request.
   */
  readonly assetPacks?: ReadonlyArray<ProjectContextAssetPack>;
}

/**
 * The contract `GET_PROJECT_STATE` looks up. The host is
 * responsible for instantiating something that satisfies this and
 * registering it under `PROJECT_CONTEXT_SERVICE_TYPE` in the
 * runtime's `getService` table.
 */
export interface IProjectContextService {
  getProjectContext(): ProjectContext | null;
}

/**
 * Trivial in-memory implementation. The agent server uses this
 * shape inside `handleDesignRequest` to expose `request.projectContext`
 * via `getService(PROJECT_CONTEXT_SERVICE_TYPE)`.
 */
export function makeProjectContextService(
  context: ProjectContext | null,
): IProjectContextService {
  return {
    getProjectContext() {
      return context;
    },
  };
}
