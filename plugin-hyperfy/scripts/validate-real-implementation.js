#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log(chalk.blue.bold('🔍 Among Us Real Implementation Validator'));
console.log(chalk.gray('=' .repeat(60)));

const validationResults = {
  passed: [],
  failed: [],
  warnings: []
};

function check(name, condition, errorMsg) {
  if (condition) {
    validationResults.passed.push(name);
    console.log(chalk.green(`✅ ${name}`));
  } else {
    validationResults.failed.push({ name, error: errorMsg });
    console.log(chalk.red(`❌ ${name} - ${errorMsg}`));
  }
}

function fileExists(filePath) {
  return fs.existsSync(path.join(rootDir, filePath));
}

function readFile(filePath) {
  try {
    return fs.readFileSync(path.join(rootDir, filePath), 'utf8');
  } catch (e) {
    return null;
  }
}

async function runCommand(command, args) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { 
      cwd: rootDir,
      stdio: 'pipe'
    });
    
    let output = '';
    proc.stdout.on('data', (data) => output += data);
    proc.stderr.on('data', (data) => output += data);
    
    proc.on('close', (code) => {
      resolve({ code, output });
    });
  });
}

async function validateImplementation() {
  console.log(chalk.cyan('\n📁 Core Implementation Files'));
  console.log(chalk.gray('-' .repeat(40)));

  // Check GameState implementation
  check('GameState.ts exists', fileExists('src/apps/amongus/GameState.ts'), 'Core game logic missing');
  const gameStateCode = readFile('src/apps/amongus/GameState.ts');
  if (gameStateCode) {
    check('GameState is not empty', gameStateCode.length > 100, 'GameState.ts is empty');
    check('GameState has GamePhase enum', gameStateCode.includes('export enum GamePhase'), 'Missing GamePhase');
    check('GameState has PlayerRole enum', gameStateCode.includes('export enum PlayerRole'), 'Missing PlayerRole');
    check('GameState has attemptKill method', gameStateCode.includes('attemptKill('), 'Missing kill mechanics');
    check('GameState has checkWinCondition', gameStateCode.includes('checkWinCondition('), 'Missing win conditions');
  }

  // Check Real Agent implementation
  check('RealAmongUsAgent.ts exists', fileExists('src/agents/RealAmongUsAgent.ts'), 'Real agent missing');
  const agentCode = readFile('src/agents/RealAmongUsAgent.ts');
  if (agentCode) {
    check('Uses AgentRuntime', agentCode.includes('extends AgentRuntime'), 'Not extending AgentRuntime');
    check('Has LLM integration', agentCode.includes('this.llm.complete'), 'No LLM usage found');
    check('Has decision making', agentCode.includes('analyzeAndDecide'), 'No AI decision method');
    check('No hardcoded messages', !agentCode.includes('"I was in electrical"'), 'Found hardcoded messages');
  }

  // Check WebSocket Server
  check('WebSocket server exists', fileExists('src/servers/AmongUsWebSocketServer.ts'), 'Server missing');
  const serverCode = readFile('src/servers/AmongUsWebSocketServer.ts');
  if (serverCode) {
    check('Uses WebSocketServer', serverCode.includes('WebSocketServer'), 'Not using WebSocketServer');
    check('Has game state', serverCode.includes('GameState'), 'No GameState in server');
    check('Handles all messages', serverCode.includes('handleMessage'), 'Message handling missing');
  }

  // Check Game Service
  check('HyperfyGameService exists', fileExists('src/services/HyperfyGameService.ts'), 'Game service missing');

  // Check launcher scripts
  check('Agent launcher exists', fileExists('scripts/launch-real-among-us-agents.js'), 'Agent launcher missing');
  check('Server starter exists', fileExists('scripts/start-amongus-server.js'), 'Server starter missing');

  console.log(chalk.cyan('\n🧪 Implementation Quality'));
  console.log(chalk.gray('-' .repeat(40)));

  // Check for mock implementations
  const scenarioFiles = fs.readdirSync(path.join(rootDir, 'scenarios')).filter(f => f.includes('among'));
  let hasMockAgents = false;
  scenarioFiles.forEach(file => {
    const content = readFile(`scenarios/${file}`);
    if (content && content.includes('MockAmongUsAgent')) {
      hasMockAgents = true;
    }
  });
  check('No mock agents in use', !hasMockAgents, 'Still using MockAmongUsAgent');

  // Check character files
  const characterColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white'];
  let validCharacters = 0;
  characterColors.forEach(color => {
    if (fileExists(`src/agents/characters/${color}.json`)) {
      validCharacters++;
    }
  });
  check('All 8 characters exist', validCharacters === 8, `Only ${validCharacters}/8 characters found`);

  // Check for real networking
  const launcherCode = readFile('scripts/launch-real-among-us-agents.js');
  if (launcherCode) {
    check('Uses WebSocket client', launcherCode.includes('new WebSocket'), 'No WebSocket client');
    check('Connects to server', launcherCode.includes('ws://'), 'No server connection');
    check('Uses real AgentRuntime', launcherCode.includes('new AgentRuntime'), 'No AgentRuntime usage');
  }

  console.log(chalk.cyan('\n🔌 Dependencies'));
  console.log(chalk.gray('-' .repeat(40)));

  const packageJson = JSON.parse(readFile('package.json') || '{}');
  check('Has ws dependency', packageJson.dependencies?.ws || packageJson.devDependencies?.ws, 'WebSocket library missing');
  check('Has required scripts', packageJson.scripts?.['server:amongus'], 'Server script missing');
  check('Has agent script', packageJson.scripts?.['agents:amongus'], 'Agent launcher script missing');

  console.log(chalk.cyan('\n🚀 Runtime Test'));
  console.log(chalk.gray('-' .repeat(40)));

  // Try to compile TypeScript
  console.log(chalk.yellow('Checking TypeScript compilation...'));
  const tscResult = await runCommand('npx', ['tsc', '--noEmit']);
  check('TypeScript compiles', tscResult.code === 0, 'TypeScript compilation errors');

  // Check if server can start
  console.log(chalk.yellow('Testing server startup...'));
  const serverProc = spawn('node', ['scripts/start-amongus-server.js'], {
    cwd: rootDir,
    stdio: 'pipe'
  });

  await new Promise(resolve => setTimeout(resolve, 2000));
  const serverRunning = !serverProc.killed;
  serverProc.kill();
  
  check('Server can start', serverRunning, 'Server failed to start');

  console.log(chalk.blue('\n📊 Validation Summary'));
  console.log(chalk.gray('=' .repeat(60)));

  const total = validationResults.passed.length + validationResults.failed.length;
  const passRate = Math.round((validationResults.passed.length / total) * 100);

  console.log(chalk.green(`✅ Passed: ${validationResults.passed.length}`));
  console.log(chalk.red(`❌ Failed: ${validationResults.failed.length}`));
  console.log(chalk.blue(`📈 Pass Rate: ${passRate}%`));

  if (validationResults.failed.length > 0) {
    console.log(chalk.red('\n❌ Failed Checks:'));
    validationResults.failed.forEach(f => {
      console.log(chalk.red(`   - ${f.name}: ${f.error}`));
    });
  }

  if (passRate === 100) {
    console.log(chalk.green.bold('\n🎉 VALIDATION PASSED! The real implementation is complete!'));
    console.log(chalk.cyan('\n🚀 To run the game:'));
    console.log(chalk.gray('1. Start the server: npm run server:amongus'));
    console.log(chalk.gray('2. Launch agents: npm run agents:amongus'));
  } else {
    console.log(chalk.red.bold('\n❌ VALIDATION FAILED! Some components are missing or incorrect.'));
  }

  process.exit(validationResults.failed.length > 0 ? 1 : 0);
}

validateImplementation().catch(console.error); 