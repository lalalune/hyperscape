/**
 * Avatar Definitions
 *
 * Defines available VRM avatar models for character creation.
 * These models are loaded from the asset server at runtime.
 *
 * ## LOD System
 * Avatars use a 3-tier LOD system for performance:
 * - LOD0 (url): 30K triangles - close range gameplay
 * - LOD1 (lod1Url): 10K triangles - medium distance
 * - LOD2 (lod2Url): 2K triangles - far distance / impostor base
 *
 * ## Texture Optimization
 * All avatar textures are optimized:
 * - Color/Diffuse: 2048px max
 * - Normal maps: 1024px max
 * - No metallic/roughness/AO textures (simplified PBR)
 */

export interface AvatarOption {
  id: string;
  name: string;
  /** LOD0 URL - Full detail (30K triangles) */
  url: string;
  /** LOD1 URL - Medium detail (10K triangles) */
  lod1Url?: string;
  /** LOD2 URL - Low detail (2K triangles) */
  lod2Url?: string;
  /** Path portion for character preview (prepend CDN URL) */
  previewPath: string;
  description?: string;
}

export const DEFAULT_AVATAR_FILENAME = "avatar-male-01.vrm";
export const DEFAULT_AVATAR_URL = `asset://avatars/${DEFAULT_AVATAR_FILENAME}`;

const LEGACY_AVATAR_ALIASES: Record<string, string> = {
  "ws-avatar.vrm": DEFAULT_AVATAR_FILENAME,
  "avatar.vrm": DEFAULT_AVATAR_FILENAME,
};

const AVATAR_LOD_SUFFIX_PATTERN = /_lod[12](?=\.vrm$)/i;

function normalizeAvatarFilename(filename: string): string {
  const withoutLod = filename.replace(AVATAR_LOD_SUFFIX_PATTERN, "");
  return LEGACY_AVATAR_ALIASES[withoutLod.toLowerCase()] ?? withoutLod;
}

function getAvatarLookupKey(url?: string | null): string | null {
  const normalized = normalizeAvatarAssetUrl(url, "");
  if (!normalized) return null;
  const match = normalized.match(/([A-Za-z0-9_.-]+\.vrm)(?:[?#].*)?$/i);
  return match ? normalizeAvatarFilename(match[1]).toLowerCase() : null;
}

export function normalizeAvatarAssetUrl(
  url?: string | null,
  fallbackUrl = DEFAULT_AVATAR_URL,
): string {
  const candidate = url?.trim() ?? "";
  if (!candidate) return fallbackUrl;

  const bareAvatarMatch = candidate.match(/^([A-Za-z0-9_.-]+\.vrm)([?#].*)?$/i);
  if (bareAvatarMatch) {
    const [, filenameRaw, suffix = ""] = bareAvatarMatch;
    return `asset://avatars/${normalizeAvatarFilename(filenameRaw)}${suffix}`;
  }

  const relativeAvatarMatch = candidate.match(
    /^(?:\.\/|\/)?avatars\/([A-Za-z0-9_.-]+\.vrm)([?#].*)?$/i,
  );
  if (relativeAvatarMatch) {
    const [, filenameRaw, suffix = ""] = relativeAvatarMatch;
    return `asset://avatars/${normalizeAvatarFilename(filenameRaw)}${suffix}`;
  }

  const assetAvatarMatch = candidate.match(
    /^asset:\/\/avatars\/([A-Za-z0-9_.-]+\.vrm)([?#].*)?$/i,
  );
  if (assetAvatarMatch) {
    const [, filenameRaw, suffix = ""] = assetAvatarMatch;
    return `asset://avatars/${normalizeAvatarFilename(filenameRaw)}${suffix}`;
  }

  const absoluteAvatarMatch = candidate.match(
    /^(https?:\/\/[^?#]+\/avatars\/)([A-Za-z0-9_.-]+\.vrm)([?#].*)?$/i,
  );
  if (absoluteAvatarMatch) {
    const [, prefix, filenameRaw, suffix = ""] = absoluteAvatarMatch;
    return `${prefix}${normalizeAvatarFilename(filenameRaw)}${suffix}`;
  }

  return candidate.replace(
    /_lod[12](?=\.vrm(?:[?#].*)?$)/i,
    "",
  );
}

/** LOD level enum for avatar selection */
export enum AvatarLOD {
  /** Full detail - 30K triangles (close range) */
  LOD0 = 0,
  /** Medium detail - 10K triangles (medium distance) */
  LOD1 = 1,
  /** Low detail - 2K triangles (far distance) */
  LOD2 = 2,
}

/** Distance thresholds for LOD switching (in meters) */
export const AVATAR_LOD_DISTANCES = {
  /** Distance at which to switch from LOD0 to LOD1 */
  LOD0_TO_LOD1: 30,
  /** Distance at which to switch from LOD1 to LOD2 */
  LOD1_TO_LOD2: 60,
} as const;

/**
 * Available avatar models
 *
 * - `url`: LOD0 (30K triangles) - Uses asset:// protocol resolved by ClientLoader
 * - `lod1Url`: LOD1 (10K triangles) - Medium distance
 * - `lod2Url`: LOD2 (2K triangles) - Far distance
 * - `previewPath`: Path portion for CharacterPreview component (CDN URL prepended at runtime)
 *
 * Triangle counts (optimized):
 * - LOD0: ~30K triangles (main gameplay)
 * - LOD1: ~10K triangles (medium distance)
 * - LOD2: ~2K triangles (far distance / impostor)
 */
export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: "male-01",
    name: "Male Avatar 01",
    url: "asset://avatars/avatar-male-01.vrm",
    previewPath: "/avatars/avatar-male-01.vrm",
    description: "Standard male humanoid avatar",
  },
  {
    id: "male-02",
    name: "Male Avatar 02",
    url: "asset://avatars/avatar-male-02.vrm",
    previewPath: "/avatars/avatar-male-02.vrm",
    description: "Standard male humanoid avatar",
  },
  {
    id: "female-01",
    name: "Female Avatar 01",
    url: "asset://avatars/avatar-female-01.vrm",
    previewPath: "/avatars/avatar-female-01.vrm",
    description: "Standard female humanoid avatar",
  },
  {
    id: "female-02",
    name: "Female Avatar 02",
    url: "asset://avatars/avatar-female-02.vrm",
    previewPath: "/avatars/avatar-female-02.vrm",
    description: "Standard female humanoid avatar",
  },
];

/**
 * Get avatar by ID
 */
export function getAvatarById(id: string): AvatarOption | undefined {
  return AVATAR_OPTIONS.find((avatar) => avatar.id === id);
}

/**
 * Get avatar by URL (checks url, lod1Url, lod2Url, and previewPath)
 */
export function getAvatarByUrl(url: string): AvatarOption | undefined {
  const lookupKey = getAvatarLookupKey(url);
  return AVATAR_OPTIONS.find(
    (avatar) =>
      getAvatarLookupKey(avatar.url) === lookupKey ||
      getAvatarLookupKey(avatar.lod1Url) === lookupKey ||
      getAvatarLookupKey(avatar.lod2Url) === lookupKey ||
      getAvatarLookupKey(avatar.previewPath) === lookupKey,
  );
}

/**
 * Get the appropriate LOD level based on distance
 * @param distance Distance from camera in meters
 * @returns LOD level (0, 1, or 2)
 */
export function getAvatarLODForDistance(distance: number): AvatarLOD {
  if (distance >= AVATAR_LOD_DISTANCES.LOD1_TO_LOD2) {
    return AvatarLOD.LOD2;
  }
  if (distance >= AVATAR_LOD_DISTANCES.LOD0_TO_LOD1) {
    return AvatarLOD.LOD1;
  }
  return AvatarLOD.LOD0;
}

/**
 * Get the URL for a specific LOD level of an avatar
 * Falls back to higher detail LOD if requested LOD is not available
 *
 * @param avatar The avatar option
 * @param lod The desired LOD level
 * @returns The URL for the requested LOD (or fallback)
 */
export function getAvatarUrlForLOD(
  avatar: AvatarOption,
  lod: AvatarLOD,
): string {
  switch (lod) {
    case AvatarLOD.LOD2:
      return normalizeAvatarAssetUrl(
        avatar.lod2Url ?? avatar.lod1Url ?? avatar.url,
      );
    case AvatarLOD.LOD1:
      return normalizeAvatarAssetUrl(avatar.lod1Url ?? avatar.url);
    case AvatarLOD.LOD0:
    default:
      return normalizeAvatarAssetUrl(avatar.url);
  }
}

/**
 * Get all LOD URLs for an avatar (for preloading)
 * @param avatar The avatar option
 * @returns Array of all available LOD URLs
 */
export function getAllAvatarLODUrls(avatar: AvatarOption): string[] {
  return Array.from(
    new Set(
      [avatar.url, avatar.lod1Url, avatar.lod2Url]
        .filter((url): url is string => Boolean(url))
        .map((url) => normalizeAvatarAssetUrl(url)),
    ),
  );
}
