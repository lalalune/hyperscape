#!/usr/bin/env node
/**
 * Unified Test Runner for Hyperfy RPG
 * Combines all tests into a single command: bun run test
 * 
 * Test Suite Components:
 * 1. RPG Comprehensive Tests (core gameplay)
 * 2. RPG Integration Tests (system integration)
 * 3. Hyperfy Framework Tests (engine validation)
 * 4. RPG Gameplay Tests (specific scenarios)
 * 5. Visual/UI Tests (interface validation)
 * 
 * Usage:
 *   bun run test                 - Run all tests (headless)
 *   bun run test --headed        - Run with visible browser
 *   bun run test --verbose       - Run with detailed logging
 *   bun run test --filter=rpg    - Run only RPG tests
 *   bun run test --filter=ui     - Run only UI tests
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scriptsDir = __dirname;

// Parse command line arguments
const args = process.argv.slice(2);
const isHeaded = args.includes('--headed');
const isVerbose = args.includes('--verbose');
const filterArg = args.find(arg => arg.startsWith('--filter='));
const filter = filterArg ? filterArg.split('=')[1] : null;

console.log('🧪 Hyperfy RPG Unified Test Runner Starting...');
console.log(`📊 Mode: ${isHeaded ? 'HEADED' : 'HEADLESS'} | Verbose: ${isVerbose ? 'ON' : 'OFF'} | Filter: ${filter || 'ALL'}`);

// Test suite configuration
const testSuites = [
  {
    id: 'rpg-comprehensive',
    name: '🎮 RPG Comprehensive Tests',
    description: 'Core RPG gameplay mechanics',
    script: 'test-rpg-comprehensive.mjs',
    category: 'rpg',
    priority: 1,
    timeout: 120000, // 2 minutes
    required: true
  },
  {
    id: 'rpg-integration',
    name: '🔗 RPG Integration Tests', 
    description: 'System integration validation',
    script: 'test-rpg-integration.mjs',
    category: 'rpg',
    priority: 2,
    timeout: 180000, // 3 minutes
    required: true
  },
  {
    id: 'hyperfy-framework',
    name: '⚡ Hyperfy Framework Tests',
    description: 'Engine and framework validation',
    script: 'test-framework.mjs',
    category: 'framework',
    priority: 3,
    timeout: 90000, // 1.5 minutes
    required: false
  },
  {
    id: 'rpg-gameplay',
    name: '🎯 RPG Gameplay Tests',
    description: 'Specific gameplay scenarios',
    script: 'test-rpg-gameplay.mjs',
    category: 'rpg',
    priority: 4,
    timeout: 150000, // 2.5 minutes
    required: false
  }
];

// Filter test suites based on command line filter
let filteredSuites = testSuites;
if (filter) {
  filteredSuites = testSuites.filter(suite => 
    suite.category === filter || 
    suite.id.includes(filter) ||
    suite.name.toLowerCase().includes(filter.toLowerCase())
  );
  
  if (filteredSuites.length === 0) {
    console.error(`❌ No test suites found matching filter: ${filter}`);
    console.log('Available filters: rpg, framework, integration, gameplay');
    process.exit(1);
  }
}

// Validate that test scripts exist
const missingScripts = [];
for (const suite of filteredSuites) {
  const scriptPath = resolve(scriptsDir, suite.script);
  if (!fs.existsSync(scriptPath)) {
    missingScripts.push({ suite: suite.name, script: suite.script, path: scriptPath });
  }
}

if (missingScripts.length > 0) {
  console.error('❌ Missing test scripts:');
  missingScripts.forEach(({ suite, script, path }) => {
    console.error(`   ${suite}: ${script} (${path})`);
  });
  process.exit(1);
}

console.log(`\n📋 Running ${filteredSuites.length} test suite${filteredSuites.length === 1 ? '' : 's'}:`);
filteredSuites.forEach((suite, index) => {
  console.log(`   ${index + 1}. ${suite.name} - ${suite.description}`);
});
console.log('');

// Test execution state
const results = {
  total: filteredSuites.length,
  passed: 0,
  failed: 0,
  skipped: 0,
  suiteResults: []
};

// Execute a single test suite
async function runTestSuite(suite) {
  console.log(`\n🏃 Running: ${suite.name}`);
  console.log(`📝 Description: ${suite.description}`);
  console.log(`📄 Script: ${suite.script}`);
  
  const startTime = Date.now();
  
  // Build command arguments
  const scriptPath = resolve(scriptsDir, suite.script);
  const commandArgs = ['node', scriptPath];
  
  if (isHeaded) commandArgs.push('--headed');
  if (isVerbose) commandArgs.push('--verbose');
  
  return new Promise((resolve) => {
    const process = spawn(commandArgs[0], commandArgs.slice(1), {
      stdio: isVerbose ? 'inherit' : 'pipe',
      cwd: dirname(scriptsDir) // Run from hyperfy package root
    });
    
    let stdout = '';
    let stderr = '';
    
    if (!isVerbose) {
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }
    
    // Set timeout
    const timeout = setTimeout(() => {
      console.log(`⏰ Test suite timed out after ${suite.timeout}ms`);
      process.kill('SIGKILL');
    }, suite.timeout);
    
    process.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      const success = code === 0;
      
      const result = {
        suite: suite.name,
        id: suite.id,
        success,
        code,
        duration,
        stdout: isVerbose ? null : stdout,
        stderr: isVerbose ? null : stderr,
        required: suite.required
      };
      
      if (success) {
        console.log(`✅ ${suite.name} PASSED (${Math.round(duration / 1000)}s)`);
        results.passed++;
      } else {
        console.log(`❌ ${suite.name} FAILED (${Math.round(duration / 1000)}s) - Exit code: ${code}`);
        results.failed++;
        
        // Show error output for failed tests
        if (!isVerbose && (stdout || stderr)) {
          console.log('📄 Test Output:');
          if (stdout) console.log('STDOUT:', stdout.slice(-1000)); // Last 1000 chars
          if (stderr) console.log('STDERR:', stderr.slice(-1000));
        }
      }
      
      results.suiteResults.push(result);
      resolve(result);
    });
    
    process.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`💥 Failed to start test suite ${suite.name}:`, error.message);
      
      const result = {
        suite: suite.name,
        id: suite.id,
        success: false,
        code: -1,
        duration: Date.now() - startTime,
        error: error.message,
        required: suite.required
      };
      
      results.failed++;
      results.suiteResults.push(result);
      resolve(result);
    });
  });
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Starting test execution...\n');
  
  // Show what would run without actually running (for validation)
  if (process.env.DRY_RUN === 'true') {
    console.log('🧪 DRY RUN MODE - No tests will actually execute\n');
    filteredSuites.forEach((suite, index) => {
      console.log(`   ${index + 1}. ✓ ${suite.name} (${suite.script})`);
    });
    console.log('\n✅ All test suites validated successfully!');
    process.exit(0);
  }
  
  const overallStartTime = Date.now();
  
  // Execute test suites sequentially (to avoid resource conflicts)
  for (const suite of filteredSuites) {
    await runTestSuite(suite);
  }
  
  const overallDuration = Date.now() - overallStartTime;
  
  // Generate final report
  console.log('\n' + '='.repeat(80));
  console.log('📊 UNIFIED TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`⏱️  Total Duration: ${Math.round(overallDuration / 1000)}s`);
  console.log(`📈 Results: ${results.passed} passed, ${results.failed} failed, ${results.total} total`);
  console.log(`📊 Success Rate: ${Math.round((results.passed / results.total) * 100)}%`);
  
  // Detailed results
  console.log('\n📋 Detailed Results:');
  results.suiteResults.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const required = result.required ? '[REQUIRED]' : '[OPTIONAL]';
    console.log(`   ${index + 1}. ${status} ${result.suite} ${required} (${Math.round(result.duration / 1000)}s)`);
  });
  
  // Check for critical failures
  const requiredFailures = results.suiteResults.filter(r => !r.success && r.required);
  const hasRequiredFailures = requiredFailures.length > 0;
  
  if (hasRequiredFailures) {
    console.log('\n💥 CRITICAL FAILURES DETECTED:');
    requiredFailures.forEach(failure => {
      console.log(`   ❌ ${failure.suite} (REQUIRED TEST FAILED)`);
    });
  }
  
  // Performance analysis
  const slowTests = results.suiteResults.filter(r => r.duration > 60000); // > 1 minute
  if (slowTests.length > 0) {
    console.log('\n🐌 Slow Test Suites (>1 minute):');
    slowTests.forEach(test => {
      console.log(`   ⏰ ${test.suite}: ${Math.round(test.duration / 1000)}s`);
    });
  }
  
  // Generate exit status
  let exitCode = 0;
  if (hasRequiredFailures) {
    exitCode = 1;
    console.log('\n❌ TEST SUITE FAILED - Required tests failed');
  } else if (results.failed > 0) {
    console.log('\n⚠️ TEST SUITE COMPLETED WITH WARNINGS - Optional tests failed');
  } else {
    console.log('\n✅ ALL TESTS PASSED!');
  }
  
  // Save results to file for CI/analysis
  const resultsFile = resolve(dirname(scriptsDir), 'test-results.json');
  const resultsData = {
    timestamp: new Date().toISOString(),
    duration: overallDuration,
    summary: {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      successRate: Math.round((results.passed / results.total) * 100)
    },
    suites: results.suiteResults,
    hasRequiredFailures,
    exitCode
  };
  
  try {
    fs.writeFileSync(resultsFile, JSON.stringify(resultsData, null, 2));
    console.log(`📁 Results saved to: ${resultsFile}`);
  } catch (error) {
    console.warn(`⚠️  Could not save results file: ${error.message}`);
  }
  
  console.log('='.repeat(80));
  process.exit(exitCode);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test execution interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test execution terminated');
  process.exit(143);
});

// Start the test runner
runAllTests().catch((error) => {
  console.error('💥 Unified test runner crashed:', error);
  process.exit(1);
});