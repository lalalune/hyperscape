#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log(chalk.blue.bold('🔍 Among Us Hyperfy - Comprehensive Validation'));
console.log(chalk.gray('=' .repeat(70)));

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

function warn(name, message) {
  validationResults.warnings.push({ name, message });
  console.log(chalk.yellow(`⚠️  ${name} - ${message}`));
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

console.log(chalk.cyan('\n📁 File Structure Validation'));
console.log(chalk.gray('-' .repeat(40)));

// Core implementation files
check('GameState implementation', fileExists('src/apps/amongus/GameState.ts'), 'GameState.ts missing');
check('Player movement system', fileExists('src/worlds/among-us/systems/MovementSystem.ts'), 'MovementSystem.ts missing');
check('Task system', fileExists('src/worlds/among-us/systems/TaskSystem.ts'), 'TaskSystem.ts missing');
check('Kill system', fileExists('src/worlds/among-us/systems/KillSystem.ts'), 'KillSystem.ts missing');

// Agent files
const agentColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white'];
agentColors.forEach(color => {
  check(`Agent character: ${color}`, fileExists(`src/agents/characters/${color}.json`), `${color}.json missing`);
});

// Action files
const actions = [
  'MoveToTaskAction',
  'StartTaskAction',
  'CompleteTaskAction',
  'KillPlayerAction',
  'ReportBodyAction',
  'VotePlayerAction',
  'ChatMessageAction'
];
actions.forEach(action => {
  check(`Action: ${action}`, fileExists(`src/actions/minigames/${action}.ts`), `${action}.ts missing`);
});

// Provider files
const providers = ['GameStateProvider', 'NearbyPlayersProvider', 'TaskListProvider'];
providers.forEach(provider => {
  check(`Provider: ${provider}`, fileExists(`src/providers/minigames/${provider}.ts`), `${provider}.ts missing`);
});

// Test files
check('GameState tests', fileExists('src/__tests__/core/GameState.test.ts'), 'GameState tests missing');
check('Player movement tests', fileExists('src/__tests__/core/PlayerMovement.test.ts'), 'Movement tests missing');
check('Frontend tests', fileExists('src/__tests__/frontend/GameUI.test.tsx'), 'Frontend tests missing');
check('Agent integration tests', fileExists('src/__tests__/agents/RealAgentIntegration.test.ts'), 'Agent tests missing');

// HTML files
check('Runtime test page', fileExists('public/runtime-test.html'), 'Runtime test page missing');
check('Among Us game page', fileExists('public/amongus.html'), 'Game page missing');

console.log(chalk.cyan('\n🔧 Implementation Validation'));
console.log(chalk.gray('-' .repeat(40)));

// Check GameState implementation
const gameStateCode = readFile('src/apps/amongus/GameState.ts');
if (gameStateCode) {
  check('GameState has phases', gameStateCode.includes('enum GamePhase'), 'GamePhase enum missing');
  check('GameState has player roles', gameStateCode.includes('enum PlayerRole'), 'PlayerRole enum missing');
  check('GameState has kill mechanics', gameStateCode.includes('attemptKill'), 'Kill method missing');
  check('GameState has voting', gameStateCode.includes('castVote'), 'Vote method missing');
  check('GameState has win conditions', gameStateCode.includes('checkWinCondition'), 'Win condition missing');
} else {
  warn('GameState validation', 'Could not read GameState.ts');
}

// Check character configurations
let validCharacters = 0;
agentColors.forEach(color => {
  const charData = readFile(`src/agents/characters/${color}.json`);
  if (charData) {
    try {
      const char = JSON.parse(charData);
      if (char.settings?.gameRole && char.modelProvider) {
        validCharacters++;
      }
    } catch (e) {
      warn(`Character ${color}`, 'Invalid JSON format');
    }
  }
});
check('All characters configured', validCharacters === 8, `Only ${validCharacters}/8 characters properly configured`);

// Check if using real agents vs mock
const realAgentCode = readFile('src/agents/RealAmongUsAgent.ts');
if (realAgentCode) {
  check('Real agent implementation', realAgentCode.includes('extends AgentRuntime'), 'Not extending AgentRuntime');
  check('Has AI decision making', realAgentCode.includes('analyzeAndDecide'), 'No AI decision method');
  check('Uses character data', realAgentCode.includes('this.character'), 'Not using character data');
  check('Uses LLM for decisions', realAgentCode.includes('this.llm.complete'), 'Not using LLM');
} else {
  // Fallback to check old file
  const amongUsAgentCode = readFile('src/agents/among-us-hyperfy-agent.ts');
  if (amongUsAgentCode) {
    check('Real agent implementation', amongUsAgentCode.includes('AgentRuntime'), 'Not using real AgentRuntime');
    check('Has AI decision making', amongUsAgentCode.includes('decideNextAction'), 'No AI decision method');
    check('Uses character data', amongUsAgentCode.includes('this.character'), 'Not using character data');
  } else {
    warn('Agent implementation', 'Could not find real agent implementation');
  }
}

// Check for WebSocket/networking
const hasWebSocket = fileExists('src/servers/AmongUsWebSocketServer.ts') || 
                    fileExists('scripts/start-hyperfy-world-server.js');
check('WebSocket server exists', hasWebSocket, 'No WebSocket server found');

// Check runtime test
const runtimeTestCode = readFile('public/runtime-test.html');
if (runtimeTestCode) {
  check('Runtime test has Three.js', runtimeTestCode.includes('import * as THREE'), 'Three.js not imported');
  check('Runtime test has tests', runtimeTestCode.includes('runAllTests'), 'No test runner found');
  check('Runtime test validates movement', runtimeTestCode.includes('Player Movement'), 'Movement test missing');
  check('Runtime test validates kills', runtimeTestCode.includes('Kill Mechanics'), 'Kill test missing');
}

console.log(chalk.cyan('\n⚙️  Configuration Validation'));
console.log(chalk.gray('-' .repeat(40)));

// Check package.json scripts
const packageJson = JSON.parse(readFile('package.json') || '{}');
const requiredScripts = [
  'minigames',
  'test:runtime',
  'validate',
  'demo:amongus'
];

requiredScripts.forEach(script => {
  check(`Script: ${script}`, packageJson.scripts?.[script], `Missing script: ${script}`);
});

// Check TypeScript configuration
const tsConfig = JSON.parse(readFile('tsconfig.json') || '{}');
check('TypeScript configured', tsConfig.compilerOptions, 'No TypeScript configuration');
check('Path aliases configured', 
  tsConfig.compilerOptions?.paths?.['@elizaos/core'] || tsConfig.compilerOptions?.paths?.['@/*'], 
  'Path aliases not configured');

// Check Vite configuration
const viteConfig = readFile('vite.config.ts');
if (viteConfig) {
  check('Vite has React plugin', viteConfig.includes('@vitejs/plugin-react'), 'React plugin missing');
  check('Vite has path aliases', viteConfig.includes('alias:'), 'Path aliases missing');
}

console.log(chalk.cyan('\n🧪 Test Coverage'));
console.log(chalk.gray('-' .repeat(40)));

// Count test files
const testFiles = fs.readdirSync(path.join(rootDir, 'src/__tests__'), { recursive: true })
  .filter(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx'));

check('Sufficient test coverage', testFiles.length >= 5, `Only ${testFiles.length} test files found`);

// Check test implementation
const gameStateTest = readFile('src/__tests__/core/GameState.test.ts');
if (gameStateTest) {
  const testCount = (gameStateTest.match(/it\(/g) || []).length;
  check('GameState has comprehensive tests', testCount >= 20, `Only ${testCount} tests found`);
}

console.log(chalk.cyan('\n🚨 Common Issues Check'));
console.log(chalk.gray('-' .repeat(40)));

// Check for mock vs real implementation
const scenarioCode = readFile('scenarios/among-us-scenario-browser.ts') || 
                    readFile('scenarios/among-us-runner-browser.ts');
if (scenarioCode) {
  const usesMockAgents = scenarioCode.includes('MockAmongUsAgent');
  if (usesMockAgents) {
    warn('Implementation type', 'Still using mock agents instead of real ElizaOS agents');
  } else {
    check('Using real agents', true, '');
  }
}

// Check for hardcoded messages
const messages = [
  'Has anyone seen',
  'I was in',
  'seems sus',
  'I think it\'s'
];

let foundHardcodedMessages = false;
['src', 'scenarios'].forEach(dir => {
  const files = fs.readdirSync(path.join(rootDir, dir), { recursive: true })
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  
  files.forEach(file => {
    const content = readFile(`${dir}/${file}`);
    if (content) {
      messages.forEach(msg => {
        if (content.includes(msg)) {
          foundHardcodedMessages = true;
        }
      });
    }
  });
});

if (foundHardcodedMessages) {
  warn('Message generation', 'Found hardcoded chat messages - should use AI generation');
}

// Check task durations
const taskSystemCode = readFile('src/worlds/among-us/systems/TaskSystem.ts');
if (taskSystemCode) {
  const hasDurationCheck = taskSystemCode.includes('5000') || taskSystemCode.includes('15000');
  check('Task durations in range', hasDurationCheck, 'Task durations not validated (should be 5-15 seconds)');
}

console.log(chalk.blue('\n📊 Validation Summary'));
console.log(chalk.gray('=' .repeat(70)));

const total = validationResults.passed.length + validationResults.failed.length;
const passRate = Math.round((validationResults.passed.length / total) * 100);

console.log(chalk.green(`✅ Passed: ${validationResults.passed.length}`));
console.log(chalk.red(`❌ Failed: ${validationResults.failed.length}`));
console.log(chalk.yellow(`⚠️  Warnings: ${validationResults.warnings.length}`));
console.log(chalk.blue(`📈 Pass Rate: ${passRate}%`));

if (validationResults.failed.length > 0) {
  console.log(chalk.red('\n❌ Failed Checks:'));
  validationResults.failed.forEach(f => {
    console.log(chalk.red(`   - ${f.name}: ${f.error}`));
  });
}

if (validationResults.warnings.length > 0) {
  console.log(chalk.yellow('\n⚠️  Warnings:'));
  validationResults.warnings.forEach(w => {
    console.log(chalk.yellow(`   - ${w.name}: ${w.message}`));
  });
}

console.log(chalk.cyan('\n📝 Recommendations:'));
if (foundHardcodedMessages) {
  console.log(chalk.gray('1. Replace hardcoded messages with AI-generated responses'));
}
if (!hasWebSocket) {
  console.log(chalk.gray('2. Implement WebSocket server for real multiplayer'));
}
if (validCharacters < 8) {
  console.log(chalk.gray('3. Complete character configurations for all agents'));
}
if (testFiles.length < 10) {
  console.log(chalk.gray('4. Add more comprehensive test coverage'));
}

console.log(chalk.green('\n✅ To run the full test suite:'));
console.log(chalk.gray('   npm run test:validate'));

console.log(chalk.green('\n✅ To see the runtime demo:'));
console.log(chalk.gray('   npm run test:runtime'));

process.exit(validationResults.failed.length > 0 ? 1 : 0);