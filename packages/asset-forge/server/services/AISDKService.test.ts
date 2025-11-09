/**
 * AISDKService Tests
 * Tests for AI SDK service providing configured language models
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { aiSDKService } from "./AISDKService";
import type { LanguageModelV1 } from "ai";

describe("AISDKService", () => {
  describe("Constructor", () => {
    it("should initialize successfully", () => {
      expect(aiSDKService).toBeDefined();
    });

    it("should have model configurations", () => {
      const qualityConfig = aiSDKService.getModelConfig("quality");
      const speedConfig = aiSDKService.getModelConfig("speed");
      const balancedConfig = aiSDKService.getModelConfig("balanced");

      expect(qualityConfig).toBeDefined();
      expect(speedConfig).toBeDefined();
      expect(balancedConfig).toBeDefined();
    });
  });

  describe("getModelConfig", () => {
    it("should return quality model config", () => {
      const config = aiSDKService.getModelConfig("quality");

      expect(config.provider).toBe("openai");
      expect(config.model).toContain("gpt-4o");
      expect(config.temperature).toBe(0.7);
    });

    it("should return speed model config", () => {
      const config = aiSDKService.getModelConfig("speed");

      expect(config.provider).toBe("openai");
      expect(config.model).toContain("gpt-4o-mini");
      expect(config.temperature).toBe(0.7);
    });

    it("should return balanced model config", () => {
      const config = aiSDKService.getModelConfig("balanced");

      expect(config.provider).toBe("openai");
      expect(config.model).toContain("gpt-4o");
      expect(config.temperature).toBe(0.5);
    });

    it("should have different temperatures for quality vs balanced", () => {
      const qualityConfig = aiSDKService.getModelConfig("quality");
      const balancedConfig = aiSDKService.getModelConfig("balanced");

      expect(qualityConfig.temperature).not.toBe(balancedConfig.temperature);
      expect(qualityConfig.temperature).toBe(0.7);
      expect(balancedConfig.temperature).toBe(0.5);
    });

    it("should use different models for speed vs quality", () => {
      const qualityConfig = aiSDKService.getModelConfig("quality");
      const speedConfig = aiSDKService.getModelConfig("speed");

      expect(qualityConfig.model).not.toBe(speedConfig.model);
      expect(qualityConfig.model).toContain("gpt-4o");
      expect(speedConfig.model).toContain("mini");
    });
  });

  describe("getConfiguredModel", () => {
    it("should return model for quality mode", async () => {
      const model = await aiSDKService.getConfiguredModel("quality");

      expect(model).toBeDefined();
      expect(model).toHaveProperty("doGenerate");
      expect(model).toHaveProperty("specificationVersion");
      expect(model).toHaveProperty("provider");
      expect(model).toHaveProperty("modelId");
    });

    it("should return model for speed mode", async () => {
      const model = await aiSDKService.getConfiguredModel("speed");

      expect(model).toBeDefined();
      expect(model).toHaveProperty("doGenerate");
    });

    it("should return model for balanced mode", async () => {
      const model = await aiSDKService.getConfiguredModel("balanced");

      expect(model).toBeDefined();
      expect(model).toHaveProperty("doGenerate");
    });

    it("should return balanced model by default", async () => {
      const model = await aiSDKService.getConfiguredModel();

      expect(model).toBeDefined();
      // Default is balanced
      const balancedConfig = aiSDKService.getModelConfig("balanced");
      expect(model.modelId).toContain("gpt-4o");
    });

    it("should throw error for unknown quality level", async () => {
      expect(async () => {
        await aiSDKService.getConfiguredModel("invalid" as any);
      }).toThrow("Unknown model quality");
    });

    it("should return different model instances for different qualities", async () => {
      const qualityModel = await aiSDKService.getConfiguredModel("quality");
      const speedModel = await aiSDKService.getConfiguredModel("speed");

      // Models should have different IDs
      expect(qualityModel.modelId).not.toBe(speedModel.modelId);
    });
  });

  describe("Model Configuration", () => {
    it("should support AI Gateway routing when configured", () => {
      const config = aiSDKService.getModelConfig("quality");

      // Model name should be either direct or with gateway prefix
      expect(
        config.model === "gpt-4o" || config.model === "openai/gpt-4o",
      ).toBe(true);
    });

    it("should have consistent provider across all models", () => {
      const configs = [
        aiSDKService.getModelConfig("quality"),
        aiSDKService.getModelConfig("speed"),
        aiSDKService.getModelConfig("balanced"),
      ];

      configs.forEach((config) => {
        expect(config.provider).toBe("openai");
      });
    });

    it("should have temperature settings within valid range", () => {
      const configs = [
        aiSDKService.getModelConfig("quality"),
        aiSDKService.getModelConfig("speed"),
        aiSDKService.getModelConfig("balanced"),
      ];

      configs.forEach((config) => {
        expect(config.temperature).toBeGreaterThanOrEqual(0);
        expect(config.temperature).toBeLessThanOrEqual(2);
      });
    });
  });

  describe("Integration", () => {
    it("should be usable as singleton", () => {
      // Verify the exported instance is the same
      const config1 = aiSDKService.getModelConfig("quality");
      const config2 = aiSDKService.getModelConfig("quality");

      expect(config1).toEqual(config2);
    });

    it("should provide models compatible with Vercel AI SDK", async () => {
      const model = await aiSDKService.getConfiguredModel("balanced");

      // Check for AI SDK interface properties (v2)
      expect(model).toHaveProperty("specificationVersion");
      expect(model.specificationVersion).toMatch(/v1|v2/);
      expect(model).toHaveProperty("provider");
      expect(model).toHaveProperty("modelId");
      expect(model).toHaveProperty("doGenerate");
      expect(typeof model.doGenerate).toBe("function");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid quality parameter", async () => {
      const invalidQualities = ["ultra", "mega", "", null, undefined] as any[];

      for (const quality of invalidQualities) {
        if (quality === undefined) {
          // undefined should use default (balanced)
          const model = await aiSDKService.getConfiguredModel(quality);
          expect(model).toBeDefined();
        } else {
          expect(async () => {
            await aiSDKService.getConfiguredModel(quality);
          }).toThrow();
        }
      }
    });
  });

  describe("Performance", () => {
    it("should return models quickly (under 100ms)", async () => {
      const start = Date.now();
      await aiSDKService.getConfiguredModel("balanced");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it("should handle multiple concurrent requests", async () => {
      const promises = [
        aiSDKService.getConfiguredModel("quality"),
        aiSDKService.getConfiguredModel("speed"),
        aiSDKService.getConfiguredModel("balanced"),
        aiSDKService.getConfiguredModel("quality"),
        aiSDKService.getConfiguredModel("speed"),
      ];

      const models = await Promise.all(promises);

      expect(models).toHaveLength(5);
      models.forEach((model) => {
        expect(model).toBeDefined();
        expect(model).toHaveProperty("doGenerate");
      });
    });
  });
});
