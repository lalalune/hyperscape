#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const HYPERFY_REPO = 'https://github.com/lalalune/hyperfy.git';
const BUILD_DIR = join(rootDir, '.hyperfy-build');
const OUTPUT_DIR = join(rootDir, 'dist', 'hyperfy');

console.log('🚀 Building Hyperfy from source...\n');

try {
  // Clean build directory
  if (existsSync(BUILD_DIR)) {
    console.log('🧹 Cleaning previous build...');
    rmSync(BUILD_DIR, { recursive: true, force: true });
  }
  mkdirSync(BUILD_DIR, { recursive: true });

  // Clone repository
  console.log('📦 Cloning Hyperfy repository...');
  execSync(`git clone ${HYPERFY_REPO} ${BUILD_DIR}`, { stdio: 'inherit' });

  // Navigate to build directory
  process.chdir(BUILD_DIR);

  // Install dependencies
  console.log('\n📚 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  // Build the project
  console.log('\n🔨 Building Hyperfy...');
  execSync('npm run build', { stdio: 'inherit' });

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Copy built files
  console.log('\n📋 Copying built files...');

  // Copy client build
  if (existsSync(join(BUILD_DIR, 'dist'))) {
    execSync(`cp -r ${join(BUILD_DIR, 'dist')}/* ${OUTPUT_DIR}`, { stdio: 'inherit' });
  }

  // Copy necessary runtime files
  const runtimeFiles = ['src/core', 'src/client', 'src/server'];

  runtimeFiles.forEach((file) => {
    const source = join(BUILD_DIR, file);
    if (existsSync(source)) {
      const dest = join(OUTPUT_DIR, file);
      mkdirSync(dirname(dest), { recursive: true });
      execSync(`cp -r ${source} ${dest}`, { stdio: 'inherit' });
    }
  });

  // Navigate back
  process.chdir(rootDir);

  // Clean up build directory
  console.log('\n🧹 Cleaning up...');
  rmSync(BUILD_DIR, { recursive: true, force: true });

  console.log('\n✅ Hyperfy built successfully!');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log('\n📝 Next steps:');
  console.log('1. The built Hyperfy files are in dist/hyperfy/');
  console.log('2. You can now import Hyperfy modules from this local build');
  console.log('3. Update your imports to use the local build if needed');
} catch (error) {
  console.error('\n❌ Build failed:', error.message);

  // Clean up on failure
  if (existsSync(BUILD_DIR)) {
    rmSync(BUILD_DIR, { recursive: true, force: true });
  }

  process.exit(1);
}
