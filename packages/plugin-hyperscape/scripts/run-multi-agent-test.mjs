#!/usr/bin/env node

/**
 * Multi-Agent Test Runner for Hyperscape Plugin
 * ==========================================
 * 
 * This script orchestrates the multi-agent test by:
 * 1. Starting a Hyperscape server (if needed)
 * 2. Running the multi-agent integration test
 * 3. Monitoring for errors and collecting results
 * 4. Providing detailed reporting
 */

import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const execAsync = promisify(exec)

// Configuration
const CONFIG = {
  HYPERSCAPE_SERVER_PORT: 5555,
  HYPERSCAPE_SERVER_HOST: 'localhost',
  TEST_TIMEOUT: 180000, // 3 minutes
  SERVER_START_TIMEOUT: 30000, // 30 seconds
  AGENT_COUNT: 10,
  LOG_FILE: path.join(__dirname, '..', 'multi-agent-test.log'),
  RESULTS_FILE: path.join(__dirname, '..', 'multi-agent-results.json'),
}

// Logging utility
class TestLogger {
  constructor(logFile) {
    this.logFile = logFile
    this.startTime = Date.now()
    
    // Clear previous log
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile)
    }
  }
  
  log(level, message, data = null) {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      elapsed: Date.now() - this.startTime
    }
    
    // Console output
    const prefix = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'SUCCESS' ? '✅' : 'ℹ️'
    console.log(`${prefix} [${level}] ${message}`)
    if (data) {
      console.log('   Data:', data)
    }
    
    // File output
    fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n')
  }
  
  info(message, data) { this.log('INFO', message, data) }
  warn(message, data) { this.log('WARN', message, data) }
  error(message, data) { this.log('ERROR', message, data) }
  success(message, data) { this.log('SUCCESS', message, data) }
}

// Initialize logger
const logger = new TestLogger(CONFIG.LOG_FILE)

/**
 * Check if Hyperscape server is running
 */
async function checkHyperscapeServer() {
  try {
    const response = await fetch(`http://${CONFIG.HYPERSCAPE_SERVER_HOST}:${CONFIG.HYPERSCAPE_SERVER_PORT}/api/health`)
    if (response.ok) {
      logger.success('Hyperscape server is already running')
      return true
    }
  } catch (error) {
    logger.info('Hyperscape server not detected, will attempt to start')
  }
  return false
}

/**
 * Start Hyperscape server
 */
async function startHyperscapeServer() {
  return new Promise((resolve, reject) => {
    logger.info('Starting Hyperscape server...')
    
    // Navigate to hyperscape package directory
    const hyperscapeDir = path.join(__dirname, '..', '..', 'hyperscape')
    
    const serverProcess = spawn('npm', ['run', 'start'], {
      cwd: hyperscapeDir,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    })
    
    let serverStarted = false
    let serverOutput = ''
    
    // Monitor server output
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString()
      serverOutput += output
      
      // Look for server start indicators
      if (output.includes('Server listening') || output.includes('Hyperscape server started')) {
        if (!serverStarted) {
          serverStarted = true
          logger.success('Hyperscape server started successfully')
          resolve(serverProcess)
        }
      }
    })
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString()
      serverOutput += output
      logger.warn('Server stderr:', output)
    })
    
    serverProcess.on('error', (error) => {
      logger.error('Failed to start Hyperscape server:', error.message)
      reject(error)
    })
    
    serverProcess.on('exit', (code) => {
      if (!serverStarted) {
        logger.error(`Hyperscape server exited with code ${code}`, { output: serverOutput })
        reject(new Error(`Server exited with code ${code}`))
      }
    })
    
    // Timeout check
    setTimeout(() => {
      if (!serverStarted) {
        logger.error('Hyperscape server start timeout')
        serverProcess.kill()
        reject(new Error('Server start timeout'))
      }
    }, CONFIG.SERVER_START_TIMEOUT)
  })
}

/**
 * Run the multi-agent test
 */
async function runMultiAgentTest() {
  return new Promise((resolve, reject) => {
    logger.info(`Starting multi-agent test with ${CONFIG.AGENT_COUNT} agents...`)
    
    const testProcess = spawn('npm', ['run', 'test', '--', '--run', 'src/__tests__/e2e/multi-agent-integration.test.ts'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      env: { 
        ...process.env, 
        WS_URL: `ws://${CONFIG.HYPERSCAPE_SERVER_HOST}:${CONFIG.HYPERSCAPE_SERVER_PORT}/ws`,
        NODE_ENV: 'test'
      }
    })
    
    let testOutput = ''
    let testResults = {
      passed: false,
      tests: {},
      errors: [],
      duration: 0,
      coverage: null
    }
    
    testProcess.stdout.on('data', (data) => {
      const output = data.toString()
      testOutput += output
      console.log(output) // Real-time output
      
      // Parse test results
      if (output.includes('✓') || output.includes('PASS')) {
        const lines = output.split('\n')
        lines.forEach(line => {
          if (line.includes('✓')) {
            const testName = line.replace(/.*✓/, '').trim()
            testResults.tests[testName] = 'PASSED'
          }
        })
      }
      
      if (output.includes('❌') || output.includes('FAIL')) {
        const lines = output.split('\n')
        lines.forEach(line => {
          if (line.includes('❌') || line.includes('FAIL')) {
            testResults.errors.push(line.trim())
          }
        })
      }
    })
    
    testProcess.stderr.on('data', (data) => {
      const output = data.toString()
      testOutput += output
      logger.warn('Test stderr:', output)
      testResults.errors.push(output)
    })
    
    testProcess.on('error', (error) => {
      logger.error('Test process error:', error.message)
      testResults.errors.push(error.message)
      reject(error)
    })
    
    testProcess.on('exit', (code) => {
      testResults.duration = Date.now() - logger.startTime
      testResults.passed = code === 0
      
      if (code === 0) {
        logger.success('Multi-agent test completed successfully')
      } else {
        logger.error(`Multi-agent test failed with exit code ${code}`)
      }
      
      // Save test results
      fs.writeFileSync(CONFIG.RESULTS_FILE, JSON.stringify(testResults, null, 2))
      
      resolve({
        success: code === 0,
        output: testOutput,
        results: testResults
      })
    })
    
    // Timeout check
    setTimeout(() => {
      logger.error('Multi-agent test timeout')
      testProcess.kill()
      reject(new Error('Test timeout'))
    }, CONFIG.TEST_TIMEOUT)
  })
}

/**
 * Generate test report
 */
function generateTestReport(testResult) {
  const report = {
    timestamp: new Date().toISOString(),
    configuration: CONFIG,
    success: testResult.success,
    summary: {
      totalTests: Object.keys(testResult.results.tests).length,
      passedTests: Object.values(testResult.results.tests).filter(r => r === 'PASSED').length,
      errors: testResult.results.errors.length,
      duration: testResult.results.duration,
    },
    details: testResult.results
  }
  
  logger.info('📊 Test Report Generated:', report.summary)
  
  // Save detailed report
  const reportFile = path.join(__dirname, '..', 'multi-agent-test-report.json')
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2))
  
  return report
}

/**
 * Main test execution
 */
async function main() {
  let serverProcess = null
  let testResult = null
  
  try {
    logger.info('🚀 Starting Multi-Agent Hyperscape Test Suite')
    
    // Step 1: Check/Start Hyperscape server
    const serverRunning = await checkHyperscapeServer()
    if (!serverRunning) {
      serverProcess = await startHyperscapeServer()
      // Wait a bit for server to fully initialize
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
    
    // Step 2: Run multi-agent test
    testResult = await runMultiAgentTest()
    
    // Step 3: Generate report
    const report = generateTestReport(testResult)
    
    // Step 4: Final results
    if (testResult.success) {
      logger.success('🎉 Multi-Agent Test Suite PASSED!')
      logger.info('📄 Report saved to:', CONFIG.RESULTS_FILE)
      process.exit(0)
    } else {
      logger.error('💥 Multi-Agent Test Suite FAILED!')
      logger.error('📄 Error report saved to:', CONFIG.RESULTS_FILE)
      process.exit(1)
    }
    
  } catch (error) {
    logger.error('💥 Test suite encountered fatal error:', error.message)
    
    if (testResult) {
      generateTestReport(testResult)
    }
    
    process.exit(1)
    
  } finally {
    // Cleanup: Stop server if we started it
    if (serverProcess) {
      logger.info('🧹 Stopping Hyperscape server...')
      serverProcess.kill()
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { main as runMultiAgentTestSuite, CONFIG, TestLogger }