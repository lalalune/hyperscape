import { System } from '../../core/systems/System';

export interface RPGTestResult {
  testName: string;
  systemName: string;
  passed: boolean;
  error?: string;
  duration: number;
  timestamp: number;
  details?: any;
}

export interface RPGTestSuite {
  name: string;
  tests: RPGTestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  successRate: number;
}

/**
 * RPG Test Runner System
 * Orchestrates all RPG system tests and reports results to server
 * 
 * Features:
 * - Runs all RPG test systems in sequence
 * - Captures all errors and exceptions
 * - Reports results to server for logging
 * - Provides comprehensive test metrics
 * - Ensures no tests are skipped or ignored
 */
export class RPGTestRunner extends System {
  private testResults: Map<string, RPGTestSuite> = new Map();
  private testSystems: string[] = [
    'RPGCombatTestSystem',
    'RPGEquipmentTestSystem', 
    'RPGInventoryTestSystem',
    'RPGMovementTestSystem',
    'RPGBankingTestSystem',
    'RPGStoreTestSystem',
    'RPGResourceGatheringTestSystem',
    'RPGPhysicsTestSystem',
    'RPGVisualTestSystem'
  ];
  private currentTestIndex = 0;
  private isRunning = false;
  private testStartTime = 0;
  private errorCollector: string[] = [];

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGTestRunner] Initializing RPG test runner...');
    
    // Set up error capture
    this.setupErrorCapture();
    
    // Listen for test events
    this.world.on?.('rpg:test:run_all', this.runAllTests.bind(this));
    this.world.on?.('rpg:test:run_suite', this.runTestSuite.bind(this));
    
    // Listen for individual test completions
    this.testSystems.forEach(systemName => {
      const eventName = `rpg:test:${systemName.toLowerCase().replace('system', '')}:completed`;
      this.world.on?.(eventName, (results: any) => {
        this.handleTestCompletion(systemName, results);
      });
    });
    
    console.log('[RPGTestRunner] Test runner initialized');
  }

  start(): void {
    console.log('[RPGTestRunner] Test runner started');
    
    // Auto-run all tests after a short delay
    setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        this.runAllTests();
      }
    }, 3000);
  }

  private setupErrorCapture(): void {
    // Custom error handler for test execution
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      // Capture error for reporting
      const errorMsg = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      this.errorCollector.push(errorMsg);
      
      // Call original console.error
      originalConsoleError.apply(console, args);
    };

    // Capture unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        const error = `Unhandled Promise Rejection: ${event.reason}`;
        this.errorCollector.push(error);
        console.error('[RPGTestRunner] Unhandled promise rejection:', event.reason);
      });

      // Capture JavaScript errors
      window.addEventListener('error', (event) => {
        const error = `JavaScript Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
        this.errorCollector.push(error);
        console.error('[RPGTestRunner] JavaScript error:', event);
      });
    }
  }

  private async runAllTests(): Promise<void> {
    if (this.isRunning) {
      console.log('[RPGTestRunner] Tests already running, skipping...');
      return;
    }

    console.log('[RPGTestRunner] ===== STARTING ALL RPG TESTS =====');
    this.isRunning = true;
    this.testStartTime = Date.now();
    this.errorCollector = [];
    this.testResults.clear();
    this.currentTestIndex = 0;

    try {
      // Run each test system sequentially
      for (const systemName of this.testSystems) {
        await this.runTestSystem(systemName);
      }

      // Generate final report
      await this.generateFinalReport();

    } catch (error) {
      console.error('[RPGTestRunner] Test execution failed:', error);
      this.errorCollector.push(`Test execution failed: ${(error as Error).message}`);
      await this.reportCriticalFailure(error as Error);
    } finally {
      this.isRunning = false;
    }
  }

  private async runTestSystem(systemName: string): Promise<void> {
    console.log(`[RPGTestRunner] Running test system: ${systemName}`);
    const startTime = Date.now();

    try {
      // Trigger the test system
      const eventName = `rpg:test:run_${systemName.toLowerCase().replace('system', '')}_tests`;
      this.world.emit?.(eventName);

      // Wait for test completion with timeout
      await this.waitForTestCompletion(systemName, 30000); // 30 second timeout

      const duration = Date.now() - startTime;
      console.log(`[RPGTestRunner] ${systemName} completed in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[RPGTestRunner] ${systemName} failed:`, error);
      
      // Record failed test suite
      this.testResults.set(systemName, {
        name: systemName,
        tests: [{
          testName: 'system_execution',
          systemName,
          passed: false,
          error: (error as Error).message,
          duration,
          timestamp: Date.now()
        }],
        totalTests: 1,
        passedTests: 0,
        failedTests: 1,
        duration,
        successRate: 0
      });

      throw error; // Re-throw to stop execution
    }
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

  private handleTestCompletion(systemName: string, results: any): void {
    console.log(`[RPGTestRunner] Received test completion for ${systemName}:`, results);

    // Convert results to test suite format
    const testSuite: RPGTestSuite = {
      name: systemName,
      tests: [],
      totalTests: results.totalTests || 0,
      passedTests: results.passedTests || 0,
      failedTests: results.failedTests || 0,
      duration: results.duration || 0,
      successRate: results.successRate || 0
    };

    // Convert individual test results
    if (results.results) {
      for (const [testName, passed] of Object.entries(results.results)) {
        testSuite.tests.push({
          testName: testName as string,
          systemName,
          passed: passed as boolean,
          duration: results.duration || 0,
          timestamp: Date.now(),
          details: results.testObjects?.[testName]
        });
      }
    }

    this.testResults.set(systemName, testSuite);
  }

  private async runTestSuite(data: { suiteName: string }): Promise<void> {
    console.log(`[RPGTestRunner] Running specific test suite: ${data.suiteName}`);
    
    if (this.testSystems.includes(data.suiteName)) {
      await this.runTestSystem(data.suiteName);
    } else {
      console.error(`[RPGTestRunner] Unknown test suite: ${data.suiteName}`);
    }
  }

  private async generateFinalReport(): Promise<void> {
    const totalDuration = Date.now() - this.testStartTime;
    
    console.log('[RPGTestRunner] ===== FINAL TEST REPORT =====');
    
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const systemResults: any = {};

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

      const status = suite.failedTests === 0 ? '✅ PASS' : '❌ FAIL';
      console.log(`[RPGTestRunner] ${systemName}: ${status} (${suite.passedTests}/${suite.totalTests})`);
    }

    const overallSuccessRate = totalTests > 0 ? (totalPassed / totalTests * 100) : 0;
    
    console.log(`[RPGTestRunner] Overall: ${totalPassed}/${totalTests} tests passed (${overallSuccessRate.toFixed(1)}%)`);
    console.log(`[RPGTestRunner] Total duration: ${totalDuration}ms`);
    console.log(`[RPGTestRunner] Errors captured: ${this.errorCollector.length}`);

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
    this.world.emit?.('rpg:test:all_completed', {
      totalTests,
      passedTests: totalPassed,
      failedTests: totalFailed,
      successRate: overallSuccessRate,
      duration: totalDuration,
      errors: this.errorCollector.length
    });

    // Fail if any tests failed
    if (totalFailed > 0) {
      throw new Error(`RPG tests failed: ${totalFailed} out of ${totalTests} tests failed`);
    }

    console.log('[RPGTestRunner] All tests completed successfully');
  }

  private async reportToServer(report: any): Promise<void> {
    try {
      console.log('[RPGTestRunner] Sending test report to server...');
      
      // Report via world event (server will handle)
      this.world.emit?.('rpg:test:report', report);
      
      // Also log for immediate visibility
      console.log('[RPGTestRunner] Test Report:', JSON.stringify(report, null, 2));
      
      // If we have fetch available, also send HTTP request
      if (typeof fetch !== 'undefined') {
        try {
          const response = await fetch('/api/test-reports', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(report)
          });
          
          if (response.ok) {
            console.log('[RPGTestRunner] Test report sent to server successfully');
          } else {
            console.warn('[RPGTestRunner] Failed to send test report to server:', response.status);
          }
        } catch (fetchError) {
          console.warn('[RPGTestRunner] HTTP test report failed:', fetchError);
        }
      }
      
    } catch (error) {
      console.error('[RPGTestRunner] Failed to report to server:', error);
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
    
    console.error('[RPGTestRunner] ===== CRITICAL TEST FAILURE =====');
    console.error('[RPGTestRunner] Error:', error.message);
    console.error('[RPGTestRunner] Completed tests:', Array.from(this.testResults.keys()));
    console.error('[RPGTestRunner] Captured errors:', this.errorCollector.length);
  }

  // Public API
  getTestResults(): Map<string, RPGTestSuite> {
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
      console.warn('[RPGTestRunner] Cannot run specific system while tests are running');
      return false;
    }

    try {
      await this.runTestSystem(systemName);
      const result = this.testResults.get(systemName);
      return result ? result.failedTests === 0 : false;
    } catch (error) {
      console.error(`[RPGTestRunner] Failed to run ${systemName}:`, error);
      return false;
    }
  }

  destroy(): void {
    this.testResults.clear();
    this.errorCollector = [];
    this.isRunning = false;
    console.log('[RPGTestRunner] Test runner destroyed');
  }

  // Required System lifecycle methods
  update(dt: number): void {
    // Check for test timeouts or monitoring
    if (this.isRunning) {
      const runningTime = Date.now() - this.testStartTime;
      if (runningTime > 300000) { // 5 minute total timeout
        console.error('[RPGTestRunner] Test execution timed out after 5 minutes');
        this.isRunning = false;
        this.reportCriticalFailure(new Error('Test execution timed out'));
      }
    }
  }

  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}