/**
 * Playtester Swarm Routes Tests
 * Tests for AI playtester orchestration endpoints
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";
import { playtesterSwarmRoutes } from "./playtester-swarm";
import { MockLanguageModelV2 } from "ai/test";
import { aiSDKService } from "../services/AISDKService";

describe("Playtester Swarm Routes", () => {
  let app: Elysia;

  // Mock successful AI response
  const mockSuccessfulResponse = `
## Playthrough
Completed the quest successfully. Found the artifact and defeated the guardian.

## Completion Status
**Completed:** Yes

## Difficulty Rating
**Difficulty:** 6/10

## Engagement Rating
**Engagement:** 8/10

## Pacing Assessment
**Pacing:** just_right

## Bugs Found
1. [MINOR] Quest marker glitch
2. [MAJOR] Combat balance issue

## Confusion Points
- Unclear objective marker

## Overall Feedback
Enjoyable quest with good pacing.

## Recommendation
**Recommendation:** pass_with_changes
`.trim();

  beforeEach(() => {
    app = new Elysia().use(playtesterSwarmRoutes);
  });

  describe("GET /api/playtester-swarm", () => {
    it("should return available personas", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/playtester-swarm"),
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("availablePersonas");
      expect(data).toHaveProperty("personas");
      expect(data).toHaveProperty("defaultSwarm");
      expect(data).toHaveProperty("description");
      expect(Array.isArray(data.availablePersonas)).toBe(true);
      expect(Array.isArray(data.defaultSwarm)).toBe(true);
    });

    it("should include all predefined personas", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/playtester-swarm"),
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      const expectedPersonas = [
        "completionist",
        "speedrunner",
        "explorer",
        "casual",
        "minmaxer",
        "roleplayer",
        "breaker",
      ];

      for (const persona of expectedPersonas) {
        expect(data.availablePersonas).toContain(persona);
        expect(data.personas).toHaveProperty(persona);
      }
    });

    it("should provide persona details", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/playtester-swarm"),
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      const completionist = data.personas.completionist;
      expect(completionist).toHaveProperty("name");
      expect(completionist).toHaveProperty("personality");
      expect(completionist).toHaveProperty("expectations");
      expect(Array.isArray(completionist.expectations)).toBe(true);
    });
  });

  describe("POST /api/playtester-swarm", () => {
    it("should run playtester swarm with valid config", async () => {
      // Mock AI SDK
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: "text" as const, text: mockSuccessfulResponse }],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        const request = {
          contentToTest: {
            title: "Test Quest",
            description: "Find the artifact",
            objectives: [{ type: "explore", description: "Search ruins" }],
          },
          contentType: "quest" as const,
          testerProfiles: ["completionist", "casual"],
        };

        const response = await app.handle(
          new Request("http://localhost/api/playtester-swarm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data).toHaveProperty("sessionId");
        expect(data).toHaveProperty("contentType");
        expect(data).toHaveProperty("testCount");
        expect(data).toHaveProperty("consensus");
        expect(data).toHaveProperty("aggregatedMetrics");
        expect(data).toHaveProperty("individualResults");
        expect(data).toHaveProperty("recommendations");
        expect(data).toHaveProperty("report");
        expect(data).toHaveProperty("stats");
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should use default testers when none specified", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: "text" as const, text: mockSuccessfulResponse }],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        const request = {
          contentToTest: {
            title: "Test Quest",
          },
          contentType: "quest" as const,
        };

        const response = await app.handle(
          new Request("http://localhost/api/playtester-swarm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.testCount).toBe(5); // Default 5 testers
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should support custom tester profiles", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: "text" as const, text: mockSuccessfulResponse }],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        const request = {
          contentToTest: {
            title: "Test Content",
          },
          contentType: "dialogue" as const,
          testerProfiles: [
            {
              name: "Custom Tester",
              personality: "Analytical and critical",
              expectations: ["Clear dialogue", "No plot holes"],
            },
          ],
        };

        const response = await app.handle(
          new Request("http://localhost/api/playtester-swarm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          }),
        );

        expect(response.status).toBe(200);
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should support all content types", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: "text" as const, text: mockSuccessfulResponse }],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        const contentTypes = ["quest", "dialogue", "npc", "combat", "puzzle"];

        for (const contentType of contentTypes) {
          const request = {
            contentToTest: { title: "Test" },
            contentType: contentType as any,
            testerProfiles: ["casual"],
          };

          const response = await app.handle(
            new Request("http://localhost/api/playtester-swarm", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(request),
            }),
          );

          expect(response.status).toBe(200);
        }
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should support test configuration options", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: "text" as const, text: mockSuccessfulResponse }],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        const request = {
          contentToTest: { title: "Test" },
          contentType: "quest" as const,
          testerProfiles: ["casual"],
          testConfig: {
            parallel: false,
            temperature: 0.5,
          },
        };

        const response = await app.handle(
          new Request("http://localhost/api/playtester-swarm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.metadata.parallel).toBe(false);
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should support custom model selection", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: "text" as const, text: mockSuccessfulResponse }],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        const request = {
          contentToTest: { title: "Test" },
          contentType: "quest" as const,
          testerProfiles: ["casual"],
          model: "speed",
        };

        const response = await app.handle(
          new Request("http://localhost/api/playtester-swarm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          }),
        );

        expect(response.status).toBe(200);
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should reject more than 10 tester profiles", async () => {
      const request = {
        contentToTest: { title: "Test" },
        contentType: "quest" as const,
        testerProfiles: Array(11).fill("casual"),
      };

      const response = await app.handle(
        new Request("http://localhost/api/playtester-swarm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("must not exceed 10");
    });

    it("should reject invalid persona names", async () => {
      const request = {
        contentToTest: { title: "Test" },
        contentType: "quest" as const,
        testerProfiles: ["invalid-persona-name"],
      };

      const response = await app.handle(
        new Request("http://localhost/api/playtester-swarm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Invalid tester profile");
    });

    it("should reject invalid content type", async () => {
      const request = {
        contentToTest: { title: "Test" },
        contentType: "invalid-type" as any,
      };

      const response = await app.handle(
        new Request("http://localhost/api/playtester-swarm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject missing contentToTest", async () => {
      const request = {
        contentType: "quest" as const,
      };

      const response = await app.handle(
        new Request("http://localhost/api/playtester-swarm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject missing contentType", async () => {
      const request = {
        contentToTest: { title: "Test" },
      };

      const response = await app.handle(
        new Request("http://localhost/api/playtester-swarm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should handle AI generation errors gracefully", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw new Error("AI API error");
        },
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        const request = {
          contentToTest: { title: "Test" },
          contentType: "quest" as const,
          testerProfiles: ["casual"],
        };

        const response = await app.handle(
          new Request("http://localhost/api/playtester-swarm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          }),
        );

        // Should still return results with error info
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.individualResults.length).toBeGreaterThan(0);
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should handle malformed JSON", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/playtester-swarm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{invalid json",
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Response Structure", () => {
    it("should include session ID in response", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: "text" as const, text: mockSuccessfulResponse }],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        const request = {
          contentToTest: { title: "Test" },
          contentType: "quest" as const,
          testerProfiles: ["casual"],
        };

        const response = await app.handle(
          new Request("http://localhost/api/playtester-swarm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.sessionId).toMatch(/^playtest_/);
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should include comprehensive test report", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: "text" as const, text: mockSuccessfulResponse }],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        const request = {
          contentToTest: { title: "Test" },
          contentType: "quest" as const,
          testerProfiles: ["casual"],
        };

        const response = await app.handle(
          new Request("http://localhost/api/playtester-swarm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.report).toHaveProperty("summary");
        expect(data.report).toHaveProperty("qualityMetrics");
        expect(data.report).toHaveProperty("issues");
        expect(data.report).toHaveProperty("playerFeedback");
        expect(data.report).toHaveProperty("recommendations");
        expect(data.report).toHaveProperty("testingDetails");
        expect(data.report.summary).toHaveProperty("grade");
        expect(data.report.summary).toHaveProperty("recommendation");
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should include orchestrator stats", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: "text" as const, text: mockSuccessfulResponse }],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        const request = {
          contentToTest: { title: "Test" },
          contentType: "quest" as const,
          testerProfiles: ["casual", "completionist"],
        };

        const response = await app.handle(
          new Request("http://localhost/api/playtester-swarm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.stats).toHaveProperty("testerCount");
        expect(data.stats).toHaveProperty("totalTestsRun");
        expect(data.stats.testerCount).toBe(2);
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty contentToTest object", async () => {
      const request = {
        contentToTest: {},
        contentType: "quest" as const,
        testerProfiles: ["casual"],
      };

      const response = await app.handle(
        new Request("http://localhost/api/playtester-swarm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        }),
      );

      // Should accept empty object (validation happens in orchestrator)
      expect([200, 400, 500]).toContain(response.status);
    });

    it("should handle very large contentToTest", async () => {
      const largeContent = {
        title: "Large Quest",
        objectives: Array(100).fill({
          type: "explore",
          description: "x".repeat(1000),
        }),
      };

      const request = {
        contentToTest: largeContent,
        contentType: "quest" as const,
        testerProfiles: ["casual"],
      };

      const response = await app.handle(
        new Request("http://localhost/api/playtester-swarm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        }),
      );

      // Should handle or reject based on size
      expect([200, 400, 413, 500]).toContain(response.status);
    });

    it("should handle mixed tester profile types", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: "text" as const, text: mockSuccessfulResponse }],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        const request = {
          contentToTest: { title: "Test" },
          contentType: "quest" as const,
          testerProfiles: [
            "casual",
            {
              name: "Custom",
              personality: "Test",
            },
            "completionist",
          ],
        };

        const response = await app.handle(
          new Request("http://localhost/api/playtester-swarm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          }),
        );

        expect(response.status).toBe(200);
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });
  });
});
