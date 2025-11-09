/**
 * AICreationService Tests
 * Tests for AI-powered image generation and 3D model creation
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { AICreationService } from "./AICreationService";

describe("AICreationService", () => {
  let originalOpenAIKey: string | undefined;
  let originalMeshyKey: string | undefined;
  let originalAIGatewayKey: string | undefined;

  beforeEach(() => {
    // Save original env vars
    originalOpenAIKey = process.env.OPENAI_API_KEY;
    originalMeshyKey = process.env.MESHY_API_KEY;
    originalAIGatewayKey = process.env.AI_GATEWAY_API_KEY;

    // Set test API keys
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.MESHY_API_KEY = "test-meshy-key";
    delete process.env.AI_GATEWAY_API_KEY;
  });

  afterEach(() => {
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
  });

  describe("Constructor", () => {
    it("should initialize with OpenAI and Meshy services", () => {
      const service = new AICreationService({
        openai: { apiKey: "test-openai-key" },
        meshy: { apiKey: "test-meshy-key" },
      });
      expect(service).toBeDefined();
      expect(service.getImageService()).toBeDefined();
      expect(service.getMeshyService()).toBeDefined();
    });

    it("should create service with custom config", () => {
      const customService = new AICreationService({
        openai: {
          apiKey: "custom-openai",
          model: "custom-model",
        },
        meshy: {
          apiKey: "custom-meshy",
          baseUrl: "https://custom.meshy.ai",
        },
      });

      expect(customService.getImageService()).toBeDefined();
      expect(customService.getMeshyService()).toBeDefined();
    });
  });

  describe("ImageGenerationService", () => {
    describe("generateImage - Direct OpenAI", () => {
      it("should generate image using direct OpenAI API", async () => {
        const testMockFetch = mock(async (url: any, options: any) => {
          expect(url).toBe("https://api.openai.com/v1/images/generations");
          expect(options.headers.Authorization).toBe("Bearer test-openai-key");

          const body = JSON.parse(options.body);
          expect(body.model).toBe("gpt-image-1");
          expect(body.prompt).toContain("sword");

          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  url: "https://oaidalleapiprodscus.blob.core.windows.net/test.png",
                },
              ],
            }),
          } as any;
        }) as any;

        const testService = new AICreationService({
          openai: {
            apiKey: "test-openai-key",
            model: "gpt-image-1",
          },
          meshy: {
            apiKey: "test-meshy-key",
          },
          fetchFn: testMockFetch,
        });

        const imageService = testService.getImageService();
        const result = await imageService.generateImage(
          "magical sword",
          "weapon",
          "fantasy",
        );

        expect(result.imageUrl).toContain("blob.core.windows.net");
        expect(result.prompt).toContain("magical sword");
        expect(result.metadata.model).toBe("gpt-image-1");
        expect(result.metadata.resolution).toBe("1024x1024");
      });

      it("should generate image with base64 response", async () => {
        const testMockFetch = mock(async () => ({
          ok: true,
          json: async () => ({
            data: [
              {
                b64_json: "iVBORw0KGgoAAAANSUhEUg==",
              },
            ],
          }),
        })) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const imageService = testService.getImageService();
        const result = await imageService.generateImage("test asset", "prop");

        expect(result.imageUrl).toContain("data:image/png;base64,");
        expect(result.metadata.quality).toBe("high");
      });

      it("should throw error when API fails", async () => {
        const testMockFetch = mock(async () => ({
          ok: false,
          status: 401,
          text: async () => "Unauthorized",
        })) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const imageService = testService.getImageService();

        expect(async () => {
          await imageService.generateImage("test", "prop");
        }).toThrow("Image generation API error");
      });
    });

    describe("generateImage - AI Gateway", () => {
      beforeEach(() => {
        process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
        delete process.env.OPENAI_API_KEY;
      });

      it("should generate image using AI Gateway", async () => {
        const testMockFetch = mock(async (url: any, options: any) => {
          expect(url).toBe("https://ai-gateway.vercel.sh/v1/chat/completions");
          expect(options.headers.Authorization).toBe("Bearer test-gateway-key");

          const body = JSON.parse(options.body);
          expect(body.model).toBe("google/gemini-2.5-flash-image");
          expect(body.messages[0].content).toContain("Generate an image");

          return {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    images: [
                      {
                        image_url: {
                          url: "https://generativelanguage.googleapis.com/test.png",
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          } as any;
        }) as any;

        const testService = new AICreationService({
          openai: { apiKey: "" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const imageService = testService.getImageService();
        const result = await imageService.generateImage(
          "fantasy character",
          "character",
          "RPG",
        );

        expect(result.imageUrl).toContain("googleapis.com");
        expect(result.metadata.model).toBe("google/gemini-2.5-flash-image");
      });

      it("should throw error when no images in response", async () => {
        const testMockFetch = mock(async () => ({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {},
              },
            ],
          }),
        })) as any;

        const testService = new AICreationService({
          openai: { apiKey: "" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const imageService = testService.getImageService();

        expect(async () => {
          await imageService.generateImage("test", "prop");
        }).toThrow("No image data returned");
      });
    });

    it("should throw error when no API key configured", async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;

      const noKeyService = new AICreationService({
        openai: { apiKey: "" },
        meshy: { apiKey: "test" },
      });

      const noKeyImageService = noKeyService.getImageService();

      expect(async () => {
        await noKeyImageService.generateImage("test", "prop");
      }).toThrow("required for image generation");
    });
  });

  describe("MeshyService", () => {
    describe("startImageTo3D", () => {
      it("should start image-to-3D conversion", async () => {
        const testMockFetch = mock(async (url: any, options: any) => {
          expect(url).toBe("https://api.meshy.ai/openapi/v1/image-to-3d");
          expect(options.method).toBe("POST");
          expect(options.headers.Authorization).toBe("Bearer test-meshy-key");

          const body = JSON.parse(options.body);
          expect(body.image_url).toBe("https://example.com/test.png");
          expect(body.ai_model).toBe("meshy-5");
          expect(body.enable_pbr).toBe(true);

          return {
            ok: true,
            json: async () => ({
              task_id: "task-123",
            }),
          } as any;
        }) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const meshyService = testService.getMeshyService();
        const taskId = await meshyService.startImageTo3D(
          "https://example.com/test.png",
          {
            enable_pbr: true,
            ai_model: "meshy-5",
            topology: "quad",
            targetPolycount: 10000,
            texture_resolution: 2048,
          },
        );

        expect(taskId).toBe("task-123");
      });

      it("should use default options when not provided", async () => {
        const testMockFetch = mock(async (url: any, options: any) => {
          const body = JSON.parse(options.body);
          expect(body.enable_pbr).toBe(false);
          expect(body.ai_model).toBe("meshy-4");
          expect(body.topology).toBe("quad");
          expect(body.target_polycount).toBe(2000);

          return {
            ok: true,
            json: async () => ({ task_id: "default-task" }),
          } as any;
        }) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const meshyService = testService.getMeshyService();
        await meshyService.startImageTo3D("https://example.com/test.png", {});
      });

      it("should handle nested task_id in result", async () => {
        const testMockFetch = mock(async () => ({
          ok: true,
          json: async () => ({
            result: {
              task_id: "nested-task-id",
            },
          }),
        })) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const meshyService = testService.getMeshyService();
        const taskId = await meshyService.startImageTo3D(
          "https://example.com/test.png",
          {},
        );

        expect(taskId).toBe("nested-task-id");
      });

      it("should throw error on API failure", async () => {
        const testMockFetch = mock(async () => ({
          ok: false,
          status: 400,
          text: async () => "Invalid image URL",
        })) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const meshyService = testService.getMeshyService();

        expect(async () => {
          await meshyService.startImageTo3D("invalid-url", {});
        }).toThrow("Meshy API error");
      });
    });

    describe("getTaskStatus", () => {
      it("should get task status", async () => {
        const testMockFetch = mock(async (url: any) => {
          expect(url).toBe(
            "https://api.meshy.ai/openapi/v1/image-to-3d/task-123",
          );

          return {
            ok: true,
            json: async () => ({
              result: {
                status: "SUCCEEDED",
                progress: 100,
                model_urls: {
                  glb: "https://assets.meshy.ai/model.glb",
                },
              },
            }),
          } as any;
        }) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const meshyService = testService.getMeshyService();
        const status = await meshyService.getTaskStatus("task-123");

        expect(status.status).toBe("SUCCEEDED");
        expect(status.progress).toBe(100);
        expect(status.model_urls.glb).toContain("assets.meshy.ai");
      });
    });

    describe("startRetextureTask", () => {
      it("should start retexture task with input task ID", async () => {
        const testMockFetch = mock(async (url: any, options: any) => {
          expect(url).toBe("https://api.meshy.ai/openapi/v1/retexture");

          const body = JSON.parse(options.body);
          expect(body.input_task_id).toBe("base-task-123");
          expect(body.text_style_prompt).toBe("bronze material");
          expect(body.art_style).toBe("realistic");

          return {
            ok: true,
            json: async () => ({ task_id: "retexture-task-456" }),
          } as any;
        }) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const meshyService = testService.getMeshyService();
        const taskId = await meshyService.startRetextureTask(
          { inputTaskId: "base-task-123" },
          { textStylePrompt: "bronze material" },
          { artStyle: "realistic", aiModel: "meshy-5" },
        );

        expect(taskId).toBe("retexture-task-456");
      });

      it("should start retexture task with model URL", async () => {
        const testMockFetch = mock(async (url: any, options: any) => {
          const body = JSON.parse(options.body);
          expect(body.model_url).toBe("https://example.com/model.glb");
          expect(body.input_task_id).toBe(undefined);

          return {
            ok: true,
            json: async () => ({ id: "retexture-url-task" }),
          } as any;
        }) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const meshyService = testService.getMeshyService();
        const taskId = await meshyService.startRetextureTask(
          { modelUrl: "https://example.com/model.glb" },
          { imageStyleUrl: "https://example.com/style.png" },
          {},
        );

        expect(taskId).toBe("retexture-url-task");
      });
    });

    describe("startRiggingTask", () => {
      it("should start rigging task", async () => {
        const testMockFetch = mock(async (url: any, options: any) => {
          expect(url).toBe("https://api.meshy.ai/openapi/v1/rigging");

          const body = JSON.parse(options.body);
          expect(body.input_task_id).toBe("base-task-123");
          expect(body.height_meters).toBe(1.8);

          return {
            ok: true,
            json: async () => ({ task_id: "rigging-task-789" }),
          } as any;
        }) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const meshyService = testService.getMeshyService();
        const taskId = await meshyService.startRiggingTask(
          { inputTaskId: "base-task-123" },
          { heightMeters: 1.8 },
        );

        expect(taskId).toBe("rigging-task-789");
      });

      it("should use default height when not provided", async () => {
        const testMockFetch = mock(async (url: any, options: any) => {
          const body = JSON.parse(options.body);
          expect(body.height_meters).toBe(1.7);

          return {
            ok: true,
            json: async () => ({ task_id: "default-rigging" }),
          } as any;
        }) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const meshyService = testService.getMeshyService();
        await meshyService.startRiggingTask({ inputTaskId: "base-task" }, {});
      });

      it("should throw error when neither inputTaskId nor modelUrl provided", async () => {
        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
        });

        const meshyService = testService.getMeshyService();

        expect(async () => {
          await meshyService.startRiggingTask({}, {});
        }).toThrow("Either inputTaskId or modelUrl must be provided");
      });
    });

    describe("getRiggingTaskStatus", () => {
      it("should get rigging task status", async () => {
        const testMockFetch = mock(async (url: any) => {
          expect(url).toBe(
            "https://api.meshy.ai/openapi/v1/rigging/rigging-123",
          );

          return {
            ok: true,
            json: async () => ({
              status: "SUCCEEDED",
              progress: 100,
              result: {
                basic_animations: {
                  walking_glb_url: "https://assets.meshy.ai/walk.glb",
                  running_glb_url: "https://assets.meshy.ai/run.glb",
                },
              },
            }),
          } as any;
        }) as any;

        const testService = new AICreationService({
          openai: { apiKey: "test-openai-key" },
          meshy: { apiKey: "test-meshy-key" },
          fetchFn: testMockFetch,
        });

        const meshyService = testService.getMeshyService();
        const status = await meshyService.getRiggingTaskStatus("rigging-123");

        expect(status.status).toBe("SUCCEEDED");
        expect(status.result.basic_animations.walking_glb_url).toContain(
          "walk.glb",
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      const testMockFetch = mock(async () => {
        throw new Error("Network timeout");
      }) as any;

      const testService = new AICreationService({
        openai: { apiKey: "test-openai-key" },
        meshy: { apiKey: "test-meshy-key" },
        fetchFn: testMockFetch,
      });

      const imageService = testService.getImageService();

      expect(async () => {
        await imageService.generateImage("test", "prop");
      }).toThrow("Network timeout");
    });

    it("should handle malformed API responses", async () => {
      const testMockFetch = mock(async () => ({
        ok: true,
        json: async () => ({}), // Missing task_id
      })) as any;

      const testService = new AICreationService({
        openai: { apiKey: "test-openai-key" },
        meshy: { apiKey: "test-meshy-key" },
        fetchFn: testMockFetch,
      });

      const meshyService = testService.getMeshyService();
      const result = await meshyService.startImageTo3D(
        "https://example.com/test.png",
        {},
      );

      // Should return the full object when no task_id found
      expect(typeof result).toBe("object");
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle full workflow: image generation -> 3D conversion", async () => {
      let callCount = 0;

      const testMockFetch = mock(async (url: any, options: any) => {
        callCount++;

        // First call: image generation
        if (url.includes("images/generations")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ url: "https://example.com/generated.png" }],
            }),
          } as any;
        }

        // Second call: image-to-3D
        if (url.includes("image-to-3d")) {
          return {
            ok: true,
            json: async () => ({ task_id: "conversion-task" }),
          } as any;
        }

        return { ok: false } as any;
      }) as any;

      const testService = new AICreationService({
        openai: { apiKey: "test-openai-key" },
        meshy: { apiKey: "test-meshy-key" },
        fetchFn: testMockFetch,
      });

      const imageService = testService.getImageService();
      const meshyService = testService.getMeshyService();

      // Generate image
      const imageResult = await imageService.generateImage(
        "fantasy sword",
        "weapon",
      );

      expect(imageResult.imageUrl).toContain("generated.png");

      // Convert to 3D
      const taskId = await meshyService.startImageTo3D(
        imageResult.imageUrl,
        {},
      );

      expect(taskId).toBe("conversion-task");
      expect(callCount).toBe(2);
    });
  });
});
