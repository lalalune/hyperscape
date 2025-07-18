#!/usr/bin/env node
import { spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

console.log(chalk.blue.bold('\n🧪 Among Us Hyperfy - Comprehensive Test Suite\n'));

const testSuites = [
  {
    name: 'Unit Tests',
    command: 'npm',
    args: ['run', 'test:unit'],
    description: 'Core game logic and utilities'
  },
  {
    name: 'Integration Tests',
    command: 'npm',
    args: ['run', 'test:integration'],
    description: 'System interactions and APIs'
  },
  {
    name: 'Frontend Tests',
    command: 'npm',
    args: ['run', 'test:frontend'],
    description: 'React components and UI'
  },
  {
    name: 'E2E Tests',
    command: 'npm',
    args: ['run', 'test:e2e'],
    description: 'End-to-end gameplay scenarios'
  },
  {
    name: 'Agent Tests',
    command: 'npm',
    args: ['run', 'test:agents'],
    description: 'AI agent behavior and decisions'
  },
  {
    name: 'Performance Tests',
    command: 'npm',
    args: ['run', 'test:performance'],
    description: 'Load testing and benchmarks'
  }
];

const reportDir = join(process.cwd(), 'test-reports');
if (!existsSync(reportDir)) {
  mkdirSync(reportDir, { recursive: true });
}

const results = [];
let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;
let totalDuration = 0;

async function runTestSuite(suite) {
  console.log(chalk.yellow(`\n📋 ${suite.name}`));
  console.log(chalk.gray(`   ${suite.description}`));
  console.log(chalk.gray('   ' + '─'.repeat(50)));

  const startTime = Date.now();
  const logFile = join(reportDir, `${suite.name.toLowerCase().replace(/\s+/g, '-')}.log`);
  const logStream = createWriteStream(logFile);

  return new Promise((resolve) => {
    const proc = spawn(suite.command, suite.args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    });

    let output = '';
    let stats = {
      tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      logStream.write(text);

      // Parse test results
      const testMatch = text.match(/(\d+) tests?/);
      const passMatch = text.match(/(\d+) passed/);
      const failMatch = text.match(/(\d+) failed/);
      const skipMatch = text.match(/(\d+) skipped/);

      if (testMatch) stats.tests = parseInt(testMatch[1]);
      if (passMatch) stats.passed = parseInt(passMatch[1]);
      if (failMatch) stats.failed = parseInt(failMatch[1]);
      if (skipMatch) stats.skipped = parseInt(skipMatch[1]);

      // Show progress
      if (text.includes('✓') || text.includes('✔')) {
        process.stdout.write(chalk.green('.'));
      } else if (text.includes('✗') || text.includes('✖')) {
        process.stdout.write(chalk.red('F'));
      } else if (text.includes('⚠') || text.includes('○')) {
        process.stdout.write(chalk.yellow('S'));
      }
    });

    proc.stderr.on('data', (data) => {
      logStream.write(data);
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      logStream.end();

      // Update totals
      totalTests += stats.tests;
      totalPassed += stats.passed;
      totalFailed += stats.failed;
      totalSkipped += stats.skipped;
      totalDuration += duration;

      const result = {
        name: suite.name,
        success: code === 0,
        stats,
        duration,
        logFile
      };

      results.push(result);

      console.log('\n');
      if (code === 0) {
        console.log(chalk.green(`   ✅ ${suite.name} completed successfully`));
      } else {
        console.log(chalk.red(`   ❌ ${suite.name} failed with exit code ${code}`));
      }
      console.log(chalk.gray(`   Duration: ${(duration / 1000).toFixed(2)}s`));
      console.log(chalk.gray(`   Tests: ${stats.tests} | Passed: ${stats.passed} | Failed: ${stats.failed} | Skipped: ${stats.skipped}`));

      resolve(result);
    });
  });
}

async function runAllTests() {
  console.log(chalk.blue('Starting test execution...\n'));

  for (const suite of testSuites) {
    await runTestSuite(suite);
  }

  // Print summary
  console.log(chalk.blue.bold('\n📊 Test Summary\n'));
  console.log(chalk.gray('═'.repeat(60)));

  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? chalk.green : chalk.red;
    console.log(color(`${icon} ${result.name.padEnd(20)} ${result.stats.passed}/${result.stats.tests} passed (${(result.duration / 1000).toFixed(2)}s)`));
  });

  console.log(chalk.gray('═'.repeat(60)));
  console.log(chalk.white.bold(`\nTotal Tests: ${totalTests}`));
  console.log(chalk.green(`✅ Passed: ${totalPassed}`));
  console.log(chalk.red(`❌ Failed: ${totalFailed}`));
  console.log(chalk.yellow(`⚠️  Skipped: ${totalSkipped}`));
  console.log(chalk.gray(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`));

  const coverage = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : 0;
  console.log(chalk.blue(`\n📈 Pass Rate: ${coverage}%`));

  // Generate HTML report
  await generateHTMLReport();

  // Exit with appropriate code
  const exitCode = totalFailed > 0 ? 1 : 0;
  console.log(chalk.gray(`\n📁 Detailed logs saved to: ${reportDir}`));
  console.log(chalk.gray(`📄 HTML report: ${join(reportDir, 'index.html')}`));
  
  if (exitCode === 0) {
    console.log(chalk.green.bold('\n✨ All tests passed! The system is ready for deployment.\n'));
  } else {
    console.log(chalk.red.bold(`\n⚠️  ${totalFailed} tests failed. Please fix the issues before deployment.\n`));
  }

  process.exit(exitCode);
}

async function generateHTMLReport() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Among Us Hyperfy - Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #1a1a1a;
      color: #fff;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: #4a9eff;
      margin-bottom: 30px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 36px;
      font-weight: bold;
      margin: 10px 0;
    }
    .stat-label {
      color: #999;
      font-size: 14px;
    }
    .tests-table {
      background: #2a2a2a;
      border-radius: 8px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #333;
      padding: 15px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 15px;
      border-top: 1px solid #333;
    }
    .success { color: #4caf50; }
    .failure { color: #f44336; }
    .warning { color: #ff9800; }
    .progress-bar {
      width: 100%;
      height: 20px;
      background: #333;
      border-radius: 10px;
      overflow: hidden;
      margin-top: 10px;
    }
    .progress-fill {
      height: 100%;
      background: #4caf50;
      transition: width 0.3s ease;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎮 Among Us Hyperfy - Test Report</h1>
    <p>Generated on ${new Date().toLocaleString()}</p>
    
    <div class="summary">
      <div class="stat-card">
        <div class="stat-label">Total Tests</div>
        <div class="stat-value">${totalTests}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Passed</div>
        <div class="stat-value success">${totalPassed}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Failed</div>
        <div class="stat-value failure">${totalFailed}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pass Rate</div>
        <div class="stat-value">${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0}%</div>
      </div>
    </div>

    <div class="tests-table">
      <table>
        <thead>
          <tr>
            <th>Test Suite</th>
            <th>Status</th>
            <th>Tests</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Duration</th>
            <th>Pass Rate</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(result => `
            <tr>
              <td>${result.name}</td>
              <td class="${result.success ? 'success' : 'failure'}">${result.success ? '✅ Passed' : '❌ Failed'}</td>
              <td>${result.stats.tests}</td>
              <td class="success">${result.stats.passed}</td>
              <td class="failure">${result.stats.failed}</td>
              <td>${(result.duration / 1000).toFixed(2)}s</td>
              <td>
                ${result.stats.tests > 0 ? ((result.stats.passed / result.stats.tests) * 100).toFixed(1) : 0}%
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${result.stats.tests > 0 ? (result.stats.passed / result.stats.tests) * 100 : 0}%"></div>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
  `;

  const fs = await import('fs/promises');
  await fs.writeFile(join(reportDir, 'index.html'), html);
}

// Run tests
runAllTests().catch(error => {
  console.error(chalk.red('\n❌ Test runner failed:'), error);
  process.exit(1);
}); 