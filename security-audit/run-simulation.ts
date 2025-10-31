#!/usr/bin/env tsx
/**
 * Bug Hunting Simulation - Main Runner
 * Execute competitive multi-agent security testing
 */

import { BugHuntingSimulation } from './simulation-coordinator';

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🔒 COMPETITIVE BUG HUNTING SIMULATION 🔒                     ║
║                                                                ║
║   Multi-Agent Security Testing Framework                      ║
║   with Reinforcement Learning                                 ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);

  const simulation = new BugHuntingSimulation();

  // Load additional teams
  console.log('\n📦 Loading Teams...\n');

  try {
    await simulation.loadTeam('./team-manual', 'TEAM_MANUAL');
  } catch (error) {
    console.log('⚠️  Team 2 (Manual Review) not available - continuing with Team 1');
  }

  try {
    await simulation.loadTeam('./team-fuzzing', 'TEAM_FUZZING');
  } catch (error) {
    console.log('⚠️  Team 3 (Fuzzing) not available - continuing with available teams');
  }

  // Configuration
  const NUM_ROUNDS = 3;

  console.log(`\n⚙️  Configuration:`);
  console.log(`   Rounds: ${NUM_ROUNDS}`);
  console.log(`   Target: Hyperscape Codebase`);
  console.log(`   Scoring: CVSS v3.1 + Bug Bounty Values`);
  console.log(`   Learning: Reinforcement Learning Enabled\n`);

  // Run simulation rounds
  for (let round = 1; round <= NUM_ROUNDS; round++) {
    await simulation.runRound(round);

    // Small delay between rounds for readability
    if (round < NUM_ROUNDS) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Generate final analysis
  console.log('\n\n🔬 Analyzing Results...\n');
  await simulation.generateFinalAnalysis();

  // Display detailed performance metrics
  console.log('\n📈 Detailed Performance Metrics:\n');

  const performances = simulation.getPerformances();
  for (const [teamId, perf] of performances) {
    console.log(`\n${teamId}:`);
    console.log(`├─ Rounds Completed: ${perf.roundsCompleted}`);
    console.log(`├─ Total Bounty: $${perf.totalBountyValue.toLocaleString()}`);
    console.log(`├─ Valid Bugs: ${perf.validBugs} / ${perf.bugsFound}`);
    console.log(`├─ Severity Breakdown:`);
    console.log(`│  ├─ Critical: ${perf.criticalBugs}`);
    console.log(`│  ├─ High: ${perf.highBugs}`);
    console.log(`│  ├─ Medium: ${perf.mediumBugs}`);
    console.log(`│  └─ Low: ${perf.lowBugs}`);
    console.log(`├─ Avg CVSS: ${perf.cvssAverage.toFixed(2)}`);
    console.log(`├─ FP Rate: ${(perf.falsePositiveRate * 100).toFixed(1)}%`);
    console.log(`├─ Unique Bugs: ${perf.uniqueBugsFound}`);
    console.log(`└─ Avg Discovery Time: ${perf.averageTimeToDiscover.toFixed(0)}ms`);
  }

  console.log(`\n✅ Simulation Complete!`);
  console.log(`\n📄 Full report saved to: security-audit/FINAL-REPORT.md\n`);
}

main().catch(console.error);
