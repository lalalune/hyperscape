import { UnifiedVisualTestRunner } from './UnifiedVisualTestRunner'
import { HyperfyServerManager } from './HyperfyServerManager'
import { ComprehensiveRPGTests } from '../scenarios/ComprehensiveRPGTests'
import { promises as fs } from 'fs'
import { join } from 'path'

export interface OrchestratorConfig {
  serverPort: number
  hyperfyPath: string
  headless: boolean
  timeout: number
  outputDir: string
  runInParallel: boolean
  serverStartTimeout: number
}

export interface TestReport {
  startTime: number
  endTime: number
  duration: number
  totalTests: number
  passedTests: number
  failedTests: number
  successRate: number
  suites: Array<{
    name: string
    passed: number
    failed: number
    duration: number
    tests: Array<{
      name: string
      passed: boolean
      errors: string[]
      duration: number
      screenshotPath?: string
    }>
  }>
  serverLogs: string[]
  errors: string[]
}

export class VisualTestOrchestrator {
  private runner: UnifiedVisualTestRunner
  private serverManager: HyperfyServerManager
  private rpgTests: ComprehensiveRPGTests
  
  constructor(private config: OrchestratorConfig) {
    this.runner = new UnifiedVisualTestRunner(
      config.headless,
      1920,
      1080
    )
    
    this.serverManager = new HyperfyServerManager({
      port: config.serverPort,
      hyperfyPath: config.hyperfyPath,
      timeout: config.serverStartTimeout
    })
    
    this.rpgTests = new ComprehensiveRPGTests(
      this.runner,
      this.serverManager,
      `http://localhost:${config.serverPort}`
    )
  }

  async runFullTestSuite(): Promise<TestReport> {
    const startTime = Date.now()
    const errors: string[] = []
    let serverLogs: string[] = []

    console.log('🎯 Visual Test Orchestrator Starting...')
    console.log('======================================')
    console.log(`Server: localhost:${this.config.serverPort}`)
    console.log(`Headless: ${this.config.headless}`)
    console.log(`Output: ${this.config.outputDir}`)
    console.log('')

    try {
      // 1. Ensure output directory exists
      await fs.mkdir(this.config.outputDir, { recursive: true })

      // 2. Start Hyperfy server
      console.log('🚀 Starting Hyperfy server...')
      const serverStatus = await this.serverManager.startServer({
        port: this.config.serverPort,
        hyperfyPath: this.config.hyperfyPath,
        timeout: this.config.serverStartTimeout
      })
      
      if (!serverStatus.running) {
        throw new Error('Failed to start Hyperfy server')
      }
      
      serverLogs = serverStatus.logs
      console.log(`✅ Server running on port ${this.config.serverPort}`)

      // 3. Initialize visual test runner
      console.log('🎬 Initializing visual test runner...')
      await this.runner.initialize()
      console.log('✅ Visual test runner ready')

      // 4. Verify server is actually serving content
      console.log('🔍 Verifying server connectivity...')
      const isHealthy = await this.serverManager.checkServerHealth(this.config.serverPort)
      if (!isHealthy) {
        throw new Error('Server is not responding to health checks')
      }
      console.log('✅ Server connectivity verified')

      // 5. Run all RPG test suites
      console.log('\n🧪 Running comprehensive RPG tests...')
      const testResults = await this.rpgTests.runAllTests()

      const endTime = Date.now()
      const duration = endTime - startTime

      // 6. Generate report
      const report: TestReport = {
        startTime,
        endTime,
        duration,
        totalTests: testResults.totalPassed + testResults.totalFailed,
        passedTests: testResults.totalPassed,
        failedTests: testResults.totalFailed,
        successRate: (testResults.totalPassed / (testResults.totalPassed + testResults.totalFailed)) * 100,
        suites: testResults.suites.map(suite => ({
          name: suite.suiteName,
          passed: suite.passed,
          failed: suite.failed,
          duration: suite.results.reduce((sum, test) => sum + test.duration, 0),
          tests: suite.results
        })),
        serverLogs,
        errors
      }

      // 7. Save detailed report
      await this.saveReport(report)

      console.log('\n📊 COMPREHENSIVE TEST RESULTS')
      console.log('==============================')
      console.log(`⏱️  Duration: ${(duration / 1000).toFixed(1)}s`)
      console.log(`📈 Total Tests: ${report.totalTests}`)
      console.log(`✅ Passed: ${report.passedTests}`)
      console.log(`❌ Failed: ${report.failedTests}`)
      console.log(`📊 Success Rate: ${report.successRate.toFixed(1)}%`)
      
      if (report.failedTests > 0) {
        console.log('\n❌ FAILED TESTS:')
        for (const suite of report.suites) {
          for (const test of suite.tests) {
            if (!test.passed) {
              console.log(`  🔴 ${suite.name}/${test.name}`)
              test.errors.forEach(error => console.log(`     💥 ${error}`))
            }
          }
        }
      }

      return report

    } catch (error) {
      errors.push(`Test suite failed: ${error}`)
      
      return {
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        successRate: 0,
        suites: [],
        serverLogs,
        errors
      }
    } finally {
      // Cleanup
      await this.cleanup()
    }
  }

  // Run just the basic validation tests to prove the system works
  async runValidationTests(): Promise<TestReport> {
    const startTime = Date.now()
    const errors: string[] = []
    let serverLogs: string[] = []

    try {
      console.log('🔍 Running Visual Test Validation...')
      
      // Start server
      const serverStatus = await this.serverManager.startServer({
        port: this.config.serverPort,
        hyperfyPath: this.config.hyperfyPath,
        timeout: this.config.serverStartTimeout
      })
      
      serverLogs = serverStatus.logs

      // Initialize runner
      await this.runner.initialize()

      // Run just basic rendering tests to validate the framework
      const basicSuite = this.rpgTests.createBasicRenderingTests()
      const result = await this.rpgTests.runTestSuite(basicSuite)

      const endTime = Date.now()
      
      return {
        startTime,
        endTime,
        duration: endTime - startTime,
        totalTests: result.passed + result.failed,
        passedTests: result.passed,
        failedTests: result.failed,
        successRate: (result.passed / (result.passed + result.failed)) * 100,
        suites: [{
        name: result.suiteName,
        passed: result.passed,
        failed: result.failed,
        duration: result.results.reduce((sum, test) => sum + test.duration, 0),
        tests: result.results.map(test => ({
          name: test.name,
          passed: test.passed,
          errors: test.errors,
          duration: test.duration
        }))
      }],
        serverLogs,
        errors
      }

    } catch (error) {
      errors.push(`Validation failed: ${error}`)
      
      return {
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        totalTests: 0,
        passedTests: 0,
        failedTests: 1,
        successRate: 0,
        suites: [],
        serverLogs,
        errors
      }
    } finally {
      await this.cleanup()
    }
  }

  private async saveReport(report: TestReport): Promise<void> {
    const reportPath = join(this.config.outputDir, `test-report-${Date.now()}.json`)
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    
    // Also save HTML report
    const htmlReport = this.generateHTMLReport(report)
    const htmlPath = join(this.config.outputDir, `test-report-${Date.now()}.html`)
    await fs.writeFile(htmlPath, htmlReport)
    
    console.log(`\n📄 Reports saved:`)
    console.log(`   JSON: ${reportPath}`)
    console.log(`   HTML: ${htmlPath}`)
  }

  private generateHTMLReport(report: TestReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>RPG Visual Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .suite { margin: 20px 0; border: 1px solid #ddd; border-radius: 5px; }
        .suite-header { background: #e0e0e0; padding: 15px; }
        .test { padding: 10px; border-bottom: 1px solid #eee; }
        .passed { background: #e8f5e8; }
        .failed { background: #ffeaea; }
        .error { color: #cc0000; font-size: 0.9em; margin-left: 20px; }
        .screenshot { max-width: 200px; margin: 10px 0; }
        .stats { display: flex; gap: 20px; margin: 10px 0; }
        .stat { padding: 10px; border-radius: 3px; text-align: center; }
        .stat.passed { background: #d4edda; color: #155724; }
        .stat.failed { background: #f8d7da; color: #721c24; }
        .stat.total { background: #cce5ff; color: #004080; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎮 RPG Visual Test Report</h1>
        <div class="stats">
            <div class="stat total">
                <div><strong>${report.totalTests}</strong></div>
                <div>Total Tests</div>
            </div>
            <div class="stat passed">
                <div><strong>${report.passedTests}</strong></div>
                <div>Passed</div>
            </div>
            <div class="stat failed">
                <div><strong>${report.failedTests}</strong></div>
                <div>Failed</div>
            </div>
        </div>
        <p><strong>Success Rate:</strong> ${report.successRate.toFixed(1)}%</p>
        <p><strong>Duration:</strong> ${(report.duration / 1000).toFixed(1)}s</p>
        <p><strong>Timestamp:</strong> ${new Date(report.startTime).toLocaleString()}</p>
    </div>

    ${report.suites.map(suite => `
        <div class="suite">
            <div class="suite-header">
                <h2>${suite.name}</h2>
                <p>✅ ${suite.passed} passed, ❌ ${suite.failed} failed</p>
            </div>
            ${suite.tests.map(test => `
                <div class="test ${test.passed ? 'passed' : 'failed'}">
                    <h3>${test.passed ? '✅' : '❌'} ${test.name}</h3>
                    <p><strong>Duration:</strong> ${test.duration}ms</p>
                    ${test.screenshotPath ? `<img class="screenshot" src="${test.screenshotPath}" alt="${test.name} screenshot">` : ''}
                    ${test.errors.length > 0 ? `
                        <div>
                            <strong>Errors:</strong>
                            ${test.errors.map(error => `<div class="error">• ${error}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `).join('')}

    ${report.errors.length > 0 ? `
        <div class="suite">
            <div class="suite-header">
                <h2>🚨 System Errors</h2>
            </div>
            ${report.errors.map(error => `<div class="error">• ${error}</div>`).join('')}
        </div>
    ` : ''}
</body>
</html>
    `
  }

  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...')
    
    try {
      await this.runner.cleanup()
      console.log('✅ Visual test runner cleaned up')
    } catch (error) {
      console.error('❌ Failed to cleanup visual test runner:', error)
    }

    try {
      await this.serverManager.killAllServers()
      console.log('✅ All servers stopped')
    } catch (error) {
      console.error('❌ Failed to stop servers:', error)
    }

    console.log('🎯 Cleanup complete')
  }
}

// Helper function to create and run orchestrator
export async function runComprehensiveVisualTests(config: Partial<OrchestratorConfig> = {}): Promise<TestReport> {
  const fullConfig: OrchestratorConfig = {
    serverPort: 3000,
    hyperfyPath: '../hyperfy',
    headless: false,
    timeout: 60000,
    outputDir: './test-results',
    runInParallel: false,
    serverStartTimeout: 45000,
    ...config
  }

  const orchestrator = new VisualTestOrchestrator(fullConfig)
  return await orchestrator.runFullTestSuite()
}

export async function runValidationOnly(config: Partial<OrchestratorConfig> = {}): Promise<TestReport> {
  const fullConfig: OrchestratorConfig = {
    serverPort: 3000,
    hyperfyPath: '../hyperfy', 
    headless: false,
    timeout: 30000,
    outputDir: './test-results',
    runInParallel: false,
    serverStartTimeout: 30000,
    ...config
  }

  const orchestrator = new VisualTestOrchestrator(fullConfig)
  return await orchestrator.runValidationTests()
}