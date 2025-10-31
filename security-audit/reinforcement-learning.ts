/**
 * Reinforcement Learning Framework
 * Adapts team strategies based on performance metrics
 */

import { TeamStrategy, BugReport, BugSeverity, BugCategory, TeamPerformance, ReinforcementLearningState } from './types';

export class ReinforcementLearning {
  private learningStates: Map<string, ReinforcementLearningState> = new Map();

  /**
   * Initialize learning state for a team
   */
  initializeTeam(teamId: string): void {
    this.learningStates.set(teamId, {
      successfulPatterns: new Map(),
      unsuccessfulPatterns: new Map(),
      rewardHistory: [],
      strategyAdjustments: 0
    });
  }

  /**
   * Calculate reward for a bug report
   */
  calculateReward(report: BugReport): number {
    let reward = 0;

    // Base reward from bounty value
    reward += report.bountyValue / 100; // Scale to 0-150 range

    // Bonus for severity
    const severityBonus = {
      [BugSeverity.CRITICAL]: 100,
      [BugSeverity.HIGH]: 50,
      [BugSeverity.MEDIUM]: 25,
      [BugSeverity.LOW]: 10,
      [BugSeverity.INFO]: 5
    };
    reward += severityBonus[report.severity];

    // Bonus for uniqueness
    if (report.isUnique) {
      reward += 50;
    }

    // Penalty for false positives
    if (report.isFalsePositive) {
      reward -= 100;
    }

    // Bonus for fast discovery
    if (report.timeToDiscover < 1000) {
      reward += 20;
    } else if (report.timeToDiscover < 5000) {
      reward += 10;
    }

    // CVSS score multiplier
    reward = reward * (1 + report.cvssScore.baseScore / 10);

    return Math.round(reward);
  }

  /**
   * Update learning state based on bug reports
   */
  updateFromReports(teamId: string, reports: BugReport[]): void {
    const state = this.learningStates.get(teamId);
    if (!state) return;

    for (const report of reports) {
      const reward = this.calculateReward(report);
      state.rewardHistory.push(reward);

      const pattern = `${report.category}-${report.discoveryMethod}`;

      if (report.isValid && !report.isFalsePositive) {
        // Successful pattern
        const current = state.successfulPatterns.get(pattern) || 0;
        state.successfulPatterns.set(pattern, current + reward);
      } else {
        // Unsuccessful pattern
        const current = state.unsuccessfulPatterns.get(pattern) || 0;
        state.unsuccessfulPatterns.set(pattern, current + 1);
      }
    }
  }

  /**
   * Adapt strategy based on learning
   */
  adaptStrategy(teamId: string, currentStrategy: TeamStrategy, performance: TeamPerformance): TeamStrategy {
    const state = this.learningStates.get(teamId);
    if (!state) return currentStrategy;

    const newStrategy = { ...currentStrategy };

    // Adjust exploration vs exploitation
    const avgReward = state.rewardHistory.reduce((a, b) => a + b, 0) / Math.max(1, state.rewardHistory.length);

    if (avgReward < 50) {
      // Low rewards - increase exploration
      newStrategy.explorationRate = Math.min(0.9, currentStrategy.explorationRate + 0.1);
    } else if (avgReward > 100) {
      // High rewards - increase exploitation
      newStrategy.explorationRate = Math.max(0.1, currentStrategy.explorationRate - 0.1);
    }

    // Adjust learning rate based on strategy stability
    if (state.strategyAdjustments > 5 && avgReward < 30) {
      // Too many adjustments without improvement - slow down learning
      newStrategy.learningRate = Math.max(0.01, currentStrategy.learningRate * 0.8);
    } else if (avgReward > 80) {
      // Good performance - can learn faster
      newStrategy.learningRate = Math.min(0.5, currentStrategy.learningRate * 1.2);
    }

    // Focus on successful categories
    const categoryScores = this.calculateCategoryScores(state);
    const topCategories = Array.from(categoryScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);

    if (topCategories.length > 0) {
      newStrategy.focusAreas = topCategories;
    }

    // Adjust scan depth based on false positive rate
    if (performance.falsePositiveRate > 0.5) {
      // Too many false positives - go deeper
      newStrategy.scanDepth = 'DEEP';
    } else if (performance.falsePositiveRate < 0.1) {
      // Low false positives - can scan faster
      newStrategy.scanDepth = 'MEDIUM';
    }

    state.strategyAdjustments++;
    return newStrategy;
  }

  /**
   * Calculate scores for each bug category
   */
  private calculateCategoryScores(state: ReinforcementLearningState): Map<BugCategory, number> {
    const scores = new Map<BugCategory, number>();

    for (const [pattern, reward] of state.successfulPatterns) {
      const category = pattern.split('-')[0] as BugCategory;
      const current = scores.get(category) || 0;
      scores.set(category, current + reward);
    }

    // Penalize for unsuccessful patterns
    for (const [pattern, failures] of state.unsuccessfulPatterns) {
      const category = pattern.split('-')[0] as BugCategory;
      const current = scores.get(category) || 0;
      scores.set(category, current - failures * 10);
    }

    return scores;
  }

  /**
   * Get epsilon value for epsilon-greedy exploration
   */
  getEpsilon(teamId: string, round: number): number {
    const state = this.learningStates.get(teamId);
    if (!state) return 0.5;

    // Decay exploration over time
    const baseEpsilon = state.successfulPatterns.size > 0 ? 0.3 : 0.7;
    const decay = Math.exp(-round / 10);
    return baseEpsilon * decay;
  }

  /**
   * Select action using epsilon-greedy policy
   */
  selectAction(teamId: string, round: number, availableActions: string[]): string {
    const epsilon = this.getEpsilon(teamId, round);
    const state = this.learningStates.get(teamId);

    if (!state || Math.random() < epsilon) {
      // Explore - random action
      return availableActions[Math.floor(Math.random() * availableActions.length)];
    }

    // Exploit - best known action
    let bestAction = availableActions[0];
    let bestScore = -Infinity;

    for (const action of availableActions) {
      const score = state.successfulPatterns.get(action) || 0;
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Get learning metrics for a team
   */
  getMetrics(teamId: string): {
    totalReward: number;
    averageReward: number;
    successRate: number;
    topPatterns: Array<[string, number]>;
  } {
    const state = this.learningStates.get(teamId);
    if (!state) {
      return { totalReward: 0, averageReward: 0, successRate: 0, topPatterns: [] };
    }

    const totalReward = state.rewardHistory.reduce((a, b) => a + b, 0);
    const averageReward = totalReward / Math.max(1, state.rewardHistory.length);

    const totalAttempts = state.successfulPatterns.size + state.unsuccessfulPatterns.size;
    const successRate = totalAttempts > 0 ? state.successfulPatterns.size / totalAttempts : 0;

    const topPatterns = Array.from(state.successfulPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalReward,
      averageReward,
      successRate,
      topPatterns
    };
  }
}
