/**
 * Bug Hunting Simulation Coordinator
 * Orchestrates competitive multi-agent security testing
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { AutomatedScanningTeam } from './team-automated';
import { ReinforcementLearning } from './reinforcement-learning';
import {
  BugReport,
  BugCategory,
  BugSeverity,
  TeamConfig,
  TeamPerformance,
  TeamStrategy,
  SimulationRound
} from './types';

export class BugHuntingSimulation {
  private teams: Map<string, any> = new Map();
  private rl = new ReinforcementLearning();
  private performances: Map<string, TeamPerformance> = new Map();
  private rounds: SimulationRound[] = [];
  private allBugReports: BugReport[] = [];

  constructor() {
    this.initializeTeams();
  }

  private initializeTeams(): void {
    // Team 1: Automated Scanning
    const team1Config: TeamConfig = {
      id: 'TEAM_AUTOMATED',
      name: 'Pattern Recognition Squad',
      methodology: 'AUTOMATED',
      description: 'Automated scanning with regex patterns and static analysis',
      initialStrategy: {
        focusAreas: [
          BugCategory.INJECTION,
          BugCategory.XSS,
          BugCategory.AUTH_BYPASS,
          BugCategory.CRYPTO_FAILURE,
          BugCategory.DATA_EXPOSURE
        ],
        searchPatterns: ['**/src/**/*.ts', '**/packages/**/*.ts'],
        scanDepth: 'MEDIUM',
        priorityFiles: [],
        learningRate: 0.1,
        explorationRate: 0.3
      }
    };

    this.teams.set(team1Config.id, new AutomatedScanningTeam(team1Config.initialStrategy));
    this.rl.initializeTeam(team1Config.id);
    this.performances.set(team1Config.id, this.createInitialPerformance(team1Config.id));

    // Note: Teams 2 and 3 are loaded dynamically in separate files
    console.log('✓ Initialized Team 1: Automated Scanning');
  }

  private createInitialPerformance(teamId: string): TeamPerformance {
    return {
      teamId,
      roundsCompleted: 0,
      bugsFound: 0,
      validBugs: 0,
      falsePositives: 0,
      criticalBugs: 0,
      highBugs: 0,
      mediumBugs: 0,
      lowBugs: 0,
      totalBountyValue: 0,
      averageTimeToDiscover: 0,
      falsePositiveRate: 0,
      uniqueBugsFound: 0,
      cvssAverage: 0,
      strategyEvolution: []
    };
  }

  /**
   * Load additional teams dynamically
   */
  async loadTeam(teamModule: string, teamId: string): Promise<void> {
    try {
      const module = await import(teamModule);
      const TeamClass = Object.values(module)[0] as any;

      const strategy: TeamStrategy = {
        focusAreas: [BugCategory.LOGIC_FLAW, BugCategory.AUTH_BYPASS],
        searchPatterns: ['**/src/**/*.ts'],
        scanDepth: 'DEEP',
        priorityFiles: [],
        learningRate: 0.15,
        explorationRate: 0.5
      };

      this.teams.set(teamId, new TeamClass(strategy));
      this.rl.initializeTeam(teamId);
      this.performances.set(teamId, this.createInitialPerformance(teamId));

      console.log(`✓ Loaded ${teamId}`);
    } catch (error) {
      console.error(`✗ Failed to load ${teamId}:`, error);
    }
  }

  /**
   * Get target files for scanning
   */
  private async getTargetFiles(patterns: string[]): Promise<string[]> {
    const files: string[] = [];
    const baseDir = '/home/user/hyperscape';

    for (const pattern of patterns) {
      const fullPattern = path.join(baseDir, pattern);
      const matches = await glob(fullPattern, {
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.test.ts', '**/*.spec.ts']
      });
      files.push(...matches);
    }

    return [...new Set(files)]; // Deduplicate
  }

  /**
   * Mark duplicate bugs (not unique)
   */
  private markDuplicates(reports: BugReport[]): void {
    const seen = new Map<string, BugReport>();

    for (const report of reports) {
      const key = `${report.category}-${report.location.file}-${report.location.lines.join(',')}`;
      const existing = seen.get(key);

      if (existing) {
        // This is a duplicate
        report.isUnique = false;
        // Keep the higher severity one as unique
        if (report.severity > existing.severity) {
          existing.isUnique = false;
          report.isUnique = true;
          seen.set(key, report);
        }
      } else {
        report.isUnique = true;
        seen.set(key, report);
      }
    }
  }

  /**
   * Validate bug reports (simple heuristic for false positives)
   */
  private validateReports(reports: BugReport[]): void {
    for (const report of reports) {
      // Simple heuristic: if it's in test files, likely false positive
      if (report.location.file.includes('.test.') || report.location.file.includes('.spec.')) {
        report.isFalsePositive = true;
        report.isValid = false;
      }

      // Very low CVSS scores might be false positives
      if (report.cvssScore.baseScore < 1.0) {
        report.isFalsePositive = true;
        report.isValid = false;
      }

      // If snippet is too short, might not have enough context
      if (report.location.snippet.length < 20) {
        report.isFalsePositive = true;
        report.isValid = false;
      }
    }
  }

  /**
   * Run a single round of bug hunting
   */
  async runRound(roundNumber: number): Promise<SimulationRound> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎯 ROUND ${roundNumber} - Bug Hunting Competition`);
    console.log('='.repeat(60));

    const startTime = Date.now();
    const teamsReports = new Map<string, BugReport[]>();
    const scores = new Map<string, number>();

    // Get target files based on team strategies
    const targetFiles = await this.getTargetFiles(['**/src/**/*.ts', '**/packages/**/*.ts']);
    console.log(`\n📁 Target: ${targetFiles.length} files\n`);

    // Each team scans in parallel
    const scanPromises = Array.from(this.teams.entries()).map(async ([teamId, team]) => {
      console.log(`🔍 ${teamId} scanning...`);
      const scanStart = Date.now();

      const reports = await team.scanFiles(targetFiles);
      const scanEnd = Date.now();

      // Add time to discover
      reports.forEach((r: BugReport) => {
        r.timeToDiscover = scanEnd - scanStart;
      });

      return { teamId, reports };
    });

    const results = await Promise.all(scanPromises);

    // Process results
    for (const { teamId, reports } of results) {
      teamsReports.set(teamId, reports);
      console.log(`  ✓ ${teamId}: ${reports.length} potential issues found`);
    }

    // Validate and mark duplicates across ALL teams
    const allReports = Array.from(teamsReports.values()).flat();
    this.validateReports(allReports);
    this.markDuplicates(allReports);
    this.allBugReports.push(...allReports);

    // Calculate scores for each team
    for (const [teamId, reports] of teamsReports) {
      const teamScore = this.calculateTeamScore(reports);
      scores.set(teamId, teamScore);

      // Update performance metrics
      this.updatePerformance(teamId, reports);

      // Update reinforcement learning
      this.rl.updateFromReports(teamId, reports);

      // Adapt strategy based on performance
      const team = this.teams.get(teamId);
      const performance = this.performances.get(teamId)!;
      const currentStrategy = team.getStrategy();
      const newStrategy = this.rl.adaptStrategy(teamId, currentStrategy, performance);
      team.updateStrategy(newStrategy);
      performance.strategyEvolution.push(newStrategy);
    }

    const endTime = Date.now();
    const round: SimulationRound = {
      roundNumber,
      timestamp: Date.now(),
      targetFiles,
      teamsReports,
      scores,
      duration: endTime - startTime
    };

    this.rounds.push(round);

    // Display round results
    this.displayRoundResults(round);

    return round;
  }

  /**
   * Calculate score for a team's bug reports
   */
  private calculateTeamScore(reports: BugReport[]): number {
    let score = 0;

    for (const report of reports) {
      if (!report.isValid || report.isFalsePositive) {
        score -= 10; // Penalty for false positives
        continue;
      }

      // Base score is bounty value
      score += report.bountyValue;

      // Bonus for unique findings
      if (report.isUnique) {
        score += report.bountyValue * 0.5;
      }

      // Bonus for critical severity
      if (report.severity === BugSeverity.CRITICAL) {
        score += 1000;
      } else if (report.severity === BugSeverity.HIGH) {
        score += 500;
      }

      // Bonus for fast discovery
      if (report.timeToDiscover < 1000) {
        score += 100;
      }
    }

    return Math.round(score);
  }

  /**
   * Update team performance metrics
   */
  private updatePerformance(teamId: string, reports: BugReport[]): void {
    const perf = this.performances.get(teamId)!;
    perf.roundsCompleted++;

    const validBugs = reports.filter(r => r.isValid && !r.isFalsePositive);
    const falsePositives = reports.filter(r => r.isFalsePositive);

    perf.bugsFound += reports.length;
    perf.validBugs += validBugs.length;
    perf.falsePositives += falsePositives.length;
    perf.uniqueBugsFound += reports.filter(r => r.isUnique).length;

    for (const report of validBugs) {
      perf.totalBountyValue += report.bountyValue;

      switch (report.severity) {
        case BugSeverity.CRITICAL:
          perf.criticalBugs++;
          break;
        case BugSeverity.HIGH:
          perf.highBugs++;
          break;
        case BugSeverity.MEDIUM:
          perf.mediumBugs++;
          break;
        case BugSeverity.LOW:
          perf.lowBugs++;
          break;
      }
    }

    // Calculate averages
    perf.falsePositiveRate = perf.bugsFound > 0 ? perf.falsePositives / perf.bugsFound : 0;

    const totalTime = reports.reduce((sum, r) => sum + r.timeToDiscover, 0);
    perf.averageTimeToDiscover = reports.length > 0 ? totalTime / reports.length : 0;

    const totalCVSS = validBugs.reduce((sum, r) => sum + r.cvssScore.baseScore, 0);
    perf.cvssAverage = validBugs.length > 0 ? totalCVSS / validBugs.length : 0;
  }

  /**
   * Display round results
   */
  private displayRoundResults(round: SimulationRound): void {
    console.log(`\n📊 Round ${round.roundNumber} Results (${round.duration}ms):\n`);

    const sortedScores = Array.from(round.scores.entries())
      .sort((a, b) => b[1] - a[1]);

    for (let i = 0; i < sortedScores.length; i++) {
      const [teamId, score] = sortedScores[i];
      const reports = round.teamsReports.get(teamId) || [];
      const validBugs = reports.filter(r => r.isValid && !r.isFalsePositive);
      const uniqueBugs = reports.filter(r => r.isUnique);

      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      console.log(`${medal} ${teamId}:`);
      console.log(`     Score: ${score.toLocaleString()}`);
      console.log(`     Bugs: ${validBugs.length} valid / ${reports.length} total`);
      console.log(`     Unique: ${uniqueBugs.length}`);
      console.log(`     FP Rate: ${((reports.length - validBugs.length) / Math.max(1, reports.length) * 100).toFixed(1)}%`);
    }
  }

  /**
   * Generate final analysis and winner declaration
   */
  async generateFinalAnalysis(): Promise<string> {
    console.log(`\n${'='.repeat(60)}`);
    console.log('🏆 FINAL RESULTS - Bug Bounty Competition');
    console.log('='.repeat(60));

    const sortedPerformances = Array.from(this.performances.values())
      .sort((a, b) => b.totalBountyValue - a.totalBountyValue);

    const winner = sortedPerformances[0];
    const winnerMetrics = this.rl.getMetrics(winner.teamId);

    let report = `\n## 🥇 WINNER: ${winner.teamId}\n\n`;
    report += `**Total Bounty Value:** $${winner.totalBountyValue.toLocaleString()}\n`;
    report += `**Valid Bugs Found:** ${winner.validBugs}\n`;
    report += `**Critical Bugs:** ${winner.criticalBugs}\n`;
    report += `**High Bugs:** ${winner.highBugs}\n`;
    report += `**Average CVSS:** ${winner.cvssAverage.toFixed(2)}\n`;
    report += `**False Positive Rate:** ${(winner.falsePositiveRate * 100).toFixed(1)}%\n`;
    report += `**Average Discovery Time:** ${winner.averageTimeToDiscover.toFixed(0)}ms\n\n`;

    report += `### Superior Strategies:\n`;
    for (const [pattern, score] of winnerMetrics.topPatterns) {
      report += `- ${pattern}: ${score} reward points\n`;
    }

    report += `\n## 📊 All Teams Performance:\n\n`;

    for (let i = 0; i < sortedPerformances.length; i++) {
      const perf = sortedPerformances[i];
      const position = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

      report += `${position} **${perf.teamId}**\n`;
      report += `   Bounty: $${perf.totalBountyValue.toLocaleString()} | `;
      report += `Bugs: ${perf.validBugs}/${perf.bugsFound} | `;
      report += `CVSS: ${perf.cvssAverage.toFixed(2)} | `;
      report += `FP: ${(perf.falsePositiveRate * 100).toFixed(1)}%\n\n`;
    }

    report += `\n## 🔍 Optimized Bug Hunting Methodology:\n\n`;
    report += this.extractBestPractices();

    console.log(report);

    // Save report
    await fs.writeFile(
      '/home/user/hyperscape/security-audit/FINAL-REPORT.md',
      report,
      'utf-8'
    );

    return report;
  }

  /**
   * Extract best practices from all teams
   */
  private extractBestPractices(): string {
    let practices = '';

    practices += `### Combined Best Practices:\n\n`;
    practices += `1. **Focus Areas** (by success rate):\n`;

    const categorySuccessMap = new Map<BugCategory, number>();
    for (const report of this.allBugReports.filter(r => r.isValid && !r.isFalsePositive)) {
      const current = categorySuccessMap.get(report.category) || 0;
      categorySuccessMap.set(report.category, current + 1);
    }

    const topCategories = Array.from(categorySuccessMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [category, count] of topCategories) {
      practices += `   - ${category}: ${count} bugs found\n`;
    }

    practices += `\n2. **Scan Depth Strategy**:\n`;
    practices += `   - Use DEEP scan for authentication/authorization code\n`;
    practices += `   - Use MEDIUM scan for general business logic\n`;
    practices += `   - Use SHALLOW scan for UI/presentation layers\n`;

    practices += `\n3. **Prioritization**:\n`;
    practices += `   - Start with high-value targets (auth, payment, data access)\n`;
    practices += `   - Scan user input handling functions thoroughly\n`;
    practices += `   - Review cryptographic operations with deep analysis\n`;

    practices += `\n4. **Quality Metrics**:\n`;
    practices += `   - Target <10% false positive rate\n`;
    practices += `   - Average CVSS >5.0 for meaningful findings\n`;
    practices += `   - Aim for >50% unique bugs (avoid duplicates)\n`;

    return practices;
  }

  getPerformances(): Map<string, TeamPerformance> {
    return this.performances;
  }

  getRounds(): SimulationRound[] {
    return this.rounds;
  }
}
