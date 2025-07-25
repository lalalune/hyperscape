#!/usr/bin/env node

/**
 * Frontend Error Detection Test
 * Verifies that the frontend loads without JavaScript errors
 * This should ALWAYS be run after any code changes
 */

import { execSync, spawn } from 'child_process';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TEST_URL = 'http://localhost:3333';
const SERVER_STARTUP_TIMEOUT = 10000; // 10 seconds
const TEST_TIMEOUT = 30000; // 30 seconds

console.log('🚨 FRONTEND ERROR DETECTION TEST');
console.log('===============================');

let serverProcess = null;
let browser = null;
let page = null;

async function startServer() {
  console.log('🚀 Starting server...');
  
  // Kill any existing server on port 3333
  try {
    execSync('lsof -ti:3333 | xargs kill -9', { stdio: 'ignore' });
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (e) {
    // No existing server, that's fine
  }
  
  // Start server
  serverProcess = spawn('bun', ['run', 'start'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  let output = '';
  
  serverProcess.stdout.on('data', (data) => {
    output += data.toString();
    console.log('[SERVER]', data.toString().trim());
  });
  
  serverProcess.stderr.on('data', (data) => {
    output += data.toString();
    console.error('[SERVER ERROR]', data.toString().trim());
  });
  
  // Wait for server to start
  const startTime = Date.now();
  while (Date.now() - startTime < SERVER_STARTUP_TIMEOUT) {
    try {
      const response = await fetch(TEST_URL);
      if (response.ok) {
        console.log('✅ Server started successfully');
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.error('❌ Server failed to start within timeout');
  console.error('Server output:', output);
  return false;
}

async function testFrontend() {
  console.log('🌐 Testing frontend for errors...');
  
  // Launch browser
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext();
  page = await await context.newPage();
  
  // Collect all errors
  const errors = [];
  const consoleErrors = [];
  
  // Listen for JavaScript errors
  page.on('pageerror', (error) => {
    errors.push({
      type: 'pageerror',
      message: error.message,
      stack: error.stack
    });
    console.error('🚨 PAGE ERROR:', error.message);
    console.error('   Stack:', error.stack);
  });
  
  // Listen for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        type: 'console',
        message: msg.text(),
        location: msg.location()
      });
      console.error('🚨 CONSOLE ERROR:', msg.text());
      console.error('   Location:', msg.location());
    }
  });
  
  // Listen for unhandled promise rejections
  page.on('requestfailed', (request) => {
    console.warn('⚠️  Request failed:', request.url(), request.failure()?.errorText);
  });
  
  try {
    // Navigate to the page
    console.log(`📄 Loading ${TEST_URL}...`);
    const response = await page.goto(TEST_URL, { 
      waitUntil: 'networkidle',
      timeout: TEST_TIMEOUT 
    });
    
    if (!response.ok()) {
      console.error(`❌ HTTP Error: ${response.status()} ${response.statusText()}`);
      return false;
    }
    
    console.log('✅ Page loaded successfully');
    
    // Wait a bit more for any async JavaScript to run
    await page.waitForTimeout(3000);
    
    // Check if any critical elements are missing
    const hasCanvas = await page.evaluate(() => {
      return document.querySelector('canvas') !== null;
    });
    
    const hasScripts = await page.evaluate(() => {
      return document.querySelectorAll('script').length > 0;
    });
    
    console.log(`🎨 Canvas element found: ${hasCanvas}`);
    console.log(`📜 Script elements found: ${hasScripts}`);
    
    // Check for specific error indicators
    const hasErrorText = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      return bodyText.includes('Error') || bodyText.includes('Failed') || bodyText.includes('Cannot');
    });
    
    if (hasErrorText) {
      console.warn('⚠️  Page contains error text');
      const pageText = await page.evaluate(() => document.body.textContent);
      console.warn('Page content:', pageText.substring(0, 500));
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ 
      path: 'frontend-test-screenshot.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved as frontend-test-screenshot.png');
    
    // Report results
    console.log('\n📊 FRONTEND TEST RESULTS:');
    console.log('=======================');
    console.log(`JavaScript Errors: ${errors.length}`);
    console.log(`Console Errors: ${consoleErrors.length}`);
    console.log(`Canvas Present: ${hasCanvas ? '✅' : '❌'}`);
    console.log(`Scripts Present: ${hasScripts ? '✅' : '❌'}`);
    
    if (errors.length > 0) {
      console.log('\n🚨 JAVASCRIPT ERRORS DETECTED:');
      errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.type}: ${error.message}`);
        if (error.stack) {
          console.log(`   Stack: ${error.stack.split('\n')[0]}`);
        }
      });
    }
    
    if (consoleErrors.length > 0) {
      console.log('\n🚨 CONSOLE ERRORS DETECTED:');
      consoleErrors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.message}`);
        if (error.location) {
          console.log(`   Location: ${error.location.url}:${error.location.lineNumber}`);
        }
      });
    }
    
    // Save detailed error report
    const errorReport = {
      timestamp: new Date().toISOString(),
      url: TEST_URL,
      pageErrors: errors,
      consoleErrors: consoleErrors,
      pageState: {
        hasCanvas,
        hasScripts,
        hasErrorText
      }
    };
    
    fs.writeFileSync('frontend-error-report.json', JSON.stringify(errorReport, null, 2));
    console.log('📄 Detailed error report saved as frontend-error-report.json');
    
    // Return success/failure
    const hasErrors = errors.length > 0 || consoleErrors.length > 0;
    
    if (hasErrors) {
      console.log('\n❌ FRONTEND TEST FAILED - Errors detected');
      return false;
    } else {
      console.log('\n✅ FRONTEND TEST PASSED - No errors detected');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Frontend test failed with exception:', error.message);
    return false;
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up...');
  
  if (page) {
    await page.close().catch(() => {});
  }
  
  if (browser) {
    await browser.close().catch(() => {});
  }
  
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    // Give it a moment to shut down gracefully
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (!serverProcess.killed) {
      serverProcess.kill('SIGKILL');
    }
  }
  
  // Kill any remaining server processes
  try {
    execSync('lsof -ti:3333 | xargs kill -9', { stdio: 'ignore' });
  } catch (e) {
    // No processes to kill
  }
  
  console.log('✅ Cleanup complete');
}

async function main() {
  let success = false;
  
  try {
    const serverStarted = await startServer();
    if (!serverStarted) {
      console.error('❌ Could not start server');
      process.exit(1);
    }
    
    success = await testFrontend();
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await cleanup();
  }
  
  if (success) {
    console.log('\n🎉 ALL FRONTEND TESTS PASSED');
    process.exit(0);
  } else {
    console.log('\n💥 FRONTEND TESTS FAILED');
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  cleanup().then(() => process.exit(1));
});

main().catch((error) => {
  console.error('Main function failed:', error);
  cleanup().then(() => process.exit(1));
});