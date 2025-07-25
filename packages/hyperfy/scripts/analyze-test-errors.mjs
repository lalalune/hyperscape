#!/usr/bin/env node

/**
 * RPG Test Error Analysis Script
 * 
 * This script analyzes the comprehensive test results from test-rpg-comprehensive.mjs
 * and provides detailed error analysis, categorization, and recommendations.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');

// Configuration
const CONFIG = {
  testResultsDir: path.join(packageRoot, 'test-results'),
  logDir: path.join(packageRoot, 'test-logs'),
  outputDir: path.join(packageRoot, 'test-analysis'),
  verbose: process.argv.includes('--verbose'),
  format: process.argv.includes('--json') ? 'json' : 'text'
};

class RPGTestErrorAnalyzer {
  constructor() {
    this.errorCategories = {
      'system_loading': {
        patterns: [/system not found/i, /failed to register/i, /initialization failed/i],
        severity: 'critical',
        description: 'Core system loading failures'
      },
      'test_timeout': {
        patterns: [/timeout/i, /exceeded/i, /hanging/i],
        severity: 'high',
        description: 'Test execution timeouts'
      },
      'validation_failure': {
        patterns: [/validation failed/i, /assertion/i, /expected.*but got/i],
        severity: 'high',
        description: 'Test validation failures'
      },
      'network_error': {
        patterns: [/network/i, /connection/i, /websocket/i, /request failed/i],
        severity: 'medium',
        description: 'Network and connectivity issues'
      },
      'database_error': {
        patterns: [/database/i, /sql/i, /sqlite/i, /persistence/i],
        severity: 'high',
        description: 'Database and persistence errors'
      },
      'ui_error': {
        patterns: [/ui/i, /interface/i, /component/i, /render/i],
        severity: 'medium',
        description: 'User interface errors'
      },
      'physics_error': {
        patterns: [/physics/i, /collision/i, /rigidbody/i, /three\.js/i],
        severity: 'medium',
        description: 'Physics and 3D engine errors'
      },
      'gameplay_error': {
        patterns: [/combat/i, /inventory/i, /equipment/i, /mob/i, /player/i],
        severity: 'high',
        description: 'Core gameplay mechanic errors'
      }
    };
    
    this.analysisResults = {
      totalErrors: 0,
      errorsByCategory: {},
      errorsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      errorsBySystem: {},
      errorTrends: [],
      recommendationsGenerated: []
    };
  }

  async analyze() {
    console.log('🔍 Starting RPG Test Error Analysis...');
    
    // Create output directory
    await fs.mkdir(CONFIG.outputDir, { recursive: true });
    
    // Load test results
    const testReport = await this.loadTestReport();
    if (!testReport) {
      console.error('❌ No test report found to analyze');
      return;
    }
    
    // Load error logs
    const errorLogs = await this.loadErrorLogs();
    
    // Analyze errors
    await this.analyzeTestReport(testReport);
    await this.analyzeErrorLogs(errorLogs);
    
    // Generate recommendations
    this.generateRecommendations();
    
    // Output results
    await this.outputAnalysis();
    
    console.log('✅ Error analysis complete');
  }

  async loadTestReport() {
    try {
      const reportPath = path.join(CONFIG.testResultsDir, 'comprehensive-test-report.json');
      const reportData = await fs.readFile(reportPath, 'utf8');
      return JSON.parse(reportData);
    } catch (error) {
      console.warn('⚠️ Could not load comprehensive test report:', error.message);
      return null;
    }
  }

  async loadErrorLogs() {
    try {
      const logPath = path.join(CONFIG.logDir, 'error-log.json');
      const logData = await fs.readFile(logPath, 'utf8');
      return JSON.parse(logData);
    } catch (error) {
      console.warn('⚠️ Could not load error logs:', error.message);
      return null;
    }
  }

  async analyzeTestReport(report) {
    if (!report) return;
    
    console.log('📊 Analyzing test report...');
    
    // Analyze system states
    if (report.systems?.systemStates) {
      for (const [systemName, state] of Object.entries(report.systems.systemStates)) {
        if (state.hasErrors) {
          this.categorizeSystemError(systemName, 'System reported errors');
        }
      }
    }
    
    // Analyze test results
    if (report.testResults) {
      for (const [cycleKey, cycleData] of Object.entries(report.testResults)) {
        if (cycleData.results) {
          for (const [systemName, systemData] of Object.entries(cycleData.results)) {
            this.analyzeSystemTestResults(systemName, systemData);
          }
        }
      }
    }
    
    // Analyze aggregated errors
    if (report.errors?.bySystem) {
      for (const [systemName, errors] of Object.entries(report.errors.bySystem)) {
        for (const error of errors) {
          this.categorizeError(error.message, systemName, error.timestamp);
        }
      }
    }
    
    // Analyze logs
    if (report.logs?.entries) {
      for (const logEntry of report.logs.entries) {
        if (logEntry.type === 'error' || logEntry.type === 'pageerror' || logEntry.type === 'server_error') {
          this.categorizeError(logEntry.message, 'general', logEntry.timestamp);
        }
      }
    }
  }

  analyzeSystemTestResults(systemName, systemData) {
    if (systemData.errors && systemData.errors.length > 0) {
      for (const error of systemData.errors) {
        this.categorizeError(error.error, systemName, error.timestamp);
      }
    }
    
    // Analyze station results
    if (systemData.stations) {
      for (const [stationId, station] of systemData.stations) {
        if (station.currentError) {
          this.categorizeError(station.currentError, systemName, new Date().toISOString());
        }
        
        // Analyze success rates
        if (station.totalRuns > 0) {
          const successRate = station.successCount / station.totalRuns;
          if (successRate < 0.5) {
            this.categorizeError(
              `Low success rate: ${(successRate * 100).toFixed(1)}% for station ${station.name}`,
              systemName,
              new Date().toISOString()
            );
          }
        }
      }
    }
  }

  async analyzeErrorLogs(errorLogs) {
    if (!errorLogs) return;
    
    console.log('📋 Analyzing error logs...');
    
    // Analyze critical errors
    if (errorLogs.criticalErrors) {
      for (const error of errorLogs.criticalErrors) {
        this.categorizeError(error.message, error.source || 'unknown', error.timestamp);
      }
    }
    
    // Analyze system-specific errors
    if (errorLogs.errors) {
      for (const [systemName, systemErrors] of Object.entries(errorLogs.errors)) {
        for (const error of systemErrors) {
          this.categorizeError(error.message, systemName, error.timestamp);
        }
      }
    }
  }

  categorizeError(errorMessage, systemName, timestamp) {
    this.analysisResults.totalErrors++;
    
    // Categorize by pattern matching
    let category = 'unknown';
    let severity = 'low';
    
    for (const [categoryName, categoryConfig] of Object.entries(this.errorCategories)) {
      for (const pattern of categoryConfig.patterns) {
        if (pattern.test(errorMessage)) {
          category = categoryName;
          severity = categoryConfig.severity;
          break;
        }
      }
      if (category !== 'unknown') break;
    }
    
    // Track by category
    if (!this.analysisResults.errorsByCategory[category]) {
      this.analysisResults.errorsByCategory[category] = [];
    }
    this.analysisResults.errorsByCategory[category].push({
      message: errorMessage,
      system: systemName,
      timestamp,
      severity
    });
    
    // Track by severity
    this.analysisResults.errorsBySeverity[severity]++;
    
    // Track by system
    if (!this.analysisResults.errorsBySystem[systemName]) {
      this.analysisResults.errorsBySystem[systemName] = [];
    }
    this.analysisResults.errorsBySystem[systemName].push({
      message: errorMessage,
      category,
      severity,
      timestamp
    });
    
    if (CONFIG.verbose) {
      console.log(`[${severity.toUpperCase()}] [${category}] [${systemName}] ${errorMessage}`);
    }
  }

  categorizeSystemError(systemName, errorMessage) {
    this.categorizeError(errorMessage, systemName, new Date().toISOString());
  }

  generateRecommendations() {
    console.log('💡 Generating recommendations...');
    
    const recommendations = [];
    
    // Severity-based recommendations
    if (this.analysisResults.errorsBySeverity.critical > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        title: 'Critical System Failures Detected',
        description: `${this.analysisResults.errorsBySeverity.critical} critical errors found. These prevent core functionality.`,
        actions: [
          'Review system registration and initialization code',
          'Check for missing dependencies or configuration',
          'Verify database connectivity and schema',
          'Run tests individually to isolate failing systems'
        ]
      });
    }
    
    if (this.analysisResults.errorsBySeverity.high > 5) {
      recommendations.push({
        priority: 'HIGH',
        title: 'Multiple High-Severity Issues',
        description: `${this.analysisResults.errorsBySeverity.high} high-severity errors require immediate attention.`,
        actions: [
          'Focus on gameplay mechanics validation',
          'Review test assertions and expected behaviors',
          'Check for race conditions in test execution',
          'Verify mock data and test fixtures'
        ]
      });
    }
    
    // Category-based recommendations
    for (const [category, errors] of Object.entries(this.analysisResults.errorsByCategory)) {
      if (errors.length > 3) {
        const categoryConfig = this.errorCategories[category];
        recommendations.push({
          priority: categoryConfig?.severity?.toUpperCase() || 'MEDIUM',
          title: `Frequent ${categoryConfig?.description || category} Issues`,
          description: `${errors.length} errors in category: ${category}`,
          actions: this.getCategorySpecificActions(category)
        });
      }
    }
    
    // System-based recommendations
    const systemsWithMostErrors = Object.entries(this.analysisResults.errorsBySystem)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, 3);
    
    for (const [systemName, systemErrors] of systemsWithMostErrors) {
      if (systemErrors.length > 2) {
        recommendations.push({
          priority: 'MEDIUM',
          title: `${systemName} System Issues`,
          description: `${systemErrors.length} errors detected in ${systemName}`,
          actions: [
            `Review ${systemName} implementation for common failure patterns`,
            `Check ${systemName} test scenarios and validation logic`,
            `Verify ${systemName} dependencies and initialization order`,
            `Consider adding more specific error handling to ${systemName}`
          ]
        });
      }
    }
    
    // General recommendations
    if (this.analysisResults.totalErrors > 20) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'High Overall Error Count',
        description: `${this.analysisResults.totalErrors} total errors indicate systemic issues`,
        actions: [
          'Consider reducing test complexity or splitting into smaller suites',
          'Review test environment setup and stability',
          'Implement more robust error recovery in test framework',
          'Add monitoring for test execution patterns'
        ]
      });
    }
    
    this.analysisResults.recommendationsGenerated = recommendations;
  }

  getCategorySpecificActions(category) {
    const actionMap = {
      'system_loading': [
        'Check system registration order and dependencies',
        'Verify all required systems are properly imported',
        'Review system initialization parameters',
        'Check for circular dependencies between systems'
      ],
      'test_timeout': [
        'Increase timeout values for complex operations',
        'Optimize test execution performance',
        'Check for infinite loops or blocking operations',
        'Consider parallel test execution'
      ],
      'validation_failure': [
        'Review test assertions and expected values',
        'Update test data to match current implementation',
        'Check for timing issues in asynchronous operations',
        'Verify mock data accuracy'
      ],
      'network_error': [
        'Check server startup and connectivity',
        'Review WebSocket connection handling',
        'Verify port availability and firewall settings',
        'Implement connection retry logic'
      ],
      'database_error': [
        'Check database schema and migrations',
        'Verify database file permissions',
        'Review SQL queries for correctness',
        'Implement database connection pooling'
      ],
      'ui_error': [
        'Check UI component rendering logic',
        'Verify DOM manipulation and event handling',
        'Review React component lifecycle issues',
        'Test UI with different screen sizes and browsers'
      ],
      'physics_error': [
        'Check Three.js scene setup and object hierarchy',
        'Verify physics world initialization',
        'Review collision detection and rigidbody setup',
        'Check for memory leaks in 3D objects'
      ],
      'gameplay_error': [
        'Review game logic and state management',
        'Check player and mob interaction systems',
        'Verify item and inventory mechanics',
        'Test combat calculations and formulas'
      ]
    };
    
    return actionMap[category] || [
      'Review error messages for specific details',
      'Add more detailed logging to identify root cause',
      'Consider isolating this issue with targeted tests',
      'Check documentation for known issues'
    ];
  }

  async outputAnalysis() {
    const analysis = {
      timestamp: new Date().toISOString(),
      summary: {
        totalErrors: this.analysisResults.totalErrors,
        errorsBySeverity: this.analysisResults.errorsBySeverity,
        topCategories: Object.entries(this.analysisResults.errorsByCategory)
          .map(([category, errors]) => ({ category, count: errors.length }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        topSystems: Object.entries(this.analysisResults.errorsBySystem)
          .map(([system, errors]) => ({ system, count: errors.length }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      },
      detailed: {
        errorsByCategory: this.analysisResults.errorsByCategory,
        errorsBySystem: this.analysisResults.errorsBySystem
      },
      recommendations: this.analysisResults.recommendationsGenerated
    };
    
    if (CONFIG.format === 'json') {
      // Output as JSON
      const jsonPath = path.join(CONFIG.outputDir, 'error-analysis.json');
      await fs.writeFile(jsonPath, JSON.stringify(analysis, null, 2));
      console.log(`📄 JSON analysis saved: ${jsonPath}`);
    } else {
      // Output as readable text
      const textPath = path.join(CONFIG.outputDir, 'error-analysis.txt');
      const textReport = this.formatTextReport(analysis);
      await fs.writeFile(textPath, textReport);
      console.log(`📄 Text analysis saved: ${textPath}`);
    }
    
    // Always output summary to console
    this.printSummary(analysis);
  }

  formatTextReport(analysis) {
    let report = '';
    
    report += '=' .repeat(60) + '\n';
    report += 'RPG TEST ERROR ANALYSIS REPORT\n';
    report += '=' .repeat(60) + '\n';
    report += `Generated: ${analysis.timestamp}\n\n`;
    
    // Summary
    report += 'SUMMARY\n';
    report += '-'.repeat(20) + '\n';
    report += `Total Errors: ${analysis.summary.totalErrors}\n`;
    report += `Critical: ${analysis.summary.errorsBySeverity.critical}\n`;
    report += `High: ${analysis.summary.errorsBySeverity.high}\n`;
    report += `Medium: ${analysis.summary.errorsBySeverity.medium}\n`;
    report += `Low: ${analysis.summary.errorsBySeverity.low}\n\n`;
    
    // Top categories
    report += 'TOP ERROR CATEGORIES\n';
    report += '-'.repeat(20) + '\n';
    for (const { category, count } of analysis.summary.topCategories) {
      const desc = this.errorCategories[category]?.description || category;
      report += `${count}x ${desc} (${category})\n`;
    }
    report += '\n';
    
    // Top systems
    report += 'SYSTEMS WITH MOST ERRORS\n';
    report += '-'.repeat(20) + '\n';
    for (const { system, count } of analysis.summary.topSystems) {
      report += `${count}x ${system}\n`;
    }
    report += '\n';
    
    // Recommendations
    report += 'RECOMMENDATIONS\n';
    report += '-'.repeat(20) + '\n';
    for (const rec of analysis.recommendations) {
      report += `[${rec.priority}] ${rec.title}\n`;
      report += `${rec.description}\n`;
      report += 'Actions:\n';
      for (const action of rec.actions) {
        report += `  • ${action}\n`;
      }
      report += '\n';
    }
    
    return report;
  }

  printSummary(analysis) {
    console.log('\n📊 ERROR ANALYSIS SUMMARY');
    console.log('========================');
    console.log(`Total Errors: ${analysis.summary.totalErrors}`);
    console.log(`Critical: ${analysis.summary.errorsBySeverity.critical} | High: ${analysis.summary.errorsBySeverity.high} | Medium: ${analysis.summary.errorsBySeverity.medium} | Low: ${analysis.summary.errorsBySeverity.low}`);
    
    if (analysis.summary.topCategories.length > 0) {
      console.log('\nTop Error Categories:');
      for (const { category, count } of analysis.summary.topCategories.slice(0, 3)) {
        const desc = this.errorCategories[category]?.description || category;
        console.log(`  ${count}x ${desc}`);
      }
    }
    
    if (analysis.summary.topSystems.length > 0) {
      console.log('\nSystems Needing Attention:');
      for (const { system, count } of analysis.summary.topSystems.slice(0, 3)) {
        console.log(`  ${count}x ${system}`);
      }
    }
    
    console.log(`\n💡 Generated ${analysis.recommendations.length} recommendations`);
    console.log(`📁 Detailed analysis saved in: ${CONFIG.outputDir}`);
  }
}

// Main execution
async function main() {
  const analyzer = new RPGTestErrorAnalyzer();
  
  try {
    await analyzer.analyze();
  } catch (error) {
    console.error('💥 Error analysis failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}