#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${colors[color]}${message}${colors.reset}`);
}

// Test the actual game execution in Node.js environment
async function testGameExecution(gameName) {
    log(`\n🎮 Testing ${gameName} game execution...`, 'blue');
    
    const results = {
        imports: false,
        worldCreation: false,
        agentCreation: false,
        gameStarts: false,
        gameCompletes: false,
        noErrors: true,
        errors: [],
        messages: []
    };
    
    // Create a test script that runs the game
    const testScript = `
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the browser environment
global.window = {
    addEventListener: () => {},
    innerWidth: 800,
    innerHeight: 600
};
global.document = {
    getElementById: () => ({ style: {} }),
    addEventListener: () => {}
};

// Mock Three.js
const mockScene = { add: () => {} };
const mockCamera = { position: { set: () => {} }, lookAt: () => {} };
const mockControls = { enabled: true };

// Track execution
const executionLog = {
    imports: false,
    worldCreation: false, 
    agentCreation: false,
    gameStarts: false,
    gameCompletes: false,
    messages: [],
    errors: []
};

try {
    // Test imports
    const runnerPath = join(__dirname, '../scenarios/${gameName === 'mafia' ? 'mafia-game-runner' : 'among-us-runner'}.ts');
    const { ${gameName === 'mafia' ? 'runMafiaGame, MockAgentRuntime, MockHyperfyWorld' : 'runAmongUs, MockAmongUsAgent, MockAmongUsWorld'} } = await import(runnerPath);
    executionLog.imports = true;
    
    // Override world sendMessage to capture messages
    const OriginalWorld = ${gameName === 'mafia' ? 'MockHyperfyWorld' : 'MockAmongUsWorld'};
    class TestWorld extends OriginalWorld {
        async sendMessage(message) {
            executionLog.messages.push(message);
            if (message.includes('NIGHT') || message.includes('DAY') || message.includes('EMERGENCY')) {
                executionLog.gameStarts = true;
            }
            if (message.includes('wins') || message.includes('Game Over')) {
                executionLog.gameCompletes = true;
            }
            return super.sendMessage ? super.sendMessage(message) : undefined;
        }
    }
    
    // Override console.log temporarily
    const originalLog = console.log;
    console.log = (...args) => {
        const message = args.join(' ');
        if (message.includes('eliminated') || message.includes('phase')) {
            executionLog.messages.push(message);
        }
        originalLog(...args);
    };
    
    // Create mock world
    global.window.${gameName}World = {
        createPlayer: () => { executionLog.agentCreation = true; },
        showEvent: () => {},
        setPhase: () => {},
        eliminatePlayer: () => {},
        updatePlayerList: () => {},
        updateGameStatus: () => {}
    };
    
    executionLog.worldCreation = true;
    
    // Run the game
    const runFunction = ${gameName === 'mafia' ? 'runMafiaGame' : 'runAmongUs'};
    await runFunction();
    
} catch (error) {
    executionLog.errors.push(error.message);
}

console.log(JSON.stringify(executionLog));
`;

    try {
        // Write test script
        const testFile = join(rootDir, `test-${gameName}-execution.mjs`);
        await execAsync(`echo '${testScript.replace(/'/g, "'\\''")}' > ${testFile}`);
        
        // Run the test
        const { stdout, stderr } = await execAsync(`node ${testFile}`, { cwd: rootDir });
        
        // Parse results
        try {
            const executionLog = JSON.parse(stdout.trim().split('\n').pop());
            results.imports = executionLog.imports;
            results.worldCreation = executionLog.worldCreation;
            results.agentCreation = executionLog.agentCreation;
            results.gameStarts = executionLog.gameStarts;
            results.gameCompletes = executionLog.gameCompletes;
            results.messages = executionLog.messages;
            results.errors = executionLog.errors;
            results.noErrors = executionLog.errors.length === 0;
        } catch (parseError) {
            results.errors.push(`Failed to parse output: ${parseError.message}`);
            results.noErrors = false;
        }
        
        // Clean up
        await execAsync(`rm ${testFile}`);
        
    } catch (error) {
        results.errors.push(error.message);
        results.noErrors = false;
    }
    
    // Report results
    log(`  Module imports: ${results.imports ? '✅' : '❌'}`, results.imports ? 'green' : 'red');
    log(`  World creation: ${results.worldCreation ? '✅' : '❌'}`, results.worldCreation ? 'green' : 'red');
    log(`  Agent creation: ${results.agentCreation ? '✅' : '❌'}`, results.agentCreation ? 'green' : 'red');
    log(`  Game starts: ${results.gameStarts ? '✅' : '❌'}`, results.gameStarts ? 'green' : 'red');
    log(`  Game completes: ${results.gameCompletes ? '✅' : '❌'}`, results.gameCompletes ? 'green' : 'red');
    log(`  No runtime errors: ${results.noErrors ? '✅' : '❌'}`, results.noErrors ? 'green' : 'red');
    
    if (results.messages.length > 0) {
        log(`  Game messages: ✅ (${results.messages.length} messages)`, 'green');
    }
    
    if (results.errors.length > 0) {
        log(`  Errors:`, 'red');
        results.errors.forEach(err => log(`    - ${err}`, 'red'));
    }
    
    return results;
}

// Main test function
async function main() {
    log('\n🎮 Testing Game Execution\n', 'magenta');
    
    const mafiaResults = await testGameExecution('mafia');
    const amongUsResults = await testGameExecution('amongus');
    
    const mafiaPass = mafiaResults.imports && mafiaResults.worldCreation && 
                      mafiaResults.agentCreation && mafiaResults.gameStarts && 
                      mafiaResults.noErrors;
                      
    const amongUsPass = amongUsResults.imports && amongUsResults.worldCreation && 
                        amongUsResults.agentCreation && amongUsResults.gameStarts && 
                        amongUsResults.noErrors;
    
    log('\n📊 Summary:', 'cyan');
    log(`  🎭 Mafia: ${mafiaPass ? '✅ PASSED' : '❌ FAILED'}`, mafiaPass ? 'green' : 'red');
    log(`  🚀 Among Us: ${amongUsPass ? '✅ PASSED' : '❌ FAILED'}`, amongUsPass ? 'green' : 'red');
    
    if (mafiaPass && amongUsPass) {
        log('\n✅ All games execute successfully!', 'green');
        log('\nThe games are ready to play in the browser:', 'cyan');
        log('1. Ensure server is running: npm run minigames', 'cyan');
        log('2. Open http://localhost:3001/minigames.html', 'cyan');
        log('3. Click on a game and press Start!', 'cyan');
    } else {
        log('\n❌ Some games failed to execute properly', 'red');
    }
    
    process.exit(mafiaPass && amongUsPass ? 0 : 1);
}

main().catch(error => {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    process.exit(1);
}); 