/**
 * `AssetPackCatalogService` — request-scoped read of the asset
 * packs the agent is allowed to recommend installing.
 *
 * Phase AP5 of `PLAN_ASSET_PACKS.md`. The host (studio) fetches
 * `GET /api/asset-packs` (built-in + team-owned), filters out
 * packs already installed on the active project, and plugs the
 * remaining list into the runtime as a service. The agent's
 * `LIST_ASSET_PACKS` action reads through here so it knows what
 * to recommend; `PROPOSE_ASSET_PACK_INSTALL` validates against
 * this catalog before surfacing an install proposal.
 *
 * Request-scoped (not singleton): each `/design` invocation gets
 * its own snapshot, so concurrent requests don't see each other's
 * teams' packs.
 */

export const ASSET_PACK_CATALOG_SERVICE_TYPE =
  "assetPackCatalogService" as const;

/**
 * One installable pack as the agent sees it. Mirrors a subset of
 * `AssetPackManifest` — agent only needs id+name+summary stats
 * to pick which to recommend; full asset entries are fetched
 * separately if needed (or surfaced via `GET_PROJECT_STATE.availableAssets`
 * once installed).
 */
export interface InstallableAssetPack {
  /** Pack manifest id, e.g. `@hyperforge/asset-pack-hyperia-v1`. */
  readonly manifestId: string;
  /** Human-friendly name. */
  readonly name: string;
  /** One-line description for chat surfaces. */
  readonly description: string;
  /** Pack semver, e.g. `1.0.0`. */
  readonly packVersion: string;
  /** Number of asset entries this pack contributes. */
  readonly assetCount: number;
  /** Free-form tags applied to the whole pack. */
  readonly tags: ReadonlyArray<string>;
  /**
   * `"builtin"` for first-party packs every team can install,
   * `"team"` for packs owned by the caller's team. UI uses this
   * to decide whether to render an "in your library" badge.
   */
  readonly source: "builtin" | "team" | "marketplace";
  /**
   * Phase 5 / C3 prep — section counts for non-asset content
   * the pack ships. Lets the agent answer "how many biomes
   * does pack X have?" / "does pack Y declare any vegetation
   * species?" without re-fetching the full manifest.
   * Defaults to 0 when the section is absent.
   */
  readonly biomeCount?: number;
  readonly terrainShaderCount?: number;
  readonly terrainHeightmapPresetCount?: number;
  readonly terrainNoiseFunctionCount?: number;
  readonly waterShaderCount?: number;
  readonly waterAnimationCount?: number;
  readonly vegetationSpeciesCount?: number;
  readonly vegetationDensityRuleCount?: number;
}

export interface IAssetPackCatalogService {
  /**
   * Every pack the active project could install. Already
   * filtered to the caller's team scope by the host. May be
   * empty (no packs available to this team).
   */
  listInstallable(): ReadonlyArray<InstallableAssetPack>;
}

/**
 * Trivial in-memory implementation. The agent server uses this
 * inside `handleDesignRequest` to plug request-scoped catalog
 * data into `getService(ASSET_PACK_CATALOG_SERVICE_TYPE)`.
 */
export function makeAssetPackCatalogService(
  packs: ReadonlyArray<InstallableAssetPack>,
): IAssetPackCatalogService {
  const snapshot: ReadonlyArray<InstallableAssetPack> = packs.map((p) => ({
    manifestId: p.manifestId,
    name: p.name,
    description: p.description,
    packVersion: p.packVersion,
    assetCount: p.assetCount,
    tags: [...p.tags],
    source: p.source,
    biomeCount: p.biomeCount,
    terrainShaderCount: p.terrainShaderCount,
    terrainHeightmapPresetCount: p.terrainHeightmapPresetCount,
    terrainNoiseFunctionCount: p.terrainNoiseFunctionCount,
    waterShaderCount: p.waterShaderCount,
    waterAnimationCount: p.waterAnimationCount,
    vegetationSpeciesCount: p.vegetationSpeciesCount,
    vegetationDensityRuleCount: p.vegetationDensityRuleCount,
  }));
  return {
    listInstallable() {
      return snapshot;
    },
  };
}
