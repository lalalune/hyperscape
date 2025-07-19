#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎮 Setting up RPG World for Hyperfy...');

const rootDir = path.join(__dirname, '../');
const worldDir = path.join(rootDir, 'rpg-world');
const assetsDir = path.join(worldDir, 'assets');
const collectionsDir = path.join(worldDir, 'collections');
const defaultCollectionDir = path.join(collectionsDir, 'default');

// Ensure directories exist
console.log('📂 Creating world directories...');
await fs.ensureDir(worldDir);
await fs.ensureDir(assetsDir);
await fs.ensureDir(collectionsDir);
await fs.ensureDir(defaultCollectionDir);

// Copy base Hyperfy assets
const hyperfyAssetsDir = path.join(rootDir, '..', 'hyperfy', 'src', 'world', 'assets');
if (await fs.exists(hyperfyAssetsDir)) {
  console.log('📦 Copying base Hyperfy assets...');
  await fs.copy(hyperfyAssetsDir, assetsDir);
}

// Copy base Hyperfy collections 
const hyperfyCollectionsDir = path.join(rootDir, '..', 'hyperfy', 'src', 'world', 'collections', 'default');
if (await fs.exists(hyperfyCollectionsDir)) {
  console.log('📱 Copying base Hyperfy apps...');
  await fs.copy(hyperfyCollectionsDir, defaultCollectionDir);
}

// Copy our RPG apps
const rpgAppsDir = path.join(rootDir, 'hyp-apps');
if (await fs.exists(rpgAppsDir)) {
  console.log('🎯 Adding RPG apps to collections...');
  
  // Copy RPG .hyp files
  const rpgFiles = await fs.readdir(rpgAppsDir);
  for (const file of rpgFiles) {
    if (file.endsWith('.hyp')) {
      const srcPath = path.join(rpgAppsDir, file);
      const destPath = path.join(defaultCollectionDir, file);
      await fs.copy(srcPath, destPath);
      console.log(`  ✅ Added ${file}`);
    }
  }
  
  // Update the manifest to include RPG apps
  const manifestPath = path.join(defaultCollectionDir, 'manifest.json');
  const manifest = await fs.readJSON(manifestPath);
  
  // Add RPG apps to the manifest if they're not already there
  const rpgApps = ['RPGPlayer.hyp', 'RPGGoblin.hyp'];
  for (const appFile of rpgApps) {
    if (!manifest.apps.includes(appFile)) {
      manifest.apps.push(appFile);
    }
  }
  
  await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
  console.log('  ✅ Updated manifest with RPG apps');
}

// Create world manifest
const worldManifest = {
  name: "RPG World",
  description: "A complete RuneScape-inspired RPG world built on Hyperfy",
  version: "1.0.0",
  author: "Hyperscape Team"
};

await fs.writeJSON(path.join(worldDir, 'manifest.json'), worldManifest, { spaces: 2 });

console.log('✅ RPG World setup complete!');
console.log(`📂 World directory: ${worldDir}`);
console.log('🚀 Ready to start Hyperfy server with: bun run hyperfy:start');