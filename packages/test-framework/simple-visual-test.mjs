#!/usr/bin/env node

import { spawn } from 'child_process';
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testRPGVisuals() {
  console.log('🧪 Testing RPG Visual Rendering...');
  
  let browser = null;
  let serverProcess = null;
  
  try {
    // Start RPG server
    console.log('🚀 Starting RPG server...');
    serverProcess = spawn('npm', ['run', '--workspace=packages/rpg', 'start'], {
      cwd: '/Users/shawwalters/hyperscape',
      detached: true
    });
    
    // Wait for server to start
    await new Promise((resolve, reject) => {
      let resolved = false;
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[Server]', output.trim());
        if (output.includes('running on port') && !resolved) {
          console.log('✅ Server is ready');
          resolved = true;
          resolve();
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.log('[Server Error]', data.toString().trim());
      });
      
      setTimeout(() => {
        if (!resolved) {
          reject(new Error('Server timeout'));
        }
      }, 15000);
    });
    
    // Start browser
    console.log('🌐 Starting browser...');
    browser = await chromium.launch({ 
      headless: false,
      args: ['--disable-web-security'] 
    });
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Navigate to RPG world
    console.log('🏠 Navigating to RPG world...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for world to load
    console.log('⏳ Waiting for world to load...');
    await page.waitForTimeout(10000);
    
    // Take screenshot
    const screenshotPath = join(__dirname, '../screenshots/rpg-actual.png');
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: false 
    });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    
    // Check if RPG elements are visible in DOM
    const rpgElements = await page.evaluate(() => {
      // Check for window.rpgPlayer and window.rpgGoblin
      const hasRPGPlayer = typeof window.rpgPlayer !== 'undefined';
      const hasRPGGoblin = typeof window.rpgGoblin !== 'undefined';
      
      // Check for three.js scene objects
      const canvasExists = document.querySelector('canvas') !== null;
      
      return {
        hasRPGPlayer,
        hasRPGGoblin,
        canvasExists,
        rpgPlayerData: window.rpgPlayer ? window.rpgPlayer.getStats() : null,
        rpgGoblinData: window.rpgGoblin ? window.rpgGoblin.getStats() : null
      };
    });
    
    console.log('🔍 RPG Elements Found:', JSON.stringify(rpgElements, null, 2));
    
    // Log console messages
    page.on('console', (msg) => {
      if (msg.text().includes('RPG')) {
        console.log('[Browser RPG]', msg.text());
      }
    });
    
    // Keep browser open for debugging
    console.log('🔍 Browser open for inspection. Press Ctrl+C to close.');
    await new Promise(() => {}); // Keep running
    
  } catch (error) {
    console.error('💥 Test error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
    if (serverProcess) {
      process.kill(-serverProcess.pid);
    }
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

testRPGVisuals();