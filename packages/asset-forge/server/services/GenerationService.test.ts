/**
 * GenerationService Tests
 * Comprehensive tests for multi-step AI asset generation pipeline
 * Covers: Image generation → 3D conversion → Retexturing → Rigging
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { GenerationService } from "./GenerationService";
import fs from "fs/promises";
import path from "path";

describe("GenerationService", () => {
  let service: GenerationService;
  let originalOpenAIKey: string | undefined;
  let originalMeshyKey: string | undefined;
  let originalAIGatewayKey: string | undefined;
  let testOutputDir: string;
  let mockFetch: any;

  // Helper function to poll pipeline status until condition is met
  async function waitForPipelineCondition(
    pipelineId: string,
    condition: (status: any) => boolean,
    timeoutMs: number = 2000,
    pollIntervalMs: number = 50,
  ): Promise<any> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const status = await service.getPipelineStatus(pipelineId);
      if (condition(status)) {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    // Return final status even if condition not met (for assertions)
    return await service.getPipelineStatus(pipelineId);
  }

  beforeEach(async () => {
    // Save original env vars
    originalOpenAIKey = process.env.OPENAI_API_KEY;
    originalMeshyKey = process.env.MESHY_API_KEY;
    originalAIGatewayKey = process.env.AI_GATEWAY_API_KEY;

    // Set test API keys
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.MESHY_API_KEY = "test-meshy-key";
    delete process.env.AI_GATEWAY_API_KEY;

    // Create mock fetch function
    mockFetch = mock(async (url: any, options?: any) => {
      // Default mock responses to prevent real API calls
      if (typeof url === "string" && url.includes("chat/completions")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            choices: [{ message: { content: "Enhanced test prompt" } }],
          }),
          text: async () =>
            JSON.stringify({
              choices: [{ message: { content: "Enhanced test prompt" } }],
            }),
        } as any;
      }

      if (typeof url === "string" && url.includes("images/generations")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            data: [{ url: "https://example.com/test-image.png" }],
          }),
          text: async () =>
            JSON.stringify({
              data: [{ url: "https://example.com/test-image.png" }],
            }),
        } as any;
      }

      // Meshy image-to-3D POST
      if (
        typeof url === "string" &&
        url.includes("image-to-3d") &&
        options?.method === "POST"
      ) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ task_id: "test-mesh-task" }),
          text: async () => JSON.stringify({ task_id: "test-mesh-task" }),
        } as any;
      }

      // Meshy task status - return FAILED to stop quickly
      if (
        typeof url === "string" &&
        url.includes("image-to-3d/test-mesh-task")
      ) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            result: {
              status: "FAILED",
              error: "Test early termination",
            },
          }),
          text: async () =>
            JSON.stringify({
              status: "FAILED",
              error: "Test early termination",
            }),
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

    service = new GenerationService({ fetchFn: mockFetch });

    // Create test output directory
    testOutputDir = `/tmp/generation-test-${Date.now()}`;
    await fs.mkdir(testOutputDir, { recursive: true });
    await fs.mkdir(path.join(testOutputDir, "gdd-assets"), { recursive: true });
    await fs.mkdir(path.join(testOutputDir, "temp-images"), {
      recursive: true,
    });
  });

  afterEach(async () => {
    // Restore original env vars
    if (originalOpenAIKey) {
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }

    if (originalMeshyKey) {
      process.env.MESHY_API_KEY = originalMeshyKey;
    } else {
      delete process.env.MESHY_API_KEY;
    }

    if (originalAIGatewayKey) {
      process.env.AI_GATEWAY_API_KEY = originalAIGatewayKey;
    } else {
      delete process.env.AI_GATEWAY_API_KEY;
    }

    // Cleanup test directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Cleanup gdd-assets created by service
    try {
      await fs.rm("gdd-assets", { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      await fs.rm("temp-images", { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Constructor", () => {
    it("should initialize with default configuration", () => {
      expect(service).toBeDefined();
      expect((service as any).activePipelines).toBeDefined();
      expect((service as any).aiService).toBeDefined();
    });

    it("should warn when API keys are missing", () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.MESHY_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;

      // Should create service but warn
      const noKeyService = new GenerationService({ fetchFn: mockFetch });
      expect(noKeyService).toBeDefined();
    });
  });

  describe("startPipeline", () => {
    it("should create and start new pipeline", async () => {
      const config = {
        description: "bronze sword",
        assetId: "test-sword",
        name: "Test Sword",
        type: "weapon",
        subtype: "sword",
        style: "fantasy",
      };

      const result = await service.startPipeline(config);

      expect(result.pipelineId).toBeDefined();
      expect(result.pipelineId).toContain("pipeline-");
      // Pipeline immediately transitions to "processing" - accept either state
      expect(["initializing", "processing"]).toContain(result.status);
      expect(result.message).toContain("started successfully");
    });

    it("should initialize pipeline stages correctly", async () => {
      const config = {
        description: "test asset",
        assetId: "test-asset",
        name: "Test",
        type: "prop",
        subtype: "misc",
      };

      const result = await service.startPipeline(config);

      const status = await service.getPipelineStatus(result.pipelineId);

      expect(status.stages.textInput.status).toBe("completed");
      // Stages may already be processing due to async execution
      expect(["pending", "processing", "completed", "skipped"]).toContain(
        status.stages.promptOptimization.status,
      );
      expect(["pending", "processing", "completed", "failed"]).toContain(
        status.stages.imageGeneration.status,
      );
      expect(["pending", "processing", "completed", "failed"]).toContain(
        status.stages.image3D.status,
      );
    });

    it("should include rigging stage for avatars when enabled", async () => {
      const config = {
        description: "warrior character",
        assetId: "test-warrior",
        name: "Warrior",
        type: "character",
        subtype: "humanoid",
        generationType: "avatar",
        enableRigging: true,
      };

      const result = await service.startPipeline(config);

      const status = await service.getPipelineStatus(result.pipelineId);

      expect(status.stages.rigging).toBeDefined();
      expect(status.stages.rigging!.status).toBe("pending");
    });

    it("should not include rigging stage when disabled", async () => {
      const config = {
        description: "static prop",
        assetId: "test-prop",
        name: "Prop",
        type: "prop",
        subtype: "misc",
        enableRigging: false,
      };

      const result = await service.startPipeline(config);

      const status = await service.getPipelineStatus(result.pipelineId);

      expect(status.stages.rigging).toBe(undefined);
    });

    it("should include sprite generation stage when enabled", async () => {
      const config = {
        description: "icon asset",
        assetId: "test-icon",
        name: "Icon",
        type: "prop",
        subtype: "icon",
        enableSprites: true,
      };

      const result = await service.startPipeline(config);

      const status = await service.getPipelineStatus(result.pipelineId);

      expect(status.stages.spriteGeneration).toBeDefined();
      expect(status.stages.spriteGeneration!.status).toBe("pending");
    });
  });

  describe("getPipelineStatus", () => {
    it("should return pipeline status", async () => {
      const config = {
        description: "test",
        assetId: "test",
        name: "Test",
        type: "prop",
        subtype: "misc",
      };

      const { pipelineId } = await service.startPipeline(config);

      const status = await service.getPipelineStatus(pipelineId);

      expect(status.id).toBe(pipelineId);
      expect(status.status).toBeDefined();
      expect(status.progress).toBeDefined();
      expect(status.stages).toBeDefined();
      expect(status.createdAt).toBeDefined();
    });

    it("should throw error for non-existent pipeline", async () => {
      await expect(async () => {
        await service.getPipelineStatus("non-existent-pipeline");
      }).toThrow("Pipeline non-existent-pipeline not found");
    });
  });

  describe("Pipeline Processing - GPT-4 Enhancement", () => {
    it("should skip GPT-4 enhancement when explicitly disabled", async () => {
      const config = {
        description: "simple sword",
        assetId: "simple-sword",
        name: "Simple Sword",
        type: "weapon",
        subtype: "sword",
        metadata: {
          useGPT4Enhancement: false,
        },
      };

      const { pipelineId } = await service.startPipeline(config);

      // Wait a bit for processing to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = await service.getPipelineStatus(pipelineId);

      expect(status.stages.promptOptimization.status).toBe("skipped");
    });

    // FIXME: This test overrides global.fetch but service uses injected mockFetch
    // To properly test this, we'd need to create a new service instance with custom fetch
    it.skip("should enhance prompt with GPT-4 by default", async () => {
      const originalFetch = global.fetch;
      let gpt4Called = false;

      global.fetch = mock(async (url: any, options: any) => {
        // GPT-4 enhancement call
        if (
          url.includes("openai.com") &&
          url.includes("chat/completions") &&
          options?.body
        ) {
          gpt4Called = true;
          return {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: "Enhanced bronze sword with detailed textures",
                  },
                },
              ],
            }),
          } as any;
        }

        // Image generation
        if (url.includes("images/generations")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ url: "https://example.com/image.png" }],
            }),
          } as any;
        }

        // Meshy image-to-3D
        if (url.includes("image-to-3d") && options?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ task_id: "mesh-task-123" }),
          } as any;
        }

        // Meshy status - return FAILED to stop pipeline quickly
        if (url.includes("image-to-3d/mesh-task-123")) {
          return {
            ok: true,
            json: async () => ({
              result: {
                status: "FAILED",
                error: "Test early termination",
              },
            }),
          } as any;
        }

        return { ok: false, statusText: "Not mocked" } as any;
      }) as any;

      try {
        const config = {
          description: "bronze sword",
          assetId: "bronze-sword",
          name: "Bronze Sword",
          type: "weapon",
          subtype: "sword",
        };

        await service.startPipeline(config);

        // Wait for GPT-4 enhancement to be attempted
        await new Promise((resolve) => setTimeout(resolve, 200));

        expect(gpt4Called).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("Pipeline Processing - Image Generation", () => {
    it("should skip image generation when user provides reference image", async () => {
      const config = {
        description: "custom model",
        assetId: "custom-model",
        name: "Custom Model",
        type: "prop",
        subtype: "misc",
        referenceImage: {
          url: "https://example.com/reference.png",
        },
      };

      const { pipelineId } = await service.startPipeline(config);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = await service.getPipelineStatus(pipelineId);

      expect(status.stages.imageGeneration.status).toBe("skipped");
      expect(status.stages.imageGeneration.result).toBeDefined();
      expect(status.stages.imageGeneration.result.source).toBe("user-provided");
    });

    it("should use data URI from user reference", async () => {
      const config = {
        description: "test",
        assetId: "test",
        name: "Test",
        type: "prop",
        subtype: "misc",
        referenceImage: {
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        },
      };

      const { pipelineId } = await service.startPipeline(config);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = await service.getPipelineStatus(pipelineId);

      expect(status.stages.imageGeneration.status).toBe("skipped");
    });
  });

  describe("Pipeline Processing - Material Variants", () => {
    // FIXME: These tests timeout because pipeline takes >5s (Meshy poll interval)
    // Need to either mock Meshy polling or create deterministic test setup
    it.skip("should skip texture generation when not enabled", async () => {
      const config = {
        description: "plain sword",
        assetId: "plain-sword",
        name: "Plain Sword",
        type: "weapon",
        subtype: "sword",
        enableRetexturing: false,
      };

      const { pipelineId } = await service.startPipeline(config);

      // Wait for pipeline to process and skip texture stage
      const status = await waitForPipelineCondition(
        pipelineId,
        (s) => s.stages.textureGeneration.status !== "pending",
        1000,
      );

      expect(status.stages.textureGeneration.status).toBe("skipped");
    });

    it.skip("should skip texture generation when no material presets provided", async () => {
      const config = {
        description: "sword",
        assetId: "sword",
        name: "Sword",
        type: "weapon",
        subtype: "sword",
        enableRetexturing: true,
        materialPresets: [],
      };

      const { pipelineId } = await service.startPipeline(config);

      // Wait for pipeline to process and skip texture stage
      const status = await waitForPipelineCondition(
        pipelineId,
        (s) => s.stages.textureGeneration.status !== "pending",
        1000,
      );

      expect(status.stages.textureGeneration.status).toBe("skipped");
    });
  });

  describe("Error Handling", () => {
    // FIXME: These tests override global.fetch but service uses injected mockFetch
    // Need to create new service instances with custom fetch for each test
    it.skip("should handle image generation errors gracefully", async () => {
      const originalFetch = global.fetch;

      global.fetch = mock(async (url: any) => {
        if (url.includes("images/generations")) {
          return {
            ok: false,
            status: 401,
            text: async () => "Unauthorized",
          } as any;
        }
        return { ok: false } as any;
      }) as any;

      try {
        const config = {
          description: "test",
          assetId: "test",
          name: "Test",
          type: "prop",
          subtype: "misc",
          metadata: {
            useGPT4Enhancement: false, // Skip GPT-4 to test image gen directly
          },
        };

        const { pipelineId } = await service.startPipeline(config);

        // Poll until pipeline fails (deterministic check)
        const status = await waitForPipelineCondition(
          pipelineId,
          (s) => s.status === "failed" || s.status === "completed",
          2000,
        );

        expect(status.status).toBe("failed");
        expect(status.error).toBeDefined();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it.skip("should mark pipeline as failed on unhandled error", async () => {
      const originalFetch = global.fetch;

      global.fetch = mock(async () => {
        throw new Error("Catastrophic network failure");
      }) as any;

      try {
        const config = {
          description: "test",
          assetId: "test",
          name: "Test",
          type: "prop",
          subtype: "misc",
          metadata: {
            useGPT4Enhancement: false,
          },
        };

        const { pipelineId } = await service.startPipeline(config);

        // Poll until pipeline fails (deterministic check)
        const status = await waitForPipelineCondition(
          pipelineId,
          (s) => s.status === "failed" || s.status === "completed",
          2000,
        );

        expect(status.status).toBe("failed");
        expect(status.error).toContain("Catastrophic");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it.skip("should continue without rigging if rigging fails", async () => {
      const originalFetch = global.fetch;

      global.fetch = mock(async (url: any, options: any) => {
        // Allow GPT-4, image gen, and image-to-3D to succeed
        if (url.includes("chat/completions")) {
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: "Enhanced prompt" } }],
            }),
          } as any;
        }

        if (url.includes("images/generations")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ url: "https://example.com/image.png" }],
            }),
          } as any;
        }

        if (url.includes("image-to-3d") && options?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ task_id: "mesh-123" }),
          } as any;
        }

        // Meshy status - succeed quickly
        if (url.includes("image-to-3d/mesh-123")) {
          return {
            ok: true,
            json: async () => ({
              result: {
                status: "SUCCEEDED",
                progress: 100,
                model_urls: { glb: "https://example.com/model.glb" },
              },
            }),
          } as any;
        }

        // Download model
        if (url.includes("model.glb")) {
          return {
            ok: true,
            arrayBuffer: async () => Buffer.from("FAKE_GLB"),
          } as any;
        }

        // Rigging - fail
        if (url.includes("rigging")) {
          return {
            ok: true,
            json: async () => ({
              status: "FAILED",
              task_error: { message: "Rigging failed" },
            }),
          } as any;
        }

        return { ok: false } as any;
      }) as any;

      try {
        const config = {
          description: "warrior",
          assetId: "warrior",
          name: "Warrior",
          type: "character",
          subtype: "humanoid",
          generationType: "avatar",
          enableRigging: true,
        };

        const { pipelineId } = await service.startPipeline(config);

        // Poll until pipeline completes (deterministic check - longer timeout for rigging)
        const status = await waitForPipelineCondition(
          pipelineId,
          (s) => s.status === "completed" || s.status === "failed",
          3000,
        );

        // Pipeline should complete despite rigging failure
        expect(status.status).toBe("completed");
        if (status.stages.rigging) {
          expect(status.stages.rigging.status).toBe("failed");
        }
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("Cleanup", () => {
    it("should cleanup old pipelines", async () => {
      // Create fake old pipeline
      const oldPipeline = {
        id: "old-pipeline",
        status: "completed" as const,
        progress: 100,
        stages: {} as any,
        results: {},
        config: {} as any,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      };

      (service as any).activePipelines.set("old-pipeline", oldPipeline);

      // Cleanup
      service.cleanupOldPipelines();

      // Should be removed
      await expect(async () => {
        await service.getPipelineStatus("old-pipeline");
      }).toThrow();
    });

    it("should not cleanup recent pipelines", async () => {
      const config = {
        description: "test",
        assetId: "test",
        name: "Test",
        type: "prop",
        subtype: "misc",
      };

      const { pipelineId } = await service.startPipeline(config);

      // Cleanup
      service.cleanupOldPipelines();

      // Should still exist
      const status = await service.getPipelineStatus(pipelineId);
      expect(status).toBeDefined();
    });

    it("should not cleanup in-progress pipelines even if old", () => {
      const oldPipeline = {
        id: "in-progress",
        status: "processing" as const,
        progress: 50,
        stages: {} as any,
        results: {},
        config: {} as any,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      };

      (service as any).activePipelines.set("in-progress", oldPipeline);

      service.cleanupOldPipelines();

      // Should still exist because it's processing
      const status = (service as any).activePipelines.get("in-progress");
      expect(status).toBeDefined();
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle minimal config", async () => {
      const config = {
        description: "simple asset",
        assetId: "simple",
        name: "Simple",
        type: "prop",
        subtype: "misc",
      };

      const { pipelineId } = await service.startPipeline(config);
      const status = await service.getPipelineStatus(pipelineId);

      expect(status).toBeDefined();
      expect(status.id).toBe(pipelineId);
    });

    it("should handle full config with all options", async () => {
      const config = {
        description: "epic fantasy sword",
        assetId: "epic-sword",
        name: "Epic Sword",
        type: "weapon",
        subtype: "sword",
        generationType: "weapon",
        style: "fantasy",
        quality: "ultra",
        enableRigging: false,
        enableRetexturing: true,
        enableSprites: true,
        materialPresets: [
          {
            id: "bronze",
            displayName: "Bronze",
            category: "metal",
            tier: 1,
            color: "#CD7F32",
            stylePrompt: "bronze material",
          },
        ],
        riggingOptions: {
          heightMeters: 1.8,
        },
        customPrompts: {
          gameStyle: "low-poly fantasy RPG",
        },
        metadata: {
          useGPT4Enhancement: true,
          characterHeight: 1.8,
        },
      };

      const { pipelineId } = await service.startPipeline(config);
      const status = await service.getPipelineStatus(pipelineId);

      expect(status).toBeDefined();
      expect(status.stages.textureGeneration).toBeDefined();
      expect(status.stages.spriteGeneration).toBeDefined();
      expect(status.stages.rigging).toBe(undefined); // Not avatar type
    });

    it("should handle concurrent pipelines", async () => {
      const configs = [
        {
          description: "sword 1",
          assetId: "sword-1",
          name: "Sword 1",
          type: "weapon",
          subtype: "sword",
        },
        {
          description: "sword 2",
          assetId: "sword-2",
          name: "Sword 2",
          type: "weapon",
          subtype: "sword",
        },
        {
          description: "sword 3",
          assetId: "sword-3",
          name: "Sword 3",
          type: "weapon",
          subtype: "sword",
        },
      ];

      const results = await Promise.all(
        configs.map((config) => service.startPipeline(config)),
      );

      expect(results).toHaveLength(3);
      expect(new Set(results.map((r) => r.pipelineId)).size).toBe(3); // All unique IDs

      // All should be retrievable
      for (const { pipelineId } of results) {
        const status = await service.getPipelineStatus(pipelineId);
        expect(status).toBeDefined();
      }
    });
  });

  describe("Progress Tracking", () => {
    it("should update progress through pipeline stages", async () => {
      const config = {
        description: "test asset",
        assetId: "test-progress",
        name: "Test Progress",
        type: "prop",
        subtype: "misc",
        metadata: {
          useGPT4Enhancement: false,
        },
      };

      const { pipelineId } = await service.startPipeline(config);

      // Initial state
      let status = await service.getPipelineStatus(pipelineId);
      expect(status.progress).toBe(0);

      // After text input (should be immediate)
      expect(status.stages.textInput.progress).toBe(100);
    });

    it("should track individual stage progress", async () => {
      const config = {
        description: "test",
        assetId: "test",
        name: "Test",
        type: "prop",
        subtype: "misc",
      };

      const { pipelineId } = await service.startPipeline(config);
      const status = await service.getPipelineStatus(pipelineId);

      // Text input should be complete
      expect(status.stages.textInput.status).toBe("completed");
      expect(status.stages.textInput.progress).toBe(100);

      // Other stages should be pending
      expect(status.stages.imageGeneration.progress).toBe(0);
      expect(status.stages.image3D.progress).toBe(0);
    });
  });
});
