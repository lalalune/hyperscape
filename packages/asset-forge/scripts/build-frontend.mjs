#!/usr/bin/env bun
/**
 * Frontend Build Script using Bun
 * Bundles React frontend for production deployment
 */

import { $ } from 'bun';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';

console.log('🚀 Building frontend with Bun...\n');

// Clean dist directory
if (existsSync('dist')) {
  console.log('🧹 Cleaning dist directory...');
  await rm('dist', { recursive: true, force: true });
}

// Create dist directory
await mkdir('dist', { recursive: true });

// Use Vite for building (Bun will run it faster)
// Vite is still the best React bundler, but Bun runs it much faster
console.log('📦 Bundling with Vite (via Bun)...');
await $`bun --bun vite build`;

console.log('\n✅ Frontend build complete!');
