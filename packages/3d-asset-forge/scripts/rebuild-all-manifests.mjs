#!/usr/bin/env node

/**
 * Rebuild All Manifests
 * Scans all assets in forge/ directory and regenerates all manifest files
 * This is useful when the manifest format changes or to rebuild from scratch
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { ManifestService } from '../server/services/ManifestService.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  console.log('🔄 Rebuilding all manifests from forge assets...\n')
  
  const assetsDir = path.join(__dirname, '../../hyperscape/world/assets')
  const forgeDir = path.join(assetsDir, 'forge')
  const manifestsDir = path.join(assetsDir, 'manifests')
  
  // Initialize manifest service
  const manifestService = new ManifestService(assetsDir)
  
  // Clear existing manifests (backup first)
  console.log('📦 Backing up existing manifests...')
  const backupDir = path.join(manifestsDir, 'backup-' + Date.now())
  await fs.mkdir(backupDir, { recursive: true })
  
  const manifestFiles = ['items.json', 'mobs.json', 'npcs.json', 'resources.json', 'buildings.json', 'avatars.json']
  for (const file of manifestFiles) {
    const filePath = path.join(manifestsDir, file)
    try {
      await fs.copyFile(filePath, path.join(backupDir, file))
      console.log(`  ✓ Backed up ${file}`)
    } catch (error) {
      // File doesn't exist yet
    }
  }
  
  // Clear manifests
  console.log('\n🗑️  Clearing manifests...')
  for (const file of manifestFiles) {
    const filePath = path.join(manifestsDir, file)
    try {
      await fs.writeFile(filePath, '[]')
      console.log(`  ✓ Cleared ${file}`)
    } catch (error) {
      // Ignore
    }
  }
  
  // Scan forge directory
  console.log('\n🔍 Scanning forge assets...')
  let assetDirs = []
  try {
    assetDirs = await fs.readdir(forgeDir)
  } catch (error) {
    console.error('❌ Failed to read forge directory:', error.message)
    return
  }
  
  let processed = 0
  let skipped = 0
  let errors = 0
  
  for (const assetDir of assetDirs) {
    if (assetDir.startsWith('.')) {
      skipped++
      continue
    }
    
    const assetPath = path.join(forgeDir, assetDir)
    
    try {
      const stats = await fs.stat(assetPath)
      if (!stats.isDirectory()) {
        skipped++
        continue
      }
      
      // Load metadata
      const metadataPath = path.join(assetPath, 'metadata.json')
      let metadata = {}
      try {
        const raw = await fs.readFile(metadataPath, 'utf-8')
        metadata = JSON.parse(raw)
      } catch (e) {
        console.warn(`  ⚠️  No metadata for ${assetDir}, using defaults`)
      }
      
      // Create minimal config from metadata
      const config = {
        name: metadata.name || assetDir,
        type: metadata.type || 'weapon',
        subtype: metadata.subtype || 'sword',
        description: metadata.description || `A ${metadata.name || assetDir}`,
        metadata: metadata
      }
      
      // Write to appropriate manifest
      await manifestService.writeManifest(assetDir, metadata, config)
      processed++
      
      console.log(`  ✓ Processed ${assetDir} → ${config.type}/${config.subtype}`)
      
    } catch (error) {
      console.error(`  ❌ Failed to process ${assetDir}:`, error.message)
      errors++
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('REBUILD COMPLETE')
  console.log('='.repeat(60))
  console.log(`Processed: ${processed}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors: ${errors}`)
  console.log('')
  console.log(`Manifests saved to: ${manifestsDir}`)
  console.log(`Backup saved to: ${backupDir}`)
  console.log('='.repeat(60) + '\n')
  
  // Show manifest summary
  console.log('📊 Manifest Summary:')
  for (const file of manifestFiles) {
    const filePath = path.join(manifestsDir, file)
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(raw)
      console.log(`  ${file}: ${data.length} entries`)
    } catch (error) {
      console.log(`  ${file}: 0 entries`)
    }
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

