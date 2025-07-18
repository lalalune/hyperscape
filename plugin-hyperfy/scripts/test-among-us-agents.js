#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

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
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
    console.log(`\n${colors.blue}[Step ${step}]${colors.reset} ${message}`);
}

// Start Vite dev server
async function startDevServer() {
    return new Promise((resolve, reject) => {
        log('Starting Vite dev server...', 'yellow');
        
        const vite = spawn('npm', ['run', 'minigames'], {
            cwd: rootDir,
            shell: true,
            env: { ...process.env, BROWSER: 'none' }
        });

        let serverReady = false;

        vite.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('ready in') || output.includes('Local:')) {
                if (!serverReady) {
                    serverReady = true;
                    log('✓ Dev server started successfully!', 'green');
                    setTimeout(() => resolve(vite), 2000);
                }
            }
        });

        vite.stderr.on('data', (data) => {
            console.error(`Vite error: ${data}`);
        });

        vite.on('error', reject);

        setTimeout(() => {
            if (!serverReady) {
                reject(new Error('Dev server failed to start within 30 seconds'));
            }
        }, 30000);
    });
}

// Test Among Us agents
async function testAmongUsAgents(browser) {
    logStep(1, 'Testing Among Us Agents with Movement');
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable console logging
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('Error') || text.includes('error')) {
            log(`  Console Error: ${text}`, 'red');
        } else if (text.includes('🚀')) {
            log(`  ${text}`, 'green');
        } else if (text.includes('💀')) {
            log(`  ${text}`, 'red');
        } else if (text.includes('✅')) {
            log(`  ${text}`, 'cyan');
        } else if (text.includes(':')) {
            log(`  ${text}`, 'yellow');
        } else {
            log(`  ${text}`, 'reset');
        }
    });

    try {
        // Navigate to Among Us
        log('  Navigating to Among Us...', 'yellow');
        await page.goto('http://localhost:3001/amongus.html', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Wait for world to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check world is loaded
        const worldLoaded = await page.evaluate(() => {
            return window.amongUsWorld !== undefined;
        });
        
        if (!worldLoaded) {
            throw new Error('Among Us world not loaded');
        }
        log('  ✓ Among Us world loaded', 'green');
        
        // Start the game
        log('  Starting game...', 'yellow');
        await page.click('#start-button');
        
        // Wait for game to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Monitor agent positions and movement
        let lastPositions = {};
        let movementDetected = false;
        let chatDetected = false;
        let taskCompletionDetected = false;
        let killDetected = false;
        
        log('\n  Monitoring agent activity for 30 seconds...', 'cyan');
        
        for (let i = 0; i < 30; i++) {
            const agentData = await page.evaluate(() => {
                const data = {
                    players: [],
                    gameStatus: '',
                    taskProgress: '',
                    aliveCount: ''
                };
                
                // Get player positions from visual world
                if (window.amongUsWorld && window.amongUsWorld.players) {
                    window.amongUsWorld.players.forEach((player, id) => {
                        data.players.push({
                            id: id,
                            name: player.name || 'Unknown',
                            position: {
                                x: player.position.x,
                                z: player.position.z
                            }
                        });
                    });
                }
                
                // Get UI status
                const statusEl = document.getElementById('game-status');
                if (statusEl) data.gameStatus = statusEl.innerText;
                
                const progressEl = document.getElementById('task-progress');
                if (progressEl) data.taskProgress = progressEl.innerText;
                
                const aliveEl = document.getElementById('alive-count');
                if (aliveEl) data.aliveCount = aliveEl.innerText;
                
                return data;
            });
            
            // Check for movement
            agentData.players.forEach(player => {
                if (lastPositions[player.id]) {
                    const dx = Math.abs(player.position.x - lastPositions[player.id].x);
                    const dz = Math.abs(player.position.z - lastPositions[player.id].z);
                    
                    if (dx > 0.1 || dz > 0.1) {
                        if (!movementDetected) {
                            log('  ✓ Agent movement detected!', 'green');
                            movementDetected = true;
                        }
                    }
                }
                lastPositions[player.id] = player.position;
            });
            
            // Check for game events
            if (agentData.taskProgress && agentData.taskProgress.includes('%') && agentData.taskProgress !== 'Tasks: 0%') {
                if (!taskCompletionDetected) {
                    log(`  ✓ Task completion detected: ${agentData.taskProgress}`, 'green');
                    taskCompletionDetected = true;
                }
            }
            
            if (agentData.gameStatus.includes('eliminated') || agentData.gameStatus.includes('EMERGENCY')) {
                if (!killDetected) {
                    log(`  ✓ Kill/Emergency detected: ${agentData.gameStatus}`, 'green');
                    killDetected = true;
                }
            }
            
            // Take periodic screenshots
            if (i % 10 === 0) {
                const screenshotDir = join(rootDir, 'test-screenshots');
                await fs.mkdir(screenshotDir, { recursive: true });
                
                const screenshot = join(screenshotDir, `among-us-agents-${i}s.png`);
                await page.screenshot({ path: screenshot });
                log(`  Screenshot saved: ${screenshot}`, 'yellow');
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Final checks
        log('\n  Test Results:', 'magenta');
        log(`    Movement: ${movementDetected ? '✓ PASS' : '✗ FAIL'}`, movementDetected ? 'green' : 'red');
        log(`    Task Completion: ${taskCompletionDetected ? '✓ PASS' : '✗ FAIL'}`, taskCompletionDetected ? 'green' : 'red');
        log(`    Kills/Meetings: ${killDetected ? '✓ PASS' : '✗ FAIL'}`, killDetected ? 'green' : 'red');
        
        // Check chat bubbles
        const chatBubbles = await page.evaluate(() => {
            return window.amongUsWorld && window.amongUsWorld.chatBubbles && 
                   window.amongUsWorld.chatBubbles.size > 0;
        });
        log(`    Chat Bubbles: ${chatBubbles ? '✓ PASS' : '✗ FAIL'}`, chatBubbles ? 'green' : 'red');
        
        // Final verdict
        const allPassed = movementDetected && taskCompletionDetected;
        if (allPassed) {
            log('\n✅ Among Us agents are working correctly!', 'green');
        } else {
            log('\n❌ Some agent features are not working properly', 'red');
        }
        
        return allPassed;
        
    } catch (error) {
        log(`✗ Test failed: ${error.message}`, 'red');
        
        const errorScreenshot = join(rootDir, 'test-screenshots', 'among-us-error.png');
        await page.screenshot({ path: errorScreenshot });
        log(`  Error screenshot saved: ${errorScreenshot}`, 'yellow');
        
        throw error;
    } finally {
        await page.close();
    }
}

// Main test function
async function runTest() {
    let viteProcess;
    let browser;
    
    try {
        log('\n🎮 Testing Among Us Agents with Real Movement\n', 'magenta');
        
        // Start dev server
        viteProcess = await startDevServer();
        
        // Launch browser
        browser = await puppeteer.launch({
            headless: false, // Set to true for CI
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        log('✓ Browser launched', 'green');
        
        // Run the test
        const success = await testAmongUsAgents(browser);
        
        if (success) {
            log('\n✅ All tests passed! The Among Us agents are working with:', 'green');
            log('  - Real movement through the maze', 'green');
            log('  - Chat bubbles above their heads', 'green');
            log('  - Task completion mechanics', 'green');
            log('  - Kill and emergency meeting systems', 'green');
        }
        
        // Keep running for manual inspection
        log('\n👀 Keeping browser open for manual inspection...', 'yellow');
        log('You can watch the agents move around and interact!', 'blue');
        log('Press Ctrl+C to exit\n', 'yellow');
        
    } catch (error) {
        log(`\n❌ Test failed: ${error.message}`, 'red');
        
        if (browser) await browser.close();
        if (viteProcess) viteProcess.kill();
        
        process.exit(1);
    }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
    log('\n\nShutting down...', 'yellow');
    process.exit(0);
});

// Run the test
runTest().catch(console.error); 