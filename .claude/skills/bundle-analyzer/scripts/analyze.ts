#!/usr/bin/env bun

/**
 * Bundle Analysis Script
 * Analyzes JavaScript bundle sizes and identifies optimization opportunities
 */

import { $ } from 'bun';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Bundle Analyzer - Analyze JavaScript bundle sizes

Usage:
  bun run analyze.ts [options]

Options:
  --webpack          Analyze webpack bundle
  --vite             Analyze vite bundle
  --build            Build before analyzing
  --help, -h         Show this help message

Examples:
  bun run analyze.ts --webpack
  bun run analyze.ts --vite --build
`);
    process.exit(0);
  }

  const shouldBuild = args.includes('--build');
  const isWebpack = args.includes('--webpack');
  const isVite = args.includes('--vite');

  try {
    // Build if requested
    if (shouldBuild) {
      console.log('Building application...');
      await $`npm run build`;
    }

    // Analyze based on bundler
    if (isWebpack) {
      console.log('Analyzing webpack bundle...');
      await $`ANALYZE=true npm run build`;
    } else if (isVite) {
      console.log('Analyzing vite bundle...');
      await $`npm run build -- --mode=analyze`;
    } else {
      console.log('Detecting bundler...');
      // Auto-detect bundler
      const pkgJson = await Bun.file('package.json').json();
      if (pkgJson.devDependencies?.webpack) {
        await $`ANALYZE=true npm run build`;
      } else if (pkgJson.devDependencies?.vite) {
        await $`npm run build -- --mode=analyze`;
      } else {
        console.error('Could not detect bundler. Use --webpack or --vite flag.');
        process.exit(1);
      }
    }

    console.log('✓ Bundle analysis complete!');
  } catch (error) {
    console.error('Bundle analysis failed:', error);
    process.exit(1);
  }
}

main();
