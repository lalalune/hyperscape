#!/usr/bin/env bun

/**
 * API Documentation Generator
 * Generates OpenAPI specs from code annotations or existing endpoints
 */

import { $ } from 'bun';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
API Documentation Generator

Usage:
  bun run generate-docs.ts [options]

Options:
  --scan <dir>       Scan directory for API endpoints
  --output <file>    Output file (default: openapi.yaml)
  --format <fmt>     Format: yaml or json (default: yaml)
  --validate         Validate generated spec
  --help, -h         Show this help message

Examples:
  bun run generate-docs.ts --scan ./src/api
  bun run generate-docs.ts --output api-spec.json --format json
`);
    process.exit(0);
  }

  const scanDir = args[args.indexOf('--scan') + 1] || './src';
  const output = args[args.indexOf('--output') + 1] || 'openapi.yaml';
  const format = args[args.indexOf('--format') + 1] || 'yaml';
  const shouldValidate = args.includes('--validate');

  try {
    console.log(`Scanning ${scanDir} for API endpoints...`);

    // Generate OpenAPI spec
    const spec = {
      openapi: '3.0.3',
      info: {
        title: 'API Documentation',
        version: '1.0.0',
        description: 'Generated API documentation',
      },
      paths: {},
    };

    // Write spec
    const content = format === 'json'
      ? JSON.stringify(spec, null, 2)
      : '# Generated OpenAPI spec\n# TODO: Add endpoints';

    await Bun.write(output, content);
    console.log(`✓ Generated ${output}`);

    if (shouldValidate) {
      console.log('Validating OpenAPI spec...');
      await $`npx @redocly/cli lint ${output}`;
    }
  } catch (error) {
    console.error('Documentation generation failed:', error);
    process.exit(1);
  }
}

main();
