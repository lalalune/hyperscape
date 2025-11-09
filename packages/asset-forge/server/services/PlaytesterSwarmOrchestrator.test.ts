/**
 * PlaytesterSwarmOrchestrator Tests
 * Comprehensive tests for AI playtester swarm orchestration
 * Uses MockLanguageModelV2 for deterministic testing without API calls
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { PlaytesterSwarmOrchestrator } from "./PlaytesterSwarmOrchestrator";
import type { PlaytesterConfig } from "../utils/playtester-prompts";
import { MockLanguageModelV2 } from "ai/test";
import { aiSDKService } from "./AISDKService";

describe("PlaytesterSwarmOrchestrator", () => {
  let orchestrator: PlaytesterSwarmOrchestrator;

  // Test content for playtesting
  const sampleQuest = {
    title: "The Lost Artifact",
    description: "Find the ancient artifact in the ruins",
    objectives: [
      { type: "travel", description: "Go to the Ancient Ruins" },
      {
        type: "explore",
        description: "Search for the artifact in the main chamber",
      },
      { type: "combat", description: "Defeat the guardian" },
      { type: "acquire", description: "Take the artifact" },
    ],
    rewards: {
      experience: 100,
      gold: 50,
      items: ["Ancient Sword"],
    },
  };

  // Default test tester configurations
  const testTesters: PlaytesterConfig[] = [
    {
      id: "test-completionist",
      name: "Test Completionist",
      archetype: "completionist",
      knowledgeLevel: "expert",
      personality: "Thorough and detail-oriented",
      expectations: ["All content accessible", "No dead ends"],
    },
    {
      id: "test-casual",
      name: "Test Casual",
      archetype: "casual",
      knowledgeLevel: "beginner",
      personality: "Relaxed and needs guidance",
      expectations: ["Clear instructions", "Forgiving mechanics"],
    },
  ];

  // Mock response that parses correctly
  const mockSuccessfulTestResponse = `
## Playthrough
I started the quest and traveled to the Ancient Ruins. The location was easy to find.
I explored the main chamber and found the artifact after some searching.
I defeated the guardian in combat and successfully acquired the artifact.

## Completion Status
**Completed:** Yes

## Difficulty Rating
**Difficulty:** 5/10

## Engagement Rating
**Engagement:** 7/10

## Pacing Assessment
**Pacing:** just_right

## Bugs Found
1. [MINOR] The guardian's health bar sometimes doesn't update correctly
2. [MAJOR] Quest marker disappears after entering the ruins

## Confusion Points
- Unclear where exactly to search in the main chamber
- Guardian combat mechanics not well explained

## Overall Feedback
The quest was enjoyable and well-balanced. The rewards feel appropriate for the difficulty level.

## Recommendation
**Recommendation:** pass_with_changes
`.trim();

  beforeEach(() => {
    // Create fresh orchestrator for each test
    orchestrator = new PlaytesterSwarmOrchestrator({
      parallelTests: false, // Sequential for testing consistency
      temperature: 0.7,
      model: "quality",
      requestTimeoutMs: 30000,
    });
  });

  describe("Constructor", () => {
    it("should initialize with default config", () => {
      const defaultOrchestrator = new PlaytesterSwarmOrchestrator();
      const stats = defaultOrchestrator.getStats();

      expect(stats.testerCount).toBe(0);
      expect(stats.totalTestsRun).toBe(0);
    });

    it("should initialize with custom config", () => {
      const customOrchestrator = new PlaytesterSwarmOrchestrator({
        parallelTests: true,
        temperature: 0.5,
        model: "speed",
        requestTimeoutMs: 10000,
      });

      const stats = customOrchestrator.getStats();
      expect(stats.testerCount).toBe(0);
    });
  });

  describe("registerTester", () => {
    it("should register a tester successfully", () => {
      orchestrator.registerTester(testTesters[0]);

      const stats = orchestrator.getStats();
      expect(stats.testerCount).toBe(1);
      expect(stats.testerBreakdown[0].name).toBe("Test Completionist");
      expect(stats.testerBreakdown[0].archetype).toBe("completionist");
    });

    it("should register multiple testers", () => {
      testTesters.forEach((tester) => orchestrator.registerTester(tester));

      const stats = orchestrator.getStats();
      expect(stats.testerCount).toBe(2);
    });

    it("should track tester stats correctly", () => {
      orchestrator.registerTester(testTesters[0]);

      const stats = orchestrator.getStats();
      expect(stats.testerBreakdown[0].testsCompleted).toBe(0);
      expect(stats.testerBreakdown[0].bugsFound).toBe(0);
      expect(stats.testerBreakdown[0].averageEngagement).toBe("0.0");
    });
  });

  describe("getStats", () => {
    it("should return empty stats when no testers registered", () => {
      const stats = orchestrator.getStats();

      expect(stats.testerCount).toBe(0);
      expect(stats.totalTestsRun).toBe(0);
      expect(stats.totalBugsFound).toBe(0);
      expect(stats.testerBreakdown).toHaveLength(0);
    });

    it("should return correct breakdown for registered testers", () => {
      testTesters.forEach((tester) => orchestrator.registerTester(tester));

      const stats = orchestrator.getStats();
      expect(stats.testerCount).toBe(2);
      expect(stats.testerBreakdown).toHaveLength(2);
      expect(stats.testerBreakdown[0].knowledgeLevel).toBe("expert");
      expect(stats.testerBreakdown[1].knowledgeLevel).toBe("beginner");
    });
  });

  describe("reset", () => {
    it("should reset tester stats", () => {
      testTesters.forEach((tester) => orchestrator.registerTester(tester));

      // Reset
      orchestrator.reset();

      const stats = orchestrator.getStats();
      // Testers still registered, but stats reset
      expect(stats.testerCount).toBe(2);
      expect(stats.totalTestsRun).toBe(0);
      expect(stats.totalBugsFound).toBe(0);
    });
  });

  describe("runSwarmPlaytest", () => {
    it("should throw error when no testers registered", async () => {
      expect(async () => {
        await orchestrator.runSwarmPlaytest(sampleQuest);
      }).toThrow("No testers registered");
    });

    it("should run playtest with mocked AI responses", async () => {
      // Mock the getConfiguredModel to return a mock model
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [
            { type: "text" as const, text: mockSuccessfulTestResponse },
          ],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      // Mock aiSDKService.getConfiguredModel
      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        orchestrator.registerTester(testTesters[0]);

        const result = await orchestrator.runSwarmPlaytest(sampleQuest);

        expect(result.testCount).toBe(1);
        expect(result.individualResults).toHaveLength(1);
        expect(result.individualResults[0].success).toBe(true);
        expect(result.individualResults[0].completed).toBe(true);
        expect(result.individualResults[0].bugs.length).toBeGreaterThan(0);
        expect(result.aggregatedMetrics.totalTests).toBe(1);
        expect(result.consensus.recommendation).toMatch(
          /pass|pass_with_changes|fail/,
        );
      } finally {
        // Restore original method
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should aggregate metrics correctly with multiple testers", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [
            { type: "text" as const, text: mockSuccessfulTestResponse },
          ],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        testTesters.forEach((tester) => orchestrator.registerTester(tester));

        const result = await orchestrator.runSwarmPlaytest(sampleQuest);

        const metrics = result.aggregatedMetrics;
        expect(metrics.totalTests).toBe(2);
        expect(metrics.completionRate).toBeGreaterThanOrEqual(0);
        expect(metrics.completionRate).toBeLessThanOrEqual(100);
        expect(metrics.averageDifficulty).toBeGreaterThanOrEqual(0);
        expect(metrics.averageDifficulty).toBeLessThanOrEqual(10);
        expect(metrics.averageEngagement).toBeGreaterThanOrEqual(0);
        expect(metrics.averageEngagement).toBeLessThanOrEqual(10);
        expect(metrics.bugReports.length).toBeGreaterThan(0);
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should provide actionable recommendations", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [
            { type: "text" as const, text: mockSuccessfulTestResponse },
          ],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        orchestrator.registerTester(testTesters[0]);

        const result = await orchestrator.runSwarmPlaytest(sampleQuest);

        expect(result.recommendations.length).toBeGreaterThan(0);

        const firstRec = result.recommendations[0];
        expect(firstRec.priority).toMatch(/critical|high|medium|low|info/);
        expect(firstRec.category).toMatch(
          /bugs|completion|difficulty|engagement|pacing|quality/,
        );
        expect(firstRec.message).toBeDefined();
        expect(firstRec.action).toBeDefined();
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should build consensus from multiple testers", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [
            { type: "text" as const, text: mockSuccessfulTestResponse },
          ],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        testTesters.forEach((tester) => orchestrator.registerTester(tester));

        const result = await orchestrator.runSwarmPlaytest(sampleQuest);

        expect(result.consensus.recommendation).toMatch(
          /pass|pass_with_changes|fail/,
        );
        expect(result.consensus.confidence).toBeGreaterThanOrEqual(0);
        expect(result.consensus.confidence).toBeLessThanOrEqual(1);
        expect(result.consensus.agreement).toMatch(/strong|moderate/);
        expect(result.consensus.summary).toBeDefined();
        expect(result.consensus.summary.length).toBeGreaterThan(0);
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle AI errors gracefully", async () => {
      // Mock with error
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw new Error("AI API Error");
        },
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        orchestrator.registerTester(testTesters[0]);

        const result = await orchestrator.runSwarmPlaytest(sampleQuest);

        // Should have results even if they failed
        expect(result.individualResults).toHaveLength(1);
        const testResult = result.individualResults[0];
        expect(testResult.success).toBe(false);
        expect(testResult.error).toBeDefined();
        expect(testResult.error).toContain("AI API Error");
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });

    it("should handle timeout errors", async () => {
      // Create orchestrator with very short timeout
      const timeoutOrchestrator = new PlaytesterSwarmOrchestrator({
        requestTimeoutMs: 1, // 1ms timeout
        parallelTests: false,
      });

      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          // Simulate slow response
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {
            content: [{ type: "text" as const, text: "response" }],
            finishReason: "stop" as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            warnings: [],
          };
        },
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        timeoutOrchestrator.registerTester(testTesters[0]);

        const result = await timeoutOrchestrator.runSwarmPlaytest(sampleQuest);

        expect(result.individualResults).toHaveLength(1);
        const testResult = result.individualResults[0];
        expect(testResult.success).toBe(false);
        expect(testResult.error).toContain("timeout");
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });
  });

  describe("Stats Tracking", () => {
    it("should update tester stats after playtest", async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [
            { type: "text" as const, text: mockSuccessfulTestResponse },
          ],
          finishReason: "stop" as const,
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          warnings: [],
        }),
      });

      const originalGetModel = aiSDKService.getConfiguredModel;
      aiSDKService.getConfiguredModel = mock(async () => mockModel);

      try {
        orchestrator.registerTester(testTesters[0]);

        const statsBefore = orchestrator.getStats();
        expect(statsBefore.totalTestsRun).toBe(0);

        await orchestrator.runSwarmPlaytest(sampleQuest);

        const statsAfter = orchestrator.getStats();
        expect(statsAfter.totalTestsRun).toBe(1);
        expect(statsAfter.testerBreakdown[0].testsCompleted).toBe(1);
        expect(statsAfter.totalBugsFound).toBeGreaterThan(0);
      } finally {
        aiSDKService.getConfiguredModel = originalGetModel;
      }
    });
  });
});
