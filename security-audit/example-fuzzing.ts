/**
 * Example: Using the Fuzzing & Behavioral Analysis Team
 * Demonstrates how to run fuzzing tests on Hyperscape codebase
 */

import { FuzzingBehavioralTeam } from './team-fuzzing';
import { BugCategory, TeamStrategy } from './types';

async function runFuzzingExample() {
  // Initialize the fuzzing team with a strategy
  const strategy: TeamStrategy = {
    focusAreas: [
      BugCategory.DOS,
      BugCategory.TYPE_CONFUSION,
      BugCategory.RACE_CONDITION,
      BugCategory.MEMORY_CORRUPTION,
    ],
    searchPatterns: ['*.ts'],
    scanDepth: 'DEEP',
    priorityFiles: [
      'packages/client/src/utils/SafeMathParser.ts',
      'packages/client/src/utils/InputValidator.ts',
      'packages/plugin-hyperscape/src/managers/guards.ts',
    ],
    learningRate: 0.1,
    explorationRate: 0.3,
  };

  const fuzzingTeam = new FuzzingBehavioralTeam(strategy);

  console.log('=== Fuzzing & Behavioral Analysis Team ===');
  console.log('Team ID:', fuzzingTeam.teamId);
  console.log('Team Name:', fuzzingTeam.name);
  console.log('');

  // Target files for fuzzing
  const targetFiles = [
    '/home/user/hyperscape/packages/client/src/utils/SafeMathParser.ts',
    '/home/user/hyperscape/packages/client/src/utils/InputValidator.ts',
    '/home/user/hyperscape/packages/plugin-hyperscape/src/managers/guards.ts',
  ];

  console.log('Fuzzing target files:');
  targetFiles.forEach(file => console.log(`  - ${file}`));
  console.log('');

  // Run fuzzing campaign
  const startTime = Date.now();
  const bugReports = await fuzzingTeam.scanFiles(targetFiles);
  const duration = Date.now() - startTime;

  // Display results
  console.log('=== Fuzzing Results ===');
  console.log(`Duration: ${duration}ms`);
  console.log(`Total bugs found: ${bugReports.length}`);
  console.log('');

  // Group by severity
  const bySeverity = bugReports.reduce((acc, bug) => {
    acc[bug.severity] = (acc[bug.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Bugs by severity:');
  Object.entries(bySeverity).forEach(([severity, count]) => {
    console.log(`  ${severity}: ${count}`);
  });
  console.log('');

  // Group by category
  const byCategory = bugReports.reduce((acc, bug) => {
    acc[bug.category] = (acc[bug.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Bugs by category:');
  Object.entries(byCategory).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });
  console.log('');

  // Show top 5 critical bugs
  const criticalBugs = bugReports
    .filter(bug => bug.severity === 'CRITICAL')
    .sort((a, b) => b.cvssScore.baseScore - a.cvssScore.baseScore)
    .slice(0, 5);

  if (criticalBugs.length > 0) {
    console.log('=== Top Critical Bugs ===');
    criticalBugs.forEach((bug, idx) => {
      console.log(`\n${idx + 1}. ${bug.title}`);
      console.log(`   File: ${bug.location.file}`);
      console.log(`   Category: ${bug.category}`);
      console.log(`   CVSS: ${bug.cvssScore.baseScore}`);
      console.log(`   Bounty: $${bug.bountyValue}`);
      console.log(`   Description: ${bug.description.substring(0, 100)}...`);
    });
    console.log('');
  }

  // Calculate behavioral metrics
  const testResults = fuzzingTeam.getTestResults();
  if (testResults.length > 0) {
    const metrics = await fuzzingTeam.analyzeBehavior(testResults);

    console.log('=== Behavioral Metrics ===');
    console.log(`Average execution time: ${metrics.averageExecutionTime.toFixed(2)}ms`);
    console.log(`Max execution time: ${metrics.maxExecutionTime.toFixed(2)}ms`);
    console.log(`Total memory delta: ${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
    console.log(`Crash rate: ${(metrics.crashRate * 100).toFixed(2)}%`);
    console.log(`Anomaly rate: ${(metrics.anomalyRate * 100).toFixed(2)}%`);
    console.log('');
  }

  // Calculate total bounty value
  const totalBounty = bugReports.reduce((sum, bug) => sum + bug.bountyValue, 0);
  console.log('=== Bounty Summary ===');
  console.log(`Total bounty value: $${totalBounty.toLocaleString()}`);
  console.log(`Average bounty per bug: $${(totalBounty / bugReports.length).toFixed(2)}`);
  console.log('');

  return bugReports;
}

// Export for use in other scripts
export { runFuzzingExample };

// Run if executed directly
if (require.main === module) {
  runFuzzingExample()
    .then(() => {
      console.log('Fuzzing complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fuzzing failed:', error);
      process.exit(1);
    });
}
