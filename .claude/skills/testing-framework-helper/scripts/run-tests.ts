#!/usr/bin/env bun

/**
 * Test Runner Helper
 * Runs tests with various configurations
 */

import { $ } from 'bun';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Test Runner Helper

Usage:
  bun run run-tests.ts [options]

Options:
  --watch            Watch mode
  --coverage         Generate coverage report
  --unit             Run unit tests only
  --integration      Run integration tests only
  --help, -h         Show this help message

Examples:
  bun run run-tests.ts --watch
  bun run run-tests.ts --coverage
`);
    process.exit(0);
  }

  const watch = args.includes('--watch');
  const coverage = args.includes('--coverage');
  const unit = args.includes('--unit');
  const integration = args.includes('--integration');

  try {
    let cmd = 'bun test';

    if (watch) cmd += ' --watch';
    if (coverage) cmd += ' --coverage';
    if (unit) cmd += ' unit';
    if (integration) cmd += ' integration';

    await $`${cmd}`;
    console.log('✓ Tests complete!');
  } catch (error) {
    console.error('Tests failed:', error);
    process.exit(1);
  }
}

main();
