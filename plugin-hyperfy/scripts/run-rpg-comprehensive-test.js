#!/usr/bin/env node

/**
 * Script to run comprehensive RPG tests in Hyperfy
 * This runs the full test suite with observer mode enabled
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Configuration
const HYPERFY_DIR = join(rootDir, 'hyperfy');
const HYPERFY_REPO = 'https://github.com/lalalune/hyperfy.git';

// Test phases configuration
const TEST_PHASES = [
  {
    name: 'Basic Connectivity',
    scenario: 'scenarios/rpg-basic-connection.ts',
    filter: 'Basic RPG Connection Test',
    duration: 5,
    description: 'Testing basic RPG world connection and movement'
  },
  {
    name: 'Combat System',
    scenario: 'scenarios/rpg-comprehensive-test.ts',
    filter: 'RPG Combat System Test',
    duration: 20,
    description: 'Testing all combat mechanics (melee, ranged, magic)'
  },
  {
    name: 'Skills System',
    scenario: 'scenarios/rpg-comprehensive-test.ts',
    filter: 'RPG Skills System Test',
    duration: 30,
    description: 'Testing gathering, processing, and crafting skills'
  },
  {
    name: 'Quest System',
    scenario: 'scenarios/rpg-comprehensive-test.ts',
    filter: 'RPG Quest System Test',
    duration: 25,
    description: 'Testing quest discovery, completion, and rewards'
  },
  {
    name: 'Economy System',
    scenario: 'scenarios/rpg-comprehensive-test.ts',
    filter: 'RPG Economy System Test',
    duration: 15,
    description: 'Testing shops, trading, and economic balance'
  },
  {
    name: 'Agent Swarm',
    scenario: 'scenarios/rpg-comprehensive-test.ts',
    filter: 'RPG Agent Swarm Test',
    duration: 30,
    description: 'Testing multiple agents playing simultaneously'
  }
];

// Process tracking
let hyperfyProcess = null;
let currentPhase = 0;
let phaseResults = [];

// Parse command line arguments
const args = process.argv.slice(2);
const enableObserver = args.includes('--observe') || args.includes('-o');
const skipHyperfy = args.includes('--skip-hyperfy');
const runSpecificPhase = args.find(arg => arg.startsWith('--phase='));
const quickTest = args.includes('--quick');

// Cleanup function
async function cleanup() {
  console.log('\n🧹 Cleaning up...');

  if (hyperfyProcess) {
    console.log('Stopping Hyperfy server...');
    hyperfyProcess.kill('SIGTERM');
  }

  // Display test results
  displayResults();

  process.exit(0);
}

// Handle exit signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function checkHyperfy() {
  console.log('🔍 Checking for Hyperfy installation...');

  if (!existsSync(HYPERFY_DIR)) {
    console.log('📦 Hyperfy not found. Cloning repository...');
    await execAsync(`git clone ${HYPERFY_REPO} ${HYPERFY_DIR}`);

    console.log('📚 Installing Hyperfy dependencies...');
    await execAsync('npm install', { cwd: HYPERFY_DIR });
  } else {
    console.log('✅ Hyperfy found at:', HYPERFY_DIR);
  }
}

async function startHyperfy() {
  console.log('\n🚀 Starting Hyperfy server with RPG world...');

  hyperfyProcess = spawn('npm', ['run', 'dev'], {
    cwd: HYPERFY_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ENABLE_RPG: 'true', // Enable RPG features
      RPG_MODE: 'runescape' // Set to Runescape-like mode
    }
  });

  // Log Hyperfy output
  hyperfyProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output.includes('RPG')) {
      console.log(`[Hyperfy RPG] ${output}`);
    }
  });

  hyperfyProcess.stderr.on('data', (data) => {
    console.error(`[Hyperfy Error] ${data.toString().trim()}`);
  });

  hyperfyProcess.on('error', (error) => {
    console.error('Failed to start Hyperfy:', error);
    cleanup();
  });

  // Wait for Hyperfy to be ready
  console.log('⏳ Waiting for Hyperfy RPG world to initialize (45 seconds)...');
  await new Promise((resolve) => setTimeout(resolve, 45000));

  console.log('✅ Hyperfy RPG world should be running at http://localhost:3000');
}

async function runTestPhase(phase) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 Phase ${currentPhase + 1}/${TEST_PHASES.length}: ${phase.name}`);
  console.log(`📝 ${phase.description}`);
  console.log(`⏱️  Estimated duration: ${phase.duration} minutes`);
  console.log(`${'='.repeat(70)}\n`);

  const startTime = Date.now();
  
  const env = {
    ...process.env,
    ENABLE_OBSERVATION_WINDOW: enableObserver ? 'true' : 'false',
    HYPERFY_WS_URL: 'ws://localhost:3001/ws'
  };

  return new Promise((resolve) => {
    const scenarioProcess = spawn('elizaos', [
      'scenario',
      'run',
      phase.scenario,
      '--filter',
      phase.filter
    ], {
      cwd: rootDir,
      env,
      stdio: 'inherit',
    });

    scenarioProcess.on('error', (error) => {
      console.error(`❌ Phase failed: ${phase.name}`, error);
      phaseResults.push({
        phase: phase.name,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
      resolve(false);
    });

    scenarioProcess.on('exit', (code) => {
      const duration = Date.now() - startTime;
      const success = code === 0;
      
      console.log(`\n${success ? '✅' : '❌'} Phase completed: ${phase.name}`);
      console.log(`Duration: ${Math.round(duration / 1000)}s`);
      
      phaseResults.push({
        phase: phase.name,
        success,
        duration,
        exitCode: code
      });
      
      resolve(success);
    });
  });
}

function displayResults() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(70));

  const totalTests = phaseResults.length;
  const passedTests = phaseResults.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = phaseResults.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nTotal Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`⏱️  Total Duration: ${Math.round(totalDuration / 60000)} minutes`);

  console.log('\nDetailed Results:');
  console.log('-'.repeat(70));

  phaseResults.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const duration = Math.round(result.duration / 1000);
    console.log(`${index + 1}. ${result.phase}: ${status} (${duration}s)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(70));
  
  if (failedTests === 0) {
    console.log('🎉 All tests passed! The RPG system is production-ready.');
  } else {
    console.log('⚠️  Some tests failed. Please review the failures above.');
  }
}

async function main() {
  console.log('🎮 Hyperfy RPG Comprehensive Test Suite');
  console.log('=======================================\n');

  console.log('This suite will test:');
  console.log('1. Basic RPG connectivity and movement');
  console.log('2. Complete combat system (melee, ranged, magic)');
  console.log('3. All skills and crafting systems');
  console.log('4. Quest discovery and completion');
  console.log('5. Economy and trading systems');
  console.log('6. Multi-agent swarm performance\n');

  console.log('Options:');
  console.log('  --observe, -o     Open observation window');
  console.log('  --skip-hyperfy    Skip Hyperfy setup');
  console.log('  --phase=N         Run specific phase (1-6)');
  console.log('  --quick           Run quick tests only\n');

  if (enableObserver) {
    console.log('👁️  Observer mode: ENABLED');
    console.log('   A browser window will show agent activity\n');
  }

  try {
    if (!skipHyperfy) {
      await checkHyperfy();
      await startHyperfy();
    } else {
      console.log("⚡ Skipping Hyperfy setup (assuming it's already running)");
    }

    // Determine which phases to run
    let phasesToRun = TEST_PHASES;
    
    if (runSpecificPhase) {
      const phaseNum = parseInt(runSpecificPhase.split('=')[1]);
      if (phaseNum >= 1 && phaseNum <= TEST_PHASES.length) {
        phasesToRun = [TEST_PHASES[phaseNum - 1]];
        console.log(`\n🎯 Running only phase ${phaseNum}: ${phasesToRun[0].name}`);
      }
    } else if (quickTest) {
      phasesToRun = TEST_PHASES.filter(p => p.duration <= 15);
      console.log('\n⚡ Quick test mode: Running phases under 15 minutes');
    }

    console.log(`\n📋 Total phases to run: ${phasesToRun.length}`);
    const estimatedTime = phasesToRun.reduce((sum, p) => sum + p.duration, 0);
    console.log(`⏱️  Estimated total time: ${estimatedTime} minutes\n`);

    // Wait for user confirmation
    console.log('Press Enter to start testing, or Ctrl+C to cancel...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    // Run test phases
    for (let i = 0; i < phasesToRun.length; i++) {
      currentPhase = i;
      const phase = phasesToRun[i];
      
      await runTestPhase(phase);

      // Brief pause between phases
      if (i < phasesToRun.length - 1) {
        console.log('\n⏸️  Pausing 10 seconds before next phase...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    console.log('\n✅ All test phases completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await cleanup();
  }
}

// Enable better error messages
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the script
main().catch(console.error); 