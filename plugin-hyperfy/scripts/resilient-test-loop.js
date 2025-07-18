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

// Check if a URL is accessible
async function checkUrl(url, timeout = 5000) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: 'GET',
            timeout: timeout
        };

        const req = http.request(options, (res) => {
            resolve({ success: true, statusCode: res.statusCode, port: urlObj.port });
        });

        req.on('error', (err) => {
            resolve({ success: false, error: err.message, port: urlObj.port });
        });

        req.on('timeout', () => {
            req.abort();
            resolve({ success: false, error: 'timeout', port: urlObj.port });
        });

        req.end();
    });
}

// Find available port
async function findAvailablePort() {
    const ports = [3001, 3000, 3002, 3003];  // Check 3001 first since Vite often uses it
    
    for (const port of ports) {
        const result = await checkUrl(`http://localhost:${port}/minigames.html`);
        if (result.success) {
            return port;
        }
    }
    
    return null;
}

// Test game page
async function testGamePage(port, gameName, path) {
    const url = `http://localhost:${port}${path}`;
    const testResults = {
        name: gameName,
        url,
        accessible: false,
        htmlValid: false,
        hasCanvas: false,
        errors: []
    };
    
    try {
        // Check if page is accessible
        const accessResult = await checkUrl(url);
        testResults.accessible = accessResult.success;
        
        if (!accessResult.success) {
            testResults.errors.push(`Page not accessible: ${accessResult.error}`);
            return testResults;
        }
        
        // Use curl to check HTML content
        try {
            const { stdout } = await execAsync(`curl -s "${url}" | head -500`);
            testResults.htmlValid = stdout.includes('<!DOCTYPE html>');
            testResults.hasCanvas = stdout.includes('<canvas');
            
            // Check for specific game elements
            if (gameName === 'Menu') {
                testResults.hasGameCards = stdout.includes('game-card') || stdout.includes('Mafia') || stdout.includes('Among Us');
            } else if (gameName === 'Mafia') {
                testResults.hasMafiaElements = stdout.includes('mafia') || stdout.includes('Mafia');
            } else if (gameName === 'Among Us') {
                testResults.hasAmongUsElements = stdout.includes('amongus') || stdout.includes('Among Us');
            }
        } catch (curlError) {
            testResults.errors.push(`Curl failed: ${curlError.message}`);
        }
        
    } catch (error) {
        testResults.errors.push(`Test failed: ${error.message}`);
    }
    
    return testResults;
}

// Run comprehensive tests
async function runTests(port) {
    log(`\nRunning tests on port ${port}...`, 'blue');
    
    const tests = [
        { name: 'Menu', path: '/minigames.html' },
        { name: 'Mafia', path: '/mafia.html' },
        { name: 'Among Us', path: '/amongus.html' }
    ];
    
    const results = [];
    
    for (const test of tests) {
        const result = await testGamePage(port, test.name, test.path);
        results.push(result);
        
        // Report result
        if (result.accessible && result.htmlValid) {
            log(`  ✓ ${test.name}: Accessible and valid HTML`, 'green');
            
            if (result.hasCanvas) {
                log(`    ✓ Canvas element found`, 'green');
            } else if (test.name !== 'Menu') {
                log(`    ⚠ No canvas element found`, 'yellow');
            }
            
            if (test.name === 'Menu' && result.hasGameCards) {
                log(`    ✓ Game cards detected`, 'green');
            } else if (test.name === 'Mafia' && result.hasMafiaElements) {
                log(`    ✓ Mafia elements detected`, 'green');
            } else if (test.name === 'Among Us' && result.hasAmongUsElements) {
                log(`    ✓ Among Us elements detected`, 'green');
            }
        } else {
            log(`  ✗ ${test.name}: Failed`, 'red');
            result.errors.forEach(err => log(`    - ${err}`, 'red'));
        }
    }
    
    return results;
}

// Main test loop
async function resilientTestLoop() {
    log('\n🎮 Starting Resilient Minigames Test Loop\n', 'magenta');
    log('This test loop will:', 'cyan');
    log('  - Find the correct port automatically', 'cyan');
    log('  - Handle errors gracefully', 'cyan');
    log('  - Keep testing even if some tests fail', 'cyan');
    log('  - Work without Chrome/Puppeteer\n', 'cyan');
    
    let testCount = 0;
    const testInterval = 20000; // Test every 20 seconds
    let lastPort = null;
    
    const runTestCycle = async () => {
        testCount++;
        log(`\n--- Test Cycle #${testCount} ---`, 'magenta');
        
        // Find available port
        const port = await findAvailablePort();
        
        if (!port) {
            log('⚠ No server found on ports 3000-3003', 'yellow');
            log('  Make sure to run: npm run minigames', 'yellow');
            return;
        }
        
        if (port !== lastPort) {
            log(`✓ Found server on port ${port}`, 'green');
            lastPort = port;
        }
        
        // Run tests
        try {
            const results = await runTests(port);
            
            // Summary
            const passed = results.filter(r => r.accessible && r.htmlValid).length;
            const total = results.length;
            
            if (passed === total) {
                log(`\n✅ All ${total} tests passed!`, 'green');
            } else {
                log(`\n⚠️  ${passed}/${total} tests passed`, 'yellow');
            }
            
            // Additional checks
            log('\n📊 Additional Checks:', 'cyan');
            
            // Check if Three.js is loading
            try {
                const { stdout } = await execAsync(`curl -s "http://localhost:${port}/node_modules/three/build/three.module.js" | head -1`);
                if (stdout.includes('export') || stdout.includes('import')) {
                    log('  ✓ Three.js module accessible', 'green');
                } else {
                    log('  ✗ Three.js module not found', 'red');
                }
            } catch (e) {
                log('  ⚠ Could not check Three.js module', 'yellow');
            }
            
        } catch (error) {
            log(`\n❌ Test cycle error: ${error.message}`, 'red');
            log('  Continuing anyway...', 'yellow');
        }
        
        log(`\nNext test in ${testInterval/1000} seconds...`, 'blue');
    };
    
    // Run initial test
    await runTestCycle();
    
    // Set up interval
    const interval = setInterval(runTestCycle, testInterval);
    
    log('\n📊 Test loop running. Press Ctrl+C to stop.\n', 'cyan');
    
    // Handle cleanup
    process.on('SIGINT', () => {
        log('\n\nStopping test loop...', 'yellow');
        clearInterval(interval);
        log('✅ Test loop stopped gracefully', 'green');
        process.exit(0);
    });
}

// Quick mode - single test run
async function runQuickTest() {
    log('\n🎮 Running Quick Resilient Test\n', 'magenta');
    
    const port = await findAvailablePort();
    
    if (!port) {
        log('❌ No server found. Start it with: npm run minigames', 'red');
        process.exit(1);
    }
    
    log(`✓ Found server on port ${port}`, 'green');
    
    const results = await runTests(port);
    const passed = results.filter(r => r.accessible && r.htmlValid).length;
    const total = results.length;
    
    if (passed === total) {
        log(`\n✅ All ${total} tests passed!`, 'green');
        process.exit(0);
    } else {
        log(`\n⚠️  Only ${passed}/${total} tests passed`, 'yellow');
        process.exit(1);
    }
}

// Parse arguments
const args = process.argv.slice(2);
const isQuickMode = args.includes('--quick');

// Show help
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Resilient Minigames Test Loop

Usage:
  node scripts/resilient-test-loop.js [options]

Options:
  --quick    Run a single test and exit
  --help     Show this help message

This script:
  - Automatically finds the correct port (3000-3003)
  - Tests all minigame pages
  - Handles errors gracefully
  - Works without Chrome/Puppeteer
  - Keeps running even if tests fail
`);
    process.exit(0);
}

// Run appropriate mode
if (isQuickMode) {
    runQuickTest().catch(error => {
        log(`\n❌ Quick test failed: ${error.message}`, 'red');
        process.exit(1);
    });
} else {
    resilientTestLoop().catch(error => {
        log(`\n❌ Test loop failed: ${error.message}`, 'red');
        process.exit(1);
    });
} 