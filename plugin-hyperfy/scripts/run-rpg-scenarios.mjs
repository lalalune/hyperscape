#!/usr/bin/env node

/**
 * RPG Scenario Runner
 *
 * This script runs the RPG scenarios for the AI Agent Metaverse
 * It can run individual scenarios or sequences of scenarios
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  hyperfyPort: 3000,
  hyperfyWsPort: 3001,
  hyperfyStartupTime: 30000, // 30 seconds for hyperfy to start
  scenarioTimeout: 1800000, // 30 minutes max per scenario
  retryAttempts: 3,
  outputDir: path.join(__dirname, '../scenario-results'),
};

// Available scenarios
const RPG_SCENARIOS = {
  'basic-connection': {
    name: 'Basic RPG Connection Test',
    file: 'rpg-basic-connection.ts',
    description: 'Tests agent connection to Hyperfy RPG world',
    duration: '30 seconds',
    dependencies: ['hyperfy-server'],
  },
  'level-up': {
    name: 'Single Player Level-Up Challenge',
    file: 'rpg-basic-connection.ts',
    description: 'Agent must reach level 2 in 10 minutes',
    duration: '10 minutes',
    dependencies: ['hyperfy-server'],
  },
  'quest-completion': {
    name: 'Quest Completion Challenge',
    file: 'rpg-quest-scenarios.ts',
    description: 'Agent completes fetch/kill/NPC quest',
    duration: '10 minutes',
    dependencies: ['hyperfy-server'],
  },
  trading: {
    name: 'Multi-Agent Trading Challenge',
    file: 'rpg-quest-scenarios.ts',
    description: 'Two agents trade items successfully',
    duration: '10 minutes',
    dependencies: ['hyperfy-server'],
  },
  'cooperative-quest': {
    name: 'Cooperative Quest Challenge',
    file: 'rpg-quest-scenarios.ts',
    description: 'Multiple agents work together on quest',
    duration: '15 minutes',
    dependencies: ['hyperfy-server'],
  },
  'self-improvement': {
    name: 'Self-Improvement Gaming Marathon',
    file: 'rpg-self-improvement.ts',
    description: 'Agent plays with 10-minute assessments',
    duration: '30 minutes',
    dependencies: ['hyperfy-server', 'autocoder'],
  },
  'collaborative-improvement': {
    name: 'Collaborative Self-Improvement Gaming',
    file: 'rpg-self-improvement.ts',
    description: 'Multiple agents collaborate on improvements',
    duration: '40 minutes',
    dependencies: ['hyperfy-server', 'autocoder'],
  },
};

// Scenario sequences
const SCENARIO_SEQUENCES = {
  'quick-test': ['basic-connection', 'level-up'],
  'full-progression': ['basic-connection', 'level-up', 'quest-completion', 'trading'],
  'collaboration-test': ['trading', 'cooperative-quest', 'collaborative-improvement'],
  'complete-suite': Object.keys(RPG_SCENARIOS),
};

class RPGScenarioRunner {
  constructor() {
    this.hyperfyProcess = null;
    this.results = [];
    this.startTime = new Date();
  }

  async run() {
    console.log('🎮 AI Agent Metaverse - RPG Scenario Runner');
    console.log('============================================');

    try {
      // Parse command line arguments
      const args = this.parseArgs();

      // Setup output directory
      this.setupOutputDir();

      // Check dependencies
      await this.checkDependencies();

      // Start Hyperfy server if needed
      if (args.startHyperfy) {
        await this.startHyperfyServer();
      }

      // Run scenarios
      await this.runScenarios(args);

      // Generate report
      this.generateReport();
    } catch (error) {
      console.error('❌ Error running scenarios:', error.message);
      process.exit(1);
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  parseArgs() {
    const args = process.argv.slice(2);
    const config = {
      scenarios: [],
      sequence: null,
      startHyperfy: true,
      skipHyperfyCheck: false,
      continueOnFailure: false,
      outputFile: null,
      verbose: false,
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--scenario':
        case '-s':
          config.scenarios.push(args[++i]);
          break;
        case '--sequence':
        case '-seq':
          config.sequence = args[++i];
          break;
        case '--no-hyperfy':
          config.startHyperfy = false;
          break;
        case '--skip-hyperfy-check':
          config.skipHyperfyCheck = true;
          break;
        case '--continue-on-failure':
        case '-c':
          config.continueOnFailure = true;
          break;
        case '--output':
        case '-o':
          config.outputFile = args[++i];
          break;
        case '--verbose':
        case '-v':
          config.verbose = true;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
        case '--list':
        case '-l':
          this.listScenarios();
          process.exit(0);
          break;
        default:
          if (!arg.startsWith('-')) {
            config.scenarios.push(arg);
          }
          break;
      }
    }

    // Default to quick test if nothing specified
    if (config.scenarios.length === 0 && !config.sequence) {
      config.sequence = 'quick-test';
    }

    // Resolve sequence to scenarios
    if (config.sequence) {
      if (SCENARIO_SEQUENCES[config.sequence]) {
        config.scenarios = SCENARIO_SEQUENCES[config.sequence];
      } else {
        throw new Error(`Unknown sequence: ${config.sequence}`);
      }
    }

    return config;
  }

  showHelp() {
    console.log(`
🎮 RPG Scenario Runner - Help

USAGE:
  node run-rpg-scenarios.mjs [options] [scenarios...]

OPTIONS:
  -s, --scenario <name>     Run specific scenario
  -seq, --sequence <name>   Run predefined sequence
  --no-hyperfy             Don't start Hyperfy server
  --skip-hyperfy-check     Skip checking if Hyperfy is running
  -c, --continue-on-failure Continue running even if scenarios fail
  -o, --output <file>      Output results to file
  -v, --verbose            Verbose output
  -l, --list               List available scenarios and sequences
  -h, --help               Show this help

EXAMPLES:
  # Run quick test sequence
  node run-rpg-scenarios.mjs --sequence quick-test

  # Run specific scenarios
  node run-rpg-scenarios.mjs basic-connection level-up

  # Run all scenarios with autocoder
  node run-rpg-scenarios.mjs --sequence complete-suite

  # Run without starting Hyperfy (assumes it's already running)
  node run-rpg-scenarios.mjs --no-hyperfy basic-connection
`);
  }

  listScenarios() {
    console.log('\n📋 Available Scenarios:');
    console.log('=======================');

    Object.entries(RPG_SCENARIOS).forEach(([key, scenario]) => {
      console.log(`\n🎯 ${key}`);
      console.log(`   Name: ${scenario.name}`);
      console.log(`   Description: ${scenario.description}`);
      console.log(`   Duration: ${scenario.duration}`);
      console.log(`   Dependencies: ${scenario.dependencies.join(', ')}`);
    });

    console.log('\n📦 Available Sequences:');
    console.log('========================');

    Object.entries(SCENARIO_SEQUENCES).forEach(([key, scenarios]) => {
      console.log(`\n🎯 ${key}`);
      console.log(`   Scenarios: ${scenarios.join(' → ')}`);
      const totalScenarios = scenarios.length;
      console.log(`   Total: ${totalScenarios} scenarios`);
    });
  }

  setupOutputDir() {
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
  }

  async checkDependencies() {
    console.log('🔍 Checking dependencies...');

    // Check if elizaos CLI is available
    try {
      execSync('elizaos --version', { stdio: 'ignore' });
      console.log('✅ ElizaOS CLI found');
    } catch (error) {
      throw new Error('ElizaOS CLI not found. Please install and build the project first.');
    }

    // Check if hyperfy package exists
    const hyperfyPath = path.resolve(__dirname, '../../hyperfy');
    if (!fs.existsSync(hyperfyPath)) {
      throw new Error('Hyperfy package not found. Please ensure the hyperfy package is available.');
    }
    console.log('✅ Hyperfy package found');
  }

  async startHyperfyServer() {
    console.log('🚀 Starting Hyperfy server...');

    const hyperfyPath = path.resolve(__dirname, '../../hyperfy');

    try {
      // Check if already running
      try {
        const response = await fetch(`http://localhost:${CONFIG.hyperfyPort}`);
        if (response.ok) {
          console.log('✅ Hyperfy server already running');
          return;
        }
      } catch (_error) {
        // Not running, need to start it
      }

      // Start Hyperfy server
      this.hyperfyProcess = spawn('npm', ['run', 'dev'], {
        cwd: hyperfyPath,
        stdio: 'pipe',
        detached: false,
      });

      this.hyperfyProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running') || output.includes('Ready')) {
          console.log('✅ Hyperfy server started');
        }
      });

      this.hyperfyProcess.stderr.on('data', (data) => {
        console.error('Hyperfy error:', data.toString());
      });

      // Wait for startup
      console.log(`⏳ Waiting ${CONFIG.hyperfyStartupTime / 1000}s for Hyperfy to start...`);
      await new Promise((resolve) => setTimeout(resolve, CONFIG.hyperfyStartupTime));

      // Verify it's running
      try {
        const response = await fetch(`http://localhost:${CONFIG.hyperfyPort}`);
        if (!response.ok) {
          throw new Error('Hyperfy server not responding');
        }
        console.log('✅ Hyperfy server verified running');
      } catch (_error) {
        throw new Error('Failed to verify Hyperfy server startup');
      }
    } catch (error) {
      throw new Error(`Failed to start Hyperfy server: ${error.message}`);
    }
  }

  async runScenarios(args) {
    console.log(`\n🎯 Running ${args.scenarios.length} scenarios...\n`);

    for (let i = 0; i < args.scenarios.length; i++) {
      const scenarioKey = args.scenarios[i];
      const scenario = RPG_SCENARIOS[scenarioKey];

      if (!scenario) {
        console.error(`❌ Unknown scenario: ${scenarioKey}`);
        if (!args.continueOnFailure) break;
        continue;
      }

      console.log(`📍 [${i + 1}/${args.scenarios.length}] ${scenario.name}`);
      console.log(`   Duration: ${scenario.duration}`);
      console.log(`   Description: ${scenario.description}`);

      const result = await this.runSingleScenario(scenarioKey, scenario, args);
      this.results.push(result);

      if (!result.success && !args.continueOnFailure) {
        console.log('❌ Stopping due to failure (use --continue-on-failure to continue)');
        break;
      }

      // Brief pause between scenarios
      if (i < args.scenarios.length - 1) {
        console.log('⏳ Waiting 5 seconds before next scenario...\n');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async runSingleScenario(scenarioKey, scenario, args) {
    const startTime = new Date();
    let success = false;
    let output = '';
    let error = null;

    try {
      console.log(`   🏃 Running scenario...`);

      // Build scenario file path
      const scenarioPath = path.join(__dirname, '../scenarios', scenario.file);

      // Run scenario using elizaos CLI
      const cmd = `elizaos scenario run ${scenarioPath}`;

      if (args.verbose) {
        console.log(`   📝 Command: ${cmd}`);
      }

      output = execSync(cmd, {
        cwd: path.resolve(__dirname, '../../../..'), // Root of monorepo
        encoding: 'utf8',
        timeout: CONFIG.scenarioTimeout,
      });

      success = true;
      console.log(`   ✅ Completed successfully`);
    } catch (err) {
      error = err.message;
      console.log(`   ❌ Failed: ${error}`);

      if (args.verbose) {
        console.log(`   Output: ${err.stdout || 'No output'}`);
        console.log(`   Error: ${err.stderr || 'No error details'}`);
      }
    }

    const endTime = new Date();
    const duration = endTime - startTime;

    return {
      scenarioKey,
      scenario: scenario.name,
      success,
      duration,
      output,
      error,
      startTime,
      endTime,
    };
  }

  generateReport() {
    const endTime = new Date();
    const totalDuration = endTime - this.startTime;
    const successCount = this.results.filter((r) => r.success).length;
    const failureCount = this.results.length - successCount;

    console.log('\n📊 Scenario Results Report');
    console.log('===========================');
    console.log(`📅 Run Date: ${this.startTime.toISOString()}`);
    console.log(`⏱️  Total Duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(
      `📈 Success Rate: ${successCount}/${this.results.length} (${Math.round((successCount / this.results.length) * 100)}%)`
    );

    if (successCount > 0) {
      console.log('\n✅ Successful Scenarios:');
      this.results
        .filter((r) => r.success)
        .forEach((result) => {
          console.log(`   📗 ${result.scenario} (${Math.round(result.duration / 1000)}s)`);
        });
    }

    if (failureCount > 0) {
      console.log('\n❌ Failed Scenarios:');
      this.results
        .filter((r) => !r.success)
        .forEach((result) => {
          console.log(`   📕 ${result.scenario} - ${result.error}`);
        });
    }

    // Save detailed report
    const reportFile = path.join(CONFIG.outputDir, `rpg-scenario-report-${Date.now()}.json`);
    const report = {
      runDate: this.startTime.toISOString(),
      totalDuration,
      successCount,
      failureCount,
      results: this.results,
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportFile}`);
  }

  async cleanup() {
    if (this.hyperfyProcess) {
      console.log('\n🧹 Stopping Hyperfy server...');
      this.hyperfyProcess.kill('SIGTERM');

      // Wait a bit for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (!this.hyperfyProcess.killed) {
        this.hyperfyProcess.kill('SIGKILL');
      }

      console.log('✅ Hyperfy server stopped');
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new RPGScenarioRunner();
  runner.run().catch(console.error);
}

export default RPGScenarioRunner;
