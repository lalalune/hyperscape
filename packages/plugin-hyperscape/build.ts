#!/usr/bin/env bun

/**
 * Build script using bun build
 * Replaces tsup with native bun build functionality
 */

import { $ } from 'bun';
import { buildConfig } from './build.config';

async function build() {
  console.log('🏗️  Building package...');

  // Clean dist directory
  await $`rm -rf dist`;

  // Build with bun
  const result = await Bun.build(buildConfig);

  if (!result.success) {
    console.error('❌ Build failed:');
    for (const message of result.logs) {
      console.error(message);
    }
    process.exit(1);
  }

  console.log(`✅ Built ${result.outputs.length} files`);

  // Generate TypeScript declarations
  console.log('📝 Generating TypeScript declarations...');
  // Use the existing tsconfig.json and emit declarations only
  await $`tsc --project tsconfig.json --emitDeclarationOnly`;
  console.log('✅ TypeScript declarations generated');

  console.log('✅ Build complete!');
}

build().catch(console.error);
