import { promises as fs } from 'fs'
import { join } from 'path'
import { PerformanceReport, PerformanceTestSuite } from '../core/PerformanceTestSuite.js'

export interface TestSummary {
  totalTests: number
  passedTests: number
  failedTests: number
  duration: number
  timestamp: string
  coverage: {
    visual: boolean
    performance: boolean
    integration: boolean
    e2e: boolean
  }
}

export interface ComprehensiveTestReport {
  summary: TestSummary
  performanceReports: PerformanceReport[]
  visualTestResults: any[]
  integrationTestResults: any[]
  errors: string[]
  warnings: string[]
  recommendations: string[]
}

export class TestReportGenerator {
  private reportPath: string
  private performanceTestSuite: PerformanceTestSuite

  constructor(reportPath: string = './test-results') {
    this.reportPath = reportPath
    this.performanceTestSuite = new PerformanceTestSuite(join(reportPath, 'performance'))
  }

  async generateComprehensiveReport(testResults: any[]): Promise<ComprehensiveTestReport> {
    console.log('📊 Generating comprehensive test report...')

    // Calculate summary
    const summary = this.calculateTestSummary(testResults)
    
    // Load performance reports
    const performanceReports = await this.loadPerformanceReports()
    
    // Load other test results
    const visualTestResults = await this.loadVisualTestResults()
    const integrationTestResults = await this.loadIntegrationTestResults()
    
    // Analyze for errors and recommendations
    const { errors, warnings, recommendations } = this.analyzeTestResults(testResults, performanceReports)

    const report: ComprehensiveTestReport = {
      summary,
      performanceReports,
      visualTestResults,
      integrationTestResults,
      errors,
      warnings,
      recommendations
    }

    // Save report
    await this.saveReport(report)
    
    // Generate markdown summary
    await this.generateMarkdownSummary(report)

    return report
  }

  private calculateTestSummary(testResults: any[]): TestSummary {
    const totalTests = testResults.length
    const passedTests = testResults.filter(r => r.status === 'passed').length
    const failedTests = totalTests - passedTests
    
    const duration = testResults.reduce((sum, r) => sum + (r.duration || 0), 0)
    
    // Determine coverage based on test names/types
    const testNames = testResults.map(r => r.title || r.name || '').join(' ').toLowerCase()
    
    return {
      totalTests,
      passedTests,
      failedTests,
      duration,
      timestamp: new Date().toISOString(),
      coverage: {
        visual: testNames.includes('visual') || testNames.includes('screenshot'),
        performance: testNames.includes('performance') || testNames.includes('benchmark'),
        integration: testNames.includes('integration') || testNames.includes('gameplay'),
        e2e: testNames.includes('e2e') || testNames.includes('comprehensive')
      }
    }
  }

  private async loadPerformanceReports(): Promise<PerformanceReport[]> {
    try {
      const performanceDir = join(this.reportPath, 'performance')
      const files = await fs.readdir(performanceDir)
      const reportFiles = files.filter(f => f.startsWith('performance-') && f.endsWith('.json'))
      
      const reports: PerformanceReport[] = []
      for (const file of reportFiles) {
        try {
          const content = await fs.readFile(join(performanceDir, file), 'utf-8')
          reports.push(JSON.parse(content))
        } catch (error) {
          console.warn(`Failed to load performance report ${file}:`, error)
        }
      }
      
      return reports
    } catch (error) {
      return []
    }
  }

  private async loadVisualTestResults(): Promise<any[]> {
    try {
      const visualDir = join(this.reportPath, 'screenshots')
      const files = await fs.readdir(visualDir)
      
      // Return metadata about visual tests
      return files
        .filter(f => f.endsWith('.png'))
        .map(f => ({
          filename: f,
          timestamp: this.extractTimestampFromFilename(f),
          testType: this.extractTestTypeFromFilename(f)
        }))
    } catch (error) {
      return []
    }
  }

  private async loadIntegrationTestResults(): Promise<any[]> {
    try {
      const integrationFile = join(this.reportPath, 'test-results.json')
      const content = await fs.readFile(integrationFile, 'utf-8')
      const data = JSON.parse(content)
      
      return data.suites?.flatMap((suite: any) => 
        suite.tests?.map((test: any) => ({
          title: test.title,
          status: test.outcome,
          duration: test.duration,
          error: test.error?.message
        })) || []
      ) || []
    } catch (error) {
      return []
    }
  }

  private analyzeTestResults(testResults: any[], performanceReports: PerformanceReport[]) {
    const errors: string[] = []
    const warnings: string[] = []
    const recommendations: string[] = []

    // Analyze test failures
    testResults
      .filter(r => r.status === 'failed')
      .forEach(r => {
        errors.push(`Test "${r.title}" failed: ${r.error}`)
      })

    // Analyze performance issues
    performanceReports
      .filter(r => !r.passed)
      .forEach(r => {
        errors.push(...r.issues)
        recommendations.push(...r.recommendations)
      })

    // Check test coverage
    const hasVisualTests = testResults.some(r => r.title?.toLowerCase().includes('visual'))
    const hasPerformanceTests = performanceReports.length > 0
    const hasIntegrationTests = testResults.some(r => r.title?.toLowerCase().includes('integration'))

    if (!hasVisualTests) {
      warnings.push('No visual tests detected - UI and rendering issues may go unnoticed')
      recommendations.push('Add visual regression testing with screenshot comparison')
    }

    if (!hasPerformanceTests) {
      warnings.push('No performance tests detected - performance regressions may go unnoticed')
      recommendations.push('Add performance benchmarking and regression detection')
    }

    if (!hasIntegrationTests) {
      warnings.push('No integration tests detected - system integration issues may go unnoticed')
      recommendations.push('Add end-to-end integration tests covering full user workflows')
    }

    // Check for pattern of failures
    if (errors.length > testResults.length * 0.3) {
      errors.push('High failure rate detected - system may be unstable')
      recommendations.push('Focus on fixing fundamental issues before adding new features')
    }

    return { errors, warnings, recommendations }
  }

  private extractTimestampFromFilename(filename: string): string {
    const match = filename.match(/-(\d+)\.png$/)
    return match ? new Date(parseInt(match[1])).toISOString() : ''
  }

  private extractTestTypeFromFilename(filename: string): string {
    const parts = filename.split('-')
    return parts.slice(0, -1).join('-') // Remove timestamp
  }

  private async saveReport(report: ComprehensiveTestReport): Promise<void> {
    await fs.mkdir(this.reportPath, { recursive: true })
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportFile = join(this.reportPath, `comprehensive-report-${timestamp}.json`)
    
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2))
    console.log(`📊 Comprehensive report saved: ${reportFile}`)
  }

  private async generateMarkdownSummary(report: ComprehensiveTestReport): Promise<void> {
    const { summary, performanceReports, errors, warnings, recommendations } = report
    
    let markdown = `# Test Report Summary\n\n`
    markdown += `**Generated:** ${summary.timestamp}\n\n`
    
    // Summary section
    markdown += `## Test Results Overview\n\n`
    markdown += `| Metric | Value |\n`
    markdown += `|--------|-------|\n`
    markdown += `| Total Tests | ${summary.totalTests} |\n`
    markdown += `| Passed | ${summary.passedTests} ✅ |\n`
    markdown += `| Failed | ${summary.failedTests} ${summary.failedTests > 0 ? '❌' : '✅'} |\n`
    markdown += `| Duration | ${(summary.duration / 1000).toFixed(1)}s |\n`
    markdown += `| Success Rate | ${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}% |\n\n`

    // Coverage section
    markdown += `## Test Coverage\n\n`
    markdown += `| Type | Status |\n`
    markdown += `|------|--------|\n`
    markdown += `| Visual Testing | ${summary.coverage.visual ? '✅' : '❌'} |\n`
    markdown += `| Performance Testing | ${summary.coverage.performance ? '✅' : '❌'} |\n`
    markdown += `| Integration Testing | ${summary.coverage.integration ? '✅' : '❌'} |\n`
    markdown += `| E2E Testing | ${summary.coverage.e2e ? '✅' : '❌'} |\n\n`

    // Performance section
    if (performanceReports.length > 0) {
      markdown += `## Performance Results\n\n`
      markdown += this.performanceTestSuite.generatePerformanceSummary(performanceReports)
      markdown += `\n\n`
    }

    // Issues section
    if (errors.length > 0) {
      markdown += `## Errors\n\n`
      errors.forEach(error => {
        markdown += `- ❌ ${error}\n`
      })
      markdown += `\n`
    }

    if (warnings.length > 0) {
      markdown += `## Warnings\n\n`
      warnings.forEach(warning => {
        markdown += `- ⚠️ ${warning}\n`
      })
      markdown += `\n`
    }

    if (recommendations.length > 0) {
      markdown += `## Recommendations\n\n`
      recommendations.forEach(rec => {
        markdown += `- 💡 ${rec}\n`
      })
      markdown += `\n`
    }

    // Overall status
    const overallStatus = summary.failedTests === 0 && errors.length === 0 ? 'PASSED' : 'FAILED'
    markdown += `## Overall Status: ${overallStatus} ${overallStatus === 'PASSED' ? '🎉' : '❌'}\n`

    // Save markdown report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const markdownFile = join(this.reportPath, `test-summary-${timestamp}.md`)
    await fs.writeFile(markdownFile, markdown)
    
    // Also save as latest
    const latestFile = join(this.reportPath, 'latest-test-summary.md')
    await fs.writeFile(latestFile, markdown)
    
    console.log(`📝 Markdown summary saved: ${markdownFile}`)
    console.log(`📝 Latest summary: ${latestFile}`)
  }

  async generateCIReport(testResults: any[]): Promise<string> {
    const summary = this.calculateTestSummary(testResults)
    const performanceReports = await this.loadPerformanceReports()
    
    // Generate concise CI-friendly output
    let output = `TEST_SUMMARY_TOTAL=${summary.totalTests}\n`
    output += `TEST_SUMMARY_PASSED=${summary.passedTests}\n`
    output += `TEST_SUMMARY_FAILED=${summary.failedTests}\n`
    output += `TEST_SUMMARY_SUCCESS_RATE=${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}\n`
    output += `TEST_SUMMARY_DURATION=${summary.duration}\n`
    
    // Performance metrics
    if (performanceReports.length > 0) {
      const avgLoadTime = performanceReports.reduce((sum, r) => sum + r.metrics.loadTime, 0) / performanceReports.length
      const avgFrameRate = performanceReports.reduce((sum, r) => sum + r.metrics.frameRate, 0) / performanceReports.length
      
      output += `PERFORMANCE_AVG_LOAD_TIME=${avgLoadTime.toFixed(0)}\n`
      output += `PERFORMANCE_AVG_FRAME_RATE=${avgFrameRate.toFixed(1)}\n`
    }
    
    return output
  }
}