#!/usr/bin/env node
/**
 * Debug System Loading
 * 
 * Simple test to debug why RPGVisualTestSystem is not loading
 */

import { chromium } from 'playwright';

const SERVER_URL = 'http://localhost:3333';

async function debugSystemLoading() {
  console.log('[Debug] Starting system loading debug...');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  const page = await browser.newPage();
  
  // Enable verbose console logging
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[Browser ${type.toUpperCase()}] ${text}`);
  });

  // Navigate to world
  await page.goto(SERVER_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(10000); // Wait longer for systems to load
  
  // Debug system loading
  const systemDebug = await page.evaluate(() => {
    console.log('[Debug] Starting system analysis...');
    
    const world = window.world;
    if (!world) {
      return { error: 'World not found' };
    }
    
    console.log('[Debug] World object found');
    console.log('[Debug] World keys:', Object.keys(world));
    
    const systems = world.systems;
    if (!systems) {
      return { error: 'Systems object not found', worldKeys: Object.keys(world) };
    }
    
    console.log('[Debug] Systems object found');
    console.log('[Debug] System keys:', Object.keys(systems));
    
    // Check each system
    const systemInfo = {};
    for (const [key, system] of Object.entries(systems)) {
      systemInfo[key] = {
        exists: !!system,
        type: system ? system.constructor.name : 'null',
        initialized: system ? (system.initialized || false) : false,
        started: system ? (system.started || false) : false
      };
      
      console.log(`[Debug] System ${key}:`, systemInfo[key]);
    }
    
    // Specifically check visual test system
    const visualTestSystem = systems['rpg-visual-test'];
    const visualTestDetails = {
      exists: !!visualTestSystem,
      type: visualTestSystem ? visualTestSystem.constructor.name : 'null',
      methods: visualTestSystem ? Object.getOwnPropertyNames(Object.getPrototypeOf(visualTestSystem)) : [],
      entities: null,
      error: null
    };
    
    if (visualTestSystem) {
      try {
        if (visualTestSystem.getAllEntities) {
          const entities = visualTestSystem.getAllEntities();
          visualTestDetails.entities = {
            count: entities.size,
            keys: Array.from(entities.keys())
          };
        } else {
          visualTestDetails.error = 'getAllEntities method not found';
        }
      } catch (error) {
        visualTestDetails.error = error.message;
      }
    }
    
    console.log('[Debug] Visual test system details:', visualTestDetails);
    
    // Check interaction system
    const interactionSystem = systems['rpg-interaction'];
    const interactionDetails = {
      exists: !!interactionSystem,
      type: interactionSystem ? interactionSystem.constructor.name : 'null',
      methods: interactionSystem ? Object.getOwnPropertyNames(Object.getPrototypeOf(interactionSystem)) : [],
      interactables: null,
      error: null
    };
    
    if (interactionSystem) {
      try {
        if (interactionSystem.interactables) {
          interactionDetails.interactables = {
            count: interactionSystem.interactables.size,
            keys: Array.from(interactionSystem.interactables.keys())
          };
        } else {
          interactionDetails.error = 'interactables property not found';
        }
      } catch (error) {
        interactionDetails.error = error.message;
      }
    }
    
    console.log('[Debug] Interaction system details:', interactionDetails);
    
    // Check scene for cubes
    const scene = world.stage?.scene;
    const sceneInfo = {
      exists: !!scene,
      childrenCount: scene ? scene.children.length : 0,
      cubes: []
    };
    
    if (scene) {
      scene.traverse((child) => {
        if (child.name && (
          child.name.includes('Mob_') || 
          child.name.includes('Item_') || 
          child.name.includes('Resource_') || 
          child.name.includes('NPC_')
        )) {
          sceneInfo.cubes.push({
            name: child.name,
            type: child.constructor.name,
            position: { x: child.position.x, y: child.position.y, z: child.position.z },
            hasPhysX: !!child.userData?.physx
          });
        }
      });
    }
    
    console.log('[Debug] Scene info:', sceneInfo);
    
    return {
      worldExists: !!world,
      systemsCount: Object.keys(systems).length,
      systemInfo: systemInfo,
      visualTestSystem: visualTestDetails,
      interactionSystem: interactionDetails,
      scene: sceneInfo
    };
  });
  
  console.log('\n=== System Debug Results ===');
  console.log('World exists:', systemDebug.worldExists);
  console.log('Systems count:', systemDebug.systemsCount);
  console.log('Visual test system exists:', systemDebug.visualTestSystem.exists);
  console.log('Interaction system exists:', systemDebug.interactionSystem.exists);
  console.log('Cubes in scene:', systemDebug.scene.cubes.length);
  
  if (systemDebug.visualTestSystem.error) {
    console.log('Visual test system error:', systemDebug.visualTestSystem.error);
  }
  
  if (systemDebug.interactionSystem.error) {
    console.log('Interaction system error:', systemDebug.interactionSystem.error);
  }
  
  // Wait for user to inspect
  console.log('\n=== Browser window is open for inspection ===');
  console.log('Press any key to close...');
  
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => {
    browser.close();
    process.exit(0);
  });
}

debugSystemLoading().catch(console.error);