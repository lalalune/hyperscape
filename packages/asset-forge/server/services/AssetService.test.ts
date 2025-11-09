/**
 * AssetService Tests
 * Tests for file-based asset management (CRUD operations, metadata, variants)
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { AssetService } from "./AssetService";
import fs from "fs/promises";
import path from "path";

describe("AssetService", () => {
  let service: AssetService;
  let testDir: string;

  beforeEach(async () => {
    // Create test directory
    testDir = `/tmp/asset-service-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });

    service = new AssetService(testDir);
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("listAssets", () => {
    it("should return empty array when no assets exist", async () => {
      const assets = await service.listAssets();
      expect(assets).toEqual([]);
    });

    it("should list single asset", async () => {
      // Create test asset
      const assetId = "test-sword";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      const metadata = {
        name: "Test Sword",
        description: "A test weapon",
        type: "weapon",
        generatedAt: new Date().toISOString(),
      };

      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify(metadata),
      );
      await fs.writeFile(path.join(assetDir, "test-sword.glb"), "fake-glb");

      const assets = await service.listAssets();

      expect(assets).toHaveLength(1);
      expect(assets[0].id).toBe(assetId);
      expect(assets[0].name).toBe("Test Sword");
      expect(assets[0].hasModel).toBe(true);
      expect(assets[0].modelFile).toBe("test-sword.glb");
    });

    it("should list multiple assets sorted by generation date", async () => {
      // Create three assets with different timestamps
      const asset1 = {
        id: "old-sword",
        name: "Old Sword",
        type: "weapon",
        generatedAt: new Date("2024-01-01").toISOString(),
      };

      const asset2 = {
        id: "new-sword",
        name: "New Sword",
        type: "weapon",
        generatedAt: new Date("2024-12-01").toISOString(),
      };

      const asset3 = {
        id: "mid-sword",
        name: "Mid Sword",
        type: "weapon",
        generatedAt: new Date("2024-06-01").toISOString(),
      };

      for (const asset of [asset1, asset2, asset3]) {
        const assetDir = path.join(testDir, asset.id);
        await fs.mkdir(assetDir, { recursive: true });
        await fs.writeFile(
          path.join(assetDir, "metadata.json"),
          JSON.stringify(asset),
        );
        await fs.writeFile(path.join(assetDir, `${asset.id}.glb`), "glb");
      }

      const assets = await service.listAssets();

      expect(assets).toHaveLength(3);
      // Should be sorted newest first
      expect(assets[0].id).toBe("new-sword");
      expect(assets[1].id).toBe("mid-sword");
      expect(assets[2].id).toBe("old-sword");
    });

    it("should skip hidden files and directories", async () => {
      // Create hidden directory
      await fs.mkdir(path.join(testDir, ".git"), { recursive: true });

      // Create JSON file (not asset directory)
      await fs.writeFile(path.join(testDir, "config.json"), "{}");

      const assets = await service.listAssets();

      expect(assets).toHaveLength(0);
    });

    it("should skip assets with invalid metadata", async () => {
      // Create asset with valid metadata
      const validAssetDir = path.join(testDir, "valid-asset");
      await fs.mkdir(validAssetDir, { recursive: true });
      await fs.writeFile(
        path.join(validAssetDir, "metadata.json"),
        JSON.stringify({ name: "Valid", type: "weapon" }),
      );

      // Create asset with invalid JSON
      const invalidAssetDir = path.join(testDir, "invalid-asset");
      await fs.mkdir(invalidAssetDir, { recursive: true });
      await fs.writeFile(
        path.join(invalidAssetDir, "metadata.json"),
        "invalid-json{",
      );

      const assets = await service.listAssets();

      // Should only return valid asset
      expect(assets).toHaveLength(1);
      expect(assets[0].id).toBe("valid-asset");
    });

    it("should handle asset without GLB file", async () => {
      const assetId = "no-model-asset";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify({ name: "No Model", type: "concept" }),
      );

      const assets = await service.listAssets();

      expect(assets).toHaveLength(1);
      expect(assets[0].hasModel).toBe(false);
      expect(assets[0].modelFile).toBe(undefined);
    });
  });

  describe("getModelPath", () => {
    it("should return path to GLB file", async () => {
      const assetId = "test-asset";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify({ type: "weapon" }),
      );
      await fs.writeFile(path.join(assetDir, "model.glb"), "glb-data");

      const modelPath = await service.getModelPath(assetId);

      expect(modelPath).toBe(path.join(assetDir, "model.glb"));
    });

    it("should prefer rigged model for characters", async () => {
      const assetId = "character-asset";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      // Create metadata with rigged model path
      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify({
          type: "character",
          riggedModelPath: "character-asset_rigged.glb",
        }),
      );

      // Create both rigged and regular model
      await fs.writeFile(path.join(assetDir, "character-asset.glb"), "base");
      await fs.writeFile(
        path.join(assetDir, "character-asset_rigged.glb"),
        "rigged",
      );

      const modelPath = await service.getModelPath(assetId);

      expect(modelPath).toBe(path.join(assetDir, "character-asset_rigged.glb"));
    });

    it("should fall back to regular model if rigged not found", async () => {
      const assetId = "character-asset";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify({
          type: "character",
          riggedModelPath: "missing_rigged.glb",
        }),
      );

      await fs.writeFile(path.join(assetDir, "character-asset.glb"), "base");

      const modelPath = await service.getModelPath(assetId);

      expect(modelPath).toBe(path.join(assetDir, "character-asset.glb"));
    });

    it("should throw error for non-existent asset", async () => {
      expect(async () => {
        await service.getModelPath("non-existent");
      }).toThrow("Asset non-existent not found");
    });

    it("should throw error when no GLB file found", async () => {
      const assetId = "no-glb-asset";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      expect(async () => {
        await service.getModelPath(assetId);
      }).toThrow("Model file not found");
    });
  });

  describe("getAssetMetadata", () => {
    it("should read and parse metadata JSON", async () => {
      const assetId = "test-asset";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      const metadata = {
        name: "Test Asset",
        type: "weapon",
        subtype: "sword",
        description: "A test sword",
        meshyTaskId: "task-123",
      };

      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify(metadata),
      );

      const result = await service.getAssetMetadata(assetId);

      expect(result.name).toBe("Test Asset");
      expect(result.type).toBe("weapon");
      expect(result.meshyTaskId).toBe("task-123");
    });

    it("should throw error for missing metadata file", async () => {
      expect(async () => {
        await service.getAssetMetadata("non-existent");
      }).toThrow();
    });
  });

  describe("loadAsset", () => {
    it("should load complete asset with all data", async () => {
      const assetId = "complete-asset";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      const metadata = {
        name: "Complete Asset",
        description: "Fully loaded asset",
        type: "weapon",
        generatedAt: new Date().toISOString(),
      };

      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify(metadata),
      );
      await fs.writeFile(path.join(assetDir, "model.glb"), "glb");

      const asset = await service.loadAsset(assetId);

      expect(asset).not.toBe(null);
      expect(asset!.id).toBe(assetId);
      expect(asset!.name).toBe("Complete Asset");
      expect(asset!.description).toBe("Fully loaded asset");
      expect(asset!.hasModel).toBe(true);
    });

    it("should return null for non-existent asset", async () => {
      const asset = await service.loadAsset("non-existent");
      expect(asset).toBe(null);
    });

    it("should return null for file (not directory)", async () => {
      await fs.writeFile(path.join(testDir, "file.txt"), "not a directory");

      const asset = await service.loadAsset("file.txt");
      expect(asset).toBe(null);
    });
  });

  describe("deleteAsset", () => {
    it("should delete asset directory", async () => {
      const assetId = "delete-me";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify({ name: "Delete Me", type: "weapon" }),
      );

      const result = await service.deleteAsset(assetId);

      expect(result).toBe(true);

      // Verify directory is deleted
      const exists = await fs
        .access(assetDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it("should throw error for non-existent asset", async () => {
      expect(async () => {
        await service.deleteAsset("non-existent");
      }).toThrow("Asset non-existent not found");
    });

    it("should delete all variants when includeVariants is true", async () => {
      const baseId = "base-asset";
      const variant1Id = "base-asset-bronze";
      const variant2Id = "base-asset-silver";

      // Create base asset
      const baseDir = path.join(testDir, baseId);
      await fs.mkdir(baseDir, { recursive: true });
      await fs.writeFile(
        path.join(baseDir, "metadata.json"),
        JSON.stringify({
          name: "Base",
          type: "weapon",
          isBaseModel: true,
        }),
      );

      // Create variants
      for (const variantId of [variant1Id, variant2Id]) {
        const variantDir = path.join(testDir, variantId);
        await fs.mkdir(variantDir, { recursive: true });
        await fs.writeFile(
          path.join(variantDir, "metadata.json"),
          JSON.stringify({
            name: variantId,
            type: "weapon",
            isVariant: true,
            parentBaseModel: baseId,
          }),
        );
      }

      await service.deleteAsset(baseId, true);

      // Verify all are deleted
      const baseExists = await fs
        .access(baseDir)
        .then(() => true)
        .catch(() => false);
      const variant1Exists = await fs
        .access(path.join(testDir, variant1Id))
        .then(() => true)
        .catch(() => false);
      const variant2Exists = await fs
        .access(path.join(testDir, variant2Id))
        .then(() => true)
        .catch(() => false);

      expect(baseExists).toBe(false);
      expect(variant1Exists).toBe(false);
      expect(variant2Exists).toBe(false);
    });

    it("should not delete variants when includeVariants is false", async () => {
      const baseId = "base-asset";
      const variantId = "base-asset-bronze";

      // Create base and variant
      for (const id of [baseId, variantId]) {
        const dir = path.join(testDir, id);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(
          path.join(dir, "metadata.json"),
          JSON.stringify({
            name: id,
            type: "weapon",
            isBaseModel: id === baseId,
            isVariant: id === variantId,
            parentBaseModel: id === variantId ? baseId : undefined,
          }),
        );
      }

      await service.deleteAsset(baseId, false);

      // Base should be deleted, variant should remain
      const baseExists = await fs
        .access(path.join(testDir, baseId))
        .then(() => true)
        .catch(() => false);
      const variantExists = await fs
        .access(path.join(testDir, variantId))
        .then(() => true)
        .catch(() => false);

      expect(baseExists).toBe(false);
      expect(variantExists).toBe(true);
    });
  });

  describe("updateAsset", () => {
    let assetId: string;

    beforeEach(async () => {
      assetId = "update-asset";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify({
          name: "Original Name",
          type: "weapon",
          description: "Original description",
        }),
      );
    });

    it("should update asset metadata", async () => {
      const updated = await service.updateAsset(assetId, {
        metadata: { customField: "custom value" },
      });

      expect(updated).not.toBe(null);
      expect(updated!.metadata.customField).toBe("custom value");
      expect(updated!.metadata.lastModified).toBeDefined();
    });

    it("should update asset type", async () => {
      const updated = await service.updateAsset(assetId, {
        type: "armor",
      });

      expect(updated!.type).toBe("armor");
    });

    it("should rename asset directory when name changes", async () => {
      const newName = "renamed-asset";

      const updated = await service.updateAsset(assetId, {
        name: newName,
      });

      expect(updated).not.toBe(null);
      expect(updated!.id).toBe(newName);

      // Old directory should not exist
      const oldExists = await fs
        .access(path.join(testDir, assetId))
        .then(() => true)
        .catch(() => false);
      expect(oldExists).toBe(false);

      // New directory should exist
      const newExists = await fs
        .access(path.join(testDir, newName))
        .then(() => true)
        .catch(() => false);
      expect(newExists).toBe(true);
    });

    it("should throw error when renaming to existing asset name", async () => {
      // Create another asset
      const existingAssetDir = path.join(testDir, "existing-asset");
      await fs.mkdir(existingAssetDir, { recursive: true });
      await fs.writeFile(
        path.join(existingAssetDir, "metadata.json"),
        JSON.stringify({ name: "Existing" }),
      );

      expect(async () => {
        await service.updateAsset(assetId, {
          name: "existing-asset",
        });
      }).toThrow("already exists");
    });

    it("should return null for non-existent asset", async () => {
      const updated = await service.updateAsset("non-existent", {
        name: "New Name",
      });

      expect(updated).toBe(null);
    });

    it("should set isPublic to true by default", async () => {
      const updated = await service.updateAsset(assetId, {
        metadata: { someField: "value" },
      });

      expect(updated!.metadata.isPublic).toBe(true);
    });
  });

  describe("updateDependenciesAfterDelete", () => {
    it("should remove deleted asset from dependencies file", async () => {
      const dependenciesPath = path.join(testDir, ".dependencies.json");

      const dependencies = {
        "base-asset": {
          variants: ["base-asset-bronze", "base-asset-silver"],
        },
        "base-asset-bronze": {},
      };

      await fs.writeFile(
        dependenciesPath,
        JSON.stringify(dependencies, null, 2),
      );

      await service.updateDependenciesAfterDelete("base-asset-bronze");

      const updated = JSON.parse(await fs.readFile(dependenciesPath, "utf-8"));

      expect(updated["base-asset-bronze"]).toBe(undefined);
      expect(updated["base-asset"].variants).not.toContain("base-asset-bronze");
      expect(updated["base-asset"].variants).toContain("base-asset-silver");
    });

    it("should handle missing dependencies file gracefully", async () => {
      // Should not throw
      await service.updateDependenciesAfterDelete("some-asset");
    });
  });

  describe("updateDependenciesAfterRename", () => {
    it("should update asset ID in dependencies file", async () => {
      const dependenciesPath = path.join(testDir, "dependencies.json");

      const dependencies = {
        "old-id": {
          variants: ["old-id-bronze"],
        },
        "other-asset": {
          variants: ["old-id"],
        },
      };

      await fs.writeFile(
        dependenciesPath,
        JSON.stringify(dependencies, null, 2),
      );

      await service.updateDependenciesAfterRename("old-id", "new-id");

      const updated = JSON.parse(await fs.readFile(dependenciesPath, "utf-8"));

      expect(updated["old-id"]).toBe(undefined);
      expect(updated["new-id"]).toBeDefined();
      expect(updated["other-asset"].variants).toContain("new-id");
      expect(updated["other-asset"].variants).not.toContain("old-id");
    });

    it("should handle missing dependencies file gracefully", async () => {
      // Should not throw
      await service.updateDependenciesAfterRename("old", "new");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long asset names", async () => {
      const longName = "a".repeat(200);
      const assetDir = path.join(testDir, longName);
      await fs.mkdir(assetDir, { recursive: true });

      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify({ name: longName, type: "test" }),
      );

      const assets = await service.listAssets();
      expect(assets).toHaveLength(1);
      expect(assets[0].id).toBe(longName);
    });

    it("should handle special characters in asset names", async () => {
      const specialName = "test-asset_v2.0";
      const assetDir = path.join(testDir, specialName);
      await fs.mkdir(assetDir, { recursive: true });

      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify({ name: specialName }),
      );

      const asset = await service.loadAsset(specialName);
      expect(asset).not.toBe(null);
      expect(asset!.id).toBe(specialName);
    });

    it("should handle concurrent listAssets calls", async () => {
      // Create asset
      const assetDir = path.join(testDir, "concurrent-test");
      await fs.mkdir(assetDir, { recursive: true });
      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify({ name: "Test", type: "weapon" }),
      );

      // Call listAssets multiple times concurrently
      const results = await Promise.all([
        service.listAssets(),
        service.listAssets(),
        service.listAssets(),
      ]);

      // All should return same result
      expect(results[0]).toHaveLength(1);
      expect(results[1]).toHaveLength(1);
      expect(results[2]).toHaveLength(1);
    });

    it("should handle empty metadata gracefully", async () => {
      const assetId = "empty-metadata";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      await fs.writeFile(path.join(assetDir, "metadata.json"), "{}");

      const asset = await service.loadAsset(assetId);

      expect(asset).not.toBe(null);
      expect(asset!.name).toBe(assetId); // Falls back to ID
      expect(asset!.type).toBe("unknown");
    });
  });
});
