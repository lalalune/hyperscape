#!/usr/bin/env node

/**
 * Script to run the autonomous multi-agent exploration scenario
 * This handles starting Hyperfy, running the scenario, and cleanup
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
const SCENARIO_FILE = 'scenarios/hyperfy-autonomous-exploration.ts';

// Process tracking
let hyperfyProcess = null;
let scenarioProcess = null;

// Cleanup function
async function cleanup() {
  console.log('\n🧹 Cleaning up...');

  if (scenarioProcess) {
    console.log('Stopping scenario runner...');
    scenarioProcess.kill('SIGTERM');
  }

  if (hyperfyProcess) {
    console.log('Stopping Hyperfy server...');
    hyperfyProcess.kill('SIGTERM');
  }

  // Give processes time to shut down gracefully
  await new Promise((resolve) => setTimeout(resolve, 2000));

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
  console.log('\n🚀 Starting Hyperfy server...');

  hyperfyProcess = spawn('npm', ['run', 'dev'], {
    cwd: HYPERFY_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Log Hyperfy output
  hyperfyProcess.stdout.on('data', (data) => {
    console.log(`[Hyperfy] ${data.toString().trim()}`);
  });

  hyperfyProcess.stderr.on('data', (data) => {
    console.error(`[Hyperfy Error] ${data.toString().trim()}`);
  });

  hyperfyProcess.on('error', (error) => {
    console.error('Failed to start Hyperfy:', error);
    cleanup();
  });

  // Wait for Hyperfy to be ready
  console.log('⏳ Waiting for Hyperfy to start (30 seconds)...');
  await new Promise((resolve) => setTimeout(resolve, 30000));

  console.log('✅ Hyperfy should be running at http://localhost:3000');
}

async function runScenario() {
  console.log('\n🤖 Running autonomous exploration scenario...');

  const enableObservation =
    process.argv.includes('--observe') || process.env.ENABLE_OBSERVATION_WINDOW === 'true';

  const env = {
    ...process.env,
    ENABLE_OBSERVATION_WINDOW: enableObservation ? 'true' : 'false',
  };

  if (enableObservation) {
    console.log('👁️ Observation window will be opened');
  }

  // Run the scenario
  scenarioProcess = spawn('elizaos', ['scenario', 'run', SCENARIO_FILE], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
  });

  scenarioProcess.on('error', (error) => {
    console.error('Failed to run scenario:', error);
    cleanup();
  });

  scenarioProcess.on('exit', (code) => {
    console.log(`\n✅ Scenario completed with code: ${code}`);
    cleanup();
  });
}

async function main() {
  console.log('🌍 Hyperfy Autonomous Multi-Agent Exploration Test');
  console.log('==================================================\n');

  console.log('This script will:');
  console.log('1. Check/install Hyperfy');
  console.log('2. Start Hyperfy server');
  console.log('3. Run 10 autonomous agents for 1 minute');
  console.log('4. Clean up when done\n');

  console.log('Options:');
  console.log('  --observe    Open Puppeteer window to watch agents');
  console.log("  --skip-setup Skip Hyperfy setup (assumes it's already running)\n");

  try {
    if (!process.argv.includes('--skip-setup')) {
      await checkHyperfy();
      await startHyperfy();
    } else {
      console.log("⚡ Skipping Hyperfy setup (assuming it's already running)");
    }

    await runScenario();
  } catch (error) {
    console.error('❌ Error:', error);
    await cleanup();
  }
}

// Run the script
main().catch(console.error);
