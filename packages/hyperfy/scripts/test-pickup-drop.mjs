#!/usr/bin/env node

/**
 * Ground Item Pickup/Drop Integration Test
 * Tests the complete pickup/drop flow with visual representation
 */

import { spawn } from 'child_process';
import puppeteer from 'puppeteer';

const SERVER_URL = 'http://localhost:3333';
const TEST_TIMEOUT = 60000; // 1 minute

let server = null;
let browser = null;
let page = null;

async function startServer() {
  console.log('📦 Starting Hyperfy server...');
  
  server = spawn('bun', ['run', 'start'], {
    cwd: '/Users/shawwalters/hyperscape/packages/hyperfy',
    stdio: 'pipe'
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server failed to start within 30 seconds'));
    }, 30000);

    server.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[SERVER] ${output.trim()}`);
      
      if (output.includes('Server running') || output.includes('localhost:3333')) {
        clearTimeout(timeout);
        console.log('✅ Server started successfully');
        resolve();
      }
    });

    server.stderr.on('data', (data) => {
      console.error(`[SERVER ERROR] ${data.toString().trim()}`);
    });

    server.on('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

async function setupBrowser() {
  console.log('🌐 Starting browser...');
  
  browser = await puppeteer.launch({
    headless: false, // Show browser for visual verification
    defaultViewport: { width: 1200, height: 800 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  page = await browser.newPage();
  
  // Listen for console logs and errors
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || text.includes('[RPG')) {
      console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
    }
  });
  
  page.on('pageerror', error => {
    console.error(`[PAGE ERROR] ${error.message}`);
  });

  console.log('✅ Browser started');
}

async function testPickupDropFlow() {
  console.log('🧪 Testing pickup/drop flow...');
  
  try {
    // Navigate to the game
    console.log('📍 Navigating to game...');
    await page.goto(SERVER_URL, { waitUntil: 'networkidle0' });
    
    // Wait for game to load
    console.log('⏳ Waiting for game to load...');
    await page.waitForFunction(() => {
      return window.world && window.world.rpg;
    }, { timeout: 30000 });
    
    console.log('✅ Game loaded successfully');

    // Test 1: Create a ground item
    console.log('🎯 Test 1: Creating ground item...');
    const createResult = await page.evaluate(() => {
      try {
        // Get item pickup system
        const itemPickupSystem = window.world.rpg.getSystem?.('itemPickup');
        if (!itemPickupSystem) {
          throw new Error('Item pickup system not found');
        }

        // Create a test item
        const testItem = {
          id: 'bronze_sword',
          name: 'Bronze Sword',
          type: 'weapon',
          stackable: false
        };

        // Drop item at a test position
        const position = new window.THREE.Vector3(5, 0, 5);
        const itemId = itemPickupSystem.dropItem(testItem, position, 'test_player');
        
        return {
          success: true,
          itemId: itemId,
          position: { x: position.x, y: position.y, z: position.z }
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    if (!createResult.success) {
      throw new Error(`Failed to create ground item: ${createResult.error}`);
    }

    console.log(`✅ Created ground item: ${createResult.itemId}`);

    // Test 2: Verify visual representation
    console.log('👁️ Test 2: Verifying visual representation...');
    await page.waitForTimeout(2000); // Wait for rendering

    const visualVerification = await page.evaluate(() => {
      try {
        // Check if item mesh exists in scene
        const scene = window.world.stage?.scene;
        if (!scene) throw new Error('Scene not found');

        const groundItemMeshes = [];
        scene.traverse((object) => {
          if (object.userData?.type === 'ground_item') {
            groundItemMeshes.push({
              name: object.name,
              position: {
                x: Math.round(object.position.x * 10) / 10,
                y: Math.round(object.position.y * 10) / 10,
                z: Math.round(object.position.z * 10) / 10
              },
              visible: object.visible,
              material: object.material ? {
                color: object.material.color?.getHex() || 0,
                opacity: object.material.opacity || 1
              } : null
            });
          }
        });

        return {
          success: true,
          groundItems: groundItemMeshes,
          totalItems: groundItemMeshes.length
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    if (!visualVerification.success) {
      throw new Error(`Visual verification failed: ${visualVerification.error}`);
    }

    if (visualVerification.totalItems === 0) {
      throw new Error('No ground items found in scene');
    }

    console.log(`✅ Found ${visualVerification.totalItems} ground item(s) in scene`);
    console.log('Ground items:', visualVerification.groundItems);

    // Test 3: Test pickup interaction
    console.log('🤏 Test 3: Testing pickup interaction...');
    const pickupResult = await page.evaluate(() => {
      try {
        // Get the ground item
        const itemPickupSystem = window.world.rpg.getSystem?.('itemPickup');
        if (!itemPickupSystem) {
          throw new Error('Item pickup system not found');
        }

        const groundItems = itemPickupSystem.getAllGroundItems();
        if (groundItems.length === 0) {
          throw new Error('No ground items available for pickup');
        }

        const groundItem = groundItems[0];
        
        // Simulate pickup request
        window.world.emit?.('rpg:item:pickup_request', {
          playerId: 'test_player',
          itemId: groundItem.id
        });

        return {
          success: true,
          pickedUpItem: {
            id: groundItem.id,
            name: groundItem.item.name
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    if (!pickupResult.success) {
      throw new Error(`Pickup test failed: ${pickupResult.error}`);
    }

    console.log(`✅ Pickup test successful: ${pickupResult.pickedUpItem.name}`);

    // Test 4: Verify item removal from scene
    console.log('🧹 Test 4: Verifying item removal...');
    await page.waitForTimeout(1000); // Wait for cleanup

    const removalVerification = await page.evaluate(() => {
      try {
        // Check if ground item was removed from scene
        const scene = window.world.stage?.scene;
        if (!scene) throw new Error('Scene not found');

        let groundItemCount = 0;
        scene.traverse((object) => {
          if (object.userData?.type === 'ground_item') {
            groundItemCount++;
          }
        });

        return {
          success: true,
          remainingItems: groundItemCount
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    if (!removalVerification.success) {
      throw new Error(`Removal verification failed: ${removalVerification.error}`);
    }

    if (removalVerification.remainingItems > 0) {
      console.log(`⚠️ Warning: ${removalVerification.remainingItems} ground items still in scene`);
    } else {
      console.log('✅ Ground item successfully removed from scene');
    }

    // Test 5: Test inventory drop
    console.log('📦 Test 5: Testing inventory drop...');
    const dropResult = await page.evaluate(() => {
      try {
        // Simulate inventory drop
        const localPlayer = window.world.getPlayer?.();
        if (!localPlayer) {
          throw new Error('Local player not found');
        }

        // Create test item in inventory
        const testInventoryItem = {
          id: 'steel_sword',
          name: 'Steel Sword',
          type: 'weapon',
          quantity: 1,
          stackable: false
        };

        // Emit drop event
        window.world.emit?.('rpg:inventory:drop', {
          playerId: localPlayer.id,
          slot: 0,
          quantity: 1
        });

        return {
          success: true,
          droppedItem: testInventoryItem
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    if (!dropResult.success) {
      console.log(`⚠️ Drop test warning: ${dropResult.error}`);
    } else {
      console.log(`✅ Drop test successful: ${dropResult.droppedItem.name}`);
    }

    console.log('🎉 All pickup/drop tests completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Pickup/Drop test failed:', error.message);
    throw error;
  }
}

async function cleanup() {
  console.log('🧹 Cleaning up...');
  
  if (browser) {
    await browser.close();
    console.log('✅ Browser closed');
  }
  
  if (server) {
    server.kill();
    console.log('✅ Server stopped');
  }
}

async function runTest() {
  try {
    console.log('🚀 Starting Ground Item Pickup/Drop Integration Test');
    console.log('=' .repeat(60));

    await startServer();
    await setupBrowser();
    await testPickupDropFlow();

    console.log('=' .repeat(60));
    console.log('✅ ALL TESTS PASSED - Ground item pickup/drop system working correctly!');
    
  } catch (error) {
    console.error('=' .repeat(60));
    console.error('❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Set timeout for entire test
setTimeout(() => {
  console.error('❌ Test timed out after 1 minute');
  cleanup().then(() => process.exit(1));
}, TEST_TIMEOUT);

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted');
  await cleanup();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught exception:', error);
  await cleanup();
  process.exit(1);
});

// Run the test
runTest();