#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const hyperfyDir = join(rootDir, 'temp-hyperfy');
const targetDir = join(rootDir, 'src', 'hyperfy');

console.log('🚀 Building Hyperfy from source...\n');

try {
  // Clean up any existing temp directory
  if (existsSync(hyperfyDir)) {
    console.log('📦 Cleaning up existing temp directory...');
    rmSync(hyperfyDir, { recursive: true, force: true });
  }

  // Clone Hyperfy repository
  console.log('📥 Cloning Hyperfy repository...');
  execSync(`git clone https://github.com/lalalune/hyperfy.git ${hyperfyDir}`, {
    stdio: 'inherit',
  });

  // Install dependencies
  console.log('\n📦 Installing dependencies...');
  execSync('npm install', {
    cwd: hyperfyDir,
    stdio: 'inherit',
  });

  // Build Hyperfy
  console.log('\n🔨 Building Hyperfy...');
  execSync('npm run build', {
    cwd: hyperfyDir,
    stdio: 'inherit',
  });

  // Create target directory if it doesn't exist
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Copy built files to plugin
  console.log('\n📋 Copying built files to plugin...');

  // Copy core modules
  const coreSrc = join(hyperfyDir, 'packages', 'core', 'src');
  if (existsSync(coreSrc)) {
    cpSync(coreSrc, join(targetDir, 'src', 'core'), { recursive: true });
    console.log('✅ Copied core modules');
  }

  // Copy client modules
  const clientSrc = join(hyperfyDir, 'packages', 'client', 'src');
  if (existsSync(clientSrc)) {
    cpSync(clientSrc, join(targetDir, 'src', 'client'), { recursive: true });
    console.log('✅ Copied client modules');
  }

  // Copy any built dist files
  const distDir = join(hyperfyDir, 'dist');
  if (existsSync(distDir)) {
    cpSync(distDir, join(targetDir, 'dist'), { recursive: true });
    console.log('✅ Copied dist files');
  }

  // Clean up temp directory
  console.log('\n🧹 Cleaning up temp directory...');
  rmSync(hyperfyDir, { recursive: true, force: true });

  console.log('\n✨ Hyperfy build complete!');
  console.log(`📁 Files copied to: ${targetDir}`);
} catch (error) {
  console.error('\n❌ Build failed:', error.message);

  // Clean up on error
  if (existsSync(hyperfyDir)) {
    rmSync(hyperfyDir, { recursive: true, force: true });
  }

  process.exit(1);
}

// Create a simple package.json for the hyperfy module
const packageJson = {
  name: '@eliza/hyperfy-core',
  version: '1.0.0',
  type: 'module',
  private: true,
  description: 'Hyperfy core modules for ElizaOS plugin',
};

import { writeFileSync } from 'fs';
writeFileSync(join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2));

console.log('\n📝 Created package.json for hyperfy module');
