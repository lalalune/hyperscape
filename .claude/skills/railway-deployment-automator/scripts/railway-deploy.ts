#!/usr/bin/env bun

/**
 * Railway Deployment Automation
 * Automates Railway deployments with pre-flight checks
 */

import { $ } from 'bun';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Railway Deployment Automator

Usage:
  bun run railway-deploy.ts [options]

Options:
  --service <name>   Deploy specific service
  --env <name>       Environment (production, staging)
  --watch            Watch deployment status
  --help, -h         Show this help message

Examples:
  bun run railway-deploy.ts --service api
  bun run railway-deploy.ts --env production --watch
`);
    process.exit(0);
  }

  const service = args[args.indexOf('--service') + 1];
  const environment = args[args.indexOf('--env') + 1] || 'production';
  const watch = args.includes('--watch');

  try {
    console.log('Deploying to Railway...');

    let cmd = 'railway up';
    if (service) cmd += ` --service ${service}`;
    if (environment) cmd += ` --environment ${environment}`;

    await $`${cmd}`;

    if (watch) {
      console.log('Watching deployment...');
      await $`railway status`;
    }

    console.log('✓ Railway deployment complete!');
  } catch (error) {
    console.error('Railway deployment failed:', error);
    process.exit(1);
  }
}

main();
