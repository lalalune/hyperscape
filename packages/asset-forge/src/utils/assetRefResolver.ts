/**
 * AssetRef resolver — translate a global `<packId>/<entryId>`
 * reference into the underlying `modelUrl` so the studio renderer
 * can load it.
 *
 * Refs come out of `GET_PROJECT_STATE.availableAssets` and land in
 * the `assetRef` field on `WorldAreaNPC` / `WorldAreaMobSpawn` /
 * `WorldAreaResource` / `WorldAreaStation` placements. The entry's
 * concrete `modelUrl` lives inside the pack's manifest blob in
 * the database — fetched lazily and cached so the viewport
 * doesn't re-fetch the same manifest for every marker.
 *
 * Layer A.5 of the AI ↔ assets ↔ plugins integration: with the
 * resolver wired into `useAgentEntityMarkers`, the agent's
 * placements actually render the right 3D model instead of a
 * placeholder cube.
 */

import { getAssetPack } from "./assetPackApi";

/**
 * Split `<packManifestId>/<entryId>` into its two parts. Pack
 * ids may include slashes (`@scope/pack-name-vN`) so we split on
 * the LAST slash.
 */
function splitRef(ref: string): { packId: string; entryId: string } | null {
  const lastSlash = ref.lastIndexOf("/");
  if (lastSlash <= 0 || lastSlash >= ref.length - 1) return null;
  const packId = ref.slice(0, lastSlash);
  const entryId = ref.slice(lastSlash + 1);
  if (!packId || !entryId) return null;
  return { packId, entryId };
}

/**
 * In-flight pack-manifest fetches keyed by manifestId so concurrent
 * resolutions of refs into the same pack share one network round-
 * trip. Resolved manifests stay cached for the session.
 */
const packManifestCache = new Map<
  string,
  Promise<Record<string, unknown> | null>
>();

async function getPackManifest(
  packId: string,
): Promise<Record<string, unknown> | null> {
  const cached = packManifestCache.get(packId);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const pack = await getAssetPack(packId);
      if (!pack) return null;
      const manifest =
        pack.manifest && typeof pack.manifest === "object"
          ? (pack.manifest as Record<string, unknown>)
          : null;
      return manifest;
    } catch {
      return null;
    }
  })();
  packManifestCache.set(packId, promise);
  return promise;
}

/**
 * Resolve an `assetRef` to a model URL by walking the pack's
 * manifest for the matching entry. Returns null when the pack
 * doesn't exist, the entry isn't found, or the entry has no
 * `modelUrl`. Caller is expected to fall back to a placeholder.
 */
export async function resolveAssetRef(ref: string): Promise<string | null> {
  const parts = splitRef(ref);
  if (!parts) return null;
  const manifest = await getPackManifest(parts.packId);
  if (!manifest) return null;
  const assets = (manifest.assets ?? []) as Array<{
    id?: string;
    modelUrl?: string;
  }>;
  const entry = assets.find((a) => a?.id === parts.entryId);
  if (!entry || typeof entry.modelUrl !== "string") return null;
  return entry.modelUrl;
}

/** Test-only: clear the cache between unit tests. */
export function _clearAssetRefCache(): void {
  packManifestCache.clear();
}
