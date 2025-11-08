#!/usr/bin/env bun

/**
 * Database Migration Creator
 * Creates new migration files with templates
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
Database Migration Creator

Usage:
  bun run create-migration.ts <name> [options]

Options:
  --dir <path>       Migration directory (default: ./migrations)
  --help, -h         Show this help message

Examples:
  bun run create-migration.ts add-users-table
  bun run create-migration.ts update-schema --dir ./db/migrations
`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const name = args[0];
  const migrationDir = args[args.indexOf('--dir') + 1] || './migrations';
  const timestamp = Date.now();
  const filename = `${timestamp}_${name}.sql`;

  try {
    await mkdir(migrationDir, { recursive: true });

    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Up Migration
-- Add your SQL here


-- Down Migration
-- Add rollback SQL here

`;

    const filepath = join(migrationDir, filename);
    await writeFile(filepath, template);

    console.log(`✓ Created migration: ${filepath}`);
  } catch (error) {
    console.error('Failed to create migration:', error);
    process.exit(1);
  }
}

main();
