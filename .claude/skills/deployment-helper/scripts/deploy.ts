#!/usr/bin/env bun

/**
 * Deployment Helper
 * Automates deployment tasks and checks
 */

import { $ } from 'bun';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Deployment Helper

Usage:
  bun run deploy.ts [environment] [options]

Environments:
  staging            Deploy to staging
  production         Deploy to production

Options:
  --skip-tests       Skip running tests
  --skip-build       Skip building
  --dry-run          Show what would be deployed
  --help, -h         Show this help message

Examples:
  bun run deploy.ts staging
  bun run deploy.ts production --skip-tests
`);
    process.exit(0);
  }

  const env = args[0] || 'staging';
  const skipTests = args.includes('--skip-tests');
  const skipBuild = args.includes('--skip-build');
  const dryRun = args.includes('--dry-run');

  try {
    console.log(`Deploying to ${env}...`);

    if (!skipTests) {
      console.log('Running tests...');
      await $`npm test`;
    }

    if (!skipBuild) {
      console.log('Building application...');
      await $`npm run build`;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would deploy to ${env}`);
    } else {
      console.log(`Deploying to ${env}...`);
      // Add actual deployment logic here
      await $`echo "Deploy to ${env}"`;
    }

    console.log(`✓ Deployment to ${env} complete!`);
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

main();
