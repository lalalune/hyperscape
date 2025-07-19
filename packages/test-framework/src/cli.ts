#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createTestFramework } from './index.js';
import { ComprehensiveTestRunner } from './runners/ComprehensiveTestRunner.js';
import { HyperfyTestScenarios } from './scenarios/HyperfyTestScenarios.js';
import { RPGTestSuite } from './RPGTestSuite.js';
import { runSimpleConnectionTest } from './simple-connection-test.js';

const program = new Command();

program
  .name('hyperfy-test')
  .description('Testing framework for Hyperfy applications')
  .version('1.0.0');

program
  .command('run')
  .description('Run comprehensive test suite')
  .option('-c, --category <category>', 'Run scenarios by category')
  .option('-t, --tags <tags...>', 'Run scenarios by tags')
  .option('--no-visual', 'Skip visual tests')
  .option('--timeout <ms>', 'Test timeout in milliseconds', '60000')
  .option('-o, --output <dir>', 'Output directory for results', './test-results')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    console.log(chalk.blue('🧪 Hyperfy Test Framework'));
    console.log(chalk.blue('==========================\n'));

    try {
      // Create framework
      const framework = createTestFramework();
      
      console.log('🚀 Initializing test framework...');
      
      // Initialize framework (standalone mode)
      await framework.initialize({});
      
      console.log('✅ Framework initialized');

      // Create comprehensive test runner
      const runner = new ComprehensiveTestRunner(framework);
      
      // Run tests
      const report = await runner.runComprehensiveTests({
        categories: options.category ? [options.category] : undefined,
        tags: options.tags,
        timeout: parseInt(options.timeout),
        outputDir: options.output,
        captureScreenshots: !options.noVisual,
        verbose: options.verbose,
        generateReport: true
      });

      // Display results
      console.log('\n' + chalk.bold('📊 Test Results Summary'));
      console.log('========================');
      console.log(chalk.green(`✅ Passed: ${report.summary.passed}`));
      console.log(chalk.red(`❌ Failed: ${report.summary.failed}`));
      console.log(chalk.yellow(`⏭️  Skipped: ${report.summary.skipped}`));
      console.log(chalk.blue(`📈 Total: ${report.summary.total}`));
      console.log(chalk.cyan(`⏱️  Duration: ${(report.duration / 1000).toFixed(2)}s`));
      console.log(chalk.magenta(`📊 Success Rate: ${((report.summary.passed / report.summary.total) * 100).toFixed(1)}%`));

      if (report.summary.failed > 0) {
        console.log('\n' + chalk.red('❌ Failed Tests:'));
        report.results
          .filter(r => r.status === 'failed' || r.status === 'error')
          .forEach(r => {
            console.log(chalk.red(`  - ${r.scenarioName}`));
            if (r.validation?.failures) {
              r.validation.failures.forEach(f => {
                console.log(chalk.gray(`    └─ ${f.message}`));
              });
            }
            if (r.error) {
              console.log(chalk.gray(`    └─ Error: ${r.error.message}`));
            }
          });
      }

      // Cleanup
      await framework.cleanup();
      
      // Exit with appropriate code
      process.exit(report.summary.failed > 0 ? 1 : 0);
      
    } catch (error: any) {
      console.error(chalk.red('❌ Test run failed:'));
      console.error(chalk.red(error.message));
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List available test scenarios')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (options) => {
    console.log(chalk.blue('📋 Available Test Scenarios'));
    console.log(chalk.blue('===========================\n'));

    const scenarios = HyperfyTestScenarios.getAllScenarios();
    
    const filtered = options.category ? 
      scenarios.filter(s => s.category === options.category) : 
      scenarios;

    if (filtered.length === 0) {
      console.log(chalk.yellow('No scenarios found matching criteria'));
      return;
    }

    // Group by category
    const grouped = filtered.reduce((acc, scenario) => {
      const category = scenario.category || 'uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(scenario);
      return acc;
    }, {} as Record<string, typeof scenarios>);

    Object.entries(grouped).forEach(([category, categoryScenarios]) => {
      console.log(chalk.bold.blue(`📂 ${category.toUpperCase()}`));
      categoryScenarios.forEach(scenario => {
        console.log(`  🧪 ${chalk.cyan(scenario.id)} - ${scenario.name}`);
        console.log(`     ${chalk.gray(scenario.description)}`);
        if (scenario.tags && scenario.tags.length > 0) {
          console.log(`     ${chalk.yellow('Tags:')} ${scenario.tags.join(', ')}`);
        }
        console.log();
      });
    });
  });

program
  .command('validate')
  .description('Validate test framework setup')
  .action(async () => {
    console.log(chalk.blue('🔧 Validating Test Framework Setup'));
    console.log(chalk.blue('===================================\n'));

    try {
      // Test framework creation
      console.log('📦 Testing framework creation...');
      const framework = createTestFramework();
      console.log(chalk.green('✅ Framework created successfully'));

      // Test initialization
      console.log('🚀 Testing framework initialization...');
      await framework.initialize({});
      console.log(chalk.green('✅ Framework initialized successfully'));

      // Test scenario loading
      console.log('📋 Testing scenario loading...');
      const scenarios = HyperfyTestScenarios.getAllScenarios();
      console.log(chalk.green(`✅ Loaded ${scenarios.length} scenarios`));

      // Test cleanup
      console.log('🧹 Testing cleanup...');
      await framework.cleanup();
      console.log(chalk.green('✅ Cleanup completed successfully'));

      console.log('\n' + chalk.green('🎉 Test framework validation passed!'));

    } catch (error: any) {
      console.error('\n' + chalk.red('❌ Validation failed:'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('visual')
  .description('Run comprehensive visual tests with Playwright')
  .option('-s, --scenarios <scenarios...>', 'Run specific scenarios by ID')
  .option('-o, --output <path>', 'Output directory for test results', './test-results/visual')
  .option('--headless', 'Run browser in headless mode', false)
  .action(async (options) => {
    try {
      console.log(chalk.blue('🎬 Starting Visual Testing'));
      console.log(chalk.blue('==========================\n'));

      const framework = createTestFramework();
      const { ComprehensiveVisualTestRunner } = await import('./runners/ComprehensiveVisualTestRunner.js');
      const visualRunner = new ComprehensiveVisualTestRunner(framework, options.output);

      // Check basic screen functionality first
      console.log('🖥️  Checking basic screen functionality...');
      const screenCheck = await visualRunner.checkBasicScreenFunctionality();
      
      if (!screenCheck.passed) {
        console.log(chalk.red('❌ Basic screen functionality check failed:'));
        screenCheck.issues.forEach(issue => {
          console.log(chalk.red(`  - ${issue}`));
        });
        process.exit(1);
      }
      
      console.log(chalk.green('✅ Basic screen functionality check passed'));
      
      // Run visual tests
      let results;
      if (options.scenarios && options.scenarios.length > 0) {
        console.log(`\n🎯 Running specific scenarios: ${options.scenarios.join(', ')}`);
        results = await visualRunner.runSpecificTests(options.scenarios);
      } else {
        console.log('\n🎯 Running all visual test scenarios...');
        const report = await visualRunner.runAllVisualTests();
        results = report.results;
        
        console.log(`\n📊 Visual Test Report generated: ${options.output}/visual-test-report.html`);
      }

      // Summary
      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      
      console.log('\n' + chalk.bold('📊 Visual Test Summary'));
      console.log('======================');
      console.log(chalk.green(`✅ Passed: ${passed}`));
      console.log(chalk.red(`❌ Failed: ${failed}`));
      console.log(chalk.blue(`📈 Total: ${results.length}`));
      
      if (failed > 0) {
        console.log('\n' + chalk.red('❌ Failed Tests:'));
        results
          .filter(r => r.status === 'failed')
          .forEach(r => {
            console.log(chalk.red(`  - ${r.scenarioName}`));
            if (r.validation?.failures) {
              r.validation.failures.forEach(f => {
                console.log(chalk.gray(`    └─ ${f.message}`));
              });
            }
          });
      }

      process.exit(failed > 0 ? 1 : 0);
      
    } catch (error: any) {
      console.error(chalk.red('❌ Visual testing failed:'));
      console.error(chalk.red(error.message));
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

program
  .command('screen-check')
  .description('Quick check of basic screen rendering functionality')
  .action(async () => {
    try {
      console.log(chalk.blue('🖥️  Basic Screen Functionality Check'));
      console.log(chalk.blue('===================================\n'));

      const framework = createTestFramework();
      const { ComprehensiveVisualTestRunner } = await import('./runners/ComprehensiveVisualTestRunner.js');
      const visualRunner = new ComprehensiveVisualTestRunner(framework);

      const result = await visualRunner.checkBasicScreenFunctionality();
      
      if (result.passed) {
        console.log(chalk.green('✅ Basic screen functionality is working correctly'));
        console.log(`   Dominant color: ${result.statistics.dominantColor}`);
        console.log(`   Color variance: ${(result.statistics.colorVariance * 100).toFixed(1)}%`);
      } else {
        console.log(chalk.red('❌ Basic screen functionality issues detected:'));
        result.issues.forEach(issue => {
          console.log(chalk.red(`  - ${issue}`));
        });
        console.log(`\n📊 Statistics:`);
        console.log(`   All white: ${result.statistics.isAllWhite}`);
        console.log(`   All black: ${result.statistics.isAllBlack}`);
        console.log(`   Dominant color: ${result.statistics.dominantColor}`);
        console.log(`   Color variance: ${(result.statistics.colorVariance * 100).toFixed(1)}%`);
      }

      process.exit(result.passed ? 0 : 1);
      
    } catch (error: any) {
      console.error(chalk.red('❌ Screen check failed:'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('system')
  .description('Run Hyperfy system tests (Apps, Entities, ECS)')
  .option('-s, --scenarios <scenarios...>', 'Run specific scenarios by ID')
  .option('-o, --output <path>', 'Output directory for test results', './test-results/system')
  .option('--apps-only', 'Run only App system tests')
  .option('--entities-only', 'Run only Entity system tests')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔧 Hyperfy System Testing'));
      console.log(chalk.blue('==========================\n'));

      const framework = createTestFramework();
      const { HyperfySystemTestRunner } = await import('./runners/HyperfySystemTestRunner.js');
      
      // Initialize framework with minimal plugin (just creates a world)
      await framework.initialize({
        pluginModule: {
          default: {
            init: async (world: any) => {
              console.log('[SystemTest] Plugin initialized with world');
            }
          }
        }
      });
      
      const systemRunner = new HyperfySystemTestRunner(framework);

      let results;
      if (options.appsOnly) {
        console.log('🎯 Running App system tests only...');
        results = await systemRunner.testAppSystem();
      } else if (options.entitiesOnly) {
        console.log('🎯 Running Entity system tests only...');
        results = await systemRunner.testEntitySystem();
      } else if (options.scenarios && options.scenarios.length > 0) {
        console.log(`🎯 Running specific scenarios: ${options.scenarios.join(', ')}`);
        results = [];
        for (const scenarioId of options.scenarios) {
          const result = await systemRunner.runSystemTest(scenarioId);
          results.push(result);
        }
      } else {
        console.log('🎯 Running all system tests...');
        const report = await systemRunner.runAllSystemTests();
        results = report.results;
        
        console.log(`\n📊 System Test Report generated: ${report.report}`);
      }

      // Summary
      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
      
      console.log('\n' + chalk.bold('📊 System Test Summary'));
      console.log('======================');
      console.log(chalk.green(`✅ Passed: ${passed}`));
      console.log(chalk.red(`❌ Failed: ${failed}`));
      console.log(chalk.blue(`📈 Total: ${results.length}`));
      
      if (failed > 0) {
        console.log('\n' + chalk.red('❌ Failed Tests:'));
        results
          .filter(r => r.status === 'failed' || r.status === 'error')
          .forEach(r => {
            console.log(chalk.red(`  - ${r.scenarioName}`));
            if (r.validation?.failures) {
              r.validation.failures.forEach(f => {
                console.log(chalk.gray(`    └─ ${f.message}`));
              });
            }
            if (r.error) {
              console.log(chalk.gray(`    └─ Error: ${r.error.message}`));
            }
          });
      }

      await framework.cleanup();
      process.exit(failed > 0 ? 1 : 0);
      
    } catch (error: any) {
      console.error(chalk.red('❌ System testing failed:'));
      console.error(chalk.red(error.message));
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

program
  .command('browser')
  .description('Run real browser tests with Hyperfy world and avatars')
  .option('-o, --output <path>', 'Output directory for test results', './test-results/browser')
  .option('--keep-open', 'Keep browser open after tests complete')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🌐 Real Browser Hyperfy Testing'));
      console.log(chalk.blue('==================================\n'));

      const framework = createTestFramework();
      const { BrowserHyperfyTestRunner } = await import('./runners/BrowserHyperfyTestRunner.js');
      
      // Initialize framework with minimal plugin
      await framework.initialize({
        pluginModule: {
          default: {
            init: async (world: any) => {
              console.log('[BrowserTest] Plugin initialized');
            }
          }
        }
      });
      
      const browserRunner = new BrowserHyperfyTestRunner(framework);
      
      // Initialize browser and start real Hyperfy world
      await browserRunner.initialize();
      
      console.log('🎯 Running real browser tests with Hyperfy world...');
      
      // Run all browser tests
      const { summary, results } = await browserRunner.runAllBrowserTests();
      
      // Summary
      console.log('\n' + chalk.bold('📊 Browser Test Summary'));
      console.log('=======================');
      console.log(chalk.green(`✅ Passed: ${summary.passed}`));
      console.log(chalk.red(`❌ Failed: ${summary.failed}`));
      console.log(chalk.blue(`📈 Total: ${summary.total}`));
      console.log(chalk.cyan(`⏱️  Duration: ${(summary.duration / 1000).toFixed(2)}s`));
      
      if (summary.failed > 0) {
        console.log('\n' + chalk.red('❌ Failed Tests:'));
        results
          .filter(r => r.status === 'failed')
          .forEach(r => {
            console.log(chalk.red(`  - ${r.scenarioName}`));
            if (r.validation?.failures) {
              r.validation.failures.forEach(f => {
                console.log(chalk.gray(`    └─ ${f.message}`));
              });
            }
            if (r.error) {
              console.log(chalk.gray(`    └─ Error: ${r.error.message}`));
            }
          });
      }

      // Show screenshots taken
      const totalScreenshots = results.reduce((acc, r) => acc + r.screenshots.length, 0);
      console.log(`\n📸 Screenshots taken: ${totalScreenshots}`);
      
      if (!options.keepOpen) {
        await browserRunner.cleanup();
      } else {
        console.log(chalk.yellow('\n🔄 Browser kept open for manual inspection'));
        console.log(chalk.yellow('Press Ctrl+C to exit and cleanup'));
        
        // Wait for user to exit
        process.on('SIGINT', async () => {
          console.log('\nCleaning up...');
          await browserRunner.cleanup();
          process.exit(0);
        });
      }

      await framework.cleanup();
      process.exit(summary.failed > 0 ? 1 : 0);
      
    } catch (error: any) {
      console.error(chalk.red('❌ Browser testing failed:'));
      console.error(chalk.red(error.message));
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

program
  .command('cube')
  .description('Test interactable cube with overhead camera and visual verification')
  .option('-o, --output <path>', 'Output directory for test results', './test-results/cube')
  .option('--keep-open', 'Keep browser open after tests complete')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🎲 Interactable Cube Testing'));
      console.log(chalk.blue('===============================\n'));

      const framework = createTestFramework();
      const { InteractableCubeBrowserTestRunner } = await import('./runners/InteractableCubeBrowserTestRunner.js');
      
      // Initialize framework with minimal plugin
      await framework.initialize({
        pluginModule: {
          default: {
            init: async (world: any) => {
              console.log('[CubeTest] Plugin initialized');
            }
          }
        }
      });
      
      const cubeRunner = new InteractableCubeBrowserTestRunner(framework);
      
      // Initialize browser and connect to Hyperfy world
      await cubeRunner.initialize();
      
      console.log('🎯 Running interactable cube tests with overhead camera...');
      
      // Run all cube tests
      const { summary, results } = await cubeRunner.runAllCubeTests();
      
      // Summary
      console.log('\n' + chalk.bold('📊 Cube Test Summary'));
      console.log('=====================');
      console.log(chalk.green(`✅ Passed: ${summary.passed}`));
      console.log(chalk.red(`❌ Failed: ${summary.failed}`));
      console.log(chalk.blue(`📈 Total: ${summary.total}`));
      console.log(chalk.cyan(`⏱️  Duration: ${(summary.duration / 1000).toFixed(2)}s`));
      
      if (summary.failed > 0) {
        console.log('\n' + chalk.red('❌ Failed Tests:'));
        results
          .filter(r => r.status === 'failed')
          .forEach(r => {
            console.log(chalk.red(`  - ${r.scenarioName}`));
            if (r.validation?.failures) {
              r.validation.failures.forEach(f => {
                console.log(chalk.gray(`    └─ ${f.message}`));
              });
            }
            if (r.error) {
              console.log(chalk.gray(`    └─ Error: ${r.error.message}`));
            }
          });
      }

      // Show screenshots taken
      const totalScreenshots = results.reduce((acc, r) => acc + r.screenshots.length, 0);
      console.log(`\n📸 Screenshots taken: ${totalScreenshots}`);
      
      if (!options.keepOpen) {
        await cubeRunner.cleanup();
      } else {
        console.log(chalk.yellow('\n🔄 Browser kept open for manual inspection'));
        console.log(chalk.yellow('Press Ctrl+C to exit and cleanup'));
        
        // Wait for user to exit
        process.on('SIGINT', async () => {
          console.log('\nCleaning up...');
          await cubeRunner.cleanup();
          process.exit(0);
        });
      }

      await framework.cleanup();
      process.exit(summary.failed > 0 ? 1 : 0);
      
    } catch (error: any) {
      console.error(chalk.red('❌ Cube testing failed:'));
      console.error(chalk.red(error.message));
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

program
  .command('rpg')
  .description('Run comprehensive RPG system tests')
  .option('-u, --url <url>', 'Hyperfy server URL', 'http://localhost:3000')
  .option('-o, --output <dir>', 'Output directory', './test-results/rpg')
  .option('-p, --parallel', 'Run tests in parallel', false)
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '300000')
  .option('-s, --skip-on-error', 'Skip remaining tests on error', false)
  .action(async (options) => {
    console.log(chalk.blue('🎮 Starting RPG Test Suite...'));
    console.log(chalk.blue('==============================\n'));
    
    const suite = new RPGTestSuite({
      hyperfyUrl: options.url,
      outputDir: options.output,
      parallel: options.parallel,
      timeout: parseInt(options.timeout),
      skipOnError: options.skipOnError
    });

    try {
      const result = await suite.runAll();
      
      console.log('\n' + chalk.bold('📊 RPG Test Results'));
      console.log('===================');
      console.log(chalk.green(`✅ Passed: ${result.passedTests}`));
      console.log(chalk.red(`❌ Failed: ${result.failedTests}`));
      console.log(chalk.blue(`📈 Total: ${result.totalTests}`));
      console.log(chalk.cyan(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`));
      console.log(chalk.magenta(`📊 Success Rate: ${((result.passedTests / result.totalTests) * 100).toFixed(1)}%`));
      
      if (result.failedTests > 0) {
        console.log('\n' + chalk.red('❌ Failed RPG Tests:'));
        for (const test of result.results.filter(r => !r.passed)) {
          console.log(chalk.red(`  - ${test.name}: ${test.errors.join(', ')}`));
        }
        process.exit(1);
      } else {
        console.log('\n' + chalk.green('🎉 All RPG tests passed!'));
        process.exit(0);
      }
    } catch (error: any) {
      console.error(chalk.red('💥 RPG test suite failed:'), error);
      process.exit(1);
    }
  });

program
  .command('rpg-combat')
  .description('Run RPG combat system test')
  .option('-u, --url <url>', 'Hyperfy server URL', 'http://localhost:3000')
  .option('-o, --output <dir>', 'Output directory', './test-results/rpg')
  .action(async (options) => {
    console.log(chalk.blue('⚔️ Running RPG Combat Test...'));
    
    try {
      const result = await RPGTestSuite.runCombatTest({
        hyperfyUrl: options.url,
        outputDir: options.output
      });
      
      console.log(`Combat test: ${result.passedTests > 0 ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED')}`);
      console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
      
      if (result.failedTests > 0) {
        console.log(chalk.red('Errors:'), result.results[0]?.errors?.join(', ') || 'Unknown error');
      }
      
      process.exit(result.passedTests > 0 ? 0 : 1);
    } catch (error: any) {
      console.error(chalk.red('💥 Combat test failed:'), error);
      process.exit(1);
    }
  });

program
  .command('rpg-spawning')
  .description('Run RPG mob spawning test')
  .option('-u, --url <url>', 'Hyperfy server URL', 'http://localhost:3000')
  .option('-o, --output <dir>', 'Output directory', './test-results/rpg')
  .action(async (options) => {
    console.log(chalk.blue('🧌 Running RPG Spawning Test...'));
    
    try {
      const result = await RPGTestSuite.runSpawningTest({
        hyperfyUrl: options.url,
        outputDir: options.output
      });
      
      console.log(`Spawning test: ${result.passedTests > 0 ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED')}`);
      console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
      
      if (result.failedTests > 0) {
        console.log(chalk.red('Errors:'), result.results[0]?.errors?.join(', ') || 'Unknown error');
      }
      
      process.exit(result.passedTests > 0 ? 0 : 1);
    } catch (error: any) {
      console.error(chalk.red('💥 Spawning test failed:'), error);
      process.exit(1);
    }
  });

program
  .command('rpg-death')
  .description('Run RPG death and respawn test')
  .option('-u, --url <url>', 'Hyperfy server URL', 'http://localhost:3000')
  .option('-o, --output <dir>', 'Output directory', './test-results/rpg')
  .action(async (options) => {
    console.log(chalk.blue('💀 Running RPG Death Test...'));
    
    try {
      const result = await RPGTestSuite.runDeathTest({
        hyperfyUrl: options.url,
        outputDir: options.output
      });
      
      console.log(`Death test: ${result.passedTests > 0 ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED')}`);
      console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
      
      if (result.failedTests > 0) {
        console.log(chalk.red('Errors:'), result.results[0]?.errors?.join(', ') || 'Unknown error');
      }
      
      process.exit(result.passedTests > 0 ? 0 : 1);
    } catch (error: any) {
      console.error(chalk.red('💥 Death test failed:'), error);
      process.exit(1);
    }
  });

program
  .command('rpg-persistence')
  .description('Run RPG persistence test')
  .option('-u, --url <url>', 'Hyperfy server URL', 'http://localhost:3000')
  .option('-o, --output <dir>', 'Output directory', './test-results/rpg')
  .action(async (options) => {
    console.log(chalk.blue('💾 Running RPG Persistence Test...'));
    
    try {
      const result = await RPGTestSuite.runPersistenceTest({
        hyperfyUrl: options.url,
        outputDir: options.output
      });
      
      console.log(`Persistence test: ${result.passedTests > 0 ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED')}`);
      console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
      
      if (result.failedTests > 0) {
        console.log(chalk.red('Errors:'), result.results[0]?.errors?.join(', ') || 'Unknown error');
      }
      
      process.exit(result.passedTests > 0 ? 0 : 1);
    } catch (error: any) {
      console.error(chalk.red('💥 Persistence test failed:'), error);
      process.exit(1);
    }
  });

program
  .command('connection')
  .description('Test basic connection to Hyperfy server')
  .option('-u, --url <url>', 'Hyperfy server URL', 'http://localhost:3001')
  .action(async (options) => {
    console.log(chalk.blue('🔌 Testing Hyperfy Server Connection...'));
    
    try {
      await runSimpleConnectionTest();
    } catch (error: any) {
      console.error(chalk.red('💥 Connection test failed:'), error);
      process.exit(1);
    }
  });

program
  .command('visual-comprehensive')
  .description('Run comprehensive visual testing with unified system')
  .option('--headless', 'Run browser in headless mode', false)
  .option('-p, --port <port>', 'Hyperfy server port', '3001')
  .option('--hyperfy-path <path>', 'Path to Hyperfy directory', '../hyperfy')
  .option('-o, --output <dir>', 'Output directory for results', './test-results')
  .option('--server-timeout <ms>', 'Server start timeout', '45000')
  .action(async (options) => {
    console.log(chalk.blue('🧪 Comprehensive Visual Testing'));
    console.log(chalk.blue('================================\n'));

    try {
      const { runComprehensiveVisualTests } = await import('./core/VisualTestOrchestrator.js');
      
      const config = {
        serverPort: parseInt(options.port),
        hyperfyPath: options.hyperfyPath,
        headless: options.headless,
        outputDir: options.output,
        serverStartTimeout: parseInt(options.serverTimeout)
      };

      const report = await runComprehensiveVisualTests(config);

      // Print summary
      console.log('\n' + chalk.bold('📊 FINAL TEST RESULTS'));
      console.log('======================');
      console.log(chalk.green(`✅ Passed: ${report.passedTests}`));
      console.log(chalk.red(`❌ Failed: ${report.failedTests}`));
      console.log(chalk.blue(`📈 Total: ${report.totalTests}`));
      console.log(chalk.cyan(`⏱️  Duration: ${(report.duration / 1000).toFixed(2)}s`));
      console.log(chalk.magenta(`📊 Success Rate: ${report.successRate.toFixed(1)}%`));

      if (report.failedTests > 0) {
        console.log('\n' + chalk.red('❌ FAILED TESTS:'));
        for (const suite of report.suites) {
          for (const test of suite.tests) {
            if (!test.passed) {
              console.log(chalk.red(`  - ${suite.name}/${test.name}`));
              test.errors.forEach(error => console.log(chalk.gray(`    └─ ${error}`)));
            }
          }
        }
        process.exit(1);
      } else {
        console.log('\n' + chalk.green('🎉 All tests passed!'));
        process.exit(0);
      }

    } catch (error: any) {
      console.error(chalk.red('💥 Comprehensive visual testing failed:'));
      console.error(chalk.red(error.message));
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

program
  .command('visual-validate')
  .description('Run validation tests to prove visual testing works')
  .option('--headless', 'Run browser in headless mode', false)
  .option('-p, --port <port>', 'Hyperfy server port', '3001')
  .option('--hyperfy-path <path>', 'Path to Hyperfy directory', '../hyperfy')
  .option('-o, --output <dir>', 'Output directory for results', './test-results')
  .option('--server-timeout <ms>', 'Server start timeout', '30000')
  .action(async (options) => {
    console.log(chalk.blue('🔍 Visual Testing Validation'));
    console.log(chalk.blue('=============================\n'));

    try {
      const { runValidationOnly } = await import('./core/VisualTestOrchestrator.js');
      
      const config = {
        serverPort: parseInt(options.port),
        hyperfyPath: options.hyperfyPath,
        headless: options.headless,
        outputDir: options.output,
        serverStartTimeout: parseInt(options.serverTimeout)
      };

      const report = await runValidationOnly(config);

      console.log('\n' + chalk.bold('📊 VALIDATION RESULTS'));
      console.log('======================');
      console.log(chalk.green(`✅ Passed: ${report.passedTests}`));
      console.log(chalk.red(`❌ Failed: ${report.failedTests}`));
      console.log(chalk.cyan(`⏱️  Duration: ${(report.duration / 1000).toFixed(2)}s`));

      if (report.failedTests === 0) {
        console.log('\n' + chalk.green('✅ Visual testing system is working correctly!'));
        process.exit(0);
      } else {
        console.log('\n' + chalk.red('❌ Visual testing system validation failed'));
        process.exit(1);
      }

    } catch (error: any) {
      console.error(chalk.red('💥 Validation failed:'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Add help examples
program.addHelpText('after', `
Examples:
  ${chalk.cyan('hyperfy-test validate')}               Validate framework setup
  ${chalk.cyan('hyperfy-test list')}                   List all test scenarios
  ${chalk.cyan('hyperfy-test run')}                    Run all tests
  ${chalk.cyan('hyperfy-test run -c core')}            Run core functionality tests
  ${chalk.cyan('hyperfy-test run -t world apps')}      Run tests tagged with 'world' or 'apps'
  ${chalk.cyan('hyperfy-test system')}                 Run all Hyperfy system tests
  ${chalk.cyan('hyperfy-test system --apps-only')}     Run only App system tests
  ${chalk.cyan('hyperfy-test system --entities-only')} Run only Entity system tests
  ${chalk.cyan('hyperfy-test browser')}                Run real browser tests with Hyperfy world
  ${chalk.cyan('hyperfy-test browser --keep-open')}    Keep browser open for manual inspection
  ${chalk.cyan('hyperfy-test cube')}                   Test interactable cube with overhead camera
  ${chalk.cyan('hyperfy-test cube --keep-open')}       Keep browser open after cube tests
  ${chalk.cyan('hyperfy-test visual')}                 Run all visual tests with Playwright
  ${chalk.cyan('hyperfy-test visual -s rpg-combat')}   Run specific visual test scenario
  ${chalk.cyan('hyperfy-test screen-check')}           Quick check of basic rendering
  ${chalk.cyan('hyperfy-test visual --headless')}      Run visual tests in headless mode
  
  ${chalk.yellow('RPG Testing Commands:')}
  ${chalk.cyan('hyperfy-test rpg')}                    Run all RPG system tests
  ${chalk.cyan('hyperfy-test rpg-combat')}             Run RPG combat system test
  ${chalk.cyan('hyperfy-test rpg-spawning')}           Run RPG mob spawning test
  ${chalk.cyan('hyperfy-test rpg-death')}              Run RPG death and respawn test
  ${chalk.cyan('hyperfy-test rpg-persistence')}        Run RPG persistence test
`);

program.parse();