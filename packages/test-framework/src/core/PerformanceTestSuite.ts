import { Page } from 'playwright'
import { promises as fs } from 'fs'
import { join } from 'path'

export interface PerformanceMetrics {
  loadTime: number
  frameRate: number
  memoryUsage?: number
  networkRequests: number
  renderTime: number
  jsHeapSize: number
  domNodes: number
  timestamp: number
}

export interface PerformanceBenchmark {
  name: string
  maxLoadTime: number
  minFrameRate: number
  maxMemoryUsage: number
  maxRenderTime: number
}

export interface PerformanceReport {
  metrics: PerformanceMetrics
  benchmark: PerformanceBenchmark
  passed: boolean
  issues: string[]
  recommendations: string[]
}

export class PerformanceTestSuite {
  private baselineMetrics: PerformanceMetrics | null = null
  private reportPath: string

  constructor(reportPath: string = './test-results/performance') {
    this.reportPath = reportPath
  }

  async testWorldLoadingPerformance(page: Page, worldUrl: string): Promise<PerformanceReport> {
    console.log('⚡ Testing world loading performance...')

    const benchmark: PerformanceBenchmark = {
      name: 'World Loading',
      maxLoadTime: 10000, // 10 seconds
      minFrameRate: 30,    // 30 FPS
      maxMemoryUsage: 500 * 1024 * 1024, // 500MB
      maxRenderTime: 16.67 // ~60 FPS (16.67ms per frame)
    }

    const startTime = performance.now()

    // Start performance monitoring
    await page.evaluate(() => {
      // Clear any existing performance marks
      performance.clearMarks()
      performance.clearMeasures()
      performance.mark('world-load-start')
    })

    // Navigate to world
    await page.goto(worldUrl, { waitUntil: 'networkidle' })

    // Wait for world to be fully loaded
    await page.waitForFunction(() => 
      window.world && window.world.ready && window.world.renderer
    )

    const loadTime = performance.now() - startTime

    // Measure performance metrics
    const metrics = await this.collectPerformanceMetrics(page, loadTime)

    // Analyze results
    const report = this.analyzePerformance(metrics, benchmark)

    // Save report
    await this.savePerformanceReport(report)

    return report
  }

  async testRenderingPerformance(page: Page, duration: number = 5000): Promise<PerformanceReport> {
    console.log('🎨 Testing rendering performance...')

    const benchmark: PerformanceBenchmark = {
      name: 'Rendering Performance',
      maxLoadTime: 1000,  // Initial render should be fast
      minFrameRate: 45,   // Higher requirement for rendering
      maxMemoryUsage: 300 * 1024 * 1024, // 300MB
      maxRenderTime: 16.67
    }

    // Measure frame rate over time
    const frameRate = await this.measureFrameRate(page, duration)
    
    // Get rendering metrics
    const renderMetrics = await page.evaluate(() => {
      const timing = performance.timing
      return {
        domLoading: timing.domLoading - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        domComplete: timing.domComplete - timing.navigationStart
      }
    })

    const metrics: PerformanceMetrics = {
      loadTime: renderMetrics.domComplete,
      frameRate,
      renderTime: 1000 / frameRate, // ms per frame
      networkRequests: 0,
      jsHeapSize: 0,
      domNodes: 0,
      timestamp: Date.now()
    }

    // Fill in additional metrics
    const additionalMetrics = await this.collectPerformanceMetrics(page, 0)
    Object.assign(metrics, additionalMetrics)

    const report = this.analyzePerformance(metrics, benchmark)
    await this.savePerformanceReport(report)

    return report
  }

  async testMemoryUsage(page: Page): Promise<PerformanceReport> {
    console.log('💾 Testing memory usage...')

    const benchmark: PerformanceBenchmark = {
      name: 'Memory Usage',
      maxLoadTime: 5000,
      minFrameRate: 30,
      maxMemoryUsage: 400 * 1024 * 1024, // 400MB
      maxRenderTime: 20
    }

    // Force garbage collection if available
    try {
      await page.evaluate(() => {
        if (window.gc) {
          window.gc()
        }
      })
    } catch (error) {
      // GC not available, that's okay
    }

    // Wait a moment for GC to complete
    await new Promise(resolve => setTimeout(resolve, 1000))

    const metrics = await this.collectPerformanceMetrics(page, 0)
    const report = this.analyzePerformance(metrics, benchmark)

    await this.savePerformanceReport(report)
    return report
  }

  async measureFrameRate(page: Page, duration: number = 5000): Promise<number> {
    return page.evaluate((testDuration) => {
      return new Promise<number>(resolve => {
        let frames = 0
        const startTime = performance.now()

        function countFrame() {
          frames++
          const elapsed = performance.now() - startTime
          
          if (elapsed < testDuration) {
            requestAnimationFrame(countFrame)
          } else {
            const fps = frames / (elapsed / 1000)
            resolve(fps)
          }
        }

        requestAnimationFrame(countFrame)
      })
    }, duration)
  }

  private async collectPerformanceMetrics(page: Page, loadTime: number): Promise<PerformanceMetrics> {
    const browserMetrics = await page.evaluate(() => {
      // Collect browser performance data
      const nav = performance.navigation
      const timing = performance.timing
      const memory = (performance as any).memory

      // Count network requests
      const resources = performance.getEntriesByType('resource')
      const networkRequests = resources.length

      // Count DOM nodes
      const domNodes = document.querySelectorAll('*').length

      return {
        navigationStart: timing.navigationStart,
        domLoading: timing.domLoading,
        domComplete: timing.domComplete,
        loadEventEnd: timing.loadEventEnd,
        networkRequests,
        domNodes,
        memoryUsage: memory ? memory.usedJSHeapSize : undefined,
        jsHeapSize: memory ? memory.totalJSHeapSize : undefined,
        jsHeapSizeLimit: memory ? memory.jsHeapSizeLimit : undefined
      }
    })

    return {
      loadTime,
      frameRate: 0, // Will be filled by specific tests
      memoryUsage: browserMetrics.memoryUsage,
      networkRequests: browserMetrics.networkRequests,
      renderTime: 0, // Will be calculated
      jsHeapSize: browserMetrics.jsHeapSize || 0,
      domNodes: browserMetrics.domNodes,
      timestamp: Date.now()
    }
  }

  private analyzePerformance(metrics: PerformanceMetrics, benchmark: PerformanceBenchmark): PerformanceReport {
    const issues: string[] = []
    const recommendations: string[] = []

    // Check load time
    if (metrics.loadTime > benchmark.maxLoadTime) {
      issues.push(`Load time ${metrics.loadTime}ms exceeds benchmark ${benchmark.maxLoadTime}ms`)
      recommendations.push('Consider optimizing asset loading and reducing bundle size')
    }

    // Check frame rate
    if (metrics.frameRate > 0 && metrics.frameRate < benchmark.minFrameRate) {
      issues.push(`Frame rate ${metrics.frameRate.toFixed(1)}fps below benchmark ${benchmark.minFrameRate}fps`)
      recommendations.push('Optimize rendering performance or reduce visual complexity')
    }

    // Check memory usage
    if (metrics.memoryUsage && metrics.memoryUsage > benchmark.maxMemoryUsage) {
      const memoryMB = Math.round(metrics.memoryUsage / 1024 / 1024)
      const benchmarkMB = Math.round(benchmark.maxMemoryUsage / 1024 / 1024)
      issues.push(`Memory usage ${memoryMB}MB exceeds benchmark ${benchmarkMB}MB`)
      recommendations.push('Check for memory leaks and optimize asset management')
    }

    // Check render time
    if (metrics.renderTime > benchmark.maxRenderTime) {
      issues.push(`Render time ${metrics.renderTime.toFixed(2)}ms exceeds benchmark ${benchmark.maxRenderTime}ms`)
      recommendations.push('Optimize shader performance and reduce draw calls')
    }

    // Check for excessive network requests
    if (metrics.networkRequests > 50) {
      issues.push(`High number of network requests: ${metrics.networkRequests}`)
      recommendations.push('Consider bundling assets or using a CDN')
    }

    // Check for excessive DOM nodes
    if (metrics.domNodes > 5000) {
      issues.push(`High number of DOM nodes: ${metrics.domNodes}`)
      recommendations.push('Optimize DOM structure and use virtual scrolling if needed')
    }

    const passed = issues.length === 0

    return {
      metrics,
      benchmark,
      passed,
      issues,
      recommendations
    }
  }

  async setBaselineMetrics(metrics: PerformanceMetrics): Promise<void> {
    this.baselineMetrics = metrics
    
    // Save baseline to file
    const baselinePath = join(this.reportPath, 'baseline.json')
    await fs.mkdir(this.reportPath, { recursive: true })
    await fs.writeFile(baselinePath, JSON.stringify(metrics, null, 2))
    
    console.log('📊 Performance baseline saved')
  }

  async loadBaselineMetrics(): Promise<PerformanceMetrics | null> {
    try {
      const baselinePath = join(this.reportPath, 'baseline.json')
      const data = await fs.readFile(baselinePath, 'utf-8')
      this.baselineMetrics = JSON.parse(data)
      return this.baselineMetrics
    } catch (error) {
      return null
    }
  }

  async detectRegressions(currentMetrics: PerformanceMetrics): Promise<string[]> {
    if (!this.baselineMetrics) {
      await this.loadBaselineMetrics()
      if (!this.baselineMetrics) {
        return ['No baseline metrics available for regression detection']
      }
    }

    const regressions: string[] = []
    const threshold = 0.15 // 15% regression threshold

    // Check load time regression
    if (currentMetrics.loadTime > this.baselineMetrics.loadTime * (1 + threshold)) {
      const increase = ((currentMetrics.loadTime / this.baselineMetrics.loadTime) - 1) * 100
      regressions.push(`Load time regression: +${increase.toFixed(1)}% (${currentMetrics.loadTime}ms vs ${this.baselineMetrics.loadTime}ms)`)
    }

    // Check frame rate regression
    if (currentMetrics.frameRate > 0 && this.baselineMetrics.frameRate > 0) {
      if (currentMetrics.frameRate < this.baselineMetrics.frameRate * (1 - threshold)) {
        const decrease = (1 - (currentMetrics.frameRate / this.baselineMetrics.frameRate)) * 100
        regressions.push(`Frame rate regression: -${decrease.toFixed(1)}% (${currentMetrics.frameRate.toFixed(1)}fps vs ${this.baselineMetrics.frameRate.toFixed(1)}fps)`)
      }
    }

    // Check memory usage regression
    if (currentMetrics.memoryUsage && this.baselineMetrics.memoryUsage) {
      if (currentMetrics.memoryUsage > this.baselineMetrics.memoryUsage * (1 + threshold)) {
        const increase = ((currentMetrics.memoryUsage / this.baselineMetrics.memoryUsage) - 1) * 100
        regressions.push(`Memory usage regression: +${increase.toFixed(1)}% (${Math.round(currentMetrics.memoryUsage / 1024 / 1024)}MB vs ${Math.round(this.baselineMetrics.memoryUsage / 1024 / 1024)}MB)`)
      }
    }

    return regressions
  }

  private async savePerformanceReport(report: PerformanceReport): Promise<void> {
    await fs.mkdir(this.reportPath, { recursive: true })
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportFile = join(this.reportPath, `performance-${report.benchmark.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.json`)
    
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2))
    
    console.log(`📊 Performance report saved: ${reportFile}`)
  }

  generatePerformanceSummary(reports: PerformanceReport[]): string {
    const totalTests = reports.length
    const passedTests = reports.filter(r => r.passed).length
    const failedTests = totalTests - passedTests

    let summary = `# Performance Test Summary\n\n`
    summary += `**Total Tests:** ${totalTests}\n`
    summary += `**Passed:** ${passedTests} ✅\n`
    summary += `**Failed:** ${failedTests} ❌\n\n`

    if (failedTests > 0) {
      summary += `## Issues Found\n\n`
      
      reports.forEach(report => {
        if (!report.passed) {
          summary += `### ${report.benchmark.name}\n`
          report.issues.forEach(issue => {
            summary += `- ❌ ${issue}\n`
          })
          summary += '\n**Recommendations:**\n'
          report.recommendations.forEach(rec => {
            summary += `- 💡 ${rec}\n`
          })
          summary += '\n'
        }
      })
    } else {
      summary += `## All Performance Tests Passed! 🎉\n\n`
    }

    // Add metrics table
    summary += `## Metrics Summary\n\n`
    summary += `| Test | Load Time | Frame Rate | Memory Usage | Status |\n`
    summary += `|------|-----------|------------|--------------|--------|\n`
    
    reports.forEach(report => {
      const metrics = report.metrics
      const loadTime = `${metrics.loadTime.toFixed(0)}ms`
      const frameRate = metrics.frameRate > 0 ? `${metrics.frameRate.toFixed(1)}fps` : 'N/A'
      const memory = metrics.memoryUsage ? `${Math.round(metrics.memoryUsage / 1024 / 1024)}MB` : 'N/A'
      const status = report.passed ? '✅' : '❌'
      
      summary += `| ${report.benchmark.name} | ${loadTime} | ${frameRate} | ${memory} | ${status} |\n`
    })

    return summary
  }
}