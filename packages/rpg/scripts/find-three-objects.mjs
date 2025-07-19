#!/usr/bin/env node

import { chromium } from 'playwright';

async function findThreeObjects() {
  console.log('🔍 FINDING THREE.JS OBJECTS IN HYPERFY');
  console.log('======================================');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Navigate to Hyperfy
  console.log('🌐 Navigating to Hyperfy...');
  await page.goto('http://localhost:3001');
  
  // Wait for world to load
  console.log('⏳ Waiting for world to load...');
  await page.waitForTimeout(5000);
  
  // Deep search for Three.js objects
  const searchResults = await page.evaluate(() => {
    const results = {
      windowKeys: [],
      worldKeys: [],
      threeLocations: [],
      sceneLocations: [],
      rendererLocations: [],
      cameraLocations: [],
      meshLocations: [],
      errors: []
    };
    
    try {
      // Search window object
      results.windowKeys = Object.keys(window).filter(key => 
        key.toLowerCase().includes('three') || 
        key.toLowerCase().includes('scene') ||
        key.toLowerCase().includes('world') ||
        key.toLowerCase().includes('render')
      );
      
      // Search world object
      if (window.world) {
        results.worldKeys = Object.keys(window.world);
        
        // Deep search in world
        function searchObject(obj, path = '', maxDepth = 3) {
          if (maxDepth <= 0) return;
          
          for (const key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
              const currentPath = path ? `${path}.${key}` : key;
              
              // Check for Three.js objects
              if (obj[key].isScene) {
                results.sceneLocations.push(currentPath);
              }
              
              if (obj[key].isCamera) {
                results.cameraLocations.push(currentPath);
              }
              
              if (obj[key].isWebGLRenderer) {
                results.rendererLocations.push(currentPath);
              }
              
              if (obj[key].isMesh) {
                results.meshLocations.push(currentPath);
              }
              
              // Check for THREE namespace
              if (key === 'THREE' || (obj[key].Scene && obj[key].Mesh)) {
                results.threeLocations.push(currentPath);
              }
              
              // Recurse
              searchObject(obj[key], currentPath, maxDepth - 1);
            }
          }
        }
        
        searchObject(window.world);
      }
      
      // Also check global THREE
      if (window.THREE) {
        results.threeLocations.push('window.THREE');
      }
      
      // Search for any scenes in the document
      if (document.querySelectorAll) {
        const canvases = document.querySelectorAll('canvas');
        results.canvasCount = canvases.length;
        
        // Check each canvas for Three.js renderer
        for (let i = 0; i < canvases.length; i++) {
          const canvas = canvases[i];
          if (canvas.__THREE__RENDERER__) {
            results.rendererLocations.push(`canvas[${i}].__THREE__RENDERER__`);
          }
        }
      }
      
    } catch (error) {
      results.errors.push(error.message);
    }
    
    return results;
  });
  
  console.log('\n📊 SEARCH RESULTS:');
  console.log('==================');
  
  console.log(`\n🪟 Window keys containing 'three', 'scene', 'world', or 'render':`);
  if (searchResults.windowKeys.length > 0) {
    searchResults.windowKeys.forEach(key => console.log(`  - window.${key}`));
  } else {
    console.log('  - None found');
  }
  
  console.log(`\n🌍 World object keys:`);
  if (searchResults.worldKeys.length > 0) {
    searchResults.worldKeys.forEach(key => console.log(`  - world.${key}`));
  } else {
    console.log('  - None found');
  }
  
  console.log(`\n🎭 THREE.js namespace locations:`);
  if (searchResults.threeLocations.length > 0) {
    searchResults.threeLocations.forEach(loc => console.log(`  - ${loc}`));
  } else {
    console.log('  - None found');
  }
  
  console.log(`\n🎬 Scene object locations:`);
  if (searchResults.sceneLocations.length > 0) {
    searchResults.sceneLocations.forEach(loc => console.log(`  - ${loc}`));
  } else {
    console.log('  - None found');
  }
  
  console.log(`\n📹 Renderer object locations:`);
  if (searchResults.rendererLocations.length > 0) {
    searchResults.rendererLocations.forEach(loc => console.log(`  - ${loc}`));
  } else {
    console.log('  - None found');
  }
  
  console.log(`\n📷 Camera object locations:`);
  if (searchResults.cameraLocations.length > 0) {
    searchResults.cameraLocations.forEach(loc => console.log(`  - ${loc}`));
  } else {
    console.log('  - None found');
  }
  
  console.log(`\n🧊 Mesh object locations:`);
  if (searchResults.meshLocations.length > 0) {
    searchResults.meshLocations.forEach(loc => console.log(`  - ${loc}`));
  } else {
    console.log('  - None found');
  }
  
  if (searchResults.canvasCount !== undefined) {
    console.log(`\n🖼️  Canvas elements found: ${searchResults.canvasCount}`);
  }
  
  if (searchResults.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    searchResults.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  // Try alternative access patterns
  console.log('\n🔬 Trying alternative access patterns...');
  const altResults = await page.evaluate(() => {
    const results = {};
    
    try {
      // Check for specific Hyperfy patterns
      if (window.hyperfyWorld) {
        results.hyperfyWorldExists = true;
        results.hyperfyWorldKeys = Object.keys(window.hyperfyWorld);
      }
      
      if (window.world && window.world.entities) {
        results.entitiesExists = true;
        results.entitiesKeys = Object.keys(window.world.entities);
      }
      
      if (window.world && window.world.systems) {
        results.systemsExists = true;
        results.systemsKeys = Object.keys(window.world.systems);
      }
      
      // Check for React/app structure
      if (window.React) {
        results.reactExists = true;
      }
      
      // Check console for any stored references
      if (console.lastThreeScene) {
        results.consoleScene = true;
      }
      
    } catch (error) {
      results.error = error.message;
    }
    
    return results;
  });
  
  console.log('Alternative patterns:');
  Object.entries(altResults).forEach(([key, value]) => {
    console.log(`  - ${key}: ${value}`);
  });
  
  console.log('\n🔍 Keeping browser open for 10 seconds for manual inspection...');
  await page.waitForTimeout(10000);
  
  await browser.close();
  
  console.log('\n✅ Search complete!');
}

findThreeObjects().catch(console.error);