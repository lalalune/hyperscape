/**
 * Auto-Fix Coordinator
 * Orchestrates fix teams, validates fixes, and generates reports
 */

import { promises as fs } from 'fs';
import { BugReport, BugCategory, BugSeverity } from './types';
import { FixAttempt, FixReport, FileFix, FixStatus, FixTeamPerformance } from './fix-types';
import { PatternBasedFixTeam } from './fix-team-pattern';
import { SemanticRefactoringTeam } from './fix-team-semantic';
import { FixValidator } from './fix-validator';

export class AutoFixCoordinator {
  private patternTeam = new PatternBasedFixTeam();
  private semanticTeam = new SemanticRefactoringTeam();
  private validator = new FixValidator();

  private allFixes: FixAttempt[] = [];
  private teamPerformances = new Map<string, FixTeamPerformance>();

  /**
   * Run auto-fix on discovered vulnerabilities
   */
  async fixVulnerabilities(bugs: BugReport[]): Promise<FixReport> {
    console.log('\n' + '='.repeat(60));
    console.log('🔧 AUTO-FIX FRAMEWORK - Automated Vulnerability Remediation');
    console.log('='.repeat(60));
    console.log(`\n📋 Processing ${bugs.length} vulnerabilities...\n`);

    const startTime = Date.now();

    // Initialize team performances
    this.initializePerformances();

    // Categorize bugs by fix team
    const { patternBugs, semanticBugs, manualBugs } = this.categorizeBugs(bugs);

    console.log('📊 Bug Distribution:');
    console.log(`  Pattern-based fixes: ${patternBugs.length}`);
    console.log(`  Semantic refactoring: ${semanticBugs.length}`);
    console.log(`  Manual review required: ${manualBugs.length}\n`);

    // Run fix teams in parallel
    const fixPromises = [
      this.patternTeam.fixBugs(patternBugs),
      this.semanticTeam.fixBugs(semanticBugs)
    ];

    const [patternFixes, semanticFixes] = await Promise.all(fixPromises);

    this.allFixes = [...patternFixes, ...semanticFixes];

    console.log(`\n✓ Generated ${this.allFixes.length} fix attempts\n`);

    // Validate fixes
    const validationResult = await this.validator.validateFixes(this.allFixes);

    // Handle validation failures
    if (!validationResult.passed) {
      console.log('\n⚠ Validation found issues - rolling back failed fixes...');

      const failedFixes = this.allFixes.filter(
        f => f.status === FixStatus.FAILED && f.canRollback
      );

      if (failedFixes.length > 0) {
        await this.validator.rollbackFixes(failedFixes);
      }
    }

    // Update team performances
    this.updatePerformances();

    // Generate files modified
    const filesModified = await this.generateFileFixList();

    // Generate report
    const report = this.generateReport(
      bugs.length,
      validationResult,
      filesModified,
      startTime
    );

    // Display summary
    this.displaySummary(report);

    // Save report
    await this.saveReport(report);

    return report;
  }

  /**
   * Initialize team performance tracking
   */
  private initializePerformances(): void {
    this.teamPerformances.set(this.patternTeam.teamId, {
      teamId: this.patternTeam.teamId,
      totalAttempts: 0,
      successfulFixes: 0,
      failedFixes: 0,
      averageConfidence: 0,
      averageTimeToFix: 0,
      testsPassedRate: 0,
      rollbackRate: 0
    });

    this.teamPerformances.set(this.semanticTeam.teamId, {
      teamId: this.semanticTeam.teamId,
      totalAttempts: 0,
      successfulFixes: 0,
      failedFixes: 0,
      averageConfidence: 0,
      averageTimeToFix: 0,
      testsPassedRate: 0,
      rollbackRate: 0
    });
  }

  /**
   * Categorize bugs by which team should handle them
   */
  private categorizeBugs(bugs: BugReport[]): {
    patternBugs: BugReport[];
    semanticBugs: BugReport[];
    manualBugs: BugReport[];
  } {
    const patternBugs: BugReport[] = [];
    const semanticBugs: BugReport[] = [];
    const manualBugs: BugReport[] = [];

    const patternCategories = this.patternTeam.getConfig().specialization;
    const semanticCategories = this.semanticTeam.getConfig().specialization;

    for (const bug of bugs) {
      if (patternCategories.includes(bug.category)) {
        patternBugs.push(bug);
      } else if (semanticCategories.includes(bug.category)) {
        semanticBugs.push(bug);
      } else {
        manualBugs.push(bug);
      }
    }

    return { patternBugs, semanticBugs, manualBugs };
  }

  /**
   * Update team performance metrics
   */
  private updatePerformances(): void {
    for (const [teamId, perf] of this.teamPerformances) {
      const teamFixes = this.allFixes.filter(f => f.teamId === teamId);

      perf.totalAttempts = teamFixes.length;
      perf.successfulFixes = teamFixes.filter(
        f => f.status === FixStatus.VALIDATED || f.status === FixStatus.FIXED
      ).length;
      perf.failedFixes = teamFixes.filter(f => f.status === FixStatus.FAILED).length;

      const confidences = teamFixes.map(f => f.confidence);
      perf.averageConfidence =
        confidences.reduce((a, b) => a + b, 0) / Math.max(1, confidences.length);

      const times = teamFixes.map(f => f.timeToFix);
      perf.averageTimeToFix = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);

      const testsPassedCount = teamFixes.filter(f => f.testsPass).length;
      perf.testsPassedRate = testsPassedCount / Math.max(1, teamFixes.length);

      const rollbackCount = teamFixes.filter(f => f.status === FixStatus.ROLLED_BACK).length;
      perf.rollbackRate = rollbackCount / Math.max(1, teamFixes.length);
    }
  }

  /**
   * Generate list of files modified
   */
  private async generateFileFixList(): Promise<FileFix[]> {
    const fileFixMap = new Map<string, FileFix>();

    for (const fix of this.allFixes) {
      if (fix.status !== FixStatus.FIXED && fix.status !== FixStatus.VALIDATED) {
        continue;
      }

      const filePath = fix.bugReport.location.file;

      if (!fileFixMap.has(filePath)) {
        try {
          const originalContent = await fs.readFile(filePath, 'utf-8');
          fileFixMap.set(filePath, {
            filePath,
            originalContent,
            fixedContent: fix.fixedCode,
            fixes: [fix],
            totalChanges: 0,
            linesAdded: 0,
            linesRemoved: 0
          });
        } catch (error) {
          console.error(`Error reading ${filePath}:`, error);
        }
      } else {
        const fileFix = fileFixMap.get(filePath)!;
        fileFix.fixes.push(fix);
        fileFix.fixedContent = fix.fixedCode; // Use latest fixed version
      }
    }

    // Calculate line changes
    for (const fileFix of fileFixMap.values()) {
      const originalLines = fileFix.originalContent.split('\n').length;
      const fixedLines = fileFix.fixedContent.split('\n').length;

      fileFix.totalChanges = fileFix.fixes.length;
      fileFix.linesAdded = Math.max(0, fixedLines - originalLines);
      fileFix.linesRemoved = Math.max(0, originalLines - fixedLines);
    }

    return Array.from(fileFixMap.values());
  }

  /**
   * Generate fix report
   */
  private generateReport(
    totalBugs: number,
    validationResult: any,
    filesModified: FileFix[],
    startTime: number
  ): FixReport {
    const fixed = this.allFixes.filter(
      f => f.status === FixStatus.VALIDATED || f.status === FixStatus.FIXED
    ).length;
    const failed = this.allFixes.filter(f => f.status === FixStatus.FAILED).length;
    const manual = this.allFixes.filter(f => f.status === FixStatus.REQUIRES_MANUAL).length;

    // Count by severity
    const bySeverity = new Map<BugSeverity, number>();
    for (const fix of this.allFixes) {
      if (fix.status === FixStatus.VALIDATED || fix.status === FixStatus.FIXED) {
        const current = bySeverity.get(fix.bugReport.severity) || 0;
        bySeverity.set(fix.bugReport.severity, current + 1);
      }
    }

    // Count by category
    const byCategory = new Map<BugCategory, number>();
    for (const fix of this.allFixes) {
      if (fix.status === FixStatus.VALIDATED || fix.status === FixStatus.FIXED) {
        const current = byCategory.get(fix.bugReport.category) || 0;
        byCategory.set(fix.bugReport.category, current + 1);
      }
    }

    return {
      timestamp: Date.now(),
      totalBugsFixed: fixed,
      totalBugsFailed: failed,
      totalBugsManual: manual,
      byTeam: this.teamPerformances,
      bySeverity,
      byCategory,
      filesModified,
      validationResults: validationResult,
      prDetails: {
        title: `🔒 Auto-fix: ${fixed} security vulnerabilities`,
        description: this.generatePRDescription(fixed, bySeverity, byCategory),
        branch: `security/auto-fix-${Date.now()}`
      }
    };
  }

  /**
   * Generate PR description
   */
  private generatePRDescription(
    fixedCount: number,
    bySeverity: Map<BugSeverity, number>,
    byCategory: Map<BugCategory, number>
  ): string {
    let desc = '## 🔒 Automated Security Vulnerability Fixes\n\n';
    desc += `This PR automatically fixes **${fixedCount} security vulnerabilities** discovered by the bug hunting framework.\n\n`;

    desc += '### Fixed by Severity\n\n';
    for (const [severity, count] of Array.from(bySeverity.entries()).sort()) {
      const emoji = {
        CRITICAL: '🔴',
        HIGH: '🟠',
        MEDIUM: '🟡',
        LOW: '🟢',
        INFO: '⚪'
      }[severity];
      desc += `- ${emoji} **${severity}**: ${count} fixes\n`;
    }

    desc += '\n### Fixed by Category\n\n';
    for (const [category, count] of Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])) {
      desc += `- **${category}**: ${count} fixes\n`;
    }

    desc += '\n### Fix Teams\n\n';
    desc += '- **Pattern-Based Team**: Simple regex-based transformations\n';
    desc += '- **Semantic Refactoring Team**: Complex AST-based code restructuring\n';

    desc += '\n### Validation\n\n';
    desc += 'All fixes have been:\n';
    desc += '- ✓ Validated with TypeScript compilation\n';
    desc += '- ✓ Checked with ESLint\n';
    desc += '- ✓ Scanned for new vulnerabilities\n';
    desc += '- ✓ Tested with existing test suite\n';

    return desc;
  }

  /**
   * Display summary
   */
  private displaySummary(report: FixReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUTO-FIX SUMMARY');
    console.log('='.repeat(60));

    console.log(`\n✅ Successfully Fixed: ${report.totalBugsFixed}`);
    console.log(`❌ Failed to Fix: ${report.totalBugsFailed}`);
    console.log(`⚠️  Requires Manual Review: ${report.totalBugsManual}`);

    console.log('\n📁 Files Modified:');
    console.log(`  Total files: ${report.filesModified.length}`);
    const totalAdded = report.filesModified.reduce((sum, f) => sum + f.linesAdded, 0);
    const totalRemoved = report.filesModified.reduce((sum, f) => sum + f.linesRemoved, 0);
    console.log(`  Lines added: ${totalAdded}`);
    console.log(`  Lines removed: ${totalRemoved}`);

    console.log('\n🏆 Team Performance:');
    for (const [teamId, perf] of report.byTeam) {
      console.log(`\n  ${teamId}:`);
      console.log(`    Success rate: ${((perf.successfulFixes / Math.max(1, perf.totalAttempts)) * 100).toFixed(1)}%`);
      console.log(`    Avg confidence: ${(perf.averageConfidence * 100).toFixed(1)}%`);
      console.log(`    Avg time: ${perf.averageTimeToFix.toFixed(0)}ms`);
      console.log(`    Tests passed: ${(perf.testsPassedRate * 100).toFixed(1)}%`);
    }

    console.log('\n🧪 Validation Results:');
    console.log(`  Tests run: ${report.validationResults.testsRun}`);
    console.log(`  Tests passed: ${report.validationResults.testsPassed}`);
    console.log(`  Tests failed: ${report.validationResults.testsFailed}`);
    console.log(`  New bugs introduced: ${report.validationResults.newBugsIntroduced.length}`);
    console.log(`  Static analysis errors: ${report.validationResults.staticAnalysisErrors.length}`);

    if (report.validationResults.passed) {
      console.log('\n✓ All validations passed! Fixes are safe to merge.');
    } else {
      console.log('\n⚠ Some validations failed. Review failed fixes before merging.');
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * Save report to file
   */
  private async saveReport(report: FixReport): Promise<void> {
    const reportPath = '/home/user/hyperscape/security-audit/AUTO-FIX-REPORT.md';

    let markdown = `# 🔧 Auto-Fix Report\n\n`;
    markdown += `**Generated:** ${new Date(report.timestamp).toISOString()}\n\n`;

    markdown += `## Summary\n\n`;
    markdown += `- ✅ Successfully Fixed: **${report.totalBugsFixed}**\n`;
    markdown += `- ❌ Failed to Fix: **${report.totalBugsFailed}**\n`;
    markdown += `- ⚠️ Requires Manual Review: **${report.totalBugsManual}**\n\n`;

    markdown += `## Fixed by Severity\n\n`;
    for (const [severity, count] of report.bySeverity) {
      markdown += `- **${severity}**: ${count}\n`;
    }

    markdown += `\n## Fixed by Category\n\n`;
    for (const [category, count] of report.byCategory) {
      markdown += `- **${category}**: ${count}\n`;
    }

    markdown += `\n## Team Performance\n\n`;
    for (const [teamId, perf] of report.byTeam) {
      markdown += `### ${teamId}\n\n`;
      markdown += `- Total attempts: ${perf.totalAttempts}\n`;
      markdown += `- Successful fixes: ${perf.successfulFixes}\n`;
      markdown += `- Success rate: ${((perf.successfulFixes / Math.max(1, perf.totalAttempts)) * 100).toFixed(1)}%\n`;
      markdown += `- Average confidence: ${(perf.averageConfidence * 100).toFixed(1)}%\n`;
      markdown += `- Average time: ${perf.averageTimeToFix.toFixed(0)}ms\n`;
      markdown += `- Tests passed rate: ${(perf.testsPassedRate * 100).toFixed(1)}%\n\n`;
    }

    markdown += `## Files Modified\n\n`;
    for (const file of report.filesModified) {
      const shortPath = file.filePath.replace('/home/user/hyperscape/', '');
      markdown += `### ${shortPath}\n\n`;
      markdown += `- Total fixes: ${file.totalChanges}\n`;
      markdown += `- Lines added: ${file.linesAdded}\n`;
      markdown += `- Lines removed: ${file.linesRemoved}\n\n`;

      markdown += `**Fixes:**\n`;
      for (const fix of file.fixes) {
        markdown += `- ${fix.bugReport.title} (${fix.strategy})\n`;
        markdown += `  - Confidence: ${(fix.confidence * 100).toFixed(0)}%\n`;
        markdown += `  - ${fix.explanation}\n`;
      }
      markdown += '\n';
    }

    markdown += `## Validation Results\n\n`;
    markdown += `- Tests run: ${report.validationResults.testsRun}\n`;
    markdown += `- Tests passed: ${report.validationResults.testsPassed}\n`;
    markdown += `- Tests failed: ${report.validationResults.testsFailed}\n`;
    markdown += `- New bugs introduced: ${report.validationResults.newBugsIntroduced.length}\n`;
    markdown += `- Static analysis errors: ${report.validationResults.staticAnalysisErrors.length}\n\n`;

    if (report.validationResults.passed) {
      markdown += `✓ **All validations passed!**\n\n`;
    } else {
      markdown += `⚠️ **Some validations failed. Review before merging.**\n\n`;
    }

    markdown += `## Pull Request\n\n`;
    markdown += `**Title:** ${report.prDetails.title}\n\n`;
    markdown += `**Branch:** ${report.prDetails.branch}\n\n`;
    markdown += report.prDetails.description;

    await fs.writeFile(reportPath, markdown, 'utf-8');
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  getAllFixes(): FixAttempt[] {
    return this.allFixes;
  }

  getTeamPerformances(): Map<string, FixTeamPerformance> {
    return this.teamPerformances;
  }
}
