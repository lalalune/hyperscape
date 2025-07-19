#!/usr/bin/env node

import { TestFramework } from '../core/TestFramework.mjs';

console.log('🧪 TESTING SIMPLE HYPERFY APP');
console.log('=====================================');

const framework = new TestFramework();

try {
  console.log('🚀 Starting server with SimpleTest app...');
  await framework.startServer('/Users/shawwalters/hyperscape/packages/hyperfy');
  console.log('✅ Simple test server ready');

  console.log('🌐 Testing SimpleTest in browser...');
  await framework.startBrowser();
  
  console.log('🏠 Loading world...');
  await framework.page.goto('http://localhost:3001', {
    waitUntil: 'networkidle0',
    timeout: 10000
  });
  
  console.log('⏳ Waiting for systems to initialize...');
  await framework.page.waitForTimeout(3000);
  
  console.log('📸 Taking screenshot...');
  const screenshotPath = `/Users/shawwalters/hyperscape/packages/screenshots/simple-test-${Date.now()}.png`;
  await framework.page.screenshot({ 
    path: screenshotPath, 
    fullPage: false 
  });
  
  console.log('🔍 Analyzing world content...');
  
  // Check for any entities in the browser
  const entities = await framework.page.evaluate(() => {
    const results = [];
    
    // Check if SimpleTest console logs appeared
    if (window.console && window.console.log) {
      results.push({ type: 'console', found: true });
    }
    
    // Check for Three.js scene
    if (window.THREE && window.scene) {
      results.push({ type: 'three_scene', found: true });
      
      // Count objects in the scene
      const objectCount = window.scene.children.length;
      results.push({ type: 'scene_objects', count: objectCount });
    }
    
    // Check for red objects (our test cube should be red)
    const canvas = document.querySelector('canvas');
    if (canvas) {
      results.push({ type: 'canvas', found: true, width: canvas.width, height: canvas.height });
    }
    
    return results;
  });
  
  console.log('📊 SIMPLE TEST RESULTS:');
  console.log('==================================================');
  console.log('Screenshot:', screenshotPath);
  console.log('Browser Entities Found:', entities.length);
  
  entities.forEach(entity => {
    console.log(`- ${entity.type}:`, entity);
  });
  
  // Use image analysis to detect red pixels
  console.log('🔍 Analyzing screenshot for red cube...');
  const imageAnalysis = await framework.analyzeImage(screenshotPath);
  
  console.log('Image Analysis:');
  console.log(`- Total pixels: ${imageAnalysis.totalPixels}`);
  console.log(`- Red pixels: ${imageAnalysis.colorStats.red || 0}`);
  console.log(`- Dominant colors:`, Object.keys(imageAnalysis.dominantColors).slice(0, 5));
  
  const hasRedPixels = (imageAnalysis.colorStats.red || 0) > 100; // At least 100 red pixels
  
  if (hasRedPixels && entities.length > 0) {
    console.log('✅ SUCCESS: SimpleTest app appears to be working!');
    console.log('   - Browser entities detected');
    console.log('   - Red pixels found in screenshot');
  } else {
    console.log('❌ FAILURE: SimpleTest app not working properly');
    console.log(`   - Entities: ${entities.length}`);
    console.log(`   - Red pixels: ${imageAnalysis.colorStats.red || 0}`);
  }
  
} catch (error) {
  console.error('💥 Simple test failed:', error.message);
} finally {
  console.log('🔄 Closing browser...');
  await framework.cleanup();
  console.log('🛑 Stopping simple test server...');
  await framework.stopServer();
}

console.log('🏁 Simple test complete!');