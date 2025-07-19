import 'dotenv/config'
import chalk from 'chalk'
import { GDDAssetGenerator } from '../generators/GDDAssetGenerator'
import { ProgressTracker } from '../utils/ProgressTracker'
import { AssetPrompts } from '../config/AssetPrompts'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

export async function runTests(): Promise<void> {
  console.log(chalk.blue('🧪 AI Creation System Tests'))
  console.log(chalk.blue('=' .repeat(40)))
  
  const tests: TestResult[] = []
  
  // Test 1: Environment Variables
  tests.push(await testEnvironmentVariables())
  
  // Test 2: Asset Prompts
  tests.push(await testAssetPrompts())
  
  // Test 3: Progress Tracking
  tests.push(await testProgressTracking())
  
  // Test 4: GDD Asset Loading
  tests.push(await testGDDAssetLoading())
  
  // Test 5: Service Initialization
  tests.push(await testServiceInitialization())
  
  // Display results
  displayTestResults(tests)
  
  const failedTests = tests.filter(test => !test.passed)
  if (failedTests.length > 0) {
    throw new Error(`${failedTests.length} tests failed`)
  }
}

async function testEnvironmentVariables(): Promise<TestResult> {
  const start = Date.now()
  
  try {
    const hasOpenAI = !!process.env.OPENAI_API_KEY
    const hasMeshy = !!process.env.MESHY_API_KEY
    
    if (!hasOpenAI) {
      throw new Error('OPENAI_API_KEY not found in environment')
    }
    
    if (!hasMeshy) {
      throw new Error('MESHY_API_KEY not found in environment')
    }
    
    return {
      name: 'Environment Variables',
      passed: true,
      duration: Date.now() - start
    }
  } catch (error) {
    return {
      name: 'Environment Variables',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start
    }
  }
}

async function testAssetPrompts(): Promise<TestResult> {
  const start = Date.now()
  
  try {
    const supportedTypes = AssetPrompts.getSupportedTypes()
    
    if (supportedTypes.length === 0) {
      throw new Error('No supported asset types found')
    }
    
    // Test some common types
    const testTypes = ['sword', 'helmet', 'goblin', 'logs']
    
    for (const type of testTypes) {
      if (!AssetPrompts.hasSupportFor(type)) {
        throw new Error(`No support for asset type: ${type}`)
      }
    }
    
    // Test prompt generation
    const testAsset = {
      name: 'Test Sword',
      description: 'Test',
      type: 'weapon',
      subtype: 'sword',
      metadata: { tier: 'bronze' }
    }
    
    const prompt = AssetPrompts.getPrompt(testAsset)
    
    if (!prompt) {
      throw new Error('Failed to generate prompt for test asset')
    }
    
    if (!prompt.includes('bronze')) {
      throw new Error('Prompt does not include tier information')
    }
    
    return {
      name: 'Asset Prompts',
      passed: true,
      duration: Date.now() - start
    }
  } catch (error) {
    return {
      name: 'Asset Prompts',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start
    }
  }
}

async function testProgressTracking(): Promise<TestResult> {
  const start = Date.now()
  
  try {
    const tracker = new ProgressTracker()
    
    // Test progress report generation
    const report = await tracker.generateReport()
    
    if (typeof report.totalAssets !== 'number') {
      throw new Error('Invalid total assets count')
    }
    
    if (typeof report.successRate !== 'number') {
      throw new Error('Invalid success rate')
    }
    
    if (!Array.isArray(report.remainingAssets)) {
      throw new Error('Invalid remaining assets array')
    }
    
    return {
      name: 'Progress Tracking',
      passed: true,
      duration: Date.now() - start
    }
  } catch (error) {
    return {
      name: 'Progress Tracking',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start
    }
  }
}

async function testGDDAssetLoading(): Promise<TestResult> {
  const start = Date.now()
  
  try {
    // This will throw if GDD batch file is missing
    const generator = new GDDAssetGenerator()
    
    // Test getting remaining assets
    const tracker = new ProgressTracker()
    const remainingAssets = await tracker.getRemainingAssets()
    
    if (!Array.isArray(remainingAssets)) {
      throw new Error('Failed to load remaining assets')
    }
    
    return {
      name: 'GDD Asset Loading',
      passed: true,
      duration: Date.now() - start
    }
  } catch (error) {
    return {
      name: 'GDD Asset Loading',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start
    }
  }
}

async function testServiceInitialization(): Promise<TestResult> {
  const start = Date.now()
  
  try {
    const generator = new GDDAssetGenerator()
    
    // Test that generator can be created without errors
    if (!generator) {
      throw new Error('Failed to create GDD Asset Generator')
    }
    
    return {
      name: 'Service Initialization',
      passed: true,
      duration: Date.now() - start
    }
  } catch (error) {
    return {
      name: 'Service Initialization',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start
    }
  }
}

function displayTestResults(tests: TestResult[]): void {
  console.log(chalk.cyan('\n📊 Test Results:'))
  
  tests.forEach(test => {
    const status = test.passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')
    const duration = chalk.gray(`(${test.duration}ms)`)
    
    console.log(`  ${status} ${test.name} ${duration}`)
    
    if (!test.passed && test.error) {
      console.log(chalk.red(`    Error: ${test.error}`))
    }
  })
  
  const passedCount = tests.filter(test => test.passed).length
  const totalCount = tests.length
  const successRate = Math.round((passedCount / totalCount) * 100)
  
  console.log(chalk.cyan(`\n📈 Summary: ${passedCount}/${totalCount} tests passed (${successRate}%)`))
  
  if (passedCount === totalCount) {
    console.log(chalk.green('🎉 All tests passed!'))
  } else {
    console.log(chalk.red(`❌ ${totalCount - passedCount} tests failed`))
  }
}