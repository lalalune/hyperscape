#!/usr/bin/env node

/**
 * Simple Physics Systems Check
 * Verifies that our physics test systems are properly registered
 */

import { createServerWorld } from '../build/index.js';

console.log('🔬 Checking Physics Test Systems Registration...');

async function checkPhysicsSystems() {
  try {
    // Create a server world to test system registration
    const world = await createServerWorld();
    
    console.log('✅ Server world created successfully');
    
    // Check if our physics test systems are registered
    const systems = world.systems || [];
    console.log(`📊 Total systems registered: ${systems.length}`);
    
    // Look for our physics test systems
    const physicsIntegrationSystem = world['rpg-physics-integration-test'];
    const precisionPhysicsSystem = world['rpg-precision-physics-test'];
    
    console.log('\n🔍 Physics Test Systems Check:');
    console.log(`  Physics Integration Test System: ${physicsIntegrationSystem ? '✅ FOUND' : '❌ NOT FOUND'}`);
    console.log(`  Precision Physics Test System: ${precisionPhysicsSystem ? '✅ FOUND' : '❌ NOT FOUND'}`);
    
    if (physicsIntegrationSystem) {
      console.log(`    Type: ${physicsIntegrationSystem.constructor.name}`);
      console.log(`    Methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(physicsIntegrationSystem)).filter(name => name !== 'constructor').slice(0, 5).join(', ')}...`);
    }
    
    if (precisionPhysicsSystem) {
      console.log(`    Type: ${precisionPhysicsSystem.constructor.name}`);
      console.log(`    Methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(precisionPhysicsSystem)).filter(name => name !== 'constructor').slice(0, 5).join(', ')}...`);
    }
    
    // Check if RPG API is available
    const rpgAPI = world.rpg;
    if (rpgAPI) {
      console.log('\n🎮 RPG API Check:');
      console.log('  RPG API: ✅ FOUND');
      
      // Check for our physics test API methods
      const hasPhysicsIntegrationAPI = typeof rpgAPI.getPhysicsIntegrationResults === 'function';
      const hasPrecisionPhysicsAPI = typeof rpgAPI.getPrecisionPhysicsResults === 'function';
      const hasRunPhysicsTests = typeof rpgAPI.runPhysicsIntegrationTests === 'function';
      
      console.log(`  Physics Integration API: ${hasPhysicsIntegrationAPI ? '✅ FOUND' : '❌ NOT FOUND'}`);
      console.log(`  Precision Physics API: ${hasPrecisionPhysicsAPI ? '✅ FOUND' : '❌ NOT FOUND'}`);
      console.log(`  Run Physics Tests API: ${hasRunPhysicsTests ? '✅ FOUND' : '❌ NOT FOUND'}`);
    } else {
      console.log('\n🎮 RPG API: ❌ NOT FOUND');
    }
    
    // List all registered systems for debugging
    console.log('\n📋 All Registered Systems:');
    systems.forEach((system, index) => {
      const systemName = system.constructor.name;
      console.log(`  ${index + 1}. ${systemName}`);
    });
    
    // Check world properties for our systems
    console.log('\n🔍 World Properties Check:');
    const worldKeys = Object.keys(world).filter(key => key.includes('physics') || key.includes('test'));
    console.log(`  Physics/Test related properties: ${worldKeys.join(', ') || 'none'}`);
    
    const allTestsPassed = physicsIntegrationSystem && precisionPhysicsSystem && rpgAPI;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 PHYSICS SYSTEMS CHECK SUMMARY');
    console.log('='.repeat(60));
    console.log(`Status: ${allTestsPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Physics Integration System: ${physicsIntegrationSystem ? '✅' : '❌'}`);
    console.log(`Precision Physics System: ${precisionPhysicsSystem ? '✅' : '❌'}`);
    console.log(`RPG API Available: ${rpgAPI ? '✅' : '❌'}`);
    console.log('='.repeat(60));
    
    return allTestsPassed;
    
  } catch (error) {
    console.error('❌ Error checking physics systems:', error);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the check
checkPhysicsSystems().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});