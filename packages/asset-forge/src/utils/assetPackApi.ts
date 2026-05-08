/**
 * Asset Packs API client.
 *
 * Phase AP4 of `PLAN_ASSET_PACKS.md`. Calls the studio's
 * `/api/asset-packs` endpoints (built-in + team-scoped packs) and
 * shapes the response into the agent-facing `ProjectContextAssetPack`
 * the design endpoint expects in `projectContext.assetPacks`.
 */

import { apiFetch } from "./api";

export interface AssetPackResponse {
  id: string;
  manifestId: string;
  source: string;
  version: string;
  manifest: unknown;
  teamId: string | null;
  /** AP9.1 — "private" | "team" | "public". */
  visibility: string;
  /** AP9.1 — set when pack first reaches `visibility="public"`. */
  publishedAt: string | null;
  createdAt: string;
}

interface AssetPackManifestShape {
  id: string;
  name: string;
  description?: string;
  packVersion: string;
  assets: ReadonlyArray<{
    id: string;
    name: string;
    description?: string;
    type: string;
    subtype: string;
    tags?: ReadonlyArray<string>;
  }>;
}

/**
 * One pack as the agent sees it via `GET_PROJECT_STATE`. Mirrors
 * `ProjectContextAssetPack` from `@hyperforge/eliza-game-builder`
 * — agent only needs id+name+catalog, not URLs or thumbnails.
 */
export interface ResolvedProjectAssetPack {
  manifestId: string;
  name: string;
  packVersion: string;
  assets: ReadonlyArray<{
    id: string;
    name: string;
    description?: string;
    type: string;
    subtype: string;
    tags?: ReadonlyArray<string>;
  }>;
}

export async function getAssetPack(
  manifestId: string,
): Promise<AssetPackResponse | null> {
  const encoded = encodeURIComponent(manifestId);
  const res = await apiFetch(`/api/asset-packs/${encoded}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch asset pack ${manifestId}: ${res.status}`);
  }
  return res.json();
}

export async function listAssetPacks(
  teamId?: string,
): Promise<AssetPackResponse[]> {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const res = await apiFetch(`/api/asset-packs${qs}`);
  if (!res.ok) {
    throw new Error(`Failed to list asset packs: ${res.status}`);
  }
  return res.json();
}

/**
 * AP9.2 — browse the public marketplace. No auth required;
 * returns every `visibility="public"` pack ordered by
 * `published_at DESC`. Pagination via limit/offset.
 */
export async function listMarketplaceAssetPacks(options?: {
  limit?: number;
  offset?: number;
}): Promise<AssetPackResponse[]> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  if (options?.offset !== undefined)
    params.set("offset", String(options.offset));
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await apiFetch(`/api/asset-packs/marketplace${qs}`);
  if (!res.ok) {
    throw new Error(`Failed to browse marketplace: ${res.status}`);
  }
  return res.json();
}

/**
 * One installable pack as the agent's `LIST_ASSET_PACKS` action
 * sees it. Mirrors `InstallableAssetPack` from
 * `@hyperforge/eliza-game-builder`. The studio fetches packs and
 * shapes them into this form before sending on `installableAssetPacks`.
 */
export interface InstallablePackSummary {
  manifestId: string;
  name: string;
  description: string;
  packVersion: string;
  assetCount: number;
  tags: string[];
  source: "builtin" | "team" | "marketplace";
  /**
   * Phase 5 / C3 prep — counts for each non-asset content
   * section the pack ships. The agent uses these to decide
   * which packs match a player's request ("how many biomes
   * does the tropical pack have?") without re-fetching the
   * full manifest. Counts default to 0 when the section is
   * absent — same as the pack browser UI's badge surface
   * (`AssetPackBrowserPanel.tsx`).
   */
  biomeCount: number;
  terrainShaderCount: number;
  terrainHeightmapPresetCount: number;
  terrainNoiseFunctionCount: number;
  waterShaderCount: number;
  waterAnimationCount: number;
  vegetationSpeciesCount: number;
  vegetationDensityRuleCount: number;
}

/**
 * Fetch packs the active team can install and reshape into the
 * `InstallablePackSummary` form the agent server expects on
 * `installableAssetPacks`. Built-in packs come from `team_id IS NULL`;
 * team packs come from the caller's team scope.
 */
export async function listInstallableAssetPacks(
  teamId?: string,
): Promise<InstallablePackSummary[]> {
  const packs = await listAssetPacks(teamId);
  return packs
    .map((pack) => {
      const manifest = pack.manifest as {
        id?: string;
        name?: string;
        description?: string;
        packVersion?: string;
        assets?: ReadonlyArray<unknown>;
        tags?: ReadonlyArray<string>;
        biomes?: ReadonlyArray<unknown>;
        terrainShaders?: ReadonlyArray<unknown>;
        terrainHeightmapPresets?: ReadonlyArray<unknown>;
        terrainNoiseFunctions?: ReadonlyArray<unknown>;
        waterShaders?: ReadonlyArray<unknown>;
        waterAnimations?: ReadonlyArray<unknown>;
        vegetationSpecies?: ReadonlyArray<unknown>;
        vegetationDensityRules?: ReadonlyArray<unknown>;
      } | null;
      if (!manifest || typeof manifest !== "object") return null;
      const arrLen = (a: ReadonlyArray<unknown> | undefined) =>
        Array.isArray(a) ? a.length : 0;
      return {
        manifestId: pack.manifestId,
        name: manifest.name ?? pack.manifestId,
        description: manifest.description ?? "",
        packVersion: manifest.packVersion ?? pack.version,
        assetCount: arrLen(manifest.assets),
        tags: Array.isArray(manifest.tags) ? [...manifest.tags] : [],
        source: pack.teamId === null ? "builtin" : "team",
        biomeCount: arrLen(manifest.biomes),
        terrainShaderCount: arrLen(manifest.terrainShaders),
        terrainHeightmapPresetCount: arrLen(manifest.terrainHeightmapPresets),
        terrainNoiseFunctionCount: arrLen(manifest.terrainNoiseFunctions),
        waterShaderCount: arrLen(manifest.waterShaders),
        waterAnimationCount: arrLen(manifest.waterAnimations),
        vegetationSpeciesCount: arrLen(manifest.vegetationSpecies),
        vegetationDensityRuleCount: arrLen(manifest.vegetationDensityRules),
      } as InstallablePackSummary;
    })
    .filter((p): p is InstallablePackSummary => p !== null);
}

/**
 * Create a new (empty) team asset pack. Pack starts at
 * `visibility="team"` and has no asset entries — the owner adds
 * entries through the dedicated "Add to Pack" surface (or the
 * seeder, or the agent's bake pipeline routing).
 *
 * Throws on 409 (id collision) or 403 (not a team member).
 */
export async function createAssetPack(input: {
  manifestId: string;
  name: string;
  description?: string;
  packVersion: string;
  license?: string;
  tags?: string[];
  teamId: string;
}): Promise<AssetPackResponse> {
  const res = await apiFetch("/api/asset-packs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Failed to create asset pack: ${text}`);
  }
  return res.json();
}

/**
 * One asset entry inside a pack manifest. Mirrors
 * `AssetPackEntrySchema` from `@hyperforge/manifest-schema`.
 *
 * Inlined here as a TypeScript type so consumers don't need to
 * import the manifest-schema package just to call the API.
 */
export interface AssetPackEntryInput {
  id: string;
  name: string;
  description?: string;
  type:
    | "character"
    | "creature"
    | "prop"
    | "weapon"
    | "tool"
    | "armor"
    | "vehicle"
    | "misc";
  subtype: string;
  modelUrl: string;
  thumbnailUrl?: string;
  characterHeight?: number;
  rigged?: boolean;
  tags?: string[];
}

/**
 * Append an entry to a pack's manifest. Validates server-side
 * against `AssetPackEntrySchema`; rejects duplicate ids and
 * built-in packs (which are seeder-managed).
 */
export async function addAssetPackEntry(
  manifestId: string,
  entry: AssetPackEntryInput,
): Promise<AssetPackResponse> {
  const encoded = encodeURIComponent(manifestId);
  const res = await apiFetch(`/api/asset-packs/${encoded}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Failed to add pack entry: ${text}`);
  }
  return res.json();
}

/**
 * AP9 — publish a team pack to the marketplace. Flips visibility
 * from "team" to "public". Caller must be a team owner of the
 * pack's team.
 */
export async function publishAssetPack(
  manifestId: string,
): Promise<AssetPackResponse> {
  const encoded = encodeURIComponent(manifestId);
  const res = await apiFetch(`/api/asset-packs/${encoded}/publish`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Failed to publish pack: ${text}`);
  }
  return res.json();
}

/**
 * AP9 — unpublish a previously-public pack (takedown). Flips
 * visibility back to "team" and clears published_at.
 */
export async function unpublishAssetPack(
  manifestId: string,
): Promise<AssetPackResponse> {
  const encoded = encodeURIComponent(manifestId);
  const res = await apiFetch(`/api/asset-packs/${encoded}/unpublish`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Failed to unpublish pack: ${text}`);
  }
  return res.json();
}

/**
 * Replace the project's installed asset pack list. Calls
 * `POST /api/world/projects/:projectId/asset-packs`. The new list
 * is persisted, the project version bumps, and the BEFORE state
 * is snapshotted into the revision history.
 */
export async function setProjectAssetPacks(
  projectId: string,
  assetPacks: ReadonlyArray<string>,
): Promise<void> {
  const res = await apiFetch(
    `/api/world/projects/${encodeURIComponent(projectId)}/asset-packs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetPacks: [...assetPacks] }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Failed to update asset packs: ${text}`);
  }
}

/**
 * Resolve a list of pack manifestIds into the catalog shape the
 * agent's `GET_PROJECT_STATE` returns. Missing packs (404) are
 * silently dropped — surfaces as "fewer assets available" to the
 * agent rather than throwing.
 */
export async function resolveProjectAssetPacks(
  manifestIds: ReadonlyArray<string>,
): Promise<ResolvedProjectAssetPack[]> {
  if (manifestIds.length === 0) return [];
  const settled = await Promise.allSettled(
    manifestIds.map((id) => getAssetPack(id)),
  );
  const out: ResolvedProjectAssetPack[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status !== "fulfilled" || !result.value) continue;
    const pack = result.value;
    const manifest = pack.manifest as AssetPackManifestShape | null;
    if (!manifest || typeof manifest !== "object") continue;
    if (!Array.isArray(manifest.assets)) continue;
    out.push({
      manifestId: pack.manifestId,
      name: manifest.name ?? pack.manifestId,
      packVersion: manifest.packVersion ?? pack.version,
      assets: manifest.assets.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        type: a.type,
        subtype: a.subtype,
        tags: a.tags,
      })),
    });
  }
  return out;
}
