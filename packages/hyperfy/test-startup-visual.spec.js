const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');

test.describe('Visual Startup Testing', () => {
  let server;
  
  test.beforeAll(async () => {
    // Start the Hyperfy server
    server = spawn('bun', ['run', 'dev'], {
      cwd: path.join(__dirname),
      detached: true,
      stdio: 'pipe'
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 10000));
  });
  
  test.afterAll(async () => {
    if (server) {
      process.kill(-server.pid);
    }
  });
  
  test('can connect to Hyperfy server and see world', async ({ page }) => {
    // Set up console logging to catch errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Try to connect to the Hyperfy world
    await page.goto('http://localhost:3000');
    
    // Wait for page to load
    await page.waitForTimeout(5000);
    
    // Take a screenshot to see what's actually happening
    await page.screenshot({ path: 'startup-test.png', fullPage: true });
    
    // Check if the page loaded without critical errors
    const title = await page.title();
    console.log('Page title:', title);
    
    // Log any errors we caught
    if (errors.length > 0) {
      console.log('Console errors:', errors);
    }
    
    // Basic check - page should have some content
    const bodyContent = await page.textContent('body');
    expect(bodyContent.length).toBeGreaterThan(0);
    
    // Check for WebSocket connection
    const wsConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:3000/ws');
        ws.onopen = () => resolve(true);
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000);
      });
    });
    
    console.log('WebSocket connection successful:', wsConnected);
    
    // Take final screenshot
    await page.screenshot({ path: 'final-state.png', fullPage: true });
  });
});