#!/usr/bin/env tsx
/**
 * Run Auto-Fix Framework
 * Loads discovered vulnerabilities and automatically generates fixes
 */

import { AutoFixCoordinator } from './fix-coordinator';
import { AutomatedScanningTeam } from './team-automated';
import { BugCategory } from './types';
import { glob } from 'glob';

async function main() {
  console.log('\n🔒 AUTO-FIX FRAMEWORK - Automated Vulnerability Remediation\n');

  // Option 1: Load bugs from previous scan
  // For now, we'll re-scan to get fresh bug reports
  console.log('📡 Scanning for vulnerabilities...\n');

  const scanner = new AutomatedScanningTeam({
    focusAreas: [
      BugCategory.INJECTION,
      BugCategory.XSS,
      BugCategory.AUTH_BYPASS,
      BugCategory.CRYPTO_FAILURE,
      BugCategory.DATA_EXPOSURE,
      BugCategory.BROKEN_ACCESS,
      BugCategory.INSECURE_DESIGN,
      BugCategory.TYPE_CONFUSION
    ],
    searchPatterns: ['**/src/**/*.ts'],
    scanDepth: 'MEDIUM',
    priorityFiles: [],
    learningRate: 0.1,
    explorationRate: 0.3
  });

  // Scan a subset of files for demonstration
  const files = await glob('/home/user/hyperscape/packages/*/src/**/*.ts', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts']
  });

  console.log(`📁 Scanning ${files.length} files...\n`);

  const bugs = await scanner.scanFiles(files.slice(0, 30)); // Scan subset for speed

  // Filter to valid bugs
  const validBugs = bugs.filter(b => b.isValid && !b.isFalsePositive);

  console.log(`\n✓ Found ${validBugs.length} valid vulnerabilities\n`);

  if (validBugs.length === 0) {
    console.log('No vulnerabilities found to fix. Exiting.');
    return;
  }

  // Display top vulnerabilities
  console.log('🎯 Top Vulnerabilities to Fix:\n');
  const topBugs = validBugs.slice(0, 10);
  topBugs.forEach((bug, i) => {
    console.log(`${i + 1}. ${bug.title}`);
    console.log(`   File: ${bug.location.file.replace('/home/user/hyperscape/', '')}`);
    console.log(`   Severity: ${bug.severity} | Category: ${bug.category}`);
    console.log('');
  });

  // Run auto-fix coordinator
  const coordinator = new AutoFixCoordinator();
  const report = await coordinator.fixVulnerabilities(validBugs);

  // Display final statistics
  console.log('\n📈 Final Statistics:\n');
  console.log(`Total vulnerabilities: ${validBugs.length}`);
  console.log(`Successfully fixed: ${report.totalBugsFixed} (${((report.totalBugsFixed / validBugs.length) * 100).toFixed(1)}%)`);
  console.log(`Failed to fix: ${report.totalBugsFailed}`);
  console.log(`Requires manual review: ${report.totalBugsManual}`);

  console.log(`\nFiles modified: ${report.filesModified.length}`);

  const totalBountyFixed = coordinator.getAllFixes()
    .filter(f => f.status === 'VALIDATED' || f.status === 'FIXED')
    .reduce((sum, f) => sum + f.bugReport.bountyValue, 0);

  console.log(`\n💰 Bug Bounty Value Fixed: $${totalBountyFixed.toLocaleString()}`);

  // Show next steps
  console.log('\n📋 Next Steps:\n');
  if (report.validationResults.passed) {
    console.log('1. ✓ All validations passed');
    console.log('2. Review AUTO-FIX-REPORT.md for details');
    console.log('3. Create PR with fixes:');
    console.log(`   git checkout -b ${report.prDetails.branch}`);
    console.log('   git add .');
    console.log(`   git commit -m "${report.prDetails.title}"`);
    console.log('   git push origin HEAD');
  } else {
    console.log('1. ⚠ Some validations failed');
    console.log('2. Review AUTO-FIX-REPORT.md for details');
    console.log('3. Fix validation errors manually');
    console.log('4. Re-run validation');
  }

  console.log('\n✓ Auto-fix process complete!\n');
}

main().catch(error => {
  console.error('\n❌ Auto-fix failed:', error);
  process.exit(1);
});
