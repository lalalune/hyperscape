import { TestFramework } from '../core/TestFramework';
import { TestResult, TestValidation, ValidationFailure } from '../types';
import { HyperfyAppTestScenarios } from '../scenarios/HyperfyAppTestScenarios';
import { HyperfyEntityTestScenarios } from '../scenarios/HyperfyEntityTestScenarios';
import fs from 'fs-extra';
import path from 'path';

/**
 * Comprehensive test runner for Hyperfy systems
 * Tests App system, Entity Component System, and core functionality
 */
export class HyperfySystemTestRunner {
  private framework: TestFramework;
  
  constructor(framework: TestFramework) {
    this.framework = framework;
  }

  /**
   * Run all Hyperfy system tests
   */
  async runAllSystemTests(): Promise<{
    summary: {
      total: number;
      passed: number;
      failed: number;
      duration: number;
    };
    results: TestResult[];
    report: string;
  }> {
    console.log('[HyperfySystemTestRunner] Starting comprehensive system tests...');
    
    const startTime = Date.now();
    const results: TestResult[] = [];
    
    // Get all test scenarios
    const allScenarios = [
      ...HyperfyAppTestScenarios.getAllScenarios(),
      ...HyperfyEntityTestScenarios.getAllScenarios()
    ];
    
    console.log(`[HyperfySystemTestRunner] Found ${allScenarios.length} test scenarios`);
    
    // Run each scenario
    for (const scenario of allScenarios) {
      console.log(`[HyperfySystemTestRunner] Running: ${scenario.name}`);
      
      try {
        const result = await this.runScenario(scenario);
        results.push(result);
        
        const status = result.status === 'passed' ? '✅' : '❌';
        console.log(`[HyperfySystemTestRunner] ${status} ${scenario.name} (${result.duration}ms)`);
        
      } catch (error: any) {
        console.error(`[HyperfySystemTestRunner] ❌ ${scenario.name} failed with error:`, error);
        
        results.push({
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          status: 'error',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          error: error as Error,
          logs: [`Error: ${error.message}`],
          screenshots: [],
          validation: {
            passed: false,
            failures: [{
              type: 'exception',
              message: error.message
            }],
            warnings: []
          }
        });
      }
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed' || r.status === 'error').length,
      duration
    };
    
    console.log(`[HyperfySystemTestRunner] Tests completed: ${summary.passed}/${summary.total} passed (${duration}ms)`);
    
    // Generate report
    const report = await this.generateReport(summary, results);
    
    return {
      summary,
      results,
      report
    };
  }

  /**
   * Run a specific system test scenario
   */
  async runSystemTest(scenarioId: string): Promise<TestResult> {
    const allScenarios = [
      ...HyperfyAppTestScenarios.getAllScenarios(),
      ...HyperfyEntityTestScenarios.getAllScenarios()
    ];
    
    const scenario = allScenarios.find(s => s.id === scenarioId);
    if (!scenario) {
      throw new Error(`Scenario '${scenarioId}' not found`);
    }
    
    return await this.runScenario(scenario);
  }

  /**
   * Run a single test scenario
   */
  private async runScenario(scenario: any): Promise<TestResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    
    // Create test context
    const world = this.framework.getWorld();
    if (!world) {
      throw new Error('No world available for testing');
    }
    
    const context = {
      world,
      framework: this.framework,
      helpers: {} as any, // TODO: Implement proper helpers
      data: new Map<string, any>(),
      
      log: (message: string) => {
        logs.push(`[LOG] ${message}`);
        console.log(`[${scenario.id}] ${message}`);
      },
      
      warn: (message: string) => {
        logs.push(`[WARN] ${message}`);
        console.warn(`[${scenario.id}] ${message}`);
      },
      
      error: (message: string) => {
        logs.push(`[ERROR] ${message}`);
        console.error(`[${scenario.id}] ${message}`);
      },
      
      wait: async (ms: number) => {
        return new Promise(resolve => setTimeout(resolve, ms));
      },
      
      expectCondition: async (condition: () => boolean, timeout: number = 5000) => {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
          if (condition()) {
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Condition timeout');
      }
    };
    
    try {
      // Setup phase
      logs.push('[PHASE] Setup');
      await scenario.setup(context);
      
      // Execute phase
      logs.push('[PHASE] Execute');
      await scenario.execute(context);
      
      // Validate phase
      logs.push('[PHASE] Validate');
      const validation = await scenario.validate(context);
      
      // Cleanup phase
      logs.push('[PHASE] Cleanup');
      await scenario.cleanup(context);
      
      const endTime = Date.now();
      
      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        status: validation.passed ? 'passed' : 'failed',
        startTime,
        endTime,
        duration: endTime - startTime,
        logs,
        screenshots: [], // System tests don't use screenshots
        validation
      };
      
    } catch (error) {
      const endTime = Date.now();
      
      // Try to run cleanup even if test failed
      try {
        await scenario.cleanup(context);
      } catch (cleanupError: any) {
        logs.push(`[CLEANUP ERROR] ${cleanupError.message}`);
      }
      
      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        status: 'error',
        startTime,
        endTime,
        duration: endTime - startTime,
        error: error as Error,
        logs,
        screenshots: [],
        validation: {
          passed: false,
          failures: [{
            type: 'exception',
            message: (error as any).message,
            stack: (error as any).stack
          }],
          warnings: []
        }
      };
    }
  }

  /**
   * Generate HTML report for system tests
   */
  private async generateReport(summary: any, results: TestResult[]): Promise<string> {
    const timestamp = new Date().toISOString();
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hyperfy System Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .metric { background: #fff; padding: 15px; border-radius: 6px; border-left: 4px solid #007cba; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; color: #007cba; }
        .passed { border-left-color: #28a745; }
        .passed .value { color: #28a745; }
        .failed { border-left-color: #dc3545; }
        .failed .value { color: #dc3545; }
        .test-result { background: #fff; margin-bottom: 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .test-header { padding: 15px; cursor: pointer; }
        .test-header.passed { background: #d4edda; border-left: 4px solid #28a745; }
        .test-header.failed { background: #f8d7da; border-left: 4px solid #dc3545; }
        .test-header.error { background: #f8d7da; border-left: 4px solid #dc3545; }
        .test-content { padding: 15px; border-top: 1px solid #dee2e6; display: none; }
        .test-content.show { display: block; }
        .logs { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .logs pre { margin: 0; white-space: pre-wrap; font-size: 12px; }
        .failures { background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .failures h4 { margin: 0 0 10px 0; color: #856404; }
        .warnings { background: #e2e3e5; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .warnings h4 { margin: 0 0 10px 0; color: #6c757d; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Hyperfy System Test Report</h1>
        <p><strong>Generated:</strong> ${timestamp}</p>
        <p><strong>Test Type:</strong> System Tests (App System, Entity Component System)</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div class="value">${summary.total}</div>
        </div>
        <div class="metric passed">
            <h3>Passed</h3>
            <div class="value">${summary.passed}</div>
        </div>
        <div class="metric failed">
            <h3>Failed</h3>
            <div class="value">${summary.failed}</div>
        </div>
        <div class="metric">
            <h3>Duration</h3>
            <div class="value">${summary.duration}ms</div>
        </div>
    </div>

    <h2>Test Results</h2>
    
    ${results.map(result => `
        <div class="test-result">
            <div class="test-header ${result.status}" onclick="toggleContent('${result.scenarioId}')">
                <h3>${result.status === 'passed' ? '✅' : '❌'} ${result.scenarioName}</h3>
                <p><strong>ID:</strong> ${result.scenarioId} | <strong>Duration:</strong> ${result.duration}ms</p>
            </div>
            <div class="test-content" id="${result.scenarioId}">
                
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
                
                ${result.error ? `
                    <div class="failures">
                        <h4>💥 Error:</h4>
                        <pre>${result.error.message}</pre>
                        ${result.error.stack ? `<pre>${result.error.stack}</pre>` : ''}
                    </div>
                ` : ''}
                
                <div class="logs">
                    <h4>📋 Logs:</h4>
                    <pre>${result.logs.join('\\n')}</pre>
                </div>
            </div>
        </div>
    `).join('')}

    <script>
        function toggleContent(id) {
            const content = document.getElementById(id);
            content.classList.toggle('show');
        }
    </script>
</body>
</html>`;

    // Save report to file
    const outputDir = './test-results/system';
    await fs.ensureDir(outputDir);
    
    const reportFilename = `hyperfy-system-tests-${timestamp.replace(/[:.]/g, '-')}.html`;
    const reportPath = path.join(outputDir, reportFilename);
    
    await fs.writeFile(reportPath, html);
    
    console.log(`[HyperfySystemTestRunner] Report saved: ${reportPath}`);
    
    return reportPath;
  }

  /**
   * Test specific Hyperfy systems
   */
  async testAppSystem(): Promise<TestResult[]> {
    const scenarios = HyperfyAppTestScenarios.getAllScenarios();
    const results: TestResult[] = [];
    
    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
    }
    
    return results;
  }

  async testEntitySystem(): Promise<TestResult[]> {
    const scenarios = HyperfyEntityTestScenarios.getAllScenarios();
    const results: TestResult[] = [];
    
    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
    }
    
    return results;
  }
}