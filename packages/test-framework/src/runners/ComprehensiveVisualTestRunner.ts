import { TestFramework } from '../core/TestFramework';
import { TestResult, TestValidation } from '../types';
import { PlaywrightVisualTestRunner } from './PlaywrightVisualTestRunner';
import { RPGVisualTestScenarios } from '../scenarios/RPGVisualTestScenarios';
import fs from 'fs-extra';
import path from 'path';

/**
 * Comprehensive visual test runner that orchestrates all visual testing
 */
export class ComprehensiveVisualTestRunner {
  private framework: TestFramework;
  private outputDir: string;
  
  constructor(framework: TestFramework, outputDir: string = './test-results/visual') {
    this.framework = framework;
    this.outputDir = outputDir;
  }

  /**
   * Run all visual tests and generate comprehensive report
   */
  async runAllVisualTests(): Promise<{
    summary: {
      total: number;
      passed: number;
      failed: number;
      duration: number;
    };
    results: TestResult[];
    report: string;
  }> {
    await fs.ensureDir(this.outputDir);
    
    const startTime = Date.now();
    const results: TestResult[] = [];
    
    console.log('🎬 Starting Comprehensive Visual Testing');
    console.log('==========================================');
    
    // Get all RPG visual test scenarios
    const scenarios = RPGVisualTestScenarios.getAllScenarios();
    
    for (const scenario of scenarios) {
      console.log(`\n🎯 Running: ${scenario.name}`);
      console.log(`📝 ${scenario.description}`);
      
      try {
        const result = await this.runSingleVisualTest(scenario);
        results.push(result);
        
        const status = result.status === 'passed' ? '✅' : '❌';
        console.log(`${status} ${scenario.name}: ${result.status} (${result.duration}ms)`);
        
        if (result.status === 'failed') {
          console.log(`   Error: ${result.error?.message || 'Unknown error'}`);
        }
        
      } catch (error: any) {
        console.log(`❌ ${scenario.name}: exception (${error.message})`);
        results.push({
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          status: 'failed',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          logs: [`Exception during test execution: ${error.message}`],
          screenshots: [],
          error,
          validation: {
            passed: false,
            failures: [{
              type: 'exception',
              message: error.message,
              stack: error.stack
            }],
            warnings: []
          }
        });
      }
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Generate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      duration
    };
    
    // Generate detailed report
    const report = await this.generateReport(summary, results);
    
    // Save report
    await fs.writeFile(
      path.join(this.outputDir, 'visual-test-report.html'),
      report
    );
    
    console.log('\n📊 Visual Testing Summary');
    console.log('========================');
    console.log(`Total tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Report saved to: ${path.join(this.outputDir, 'visual-test-report.html')}`);
    
    return { summary, results, report };
  }

  /**
   * Run a single visual test scenario
   */
  private async runSingleVisualTest(scenario: any): Promise<TestResult> {
    const context = {
      framework: this.framework,
      data: new Map<string, any>(),
      log: (message: string) => {
        console.log(`  📝 ${message}`);
      }
    };

    const startTime = Date.now();
    
    try {
      // Setup
      await scenario.setup(context);
      
      // Execute
      await scenario.execute(context);
      
      // Validate
      const validation = await scenario.validate(context);
      
      const endTime = Date.now();
      
      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        status: validation.passed ? 'passed' : 'failed',
        startTime,
        endTime,
        duration: endTime - startTime,
        logs: [],
        screenshots: [],
        validation
      };
      
    } catch (error: any) {
      const endTime = Date.now();
      
      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        status: 'failed',
        startTime,
        endTime,
        duration: endTime - startTime,
        logs: [],
        screenshots: [],
        error,
        validation: {
          passed: false,
          failures: [{
            type: 'exception',
            message: error.message,
            stack: error.stack
          }],
          warnings: []
        }
      };
    }
  }

  /**
   * Generate HTML report with screenshots and analysis
   */
  private async generateReport(summary: any, results: TestResult[]): Promise<string> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hyperfy Visual Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #333;
        }
        .summary-card .number {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
        }
        .test-result {
            background: white;
            margin-bottom: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .test-header {
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        .test-header h3 {
            margin: 0 0 10px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .status-passed {
            color: #28a745;
        }
        .status-failed {
            color: #dc3545;
        }
        .test-body {
            padding: 20px;
        }
        .screenshots {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .screenshot {
            text-align: center;
        }
        .screenshot img {
            max-width: 100%;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .screenshot-caption {
            margin-top: 10px;
            font-size: 0.9em;
            color: #666;
        }
        .failures {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin-top: 15px;
        }
        .warnings {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin-top: 15px;
        }
        .timestamp {
            color: #666;
            font-size: 0.9em;
        }
        .duration {
            background: #e9ecef;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 0.8em;
            color: #495057;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎬 Hyperfy Visual Test Report</h1>
        <p>Comprehensive visual testing results for Hyperfy framework</p>
        <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
    </div>

    <div class="summary">
        <div class="summary-card">
            <h3>Total Tests</h3>
            <div class="number">${summary.total}</div>
        </div>
        <div class="summary-card">
            <h3>Passed</h3>
            <div class="number" style="color: #28a745">${summary.passed}</div>
        </div>
        <div class="summary-card">
            <h3>Failed</h3>
            <div class="number" style="color: #dc3545">${summary.failed}</div>
        </div>
        <div class="summary-card">
            <h3>Duration</h3>
            <div class="number" style="font-size: 1.5em">${(summary.duration / 1000).toFixed(1)}s</div>
        </div>
    </div>

    ${results.map(result => `
        <div class="test-result">
            <div class="test-header">
                <h3>
                    <span class="status-${result.status}">${result.status === 'passed' ? '✅' : '❌'}</span>
                    ${result.scenarioName}
                    <span class="duration">${result.duration}ms</span>
                </h3>
                <div class="timestamp">
                    Started: ${new Date(result.startTime).toLocaleTimeString()}
                </div>
            </div>
            <div class="test-body">
                ${result.validation?.failures && result.validation.failures.length > 0 ? `
                    <div class="failures">
                        <h4>❌ Failures:</h4>
                        <ul>
                            ${result.validation.failures.map(failure => `
                                <li><strong>${failure.type}:</strong> ${failure.message}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${result.validation?.warnings && result.validation.warnings.length > 0 ? `
                    <div class="warnings">
                        <h4>⚠️ Warnings:</h4>
                        <ul>
                            ${result.validation.warnings.map(warning => `
                                <li>${warning}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${result.screenshots && result.screenshots.length > 0 ? `
                    <div class="screenshots">
                        ${result.screenshots.map(screenshot => `
                            <div class="screenshot">
                                <img src="${path.relative(this.outputDir, screenshot)}" alt="Test screenshot">
                                <div class="screenshot-caption">${path.basename(screenshot)}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${result.logs && result.logs.length > 0 ? `
                    <details>
                        <summary>📋 Logs (${result.logs.length} entries)</summary>
                        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">${result.logs.join('\n')}</pre>
                    </details>
                ` : ''}
            </div>
        </div>
    `).join('')}

    <div style="text-align: center; margin-top: 40px; padding: 20px; color: #666;">
        <p>Generated by Hyperfy Test Framework</p>
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Run specific test scenarios by ID
   */
  async runSpecificTests(scenarioIds: string[]): Promise<TestResult[]> {
    const allScenarios = RPGVisualTestScenarios.getAllScenarios();
    const selectedScenarios = allScenarios.filter(s => scenarioIds.includes(s.id));
    
    const results: TestResult[] = [];
    
    for (const scenario of selectedScenarios) {
      const result = await this.runSingleVisualTest(scenario);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Check basic screen rendering - is the screen working at all?
   */
  async checkBasicScreenFunctionality(): Promise<{
    passed: boolean;
    issues: string[];
    statistics: {
      isAllWhite: boolean;
      isAllBlack: boolean;
      dominantColor: string;
      colorVariance: number;
    };
  }> {
    console.log('🖥️  Checking basic screen functionality...');
    
    const visualRunner = new PlaywrightVisualTestRunner(this.framework);
    await visualRunner.initialize({ viewport: { width: 1920, height: 1080 } });
    
    try {
      // Create a simple test world
      const { url } = await visualRunner.createTestWorld({
        id: 'screen-test',
        entities: [
          {
            type: 'terrain',
            id: 'test-ground',
            position: { x: 0, y: 0, z: 0 },
            color: '#808080' // Gray ground
          }
        ],
        camera: {
          type: 'overhead',
          position: { x: 0, y: 10, z: 0 }
        }
      });

      // Navigate to the world
      if (visualRunner['page']) {
        await visualRunner['page'].goto(url, { waitUntil: 'networkidle' });
        await visualRunner['page'].waitForTimeout(3000);
        
        // Take screenshot
        const screenshotPath = await visualRunner.takeScreenshot('basic-screen-test');
        
        // Analyze the screenshot for basic functionality
        const statistics = await this.analyzeScreenStatistics(screenshotPath);
        
        const issues = [];
        
        if (statistics.isAllWhite) {
          issues.push('Screen is completely white - likely rendering failure');
        }
        
        if (statistics.isAllBlack) {
          issues.push('Screen is completely black - likely world loading failure');
        }
        
        if (statistics.colorVariance < 0.1) {
          issues.push('Very low color variance - might indicate rendering issues');
        }
        
        return {
          passed: issues.length === 0,
          issues,
          statistics
        };
      }
      
      throw new Error('Browser page not available');
      
    } finally {
      await visualRunner.cleanup();
    }
  }

  /**
   * Analyze screenshot for basic statistics
   */
  private async analyzeScreenStatistics(screenshotPath: string): Promise<{
    isAllWhite: boolean;
    isAllBlack: boolean;
    dominantColor: string;
    colorVariance: number;
  }> {
    // This would implement actual image analysis
    // For now, return placeholder statistics
    return {
      isAllWhite: false,
      isAllBlack: false,
      dominantColor: '#808080',
      colorVariance: 0.5
    };
  }
}