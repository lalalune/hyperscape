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
    magenta: '\x1b[35m'
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
        
        const vite = spawn('npm', ['run', 'dev'], {
            cwd: rootDir,
            shell: true,
            env: { ...process.env, BROWSER: 'none' } // Prevent auto-opening browser
        });

        let serverReady = false;

        vite.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('ready in') || output.includes('Local:')) {
                if (!serverReady) {
                    serverReady = true;
                    log('✓ Dev server started successfully!', 'green');
                    setTimeout(() => resolve(vite), 2000); // Give it extra time
                }
            }
        });

        vite.stderr.on('data', (data) => {
            console.error(`Vite error: ${data}`);
        });

        vite.on('error', reject);

        // Timeout after 30 seconds
        setTimeout(() => {
            if (!serverReady) {
                reject(new Error('Dev server failed to start within 30 seconds'));
            }
        }, 30000);
    });
}

// Test a minigame
async function testMinigame(browser, gameName, gameUrl, runCommand) {
    logStep(gameName, `Testing ${gameName} minigame`);
    
    const page = await browser.newPage();
    
    // Set viewport for consistent screenshots
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable console logging
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('Error') || text.includes('error')) {
            log(`  Console Error: ${text}`, 'red');
        } else if (text.includes('loaded!')) {
            log(`  ${text}`, 'green');
        }
    });

    try {
        // Navigate to game
        log(`  Navigating to ${gameUrl}...`, 'yellow');
        await page.goto(gameUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for game to load
        await page.waitForTimeout(3000);
        
        // Take initial screenshot
        const screenshotDir = join(rootDir, 'test-screenshots');
        await fs.mkdir(screenshotDir, { recursive: true });
        
        const initialScreenshot = join(screenshotDir, `${gameName.toLowerCase()}-initial.png`);
        await page.screenshot({ path: initialScreenshot });
        log(`  ✓ Initial screenshot saved: ${initialScreenshot}`, 'green');
        
        // Check if 3D scene is loaded
        const hasCanvas = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            return canvas !== null;
        });
        
        if (!hasCanvas) {
            throw new Error('Canvas element not found - 3D scene may not be loaded');
        }
        log('  ✓ 3D canvas detected', 'green');
        
        // Check if world object exists
        const worldLoaded = await page.evaluate((game) => {
            if (game === 'Mafia') {
                return window.mafiaWorld !== undefined;
            } else {
                return window.amongUsWorld !== undefined;
            }
        }, gameName);
        
        if (!worldLoaded) {
            throw new Error(`${gameName} world object not found`);
        }
        log(`  ✓ ${gameName} world loaded`, 'green');
        
        // Run the game scenario
        log(`  Running ${gameName} scenario...`, 'yellow');
        await page.evaluate((command) => {
            eval(command);
        }, runCommand);
        
        // Wait for game to start
        await page.waitForTimeout(5000);
        
        // Take gameplay screenshot
        const gameplayScreenshot = join(screenshotDir, `${gameName.toLowerCase()}-gameplay.png`);
        await page.screenshot({ path: gameplayScreenshot });
        log(`  ✓ Gameplay screenshot saved: ${gameplayScreenshot}`, 'green');
        
        // Check for UI updates (game-specific)
        if (gameName === 'Mafia') {
            const mafiaUIUpdated = await page.evaluate(() => {
                const phaseElement = document.getElementById('phase-indicator');
                return phaseElement && !phaseElement.innerText.includes('Setup');
            });
            
            if (mafiaUIUpdated) {
                log('  ✓ Mafia game phase updated', 'green');
            } else {
                log('  ⚠ Mafia game phase not updated', 'yellow');
            }
        } else if (gameName === 'Among Us') {
            const amongUsUIUpdated = await page.evaluate(() => {
                const statusElement = document.getElementById('game-status');
                return statusElement && !statusElement.innerText.includes('Waiting');
            });
            
            if (amongUsUIUpdated) {
                log('  ✓ Among Us game status updated', 'green');
            } else {
                log('  ⚠ Among Us game status not updated', 'yellow');
            }
        }
        
        // Let game run for a bit
        log(`  Letting ${gameName} run for 10 seconds...`, 'yellow');
        await page.waitForTimeout(10000);
        
        // Take final screenshot
        const finalScreenshot = join(screenshotDir, `${gameName.toLowerCase()}-final.png`);
        await page.screenshot({ path: finalScreenshot });
        log(`  ✓ Final screenshot saved: ${finalScreenshot}`, 'green');
        
        log(`✓ ${gameName} test completed successfully!`, 'green');
        
    } catch (error) {
        log(`✗ ${gameName} test failed: ${error.message}`, 'red');
        
        // Take error screenshot
        const errorScreenshot = join(rootDir, 'test-screenshots', `${gameName.toLowerCase()}-error.png`);
        await page.screenshot({ path: errorScreenshot });
        log(`  Error screenshot saved: ${errorScreenshot}`, 'yellow');
        
        throw error;
    } finally {
        await page.close();
    }
}

// Main test function
async function runVisualTests() {
    let viteProcess;
    let browser;
    
    try {
        log('\n🎮 Starting Visual Minigames Test Suite\n', 'magenta');
        
        // Step 1: Start dev server
        logStep(1, 'Starting development server');
        viteProcess = await startDevServer();
        
        // Step 2: Launch browser
        logStep(2, 'Launching browser');
        browser = await puppeteer.launch({
            headless: false, // Set to true for CI/automated testing
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        log('✓ Browser launched', 'green');
        
        // Step 3: Test minigames menu
        logStep(3, 'Testing minigames menu');
        const menuPage = await browser.newPage();
        await menuPage.goto('http://localhost:3000/minigames.html', { waitUntil: 'networkidle2' });
        
        const menuScreenshot = join(rootDir, 'test-screenshots', 'menu.png');
        await menuPage.screenshot({ path: menuScreenshot });
        log(`✓ Menu screenshot saved: ${menuScreenshot}`, 'green');
        
        // Verify both game cards exist
        const gameCards = await menuPage.evaluate(() => {
            const cards = document.querySelectorAll('.game-card');
            return cards.length;
        });
        
        if (gameCards === 2) {
            log('✓ Both game cards found in menu', 'green');
        } else {
            throw new Error(`Expected 2 game cards, found ${gameCards}`);
        }
        
        await menuPage.close();
        
        // Step 4: Test Mafia game
        await testMinigame(
            browser, 
            'Mafia', 
            'http://localhost:3000/mafia.html',
            'window.runMafiaScenario()'
        );
        
        // Step 5: Test Among Us game
        await testMinigame(
            browser, 
            'Among Us', 
            'http://localhost:3000/amongus.html',
            'window.runAmongUsScenario()'
        );
        
        // Success!
        log('\n✅ All visual tests passed! 🎉', 'green');
        log('\nScreenshots saved in: test-screenshots/', 'yellow');
        log('\nYou can:', 'blue');
        log('  - Check the screenshots to verify visual display', 'blue');
        log('  - Keep the browser open to watch the games', 'blue');
        log('  - Press Ctrl+C to stop the server and exit', 'blue');
        
        // Keep running for manual inspection
        log('\n👀 Keeping server running for manual inspection...', 'yellow');
        log('Press Ctrl+C to exit\n', 'yellow');
        
    } catch (error) {
        log(`\n❌ Test failed: ${error.message}`, 'red');
        
        // Cleanup
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

// Run the tests
runVisualTests().catch(console.error); 