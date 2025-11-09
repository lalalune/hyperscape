/**
 * AI Playtester Swarm Orchestrator
 *
 * Coordinates multiple AI agents acting as synthetic players to test game content.
 * Generates automated bug reports, engagement predictions, and difficulty assessments.
 *
 * Features:
 * - Synthetic players with diverse playstyles
 * - Parallel testing across agent swarm
 * - Automated bug detection and reporting
 * - Engagement and difficulty prediction
 * - Statistical correlation with human player performance
 *
 * Research Sources:
 * - arxiv.org/html/2509.22170v1 (LLM Agents for Automated Video Game Testing)
 * - arxiv.org/html/2507.09490v1 (Towards LLM-Based Automatic Playtest)
 * - arxiv.org/abs/2410.02829 (LLMs as Game Difficulty Testers)
 * - EA's Adversarial Reinforcement Learning for Procedural Content Generation
 */

import { generateText } from "ai";
import { aiSDKService } from "./AISDKService";
import type {
  PlaytesterConfig,
  TestResult,
  BugReport,
  ActionableRecommendation,
  AggregatedMetrics,
  Recommendation,
} from "../utils/playtester-prompts";
import {
  makePlaytestPrompt,
  parseTestResult,
  generateRecommendations as generateActionableRecommendations,
} from "../utils/playtester-prompts";

interface TesterStats extends PlaytesterConfig {
  testsCompleted: number;
  bugsFound: number;
  averageEngagement: number;
}

interface OrchestratorConfig {
  parallelTests?: boolean;
  temperature?: number;
  model?: "quality" | "speed" | "balanced";
  maxTestResults?: number;
  maxBugReports?: number;
  requestTimeoutMs?: number;
}

interface SwarmPlaytestResult {
  testCount: number;
  individualResults: TestResult[];
  aggregatedMetrics: AggregatedMetrics;
  consensus: ConsensusResult;
  recommendations: ActionableRecommendation[];
}

interface ConsensusResult {
  recommendation: Recommendation;
  confidence: number;
  agreement: "strong" | "moderate";
  summary: string;
}

interface DedupedBugReport extends BugReport {
  reportCount: number;
  reporters: string[];
}

export class PlaytesterSwarmOrchestrator {
  private testers: Map<string, TesterStats>;
  private testResults: TestResult[];
  private aggregatedMetrics: {
    bugReports: DedupedBugReport[];
    difficultyAssessments: number[];
    engagementScores: number[];
    completionRates: number[];
  };
  private config: Required<OrchestratorConfig>;

  constructor(config: OrchestratorConfig = {}) {
    this.testers = new Map();
    this.testResults = [];
    this.aggregatedMetrics = {
      bugReports: [],
      difficultyAssessments: [],
      engagementScores: [],
      completionRates: [],
    };
    this.config = {
      parallelTests: config.parallelTests ?? true,
      temperature: config.temperature ?? 0.7,
      model: config.model ?? "quality",
      maxTestResults: config.maxTestResults ?? 100,
      maxBugReports: config.maxBugReports ?? 200,
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
    };

    console.log("[PlaytesterSwarmOrchestrator] Initialized", {
      maxTestResults: this.config.maxTestResults,
      maxBugReports: this.config.maxBugReports,
    });
  }

  /**
   * Register a playtester agent with specific persona
   */
  registerTester(testerConfig: PlaytesterConfig): void {
    this.testers.set(testerConfig.id, {
      ...testerConfig,
      testsCompleted: 0,
      bugsFound: 0,
      averageEngagement: 0,
    });
  }

  /**
   * Run swarm playtest on content
   */
  async runSwarmPlaytest(
    contentToTest: Record<string, unknown>,
    testConfig: Record<string, unknown> = {},
  ): Promise<SwarmPlaytestResult> {
    const testers = Array.from(this.testers.values());

    if (testers.length === 0) {
      throw new Error(
        "No testers registered. Add testers before running playtest.",
      );
    }

    console.log(
      `[PlaytesterSwarmOrchestrator] Running swarm playtest with ${testers.length} testers...`,
    );

    // Run tests in parallel or sequential based on config
    let results: (TestResult | null)[];
    if (this.config.parallelTests) {
      const testPromises = testers.map((tester) =>
        this.runSingleTest(tester, contentToTest, testConfig),
      );
      const settledResults = await Promise.allSettled(testPromises);
      results = settledResults
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<TestResult>).value);
    } else {
      results = await this.runSequentialTests(
        testers,
        contentToTest,
        testConfig,
      );
    }

    // Process results - filter out null values
    const successfulTests = results.filter((r): r is TestResult => r !== null);

    // Aggregate metrics
    const aggregated = this.aggregateTestResults(successfulTests);

    // Update tester stats
    for (const result of successfulTests) {
      const tester = this.testers.get(result.testerId);
      if (tester) {
        tester.testsCompleted++;
        tester.bugsFound += result.bugs.length;
        tester.averageEngagement =
          (tester.averageEngagement * (tester.testsCompleted - 1) +
            result.engagement) /
          tester.testsCompleted;
      }
    }

    return {
      testCount: successfulTests.length,
      individualResults: successfulTests,
      aggregatedMetrics: aggregated,
      consensus: this.buildConsensus(successfulTests),
      recommendations: generateActionableRecommendations(aggregated),
    };
  }

  /**
   * Run test with a single tester agent
   */
  async runSingleTest(
    tester: TesterStats,
    content: Record<string, unknown>,
    testConfig: Record<string, unknown>,
  ): Promise<TestResult> {
    console.log(`[${tester.name}] Starting playtest...`);

    const testPrompt = makePlaytestPrompt(tester, content, testConfig);

    try {
      const model = await aiSDKService.getConfiguredModel(this.config.model);

      // Create timeout promise
      const timeoutMs = this.config.requestTimeoutMs;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Request timeout after ${timeoutMs}ms`)),
          timeoutMs,
        );
      });

      // Race between generation and timeout
      const response = await Promise.race([
        generateText({
          model,
          prompt: testPrompt,
          temperature: this.config.temperature,
        }),
        timeoutPromise,
      ]);

      // Parse test results from response
      const testResult = parseTestResult(response.text, tester);

      console.log(
        `[${tester.name}] Completed. Found ${testResult.bugs.length} issues, engagement: ${testResult.engagement}/10`,
      );

      return testResult;
    } catch (error) {
      console.error(`[${tester.name}] Test failed:`, error);
      return {
        testerId: tester.id,
        testerName: tester.name,
        archetype: tester.archetype,
        knowledgeLevel: tester.knowledgeLevel,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        bugs: [],
        engagement: 0,
        difficulty: 0,
        completed: false,
        playthrough: "",
        pacing: "unknown",
        confusionPoints: [],
        feedback: `Test failed: ${error instanceof Error ? error.message : String(error)}`,
        recommendation: "fail",
        rawResponse: "",
      };
    }
  }

  /**
   * Run tests sequentially (for testing or low resource environments)
   */
  async runSequentialTests(
    testers: TesterStats[],
    content: Record<string, unknown>,
    testConfig: Record<string, unknown>,
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const tester of testers) {
      const result = await this.runSingleTest(tester, content, testConfig);
      results.push(result);
    }

    return results;
  }

  /**
   * Aggregate results from multiple testers
   */
  aggregateTestResults(results: TestResult[]): AggregatedMetrics {
    const aggregated: AggregatedMetrics = {
      totalTests: results.length,
      completionRate: 0,
      averageDifficulty: 0,
      difficultyByLevel: {},
      averageEngagement: 0,
      engagementByArchetype: {},
      pacing: { too_fast: 0, just_right: 0, too_slow: 0, unknown: 0 },
      bugReports: [],
      uniqueBugs: 0,
      criticalBugs: 0,
      majorBugs: 0,
      minorBugs: 0,
      confusionPoints: [],
      recommendations: { pass: 0, pass_with_changes: 0, fail: 0 },
    };

    if (results.length === 0) {
      return aggregated;
    }

    // Calculate completion rate
    const completed = results.filter((r) => r.completed).length;
    aggregated.completionRate = (completed / results.length) * 100;

    // Calculate average difficulty
    const difficulties = results.map((r) => r.difficulty).filter((d) => d > 0);
    aggregated.averageDifficulty =
      difficulties.length > 0
        ? difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length
        : 0;

    // Difficulty by knowledge level
    const difficultyByLevelTemp: Record<string, number[]> = {};
    for (const result of results) {
      if (!difficultyByLevelTemp[result.knowledgeLevel]) {
        difficultyByLevelTemp[result.knowledgeLevel] = [];
      }
      difficultyByLevelTemp[result.knowledgeLevel]!.push(result.difficulty);
    }

    for (const level in difficultyByLevelTemp) {
      const scores = difficultyByLevelTemp[level]!;
      aggregated.difficultyByLevel[level] = {
        average: scores.reduce((sum, s) => sum + s, 0) / scores.length,
        count: scores.length,
      };
    }

    // Calculate average engagement
    const engagements = results.map((r) => r.engagement).filter((e) => e > 0);
    aggregated.averageEngagement =
      engagements.length > 0
        ? engagements.reduce((sum, e) => sum + e, 0) / engagements.length
        : 0;

    // Engagement by archetype
    const engagementByArchetypeTemp: Record<string, number[]> = {};
    for (const result of results) {
      if (!engagementByArchetypeTemp[result.archetype]) {
        engagementByArchetypeTemp[result.archetype] = [];
      }
      engagementByArchetypeTemp[result.archetype]!.push(result.engagement);
    }

    for (const archetype in engagementByArchetypeTemp) {
      const scores = engagementByArchetypeTemp[archetype]!;
      aggregated.engagementByArchetype[archetype] = {
        average: scores.reduce((sum, s) => sum + s, 0) / scores.length,
        count: scores.length,
      };
    }

    // Aggregate pacing
    for (const result of results) {
      if (result.pacing in aggregated.pacing) {
        aggregated.pacing[result.pacing]++;
      }
    }

    // Collect all bugs
    const allBugs: BugReport[] = [];
    for (const result of results) {
      for (const bug of result.bugs) {
        allBugs.push(bug);

        // Count by severity
        if (bug.severity === "critical") aggregated.criticalBugs++;
        else if (bug.severity === "major") aggregated.majorBugs++;
        else aggregated.minorBugs++;
      }
    }

    // Deduplicate similar bugs
    aggregated.bugReports = this.deduplicateBugs(allBugs);
    aggregated.uniqueBugs = aggregated.bugReports.length;

    // Collect confusion points
    for (const result of results) {
      aggregated.confusionPoints.push(...result.confusionPoints);
    }

    // Aggregate recommendations
    for (const result of results) {
      aggregated.recommendations[result.recommendation]++;
    }

    return aggregated;
  }

  /**
   * Deduplicate similar bug reports
   */
  deduplicateBugs(bugs: BugReport[]): DedupedBugReport[] {
    const unique: DedupedBugReport[] = [];
    const seen = new Set<string>();

    for (const bug of bugs) {
      // Simple deduplication: lowercase first 50 chars
      const key = bug.description.toLowerCase().slice(0, 50);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push({
          ...bug,
          reportCount: 1,
          reporters: [bug.reporter],
        });
      } else {
        // Find existing bug and increment count
        const existing = unique.find(
          (b) => b.description.toLowerCase().slice(0, 50) === key,
        );
        if (existing) {
          existing.reportCount++;
          if (!existing.reporters.includes(bug.reporter)) {
            existing.reporters.push(bug.reporter);
          }
          // Upgrade severity if higher
          const severityOrder = { critical: 3, major: 2, minor: 1 };
          if (severityOrder[bug.severity] > severityOrder[existing.severity]) {
            existing.severity = bug.severity;
          }
        }
      }
    }

    // Sort by report count (most reported first) then severity
    unique.sort((a, b) => {
      if (b.reportCount !== a.reportCount) {
        return b.reportCount - a.reportCount;
      }
      const severityOrder = { critical: 3, major: 2, minor: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    return unique;
  }

  /**
   * Build consensus summary from test results
   */
  buildConsensus(results: TestResult[]): ConsensusResult {
    const totalTesters = results.length;
    const passRate =
      results.filter((r) => r.recommendation === "pass").length / totalTesters;
    const failRate =
      results.filter((r) => r.recommendation === "fail").length / totalTesters;

    let consensusRecommendation: Recommendation = "pass_with_changes";
    if (passRate >= 0.7) consensusRecommendation = "pass";
    else if (failRate >= 0.5) consensusRecommendation = "fail";

    return {
      recommendation: consensusRecommendation,
      confidence: Math.max(passRate, failRate),
      agreement: passRate >= 0.7 || failRate >= 0.5 ? "strong" : "moderate",
      summary: this.generateConsensusSummary(results, consensusRecommendation),
    };
  }

  /**
   * Generate natural language consensus summary
   */
  generateConsensusSummary(
    results: TestResult[],
    recommendation: Recommendation,
  ): string {
    const totalTesters = results.length;
    const completed = results.filter((r) => r.completed).length;
    const avgDifficulty =
      results.reduce((sum, r) => sum + r.difficulty, 0) / totalTesters;
    const avgEngagement =
      results.reduce((sum, r) => sum + r.engagement, 0) / totalTesters;
    const totalBugs = results.reduce((sum, r) => sum + r.bugs.length, 0);

    return (
      `${totalTesters} AI playtesters evaluated this content. ` +
      `${completed} of ${totalTesters} completed it successfully. ` +
      `Average difficulty was ${avgDifficulty.toFixed(1)}/10, ` +
      `engagement was ${avgEngagement.toFixed(1)}/10. ` +
      `${totalBugs} potential issues were reported. ` +
      `Overall recommendation: ${recommendation.toUpperCase().replace("_", " ")}.`
    );
  }

  /**
   * Get orchestrator statistics
   */
  getStats() {
    const testers = Array.from(this.testers.values());

    return {
      testerCount: testers.length,
      totalTestsRun: testers.reduce((sum, t) => sum + t.testsCompleted, 0),
      totalBugsFound: testers.reduce((sum, t) => sum + t.bugsFound, 0),
      testerBreakdown: testers.map((t) => ({
        name: t.name,
        archetype: t.archetype,
        knowledgeLevel: t.knowledgeLevel,
        testsCompleted: t.testsCompleted,
        bugsFound: t.bugsFound,
        averageEngagement: t.averageEngagement.toFixed(1),
      })),
    };
  }

  /**
   * Reset orchestrator state
   */
  reset(): void {
    this.testResults = [];
    this.aggregatedMetrics = {
      bugReports: [],
      difficultyAssessments: [],
      engagementScores: [],
      completionRates: [],
    };

    // Reset tester stats
    for (const tester of this.testers.values()) {
      tester.testsCompleted = 0;
      tester.bugsFound = 0;
      tester.averageEngagement = 0;
    }
  }

  /**
   * Gracefully shutdown and cleanup resources
   */
  destroy(): void {
    // Clear all memory
    this.testResults = [];
    this.aggregatedMetrics = {
      bugReports: [],
      difficultyAssessments: [],
      engagementScores: [],
      completionRates: [],
    };
    this.testers.clear();

    console.log(
      "[PlaytesterSwarmOrchestrator] Destroyed and resources cleaned up",
    );
  }
}
