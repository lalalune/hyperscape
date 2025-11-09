/**
 * Generation Routes Tests
 * Tests for generation pipeline endpoints
 *
 * NOTE: These tests use mocked GenerationService as the actual service
 * requires external API calls (Meshy, OpenAI) which should not be called in tests.
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { Elysia } from "elysia";
import { createGenerationRoutes } from "./generation";

// Mock GenerationService
const mockGenerationService = {
  startPipeline: async (config: any) => {
    return {
      pipelineId: "test-pipeline-123",
      status: "initiated",
      message: "Pipeline started successfully",
    };
  },
  getPipelineStatus: async (pipelineId: string) => {
    if (pipelineId === "non-existent") {
      throw new Error("Pipeline not found");
    }
    return {
      id: pipelineId,
      status: "processing",
      progress: 50,
      stages: {},
      results: {},
      createdAt: new Date().toISOString(),
    };
  },
};

describe("Generation Routes", () => {
  let app: Elysia;

  beforeAll(() => {
    app = new Elysia().use(
      createGenerationRoutes(mockGenerationService as any),
    );
  });

  describe("POST /api/generation/pipeline", () => {
    it("should start generation pipeline with valid config", async () => {
      const config = {
        description: "Test asset generation",
        assetId: "test-asset-123",
        name: "Test Asset",
        type: "weapon",
        subtype: "sword",
      };

      const response = await app.handle(
        new Request("http://localhost/api/generation/pipeline", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.pipelineId).toBeDefined();
      expect(data.status).toBeDefined();
      expect(data.message).toBeDefined();
    });

    it("should reject empty description", async () => {
      const config = {
        description: "",
        assetId: "test-asset",
        name: "Test",
        type: "weapon",
        subtype: "sword",
      };

      const response = await app.handle(
        new Request("http://localhost/api/generation/pipeline", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject missing required fields", async () => {
      const config = {
        description: "Test",
        // Missing other required fields
      };

      const response = await app.handle(
        new Request("http://localhost/api/generation/pipeline", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should work without authentication (optional auth)", async () => {
      const config = {
        description: "Public test",
        assetId: "test-asset",
        name: "Test",
        type: "weapon",
        subtype: "sword",
      };

      const response = await app.handle(
        new Request("http://localhost/api/generation/pipeline", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/generation/pipeline/:pipelineId", () => {
    it("should return pipeline status", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/generation/pipeline/test-pipeline-123",
        ),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe("test-pipeline-123");
      expect(data.status).toBeDefined();
      expect(data.progress).toBeDefined();
    });

    it("should handle non-existent pipeline", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/generation/pipeline/non-existent"),
      );

      // Should return error status
      expect([404, 500]).toContain(response.status);
    });

    it("should work without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/generation/pipeline/test-pipeline"),
      );

      // No 401 error expected
      expect(response.status).not.toBe(401);
    });
  });
});
