#!/usr/bin/env node

/**
 * Physics Integration Test Script
 * Standalone test runner specifically for the new physics test systems
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { resolve as pathResolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = pathResolve(__dirname, '..');

console.log('🔬 Physics Integration Test Runner Starting...');
console.log('📍 Testing RPGPhysicsIntegrationTestSystem and RPGPrecisionPhysicsTestSystem');

// Environment setup
process.env.NODE_ENV = 'test';
process.env.ENABLE_RPG_TESTS = 'true';
process.env.RPG_ENABLE_ALL_TEST_SYSTEMS = 'true';

let serverProcess = null;
let testResults = {
  passed: false,
  startTime: Date.now(),
  endTime: null,
  duration: null,
  errors: [],
  logs: [],
  physicsTests: {}
};

function logAndRecord(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  
  console.log(logEntry);
  testResults.logs.push(logEntry);
  
  if (isError) {
    testResults.errors.push(logEntry);
  }
}

async function startServer() {
  logAndRecord('🚀 Starting Hyperfy server for physics testing...');
  
  return new Promise((resolve, reject) => {
    const serverScript = pathResolve(rootDir, 'src/server/index.ts');
    
    serverProcess = spawn('npx', ['tsx', serverScript], {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: '3333',
        NODE_ENV: 'test',
        ENABLE_RPG_TESTS: 'true',
        RPG_ENABLE_ALL_TEST_SYSTEMS: 'true'
      }
    });

    let serverReady = false;
    let startupOutput = '';

    const checkServerReady = (data) => {
      const output = data.toString();
      startupOutput += output;
      
      // Look for physics test system initialization
      if (output.includes('[PhysicsTests] Initializing comprehensive physics test system') ||
          output.includes('[PrecisionPhysics] Initializing precision physics test system') ||
          output.includes('Physics integration test system initialized')) {
        logAndRecord('✅ Physics test systems detected in server startup');
      }
      
      // Check for server ready indicators
      if (output.includes('Server listening on') || 
          output.includes('HTTP server listening') ||
          output.includes('World initialized') ||
          output.includes('started on port')) {
        if (!serverReady) {
          serverReady = true;
          logAndRecord('✅ Server ready for physics testing');
          setTimeout(() => resolve(), 2000); // Give additional time for systems to initialize
        }
      }
      
      // Look for physics test completions
      if (output.includes('ALL PHYSICS INTEGRATION TESTS PASSED')) {
        testResults.physicsTests.integration = { passed: true };
        logAndRecord('✅ Physics integration tests PASSED');
      }
      
      if (output.includes('ALL PRECISION PHYSICS TESTS PASSED')) {
        testResults.physicsTests.precision = { passed: true };
        logAndRecord('✅ Precision physics tests PASSED');
      }
      
      // Look for physics test failures
      if (output.includes('PHYSICS TESTS FAILED') || output.includes('PRECISION PHYSICS TESTS FAILED')) {
        testResults.physicsTests.failed = true;
        logAndRecord('❌ Physics tests FAILED', true);
      }
    };

    serverProcess.stdout.on('data', checkServerReady);
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error('Server stderr:', output);
      checkServerReady(data);
    });

    serverProcess.on('error', (error) => {
      logAndRecord(`❌ Server startup error: ${error.message}`, true);
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        logAndRecord('⏰ Server startup timeout (30s)', true);
        logAndRecord('Startup output:', false);
        console.log(startupOutput);
        reject(new Error('Server startup timeout'));
      }
    }, 30000);
  });
}

async function testPhysicsIntegration() {
  logAndRecord('🔬 Testing physics integration systems...');
  
  // Wait for automatic tests to complete (they start automatically)
  await new Promise(resolve => setTimeout(resolve, 20000)); // 20 seconds for physics tests to complete
  
  // Check if tests completed successfully
  const integrationPassed = testResults.physicsTests.integration?.passed || false;
  const precisionPassed = testResults.physicsTests.precision?.passed || false;
  const anyFailed = testResults.physicsTests.failed || false;
  
  if (anyFailed) {
    logAndRecord('❌ Physics tests reported failures', true);
    return false;
  }
  
  if (!integrationPassed && !precisionPassed) {
    logAndRecord('⚠️ No physics test completion signals detected - tests may not be running', true);
    // Don't fail immediately - may just be timing
  }
  
  logAndRecord('✅ Physics integration test phase completed');
  return true;
}

async function runPhysicsTests() {
  try {
    // Start server
    await startServer();
    
    // Run physics tests
    const physicsTestsOk = await testPhysicsIntegration();
    
    // Determine overall result
    const hasErrors = testResults.errors.length > 0;
    const testsPassed = physicsTestsOk && !hasErrors;
    
    testResults.passed = testsPassed;
    testResults.endTime = Date.now();
    testResults.duration = testResults.endTime - testResults.startTime;
    
    if (testsPassed) {
      logAndRecord('🎉 ALL PHYSICS TESTS PASSED!');
    } else {
      logAndRecord('❌ PHYSICS TESTS FAILED', true);
    }
    
  } catch (error) {
    logAndRecord(`💥 Test execution error: ${error.message}`, true);
    testResults.passed = false;
    testResults.endTime = Date.now();
    testResults.duration = testResults.endTime - testResults.startTime;
  } finally {
    // Clean up
    if (serverProcess) {
      logAndRecord('🛑 Stopping server...');
      serverProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (serverProcess) {
          serverProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }
}

async function generateReport() {
  const reportPath = pathResolve(rootDir, 'test-results/physics-integration-test.json');
  
  try {
    writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    logAndRecord(`📄 Test report saved to: ${reportPath}`);
  } catch (error) {
    logAndRecord(`⚠️ Could not save test report: ${error.message}`, true);
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('🔬 PHYSICS INTEGRATION TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Status: ${testResults.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Duration: ${(testResults.duration / 1000).toFixed(1)}s`);
  console.log(`Errors: ${testResults.errors.length}`);
  
  if (testResults.physicsTests.integration) {
    console.log(`Integration Tests: ${testResults.physicsTests.integration.passed ? '✅ PASSED' : '❌ FAILED'}`);
  }
  
  if (testResults.physicsTests.precision) {
    console.log(`Precision Tests: ${testResults.physicsTests.precision.passed ? '✅ PASSED' : '❌ FAILED'}`);
  }
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    testResults.errors.slice(0, 5).forEach(error => console.log(`  ${error}`));
    if (testResults.errors.length > 5) {
      console.log(`  ... and ${testResults.errors.length - 5} more errors`);
    }
  }
  
  console.log('='.repeat(60));
}

// Main execution
async function main() {
  try {
    await runPhysicsTests();
    await generateReport();
    
    // Exit with appropriate code
    process.exit(testResults.passed ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  logAndRecord('🛑 Test interrupted by user');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(1);
});

process.on('SIGTERM', () => {
  logAndRecord('🛑 Test terminated');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(1);
});

main();