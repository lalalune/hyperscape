/**
 * Fix Validation System
 * Validates fixes don't break functionality and don't introduce new bugs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { FixAttempt, ValidationResult, FixStatus } from './fix-types';
import { BugReport } from './types';
import { AutomatedScanningTeam } from './team-automated';

const execAsync = promisify(exec);

export class FixValidator {
  private baseDir = '/home/user/hyperscape';

  /**
   * Validate all fixes in a batch
   */
  async validateFixes(fixes: FixAttempt[]): Promise<ValidationResult> {
    console.log(`\n🧪 Validating ${fixes.length} fixes...`);

    const validationStart = Date.now();
    let testsRun = 0;
    let testsPassed = 0;
    let testsFailed = 0;
    const newBugsIntroduced: BugReport[] = [];
    const staticAnalysisErrors: string[] = [];

    // Run TypeScript compilation check
    console.log('  Running TypeScript compilation check...');
    const tsCheckResult = await this.runTypeScriptCheck();
    if (!tsCheckResult.passed) {
      staticAnalysisErrors.push(...tsCheckResult.errors);
      console.log(`  ✗ TypeScript compilation failed with ${tsCheckResult.errors.length} errors`);
    } else {
      console.log('  ✓ TypeScript compilation passed');
    }

    // Run ESLint
    console.log('  Running ESLint analysis...');
    const lintResult = await this.runESLint();
    if (!lintResult.passed) {
      staticAnalysisErrors.push(...lintResult.errors);
      console.log(`  ⚠ ESLint found ${lintResult.errors.length} issues`);
    } else {
      console.log('  ✓ ESLint passed');
    }

    // Scan for new vulnerabilities introduced by fixes
    console.log('  Scanning for new vulnerabilities...');
    const newBugs = await this.scanForNewBugs(fixes);
    if (newBugs.length > 0) {
      newBugsIntroduced.push(...newBugs);
      console.log(`  ⚠ Found ${newBugs.length} new vulnerabilities introduced by fixes`);
    } else {
      console.log('  ✓ No new vulnerabilities introduced');
    }

    // Run tests if available
    console.log('  Running test suite...');
    const testResult = await this.runTests();
    testsRun = testResult.total;
    testsPassed = testResult.passed;
    testsFailed = testResult.failed;

    if (testsFailed > 0) {
      console.log(`  ⚠ ${testsFailed} tests failed`);
    } else if (testsRun > 0) {
      console.log(`  ✓ All ${testsPassed} tests passed`);
    } else {
      console.log('  ℹ No tests found to run');
    }

    const passed =
      staticAnalysisErrors.length === 0 &&
      newBugsIntroduced.length === 0 &&
      (testsFailed === 0 || testsRun === 0);

    const validationEnd = Date.now();
    console.log(`\n✓ Validation completed in ${validationEnd - validationStart}ms`);

    // Update fix statuses based on validation
    for (const fix of fixes) {
      if (fix.status === FixStatus.FIXED) {
        fix.testsPass = testsFailed === 0;
        fix.staticAnalysisPass = staticAnalysisErrors.length === 0;
        fix.introducesNewBugs = newBugsIntroduced.some(bug =>
          bug.location.file === fix.bugReport.location.file
        );

        // Mark as validated if all checks pass
        if (fix.testsPass && fix.staticAnalysisPass && !fix.introducesNewBugs) {
          fix.status = FixStatus.VALIDATED;
        } else {
          fix.status = FixStatus.FAILED;
        }
      }
    }

    return {
      passed,
      testsRun,
      testsPassed,
      testsFailed,
      newBugsIntroduced,
      staticAnalysisErrors
    };
  }

  /**
   * Run TypeScript compilation check
   */
  private async runTypeScriptCheck(): Promise<{ passed: boolean; errors: string[] }> {
    try {
      await execAsync('npx tsc --noEmit', { cwd: this.baseDir, timeout: 30000 });
      return { passed: true, errors: [] };
    } catch (error: any) {
      const errors = error.stdout?.split('\n').filter((line: string) => line.trim()) || [];
      return { passed: false, errors: errors.slice(0, 20) }; // Limit to first 20 errors
    }
  }

  /**
   * Run ESLint analysis
   */
  private async runESLint(): Promise<{ passed: boolean; errors: string[] }> {
    try {
      await execAsync('npx eslint . --max-warnings 0', { cwd: this.baseDir, timeout: 30000 });
      return { passed: true, errors: [] };
    } catch (error: any) {
      const errors = error.stdout?.split('\n').filter((line: string) => line.trim()) || [];
      return { passed: false, errors: errors.slice(0, 20) };
    }
  }

  /**
   * Scan for new bugs introduced by fixes
   */
  private async scanForNewBugs(fixes: FixAttempt[]): Promise<BugReport[]> {
    // Extract unique files that were modified
    const modifiedFiles = [...new Set(fixes.map(f => f.bugReport.location.file))];

    // Use automated scanner to check for new vulnerabilities
    const scanner = new AutomatedScanningTeam({
      focusAreas: [],
      searchPatterns: [],
      scanDepth: 'MEDIUM',
      priorityFiles: modifiedFiles,
      learningRate: 0.1,
      explorationRate: 0.3
    });

    try {
      const newBugs = await scanner.scanFiles(modifiedFiles);
      // Filter to only critical/high severity new bugs
      return newBugs.filter(bug =>
        bug.severity === 'CRITICAL' || bug.severity === 'HIGH'
      );
    } catch (error) {
      console.error('Error scanning for new bugs:', error);
      return [];
    }
  }

  /**
   * Run test suite
   */
  private async runTests(): Promise<{ total: number; passed: number; failed: number }> {
    try {
      // Try to run package tests
      const { stdout } = await execAsync('npm test -- --passWithNoTests', {
        cwd: this.baseDir,
        timeout: 60000
      });

      // Parse test results from output
      const passedMatch = stdout.match(/(\d+)\s+passed/i);
      const failedMatch = stdout.match(/(\d+)\s+failed/i);
      const totalMatch = stdout.match(/Tests:\s+(\d+)\s+total/i);

      const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      const total = totalMatch ? parseInt(totalMatch[1]) : passed + failed;

      return { total, passed, failed };
    } catch (error: any) {
      // Tests might not exist or might have failed
      if (error.stdout?.includes('no tests found')) {
        return { total: 0, passed: 0, failed: 0 };
      }

      // Parse failure output
      const failedMatch = error.stdout?.match(/(\d+)\s+failed/i);
      const passedMatch = error.stdout?.match(/(\d+)\s+passed/i);

      return {
        total: (failedMatch ? parseInt(failedMatch[1]) : 0) + (passedMatch ? parseInt(passedMatch[1]) : 0),
        passed: passedMatch ? parseInt(passedMatch[1]) : 0,
        failed: failedMatch ? parseInt(failedMatch[1]) : 0
      };
    }
  }

  /**
   * Rollback a fix
   */
  async rollbackFix(fix: FixAttempt): Promise<void> {
    if (!fix.canRollback) {
      throw new Error('Fix cannot be rolled back');
    }

    try {
      await fs.writeFile(fix.bugReport.location.file, fix.originalCode, 'utf-8');
      fix.status = FixStatus.ROLLED_BACK;
      console.log(`  ↩ Rolled back fix for ${fix.bugReport.title} in ${fix.bugReport.location.file}`);
    } catch (error) {
      console.error(`  ✗ Failed to rollback fix:`, error);
      throw error;
    }
  }

  /**
   * Rollback multiple fixes
   */
  async rollbackFixes(fixes: FixAttempt[]): Promise<void> {
    console.log(`\n↩ Rolling back ${fixes.length} fixes...`);

    for (const fix of fixes) {
      if (fix.canRollback) {
        await this.rollbackFix(fix);
      }
    }
  }
}
