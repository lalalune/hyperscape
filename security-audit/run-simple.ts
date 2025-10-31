#!/usr/bin/env tsx
import { AutomatedScanningTeam } from './team-automated';
import { CVSSCalculator } from './cvss-calculator';
import { BugCategory, BugSeverity } from './types';
import { glob } from 'glob';

async function main() {
  console.log('\n🔒 BUG HUNTING DEMONSTRATION\n');
  
  const team = new AutomatedScanningTeam({
    focusAreas: [BugCategory.INJECTION, BugCategory.XSS, BugCategory.AUTH_BYPASS],
    searchPatterns: ['**/src/**/*.ts'],
    scanDepth: 'MEDIUM',
    priorityFiles: [],
    learningRate: 0.1,
    explorationRate: 0.3
  });

  // Get target files
  const files = await glob('/home/user/hyperscape/packages/*/src/**/*.ts', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts']
  });

  console.log(`📁 Scanning ${files.length} files...\n`);
  
  const reports = await team.scanFiles(files.slice(0, 50)); // Sample
  
  // Filter valid bugs
  const validBugs = reports.filter(r => r.isValid && !r.isFalsePositive);
  
  // Calculate stats
  const bySeverity = {
    CRITICAL: validBugs.filter(r => r.severity === BugSeverity.CRITICAL).length,
    HIGH: validBugs.filter(r => r.severity === BugSeverity.HIGH).length,
    MEDIUM: validBugs.filter(r => r.severity === BugSeverity.MEDIUM).length,
    LOW: validBugs.filter(r => r.severity === BugSeverity.LOW).length
  };
  
  const totalBounty = validBugs.reduce((sum, r) => sum + r.bountyValue, 0);
  const avgCVSS = validBugs.reduce((sum, r) => sum + r.cvssScore.baseScore, 0) / validBugs.length;
  
  console.log('📊 RESULTS:\n');
  console.log(`Total Issues Found: ${reports.length}`);
  console.log(`Valid Vulnerabilities: ${validBugs.length}`);
  console.log(`False Positive Rate: ${((reports.length - validBugs.length) / reports.length * 100).toFixed(1)}%\n`);
  
  console.log('Severity Breakdown:');
  console.log(`  🔴 CRITICAL: ${bySeverity.CRITICAL}`);
  console.log(`  🟠 HIGH: ${bySeverity.HIGH}`);
  console.log(`  🟡 MEDIUM: ${bySeverity.MEDIUM}`);
  console.log(`  🟢 LOW: ${bySeverity.LOW}\n`);
  
  console.log(`💰 Total Bug Bounty Value: $${totalBounty.toLocaleString()}`);
  console.log(`📈 Average CVSS Score: ${avgCVSS.toFixed(2)}\n`);
  
  // Show top 10 findings
  console.log('🎯 TOP 10 CRITICAL FINDINGS:\n');
  const topFindings = validBugs
    .filter(r => r.severity === BugSeverity.CRITICAL || r.severity === BugSeverity.HIGH)
    .slice(0, 10);
  
  topFindings.forEach((bug, i) => {
    console.log(`${i + 1}. ${bug.title}`);
    console.log(`   File: ${bug.location.file.replace('/home/user/hyperscape/', '')}`);
    console.log(`   Severity: ${bug.severity} (CVSS ${bug.cvssScore.baseScore})`);
    console.log(`   Bounty: $${bug.bountyValue.toLocaleString()}`);
    console.log(`   Category: ${bug.category}`);
    console.log('');
  });
}

main().catch(console.error);
