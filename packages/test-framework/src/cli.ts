#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { createTestFramework } from './index'

const program = new Command()

program
  .name('hyperfy-test')
  .description('Testing framework for Hyperfy applications')
  .version('1.0.0')

program
  .command('run')
  .description('Run test scenarios')
  .option('-p, --plugin <path>', 'Path to plugin module')
  .option('-s, --scenarios <ids...>', 'Specific scenario IDs to run')
  .option('-c, --category <category>', 'Run scenarios by category')
  .option('-t, --tags <tags...>', 'Run scenarios by tags')
  .option('--parallel', 'Run tests in parallel')
  .option('--timeout <ms>', 'Test timeout in milliseconds', '60000')
  .option('-o, --output <dir>', 'Output directory for results')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const spinner = ora('Initializing test framework...').start()
    
    try {
      // Create framework
      const framework = createTestFramework()
      
      // Initialize with plugin
      await framework.initialize({
        pluginPath: options.plugin
      })
      
      spinner.succeed('Framework initialized')
      
      // TODO: Load test scenarios
      // This would normally load scenarios from a test directory
      
      // Run tests
      const runner = framework.getRunner()
      const report = await runner.run({
        scenarios: options.scenarios,
        categories: options.category ? [options.category] : undefined,
        tags: options.tags,
        parallel: options.parallel,
        timeout: parseInt(options.timeout),
        outputDir: options.output,
        generateReport: true,
        verbose: options.verbose
      })
      
      // Display results
      console.log('\n' + chalk.bold('Test Results:'))
      console.log(chalk.green(`✅ Passed: ${report.summary.passed}`))
      console.log(chalk.red(`❌ Failed: ${report.summary.failed}`))
      console.log(chalk.yellow(`⏭️  Skipped: ${report.summary.skipped}`))
      console.log(chalk.blue(`📊 Total: ${report.summary.total}`))
      
      if (report.summary.failed > 0) {
        console.log('\n' + chalk.red('Failed Tests:'))
        report.results
          .filter(r => r.status === 'failed')
          .forEach(r => {
            console.log(chalk.red(`  - ${r.scenarioName}`))
            r.validation?.failures.forEach(f => {
              console.log(chalk.gray(`    ${f.message}`))
            })
          })
      }
      
      // Cleanup
      await framework.cleanup()
      
      // Exit with appropriate code
      process.exit(report.summary.failed > 0 ? 1 : 0)
    } catch (error: any) {
      spinner.fail('Test run failed')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  })

program
  .command('list')
  .description('List available test scenarios')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (options) => {
    // TODO: Implement scenario listing
    console.log(chalk.yellow('Scenario listing not yet implemented'))
  })

program.parse() 