#!/usr/bin/env node

const { spawn } = require('child_process')
const path = require('path')

console.log('🚀 Running RPG Asset Generation Test Suite')
console.log('=' .repeat(60))

const results = []

async function runTest(description, command, args = []) {
  console.log(`\n📋 ${description}...`)
  
  const startTime = Date.now()
  
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'pipe',
      shell: true
    })
    
    let stdout = ''
    let stderr = ''
    
    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })
    
    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })
    
    proc.on('close', (code) => {
      const duration = Date.now() - startTime
      const success = code === 0
      
      results.push({
        description,
        success,
        duration,
        command: `${command} ${args.join(' ')}`,
        stdout: stdout.slice(-1000), // Keep last 1000 chars
        stderr: stderr.slice(-1000)
      })
      
      if (success) {
        console.log(`✅ ${description} - PASSED (${duration}ms)`)
      } else {
        console.log(`❌ ${description} - FAILED (${duration}ms)`)
        if (stderr) {
          console.log(`Error: ${stderr.slice(-200)}`) // Show last 200 chars of error
        }
      }
      
      resolve(success)
    })
    
    proc.on('error', (error) => {
      const duration = Date.now() - startTime
      results.push({
        description,
        success: false,
        duration,
        command: `${command} ${args.join(' ')}`,
        error: error.message
      })
      
      console.log(`❌ ${description} - ERROR (${duration}ms): ${error.message}`)
      resolve(false)
    })
  })
}

async function main() {
  // Test 1: File existence validation
  await runTest(
    'Batch File Validation',
    'npx',
    ['playwright', 'test', 'tests/validation/file-existence.spec.ts', '--config=playwright.config.ts']
  )
  
  // Test 2: Asset validation 
  await runTest(
    'Asset Validation Tests',
    'npx',
    ['playwright', 'test', 'tests/validation/asset-validation.spec.ts', '--config=playwright.config.ts']
  )
  
  // Test 3: Check if we can list batch files
  await runTest(
    'Batch Files Check',
    'ls',
    ['-la', 'demo-batches/']
  )
  
  // Test 4: Check if output directory exists
  await runTest(
    'Output Directory Check',
    'ls',
    ['-la', 'output/']
  )
  
  // Generate summary
  console.log('\n📊 Test Summary')
  console.log('=' .repeat(60))
  
  const totalTests = results.length
  const passedTests = results.filter(r => r.success).length
  const failedTests = totalTests - passedTests
  
  console.log(`Total Tests: ${totalTests}`)
  console.log(`Passed: ${passedTests}`)
  console.log(`Failed: ${failedTests}`)
  console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`)
  
  if (failedTests > 0) {
    console.log('\n❌ Failed Tests:')
    results.filter(r => !r.success).forEach(result => {
      console.log(`  - ${result.description}`)
      if (result.error) {
        console.log(`    Error: ${result.error}`)
      }
    })
  }
  
  console.log('\n🎉 Test run complete!')
  
  // Exit with proper code
  process.exit(failedTests === 0 ? 0 : 1)
}

main().catch(console.error)