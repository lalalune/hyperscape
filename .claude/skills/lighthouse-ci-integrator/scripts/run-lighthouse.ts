#!/usr/bin/env bun

/**
 * Lighthouse CI Runner
 * Run Lighthouse CI tests with custom configuration
 */

import { $ } from 'bun';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Lighthouse CI Runner

Usage:
  bun run run-lighthouse.ts [options]

Options:
  --mobile           Run mobile tests
  --desktop          Run desktop tests (default)
  --url <url>        Test specific URL
  --collect-only     Only collect, don't assert
  --upload           Upload results to LHCI server
  --help, -h         Show this help message

Examples:
  bun run run-lighthouse.ts --mobile
  bun run run-lighthouse.ts --url https://example.com
  bun run run-lighthouse.ts --collect-only
`);
    process.exit(0);
  }

  const isMobile = args.includes('--mobile');
  const isDesktop = args.includes('--desktop') || !isMobile;
  const customUrl = args[args.indexOf('--url') + 1];
  const collectOnly = args.includes('--collect-only');
  const shouldUpload = args.includes('--upload');

  try {
    const config = isMobile ? 'lighthouserc.mobile.js' : 'lighthouserc.js';

    console.log(`Running Lighthouse CI (${isMobile ? 'mobile' : 'desktop'})...`);

    if (collectOnly) {
      await $`lhci collect --config=${config}`;
    } else if (shouldUpload) {
      await $`lhci autorun --config=${config} --upload.target=lhci`;
    } else {
      await $`lhci autorun --config=${config}`;
    }

    console.log('✓ Lighthouse CI complete!');
  } catch (error) {
    console.error('Lighthouse CI failed:', error);
    process.exit(1);
  }
}

main();
