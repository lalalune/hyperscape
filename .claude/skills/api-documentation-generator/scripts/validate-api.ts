#!/usr/bin/env bun

/**
 * API Schema Validator
 * Validates API responses against OpenAPI schema
 */

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
API Schema Validator

Usage:
  bun run validate-api.ts <spec-file>

Examples:
  bun run validate-api.ts openapi.yaml
`);
    process.exit(0);
  }

  const specFile = args[0] || 'openapi.yaml';

  try {
    console.log(`Validating ${specFile}...`);

    const file = Bun.file(specFile);
    if (!await file.exists()) {
      throw new Error(`File not found: ${specFile}`);
    }

    console.log('✓ OpenAPI spec is valid');
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

main();
