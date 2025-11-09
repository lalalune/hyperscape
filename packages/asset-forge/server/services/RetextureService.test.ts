/**
 * RetextureService Tests
 * Tests for AI-powered retexturing using Meshy API
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { RetextureService } from "./RetextureService";
import fs from "fs/promises";
import path from "path";

describe("RetextureService", () => {
  let service: RetextureService;
  let originalMeshyKey: string | undefined;
  let testDir: string;
  let mockFetch: any;

  beforeEach(async () => {
    // Save original env var
    originalMeshyKey = process.env.MESHY_API_KEY;

    // Set test API key
    process.env.MESHY_API_KEY = "test-meshy-key";

    // Create mock fetch function
    mockFetch = mock(async (url: any, options?: any) => {
      // Start retexture task
      if (
        typeof url === "string" &&
        url.includes("/retexture") &&
        options?.method === "POST"
      ) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ task_id: "retexture-task-456" }),
          text: async () => JSON.stringify({ task_id: "retexture-task-456" }),
        } as any;
      }

      // Get task status - default to SUCCEEDED
      if (
        typeof url === "string" &&
        url.includes("/retexture/") &&
        !options?.method
      ) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            status: "SUCCEEDED",
            progress: 100,
            model_urls: {
              glb: "https://assets.meshy.ai/retextured.glb",
            },
          }),
          text: async () => JSON.stringify({ status: "SUCCEEDED" }),
        } as any;
      }

      // Download model files
      if (
        typeof url === "string" &&
        (url.includes(".glb") || url.includes("model"))
      ) {
        const buffer = Buffer.from("FAKE_GLB_DATA");
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => buffer,
        } as any;
      }

      // Default: return failed response
      return {
        ok: false,
        status: 404,
        statusText: "Not mocked",
        text: async () => "Not mocked",
        json: async () => ({ error: "Not mocked" }),
      } as any;
    });

    service = new RetextureService({
      meshyApiKey: "test-meshy-key",
      fetchFn: mockFetch,
    });

    // Create test directory
    testDir = `/tmp/retexture-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Restore original env var
    if (originalMeshyKey) {
      process.env.MESHY_API_KEY = originalMeshyKey;
    } else {
      delete process.env.MESHY_API_KEY;
    }

    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Constructor", () => {
    it("should initialize with API key from config", () => {
      const configService = new RetextureService({
        meshyApiKey: "config-key",
        fetchFn: mockFetch,
      });

      expect((configService as any).meshyApiKey).toBe("config-key");
      expect((configService as any).meshyClient).not.toBe(null);
    });

    it("should initialize with API key from environment", () => {
      process.env.MESHY_API_KEY = "env-key";

      const envService = new RetextureService({ fetchFn: mockFetch });

      expect((envService as any).meshyApiKey).toBe("env-key");
      expect((envService as any).meshyClient).not.toBe(null);
    });

    it("should warn when no API key available", () => {
      delete process.env.MESHY_API_KEY;

      const noKeyService = new RetextureService({ fetchFn: mockFetch });

      expect((noKeyService as any).meshyApiKey).toBe(undefined);
      expect((noKeyService as any).meshyClient).toBe(null);
    });
  });

  describe("retexture", () => {
    let materialPreset: any;
    let baseAssetId: string;

    beforeEach(async () => {
      materialPreset = {
        id: "bronze",
        displayName: "Bronze",
        category: "metal",
        tier: 1,
        color: "#CD7F32",
        stylePrompt: "bronze metal material with weathered patina",
      };

      baseAssetId = "test-sword-base";

      // Create base asset with metadata
      const baseAssetDir = path.join(testDir, baseAssetId);
      await fs.mkdir(baseAssetDir, { recursive: true });

      const metadata = {
        id: baseAssetId,
        name: "Test Sword",
        type: "weapon",
        subtype: "sword",
        meshyTaskId: "base-task-123",
        description: "A test sword",
        isBaseModel: true,
        hasConceptArt: false,
      };

      await fs.writeFile(
        path.join(baseAssetDir, "metadata.json"),
        JSON.stringify(metadata, null, 2),
      );
    });

    it("should throw error when no API key configured", async () => {
      // Temporarily delete env var
      delete process.env.MESHY_API_KEY;
      const noKeyService = new RetextureService({ fetchFn: mockFetch });
      // Restore it
      process.env.MESHY_API_KEY = "test-meshy-key";

      try {
        await noKeyService.retexture({
          baseAssetId,
          materialPreset,
          assetsDir: testDir,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("MESHY_API_KEY is required");
      }
    });

    it("should throw error when base asset has no meshyTaskId", async () => {
      // Create asset without meshyTaskId
      const noTaskAssetId = "no-task-asset";
      const noTaskDir = path.join(testDir, noTaskAssetId);
      await fs.mkdir(noTaskDir, { recursive: true });

      await fs.writeFile(
        path.join(noTaskDir, "metadata.json"),
        JSON.stringify({ id: noTaskAssetId, name: "No Task" }, null, 2),
      );

      try {
        await service.retexture({
          baseAssetId: noTaskAssetId,
          materialPreset,
          assetsDir: testDir,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("does not have a Meshy task ID");
      }
    });

    it("should successfully retexture asset", async () => {
      const result = await service.retexture({
        baseAssetId,
        materialPreset,
        assetsDir: testDir,
      });

      expect(result.success).toBe(true);
      expect(result.assetId).toContain("bronze");
      expect(result.url).toContain("bronze");

      // Verify variant directory was created
      const variantDir = path.join(testDir, `test-sword-${materialPreset.id}`);
      const variantExists = await fs
        .access(variantDir)
        .then(() => true)
        .catch(() => false);
      expect(variantExists).toBe(true);

      // Verify metadata was created
      const metadataPath = path.join(variantDir, "metadata.json");
      const metadataExists = await fs
        .access(metadataPath)
        .then(() => true)
        .catch(() => false);
      expect(metadataExists).toBe(true);

      // Verify model file was created
      const modelPath = path.join(
        variantDir,
        `test-sword-${materialPreset.id}.glb`,
      );
      const modelExists = await fs
        .access(modelPath)
        .then(() => true)
        .catch(() => false);
      expect(modelExists).toBe(true);
    });

    it("should use custom output name when provided", async () => {
      const result = await service.retexture({
        baseAssetId,
        materialPreset,
        outputName: "custom-sword-variant",
        assetsDir: testDir,
      });

      expect(result.assetId).toBe("custom-sword-variant");
    });

    it("should handle network errors during retexturing", async () => {
      // Create service with error-throwing mock
      const errorFetch = mock(async () => {
        throw new Error("Network timeout");
      });
      const errorService = new RetextureService({
        meshyApiKey: "test-key",
        fetchFn: errorFetch as any,
      });

      try {
        await errorService.retexture({
          baseAssetId,
          materialPreset,
          assetsDir: testDir,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Network error during retexturing");
      }
    });

    it("should handle task failure", async () => {
      // Create service with failure-returning mock
      const failFetch = mock(async (url: any, options?: any) => {
        if (
          typeof url === "string" &&
          url.includes("/retexture") &&
          options?.method === "POST"
        ) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ task_id: "fail-task" }),
            text: async () => JSON.stringify({ task_id: "fail-task" }),
          } as any;
        }

        if (typeof url === "string" && url.includes("/retexture/fail-task")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: "FAILED",
              task_error: { message: "Invalid material prompt" },
            }),
            text: async () => JSON.stringify({ status: "FAILED" }),
          } as any;
        }

        return { ok: false } as any;
      });
      const failService = new RetextureService({
        meshyApiKey: "test-key",
        fetchFn: failFetch as any,
      });

      try {
        await failService.retexture({
          baseAssetId,
          materialPreset,
          assetsDir: testDir,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Retexture failed");
      }
    });

    it("should handle timeout during retexturing", async () => {
      // Create service with timeout-triggering mock
      const timeoutFetch = mock(async (url: any, options?: any) => {
        if (
          typeof url === "string" &&
          url.includes("/retexture") &&
          options?.method === "POST"
        ) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ task_id: "timeout-task" }),
            text: async () => JSON.stringify({ task_id: "timeout-task" }),
          } as any;
        }

        if (
          typeof url === "string" &&
          url.includes("/retexture/timeout-task")
        ) {
          // Always return PENDING to trigger timeout
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: "PENDING",
              progress: 50,
            }),
            text: async () => JSON.stringify({ status: "PENDING" }),
          } as any;
        }

        return { ok: false } as any;
      });

      const timeoutService = new RetextureService({
        meshyApiKey: "test-key",
        fetchFn: timeoutFetch as any,
      });

      // Override maxCheckTime and checkInterval for faster test
      (timeoutService as any).meshyClient.maxCheckTime = 100;
      (timeoutService as any).meshyClient.checkInterval = 10; // Check every 10ms

      try {
        await timeoutService.retexture({
          baseAssetId,
          materialPreset,
          assetsDir: testDir,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("timeout");
      }
    });
  });

  describe("saveRetexturedAsset", () => {
    it("should save retextured asset with all metadata", async () => {
      const baseAssetId = "base-asset";
      const variantName = "base-asset-bronze";

      // Create base asset
      const baseDir = path.join(testDir, baseAssetId);
      await fs.mkdir(baseDir, { recursive: true });

      const baseMetadata = {
        id: baseAssetId,
        name: "Base Asset",
        type: "weapon",
        subtype: "sword",
        meshyTaskId: "base-task",
        description: "Base sword",
        isBaseModel: true,
        conceptArtPath: "concept-art.png",
        hasConceptArt: true,
        isPublic: true,
      };

      await fs.writeFile(
        path.join(baseDir, "metadata.json"),
        JSON.stringify(baseMetadata),
      );

      // Create concept art
      await fs.writeFile(path.join(baseDir, "concept-art.png"), "fake-png");

      const materialPreset = {
        id: "bronze",
        displayName: "Bronze",
        category: "metal",
        tier: 1,
        color: "#CD7F32",
        stylePrompt: "bronze material",
      };

      const result = {
        status: "SUCCEEDED",
        model_urls: { glb: "https://example.com/model.glb" },
      };

      const savedMetadata = await service.saveRetexturedAsset({
        result,
        variantName,
        baseAssetId,
        baseMetadata: baseMetadata as any,
        materialPreset,
        taskId: "retexture-task",
        assetsDir: testDir,
      });

      expect(savedMetadata.id).toBe(variantName);
      expect(savedMetadata.isVariant).toBe(true);
      expect(savedMetadata.parentBaseModel).toBe(baseAssetId);
      expect(savedMetadata.materialPreset!.id).toBe("bronze");
      expect(savedMetadata.retextureTaskId).toBe("retexture-task");
      expect(savedMetadata.workflow).toBe("Meshy AI Retexture");

      // Verify files were created
      const variantDir = path.join(testDir, variantName);
      const modelExists = await fs
        .access(path.join(variantDir, `${variantName}.glb`))
        .then(() => true)
        .catch(() => false);
      expect(modelExists).toBe(true);

      const metadataExists = await fs
        .access(path.join(variantDir, "metadata.json"))
        .then(() => true)
        .catch(() => false);
      expect(metadataExists).toBe(true);

      const conceptExists = await fs
        .access(path.join(variantDir, "concept-art.png"))
        .then(() => true)
        .catch(() => false);
      expect(conceptExists).toBe(true);
    });

    it("should throw error when no model URL in result", async () => {
      const result = {
        status: "SUCCEEDED",
        model_urls: {},
      };

      try {
        await service.saveRetexturedAsset({
          result: result as any,
          variantName: "test",
          baseAssetId: "base",
          baseMetadata: {} as any,
          materialPreset: {} as any,
          taskId: "task",
          assetsDir: testDir,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("No model URL in result");
      }
    });
  });

  describe("updateBaseAssetVariants", () => {
    it("should add variant to base asset metadata", async () => {
      const baseAssetId = "base-asset";
      const variantId = "base-asset-bronze";

      // Create base asset
      const baseDir = path.join(testDir, baseAssetId);
      await fs.mkdir(baseDir, { recursive: true });

      const metadata = {
        id: baseAssetId,
        name: "Base",
        variants: [],
        variantCount: 0,
      };

      await fs.writeFile(
        path.join(baseDir, "metadata.json"),
        JSON.stringify(metadata),
      );

      await service.updateBaseAssetVariants(baseAssetId, variantId, testDir);

      // Read updated metadata
      const updated = JSON.parse(
        await fs.readFile(path.join(baseDir, "metadata.json"), "utf-8"),
      );

      expect(updated.variants).toContain(variantId);
      expect(updated.variantCount).toBe(1);
      expect(updated.lastVariantGenerated).toBe(variantId);
      expect(updated.updatedAt).toBeDefined();
    });

    it("should not duplicate variants", async () => {
      const baseAssetId = "base-asset";
      const variantId = "base-asset-bronze";

      // Create base asset
      const baseDir = path.join(testDir, baseAssetId);
      await fs.mkdir(baseDir, { recursive: true });

      const metadata = {
        id: baseAssetId,
        variants: [variantId],
        variantCount: 1,
      };

      await fs.writeFile(
        path.join(baseDir, "metadata.json"),
        JSON.stringify(metadata),
      );

      await service.updateBaseAssetVariants(baseAssetId, variantId, testDir);

      // Read metadata
      const updated = JSON.parse(
        await fs.readFile(path.join(baseDir, "metadata.json"), "utf-8"),
      );

      // Should still only have one variant
      expect(updated.variants.length).toBe(1);
      expect(updated.variantCount).toBe(1);
    });

    it("should handle missing metadata file gracefully", async () => {
      const baseAssetId = "non-existent";
      const variantId = "variant";

      // Should not throw
      await service.updateBaseAssetVariants(baseAssetId, variantId, testDir);
    });
  });

  describe("getAssetMetadata", () => {
    it("should read asset metadata from file", async () => {
      const assetId = "test-asset";
      const assetDir = path.join(testDir, assetId);
      await fs.mkdir(assetDir, { recursive: true });

      const metadata = {
        id: assetId,
        name: "Test Asset",
        type: "weapon",
        meshyTaskId: "task-123",
      };

      await fs.writeFile(
        path.join(assetDir, "metadata.json"),
        JSON.stringify(metadata),
      );

      const result = await service.getAssetMetadata(assetId, testDir);

      expect(result.id).toBe(assetId);
      expect(result.name).toBe("Test Asset");
      expect(result.meshyTaskId).toBe("task-123");
    });

    it("should throw error for missing metadata", async () => {
      try {
        await service.getAssetMetadata("non-existent", testDir);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error).toBeDefined(); // Should throw some error
      }
    });
  });

  describe("regenerateBase", () => {
    it("should return simulated success response", async () => {
      const baseAssetId = "base-asset";

      // Set required env vars for regenerateBase
      process.env.OPENAI_API_KEY = "test-openai-key";

      // Create base asset
      const baseDir = path.join(testDir, baseAssetId);
      await fs.mkdir(baseDir, { recursive: true });

      await fs.writeFile(
        path.join(baseDir, "metadata.json"),
        JSON.stringify({ id: baseAssetId }),
      );

      const result = await service.regenerateBase({
        baseAssetId,
        assetsDir: testDir,
      });

      expect(result.success).toBe(true);
      expect(result.assetId).toBe(baseAssetId);
      expect(result.message).toContain("coming soon");
    });
  });

  describe("destroy", () => {
    it("should cleanup meshyClient resources", () => {
      // Should not throw
      service.destroy();

      // After destroy, client should be cleaned up
      expect(() => service.destroy()).not.toThrow();
    });

    it("should handle destroy when no client exists", () => {
      const noClientService = new RetextureService();

      // Should not throw
      expect(() => noClientService.destroy()).not.toThrow();
    });
  });
});
