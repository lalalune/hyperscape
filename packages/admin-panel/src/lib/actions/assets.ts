"use server";

import fs from "fs-extra";
import path from "path";

/**
 * Assets Server Actions
 *
 * Manages game server assets located in packages/server/world/assets/
 * Handles both:
 * - Asset metadata.json files (per-model metadata)
 * - Manifest files (global game data like items.json, npcs.json)
 */

// Path to the game server's assets directory
const ASSETS_ROOT = path.join(process.cwd(), "../server/world/assets");

// Asset categories
const ASSET_CATEGORIES = [
  "models",
  "audio",
  "emotes",
  "grass",
  "vegetation",
  "rocks",
  "terrain",
  "textures",
  "water",
  "world",
  "avatars",
  "manifests",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

// Manifest file names
const MANIFEST_FILES = [
  "items.json",
  "npcs.json",
  "biomes.json",
  "resources.json",
  "stores.json",
  "buildings.json",
  "music.json",
  "world-areas.json",
] as const;

export type ManifestFile = (typeof MANIFEST_FILES)[number];

// =======================
// TYPES
// =======================

export interface AssetFile {
  name: string;
  path: string; // Relative to assets root
  fullPath: string; // Absolute path
  type: "file" | "directory";
  size?: number;
  extension?: string;
  category?: AssetCategory;
}

export interface AssetTree {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: AssetTree[];
  size?: number;
  extension?: string;
}

export interface AssetMetadata {
  name?: string;
  gameId?: string;
  type?: string;
  subtype?: string;
  description?: string;
  detailedPrompt?: string;
  generatedAt?: string;
  completedAt?: string;
  isBaseModel?: boolean;
  materialVariants?: string[];
  isPlaceholder?: boolean;
  hasModel?: boolean;
  hasConceptArt?: boolean;
  modelPath?: string;
  conceptArtUrl?: string;
  gddCompliant?: boolean;
  workflow?: string;
  meshyTaskId?: string;
  meshyStatus?: string;
  // VRM/character specific
  isRigged?: boolean;
  characterHeight?: number;
  riggedModelPath?: string;
  animations?: Record<string, unknown>;
  // Material variants
  isVariant?: boolean;
  parentBaseModel?: string;
  materialPreset?: {
    id: string;
    tier?: string;
    name?: string;
  };
  [key: string]: unknown;
}

export interface ManifestData {
  name: ManifestFile;
  path: string;
  data: unknown[];
  itemCount: number;
}

// =======================
// ASSET FILE OPERATIONS
// =======================

/**
 * Get the asset tree structure
 */
export async function getAssetTree(): Promise<AssetTree> {
  try {
    const tree = await buildTree(ASSETS_ROOT, "");
    return tree;
  } catch (error) {
    console.error("Failed to get asset tree:", error);
    throw new Error("Failed to load assets");
  }
}

/**
 * Build tree structure recursively
 */
async function buildTree(
  fullPath: string,
  relativePath: string,
): Promise<AssetTree> {
  const stats = await fs.stat(fullPath);
  const name = path.basename(fullPath);

  if (stats.isFile()) {
    return {
      name,
      path: relativePath,
      type: "file",
      size: stats.size,
      extension: path.extname(name),
    };
  }

  // Directory
  const children: AssetTree[] = [];
  const entries = await fs.readdir(fullPath);

  for (const entry of entries) {
    // Skip hidden files and README
    if (entry.startsWith(".") || entry === "README.md") {
      continue;
    }

    const entryFullPath = path.join(fullPath, entry);
    const entryRelativePath = relativePath ? `${relativePath}/${entry}` : entry;

    try {
      const child = await buildTree(entryFullPath, entryRelativePath);
      children.push(child);
    } catch (error) {
      // Skip files we can't read
      console.warn(`Skipping ${entry}:`, error);
    }
  }

  return {
    name,
    path: relativePath,
    type: "directory",
    children: children.sort((a, b) => {
      // Directories first, then files, alphabetically
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    }),
  };
}

/**
 * Get list of assets by category
 */
export async function getAssetsByCategory(
  category: AssetCategory,
): Promise<AssetFile[]> {
  const categoryPath = path.join(ASSETS_ROOT, category);

  try {
    const exists = await fs.pathExists(categoryPath);
    if (!exists) {
      return [];
    }

    const entries = await fs.readdir(categoryPath);
    const assets: AssetFile[] = [];

    for (const entry of entries) {
      if (entry.startsWith(".")) continue;

      const fullPath = path.join(categoryPath, entry);
      const stats = await fs.stat(fullPath);
      const relativePath = `${category}/${entry}`;

      assets.push({
        name: entry,
        path: relativePath,
        fullPath,
        type: stats.isDirectory() ? "directory" : "file",
        size: stats.isFile() ? stats.size : undefined,
        extension: stats.isFile() ? path.extname(entry) : undefined,
        category,
      });
    }

    return assets;
  } catch (error) {
    console.error(`Failed to get assets for category ${category}:`, error);
    return [];
  }
}

/**
 * Get asset file contents (for viewing/editing)
 * For binary files (audio, models, images), only returns metadata - use CDN URL to access the file
 */
export async function getAssetFile(relativePath: string): Promise<{
  contents: string;
  type: string;
  size: number;
}> {
  try {
    const fullPath = path.join(ASSETS_ROOT, relativePath);
    const stats = await fs.stat(fullPath);
    const ext = path.extname(relativePath).toLowerCase();

    // Read as text for JSON, metadata
    if (ext === ".json") {
      const contents = await fs.readFile(fullPath, "utf-8");
      return {
        contents,
        type: "json",
        size: stats.size,
      };
    }

    // Binary files (models, audio, images) - don't read contents, use CDN instead
    let type = "binary";

    if ([".glb", ".gltf", ".vrm"].includes(ext)) {
      type = "model";
    } else if ([".mp3", ".ogg", ".wav"].includes(ext)) {
      type = "audio";
    } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      type = "image";
    }

    return {
      contents: "", // Binary files served via CDN
      type,
      size: stats.size,
    };
  } catch (error) {
    console.error(`Failed to get asset file ${relativePath}:`, error);
    throw new Error(`Asset file not found: ${relativePath}`);
  }
}

// =======================
// METADATA OPERATIONS (per-asset metadata.json)
// =======================

/**
 * Get metadata.json for a specific asset
 * Example: models/sword-base/metadata.json
 */
export async function getAssetMetadata(
  assetPath: string,
): Promise<AssetMetadata | null> {
  try {
    const metadataPath = path.join(ASSETS_ROOT, assetPath, "metadata.json");
    const exists = await fs.pathExists(metadataPath);

    if (!exists) {
      return null;
    }

    const contents = await fs.readFile(metadataPath, "utf-8");
    return JSON.parse(contents) as AssetMetadata;
  } catch (error) {
    console.error(`Failed to get metadata for ${assetPath}:`, error);
    return null;
  }
}

/**
 * Update metadata.json for a specific asset
 */
export async function updateAssetMetadata(
  assetPath: string,
  metadata: AssetMetadata,
): Promise<void> {
  try {
    const metadataPath = path.join(ASSETS_ROOT, assetPath, "metadata.json");
    await fs.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      "utf-8",
    );
  } catch (error) {
    console.error(`Failed to update metadata for ${assetPath}:`, error);
    throw new Error("Failed to update asset metadata");
  }
}

/**
 * Get all assets with metadata.json files
 */
export async function getAllAssetsWithMetadata(): Promise<
  Array<{
    path: string;
    metadata: AssetMetadata;
  }>
> {
  const assetsWithMetadata: Array<{ path: string; metadata: AssetMetadata }> =
    [];

  try {
    // Check models directory
    const modelsPath = path.join(ASSETS_ROOT, "models");
    const modelDirs = await fs.readdir(modelsPath);

    for (const dir of modelDirs) {
      if (dir.startsWith(".")) continue;

      const assetPath = `models/${dir}`;
      const metadata = await getAssetMetadata(assetPath);

      if (metadata) {
        assetsWithMetadata.push({ path: assetPath, metadata });
      }
    }

    return assetsWithMetadata;
  } catch (error) {
    console.error("Failed to get assets with metadata:", error);
    return [];
  }
}

// =======================
// MANIFEST OPERATIONS (global game data)
// =======================

/**
 * Get all available manifest files
 */
export async function getManifests(): Promise<ManifestData[]> {
  const manifestsPath = path.join(ASSETS_ROOT, "manifests");
  const manifests: ManifestData[] = [];

  try {
    for (const manifestFile of MANIFEST_FILES) {
      const filePath = path.join(manifestsPath, manifestFile);
      const exists = await fs.pathExists(filePath);

      if (exists) {
        const contents = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(contents);

        manifests.push({
          name: manifestFile,
          path: `manifests/${manifestFile}`,
          data: Array.isArray(data) ? data : [],
          itemCount: Array.isArray(data) ? data.length : 0,
        });
      }
    }

    return manifests;
  } catch (error) {
    console.error("Failed to get manifests:", error);
    return [];
  }
}

/**
 * Get specific manifest data
 */
export async function getManifestData(
  manifestFile: ManifestFile,
): Promise<unknown[]> {
  try {
    const filePath = path.join(ASSETS_ROOT, "manifests", manifestFile);
    const contents = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(contents);

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Failed to get manifest ${manifestFile}:`, error);
    throw new Error(`Failed to load manifest: ${manifestFile}`);
  }
}

/**
 * Update manifest file
 */
export async function updateManifest(
  manifestFile: ManifestFile,
  data: unknown[],
): Promise<void> {
  try {
    if (!Array.isArray(data)) {
      throw new Error("Manifest data must be an array");
    }

    const filePath = path.join(ASSETS_ROOT, "manifests", manifestFile);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Failed to update manifest ${manifestFile}:`, error);
    throw new Error("Failed to update manifest");
  }
}

/**
 * Validate manifest data structure
 * TODO: Add schema validation based on manifest type
 */
export async function validateManifest(
  manifestFile: ManifestFile,
  data: unknown[],
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    errors.push("Manifest data must be an array");
    return { valid: false, errors };
  }

  // Basic validation - check that all items have an id
  for (let i = 0; i < data.length; i++) {
    const item = data[i] as Record<string, unknown>;
    if (!item.id) {
      errors.push(`Item at index ${i} is missing required field: id`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =======================
// ASSET USAGE TRACKING
// =======================

/**
 * Find all references to an asset across manifests
 * Example: Find which items use "models/sword-bronze/sword-bronze.glb"
 */
export async function findAssetReferences(assetPath: string): Promise<
  {
    manifestFile: ManifestFile;
    itemId: string;
    itemName: string;
    field: string;
  }[]
> {
  const references: Array<{
    manifestFile: ManifestFile;
    itemId: string;
    itemName: string;
    field: string;
  }> = [];

  try {
    const manifests = await getManifests();

    for (const manifest of manifests) {
      for (const item of manifest.data) {
        const record = item as Record<string, unknown>;

        // Search all fields recursively for asset references
        const searchObject = (obj: unknown, path: string = ""): void => {
          if (typeof obj === "string") {
            // Check if the string contains the asset path
            if (obj.includes(assetPath)) {
              references.push({
                manifestFile: manifest.name,
                itemId: record.id as string,
                itemName: (record.name as string) || (record.id as string),
                field: path,
              });
            }
          } else if (obj && typeof obj === "object") {
            // Recursively search nested objects
            for (const [key, value] of Object.entries(obj)) {
              const newPath = path ? `${path}.${key}` : key;
              searchObject(value, newPath);
            }
          }
        };

        searchObject(record);
      }
    }

    return references;
  } catch (error) {
    console.error(`Failed to find references for ${assetPath}:`, error);
    return [];
  }
}

/**
 * Get comprehensive asset information including metadata and usage
 */
export async function getAssetInfo(relativePath: string): Promise<{
  file: {
    path: string;
    type: string;
    size: number;
    extension: string;
  };
  metadata: Record<string, unknown> | null;
  references: Array<{
    manifestFile: ManifestFile;
    itemId: string;
    itemName: string;
    field: string;
  }>;
}> {
  try {
    const file = await getAssetFile(relativePath);
    const ext = path.extname(relativePath).toLowerCase();

    // Get metadata from manifests that might reference this asset
    let metadata: Record<string, unknown> | null = null;

    // For audio files, check music.json
    if (file.type === "audio") {
      const musicData = await getManifestData("music.json");
      const assetPath = relativePath.replace(/^audio\/music\//, "");
      const musicEntry = musicData.find((entry: unknown) => {
        const record = entry as Record<string, unknown>;
        const entryPath = record.path as string;
        return entryPath && entryPath.includes(assetPath);
      });
      if (musicEntry) {
        metadata = musicEntry as Record<string, unknown>;
      }
    }

    // Get all references to this asset
    const references = await findAssetReferences(relativePath);

    return {
      file: {
        path: relativePath,
        type: file.type,
        size: file.size,
        extension: ext,
      },
      metadata,
      references,
    };
  } catch (error) {
    console.error(`Failed to get asset info for ${relativePath}:`, error);
    throw new Error("Failed to load asset information");
  }
}

// =======================
// CDN OPERATIONS
// =======================

/**
 * Get CDN configuration
 */
export async function getCDNConfig(): Promise<{
  url: string;
  isLocal: boolean;
}> {
  const cdnUrl = process.env.PUBLIC_CDN_URL || "http://localhost:8080";

  return {
    url: cdnUrl,
    isLocal: cdnUrl.includes("localhost") || cdnUrl.includes("127.0.0.1"),
  };
}

/**
 * Get CDN URL for an asset file
 * Example: models/sword-base/concept-art.png → http://localhost:8080/models/sword-base/concept-art.png
 */
export async function getCDNUrl(relativePath: string): Promise<string> {
  const config = await getCDNConfig();
  const normalizedPath = relativePath.startsWith("/")
    ? relativePath.slice(1)
    : relativePath;
  return `${config.url}/${normalizedPath}`;
}

/**
 * Get asset stats
 */
export async function getAssetStats(): Promise<{
  totalFiles: number;
  totalSize: number;
  byCategory: Record<AssetCategory, { files: number; size: number }>;
  manifestCount: number;
}> {
  const stats = {
    totalFiles: 0,
    totalSize: 0,
    byCategory: {} as Record<AssetCategory, { files: number; size: number }>,
    manifestCount: 0,
  };

  try {
    for (const category of ASSET_CATEGORIES) {
      const assets = await getAssetsByCategory(category);
      let categorySize = 0;

      for (const asset of assets) {
        if (asset.type === "file" && asset.size) {
          categorySize += asset.size;
          stats.totalFiles++;
          stats.totalSize += asset.size;
        }
      }

      stats.byCategory[category] = {
        files: assets.filter((a) => a.type === "file").length,
        size: categorySize,
      };

      if (category === "manifests") {
        stats.manifestCount = assets.filter(
          (a) => a.extension === ".json",
        ).length;
      }
    }

    return stats;
  } catch (error) {
    console.error("Failed to get asset stats:", error);
    return stats;
  }
}
