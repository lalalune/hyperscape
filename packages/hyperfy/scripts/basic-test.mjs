#!/usr/bin/env node

/**
 * Basic Functionality Test
 * 
 * Minimal test to verify the package is working
 */

console.log('🎮 Hyperfy Package Basic Test');
console.log('===============================');

const tests = [
  {
    name: 'Package Structure',
    test: () => {
      const fs = require('fs');
      const path = require('path');
      
      const packagePath = path.join(process.cwd(), 'package.json');
      const srcPath = path.join(process.cwd(), 'src');
      
      return {
        passed: fs.existsSync(packagePath) && fs.existsSync(srcPath),
        details: {
          hasPackageJson: fs.existsSync(packagePath),
          hasSrcDir: fs.existsSync(srcPath)
        }
      };
    }
  },
  
  {
    name: 'RPG Scripts Available',
    test: () => {
      const fs = require('fs');
      const path = require('path');
      
      const rpgTestScript = path.join(process.cwd(), 'scripts', 'run-rpg-tests.mjs');
      const rpgVisualScript = path.join(process.cwd(), 'scripts', 'rpg-visual-test.mjs');
      
      return {
        passed: fs.existsSync(rpgTestScript) && fs.existsSync(rpgVisualScript),
        details: {
          hasRpgTestScript: fs.existsSync(rpgTestScript),
          hasRpgVisualScript: fs.existsSync(rpgVisualScript)
        }
      };
    }
  },
  
  {
    name: 'Core Dependencies Check',
    test: () => {
      try {
        // Try to require core Node.js modules that the package uses
        require('fs');
        require('path');
        require('crypto');
        
        return {
          passed: true,
          details: {
            nodeCoreModules: 'available'
          }
        };
      } catch (error) {
        return {
          passed: false,
          details: {
            error: error.message
          }
        };
      }
    }
  }
];

function runTests() {
  console.log(`\n🏃 Running ${tests.length} basic tests...\n`);
  
  const results = [];
  
  for (const test of tests) {
    console.log(`📋 ${test.name}...`);
    
    try {
      const result = test.test();
      results.push({
        name: test.name,
        ...result
      });
      
      console.log(`   ${result.passed ? '✅' : '❌'} ${result.passed ? 'PASSED' : 'FAILED'}`);
      if (!result.passed) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
      }
    } catch (error) {
      results.push({
        name: test.name,
        passed: false,
        details: { error: error.message }
      });
      console.log(`   ❌ FAILED - ${error.message}`);
    }
    
    console.log('');
  }
  
  // Summary
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  console.log('🏆 Test Results Summary');
  console.log('=======================');
  console.log(`   Passed: ${passedTests}/${totalTests}`);
  console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All basic tests passed! Package structure is valid.');
  } else {
    console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed.`);
  }
  
  return passedTests === totalTests;
}

// Run tests
try {
  const success = runTests();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error('💥 Test runner failed:', error.message);
  process.exit(1);
}