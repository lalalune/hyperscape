#!/usr/bin/env node

/**
 * Test Single Model Generation
 * Quick test to verify Meshy API integration works
 */

import { MeshyAIService } from './MeshyAIService.js';

async function testSingleModel() {
  console.log('🧪 Testing Meshy AI Integration\n');
  
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    console.error('❌ MESHY_API_KEY environment variable is required');
    console.log('Get your API key from https://meshy.ai and set it as an environment variable');
    process.exit(1);
  }
  
  const service = new MeshyAIService({ apiKey });
  
  // Test with a simple sword
  const testPrompt = 'medieval fantasy sword, sharp steel blade, detailed crossguard, leather-wrapped handle, ornate pommel, well-crafted, good quality, game asset, clean topology, PBR materials, fantasy RPG style';
  
  console.log('🎨 Starting generation...');
  console.log(`Prompt: ${testPrompt}`);
  
  try {
    // Start generation
    const taskId = await service.textTo3D({
      prompt: testPrompt,
      artStyle: 'realistic',
    });
    
    console.log(`✅ Generation started!`);
    console.log(`   Task ID: ${taskId}`);
    
    console.log('\n⏳ Waiting for completion (this may take 3-5 minutes)...');
    
    // Wait for completion
    const result = await service.waitForCompletion(taskId);
    
    console.log(`\n🎉 Generation completed!`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Task ID: ${taskId}`);
    
    if (result.model_urls) {
      console.log('\n📁 Generated files:');
      if (result.model_urls.glb) {
        console.log(`   GLB: ${result.model_urls.glb}`);
      }
      if (result.model_urls.fbx) {
        console.log(`   FBX: ${result.model_urls.fbx}`);
      }
      if (result.model_urls.usdz) {
        console.log(`   USDZ: ${result.model_urls.usdz}`);
      }
      if (result.thumbnail_url) {
        console.log(`   Thumbnail: ${result.thumbnail_url}`);
      }
      if (result.video_url) {
        console.log(`   Video: ${result.video_url}`);
      }
    }
    
    // Test download
    if (result.model_urls?.glb) {
      console.log('\n📥 Testing GLB download...');
      
      // Download the GLB file
      const response = await fetch(result.model_urls.glb);
      if (!response.ok) {
        throw new Error(`Failed to download GLB: ${response.status}`);
      }
      
      const glbData = await response.arrayBuffer();
      console.log(`✅ Downloaded GLB file: ${glbData.byteLength} bytes`);
      
      // Save test file
      const fs = await import('fs');
      fs.writeFileSync('./test-sword.glb', new Uint8Array(glbData));
      console.log('💾 Saved as test-sword.glb');
    }
    
    console.log('\n🎮 Test completed successfully!');
    console.log('You can now use the full batch generation script.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    if (error instanceof Error && error.message.includes('401')) {
      console.log('\n🔑 This appears to be an authentication error.');
      console.log('Please check your MESHY_API_KEY is correct.');
    } else if (error instanceof Error && error.message.includes('429')) {
      console.log('\n⏰ Rate limit exceeded. Wait a moment and try again.');
    } else {
      console.log('\n💡 This could be a network issue or API problem.');
      console.log('Check your internet connection and try again.');
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSingleModel();
}