#!/usr/bin/env node
/**
 * Comprehensive Concurrency Test Suite Runner
 *
 * Runs all concurrency tests and generates a detailed report
 * verifying that all Wave 2 race condition fixes are working correctly.
 *
 * Usage:
 *   node tests/concurrency-test-suite.mjs
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('\n' + '='.repeat(80))
console.log('🧪 COMPREHENSIVE CONCURRENCY TEST SUITE')
console.log('='.repeat(80))
console.log('')
console.log('This suite verifies that all Wave 2 race condition fixes are working correctly.')
console.log('Tests cover critical areas: team capacity, voice generation, API keys, assets,')
console.log('admin whitelist, and user sessions.')
console.log('')

/**
 * Test definitions
 */
const tests = [
  {
    name: 'Team Capacity Race Condition',
    path: '../server/auth/__tests__/team-capacity-race-condition.test.mjs',
    critical: 'CRITICAL-8',
    description: 'Verifies team member count enforcement under concurrent joins'
  },
  {
    name: 'Voice Generation Counter',
    path: '../server/services/__tests__/voice-race-condition.test.mjs',
    critical: 'CRITICAL-7',
    description: 'Verifies progress counter accuracy under parallel voice generation'
  },
  {
    name: 'Voice Generation Stress Test',
    path: '../server/services/__tests__/voice-race-condition-stress.test.mjs',
    critical: 'CRITICAL-7',
    description: 'Stress tests voice counter with extreme concurrency (100 iterations)'
  },
  {
    name: 'API Key Generation',
    path: '../server/routes/__tests__/api-keys-concurrency.test.mjs',
    critical: 'NEW',
    description: 'Verifies API key uniqueness under concurrent generation'
  },
  {
    name: 'Asset Creation',
    path: '../server/services/__tests__/asset-creation-concurrency.test.mjs',
    critical: 'NEW',
    description: 'Verifies asset counter integrity under concurrent uploads'
  },
  {
    name: 'Admin Whitelist',
    path: '../server/routes/__tests__/admin-whitelist-concurrency.test.mjs',
    critical: 'NEW',
    description: 'Verifies admin whitelist uniqueness under concurrent operations'
  },
  {
    name: 'User Session',
    path: '../server/auth/__tests__/session-concurrency.test.mjs',
    critical: 'NEW',
    description: 'Verifies session token uniqueness under concurrent logins'
  }
]

/**
 * Run a single test
 */
async function runTest(test) {
  const testPath = path.join(__dirname, test.path)

  return new Promise((resolve) => {
    const startTime = Date.now()
    let output = ''

    const testProcess = spawn('node', [testPath], {
      cwd: path.dirname(testPath),
      env: { ...process.env }
    })

    testProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    testProcess.stderr.on('data', (data) => {
      output += data.toString()
    })

    testProcess.on('close', (code) => {
      const duration = Date.now() - startTime

      resolve({
        name: test.name,
        critical: test.critical,
        description: test.description,
        passed: code === 0,
        exitCode: code,
        duration,
        output
      })
    })

    testProcess.on('error', (error) => {
      const duration = Date.now() - startTime

      resolve({
        name: test.name,
        critical: test.critical,
        description: test.description,
        passed: false,
        exitCode: -1,
        duration,
        output: `Error: ${error.message}\n${output}`,
        error: error.message
      })
    })
  })
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('📊 Running tests...\n')

  const results = []

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i]

    console.log(`[${i + 1}/${tests.length}] Running: ${test.name}`)
    console.log(`    ${test.description}`)
    console.log(`    Critical: ${test.critical}`)

    const result = await runTest(test)

    results.push(result)

    const status = result.passed ? '✅ PASSED' : '❌ FAILED'
    console.log(`    ${status} (${result.duration}ms)`)
    console.log('')
  }

  return results
}

/**
 * Generate detailed report
 */
async function generateReport(results) {
  console.log('\n' + '='.repeat(80))
  console.log('📋 CONCURRENCY TEST SUITE RESULTS')
  console.log('='.repeat(80))
  console.log('')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length
  const passRate = ((passed / total) * 100).toFixed(1)

  console.log(`Total Tests: ${total}`)
  console.log(`Passed: ${passed} (${passRate}%)`)
  console.log(`Failed: ${failed}`)
  console.log('')

  // Group by status
  const passedTests = results.filter(r => r.passed)
  const failedTests = results.filter(r => !r.passed)

  if (passedTests.length > 0) {
    console.log('✅ PASSED TESTS:')
    console.log('─'.repeat(80))
    for (const test of passedTests) {
      console.log(`   ${test.name} (${test.critical})`)
      console.log(`   └─ ${test.description}`)
      console.log(`      Duration: ${test.duration}ms`)
      console.log('')
    }
  }

  if (failedTests.length > 0) {
    console.log('❌ FAILED TESTS:')
    console.log('─'.repeat(80))
    for (const test of failedTests) {
      console.log(`   ${test.name} (${test.critical})`)
      console.log(`   └─ ${test.description}`)
      console.log(`      Exit Code: ${test.exitCode}`)
      console.log(`      Duration: ${test.duration}ms`)
      if (test.error) {
        console.log(`      Error: ${test.error}`)
      }
      console.log('')
    }
  }

  // Summary by critical area
  console.log('📊 SUMMARY BY CRITICAL AREA:')
  console.log('─'.repeat(80))

  const criticalAreas = [...new Set(results.map(r => r.critical))]
  for (const area of criticalAreas) {
    const areaTests = results.filter(r => r.critical === area)
    const areaPassed = areaTests.filter(r => r.passed).length
    const areaTotal = areaTests.length

    const status = areaPassed === areaTotal ? '✅' : '❌'
    console.log(`   ${status} ${area}: ${areaPassed}/${areaTotal} tests passed`)
  }

  console.log('')

  // Race condition analysis
  console.log('🔍 RACE CONDITION ANALYSIS:')
  console.log('─'.repeat(80))

  const raceConditionTests = [
    {
      name: 'Team Member Count (CRITICAL-8)',
      test: results.find(r => r.name === 'Team Capacity Race Condition'),
      fix: 'Database transaction + capacity checking'
    },
    {
      name: 'Voice Generation Counter (CRITICAL-7)',
      test: results.find(r => r.name === 'Voice Generation Counter'),
      fix: 'Promise chain lock for atomic increments'
    },
    {
      name: 'API Key Uniqueness',
      test: results.find(r => r.name === 'API Key Generation'),
      fix: 'Database UNIQUE constraint + transaction'
    },
    {
      name: 'Asset Counter',
      test: results.find(r => r.name === 'Asset Creation'),
      fix: 'Database transaction + atomic counter'
    },
    {
      name: 'Admin Whitelist',
      test: results.find(r => r.name === 'Admin Whitelist'),
      fix: 'Database UNIQUE constraint + transaction'
    },
    {
      name: 'Session Tokens',
      test: results.find(r => r.name === 'User Session'),
      fix: 'Database UNIQUE constraint + retry logic'
    }
  ]

  for (const item of raceConditionTests) {
    if (!item.test) continue

    const status = item.test.passed ? '✅ PROTECTED' : '❌ VULNERABLE'
    console.log(`   ${status} ${item.name}`)
    console.log(`             Fix: ${item.fix}`)
  }

  console.log('')

  // Recommendations
  if (failedTests.length > 0) {
    console.log('⚠️  RECOMMENDATIONS:')
    console.log('─'.repeat(80))
    console.log('   1. Review failed test output logs for detailed error messages')
    console.log('   2. Verify database transaction implementation in failing tests')
    console.log('   3. Check for proper UNIQUE constraints on critical columns')
    console.log('   4. Ensure atomic operations are wrapped in db.transaction()')
    console.log('   5. Consider stress testing with higher concurrency levels')
    console.log('')
  }

  // Final verdict
  console.log('='.repeat(80))
  if (failed === 0) {
    console.log('🎉 ALL CONCURRENCY TESTS PASSED!')
    console.log('')
    console.log('All Wave 2 race condition fixes have been verified.')
    console.log('The system is protected against the tested concurrency issues.')
  } else {
    console.log('⚠️  SOME TESTS FAILED')
    console.log('')
    console.log(`${failed} test(s) failed. Please review the failures and implement fixes.`)
  }
  console.log('='.repeat(80))
  console.log('')

  // Generate JSON report
  const jsonReport = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed,
      passRate: parseFloat(passRate)
    },
    results: results.map(r => ({
      name: r.name,
      critical: r.critical,
      description: r.description,
      passed: r.passed,
      duration: r.duration,
      exitCode: r.exitCode
    })),
    raceConditions: raceConditionTests.map(item => ({
      name: item.name,
      protected: item.test?.passed || false,
      fix: item.fix
    }))
  }

  // Save JSON report
  const reportPath = path.join(__dirname, '../concurrency-test-report.json')
  await fs.writeFile(reportPath, JSON.stringify(jsonReport, null, 2))
  console.log(`📄 JSON report saved to: ${reportPath}`)
  console.log('')

  return failed === 0
}

/**
 * Main execution
 */
async function main() {
  try {
    const results = await runAllTests()
    const allPassed = await generateReport(results)

    process.exit(allPassed ? 0 : 1)
  } catch (error) {
    console.error('❌ Test suite failed with error:', error)
    process.exit(1)
  }
}

main()
