#!/usr/bin/env node

import { existsSync } from 'fs';
import { join } from 'path';

console.log('🧪 Verifying TDD Setup for Among Us Hyperfy\n');

const checks = [
  {
    name: 'Test Framework',
    files: [
      'vitest.config.ts',
      'cypress.config.ts',
      'src/__tests__/setup.ts'
    ]
  },
  {
    name: 'Core Tests',
    files: [
      'src/__tests__/core/GameState.test.ts',
      'src/__tests__/core/PlayerMovement.test.ts'
    ]
  },
  {
    name: 'Frontend Tests',
    files: [
      'src/__tests__/frontend/GameUI.test.tsx'
    ]
  },
  {
    name: 'Agent Tests',
    files: [
      'src/__tests__/agents/RealAgentIntegration.test.ts'
    ]
  },
  {
    name: 'Simulation Tests',
    files: [
      'src/__tests__/simulation/PlayerSimulation.test.ts'
    ]
  },
  {
    name: 'Test Helpers',
    files: [
      'src/__tests__/helpers/MockWorld.ts',
      'src/testing/PlayerSimulator.ts'
    ]
  },
  {
    name: 'Implementations',
    files: [
      'src/apps/amongus/GameState.ts',
      'src/entities/Player.ts',
      'src/systems/PlayerMovementSystem.ts',
      'src/types/math.ts'
    ]
  },
  {
    name: 'Test Scripts',
    files: [
      'scripts/run-all-tests.js',
      'scripts/demo-tdd-workflow.js',
      'scripts/generate-visual-test-report.js'
    ]
  }
];

let allPassed = true;

console.log('Checking test setup...\n');

checks.forEach(check => {
  console.log(`📁 ${check.name}:`);
  
  check.files.forEach(file => {
    const exists = existsSync(join(process.cwd(), file));
    const status = exists ? '✅' : '❌';
    const color = exists ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`   ${status} ${color}${file}\x1b[0m`);
    
    if (!exists) allPassed = false;
  });
  
  console.log('');
});

console.log('📋 Test Commands Available:');
console.log('   npm test              - Run all tests');
console.log('   npm run test:unit     - Run unit tests');
console.log('   npm run test:frontend - Run frontend tests');
console.log('   npm run test:agents   - Run agent tests');
console.log('   npm run test:tdd      - Start TDD watch mode');
console.log('   npm run test:coverage - Generate coverage report');
console.log('');

if (allPassed) {
  console.log('✅ All test files are in place!');
  console.log('');
  console.log('🚀 Next steps:');
  console.log('   1. Install dependencies: npm install');
  console.log('   2. Run tests: npm test');
  console.log('   3. Start TDD workflow: npm run test:tdd');
} else {
  console.log('❌ Some test files are missing.');
  console.log('   The implementation has been designed but files need to be created.');
  console.log('   Run the test commands to see which specific implementations are needed.');
}

console.log('\n📚 Documentation:');
console.log('   - TDD Strategy: HYPERFY_AMONGUS_TDD_STRATEGY.md');
console.log('   - Test Summary: HYPERFY_AMONGUS_TEST_IMPLEMENTATION_SUMMARY.md');
console.log('   - Complete Guide: HYPERFY_AMONGUS_TDD_COMPLETE.md');

process.exit(allPassed ? 0 : 1); 