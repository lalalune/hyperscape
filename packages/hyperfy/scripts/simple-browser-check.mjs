#!/usr/bin/env node
/**
 * Simple Browser Check
 * 
 * Quick check of browser console and system loading
 */

import { chromium } from 'playwright';

async function simpleBrowserCheck() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Log all console messages
  page.on('console', msg => {
    if (msg.text().includes('rpg-visual-test') || msg.text().includes('RPGVisualTestSystem') || 
        msg.text().includes('visualTestSystem') || msg.text().includes('systems available')) {
      console.log(`[BROWSER] ${msg.text()}`);
    }
  });
  
  await page.goto('http://localhost:3333');
  await page.waitForTimeout(10000);
  
  // Check systems in console
  const result = await page.evaluate(() => {
    console.log('=== Manual System Check ===');
    console.log('World:', !!window.world);
    console.log('Systems:', window.world ? Object.keys(window.world.systems || {}) : 'No world');
    
    if (window.world?.systems) {
      console.log('RPG Visual Test System:', !!window.world.systems['rpg-visual-test']);
      console.log('RPG Interaction System:', !!window.world.systems['rpg-interaction']);
      
      // Try to access the visual test system
      const vts = window.world.systems['rpg-visual-test'];
      if (vts) {
        console.log('VTS Type:', vts.constructor.name);
        console.log('VTS Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(vts)));
        
        if (vts.getAllEntities) {
          const entities = vts.getAllEntities();
          console.log('VTS Entities:', entities.size);
        } else {
          console.log('VTS: getAllEntities method not found');
        }
      } else {
        console.log('VTS: System not found');
      }
    }
    
    return {
      worldExists: !!window.world,
      systemsExists: !!window.world?.systems,
      visualTestExists: !!window.world?.systems?.['rpg-visual-test']
    };
  });
  
  console.log('Result:', result);
  
  // Keep browser open for manual inspection
  console.log('Browser open for manual inspection. Press Ctrl+C to close.');
  
  // Wait indefinitely
  await new Promise(() => {});
}

simpleBrowserCheck().catch(console.error);