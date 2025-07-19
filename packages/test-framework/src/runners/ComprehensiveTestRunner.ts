import { TestFramework } from '../core/TestFramework';
import { PlaywrightVisualTestRunner } from './PlaywrightVisualTestRunner';
import { HyperfyTestScenarios } from '../scenarios/HyperfyTestScenarios';
import { TestResult, TestReport, TestRunnerConfig, TestScenario } from '../types';
import fs from 'fs-extra';
import path from 'path';

/**
 * Comprehensive test runner that combines all testing capabilities
 */
export class ComprehensiveTestRunner {
  private framework: TestFramework;
  private visualRunner?: PlaywrightVisualTestRunner;
  private results: TestResult[] = [];

  constructor(framework: TestFramework) {
    this.framework = framework;
  }

  /**
   * Run all types of tests
   */
  async runComprehensiveTests(config: TestRunnerConfig = {}): Promise<TestReport> {
    const startTime = Date.now();
    
    console.log('🧪 Starting Comprehensive Hyperfy Test Suite');
    console.log('============================================');

    // Set up output directory
    const outputDir = config.outputDir || './test-results';
    await fs.ensureDir(outputDir);
    await fs.ensureDir(path.join(outputDir, 'screenshots'));

    try {
      // Run core functionality tests
      await this.runCoreTests(config);

      // Run visual tests if enabled
      if (config.captureScreenshots !== false) {
        await this.runVisualTests(config);
      }

      // Generate and save report
      const report = this.generateReport(startTime, config);
      await this.saveReport(report, outputDir);

      return report;

    } finally {
      // Cleanup
      if (this.visualRunner) {
        await this.visualRunner.cleanup();
      }
    }
  }

  /**
   * Run core functionality tests
   */
  private async runCoreTests(config: TestRunnerConfig): Promise<void> {
    console.log('\n📋 Running Core Functionality Tests');
    console.log('=====================================');

    const scenarios = HyperfyTestScenarios.getAllScenarios();
    
    for (const scenario of scenarios) {
      if (this.shouldRunScenario(scenario, config)) {
        const result = await this.runScenario(scenario);
        this.results.push(result);
        this.logResult(result);
      }
    }
  }

  /**
   * Run visual tests
   */
  private async runVisualTests(config: TestRunnerConfig): Promise<void> {
    console.log('\n🎨 Running Visual Tests');
    console.log('=======================');

    this.visualRunner = new PlaywrightVisualTestRunner(this.framework);
    await this.visualRunner.initialize();

    // Test basic world rendering
    const worldRenderingTest = await this.visualRunner.runWorldTest(
      {
        id: 'visual-test-world',
        name: 'Visual Test World',
        type: 'server',
        persistence: { type: 'sqlite' }
      },
      {
        name: 'basic-world-rendering',
        description: 'Test that a basic world renders correctly',
        steps: [
          { name: 'initial-load', action: 'wait', value: 3000 },
          { name: 'world-loaded', action: 'screenshot' },
          { name: 'wait-for-systems', action: 'wait', value: 2000 },
          { name: 'systems-ready', action: 'screenshot' }
        ]
      }
    );

    this.results.push(worldRenderingTest);
    this.logResult(worldRenderingTest);
  }

  /**
   * Run a single test scenario
   */
  private async runScenario(scenario: TestScenario): Promise<TestResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    try {
      const context = this.framework.createTestContext();
      
      // Override logging to capture logs
      const originalLog = context.log;
      context.log = (message: string) => {
        logs.push(message);
        originalLog(message);
      };

      // Run scenario phases
      await scenario.setup(context);
      await scenario.execute(context);
      const validation = await scenario.validate(context);
      await scenario.cleanup(context);

      const endTime = Date.now();

      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        status: validation.passed ? 'passed' : 'failed',
        startTime,
        endTime,
        duration: endTime - startTime,
        validation,
        logs,
        screenshots: []
      };

    } catch (error: any) {
      const endTime = Date.now();

      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        status: 'error',
        startTime,
        endTime,
        duration: endTime - startTime,
        error,
        logs,
        screenshots: []
      };
    }
  }

  /**
   * Check if a scenario should run based on config
   */
  private shouldRunScenario(scenario: TestScenario, config: TestRunnerConfig): boolean {
    // Check categories
    if (config.categories && config.categories.length > 0) {
      if (!scenario.category || !config.categories.includes(scenario.category)) {
        return false;
      }
    }

    // Check tags
    if (config.tags && config.tags.length > 0) {
      if (!scenario.tags || !config.tags.some(tag => scenario.tags!.includes(tag))) {
        return false;
      }
    }

    // Check specific scenarios
    if (config.scenarios && config.scenarios.length > 0) {
      const scenarioIds = config.scenarios.map(s => typeof s === 'string' ? s : s.id);
      if (!scenarioIds.includes(scenario.id)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Log test result
   */
  private logResult(result: TestResult): void {
    const status = result.status === 'passed' ? '✅' : '❌';
    const duration = (result.duration / 1000).toFixed(2);
    
    console.log(`${status} ${result.scenarioName} (${duration}s)`);
    
    if (result.status === 'failed' && result.validation?.failures) {
      result.validation.failures.forEach(failure => {
        console.log(`   └─ ${failure.message}`);
      });
    }
    
    if (result.error) {
      console.log(`   └─ Error: ${result.error.message}`);
    }
  }

  /**
   * Generate test report
   */
  private generateReport(startTime: number, config: TestRunnerConfig): TestReport {
    const endTime = Date.now();
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'passed').length,
      failed: this.results.filter(r => r.status === 'failed').length,
      skipped: this.results.filter(r => r.status === 'skipped').length,
      errorRate: 0
    };
    
    summary.errorRate = summary.total > 0 ? 
      (summary.failed / summary.total) * 100 : 0;

    return {
      timestamp: startTime,
      duration: endTime - startTime,
      config,
      summary,
      results: this.results
    };
  }

  /**
   * Save test report
   */
  private async saveReport(report: TestReport, outputDir: string): Promise<void> {
    const reportPath = path.join(outputDir, 'test-report.json');
    await fs.writeJson(reportPath, report, { spaces: 2 });
    
    // Generate HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlPath = path.join(outputDir, 'test-report.html');
    await fs.writeFile(htmlPath, htmlReport);
    
    console.log(`\n📊 Test report saved: ${reportPath}`);
    console.log(`📊 HTML report saved: ${htmlPath}`);
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: TestReport): string {
    const { summary, results } = report;
    const successRate = ((summary.passed / summary.total) * 100).toFixed(1);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Hyperfy Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .result { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .result.passed { border-color: #28a745; background: #f8fff9; }
        .result.failed { border-color: #dc3545; background: #fff8f8; }
        .failure { color: #666; margin-left: 20px; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Hyperfy Test Report</h1>
        <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
        <p>Duration: ${(report.duration / 1000).toFixed(2)} seconds</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div style="font-size: 2em;">${summary.total}</div>
        </div>
        <div class="metric">
            <h3>Success Rate</h3>
            <div style="font-size: 2em; color: ${summary.passed === summary.total ? '#28a745' : '#dc3545'};">
                ${successRate}%
            </div>
        </div>
        <div class="metric passed">
            <h3>Passed</h3>
            <div style="font-size: 2em;">${summary.passed}</div>
        </div>
        <div class="metric failed">
            <h3>Failed</h3>
            <div style="font-size: 2em;">${summary.failed}</div>
        </div>
    </div>
    
    <h2>Test Results</h2>
    ${results.map(result => `
        <div class="result ${result.status}">
            <h3>${result.status === 'passed' ? '✅' : '❌'} ${result.scenarioName}</h3>
            <p>Duration: ${(result.duration / 1000).toFixed(2)}s</p>
            ${result.validation?.failures?.map(f => `
                <div class="failure">❌ ${f.message}</div>
            `).join('') || ''}
        </div>
    `).join('')}
</body>
</html>`;
  }
}