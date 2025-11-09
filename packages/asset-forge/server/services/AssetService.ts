/**
 * Asset Service
 * Handles asset listing and retrieval
 */

import fs from "fs/promises";
import path from "path";
import type { UserContextType, AssetMetadataType } from "../models";
import { assetDatabaseService } from "./AssetDatabaseService";

interface AssetUpdate {
  name?: string;
  type?: string;
  tier?: number;
  category?: string;
  metadata?: Record<string, unknown>;
}

interface Asset {
  id: string;
  name: string;
  description: string;
  type: string;
  metadata: AssetMetadataType;
  hasModel: boolean;
  modelFile?: string;
  generatedAt?: string;
}

interface Dependencies {
  [key: string]: {
    variants?: string[];
  };
}

export class AssetService {
  private assetsDir: string;

  constructor(assetsDir: string) {
    this.assetsDir = assetsDir;
  }

  async listAssets(): Promise<Asset[]> {
    try {
      const assetDirs = await fs.readdir(this.assetsDir);
      const assets: Asset[] = [];

      for (const assetDir of assetDirs) {
        if (assetDir.startsWith(".") || assetDir.endsWith(".json")) {
          continue;
        }

        const assetPath = path.join(this.assetsDir, assetDir);

        try {
          const stats = await fs.stat(assetPath);
          if (!stats.isDirectory()) continue;

          const metadataPath = path.join(assetPath, "metadata.json");
          const metadata = JSON.parse(
            await fs.readFile(metadataPath, "utf-8"),
          ) as AssetMetadataType;

          // Normalize tier property for frontend compatibility
          // For variants: extract tier from materialPreset.id or materialPreset.tier
          // For base models: tier is optional
          if (
            !metadata.tier &&
            metadata.isVariant &&
            (metadata as Record<string, unknown>).materialPreset
          ) {
            const preset = (metadata as Record<string, unknown>)
              .materialPreset as Record<string, unknown>;
            // Use the material ID as the tier name (e.g., "steel", "bronze", "dragon")
            metadata.tier = (preset.id as string) || (preset.tier as string);
          }

          const files = await fs.readdir(assetPath);
          const glbFile = files.find((f) => f.endsWith(".glb"));

          assets.push({
            id: assetDir,
            name: metadata.name || assetDir,
            description: metadata.description || "",
            type: metadata.type || "unknown",
            metadata: metadata,
            hasModel: !!glbFile,
            modelFile: glbFile,
            generatedAt: metadata.generatedAt,
          });
        } catch (error) {
          // Skip assets that can't be loaded
          const err = error as Error;
          console.warn(`Failed to load asset ${assetDir}:`, err.message);
        }
      }

      // Sort by generation date, newest first
      return assets.sort(
        (a, b) =>
          new Date(b.generatedAt || 0).getTime() -
          new Date(a.generatedAt || 0).getTime(),
      );
    } catch (error) {
      console.error("Failed to list assets:", error);
      return [];
    }
  }

  async getModelPath(assetId: string): Promise<string> {
    const assetPath = path.join(this.assetsDir, assetId);

    // Check if asset directory exists
    try {
      await fs.access(assetPath);
    } catch (error) {
      throw new Error(`Asset ${assetId} not found`);
    }

    // Read metadata to check if it's a character with a rigged model
    try {
      const metadata = await this.getAssetMetadata(assetId);

      // For characters, prefer the rigged model if available
      if (metadata.type === "character" && metadata.riggedModelPath) {
        const riggedPath = path.join(
          assetPath,
          path.basename(metadata.riggedModelPath),
        );
        try {
          await fs.access(riggedPath);
          console.log(
            `Returning rigged model for character ${assetId}: ${metadata.riggedModelPath}`,
          );
          return riggedPath;
        } catch {
          console.warn(
            `Rigged model not found for character ${assetId}, falling back to regular model`,
          );
        }
      }
    } catch (error) {
      console.log(
        `Could not read metadata for ${assetId}, using default model selection`,
      );
    }

    // Default behavior: find the first .glb file
    const files = await fs.readdir(assetPath);
    const glbFile = files.find((f) => f.endsWith(".glb"));

    if (!glbFile) {
      throw new Error("Model file not found");
    }

    return path.join(assetPath, glbFile);
  }

  async getAssetMetadata(assetId: string): Promise<AssetMetadataType> {
    const metadataPath = path.join(this.assetsDir, assetId, "metadata.json");
    return JSON.parse(
      await fs.readFile(metadataPath, "utf-8"),
    ) as AssetMetadataType;
  }

  async loadAsset(assetId: string): Promise<Asset | null> {
    try {
      const assetPath = path.join(this.assetsDir, assetId);
      const stats = await fs.stat(assetPath);

      if (!stats.isDirectory()) {
        return null;
      }

      const metadataPath = path.join(assetPath, "metadata.json");
      const metadata = JSON.parse(
        await fs.readFile(metadataPath, "utf-8"),
      ) as AssetMetadataType;

      const files = await fs.readdir(assetPath);
      const glbFile = files.find((f) => f.endsWith(".glb"));

      return {
        id: assetId,
        name: metadata.name || assetId,
        description: metadata.description || "",
        type: metadata.type || "unknown",
        metadata: metadata,
        hasModel: !!glbFile,
        modelFile: glbFile,
        generatedAt: metadata.generatedAt,
      };
    } catch (error) {
      console.error(`Failed to load asset ${assetId}:`, error);
      return null;
    }
  }

  async deleteAsset(
    assetId: string,
    includeVariants = false,
    userId?: string,
  ): Promise<boolean> {
    const assetPath = path.join(this.assetsDir, assetId);

    // Check if asset exists
    try {
      await fs.access(assetPath);
    } catch {
      throw new Error(`Asset ${assetId} not found`);
    }

    // Get metadata to check if it's a base asset
    const metadata = await this.getAssetMetadata(assetId);

    // If it's a base asset and includeVariants is true, delete all variants
    if (metadata.isBaseModel && includeVariants) {
      const allAssets = await this.listAssets();
      const variants = allAssets.filter(
        (asset) => asset.metadata.parentBaseModel === assetId,
      );

      // Delete all variants
      for (const variant of variants) {
        await this.deleteAssetDirectory(variant.id);
      }
    }

    // Delete the main asset
    await this.deleteAssetDirectory(assetId);

    // Update dependencies file if it exists
    await this.updateDependenciesAfterDelete(assetId);

    return true;
  }

  async deleteAssetDirectory(assetId: string): Promise<void> {
    const assetPath = path.join(this.assetsDir, assetId);

    try {
      // Recursively delete the directory
      await fs.rm(assetPath, { recursive: true, force: true });
      console.log(`Deleted asset directory: ${assetId}`);

      // Delete from database
      try {
        await assetDatabaseService.deleteAssetRecord(assetId);
      } catch (error) {
        console.error(
          "[AssetService] Failed to delete asset from database:",
          error,
        );
        // Continue - file deletion succeeded
      }
    } catch (error) {
      console.error(`Failed to delete asset ${assetId}:`, error);
      throw new Error(`Failed to delete asset ${assetId}`);
    }
  }

  async updateDependenciesAfterDelete(deletedAssetId: string): Promise<void> {
    const dependenciesPath = path.join(this.assetsDir, ".dependencies.json");

    try {
      const dependencies = JSON.parse(
        await fs.readFile(dependenciesPath, "utf-8"),
      ) as Dependencies;

      // Remove the deleted asset from dependencies
      delete dependencies[deletedAssetId];

      // Remove the deleted asset from other assets' variants lists
      for (const [baseId, deps] of Object.entries(dependencies)) {
        if (deps.variants && deps.variants.includes(deletedAssetId)) {
          deps.variants = deps.variants.filter((id) => id !== deletedAssetId);
        }
      }

      await fs.writeFile(
        dependenciesPath,
        JSON.stringify(dependencies, null, 2),
      );
    } catch (error) {
      // Dependencies file might not exist, which is okay
      console.log("No dependencies file to update");
    }
  }

  async updateAsset(
    assetId: string,
    updates: AssetUpdate,
    userId?: string,
  ): Promise<Asset | null> {
    try {
      const assetPath = path.join(this.assetsDir, assetId);
      const metadataPath = path.join(assetPath, "metadata.json");

      // Check if asset exists
      try {
        await fs.access(assetPath);
      } catch {
        return null;
      }

      // Read current metadata
      const currentMetadata = JSON.parse(
        await fs.readFile(metadataPath, "utf-8"),
      ) as AssetMetadataType;

      // Update metadata with new values
      const updatedMetadata: AssetMetadataType = {
        ...currentMetadata,
        ...updates.metadata,
        lastModified: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Default isPublic to true if not set
      if (updatedMetadata.isPublic === undefined) {
        updatedMetadata.isPublic = true;
      }

      // Handle type change if provided
      if (updates.type && updates.type !== currentMetadata.type) {
        updatedMetadata.type = updates.type;
      }

      // Handle name change if provided
      if (updates.name && updates.name !== assetId) {
        // Update name in metadata
        updatedMetadata.name = updates.name;
        updatedMetadata.gameId = updates.name;

        // Create new directory with new name
        const newAssetPath = path.join(this.assetsDir, updates.name);

        // Check if new name already exists
        try {
          await fs.access(newAssetPath);
          throw new Error(`Asset with name ${updates.name} already exists`);
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          // If the error is NOT "file not found", re-throw it
          if (err.code !== "ENOENT") {
            throw error;
          }
          // Otherwise, the path doesn't exist, which is what we want
        }

        // Rename directory
        await fs.rename(assetPath, newAssetPath);

        // Update metadata in new location
        await fs.writeFile(
          path.join(newAssetPath, "metadata.json"),
          JSON.stringify(updatedMetadata, null, 2),
        );

        // Update dependencies if needed
        await this.updateDependenciesAfterRename(assetId, updates.name);

        return this.loadAsset(updates.name);
      } else {
        // Just update metadata
        await fs.writeFile(
          metadataPath,
          JSON.stringify(updatedMetadata, null, 2),
        );

        // Update database record
        try {
          await assetDatabaseService.updateAssetRecord(assetId, {
            name: updatedMetadata.name,
            description: updatedMetadata.description,
            type: updatedMetadata.type,
            metadata: updatedMetadata as Record<string, unknown>,
          });
        } catch (error) {
          console.error(
            "[AssetService] Failed to update asset in database:",
            error,
          );
          // Continue - file update succeeded
        }

        return this.loadAsset(assetId);
      }
    } catch (error) {
      console.error(`Error updating asset ${assetId}:`, error);
      throw error;
    }
  }

  async updateDependenciesAfterRename(
    oldId: string,
    newId: string,
  ): Promise<void> {
    const dependenciesPath = path.join(this.assetsDir, "dependencies.json");

    try {
      const dependencies = JSON.parse(
        await fs.readFile(dependenciesPath, "utf-8"),
      ) as Dependencies;

      // Update the key if it exists
      if (dependencies[oldId]) {
        dependencies[newId] = dependencies[oldId];
        delete dependencies[oldId];
      }

      // Update references in other assets
      for (const [baseId, deps] of Object.entries(dependencies)) {
        if (deps.variants && deps.variants.includes(oldId)) {
          deps.variants = deps.variants.map((id) =>
            id === oldId ? newId : id,
          );
        }
      }

      await fs.writeFile(
        dependenciesPath,
        JSON.stringify(dependencies, null, 2),
      );
    } catch (error) {
      console.log("No dependencies file to update");
    }
  }
}
