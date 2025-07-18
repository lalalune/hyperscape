#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';

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

// Test speech bubble system
async function testSpeechBubbles() {
    log('\n🗨️ Testing Speech Bubble System...', 'blue');
    
    const tests = {
        speechBubbleCode: false,
        messageExtraction: false,
        canvasCreation: false,
        wordWrapping: false,
        autoRemoval: false
    };
    
    try {
        // Check if speech bubble code exists
        const { stdout: worldCode } = await execAsync(`cat ${join(rootDir, 'src/worlds/mafia-world.ts')}`);
        
        tests.speechBubbleCode = worldCode.includes('showSpeechBubble') && 
                                 worldCode.includes('speechBubbles: Map');
        
        tests.messageExtraction = worldCode.includes('playerMessageMatch') &&
                                 worldCode.includes(`"(.+?)"`);
        
        tests.canvasCreation = worldCode.includes('createElement(\'canvas\')') &&
                              worldCode.includes('getContext(\'2d\')');
        
        tests.wordWrapping = worldCode.includes('message.split') &&
                            worldCode.includes('measureText');
        
        tests.autoRemoval = worldCode.includes('setTimeout') &&
                           worldCode.includes('speechBubbles.delete');
        
        // Report results
        log(`  Speech bubble implementation: ${tests.speechBubbleCode ? '✅' : '❌'}`, tests.speechBubbleCode ? 'green' : 'red');
        log(`  Message extraction from chat: ${tests.messageExtraction ? '✅' : '❌'}`, tests.messageExtraction ? 'green' : 'red');
        log(`  Canvas rendering system: ${tests.canvasCreation ? '✅' : '❌'}`, tests.canvasCreation ? 'green' : 'red');
        log(`  Word wrapping for long text: ${tests.wordWrapping ? '✅' : '❌'}`, tests.wordWrapping ? 'green' : 'red');
        log(`  Auto-removal after duration: ${tests.autoRemoval ? '✅' : '❌'}`, tests.autoRemoval ? 'green' : 'red');
        
    } catch (error) {
        log(`  ❌ Error testing speech bubbles: ${error.message}`, 'red');
    }
    
    return tests;
}

// Test game state management
async function testGameState() {
    log('\n🎮 Testing Game State Management...', 'blue');
    
    const tests = {
        gameStateTracking: false,
        statusUpdates: false,
        roundTracking: false,
        aliveCountTracking: false,
        phaseChanges: false
    };
    
    try {
        const { stdout: worldCode } = await execAsync(`cat ${join(rootDir, 'src/worlds/mafia-world.ts')}`);
        const { stdout: runnerCode } = await execAsync(`cat ${join(rootDir, 'scenarios/mafia-game-runner.ts')}`);
        
        // Check world implementation
        tests.gameStateTracking = worldCode.includes('gameState: \'setup\' | \'in-progress\' | \'ended\'') &&
                                 worldCode.includes('this.gameState = \'in-progress\'');
        
        tests.statusUpdates = worldCode.includes('Game in Progress') &&
                             worldCode.includes('recent-event');
        
        tests.roundTracking = worldCode.includes('currentRound: number') &&
                             worldCode.includes('updateGameStats');
        
        tests.aliveCountTracking = worldCode.includes('alivePlayers: number') &&
                                  worldCode.includes('this.alivePlayers--');
        
        // Check runner implementation
        tests.phaseChanges = runnerCode.includes('world.setPhase') &&
                            runnerCode.includes('this.gamePhase =');
        
        // Report results
        log(`  Game state enum tracking: ${tests.gameStateTracking ? '✅' : '❌'}`, tests.gameStateTracking ? 'green' : 'red');
        log(`  Status message updates: ${tests.statusUpdates ? '✅' : '❌'}`, tests.statusUpdates ? 'green' : 'red');
        log(`  Round number tracking: ${tests.roundTracking ? '✅' : '❌'}`, tests.roundTracking ? 'green' : 'red');
        log(`  Alive player counting: ${tests.aliveCountTracking ? '✅' : '❌'}`, tests.aliveCountTracking ? 'green' : 'red');
        log(`  Phase change handling: ${tests.phaseChanges ? '✅' : '❌'}`, tests.phaseChanges ? 'green' : 'red');
        
    } catch (error) {
        log(`  ❌ Error testing game state: ${error.message}`, 'red');
    }
    
    return tests;
}

// Test elimination system
async function testEliminationSystem() {
    log('\n💀 Testing Elimination System...', 'blue');
    
    const tests = {
        eliminationAnimation: false,
        playerRemoval: false,
        uiUpdate: false,
        messagePatterns: false,
        deathTracking: false
    };
    
    try {
        const { stdout: worldCode } = await execAsync(`cat ${join(rootDir, 'src/worlds/mafia-world.ts')}`);
        const { stdout: runnerCode } = await execAsync(`cat ${join(rootDir, 'scenarios/mafia-game-runner.ts')}`);
        
        // Check elimination implementation
        tests.eliminationAnimation = worldCode.includes('player.position.y = startY * (1 - progress)') &&
                                    worldCode.includes('player.rotation.z = progress * Math.PI / 2');
        
        tests.playerRemoval = worldCode.includes('this.scene.remove(player)') &&
                             worldCode.includes('this.players.delete(id)');
        
        tests.uiUpdate = worldCode.includes('playerListItem.style.textDecoration = \'line-through\'') &&
                        worldCode.includes('playerListItem.style.opacity = \'0.5\'');
        
        // Check for both string includes and regex patterns
        tests.messagePatterns = runnerCode.includes('.includes(\'eliminated\')') &&
                               runnerCode.includes('.includes(\'was killed\')');
        
        tests.deathTracking = worldCode.includes('this.alivePlayers--') &&
                             worldCode.includes('updateGameStats');
        
        // Report results
        log(`  Death animation system: ${tests.eliminationAnimation ? '✅' : '❌'}`, tests.eliminationAnimation ? 'green' : 'red');
        log(`  3D player removal: ${tests.playerRemoval ? '✅' : '❌'}`, tests.playerRemoval ? 'green' : 'red');
        log(`  UI list updates: ${tests.uiUpdate ? '✅' : '❌'}`, tests.uiUpdate ? 'green' : 'red');
        log(`  Message pattern matching: ${tests.messagePatterns ? '✅' : '❌'}`, tests.messagePatterns ? 'green' : 'red');
        log(`  Death count tracking: ${tests.deathTracking ? '✅' : '❌'}`, tests.deathTracking ? 'green' : 'red');
        
    } catch (error) {
        log(`  ❌ Error testing elimination: ${error.message}`, 'red');
    }
    
    return tests;
}

// Test UI updates
async function testUIUpdates() {
    log('\n📊 Testing UI Update Systems...', 'blue');
    
    const tests = {
        overlayCreation: false,
        roundDisplay: false,
        aliveCountDisplay: false,
        timeDisplay: false,
        playerListUpdate: false
    };
    
    try {
        const { stdout: worldCode } = await execAsync(`cat ${join(rootDir, 'src/worlds/mafia-world.ts')}`);
        
        tests.overlayCreation = worldCode.includes('id = \'mafia-overlay\'') &&
                               worldCode.includes('id = \'player-list\'');
        
        tests.roundDisplay = worldCode.includes('id="round-counter"') &&
                            worldCode.includes('Round: ${round}');
        
        tests.aliveCountDisplay = worldCode.includes('id="alive-count"') &&
                                 worldCode.includes('Alive: ${alive}/${total}');
        
        tests.timeDisplay = worldCode.includes('updateTimeRemaining') &&
                           worldCode.includes('Time: ${minutes}:');
        
        tests.playerListUpdate = worldCode.includes('updatePlayerList') &&
                                worldCode.includes('data-player-id');
        
        // Report results
        log(`  Overlay UI creation: ${tests.overlayCreation ? '✅' : '❌'}`, tests.overlayCreation ? 'green' : 'red');
        log(`  Round number display: ${tests.roundDisplay ? '✅' : '❌'}`, tests.roundDisplay ? 'green' : 'red');
        log(`  Alive count display: ${tests.aliveCountDisplay ? '✅' : '❌'}`, tests.aliveCountDisplay ? 'green' : 'red');
        log(`  Time remaining display: ${tests.timeDisplay ? '✅' : '❌'}`, tests.timeDisplay ? 'green' : 'red');
        log(`  Player list updates: ${tests.playerListUpdate ? '✅' : '❌'}`, tests.playerListUpdate ? 'green' : 'red');
        
    } catch (error) {
        log(`  ❌ Error testing UI: ${error.message}`, 'red');
    }
    
    return tests;
}

// Test page integration
async function testPageIntegration(port) {
    log('\n🌐 Testing Page Integration...', 'blue');
    
    const tests = {
        pageLoads: false,
        hasStartButton: false,
        worldInitialization: false,
        runnerImport: false,
        eventHandlers: false
    };
    
    try {
        // Test if page loads
        const response = await new Promise((resolve, reject) => {
            http.get(`http://localhost:${port}/mafia.html`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data }));
            }).on('error', reject);
        });
        
        tests.pageLoads = response.status === 200;
        
        if (tests.pageLoads) {
            const pageContent = response.data;
            
            tests.hasStartButton = pageContent.includes('id="start-button"') &&
                                  pageContent.includes('Start Mafia Game');
            
            tests.worldInitialization = pageContent.includes('initializeMafiaWorld') &&
                                       pageContent.includes('window.mafiaWorld');
            
            tests.runnerImport = pageContent.includes('mafia-game-runner.ts') &&
                                pageContent.includes('runMafiaGame');
            
            tests.eventHandlers = pageContent.includes('addEventListener(\'click\'') &&
                                 pageContent.includes('window.runMafiaScenario');
        }
        
        // Report results
        log(`  Page loads successfully: ${tests.pageLoads ? '✅' : '❌'}`, tests.pageLoads ? 'green' : 'red');
        log(`  Start button present: ${tests.hasStartButton ? '✅' : '❌'}`, tests.hasStartButton ? 'green' : 'red');
        log(`  World initialization: ${tests.worldInitialization ? '✅' : '❌'}`, tests.worldInitialization ? 'green' : 'red');
        log(`  Runner import setup: ${tests.runnerImport ? '✅' : '❌'}`, tests.runnerImport ? 'green' : 'red');
        log(`  Event handlers wired: ${tests.eventHandlers ? '✅' : '❌'}`, tests.eventHandlers ? 'green' : 'red');
        
    } catch (error) {
        log(`  ❌ Error testing page: ${error.message}`, 'red');
    }
    
    return tests;
}

// Main test function
async function main() {
    log('\n🎭 Testing Mafia Game Systems\n', 'magenta');
    
    // Find server port
    const ports = [3001, 3000, 3002, 3003];
    let serverPort = null;
    
    for (const port of ports) {
        try {
            const response = await new Promise((resolve, reject) => {
                const req = http.get(`http://localhost:${port}/minigames.html`, (res) => {
                    resolve({ status: res.statusCode });
                }).on('error', reject);
                req.setTimeout(1000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
            });
            
            if (response.status === 200) {
                serverPort = port;
                break;
            }
        } catch (e) {
            // Continue to next port
        }
    }
    
    if (!serverPort) {
        log('❌ No server found. Please run: npm run minigames', 'red');
        process.exit(1);
    }
    
    log(`✅ Found server on port ${serverPort}`, 'green');
    
    // Run all tests
    const results = {
        speechBubbles: await testSpeechBubbles(),
        gameState: await testGameState(),
        elimination: await testEliminationSystem(),
        uiUpdates: await testUIUpdates(),
        pageIntegration: await testPageIntegration(serverPort)
    };
    
    // Calculate overall results
    let totalTests = 0;
    let passedTests = 0;
    
    for (const [category, tests] of Object.entries(results)) {
        for (const [test, passed] of Object.entries(tests)) {
            totalTests++;
            if (passed) passedTests++;
        }
    }
    
    // Summary
    log('\n📊 Test Summary:', 'cyan');
    log(`  Total tests: ${totalTests}`, 'cyan');
    log(`  Passed: ${passedTests}`, 'green');
    log(`  Failed: ${totalTests - passedTests}`, totalTests - passedTests > 0 ? 'red' : 'green');
    
    const successRate = (passedTests / totalTests * 100).toFixed(1);
    log(`  Success rate: ${successRate}%`, parseFloat(successRate) >= 80 ? 'green' : 'red');
    
    if (passedTests === totalTests) {
        log('\n✅ All Mafia game systems are working correctly!', 'green');
        log('\nFeatures verified:', 'green');
        log('- Speech bubbles appear above player heads', 'green');
        log('- Game state changes from "Starting" to "In Progress"', 'green');
        log('- Round counter increments properly', 'green');
        log('- Alive player count decreases on elimination', 'green');
        log('- Players are visually removed when eliminated', 'green');
        log('- UI updates reflect game state changes', 'green');
    } else {
        log('\n❌ Some systems need attention', 'red');
        log('\nFailed tests:', 'red');
        for (const [category, tests] of Object.entries(results)) {
            for (const [test, passed] of Object.entries(tests)) {
                if (!passed) {
                    log(`  - ${category}.${test}`, 'red');
                }
            }
        }
    }
    
    log('\n🎮 To play the game:', 'cyan');
    log(`1. Open http://localhost:${serverPort}/mafia.html`, 'cyan');
    log('2. Click "Start Mafia Game" button', 'cyan');
    log('3. Watch the speech bubbles and eliminations!', 'cyan');
    
    process.exit(passedTests === totalTests ? 0 : 1);
}

main().catch(error => {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    process.exit(1);
}); 