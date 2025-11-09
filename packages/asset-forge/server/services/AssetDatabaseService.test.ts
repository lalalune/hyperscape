/**
 * AssetDatabaseService Tests
 * Comprehensive tests for asset database operations with Drizzle ORM
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { AssetDatabaseService } from "./AssetDatabaseService";
import { db } from "../db/db";
import { users, assets } from "../db/schema";
import { eq } from "drizzle-orm";
import type { AssetMetadataType } from "../models";

describe("AssetDatabaseService", () => {
  let service: AssetDatabaseService;
  let testUserId: string;
  let testAssetIds: string[] = [];

  beforeEach(async () => {
    service = new AssetDatabaseService();

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        privyUserId: `privy-test-${Date.now()}-${Math.random()}`,
        role: "member",
        settings: {},
      })
      .returning();

    testUserId = user.id;
  });

  afterEach(async () => {
    // Cleanup: Delete test assets and user
    for (const assetId of testAssetIds) {
      await db
        .delete(assets)
        .where(eq(assets.filePath, `${assetId}/${assetId}.glb`));
    }
    await db.delete(assets).where(eq(assets.ownerId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    testAssetIds = [];
  });

  describe("createAssetRecord", () => {
    it("should create asset record with basic metadata", async () => {
      const assetId = `asset-${Date.now()}`;
      const metadata: AssetMetadataType = {
        name: "Test Asset",
        description: "A test 3D asset",
        type: "character",
        subtype: "humanoid",
        workflow: "text-to-3d",
        isPublic: false,
      };

      const asset = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      expect(asset).not.toBe(null);
      expect(asset.name).toBe("Test Asset");
      expect(asset.description).toBe("A test 3D asset");
      expect(asset.type).toBe("character");
      expect(asset.category).toBe("humanoid");
      expect(asset.ownerId).toBe(testUserId);
      expect(asset.filePath).toBe(`${assetId}/${assetId}.glb`);
      expect(asset.status).toBe("completed");
      expect(asset.visibility).toBe("private");

      testAssetIds.push(assetId);
    });

    it("should create asset with public visibility", async () => {
      const assetId = `asset-public-${Date.now()}`;
      const metadata: AssetMetadataType = {
        name: "Public Asset",
        type: "item",
        workflow: "text-to-3d",
        isPublic: true,
      };

      const asset = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      expect(asset.visibility).toBe("public");

      testAssetIds.push(assetId);
    });

    it("should store generation parameters in metadata", async () => {
      const assetId = `asset-params-${Date.now()}`;
      const metadata: AssetMetadataType = {
        name: "Params Asset",
        type: "environment",
        workflow: "text-to-3d",
        meshyTaskId: "meshy-task-123",
        detailedPrompt: "A detailed description",
        isPublic: false,
      };

      const asset = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      expect(asset.prompt).toBe("A detailed description");
      expect(asset.modelUsed).toBe("meshy-5");
      expect(asset.generationParams).toHaveProperty("meshyTaskId");
      expect((asset.generationParams as any).meshyTaskId).toBe(
        "meshy-task-123",
      );
      expect((asset.generationParams as any).workflow).toBe("text-to-3d");

      testAssetIds.push(assetId);
    });

    it("should use assetId as name if not provided", async () => {
      const assetId = `asset-noname-${Date.now()}`;
      const metadata: AssetMetadataType = {
        type: "item",
        workflow: "image-to-3d",
        isPublic: false,
      };

      const asset = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      expect(asset.name).toBe(assetId);

      testAssetIds.push(assetId);
    });

    it("should set default description to empty string", async () => {
      const assetId = `asset-nodesc-${Date.now()}`;
      const metadata: AssetMetadataType = {
        name: "No Desc",
        type: "equipment",
        workflow: "text-to-3d",
        isPublic: false,
      };

      const asset = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      expect(asset.description).toBe("");

      testAssetIds.push(assetId);
    });

    it("should set type to unknown if not provided", async () => {
      const assetId = `asset-notype-${Date.now()}`;
      const metadata: AssetMetadataType = {
        name: "No Type",
        workflow: "text-to-3d",
        isPublic: false,
      };

      const asset = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      expect(asset.type).toBe("unknown");

      testAssetIds.push(assetId);
    });

    it("should initialize empty tags array", async () => {
      const assetId = `asset-tags-${Date.now()}`;
      const metadata: AssetMetadataType = {
        name: "Tags Test",
        type: "character",
        workflow: "text-to-3d",
        isPublic: false,
      };

      const asset = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      expect(asset.tags).toEqual([]);

      testAssetIds.push(assetId);
    });

    it("should store complete metadata object", async () => {
      const assetId = `asset-fullmeta-${Date.now()}`;
      const metadata: AssetMetadataType = {
        name: "Full Metadata",
        description: "Complete metadata test",
        type: "character",
        subtype: "npc",
        workflow: "text-to-3d",
        meshyTaskId: "task-456",
        detailedPrompt: "A very detailed prompt",
        isPublic: true,
      };

      const asset = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      expect(asset.metadata).toHaveProperty("name");
      expect(asset.metadata).toHaveProperty("workflow");
      expect((asset.metadata as any).meshyTaskId).toBe("task-456");

      testAssetIds.push(assetId);
    });
  });

  describe("updateAssetRecord", () => {
    let testAssetId: string;

    beforeEach(async () => {
      testAssetId = `asset-update-${Date.now()}`;
      const metadata: AssetMetadataType = {
        name: "Original Name",
        description: "Original description",
        type: "item",
        workflow: "text-to-3d",
        isPublic: false,
      };

      await service.createAssetRecord(
        testAssetId,
        metadata,
        testUserId,
        `${testAssetId}/${testAssetId}.glb`,
      );

      testAssetIds.push(testAssetId);
    });

    it("should update asset name", async () => {
      const updated = await service.updateAssetRecord(testAssetId, {
        name: "Updated Name",
      });

      expect(updated).not.toBe(null);
      expect(updated!.name).toBe("Updated Name");
      expect(updated!.description).toBe("Original description");
    });

    it("should update asset description", async () => {
      const updated = await service.updateAssetRecord(testAssetId, {
        description: "New description",
      });

      expect(updated!.description).toBe("New description");
      expect(updated!.name).toBe("Original Name");
    });

    it("should update visibility", async () => {
      const updated = await service.updateAssetRecord(testAssetId, {
        visibility: "public",
      });

      expect(updated!.visibility).toBe("public");
    });

    it("should update status", async () => {
      const updated = await service.updateAssetRecord(testAssetId, {
        status: "published",
      });

      expect(updated!.status).toBe("published");
    });

    it("should update tags", async () => {
      const tags = ["fantasy", "medieval", "weapon"];

      const updated = await service.updateAssetRecord(testAssetId, {
        tags,
      });

      expect(updated!.tags).toEqual(tags);
    });

    it("should update metadata", async () => {
      const metadata = {
        customField: "value",
        rating: 5,
      };

      const updated = await service.updateAssetRecord(testAssetId, {
        metadata,
      });

      expect(updated!.metadata).toEqual(metadata);
    });

    it("should update updatedAt timestamp", async () => {
      const before = await service.getAssetWithOwner(testAssetId);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await service.updateAssetRecord(testAssetId, {
        name: "Timestamp Test",
      });

      expect(updated!.updatedAt.getTime()).toBeGreaterThan(
        before!.updatedAt.getTime(),
      );
    });

    it("should update multiple fields at once", async () => {
      const updated = await service.updateAssetRecord(testAssetId, {
        name: "Multi Update",
        description: "Multiple fields updated",
        status: "approved",
        visibility: "public",
      });

      expect(updated!.name).toBe("Multi Update");
      expect(updated!.description).toBe("Multiple fields updated");
      expect(updated!.status).toBe("approved");
      expect(updated!.visibility).toBe("public");
    });

    it("should return null for non-existent asset", async () => {
      const fakeAssetId = "non-existent-asset";

      const updated = await service.updateAssetRecord(fakeAssetId, {
        name: "Should Fail",
      });

      expect(updated).toBe(null);
    });
  });

  describe("deleteAssetRecord", () => {
    let testAssetId: string;

    beforeEach(async () => {
      testAssetId = `asset-delete-${Date.now()}`;
      const metadata: AssetMetadataType = {
        name: "To Delete",
        type: "item",
        workflow: "text-to-3d",
        isPublic: false,
      };

      await service.createAssetRecord(
        testAssetId,
        metadata,
        testUserId,
        `${testAssetId}/${testAssetId}.glb`,
      );

      testAssetIds.push(testAssetId);
    });

    it("should delete asset from database", async () => {
      await service.deleteAssetRecord(testAssetId);

      const result = await service.getAssetWithOwner(testAssetId);
      expect(result).toBe(null);

      // Remove from cleanup list
      testAssetIds = testAssetIds.filter((id) => id !== testAssetId);
    });

    it("should not throw error for non-existent asset", async () => {
      const fakeAssetId = "non-existent-delete";

      // Should complete without error
      await service.deleteAssetRecord(fakeAssetId);
    });
  });

  describe("getAssetWithOwner", () => {
    let testAssetId: string;

    beforeEach(async () => {
      testAssetId = `asset-get-${Date.now()}`;
      const metadata: AssetMetadataType = {
        name: "Get Test",
        description: "Asset for get testing",
        type: "character",
        subtype: "player",
        workflow: "text-to-3d",
        isPublic: false,
      };

      await service.createAssetRecord(
        testAssetId,
        metadata,
        testUserId,
        `${testAssetId}/${testAssetId}.glb`,
      );

      testAssetIds.push(testAssetId);
    });

    it("should return asset by ID", async () => {
      const asset = await service.getAssetWithOwner(testAssetId);

      expect(asset).not.toBe(null);
      expect(asset.name).toBe("Get Test");
      expect(asset.description).toBe("Asset for get testing");
      expect(asset.type).toBe("character");
      expect(asset.category).toBe("player");
      expect(asset.ownerId).toBe(testUserId);
    });

    it("should return null for non-existent asset", async () => {
      const fakeAssetId = "non-existent-get";

      const asset = await service.getAssetWithOwner(fakeAssetId);
      expect(asset).toBe(null);
    });

    it("should return asset with all fields populated", async () => {
      const asset = await service.getAssetWithOwner(testAssetId);

      expect(asset).not.toBe(null);
      expect(asset.id).toBeDefined();
      expect(asset.name).toBeDefined();
      expect(asset.type).toBeDefined();
      expect(asset.ownerId).toBeDefined();
      expect(asset.filePath).toBeDefined();
      expect(asset.status).toBeDefined();
      expect(asset.visibility).toBeDefined();
      expect(asset.createdAt).toBeDefined();
      expect(asset.updatedAt).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle asset with minimal metadata", async () => {
      const assetId = `asset-minimal-${Date.now()}`;
      const metadata: AssetMetadataType = {
        workflow: "text-to-3d",
        isPublic: false,
      };

      const asset = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      expect(asset).not.toBe(null);
      expect(asset.name).toBe(assetId);
      expect(asset.description).toBe("");
      expect(asset.type).toBe("unknown");

      testAssetIds.push(assetId);
    });

    it("should handle asset with very long description", async () => {
      const assetId = `asset-longdesc-${Date.now()}`;
      const longDescription = "A".repeat(5000);
      const metadata: AssetMetadataType = {
        name: "Long Description",
        description: longDescription,
        type: "environment",
        workflow: "text-to-3d",
        isPublic: false,
      };

      const asset = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      expect(asset.description).toBe(longDescription);

      testAssetIds.push(assetId);
    });

    it("should handle complex generation params", async () => {
      const assetId = `asset-complex-${Date.now()}`;
      const metadata: any = {
        name: "Complex Params",
        type: "item",
        workflow: "text-to-3d",
        quality: "high",
        meshyTaskId: "task-789",
        customParam: "value",
        isPublic: false,
      };

      const asset = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      expect((asset.generationParams as any).quality).toBe("high");
      expect((asset.generationParams as any).meshyTaskId).toBe("task-789");

      testAssetIds.push(assetId);
    });

    it("should handle concurrent creates for same user", async () => {
      const assetIds = [
        `asset-concurrent-1-${Date.now()}`,
        `asset-concurrent-2-${Date.now()}`,
        `asset-concurrent-3-${Date.now()}`,
      ];

      const metadata: AssetMetadataType = {
        name: "Concurrent",
        type: "item",
        workflow: "text-to-3d",
        isPublic: false,
      };

      const promises = assetIds.map((id) =>
        service.createAssetRecord(id, metadata, testUserId, `${id}/${id}.glb`),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((asset, i) => {
        expect(asset.ownerId).toBe(testUserId);
        testAssetIds.push(assetIds[i]);
      });
    });

    it("should handle update immediately after create", async () => {
      const assetId = `asset-immediate-${Date.now()}`;
      const metadata: AssetMetadataType = {
        name: "Immediate",
        type: "item",
        workflow: "text-to-3d",
        isPublic: false,
      };

      const created = await service.createAssetRecord(
        assetId,
        metadata,
        testUserId,
        `${assetId}/${assetId}.glb`,
      );

      const updated = await service.updateAssetRecord(assetId, {
        name: "Immediate Updated",
      });

      expect(updated!.name).toBe("Immediate Updated");
      expect(updated!.id).toBe(created.id);

      testAssetIds.push(assetId);
    });
  });
});
