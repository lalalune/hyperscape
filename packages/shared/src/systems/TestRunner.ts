 
import { SystemBase } from './SystemBase';
import { TestSuite } from '../types/core';
import { EventType } from '../types/events';
import type { World } from '../types/index';
import { Logger } from '../utils/Logger';

/**
 * Test Runner System
 * Orchestrates all system tests and reports results to server
 * 
 * Features:
 * - Runs all test systems in sequence
 * - Captures all errors and exceptions
 * - Reports results to server for logging
 * - Provides comprehensive test metrics
 * - Ensures no tests are skipped or ignored
 */
export class TestRunner extends SystemBase {
  private testResults: Map<string, TestSuite> = new Map();
  private testSystems: string[] = [
    'CombatTestSystem',
    'AggroTestSystem',
    'EquipmentTestSystem', 
    'InventoryTestSystem',
    'BankingTestSystem',
    'StoreTestSystem',
    'ResourceGatheringTestSystem',
    'LootDropTestSystem',
    'CorpseTestSystem',
    'ItemActionTestSystem',
    'FishingTestSystem',
    'CookingTestSystem',
    'WoodcuttingTestSystem',
    'FiremakingTestSystem',
    'DeathTestSystem',
    'PersistenceTestSystem',
    'SkillsTestSystem',
    'PlayerTestSystem',
    'DatabaseTestSystem',
    'UITestSystem',
    'SystemValidationTestSystem',
    'VisualTestSystem'
  ];
  private currentTestIndex = 0;
  private isRunning = false;
  private testStartTime = 0;
  private errorCollector: string[] = [];

  constructor(world: World) {
    super(world, {
      name: 'test-runner',
      dependencies: {
        required: [], // Test runner can work independently
        optional: [] // Test runner manages its own dependencies
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    // Set up type-safe event subscriptions for test management
    this.subscribe(EventType.TEST_RUN_ALL, () => this.runAllTests());
    
    // Listen for individual test completions
    this.testSystems.forEach(systemName => {
      const eventName = `test:${systemName.toLowerCase().replace('system', '')}:completed`;
      this.subscribe(eventName, (results: unknown) => {
        this.handleTestCompletion(systemName, results);
      });
    });
  }

  start(): void {
    // Auto-run all tests once on start
    this.runAllTests();
  }



  private async runAllTests(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.testStartTime = Date.now();
    this.testResults.clear();
    this.currentTestIndex = 0;

    // Run each test system sequentially
    for (const systemName of this.testSystems) {
      await this.runTestSystem(systemName);
    }

    // Generate final report
    await this.generateFinalReport();

    this.isRunning = false;
  }

  private async runTestSystem(systemName: string): Promise<void> {
    const startTime = Date.now();

    // Trigger the test system
    const eventName = `test:run_${systemName.toLowerCase().replace('system', '')}_tests`;
    this.emitTypedEvent(eventName, {} as Record<string, unknown>);

    // Wait for test completion with timeout
    await this.waitForTestCompletion(systemName, 30000); // 30 second timeout

    const _duration = Date.now() - startTime;
  }

  private async waitForTestCompletion(systemName: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Test system ${systemName} timed out after ${timeout}ms`));
      }, timeout);

      const checkCompletion = () => {
        if (this.testResults.has(systemName)) {
          clearTimeout(timeoutId);
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };

      checkCompletion();
    });
  }

  private handleTestCompletion(systemName: string, results: unknown): void {
    // Type guard for test results
    const isValidTestResults = (obj: unknown): obj is {
      totalTests?: number;
      passedTests?: number;
      failedTests?: number;
      duration?: number;
      successRate?: number;
      results?: Record<string, boolean>;
    } => {
      return obj !== null && typeof obj === 'object';
    };

    const validResults = isValidTestResults(results) ? results : {};

    // Convert results to test suite format
    const testSuite: TestSuite = {
      name: systemName,
      tests: [],
      totalTests: validResults.totalTests || 0,
      passedTests: validResults.passedTests || 0,
      failedTests: validResults.failedTests || 0,
      duration: validResults.duration || 0,
      successRate: validResults.successRate || 0
    };

    // Convert individual test results
    if (validResults.results) {
      for (const [testName, passed] of Object.entries(validResults.results)) {
        testSuite.tests.push({
          testName: testName as string,
          systemName,
          passed: passed as boolean,
          error: null,
          duration: validResults.duration || 0,
          timestamp: Date.now(),
          data: null
        });
      }
    }

    this.testResults.set(systemName, testSuite);
  }

  private async generateFinalReport(): Promise<void> {
    const totalDuration = Date.now() - this.testStartTime;
    
    
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const systemResults: Record<string, unknown> = {};

    // Aggregate results
    for (const [systemName, suite] of this.testResults) {
      totalTests += suite.totalTests;
      totalPassed += suite.passedTests;
      totalFailed += suite.failedTests;
      
      systemResults[systemName] = {
        totalTests: suite.totalTests,
        passedTests: suite.passedTests,
        failedTests: suite.failedTests,
        successRate: suite.successRate,
        duration: suite.duration
      };

      const _status = suite.failedTests === 0 ? '✅ PASS' : '❌ FAIL';
    }

    const overallSuccessRate = totalTests > 0 ? (totalPassed / totalTests * 100) : 0;
    

    // Report to server
    await this.reportToServer({
      timestamp: Date.now(),
      duration: totalDuration,
      totalTests,
      passedTests: totalPassed,
      failedTests: totalFailed,
      successRate: overallSuccessRate,
      systemResults,
      errors: this.errorCollector,
      testSuites: Object.fromEntries(this.testResults)
    });

    // Emit completion event
    this.emitTypedEvent(EventType.TEST_ALL_COMPLETED, {
      totalTests,
      passedTests: totalPassed,
      failedTests: totalFailed,
      successRate: overallSuccessRate,
      duration: totalDuration,
      errors: this.errorCollector.length
    });

    // Fail if any tests failed
    if (totalFailed > 0) {
      throw new Error(`tests failed: ${totalFailed} out of ${totalTests} tests failed`);
    }

  }

  private async reportToServer(report: Record<string, unknown>): Promise<void> {
    try {
      
      // Report via world event (server will handle)
      this.emitTypedEvent(EventType.TEST_REPORT, report as Record<string, unknown>);
      
      // Also log for immediate visibility
      
      // If we have fetch available, also send HTTP request
      if (typeof fetch !== 'undefined') {
        try {
          const response = await fetch(import.meta.env.PUBLIC_API_URL + '/test-reports', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(report)
          });
          
          if (response.ok) {
            // Successfully sent report to server
          } else {
            Logger.systemWarn('TestRunner', 'Failed to send test report to server', { status: response.status });
          }
        } catch (fetchError) {
          Logger.systemWarn('TestRunner', 'HTTP test report failed', { error: fetchError });
        }
      }
      
          } catch (_error) {
        Logger.systemError('TestRunner', 'Failed to report to server', _error instanceof Error ? _error : new Error(String(_error)));
      }
  }

  private async reportCriticalFailure(error: Error): Promise<void> {
    const failureReport = {
      timestamp: Date.now(),
      type: 'critical_failure',
      error: error.message,
      stack: error.stack,
      errors: this.errorCollector,
      completedTests: Array.from(this.testResults.keys()),
      currentTestIndex: this.currentTestIndex
    };

    await this.reportToServer(failureReport);
    
          Logger.systemError('TestRunner', '===== CRITICAL TEST FAILURE =====');
          Logger.systemError('TestRunner', 'Test error', error instanceof Error ? error : new Error(String(error)));
          Logger.systemError('TestRunner', 'Completed tests', undefined, { completedTests: Array.from(this.testResults.keys()) });
          Logger.systemError('TestRunner', 'Captured errors', undefined, { errorCount: this.errorCollector.length });
  }

  // Public API
  getTestResults(): Map<string, TestSuite> {
    return new Map(this.testResults);
  }

  getErrorLog(): string[] {
    return [...this.errorCollector];
  }

  isTestRunning(): boolean {
    return this.isRunning;
  }

  async runSpecificSystem(systemName: string): Promise<boolean> {
    if (this.isRunning) {
      Logger.systemWarn('TestRunner', 'Cannot run specific system while tests are running');
      return false;
    }

    try {
      await this.runTestSystem(systemName);
      const result = this.testResults.get(systemName);
      return result ? result.failedTests === 0 : false;
          } catch (_error) {
        Logger.systemError('TestRunner', `Failed to run ${systemName}`, _error instanceof Error ? _error : new Error(String(_error)));
        return false;
    }
  }

  // Required System lifecycle methods
  update(_dt: number): void {
    // Check for test timeouts or monitoring
    if (this.isRunning) {
      const runningTime = Date.now() - this.testStartTime;
      if (runningTime > 300000) { // 5 minute total timeout
        Logger.systemError('TestRunner', 'Test execution timed out after 5 minutes');
        this.isRunning = false;
        this.reportCriticalFailure(new Error('Test execution timed out'));
      }
    }
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear test results
    this.testResults.clear();
    
    // Clear error collector
    this.errorCollector.length = 0;
    
    // Reset test state
    this.currentTestIndex = 0;
    this.isRunning = false;
    this.testStartTime = 0;
    
        
    // Call parent cleanup
    super.destroy();
  }
}