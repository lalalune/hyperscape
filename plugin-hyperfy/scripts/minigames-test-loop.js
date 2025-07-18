#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
                    log('✓ Dev server started!', 'green');
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
                reject(new Error('Dev server failed to start'));
            }
        }, 30000);
    });
}

// Quick visual check for a game
async function quickVisualCheck(page, gameName, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        await page.waitForTimeout(2000);
        
        // Check canvas exists
        const hasCanvas = await page.evaluate(() => document.querySelector('canvas') !== null);
        
        // Check world loaded
        const worldLoaded = await page.evaluate((game) => {
            return game === 'Mafia' ? 
                window.mafiaWorld !== undefined : 
                window.amongUsWorld !== undefined;
        }, gameName);
        
        // Check UI elements
        const hasUI = await page.evaluate((game) => {
            if (game === 'Mafia') {
                return document.getElementById('mafia-overlay') !== null;
            } else {
                return document.getElementById('among-us-overlay') !== null;
            }
        }, gameName);
        
        // Get 3D objects count
        const objectCount = await page.evaluate(() => {
            if (window.world && window.world.stage && window.world.stage.scene) {
                return window.world.stage.scene.children.length;
            }
            return 0;
        });
        
        return {
            success: hasCanvas && worldLoaded && hasUI,
            details: {
                canvas: hasCanvas,
                world: worldLoaded,
                ui: hasUI,
                objects: objectCount
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Main test loop
async function runTestLoop() {
    let viteProcess;
    let browser;
    let testCount = 0;
    const testInterval = 15000; // Test every 15 seconds
    
    try {
        log('\n🎮 Starting Minigames Visual Test Loop\n', 'magenta');
        
        // Start server
        viteProcess = await startDevServer();
        
        // Launch browser (headless for continuous testing)
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Test loop
        const runTest = async () => {
            testCount++;
            log(`\n--- Test Run #${testCount} ---`, 'blue');
            
            // Test menu
            log('Testing menu page...', 'yellow');
            await page.goto('http://localhost:3000/minigames.html', { waitUntil: 'networkidle2' });
            const menuCards = await page.evaluate(() => document.querySelectorAll('.game-card').length);
            
            if (menuCards === 2) {
                log('✓ Menu: OK (2 game cards found)', 'green');
            } else {
                log(`✗ Menu: FAIL (${menuCards} cards found, expected 2)`, 'red');
            }
            
            // Test Mafia
            log('Testing Mafia game...', 'yellow');
            const mafiaResult = await quickVisualCheck(page, 'Mafia', 'http://localhost:3000/mafia.html');
            
            if (mafiaResult.success) {
                log(`✓ Mafia: OK (Canvas: ✓, World: ✓, UI: ✓, Objects: ${mafiaResult.details.objects})`, 'green');
            } else {
                log(`✗ Mafia: FAIL ${mafiaResult.error || JSON.stringify(mafiaResult.details)}`, 'red');
            }
            
            // Test Among Us
            log('Testing Among Us game...', 'yellow');
            const amongUsResult = await quickVisualCheck(page, 'Among Us', 'http://localhost:3000/amongus.html');
            
            if (amongUsResult.success) {
                log(`✓ Among Us: OK (Canvas: ✓, World: ✓, UI: ✓, Objects: ${amongUsResult.details.objects})`, 'green');
            } else {
                log(`✗ Among Us: FAIL ${amongUsResult.error || JSON.stringify(amongUsResult.details)}`, 'red');
            }
            
            // Summary
            const allPassed = menuCards === 2 && mafiaResult.success && amongUsResult.success;
            
            if (allPassed) {
                log(`\n✅ All tests passed! Next test in ${testInterval/1000}s...`, 'green');
            } else {
                log(`\n⚠️  Some tests failed. Next test in ${testInterval/1000}s...`, 'yellow');
            }
        };
        
        // Run initial test
        await runTest();
        
        // Set up interval
        const interval = setInterval(runTest, testInterval);
        
        // Keep running
        log('\n📊 Test loop running. Press Ctrl+C to stop.\n', 'cyan');
        
        // Handle cleanup
        process.on('SIGINT', async () => {
            log('\n\nStopping test loop...', 'yellow');
            clearInterval(interval);
            if (browser) await browser.close();
            if (viteProcess) viteProcess.kill();
            process.exit(0);
        });
        
    } catch (error) {
        log(`\n❌ Test loop failed: ${error.message}`, 'red');
        if (browser) await browser.close();
        if (viteProcess) viteProcess.kill();
        process.exit(1);
    }
}

// Quick test mode - single run
async function runQuickTest() {
    let browser;
    
    try {
        log('\n🎮 Running Quick Visual Test\n', 'magenta');
        
        // Assume server is already running
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Test both games
        const mafiaResult = await quickVisualCheck(page, 'Mafia', 'http://localhost:3000/mafia.html');
        const amongUsResult = await quickVisualCheck(page, 'Among Us', 'http://localhost:3000/amongus.html');
        
        log('\nTest Results:', 'blue');
        log(`Mafia: ${mafiaResult.success ? '✅ PASS' : '❌ FAIL'}`, mafiaResult.success ? 'green' : 'red');
        log(`Among Us: ${amongUsResult.success ? '✅ PASS' : '❌ FAIL'}`, amongUsResult.success ? 'green' : 'red');
        
        await browser.close();
        process.exit(mafiaResult.success && amongUsResult.success ? 0 : 1);
        
    } catch (error) {
        log(`\n❌ Quick test failed: ${error.message}`, 'red');
        if (browser) await browser.close();
        process.exit(1);
    }
}

// Parse arguments
const args = process.argv.slice(2);
const isQuickMode = args.includes('--quick');

// Run appropriate mode
if (isQuickMode) {
    runQuickTest().catch(console.error);
} else {
    runTestLoop().catch(console.error);
} 