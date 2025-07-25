#!/usr/bin/env node

/**
 * Comprehensive RPG Testing Framework
 * 
 * This script runs the Hyperfy world with all RPGTestSystems enabled,
 * collects errors from all test systems, and provides comprehensive logging.
 * 
 * All RPGTestSystems that extend RPGVisualTestFramework are automatically
 * integrated and their results are aggregated for a complete test report.
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');

// Test configuration
const CONFIG = {
  serverUrl: 'http://localhost:3333',
  testTimeout: 120000, // 2 minutes for comprehensive tests
  screenshotDir: path.join(packageRoot, 'test-results'),
  logDir: path.join(packageRoot, 'test-logs'),
  headless: !process.argv.includes('--headed'),
  verbose: process.argv.includes('--verbose'),
  serverStartupTime: 8000, // Longer startup time for all systems
  testCycleDuration: 60000, // How long to run each test cycle
  maxTestCycles: 3 // Maximum number of test cycles to run
};

// All RPGTestSystems that should be monitored
const RPG_TEST_SYSTEMS = [
  'RPGCombatTestSystem',
  'RPGAggroTestSystem', 
  'RPGInventoryTestSystem',
  'RPGBankingTestSystem',
  'RPGStoreTestSystem',
  'RPGResourceGatheringTestSystem',
  'RPGMovementTestSystem',
  'RPGEquipmentTestSystem',
  'RPGVisualTestSystem',
  'RPGPhysicsTestSystem',
  'RPGLootDropTestSystem',
  'RPGCorpseTestSystem',
  'RPGItemActionTestSystem',
  'RPGSystemValidationTestSystem',
  'RPGFishingTestSystem',
  'RPGCookingTestSystem',
  'RPGXPTestSystem',
  'RPGFiremakingTestSystem',
  'RPGWoodcuttingTestSystem',
  'RPGDeathTestSystem',
  'RPGPersistenceTestSystem',
  'RPGUITestSystem'
];

class ComprehensiveRPGTestRunner {
  constructor() {
    this.browser = null;
    this.page = null;
    this.serverProcess = null;
    this.testResults = new Map();
    this.systemErrors = new Map();
    this.screenshots = [];
    this.logEntries = [];
    this.testCycles = 0;
    this.allTestStations = new Map();
    this.startTime = Date.now();
  }

  async initialize() {
    console.log('🚀 Initializing Comprehensive RPG Test Runner...');
    
    // Create directories
    await fs.mkdir(CONFIG.screenshotDir, { recursive: true });
    await fs.mkdir(CONFIG.logDir, { recursive: true });
    
    // Start server with RPG test systems enabled
    await this.startServer();
    
    // Launch browser
    this.browser = await chromium.launch({ 
      headless: CONFIG.headless,
      args: CONFIG.headless ? [] : ['--no-sandbox', '--disable-web-security']
    });
    
    this.page = await this.browser.newPage();
    
    // Set up comprehensive error logging
    this.setupErrorLogging();
    
    console.log('✅ Comprehensive RPG Test Runner initialized');
  }

  setupErrorLogging() {
    // Capture all console messages
    this.page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      const timestamp = new Date().toISOString();
      
      const logEntry = {
        timestamp,
        type,
        message: text,
        source: 'browser'
      };
      
      this.logEntries.push(logEntry);
      
      // Check if this is an RPGTestSystem error
      if (text.includes('[RPG') && text.includes('TestSystem]')) {
        this.categorizeRPGTestError(text, timestamp);
      }
      
      if (CONFIG.verbose || type === 'error' || type === 'warning') {
        console.log(`[Browser ${type.toUpperCase()}] ${text}`);
      }
    });
    
    // Capture page errors
    this.page.on('pageerror', err => {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        type: 'pageerror',
        message: err.message,
        stack: err.stack,
        source: 'browser'
      };
      
      this.logEntries.push(logEntry);
      console.error('[PAGE ERROR]', err.message);
    });

    // Capture network failures
    this.page.on('requestfailed', request => {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        type: 'network_error',
        message: `Request failed: ${request.url()}`,
        failure: request.failure()?.errorText,
        source: 'network'
      };
      
      this.logEntries.push(logEntry);
      if (CONFIG.verbose) {
        console.log(`[NETWORK ERROR] ${request.url()}: ${request.failure()?.errorText}`);
      }
    });
  }

  categorizeRPGTestError(message, timestamp) {
    // Extract system name from message
    const systemMatch = message.match(/\[RPG(\w+)TestSystem\]/);
    if (!systemMatch) return;
    
    const systemName = `RPG${systemMatch[1]}TestSystem`;
    
    if (!this.systemErrors.has(systemName)) {
      this.systemErrors.set(systemName, []);
    }
    
    this.systemErrors.get(systemName).push({
      timestamp,
      message,
      type: message.includes('failed') ? 'failure' : 
            message.includes('error') ? 'error' : 
            message.includes('timeout') ? 'timeout' : 'info'
    });
  }

  async startServer() {
    console.log('📡 Starting Hyperfy server with RPG test systems...');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', ['build/index.js', 'start', '--world', './world', '--dev'], {
        cwd: packageRoot,
        stdio: CONFIG.verbose ? 'inherit' : 'pipe',
        env: {
          ...process.env,
          RPG_TEST_MODE: 'comprehensive',
          RPG_ENABLE_ALL_TEST_SYSTEMS: 'true',
          ENABLE_RPG_TESTS: 'true'
        }
      });
      
      if (!CONFIG.verbose) {
        this.serverProcess.stdout.on('data', (data) => {
          const output = data.toString();
          const timestamp = new Date().toISOString();
          
          // Log server output
          this.logEntries.push({
            timestamp,
            type: 'server_log',
            message: output.trim(),
            source: 'server'
          });
          
          if (output.includes('Server running')) {
            console.log('✅ Server started successfully');
            setTimeout(resolve, CONFIG.serverStartupTime);
          }
          
          // Check for RPG system initialization
          if (output.includes('RPG') && output.includes('TestSystem')) {
            console.log(`[SERVER] ${output.trim()}`);
          }
        });
        
        this.serverProcess.stderr.on('data', (data) => {
          const output = data.toString();
          const timestamp = new Date().toISOString();
          
          this.logEntries.push({
            timestamp,
            type: 'server_error',
            message: output.trim(),
            source: 'server'
          });
          
          console.error(`[SERVER ERROR] ${output.trim()}`);
        });
      } else {
        setTimeout(resolve, CONFIG.serverStartupTime);
      }
      
      this.serverProcess.on('error', reject);
      
      setTimeout(() => {
        if (!CONFIG.verbose) {
          resolve(); // Fallback timeout
        }
      }, 15000);
    });
  }

  async runComprehensiveTests() {
    console.log('🧪 Running comprehensive RPG tests...');
    
    try {
      // Navigate to the world
      await this.page.goto(CONFIG.serverUrl);
      await this.page.waitForTimeout(3000);
      
      // Wait for all RPG test systems to initialize
      await this.waitForRPGTestSystems();
      
      // Take initial screenshot
      await this.takeScreenshot('initial-state');
      
      // Monitor all test systems for multiple cycles
      for (let cycle = 0; cycle < CONFIG.maxTestCycles; cycle++) {
        this.testCycles++;
        console.log(`🔄 Running test cycle ${cycle + 1}/${CONFIG.maxTestCycles}...`);
        
        await this.runTestCycle(cycle);
        
        // Brief pause between cycles
        await this.page.waitForTimeout(5000);
      }
      
      // Collect final results
      await this.collectFinalResults();
      
    } catch (error) {
      console.error('💥 Comprehensive test run failed:', error);
      this.logEntries.push({
        timestamp: new Date().toISOString(),
        type: 'test_framework_error',
        message: error.message,
        stack: error.stack,
        source: 'test_framework'
      });
    }
  }

  async waitForRPGTestSystems() {
    console.log('⏳ Waiting for RPG test systems to initialize...');
    
    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 1000; // 1 second
    let elapsed = 0;
    
    while (elapsed < maxWaitTime) {
      const systemsStatus = await this.page.evaluate((systems) => {
        if (!window.world) return { ready: false, reason: 'No world object' };
        if (!window.world.systems) return { ready: false, reason: 'No systems array' };
        
        const foundSystems = [];
        const systems_array = Array.isArray(window.world.systems) ? window.world.systems : Object.values(window.world.systems);
        
        for (const system of systems_array) {
          const systemName = system.constructor?.name;
          if (systemName && systems.includes(systemName)) {
            foundSystems.push(systemName);
          }
        }
        
        return {
          ready: foundSystems.length >= systems.length * 0.8, // At least 80% of systems
          foundSystems,
          totalExpected: systems.length,
          foundCount: foundSystems.length
        };
      }, RPG_TEST_SYSTEMS);
      
      if (systemsStatus.ready) {
        console.log(`✅ RPG test systems ready: ${systemsStatus.foundCount}/${systemsStatus.totalExpected} systems found`);
        console.log('📋 Found systems:', systemsStatus.foundSystems.slice(0, 5), systemsStatus.foundSystems.length > 5 ? `... and ${systemsStatus.foundSystems.length - 5} more` : '');
        return;
      }
      
      if (CONFIG.verbose) {
        console.log(`⏳ Waiting for systems... Found: ${systemsStatus.foundCount}/${systemsStatus.totalExpected} (${systemsStatus.reason || 'Still loading'})`);
      }
      
      await this.page.waitForTimeout(checkInterval);
      elapsed += checkInterval;
    }
    
    console.warn('⚠️ Not all RPG test systems loaded within timeout, proceeding anyway');
  }

  async runTestCycle(cycleNumber) {
    console.log(`🔬 Monitoring test cycle ${cycleNumber + 1}...`);
    
    const cycleStartTime = Date.now();
    const cycleResults = new Map();
    
    // Monitor test stations and collect results for the cycle duration
    const monitoringPromise = this.monitorTestStations(cycleNumber, cycleResults);
    
    // Take screenshots at regular intervals
    const screenshotPromise = this.takePeriodicScreenshots(cycleNumber);
    
    // Wait for cycle to complete
    await Promise.all([
      monitoringPromise,
      screenshotPromise,
      this.page.waitForTimeout(CONFIG.testCycleDuration)
    ]);
    
    const cycleDuration = Date.now() - cycleStartTime;
    console.log(`✅ Test cycle ${cycleNumber + 1} completed in ${cycleDuration}ms`);
    
    // Store cycle results
    this.testResults.set(`cycle_${cycleNumber}`, {
      cycleNumber,
      duration: cycleDuration,
      results: Object.fromEntries(cycleResults),
      timestamp: new Date().toISOString()
    });
  }

  async monitorTestStations(cycleNumber, cycleResults) {
    const monitorDuration = CONFIG.testCycleDuration;
    const checkInterval = 2000; // Check every 2 seconds
    const checks = Math.floor(monitorDuration / checkInterval);
    
    for (let check = 0; check < checks; check++) {
      try {
        const stationData = await this.page.evaluate(() => {
          if (!window.world || !window.world.systems) return null;
          
          const testSystems = [];
          const systems_array = Array.isArray(window.world.systems) ? window.world.systems : Object.values(window.world.systems);
          
          for (const system of systems_array) {
            const systemName = system.constructor?.name;
            if (systemName && systemName.includes('TestSystem')) {
              const stationData = {
                systemName,
                stations: []
              };
              
              // Try to access test stations from the system
              if (system.testStations) {
                const stations = system.testStations instanceof Map ? 
                  Array.from(system.testStations.entries()) : 
                  Object.entries(system.testStations);
                
                for (const [stationId, station] of stations) {
                  stationData.stations.push({
                    id: stationId,
                    name: station.name || stationId,
                    status: station.status || 'unknown',
                    totalRuns: station.totalRuns || 0,
                    successCount: station.successCount || 0,
                    failureCount: station.failureCount || 0,
                    currentError: station.currentError || null
                  });
                }
              }
              
              testSystems.push(stationData);
            }
          }
          
          return testSystems;
        });
        
        if (stationData) {
          // Update our tracking
          for (const systemData of stationData) {
            if (!cycleResults.has(systemData.systemName)) {
              cycleResults.set(systemData.systemName, {
                stations: new Map(),
                totalStations: systemData.stations.length,
                errors: []
              });
            }
            
            const systemResults = cycleResults.get(systemData.systemName);
            
            for (const station of systemData.stations) {
              const existingStation = systemResults.stations.get(station.id);
              const hasNewRuns = !existingStation || station.totalRuns > existingStation.totalRuns;
              
              systemResults.stations.set(station.id, station);
              
              // Log significant changes
              if (hasNewRuns && CONFIG.verbose) {
                console.log(`[${systemData.systemName}] Station "${station.name}": ${station.status} (${station.successCount}/${station.totalRuns} success)`);
              }
              
              // Track errors
              if (station.currentError && (!existingStation || station.currentError !== existingStation.currentError)) {
                systemResults.errors.push({
                  stationId: station.id,
                  stationName: station.name,
                  error: station.currentError,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        }
        
      } catch (error) {
        console.error(`Error monitoring test stations (check ${check + 1}):`, error);
      }
      
      await this.page.waitForTimeout(checkInterval);
    }
  }

  async takePeriodicScreenshots(cycleNumber) {
    const screenshotInterval = 15000; // Every 15 seconds
    const totalScreenshots = Math.floor(CONFIG.testCycleDuration / screenshotInterval);
    
    for (let i = 0; i < totalScreenshots; i++) {
      await this.page.waitForTimeout(screenshotInterval);
      await this.takeScreenshot(`cycle-${cycleNumber}-screenshot-${i}`);
    }
  }

  async collectFinalResults() {
    console.log('📊 Collecting final test results...');
    
    // Get final system states
    const finalSystemStates = await this.page.evaluate(() => {
      if (!window.world || !window.world.systems) return null;
      
      const systemStates = {};
      const systems_array = Array.isArray(window.world.systems) ? window.world.systems : Object.values(window.world.systems);
      
      for (const system of systems_array) {
        const systemName = system.constructor?.name;
        if (systemName && systemName.includes('TestSystem')) {
          systemStates[systemName] = {
            initialized: true,
            stationCount: system.testStations ? (system.testStations.size || Object.keys(system.testStations).length) : 0,
            hasErrors: system.errorCount > 0 || false
          };
        }
      }
      
      return systemStates;
    });
    
    // Take final screenshot
    await this.takeScreenshot('final-state');
    
    // Generate comprehensive report
    await this.generateComprehensiveReport(finalSystemStates);
  }

  async takeScreenshot(name) {
    const timestamp = Date.now();
    const filename = `${name}-${timestamp}.png`;
    const filePath = path.join(CONFIG.screenshotDir, filename);
    
    try {
      await this.page.screenshot({ 
        path: filePath,
        fullPage: true
      });
      
      this.screenshots.push({
        name: name,
        filename: filename,
        path: filePath,
        timestamp: new Date().toISOString()
      });
      
      if (CONFIG.verbose) {
        console.log(`📸 Screenshot saved: ${filename}`);
      }
    } catch (error) {
      console.error(`Failed to take screenshot ${name}:`, error);
    }
  }

  async generateComprehensiveReport(finalSystemStates) {
    console.log('📋 Generating comprehensive test report...');
    
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    
    // Aggregate all test results
    const aggregatedResults = this.aggregateTestResults();
    
    // Count errors by system
    const errorsBySytem = this.aggregateErrorsBySystem();
    
    // Generate report
    const report = {
      metadata: {
        testType: 'comprehensive_rpg',
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        totalDuration,
        testCycles: this.testCycles,
        config: CONFIG
      },
      systems: {
        expectedSystems: RPG_TEST_SYSTEMS,
        foundSystems: finalSystemStates ? Object.keys(finalSystemStates) : [],
        systemStates: finalSystemStates || {}
      },
      testResults: Object.fromEntries(this.testResults),
      aggregatedResults,
      errors: {
        bySystem: Object.fromEntries(this.systemErrors),
        summary: errorsBySytem,
        totalErrors: this.logEntries.filter(entry => entry.type === 'error' || entry.type === 'pageerror').length
      },
      logs: {
        totalEntries: this.logEntries.length,
        byType: this.aggregateLogsByType(),
        entries: this.logEntries
      },
      screenshots: this.screenshots
    };
    
    // Save comprehensive report
    const reportPath = path.join(CONFIG.screenshotDir, 'comprehensive-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Save error log
    const errorLogPath = path.join(CONFIG.logDir, 'error-log.json');
    const errorLog = {
      timestamp: new Date().toISOString(),
      errors: Object.fromEntries(this.systemErrors),
      criticalErrors: this.logEntries.filter(entry => 
        entry.type === 'error' || entry.type === 'pageerror' || entry.type === 'server_error'
      )
    };
    await fs.writeFile(errorLogPath, JSON.stringify(errorLog, null, 2));
    
    // Print summary
    this.printTestSummary(report);
    
    console.log(`📄 Comprehensive report saved: ${reportPath}`);
    console.log(`📄 Error log saved: ${errorLogPath}`);
  }

  aggregateTestResults() {
    const aggregated = {
      totalSystems: 0,
      totalStations: 0,
      totalRuns: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      systemSummary: {}
    };
    
    for (const [cycleKey, cycleData] of this.testResults) {
      for (const [systemName, systemData] of cycleData.results) {
        if (!aggregated.systemSummary[systemName]) {
          aggregated.systemSummary[systemName] = {
            stationCount: 0,
            totalRuns: 0,
            totalSuccesses: 0,
            totalFailures: 0,
            errorCount: 0
          };
          aggregated.totalSystems++;
        }
        
        const summary = aggregated.systemSummary[systemName];
        summary.stationCount = Math.max(summary.stationCount, systemData.totalStations);
        summary.errorCount += systemData.errors.length;
        
        for (const [stationId, station] of systemData.stations) {
          summary.totalRuns = Math.max(summary.totalRuns, station.totalRuns);
          summary.totalSuccesses = Math.max(summary.totalSuccesses, station.successCount);
          summary.totalFailures = Math.max(summary.totalFailures, station.failureCount);
        }
        
        aggregated.totalStations = Math.max(aggregated.totalStations, summary.stationCount);
      }
    }
    
    // Calculate totals
    for (const systemSummary of Object.values(aggregated.systemSummary)) {
      aggregated.totalRuns += systemSummary.totalRuns;
      aggregated.totalSuccesses += systemSummary.totalSuccesses;
      aggregated.totalFailures += systemSummary.totalFailures;
    }
    
    return aggregated;
  }

  aggregateErrorsBySystem() {
    const summary = {};
    for (const [systemName, errors] of this.systemErrors) {
      summary[systemName] = {
        totalErrors: errors.length,
        errorTypes: {
          failure: errors.filter(e => e.type === 'failure').length,
          error: errors.filter(e => e.type === 'error').length,
          timeout: errors.filter(e => e.type === 'timeout').length,
          info: errors.filter(e => e.type === 'info').length
        }
      };
    }
    return summary;
  }

  aggregateLogsByType() {
    const byType = {};
    for (const entry of this.logEntries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    }
    return byType;
  }

  printTestSummary(report) {
    console.log('\n📋 COMPREHENSIVE RPG TEST SUMMARY');
    console.log('===================================');
    console.log(`Duration: ${Math.round(report.metadata.totalDuration / 1000)}s`);
    console.log(`Test Cycles: ${report.metadata.testCycles}`);
    console.log(`Systems Expected: ${report.systems.expectedSystems.length}`);
    console.log(`Systems Found: ${report.systems.foundSystems.length}`);
    console.log(`Total Stations: ${report.aggregatedResults.totalStations}`);
    console.log(`Total Test Runs: ${report.aggregatedResults.totalRuns}`);
    console.log(`Total Successes: ${report.aggregatedResults.totalSuccesses}`);
    console.log(`Total Failures: ${report.aggregatedResults.totalFailures}`);
    console.log(`Total Errors: ${report.errors.totalErrors}`);
    
    const successRate = report.aggregatedResults.totalRuns > 0 ? 
      ((report.aggregatedResults.totalSuccesses / report.aggregatedResults.totalRuns) * 100).toFixed(1) : '0.0';
    console.log(`Success Rate: ${successRate}%`);
    
    // System breakdown
    console.log('\n🔍 SYSTEM BREAKDOWN:');
    for (const [systemName, summary] of Object.entries(report.aggregatedResults.systemSummary)) {
      const systemRate = summary.totalRuns > 0 ? 
        ((summary.totalSuccesses / summary.totalRuns) * 100).toFixed(1) : '0.0';
      console.log(`  ${systemName}: ${summary.stationCount} stations, ${systemRate}% success, ${summary.errorCount} errors`);
    }
    
    // Error summary
    if (report.errors.totalErrors > 0) {
      console.log('\n❌ ERROR SUMMARY:');
      for (const [systemName, errorSummary] of Object.entries(report.errors.summary)) {
        console.log(`  ${systemName}: ${errorSummary.totalErrors} errors`);
      }
    }
    
    console.log(`\n📸 Screenshots: ${report.screenshots.length} saved in ${CONFIG.screenshotDir}`);
    console.log(`📄 Logs: ${report.logs.totalEntries} entries saved`);
  }

  async cleanup() {
    console.log('🧹 Cleaning up comprehensive test runner...');
    
    if (this.browser) {
      await this.browser.close();
    }
    
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
    
    console.log('✅ Cleanup complete');
  }
}

// Main execution
async function main() {
  const runner = new ComprehensiveRPGTestRunner();
  
  try {
    await runner.initialize();
    await runner.runComprehensiveTests();
    
    // Determine exit code based on results
    const hasErrors = runner.systemErrors.size > 0 || 
                     runner.logEntries.some(entry => 
                       entry.type === 'error' || entry.type === 'pageerror'
                     );
    
    if (hasErrors) {
      console.log('\n⚠️ Tests completed with errors - check the report for details');
      process.exit(1);
    } else {
      console.log('\n✅ All tests completed successfully');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('💥 Comprehensive test runner failed:', error);
    process.exit(1);
  } finally {
    await runner.cleanup();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Comprehensive test runner interrupted');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Comprehensive test runner terminated');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}